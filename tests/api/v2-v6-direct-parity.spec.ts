import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TreatmentStateMachine as V2TreatmentStateMachine } from '../../lib/v2/treatment-state-machine';
import { TreatmentStateMachine as V6TreatmentStateMachine } from '../../lib/v6/treatment-state-machine';
import { normalizeMessage, normalizeStep } from '../helpers/comparator';
import { ALL_FLOWS, FlowStep } from '../helpers/test-flows';
import { DatabaseOperations } from '../../lib/v6/database-operations';

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
  v6Step: string;
  v2Message: string;
  v6Message: string;
  stepMatch: boolean;
  messageMatch: boolean;
}

interface FlowComparison {
  flowName: string;
  totalTurns: number;
  mismatches: TurnDiff[];
}

function disablePersistence(v2: any, v6: any): void {
  // V2 and V6 both call async persistence during processing.
  // We disable it so direct parity checks remain local and deterministic.
  v2.getOrCreateContextAsync = async function getOrCreateContextAsync(
    sessionId: string,
    context?: Record<string, unknown>,
  ) {
    return this.getOrCreateContext(sessionId, context);
  };
  v2.saveContextToDatabase = async function saveContextToDatabase() {
    return;
  };

  v6.getOrCreateContextAsync = async function getOrCreateContextAsync(
    sessionId: string,
    context?: Record<string, unknown>,
  ) {
    return this.getOrCreateContext(sessionId, context);
  };

  DatabaseOperations.saveContextToDatabase = async function saveContextToDatabase() {
    return;
  };
  DatabaseOperations.loadContextFromDatabase = async function loadContextFromDatabase() {
    return null;
  };
}

async function runFlow(
  flowName: string,
  steps: FlowStep[],
): Promise<FlowComparison> {
  const v2 = new V2TreatmentStateMachine() as any;
  const v6 = new V6TreatmentStateMachine() as any;
  disablePersistence(v2, v6);

  const flowSessionId = flowName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const v2SessionId = `v2-${flowSessionId}-${Date.now()}`;
  const v6SessionId = `v6-${flowSessionId}-${Date.now()}`;
  const context = { userId: 'direct-parity-user' };

  const mismatches: TurnDiff[] = [];

  const runTurn = async (turn: number, label: string, input: string) => {
    const v2Result = (await v2.processUserInput(v2SessionId, input, context)) as DirectResult;
    const v6Result = (await v6.processUserInput(v6SessionId, input, context)) as DirectResult;

    const v2Step = normalizeStep(v2Result.nextStep || '');
    const v6Step = normalizeStep(v6Result.nextStep || '');
    const v2Message = normalizeMessage(v2Result.scriptedResponse || '');
    const v6Message = normalizeMessage(v6Result.scriptedResponse || '');

    const stepMatch = v2Step === v6Step;
    const messageMatch = v2Message === v6Message;

    if (!stepMatch || !messageMatch) {
      mismatches.push({
        turn,
        label,
        input,
        v2Step,
        v6Step,
        v2Message,
        v6Message,
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
  lines.push(`# V2 vs V6 Direct Parity Report`);
  lines.push('');
  lines.push(`Generated: ${date}`);
  lines.push('');
  lines.push(`- Flows tested: ${totalFlows}`);
  lines.push(`- Flows with mismatches: ${failedFlows.length}`);
  lines.push(`- Total mismatches: ${totalMismatches}`);
  lines.push('');

  if (failedFlows.length === 0) {
    lines.push(`## Result`);
    lines.push('');
    lines.push(`PASS - V6 matches V2 across all tested turns.`);
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`## Result`);
  lines.push('');
  lines.push(`FAIL - mismatches detected.`);
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
      lines.push(`- V6 step: \`${mismatch.v6Step}\``);
      lines.push(`- V2 message: "${mismatch.v2Message}"`);
      lines.push(`- V6 message: "${mismatch.v6Message}"`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

test('direct V2 vs V6 parity across all flows', async () => {
  const results: FlowComparison[] = [];

  for (const [flowName, steps] of Object.entries(ALL_FLOWS)) {
    const result = await runFlow(flowName, [...steps]);
    results.push(result);
  }

  const reportContent = buildReport(results);
  const reportDir = join(process.cwd(), 'tests', 'reports');
  const reportPath = join(reportDir, 'V2_V6_PARITY_REPORT.md');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportPath, reportContent, 'utf-8');

  const totalMismatches = results.reduce((sum, r) => sum + r.mismatches.length, 0);
  expect(totalMismatches, `Parity mismatches found. See ${reportPath}`).toBe(0);
});
