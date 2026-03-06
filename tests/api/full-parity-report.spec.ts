import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { runParityFlow, buildFlowReport } from '../helpers/parity-runner';
import { generateFullReportMarkdown, FlowReport } from '../helpers/comparator';
import { ALL_FLOWS, FlowStep } from '../helpers/test-flows';

/**
 * Comprehensive V2 vs V4 parity test.
 *
 * Runs EVERY flow against BOTH the V2 and V4 live APIs, comparing:
 *   - Step names (normalized)
 *   - FULL message text (not just problem refs)
 *   - Problem references in quoted strings
 *   - Detection of leaked routing signals
 *
 * Produces a human-readable markdown report at:
 *   tests/reports/V2_V4_PARITY_REPORT.md
 *
 * V2 is the medical gold standard and MUST NOT be changed.
 * Every divergence in the report = something to fix in V4.
 */

const reports: FlowReport[] = [];

const flowEntries = Object.entries(ALL_FLOWS);

for (const [flowName, flowSteps] of flowEntries) {
  test(`FULL PARITY: ${flowName}`, async ({ request }) => {
    const {
      results, v2Failed, v2FailureStep, v2FailureError,
      v4Failed, v4FailureStep, v4FailureError,
    } = await runParityFlow(request, flowSteps as FlowStep[]);

    const report = buildFlowReport(
      flowName,
      results,
      flowSteps as FlowStep[],
      v2Failed,
      v2FailureStep,
      v2FailureError,
      v4Failed,
      v4FailureStep,
      v4FailureError,
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
    if (v4Failed) {
      console.warn(
        `  ⚠️  ${flowName}: V4 crashed at step ${v4FailureStep} — comparison partial`,
      );
    }

    if (realDivergences.length > 0) {
      const summary = realDivergences
        .map(d => `  Step ${d.stepIndex} (${d.inputLabel}): ${d.detail}`)
        .join('\n');
      console.warn(`  ❌ ${flowName}: ${realDivergences.length} divergence(s):\n${summary}`);
    } else if (!v2Failed && !v4Failed) {
      console.log(`  ✅ ${flowName}: V4 matches V2`);
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
  const reportPath = path.join(reportsDir, 'V2_V4_PARITY_REPORT.md');
  fs.writeFileSync(reportPath, markdown, 'utf-8');

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  PARITY REPORT written to: ${reportPath}`);
  console.log(`${'='.repeat(70)}\n`);

  const totalDivergences = reports.reduce(
    (sum, r) => sum + r.divergences.filter(d => !d.isKnownDiff && d.type !== 'v2_error').length,
    0,
  );
  const v2Crashes = reports.filter(r => r.v2Failed).length;

  console.log(`  Flows tested:           ${reports.length}`);
  console.log(`  Flows where V2 crashed:  ${v2Crashes}`);
  console.log(`  Total divergences:       ${totalDivergences}`);
  console.log('');

  if (totalDivergences > 0) {
    console.log('  DIVERGENCES FOUND — V4 does NOT match V2 in the above flows.');
    console.log('  See the report for details and action items.');
  } else if (v2Crashes === 0) {
    console.log('  ALL FLOWS MATCH — V4 is in parity with V2.');
  } else {
    console.log('  No divergences in completed comparisons, but V2 crashes prevented full testing.');
  }
});
