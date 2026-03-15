import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { findStepSource } from '@/lib/v5/source-patcher';

export async function GET(
  _request: NextRequest,
  { params }: { params: { runId: string } },
) {
  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch every flagged step in this run that has a suggested_correction
  const { data: steps, error } = await supabase
    .from('v5_test_step_results')
    .select(`
      id,
      step_label,
      step_index,
      actual_step,
      response_message,
      suggested_correction,
      flow_result_id,
      v5_test_flow_results!inner (
        flow_name,
        run_id
      )
    `)
    .eq('review_status', 'flag')
    .not('suggested_correction', 'is', null)
    .order('step_index', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter to this run only (Supabase nested filter limitation workaround)
  const runSteps = (steps ?? []).filter(
    (s) => (s.v5_test_flow_results as any)?.run_id === params.runId,
  );

  const corrections = runSteps.map((step) => {
    const stepId = step.actual_step ?? '';
    const source = stepId ? findStepSource(stepId) : null;
    return {
      stepResultId: step.id,
      stepId,
      stepLabel: step.step_label ?? '',
      flowName: (step.v5_test_flow_results as any)?.flow_name ?? '',
      renderedText: step.response_message ?? '',
      suggestion: step.suggested_correction ?? '',
      sourceFile: source?.relativeFile ?? null,
      sourceFilePath: source?.filePath ?? null,
      sourceValue: source?.stringValue ?? null,
    };
  });

  return NextResponse.json({ corrections });
}
