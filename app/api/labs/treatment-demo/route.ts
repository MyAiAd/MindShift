import { NextRequest, NextResponse } from 'next/server';
import { TreatmentStateMachine, TreatmentContext, ProcessingResult } from '@/lib/treatment-state-machine';

// In-memory storage for demo sessions (in production, you might use Redis)
const demoSessions = new Map<string, TreatmentStateMachine>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sessionId, modality, initialInput, userInput, contextOverrides } = body;

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
        ? await stateMachine.processUserInput(sessionId, initialInput, initialContext, false)
        : await stateMachine.processUserInput(sessionId, 'start', initialContext, false);

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

      // Process user input with the existing state machine
      const result = await stateMachine.processUserInput(
        sessionId,
        userInput,
        contextOverrides,
        false // Don't bypass validation - we want full guardrails
      );

      // Get the updated context
      const currentContext = stateMachine.getContextForUndo(sessionId);

      return NextResponse.json({
        processingResult: result,
        context: currentContext
      });

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