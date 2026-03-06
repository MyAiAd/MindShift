import { test, expect } from '@playwright/test';
import { runV4Flow, assertV4Flow, assertMessageContainsProblem } from '../helpers/parity-runner';
import { PROBLEM_SHIFTING_SIMPLE, PROBLEM_SHIFTING_WITH_CYCLING } from '../helpers/test-flows';
import { TreatmentApiClient } from '../helpers/api-client';
import { extractProblemRefs } from '../helpers/comparator';

test.describe('Problem Shifting - V4 Correctness', () => {
  test('simple flow: steps land correctly', async ({ request }) => {
    const { results } = await runV4Flow(request, PROBLEM_SHIFTING_SIMPLE);
    assertV4Flow(results, PROBLEM_SHIFTING_SIMPLE, 'I feel anxious all the time');
  });

  test('simple flow: problem ref is correct throughout', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');
    const problem = 'I feel anxious all the time';

    await v4.start();
    await v4.continue('1');
    await v4.continue('1');
    // After entering problem, v4 auto-advances to intro_dynamic
    const introResp = await v4.continue(problem);

    // intro_dynamic should reference the problem in quotes
    assertMessageContainsProblem(introResp, problem, 'Problem Shifting intro');

    // Continue through cycle and check what_needs_to_happen references problem
    await v4.continue('tightness'); // feeling → body_sensation_check
    await v4.continue('my heart races'); // body → what_needs_to_happen
    const whatNeeds = v4.lastResponse!;
    assertMessageContainsProblem(whatNeeds, problem, 'what_needs_to_happen_step');

    await v4.continue('to feel calm'); // → feel_solution_state
    await v4.continue('peaceful'); // → feel_good_state
    await v4.continue('warmth'); // → what_happens_step
    await v4.continue('lighter'); // → check_if_still_problem

    const stillProblem = v4.lastResponse!;
    assertMessageContainsProblem(stillProblem, problem, 'check_if_still_problem');
  });

  test('with cycling: steps and problem refs stay consistent', async ({ request }) => {
    const { results } = await runV4Flow(request, PROBLEM_SHIFTING_WITH_CYCLING);
    assertV4Flow(results, PROBLEM_SHIFTING_WITH_CYCLING, 'I feel overwhelmed at work');
  });

  test('with cycling: problem statement does not change across cycles', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');
    const problem = 'I feel overwhelmed at work';

    await v4.start();
    await v4.continue('1');
    await v4.continue('1');
    const introResp = await v4.continue(problem);
    assertMessageContainsProblem(introResp, problem, 'Cycle 1: intro');

    // Cycle 1
    await v4.continue('stress');
    await v4.continue('tension');
    await v4.continue('to have balance');
    await v4.continue('free');
    await v4.continue('energy');
    await v4.continue('relaxed');

    // "yes" → cycles back
    const cycle1Check = await v4.continue('yes');
    assertMessageContainsProblem(cycle1Check, problem, 'Cycle 1: still a problem (yes)');

    // Cycle 2 feel_problem should still reference original
    const cycle2Feel = v4.lastResponse!;
    const refs = extractProblemRefs(cycle2Feel.message);
    const usesOriginal = refs.some(r => r.toLowerCase().includes('overwhelmed'));
    expect(usesOriginal, `Cycle 2 should still reference "${problem}"`).toBe(true);
  });
});
