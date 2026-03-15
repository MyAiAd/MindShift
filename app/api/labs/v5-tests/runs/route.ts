import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

interface StepPayload {
  stepIndex: number;
  stepLabel?: string;
  userInput?: string;
  expectedStep?: string;
  actualStep?: string;
  responseMessage?: string;
  responseTimeMs?: number;
  usedAI?: boolean;
  stepMatched?: boolean | null;
  problemRefFound?: boolean | null;
  apiError?: string;
}

interface FlowPayload {
  flowName: string;
  flowIndex: number;
  status: 'pending' | 'running' | 'completed' | 'error';
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  steps: StepPayload[];
}

interface SaveRunBody {
  runName?: string;
  notes?: string;
  startedAt?: string;
  completedAt?: string;
  flows: FlowPayload[];
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: SaveRunBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { runName, notes, startedAt, completedAt, flows = [] } = body;

  // Compute aggregate totals
  let totalSteps = 0;
  for (const flow of flows) {
    totalSteps += flow.steps.length;
  }
  const unreviewedSteps = totalSteps; // all start unreviewed

  // Insert the run
  const { data: run, error: runError } = await supabase
    .from('v5_test_runs')
    .insert({
      run_by: user.id,
      run_name: runName ?? null,
      notes: notes ?? null,
      started_at: startedAt ?? new Date().toISOString(),
      completed_at: completedAt ?? new Date().toISOString(),
      total_steps: totalSteps,
      passed_steps: 0,
      failed_steps: 0,
      flagged_steps: 0,
      unreviewed_steps: unreviewedSteps,
    })
    .select('id')
    .single();

  if (runError || !run) {
    console.error('v5-tests POST: run insert error', runError);
    return NextResponse.json({ error: 'Failed to save run', details: runError?.message }, { status: 500 });
  }

  const runId = run.id;

  // Insert flows + steps
  for (const flow of flows) {
    const { data: flowResult, error: flowError } = await supabase
      .from('v5_test_flow_results')
      .insert({
        run_id: runId,
        flow_name: flow.flowName,
        flow_index: flow.flowIndex,
        status: flow.status,
        total_steps: flow.totalSteps,
        passed_steps: flow.passedSteps,
        failed_steps: flow.failedSteps,
        error_message: flow.errorMessage ?? null,
        started_at: flow.startedAt ?? null,
        completed_at: flow.completedAt ?? null,
      })
      .select('id')
      .single();

    if (flowError || !flowResult) {
      console.error('v5-tests POST: flow insert error', flowError);
      continue;
    }

    const stepRows = flow.steps.map((s) => ({
      flow_result_id: flowResult.id,
      step_index: s.stepIndex,
      step_label: s.stepLabel ?? null,
      user_input: s.userInput ?? null,
      expected_step: s.expectedStep ?? null,
      actual_step: s.actualStep ?? null,
      response_message: s.responseMessage ?? null,
      response_time_ms: s.responseTimeMs ?? null,
      used_ai: s.usedAI ?? null,
      step_matched: s.stepMatched ?? null,
      problem_ref_found: s.problemRefFound ?? null,
      api_error: s.apiError ?? null,
      review_status: 'unreviewed',
    }));

    if (stepRows.length > 0) {
      const { error: stepsError } = await supabase
        .from('v5_test_step_results')
        .insert(stepRows);

      if (stepsError) {
        console.error('v5-tests POST: steps insert error', stepsError);
      }
    }
  }

  return NextResponse.json({
    runId,
    url: `/dashboard/labs/v5-tests?runId=${runId}`,
  });
}

export async function GET(request: NextRequest) {
  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: runs, error } = await supabase
    .from('v5_test_runs')
    .select('id, run_name, started_at, completed_at, total_steps, passed_steps, failed_steps, flagged_steps, unreviewed_steps')
    .eq('run_by', user.id)
    .order('started_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('v5-tests GET runs error', error);
    return NextResponse.json({ error: 'Failed to fetch runs', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ runs: runs ?? [] });
}
