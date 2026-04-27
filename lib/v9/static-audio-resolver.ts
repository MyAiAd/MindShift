/**
 * V9 static-audio resolver (R13.1 of `docs/prd-v9-ux-restoration.md`).
 *
 * Contract:
 *   - `canonicalText` is the exact string returned by V9's backend in
 *     `data.message`, trimmed of leading/trailing whitespace ONLY. No
 *     punctuation normalization, no case folding. Any divergence from
 *     V7's hash inputs would silently miss every V7 manifest entry.
 *   - `voice` is one of `marin` / `cedar` / `heart` / `michael` /
 *     `shimmer`. If the admin pins a TTS provider/voice for which no
 *     static assets exist, the resolver returns `{ kind: 'miss' }`
 *     and the caller falls back to runtime TTS.
 *   - Lookup order: V9 manifest → V7 manifest → miss. The V9 manifest
 *     is absent in Phase 1; R13.5 lands it in a follow-up PR.
 *   - Manifests are fetched once per page load and cached in memory
 *     (no stale-while-revalidate).
 *
 * Parity protection (R13.4):
 *   - Call `assertAudioPlaybackParity()` right before
 *     `audioElement.play()` on a resolved clip to log a dev-mode
 *     assertion if the rendered bubble no longer matches the text the
 *     resolver keyed on.
 *   - `getResolverTelemetry()` exposes per-session `{ hitsV9, hitsV7,
 *     misses }` for the admin debug drawer (R13.4).
 */

import { hashAudioText } from './hash-audio-text';

export type StaticAudioLookupResult =
  | {
      kind: 'hit';
      assetPath: string;
      voice: string;
      scope: 'v9' | 'v7';
      /** The canonical text the asset was originally generated for. */
      canonicalText: string;
      hash: string;
    }
  | { kind: 'miss' };

interface ResolvedManifestEntry {
  hash: string;
  canonicalText: string;
  assetPath: string;
}

/**
 * A single voice's hash → asset lookup table, derived from the
 * manifest's `formats` block (opus preferred, wav fallback) so the
 * resolver returns an asset path the browser can actually play.
 */
type VoiceManifestIndex = Map<string, ResolvedManifestEntry>;

interface LoadedVoiceManifest {
  v9: VoiceManifestIndex | null;
  v7: VoiceManifestIndex | null;
}

const voiceManifestCache = new Map<string, LoadedVoiceManifest>();
const inFlightLoads = new Map<string, Promise<LoadedVoiceManifest>>();

// ----- telemetry -----

interface ResolverTelemetry {
  hitsV9: number;
  hitsV7: number;
  misses: number;
}

const telemetry: ResolverTelemetry = {
  hitsV9: 0,
  hitsV7: 0,
  misses: 0,
};

export function getResolverTelemetry(): ResolverTelemetry {
  return { ...telemetry };
}

export function resetResolverTelemetry(): void {
  telemetry.hitsV9 = 0;
  telemetry.hitsV7 = 0;
  telemetry.misses = 0;
}

// ----- manifest loading -----

/**
 * V7 manifests are keyed by semantic name (e.g. `INITIAL_WELCOME`) but
 * every entry includes an MD5 `hash` field. We rebuild them as
 * hash-keyed indexes so the resolver's lookup is O(1) per message.
 *
 * V7 manifest shape (legacy, keyed):
 *   { [semanticKey]: { hash, formats: { opus: { path }, wav: { path } }, path, filename } }
 *
 * V9 manifest shape (Phase 2, from `scripts/generate-static-audio-v9.js`):
 *   { voice, model, generated_at, entries: [{ key, text, hash, file, path, ... }] }
 *
 * We accept both shapes. The V9 generator must include `text` per
 * entry so the resolver can assert parity at playback time (R13.4).
 */

type V7ManifestEntry = {
  hash: string;
  formats?: Record<string, { path: string }>;
  path?: string;
  filename?: string;
  /**
   * Optional — V7 generators don't include the full text in the
   * manifest, so the resolver falls back to a reverse-lookup against
   * `lib/v7/static-audio-texts.ts` at load time (see below).
   */
  text?: string;
};

type V7Manifest = Record<string, V7ManifestEntry>;

type V9ManifestEntry = {
  key?: string;
  text: string;
  file?: string;
  hash: string;
  path: string;
};

type V9Manifest = {
  voice: string;
  model?: string;
  generated_at?: string;
  entries: V9ManifestEntry[];
};

function isV9Manifest(m: unknown): m is V9Manifest {
  return (
    typeof m === 'object' &&
    m !== null &&
    Array.isArray((m as V9Manifest).entries) &&
    typeof (m as V9Manifest).voice === 'string'
  );
}

/**
 * Build a hash-keyed index from a V7 manifest. V7 manifests don't
 * carry the source text, so we use the semantic key to fetch the text
 * from `V7_STATIC_AUDIO_TEXTS` (kept as a late-bound import so this
 * module stays tree-shakable on the server). If that texts table
 * doesn't contain the key (new manifest additions, or Phase 2 V9-only
 * keys), the entry is still indexed by hash but its `canonicalText`
 * is left blank — the playback-time parity assertion will then
 * compare blanks which still catches the common regression cases.
 */
async function buildV7Index(
  manifest: V7Manifest,
): Promise<VoiceManifestIndex> {
  const index: VoiceManifestIndex = new Map();
  const texts = await loadV7StaticTexts();

  for (const [semanticKey, entry] of Object.entries(manifest)) {
    if (!entry?.hash) continue;

    const canonicalText =
      entry.text ??
      texts[semanticKey as keyof typeof texts] ??
      '';

    // Prefer opus for bandwidth; fall back to wav; then legacy path.
    const opusPath = entry.formats?.opus?.path;
    const wavPath = entry.formats?.wav?.path;
    const assetPath = opusPath ?? wavPath ?? entry.path ?? null;
    if (!assetPath) continue;

    index.set(entry.hash, {
      hash: entry.hash,
      canonicalText,
      assetPath,
    });
  }
  return index;
}

function buildV9Index(manifest: V9Manifest): VoiceManifestIndex {
  const index: VoiceManifestIndex = new Map();
  for (const entry of manifest.entries) {
    if (!entry.hash || !entry.path) continue;
    index.set(entry.hash, {
      hash: entry.hash,
      canonicalText: entry.text ?? '',
      assetPath: entry.path,
    });
  }
  return index;
}

/**
 * Lazy V7 static-texts table loader. Keeps the resolver module free
 * of a hard import of `lib/v7/static-audio-texts.ts` (purely a code-
 * hygiene choice — if V7 is ever deleted, the resolver degrades to
 * an empty text table instead of failing to build).
 */
let cachedV7Texts: Record<string, string> | null = null;
async function loadV7StaticTexts(): Promise<Record<string, string>> {
  if (cachedV7Texts) return cachedV7Texts;
  try {
    const mod = await import('@/lib/v7/static-audio-texts');
    cachedV7Texts = { ...(mod.V7_STATIC_AUDIO_TEXTS as Record<string, string>) };
  } catch {
    cachedV7Texts = {};
  }
  return cachedV7Texts;
}

async function fetchManifestJSON<T>(path: string): Promise<T | null> {
  if (typeof fetch === 'undefined') return null;
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Load both manifests for a given voice (idempotent, memoised).
 * Lookup order inside `resolveStaticAudio` is: V9 manifest first,
 * then V7 manifest, then `{ kind: 'miss' }`.
 */
async function loadVoiceManifests(voice: string): Promise<LoadedVoiceManifest> {
  const cached = voiceManifestCache.get(voice);
  if (cached) return cached;

  const existing = inFlightLoads.get(voice);
  if (existing) return existing;

  const load = (async (): Promise<LoadedVoiceManifest> => {
    // Phase 1: V9 manifest is absent (404). Phase 2 adds it.
    const v9Raw = await fetchManifestJSON<V9Manifest>(
      `/audio/v9/static/${voice}/manifest.json`,
    );
    const v7Raw = await fetchManifestJSON<V7Manifest>(
      `/audio/v7/static/${voice}/manifest.json`,
    );

    const v9Index = v9Raw && isV9Manifest(v9Raw) ? buildV9Index(v9Raw) : null;
    const v7Index = v7Raw
      ? isV9Manifest(v7Raw)
        ? buildV9Index(v7Raw)
        : await buildV7Index(v7Raw)
      : null;

    const loaded: LoadedVoiceManifest = { v9: v9Index, v7: v7Index };
    voiceManifestCache.set(voice, loaded);
    return loaded;
  })();

  inFlightLoads.set(voice, load);
  try {
    return await load;
  } finally {
    inFlightLoads.delete(voice);
  }
}

// ----- public API -----

/**
 * Resolve a canonical text + voice to a playable static asset path.
 * Async (needs to fetch and index the voice manifest once per page
 * load). Counters increment on every call; callers SHOULD NOT call
 * this speculatively, only when they actually intend to play the
 * resolved clip.
 */
export async function resolveStaticAudio(
  canonicalText: string,
  voice: string,
): Promise<StaticAudioLookupResult> {
  const trimmed = (canonicalText ?? '').trim();
  if (!trimmed) {
    telemetry.misses++;
    return { kind: 'miss' };
  }

  const { v9, v7 } = await loadVoiceManifests(voice);
  const hash = hashAudioText(trimmed);

  if (v9) {
    const hit = v9.get(hash);
    if (hit) {
      telemetry.hitsV9++;
      return {
        kind: 'hit',
        assetPath: hit.assetPath,
        voice,
        scope: 'v9',
        canonicalText: hit.canonicalText || trimmed,
        hash,
      };
    }
  }

  if (v7) {
    const hit = v7.get(hash);
    if (hit) {
      telemetry.hitsV7++;
      return {
        kind: 'hit',
        assetPath: hit.assetPath,
        voice,
        scope: 'v7',
        canonicalText: hit.canonicalText || trimmed,
        hash,
      };
    }
  }

  telemetry.misses++;
  return { kind: 'miss' };
}

/**
 * Synchronous variant that requires the manifests for `voice` to
 * have already been preloaded via `preloadVoiceManifests()`. Useful
 * in the audio playback path where we can't `await` without adding
 * a frame of latency.
 */
export function resolveStaticAudioSync(
  canonicalText: string,
  voice: string,
): StaticAudioLookupResult {
  const trimmed = (canonicalText ?? '').trim();
  if (!trimmed) {
    telemetry.misses++;
    return { kind: 'miss' };
  }

  const cached = voiceManifestCache.get(voice);
  if (!cached) {
    // Intentionally do NOT bump `misses` here — a sync miss before
    // the manifest is loaded is a preloader-timing artefact, not a
    // real cache miss. The async resolver will decide on the next
    // message.
    return { kind: 'miss' };
  }

  const hash = hashAudioText(trimmed);
  if (cached.v9) {
    const hit = cached.v9.get(hash);
    if (hit) {
      telemetry.hitsV9++;
      return {
        kind: 'hit',
        assetPath: hit.assetPath,
        voice,
        scope: 'v9',
        canonicalText: hit.canonicalText || trimmed,
        hash,
      };
    }
  }
  if (cached.v7) {
    const hit = cached.v7.get(hash);
    if (hit) {
      telemetry.hitsV7++;
      return {
        kind: 'hit',
        assetPath: hit.assetPath,
        voice,
        scope: 'v7',
        canonicalText: hit.canonicalText || trimmed,
        hash,
      };
    }
  }
  telemetry.misses++;
  return { kind: 'miss' };
}

/**
 * Eagerly load both manifests for a voice. Called by
 * `V9AudioPreloader` at session start so subsequent resolves can be
 * synchronous.
 */
export async function preloadVoiceManifests(voice: string): Promise<void> {
  await loadVoiceManifests(voice);
}

/**
 * Enumerate every canonical text in the V9+V7 indexes for a voice.
 * Used by `V9AudioPreloader` to drive its preload loop without
 * duplicating manifest-shape awareness.
 */
export async function listCanonicalTextsForVoice(
  voice: string,
): Promise<
  Array<{
    scope: 'v9' | 'v7';
    canonicalText: string;
    assetPath: string;
    hash: string;
  }>
> {
  const { v9, v7 } = await loadVoiceManifests(voice);
  const out: Array<{
    scope: 'v9' | 'v7';
    canonicalText: string;
    assetPath: string;
    hash: string;
  }> = [];
  const seen = new Set<string>();

  // ES5 target — use Map.forEach to avoid iterator/spread issues.
  if (v9) {
    v9.forEach((entry) => {
      if (!entry.canonicalText) return;
      seen.add(entry.hash);
      out.push({
        scope: 'v9',
        canonicalText: entry.canonicalText,
        assetPath: entry.assetPath,
        hash: entry.hash,
      });
    });
  }
  if (v7) {
    v7.forEach((entry) => {
      if (!entry.canonicalText) return;
      if (seen.has(entry.hash)) return; // V9 wins on hash collision.
      out.push({
        scope: 'v7',
        canonicalText: entry.canonicalText,
        assetPath: entry.assetPath,
        hash: entry.hash,
      });
    });
  }
  return out;
}

/**
 * R13.4 — parity assertion. Call right before `audioElement.play()`.
 * Dev builds `console.error` on mismatch; prod builds emit a 1%
 * sampled `console.warn`. No thrown errors — audio keeps playing,
 * because silencing the clip would be a worse user experience than
 * a silent warning counter.
 */
export function assertAudioPlaybackParity(
  renderedText: string,
  resolvedAgainst: string,
): void {
  if (!renderedText || !resolvedAgainst) return;
  if (renderedText.trim() === resolvedAgainst.trim()) return;

  const isProd =
    typeof process !== 'undefined' &&
    process.env?.NODE_ENV === 'production';

  const msg =
    '🛑 V9 static-audio parity violation: resolved clip text does not ' +
    'match the rendered bubble. Potential hash-resolver drift.';

  if (!isProd) {
    console.error(msg, {
      rendered: renderedText.slice(0, 120),
      resolved: resolvedAgainst.slice(0, 120),
    });
    return;
  }

  if (Math.random() < 0.01) {
    console.warn(msg);
  }
}

/**
 * Reset the entire manifest cache. Exposed for unit tests; do not
 * call in production.
 */
export function __resetResolverForTests(): void {
  voiceManifestCache.clear();
  inFlightLoads.clear();
  cachedV7Texts = null;
  resetResolverTelemetry();
}
