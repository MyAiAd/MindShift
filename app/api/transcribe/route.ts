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

async function callOpenAIProvider(
  transcriptionRequest: SanitizedTranscriptionRequest,
  startTime: number
) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), OPENAI_STT_TIMEOUT_MS);

  try {
    const openai = createOpenAIClient();
    const prompt = buildOpenAITranscriptionPrompt(transcriptionRequest);
    const file = new File([transcriptionRequest.audio], 'audio.wav', {
      type: transcriptionRequest.audio.type || 'audio/wav',
    });

    const transcription = await openai.audio.transcriptions.create(
      {
        file,
        model: 'whisper-1',
        response_format: 'verbose_json',
        prompt,
      },
      { signal: abortController.signal }
    );

    const processingTime = Date.now() - startTime;
    const segments = 'segments' in transcription ? transcription.segments || [] : [];
    const response = {
      transcript: 'text' in transcription ? transcription.text || '' : '',
      confidence: averageSegmentConfidence(segments as Array<{ avg_logprob?: number }>),
      language: 'language' in transcription ? transcription.language || 'en' : 'en',
      duration: 'duration' in transcription ? transcription.duration || 0 : 0,
      processing_time: processingTime,
      cached: false,
      segments,
      real_time_factor: 0,
      hallucination_filtered: false,
      hallucination_reason: null,
      domain_bias_applied: Boolean(prompt),
    };

    console.log(
      `[Transcribe] OpenAI success: ${response.transcript.length} chars, ${processingTime}ms, conf=${response.confidence.toFixed(2)}, domainBias=${response.domain_bias_applied}`
    );

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
  } finally {
    clearTimeout(timeout);
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
