import { getInworldApiKey } from '@/lib/v9/voice-settings';
import type {
  TtsProvider,
  TtsSynthesisRequest,
  TtsSynthesisResult,
} from './types';

/**
 * Inworld TTS provider (inworld-tts-1.5-mini by default).
 *
 * Auth:  INWORLD_API_KEY env var OR the inworld_api_key DB column —
 *        pre-encoded base64 `key:secret` string issued by the Inworld
 *        platform portal (platform.inworld.ai).  DB value takes
 *        precedence; env var is the fallback.
 * Voice: passed via request.voice (pinned from DB at session start).
 *        Falls back to INWORLD_VOICE_ID env var.
 * Model: INWORLD_TTS_MODEL env var (optional; defaults to inworld-tts-1.5-mini).
 *
 * Uses the HTTP streaming endpoint /v1/tts/synthesize:stream.
 * Pricing: set INWORLD_USD_PER_CHAR once a rate is confirmed.
 */

const DEFAULT_USD_PER_CHAR = Number(process.env.INWORLD_USD_PER_CHAR ?? '0');
const DEFAULT_MODEL = process.env.INWORLD_TTS_MODEL ?? 'inworld-tts-1.5-mini';
const ENDPOINT = 'https://api.inworld.ai/v1/tts/synthesize:stream';

export class InworldTtsProvider implements TtsProvider {
  readonly id = 'inworld' as const;
  readonly displayName = 'Inworld TTS';

  // Fast synchronous check — true when the env var is set.
  // The admin availability report does a full async DB+env check.
  isAvailable(): boolean {
    return Boolean(process.env.INWORLD_API_KEY);
  }

  async synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult> {
    const apiKey = await getInworldApiKey();
    if (!apiKey) {
      throw new Error('Inworld API key not configured. Set it in Admin → Voice settings or via INWORLD_API_KEY env var.');
    }

    const voice = request.voice ?? process.env.INWORLD_VOICE_ID ?? '';
    if (!voice) {
      throw new Error(
        'No Inworld voice configured. Select a voice in Admin → Voice settings.',
      );
    }

    const format = 'mp3';
    const start = performance.now();

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: request.signal,
      headers: {
        Authorization: `Basic ${apiKey}`,
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
