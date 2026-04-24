import { test, expect, APIRequestContext } from '@playwright/test';
import {
  createParityPair,
  createParityPairV2V5,
  createParityPairV2V6,
  createParityPairV2V9,
  TreatmentApiClient,
  TreatmentResponse,
} from './api-client';
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

export interface ParityStepResultV2V5 {
  index: number;
  label: string;
  input: string;
  v2: TreatmentResponse;
  v5: TreatmentResponse;
  v2StepNorm: string;
  v5StepNorm: string;
}

export interface ParityStepResultV2V6 {
  index: number;
  label: string;
  input: string;
  v2: TreatmentResponse;
  v6: TreatmentResponse;
  v2StepNorm: string;
  v6StepNorm: string;
}

export interface ParityStepResultV2V9 {
  index: number;
  label: string;
  input: string;
  v2: TreatmentResponse;
  v9: TreatmentResponse;
  v2StepNorm: string;
  v9StepNorm: string;
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

// ---------------------------------------------------------------------------
// Parity runner (v2 + v5 side-by-side)
// ---------------------------------------------------------------------------

export async function runParityFlowV2V5(
  request: APIRequestContext,
  steps: FlowStep[],
): Promise<{
  results: ParityStepResultV2V5[];
  v2: TreatmentApiClient;
  v5: TreatmentApiClient;
  v2Failed: boolean;
  v2FailureStep?: number;
  v2FailureError?: string;
  v5Failed: boolean;
  v5FailureStep?: number;
  v5FailureError?: string;
}> {
  const { v2, v5 } = createParityPairV2V5(request);

  const [v2Start, v5Start] = await Promise.all([v2.start(), v5.start()]);

  const results: ParityStepResultV2V5[] = [
    {
      index: 0,
      label: 'start',
      input: 'start',
      v2: v2Start,
      v5: v5Start,
      v2StepNorm: normalizeStep(v2Start.currentStep),
      v5StepNorm: normalizeStep(v5Start.currentStep),
    },
  ];

  let v2Failed = false;
  let v2FailureStep: number | undefined;
  let v2FailureError: string | undefined;
  let v5Failed = false;
  let v5FailureStep: number | undefined;
  let v5FailureError: string | undefined;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    let v2Resp: TreatmentResponse;
    let v5Resp: TreatmentResponse;

    const makeFailed = (version: 'v2' | 'v5', client: TreatmentApiClient, msg: string): TreatmentResponse => ({
      success: false,
      sessionId: client.sessionId,
      message: `${version.toUpperCase()}_ERROR: ${msg}`,
      currentStep: `${version}_error`,
      responseTime: 0,
      usedAI: false,
    });

    const makeSkipped = (version: 'v2' | 'v5', client: TreatmentApiClient): TreatmentResponse => ({
      success: false,
      sessionId: client.sessionId,
      message: `${version.toUpperCase()}_SKIPPED: previous step failed`,
      currentStep: `${version}_skipped`,
      responseTime: 0,
      usedAI: false,
    });

    if (!v5Failed) {
      try {
        v5Resp = await v5.continue(step.input);
      } catch (e) {
        const errMsg = (e as Error).message.substring(0, 200);
        console.warn(`  [parity v2v5] v5 failed at step ${i + 1} ("${step.label}"): ${errMsg}`);
        v5Failed = true;
        v5FailureStep = i + 1;
        v5FailureError = errMsg;
        v5Resp = makeFailed('v5', v5, errMsg);
      }
    } else {
      v5Resp = makeSkipped('v5', v5);
    }

    if (!v2Failed) {
      try {
        v2Resp = await v2.continue(step.input);
      } catch (e) {
        const errMsg = (e as Error).message.substring(0, 200);
        console.warn(`  [parity v2v5] v2 failed at step ${i + 1} ("${step.label}"): ${errMsg}`);
        v2Failed = true;
        v2FailureStep = i + 1;
        v2FailureError = errMsg;
        v2Resp = makeFailed('v2', v2, errMsg);
      }
    } else {
      v2Resp = makeSkipped('v2', v2);
    }

    if (v2Failed && v5Failed) {
      results.push({
        index: i + 1,
        label: step.label || `step ${i + 1}`,
        input: step.input,
        v2: v2Resp,
        v5: v5Resp,
        v2StepNorm: normalizeStep(v2Resp.currentStep),
        v5StepNorm: normalizeStep(v5Resp.currentStep),
      });
      break;
    }

    results.push({
      index: i + 1,
      label: step.label || `step ${i + 1}`,
      input: step.input,
      v2: v2Resp,
      v5: v5Resp,
      v2StepNorm: normalizeStep(v2Resp.currentStep),
      v5StepNorm: normalizeStep(v5Resp.currentStep),
    });
  }

  return {
    results, v2, v5,
    v2Failed, v2FailureStep, v2FailureError,
    v5Failed, v5FailureStep, v5FailureError,
  };
}

/**
 * Build a FlowReport from v2/v5 parity run results.
 * Maps v5 data into v4 fields and sets candidateLabel for report generation.
 */
export function buildFlowReportV2V5(
  flowName: string,
  results: ParityStepResultV2V5[],
  steps: FlowStep[],
  v2Failed: boolean,
  v2FailureStep?: number,
  v2FailureError?: string,
  v5Failed?: boolean,
  v5FailureStep?: number,
  v5FailureError?: string,
): FlowReport {
  const divergences: Divergence[] = [];
  const stepDetails: StepDetail[] = [];

  for (const r of results) {
    const label = r.label;
    const v2Ok = r.v2.success !== false && r.v2.currentStep !== 'v2_error' && r.v2.currentStep !== 'v2_skipped';
    const v5Ok = r.v5.success !== false && r.v5.currentStep !== 'v5_error' && r.v5.currentStep !== 'v5_skipped';

    if (!v5Ok && v5FailureStep !== undefined && r.index >= v5FailureStep) {
      stepDetails.push({
        index: r.index,
        label,
        input: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v5.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v5.message,
        v2Success: v2Ok,
        v4Success: false,
        match: r.index === v5FailureStep ? 'V2_ERROR' : 'V2_SKIPPED',
      });
      if (r.index === v5FailureStep) {
        divergences.push({
          type: 'v2_error',
          stepIndex: r.index,
          inputLabel: label,
          userInput: r.input,
          v2Step: r.v2.currentStep,
          v4Step: r.v5.currentStep,
          v2Message: r.v2.message,
          v4Message: r.v5.message,
          isKnownDiff: false,
          knownReason: null,
          detail: `V5 API crashed: ${v5FailureError ?? 'unknown'}`,
        });
      }
      continue;
    }

    if (!v2Ok && v2FailureStep !== undefined && r.index >= v2FailureStep) {
      stepDetails.push({
        index: r.index,
        label,
        input: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v5.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v5.message,
        v2Success: false,
        v4Success: v5Ok,
        match: r.index === v2FailureStep ? 'V2_ERROR' : 'V2_SKIPPED',
      });
      if (r.index === v2FailureStep) {
        divergences.push({
          type: 'v2_error',
          stepIndex: r.index,
          inputLabel: label,
          userInput: r.input,
          v2Step: r.v2.currentStep,
          v4Step: r.v5.currentStep,
          v2Message: r.v2.message,
          v4Message: r.v5.message,
          isKnownDiff: false,
          knownReason: null,
          detail: `V2 API crashed: ${v2FailureError ?? 'unknown'}`,
        });
      }
      continue;
    }

    const knownV2 = isKnownDifference(r.v2.currentStep);
    const knownV5 = isKnownDifference(r.v5.currentStep);
    const isKnown = knownV2 || knownV5;
    const knownReason = getKnownDifferenceReason(r.v2.currentStep) ?? getKnownDifferenceReason(r.v5.currentStep);

    const stepsMatch = r.v2StepNorm === r.v5StepNorm;
    const v2Msg = normalizeMessage(r.v2.message);
    const v5Msg = normalizeMessage(r.v5.message);
    const messagesMatch = v2Msg === v5Msg;

    const v2Refs = extractProblemRefs(r.v2.message);
    const v5Refs = extractProblemRefs(r.v5.message);
    const refsMatch =
      v2Refs.length === v5Refs.length &&
      v2Refs.every((ref, idx) => ref === v5Refs[idx]);

    const v5Leaked = isRoutingSignal(r.v5.message);

    let match: StepDetail['match'] = 'MATCH';
    if (isKnown && (!stepsMatch || !messagesMatch)) {
      match = 'KNOWN_DIFF';
    } else if (!stepsMatch || !messagesMatch || !refsMatch || v5Leaked) {
      match = 'DIVERGENCE';
    }

    stepDetails.push({
      index: r.index,
      label,
      input: r.input,
      v2Step: r.v2.currentStep,
      v4Step: r.v5.currentStep,
      v2Message: r.v2.message,
      v4Message: r.v5.message,
      v2Success: v2Ok,
      v4Success: v5Ok,
      match,
    });

    if (v5Leaked) {
      divergences.push({
        type: 'routing_signal_leaked',
        stepIndex: r.index,
        inputLabel: label,
        userInput: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v5.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v5.message,
        isKnownDiff: false,
        knownReason: null,
        detail: `V5 leaked internal routing signal "${r.v5.message}" to user`,
      });
    }

    if (!stepsMatch) {
      divergences.push({
        type: 'step_mismatch',
        stepIndex: r.index,
        inputLabel: label,
        userInput: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v5.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v5.message,
        isKnownDiff: isKnown,
        knownReason,
        detail: `Step name differs: v2="${r.v2.currentStep}" vs v5="${r.v5.currentStep}"`,
      });
    }

    if (!messagesMatch && stepsMatch) {
      divergences.push({
        type: 'message_mismatch',
        stepIndex: r.index,
        inputLabel: label,
        userInput: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v5.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v5.message,
        isKnownDiff: isKnown,
        knownReason,
        detail: 'V5 message text does not match V2 (V2 is the gold standard)',
      });
    }

    if (!refsMatch && stepsMatch && messagesMatch) {
      divergences.push({
        type: 'problem_ref_mismatch',
        stepIndex: r.index,
        inputLabel: label,
        userInput: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v5.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v5.message,
        isKnownDiff: isKnown,
        knownReason,
        detail: `Problem refs differ: v2=[${v2Refs.join(', ')}] vs v5=[${v5Refs.join(', ')}]`,
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
    v4StepsCompleted: results.filter(r => r.v5.success !== false).length,
    v2Failed,
    v2FailureStep,
    v2FailureError,
    v4Failed: v5Failed,
    v4FailureStep: v5FailureStep,
    v4FailureError: v5FailureError,
    candidateLabel: 'v5',
    divergences,
    stepDetails,
  };
}

// ---------------------------------------------------------------------------
// Parity runner (v2 + v6 side-by-side)
// ---------------------------------------------------------------------------

export async function runParityFlowV2V6(
  request: APIRequestContext,
  steps: FlowStep[],
): Promise<{
  results: ParityStepResultV2V6[];
  v2: TreatmentApiClient;
  v6: TreatmentApiClient;
  v2Failed: boolean;
  v2FailureStep?: number;
  v2FailureError?: string;
  v6Failed: boolean;
  v6FailureStep?: number;
  v6FailureError?: string;
}> {
  const { v2, v6 } = createParityPairV2V6(request);

  const [v2Start, v6Start] = await Promise.all([v2.start(), v6.start()]);

  const results: ParityStepResultV2V6[] = [
    {
      index: 0,
      label: 'start',
      input: 'start',
      v2: v2Start,
      v6: v6Start,
      v2StepNorm: normalizeStep(v2Start.currentStep),
      v6StepNorm: normalizeStep(v6Start.currentStep),
    },
  ];

  let v2Failed = false;
  let v2FailureStep: number | undefined;
  let v2FailureError: string | undefined;
  let v6Failed = false;
  let v6FailureStep: number | undefined;
  let v6FailureError: string | undefined;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    let v2Resp: TreatmentResponse;
    let v6Resp: TreatmentResponse;

    const makeFailed = (version: 'v2' | 'v6', client: TreatmentApiClient, msg: string): TreatmentResponse => ({
      success: false,
      sessionId: client.sessionId,
      message: `${version.toUpperCase()}_ERROR: ${msg}`,
      currentStep: `${version}_error`,
      responseTime: 0,
      usedAI: false,
    });

    const makeSkipped = (version: 'v2' | 'v6', client: TreatmentApiClient): TreatmentResponse => ({
      success: false,
      sessionId: client.sessionId,
      message: `${version.toUpperCase()}_SKIPPED: previous step failed`,
      currentStep: `${version}_skipped`,
      responseTime: 0,
      usedAI: false,
    });

    if (!v6Failed) {
      try {
        v6Resp = await v6.continue(step.input);
      } catch (e) {
        const errMsg = (e as Error).message.substring(0, 200);
        console.warn(`  [parity v2v6] v6 failed at step ${i + 1} ("${step.label}"): ${errMsg}`);
        v6Failed = true;
        v6FailureStep = i + 1;
        v6FailureError = errMsg;
        v6Resp = makeFailed('v6', v6, errMsg);
      }
    } else {
      v6Resp = makeSkipped('v6', v6);
    }

    if (!v2Failed) {
      try {
        v2Resp = await v2.continue(step.input);
      } catch (e) {
        const errMsg = (e as Error).message.substring(0, 200);
        console.warn(`  [parity v2v6] v2 failed at step ${i + 1} ("${step.label}"): ${errMsg}`);
        v2Failed = true;
        v2FailureStep = i + 1;
        v2FailureError = errMsg;
        v2Resp = makeFailed('v2', v2, errMsg);
      }
    } else {
      v2Resp = makeSkipped('v2', v2);
    }

    if (v2Failed && v6Failed) {
      results.push({
        index: i + 1,
        label: step.label || `step ${i + 1}`,
        input: step.input,
        v2: v2Resp,
        v6: v6Resp,
        v2StepNorm: normalizeStep(v2Resp.currentStep),
        v6StepNorm: normalizeStep(v6Resp.currentStep),
      });
      break;
    }

    results.push({
      index: i + 1,
      label: step.label || `step ${i + 1}`,
      input: step.input,
      v2: v2Resp,
      v6: v6Resp,
      v2StepNorm: normalizeStep(v2Resp.currentStep),
      v6StepNorm: normalizeStep(v6Resp.currentStep),
    });
  }

  return {
    results, v2, v6,
    v2Failed, v2FailureStep, v2FailureError,
    v6Failed, v6FailureStep, v6FailureError,
  };
}

/**
 * Build a FlowReport from v2/v6 parity run results.
 */
export function buildFlowReportV2V6(
  flowName: string,
  results: ParityStepResultV2V6[],
  steps: FlowStep[],
  v2Failed: boolean,
  v2FailureStep?: number,
  v2FailureError?: string,
  v6Failed?: boolean,
  v6FailureStep?: number,
  v6FailureError?: string,
): FlowReport {
  const divergences: Divergence[] = [];
  const stepDetails: StepDetail[] = [];

  for (const r of results) {
    const label = r.label;
    const v2Ok = r.v2.success !== false && r.v2.currentStep !== 'v2_error' && r.v2.currentStep !== 'v2_skipped';
    const v6Ok = r.v6.success !== false && r.v6.currentStep !== 'v6_error' && r.v6.currentStep !== 'v6_skipped';

    if (!v6Ok && v6FailureStep !== undefined && r.index >= v6FailureStep) {
      stepDetails.push({
        index: r.index,
        label,
        input: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v6.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v6.message,
        v2Success: v2Ok,
        v4Success: false,
        match: r.index === v6FailureStep ? 'V2_ERROR' : 'V2_SKIPPED',
      });
      if (r.index === v6FailureStep) {
        divergences.push({
          type: 'v2_error',
          stepIndex: r.index,
          inputLabel: label,
          userInput: r.input,
          v2Step: r.v2.currentStep,
          v4Step: r.v6.currentStep,
          v2Message: r.v2.message,
          v4Message: r.v6.message,
          isKnownDiff: false,
          knownReason: null,
          detail: `V6 API crashed: ${v6FailureError ?? 'unknown'}`,
        });
      }
      continue;
    }

    if (!v2Ok && v2FailureStep !== undefined && r.index >= v2FailureStep) {
      stepDetails.push({
        index: r.index,
        label,
        input: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v6.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v6.message,
        v2Success: false,
        v4Success: v6Ok,
        match: r.index === v2FailureStep ? 'V2_ERROR' : 'V2_SKIPPED',
      });
      if (r.index === v2FailureStep) {
        divergences.push({
          type: 'v2_error',
          stepIndex: r.index,
          inputLabel: label,
          userInput: r.input,
          v2Step: r.v2.currentStep,
          v4Step: r.v6.currentStep,
          v2Message: r.v2.message,
          v4Message: r.v6.message,
          isKnownDiff: false,
          knownReason: null,
          detail: `V2 API crashed: ${v2FailureError ?? 'unknown'}`,
        });
      }
      continue;
    }

    const knownV2 = isKnownDifference(r.v2.currentStep);
    const knownV6 = isKnownDifference(r.v6.currentStep);
    const isKnown = knownV2 || knownV6;
    const knownReason = getKnownDifferenceReason(r.v2.currentStep) ?? getKnownDifferenceReason(r.v6.currentStep);

    const stepsMatch = r.v2StepNorm === r.v6StepNorm;
    const v2Msg = normalizeMessage(r.v2.message);
    const v6Msg = normalizeMessage(r.v6.message);
    const messagesMatch = v2Msg === v6Msg;

    const v2Refs = extractProblemRefs(r.v2.message);
    const v6Refs = extractProblemRefs(r.v6.message);
    const refsMatch =
      v2Refs.length === v6Refs.length &&
      v2Refs.every((ref, idx) => ref === v6Refs[idx]);

    const v6Leaked = isRoutingSignal(r.v6.message);

    let match: StepDetail['match'] = 'MATCH';
    if (isKnown && (!stepsMatch || !messagesMatch)) {
      match = 'KNOWN_DIFF';
    } else if (!stepsMatch || !messagesMatch || !refsMatch || v6Leaked) {
      match = 'DIVERGENCE';
    }

    stepDetails.push({
      index: r.index,
      label,
      input: r.input,
      v2Step: r.v2.currentStep,
      v4Step: r.v6.currentStep,
      v2Message: r.v2.message,
      v4Message: r.v6.message,
      v2Success: v2Ok,
      v4Success: v6Ok,
      match,
    });

    if (v6Leaked) {
      divergences.push({
        type: 'routing_signal_leaked',
        stepIndex: r.index,
        inputLabel: label,
        userInput: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v6.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v6.message,
        isKnownDiff: false,
        knownReason: null,
        detail: `V6 leaked internal routing signal "${r.v6.message}" to user`,
      });
    }

    if (!stepsMatch) {
      divergences.push({
        type: 'step_mismatch',
        stepIndex: r.index,
        inputLabel: label,
        userInput: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v6.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v6.message,
        isKnownDiff: isKnown,
        knownReason,
        detail: `Step name differs: v2="${r.v2.currentStep}" vs v6="${r.v6.currentStep}"`,
      });
    }

    if (!messagesMatch && stepsMatch) {
      divergences.push({
        type: 'message_mismatch',
        stepIndex: r.index,
        inputLabel: label,
        userInput: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v6.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v6.message,
        isKnownDiff: isKnown,
        knownReason,
        detail: 'V6 message text does not match V2 (V2 is the gold standard)',
      });
    }

    if (!refsMatch && stepsMatch && messagesMatch) {
      divergences.push({
        type: 'problem_ref_mismatch',
        stepIndex: r.index,
        inputLabel: label,
        userInput: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v6.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v6.message,
        isKnownDiff: isKnown,
        knownReason,
        detail: `Problem refs differ: v2=[${v2Refs.join(', ')}] vs v6=[${v6Refs.join(', ')}]`,
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
    v4StepsCompleted: results.filter(r => r.v6.success !== false).length,
    v2Failed,
    v2FailureStep,
    v2FailureError,
    v4Failed: v6Failed,
    v4FailureStep: v6FailureStep,
    v4FailureError: v6FailureError,
    candidateLabel: 'v6',
    divergences,
    stepDetails,
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

// ---------------------------------------------------------------------------
// Parity runner (v2 + v9 side-by-side)
//
// V9 is a voice wrapper around V2's own state machine, so this comparison
// should always produce byte-identical `message` text. No
// `KNOWN_ACCEPTABLE_DIFFERENCES` allowlist is honoured for v9.
// ---------------------------------------------------------------------------

export async function runParityFlowV2V9(
  request: APIRequestContext,
  steps: FlowStep[],
): Promise<{
  results: ParityStepResultV2V9[];
  v2: TreatmentApiClient;
  v9: TreatmentApiClient;
  v2Failed: boolean;
  v2FailureStep?: number;
  v2FailureError?: string;
  v9Failed: boolean;
  v9FailureStep?: number;
  v9FailureError?: string;
}> {
  const { v2, v9 } = createParityPairV2V9(request);

  const [v2Start, v9Start] = await Promise.all([v2.start(), v9.start()]);

  const results: ParityStepResultV2V9[] = [
    {
      index: 0,
      label: 'start',
      input: 'start',
      v2: v2Start,
      v9: v9Start,
      v2StepNorm: normalizeStep(v2Start.currentStep),
      v9StepNorm: normalizeStep(v9Start.currentStep),
    },
  ];

  let v2Failed = false;
  let v2FailureStep: number | undefined;
  let v2FailureError: string | undefined;
  let v9Failed = false;
  let v9FailureStep: number | undefined;
  let v9FailureError: string | undefined;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    let v2Resp: TreatmentResponse;
    let v9Resp: TreatmentResponse;

    const makeFailed = (
      version: 'v2' | 'v9',
      client: TreatmentApiClient,
      msg: string,
    ): TreatmentResponse => ({
      success: false,
      sessionId: client.sessionId,
      message: `${version.toUpperCase()}_ERROR: ${msg}`,
      currentStep: `${version}_error`,
      responseTime: 0,
      usedAI: false,
    });

    const makeSkipped = (
      version: 'v2' | 'v9',
      client: TreatmentApiClient,
    ): TreatmentResponse => ({
      success: false,
      sessionId: client.sessionId,
      message: `${version.toUpperCase()}_SKIPPED: previous step failed`,
      currentStep: `${version}_skipped`,
      responseTime: 0,
      usedAI: false,
    });

    if (!v9Failed) {
      try {
        v9Resp = await v9.continue(step.input);
      } catch (e) {
        const errMsg = (e as Error).message.substring(0, 200);
        console.warn(`  [parity v2v9] v9 failed at step ${i + 1} ("${step.label}"): ${errMsg}`);
        v9Failed = true;
        v9FailureStep = i + 1;
        v9FailureError = errMsg;
        v9Resp = makeFailed('v9', v9, errMsg);
      }
    } else {
      v9Resp = makeSkipped('v9', v9);
    }

    if (!v2Failed) {
      try {
        v2Resp = await v2.continue(step.input);
      } catch (e) {
        const errMsg = (e as Error).message.substring(0, 200);
        console.warn(`  [parity v2v9] v2 failed at step ${i + 1} ("${step.label}"): ${errMsg}`);
        v2Failed = true;
        v2FailureStep = i + 1;
        v2FailureError = errMsg;
        v2Resp = makeFailed('v2', v2, errMsg);
      }
    } else {
      v2Resp = makeSkipped('v2', v2);
    }

    if (v2Failed && v9Failed) {
      results.push({
        index: i + 1,
        label: step.label || `step ${i + 1}`,
        input: step.input,
        v2: v2Resp,
        v9: v9Resp,
        v2StepNorm: normalizeStep(v2Resp.currentStep),
        v9StepNorm: normalizeStep(v9Resp.currentStep),
      });
      break;
    }

    results.push({
      index: i + 1,
      label: step.label || `step ${i + 1}`,
      input: step.input,
      v2: v2Resp,
      v9: v9Resp,
      v2StepNorm: normalizeStep(v2Resp.currentStep),
      v9StepNorm: normalizeStep(v9Resp.currentStep),
    });
  }

  return {
    results, v2, v9,
    v2Failed, v2FailureStep, v2FailureError,
    v9Failed, v9FailureStep, v9FailureError,
  };
}

/**
 * Build a FlowReport from v2/v9 parity run results.
 *
 * NOTE: v9 treats every known-acceptable-difference as a bug. The
 * `isKnownDiff` flag is therefore always forced to `false` here so the CI
 * gate blocks on any divergence, no allowlist.
 */
export function buildFlowReportV2V9(
  flowName: string,
  results: ParityStepResultV2V9[],
  steps: FlowStep[],
  v2Failed: boolean,
  v2FailureStep?: number,
  v2FailureError?: string,
  v9Failed?: boolean,
  v9FailureStep?: number,
  v9FailureError?: string,
): FlowReport {
  const divergences: Divergence[] = [];
  const stepDetails: StepDetail[] = [];

  for (const r of results) {
    const label = r.label;
    const v2Ok = r.v2.success !== false && r.v2.currentStep !== 'v2_error' && r.v2.currentStep !== 'v2_skipped';
    const v9Ok = r.v9.success !== false && r.v9.currentStep !== 'v9_error' && r.v9.currentStep !== 'v9_skipped';

    if (!v9Ok && v9FailureStep !== undefined && r.index >= v9FailureStep) {
      stepDetails.push({
        index: r.index,
        label,
        input: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v9.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v9.message,
        v2Success: v2Ok,
        v4Success: false,
        match: r.index === v9FailureStep ? 'V2_ERROR' : 'V2_SKIPPED',
      });
      if (r.index === v9FailureStep) {
        divergences.push({
          type: 'v2_error',
          stepIndex: r.index,
          inputLabel: label,
          userInput: r.input,
          v2Step: r.v2.currentStep,
          v4Step: r.v9.currentStep,
          v2Message: r.v2.message,
          v4Message: r.v9.message,
          isKnownDiff: false,
          knownReason: null,
          detail: `V9 API crashed: ${v9FailureError ?? 'unknown'}`,
        });
      }
      continue;
    }

    if (!v2Ok && v2FailureStep !== undefined && r.index >= v2FailureStep) {
      stepDetails.push({
        index: r.index,
        label,
        input: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v9.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v9.message,
        v2Success: false,
        v4Success: v9Ok,
        match: r.index === v2FailureStep ? 'V2_ERROR' : 'V2_SKIPPED',
      });
      if (r.index === v2FailureStep) {
        divergences.push({
          type: 'v2_error',
          stepIndex: r.index,
          inputLabel: label,
          userInput: r.input,
          v2Step: r.v2.currentStep,
          v4Step: r.v9.currentStep,
          v2Message: r.v2.message,
          v4Message: r.v9.message,
          isKnownDiff: false,
          knownReason: null,
          detail: `V2 API crashed: ${v2FailureError ?? 'unknown'}`,
        });
      }
      continue;
    }

    // v9 does NOT honour the `isKnownDifference` allowlist. Every text
    // divergence between v2 and v9 is treated as a blocking defect.
    const stepsMatch = r.v2StepNorm === r.v9StepNorm;
    const v2Msg = normalizeMessage(r.v2.message);
    const v9Msg = normalizeMessage(r.v9.message);
    const messagesMatch = v2Msg === v9Msg;

    const v2Refs = extractProblemRefs(r.v2.message);
    const v9Refs = extractProblemRefs(r.v9.message);
    const refsMatch =
      v2Refs.length === v9Refs.length &&
      v2Refs.every((ref, idx) => ref === v9Refs[idx]);

    const v9Leaked = isRoutingSignal(r.v9.message);

    let match: StepDetail['match'] = 'MATCH';
    if (!stepsMatch || !messagesMatch || !refsMatch || v9Leaked) {
      match = 'DIVERGENCE';
    }

    stepDetails.push({
      index: r.index,
      label,
      input: r.input,
      v2Step: r.v2.currentStep,
      v4Step: r.v9.currentStep,
      v2Message: r.v2.message,
      v4Message: r.v9.message,
      v2Success: v2Ok,
      v4Success: v9Ok,
      match,
    });

    if (v9Leaked) {
      divergences.push({
        type: 'routing_signal_leaked',
        stepIndex: r.index,
        inputLabel: label,
        userInput: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v9.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v9.message,
        isKnownDiff: false,
        knownReason: null,
        detail: `V9 leaked internal routing signal "${r.v9.message}" to user`,
      });
    }

    if (!stepsMatch) {
      divergences.push({
        type: 'step_mismatch',
        stepIndex: r.index,
        inputLabel: label,
        userInput: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v9.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v9.message,
        isKnownDiff: false,
        knownReason: null,
        detail: `Step name differs: v2="${r.v2.currentStep}" vs v9="${r.v9.currentStep}"`,
      });
    }

    if (!messagesMatch && stepsMatch) {
      divergences.push({
        type: 'message_mismatch',
        stepIndex: r.index,
        inputLabel: label,
        userInput: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v9.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v9.message,
        isKnownDiff: false,
        knownReason: null,
        detail: 'V9 message text does not match V2 (V2 is the gold standard; no allowlist for V9)',
      });
    }

    if (!refsMatch && stepsMatch && messagesMatch) {
      divergences.push({
        type: 'problem_ref_mismatch',
        stepIndex: r.index,
        inputLabel: label,
        userInput: r.input,
        v2Step: r.v2.currentStep,
        v4Step: r.v9.currentStep,
        v2Message: r.v2.message,
        v4Message: r.v9.message,
        isKnownDiff: false,
        knownReason: null,
        detail: `Problem refs differ: v2=[${v2Refs.join(', ')}] vs v9=[${v9Refs.join(', ')}]`,
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
    v4StepsCompleted: results.filter(r => r.v9.success !== false).length,
    v2Failed,
    v2FailureStep,
    v2FailureError,
    v4Failed: v9Failed,
    v4FailureStep: v9FailureStep,
    v4FailureError: v9FailureError,
    candidateLabel: 'v9',
    divergences,
    stepDetails,
  };
}
