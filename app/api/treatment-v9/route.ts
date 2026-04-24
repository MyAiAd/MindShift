import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import {
  v9HandleStartSession,
  v9HandleContinueSession,
  v9HandleResumeSession,
  v9HandleGetStatus,
  v9HandleUndo,
} from '@/lib/v9/core';

// V9 is a voice clone of V2. It uses V2's TreatmentStateMachine directly
// (no forked copy) so that every scripted response V9 speaks is byte-
// identical to the doctor text in V2. No linguistic processing, no AI
// paraphrasing, no rewrites. See
// /.cursor/plans/v9_voice_clone_plan_b3f48b14.plan.md for architecture.
//
// The companion audio endpoints live at:
//   - app/api/treatment-v9/start/route.ts  (text or audio)
//   - app/api/treatment-v9/turn/route.ts   (text or audio)

export async function POST(request: NextRequest) {
  try {
    console.log('Treatment V9 API: POST request received');

    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error('Treatment V9 API: JSON parsing error:', parseError);
      return NextResponse.json(
        {
          error: 'Invalid JSON in request body',
          details:
            parseError instanceof Error ? parseError.message : 'Unknown parsing error',
          location: 'request.json()',
        },
        { status: 400 },
      );
    }

    const { sessionId, userInput, userId, action, undoToStep } = requestBody;

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'SessionId and userId are required' },
        { status: 400 },
      );
    }

    try {
      const supabase = createServerClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.warn('Treatment V9 API: Auth check returned error, continuing anyway.');
      }

      if (user && user.id !== userId) {
        return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
      }
    } catch (authCheckError) {
      console.error('Treatment V9 API: Auth check failed, continuing anyway:', authCheckError);
    }

    switch (action) {
      case 'start':
        return await v9HandleStartSession(sessionId, userId);
      case 'continue':
        if (!userInput) {
          return NextResponse.json(
            { error: 'UserInput is required for continue action' },
            { status: 400 },
          );
        }
        return await v9HandleContinueSession(sessionId, userInput, userId);
      case 'resume':
        return await v9HandleResumeSession(sessionId, userId);
      case 'status':
        return await v9HandleGetStatus(sessionId, userId);
      case 'undo':
        if (!undoToStep) {
          return NextResponse.json(
            { error: 'undoToStep is required for undo action' },
            { status: 400 },
          );
        }
        return await v9HandleUndo(sessionId, undoToStep, userId);
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, continue, resume, status, or undo' },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('Treatment V9 API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        type: (error as any)?.constructor?.name || 'Unknown',
      },
      { status: 500 },
    );
  }
}
