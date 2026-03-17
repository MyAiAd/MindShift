import { test, expect } from '@playwright/test';
import { TreatmentApiClient } from '../helpers/api-client';

test.describe('V5 goal deadline fallback', () => {
  test('does not ask deadline again for compact deadline phrasing', async ({ request }) => {
    const v5 = new TreatmentApiClient(request, '/api/treatment-v5');

    await v5.start();
    await v5.continue('2'); // Goal work type
    const goalResponse = await v5.continue('ACHIVE GOAL 1BY NOV 2026');

    expect(goalResponse.success).toBe(true);
    expect(goalResponse.currentStep).not.toBe('goal_deadline_check');
    expect(goalResponse.message.toLowerCase()).not.toContain('is there a deadline');
  });
});
