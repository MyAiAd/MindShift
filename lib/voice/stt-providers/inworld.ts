import { getInworldApiKey } from '@/lib/v9/voice-settings';
import type {
  SttProvider,
  SttTranscribeRequest,
  SttTranscribeResult,
} from './types';

/**
 * Inworld STT batch provider (inworld/inworld-stt-1).
 *
 * Used for the admin test round-trip and isAvailable() check.
 * Live sessions use useInworldSttRealtime (WebSocket), not this class.
 *
 * Auth:  DB inworld_api_key column → INWORLD_API_KEY env var fallback.
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
    const key = await getInworldApiKey();
    if (!key) {
      throw new Error('Inworld API key not configured. Set it in Admin → Voice settings or via INWORLD_API_KEY env var.');
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
