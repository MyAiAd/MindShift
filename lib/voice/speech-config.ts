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
