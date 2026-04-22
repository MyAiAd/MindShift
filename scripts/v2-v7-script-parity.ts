/**
 * V2 vs V7 Script Parity Report (Approach 1: static text diff)
 *
 * Walks every phase and every step defined in the v2 and v7 state machines,
 * resolves each step's `scriptedResponse` (both string and function form)
 * against a canonical context using a small set of probe inputs, and emits
 * a Markdown report classifying each step as:
 *
 *   - MATCH         v2 and v7 produce identical output for all probes
 *   - DRIFT         both have the step but at least one probe differs
 *   - MISSING_V7    v2 has this step, v7 does not
 *   - ADDED_V7      v7 has this step, v2 does not
 *
 * This is a read-only diagnostic: no production code is touched, and the
 * report is written to tests/reports/V2_V7_SCRIPT_PARITY_REPORT.md.
 *
 * Usage:
 *   npx tsx scripts/v2-v7-script-parity.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TreatmentStateMachine as V2StateMachine } from '../lib/v2/treatment-state-machine';
import { TreatmentStateMachine as V7StateMachine } from '../lib/v7/treatment-state-machine';

type Resolver = {
  getPhaseSteps: (phaseName: string) => unknown;
};

// ---------------------------------------------------------------------------
// Canonical phases and probe vectors
// ---------------------------------------------------------------------------

const PHASE_NAMES = [
  'introduction',
  'work_type_selection',
  'discovery',
  'method_selection',
  'problem_shifting',
  'blockage_shifting',
  'identity_shifting',
  'reality_shifting',
  'trauma_shifting',
  'belief_shifting',
  'digging_deeper',
  'integration',
] as const;

/**
 * Probe inputs. `undefined` exercises the "first show" path (most steps
 * simply return their scripted prompt regardless of prior input). The other
 * values cover numeric work-type selection, yes/no branches, and generic
 * problem-like free text so we spot drift inside any conditional branch
 * that a step uses to compose its user-facing wording.
 */
const PROBES: Array<{ label: string; input: string | undefined }> = [
  { label: 'first-show', input: undefined },
  { label: 'yes', input: 'yes' },
  { label: 'no', input: 'no' },
  { label: 'numeric-1', input: '1' },
  { label: 'numeric-2', input: '2' },
  { label: 'numeric-3', input: '3' },
  { label: 'free-text', input: 'the problem' },
];

/**
 * A canonical TreatmentContext that populates every field the various
 * scriptedResponse functions interpolate. We rebuild it before every probe
 * because scriptedResponse functions routinely mutate context. Any field
 * added here should be pre-populated with a short, unambiguous token so
 * drift becomes visible.
 */
function buildContext(phaseName: string, stepId: string): Record<string, unknown> {
  return {
    userId: 'parity-user',
    sessionId: 'parity-session',
    currentPhase: phaseName,
    currentStep: stepId,
    problemStatement: 'the problem',
    startTime: new Date(0),
    lastActivity: new Date(0),
    userResponses: {
      mind_shifting_explanation: '1',
      work_type_description: 'the problem',
      problem_description: 'the problem',
      goal_description: 'the goal',
      negative_experience_description: 'the experience',
      restate_selected_problem: 'the problem',
      choose_method: 'problem shifting',
      confirm_statement: 'yes',
      body_sensation_check: 'yes',
      what_needs_to_happen_step: 'something needs to happen',
      feel_solution_state: 'relief',
      feel_good_state: 'peace',
      identity_dissolve_step_a: 'the identity',
      belief_step_a: 'the belief',
      trauma_experience: 'the experience',
    },
    metadata: {
      cycleCount: 0,
      lastResponse: '',
      problemStatement: 'the problem',
      originalProblemStatement: 'the problem',
      workType: 'problem',
      selectedMethod: 'problem_shifting',
      currentIdentity: 'the identity',
      currentBelief: 'the belief',
      currentDiggingProblem: '',
      newDiggingProblem: '',
      goalStatement: 'the goal',
      negativeExperienceStatement: 'the experience',
      traumaStatement: 'the experience',
      solutionState: 'relief',
      identityResponse: 'the identity',
      beliefResponse: 'the belief',
      bodySensation: 'tightness',
    },
  };
}

// ---------------------------------------------------------------------------
// Step resolution
// ---------------------------------------------------------------------------

type StepLike = {
  id: string;
  scriptedResponse: string | ((userInput?: string, context?: unknown) => string);
};

function resolveStep(
  step: StepLike,
  phaseName: string,
  probe: { label: string; input: string | undefined },
): { ok: true; output: string } | { ok: false; error: string } {
  const sr = step.scriptedResponse;
  if (typeof sr === 'string') {
    return { ok: true, output: sr };
  }
  try {
    const ctx = buildContext(phaseName, step.id);
    const out = sr(probe.input, ctx);
    return { ok: true, output: typeof out === 'string' ? out : String(out) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function getStepsForPhase(
  machine: Resolver,
  phaseName: string,
): Map<string, StepLike> {
  const steps = machine.getPhaseSteps(phaseName) as StepLike[] | null;
  const out = new Map<string, StepLike>();
  if (!steps) return out;
  for (const s of steps) {
    out.set(s.id, s);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

type Verdict = 'MATCH' | 'DRIFT' | 'MISSING_V7' | 'ADDED_V7';

interface ProbeResult {
  label: string;
  input: string | undefined;
  v2?: string;
  v7?: string;
  v2Error?: string;
  v7Error?: string;
  equal: boolean;
}

interface StepComparison {
  phase: string;
  stepId: string;
  verdict: Verdict;
  probes: ProbeResult[];
}

function compareStep(
  phaseName: string,
  stepId: string,
  v2Step: StepLike | undefined,
  v7Step: StepLike | undefined,
): StepComparison {
  if (v2Step && !v7Step) {
    return {
      phase: phaseName,
      stepId,
      verdict: 'MISSING_V7',
      probes: [],
    };
  }
  if (!v2Step && v7Step) {
    return {
      phase: phaseName,
      stepId,
      verdict: 'ADDED_V7',
      probes: [],
    };
  }
  if (!v2Step || !v7Step) {
    // Defensive; shouldn't happen given the checks above.
    return {
      phase: phaseName,
      stepId,
      verdict: 'DRIFT',
      probes: [],
    };
  }

  const probes: ProbeResult[] = PROBES.map(probe => {
    const v2 = resolveStep(v2Step, phaseName, probe);
    const v7 = resolveStep(v7Step, phaseName, probe);
    const v2Text = v2.ok ? v2.output : undefined;
    const v7Text = v7.ok ? v7.output : undefined;
    const v2Err = v2.ok ? undefined : v2.error;
    const v7Err = v7.ok ? undefined : v7.error;
    const equal =
      v2.ok && v7.ok && v2Text === v7Text;
    return {
      label: probe.label,
      input: probe.input,
      v2: v2Text,
      v7: v7Text,
      v2Error: v2Err,
      v7Error: v7Err,
      equal,
    };
  });

  const allEqual = probes.every(p => p.equal);
  return {
    phase: phaseName,
    stepId,
    verdict: allEqual ? 'MATCH' : 'DRIFT',
    probes,
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function escapeInline(s: string | undefined): string {
  if (s === undefined) return '_(error or missing)_';
  return s
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ↵ ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(s: string, max = 200): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

function codeBlock(s: string | undefined): string {
  if (s === undefined) return '```\n(error or missing)\n```';
  return '```\n' + s + '\n```';
}

function verdictIcon(v: Verdict): string {
  switch (v) {
    case 'MATCH':
      return '✅ MATCH';
    case 'DRIFT':
      return '❌ DRIFT';
    case 'MISSING_V7':
      return '⚠️ MISSING IN V7';
    case 'ADDED_V7':
      return 'ℹ️ ADDED IN V7';
  }
}

function buildReport(comparisons: StepComparison[]): string {
  const byVerdict: Record<Verdict, StepComparison[]> = {
    MATCH: [],
    DRIFT: [],
    MISSING_V7: [],
    ADDED_V7: [],
  };
  for (const c of comparisons) byVerdict[c.verdict].push(c);

  const totals = {
    total: comparisons.length,
    match: byVerdict.MATCH.length,
    drift: byVerdict.DRIFT.length,
    missing: byVerdict.MISSING_V7.length,
    added: byVerdict.ADDED_V7.length,
  };

  const lines: string[] = [];
  const timestamp = new Date().toISOString();

  lines.push('# V2 vs V7 Script Parity Report');
  lines.push('');
  lines.push(`Generated: ${timestamp}`);
  lines.push('');
  lines.push(
    '> V2 is the gold standard for customer-facing wording. Every row below ' +
      'classifies one `(phase, step)` pair by comparing the `scriptedResponse` ' +
      'output of both state machines against a fixed set of probe inputs. DRIFT ' +
      'rows mean the same step exists in both versions but produces different ' +
      'text for at least one probe.',
  );
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|------:|');
  lines.push(`| Steps compared | ${totals.total} |`);
  lines.push(`| ✅ MATCH | ${totals.match} |`);
  lines.push(`| ❌ DRIFT | ${totals.drift} |`);
  lines.push(`| ⚠️ MISSING IN V7 | ${totals.missing} |`);
  lines.push(`| ℹ️ ADDED IN V7 | ${totals.added} |`);
  lines.push('');
  lines.push(
    `Probe inputs used per step: ${PROBES.map(p => '`' + p.label + '`').join(', ')}.`,
  );
  lines.push('');

  // Per-phase summary table
  lines.push('## Per-phase summary');
  lines.push('');
  lines.push('| Phase | Match | Drift | Missing in V7 | Added in V7 |');
  lines.push('|-------|------:|------:|---------------:|------------:|');
  for (const phase of PHASE_NAMES) {
    const rows = comparisons.filter(c => c.phase === phase);
    const m = rows.filter(r => r.verdict === 'MATCH').length;
    const d = rows.filter(r => r.verdict === 'DRIFT').length;
    const mv = rows.filter(r => r.verdict === 'MISSING_V7').length;
    const av = rows.filter(r => r.verdict === 'ADDED_V7').length;
    lines.push(`| \`${phase}\` | ${m} | ${d} | ${mv} | ${av} |`);
  }
  lines.push('');

  // Missing / added sections first — cheap wins when they exist
  if (byVerdict.MISSING_V7.length > 0) {
    lines.push('## Steps missing in V7 (present in V2 only)');
    lines.push('');
    for (const c of byVerdict.MISSING_V7) {
      lines.push(`- \`${c.phase}.${c.stepId}\``);
    }
    lines.push('');
  }
  if (byVerdict.ADDED_V7.length > 0) {
    lines.push('## Steps added in V7 (not in V2)');
    lines.push('');
    for (const c of byVerdict.ADDED_V7) {
      lines.push(`- \`${c.phase}.${c.stepId}\``);
    }
    lines.push('');
  }

  // Drift details — the important section
  lines.push('## Drift details');
  lines.push('');
  if (byVerdict.DRIFT.length === 0) {
    lines.push('_No drift detected._');
    lines.push('');
  } else {
    lines.push(
      `${byVerdict.DRIFT.length} step(s) drift. Each row below lists only the ` +
        'probe inputs whose outputs diverge.',
    );
    lines.push('');
    for (const c of byVerdict.DRIFT) {
      lines.push(`### \`${c.phase}.${c.stepId}\``);
      lines.push('');
      const diverged = c.probes.filter(p => !p.equal);
      for (const probe of diverged) {
        const probeDisplay =
          probe.input === undefined ? '_(no input)_' : '`' + probe.input + '`';
        lines.push(`- **Probe \`${probe.label}\`** (input: ${probeDisplay})`);
        if (probe.v2Error || probe.v7Error) {
          if (probe.v2Error) lines.push(`  - V2 threw: \`${probe.v2Error}\``);
          if (probe.v7Error) lines.push(`  - V7 threw: \`${probe.v7Error}\``);
        }
        lines.push('');
        lines.push('  V2 output:');
        lines.push('');
        lines.push(codeBlock(probe.v2));
        lines.push('');
        lines.push('  V7 output:');
        lines.push('');
        lines.push(codeBlock(probe.v7));
        lines.push('');
      }
    }
  }

  // Full MATCH roster at the end (collapsed) so the report is auditable
  lines.push('## Matched steps (collapsed)');
  lines.push('');
  lines.push('<details><summary>Click to expand full match list</summary>');
  lines.push('');
  lines.push('| Phase | Step | First-show excerpt |');
  lines.push('|-------|------|---------------------|');
  for (const c of byVerdict.MATCH) {
    const firstShow = c.probes.find(p => p.label === 'first-show');
    const excerpt = truncate(escapeInline(firstShow?.v2), 100);
    lines.push(`| \`${c.phase}\` | \`${c.stepId}\` | ${excerpt} |`);
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const v2 = new V2StateMachine() as unknown as Resolver;
  const v7 = new V7StateMachine() as unknown as Resolver;

  const comparisons: StepComparison[] = [];

  for (const phase of PHASE_NAMES) {
    const v2Steps = getStepsForPhase(v2, phase);
    const v7Steps = getStepsForPhase(v7, phase);
    const allIds = new Set<string>([
      ...Array.from(v2Steps.keys()),
      ...Array.from(v7Steps.keys()),
    ]);
    const orderedIds = Array.from(allIds).sort();
    for (const stepId of orderedIds) {
      comparisons.push(
        compareStep(phase, stepId, v2Steps.get(stepId), v7Steps.get(stepId)),
      );
    }
  }

  const report = buildReport(comparisons);

  const reportDir = join(process.cwd(), 'tests', 'reports');
  const reportPath = join(reportDir, 'V2_V7_SCRIPT_PARITY_REPORT.md');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportPath, report, 'utf-8');

  const totals = {
    total: comparisons.length,
    match: comparisons.filter(c => c.verdict === 'MATCH').length,
    drift: comparisons.filter(c => c.verdict === 'DRIFT').length,
    missing: comparisons.filter(c => c.verdict === 'MISSING_V7').length,
    added: comparisons.filter(c => c.verdict === 'ADDED_V7').length,
  };

  // eslint-disable-next-line no-console
  console.log(
    `V2 vs V7 script parity: ` +
      `${totals.match} match, ${totals.drift} drift, ` +
      `${totals.missing} missing in v7, ${totals.added} added in v7 ` +
      `(total ${totals.total})`,
  );
  // eslint-disable-next-line no-console
  console.log(`Report written to: ${reportPath}`);
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('v2-v7 script parity failed:', err);
  process.exit(1);
});
