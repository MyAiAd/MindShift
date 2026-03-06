import { test, expect } from '@playwright/test';
import { runV4Flow, assertV4Flow, runParityFlow, assertParity } from '../helpers/parity-runner';
import { REALITY_SHIFTING_GOAL } from '../helpers/test-flows';
import { TreatmentApiClient } from '../helpers/api-client';
import { extractProblemRefs } from '../helpers/comparator';

test.describe('Reality Shifting (Goal) - V4 Correctness', () => {
  test('goal flow: completes without errors', async ({ request }) => {
    const { results } = await runV4Flow(request, REALITY_SHIFTING_GOAL);
    assertV4Flow(results, REALITY_SHIFTING_GOAL);
  });

  test('v4 references the goal in reality shifting messages', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');

    await v4.start();
    await v4.continue('2'); // Goal
    await v4.continue('I want to start a business by December');
    await v4.continue('yes');

    // Check that goal appears somewhere in subsequent messages
    const history = v4.conversationHistory;
    const allRefs = history
      .filter(h => h.response.message)
      .flatMap(h => extractProblemRefs(h.response.message));

    const goalFound = allRefs.some(
      ref => ref.toLowerCase().includes('start a business')
    );
    expect(goalFound, 'Goal should appear in reality shifting messages').toBe(true);
  });

  test('goal without deadline works', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');

    await v4.start();
    await v4.continue('2');
    const resp = await v4.continue('I want to be more confident');
    expect(resp.success).toBe(true);
  });
});

test.describe('Reality Shifting - V2/V4 Parity', () => {
  test('goal flow: v2 and v4 steps match', async ({ request }) => {
    const { results, v2Failed, v2FailureStep } = await runParityFlow(
      request,
      REALITY_SHIFTING_GOAL,
    );
    if (v2Failed) {
      console.warn(`  v2 failed at step ${v2FailureStep}`);
    }
    assertParity(results, REALITY_SHIFTING_GOAL, v2FailureStep);
  });
});
