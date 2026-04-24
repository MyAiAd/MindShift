import OpenAI from 'openai';
import type { OpenAISegment } from '@/lib/voice/openai-hallucination';
import type {
  SttProvider,
  SttTranscribeRequest,
  SttTranscribeResult,
} from './types';

/**
 * OpenAI hosted STT. This is the provider V9 has been shipping with
 * since Phase 2. Extracted here so the admin UI can swap it at runtime
 * for the self-hosted Whisper provider without touching voice-adapter.
 *
 * Pricing: OpenAI's audio transcription is billed per second of audio.
 * `gpt-4o-mini-transcribe` lists at $0.003/min ≈ $0.00005/second at
 * the time of writing. Kept as an exported constant so the admin UI
 * can show the number next to the radio.
 */
export const OPENAI_STT_USD_PER_SECOND = 0.00005; // $0.003/min

type OpenAITranscriptionRecord = {
  text?: string;
  language?: string;
  duration?: number;
  segments?: OpenAISegment[];
};

function buildPrompt(
  currentStep?: string | null,
  expectedResponseType?: string | null,
  hotwords?: string | null,
): string | undefined {
  const parts = [
    expectedResponseType ? `Expected response type: ${expectedResponseType}` : null,
    currentStep ? `Current step: ${currentStep}` : null,
    hotwords ? `Relevant terms: ${hotwords}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('\n') : undefined;
}

export class OpenAiSttProvider implements SttProvider {
  readonly id = 'openai' as const;
  readonly displayName = 'OpenAI (gpt-4o-mini-transcribe)';

  isAvailable(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async transcribe(
    request: SttTranscribeRequest,
  ): Promise<SttTranscribeResult> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured; OpenAI STT unavailable.');
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_STT_MODEL || 'gpt-4o-mini-transcribe';
    const prompt = buildPrompt(
      request.currentStep,
      request.expectedResponseType,
      request.hotwords,
    );

    const file = new File([request.audio], 'audio.wav', {
      type: request.audio.type || 'audio/wav',
    });

    const start = performance.now();
    let transcription: OpenAITranscriptionRecord;
    try {
      transcription = (await openai.audio.transcriptions.create(
        {
          file,
          model,
          response_format: 'verbose_json',
          language: 'en',
          ...(prompt ? { prompt } : {}),
        } as Parameters<OpenAI['audio']['transcriptions']['create']>[0],
        { signal: request.signal },
      )) as unknown as OpenAITranscriptionRecord;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/verbose_json/i.test(message)) throw err;
      transcription = (await openai.audio.transcriptions.create(
        {
          file,
          model,
          response_format: 'json',
          language: 'en',
          ...(prompt ? { prompt } : {}),
        } as Parameters<OpenAI['audio']['transcriptions']['create']>[0],
        { signal: request.signal },
      )) as unknown as OpenAITranscriptionRecord;
    }
    const latencyMs = Math.round(performance.now() - start);

    const text = transcription.text ?? '';
    const language = transcription.language ?? 'en';
    const durationSeconds =
      typeof transcription.duration === 'number' ? transcription.duration : 0;
    const segments: OpenAISegment[] = Array.isArray(transcription.segments)
      ? transcription.segments
      : [];

    return {
      text,
      segments,
      language,
      durationSeconds,
      provider: 'openai',
      model,
      cost: {
        audioSeconds: durationSeconds,
        characters: text.length,
        estimatedUsd: durationSeconds * OPENAI_STT_USD_PER_SECOND,
        latencyMs,
      },
    };
  }
}
