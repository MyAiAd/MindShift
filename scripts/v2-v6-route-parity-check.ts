import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizeMessage, normalizeStep } from '../tests/helpers/comparator';
import { ALL_FLOWS, FlowStep } from '../tests/helpers/test-flows';

interface ApiResponse {
  success?: boolean;
  sessionId?: string;
  message?: string;
  currentStep?: string;
  error?: string;
  details?: string;
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
  v2Failed: boolean;
  v6Failed: boolean;
}

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function postTreatment(
  endpoint: '/api/treatment-v2' | '/api/treatment-v6',
  body: Record<string, unknown>,
): Promise<ApiResponse> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json: ApiResponse = {};

  try {
    json = JSON.parse(text) as ApiResponse;
  } catch {
    json = {
      success: false,
      error: `Non-JSON response (${response.status})`,
      details: text.slice(0, 500),
    };
  }

  if (!response.ok) {
    return {
      success: false,
      error: json.error || `HTTP ${response.status}`,
      details: json.details || text.slice(0, 500),
      currentStep: json.currentStep,
      message: json.message,
      sessionId: json.sessionId,
    };
  }

  return json;
}

async function runFlow(flowName: string, steps: FlowStep[]): Promise<FlowComparison> {
  const userId = `route-parity-${randomUUID()}`;
  const v2SessionId = `v2-${randomUUID()}`;
  const v6SessionId = `v6-${randomUUID()}`;
  const mismatches: TurnDiff[] = [];
  let v2Failed = false;
  let v6Failed = false;

  const runTurn = async (turn: number, label: string, input: string) => {
    let v2Response: ApiResponse;
    let v6Response: ApiResponse;

    if (turn === 0) {
      [v2Response, v6Response] = await Promise.all([
        postTreatment('/api/treatment-v2', { action: 'start', sessionId: v2SessionId, userId }),
        postTreatment('/api/treatment-v6', { action: 'start', sessionId: v6SessionId, userId }),
      ]);
    } else {
      [v2Response, v6Response] = await Promise.all([
        v2Failed
          ? Promise.resolve({
              success: false,
              currentStep: '__v2_skipped__',
              message: 'V2_SKIPPED',
            })
          : postTreatment('/api/treatment-v2', {
              action: 'continue',
              sessionId: v2SessionId,
              userId,
              userInput: input,
            }),
        v6Failed
          ? Promise.resolve({
              success: false,
              currentStep: '__v6_skipped__',
              message: 'V6_SKIPPED',
            })
          : postTreatment('/api/treatment-v6', {
              action: 'continue',
              sessionId: v6SessionId,
              userId,
              userInput: input,
            }),
      ]);
    }

    if (v2Response.success === false) v2Failed = true;
    if (v6Response.success === false) v6Failed = true;

    const v2Step = normalizeStep(v2Response.currentStep || '');
    const v6Step = normalizeStep(v6Response.currentStep || '');
    const v2Message = normalizeMessage(
      v2Response.message || v2Response.error || v2Response.details || '',
    );
    const v6Message = normalizeMessage(
      v6Response.message || v6Response.error || v6Response.details || '',
    );

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

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    await runTurn(index + 1, step.label || `step ${index + 1}`, step.input);
    if (v2Failed && v6Failed) break;
  }

  return {
    flowName,
    totalTurns: steps.length + 1,
    mismatches,
    v2Failed,
    v6Failed,
  };
}

function buildReport(results: FlowComparison[]): string {
  const generatedAt = new Date().toISOString();
  const totalMismatches = results.reduce((sum, result) => sum + result.mismatches.length, 0);
  const failedFlows = results.filter(result => result.mismatches.length > 0);
  const v2Failures = results.filter(result => result.v2Failed).length;
  const v6Failures = results.filter(result => result.v6Failed).length;
  const lines: string[] = [];

  lines.push('# V2 vs V6 Route Parity Report');
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Base URL: ${BASE_URL}`);
  lines.push('');
  lines.push(`- Flows tested: ${results.length}`);
  lines.push(`- Flows with mismatches: ${failedFlows.length}`);
  lines.push(`- Flows where V2 failed: ${v2Failures}`);
  lines.push(`- Flows where V6 failed: ${v6Failures}`);
  lines.push(`- Total mismatches: ${totalMismatches}`);
  lines.push('');

  if (totalMismatches === 0) {
    lines.push('## Result');
    lines.push('');
    lines.push('PASS - V6 route responses match V2 across all tested turns.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('## Result');
  lines.push('');
  lines.push('FAIL - route-level mismatches detected.');
  lines.push('');

  for (const result of results) {
    lines.push(`## ${result.flowName}`);
    lines.push('');
    lines.push(`- Total turns: ${result.totalTurns}`);
    lines.push(`- Mismatches: ${result.mismatches.length}`);
    lines.push(`- V2 failed: ${result.v2Failed ? 'yes' : 'no'}`);
    lines.push(`- V6 failed: ${result.v6Failed ? 'yes' : 'no'}`);
    lines.push('');

    if (result.mismatches.length === 0) {
      lines.push('All turns matched.');
      lines.push('');
      continue;
    }

    for (const mismatch of result.mismatches) {
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
    console.log(`Running route parity flow: ${flowName}`);
    const result = await runFlow(flowName, [...steps]);
    results.push(result);
  }

  const reportDir = join(process.cwd(), 'tests', 'reports');
  const reportPath = join(reportDir, 'V2_V6_ROUTE_PARITY_REPORT.md');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportPath, buildReport(results), 'utf-8');

  const totalMismatches = results.reduce((sum, result) => sum + result.mismatches.length, 0);

  if (totalMismatches > 0) {
    console.error(`Route parity mismatches found: ${totalMismatches}. See ${reportPath}`);
    process.exit(1);
  }

  console.log(`Route parity passed with zero mismatches. Report: ${reportPath}`);
}

main().catch((error) => {
  console.error('Route parity script failed:', error);
  process.exit(1);
});
