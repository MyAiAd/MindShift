import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { runParityFlowV2V9, buildFlowReportV2V9 } from '../helpers/parity-runner';
import { generateFullReportMarkdown, FlowReport } from '../helpers/comparator';
import { ALL_FLOWS, FlowStep } from '../helpers/test-flows';

/**
 * V2 vs V9 route-level parity test.
 *
 * V9 is a voice adapter that wraps V2's own state machine. Because the two
 * routes MUST share the same doctor-authored output, we enforce byte-level
 * parity with NO `KNOWN_ACCEPTABLE_DIFFERENCES` allowlist. Any divergence is
 * a bug in the V9 adapter (never in V2).
 *
 * This spec drives every canonical user journey through both
 * `/api/treatment-v2` and `/api/treatment-v9` and asserts the response
 * `message` text is identical at every turn.
 *
 * Produces a markdown report at:
 *   tests/reports/V2_V9_ROUTE_PARITY_REPORT.md
 */

const reports: FlowReport[] = [];
const flowEntries = Object.entries(ALL_FLOWS);

for (const [flowName, flowSteps] of flowEntries) {
  test(`V2 vs V9 PARITY: ${flowName}`, async ({ request }) => {
    const {
      results,
      v2Failed,
      v2FailureStep,
      v2FailureError,
      v9Failed,
      v9FailureStep,
      v9FailureError,
    } = await runParityFlowV2V9(request, flowSteps as FlowStep[]);

    const report = buildFlowReportV2V9(
      flowName,
      results,
      flowSteps as FlowStep[],
      v2Failed,
      v2FailureStep,
      v2FailureError,
      v9Failed,
      v9FailureStep,
      v9FailureError,
    );

    reports.push(report);

    // v9 has no allowlist: every non-v2-crash divergence must fail the test.
    const blockingDivergences = report.divergences.filter(
      d => d.type !== 'v2_error',
    );

    if (v2Failed) {
      console.warn(
        `  WARNING  ${flowName}: V2 crashed at step ${v2FailureStep} - comparison partial`,
      );
    }
    if (v9Failed) {
      console.warn(
        `  WARNING  ${flowName}: V9 crashed at step ${v9FailureStep} - comparison partial`,
      );
    }

    if (blockingDivergences.length > 0) {
      const summary = blockingDivergences
        .map(d => `  Step ${d.stepIndex} (${d.inputLabel}): ${d.detail}`)
        .join('\n');
      expect(
        blockingDivergences.length,
        `${flowName}: ${blockingDivergences.length} v2/v9 divergence(s)\n${summary}`,
      ).toBe(0);
    } else if (!v2Failed && !v9Failed) {
      console.log(`  PASS  ${flowName}: V9 matches V2 byte-for-byte`);
    }
  });
}

test.afterAll(async () => {
  if (reports.length === 0) return;

  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const markdown = generateFullReportMarkdown(reports);
  const reportPath = path.join(reportsDir, 'V2_V9_ROUTE_PARITY_REPORT.md');
  fs.writeFileSync(reportPath, markdown, 'utf-8');

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  V2 vs V9 PARITY REPORT written to: ${reportPath}`);
  console.log(`${'='.repeat(70)}\n`);

  const totalDivergences = reports.reduce(
    (sum, r) =>
      sum +
      r.divergences.filter(d => d.type !== 'v2_error').length,
    0,
  );
  const v2Crashes = reports.filter(r => r.v2Failed).length;
  const v9Crashes = reports.filter(r => r.v4Failed).length;

  console.log(`  Flows tested:            ${reports.length}`);
  console.log(`  Flows where V2 crashed:  ${v2Crashes}`);
  console.log(`  Flows where V9 crashed:  ${v9Crashes}`);
  console.log(`  Total divergences:       ${totalDivergences}`);
  console.log('');

  if (totalDivergences > 0) {
    console.log('  DIVERGENCES FOUND - V9 does NOT match V2 in the above flows.');
    console.log('  See the report for details. V9 has no allowlist; fix every row.');
  } else if (v2Crashes === 0 && v9Crashes === 0) {
    console.log('  ALL FLOWS MATCH - V9 is in byte-level parity with V2.');
  } else {
    console.log(
      '  No divergences in completed comparisons, but a route crash prevented full testing.',
    );
  }
});
