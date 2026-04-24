/**
 * TtsProvider is the unified interface every v9 speech-synthesis backend
 * must implement.
 *
 * V9's principle is "doctor text is gospel" — so every provider receives
 * the SAME verbatim string that came out of v2's state machine and is
 * expected to return audio for THAT string, never a paraphrase. Providers
 * must not run any text rewrites.
 *
 * Cost instrumentation is first-class: the CostMetrics return value is
 * how we A/B test pricing between OpenAI TTS, ElevenLabs, and Kokoro at
 * deploy time, with real data, instead of guessing at architecture time.
 */

export type TtsVoiceId = string;

export type TtsAudioFormat = 'mp3' | 'wav' | 'pcm16' | 'aac' | 'opus';

export interface TtsSynthesisRequest {
  /** Verbatim doctor text from v2's state machine. Must not be modified. */
  text: string;
  /** Provider-specific voice identifier. */
  voice?: TtsVoiceId;
  /** Output container. mp3 is the most broadly compatible default. */
  format?: TtsAudioFormat;
  /** Session id for cost telemetry. */
  sessionId?: string;
  /** Step id for cost telemetry. */
  stepId?: string;
  /** Abort signal so the caller can cancel mid-synth (e.g. client disconnect). */
  signal?: AbortSignal;
}

export interface TtsCostMetrics {
  /** Raw character count sent to the provider. */
  characters: number;
  /** Provider-specific billing unit (tokens, credits, seconds). */
  providerUnits?: number;
  /** Estimated USD cost for this synth call, pre-discount. */
  estimatedUsd: number;
  /** Wall-clock time from request to first byte, in ms. */
  latencyMs: number;
  /** Total wall-clock time from request to last byte, in ms. */
  totalMs: number;
}

export interface TtsSynthesisResult {
  audio: Buffer;
  mimeType: string;
  provider: TtsProviderId;
  voice: TtsVoiceId;
  format: TtsAudioFormat;
  cost: TtsCostMetrics;
}

export type TtsProviderId = 'openai' | 'elevenlabs' | 'kokoro';

export interface TtsProvider {
  readonly id: TtsProviderId;
  readonly displayName: string;
  /**
   * Return true iff this provider can run in the current environment
   * (api keys present, local service reachable, etc). A provider that is
   * not available should never be selected as the active provider.
   */
  isAvailable(): boolean;

  synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult>;
}
