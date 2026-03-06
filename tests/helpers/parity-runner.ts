import { test, expect, APIRequestContext } from '@playwright/test';
import { createParityPair, TreatmentApiClient, TreatmentResponse } from './api-client';
import {
  normalizeStep,
  normalizeMessage,
  extractProblemRefs,
  isKnownDifference,
  getKnownDifferenceReason,
  isRoutingSignal,
  Divergence,
  FlowReport,
  StepDetail,
} from './comparator';
import { FlowStep } from './test-flows';

export interface StepResult {
  index: number;
  label: string;
  input: string;
  response: TreatmentResponse;
  stepNorm: string;
}

export interface ParityStepResult {
  index: number;
  label: string;
  input: string;
  v2: TreatmentResponse;
  v4: TreatmentResponse;
  v2StepNorm: string;
  v4StepNorm: string;
}

// ---------------------------------------------------------------------------
// V4-only flow runner (primary mode -- always works against live server)
// ---------------------------------------------------------------------------

export async function runV4Flow(
  request: APIRequestContext,
  steps: FlowStep[],
): Promise<{ results: StepResult[]; client: TreatmentApiClient }> {
  const client = new TreatmentApiClient(request, '/api/treatment-v4');

  const startResp = await client.start();
  const results: StepResult[] = [
    {
      index: 0,
      label: 'start',
      input: 'start',
      response: startResp,
      stepNorm: normalizeStep(startResp.currentStep),
    },
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const resp = await client.continue(step.input);

    results.push({
      index: i + 1,
      label: step.label || `step ${i + 1}`,
      input: step.input,
      response: resp,
      stepNorm: normalizeStep(resp.currentStep),
    });
  }

  return { results, client };
}

export function assertV4Flow(
  results: StepResult[],
  steps: FlowStep[],
  problem?: string,
) {
  const failures: string[] = [];

  for (const r of results) {
    if (r.index === 0) continue;
    const stepDef = steps[r.index - 1];
    const prefix = `[${r.index}] "${r.label}"`;

    if (stepDef.expectStep) {
      const expected = normalizeStep(stepDef.expectStep);
      if (r.stepNorm !== expected) {
        failures.push(
          `${prefix}: STEP MISMATCH  expected="${expected}" got="${r.response.currentStep}" (normalized="${r.stepNorm}")`
        );
      }
    }

    if (stepDef.checkProblemRef && problem) {
      const refs = extractProblemRefs(r.response.message);
      const found = refs.some(
        ref => ref.toLowerCase().includes(problem.toLowerCase())
      );
      if (!found && refs.length > 0) {
        failures.push(
          `${prefix}: PROBLEM REF MISMATCH\n` +
          `  expected to find: "${problem}"\n` +
          `  found refs: [${refs.join(', ')}]\n` +
          `  message: "${r.response.message.substring(0, 150)}..."`
        );
      }
    }

    if (!r.response.success) {
      failures.push(
        `${prefix}: API returned success=false\n` +
        `  error: ${r.response.error || 'unknown'}\n` +
        `  details: ${r.response.details || 'none'}`
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `V4 flow failures (${failures.length}):\n\n${failures.join('\n\n')}`
    );
  }
}

// ---------------------------------------------------------------------------
// Parity runner (v2 + v4 side-by-side)
// ---------------------------------------------------------------------------

export async function runParityFlow(
  request: APIRequestContext,
  steps: FlowStep[],
): Promise<{
  results: ParityStepResult[];
  v2: TreatmentApiClient;
  v4: TreatmentApiClient;
  v2Failed: boolean;
  v2FailureStep?: number;
  v2FailureError?: string;
  v4Failed: boolean;
  v4FailureStep?: number;
  v4FailureError?: string;
}> {
  const { v2, v4 } = createParityPair(request);

  const [v2Start, v4Start] = await Promise.all([v2.start(), v4.start()]);

  const results: ParityStepResult[] = [
    {
      index: 0,
      label: 'start',
      input: 'start',
      v2: v2Start,
      v4: v4Start,
      v2StepNorm: normalizeStep(v2Start.currentStep),
      v4StepNorm: normalizeStep(v4Start.currentStep),
    },
  ];

  let v2Failed = false;
  let v2FailureStep: number | undefined;
  let v2FailureError: string | undefined;
  let v4Failed = false;
  let v4FailureStep: number | undefined;
  let v4FailureError: string | undefined;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    let v2Resp: TreatmentResponse;
    let v4Resp: TreatmentResponse;

    const makeFailed = (version: 'v2' | 'v4', client: TreatmentApiClient, msg: string): TreatmentResponse => ({
      success: false,
      sessionId: client.sessionId,
      message: `${version.toUpperCase()}_ERROR: ${msg}`,
      currentStep: `${version}_error`,
      responseTime: 0,
      usedAI: false,
    });

    const makeSkipped = (version: 'v2' | 'v4', client: TreatmentApiClient): TreatmentResponse => ({
      success: false,
      sessionId: client.sessionId,
      message: `${version.toUpperCase()}_SKIPPED: previous step failed`,
      currentStep: `${version}_skipped`,
      responseTime: 0,
      usedAI: false,
    });

    // V4
    if (!v4Failed) {
      try {
        v4Resp = await v4.continue(step.input);
      } catch (e) {
        const errMsg = (e as Error).message.substring(0, 200);
        console.warn(`  [parity] v4 failed at step ${i + 1} ("${step.label}"): ${errMsg}`);
        v4Failed = true;
        v4FailureStep = i + 1;
        v4FailureError = errMsg;
        v4Resp = makeFailed('v4', v4, errMsg);
      }
    } else {
      v4Resp = makeSkipped('v4', v4);
    }

    // V2
    if (!v2Failed) {
      try {
        v2Resp = await v2.continue(step.input);
      } catch (e) {
        const errMsg = (e as Error).message.substring(0, 200);
        console.warn(`  [parity] v2 failed at step ${i + 1} ("${step.label}"): ${errMsg}`);
        v2Failed = true;
        v2FailureStep = i + 1;
        v2FailureError = errMsg;
        v2Resp = makeFailed('v2', v2, errMsg);
      }
    } else {
      v2Resp = makeSkipped('v2', v2);
    }

    // If both have crashed, no point continuing
    if (v2Failed && v4Failed) {
      results.push({
        index: i + 1,
        label: step.label || `step ${i + 1}`,
        input: step.input,
        v2: v2Resp,
        v4: v4Resp,
        v2StepNorm: normalizeStep(v2Resp.currentStep),
        v4StepNorm: normalizeStep(v4Resp.currentStep),
      });
      break;
    }

    results.push({
      index: i + 1,
      label: step.label || `step ${i + 1}`,
      input: step.input,
      v2: v2Resp,
      v4: v4Resp,
      v2StepNorm: normalizeStep(v2Resp.currentStep),
      v4StepNorm: normalizeStep(v4Resp.currentStep),
    });
  }

  return {
    results, v2, v4,
    v2Failed, v2FailureStep, v2FailureError,
    v4Failed, v4FailureStep, v4FailureError,
  };
}

/**
 * Assert parity for steps where both v2 and v4 succeeded (original strict mode).
 */
export function assertParity(
  results: ParityStepResult[],
  steps: FlowStep[],
  v2FailureStep?: number,
) {
  const failures: string[] = [];

  for (const r of results) {
    if (v2FailureStep !== undefined && r.index >= v2FailureStep) continue;
    if (!r.v2.success) continue;

    const stepDef = r.index > 0 ? steps[r.index - 1] : undefined;
    const prefix = `[${r.index}] "${r.label}"`;

    if (isKnownDifference(r.v2.currentStep) || isKnownDifference(r.v4.currentStep)) continue;

    if (r.v2StepNorm !== r.v4StepNorm) {
      failures.push(
        `${prefix}: STEP MISMATCH  v2="${r.v2.currentStep}" vs v4="${r.v4.currentStep}"`
      );
    }

    if (stepDef?.checkProblemRef) {
      const v2Refs = extractProblemRefs(r.v2.message);
      const v4Refs = extractProblemRefs(r.v4.message);
      const refsMatch =
        v2Refs.length === v4Refs.length &&
        v2Refs.every((ref, idx) => ref === v4Refs[idx]);

      if (!refsMatch) {
        failures.push(
          `${prefix}: PROBLEM REF MISMATCH\n` +
          `  v2 refs: [${v2Refs.join(', ')}]\n` +
          `  v4 refs: [${v4Refs.join(', ')}]\n` +
          `  v2 step: ${r.v2.currentStep}\n` +
          `  v4 step: ${r.v4.currentStep}`
        );
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Parity failures (${failures.length}):\n\n${failures.join('\n\n')}`
    );
  }
}

// ---------------------------------------------------------------------------
// Full side-by-side flow report builder (covers ALL differences)
// ---------------------------------------------------------------------------

/**
 * Build a FlowReport from parity run results.
 * Checks step names, FULL message text, problem refs, and routing signal leaks.
 */
export function buildFlowReport(
  flowName: string,
  results: ParityStepResult[],
  steps: FlowStep[],
  v2Failed: boolean,
  v2FailureStep?: number,
  v2FailureError?: string,
  v4Failed?: boolean,
  v4FailureStep?: number,
  v4FailureError?: string,
): FlowReport {
  const divergences: Divergence[] = [];
  const stepDetails: StepDetail[] = [];

  for (const r of results) {
    const label = r.label;
    const v2Ok = r.v2.success !== false && r.v2.currentStep !== 'v2_error' && r.v2.currentStep !== 'v2_skipped';
    const v4Ok = r.v4.success !== false && r.v4.currentStep !== 'v4_error' && r.v4.currentStep !== 'v4_skipped';

    // Handle V4 crash
    if (!v4Ok && v4FailureStep !== undefined && r.index >= v4FailureStep) {
      stepDetails.push({
        index: r.index,
        label,
        input: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v4.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v4.message,
        v2Success: v2Ok,
        v4Success: false,
        match: r.index === v4FailureStep ? 'V2_ERROR' : 'V2_SKIPPED',
      });

      if (r.index === v4FailureStep) {
        divergences.push({
          type: 'v2_error',
          stepIndex: r.index,
          inputLabel: label,
          userInput: r.input,
          v2Step: r.v2.currentStep,
          v4Step: r.v4.currentStep,
          v2Message: r.v2.message,
          v4Message: r.v4.message,
          isKnownDiff: false,
          knownReason: null,
          detail: `V4 API crashed: ${v4FailureError ?? 'unknown'}`,
        });
      }
      continue;
    }

    // Handle V2 crash
    if (!v2Ok && v2FailureStep !== undefined && r.index >= v2FailureStep) {
      stepDetails.push({
        index: r.index,
        label,
        input: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v4.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v4.message,
        v2Success: false,
        v4Success: v4Ok,
        match: r.index === v2FailureStep ? 'V2_ERROR' : 'V2_SKIPPED',
      });

      if (r.index === v2FailureStep) {
        divergences.push({
          type: 'v2_error',
          stepIndex: r.index,
          inputLabel: label,
          userInput: r.input,
          v2Step: r.v2.currentStep,
          v4Step: r.v4.currentStep,
          v2Message: r.v2.message,
          v4Message: r.v4.message,
          isKnownDiff: false,
          knownReason: null,
          detail: `V2 API crashed: ${v2FailureError ?? 'unknown'}`,
        });
      }
      continue;
    }

    const knownV2 = isKnownDifference(r.v2.currentStep);
    const knownV4 = isKnownDifference(r.v4.currentStep);
    const isKnown = knownV2 || knownV4;
    const knownReason = getKnownDifferenceReason(r.v2.currentStep) ?? getKnownDifferenceReason(r.v4.currentStep);

    const stepsMatch = r.v2StepNorm === r.v4StepNorm;
    const v2Msg = normalizeMessage(r.v2.message);
    const v4Msg = normalizeMessage(r.v4.message);
    const messagesMatch = v2Msg === v4Msg;

    const v2Refs = extractProblemRefs(r.v2.message);
    const v4Refs = extractProblemRefs(r.v4.message);
    const refsMatch =
      v2Refs.length === v4Refs.length &&
      v2Refs.every((ref, idx) => ref === v4Refs[idx]);

    const v4Leaked = isRoutingSignal(r.v4.message);

    let match: StepDetail['match'] = 'MATCH';
    if (isKnown && (!stepsMatch || !messagesMatch)) {
      match = 'KNOWN_DIFF';
    } else if (!stepsMatch || !messagesMatch || !refsMatch || v4Leaked) {
      match = 'DIVERGENCE';
    }

    stepDetails.push({
      index: r.index,
      label,
      input: r.input,
      v2Step: r.v2.currentStep,
      v4Step: r.v4.currentStep,
      v2Message: r.v2.message,
      v4Message: r.v4.message,
      v2Success: v2Ok,
      v4Success: v4Ok,
      match,
    });

    if (v4Leaked) {
      divergences.push({
        type: 'routing_signal_leaked',
        stepIndex: r.index,
        inputLabel: label,
        userInput: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v4.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v4.message,
        isKnownDiff: false,
        knownReason: null,
        detail: `V4 leaked internal routing signal "${r.v4.message}" to user`,
      });
    }

    if (!stepsMatch) {
      divergences.push({
        type: 'step_mismatch',
        stepIndex: r.index,
        inputLabel: label,
        userInput: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v4.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v4.message,
        isKnownDiff: isKnown,
        knownReason,
        detail: `Step name differs: v2="${r.v2.currentStep}" vs v4="${r.v4.currentStep}"`,
      });
    }

    if (!messagesMatch && stepsMatch) {
      divergences.push({
        type: 'message_mismatch',
        stepIndex: r.index,
        inputLabel: label,
        userInput: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v4.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v4.message,
        isKnownDiff: isKnown,
        knownReason,
        detail: 'V4 message text does not match V2 (V2 is the gold standard)',
      });
    }

    if (!refsMatch && stepsMatch && messagesMatch) {
      divergences.push({
        type: 'problem_ref_mismatch',
        stepIndex: r.index,
        inputLabel: label,
        userInput: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v4.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v4.message,
        isKnownDiff: isKnown,
        knownReason,
        detail: `Problem refs differ: v2=[${v2Refs.join(', ')}] vs v4=[${v4Refs.join(', ')}]`,
      });
    }
  }

  const v2Completed = results.filter(
    r => r.v2.success !== false && r.v2.currentStep !== 'v2_error' && r.v2.currentStep !== 'v2_skipped'
  ).length;

  return {
    flowName,
    totalSteps: results.length,
    v2StepsCompleted: v2Completed,
    v4StepsCompleted: results.filter(r => r.v4.success !== false).length,
    v2Failed,
    v2FailureStep,
    v2FailureError,
    divergences,
    stepDetails,
  };
}

export function assertMessageContainsProblem(
  response: TreatmentResponse,
  problem: string,
  label: string,
) {
  const refs = extractProblemRefs(response.message);
  const found = refs.some(
    ref => ref.toLowerCase().includes(problem.toLowerCase())
  );
  expect(
    found,
    `${label}: Expected problem "${problem}" in message quotes.\n` +
    `  Found refs: [${refs.join(', ')}]\n` +
    `  Message: "${response.message.substring(0, 200)}..."`
  ).toBe(true);
}
