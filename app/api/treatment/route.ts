import { NextRequest, NextResponse } from 'next/server';
import { TreatmentStateMachine, ProcessingResult } from '@/lib/treatment-state-machine';
import { AIAssistanceManager, AIAssistanceRequest } from '@/lib/ai-assistance';
import { createServerClient } from '@/lib/database-server';

// Singleton instances for performance
const treatmentMachine = new TreatmentStateMachine();
const aiAssistance = new AIAssistanceManager();

export async function POST(request: NextRequest) {
  try {
    const { sessionId, userInput, userId, action } = await request.json();

    // Validate required fields
    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'SessionId and userId are required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'start':
        return await handleStartSession(sessionId, userId);
      
      case 'continue':
        if (!userInput) {
          return NextResponse.json(
            { error: 'UserInput is required for continue action' },
            { status: 400 }
          );
        }
        return await handleContinueSession(sessionId, userInput, userId);
      
      case 'status':
        return await handleGetStatus(sessionId, userId);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, continue, or status' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Treatment API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Start a new treatment session
 */
async function handleStartSession(sessionId: string, userId: string) {
  const startTime = performance.now();
  
  try {
    // Process initial welcome step with state machine
    const result = await treatmentMachine.processUserInput(sessionId, 'start', { userId });
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;

    // Save session to database
    await saveSessionToDatabase(sessionId, userId, result, responseTime);

    return NextResponse.json({
      success: true,
      sessionId,
      message: result.scriptedResponse,
      currentStep: result.nextStep,
      responseTime: Math.round(responseTime),
      usedAI: false,
      metadata: {
        phase: 'intro',
        step: 'welcome'
      }
    });
  } catch (error) {
    console.error('Start session error:', error);
    return NextResponse.json(
      { error: 'Failed to start session' },
      { status: 500 }
    );
  }
}

/**
 * Continue existing treatment session with user input
 */
async function handleContinueSession(sessionId: string, userInput: string, userId: string) {
  const startTime = performance.now();
  
  try {
    // Process with state machine first (95% of cases)
    const result = await treatmentMachine.processUserInput(sessionId, userInput, { userId });
    
    let finalResponse: any = {
      success: true,
      sessionId,
      responseTime: 0,
      usedAI: false
    };

    if (result.canContinue && result.scriptedResponse) {
      // Scripted response - instant delivery (<200ms target)
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      finalResponse = {
        ...finalResponse,
        message: result.scriptedResponse,
        currentStep: result.nextStep,
        responseTime: Math.round(responseTime),
        usedAI: false
      };

    } else if (result.needsAIAssistance) {
      // AI assistance needed (only 5% of cases)
      const aiResponse = await handleAIAssistance(result.needsAIAssistance, sessionId, userId);
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      finalResponse = {
        ...finalResponse,
        message: aiResponse.message,
        responseTime: Math.round(responseTime),
        usedAI: true,
        aiCost: aiResponse.cost,
        aiTokens: aiResponse.tokenCount
      };

    } else {
      // Validation error or other issue
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      finalResponse = {
        ...finalResponse,
        message: result.scriptedResponse || result.reason || 'Please try again.',
        responseTime: Math.round(responseTime),
        usedAI: false,
        requiresRetry: true
      };
    }

    // Save interaction to database
    await saveInteractionToDatabase(sessionId, userInput, finalResponse);

    return NextResponse.json(finalResponse);

  } catch (error) {
    console.error('Continue session error:', error);
    return NextResponse.json(
      { error: 'Failed to process input' },
      { status: 500 }
    );
  }
}

/**
 * Handle AI assistance when triggered (only 5% of interactions)
 */
async function handleAIAssistance(
  needsAI: { trigger: any; context: string; userInput: string },
  sessionId: string,
  userId: string
) {
  try {
    // This would be populated with actual treatment context
    const assistanceRequest: AIAssistanceRequest = {
      trigger: needsAI.trigger,
      userInput: needsAI.userInput,
      context: {
        userId,
        sessionId,
        currentPhase: 'problemShifting', // This would come from actual context
        currentStep: 'feel_problem', // This would come from actual context
        userResponses: {},
        startTime: new Date(),
        lastActivity: new Date(),
        metadata: {}
      },
      currentStep: {
        id: 'feel_problem',
        scriptedResponse: '',
        expectedResponseType: 'feeling',
        validationRules: [],
        aiTriggers: []
      }
    };

    const aiResponse = await aiAssistance.processAssistanceRequest(assistanceRequest);
    
    // Log AI usage for monitoring
    console.log(`AI assistance used for session ${sessionId}:`, {
      trigger: needsAI.trigger.condition,
      tokens: aiResponse.tokenCount,
      cost: aiResponse.cost
    });

    return aiResponse;
  } catch (error) {
    console.error('AI assistance error:', error);
    // Fallback to scripted response
    return {
      message: "Please continue with the current step of the process.",
      shouldReturnToScript: true,
      tokenCount: 0,
      cost: 0
    };
  }
}

/**
 * Get session status and statistics
 */
async function handleGetStatus(sessionId: string, userId: string) {
  try {
    const supabase = await createServerClient();
    
    // Get session data from database
    const { data: session, error } = await supabase
      .from('treatment_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (error || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Get AI usage stats
    const aiStats = aiAssistance.getUsageStats(sessionId);
    const systemStats = aiAssistance.getSystemStats();

    return NextResponse.json({
      success: true,
      session: {
        id: sessionId,
        status: session.status,
        currentPhase: session.current_phase,
        currentStep: session.current_step,
        startTime: session.created_at,
        duration: session.duration_minutes
      },
      performance: {
        avgResponseTime: session.avg_response_time,
        scriptedResponses: session.scripted_responses,
        aiResponses: session.ai_responses,
        aiUsagePercent: session.ai_responses / (session.scripted_responses + session.ai_responses) * 100
      },
      aiUsage: aiStats,
      systemStats
    });
  } catch (error) {
    console.error('Get status error:', error);
    return NextResponse.json(
      { error: 'Failed to get session status' },
      { status: 500 }
    );
  }
}

/**
 * Save session data to database
 */
async function saveSessionToDatabase(
  sessionId: string,
  userId: string,
  result: ProcessingResult,
  responseTime: number
) {
  try {
    const supabase = await createServerClient();
    
    await supabase.from('treatment_sessions').insert({
      session_id: sessionId,
      user_id: userId,
      status: 'active',
      current_phase: 'intro',
      current_step: 'welcome',
      created_at: new Date().toISOString(),
      avg_response_time: responseTime,
      scripted_responses: 1,
      ai_responses: 0
    });
  } catch (error) {
    console.error('Database save error:', error);
    // Don't fail the request if database save fails
  }
}

/**
 * Save interaction to database for analytics
 */
async function saveInteractionToDatabase(
  sessionId: string,
  userInput: string,
  response: any
) {
  try {
    const supabase = await createServerClient();
    
    await supabase.from('treatment_interactions').insert({
      session_id: sessionId,
      user_input: userInput,
      response_message: response.message,
      response_time: response.responseTime,
      used_ai: response.usedAI,
      ai_cost: response.aiCost || 0,
      ai_tokens: response.aiTokens || 0,
      created_at: new Date().toISOString()
    });

    // Update session statistics
    await supabase.rpc('update_session_stats', {
      p_session_id: sessionId,
      p_used_ai: response.usedAI,
      p_response_time: response.responseTime
    });
  } catch (error) {
    console.error('Database interaction save error:', error);
    // Don't fail the request if database save fails
  }
} 