import { createServerClient } from '../database-server';
import { TreatmentContext } from './types';

export class DatabaseOperations {
  /**
   * Load treatment context from database
   */
  static async loadContextFromDatabase(sessionId: string): Promise<TreatmentContext | null> {
    try {
      const supabase = createServerClient();
      
      // Get session data
      const { data: session, error: sessionError } = await supabase
        .from('treatment_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (sessionError || !session) {
        console.log('No session found in database for:', sessionId);
        return null;
      }

      // Get user responses from treatment_progress
      const { data: progressData, error: progressError } = await supabase
        .from('treatment_progress')
        .select('step_id, user_response')
        .eq('session_id', sessionId);

      if (progressError) {
        console.error('Error loading progress data:', progressError);
      }

      // Build userResponses object
      const userResponses: Record<string, string> = {};
      if (progressData) {
        progressData.forEach(progress => {
          if (progress.user_response) {
            userResponses[progress.step_id] = progress.user_response;
          }
        });
      }

      // Construct context from database data
      const context: TreatmentContext = {
        userId: session.user_id,
        sessionId: session.session_id,
        currentPhase: session.current_phase,
        currentStep: session.current_step,
        userResponses,
        problemStatement: session.problem_statement || undefined,
        startTime: new Date(session.created_at),
        lastActivity: new Date(session.updated_at || session.created_at),
        metadata: session.metadata || {
          cycleCount: 0,
          problemStatement: '',
          lastResponse: '',
          workType: 'problem'
        }
      };

      console.log('Loaded context from database:', { 
        sessionId, 
        currentStep: context.currentStep, 
        currentPhase: context.currentPhase,
        userResponseCount: Object.keys(userResponses).length 
      });

      return context;
    } catch (error) {
      console.error('Error loading context from database:', error);
      return null;
    }
  }

  /**
   * Save treatment context to database
   */
  static async saveContextToDatabase(context: TreatmentContext): Promise<void> {
    try {
      const supabase = createServerClient();

      // Update session data with proper upsert handling
      const { error: sessionError } = await supabase
        .from('treatment_sessions')
        .upsert({
          session_id: context.sessionId,
          user_id: context.userId,
          current_phase: context.currentPhase,
          current_step: context.currentStep,
          problem_statement: context.problemStatement,
          metadata: context.metadata,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'session_id'
        });

      if (sessionError) {
        console.error('Error saving session data:', sessionError);
      }

      // Batch upsert all user responses to treatment_progress
      const progressRecords = Object.entries(context.userResponses)
        .filter(([, response]) => response)
        .map(([stepId, response]) => ({
          session_id: context.sessionId,
          phase_id: getCanonicalPhaseForStep(stepId, context.currentPhase),
          step_id: stepId,
          user_response: response
        }));

      if (progressRecords.length > 0) {
        const { error: progressError } = await supabase
          .from('treatment_progress')
          .upsert(progressRecords, {
            onConflict: 'session_id,phase_id,step_id'
          });

        if (progressError) {
          console.error('Error saving progress data:', progressError);
        }
      }

      console.log('Context saved to database:', context.sessionId);
    } catch (error) {
      console.error('Error saving context to database:', error);
    }
  }

  /**
   * Delete treatment context from database for fresh session start
   */
  static async deleteContextFromDatabase(sessionId: string): Promise<void> {
    try {
      const supabase = createServerClient();

      // Delete user responses from treatment_progress first (foreign key constraint)
      const { error: progressError } = await supabase
        .from('treatment_progress')
        .delete()
        .eq('session_id', sessionId);

      if (progressError) {
        console.error('Error deleting progress data:', progressError);
      }

      // Delete session data
      const { error: sessionError } = await supabase
        .from('treatment_sessions')
        .delete()
        .eq('session_id', sessionId);

      if (sessionError) {
        console.error('Error deleting session data:', sessionError);
      }

      console.log('Context deleted from database:', sessionId);
    } catch (error) {
      console.error('Error deleting context from database:', error);
    }
  }
}

/**
 * Resolves the canonical phase for a given step ID so that batch upserts
 * always write the correct phase_id regardless of what context.currentPhase
 * happens to be at save time. Falls back to the caller-supplied phase for
 * any step not in the map (e.g. future additions).
 */
function getCanonicalPhaseForStep(stepId: string, fallback: string): string {
  const map: Record<string, string> = {
    // Introduction
    'mind_shifting_explanation_dynamic': 'introduction',
    'method_selection': 'introduction',
    'goal_description': 'introduction',
    'negative_experience_description': 'introduction',

    // Work-type selection
    'work_type_description': 'work_type_selection',
    'confirm_statement': 'work_type_selection',
    'route_to_method': 'work_type_selection',
    'route_to_method_dynamic': 'work_type_selection',

    // Method selection
    'choose_method': 'method_selection',

    // Discovery
    'multiple_problems_selection': 'discovery',
    'restate_selected_problem': 'discovery',
    'analyze_response': 'discovery',
    'restate_identity_problem': 'discovery',
    'confirm_identity_problem': 'discovery',
    'restate_belief_problem': 'discovery',
    'confirm_belief_problem': 'discovery',

    // Problem Shifting
    'problem_shifting_intro_static': 'problem_shifting',
    'problem_shifting_intro_dynamic': 'problem_shifting',
    'body_sensation_check': 'problem_shifting',
    'what_needs_to_happen_step': 'problem_shifting',
    'feel_solution_state': 'problem_shifting',
    'feel_good_state': 'problem_shifting',
    'what_happens_step': 'problem_shifting',
    'check_if_still_problem': 'problem_shifting',

    // Identity Shifting
    'identity_shifting_intro_static': 'identity_shifting',
    'identity_shifting_intro_dynamic': 'identity_shifting',
    'identity_dissolve_step_a': 'identity_shifting',
    'identity_dissolve_step_b': 'identity_shifting',
    'identity_dissolve_step_c': 'identity_shifting',
    'identity_dissolve_step_d': 'identity_shifting',
    'identity_dissolve_step_e': 'identity_shifting',
    'identity_dissolve_step_f': 'identity_shifting',
    'identity_future_check': 'identity_shifting',
    'identity_scenario_check': 'identity_shifting',
    'identity_check': 'identity_shifting',
    'identity_future_projection': 'identity_shifting',
    'identity_future_step_b': 'identity_shifting',
    'identity_future_step_c': 'identity_shifting',
    'identity_future_step_d': 'identity_shifting',
    'identity_future_step_e': 'identity_shifting',
    'identity_future_step_f': 'identity_shifting',
    'identity_problem_check': 'identity_shifting',

    // Belief Shifting
    'belief_shifting_intro_static': 'belief_shifting',
    'belief_shifting_intro_dynamic': 'belief_shifting',
    'belief_step_a': 'belief_shifting',
    'belief_step_b': 'belief_shifting',
    'belief_step_c': 'belief_shifting',
    'belief_step_d': 'belief_shifting',
    'belief_step_e': 'belief_shifting',
    'belief_step_f': 'belief_shifting',
    'belief_check_1': 'belief_shifting',
    'belief_check_2': 'belief_shifting',
    'belief_check_3': 'belief_shifting',
    'belief_check_4': 'belief_shifting',
    'belief_problem_check': 'belief_shifting',

    // Blockage Shifting
    'blockage_shifting_intro_static': 'blockage_shifting',
    'blockage_shifting_intro_dynamic': 'blockage_shifting',
    'blockage_step_b': 'blockage_shifting',
    'blockage_step_c': 'blockage_shifting',
    'blockage_step_d': 'blockage_shifting',
    'blockage_step_e': 'blockage_shifting',
    'blockage_check_if_still_problem': 'blockage_shifting',

    // Reality Shifting
    'reality_goal_capture': 'reality_shifting',
    'goal_deadline_check': 'reality_shifting',
    'goal_deadline_date': 'reality_shifting',
    'goal_confirmation': 'reality_shifting',
    'goal_certainty': 'reality_shifting',
    'reality_shifting_intro_static': 'reality_shifting',
    'reality_shifting_intro_dynamic': 'reality_shifting',
    'reality_step_a2': 'reality_shifting',
    'reality_step_a3': 'reality_shifting',
    'reality_why_not_possible': 'reality_shifting',
    'reality_feel_reason': 'reality_shifting',
    'reality_feel_reason_2': 'reality_shifting',
    'reality_feel_reason_3': 'reality_shifting',
    'reality_column_a_restart': 'reality_shifting',
    'reality_checking_questions': 'reality_shifting',
    'reality_doubt_reason': 'reality_shifting',
    'reality_cycle_b2': 'reality_shifting',
    'reality_cycle_b3': 'reality_shifting',
    'reality_cycle_b4': 'reality_shifting',
    'reality_certainty_check': 'reality_shifting',

    // Trauma Shifting
    'trauma_shifting_intro': 'trauma_shifting',
    'trauma_problem_redirect': 'trauma_shifting',
    'trauma_identity_step_static': 'trauma_shifting',
    'trauma_identity_step_dynamic': 'trauma_shifting',
    'trauma_dissolve_step_a': 'trauma_shifting',
    'trauma_dissolve_step_b': 'trauma_shifting',
    'trauma_dissolve_step_c': 'trauma_shifting',
    'trauma_dissolve_step_d': 'trauma_shifting',
    'trauma_dissolve_step_e': 'trauma_shifting',
    'trauma_identity_check': 'trauma_shifting',
    'trauma_future_identity_check': 'trauma_shifting',
    'trauma_future_scenario_check': 'trauma_shifting',
    'trauma_future_projection': 'trauma_shifting',
    'trauma_future_step_c': 'trauma_shifting',
    'trauma_future_step_d': 'trauma_shifting',
    'trauma_future_step_e': 'trauma_shifting',
    'trauma_future_step_f': 'trauma_shifting',
    'trauma_experience_check': 'trauma_shifting',
    'trauma_dig_deeper': 'trauma_shifting',
    'trauma_dig_deeper_2': 'trauma_shifting',

    // Digging Deeper
    'digging_deeper_start': 'digging_deeper',
    'future_problem_check': 'digging_deeper',
    'restate_problem_future': 'digging_deeper',
    'digging_method_selection': 'digging_deeper',
    'scenario_check_1': 'digging_deeper',
    'restate_scenario_problem_1': 'digging_deeper',
    'clear_scenario_problem_1': 'digging_deeper',
    'scenario_check_2': 'digging_deeper',
    'restate_scenario_problem_2': 'digging_deeper',
    'clear_scenario_problem_2': 'digging_deeper',
    'scenario_check_3': 'digging_deeper',
    'restate_scenario_problem_3': 'digging_deeper',
    'clear_scenario_problem_3': 'digging_deeper',
    'anything_else_check_1': 'digging_deeper',
    'restate_anything_else_problem_1': 'digging_deeper',
    'clear_anything_else_problem_1': 'digging_deeper',
    'anything_else_check_2': 'digging_deeper',
    'restate_anything_else_problem_2': 'digging_deeper',
    'clear_anything_else_problem_2': 'digging_deeper',
    'anything_else_check_3': 'digging_deeper',
    'route_to_integration': 'digging_deeper',

    // Integration (generic + modality-prefixed)
    'integration_start': 'integration',
    'awareness_question': 'integration',
    'how_helped_question': 'integration',
    'narrative_question': 'integration',
    'intention_question': 'integration',
    'action_question': 'integration',
    'action_followup': 'integration',
    'one_thing_question': 'integration',
    'first_action_question': 'integration',
    'when_will_you_do_this': 'integration',
    'session_complete': 'integration',
    'problem_integration_awareness_1': 'integration',
    'problem_integration_awareness_2': 'integration',
    'problem_integration_awareness_3': 'integration',
    'problem_integration_awareness_4': 'integration',
    'problem_integration_awareness_5': 'integration',
    'problem_integration_action_1': 'integration',
    'problem_integration_action_2': 'integration',
    'problem_integration_action_3': 'integration',
    'integration_awareness_1': 'integration',
    'integration_awareness_2': 'integration',
    'integration_awareness_3': 'integration',
    'integration_awareness_4': 'integration',
    'integration_awareness_5': 'integration',
    'integration_action_1': 'integration',
    'integration_action_2': 'integration',
    'integration_action_3': 'integration',
    'integration_action_4': 'integration',
    'integration_action_5': 'integration',
    'identity_session_complete': 'integration',
    'belief_integration_awareness_1': 'integration',
    'belief_integration_awareness_2': 'integration',
    'belief_integration_awareness_3': 'integration',
    'belief_integration_awareness_4': 'integration',
    'belief_integration_awareness_5': 'integration',
    'belief_integration_action_1': 'integration',
    'belief_integration_action_2': 'integration',
    'belief_integration_action_3': 'integration',
    'blockage_integration_awareness_1': 'integration',
    'blockage_integration_awareness_2': 'integration',
    'blockage_integration_awareness_3': 'integration',
    'blockage_integration_awareness_4': 'integration',
    'blockage_integration_awareness_5': 'integration',
    'blockage_integration_action_1': 'integration',
    'blockage_integration_action_2': 'integration',
    'blockage_integration_action_3': 'integration',
    'trauma_integration_awareness_1': 'integration',
    'trauma_integration_awareness_2': 'integration',
    'trauma_integration_awareness_3': 'integration',
    'trauma_integration_awareness_4': 'integration',
    'trauma_integration_awareness_5': 'integration',
    'trauma_integration_action_1': 'integration',
    'trauma_integration_action_2': 'integration',
    'trauma_integration_action_3': 'integration',
    'reality_integration_intro': 'integration',
    'reality_integration_start': 'integration',
    'reality_integration_helped': 'integration',
    'reality_integration_awareness': 'integration',
    'reality_integration_action': 'integration',
    'reality_integration_action_more': 'integration',
    'reality_integration_awareness_1': 'integration',
    'reality_integration_awareness_2': 'integration',
    'reality_integration_awareness_3': 'integration',
    'reality_integration_awareness_4': 'integration',
  };
  return map[stepId] ?? fallback;
}
