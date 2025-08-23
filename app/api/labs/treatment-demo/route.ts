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

      // Initialize the session
      const result = initialInput 
        ? await stateMachine.processUserInput(sessionId, initialInput, initialContext, scriptMode)
        : await stateMachine.processUserInput(sessionId, 'start', initialContext, scriptMode);

      // Get the current context
      const currentContext = stateMachine.getContextForUndo(sessionId);

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

// Script-focused processing that sticks closely to written scripts
async function processScriptMode(
  stateMachine: TreatmentStateMachine, 
  sessionId: string, 
  userInput: string, 
  contextOverrides?: any
): Promise<any> {
  try {
    // Get current context
    const context = stateMachine.getContextForUndo(sessionId);
    if (!context) {
      throw new Error('Context not found');
    }

    // Update context with user response
    context.userResponses[context.currentStep] = userInput;
    context.lastActivity = new Date();

    // Simple step progression without complex validation
    const nextStepId = determineNextStepSimple(context);
    
    if (nextStepId) {
      context.currentStep = nextStepId;
      
      // Get the scripted response directly
      const scriptedResponse = getSimpleScriptedResponse(context, userInput);
      
      return {
        canContinue: true,
        nextStep: nextStepId,
        scriptedResponse
      };
    }

    return {
      canContinue: true,
      scriptedResponse: "Thank you for sharing that. Let's continue."
    };
  } catch (error) {
    console.error('Script mode processing error:', error);
    return {
      canContinue: true,
      scriptedResponse: "Thank you for your response. Let's move forward."
    };
  }
}

// Simple step progression logic for script mode
function determineNextStepSimple(context: any): string | null {
  const currentStep = context.currentStep;
  const modality = context.metadata?.selectedMethod || 'problem_shifting';
  
  // Define simple step sequences for each modality
  const stepSequences: Record<string, string[]> = {
    problem_shifting: [
      'mind_shifting_explanation',
      'problem_shifting_intro',
      'body_sensation_check',
      'feel_solution_state',
      'feel_good_state',
      'deeper_feeling_inquiry',
      'sensation_progression',
      'integration_check'
    ],
    reality_shifting: [
      'reality_goal_capture',
      'reality_step_a1',
      'reality_step_a2',
      'reality_feel_reason',
      'reality_feel_reason_2',
      'reality_feel_reason_3',
      'reality_integration'
    ],
    // Add other modalities as needed
  };
  
  const sequence = stepSequences[modality] || stepSequences.problem_shifting;
  const currentIndex = sequence.indexOf(currentStep);
  
  if (currentIndex >= 0 && currentIndex < sequence.length - 1) {
    return sequence[currentIndex + 1];
  }
  
  return null;
}

// Get simple scripted responses for script mode
function getSimpleScriptedResponse(context: any, userInput: string): string {
  const currentStep = context.currentStep;
  const modality = context.metadata?.selectedMethod || 'problem_shifting';
  
  // Simple script responses that stick to the written scripts
  const scriptResponses: Record<string, Record<string, string>> = {
    problem_shifting: {
      'mind_shifting_explanation': `Great! Let's work on that problem. What specific problem would you like to work on?`,
      'problem_shifting_intro': `Thank you. Now, feel that problem... what do you feel in your body when you think about that problem?`,
      'body_sensation_check': `Feel ${userInput}... what happens in yourself when you feel ${userInput}?`,
      'feel_solution_state': `What would you feel like if "${userInput}" had already happened?`,
      'feel_good_state': `Feel "${userInput}"... what does "${userInput}" feel like?`,
      'deeper_feeling_inquiry': `Feel "${userInput}"... what does "${userInput}" feel like in your body?`,
      'sensation_progression': `Feel "${userInput}"... what happens to "${userInput}" when you feel "${userInput}"?`,
      'integration_check': `Great! How do you feel about the original problem now?`
    },
    reality_shifting: {
      'reality_goal_capture': `What goal would you like to work on achieving?`,
      'reality_step_a1': `Thank you. Now think about that goal... what do you feel when you think about achieving that goal?`,
      'reality_step_a2': `Feel ${userInput}... what can you feel now?`,
      'reality_feel_reason': `What's the reason you can't have that goal right now?`,
      'reality_feel_reason_2': `Feel ${userInput}... what can you feel now?`,
      'reality_feel_reason_3': `Feel ${userInput}... what's the first thing you notice about it?`,
      'reality_integration': `Great! How do you feel about your goal now?`
    }
  };
  
  const modalityResponses = scriptResponses[modality] || scriptResponses.problem_shifting;
  return modalityResponses[currentStep] || `Thank you for sharing "${userInput}". Let's continue.`;
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