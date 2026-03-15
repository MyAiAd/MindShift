import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } },
) {
  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { runId } = params;

  // Fetch the run — RLS ensures only owner or super_admin can read
  const { data: run, error: runError } = await supabase
    .from('v5_test_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (runError || !run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  // Fetch flows
  const { data: flows, error: flowsError } = await supabase
    .from('v5_test_flow_results')
    .select('*')
    .eq('run_id', runId)
    .order('flow_index', { ascending: true });

  if (flowsError) {
    return NextResponse.json({ error: 'Failed to fetch flows', details: flowsError.message }, { status: 500 });
  }

  // Fetch all steps for this run
  const flowIds = (flows ?? []).map((f) => f.id);
  let steps: any[] = [];
  if (flowIds.length > 0) {
    const { data: stepData, error: stepsError } = await supabase
      .from('v5_test_step_results')
      .select('*')
      .in('flow_result_id', flowIds)
      .order('step_index', { ascending: true });

    if (stepsError) {
      return NextResponse.json({ error: 'Failed to fetch steps', details: stepsError.message }, { status: 500 });
    }
    steps = stepData ?? [];
  }

  // Nest steps under their flows
  const flowsWithSteps = (flows ?? []).map((flow) => ({
    ...flow,
    steps: steps.filter((s) => s.flow_result_id === flow.id),
  }));

  return NextResponse.json({ run, flows: flowsWithSteps });
}
