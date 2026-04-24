import type {
  TtsProvider,
  TtsSynthesisRequest,
  TtsSynthesisResult,
} from './types';

/**
 * Kokoro TTS provider. Talks to a self-hosted Kokoro service over HTTP.
 *
 * Env:
 *   KOKORO_SERVICE_URL   e.g. http://kokoro:8880
 *   KOKORO_API_KEY       optional X-API-Key header
 *   KOKORO_VOICE_ID      default af_heart
 *   KOKORO_USD_PER_CHAR  default 0 (self-hosted is free per-call; you pay
 *                        for compute instead)
 *
 * We include Kokoro for v9 even though it ran into US quality issues in
 * v5 — at the cost curve we care about (doctor-style explanations) it is
 * free-per-char, and v9's STT hallucination gate in place covers the old
 * "Welsh on silence" problem so Kokoro on v9 is a different bet than on
 * v5. The A/B metrics from Phase 4 will decide whether it stays.
 */

const DEFAULT_USD_PER_CHAR = Number(process.env.KOKORO_USD_PER_CHAR ?? '0');
const DEFAULT_VOICE = process.env.KOKORO_VOICE_ID ?? 'af_heart';

export class KokoroTtsProvider implements TtsProvider {
  readonly id = 'kokoro' as const;
  readonly displayName = 'Kokoro TTS';

  isAvailable(): boolean {
    return Boolean(process.env.KOKORO_SERVICE_URL);
  }

  async synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult> {
    if (!this.isAvailable()) {
      throw new Error(
        'KOKORO_SERVICE_URL not configured; Kokoro TTS unavailable.',
      );
    }

    const baseUrl = process.env.KOKORO_SERVICE_URL as string;
    const url = baseUrl.replace(/\/$/, '') + '/v1/audio/speech';
    const voice = request.voice || DEFAULT_VOICE;
    const format = request.format ?? 'mp3';

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (process.env.KOKORO_API_KEY) {
      headers['X-API-Key'] = process.env.KOKORO_API_KEY;
    }

    const start = performance.now();
    const response = await fetch(url, {
      method: 'POST',
      signal: request.signal,
      headers,
      body: JSON.stringify({
        model: 'kokoro',
        input: request.text,
        voice,
        response_format: format === 'pcm16' ? 'pcm' : format,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '<unreadable>');
      throw new Error(
        `Kokoro TTS HTTP ${response.status}: ${errText.slice(0, 200)}`,
      );
    }

    const firstByte = performance.now();
    const arrayBuffer = await response.arrayBuffer();
    const audio = Buffer.from(arrayBuffer);
    const end = performance.now();

    return {
      audio,
      mimeType: format === 'mp3' ? 'audio/mpeg' : `audio/${format}`,
      provider: 'kokoro',
      voice,
      format,
      cost: {
        characters: request.text.length,
        estimatedUsd: request.text.length * DEFAULT_USD_PER_CHAR,
        latencyMs: Math.max(0, firstByte - start),
        totalMs: Math.max(0, end - start),
      },
    };
  }
}
