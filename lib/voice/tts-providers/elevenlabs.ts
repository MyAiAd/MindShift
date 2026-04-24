import type {
  TtsProvider,
  TtsSynthesisRequest,
  TtsSynthesisResult,
} from './types';

/**
 * ElevenLabs TTS provider (Flash v2.5 tier by default).
 *
 * Auth:  ELEVENLABS_API_KEY
 * Voice: ELEVENLABS_VOICE_ID (defaults to a known-good female voice).
 * Model: ELEVENLABS_MODEL_ID (defaults to eleven_flash_v2_5).
 *
 * Pricing (as of 2025-04): Flash v2.5 is credit-based at ~2 credits per char
 * on the Creator tier; $22/mo buys 100k credits which yields ~50k chars/mo.
 * That works out to roughly $0.00044 / char. Override via
 * ELEVENLABS_USD_PER_CHAR if your plan differs.
 */

const DEFAULT_USD_PER_CHAR = Number(
  process.env.ELEVENLABS_USD_PER_CHAR ?? '0.00044',
);

const DEFAULT_MODEL = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_flash_v2_5';
const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM';
const API_BASE = process.env.ELEVENLABS_API_BASE ?? 'https://api.elevenlabs.io';

export class ElevenLabsTtsProvider implements TtsProvider {
  readonly id = 'elevenlabs' as const;
  readonly displayName = 'ElevenLabs TTS';

  isAvailable(): boolean {
    return Boolean(process.env.ELEVENLABS_API_KEY);
  }

  async synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult> {
    if (!this.isAvailable()) {
      throw new Error(
        'ELEVENLABS_API_KEY not configured; ElevenLabs TTS unavailable.',
      );
    }

    const voice = request.voice || DEFAULT_VOICE;
    const format = request.format ?? 'mp3';

    const url = `${API_BASE}/v1/text-to-speech/${encodeURIComponent(voice)}`;
    const start = performance.now();

    const response = await fetch(url, {
      method: 'POST',
      signal: request.signal,
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY as string,
        'Content-Type': 'application/json',
        Accept: format === 'mp3' ? 'audio/mpeg' : `audio/${format}`,
      },
      body: JSON.stringify({
        text: request.text,
        model_id: DEFAULT_MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '<unreadable>');
      throw new Error(
        `ElevenLabs TTS HTTP ${response.status}: ${errText.slice(0, 200)}`,
      );
    }

    const firstByte = performance.now();
    const arrayBuffer = await response.arrayBuffer();
    const audio = Buffer.from(arrayBuffer);
    const end = performance.now();

    return {
      audio,
      mimeType: format === 'mp3' ? 'audio/mpeg' : `audio/${format}`,
      provider: 'elevenlabs',
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
