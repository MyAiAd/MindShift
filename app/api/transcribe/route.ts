import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { STT_PROVIDER } from '@/lib/voice/speech-config';

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

// ============================================================================
// SERVER-SIDE HALLUCINATION FILTER FOR OPENAI STT
// ============================================================================
// OpenAI's Whisper API produces hallucinations on silence/noise just like the
// self-hosted model. The OpenAI path previously had ZERO filtering, allowing
// phantom transcripts (often in non-English languages) to reach the client.
// ============================================================================

const OPENAI_HALLUCINATION_PHRASES = new Set([
  'thanks for watching', 'thank you for watching',
  'thanks for watching and ill see you in the next video',
  'see you in the next video', 'see you in the next one', 'see you next time',
  'thanks for listening', 'thank you for listening',
  'thank you very much', 'thank you so much', 'thank you', 'thanks',
  'bye bye', 'bye', 'goodbye',
  'please subscribe', 'subscribe to my channel',
  'like and subscribe', 'please like and subscribe',
  'hey guys', 'hi everyone', 'hello everyone', 'welcome back',
  'thats all for today', 'until next time',
  'music', 'music playing', 'applause', 'laughter', 'silence',
  // Non-English hallucinations that Whisper produces from silence
  'diolch yn fawr iawn am wylior fideo',
  'diolch yn fawr am wylior fideo',
  'diolch yn fawr',
  'ご視聴ありがとうございました', '字幕由', '谢谢观看', '감사합니다',
]);

const OPENAI_HALLUCINATION_SUBSTRINGS = [
  'thanks for watching', 'thank you for watching',
  'see you in the next video', 'subscribe to my channel',
  'like and subscribe', 'welcome to my channel',
  'subtitles by', 'captions by', 'transcribed by',
  'amara.org', 'mozilla foundation',
  'diolch yn fawr', 'am wylior fideo', 'am wylio\'r fideo',
];

type OpenAISegment = {
  avg_logprob?: number;
  no_speech_prob?: number;
  compression_ratio?: number;
  text?: string;
};

type HallucinationDiagnostics = {
  filtered: boolean;
  reason: string | null;
  avgNoSpeechProb: number | null;
  avgLogprob: number | null;
  wordCount: number;
};

/**
 * Apply US-002 server-side hallucination metadata gates in the order specified by the PRD:
 *   (1) language !== 'en' on v7 sessions
 *   (2) avg(no_speech_prob) > 0.6
 *   (3) avg(avg_logprob) < -1.0 AND duration < 3.0s
 *   (4) duration < 1.5s AND word_count > 8
 *   (5) exact or substring match against OPENAI_HALLUCINATION_PHRASES / SUBSTRINGS
 *
 * Returns the filtered decision plus the numeric inputs so callers can emit structured logs.
 */
function detectOpenAIHallucination(
  transcript: string,
  language: string,
  segments: OpenAISegment[],
  duration: number,
  treatmentVersion: string | null,
): HallucinationDiagnostics {
  const trimmed = transcript?.trim() ?? '';
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

  const noSpeechProbs = (segments || [])
    .map((s) => s.no_speech_prob)
    .filter((v): v is number => typeof v === 'number');
  const avgNoSpeechProb = noSpeechProbs.length > 0
    ? noSpeechProbs.reduce((a, b) => a + b, 0) / noSpeechProbs.length
    : null;

  const logprobs = (segments || [])
    .map((s) => s.avg_logprob)
    .filter((v): v is number => typeof v === 'number');
  const avgLogprob = logprobs.length > 0
    ? logprobs.reduce((a, b) => a + b, 0) / logprobs.length
    : null;

  if (!trimmed) {
    return { filtered: false, reason: null, avgNoSpeechProb, avgLogprob, wordCount };
  }

  // Gate 1: v7-only language gate — our v7 therapy sessions are English-only.
  if (treatmentVersion === 'v7' && language && language !== 'en') {
    return {
      filtered: true,
      reason: `non_english_language: ${language}`,
      avgNoSpeechProb,
      avgLogprob,
      wordCount,
    };
  }

  // Gate 2: high average no_speech_prob means Whisper itself is saying "probably silence".
  if (avgNoSpeechProb !== null && avgNoSpeechProb > 0.6) {
    return {
      filtered: true,
      reason: `high_no_speech_prob: ${avgNoSpeechProb.toFixed(3)}`,
      avgNoSpeechProb,
      avgLogprob,
      wordCount,
    };
  }

  // Gate 3: low-confidence short-audio — typical hallucination shape.
  if (avgLogprob !== null && avgLogprob < -1.0 && duration < 3.0) {
    return {
      filtered: true,
      reason: `low_confidence_short_audio: logprob=${avgLogprob.toFixed(3)}, duration=${duration.toFixed(2)}s`,
      avgNoSpeechProb,
      avgLogprob,
      wordCount,
    };
  }

  // Gate 4: duration/word-count mismatch — very short audio can't produce long transcripts.
  if (duration < 1.5 && wordCount > 8) {
    return {
      filtered: true,
      reason: `duration_mismatch: ${wordCount} words in ${duration.toFixed(2)}s`,
      avgNoSpeechProb,
      avgLogprob,
      wordCount,
    };
  }

  // Gate 5: exact-phrase / substring deny-list (YouTube boilerplate, non-English hallucinations).
  const normalized = transcript.toLowerCase().replace(/[^\w\s']/g, '').replace(/\s+/g, ' ').trim();
  if (OPENAI_HALLUCINATION_PHRASES.has(normalized)) {
    return {
      filtered: true,
      reason: `exact_match: "${normalized}"`,
      avgNoSpeechProb,
      avgLogprob,
      wordCount,
    };
  }
  for (const pattern of OPENAI_HALLUCINATION_SUBSTRINGS) {
    if (normalized.includes(pattern)) {
      return {
        filtered: true,
        reason: `substring_match: "${pattern}"`,
        avgNoSpeechProb,
        avgLogprob,
        wordCount,
      };
    }
  }

  return { filtered: false, reason: null, avgNoSpeechProb, avgLogprob, wordCount };
}

/** Export for unit tests (US-003). Not part of the public HTTP surface. */
export const __test__ = { detectOpenAIHallucination };

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

    const useV7ProviderSelection = transcriptionRequest.treatmentVersion === 'v7';
    const resolvedProvider = useV7ProviderSelection
      ? (transcriptionRequest.providerOverride || STT_PROVIDER)
      : 'existing';

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
