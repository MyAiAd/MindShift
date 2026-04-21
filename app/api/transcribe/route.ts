import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { STT_PROVIDER } from '@/lib/voice/speech-config';
import {
  detectOpenAIHallucination,
  type OpenAISegment,
} from '@/lib/voice/openai-hallucination';

export const runtime = 'nodejs';
export const maxDuration = 30; // Vercel timeout handling

type SanitizedTranscriptionRequest = {
  audio: Blob;
  expectedResponseType: string | null;
  currentStep: string | null;
  hotwords: string | null;
  treatmentVersion: string | null;
  providerOverride: 'existing' | 'openai' | null;
};

function createOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function buildOpenAITranscriptionPrompt(request: SanitizedTranscriptionRequest): string | undefined {
  const promptParts = [
    request.expectedResponseType ? `Expected response type: ${request.expectedResponseType}` : null,
    request.currentStep ? `Current step: ${request.currentStep}` : null,
    request.hotwords ? `Relevant terms: ${request.hotwords}` : null,
  ].filter(Boolean);

  return promptParts.length > 0 ? promptParts.join('\n') : undefined;
}

async function parseRequest(request: NextRequest): Promise<SanitizedTranscriptionRequest> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const audio = formData.get('audio');
    if (!audio || !(audio instanceof Blob)) {
      throw new Error('Missing audio field in multipart body');
    }

    return {
      audio,
      expectedResponseType: typeof formData.get('expected_response_type') === 'string'
        ? (formData.get('expected_response_type') as string).trim().slice(0, 64)
        : null,
      currentStep: typeof formData.get('current_step') === 'string'
        ? (formData.get('current_step') as string).trim().slice(0, 128)
        : null,
      hotwords: typeof formData.get('hotwords') === 'string'
        ? (formData.get('hotwords') as string).trim().slice(0, 500)
        : null,
      treatmentVersion: typeof formData.get('treatment_version') === 'string'
        ? (formData.get('treatment_version') as string).trim()
        : null,
      providerOverride: typeof formData.get('provider') === 'string' &&
        ((formData.get('provider') as string) === 'existing' || (formData.get('provider') as string) === 'openai')
        ? formData.get('provider') as 'existing' | 'openai'
        : null,
    };
  }

  return {
    audio: await request.blob(),
    expectedResponseType: null,
    currentStep: null,
    hotwords: null,
    treatmentVersion: null,
    providerOverride: null,
  };
}

async function callExistingProvider(
  transcriptionRequest: SanitizedTranscriptionRequest,
  startTime: number
) {
  const whisperServiceUrl = process.env.WHISPER_SERVICE_URL;
  if (!whisperServiceUrl) {
    console.error('[Transcribe] WHISPER_SERVICE_URL not configured');
    return NextResponse.json(
      { error: 'Transcription service not configured' },
      { status: 500 }
    );
  }

  const headers: HeadersInit = {};
  if (process.env.WHISPER_API_KEY) {
    headers['X-API-Key'] = process.env.WHISPER_API_KEY;
  }

  const forward = new FormData();
  forward.append('audio', transcriptionRequest.audio, 'audio.wav');
  if (transcriptionRequest.expectedResponseType) {
    forward.append('expected_response_type', transcriptionRequest.expectedResponseType);
  }
  if (transcriptionRequest.currentStep) {
    forward.append('current_step', transcriptionRequest.currentStep);
  }
  if (transcriptionRequest.hotwords) {
    forward.append('hotwords', transcriptionRequest.hotwords);
  }

  const whisperResponse = await fetch(`${whisperServiceUrl}/transcribe`, {
    method: 'POST',
    headers,
    body: forward,
  });

  return await mapWhisperResponse(whisperResponse, startTime);
}

const OPENAI_STT_TIMEOUT_MS = 15_000;

function averageSegmentConfidence(segments: Array<{ avg_logprob?: number }> | undefined): number {
  if (!segments || segments.length === 0) return 0;
  const probs = segments
    .map((s) => s.avg_logprob)
    .filter((v): v is number => typeof v === 'number');
  if (probs.length === 0) return 0;
  const meanLogprob = probs.reduce((a, b) => a + b, 0) / probs.length;
  return Math.max(0, Math.min(1, Math.exp(meanLogprob)));
}

// Server-side OpenAI STT hallucination filter implementation lives in
// `lib/voice/openai-hallucination.ts` so it can be unit-tested without
// re-exporting a non-whitelisted field from this Next.js route file.

/**
 * Whether the given OpenAI error represents a transient failure that is safe to retry once per
 * US-010 (timeouts, 429, 5xx, network blips). 400/401/403 are permanent and must NOT retry.
 */
function isRetryableOpenAIError(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AbortError') return true;
  const anyErr = err as { status?: number; code?: string; name?: string } | undefined;
  const status = anyErr?.status;
  if (typeof status === 'number') {
    if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
      return true;
    }
    if (status >= 400 && status < 500) return false;
  }
  // Network / TypeError (fetch failed) — treat as transient.
  if (err instanceof TypeError) return true;
  if (anyErr?.name === 'FetchError') return true;
  return false;
}

/**
 * Whether the OpenAI error indicates the selected model doesn't support `verbose_json`. Used
 * by US-004 to retry once with response_format='json' instead of failing outright.
 */
function isVerboseJsonUnsupportedError(err: unknown): boolean {
  const anyErr = err as { status?: number; message?: string } | undefined;
  if (anyErr?.status !== 400) return false;
  const message = typeof anyErr?.message === 'string' ? anyErr.message.toLowerCase() : '';
  return message.includes('response_format') || message.includes('verbose_json');
}

function jitteredRetryDelayMs(): number {
  return 200 + Math.floor(Math.random() * 101); // 200..300ms
}

async function callOpenAIProvider(
  transcriptionRequest: SanitizedTranscriptionRequest,
  startTime: number
) {
  const model = process.env.OPENAI_STT_MODEL || 'gpt-4o-mini-transcribe';
  const prompt = buildOpenAITranscriptionPrompt(transcriptionRequest);
  const isV7 = transcriptionRequest.treatmentVersion === 'v7';
  // US-004: v7 sessions are English-only, so always send `language: 'en'`.
  const language = isV7 ? 'en' : undefined;

  const openai = createOpenAIClient();
  const file = new File([transcriptionRequest.audio], 'audio.wav', {
    type: transcriptionRequest.audio.type || 'audio/wav',
  });

  // OpenAI's transcription response shape depends on response_format. We normalise into a
  // lightweight record so the downstream extraction code doesn't have to juggle the union.
  type OpenAITranscriptionRecord = {
    text?: string;
    language?: string;
    duration?: number;
    segments?: OpenAISegment[];
  };

  type TranscriptionAttempt = {
    transcription: OpenAITranscriptionRecord;
    verboseJsonUsed: boolean;
    retryCount: number;
  };

  const runSingleCall = async (responseFormat: 'verbose_json' | 'json'): Promise<OpenAITranscriptionRecord> => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), OPENAI_STT_TIMEOUT_MS);
    try {
      const result = await openai.audio.transcriptions.create(
        {
          file,
          model,
          response_format: responseFormat,
          ...(language ? { language } : {}),
          ...(prompt ? { prompt } : {}),
        } as Parameters<OpenAI['audio']['transcriptions']['create']>[0],
        { signal: abortController.signal }
      );
      // The SDK's union includes string + stream variants we never request here.
      return result as unknown as OpenAITranscriptionRecord;
    } finally {
      clearTimeout(timeout);
    }
  };

  // Execute the call, applying US-004 verbose_json fallback and US-010 retry-once policy.
  const attempt = async (): Promise<TranscriptionAttempt> => {
    let retryCount = 0;

    const runWithRetry = async (responseFormat: 'verbose_json' | 'json'): Promise<OpenAITranscriptionRecord> => {
      try {
        return await runSingleCall(responseFormat);
      } catch (err) {
        if (isVerboseJsonUnsupportedError(err) && responseFormat === 'verbose_json') {
          // US-004: fall back to plain json and note that metadata gates are skipped.
          console.log(JSON.stringify({ event: 'stt_verbose_json_unsupported', model }));
          return await runSingleCall('json');
        }

        if (retryCount === 0 && isRetryableOpenAIError(err)) {
          retryCount = 1;
          console.log(JSON.stringify({ event: 'stt_retry', model, reason: err instanceof Error ? err.message : 'unknown' }));
          await new Promise((resolve) => setTimeout(resolve, jitteredRetryDelayMs()));
          try {
            return await runSingleCall(responseFormat);
          } catch (retryErr) {
            if (isVerboseJsonUnsupportedError(retryErr) && responseFormat === 'verbose_json') {
              console.log(JSON.stringify({ event: 'stt_verbose_json_unsupported', model }));
              return await runSingleCall('json');
            }
            throw retryErr;
          }
        }

        throw err;
      }
    };

    const transcription = await runWithRetry('verbose_json');
    const verboseJsonUsed = Array.isArray(transcription.segments) || typeof transcription.duration === 'number';
    return { transcription, verboseJsonUsed, retryCount };
  };

  try {
    const { transcription, verboseJsonUsed, retryCount } = await attempt();

    const processingTime = Date.now() - startTime;
    const segments = (verboseJsonUsed ? transcription.segments || [] : []) as OpenAISegment[];
    const rawTranscript = transcription.text || '';
    const detectedLanguage = transcription.language || 'en';
    const audioDuration = verboseJsonUsed ? transcription.duration || 0 : 0;

    // When verbose_json is not supported, metadata gates 2/3/4 are skipped. Phrase gates still run.
    const hallucination = detectOpenAIHallucination(
      rawTranscript,
      detectedLanguage,
      segments,
      audioDuration,
      transcriptionRequest.treatmentVersion,
    );

    const response = {
      transcript: hallucination.filtered ? '' : rawTranscript,
      confidence: averageSegmentConfidence(segments as Array<{ avg_logprob?: number }>),
      language: detectedLanguage,
      duration: audioDuration,
      processing_time: processingTime,
      cached: false,
      segments,
      real_time_factor: 0,
      hallucination_filtered: hallucination.filtered,
      hallucination_reason: hallucination.reason,
      domain_bias_applied: Boolean(prompt),
      model,
    };

    // US-002 structured log for every filtered response (human- and machine-readable).
    if (hallucination.filtered) {
      console.log(JSON.stringify({
        event: 'stt_hallucination_filtered',
        reason: hallucination.reason,
        detected_language: detectedLanguage,
        avg_no_speech_prob: hallucination.avgNoSpeechProb,
        avg_logprob: hallucination.avgLogprob,
        duration: audioDuration,
        word_count: hallucination.wordCount,
        transcript_preview: rawTranscript.slice(0, 80),
        model,
      }));
    }

    // US-005 structured telemetry for every OpenAI STT response.
    console.log(JSON.stringify({
      event: 'stt_call',
      treatment_version: transcriptionRequest.treatmentVersion ?? 'legacy',
      detected_language: detectedLanguage,
      avg_no_speech_prob: hallucination.avgNoSpeechProb,
      avg_logprob: hallucination.avgLogprob,
      duration_sec: audioDuration,
      word_count: hallucination.wordCount,
      domain_bias_applied: Boolean(prompt),
      hallucination_filtered: hallucination.filtered,
      hallucination_reason: hallucination.reason,
      model,
      processing_time_ms: processingTime,
      retry_count: retryCount,
    }));

    if (!hallucination.filtered) {
      console.log(
        `[Transcribe] OpenAI success: ${response.transcript.length} chars, ${processingTime}ms, lang=${detectedLanguage}, conf=${response.confidence.toFixed(2)}, domainBias=${response.domain_bias_applied}`
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    console.error(
      `[Transcribe] OpenAI transcription ${isTimeout ? 'timed out' : 'failed'}:`,
      error
    );
    return NextResponse.json(
      {
        error: isTimeout ? 'Transcription timed out' : 'Transcription failed',
        code: 'stt_provider_failure',
        provider: 'openai',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}

/**
 * POST /api/transcribe
 *
 * Proxy for the Whisper service. Accepts either:
 * - multipart/form-data: audio file + optional domain-bias fields (Mind Shifting)
 * - raw audio body (legacy): forwarded as a single file without bias
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const transcriptionRequest = await parseRequest(request);
    const audioSize = transcriptionRequest.audio.size;
    console.log(
      `[Transcribe] Audio: ${audioSize} bytes, ert=${transcriptionRequest.expectedResponseType || '—'}, step=${transcriptionRequest.currentStep || '—'}, provider=${transcriptionRequest.providerOverride || STT_PROVIDER}, treatment=${transcriptionRequest.treatmentVersion || 'legacy'}`
    );

    // US-018: v7 runtime is fully outsourced to OpenAI. STT_PROVIDER and providerOverride are
    // ignored for v7. The override is logged so operators can see if legacy clients are still
    // trying to force 'existing' for v7 sessions.
    if (transcriptionRequest.treatmentVersion === 'v7') {
      if (transcriptionRequest.providerOverride === 'existing') {
        console.log(JSON.stringify({ event: 'v7_legacy_stt_override_ignored' }));
      }
      return await callOpenAIProvider(transcriptionRequest, startTime);
    }

    const resolvedProvider = transcriptionRequest.providerOverride || STT_PROVIDER;
    if (resolvedProvider === 'openai') {
      return await callOpenAIProvider(transcriptionRequest, startTime);
    }

    return await callExistingProvider(transcriptionRequest, startTime);
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[Transcribe] Error after ${processingTime}ms:`, error);

    return NextResponse.json(
      {
        error: 'Transcription failed',
        code: 'stt_provider_failure',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function mapWhisperResponse(whisperResponse: Response, startTime: number) {
  if (!whisperResponse.ok) {
    const errorText = await whisperResponse.text();
    console.error(
      `[Transcribe] Whisper service error (${whisperResponse.status}): ${errorText}`
    );

    return NextResponse.json(
      {
        error: 'Transcription failed',
        details: errorText,
        status: whisperResponse.status,
      },
      { status: 500 }
    );
  }

  const whisperResult = await whisperResponse.json();
  const processingTime = Date.now() - startTime;

  const response = {
    transcript: whisperResult.transcript || '',
    confidence: whisperResult.language_probability || 0,
    language: whisperResult.language || 'en',
    duration: whisperResult.audio_duration || 0,
    processing_time: processingTime,
    cached: whisperResult.cache_hit || false,
    segments: whisperResult.segments || [],
    real_time_factor: whisperResult.real_time_factor || 0,
    hallucination_filtered: whisperResult.hallucination_filtered || false,
    hallucination_reason: whisperResult.hallucination_reason || null,
    domain_bias_applied: whisperResult.domain_bias_applied || false,
  };

  if (response.hallucination_filtered) {
    console.log(
      `[Transcribe] HALLUCINATION FILTERED: reason=${response.hallucination_reason}, ` +
        `${processingTime}ms`
    );
  } else {
    console.log(
      `[Transcribe] Success: ${response.transcript.length} chars, ` +
        `${processingTime}ms, cached=${response.cached}, ` +
        `rtf=${response.real_time_factor}, domainBias=${response.domain_bias_applied}`
    );
  }

  return NextResponse.json(response);
}
