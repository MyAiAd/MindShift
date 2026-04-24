import type { TtsProvider, TtsProviderId } from './types';
import { OpenAiTtsProvider } from './openai';
import { ElevenLabsTtsProvider } from './elevenlabs';
import { KokoroTtsProvider } from './kokoro';

export type { TtsProvider, TtsProviderId } from './types';
export type {
  TtsAudioFormat,
  TtsCostMetrics,
  TtsSynthesisRequest,
  TtsSynthesisResult,
  TtsVoiceId,
} from './types';

/**
 * Provider registry. Keeping this a plain map (rather than re-importing
 * in each consumer) means a test or debug UI can call `listTtsProviders()`
 * to enumerate what is running without hard-coding the list.
 */
const registry: Record<TtsProviderId, TtsProvider> = {
  openai: new OpenAiTtsProvider(),
  elevenlabs: new ElevenLabsTtsProvider(),
  kokoro: new KokoroTtsProvider(),
};

/**
 * Resolve the provider id that should be used right now.
 *
 * Precedence:
 *   1. explicit `requested` param (usually `?provider=` on an API call)
 *   2. TTS_PROVIDER env var, if it names a supported v9 provider
 *   3. hard-coded default of 'openai' (available whenever OPENAI_API_KEY is set)
 *
 * We do NOT fall back implicitly to a different provider when the
 * requested one is unavailable — v9 wants predictable cost/UX per
 * session, so unavailability is an error the caller sees, not a silent
 * voice-switch.
 */
export function resolveTtsProviderId(
  requested?: string | null,
): TtsProviderId {
  const valid = (v: string | null | undefined): v is TtsProviderId =>
    v === 'openai' || v === 'elevenlabs' || v === 'kokoro';

  if (valid(requested)) return requested;

  const env = (process.env.V9_TTS_PROVIDER || process.env.TTS_PROVIDER || '')
    .trim()
    .toLowerCase();
  if (valid(env)) return env as TtsProviderId;

  return 'openai';
}

export function getTtsProvider(id: TtsProviderId): TtsProvider {
  return registry[id];
}

export function listTtsProviders(): TtsProvider[] {
  return Object.values(registry);
}
