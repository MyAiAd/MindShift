import {
  detectOpenAIHallucination,
  type OpenAISegment,
  type HallucinationDiagnostics,
} from '@/lib/voice/openai-hallucination';
import OpenAI from 'openai';
import {
  getTtsProvider,
  resolveTtsProviderId,
  type TtsProviderId,
  type TtsSynthesisResult,
} from '@/lib/voice/tts-providers';
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
 */

const DEFAULT_STT_MODEL = process.env.OPENAI_STT_MODEL || 'gpt-4o-mini-transcribe';

type OpenAITranscriptionRecord = {
  text?: string;
  language?: string;
  duration?: number;
  segments?: OpenAISegment[];
};

export interface TranscribeOptions {
  /** Current v2 step id — used as part of the prompt bias. */
  currentStep?: string | null;
  /** `yesno` / `open` / etc — used as part of the prompt bias. */
  expectedResponseType?: string | null;
  /** Comma-separated hot-words for transcription. */
  hotwords?: string | null;
  /** Forwards to OpenAI's AbortSignal. */
  signal?: AbortSignal;
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
  /** STT model actually used. */
  model: string;
}

export interface SpeakScriptedOptions {
  /** Override the env-default TTS provider. */
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

function buildSttPrompt(
  currentStep?: string | null,
  expectedResponseType?: string | null,
  hotwords?: string | null,
): string | undefined {
  const parts = [
    expectedResponseType ? `Expected response type: ${expectedResponseType}` : null,
    currentStep ? `Current step: ${currentStep}` : null,
    hotwords ? `Relevant terms: ${hotwords}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('\n') : undefined;
}

/**
 * Turn an audio blob into the `userInput` string V2's state machine
 * expects. Runs STT through OpenAI (configurable via OPENAI_STT_MODEL)
 * and applies the existing hallucination gate — v9's answer to the v5/v7
 * "Welsh text on silence" regression.
 */
export async function transcribeToUserInput(
  audio: Blob,
  options: TranscribeOptions = {},
): Promise<TranscribeResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured; v9 STT unavailable.');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = DEFAULT_STT_MODEL;
  const prompt = buildSttPrompt(
    options.currentStep,
    options.expectedResponseType,
    options.hotwords,
  );

  const file = new File([audio], 'audio.wav', {
    type: audio.type || 'audio/wav',
  });

  const start = performance.now();
  let transcription: OpenAITranscriptionRecord;
  try {
    transcription = (await openai.audio.transcriptions.create(
      {
        file,
        model,
        response_format: 'verbose_json',
        language: 'en',
        ...(prompt ? { prompt } : {}),
      } as Parameters<OpenAI['audio']['transcriptions']['create']>[0],
      { signal: options.signal },
    )) as unknown as OpenAITranscriptionRecord;
  } catch (err) {
    // verbose_json might not be supported on some future model — fall
    // back to plain json, at the cost of the metadata gates (2/3/4).
    const message = err instanceof Error ? err.message : String(err);
    if (!/verbose_json/i.test(message)) throw err;
    transcription = (await openai.audio.transcriptions.create(
      {
        file,
        model,
        response_format: 'json',
        language: 'en',
        ...(prompt ? { prompt } : {}),
      } as Parameters<OpenAI['audio']['transcriptions']['create']>[0],
      { signal: options.signal },
    )) as unknown as OpenAITranscriptionRecord;
  }
  const latencyMs = performance.now() - start;

  const rawTranscript = transcription.text ?? '';
  const language = transcription.language ?? 'en';
  const durationSeconds = typeof transcription.duration === 'number'
    ? transcription.duration
    : 0;
  const segments: OpenAISegment[] = Array.isArray(transcription.segments)
    ? transcription.segments
    : [];

  // Tag v9 explicitly so the existing gate applies the same "non-English
  // rejection" policy v7 uses for silent audio.
  const hallucination = detectOpenAIHallucination(
    rawTranscript,
    language,
    segments,
    durationSeconds,
    'v7',
  );

  if (hallucination.filtered) {
    console.log(
      JSON.stringify({
        event: 'v9_stt_hallucination_filtered',
        reason: hallucination.reason,
        language,
        duration: durationSeconds,
        word_count: hallucination.wordCount,
        transcript_preview: rawTranscript.slice(0, 80),
        model,
      }),
    );
  }

  return {
    userInput: hallucination.filtered ? '' : rawTranscript,
    rawTranscript,
    hallucination,
    language,
    durationSeconds,
    latencyMs: Math.round(latencyMs),
    model,
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
