import { V9_STT_PROVIDER } from '@/lib/voice/speech-config';
import type { SttProvider, SttProviderId } from './types';
import { OpenAiSttProvider } from './openai';
import { WhisperLocalSttProvider } from './whisper';
import { ElevenLabsScribeSttProvider } from './elevenlabs-scribe';

export type { SttProvider, SttProviderId } from './types';
export type {
  SttTranscribeRequest,
  SttTranscribeResult,
  SttCostMetrics,
} from './types';

const registry: Record<SttProviderId, SttProvider> = {
  openai: new OpenAiSttProvider(),
  'whisper-local': new WhisperLocalSttProvider(),
  elevenlabs: new ElevenLabsScribeSttProvider(),
};

/**
 * Resolve the STT provider id for the current request.
 *
 * Precedence:
 *   1. explicit `requested` param (per-session override; used by the
 *      voice-adapter after reading the pinned pair from
 *      `context.metadata.voicePair`).
 *   2. `V9_STT_PROVIDER` env var (deploy-time default for fresh
 *      installs / CI where the DB singleton has not been set).
 *   3. hard-coded `'openai'`.
 *
 * Unavailability is NOT silently recovered: if the selected provider
 * can't run (missing API key / service URL), callers should fail loud
 * rather than switching behind the patient's back.
 */
export function resolveSttProviderId(
  requested?: string | null,
): SttProviderId {
  const valid = (v: string | null | undefined): v is SttProviderId =>
    v === 'openai' || v === 'whisper-local' || v === 'elevenlabs';

  if (valid(requested)) return requested;
  if (valid(V9_STT_PROVIDER)) return V9_STT_PROVIDER;
  return 'openai';
}

export function getSttProvider(id: SttProviderId): SttProvider {
  return registry[id];
}

export function listSttProviders(): SttProvider[] {
  return Object.values(registry);
}
