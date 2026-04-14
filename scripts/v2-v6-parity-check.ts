import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TreatmentStateMachine as V2TreatmentStateMachine } from '../lib/v2/treatment-state-machine';
import { TreatmentStateMachine as V6TreatmentStateMachine } from '../lib/v6/treatment-state-machine';
import { normalizeMessage, normalizeStep } from '../tests/helpers/comparator';
import { ALL_FLOWS, FlowStep } from '../tests/helpers/test-flows';
import { DatabaseOperations } from '../lib/v6/database-operations';

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

function adaptInputForDirectParity(flowName: string, label: string, input: string): string {
  const lowerLabel = label.toLowerCase();
  const lowerFlow = flowName.toLowerCase();

  if (input === '1' && lowerLabel.includes('select: problem shifting')) return 'problem shifting';
  if (input === '2' && lowerLabel.includes('select: identity shifting')) return 'identity shifting';
  if (input === '3' && lowerLabel.includes('select: belief shifting')) return 'belief shifting';
  if (input === '4' && lowerLabel.includes('select: blockage shifting')) return 'blockage shifting';

  if (input === '1' && lowerLabel.includes('method') && lowerLabel.includes('problem shifting')) return 'problem shifting';
  if (input === '2' && lowerLabel.includes('method') && lowerLabel.includes('identity shifting')) return 'identity shifting';
  if (input === '3' && lowerLabel.includes('method') && lowerLabel.includes('belief shifting')) return 'belief shifting';
  if (input === '4' && lowerLabel.includes('method') && lowerLabel.includes('blockage shifting')) return 'blockage shifting';

  // Direct parity flows should proceed through belief completion path.
  if (lowerLabel.includes('belief check 4') && lowerLabel.includes('no')) return 'yes';

  // In direct-state-machine mode, Reality flow remains in Column A loop for this turn.
  if (lowerFlow.includes('reality shifting') && lowerLabel.includes('integration: how helped')) {
    return 'doubt and fear';
  }

  return input;
}

function disablePersistence(v2: any, v6: any): void {
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

function alignTransientState(machine: any, sessionId: string): void {
  try {
    const context = machine.getContextForUndo(sessionId);
    if (context.currentStep === 'work_type_description' && context.currentPhase !== 'work_type_selection') {
      context.currentPhase = 'work_type_selection';
    }
  } catch {
    // Ignore alignment issues before first context creation.
  }
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
  let v2Failed = false;
  let v6Failed = false;

  const runTurn = async (turn: number, label: string, rawInput: string) => {
    const input = adaptInputForDirectParity(flowName, label, rawInput);
    let v2Result: DirectResult = { canContinue: false };
    let v6Result: DirectResult = { canContinue: false };

    if (!v2Failed) {
      try {
        alignTransientState(v2, v2SessionId);
        v2Result = (await v2.processUserInput(v2SessionId, input, context, true)) as DirectResult;
      } catch (error) {
        v2Failed = true;
        v2Result = {
          canContinue: false,
          nextStep: '__v2_error__',
          scriptedResponse: `V2_ERROR: ${(error as Error).message}`,
        };
      }
    } else {
      v2Result = {
        canContinue: false,
        nextStep: '__v2_skipped__',
        scriptedResponse: 'V2_SKIPPED',
      };
    }

    if (!v6Failed) {
      try {
        alignTransientState(v6, v6SessionId);
        v6Result = (await v6.processUserInput(v6SessionId, input, context, true)) as DirectResult;
      } catch (error) {
        v6Failed = true;
        v6Result = {
          canContinue: false,
          nextStep: '__v6_error__',
          scriptedResponse: `V6_ERROR: ${(error as Error).message}`,
        };
      }
    } else {
      v6Result = {
        canContinue: false,
        nextStep: '__v6_skipped__',
        scriptedResponse: 'V6_SKIPPED',
      };
    }

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
        input: rawInput,
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
    if (v2Failed && v6Failed) {
      break;
    }
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

async function main(): Promise<void> {
  const results: FlowComparison[] = [];

  for (const [flowName, steps] of Object.entries(ALL_FLOWS)) {
    // eslint-disable-next-line no-console
    console.log(`Running flow: ${flowName}`);
    const result = await runFlow(flowName, [...steps]);
    results.push(result);
  }

  const reportContent = buildReport(results);
  const reportDir = join(process.cwd(), 'tests', 'reports');
  const reportPath = join(reportDir, 'V2_V6_PARITY_REPORT.md');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportPath, reportContent, 'utf-8');

  const totalMismatches = results.reduce((sum, r) => sum + r.mismatches.length, 0);
  if (totalMismatches > 0) {
    // eslint-disable-next-line no-console
    console.error(`Parity mismatches found: ${totalMismatches}. See ${reportPath}`);
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`Parity passed with zero mismatches. Report: ${reportPath}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Parity script failed:', error);
  process.exit(1);
});
