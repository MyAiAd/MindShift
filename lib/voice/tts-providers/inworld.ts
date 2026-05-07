import type {
  TtsProvider,
  TtsSynthesisRequest,
  TtsSynthesisResult,
} from './types';

/**
 * Inworld TTS provider (inworld-tts-1.5-mini by default).
 *
 * Auth:  INWORLD_API_KEY  — pre-encoded base64 `key:secret` string as
 *        issued by the Inworld platform portal (platform.inworld.ai).
 *        Used verbatim as the Authorization: Basic credential.
 * Voice: INWORLD_VOICE_ID (required — provider is unavailable if unset).
 * Model: INWORLD_TTS_MODEL (optional; defaults to inworld-tts-1.5-mini).
 *
 * Uses the HTTP streaming endpoint /v1/tts/synthesize:stream.  The
 * response body is consumed chunk-by-chunk via ReadableStream to capture
 * first-byte latency before buffering into a single Buffer.
 *
 * Pricing: set INWORLD_USD_PER_CHAR once a rate is confirmed with
 * Inworld.  Defaults to 0 (no per-character cost tracked yet).
 */

const DEFAULT_USD_PER_CHAR = Number(process.env.INWORLD_USD_PER_CHAR ?? '0');
const DEFAULT_MODEL = process.env.INWORLD_TTS_MODEL ?? 'inworld-tts-1.5-mini';
const ENDPOINT = 'https://api.inworld.ai/v1/tts/synthesize:stream';

export class InworldTtsProvider implements TtsProvider {
  readonly id = 'inworld' as const;
  readonly displayName = 'Inworld TTS';

  isAvailable(): boolean {
    return Boolean(process.env.INWORLD_API_KEY);
  }

  async synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult> {
    if (!process.env.INWORLD_API_KEY) {
      throw new Error('INWORLD_API_KEY not configured; Inworld TTS unavailable.');
    }

    // Voice precedence: request → env fallback → error
    const voice = request.voice ?? process.env.INWORLD_VOICE_ID ?? '';
    if (!voice) {
      throw new Error(
        'No Inworld voice configured. Set INWORLD_VOICE_ID or select a voice in admin settings.',
      );
    }
    const format = 'mp3';
    const start = performance.now();

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: request.signal,
      headers: {
        Authorization: `Basic ${process.env.INWORLD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: request.text,
        model: DEFAULT_MODEL,
        voice,
        audioConfig: { audioEncoding: 'MP3' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '<unreadable>');
      throw new Error(
        `Inworld TTS HTTP ${response.status}: ${errText.slice(0, 200)}`,
      );
    }

    // ReadableStream consumption: capture first-byte latency after the
    // first chunk arrives, then collect all chunks into a single Buffer.
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let firstByte: number | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (firstByte === null) firstByte = performance.now();
      chunks.push(value);
    }

    const audio = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const end = performance.now();

    return {
      audio,
      mimeType: 'audio/mpeg',
      provider: 'inworld',
      voice,
      format,
      cost: {
        characters: request.text.length,
        estimatedUsd: request.text.length * DEFAULT_USD_PER_CHAR,
        latencyMs: Math.max(0, (firstByte ?? end) - start),
        totalMs: Math.max(0, end - start),
      },
    };
  }
}
