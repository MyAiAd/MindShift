import { test } from '@playwright/test';
import { runV4Flow, assertV4Flow, runParityFlow, assertParity } from '../helpers/parity-runner';
import { ALL_FLOWS, V2_COMPATIBLE_FLOWS, FlowStep } from '../helpers/test-flows';

/**
 * V4 correctness: run every flow against v4 and verify steps + problem refs.
 */
for (const [flowName, flowSteps] of Object.entries(ALL_FLOWS)) {
  test(`V4: ${flowName}`, async ({ request }) => {
    const { results } = await runV4Flow(request, flowSteps as FlowStep[]);
    assertV4Flow(results, flowSteps as FlowStep[]);
  });
}

/**
 * Parity: for flows where v2 works on the live server, compare v2 and v4.
 */
for (const [flowName, flowSteps] of Object.entries(V2_COMPATIBLE_FLOWS)) {
  test(`PARITY: ${flowName}`, async ({ request }) => {
    const { results, v2Failed, v2FailureStep } = await runParityFlow(
      request,
      flowSteps as FlowStep[],
    );
    if (v2Failed) {
      console.warn(`  v2 failed at step ${v2FailureStep} -- parity check limited to earlier steps`);
    }
    assertParity(results, flowSteps as FlowStep[], v2FailureStep);
  });
}
