import { test, expect, APIRequestContext } from '@playwright/test';
import { randomUUID } from 'crypto';
import { getAuthUserId } from '../helpers/api-client';
import { ALL_FLOWS, FlowStep } from '../helpers/test-flows';

// ---------------------------------------------------------------------------
// V5-only runner — calls /api/treatment-v5
// ---------------------------------------------------------------------------

interface StepResult {
  index: number;
  label: string;
  input: string;
  currentStep: string;
  message: string;
  usedAI: boolean;
  responseTime: number;
  error?: string;
}

async function runV5Flow(
  request: APIRequestContext,
  steps: FlowStep[],
): Promise<StepResult[]> {
  const sessionId = randomUUID();
  const userId = getAuthUserId() ?? `test-user-${randomUUID()}`;
  const endpoint = '/api/treatment-v5';

  const results: StepResult[] = [];

  // Step 0: start
  const startResp = await request.post(endpoint, {
    data: { action: 'start', sessionId, userId },
  });
  expect(startResp.ok(), `start request failed: ${startResp.status()}`).toBeTruthy();
  const startJson = await startResp.json();
  results.push({
    index: 0,
    label: 'start',
    input: 'start',
    currentStep: startJson.currentStep ?? '',
    message: startJson.message ?? '',
    usedAI: startJson.usedAI ?? false,
    responseTime: startJson.responseTime ?? 0,
  });

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const resp = await request.post(endpoint, {
      data: { action: 'continue', sessionId, userId, userInput: step.input },
    });
    expect(resp.ok(), `step ${i + 1} "${step.label}" failed: ${resp.status()}`).toBeTruthy();
    const json = await resp.json();

    results.push({
      index: i + 1,
      label: step.label ?? `step ${i + 1}`,
      input: step.input,
      currentStep: json.currentStep ?? '',
      message: json.message ?? '',
      usedAI: json.usedAI ?? false,
      responseTime: json.responseTime ?? 0,
      error: json.error,
    });
  }

  return results;
}

function assertV5Flow(results: StepResult[], steps: FlowStep[]) {
  const failures: string[] = [];

  for (const r of results) {
    if (r.index === 0) continue;
    const stepDef = steps[r.index - 1];
    const prefix = `[${r.index}] "${r.label}"`;

    if (r.error) {
      failures.push(`${prefix}: API error: ${r.error}`);
      continue;
    }

    if (stepDef.expectStep) {
      if (r.currentStep !== stepDef.expectStep) {
        failures.push(
          `${prefix}: STEP MISMATCH  expected="${stepDef.expectStep}" got="${r.currentStep}"`,
        );
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`V5 flow failures:\n${failures.join('\n')}`);
  }
}

// ---------------------------------------------------------------------------
// Test cases — one per flow
// ---------------------------------------------------------------------------

for (const [flowName, flowSteps] of Object.entries(ALL_FLOWS)) {
  test(`V5: ${flowName}`, async ({ request }) => {
    const results = await runV5Flow(request, flowSteps as FlowStep[]);
    assertV5Flow(results, flowSteps as FlowStep[]);
  });
}
