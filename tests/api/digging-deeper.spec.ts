import { test, expect } from '@playwright/test';
import { runV4Flow, assertV4Flow, assertMessageContainsProblem } from '../helpers/parity-runner';
import { DIGGING_DEEPER_SINGLE, CROSS_MODALITY_DIGGING } from '../helpers/test-flows';
import { TreatmentApiClient } from '../helpers/api-client';
import { extractProblemRefs } from '../helpers/comparator';

test.describe('Digging Deeper - V4 Correctness', () => {
  test('single-level digging: completes without errors', async ({ request }) => {
    const { results } = await runV4Flow(request, DIGGING_DEEPER_SINGLE);
    assertV4Flow(results, DIGGING_DEEPER_SINGLE, 'I feel angry');
  });

  test('cross-modality digging: completes without errors', async ({ request }) => {
    const { results } = await runV4Flow(request, CROSS_MODALITY_DIGGING);
    assertV4Flow(results, CROSS_MODALITY_DIGGING, 'I feel worthless');
  });

  test('new problem is used (not original) after digging deeper restatement', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');
    const originalProblem = 'I feel angry';
    const newProblem = 'I fear losing control';

    await v4.start();
    await v4.continue('1');
    await v4.continue('1');
    await v4.continue(originalProblem);

    // Complete first cycle
    for (const input of ['rage', 'clenched fists', 'to let it go', 'peaceful', 'serenity', 'calm']) {
      await v4.continue(input);
    }
    await v4.continue('no'); // not a problem

    // Dig deeper
    await v4.continue('yes');
    await v4.continue('yes'); // future problem
    await v4.continue(newProblem); // restate
    await v4.continue('1'); // Problem Shifting

    // The feel problem step should reference the NEW problem
    const feelProblem = await v4.continue('anxiety');
    const refs = extractProblemRefs(feelProblem.message);

    const usesNewProblem = refs.some(r =>
      r.toLowerCase().includes('losing control') || r.toLowerCase().includes('fear')
    );
    const usesOriginalProblem = refs.some(r => r.toLowerCase().includes('angry'));

    expect(
      usesNewProblem,
      `Should reference new problem "${newProblem}", found: [${refs.join(', ')}]`
    ).toBe(true);

    expect(
      usesOriginalProblem,
      `Should NOT reference original "${originalProblem}", found: [${refs.join(', ')}]`
    ).toBe(false);
  });

  test('permission is only asked once', async ({ request }) => {
    const v4 = new TreatmentApiClient(request, '/api/treatment-v4');

    await v4.start();
    await v4.continue('1');
    await v4.continue('1');
    await v4.continue('I feel angry');

    // Cycle 1
    for (const input of ['rage', 'clenched fists', 'to let it go', 'peaceful', 'serenity', 'calm']) {
      await v4.continue(input);
    }
    await v4.continue('no'); // not a problem

    // Grant dig deeper permission
    const digResp = await v4.continue('yes');
    expect(digResp.success).toBe(true);

    // Future problem → new problem → cycle through
    await v4.continue('yes');
    await v4.continue('I fear losing control');
    await v4.continue('1');

    for (const input of ['anxiety', 'racing heart', 'to stay in control', 'confident', 'strength', 'empowered']) {
      await v4.continue(input);
    }
    await v4.continue('no'); // not a problem

    // Should NOT ask permission again -- should go to scenario check or similar
    const afterSecondClear = await v4.continue('no');
    expect(afterSecondClear.success).toBe(true);
    expect(afterSecondClear.currentStep).not.toBe('digging_deeper_start');
  });
});
