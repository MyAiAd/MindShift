/**
 * US-003: Unit tests for the OpenAI STT hallucination metadata gates.
 *
 * Runs via `npx tsx --test tests/stt-hallucination-gates.test.ts`. The gates under test come from
 * `app/api/transcribe/route.ts` via the internal `__test__` export (ESM-only, server-side).
 *
 * Gate order (from US-002):
 *   (1) language !== 'en' on v7 sessions
 *   (2) avg(no_speech_prob) > 0.6
 *   (3) avg(avg_logprob) < -1.0 AND duration < 3.0s
 *   (4) duration < 1.5s AND word_count > 8
 *   (5) exact or substring match against OPENAI_HALLUCINATION_PHRASES / SUBSTRINGS
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { __test__ } from '../app/api/transcribe/route';

const { detectOpenAIHallucination } = __test__;

test('gate 1: non-English language is filtered for v7 sessions only', () => {
  const v7 = detectOpenAIHallucination(
    'Diolch yn fawr iawn',
    'cy',
    [{ no_speech_prob: 0.2, avg_logprob: -0.3 }],
    2.0,
    'v7',
  );
  assert.equal(v7.filtered, true);
  assert.match(v7.reason ?? '', /non_english_language/);
  assert.match(v7.reason ?? '', /cy/);

  const legacy = detectOpenAIHallucination(
    'Diolch yn fawr iawn',
    'cy',
    [{ no_speech_prob: 0.2, avg_logprob: -0.3 }],
    2.0,
    null,
  );
  // Legacy (non-v7) sessions bypass the language gate. They may still be filtered by substring —
  // "diolch yn fawr" is in the deny-list — so we just assert the reason is NOT the language gate.
  if (legacy.filtered) {
    assert.doesNotMatch(legacy.reason ?? '', /non_english_language/);
  }
});

test('gate 1: English on v7 is NOT filtered by the language gate', () => {
  const result = detectOpenAIHallucination(
    'I want to feel calm',
    'en',
    [{ no_speech_prob: 0.2, avg_logprob: -0.3 }],
    2.0,
    'v7',
  );
  assert.equal(result.filtered, false);
  assert.equal(result.reason, null);
});

test('gate 2: average no_speech_prob above 0.6 triggers filter', () => {
  const result = detectOpenAIHallucination(
    'I want to feel calm',
    'en',
    [
      { no_speech_prob: 0.7, avg_logprob: -0.3 },
      { no_speech_prob: 0.8, avg_logprob: -0.2 },
    ],
    2.5,
    'v7',
  );
  assert.equal(result.filtered, true);
  assert.match(result.reason ?? '', /high_no_speech_prob/);
});

test('gate 2 boundary: exactly 0.6 does NOT trigger', () => {
  const result = detectOpenAIHallucination(
    'I want to feel calm',
    'en',
    [{ no_speech_prob: 0.6, avg_logprob: -0.3 }],
    2.5,
    'v7',
  );
  assert.equal(result.filtered, false);
});

test('gate 3: low avg_logprob on short audio triggers filter', () => {
  const result = detectOpenAIHallucination(
    'I want to feel calm',
    'en',
    [{ no_speech_prob: 0.3, avg_logprob: -1.5 }],
    2.0,
    'v7',
  );
  assert.equal(result.filtered, true);
  assert.match(result.reason ?? '', /low_confidence_short_audio/);
});

test('gate 3: low avg_logprob but long audio does NOT trigger', () => {
  const result = detectOpenAIHallucination(
    'I want to feel calm',
    'en',
    [{ no_speech_prob: 0.3, avg_logprob: -1.5 }],
    5.0,
    'v7',
  );
  assert.equal(result.filtered, false);
});

test('gate 4: short audio with long transcript triggers duration_mismatch', () => {
  const result = detectOpenAIHallucination(
    'this is a very long transcript that should not fit in short audio',
    'en',
    [{ no_speech_prob: 0.3, avg_logprob: -0.3 }],
    1.0,
    'v7',
  );
  assert.equal(result.filtered, true);
  assert.match(result.reason ?? '', /duration_mismatch/);
});

test('gate 4 boundary: 1.5s with 8 words does NOT trigger', () => {
  const result = detectOpenAIHallucination(
    'one two three four five six seven eight',
    'en',
    [{ no_speech_prob: 0.3, avg_logprob: -0.3 }],
    1.5,
    'v7',
  );
  assert.equal(result.filtered, false);
});

test('gate 5: exact-phrase match triggers filter', () => {
  const result = detectOpenAIHallucination(
    'thanks for watching',
    'en',
    [{ no_speech_prob: 0.2, avg_logprob: -0.2 }],
    2.5,
    'v7',
  );
  assert.equal(result.filtered, true);
  assert.match(result.reason ?? '', /exact_match/);
});

test('gate 5: substring match triggers filter', () => {
  const result = detectOpenAIHallucination(
    'Hey everyone, thanks for watching and have a great day',
    'en',
    [{ no_speech_prob: 0.2, avg_logprob: -0.2 }],
    3.5,
    'v7',
  );
  assert.equal(result.filtered, true);
  assert.match(result.reason ?? '', /substring_match|exact_match/);
});

test('empty transcript is never filtered', () => {
  const result = detectOpenAIHallucination('', 'en', [], 0, 'v7');
  assert.equal(result.filtered, false);
  assert.equal(result.reason, null);
});

test('real user input with clean metadata passes', () => {
  const result = detectOpenAIHallucination(
    'I want to shift this feeling of anxiety about the meeting tomorrow',
    'en',
    [{ no_speech_prob: 0.15, avg_logprob: -0.25 }],
    4.0,
    'v7',
  );
  assert.equal(result.filtered, false);
  assert.equal(result.reason, null);
});

test('diagnostics surface the computed averages for structured logging', () => {
  const result = detectOpenAIHallucination(
    'I want to feel calm',
    'en',
    [
      { no_speech_prob: 0.1, avg_logprob: -0.2 },
      { no_speech_prob: 0.3, avg_logprob: -0.4 },
    ],
    2.5,
    'v7',
  );
  assert.equal(result.filtered, false);
  assert.ok(result.avgNoSpeechProb !== null);
  assert.ok(Math.abs(result.avgNoSpeechProb - 0.2) < 1e-9);
  assert.ok(result.avgLogprob !== null);
  assert.ok(Math.abs(result.avgLogprob + 0.3) < 1e-9);
  assert.equal(result.wordCount, 5);
});
