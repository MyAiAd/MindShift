import { NextRequest, NextResponse } from 'next/server';
import { LabsTreatmentStateMachine } from '@/lib/labs-treatment-state-machine';

// Create a singleton instance for demo sessions
const demoSessions = new Map<string, LabsTreatmentStateMachine>();

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Simple treatment demo API is working!',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  console.log('🔍 SIMPLE_API_DEBUG: Simple treatment demo API called');
  try {
    const body = await request.json();
    console.log('🔍 SIMPLE_API_DEBUG: Request body:', body);
    const { action, sessionId, modality, userInput, scriptMode = true } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Get or create state machine for this session
    let stateMachine = demoSessions.get(sessionId);
    if (!stateMachine) {
      console.log(`🔍 SIMPLE_API_DEBUG: Creating new state machine for session: ${sessionId}`);
      stateMachine = new LabsTreatmentStateMachine();
      demoSessions.set(sessionId, stateMachine);
      
      // If this is a process action and no session exists, initialize with default modality
      if (action === 'process') {
        console.log(`🔍 SIMPLE_API_DEBUG: Auto-initializing session for process action`);
        stateMachine.initializeSession(sessionId, modality || 'problem_shifting', userInput);
      }
    }

    if (action === 'initialize') {
      console.log(`🔍 SIMPLE_API_DEBUG: Initializing session for modality: ${modality}`);
      
      const result = stateMachine.initializeSession(sessionId, modality, userInput);
      const context = stateMachine.getContext(sessionId);
      
      return NextResponse.json({
        processingResult: result,
        context: context
      });

    } else if (action === 'process') {
      console.log(`🔍 SIMPLE_API_DEBUG: Processing user input: "${userInput}"`);
      
      const result = stateMachine.processUserInput(sessionId, userInput);
      const context = stateMachine.getContext(sessionId);
      
      return NextResponse.json({
        processingResult: result,
        context: context
      });

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('🔍 SIMPLE_API_DEBUG: Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 