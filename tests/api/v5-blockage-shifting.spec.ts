import { test, expect } from '@playwright/test';
import { TreatmentApiClient } from '../helpers/api-client';

test.describe('V5 Blockage Shifting', () => {
  test('keeps cycling when user says "not good" at step E', async ({ request }) => {
    const v5 = new TreatmentApiClient(request, '/api/treatment-v5');

    await v5.start();
    await v5.continue('1'); // Problem work type
    await v5.continue('4'); // Blockage Shifting
    await v5.continue('I feel stuck in my career'); // Problem statement

    // Blockage cycle A-D
    await v5.continue('frustration');
    await v5.continue('tight chest');
    await v5.continue('free and light');
    await v5.continue('lighter now');

    // Step E asks: "What's the problem now?"
    const afterStepE = await v5.continue('not good');

    // "not good" is a new active problem, not a resolved state.
    expect(afterStepE.currentStep).toBe('blockage_shifting_intro_dynamic');
    expect(afterStepE.currentStep).not.toBe('digging_deeper_start');
    expect(afterStepE.message.toLowerCase()).toContain("what does it feel like");
  });
});
