import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/treatment-v7/route';
import { ROUTING_TOKENS } from '../lib/v7/routing-tokens';

type RouteResponse = {
  success?: boolean;
  currentStep?: string;
  expectedResponseType?: string | null;
  message?: string;
  error?: string;
};

function makeSessionId(label: string) {
  return `v7-test-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function postTreatment(body: Record<string, unknown>) {
  const request = new NextRequest(
    new Request('http://localhost/api/treatment-v7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );

  const response = await POST(request);
  const json = await response.json() as RouteResponse;

  assert.equal(response.status, 200, json.error || JSON.stringify(json));
  return json;
}

function assertNoRoutingTokenLeak(message: string | undefined) {
  assert.ok(message, 'Expected a patient-facing message');

  for (const token of ROUTING_TOKENS) {
    assert.equal(
      message.includes(token),
      false,
      `Expected message not to leak routing token "${token}"`
    );
  }
}

test('v7 start returns expected response metadata', async () => {
  const sessionId = makeSessionId('start');
  const response = await postTreatment({
    action: 'start',
    sessionId,
    userId: 'test-user',
  });

  assert.equal(response.success, true);
  assert.equal(response.currentStep, 'mind_shifting_explanation');
  assert.equal(response.expectedResponseType, 'selection');
  assertNoRoutingTokenLeak(response.message);
});

test('v7 short utterance routing stays stable for work-type selection', async () => {
  const problemSession = makeSessionId('problem');
  await postTreatment({ action: 'start', sessionId: problemSession, userId: 'test-user' });
  const problemResponse = await postTreatment({
    action: 'continue',
    sessionId: problemSession,
    userId: 'test-user',
    userInput: '1',
  });
  assert.equal(problemResponse.currentStep, 'choose_method');
  assert.ok(problemResponse.expectedResponseType);
  assertNoRoutingTokenLeak(problemResponse.message);

  const goalSession = makeSessionId('goal');
  await postTreatment({ action: 'start', sessionId: goalSession, userId: 'test-user' });
  const goalResponse = await postTreatment({
    action: 'continue',
    sessionId: goalSession,
    userId: 'test-user',
    userInput: '2',
  });
  assert.equal(goalResponse.currentStep, 'goal_description');
  assert.ok(goalResponse.expectedResponseType);
  assertNoRoutingTokenLeak(goalResponse.message);

  const traumaSession = makeSessionId('trauma');
  await postTreatment({ action: 'start', sessionId: traumaSession, userId: 'test-user' });
  const traumaResponse = await postTreatment({
    action: 'continue',
    sessionId: traumaSession,
    userId: 'test-user',
    userInput: '3',
  });
  assert.equal(traumaResponse.currentStep, 'negative_experience_description');
  assert.ok(traumaResponse.expectedResponseType);
  assertNoRoutingTokenLeak(traumaResponse.message);
});

test('v7 problem-path entry keeps routing tokens out of patient output', async () => {
  const sessionId = makeSessionId('problem-path');
  await postTreatment({ action: 'start', sessionId, userId: 'test-user' });

  const chooseMethod = await postTreatment({
    action: 'continue',
    sessionId,
    userId: 'test-user',
    userInput: '1',
  });
  assert.equal(chooseMethod.currentStep, 'choose_method');
  assertNoRoutingTokenLeak(chooseMethod.message);

  const describeProblem = await postTreatment({
    action: 'continue',
    sessionId,
    userId: 'test-user',
    userInput: '1',
  });
  assert.equal(describeProblem.currentStep, 'work_type_description');
  assertNoRoutingTokenLeak(describeProblem.message);

  const intro = await postTreatment({
    action: 'continue',
    sessionId,
    userId: 'test-user',
    userInput: 'I feel anxious all the time',
  });
  assert.ok(intro.currentStep);
  assert.ok(intro.expectedResponseType);
  assertNoRoutingTokenLeak(intro.message);
});
