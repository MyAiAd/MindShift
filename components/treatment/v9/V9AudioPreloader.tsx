'use client';

import { useEffect } from 'react';
import { globalAudioCache } from '@/services/voice/audioCache';
import { getVoiceCacheName } from '@/lib/voice/voice-cache-name';
import {
  listCanonicalTextsForVoice,
  preloadVoiceManifests,
} from '@/lib/v9/static-audio-resolver';

/**
 * V9 Audio Preloader (R13.2 of `docs/prd-v9-ux-restoration.md`).
 *
 * Differences from `V7AudioPreloader.tsx`:
 *
 *   1. No `V7_STATIC_AUDIO_TEXTS` import. The preloader is purely
 *      hash-driven — it asks the resolver (R13.1) for every canonical
 *      text / asset pair available for the selected voice and
 *      preloads each one into the shared `globalAudioCache`.
 *
 *   2. Phase 1 hit source: the resolver returns V7's manifest
 *      entries (V9 manifest absent). Phase 2 (R13.5) adds a
 *      V9-specific manifest; the resolver prefers V9 on hash
 *      collision. Either way the preloader code stays the same.
 *
 *   3. Cache keys match V7's `${getVoiceCacheName(voice)}:${text}`
 *      format exactly so the runtime lookup inside
 *      `useNaturalVoice.playAudioSegment()` finds preloaded assets
 *      without needing a V9-specific code path. In Phase 1 this is
 *      safe because V9's preloader only pulls from V7's manifest —
 *      the cached audio is byte-identical to what V7's preloader
 *      would have stored. Phase 2 (R13.5) introduces a V9-specific
 *      manifest; at that point any V9/V7 hash collision is resolved
 *      deterministically in `resolveStaticAudio` (V9 wins), so the
 *      cache sees the V9 asset whether it was primed by V7 or V9
 *      code paths.
 *
 *   4. Respects the admin-pinned TTS provider surface: if the voice
 *      has no static assets (e.g. custom ElevenLabs voice), the
 *      resolver returns an empty canonical-text list and the
 *      preloader is a no-op. Runtime TTS then covers every turn.
 */

// V7 shipped with `INITIAL_WELCOME` truncation; V9 must render
// exactly what the backend returned (R7). The preloader therefore
// never primes an `INITIAL_WELCOME` cache entry either — if V9's
// backend happens to emit a string that hashes to that same entry,
// the resolver would still find it via its hash index at play time.
// Stored as a plain array so this file stays ES5-iteration-safe
// (tsconfig targets ES5 so `Set<string>` spread isn't allowed).
const MANIFEST_SKIP_KEYS: readonly string[] = ['INITIAL_WELCOME'];

interface V9AudioPreloaderProps {
  /**
   * Voice identifier (one of the short-form names used under
   * `/audio/v7/static/<voice>/`, e.g. `marin`, `heart`, `michael`,
   * `shimmer`). Defaults to `marin` to match V7's current pinned
   * default.
   */
  voice?: string;
}

export default function V9AudioPreloader({
  voice = 'marin',
}: V9AudioPreloaderProps) {
  useEffect(() => {
    let cancelled = false;
    const userAgent =
      typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOSClient =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent));

    const chooseFormatPath = (assetPath: string): string => {
      // Resolver already returned the preferred format per voice (opus
      // first, wav fallback). iOS still prefers wav because older
      // WebKit builds refused ogg/opus. The resolver gives us whatever
      // the manifest had; if we need to swap to wav on iOS, we derive
      // the sibling path from the filename.
      if (!isIOSClient) return assetPath;
      if (assetPath.endsWith('.wav')) return assetPath;
      if (assetPath.endsWith('.opus')) {
        return assetPath.replace(/\.opus$/, '.wav');
      }
      return assetPath;
    };

    const normalizeBlob = (blob: Blob, path: string): Blob => {
      if (path.endsWith('.wav')) {
        return blob.slice(0, blob.size, 'audio/wav');
      }
      const unsupportedOrGeneric =
        !blob.type ||
        blob.type === 'audio/opus' ||
        blob.type === 'application/opus' ||
        blob.type === 'application/octet-stream';
      if (!unsupportedOrGeneric) return blob;
      return blob.slice(0, blob.size, 'audio/ogg; codecs=opus');
    };

    const run = async () => {
      let successCount = 0;
      let skipCount = 0;
      let failCount = 0;

      console.log(`🎵 V9: Preloading static audio for voice "${voice}"`);

      try {
        await preloadVoiceManifests(voice);
        if (cancelled) return;
        const entries = await listCanonicalTextsForVoice(voice);
        if (cancelled) return;

        if (entries.length === 0) {
          console.log(
            `🎵 V9: No static manifest entries for "${voice}" — runtime TTS will cover every turn (Phase 1 behaviour for voices without baked assets).`,
          );
          return;
        }

        const voiceKey = getVoiceCacheName(voice);

        for (const entry of entries) {
          if (cancelled) return;

          // Preserve parity with V7's skiplist (saves a tiny bit of
          // bandwidth for the entry most likely never to be played).
          if (
            entry.canonicalText &&
            MANIFEST_SKIP_KEYS.some((k) =>
              entry.canonicalText.toLowerCase().includes(k.toLowerCase()),
            )
          ) {
            skipCount++;
            continue;
          }

          // V9's cache key matches what `useNaturalVoice.speak()` looks up:
          //   `${voiceName}:${text}`
          // By keeping the exact format V7 uses we avoid needing a V9-
          // specific lookup path inside the shared voice hook. Phase 2
          // will introduce V9-specific manifests but the resolver picks
          // V9-over-V7 on hash collision, so the cache entry is still
          // the V9 one.
          const cacheKey = `${voiceKey}:${entry.canonicalText}`;
          if (globalAudioCache.has(cacheKey)) {
            skipCount++;
            continue;
          }

          const assetPath = chooseFormatPath(entry.assetPath);
          try {
            const response = await fetch(assetPath);
            if (!response.ok) {
              throw new Error(
                `Failed to load ${assetPath}: HTTP ${response.status}`,
              );
            }
            const blob = normalizeBlob(await response.blob(), assetPath);
            const url = URL.createObjectURL(blob);
            globalAudioCache.set(cacheKey, url);
            successCount++;
          } catch (err) {
            failCount++;
            console.warn(
              `🎵 V9: preload failed for ${assetPath}`,
              err instanceof Error ? err.message : err,
            );
          }
        }

        console.log(
          `🎵 V9: preload complete (success=${successCount}, skip=${skipCount}, fail=${failCount}, entries=${entries.length})`,
        );
      } catch (err) {
        console.error(
          '❌ V9: audio preload error — runtime TTS will cover every turn:',
          err instanceof Error ? err.message : err,
        );
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [voice]);

  return null;
}
