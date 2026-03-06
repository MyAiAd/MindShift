import { test, expect } from '@playwright/test';
import { runV4Flow, assertV4Flow, assertMessageContainsProblem } from '../helpers/parity-runner';
import { BLOCKAGE_SHIFTING_SIMPLE } from '../helpers/test-flows';
import { TreatmentApiClient } from '../helpers/api-client';

test.describe('Blockage Shifting - V4 Correctness', () => {
  test('simple flow: completes without errors', async ({ request }) => {
    const { results } = await runV4Flow(request, BLOCKAGE_SHIFTING_SIMPLE);
    assertV4Flow(results, BLOCKAGE_SHIFTING_SIMPLE, 'I feel stuck in my career');
  });

  test('blockage step A references the problem', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');
    const problem = 'I feel stuck in my career';

    await v4.start();
    await v4.continue('1');
    await v4.continue('4'); // Blockage Shifting
    await v4.continue(problem);

    // Step A should reference the problem
    const stepA = await v4.continue('frustration');
    assertMessageContainsProblem(stepA, problem, 'Blockage step A');
  });

  test('resolution detection works', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');

    await v4.start();
    await v4.continue('1');
    await v4.continue('4');
    await v4.continue('I feel stuck in my career');

    // Steps A-D
    await v4.continue('frustration');
    await v4.continue('in my chest');
    await v4.continue('like a wall');
    await v4.continue('it starts to crumble');

    // Step E with resolution
    const stepE = await v4.continue('the blockage is gone');
    expect(stepE.success).toBe(true);
    expect(stepE.currentStep).toBeDefined();
  });
});
