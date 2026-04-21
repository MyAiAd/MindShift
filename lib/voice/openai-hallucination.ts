// Server-side hallucination filter for OpenAI STT (US-002 / US-003).
//
// Extracted from app/api/transcribe/route.ts so that unit tests can import
// `detectOpenAIHallucination` without pulling the Next.js route into the
// test harness — and, more importantly, so that `app/api/transcribe/route.ts`
// does not have to re-export an illegal `__test__` field (Next 14 rejects
// non-whitelisted exports on route files, which breaks the production build).
//
// OpenAI's Whisper API produces hallucinations on silence / noise just like
// the self-hosted model. The OpenAI path previously had zero filtering,
// allowing phantom transcripts (often non-English) to reach the client.

export const OPENAI_HALLUCINATION_PHRASES = new Set([
  'thanks for watching', 'thank you for watching',
  'thanks for watching and ill see you in the next video',
  'see you in the next video', 'see you in the next one', 'see you next time',
  'thanks for listening', 'thank you for listening',
  'thank you very much', 'thank you so much', 'thank you', 'thanks',
  'bye bye', 'bye', 'goodbye',
  'please subscribe', 'subscribe to my channel',
  'like and subscribe', 'please like and subscribe',
  'hey guys', 'hi everyone', 'hello everyone', 'welcome back',
  'thats all for today', 'until next time',
  'music', 'music playing', 'applause', 'laughter', 'silence',
  // Non-English hallucinations that Whisper produces from silence
  'diolch yn fawr iawn am wylior fideo',
  'diolch yn fawr am wylior fideo',
  'diolch yn fawr',
  'ご視聴ありがとうございました', '字幕由', '谢谢观看', '감사합니다',
]);

export const OPENAI_HALLUCINATION_SUBSTRINGS = [
  'thanks for watching', 'thank you for watching',
  'see you in the next video', 'subscribe to my channel',
  'like and subscribe', 'welcome to my channel',
  'subtitles by', 'captions by', 'transcribed by',
  'amara.org', 'mozilla foundation',
  'diolch yn fawr', 'am wylior fideo', 'am wylio\'r fideo',
];

export type OpenAISegment = {
  avg_logprob?: number;
  no_speech_prob?: number;
  compression_ratio?: number;
  text?: string;
};

export type HallucinationDiagnostics = {
  filtered: boolean;
  reason: string | null;
  avgNoSpeechProb: number | null;
  avgLogprob: number | null;
  wordCount: number;
};

/**
 * Apply server-side hallucination metadata gates in PRD order:
 *   (1) language !== 'en' on v7 sessions
 *   (2) avg(no_speech_prob) > 0.6
 *   (3) avg(avg_logprob) < -1.0 AND duration < 3.0s
 *   (4) duration < 1.5s AND word_count > 8
 *   (5) exact or substring match against the deny-lists above
 *
 * Returns the filtered decision plus the numeric inputs so callers can emit
 * structured logs.
 */
export function detectOpenAIHallucination(
  transcript: string,
  language: string,
  segments: OpenAISegment[],
  duration: number,
  treatmentVersion: string | null,
): HallucinationDiagnostics {
  const trimmed = transcript?.trim() ?? '';
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

  const noSpeechProbs = (segments || [])
    .map((s) => s.no_speech_prob)
    .filter((v): v is number => typeof v === 'number');
  const avgNoSpeechProb = noSpeechProbs.length > 0
    ? noSpeechProbs.reduce((a, b) => a + b, 0) / noSpeechProbs.length
    : null;

  const logprobs = (segments || [])
    .map((s) => s.avg_logprob)
    .filter((v): v is number => typeof v === 'number');
  const avgLogprob = logprobs.length > 0
    ? logprobs.reduce((a, b) => a + b, 0) / logprobs.length
    : null;

  if (!trimmed) {
    return { filtered: false, reason: null, avgNoSpeechProb, avgLogprob, wordCount };
  }

  if (treatmentVersion === 'v7' && language && language !== 'en') {
    return {
      filtered: true,
      reason: `non_english_language: ${language}`,
      avgNoSpeechProb,
      avgLogprob,
      wordCount,
    };
  }

  if (avgNoSpeechProb !== null && avgNoSpeechProb > 0.6) {
    return {
      filtered: true,
      reason: `high_no_speech_prob: ${avgNoSpeechProb.toFixed(3)}`,
      avgNoSpeechProb,
      avgLogprob,
      wordCount,
    };
  }

  if (avgLogprob !== null && avgLogprob < -1.0 && duration < 3.0) {
    return {
      filtered: true,
      reason: `low_confidence_short_audio: logprob=${avgLogprob.toFixed(3)}, duration=${duration.toFixed(2)}s`,
      avgNoSpeechProb,
      avgLogprob,
      wordCount,
    };
  }

  if (duration < 1.5 && wordCount > 8) {
    return {
      filtered: true,
      reason: `duration_mismatch: ${wordCount} words in ${duration.toFixed(2)}s`,
      avgNoSpeechProb,
      avgLogprob,
      wordCount,
    };
  }

  const normalized = transcript.toLowerCase().replace(/[^\w\s']/g, '').replace(/\s+/g, ' ').trim();
  if (OPENAI_HALLUCINATION_PHRASES.has(normalized)) {
    return {
      filtered: true,
      reason: `exact_match: "${normalized}"`,
      avgNoSpeechProb,
      avgLogprob,
      wordCount,
    };
  }
  for (const pattern of OPENAI_HALLUCINATION_SUBSTRINGS) {
    if (normalized.includes(pattern)) {
      return {
        filtered: true,
        reason: `substring_match: "${pattern}"`,
        avgNoSpeechProb,
        avgLogprob,
        wordCount,
      };
    }
  }

  return { filtered: false, reason: null, avgNoSpeechProb, avgLogprob, wordCount };
}
