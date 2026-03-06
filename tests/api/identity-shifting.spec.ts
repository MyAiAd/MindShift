import { test, expect } from '@playwright/test';
import { runV4Flow, assertV4Flow } from '../helpers/parity-runner';
import { IDENTITY_SHIFTING_SIMPLE } from '../helpers/test-flows';
import { TreatmentApiClient } from '../helpers/api-client';
import { extractProblemRefs } from '../helpers/comparator';

test.describe('Identity Shifting - V4 Correctness', () => {
  test('simple flow: completes without errors', async ({ request }) => {
    const { results } = await runV4Flow(request, IDENTITY_SHIFTING_SIMPLE);
    assertV4Flow(results, IDENTITY_SHIFTING_SIMPLE, 'I feel like a failure');
  });

  test('intro references the correct problem', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');
    const problem = 'I feel like a failure';

    await v4.start();
    await v4.continue('1');
    await v4.continue('2'); // Identity Shifting
    const introResp = await v4.continue(problem);

    // The identity intro should reference the problem
    const refs = extractProblemRefs(introResp.message);
    const found = refs.some(r => r.toLowerCase().includes('failure'));
    expect(found, `Identity intro should reference "${problem}"`).toBe(true);
  });

  test('all dissolve steps complete in sequence', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');

    await v4.start();
    await v4.continue('1');
    await v4.continue('2');
    await v4.continue('I feel like a failure');
    await v4.continue('failure'); // identity

    const dissolveSteps: string[] = [];
    for (const input of ['heaviness', 'in my stomach', 'sadness', 'it fades', 'lighter', 'more open']) {
      const resp = await v4.continue(input);
      dissolveSteps.push(resp.currentStep);
      expect(resp.success).toBe(true);
    }

    // Verify we progressed through distinct steps (no stuck loops)
    const unique = new Set(dissolveSteps);
    expect(unique.size).toBeGreaterThanOrEqual(5);
  });
});
