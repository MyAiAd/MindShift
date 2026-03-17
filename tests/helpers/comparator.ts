import { TreatmentResponse } from './api-client';

/**
 * V4 renames some steps or splits them into static/dynamic pairs.
 * This map converts v4 step names back to their v2 equivalents.
 */
const V4_TO_V2_STEP_MAP: Record<string, string> = {
  'mind_shifting_explanation_dynamic': 'mind_shifting_explanation',
  'mind_shifting_explanation_static': 'mind_shifting_explanation',
  'problem_shifting_intro_static': 'problem_shifting_intro',
  'problem_shifting_intro_dynamic': 'problem_shifting_intro',
  'identity_shifting_intro_static': 'identity_shifting_intro',
  'identity_shifting_intro_dynamic': 'identity_shifting_intro',
  'belief_shifting_intro_static': 'belief_shifting_intro',
  'belief_shifting_intro_dynamic': 'belief_shifting_intro',
  'blockage_shifting_intro_static': 'blockage_shifting_intro',
  'blockage_shifting_intro_dynamic': 'blockage_shifting_intro',
  'reality_shifting_intro_static': 'reality_shifting_intro',
  'reality_shifting_intro_dynamic': 'reality_shifting_intro',
  'trauma_shifting_intro_static': 'trauma_shifting_intro',
  'trauma_shifting_intro_dynamic': 'trauma_shifting_intro',
  'trauma_identity_step_dynamic': 'trauma_identity_step',
  'trauma_identity_step_static': 'trauma_identity_step',
  'trauma_dissolve_step_a_static': 'trauma_dissolve_step_a',
  'trauma_dissolve_step_a_dynamic': 'trauma_dissolve_step_a',
};

/**
 * Normalize a step name so v4's _static/_dynamic variants collapse to the v2 name.
 */
export function normalizeStep(step: string): string {
  return V4_TO_V2_STEP_MAP[step] ?? step;
}

/**
 * Normalize message text for comparison:
 * - Collapse whitespace
 * - Trim
 * - Strip trailing numbered method lists that v4 appends
 */
export function normalizeMessage(message: string): string {
  let text = message.trim();

  // Remove numbered method selection lists v4 appends
  text = text.replace(
    /\n+\d+\.\s*Problem Shifting\n\d+\.\s*Identity Shifting\n\d+\.\s*Belief Shifting\n\d+\.\s*Blockage Shifting\s*$/,
    ''
  );

  // Remove standalone numbered option lists "1. PROBLEM\n2. GOAL\n3. NEGATIVE EXPERIENCE"
  text = text.replace(
    /\n+\d+\.\s*PROBLEM\n\d+\.\s*GOAL\n\d+\.\s*NEGATIVE EXPERIENCE\s*$/,
    ''
  );

  // Collapse multiple whitespace/newlines into single space
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Extract quoted problem references from a message.
 * The scripts typically use 'problem statement' with single quotes.
 * Returns all quoted strings found.
 */
export function extractProblemRefs(message: string): string[] {
  const matches = message.match(/'([^']+)'/g);
  if (!matches) return [];
  return matches.map(m => m.replace(/^'|'$/g, ''));
}

/**
 * Internal routing signals that should NEVER be shown to the user.
 * If V4 surfaces one of these, it's a bug.
 */
const ROUTING_SIGNALS = [
  'PROBLEM_SELECTION_CONFIRMED',
  'GOAL_SELECTION_CONFIRMED',
  'NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED',
  'METHOD_SELECTION_NEEDED',
  'SKIP_TO_TREATMENT_INTRO',
  'PROBLEM_SHIFTING_SELECTED',
  'IDENTITY_SHIFTING_SELECTED',
  'BELIEF_SHIFTING_SELECTED',
  'BLOCKAGE_SHIFTING_SELECTED',
  'ROUTE_TO_PROBLEM_SHIFTING',
  'ROUTE_TO_IDENTITY_SHIFTING',
  'ROUTE_TO_BELIEF_SHIFTING',
  'ROUTE_TO_BLOCKAGE_SHIFTING',
  'ROUTE_TO_REALITY_SHIFTING',
  'ROUTE_TO_TRAUMA_SHIFTING',
  'ROUTE_TO_PROBLEM_INTEGRATION',
  'ROUTE_TO_IDENTITY_INTEGRATION',
  'ROUTE_TO_BELIEF_INTEGRATION',
  'ROUTE_TO_BLOCKAGE_INTEGRATION',
  'ROUTE_TO_REALITY_INTEGRATION',
  'ROUTE_TO_TRAUMA_INTEGRATION',
];

export function isRoutingSignal(message: string): boolean {
  return ROUTING_SIGNALS.includes(message.trim());
}

/**
 * Known text differences between v2 and v4 that are intentional / under review.
 * These are flagged but do not count as hard failures.
 */
const KNOWN_ACCEPTABLE_DIFFERENCES = [
  {
    id: 'initial_welcome',
    description: 'v4 omits the full Mind Shifting introduction paragraph',
    affectedSteps: ['mind_shifting_explanation', 'mind_shifting_explanation_dynamic'],
  },
  {
    id: 'method_selection_wording',
    description: 'v4 uses different wording for method selection prompt',
    affectedSteps: ['choose_method'],
  },
  {
    id: 'digging_method_list',
    description: 'v4 adds numbered list to digging deeper method selection',
    affectedSteps: ['digging_method_selection'],
  },
  {
    id: 'belief_shifting_that',
    description: 'v4 adds "that" before quoted problem in Belief Shifting intro',
    affectedSteps: ['belief_shifting_intro', 'belief_shifting_intro_dynamic'],
  },
];

export function isKnownDifference(step: string): boolean {
  const normalized = normalizeStep(step);
  return KNOWN_ACCEPTABLE_DIFFERENCES.some(d =>
    d.affectedSteps.some(s => normalizeStep(s) === normalized)
  );
}

export function getKnownDifferenceReason(step: string): string | null {
  const normalized = normalizeStep(step);
  const found = KNOWN_ACCEPTABLE_DIFFERENCES.find(d =>
    d.affectedSteps.some(s => normalizeStep(s) === normalized)
  );
  return found?.description ?? null;
}

// ---------------------------------------------------------------------------
// Divergence types — every place V4 differs from V2
// ---------------------------------------------------------------------------

export type DivergenceType =
  | 'step_mismatch'
  | 'message_mismatch'
  | 'problem_ref_mismatch'
  | 'extra_v4_step'
  | 'missing_v4_step'
  | 'routing_signal_leaked'
  | 'v2_error';

export interface Divergence {
  type: DivergenceType;
  stepIndex: number;
  inputLabel: string;
  userInput: string;
  v2Step: string;
  v4Step: string;
  v2Message: string;
  v4Message: string;
  isKnownDiff: boolean;
  knownReason: string | null;
  detail: string;
}

export interface ParityResult {
  stepIndex: number;
  v2Step: string;
  v4Step: string;
  stepsMatch: boolean;
  messagesMatch: boolean;
  problemRefsMatch: boolean;
  isKnownDiff: boolean;
  v2Message: string;
  v4Message: string;
  v2ProblemRefs: string[];
  v4ProblemRefs: string[];
}

export interface FlowReport {
  flowName: string;
  totalSteps: number;
  v2StepsCompleted: number;
  v4StepsCompleted: number;
  v2Failed: boolean;
  v2FailureStep?: number;
  v2FailureError?: string;
  v4Failed?: boolean;
  v4FailureStep?: number;
  v4FailureError?: string;
  /** When set (e.g. 'v5'), report text uses this instead of 'v4' for the candidate version */
  candidateLabel?: string;
  divergences: Divergence[];
  stepDetails: StepDetail[];
}

export interface StepDetail {
  index: number;
  label: string;
  input: string;
  v2Step: string;
  v4Step: string;
  v2Message: string;
  v4Message: string;
  v2Success: boolean;
  v4Success: boolean;
  match: 'MATCH' | 'DIVERGENCE' | 'KNOWN_DIFF' | 'V2_ERROR' | 'V2_SKIPPED';
}

/**
 * Compare parallel v2 and v4 response arrays.
 * Returns per-step parity results and an overall pass/fail.
 */
export function compareFlows(
  v2Responses: TreatmentResponse[],
  v4Responses: TreatmentResponse[],
): { results: ParityResult[]; passed: boolean; failures: ParityResult[] } {
  const len = Math.min(v2Responses.length, v4Responses.length);
  const results: ParityResult[] = [];

  for (let i = 0; i < len; i++) {
    const v2 = v2Responses[i];
    const v4 = v4Responses[i];

    const v2StepNorm = normalizeStep(v2.currentStep);
    const v4StepNorm = normalizeStep(v4.currentStep);
    const stepsMatch = v2StepNorm === v4StepNorm;

    const v2Msg = normalizeMessage(v2.message);
    const v4Msg = normalizeMessage(v4.message);
    const messagesMatch = v2Msg === v4Msg;

    const v2Refs = extractProblemRefs(v2.message);
    const v4Refs = extractProblemRefs(v4.message);
    const problemRefsMatch =
      v2Refs.length === v4Refs.length &&
      v2Refs.every((ref, idx) => ref === v4Refs[idx]);

    const knownDiff = isKnownDifference(v2.currentStep) || isKnownDifference(v4.currentStep);

    results.push({
      stepIndex: i,
      v2Step: v2.currentStep,
      v4Step: v4.currentStep,
      stepsMatch,
      messagesMatch,
      problemRefsMatch,
      isKnownDiff: knownDiff,
      v2Message: v2.message,
      v4Message: v4.message,
      v2ProblemRefs: v2Refs,
      v4ProblemRefs: v4Refs,
    });
  }

  const failures = results.filter(
    r => !r.isKnownDiff && (!r.stepsMatch || !r.problemRefsMatch)
  );

  return { results, passed: failures.length === 0, failures };
}

/**
 * Pretty-print a parity failure for test output.
 */
export function formatFailure(f: ParityResult): string {
  const lines = [`  Step ${f.stepIndex}: v2="${f.v2Step}" vs v4="${f.v4Step}"`];
  if (!f.stepsMatch) lines.push('    STEP MISMATCH');
  if (!f.messagesMatch) {
    lines.push(`    v2 msg: "${f.v2Message.substring(0, 120)}..."`);
    lines.push(`    v4 msg: "${f.v4Message.substring(0, 120)}..."`);
  }
  if (!f.problemRefsMatch) {
    lines.push(`    v2 refs: [${f.v2ProblemRefs.join(', ')}]`);
    lines.push(`    v4 refs: [${f.v4ProblemRefs.join(', ')}]`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Full side-by-side markdown report generation
// ---------------------------------------------------------------------------

function escapeMarkdown(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ↵ ');
}

function truncate(s: string, max = 200): string {
  if (s.length <= max) return s;
  return s.substring(0, max) + '…';
}

export function generateFlowReportMarkdown(report: FlowReport): string {
  const lines: string[] = [];
  const cand = report.candidateLabel ?? 'v4';
  const { flowName, divergences, stepDetails,
    v2Failed, v2FailureStep, v2FailureError,
    v4Failed, v4FailureStep, v4FailureError } = report;

  const realDivergences = divergences.filter(d => !d.isKnownDiff && d.type !== 'v2_error');
  const knownDiffs = divergences.filter(d => d.isKnownDiff);

  lines.push(`### ${flowName}`);
  lines.push('');

  if (v2Failed) {
    lines.push(`> **V2 API crashed at step ${v2FailureStep}**: ${v2FailureError ?? 'unknown'}`);
    lines.push(`> Comparison is only valid for steps before the crash.`);
    lines.push('');
  }

  if (v4Failed) {
    lines.push(`> **${cand.toUpperCase()} API crashed at step ${v4FailureStep}**: ${v4FailureError ?? 'unknown'}`);
    lines.push(`> ${cand.toUpperCase()} deployment may be out of date with local code.`);
    lines.push('');
  }

  if (realDivergences.length === 0 && !v2Failed) {
    lines.push('**Result: PASS** — V4 matches V2 at every step.');
    lines.push('');
  } else   if (realDivergences.length > 0) {
    lines.push(`**Result: ${realDivergences.length} DIVERGENCE(S) FOUND** — ${cand.toUpperCase()} does NOT match V2.`);
    lines.push('');

    for (const d of realDivergences) {
      lines.push(`#### ❌ Step ${d.stepIndex}: ${d.inputLabel}`);
      lines.push(`- **Type**: ${d.type.replace(/_/g, ' ').toUpperCase()}`);
      lines.push(`- **User input**: \`${d.userInput}\``);
      lines.push(`- **V2 step**: \`${d.v2Step}\` → ${cand.toUpperCase()} step: \`${d.v4Step}\``);
      lines.push(`- **V2 says**: "${truncate(d.v2Message)}"`);
      lines.push(`- **${cand.toUpperCase()} says**: "${truncate(d.v4Message)}"`);
      lines.push(`- **Detail**: ${d.detail}`);
      lines.push('');
    }
  }

  if (knownDiffs.length > 0) {
    lines.push(`<details><summary>${knownDiffs.length} known/accepted difference(s)</summary>`);
    lines.push('');
    for (const d of knownDiffs) {
      lines.push(`- Step ${d.stepIndex} (${d.inputLabel}): ${d.knownReason}`);
    }
    lines.push('</details>');
    lines.push('');
  }

  // Full step-by-step table
  lines.push('<details><summary>Full step-by-step comparison</summary>');
  lines.push('');
  lines.push(`| # | Input | V2 Step | ${cand.toUpperCase()} Step | Match | V2 Message (excerpt) | ${cand.toUpperCase()} Message (excerpt) |`);
  lines.push('|---|-------|---------|---------|-------|---------------------|---------------------|');
  for (const s of stepDetails) {
    const matchIcon =
      s.match === 'MATCH' ? '✅' :
      s.match === 'KNOWN_DIFF' ? '🟡' :
      s.match === 'V2_ERROR' || s.match === 'V2_SKIPPED' ? '⚠️' : '❌';
    lines.push(
      `| ${s.index} | ${escapeMarkdown(s.label)} | \`${s.v2Step}\` | \`${s.v4Step}\` | ${matchIcon} ${s.match} | ${escapeMarkdown(truncate(s.v2Message, 80))} | ${escapeMarkdown(truncate(s.v4Message, 80))} |`
    );
  }
  lines.push('</details>');
  lines.push('');

  return lines.join('\n');
}

export function generateFullReportMarkdown(reports: FlowReport[]): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const lines: string[] = [];

  const totalDivergences = reports.reduce(
    (sum, r) => sum + r.divergences.filter(d => !d.isKnownDiff && d.type !== 'v2_error').length, 0
  );
  const flowsWithIssues = reports.filter(
    r => r.divergences.some(d => !d.isKnownDiff && d.type !== 'v2_error')
  ).length;
  const flowsV2Crashed = reports.filter(r => r.v2Failed).length;
  const flowsV4Crashed = reports.filter(r => r.v4Failed).length;
  const flowsBothCrashed = reports.filter(r => r.v2Failed && r.v4Failed).length;

  const cand = reports[0]?.candidateLabel ?? 'v4';
  lines.push(`# V2 vs ${cand.toUpperCase()} Parity Report — ${timestamp}`);
  lines.push('');
  lines.push(`> V2 is the medical gold standard. Every divergence below means ${cand.toUpperCase()} says`);
  lines.push(`> something different from V2 and **must be fixed in ${cand.toUpperCase()}**.`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Flows tested | ${reports.length} |`);
  lines.push(`| Flows with divergences | ${flowsWithIssues} |`);
  lines.push(`| Flows where V2 API crashed | ${flowsV2Crashed} |`);
  lines.push(`| Flows where ${cand.toUpperCase()} API crashed | ${flowsV4Crashed} |`);
  lines.push(`| Flows where BOTH APIs crashed | ${flowsBothCrashed} |`);
  lines.push(`| Total divergences | ${totalDivergences} |`);
  lines.push('');

  if (flowsV2Crashed > 0 || flowsV4Crashed > 0) {
    lines.push('### API Crashes');
    lines.push('');
    if (flowsV2Crashed > 0) {
      lines.push('**V2 crashes** (V2 live API is the deployed gold standard):');
      for (const r of reports.filter(r => r.v2Failed)) {
        lines.push(`- **${r.flowName}**: crashed at step ${r.v2FailureStep} — ${r.v2FailureError ?? 'unknown'}`);
      }
      lines.push('');
    }
    if (flowsV4Crashed > 0) {
      const cand = reports[0]?.candidateLabel ?? 'v4';
      lines.push(`**${cand.toUpperCase()} crashes** (deployed ${cand.toUpperCase()} may be behind local code):`);
      for (const r of reports.filter(r => r.v4Failed)) {
        lines.push(`- **${r.flowName}**: crashed at step ${r.v4FailureStep} — ${r.v4FailureError ?? 'unknown'}`);
      }
      lines.push('');
    }
    if (flowsBothCrashed > 0) {
      lines.push(`> **${flowsBothCrashed} flow(s)** could not be compared at all because both APIs crashed.`);
      lines.push('> These flows need a fresh deployment before parity can be verified.');
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('## Per-Flow Results');
  lines.push('');

  for (const report of reports) {
    lines.push(generateFlowReportMarkdown(report));
    lines.push('---');
    lines.push('');
  }

  // Action items summary
  if (totalDivergences > 0) {
    const cand = reports[0]?.candidateLabel ?? 'v4';
    lines.push(`## Action Items (Fix in ${cand.toUpperCase()})`);
    lines.push('');
    let itemNum = 1;
    for (const report of reports) {
      for (const d of report.divergences.filter(d => !d.isKnownDiff && d.type !== 'v2_error')) {
        lines.push(`${itemNum}. **${report.flowName}** — Step ${d.stepIndex} (${d.inputLabel}): ${d.detail}`);
        itemNum++;
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
