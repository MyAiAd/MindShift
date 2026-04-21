/**
 * US-006: Shared helper for building voice-prefixed cache keys.
 *
 * The TTS cache uses `${voiceName}:${text}` as the key so pre-generated static audio (one set
 * per voice) is looked up correctly. Previously the lookup code in `useNaturalVoice` maintained
 * a tiny two-entry map that fell through to the string "unknown" for every OpenAI voice, so
 * every real v7 session missed the cache. This helper is the single source of truth and is
 * imported by both the runtime (`useNaturalVoice`) and the preloader (`V7AudioPreloader`).
 *
 * For an unrecognised voice id we return the raw id (so cache keys still differ between voices
 * and one bad voice doesn't collapse into a shared "unknown" bucket) and log
 * `{ event: 'voice_id_unrecognized', voice_id }` so the signal is observable.
 */

const VOICE_CACHE_NAME_MAP: Record<string, string> = {
  // Kokoro voices (self-hosted, legacy)
  af_heart: 'heart',
  am_adam: 'adam',
  af_bella: 'bella',
  am_michael: 'michael',
  af_nova: 'nova',
  af_sarah: 'sarah',

  // OpenAI voices (v7 peak-fidelity). The cache name intentionally matches the voice id so the
  // generated static-audio filenames and the runtime keys agree for these voices.
  // `marin` and `cedar` are OpenAI's post-2025-03 top-tier voices (gpt-4o-mini-tts only);
  // ash/ballad/coral/sage/verse rounded out the same release. Adding them here lets the
  // preloader fetch `/audio/v7/static/<voice>/manifest.json` for any of them.
  alloy: 'alloy',
  ash: 'ash',
  ballad: 'ballad',
  coral: 'coral',
  echo: 'echo',
  fable: 'fable',
  nova: 'nova',
  onyx: 'onyx',
  sage: 'sage',
  shimmer: 'shimmer',
  verse: 'verse',
  marin: 'marin',
  cedar: 'cedar',

  // Short-form aliases that the UI sometimes supplies.
  heart: 'heart',
  michael: 'michael',
  adam: 'adam',
  bella: 'bella',
  sarah: 'sarah',
};

const OPENAI_VOICE_IDS = new Set([
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova',
  'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar',
]);

/**
 * Canonical cache name for a voice id. Always returns a non-empty, voice-specific string.
 *
 * @param voiceId  Voice identifier (Kokoro short id like "af_heart", OpenAI voice name like
 *                 "shimmer", or a UI-side alias like "heart").
 * @returns        Normalised cache name used as the prefix in `${voiceName}:${text}` keys.
 */
export function getVoiceCacheName(voiceId: string | null | undefined): string {
  if (!voiceId) {
    console.log(JSON.stringify({ event: 'voice_id_unrecognized', voice_id: String(voiceId) }));
    return 'default';
  }

  const mapped = VOICE_CACHE_NAME_MAP[voiceId];
  if (mapped) return mapped;

  console.log(JSON.stringify({ event: 'voice_id_unrecognized', voice_id: voiceId }));
  return voiceId;
}

/**
 * Whether the given voice id resolves to an OpenAI-native voice (i.e. shimmer/alloy/etc.).
 */
export function isOpenAIVoiceId(voiceId: string | null | undefined): boolean {
  if (!voiceId) return false;
  const mapped = VOICE_CACHE_NAME_MAP[voiceId] ?? voiceId;
  return OPENAI_VOICE_IDS.has(mapped);
}
