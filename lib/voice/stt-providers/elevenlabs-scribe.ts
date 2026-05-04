import type {
  SttProvider,
  SttTranscribeRequest,
  SttTranscribeResult,
} from './types';

/**
 * ElevenLabs Scribe v2 batch STT provider.
 *
 * Used by:
 *   - The admin "Test with my mic" round-trip (/api/admin/voice-settings/test)
 *   - The isAvailable() check that drives the radio availability indicator
 *
 * The live in-session path uses the realtime WebSocket (scribe_v2_realtime)
 * via useElevenLabsScribeRealtime on the client — NOT this class.  Scribe
 * batch is only here so the server-side SttProvider interface is satisfied
 * and the admin UI can verify that the API key is configured.
 *
 * Auth:    ELEVENLABS_API_KEY (same key used by ElevenLabs TTS)
 * Model:   scribe_v2 (batch)
 * Pricing: ~$0.40/hr continuous audio; no per-call batch price published.
 *          Cost returned here is 0 (batch test is negligible / one-off).
 */

const API_BASE = process.env.ELEVENLABS_API_BASE ?? 'https://api.elevenlabs.io';

type ScribeResponse = {
  text?: string;
  language_code?: string;
  audio_duration?: number;
  words?: Array<{ text?: string; start?: number; end?: number }>;
};

export class ElevenLabsScribeSttProvider implements SttProvider {
  readonly id = 'elevenlabs' as const;
  readonly displayName = 'ElevenLabs (Scribe v2)';

  isAvailable(): boolean {
    return Boolean(process.env.ELEVENLABS_API_KEY);
  }

  async transcribe(request: SttTranscribeRequest): Promise<SttTranscribeResult> {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) {
      throw new Error('ELEVENLABS_API_KEY not configured; ElevenLabs Scribe unavailable.');
    }

    const form = new FormData();
    form.append('file', request.audio, 'audio.wav');
    form.append('model_id', 'scribe_v2');
    form.append('tag_audio_events', 'false');

    const start = performance.now();
    const response = await fetch(`${API_BASE}/v1/speech-to-text`, {
      method: 'POST',
      headers: { 'xi-api-key': key },
      body: form,
      signal: request.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `ElevenLabs Scribe HTTP ${response.status}: ${detail.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as ScribeResponse;
    const latencyMs = Math.round(performance.now() - start);

    const text = payload.text ?? '';
    const language = payload.language_code ?? 'en';
    const durationSeconds =
      typeof payload.audio_duration === 'number' ? payload.audio_duration : 0;

    return {
      text,
      segments: [],
      language,
      durationSeconds,
      provider: 'elevenlabs',
      model: 'scribe_v2',
      cost: {
        audioSeconds: durationSeconds,
        characters: text.length,
        estimatedUsd: 0,
        latencyMs,
      },
    };
  }
}
