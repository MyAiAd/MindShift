export type StrictSpeechMode = boolean;
export type SpeechToTextProvider = 'existing' | 'openai';
export type TextToSpeechProvider = 'existing' | 'openai';

/**
 * V9-only: which of the three v9 TTS provider implementations is active.
 * Read by `lib/voice/tts-providers/index.ts` (`resolveTtsProviderId`).
 * Distinct from `TTS_PROVIDER`, which controls the legacy v4..v7 code
 * paths and their limited ('existing' | 'openai') enumeration.
 */
export type V9TtsProvider = 'openai' | 'elevenlabs' | 'kokoro';

/**
 * V9-only: which STT provider the voice adapter should use. `openai` is
 * OpenAI's hosted transcription; `whisper-local` routes audio to the
 * self-hosted `whisper-service/` at `WHISPER_SERVICE_URL`.
 *
 * Read by `lib/voice/stt-providers/index.ts` (`resolveSttProviderId`)
 * and by `lib/v9/voice-settings.ts` when the DB singleton is missing.
 */
export type V9SttProvider = 'openai' | 'whisper-local';

function parseBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return defaultValue;
}

function parseProvider<T extends string>(
  value: string | undefined,
  allowedValues: readonly T[],
  defaultValue: T
): T {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase() as T;
  return allowedValues.includes(normalized) ? normalized : defaultValue;
}

export const STRICT_SPEECH_MODE: StrictSpeechMode = parseBooleanFlag(
  process.env.STRICT_SPEECH_MODE,
  true
);

export const STT_PROVIDER: SpeechToTextProvider = parseProvider<SpeechToTextProvider>(
  process.env.STT_PROVIDER,
  ['existing', 'openai'],
  'openai'
);

export const TTS_PROVIDER: TextToSpeechProvider = parseProvider<TextToSpeechProvider>(
  process.env.TTS_PROVIDER,
  ['existing', 'openai'],
  'openai'
);

/**
 * V9_TTS_PROVIDER — env toggle read by `resolveTtsProviderId` when no
 * explicit `?provider=` override is supplied on a TTS request. Set this
 * at deploy time to steer a fleet (or a single pod) onto OpenAI TTS,
 * ElevenLabs, or Kokoro. If unset, falls back to `TTS_PROVIDER` above;
 * if that is also unset, defaults to `openai`.
 *
 *   V9_TTS_PROVIDER=openai      — default; requires OPENAI_API_KEY
 *   V9_TTS_PROVIDER=elevenlabs  — requires ELEVENLABS_API_KEY
 *   V9_TTS_PROVIDER=kokoro      — requires KOKORO_SERVICE_URL
 */
export const V9_TTS_PROVIDER: V9TtsProvider = parseProvider<V9TtsProvider>(
  process.env.V9_TTS_PROVIDER,
  ['openai', 'elevenlabs', 'kokoro'],
  'openai'
);

/**
 * V9_STT_PROVIDER — env fallback for the V9 STT choice, used by
 * `lib/v9/voice-settings.ts` when the DB singleton hasn't been
 * configured yet. When the admin UI writes to `system_voice_settings`
 * that DB value wins; this env var only matters on fresh installs or
 * in CI where no super_admin has flipped the radio yet.
 *
 *   V9_STT_PROVIDER=openai         — default; requires OPENAI_API_KEY
 *   V9_STT_PROVIDER=whisper-local  — requires WHISPER_SERVICE_URL
 */
export const V9_STT_PROVIDER: V9SttProvider = parseProvider<V9SttProvider>(
  process.env.V9_STT_PROVIDER,
  ['openai', 'whisper-local'],
  'openai'
);

export function getStrictSpeechMode(): StrictSpeechMode {
  return STRICT_SPEECH_MODE;
}

export function getSttProvider(): SpeechToTextProvider {
  return STT_PROVIDER;
}

export function getTtsProvider(): TextToSpeechProvider {
  return TTS_PROVIDER;
}

export function getFallbackSttProvider(): SpeechToTextProvider {
  return STT_PROVIDER === 'openai' ? 'existing' : STT_PROVIDER;
}

export function getFallbackTtsProvider(): TextToSpeechProvider {
  return TTS_PROVIDER === 'openai' ? 'existing' : TTS_PROVIDER;
}

export function getV9TtsProvider(): V9TtsProvider {
  return V9_TTS_PROVIDER;
}

export function getV9SttProvider(): V9SttProvider {
  return V9_STT_PROVIDER;
}
