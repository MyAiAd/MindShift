import OpenAI from 'openai';
import type {
  TtsProvider,
  TtsSynthesisRequest,
  TtsSynthesisResult,
} from './types';

/**
 * OpenAI TTS provider. Uses gpt-4o-mini-tts by default to get access to
 * the higher-quality 'marin' / 'cedar' voices released in Mar 2025. See
 * the notes in app/api/tts/route.ts — falling back to tts-1 will silently
 * downgrade those voices, so we deliberately do not.
 *
 * Pricing (as of 2025-04): gpt-4o-mini-tts is metered in input tokens at
 * a rate roughly equivalent to $0.015 / 1K input chars. We estimate
 * characters * 0.000015 USD here; override DEFAULT_OPENAI_TTS_USD_PER_CHAR
 * via env if the rate changes.
 */

const DEFAULT_OPENAI_TTS_USD_PER_CHAR = Number(
  process.env.OPENAI_TTS_USD_PER_CHAR ?? '0.000015',
);

const DEFAULT_MODEL = process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts';

type OpenAIVoice =
  | 'alloy'
  | 'ash'
  | 'ballad'
  | 'coral'
  | 'echo'
  | 'fable'
  | 'nova'
  | 'onyx'
  | 'sage'
  | 'shimmer'
  | 'verse'
  | 'marin'
  | 'cedar';

const DEFAULT_VOICE: OpenAIVoice =
  ((process.env.OPENAI_TTS_VOICE as OpenAIVoice) || 'marin') as OpenAIVoice;

export class OpenAiTtsProvider implements TtsProvider {
  readonly id = 'openai' as const;
  readonly displayName = 'OpenAI TTS';

  isAvailable(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult> {
    if (!this.isAvailable()) {
      throw new Error('OPENAI_API_KEY not configured; OpenAI TTS unavailable.');
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const voice = (request.voice as OpenAIVoice) || DEFAULT_VOICE;
    const format = request.format ?? 'mp3';

    const start = performance.now();
    let firstByte: number | null = null;

    const response = await openai.audio.speech.create(
      {
        model: DEFAULT_MODEL,
        voice,
        input: request.text,
        response_format: format === 'pcm16' ? 'pcm' : format,
      } as Parameters<OpenAI['audio']['speech']['create']>[0],
      { signal: request.signal },
    );

    firstByte = performance.now();
    const arrayBuffer = await response.arrayBuffer();
    const audio = Buffer.from(arrayBuffer);
    const end = performance.now();

    return {
      audio,
      mimeType: format === 'mp3' ? 'audio/mpeg' : `audio/${format}`,
      provider: 'openai',
      voice,
      format,
      cost: {
        characters: request.text.length,
        estimatedUsd: request.text.length * DEFAULT_OPENAI_TTS_USD_PER_CHAR,
        latencyMs: Math.max(0, (firstByte ?? end) - start),
        totalMs: Math.max(0, end - start),
      },
    };
  }
}
