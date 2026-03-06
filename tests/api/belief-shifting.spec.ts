import { test, expect } from '@playwright/test';
import { runV4Flow, assertV4Flow } from '../helpers/parity-runner';
import { BELIEF_SHIFTING_SIMPLE } from '../helpers/test-flows';
import { TreatmentApiClient } from '../helpers/api-client';
import { extractProblemRefs } from '../helpers/comparator';

test.describe('Belief Shifting - V4 Correctness', () => {
  test('simple flow: completes without errors', async ({ request }) => {
    const { results } = await runV4Flow(request, BELIEF_SHIFTING_SIMPLE);
    assertV4Flow(results, BELIEF_SHIFTING_SIMPLE, 'I can never succeed');
  });

  test('intro references the correct problem', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');
    const problem = 'I can never succeed';

    await v4.start();
    await v4.continue('1');
    await v4.continue('3'); // Belief Shifting
    const introResp = await v4.continue(problem);

    const refs = extractProblemRefs(introResp.message);
    const found = refs.some(r => r.toLowerCase().includes('succeed') || r.toLowerCase().includes('never'));
    expect(found, `Belief intro should reference "${problem}"`).toBe(true);
  });

  test('all 4 belief checks are visited in sequence', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');

    await v4.start();
    await v4.continue('1');
    await v4.continue('3');
    await v4.continue('I can never succeed');
    await v4.continue('I am not good enough'); // belief identification
    // Dissolve A-F
    for (const input of ['tightness', 'in my throat', 'fear', 'it softens', 'calmer', 'more confident']) {
      await v4.continue(input);
    }

    // 4 belief checks + problem check
    const checkSteps: string[] = [];
    for (let i = 0; i < 5; i++) {
      const resp = await v4.continue('no');
      checkSteps.push(resp.currentStep);
      expect(resp.success).toBe(true);
    }

    // Each should be a different step
    const unique = new Set(checkSteps);
    expect(unique.size).toBeGreaterThanOrEqual(4);
  });
});
