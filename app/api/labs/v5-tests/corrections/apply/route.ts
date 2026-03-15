import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { applyStepCorrection } from '@/lib/v5/source-patcher';

export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    sourceFilePath: string;
    oldValue: string;
    newValue: string;
    stepResultId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sourceFilePath, oldValue, newValue, stepResultId } = body;

  if (!sourceFilePath || !oldValue || !newValue) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (oldValue === newValue) {
    return NextResponse.json({ ok: true, message: 'No change' });
  }

  try {
    applyStepCorrection(sourceFilePath, oldValue, newValue);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to apply correction' }, { status: 500 });
  }

  // Mark the step result as having its correction applied
  if (stepResultId) {
    await supabase
      .from('v5_test_step_results')
      .update({ review_note: `[APPLIED] ${newValue}` })
      .eq('id', stepResultId);
  }

  return NextResponse.json({ ok: true });
}
