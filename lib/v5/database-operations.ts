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

      // Save user responses to treatment_progress
      for (const [stepId, response] of Object.entries(context.userResponses)) {
        if (response) {
          const { error: progressError } = await supabase
            .from('treatment_progress')
            .upsert({
              session_id: context.sessionId,
              phase_id: context.currentPhase,
              step_id: stepId,
              user_response: response
            }, {
              onConflict: 'session_id,phase_id,step_id'
            });

          if (progressError) {
            console.error('Error saving progress data:', progressError);
          }
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
