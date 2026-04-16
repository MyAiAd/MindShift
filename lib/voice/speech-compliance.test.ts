import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectRoutingToken,
  normalizeSpeechText,
  validateSpeechOutput,
} from './speech-compliance';

test('normalizeSpeechText collapses whitespace for exact-match checks', () => {
  assert.equal(
    normalizeSpeechText('Hello   world\n\nagain'),
    'Hello world again'
  );
});

test('detectRoutingToken catches literal routing tokens with surrounding whitespace', () => {
  assert.equal(
    detectRoutingToken('  METHOD_SELECTION_NEEDED  '),
    'METHOD_SELECTION_NEEDED'
  );
});

test('detectRoutingToken does not false-positive on natural English that resembles a token', () => {
  assert.equal(
    detectRoutingToken('method selection needed'),
    null
  );
  assert.equal(
    detectRoutingToken("Let's transition to dig deeper into this feeling"),
    null
  );
});

test('validateSpeechOutput passes when exact speech matches server message', () => {
  const result = validateSpeechOutput({
    textToSpeak: 'Hello there',
    apiMessage: 'Hello there',
  });

  assert.deepEqual(result, { ok: true });
});

test('validateSpeechOutput passes when normalized speech matches server message', () => {
  const result = validateSpeechOutput({
    textToSpeak: 'Hello   there',
    apiMessage: 'Hello there',
  });

  assert.deepEqual(result, { ok: true });
});

test('validateSpeechOutput rejects routing tokens', () => {
  const result = validateSpeechOutput({
    textToSpeak: 'TRANSITION_TO_DIG_DEEPER',
    apiMessage: 'TRANSITION_TO_DIG_DEEPER',
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail('Expected routing token failure');
  }
  assert.equal(result.reason, 'routing_token');
});

test('validateSpeechOutput rejects mismatched spoken text', () => {
  const result = validateSpeechOutput({
    textToSpeak: 'Hello there',
    apiMessage: 'Goodbye there',
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail('Expected message mismatch failure');
  }
  assert.equal(result.reason, 'message_mismatch');
});

test('detectRoutingToken catches every registered token', () => {
  const { ROUTING_TOKENS } = require('../v7/routing-tokens');
  for (const token of ROUTING_TOKENS) {
    assert.equal(
      detectRoutingToken(token),
      token,
      `Expected detectRoutingToken to catch "${token}"`
    );
  }
});

test('detectRoutingToken catches lowercase-with-underscores variant of a token', () => {
  assert.equal(
    detectRoutingToken('problem_selection_confirmed'),
    'PROBLEM_SELECTION_CONFIRMED',
    'Lowercase with underscores should match (case-insensitive, underscores preserved)'
  );
});

test('detectRoutingToken catches token embedded in surrounding text', () => {
  assert.equal(
    detectRoutingToken('prefix ROUTE_TO_INTEGRATION suffix'),
    'ROUTE_TO_INTEGRATION'
  );
});

test('validateSpeechOutput passes when no apiMessage is provided', () => {
  const result = validateSpeechOutput({
    textToSpeak: 'Clean therapeutic text',
  });
  assert.deepEqual(result, { ok: true });
});

test('validateSpeechOutput passes for clean text with apiMessage null', () => {
  const result = validateSpeechOutput({
    textToSpeak: 'Please describe what you are feeling.',
    apiMessage: null,
  });
  assert.deepEqual(result, { ok: true });
});

test('validateSpeechOutput rejects every registered routing token as speech', () => {
  const { ROUTING_TOKENS } = require('../v7/routing-tokens');
  for (const token of ROUTING_TOKENS) {
    const result = validateSpeechOutput({ textToSpeak: token });
    assert.equal(
      result.ok,
      false,
      `Token "${token}" should be rejected as speech output`
    );
  }
});
