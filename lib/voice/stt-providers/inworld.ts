import type {
  SttProvider,
  SttTranscribeRequest,
  SttTranscribeResult,
} from './types';

/**
 * Inworld STT batch provider (inworld/inworld-stt-1).
 *
 * Used by:
 *   - The admin "Test with my mic" round-trip (/api/admin/voice-settings/test)
 *   - The isAvailable() check that drives the radio availability indicator
 *
 * Live in-session transcription uses the realtime WebSocket endpoint via
 * useInworldSttRealtime on the client — NOT this class.
 *
 * Auth:    INWORLD_API_KEY  — pre-encoded base64 `key:secret` string.
 * Model:   inworld/inworld-stt-1
 * Pricing: TBD — estimatedUsd is reported as 0 until a rate is confirmed.
 *
 * Response shape: expects { text: string } or { transcript: string }.
 * The hallucination filter falls back gracefully to the full transcript
 * string when segments: [] is returned here.
 */

const ENDPOINT = 'https://api.inworld.ai/v1/stt/transcribe';

type InworldSttResponse = {
  text?: string;
  transcript?: string;
  language?: string;
  duration?: number;
};

export class InworldSttProvider implements SttProvider {
  readonly id = 'inworld' as const;
  readonly displayName = 'Inworld STT';

  isAvailable(): boolean {
    return Boolean(process.env.INWORLD_API_KEY);
  }

  async transcribe(request: SttTranscribeRequest): Promise<SttTranscribeResult> {
    const key = process.env.INWORLD_API_KEY;
    if (!key) {
      throw new Error('INWORLD_API_KEY not configured; Inworld STT unavailable.');
    }

    const form = new FormData();
    form.append('audio', request.audio, 'audio.wav');
    form.append(
      'config',
      JSON.stringify({ model: 'inworld/inworld-stt-1', audioEncoding: 'AUTO_DETECT' }),
    );

    const start = performance.now();
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Basic ${key}` },
      body: form,
      signal: request.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Inworld STT HTTP ${response.status}: ${detail.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as InworldSttResponse;
    const latencyMs = Math.round(performance.now() - start);

    const text = payload.text ?? payload.transcript ?? '';
    const durationSeconds =
      typeof payload.duration === 'number' ? payload.duration : 0;

    return {
      text,
      segments: [],
      language: payload.language ?? 'en',
      durationSeconds,
      provider: 'inworld',
      model: 'inworld/inworld-stt-1',
      cost: {
        audioSeconds: durationSeconds,
        characters: text.length,
        estimatedUsd: 0,
        latencyMs,
      },
    };
  }
}
