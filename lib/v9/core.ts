import { NextResponse } from 'next/server';
import {
  TreatmentStateMachine,
  ProcessingResult,
} from '@/lib/v2/treatment-state-machine';
import { createServerClient } from '@/lib/database-server';
import { STRICT_SPEECH_MODE } from '@/lib/voice/speech-config';
import { getVoicePair, type VoicePair } from '@/lib/v9/voice-settings';

/**
 * V9 is a voice clone of V2. It uses V2's TreatmentStateMachine directly
 * (no forked copy) so that every scripted response V9 speaks is byte-
 * identical to the doctor text in V2. No linguistic processing, no AI
 * paraphrasing, no rewrites.
 *
 * This module contains the shared singleton and the handler functions
 * used by both:
 *   - app/api/treatment-v9/route.ts      (text JSON)
 *   - app/api/treatment-v9/start/route.ts (text or audio)
 *   - app/api/treatment-v9/turn/route.ts  (text or audio)
 *
 * Keeping them here ensures all three entry points share the same
 * in-memory session context.
 */

export const v9TreatmentMachine = new TreatmentStateMachine();

const TRANSITION_SIGNALS = new Set<string>([
  'TRANSITION_TO_DIG_DEEPER',
  'METHOD_SELECTION_NEEDED',
]);

export async function v9HandleStartSession(sessionId: string, userId: string) {
  const startTime = performance.now();
  try {
    await v9TreatmentMachine.clearContext(sessionId, { userId });
    const result = await v9TreatmentMachine.processUserInput(
      sessionId,
      'start',
      { userId },
    );
    const responseTime = performance.now() - startTime;

    await v9SaveSessionToDatabase(sessionId, userId, result, responseTime);
    const context = await v9TreatmentMachine.getOrCreateContextAsync(
      sessionId,
      { userId },
    );

    // Pin the admin-selected voice pair to the session at start time.
    // All subsequent turns read from `context.metadata.voicePair`, so
    // flipping the admin radios mid-session will not change the voice
    // a patient hears inside an in-flight conversation.
    const pair = await getVoicePair();
    context.metadata = context.metadata ?? {};
    (context.metadata as Record<string, unknown>).voicePair = {
      stt: pair.stt,
      tts: pair.tts,
    };
    try {
      await v9TreatmentMachine.saveContextToDatabase(context);
    } catch (persistError) {
      console.warn(
        'V9 start: failed to persist pinned voice pair, continuing in-memory:',
        persistError instanceof Error ? persistError.message : persistError,
      );
    }

    const finalResponse = {
      success: true,
      sessionId,
      message: result.scriptedResponse,
      currentStep: result.nextStep,
      responseTime: Math.round(responseTime),
      usedAI: false,
      metadata: { phase: 'intro', step: 'welcome' },
      voicePair: { stt: pair.stt, tts: pair.tts },
    };

    await v9SaveInteractionToDatabase(sessionId, 'start', finalResponse);
    return NextResponse.json(finalResponse);
  } catch (error) {
    console.error('V9 start session error:', error);
    return NextResponse.json(
      {
        error: 'Failed to start session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * Read the pinned voice pair for an existing session. Used by the
 * /turn endpoint so STT/TTS providers are stable across turns even
 * when the admin flips radios mid-session.
 *
 * Falls back to the current admin setting if the session has no pin
 * yet (e.g. a session created before this feature shipped). The
 * fallback is then persisted so the session becomes stable from the
 * next turn onward.
 */
export async function v9GetSessionVoicePair(
  sessionId: string,
  userId: string,
): Promise<VoicePair> {
  try {
    const context = await v9TreatmentMachine.getOrCreateContextAsync(
      sessionId,
      { userId },
    );
    const pinned = (context.metadata as Record<string, unknown> | undefined)
      ?.voicePair as VoicePair | undefined;
    if (
      pinned &&
      (pinned.stt === 'openai' || pinned.stt === 'whisper-local') &&
      (pinned.tts === 'openai' ||
        pinned.tts === 'elevenlabs' ||
        pinned.tts === 'kokoro')
    ) {
      return pinned;
    }

    const fallback = await getVoicePair();
    const pair: VoicePair = { stt: fallback.stt, tts: fallback.tts };
    context.metadata = context.metadata ?? {};
    (context.metadata as Record<string, unknown>).voicePair = pair;
    try {
      await v9TreatmentMachine.saveContextToDatabase(context);
    } catch {
      // Non-fatal: if persistence fails we'll just re-pin next turn.
    }
    return pair;
  } catch (err) {
    console.warn(
      'V9 voice pair lookup failed, defaulting to openai/openai:',
      err instanceof Error ? err.message : err,
    );
    return { stt: 'openai', tts: 'openai' };
  }
}

export async function v9HandleContinueSession(
  sessionId: string,
  userInput: string,
  userId: string,
) {
  const startTime = performance.now();
  try {
    const aiValidationBypass = STRICT_SPEECH_MODE;

    let result: ProcessingResult;
    try {
      result = await v9TreatmentMachine.processUserInput(
        sessionId,
        userInput,
        { userId },
        aiValidationBypass,
      );
    } catch (stateMachineError) {
      console.error('Treatment V9 API: State machine error:', stateMachineError);
      return NextResponse.json(
        {
          error: 'State machine processing failed',
          details:
            stateMachineError instanceof Error
              ? stateMachineError.message
              : 'Unknown state machine error',
          stack:
            stateMachineError instanceof Error
              ? stateMachineError.stack
              : 'No stack trace',
          location: 'processUserInput',
        },
        { status: 500 },
      );
    }

    let finalResponse: any = {
      success: true,
      sessionId,
      responseTime: 0,
      usedAI: false,
    };

    if (result.canContinue && result.scriptedResponse) {
      if (TRANSITION_SIGNALS.has(result.scriptedResponse)) {
        const inputForNextStep =
          result.scriptedResponse === 'METHOD_SELECTION_NEEDED'
            ? ''
            : userInput || '';
        const nextResult = await v9TreatmentMachine.processUserInput(
          sessionId,
          inputForNextStep,
          { userId },
          aiValidationBypass,
        );
        if (nextResult.canContinue && nextResult.scriptedResponse) {
          result = nextResult;
        }
      }

      const finalMessage = result.scriptedResponse;
      const responseTime = performance.now() - startTime;

      finalResponse = {
        ...finalResponse,
        message: finalMessage,
        currentStep: result.nextStep,
        responseTime: Math.round(responseTime),
        usedAI: false,
      };
    } else {
      const responseTime = performance.now() - startTime;
      finalResponse = {
        ...finalResponse,
        message: result.scriptedResponse || result.reason || 'Please try again.',
        currentStep:
          result.nextStep ||
          v9TreatmentMachine.getContextForUndo(sessionId)?.currentStep,
        responseTime: Math.round(responseTime),
        usedAI: false,
        requiresRetry: !result.canContinue,
      };
    }

    await v9SaveInteractionToDatabase(sessionId, userInput, finalResponse);
    await v9UpdateSessionContextInDatabase(
      sessionId,
      finalResponse.currentStep,
      finalResponse.usedAI,
      finalResponse.responseTime,
    );

    return NextResponse.json(finalResponse);
  } catch (error) {
    console.error('V9 continue session error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process input',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function v9HandleResumeSession(sessionId: string, userId: string) {
  try {
    const context = await v9TreatmentMachine.getOrCreateContextAsync(sessionId, {
      userId,
    });

    const supabase = createServerClient();
    const { data: session, error } = await supabase
      .from('treatment_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (error || !session) {
      return await v9HandleStartSession(sessionId, userId);
    }

    const { data: interactions } = await supabase
      .from('treatment_interactions')
      .select('user_input, response_message, used_ai, response_time, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    const messages: any[] = [];
    if (interactions && interactions.length > 0) {
      for (let i = 0; i < interactions.length; i++) {
        const interaction = interactions[i];
        if (interaction.user_input && interaction.user_input.trim() !== 'start') {
          messages.push({
            id: `user-${i}`,
            content: interaction.user_input,
            isUser: true,
            timestamp: new Date(interaction.created_at),
          });
        }
        messages.push({
          id: `system-${i}`,
          content: interaction.response_message,
          isUser: false,
          timestamp: new Date(interaction.created_at),
          responseTime: interaction.response_time,
          usedAI: interaction.used_ai,
        });
      }
    }

    return NextResponse.json({
      success: true,
      sessionId,
      currentStep: context.currentStep,
      currentPhase: context.currentPhase,
      messages,
      isExistingSession: true,
      session: {
        status: session.status,
        problemStatement: context.problemStatement,
        metadata: context.metadata,
        startTime: session.created_at,
        duration: session.duration_minutes,
      },
      performance: {
        avgResponseTime: session.avg_response_time,
        scriptedResponses: session.scripted_responses,
        aiResponses: session.ai_responses,
      },
    });
  } catch (error) {
    console.error('V9 resume session error:', error);
    return await v9HandleStartSession(sessionId, userId);
  }
}

export async function v9HandleGetStatus(sessionId: string, userId: string) {
  try {
    const supabase = createServerClient();
    const { data: session, error } = await supabase
      .from('treatment_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      session: {
        id: sessionId,
        status: session.status,
        currentPhase: session.current_phase,
        currentStep: session.current_step,
        startTime: session.created_at,
        duration: session.duration_minutes,
      },
      performance: {
        avgResponseTime: session.avg_response_time,
        scriptedResponses: session.scripted_responses,
        aiResponses: session.ai_responses,
      },
    });
  } catch (error) {
    console.error('V9 get status error:', error);
    return NextResponse.json(
      { error: 'Failed to get session status' },
      { status: 500 },
    );
  }
}

export async function v9HandleUndo(
  sessionId: string,
  undoToStep: string,
  userId: string,
) {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error(`Invalid sessionId: ${sessionId}`);
    }
    if (!undoToStep || typeof undoToStep !== 'string') {
      throw new Error(`Invalid undoToStep: ${undoToStep}`);
    }
    if (!userId || typeof userId !== 'string') {
      throw new Error(`Invalid userId: ${userId}`);
    }

    const context = v9TreatmentMachine.getContextForUndo(sessionId);
    if (!context) throw new Error('Treatment context is null or undefined');

    const stepsToKeep = new Set<string>();
    let phaseSteps;
    try {
      phaseSteps = v9TreatmentMachine.getPhaseSteps(context.currentPhase);
    } catch {
      await v9TreatmentMachine.clearUserResponsesForUndo(sessionId, new Set());
    }

    if (phaseSteps && Array.isArray(phaseSteps)) {
      let foundTargetStep = false;
      for (const step of phaseSteps) {
        if (step && step.id) {
          stepsToKeep.add(step.id);
          if (step.id === undoToStep) {
            foundTargetStep = true;
            break;
          }
        }
      }

      try {
        if (foundTargetStep) {
          v9TreatmentMachine.clearUserResponsesForUndo(sessionId, stepsToKeep);
          const stepsToInvalidate: string[] = [];
          Object.keys(context.userResponses).forEach((stepId) => {
            if (!stepsToKeep.has(stepId)) stepsToInvalidate.push(stepId);
          });
          if (stepsToInvalidate.length > 0) {
            v9TreatmentMachine.invalidateCacheForSteps(stepsToInvalidate);
          }
        } else {
          v9TreatmentMachine.clearUserResponsesForUndo(sessionId, new Set());
        }
      } catch (clearError) {
        console.error('V9 undo: Error clearing user responses:', clearError);
      }
    } else {
      try {
        v9TreatmentMachine.clearUserResponsesForUndo(sessionId, new Set());
      } catch {
        // non-critical
      }
    }

    const targetPhase = v9GetPhaseForStep(undoToStep);

    try {
      v9TreatmentMachine.updateContextForUndo(sessionId, {
        currentStep: undoToStep,
        currentPhase: targetPhase,
        lastActivity: new Date(),
      });
    } catch (updateError) {
      throw new Error(
        `Failed to update context: ${
          updateError instanceof Error ? updateError.message : 'Unknown update error'
        }`,
      );
    }

    try {
      await v9TreatmentMachine.saveContextToDatabase(context);
    } catch (saveError) {
      console.error('V9 undo: Error saving context to database:', saveError);
    }

    const updatedContext = v9TreatmentMachine.getContextForUndo(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Undo successful',
      currentStep: undoToStep,
      clearedResponses: updatedContext.userResponses
        ? Object.keys(updatedContext.userResponses).length
        : 0,
    });
  } catch (error) {
    console.error('V9 undo error:', error);
    return NextResponse.json(
      {
        error: 'Undo failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// ---- persistence helpers ----

async function v9SaveSessionToDatabase(
  sessionId: string,
  userId: string,
  _result: ProcessingResult,
  responseTime: number,
) {
  try {
    const supabase = createServerClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', userId)
      .single();

    const sessionData = {
      session_id: sessionId,
      user_id: userId,
      tenant_id: profile?.tenant_id || null,
      status: 'active',
      current_phase: 'introduction',
      current_step: 'mind_shifting_explanation',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      avg_response_time: Math.round(responseTime),
      scripted_responses: 1,
      ai_responses: 0,
      duration_minutes: 0,
      total_ai_cost: 0.0,
      total_ai_tokens: 0,
    };

    const { error } = await supabase.from('treatment_sessions').insert(sessionData);
    if (error) {
      console.warn('Treatment V9 API: session insert warning:', error.message);
    }
  } catch (error) {
    console.error('V9 database save error:', error);
  }
}

async function v9SaveInteractionToDatabase(
  sessionId: string,
  userInput: string,
  response: any,
) {
  try {
    const supabase = createServerClient();
    await supabase.from('treatment_interactions').insert({
      session_id: sessionId,
      user_input: userInput,
      response_message: response.message,
      response_time: response.responseTime,
      used_ai: response.usedAI,
      ai_cost: response.aiCost || 0,
      ai_tokens: response.aiTokens || 0,
      step_id: response.currentStep,
      phase_id: v9GetPhaseForStep(response.currentStep || ''),
      created_at: new Date().toISOString(),
    });

    await supabase.rpc('update_session_stats', {
      p_session_id: sessionId,
      p_used_ai: response.usedAI,
      p_response_time: response.responseTime,
    });
  } catch (error) {
    console.error('V9 database interaction save error:', error);
  }
}

async function v9UpdateSessionContextInDatabase(
  sessionId: string,
  currentStep: string,
  _usedAI: boolean,
  _responseTime: number,
) {
  try {
    const supabase = createServerClient();
    const context = v9TreatmentMachine.getContextForUndo(sessionId);

    const isCompleted =
      currentStep === 'session_complete' ||
      currentStep === 'reality_session_complete' ||
      currentStep?.includes('session_complete');

    const updateData: any = {
      current_phase: context.currentPhase,
      current_step: currentStep,
      problem_statement: context.problemStatement,
      metadata: context.metadata,
      updated_at: new Date().toISOString(),
    };

    if (isCompleted) {
      updateData.status = 'completed';
      updateData.completed_at = new Date().toISOString();
    }

    await supabase
      .from('treatment_sessions')
      .update(updateData)
      .eq('session_id', sessionId);

    const userResponse = context.userResponses?.[context.currentStep];
    if (userResponse) {
      try {
        await supabase.from('treatment_progress').upsert(
          {
            session_id: sessionId,
            phase_id: context.currentPhase,
            step_id: context.currentStep,
            user_response: userResponse,
            completed_at: new Date().toISOString(),
          },
          { onConflict: 'session_id,phase_id,step_id' },
        );
      } catch (progressError) {
        console.error('V9 progress save error:', progressError);
      }
    }
  } catch (error) {
    console.error('V9 database context update error:', error);
  }
}

/** V9 inherits V2's phase-for-step mapping unchanged. */
export function v9GetPhaseForStep(stepId: string): string {
  const stepToPhaseMap: Record<string, string> = {
    mind_shifting_explanation: 'introduction',
    goal_description: 'introduction',
    negative_experience_description: 'introduction',
    method_selection: 'introduction',
    work_type_selection: 'work_type_selection',
    work_type_description: 'work_type_selection',
    confirm_statement: 'work_type_selection',
    route_to_method: 'work_type_selection',
    method_selected: 'work_type_selection',
    multiple_problems_selection: 'discovery',
    restate_selected_problem: 'discovery',
    analyze_response: 'discovery',
    restate_identity_problem: 'discovery',
    confirm_identity_problem: 'discovery',
    restate_belief_problem: 'discovery',
    confirm_belief_problem: 'discovery',
    choose_method: 'method_selection',
    problem_shifting_intro: 'problem_shifting',
    body_sensation_check: 'problem_shifting',
    what_needs_to_happen_step: 'problem_shifting',
    feel_solution_state: 'problem_shifting',
    feel_good_state: 'problem_shifting',
    what_happens_step: 'problem_shifting',
    check_if_still_problem: 'problem_shifting',
    problem_integration_awareness_1: 'problem_shifting',
    problem_integration_awareness_2: 'problem_shifting',
    problem_integration_awareness_3: 'problem_shifting',
    problem_integration_awareness_4: 'problem_shifting',
    problem_integration_awareness_5: 'problem_shifting',
    problem_integration_action_1: 'problem_shifting',
    problem_integration_action_2: 'problem_shifting',
    problem_integration_action_3: 'problem_shifting',
    blockage_shifting_intro: 'blockage_shifting',
    blockage_step_b: 'blockage_shifting',
    blockage_step_c: 'blockage_shifting',
    blockage_step_d: 'blockage_shifting',
    blockage_step_e: 'blockage_shifting',
    blockage_check_if_still_problem: 'blockage_shifting',
    blockage_integration_awareness_1: 'blockage_shifting',
    blockage_integration_awareness_2: 'blockage_shifting',
    blockage_integration_awareness_3: 'blockage_shifting',
    blockage_integration_awareness_4: 'blockage_shifting',
    blockage_integration_awareness_5: 'blockage_shifting',
    blockage_integration_action_1: 'blockage_shifting',
    blockage_integration_action_2: 'blockage_shifting',
    blockage_integration_action_3: 'blockage_shifting',
    identity_shifting_intro: 'identity_shifting',
    identity_dissolve_step_a: 'identity_shifting',
    identity_dissolve_step_b: 'identity_shifting',
    identity_dissolve_step_c: 'identity_shifting',
    identity_dissolve_step_d: 'identity_shifting',
    identity_dissolve_step_e: 'identity_shifting',
    identity_dissolve_step_f: 'identity_shifting',
    identity_future_check: 'identity_shifting',
    identity_scenario_check: 'identity_shifting',
    identity_check: 'identity_shifting',
    identity_future_projection: 'identity_shifting',
    identity_future_step_b: 'identity_shifting',
    identity_future_step_c: 'identity_shifting',
    identity_future_step_d: 'identity_shifting',
    identity_future_step_e: 'identity_shifting',
    identity_future_step_f: 'identity_shifting',
    identity_problem_check: 'identity_shifting',
    identity_session_complete: 'identity_shifting',
    reality_shifting_intro: 'reality_shifting',
    reality_goal_capture: 'reality_shifting',
    goal_deadline_check: 'reality_shifting',
    goal_deadline_date: 'reality_shifting',
    goal_confirmation: 'reality_shifting',
    goal_certainty: 'reality_shifting',
    reality_step_a2: 'reality_shifting',
    reality_step_a3: 'reality_shifting',
    reality_step_b: 'reality_shifting',
    reality_why_not_possible: 'reality_shifting',
    reality_feel_reason: 'reality_shifting',
    reality_feel_reason_2: 'reality_shifting',
    reality_feel_reason_3: 'reality_shifting',
    reality_column_a_restart: 'reality_shifting',
    reality_checking_questions: 'reality_shifting',
    reality_doubt_reason: 'reality_shifting',
    reality_cycle_b2: 'reality_shifting',
    reality_cycle_b3: 'reality_shifting',
    reality_cycle_b4: 'reality_shifting',
    reality_certainty_check: 'reality_shifting',
    reality_integration_intro: 'reality_shifting',
    reality_integration_start: 'reality_shifting',
    reality_integration_helped: 'reality_shifting',
    reality_integration_awareness: 'reality_shifting',
    reality_integration_action: 'reality_shifting',
    reality_integration_action_more: 'reality_shifting',
    reality_integration_awareness_1: 'reality_shifting',
    reality_integration_awareness_2: 'reality_shifting',
    reality_integration_awareness_3: 'reality_shifting',
    reality_integration_awareness_4: 'reality_shifting',
    reality_integration_action_1: 'reality_shifting',
    reality_integration_action_2: 'reality_shifting',
    reality_integration_action_3: 'reality_shifting',
    reality_session_complete: 'reality_shifting',
    trauma_shifting_intro: 'trauma_shifting',
    trauma_problem_redirect: 'trauma_shifting',
    trauma_identity_step: 'trauma_shifting',
    trauma_dissolve_step_a: 'trauma_shifting',
    trauma_dissolve_step_b: 'trauma_shifting',
    trauma_dissolve_step_c: 'trauma_shifting',
    trauma_dissolve_step_d: 'trauma_shifting',
    trauma_dissolve_step_e: 'trauma_shifting',
    trauma_identity_check: 'trauma_shifting',
    trauma_future_identity_check: 'trauma_shifting',
    trauma_future_scenario_check: 'trauma_shifting',
    trauma_future_projection: 'trauma_shifting',
    trauma_future_step_c: 'trauma_shifting',
    trauma_future_step_d: 'trauma_shifting',
    trauma_future_step_e: 'trauma_shifting',
    trauma_future_step_f: 'trauma_shifting',
    trauma_experience_check: 'trauma_shifting',
    trauma_dig_deeper: 'trauma_shifting',
    trauma_dig_deeper_2: 'trauma_shifting',
    trauma_integration_awareness_1: 'trauma_shifting',
    trauma_integration_awareness_2: 'trauma_shifting',
    trauma_integration_awareness_3: 'trauma_shifting',
    trauma_integration_awareness_4: 'trauma_shifting',
    trauma_integration_awareness_5: 'trauma_shifting',
    trauma_integration_helped: 'trauma_shifting',
    trauma_integration_action: 'trauma_shifting',
    trauma_integration_action_1: 'trauma_shifting',
    trauma_integration_action_2: 'trauma_shifting',
    trauma_integration_action_3: 'trauma_shifting',
    trauma_integration_action_more: 'trauma_shifting',
    trauma_session_complete: 'trauma_shifting',
    belief_shifting_intro: 'belief_shifting',
    belief_step_a: 'belief_shifting',
    belief_step_b: 'belief_shifting',
    belief_step_c: 'belief_shifting',
    belief_step_d: 'belief_shifting',
    belief_step_e: 'belief_shifting',
    belief_step_f: 'belief_shifting',
    belief_check_1: 'belief_shifting',
    belief_check_2: 'belief_shifting',
    belief_check_3: 'belief_shifting',
    belief_future_projection: 'belief_shifting',
    belief_future_step_b: 'belief_shifting',
    belief_future_step_c: 'belief_shifting',
    belief_future_step_d: 'belief_shifting',
    belief_future_step_e: 'belief_shifting',
    belief_future_step_f: 'belief_shifting',
    belief_check_4: 'belief_shifting',
    belief_problem_check: 'belief_shifting',
    belief_integration_awareness_1: 'belief_shifting',
    belief_integration_awareness_2: 'belief_shifting',
    belief_integration_awareness_3: 'belief_shifting',
    belief_integration_awareness_4: 'belief_shifting',
    belief_integration_awareness_5: 'belief_shifting',
    belief_integration_action_1: 'belief_shifting',
    belief_integration_action_2: 'belief_shifting',
    belief_integration_action_3: 'belief_shifting',
    digging_deeper_start: 'digging_deeper',
    future_problem_check: 'digging_deeper',
    restate_problem_future: 'digging_deeper',
    digging_method_selection: 'digging_deeper',
    scenario_check_1: 'digging_deeper',
    scenario_check_2: 'digging_deeper',
    scenario_check_3: 'digging_deeper',
    restate_scenario_problem_1: 'digging_deeper',
    restate_scenario_problem_2: 'digging_deeper',
    restate_scenario_problem_3: 'digging_deeper',
    clear_scenario_problem_1: 'digging_deeper',
    clear_scenario_problem_2: 'digging_deeper',
    clear_scenario_problem_3: 'digging_deeper',
    anything_else_check_1: 'digging_deeper',
    anything_else_check_2: 'digging_deeper',
    anything_else_check_3: 'digging_deeper',
    restate_anything_else_problem_1: 'digging_deeper',
    restate_anything_else_problem_2: 'digging_deeper',
    restate_anything_else_problem_3: 'digging_deeper',
    clear_anything_else_problem_1: 'digging_deeper',
    clear_anything_else_problem_2: 'digging_deeper',
    clear_anything_else_problem_3: 'digging_deeper',
    integration_start: 'integration',
    awareness_question: 'integration',
    how_helped_question: 'integration',
    narrative_question: 'integration',
    intention_question: 'integration',
    action_question: 'integration',
    action_followup: 'integration',
    one_thing_question: 'integration',
    first_action_question: 'integration',
    when_will_you_do_this: 'integration',
    session_complete: 'integration',
  };

  return stepToPhaseMap[stepId] || 'introduction';
}
