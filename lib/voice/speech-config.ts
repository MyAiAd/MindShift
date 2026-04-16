export type StrictSpeechMode = boolean;
export type SpeechToTextProvider = 'existing' | 'openai';
export type TextToSpeechProvider = 'existing' | 'openai';

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
