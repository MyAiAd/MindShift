import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30; // Vercel timeout handling

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
    const whisperServiceUrl = process.env.WHISPER_SERVICE_URL;
    if (!whisperServiceUrl) {
      console.error('[Transcribe] WHISPER_SERVICE_URL not configured');
      return NextResponse.json(
        { error: 'Transcription service not configured' },
        { status: 500 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    const headers: HeadersInit = {};
    if (process.env.WHISPER_API_KEY) {
      headers['X-API-Key'] = process.env.WHISPER_API_KEY;
    }

    let formData: FormData;

    if (contentType.includes('multipart/form-data')) {
      formData = await request.formData();
      const audio = formData.get('audio');
      if (!audio || !(audio instanceof Blob)) {
        return NextResponse.json(
          { error: 'Missing audio field in multipart body' },
          { status: 400 }
        );
      }
      const audioSize = audio.size;
      console.log(
        `[Transcribe] Multipart audio: ${audioSize} bytes, ` +
          `ert=${formData.get('expected_response_type') || '—'}, ` +
          `step=${formData.get('current_step') || '—'}`
      );

      const forward = new FormData();
      forward.append('audio', audio, 'audio.wav');
      const ert = formData.get('expected_response_type');
      const step = formData.get('current_step');
      const hw = formData.get('hotwords');
      if (typeof ert === 'string' && ert.trim()) {
        forward.append('expected_response_type', ert.trim().slice(0, 64));
      }
      if (typeof step === 'string' && step.trim()) {
        forward.append('current_step', step.trim().slice(0, 128));
      }
      if (typeof hw === 'string' && hw.trim()) {
        forward.append('hotwords', hw.trim().slice(0, 500));
      }

      const whisperResponse = await fetch(`${whisperServiceUrl}/transcribe`, {
        method: 'POST',
        headers,
        body: forward,
      });
      return await mapWhisperResponse(whisperResponse, startTime);
    }

    // Legacy: raw WAV blob
    const audioBlob = await request.blob();
    const audioSize = audioBlob.size;
    console.log(`[Transcribe] Raw audio: ${audioSize} bytes (no domain bias)`);

    const forward = new FormData();
    forward.append('audio', audioBlob, 'audio.wav');

    const whisperResponse = await fetch(`${whisperServiceUrl}/transcribe`, {
      method: 'POST',
      headers,
      body: forward,
    });
    return await mapWhisperResponse(whisperResponse, startTime);
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[Transcribe] Error after ${processingTime}ms:`, error);

    return NextResponse.json(
      {
        error: 'Transcription failed',
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
