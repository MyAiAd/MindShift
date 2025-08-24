import { NextRequest, NextResponse } from 'next/server';
import { TreatmentStateMachine, TreatmentContext, ProcessingResult } from '@/lib/treatment-state-machine';

// In-memory storage for demo sessions (in production, you might use Redis)
const demoSessions = new Map<string, TreatmentStateMachine>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sessionId, modality, initialInput, userInput, contextOverrides, scriptMode = true } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    let stateMachine = demoSessions.get(sessionId);
    
    if (action === 'initialize') {
      console.log(`🔍 SCRIPT_MODE_DEBUG: Initializing new demo session for modality: ${modality}`);
      console.log(`🔍 SCRIPT_MODE_DEBUG: Script mode enabled: ${scriptMode}`);
      
      // Create new state machine for this demo session
      stateMachine = new TreatmentStateMachine();
      demoSessions.set(sessionId, stateMachine);

      // Override database save to prevent writes
      const originalSaveMethod = (stateMachine as any).saveContextToDatabase;
      (stateMachine as any).saveContextToDatabase = async () => {
        // No-op for demo - prevent database writes
        return Promise.resolve();
      };

      // Create initial context based on modality
      const initialContext: Partial<TreatmentContext> = {
        userId: 'demo_user',
        sessionId,
        currentPhase: getInitialPhase(modality),
        currentStep: getInitialStep(modality),
        userResponses: {},
        startTime: new Date(),
        lastActivity: new Date(),
        metadata: {
          cycleCount: 0,
          problemStatement: '',
          lastResponse: '',
          workType: getWorkType(modality),
          selectedMethod: modality
        }
      };

      console.log(`🔍 SCRIPT_MODE_DEBUG: Initial context created:`, initialContext);
      
      // Initialize the session
      const initInput = initialInput || 'start';
      console.log(`🔍 SCRIPT_MODE_DEBUG: Initializing with input: "${initInput}"`);
      
      const result = await stateMachine.processUserInput(sessionId, initInput, initialContext, scriptMode);
      
      console.log(`🔍 SCRIPT_MODE_DEBUG: Initialization result:`, result);

      // Get the current context
      const currentContext = stateMachine.getContextForUndo(sessionId);
      console.log(`🔍 SCRIPT_MODE_DEBUG: Final context after initialization:`, currentContext);

      return NextResponse.json({
        processingResult: result,
        context: currentContext
      });

    } else if (action === 'process') {
      if (!stateMachine) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      if (scriptMode) {
        // SCRIPT-STRICT MODE: Process with minimal AI interference
        const result = await processScriptMode(stateMachine, sessionId, userInput, contextOverrides);
        const currentContext = stateMachine.getContextForUndo(sessionId);
        
        return NextResponse.json({
          processingResult: result,
          context: currentContext
        });
      } else {
        // FULL STATE MACHINE MODE: Process with all validation and AI assistance
        const result = await stateMachine.processUserInput(
          sessionId,
          userInput,
          contextOverrides,
          false // Full validation in non-script mode
        );

        const currentContext = stateMachine.getContextForUndo(sessionId);

        return NextResponse.json({
          processingResult: result,
          context: currentContext
        });
      }

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Treatment demo API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Script-focused processing that uses the REAL state machine with validation but forces exact scripted responses
async function processScriptMode(
  stateMachine: TreatmentStateMachine, 
  sessionId: string, 
  userInput: string, 
  contextOverrides?: any
): Promise<any> {
  console.log(`🔍 SCRIPT_MODE_DEBUG: Starting processScriptMode for session ${sessionId}`);
  console.log(`🔍 SCRIPT_MODE_DEBUG: User input: "${userInput}"`);
  
  try {
    // Get current context for debugging
    const context = stateMachine.getContextForUndo(sessionId);
    console.log(`🔍 SCRIPT_MODE_DEBUG: Current context:`, {
      currentPhase: context?.currentPhase,
      currentStep: context?.currentStep,
      modality: context?.metadata?.selectedMethod
    });

    // Use the REAL state machine processing but intercept AI assistance
    const originalAIMethod = (stateMachine as any).checkAITriggers;
    const originalValidationMethod = (stateMachine as any).validateUserInput;
    
    // Override validation to use exact scripted responses for validation errors
    (stateMachine as any).validateUserInput = function(userInput: string, step: any, context?: any) {
      console.log(`🔍 SCRIPT_MODE_DEBUG: Validating input "${userInput}" for step "${step?.id}"`);
      const result = originalValidationMethod.call(this, userInput, step, context);
      console.log(`🔍 SCRIPT_MODE_DEBUG: Validation result:`, result);
      
      if (!result.isValid && result.error) {
        console.log(`🔍 SCRIPT_MODE_DEBUG: Converting validation error "${result.error}" to exact scripted response`);
        // Convert AI validation flags to exact scripted responses
        if (result.error === 'AI_VALIDATION_NEEDED:problem_vs_question') {
          const exactResponse = {
            isValid: false,
            error: 'How would you state that as a problem instead of a question?'
          };
          console.log(`🔍 SCRIPT_MODE_DEBUG: Returning exact response:`, exactResponse);
          return exactResponse;
        }
        if (result.error === 'AI_VALIDATION_NEEDED:problem_vs_goal') {
          const exactResponse = {
            isValid: false,
            error: 'How would you state that as a problem instead of a goal?'
          };
          console.log(`🔍 SCRIPT_MODE_DEBUG: Returning exact response:`, exactResponse);
          return exactResponse;
        }
        if (result.error === 'AI_VALIDATION_NEEDED:goal_vs_problem') {
          const exactResponse = {
            isValid: false,
            error: 'How would you state that as a goal instead of a problem?'
          };
          console.log(`🔍 SCRIPT_MODE_DEBUG: Returning exact response:`, exactResponse);
          return exactResponse;
        }
        if (result.error === 'AI_VALIDATION_NEEDED:goal_vs_question') {
          const exactResponse = {
            isValid: false,
            error: 'How would you state that as a goal instead of a question?'
          };
          console.log(`🔍 SCRIPT_MODE_DEBUG: Returning exact response:`, exactResponse);
          return exactResponse;
        }
        if (result.error === 'AI_VALIDATION_NEEDED:single_negative_experience') {
          const exactResponse = {
            isValid: false,
            error: 'It is important that we only work on one memory of a single event at a time, so please recall a significant event and tell me what the event was in a few words.'
          };
          console.log(`🔍 SCRIPT_MODE_DEBUG: Returning exact response:`, exactResponse);
          return exactResponse;
        }
      }
      
      console.log(`🔍 SCRIPT_MODE_DEBUG: No validation error conversion needed, returning original result:`, result);
      return result;
    };
    
    // Disable AI triggers to prevent deviation from scripts
    (stateMachine as any).checkAITriggers = function(userInput: string, step: any, context: any) {
      console.log(`🔍 SCRIPT_MODE_DEBUG: AI triggers called but disabled in script mode`);
      return null; // No AI triggers in script mode
    };

    console.log(`🔍 SCRIPT_MODE_DEBUG: Processing with real state machine...`);
    // Process with the real state machine
    const result = await stateMachine.processUserInput(
      sessionId,
      userInput,
      contextOverrides,
      false // Don't bypass validation - we want the exact validation messages
    );

    console.log(`🔍 SCRIPT_MODE_DEBUG: State machine result:`, result);

    // Restore original methods
    (stateMachine as any).checkAITriggers = originalAIMethod;
    (stateMachine as any).validateUserInput = originalValidationMethod;

    console.log(`🔍 SCRIPT_MODE_DEBUG: Returning final result:`, result);
    return result;
  } catch (error) {
    console.error('Script mode processing error:', error);
    return {
      canContinue: true,
      scriptedResponse: "Thank you for your response. Let's move forward."
    };
  }
}



// Helper functions to map modalities to phases/steps
function getInitialPhase(modality: string): string {
  switch (modality) {
    case 'problem_shifting':
    case 'identity_shifting':
    case 'belief_shifting':
    case 'blockage_shifting':
      return 'introduction';
    case 'reality_shifting':
      return 'reality_shifting';
    case 'trauma_shifting':
      return 'trauma_shifting';
    default:
      return 'introduction';
  }
}

function getInitialStep(modality: string): string {
  switch (modality) {
    case 'problem_shifting':
    case 'identity_shifting':
    case 'belief_shifting':
    case 'blockage_shifting':
      return 'mind_shifting_explanation';
    case 'reality_shifting':
      return 'reality_goal_capture';
    case 'trauma_shifting':
      return 'trauma_shifting_intro';
    default:
      return 'mind_shifting_explanation';
  }
}

function getWorkType(modality: string): string {
  switch (modality) {
    case 'reality_shifting':
      return 'goal';
    case 'trauma_shifting':
      return 'negative_experience';
    default:
      return 'problem';
  }
} 