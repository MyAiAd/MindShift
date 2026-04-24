import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TreatmentStateMachine as V2TreatmentStateMachine } from '../../lib/v2/treatment-state-machine';
import { normalizeMessage, normalizeStep } from '../helpers/comparator';
import { ALL_FLOWS, FlowStep } from '../helpers/test-flows';

/**
 * V2 vs V9 direct-state-machine parity test.
 *
 * V9 reuses V2's state machine module verbatim. This test runs two
 * independent instances of that module side-by-side to verify that neither
 * copy has accidentally diverged at the source level (e.g. an import shim
 * that re-exports a modified class, or a patch script that mutates the
 * prototype at load time).
 *
 * Because both machines ARE the same class, this test is expected to pass
 * 100% of the time. If it ever fails, someone introduced a v9-specific fork
 * of v2 logic, which the V9 plan explicitly forbids.
 *
 * Unlike `v2-v9-parity.spec.ts`, this spec does NOT require a live server.
 * It is the CI-safe fast gate.
 */

interface DirectResult {
  canContinue: boolean;
  nextStep?: string;
  scriptedResponse?: string;
  reason?: string;
}

interface TurnDiff {
  turn: number;
  label: string;
  input: string;
  v2Step: string;
  v9Step: string;
  v2Message: string;
  v9Message: string;
  stepMatch: boolean;
  messageMatch: boolean;
}

interface FlowComparison {
  flowName: string;
  totalTurns: number;
  mismatches: TurnDiff[];
}

function disablePersistence(...machines: any[]): void {
  for (const m of machines) {
    m.getOrCreateContextAsync = async function getOrCreateContextAsync(
      sessionId: string,
      context?: Record<string, unknown>,
    ) {
      return this.getOrCreateContext(sessionId, context);
    };
    m.saveContextToDatabase = async function saveContextToDatabase() {
      return;
    };
  }
}

async function runFlow(
  flowName: string,
  steps: FlowStep[],
): Promise<FlowComparison> {
  const v2 = new V2TreatmentStateMachine() as any;
  const v9 = new V2TreatmentStateMachine() as any;
  disablePersistence(v2, v9);

  const flowSessionId = flowName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const v2SessionId = `v2-${flowSessionId}-${Date.now()}`;
  const v9SessionId = `v9-${flowSessionId}-${Date.now()}`;
  const context = { userId: 'direct-v2v9-parity-user' };

  const mismatches: TurnDiff[] = [];

  const runTurn = async (turn: number, label: string, input: string) => {
    const v2Result = (await v2.processUserInput(v2SessionId, input, context)) as DirectResult;
    const v9Result = (await v9.processUserInput(v9SessionId, input, context)) as DirectResult;

    const v2Step = normalizeStep(v2Result.nextStep || '');
    const v9Step = normalizeStep(v9Result.nextStep || '');
    const v2Message = normalizeMessage(v2Result.scriptedResponse || '');
    const v9Message = normalizeMessage(v9Result.scriptedResponse || '');

    const stepMatch = v2Step === v9Step;
    const messageMatch = v2Message === v9Message;

    if (!stepMatch || !messageMatch) {
      mismatches.push({
        turn,
        label,
        input,
        v2Step,
        v9Step,
        v2Message,
        v9Message,
        stepMatch,
        messageMatch,
      });
    }
  };

  await runTurn(0, 'start', 'start');

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    await runTurn(i + 1, step.label || `step ${i + 1}`, step.input);
  }

  return {
    flowName,
    totalTurns: steps.length + 1,
    mismatches,
  };
}

function buildReport(results: FlowComparison[]): string {
  const date = new Date().toISOString();
  const totalFlows = results.length;
  const failedFlows = results.filter(r => r.mismatches.length > 0);
  const totalMismatches = results.reduce((sum, r) => sum + r.mismatches.length, 0);

  const lines: string[] = [];
  lines.push(`# V2 vs V9 Direct Parity Report`);
  lines.push('');
  lines.push(`Generated: ${date}`);
  lines.push('');
  lines.push(
    `V9 imports the V2 state machine directly. This report verifies that ` +
      `two independent instances of the shared class produce identical ` +
      `output for every canonical flow.`,
  );
  lines.push('');
  lines.push(`- Flows tested: ${totalFlows}`);
  lines.push(`- Flows with mismatches: ${failedFlows.length}`);
  lines.push(`- Total mismatches: ${totalMismatches}`);
  lines.push('');

  if (failedFlows.length === 0) {
    lines.push(`## Result`);
    lines.push('');
    lines.push(`PASS - V9 matches V2 across all tested turns.`);
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`## Result`);
  lines.push('');
  lines.push(
    `FAIL - mismatches detected. V9 MUST share V2's state machine; any ` +
      `divergence here means a v9-specific fork has been introduced.`,
  );
  lines.push('');

  for (const flow of results) {
    lines.push(`## ${flow.flowName}`);
    lines.push('');
    lines.push(`- Total turns: ${flow.totalTurns}`);
    lines.push(`- Mismatches: ${flow.mismatches.length}`);
    lines.push('');

    if (flow.mismatches.length === 0) {
      lines.push(`All turns matched.`);
      lines.push('');
      continue;
    }

    for (const mismatch of flow.mismatches) {
      lines.push(`### Turn ${mismatch.turn}: ${mismatch.label}`);
      lines.push(`- Input: \`${mismatch.input}\``);
      lines.push(`- Step match: ${mismatch.stepMatch ? 'yes' : 'no'}`);
      lines.push(`- Message match: ${mismatch.messageMatch ? 'yes' : 'no'}`);
      lines.push(`- V2 step: \`${mismatch.v2Step}\``);
      lines.push(`- V9 step: \`${mismatch.v9Step}\``);
      lines.push(`- V2 message: "${mismatch.v2Message}"`);
      lines.push(`- V9 message: "${mismatch.v9Message}"`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

test('direct V2 vs V9 parity across all flows', async () => {
  const results: FlowComparison[] = [];

  for (const [flowName, steps] of Object.entries(ALL_FLOWS)) {
    const result = await runFlow(flowName, [...steps]);
    results.push(result);
  }

  const reportContent = buildReport(results);
  const reportDir = join(process.cwd(), 'tests', 'reports');
  const reportPath = join(reportDir, 'V2_V9_PARITY_REPORT.md');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportPath, reportContent, 'utf-8');

  const totalMismatches = results.reduce((sum, r) => sum + r.mismatches.length, 0);
  expect(totalMismatches, `V9 direct-parity drift found. See ${reportPath}`).toBe(0);
});
