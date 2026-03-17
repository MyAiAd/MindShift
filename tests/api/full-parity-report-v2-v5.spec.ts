import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { runParityFlowV2V5, buildFlowReportV2V5 } from '../helpers/parity-runner';
import { generateFullReportMarkdown, FlowReport } from '../helpers/comparator';
import { ALL_FLOWS, FlowStep } from '../helpers/test-flows';

/**
 * V2 vs V5 parity test.
 *
 * Runs every flow against BOTH the V2 and V5 APIs, comparing:
 *   - Step names (normalized)
 *   - Full message text
 *   - Problem references in quoted strings
 *   - Detection of leaked routing signals
 *
 * Produces a markdown report at:
 *   tests/reports/V2_V5_PARITY_REPORT.md
 *
 * V2 is the medical gold standard. Every divergence = something to fix in V5.
 */

const reports: FlowReport[] = [];
const flowEntries = Object.entries(ALL_FLOWS);

for (const [flowName, flowSteps] of flowEntries) {
  test(`V2 vs V5 PARITY: ${flowName}`, async ({ request }) => {
    const {
      results,
      v2Failed,
      v2FailureStep,
      v2FailureError,
      v5Failed,
      v5FailureStep,
      v5FailureError,
    } = await runParityFlowV2V5(request, flowSteps as FlowStep[]);

    const report = buildFlowReportV2V5(
      flowName,
      results,
      flowSteps as FlowStep[],
      v2Failed,
      v2FailureStep,
      v2FailureError,
      v5Failed,
      v5FailureStep,
      v5FailureError,
    );

    reports.push(report);

    const realDivergences = report.divergences.filter(
      d => !d.isKnownDiff && d.type !== 'v2_error',
    );

    if (v2Failed) {
      console.warn(
        `  ⚠️  ${flowName}: V2 crashed at step ${v2FailureStep} — comparison partial`,
      );
    }
    if (v5Failed) {
      console.warn(
        `  ⚠️  ${flowName}: V5 crashed at step ${v5FailureStep} — comparison partial`,
      );
    }

    if (realDivergences.length > 0) {
      const summary = realDivergences
        .map(d => `  Step ${d.stepIndex} (${d.inputLabel}): ${d.detail}`)
        .join('\n');
      console.warn(
        `  ❌ ${flowName}: ${realDivergences.length} divergence(s):\n${summary}`,
      );
    } else if (!v2Failed && !v5Failed) {
      console.log(`  ✅ ${flowName}: V5 matches V2`);
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
  const reportPath = path.join(reportsDir, 'V2_V5_PARITY_REPORT.md');
  fs.writeFileSync(reportPath, markdown, 'utf-8');

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  V2 vs V5 PARITY REPORT written to: ${reportPath}`);
  console.log(`${'='.repeat(70)}\n`);

  const totalDivergences = reports.reduce(
    (sum, r) =>
      sum +
      r.divergences.filter(d => !d.isKnownDiff && d.type !== 'v2_error').length,
    0,
  );
  const v2Crashes = reports.filter(r => r.v2Failed).length;
  const v5Crashes = reports.filter(r => r.v4Failed).length;

  console.log(`  Flows tested:            ${reports.length}`);
  console.log(`  Flows where V2 crashed:  ${v2Crashes}`);
  console.log(`  Flows where V5 crashed:  ${v5Crashes}`);
  console.log(`  Total divergences:       ${totalDivergences}`);
  console.log('');

  if (totalDivergences > 0) {
    console.log('  DIVERGENCES FOUND — V5 does NOT match V2 in the above flows.');
    console.log('  See the report for details and action items.');
  } else if (v2Crashes === 0) {
    console.log('  ALL FLOWS MATCH — V5 is in parity with V2.');
  } else {
    console.log(
      '  No divergences in completed comparisons, but V2 crashes prevented full testing.',
    );
  }
});
