import { NextRequest, NextResponse } from 'next/server';

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
    const { action, sessionId, modality, userInput } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    if (action === 'initialize') {
      console.log(`🔍 SIMPLE_API_DEBUG: Initializing session for modality: ${modality}`);
      
      // Simple initialization response
      return NextResponse.json({
        processingResult: {
          canContinue: true,
          scriptedResponse: "Welcome to Mind Shifting. What problem would you like to work on today? Please state it in a few words.",
          reason: 'initialization_success'
        },
        context: {
          sessionId,
          currentPhase: 'introduction',
          currentStep: 'mind_shifting_explanation',
          modality
        }
      });

    } else if (action === 'process') {
      console.log(`🔍 SIMPLE_API_DEBUG: Processing user input: "${userInput}"`);
      
      // Simple processing logic
      let response = "Thank you for your response. Let's continue with the treatment.";
      
      if (userInput.toLowerCase().includes('money') || userInput.toLowerCase().includes('financial')) {
        response = "I understand you want to work on financial issues. Let's focus on that specific problem. What exactly is the financial problem you're facing?";
      } else if (userInput.toLowerCase().includes('problem') || userInput.toLowerCase().includes('issue')) {
        response = "Good, you've identified a problem. Now let's work on it step by step. What specific aspect of this problem would you like to address first?";
      } else if (userInput.toLowerCase().includes('goal') || userInput.toLowerCase().includes('want')) {
        response = "I see you're stating a goal. For Mind Shifting, we need to work with the problem that's preventing you from achieving this goal. What's the problem that's stopping you from reaching this goal?";
      }
      
      return NextResponse.json({
        processingResult: {
          canContinue: true,
          scriptedResponse: response,
          reason: 'processing_success'
        },
        context: {
          sessionId,
          currentPhase: 'introduction',
          currentStep: 'problem_capture',
          lastInput: userInput
        }
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