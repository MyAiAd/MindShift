import {
  detectOpenAIHallucination,
  type HallucinationDiagnostics,
} from '@/lib/voice/openai-hallucination';
import {
  getTtsProvider,
  resolveTtsProviderId,
  type TtsProviderId,
  type TtsSynthesisResult,
} from '@/lib/voice/tts-providers';
import {
  getSttProvider,
  resolveSttProviderId,
  type SttProviderId,
} from '@/lib/voice/stt-providers';
import { recordTtsCost } from '@/lib/v9/tts-cost-metrics';

/**
 * V9 voice adapter.
 *
 * String in, string out. The adapter is deliberately small: it turns
 * audio into a transcript (transcribeToUserInput) and turns a doctor
 * string into audio (speakScripted). It never rewrites either side.
 *
 * This file is the ONLY place in v9 where "voice" happens. Everything
 * else in the v9 stack (state machine, route, frontend) sees plain
 * strings, identical to v2. That is what keeps the v2-v9 parity gate
 * in CI meaningful.
 *
 * Provider choice (both STT and TTS) is pinned to a session at start
 * time and passed in via `providerId`. See
 * `lib/v9/core.ts#v9HandleStartSession` and
 * `lib/v9/voice-settings.ts#getVoicePair` for how the pair is
 * resolved and stored.
 */

export interface TranscribeOptions {
  /** Current v2 step id — used as part of the prompt bias. */
  currentStep?: string | null;
  /** `yesno` / `open` / etc — used as part of the prompt bias. */
  expectedResponseType?: string | null;
  /** Comma-separated hot-words for transcription. */
  hotwords?: string | null;
  /** Abort signal for client disconnects. */
  signal?: AbortSignal;
  /** Per-session STT provider (from `context.metadata.voicePair.stt`). */
  providerId?: SttProviderId | null;
}

export interface TranscribeResult {
  /** Final user-input string v2's state machine should receive. Empty
   *  string if the STT output was rejected by the hallucination gate. */
  userInput: string;
  /** Raw transcript before hallucination filtering. */
  rawTranscript: string;
  /** Hallucination filter diagnostics. */
  hallucination: HallucinationDiagnostics;
  /** Detected language from STT (used by the hallucination gate). */
  language: string;
  /** Audio duration in seconds if STT returned it. */
  durationSeconds: number;
  /** STT call latency in ms. */
  latencyMs: number;
  /** STT provider id that actually ran. */
  provider: SttProviderId;
  /** Provider-specific model identifier. */
  model: string;
  /** Estimated USD cost for this STT call. */
  estimatedUsd: number;
}

export interface SpeakScriptedOptions {
  /** Override the env/admin default TTS provider. */
  providerId?: TtsProviderId | null;
  /** Provider-specific voice id. */
  voice?: string | null;
  /** Output container. */
  format?: 'mp3' | 'wav' | 'pcm16' | 'aac' | 'opus';
  /** Session id for cost telemetry. */
  sessionId?: string;
  /** Step id for cost telemetry. */
  stepId?: string;
  signal?: AbortSignal;
}

export type SpeakScriptedResult = TtsSynthesisResult;

/**
 * Turn an audio blob into the `userInput` string V2's state machine
 * expects. Dispatches through the STT provider registry and applies
 * the existing hallucination gate regardless of which provider ran —
 * V9's answer to the v5/v7 "Welsh text on silence" regression.
 */
export async function transcribeToUserInput(
  audio: Blob,
  options: TranscribeOptions = {},
): Promise<TranscribeResult> {
  const providerId = resolveSttProviderId(options.providerId);
  const provider = getSttProvider(providerId);
  if (!provider.isAvailable()) {
    throw new Error(
      `STT provider "${providerId}" is not available in this environment.`,
    );
  }

  const result = await provider.transcribe({
    audio,
    currentStep: options.currentStep,
    expectedResponseType: options.expectedResponseType,
    hotwords: options.hotwords,
    signal: options.signal,
  });

  // Both providers normalise into the same segment shape so the
  // hallucination gate can be applied uniformly. The `'v7'` tag
  // activates the English-only rule the patient-facing treatment
  // flows require.
  const hallucination = detectOpenAIHallucination(
    result.text,
    result.language,
    result.segments,
    result.durationSeconds,
    'v7',
  );

  if (hallucination.filtered) {
    console.log(
      JSON.stringify({
        event: 'v9_stt_hallucination_filtered',
        reason: hallucination.reason,
        provider: result.provider,
        language: result.language,
        duration: result.durationSeconds,
        word_count: hallucination.wordCount,
        transcript_preview: result.text.slice(0, 80),
        model: result.model,
      }),
    );
  }

  return {
    userInput: hallucination.filtered ? '' : result.text,
    rawTranscript: result.text,
    hallucination,
    language: result.language,
    durationSeconds: result.durationSeconds,
    latencyMs: result.cost.latencyMs,
    provider: result.provider,
    model: result.model,
    estimatedUsd: result.cost.estimatedUsd,
  };
}

/**
 * Speak v2's scripted response, verbatim, via the configured provider.
 *
 * Callers are expected to already have the v2 state machine's raw output
 * and to pass it through unchanged. `speakScripted` does no linguistic
 * processing, no paraphrasing, no SSML injection.
 */
export async function speakScripted(
  text: string,
  options: SpeakScriptedOptions = {},
): Promise<SpeakScriptedResult> {
  const providerId = resolveTtsProviderId(options.providerId);
  const provider = getTtsProvider(providerId);
  if (!provider.isAvailable()) {
    throw new Error(
      `TTS provider "${providerId}" is not available in this environment.`,
    );
  }

  const result = await provider.synthesize({
    text,
    voice: options.voice ?? undefined,
    format: options.format ?? 'mp3',
    sessionId: options.sessionId,
    stepId: options.stepId,
    signal: options.signal,
  });

  recordTtsCost(
    options.sessionId,
    result.provider,
    result.voice,
    options.stepId,
    result.cost,
  );

  console.log(
    JSON.stringify({
      event: 'v9_tts_synth',
      provider: result.provider,
      voice: result.voice,
      characters: result.cost.characters,
      estimated_usd: result.cost.estimatedUsd,
      latency_ms: Math.round(result.cost.latencyMs),
      total_ms: Math.round(result.cost.totalMs),
      session_id: options.sessionId,
      step_id: options.stepId,
    }),
  );

  return result;
}
