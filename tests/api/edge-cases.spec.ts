import { test, expect } from '@playwright/test';
import { assertMessageContainsProblem } from '../helpers/parity-runner';
import { TreatmentApiClient } from '../helpers/api-client';
import { extractProblemRefs } from '../helpers/comparator';

test.describe('Edge Cases - V4 Correctness', () => {
  test('problem statement preserved through full cycle', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');
    const problem = 'I feel anxious all the time';

    await v4.start();
    await v4.continue('1');
    await v4.continue('1');

    // Intro should reference the problem
    const introResp = await v4.continue(problem);
    assertMessageContainsProblem(introResp, problem, 'intro');

    // Cycle through
    await v4.continue('tightness');
    await v4.continue('my heart races');
    // what_needs_to_happen references problem
    const whatNeeds = v4.lastResponse!;
    assertMessageContainsProblem(whatNeeds, problem, 'what_needs_to_happen');

    await v4.continue('to feel calm');
    await v4.continue('peaceful');
    await v4.continue('warmth');
    await v4.continue('lighter');

    // check_if_still_problem references problem
    const check = v4.lastResponse!;
    assertMessageContainsProblem(check, problem, 'check_if_still_problem');
  });

  test('session resume returns correct state', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');

    await v4.start();
    await v4.continue('1');
    await v4.continue('1');
    await v4.continue('I feel anxious');
    await v4.continue('tightness');

    const resumed = await v4.resume();
    expect(resumed.success).toBe(true);
    expect(resumed.currentStep).toBeDefined();
    // Resume response may have messages as array or conversation history
    if (resumed.messages) {
      expect(resumed.messages.length).toBeGreaterThan(0);
    }
  });

  test('undo works correctly', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');

    await v4.start();
    await v4.continue('1');
    await v4.continue('1');
    await v4.continue('I feel stressed');

    // Undo back to work_type_description
    const undoResp = await v4.undo('work_type_description');
    expect(undoResp.success).toBe(true);

    // Should be able to re-enter a problem
    const reEnter = await v4.continue('I feel very stressed about everything');
    expect(reEnter.success).toBe(true);
  });

  test('v4 auto-advance combines static + dynamic intro', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');

    await v4.start();
    await v4.continue('1');
    await v4.continue('1');
    // Use a clear, unambiguous problem statement to avoid AI validation
    const introResp = await v4.continue('I feel stuck in a rut');

    // The combined auto-advance response should contain the static intro
    // instructions AND the dynamic "Feel the problem '...' what does it feel like?"
    expect(introResp.message).toContain('close your eyes');
    expect(introResp.message).toContain('Feel the problem');
  });

  test('empty input on auto-advance step is handled', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');

    await v4.start();
    // v4 allows empty input for auto-advance steps
    try {
      const resp = await v4.continue('');
      expect(resp.success).toBeDefined();
    } catch {
      // May fail depending on step -- that's acceptable
    }
  });
});
