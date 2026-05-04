/**
 * SttProvider is the unified interface every V9 speech-to-text backend
 * must implement.
 *
 * Why a dedicated V9 registry instead of calling providers directly:
 *
 *   - Lets the admin UI switch STT between OpenAI (hosted) and
 *     `whisper-local` (self-hosted `whisper-service/`) with a single
 *     radio flip, no redeploy.
 *   - Keeps the V2-V9 text parity gate intact: providers only produce
 *     the `userInput` string that V2's state machine consumes. They do
 *     NOT produce `scriptedResponse` text, so they cannot drift from
 *     the doctor script.
 *   - Makes cost instrumentation uniform: every provider reports
 *     characters / seconds / latency in the same shape.
 *
 * Hallucination filtering is applied OUTSIDE the provider, by
 * `lib/voice/openai-hallucination.ts`, on the common segment shape
 * both OpenAI and self-hosted Whisper return. That way the patient is
 * protected from the v5 "Welsh text on silence" regression no matter
 * which provider is selected.
 */

import type { OpenAISegment } from '@/lib/voice/openai-hallucination';

export type SttProviderId = 'openai' | 'whisper-local' | 'elevenlabs';

export interface SttTranscribeRequest {
  /** Raw audio blob uploaded by the client. */
  audio: Blob;
  /** Current V2 step id — used as prompt-bias hint. */
  currentStep?: string | null;
  /** V2 expected-response-type hint (`yesno` / `open` / ...). */
  expectedResponseType?: string | null;
  /** Comma-separated hot-words for the transcription engine. */
  hotwords?: string | null;
  /** Abort signal so the caller can cancel in-flight requests. */
  signal?: AbortSignal;
}

export interface SttCostMetrics {
  /** Audio duration in seconds (as reported by the provider). */
  audioSeconds: number;
  /** Characters in the returned transcript. */
  characters: number;
  /** Estimated USD cost for this STT call. */
  estimatedUsd: number;
  /** Wall-clock latency in ms (request start to response end). */
  latencyMs: number;
}

export interface SttTranscribeResult {
  /** Verbatim transcript text. Hallucination filtering happens after. */
  text: string;
  /** Per-segment data used by the hallucination gate. */
  segments: OpenAISegment[];
  /** Language code (e.g. "en"). */
  language: string;
  /** Audio duration in seconds. */
  durationSeconds: number;
  /** Provider id that actually ran. */
  provider: SttProviderId;
  /** Provider-specific model identifier. */
  model: string;
  /** Cost + timing metrics. */
  cost: SttCostMetrics;
}

export interface SttProvider {
  readonly id: SttProviderId;
  readonly displayName: string;
  /**
   * Return true iff this provider is usable in the current environment
   * (API key present / local service URL reachable). A provider that
   * reports not available must never be selected as the active provider.
   */
  isAvailable(): boolean;

  transcribe(request: SttTranscribeRequest): Promise<SttTranscribeResult>;
}
