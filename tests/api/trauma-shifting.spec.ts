import { test, expect } from '@playwright/test';
import { runV4Flow, assertV4Flow, runParityFlow, assertParity } from '../helpers/parity-runner';
import { TRAUMA_SHIFTING_SIMPLE } from '../helpers/test-flows';
import { TreatmentApiClient } from '../helpers/api-client';

test.describe('Trauma Shifting - V4 Correctness', () => {
  test('simple flow: completes without errors', async ({ request }) => {
    const { results } = await runV4Flow(request, TRAUMA_SHIFTING_SIMPLE);
    assertV4Flow(results, TRAUMA_SHIFTING_SIMPLE);
  });

  test('experience check clears correctly', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');

    await v4.start();
    await v4.continue('3');
    await v4.continue('Car accident last year');
    await v4.continue('yes'); // agree to trauma process

    // Identity + dissolve
    await v4.continue('victim');
    for (const input of ['fear', 'shaking', 'terror', 'it lessens', 'calmer']) {
      await v4.continue(input);
    }

    // Post-dissolve checks
    await v4.continue('no'); // future identity
    await v4.continue('no'); // future scenario
    const expCheck = await v4.continue('no'); // experience check
    expect(expCheck.success).toBe(true);
  });
});

test.describe('Trauma Shifting - V2/V4 Parity', () => {
  test('trauma flow: v2 and v4 steps match', async ({ request }) => {
    const { results, v2Failed, v2FailureStep } = await runParityFlow(
      request,
      TRAUMA_SHIFTING_SIMPLE,
    );
    if (v2Failed) {
      console.warn(`  v2 failed at step ${v2FailureStep}`);
    }
    assertParity(results, TRAUMA_SHIFTING_SIMPLE, v2FailureStep);
  });
});
