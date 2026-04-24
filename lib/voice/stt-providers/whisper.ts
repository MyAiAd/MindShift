import type { OpenAISegment } from '@/lib/voice/openai-hallucination';
import type {
  SttProvider,
  SttTranscribeRequest,
  SttTranscribeResult,
} from './types';

/**
 * Self-hosted Whisper (the `whisper-service/` Python app). The admin
 * UI selects this by setting `stt_provider = 'whisper-local'` in the
 * `system_voice_settings` singleton row.
 *
 * Infrastructure cost is fixed per-hour (compute), so we report a
 * nominal $0 per-call cost. The admin-facing cost report blends this
 * with the TTS side to give a realistic per-session total.
 *
 * Request/response shape matches the existing
 * `app/api/transcribe/route.ts#callExistingProvider` helper: multipart
 * `audio=<blob>` plus optional `current_step`, `expected_response_type`,
 * `hotwords` hints, authenticated via `X-API-Key` if WHISPER_API_KEY is
 * set.
 *
 * The whisper-service returns `transcript`, `segments`, `language`,
 * and `audio_duration`. We normalise into the shared SttTranscribeResult
 * shape so voice-adapter and the hallucination gate don't have to know
 * which provider ran.
 */

type WhisperServiceResponse = {
  transcript?: string;
  language?: string;
  audio_duration?: number;
  segments?: Array<{
    text?: string;
    avg_logprob?: number;
    no_speech_prob?: number;
    compression_ratio?: number;
  }>;
  real_time_factor?: number;
  total_processing_time?: number;
};

export class WhisperLocalSttProvider implements SttProvider {
  readonly id = 'whisper-local' as const;
  readonly displayName = 'Whisper (self-hosted)';

  isAvailable(): boolean {
    return Boolean(process.env.WHISPER_SERVICE_URL);
  }

  async transcribe(
    request: SttTranscribeRequest,
  ): Promise<SttTranscribeResult> {
    const url = process.env.WHISPER_SERVICE_URL;
    if (!url) {
      throw new Error(
        'WHISPER_SERVICE_URL not configured; whisper-local STT unavailable.',
      );
    }

    const headers: HeadersInit = {};
    if (process.env.WHISPER_API_KEY) {
      headers['X-API-Key'] = process.env.WHISPER_API_KEY;
    }

    const forward = new FormData();
    forward.append('audio', request.audio, 'audio.wav');
    if (request.expectedResponseType) {
      forward.append('expected_response_type', request.expectedResponseType);
    }
    if (request.currentStep) {
      forward.append('current_step', request.currentStep);
    }
    if (request.hotwords) {
      forward.append('hotwords', request.hotwords);
    }

    const start = performance.now();
    const response = await fetch(`${url.replace(/\/$/, '')}/transcribe`, {
      method: 'POST',
      headers,
      body: forward,
      signal: request.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `whisper-service returned ${response.status}: ${detail.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as WhisperServiceResponse;
    const latencyMs = Math.round(performance.now() - start);

    const text = payload.transcript ?? '';
    const language = payload.language ?? 'en';
    const durationSeconds =
      typeof payload.audio_duration === 'number' ? payload.audio_duration : 0;
    const segments: OpenAISegment[] = Array.isArray(payload.segments)
      ? payload.segments.map((s) => ({
          text: s.text,
          avg_logprob: s.avg_logprob,
          no_speech_prob: s.no_speech_prob,
          compression_ratio: s.compression_ratio,
        }))
      : [];

    return {
      text,
      segments,
      language,
      durationSeconds,
      provider: 'whisper-local',
      model: 'whisper-service',
      cost: {
        audioSeconds: durationSeconds,
        characters: text.length,
        // Self-hosted: no per-call API cost. Compute is billed by the
        // hour regardless of call volume, so attributing it per-call
        // here would be misleading.
        estimatedUsd: 0,
        latencyMs,
      },
    };
  }
}
