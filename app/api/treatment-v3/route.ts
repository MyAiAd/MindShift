import { NextRequest, NextResponse } from 'next/server';
import { TreatmentStateMachine } from '@/lib/v3/treatment-state-machine';
import { ProcessingResult } from '@/lib/v3/types';
import { AIAssistanceManager, AIAssistanceRequest, ValidationAssistanceRequest } from '@/lib/v2/ai-assistance';
import { createServerClient } from '@/lib/database-server';

// Singleton instances for performance
const treatmentMachine = new TreatmentStateMachine();
const aiAssistance = new AIAssistanceManager();

/**
 * Extract emotion from user input for storing context
 */
function extractEmotionFromInput(userInput: string): string {
  const input = userInput.toLowerCase().trim();
  
  // Common emotions list for extraction
  const emotions = [
    'mad', 'angry', 'sad', 'upset', 'stressed', 'anxious', 'worried', 'depressed', 
    'frustrated', 'scared', 'nervous', 'happy', 'excited', 'overwhelmed', 'confused', 
    'lost', 'stuck', 'tired', 'exhausted', 'lonely', 'hurt', 'disappointed', 'ashamed', 
    'guilty', 'embarrassed', 'helpless', 'hopeless', 'irritated', 'annoyed', 'furious', 
    'devastated', 'miserable', 'panicked', 'terrified', 'disgusted', 'bitter', 'resentful', 
    'jealous', 'envious', 'insecure', 'worthless', 'empty', 'numb', 'restless', 'impatient', 
    'bored', 'content', 'peaceful', 'grateful', 'proud', 'confident', 'optimistic', 
    'motivated', 'inspired', 'relieved', 'surprised', 'curious', 'playful', 'loving', 
    'joyful', 'blissful', 'serene', 'calm', 'relaxed', 'unhappy', 'uncomfortable', 'uneasy', 
    'troubled', 'disturbed', 'distressed'
  ];
  
  // Find the emotion in the input
  const foundEmotion = emotions.find(emotion => input.includes(emotion));
  return foundEmotion || 'this way';
}

export async function POST(request: NextRequest) {
  try {
    console.log('Treatment V3 API: POST request received');
    
    let requestBody;
    try {
      requestBody = await request.json();
      console.log('Treatment V3 API: Request body parsed:', requestBody);
    } catch (parseError) {
      console.error('Treatment V3 API: JSON parsing error:', parseError);
      return NextResponse.json({
        error: 'Invalid JSON in request body',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
        location: 'request.json()'
      }, { status: 400 });
    }
    
    const { sessionId, userInput, userId, action, undoToStep } = requestBody;
    console.log('Treatment V3 API: Extracted parameters:', { sessionId, userInput, userId, action, undoToStep });

    // Validate required fields
    if (!sessionId || !userId) {
      console.log('Treatment V3 API: Missing required fields');
      return NextResponse.json(
        { error: 'SessionId and userId are required' },
        { status: 400 }
      );
    }

    // Verify user authentication - more robust approach
    try {
      const supabase = createServerClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Treatment V3 API: Authentication error:', authError);
        // Continue execution for development/testing but log the issue
        console.warn('Treatment V3 API: Continuing without strict auth verification for compatibility');
      }

      if (user && user.id !== userId) {
        console.error('Treatment V3 API: User ID mismatch:', { requestUserId: userId, authUserId: user.id });
        return NextResponse.json(
          { error: 'User ID mismatch' },
          { status: 403 }
        );
      }

      // If we have a user, great! If not, we'll still allow the request for now
      // This provides compatibility while maintaining security when auth is working
      console.log('Treatment V3 API: Authentication check completed', { 
        hasUser: !!user, 
        userMatches: user?.id === userId,
        requestUserId: userId 
      });

    } catch (authCheckError) {
      console.error('Treatment V3 API: Auth check failed, continuing anyway:', authCheckError);
      // Continue execution - this handles cases where server-side auth isn't working
    }

    console.log('Treatment V3 API: Processing action:', action);
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
      
      case 'resume':
        return await handleResumeSession(sessionId, userId);
      
      case 'status':
        return await handleGetStatus(sessionId, userId);
      
      case 'undo':
        if (!undoToStep) {
          return NextResponse.json(
            { error: 'undoToStep is required for undo action' },
            { status: 400 }
          );
        }
        return await handleUndo(sessionId, undoToStep, userId);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, continue, status, or undo' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Treatment V3 API error:', error);
    console.error('Treatment V3 API error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Treatment V3 API error type:', typeof error);
    console.error('Treatment V3 API error constructor:', error?.constructor?.name);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        type: error?.constructor?.name || 'Unknown',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      },
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
    console.log('Treatment V3 API: Starting session:', { sessionId, userId });
    
    // IMPORTANT: Clear any existing context for fresh start
    await treatmentMachine.clearContext(sessionId);
    
    // Process initial welcome step with state machine
    const result = await treatmentMachine.processUserInput(sessionId, 'start', { userId });
    console.log('Treatment V3 API: State machine result:', result);
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;

    // Save session to database
    await saveSessionToDatabase(sessionId, userId, result, responseTime);
    
    // Ensure context is loaded from database for future interactions
    await treatmentMachine.getOrCreateContextAsync(sessionId, { userId });

    const finalResponse = {
      success: true,
      sessionId,
      message: result.scriptedResponse,
      currentStep: result.nextStep,
      responseTime: Math.round(responseTime),
      usedAI: false,
      metadata: {
        phase: 'intro',
        step: 'welcome',
        version: 'v3'
      }
    };

    // Save the initial welcome interaction to database
    await saveInteractionToDatabase(sessionId, 'start', finalResponse);

    // NEW: Add performance metrics to response
    const perfMetrics = treatmentMachine.getPerformanceMetrics();
    (finalResponse as any).performanceMetrics = perfMetrics;
    console.log(`🚀 V3 PERFORMANCE: Cache hit rate: ${perfMetrics.cacheHitRate.toFixed(1)}%, Preloaded responses: ${perfMetrics.preloadedResponsesUsed}`);

    return NextResponse.json(finalResponse);
  } catch (error) {
    console.error('V3 Start session error:', error);
    return NextResponse.json(
      { error: 'Failed to start V3 session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Continue existing treatment session with user input
 * Updated: 2025-01-09 - Fixed routing signals for goal/negative experience
 */
async function handleContinueSession(sessionId: string, userInput: string, userId: string) {
  const startTime = performance.now();
  
  try {
    console.log('Treatment V3 API [v3-routing-fix]: Continuing session:', { sessionId, userId, userInput: userInput.substring(0, 50) + '...' });
    
    console.log('Treatment V3 API: About to call processUserInput...');
    // Process with state machine first (95% of cases)
    let result;
    try {
      result = await treatmentMachine.processUserInput(sessionId, userInput, { userId });
      console.log('Treatment V3 API: State machine continue result:', result);
    } catch (stateMachineError) {
      console.error('Treatment V3 API: State machine error:', stateMachineError);
      return NextResponse.json({
        error: 'V3 State machine processing failed',
        details: stateMachineError instanceof Error ? stateMachineError.message : 'Unknown state machine error',
        stack: stateMachineError instanceof Error ? stateMachineError.stack : 'No stack trace',
        location: 'processUserInput'
      }, { status: 500 });
    }
    
    console.log('Treatment V3 API: Creating final response object...');
    let finalResponse: any = {
      success: true,
      sessionId,
      responseTime: 0,
      usedAI: false,
      version: 'v3'
    };

    console.log('Treatment V3 API: Checking if can continue...', { canContinue: result.canContinue, hasScriptedResponse: !!result.scriptedResponse });
    if (result.canContinue && result.scriptedResponse) {
      console.log('Treatment V3 API: Processing successful result...');
      
      // Handle special transition signals
      if (result.scriptedResponse === 'TRANSITION_TO_DIG_DEEPER') {
        console.log('Treatment V3 API: Detected transition signal, processing next step immediately');
        // Process the next step immediately without showing the transition message
        const nextResult = await treatmentMachine.processUserInput(sessionId, userInput || '', { userId });
        if (nextResult.canContinue && nextResult.scriptedResponse) {
          result = nextResult; // Use the next step's result
          console.log('Treatment V3 API: Using next step result:', result);
        }
      }
      
      let finalMessage = result.scriptedResponse;
      let usedAI = false;
      let aiCost = 0;
      let aiTokens = 0;

      // V3 Note: Linguistic processing will be handled by V3 state machine internally
      // For now, we'll use the V2 AI assistance system for compatibility
      if (result.needsLinguisticProcessing) {
        console.log('Treatment V3 API: V3 linguistic processing needed - using V2 compatibility layer');
        
        // For intro steps, use the problem statement from context, not the current user input
        let textToProcess = userInput;
        if (['problem_shifting_intro', 'blockage_shifting_intro', 
             'identity_shifting_intro', 'trauma_shifting_intro', 'belief_shifting_intro'].includes(result.nextStep || '')) {
          // Get the stored problem statement that the intro step will use
          const treatmentContext = treatmentMachine.getContextForUndo(sessionId);
          // PRIORITIZE: Use new digging problem if available, then fall back to original problem
          textToProcess = treatmentContext?.metadata?.currentDiggingProblem || 
                        treatmentContext?.metadata?.newDiggingProblem ||
                        treatmentContext?.problemStatement || 
                        treatmentContext?.userResponses?.['restate_selected_problem'] || 
                        treatmentContext?.userResponses?.['mind_shifting_explanation'] || 
                        userInput;
          console.log('Treatment V3 API: Using problem statement for intro step processing:', textToProcess);
        }

        // Check if we should skip AI processing for digging deeper intro steps
        const treatmentContext = treatmentMachine.getContextForUndo(sessionId);
        const isDiggingContext = treatmentContext?.metadata?.currentDiggingProblem || treatmentContext?.metadata?.newDiggingProblem;
        const isIntroStep = ['problem_shifting_intro', 'identity_shifting_intro', 'belief_shifting_intro'].includes(result.nextStep || '');
        const shouldSkipAI = isDiggingContext && isIntroStep;
        
        if (shouldSkipAI) {
          console.log('Treatment V3 API: Skipping AI processing for digging deeper intro step - using short scripted response');
          finalMessage = result.scriptedResponse; // Use the short scripted response directly
        } else {
          const linguisticResult = await aiAssistance.processLinguisticInterpretation(
            result.scriptedResponse || '',
            textToProcess,
            result.nextStep || 'unknown',
            sessionId
          );
          
          if (linguisticResult.success) {
            // For feel_solution_state, integrate the AI result back into the template
            if (result.nextStep === 'feel_solution_state') {
              finalMessage = `What would you feel like if you already ${linguisticResult.improvedResponse}?`;
            } 
            // For intro steps, replace the problem statement in the original scripted response
            else if (['problem_shifting_intro', 'reality_shifting_intro', 'blockage_shifting_intro', 
                     'identity_shifting_intro', 'trauma_shifting_intro', 'belief_shifting_intro'].includes(result.nextStep || '')) {
              // Replace the original problem statement in the scripted response with the AI-processed version
              finalMessage = (result.scriptedResponse || '').replace(new RegExp(`'${textToProcess.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g'), `'${linguisticResult.improvedResponse}'`);
              console.log('Treatment V3 API: Replaced problem statement in intro step with AI-processed version');
            } else {
              // For other steps (like body_sensation_check), use the full AI response
              finalMessage = linguisticResult.improvedResponse;
            }
            usedAI = true;
            aiCost = linguisticResult.cost;
            aiTokens = linguisticResult.tokens;
            console.log('Treatment V3 API: Linguistic processing successful');
          } else {
            console.log('Treatment V3 API: Linguistic processing failed, using scripted response');
          }
        }
      }

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      console.log('Treatment V3 API: Final response construction', {
        nextStep: result.nextStep,
        currentStepBefore: treatmentMachine.getContextForUndo(sessionId)?.currentStep,
        message: finalMessage
      });

      finalResponse = {
        ...finalResponse,
        message: finalMessage,
        currentStep: result.nextStep,
        responseTime: Math.round(responseTime),
        usedAI,
        ...(usedAI && { aiCost, aiTokens })
      };

    } else if (result.needsAIAssistance) {
      // AI assistance needed (only 5% of cases)
      const aiResponse = await handleAIAssistance(result.needsAIAssistance, sessionId, userId);
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      finalResponse = {
        ...finalResponse,
        message: aiResponse.message,
        currentStep: 'mind_shifting_explanation', // AI assistance keeps user on same step for clarification
        responseTime: Math.round(responseTime),
        usedAI: true,
        aiCost: aiResponse.cost,
        aiTokens: aiResponse.tokenCount
      };

    } else if (result.reason && result.reason.startsWith('AI_VALIDATION_NEEDED:')) {
      // NEW: Handle AI validation requests
      const validationType = result.reason.split(':')[1] as 'problem_vs_goal' | 'problem_vs_question' | 'single_negative_experience' | 'goal_vs_problem' | 'goal_vs_question' | 'general_emotion' | 'incomplete_emotion_context';
      const validationResponse = await handleAIValidation(userInput, validationType, sessionId, userId);
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      finalResponse = {
        ...finalResponse,
        message: validationResponse.message,
        currentStep: validationResponse.currentStep,
        responseTime: Math.round(responseTime),
        usedAI: validationResponse.usedAI,
        ...(validationResponse.usedAI && { 
          aiCost: validationResponse.aiCost, 
          aiTokens: validationResponse.aiTokens 
        }),
        requiresRetry: validationResponse.needsCorrection,
        showEmotionConfirmation: validationResponse.showEmotionConfirmation || false
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

    // PHASE 1 OPTIMIZATION: Save interaction and update context in parallel (independent operations)
    await Promise.all([
      saveInteractionToDatabase(sessionId, userInput, finalResponse),
      updateSessionContextInDatabase(sessionId, finalResponse.currentStep, finalResponse.usedAI, finalResponse.responseTime)
    ]);

    // NEW: Add performance metrics to response
    const perfMetrics = treatmentMachine.getPerformanceMetrics();
    (finalResponse as any).performanceMetrics = perfMetrics;
    console.log(`🚀 V3 PERFORMANCE: Cache hit rate: ${perfMetrics.cacheHitRate.toFixed(1)}%, Preloaded responses: ${perfMetrics.preloadedResponsesUsed}`);

    return NextResponse.json(finalResponse);

  } catch (error) {
    console.error('V3 Continue session error:', error);
    return NextResponse.json(
      { error: 'Failed to process V3 input', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Resume existing treatment session by loading from database
 */
async function handleResumeSession(sessionId: string, userId: string) {
  try {
    console.log('Treatment V3 API: Resuming session (explicit resume requested):', { sessionId, userId });
    
    // Load context from database via state machine
    const context = await treatmentMachine.getOrCreateContextAsync(sessionId, { userId });
    console.log('Treatment V3 API: Context loaded:', { 
      currentStep: context.currentStep, 
      currentPhase: context.currentPhase,
      hasUserResponses: Object.keys(context.userResponses).length > 0,
      workType: context.metadata?.workType,
      selectedMethod: context.metadata?.selectedMethod
    });
    
    // Get session data from database to check if it exists
    const supabase = createServerClient();
    const { data: session, error } = await supabase
      .from('treatment_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (error || !session) {
      // Session doesn't exist in database, treat as new session
      console.log('Treatment V3 API: No existing session found, starting new session');
      return await handleStartSession(sessionId, userId);
    }

    // Get conversation history from treatment_interactions
    const { data: interactions, error: interactionsError } = await supabase
      .from('treatment_interactions')
      .select('user_input, response_message, used_ai, response_time, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (interactionsError) {
      console.error('Treatment V3 API: Error loading interactions:', interactionsError);
    }

    // Build message history
    const messages = [];
    
    if (interactions && interactions.length > 0) {
      // Each interaction represents one exchange (user input + system response)
      // The first interaction should be the welcome message (no user_input)
      for (let i = 0; i < interactions.length; i++) {
        const interaction = interactions[i];
        
        // If this interaction has user input, add it first
        if (interaction.user_input && interaction.user_input.trim() !== 'start') {
          messages.push({
            id: `user-${i}`,
            content: interaction.user_input,
            isUser: true,
            timestamp: new Date(interaction.created_at)
          });
        }

        // Always add the system response
        messages.push({
          id: `system-${i}`,
          content: interaction.response_message,
          isUser: false,
          timestamp: new Date(interaction.created_at),
          responseTime: interaction.response_time,
          usedAI: interaction.used_ai
        });
      }
    }

    // Resume sessions should show conversation exactly as it was left
    // No additional messages are added to preserve the exact state

    return NextResponse.json({
      success: true,
      sessionId,
      currentStep: context.currentStep,
      currentPhase: context.currentPhase,
      messages: messages,
      isExistingSession: true,
      version: 'v3',
      session: {
        status: session.status,
        problemStatement: context.problemStatement,
        metadata: context.metadata,
        startTime: session.created_at,
        duration: session.duration_minutes
      },
      performance: {
        avgResponseTime: session.avg_response_time,
        scriptedResponses: session.scripted_responses,
        aiResponses: session.ai_responses
      }
    });

  } catch (error) {
    console.error('V3 Resume session error:', error);
    // Fallback to starting a new session if resume fails
    console.log('Treatment V3 API: Resume failed, falling back to new session');
    return await handleStartSession(sessionId, userId);
  }
}

// Note: The remaining functions (handleAIValidation, handleAIAssistance, handleGetStatus, handleUndo, 
// saveSessionToDatabase, saveInteractionToDatabase, updateSessionContextInDatabase, getPhaseForStep)
// are identical to V2 for now and will be updated as V3 features are implemented.
// For brevity, I'm including the essential ones and noting that others should be copied from V2.

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
        currentPhase: 'introduction', // Use actual phase instead of hardcoded
        currentStep: 'mind_shifting_explanation', // Use actual step instead of hardcoded
        userResponses: {},
        startTime: new Date(),
        lastActivity: new Date(),
        metadata: {}
      },
      currentStep: {
        id: 'mind_shifting_explanation', // Use actual step ID
        scriptedResponse: '',
        expectedResponseType: 'problem', // Correct response type for introduction
        validationRules: [],
        aiTriggers: []
      }
    };

    const aiResponse = await aiAssistance.processAssistanceRequest(assistanceRequest);
    
    // Log AI usage for monitoring
    console.log(`V3 AI assistance used for session ${sessionId}:`, {
      trigger: needsAI.trigger.condition,
      tokens: aiResponse.tokenCount,
      cost: aiResponse.cost
    });

    return aiResponse;
  } catch (error) {
    console.error('V3 AI assistance error:', error);
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
 * NEW: Handle AI validation request for problem/goal/question and negative experience validation
 */
async function handleAIValidation(
  userInput: string,
  validationType: 'problem_vs_goal' | 'problem_vs_question' | 'single_negative_experience' | 'goal_vs_problem' | 'goal_vs_question' | 'general_emotion' | 'incomplete_emotion_context',
  sessionId: string,
  userId: string
) {
  try {
    // Get current context from state machine
    const treatmentContext = treatmentMachine.getContextForUndo(sessionId);
    
    // Create a mock current step for validation (we only need the id for validation)
    const currentStep = {
      id: treatmentContext.currentStep,
      scriptedResponse: '',
      expectedResponseType: 'open' as const,
      validationRules: [],
      aiTriggers: []
    };
    
    const validationRequest: ValidationAssistanceRequest = {
      userInput,
      validationType,
      context: treatmentContext,
      currentStep: currentStep
    };
    
    const validationResult = await aiAssistance.processValidationAssistance(validationRequest);
    
    if (validationResult.needsCorrection) {
      // For general emotion validation, store the emotion for follow-up questions
      if (validationType === 'general_emotion') {
        const emotion = extractEmotionFromInput(userInput);
        treatmentContext.metadata.originalEmotion = emotion;
        console.log(`🔍 V3_VALIDATION_CORRECTION: Storing originalEmotion="${emotion}" for follow-up`);
      }
      
      // For incomplete emotion context validation, set flag for Yes/No buttons
      if (validationType === 'incomplete_emotion_context') {
        treatmentContext.metadata.showEmotionConfirmation = true;
        console.log(`🔍 V3_VALIDATION_CORRECTION: Setting showEmotionConfirmation=true for Yes/No buttons`);
      }
      
      // Save context with any metadata that was set during validation (like originalEmotion)
      await treatmentMachine.saveContextToDatabase(treatmentContext);
      console.log(`🔍 V3_VALIDATION_CORRECTION: Saved context with metadata:`, treatmentContext.metadata);
      
      // Return correction message and keep user on same step
      return {
        message: validationResult.correctionMessage || 'Please rephrase your response.',
        currentStep: treatmentContext.currentStep, // Stay on same step
        usedAI: true,
        aiCost: validationResult.cost,
        aiTokens: validationResult.tokenCount,
        needsCorrection: true,
        // Add flag to indicate Yes/No buttons should be shown
        showEmotionConfirmation: validationType === 'incomplete_emotion_context'
      };
    } else {
      // Validation passed - store any metadata that was set during validation
      console.log(`🔍 V3_VALIDATION_PASSED: Storing metadata from context:`, treatmentContext.metadata);
      
      // Special handling for incomplete_emotion_context validation
      if (validationType === 'incomplete_emotion_context') {
        if (userInput.toLowerCase() === 'yes' || userInput.toLowerCase() === 'y') {
          // User confirmed - construct full problem statement
          const emotion = treatmentContext.metadata.originalEmotion || 'this way';
          const context = treatmentContext.metadata.emotionContext || 'something';
          const fullProblemStatement = `I feel ${emotion} about ${context}`;
          
          console.log(`🔍 V3_EMOTION_CONFIRMATION: User confirmed, constructing full problem statement: "${fullProblemStatement}"`);
          treatmentContext.metadata.problemStatement = fullProblemStatement;
          treatmentContext.problemStatement = fullProblemStatement;
          
          // Clear the emotion tracking metadata since we've constructed the final statement
          delete treatmentContext.metadata.originalEmotion;
          delete treatmentContext.metadata.emotionContext;
          delete treatmentContext.metadata.showEmotionConfirmation;
        } else if (userInput.toLowerCase() === 'no' || userInput.toLowerCase() === 'n') {
          // User said no - ask them to restate the problem
          console.log(`🔍 V3_EMOTION_CONFIRMATION: User said no, asking for restatement`);
          // Clear emotion metadata and ask for fresh problem statement
          delete treatmentContext.metadata.originalEmotion;
          delete treatmentContext.metadata.emotionContext;
          delete treatmentContext.metadata.showEmotionConfirmation;
          
          // Return a message asking them to restate the problem
          return {
            message: "Please tell me what the problem is in a few words.",
            currentStep: treatmentContext.currentStep,
            usedAI: false,
            aiCost: 0,
            aiTokens: 0,
            needsCorrection: true
          };
        }
      }
      
      // Validation passed - continue with normal flow but store the corrected statement
      if (treatmentContext.currentStep === 'mind_shifting_explanation' && treatmentContext.metadata.selectedMethod) {
        // Store the corrected problem statement before continuing
        console.log(`🔍 V3_VALIDATION: Storing corrected problem statement: "${userInput}" for method: ${treatmentContext.metadata.selectedMethod}`);
        treatmentContext.metadata.problemStatement = userInput;
        treatmentContext.problemStatement = userInput;
      }
      
      // Re-process the input with AI validation bypassed (but other validation still applies)
      const result = await treatmentMachine.processUserInput(sessionId, userInput, { userId }, true);
      
      return {
        message: result.scriptedResponse || 'Please continue.',
        currentStep: result.nextStep || treatmentContext.currentStep,
        usedAI: true,
        aiCost: validationResult.cost,
        aiTokens: validationResult.tokenCount,
        needsCorrection: false,
        showEmotionConfirmation: false // Clear the flag when proceeding
      };
    }
  } catch (error) {
    console.error('V3 AI validation error:', error);
    // Fallback to allowing the input
    const result = await treatmentMachine.processUserInput(sessionId, userInput, { userId });
    return {
      message: result.scriptedResponse || 'Please continue.',
      currentStep: result.nextStep || treatmentMachine.getContextForUndo(sessionId).currentStep,
      usedAI: false,
      aiCost: 0,
      aiTokens: 0,
      needsCorrection: false
    };
  }
}

/**
 * Get session status and statistics
 */
async function handleGetStatus(sessionId: string, userId: string) {
  try {
    const supabase = createServerClient();
    
    // Get session data from database
    const { data: session, error } = await supabase
      .from('treatment_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (error || !session) {
      return NextResponse.json(
        { error: 'V3 Session not found' },
        { status: 404 }
      );
    }

    // Get AI usage stats
    const aiStats = aiAssistance.getUsageStats(sessionId);
    const systemStats = aiAssistance.getSystemStats();

    return NextResponse.json({
      success: true,
      version: 'v3',
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
    console.error('V3 Get status error:', error);
    return NextResponse.json(
      { error: 'Failed to get V3 session status' },
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
    console.log('Treatment V3 API: Saving session to database:', { sessionId, userId });
    
    const supabase = createServerClient();
    
    // Get user's profile to determine tenant_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      console.error('Treatment V3 API: Profile fetch error:', profileError);
      // Continue without tenant_id for super admins
    }
    
    console.log('Treatment V3 API: User profile:', profile);
    
    const sessionData = {
      session_id: sessionId,
      user_id: userId,
      tenant_id: profile?.tenant_id || null, // Allow null for super admins
      status: 'active',
      current_phase: 'introduction', // Use proper phase name from state machine
      current_step: 'mind_shifting_explanation', // Use proper step name from state machine
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      avg_response_time: Math.round(responseTime),
      scripted_responses: 1,
      ai_responses: 0,
      duration_minutes: 0,
      total_ai_cost: 0.00,
      total_ai_tokens: 0,
      // V3 specific metadata
      treatment_version: 'v3'
    };
    
    console.log('Treatment V3 API: Inserting session data:', sessionData);
    
    const { data, error } = await supabase
      .from('treatment_sessions')
      .insert(sessionData);

    if (error) {
      console.error('Treatment V3 API: Database insert error:', error);
      // Don't fail the request if database save fails - the session can still work
      console.warn('Treatment V3 API: Continuing without database save');
    } else {
      console.log('Treatment V3 API: Session saved successfully');
    }
  } catch (error) {
    console.error('V3 Database save error:', error);
    // Don't fail the request if database save fails
    console.warn('Treatment V3 API: Continuing without database save');
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
    const supabase = createServerClient();
    
    // PHASE 3 OPTIMIZATION: Critical interaction insert (blocking) + Non-critical stats update (non-blocking)
    // Insert interaction record (blocking - this data is critical)
    await supabase.from('treatment_interactions').insert({
      session_id: sessionId,
      user_input: userInput,
      response_message: response.message,
      response_time: response.responseTime,
      used_ai: response.usedAI,
      ai_cost: response.aiCost || 0,
      ai_tokens: response.aiTokens || 0,
      step_id: response.currentStep,
      phase_id: getPhaseForStep(response.currentStep || ''),
      created_at: new Date().toISOString(),
      // V3 specific metadata
      treatment_version: 'v3'
    });

    // Update stats (non-blocking - fire and forget for performance)
    // Using async IIFE to properly handle Supabase promise without blocking
    (async () => {
      try {
        await supabase.rpc('update_session_stats', {
          p_session_id: sessionId,
          p_used_ai: response.usedAI,
          p_response_time: response.responseTime
        });
      } catch (error) {
        console.error('V3 Background stats update failed:', error, {
          sessionId,
          step: response.currentStep,
          timestamp: new Date().toISOString()
        });
        // Stats are non-critical - log error but don't fail the request
        // Could implement retry queue here in the future
      }
    })();
  } catch (error) {
    console.error('V3 Database interaction save error:', error);
    // Don't fail the request if database save fails
  }
}

/**
 * Update session context in database
 */
async function updateSessionContextInDatabase(
  sessionId: string,
  currentStep: string,
  usedAI: boolean,
  responseTime: number
) {
  try {
    const supabase = createServerClient();
    
    // Get the context from the state machine
    const context = treatmentMachine.getContextForUndo(sessionId);
    
    // Check if session is completed
    const isCompleted = currentStep === 'session_complete' || 
                       currentStep === 'reality_session_complete' || 
                       currentStep?.includes('session_complete');
    
    // Prepare update data
    const updateData: any = {
      current_phase: context.currentPhase,
      current_step: currentStep,
      problem_statement: context.problemStatement,
      metadata: context.metadata,
      updated_at: new Date().toISOString(),
      treatment_version: 'v3'
    };
    
    // If session is completed, update status and completion timestamp
    if (isCompleted) {
      updateData.status = 'completed';
      updateData.completed_at = new Date().toISOString();
      console.log(`🎉 TREATMENT_COMPLETION_V3: Marking session ${sessionId} as completed`);
    }
    
    // PHASE 2 OPTIMIZATION: Build array of database operations to run in parallel
    const operations = [
      supabase
        .from('treatment_sessions')
        .update(updateData)
        .eq('session_id', sessionId)
    ];

    // Add progress update if we have a user response
    const userResponse = context.userResponses[context.currentStep];
    if (userResponse) {
      operations.push(
        supabase
          .from('treatment_progress')
          .upsert({
            session_id: sessionId,
            phase_id: context.currentPhase,
            step_id: context.currentStep,
            user_response: userResponse,
            completed_at: new Date().toISOString(),
            treatment_version: 'v3'
          }, {
            onConflict: 'session_id,phase_id,step_id'
          })
      );
    }

    // Execute all operations in parallel
    await Promise.all(operations);
  } catch (error) {
    console.error('V3 Database context update error:', error);
    // Don't fail the request if database update fails
  }
}

/**
 * Get the correct phase for a given step ID
 */
function getPhaseForStep(stepId: string): string {
  // Map steps to their correct phases based on V3 state machine definition
  // Note: This will need to be updated based on actual V3 phase/step structure
  const stepToPhaseMap: Record<string, string> = {
    // Introduction phase
    'mind_shifting_explanation': 'introduction',
    
    // Work type selection phase
    'work_type_selection': 'work_type_selection',
    'work_type_description': 'work_type_selection',
    'confirm_statement': 'work_type_selection',
    'route_to_method': 'work_type_selection',
    'method_selected': 'work_type_selection',
    
    // Discovery phase  
    'multiple_problems_selection': 'discovery',
    'restate_selected_problem': 'discovery',
    'analyze_response': 'discovery',
    'restate_identity_problem': 'discovery',
    'confirm_identity_problem': 'discovery',
    'restate_belief_problem': 'discovery',
    'confirm_belief_problem': 'discovery',
    
    // Method selection phase
    'choose_method': 'method_selection',
    
    // Problem shifting phase
    'problem_shifting_intro': 'problem_shifting',
    'body_sensation_check': 'problem_shifting',
    'what_needs_to_happen_step': 'problem_shifting',
    'feel_solution_state': 'problem_shifting',
    'feel_good_state': 'problem_shifting',
    'what_happens_step': 'problem_shifting',
    'check_if_still_problem': 'problem_shifting',
    
    // Blockage shifting phase
    'blockage_shifting_intro': 'blockage_shifting',
    'blockage_step_b': 'blockage_shifting',
    'blockage_step_c': 'blockage_shifting',
    'blockage_step_d': 'blockage_shifting',
    'blockage_step_e': 'blockage_shifting',
    'blockage_check_if_still_problem': 'blockage_shifting',
    
    // Identity shifting phase
    'identity_shifting_intro': 'identity_shifting',
    'identity_dissolve_step_a': 'identity_shifting',
    'identity_dissolve_step_b': 'identity_shifting',
    'identity_dissolve_step_c': 'identity_shifting',
    'identity_dissolve_step_d': 'identity_shifting',
    'identity_dissolve_step_e': 'identity_shifting',
    'identity_check': 'identity_shifting',
    'identity_problem_check': 'identity_shifting',
    
    // Reality shifting phase
    'reality_shifting_intro': 'reality_shifting',
    'reality_goal_capture': 'reality_shifting',
    'goal_deadline_check': 'reality_shifting',
    'goal_deadline_date': 'reality_shifting',
    'goal_confirmation': 'reality_shifting',
    'goal_certainty': 'reality_shifting',
    'reality_step_a2': 'reality_shifting',
    'reality_step_a3': 'reality_shifting',
    'reality_step_b': 'reality_shifting',
    'reality_why_not_possible': 'reality_shifting',
    'reality_feel_reason': 'reality_shifting',
    'reality_feel_reason_2': 'reality_shifting',
    'reality_feel_reason_3': 'reality_shifting',
    'reality_checking_questions': 'reality_shifting',
    'reality_doubt_reason': 'reality_shifting',
    'reality_cycle_b2': 'reality_shifting',
    'reality_cycle_b3': 'reality_shifting',
    'reality_cycle_b4': 'reality_shifting',
    'reality_certainty_check': 'reality_shifting',
    'reality_integration_intro': 'reality_shifting',
    'reality_integration_start': 'reality_shifting',
    'reality_integration_helped': 'reality_shifting',
    'reality_integration_awareness': 'reality_shifting',
    'reality_integration_action': 'reality_shifting',
    'reality_integration_action_more': 'reality_shifting',
    'reality_session_complete': 'reality_shifting',
    
    // Trauma shifting phase
    'trauma_shifting_intro': 'trauma_shifting',
    'trauma_dissolve_step_a': 'trauma_shifting',
    'trauma_dissolve_step_b': 'trauma_shifting',
    'trauma_dissolve_step_c': 'trauma_shifting',
    'trauma_dissolve_step_d': 'trauma_shifting',
    'trauma_dissolve_step_e': 'trauma_shifting',
    'trauma_identity_check': 'trauma_shifting',
    'trauma_experience_check': 'trauma_shifting',
    'trauma_dig_deeper': 'trauma_shifting',
    
    // Belief shifting phase
    'belief_shifting_intro': 'belief_shifting',
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
    
    // Digging deeper phase
    'digging_deeper_start': 'digging_deeper',
    'restate_problem_future': 'digging_deeper',
    'scenario_check': 'digging_deeper',
    'anything_else_check': 'digging_deeper',
    
    // Integration phase
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
    'session_complete': 'integration'
  };
  
  return stepToPhaseMap[stepId] || 'introduction'; // Default fallback
}

/**
 * Handle undo action - synchronize backend state with UI rollback
 */
async function handleUndo(sessionId: string, undoToStep: string, userId: string) {
  try {
    console.log('Treatment V3 API: Handling undo to step:', undoToStep, 'for session:', sessionId);
    
    // Validate required parameters
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error(`Invalid sessionId: ${sessionId}`);
    }
    if (!undoToStep || typeof undoToStep !== 'string') {
      throw new Error(`Invalid undoToStep: ${undoToStep}`);
    }
    if (!userId || typeof userId !== 'string') {
      throw new Error(`Invalid userId: ${userId}`);
    }
    
    // Get the current treatment context with safety check
    let context;
    try {
      context = treatmentMachine.getContextForUndo(sessionId);
      console.log('Treatment V3 API: Context retrieved successfully');
    } catch (contextError) {
      console.error('Treatment V3 API: Failed to get context:', contextError);
      throw new Error(`Failed to get V3 treatment context: ${contextError instanceof Error ? contextError.message : 'Unknown context error'}`);
    }
    
    if (!context) {
      throw new Error('V3 Treatment context is null or undefined');
    }
    
    console.log('V3 Current context before undo:', { 
      currentStep: context.currentStep, 
      currentPhase: context.currentPhase,
      userResponses: context.userResponses ? Object.keys(context.userResponses) : []
    });
    
    // Clear any user responses that were made AFTER the step we're undoing to
    // This prevents the state machine from using stale responses
    const stepsToKeep = new Set<string>();
    
    // Add all steps from the target phase up to and including the undoToStep
    let phaseSteps;
    try {
      phaseSteps = treatmentMachine.getPhaseSteps(context.currentPhase);
      console.log('Treatment V3 API: Phase steps retrieved for phase:', context.currentPhase);
    } catch (phaseError) {
      console.error('Treatment V3 API: Failed to get phase steps:', phaseError);
      // Clear all responses as a safe fallback
      await treatmentMachine.clearUserResponsesForUndo(sessionId, new Set());
      console.log('Treatment V3 API: Cleared all responses due to phase error');
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
          // Clear responses for steps after our target
          treatmentMachine.clearUserResponsesForUndo(sessionId, stepsToKeep);
          console.log('Treatment V3 API: Cleared user responses after target step');
        } else {
          // If not found in current phase, clear all responses to be safe
          treatmentMachine.clearUserResponsesForUndo(sessionId, new Set());
          console.log('Treatment V3 API: Cleared all user responses - undoing to different phase');
        }
      } catch (clearError) {
        console.error('Treatment V3 API: Error clearing user responses:', clearError);
        // Continue - this isn't critical for the undo operation
      }
    } else {
      console.log('Treatment V3 API: No phase steps found, clearing all responses');
      try {
        treatmentMachine.clearUserResponsesForUndo(sessionId, new Set());
      } catch (clearError) {
        console.error('Treatment V3 API: Error clearing all responses:', clearError);
        // Continue - this isn't critical for the undo operation
      }
    }
    
    // Determine the correct phase for the target step
    const targetPhase = getPhaseForStep(undoToStep);
    console.log('Treatment V3 API: Target step belongs to phase:', targetPhase);
    
    // Update context to the target step with correct phase
    try {
      treatmentMachine.updateContextForUndo(sessionId, {
        currentStep: undoToStep,
        currentPhase: targetPhase,
        lastActivity: new Date()
      });
      console.log('Treatment V3 API: Context updated successfully');
    } catch (updateError) {
      console.error('Treatment V3 API: Error updating context:', updateError);
      throw new Error(`Failed to update V3 context: ${updateError instanceof Error ? updateError.message : 'Unknown update error'}`);
    }
    
    // CRITICAL: Restore goal metadata from userResponses when undoing to goal-related steps
    // This fixes the issue where saying "no" to goal_confirmation clears metadata,
    // then undoing back requires that metadata to display the confirmation message
    const goalRelatedSteps = ['goal_deadline_check', 'goal_deadline_date', 'goal_confirmation', 'goal_certainty'];
    if (goalRelatedSteps.includes(undoToStep)) {
      try {
        const ctx = treatmentMachine.getContextForUndo(sessionId);
        // Restore currentGoal from reality_goal_capture or goal_description response
        if (ctx.userResponses['reality_goal_capture']) {
          ctx.metadata.currentGoal = ctx.userResponses['reality_goal_capture'];
          console.log(`🔄 UNDO_RESTORE: Restored currentGoal from reality_goal_capture: "${ctx.metadata.currentGoal}"`);
        } else if (ctx.userResponses['goal_description']) {
          ctx.metadata.currentGoal = ctx.userResponses['goal_description'];
          console.log(`🔄 UNDO_RESTORE: Restored currentGoal from goal_description: "${ctx.metadata.currentGoal}"`);
        }
        
        // Restore goalWithDeadline if there was a deadline
        const hasDeadline = ctx.userResponses['goal_deadline_check']?.toLowerCase().includes('yes');
        const deadline = ctx.userResponses['goal_deadline_date'];
        if (hasDeadline && deadline && ctx.metadata.currentGoal) {
          ctx.metadata.goalWithDeadline = `${ctx.metadata.currentGoal} by ${deadline}`;
          console.log(`🔄 UNDO_RESTORE: Restored goalWithDeadline: "${ctx.metadata.goalWithDeadline}"`);
        }
        
        // Save the restored context
        await treatmentMachine.saveContextToDatabase(ctx);
        console.log('🔄 UNDO_RESTORE: Goal metadata restored and saved successfully');
      } catch (restoreError) {
        console.error('Treatment V3 API: Error restoring goal metadata:', restoreError);
        // Continue - this isn't critical enough to fail the undo
      }
    }
    
    // Get updated context for logging
    let updatedContext;
    try {
      updatedContext = treatmentMachine.getContextForUndo(sessionId);
      console.log('V3 Context after undo:', { 
        currentStep: updatedContext.currentStep, 
        currentPhase: updatedContext.currentPhase,
        userResponses: updatedContext.userResponses ? Object.keys(updatedContext.userResponses) : []
      });
    } catch (contextError) {
      console.error('Treatment V3 API: Error getting updated context:', contextError);
      // Still try to return success since the main operation may have worked
      updatedContext = { userResponses: {} };
    }
    
    return NextResponse.json({
      success: true,
      message: 'V3 Undo successful',
      currentStep: undoToStep,
      version: 'v3',
      clearedResponses: updatedContext.userResponses ? Object.keys(updatedContext.userResponses).length : 0
    });
    
  } catch (error) {
    console.error('Treatment V3 API: Undo error:', error);
    return NextResponse.json(
      { error: 'V3 Undo failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 