import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { review_status: string; review_note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { review_status, review_note } = body;
  const validStatuses = ['unreviewed', 'pass', 'fail', 'flag'];
  if (!validStatuses.includes(review_status)) {
    return NextResponse.json({ error: 'Invalid review_status' }, { status: 400 });
  }

  // Update the step
  const { data: step, error: stepError } = await supabase
    .from('v5_test_step_results')
    .update({
      review_status,
      review_note: review_note ?? null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select('*, flow_result_id')
    .single();

  if (stepError || !step) {
    console.error('v5-tests PATCH step error', stepError);
    return NextResponse.json({ error: 'Failed to update step', details: stepError?.message }, { status: 500 });
  }

  // Re-compute flow aggregates
  const { data: allSteps } = await supabase
    .from('v5_test_step_results')
    .select('review_status')
    .eq('flow_result_id', step.flow_result_id);

  if (allSteps) {
    const passedSteps = allSteps.filter((s) => s.review_status === 'pass').length;
    const failedSteps = allSteps.filter((s) => s.review_status === 'fail').length;

    await supabase
      .from('v5_test_flow_results')
      .update({ passed_steps: passedSteps, failed_steps: failedSteps })
      .eq('id', step.flow_result_id);

    // Re-compute run aggregates
    const { data: flow } = await supabase
      .from('v5_test_flow_results')
      .select('run_id')
      .eq('id', step.flow_result_id)
      .single();

    if (flow) {
      const { data: runFlowIds } = await supabase
        .from('v5_test_flow_results')
        .select('id')
        .eq('run_id', flow.run_id);

      if (runFlowIds) {
        const ids = runFlowIds.map((f) => f.id);
        const { data: runSteps } = await supabase
          .from('v5_test_step_results')
          .select('review_status')
          .in('flow_result_id', ids);

        if (runSteps) {
          const runPassed = runSteps.filter((s) => s.review_status === 'pass').length;
          const runFailed = runSteps.filter((s) => s.review_status === 'fail').length;
          const runFlagged = runSteps.filter((s) => s.review_status === 'flag').length;
          const runUnreviewed = runSteps.filter((s) => s.review_status === 'unreviewed').length;

          await supabase
            .from('v5_test_runs')
            .update({
              passed_steps: runPassed,
              failed_steps: runFailed,
              flagged_steps: runFlagged,
              unreviewed_steps: runUnreviewed,
              updated_at: new Date().toISOString(),
            })
            .eq('id', flow.run_id);
        }
      }
    }
  }

  return NextResponse.json({ step });
}
