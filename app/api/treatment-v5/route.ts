import { NextRequest, NextResponse } from 'next/server';
import { TreatmentStateMachine } from '@/lib/v5/treatment-state-machine';
import { ProcessingResult } from '@/lib/v5/types';
import { AIAssistanceManager, AIAssistanceRequest, AIModelOverrides, ValidationAssistanceRequest } from '@/lib/v2/ai-assistance';
import { createServerClient } from '@/lib/database-server';
import { getUserOpenRouterKey } from '@/lib/server/labs-openrouter-key';
import { ValidationHelpers } from '@/lib/v5/validation-helpers';

// Singleton instances for performance
const treatmentMachine = new TreatmentStateMachine();
const aiAssistance = new AIAssistanceManager();
const DEADLINE_AI_TIMEOUT_MS = 1800;

type DeadlineDetectionAIResult = {
  hasDeadline: boolean;
  deadlineText?: string | null;
  normalizedGoal?: string | null;
  confidence?: number;
};

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

function safeParseDeadlineResult(raw: string): DeadlineDetectionAIResult | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;

  const directJsonStart = trimmed.indexOf('{');
  const directJsonEnd = trimmed.lastIndexOf('}');
  if (directJsonStart === -1 || directJsonEnd === -1 || directJsonEnd <= directJsonStart) {
    return null;
  }

  const candidate = trimmed.slice(directJsonStart, directJsonEnd + 1);
  try {
    const parsed = JSON.parse(candidate);
    if (typeof parsed?.hasDeadline !== 'boolean') return null;
    return {
      hasDeadline: parsed.hasDeadline,
      deadlineText: typeof parsed.deadlineText === 'string' ? parsed.deadlineText : null,
      normalizedGoal: typeof parsed.normalizedGoal === 'string' ? parsed.normalizedGoal : null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    };
  } catch {
    return null;
  }
}

function normalizeGoalDeadlineInput(rawInput: string): string {
  let input = (rawInput || '').trim();
  if (!input) return input;

  // Normalize compact "1by"/"2by" style prefixes into a proper deadline preposition.
  input = input.replace(/\b\d+\s*by\b/gi, 'by');

  const monthMap: Record<string, string> = {
    jan: 'january',
    feb: 'february',
    mar: 'march',
    apr: 'april',
    may: 'may',
    jun: 'june',
    jul: 'july',
    aug: 'august',
    sep: 'september',
    sept: 'september',
    oct: 'october',
    nov: 'november',
    dec: 'december',
  };

  // Expand month abbreviations to match local deadline detector patterns.
  input = input.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/gi, (abbr) => {
    const key = abbr.toLowerCase();
    return monthMap[key] || abbr;
  });

  return input.replace(/\s+/g, ' ').trim();
}

async function getDeadlineDetectionOverrides(
  userId: string,
  aiModelOverrides?: AIModelOverrides
): Promise<AIModelOverrides | null> {
  // Reuse explicit labs override when available.
  if (aiModelOverrides?.apiKey) {
    return aiModelOverrides;
  }

  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!authError && user && user.id === userId) {
      const openRouterKey = await getUserOpenRouterKey(supabase, user.id);
      if (openRouterKey) {
        return {
          apiKey: openRouterKey,
          baseURL: 'https://openrouter.ai/api/v1',
          model: 'openai/gpt-4o-mini',
          defaultHeaders: {
            'HTTP-Referer': 'https://mind-shift.click',
            'X-Title': 'MindShifting V5 Deadline Detection',
          },
        };
      }
    }

    // Fallback: use shared server key if configured.
    // This keeps deadline detection working even when per-user key/auth is unavailable.
    {
      const sharedApiKey = process.env.OPENAI_API_KEY;
      if (!sharedApiKey) {
        return null;
      }

      const isOpenRouterKey = sharedApiKey.startsWith('sk-or-');
      return {
        apiKey: sharedApiKey,
        baseURL: isOpenRouterKey ? 'https://openrouter.ai/api/v1' : undefined,
        model: isOpenRouterKey ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',
        defaultHeaders: isOpenRouterKey
          ? {
              'HTTP-Referer': 'https://mind-shift.click',
              'X-Title': 'MindShifting V5 Deadline Detection',
            }
          : undefined,
      };
    }
  } catch (error) {
    console.warn('Treatment V5 API: Unable to resolve OpenRouter override for deadline detection:', error);
    return null;
  }
}

async function detectDeadlineWithOpenRouter(
  userGoalInput: string,
  modelOverrides: AIModelOverrides
): Promise<DeadlineDetectionAIResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEADLINE_AI_TIMEOUT_MS);

  try {
    const baseURL = modelOverrides.baseURL || 'https://api.openai.com/v1';
    const payload = {
      model: modelOverrides.model || 'openai/gpt-4o-mini',
      temperature: 0,
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content: [
            'You detect deadlines in user goals.',
            'Return ONLY JSON with keys: hasDeadline (boolean), deadlineText (string|null), normalizedGoal (string|null), confidence (0..1).',
            'Treat abbreviated months (jan,feb,mar,apr,may,jun,jul,aug,sep,sept,oct,nov,dec) as valid month deadlines.',
            'Handle compact/attached variants like "1BYNOV2026" by interpreting intended spacing.',
            'Set hasDeadline=false unless there is an explicit time/date reference.'
          ].join(' ')
        },
        {
          role: 'user',
          content: `Goal: ${userGoalInput}`
        }
      ]
    };

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${modelOverrides.apiKey}`,
        'Content-Type': 'application/json',
        ...modelOverrides.defaultHeaders,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn('Treatment V5 API: Deadline AI request failed', {
        status: response.status,
        bodyPreview: errorBody.slice(0, 300)
      });
      return null;
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return null;
    }

    return safeParseDeadlineResult(content);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Treatment V5 API: POST request received');

    let requestBody;
    try {
      requestBody = await request.json();
      console.log('Treatment V5 API: Request body parsed:', requestBody);
    } catch (parseError) {
      console.error('Treatment V5 API: JSON parsing error:', parseError);
      return NextResponse.json({
        error: 'Invalid JSON in request body',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
        location: 'request.json()'
      }, { status: 400 });
    }

    const { sessionId, userInput, userId, action, undoToStep, labsModel } = requestBody;
    console.log('Treatment V5 API: Extracted parameters:', { sessionId, userInput, userId, action, undoToStep, labsModel });

    // Validate required fields
    if (!sessionId || !userId) {
      console.log('Treatment V5 API: Missing required fields');
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
        console.error('Treatment V5 API: Authentication error:', authError);
        // Continue execution for development/testing but log the issue
        console.warn('Treatment V5 API: Continuing without strict auth verification for compatibility');
      }

      if (user && user.id !== userId) {
        console.error('Treatment V5 API: User ID mismatch:', { requestUserId: userId, authUserId: user.id });
        return NextResponse.json(
          { error: 'User ID mismatch' },
          { status: 403 }
        );
      }

      // If we have a user, great! If not, we'll still allow the request for now
      // This provides compatibility while maintaining security when auth is working
      console.log('Treatment V5 API: Authentication check completed', {
        hasUser: !!user,
        userMatches: user?.id === userId,
        requestUserId: userId
      });

    } catch (authCheckError) {
      console.error('Treatment V5 API: Auth check failed, continuing anyway:', authCheckError);
      // Continue execution - this handles cases where server-side auth isn't working
    }

    let aiModelOverrides: AIModelOverrides | undefined;
    if (labsModel) {
      const supabase = createServerClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (user.id !== userId) {
        return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
      }

      const openRouterKey = await getUserOpenRouterKey(supabase, user.id);
      if (!openRouterKey) {
        return NextResponse.json(
          { error: 'OpenRouter API key required. Add it in Settings > API Keys.' },
          { status: 400 }
        );
      }

      aiModelOverrides = {
        apiKey: openRouterKey,
        baseURL: 'https://openrouter.ai/api/v1',
        model: labsModel,
        defaultHeaders: {
          'HTTP-Referer': 'https://mind-shift.click',
          'X-Title': 'MindShifting Labs V5',
        },
      };
    }

    console.log('Treatment V5 API: Processing action:', action);
    switch (action) {
      case 'start':
        return await handleStartSession(sessionId, userId);

      case 'continue':
        // V4: Allow empty userInput for auto-advance steps (e.g., expectedResponseType: 'auto')
        // The state machine will handle step-specific validation based on the step's expectedResponseType
        return await handleContinueSession(sessionId, userInput || '', userId, aiModelOverrides);

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
    console.error('Treatment V5 API error:', error);
    console.error('Treatment V5 API error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Treatment V5 API error type:', typeof error);
    console.error('Treatment V5 API error constructor:', error?.constructor?.name);
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
    console.log('Treatment V5 API: Starting session:', { sessionId, userId });

    // IMPORTANT: Clear any existing context for fresh start
    await treatmentMachine.clearContext(sessionId);

    // Process initial welcome step with state machine
    const result = await treatmentMachine.processUserInput(sessionId, 'start', { userId });
    console.log('Treatment V5 API: State machine result:', result);

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
        version: 'v4'
      }
    };

    // Save the initial welcome interaction to database
    await saveInteractionToDatabase(sessionId, 'start', finalResponse);

    // NEW: Add performance metrics to response
    const perfMetrics = treatmentMachine.getPerformanceMetrics();
    (finalResponse as any).performanceMetrics = perfMetrics;
    console.log(`🚀 V4 PERFORMANCE: Cache hit rate: ${perfMetrics.cacheHitRate.toFixed(1)}%, Preloaded responses: ${perfMetrics.preloadedResponsesUsed}`);

    return NextResponse.json(finalResponse);
  } catch (error) {
    console.error('V4 Start session error:', error);
    return NextResponse.json(
      { error: 'Failed to start V4 session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Continue existing treatment session with user input
 * Updated: 2025-01-09 - Fixed routing signals for goal/negative experience
 */
async function handleContinueSession(
  sessionId: string,
  userInput: string,
  userId: string,
  aiModelOverrides?: AIModelOverrides
) {
  const startTime = performance.now();

  try {
    console.log('Treatment V5 API [v4-routing-fix]: Continuing session:', { sessionId, userId, userInput: userInput.substring(0, 50) + '...' });

    // Optional micro-AI assist for deadline extraction in goal capture.
    // Keep this cheap and non-blocking: only when local parser does not find a deadline.
    const currentContext = treatmentMachine.getContextForUndo(sessionId);
    const currentStep = currentContext?.currentStep;
    const isGoalCaptureStep = currentStep === 'goal_description' || currentStep === 'reality_goal_capture';
    if (isGoalCaptureStep && userInput.trim()) {
      // Fast local normalization handles compact tokens like "1BY NOV 2026".
      const normalizedInput = normalizeGoalDeadlineInput(userInput);
      const localDeadline = ValidationHelpers.detectDeadlineInGoal(normalizedInput);
      if (localDeadline.hasDeadline && normalizedInput !== userInput) {
        userInput = normalizedInput;
      }

      if (!localDeadline.hasDeadline) {
        const deadlineOverrides = await getDeadlineDetectionOverrides(userId, aiModelOverrides);
        if (deadlineOverrides) {
          const aiDeadline = await detectDeadlineWithOpenRouter(userInput, deadlineOverrides);
          const aiConfidence = aiDeadline?.confidence ?? 0;
          if (
            aiDeadline?.hasDeadline &&
            aiConfidence >= 0.8 &&
            aiDeadline.normalizedGoal &&
            aiDeadline.normalizedGoal.trim().length > 0
          ) {
            console.log('Treatment V5 API: Deadline AI normalized goal input', {
              currentStep,
              originalInput: userInput,
              normalizedGoal: aiDeadline.normalizedGoal,
              deadlineText: aiDeadline.deadlineText,
              confidence: aiConfidence
            });
            userInput = aiDeadline.normalizedGoal.trim();
          }
        }
      }
    }

    console.log('Treatment V5 API: About to call processUserInput...');
    // Process with state machine first (95% of cases)
    let result;
    try {
      result = await treatmentMachine.processUserInput(sessionId, userInput, { userId });
      console.log('Treatment V5 API: State machine continue result:', result);
    } catch (stateMachineError) {
      console.error('Treatment V5 API: State machine error:', stateMachineError);
      return NextResponse.json({
        error: 'V4 State machine processing failed',
        details: stateMachineError instanceof Error ? stateMachineError.message : 'Unknown state machine error',
        stack: stateMachineError instanceof Error ? stateMachineError.stack : 'No stack trace',
        location: 'processUserInput'
      }, { status: 500 });
    }

    console.log('Treatment V5 API: Creating final response object...');
    let finalResponse: any = {
      success: true,
      sessionId,
      responseTime: 0,
      usedAI: false,
      version: 'v4'
    };

    console.log('Treatment V5 API: Checking if can continue...', { canContinue: result.canContinue, hasScriptedResponse: !!result.scriptedResponse });
    if (result.canContinue && result.scriptedResponse) {
      console.log('Treatment V5 API: Processing successful result...');

      // Handle special transition signals
      if (result.scriptedResponse === 'TRANSITION_TO_DIG_DEEPER') {
        console.log('Treatment V5 API: Detected transition signal, processing next step immediately');
        // Process the next step immediately without showing the transition message
        const nextResult = await treatmentMachine.processUserInput(sessionId, userInput || '', { userId });
        if (nextResult.canContinue && nextResult.scriptedResponse) {
          result = nextResult; // Use the next step's result
          console.log('Treatment V5 API: Using next step result:', result);
        }
      }

      // V4: Handle auto-advance steps by chaining to next step and combining messages
      // This creates seamless two-part messages for voice playback
      if (result.expectedResponseType === 'auto' && result.scriptedResponse) {
        console.log('Treatment V5 API: Auto-advance step detected, chaining to next step immediately');
        console.log('Treatment V5 API: First step:', result.nextStep, 'First message:', result.scriptedResponse.substring(0, 80) + '...');
        const firstMessage = result.scriptedResponse;
        
        // Process the next step with empty input (auto-advance)
        const nextResult = await treatmentMachine.processUserInput(sessionId, '', { userId });
        console.log('Treatment V5 API: Auto-advance chain result:', {
          canContinue: nextResult.canContinue,
          hasScriptedResponse: !!nextResult.scriptedResponse,
          nextStep: nextResult.nextStep,
          scriptedResponsePreview: nextResult.scriptedResponse?.substring(0, 80) + '...'
        });
        
        if (nextResult.canContinue && nextResult.scriptedResponse) {
          // Combine both messages with double newline for readability
          result.scriptedResponse = `${firstMessage}\n\n${nextResult.scriptedResponse}`;
          result.nextStep = nextResult.nextStep; // Use the second step's ID
          result.expectedResponseType = nextResult.expectedResponseType; // Use the second step's response type
          result.needsLinguisticProcessing = nextResult.needsLinguisticProcessing; // V4 FIX: Use second step's flag to prevent AI processing combined messages
          console.log('Treatment V5 API: ✅ Combined auto-advance messages:', {
            firstMessage: firstMessage.substring(0, 50) + '...',
            secondMessage: nextResult.scriptedResponse.substring(0, 50) + '...',
            finalStep: result.nextStep,
            finalResponseType: result.expectedResponseType,
            needsLinguisticProcessing: result.needsLinguisticProcessing
          });
        } else {
          console.error('Treatment V5 API: ❌ Auto-advance chain FAILED!', {
            canContinue: nextResult.canContinue,
            hasScriptedResponse: !!nextResult.scriptedResponse,
            reason: nextResult.reason,
            nextStep: nextResult.nextStep
          });
        }
      }

      let finalMessage = result.scriptedResponse;
      let usedAI = false;
      let aiCost = 0;
      let aiTokens = 0;

      // V4 Note: Linguistic processing will be handled by V4 state machine internally
      // For now, we'll use the V2 AI assistance system for compatibility
      if (result.needsLinguisticProcessing) {
        console.log('Treatment V5 API: V4 linguistic processing needed - using V2 compatibility layer');

        // For intro steps, use the problem statement from context, not the current user input
        // PARITY: Include v4 step IDs (*_intro_dynamic, *_intro_static) so correct source text is used
        let textToProcess = userInput;
        const introStepIds = [
          'problem_shifting_intro', 'problem_shifting_intro_dynamic', 'problem_shifting_intro_static',
          'blockage_shifting_intro', 'blockage_shifting_intro_dynamic', 'blockage_shifting_intro_static',
          'identity_shifting_intro', 'identity_shifting_intro_dynamic', 'identity_shifting_intro_static',
          'trauma_shifting_intro', 'trauma_shifting_intro_dynamic', 'trauma_shifting_intro_static',
          'belief_shifting_intro', 'belief_shifting_intro_dynamic', 'belief_shifting_intro_static'
        ];
        if (introStepIds.includes(result.nextStep || '')) {
          // Get the stored problem statement that the intro step will use
          const treatmentContext = treatmentMachine.getContextForUndo(sessionId);
          // PRIORITIZE: Use new digging problem if available, then fall back to original problem
          textToProcess = treatmentContext?.metadata?.currentDiggingProblem ||
            treatmentContext?.metadata?.newDiggingProblem ||
            treatmentContext?.problemStatement ||
            treatmentContext?.userResponses?.['restate_selected_problem'] ||
            treatmentContext?.userResponses?.['mind_shifting_explanation_dynamic'] ||
            userInput;
          console.log('Treatment V5 API: Using problem statement for intro step processing:', textToProcess);
        }

        // Check if we should skip AI processing for digging deeper intro steps
        const treatmentContext = treatmentMachine.getContextForUndo(sessionId);
        const isDiggingContext = treatmentContext?.metadata?.currentDiggingProblem || treatmentContext?.metadata?.newDiggingProblem;
        const isIntroStep = [
          'problem_shifting_intro', 'problem_shifting_intro_dynamic', 'problem_shifting_intro_static',
          'identity_shifting_intro', 'identity_shifting_intro_dynamic', 'identity_shifting_intro_static',
          'belief_shifting_intro', 'belief_shifting_intro_dynamic', 'belief_shifting_intro_static'
        ].includes(result.nextStep || '');
        const shouldSkipAI = isDiggingContext && isIntroStep;

        if (shouldSkipAI) {
          console.log('Treatment V5 API: Skipping AI processing for digging deeper intro step - using short scripted response');
          finalMessage = result.scriptedResponse; // Use the short scripted response directly
        } else {
          const linguisticResult = await aiAssistance.processLinguisticInterpretation(
            result.scriptedResponse || '',
            textToProcess,
            result.nextStep || 'unknown',
            sessionId,
            aiModelOverrides
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
              console.log('Treatment V5 API: Replaced problem statement in intro step with AI-processed version');
            } else {
              // For other steps (like body_sensation_check), use the full AI response
              finalMessage = linguisticResult.improvedResponse;
            }
            usedAI = true;
            aiCost = linguisticResult.cost;
            aiTokens = linguisticResult.tokens;
            console.log('Treatment V5 API: Linguistic processing successful');
          } else {
            console.log('Treatment V5 API: Linguistic processing failed, using scripted response');
          }
        }
      }

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      console.log('Treatment V5 API: Final response construction', {
        nextStep: result.nextStep,
        currentStepBefore: treatmentMachine.getContextForUndo(sessionId)?.currentStep,
        message: finalMessage
      });

      finalResponse = {
        ...finalResponse,
        success: true,
        message: finalMessage,
        currentStep: result.nextStep,
        responseTime: Math.round(responseTime),
        canContinue: result.canContinue,
        usedAI,
        expectedResponseType: result.expectedResponseType, // Pass this to frontend for auto-advance
        aiCost,
        aiTokens
      };

    } else if (result.needsAIAssistance) {
      // AI assistance needed (only 5% of cases)
      const aiResponse = await handleAIAssistance(result.needsAIAssistance, sessionId, userId, aiModelOverrides);
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      finalResponse = {
        ...finalResponse,
        message: aiResponse.message,
        currentStep: 'mind_shifting_explanation_dynamic', // AI assistance keeps user on same step for clarification
        responseTime: Math.round(responseTime),
        usedAI: true,
        aiCost: aiResponse.cost,
        aiTokens: aiResponse.tokenCount
      };

    } else if (result.reason && result.reason.startsWith('AI_VALIDATION_NEEDED:')) {
      // NEW: Handle AI validation requests
      const validationType = result.reason.split(':')[1] as 'problem_vs_goal' | 'problem_vs_question' | 'single_negative_experience' | 'goal_vs_problem' | 'goal_vs_question' | 'general_emotion' | 'incomplete_emotion_context';
      const validationResponse = await handleAIValidation(userInput, validationType, sessionId, userId, aiModelOverrides);
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

    // Fire-and-forget: DB writes don't block the API response
    void Promise.all([
      saveInteractionToDatabase(sessionId, userInput, finalResponse),
      updateSessionContextInDatabase(sessionId, finalResponse.currentStep, finalResponse.usedAI, finalResponse.responseTime)
    ]).catch(err => console.error('Background DB save failed:', err));

    // NEW: Add performance metrics to response
    const perfMetrics = treatmentMachine.getPerformanceMetrics();
    (finalResponse as any).performanceMetrics = perfMetrics;
    console.log(`🚀 V4 PERFORMANCE: Cache hit rate: ${perfMetrics.cacheHitRate.toFixed(1)}%, Preloaded responses: ${perfMetrics.preloadedResponsesUsed}`);

    return NextResponse.json(finalResponse);

  } catch (error) {
    console.error('V4 Continue session error:', error);
    return NextResponse.json(
      { error: 'Failed to process V4 input', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Resume existing treatment session by loading from database
 */
async function handleResumeSession(sessionId: string, userId: string) {
  try {
    console.log('Treatment V5 API: Resuming session (explicit resume requested):', { sessionId, userId });

    // Load context from database via state machine
    const context = await treatmentMachine.getOrCreateContextAsync(sessionId, { userId });
    console.log('Treatment V5 API: Context loaded:', {
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
      console.log('Treatment V5 API: No existing session found, starting new session');
      return await handleStartSession(sessionId, userId);
    }

    // Get conversation history from treatment_interactions
    const { data: interactions, error: interactionsError } = await supabase
      .from('treatment_interactions')
      .select('user_input, response_message, used_ai, response_time, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (interactionsError) {
      console.error('Treatment V5 API: Error loading interactions:', interactionsError);
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
      version: 'v4',
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
    console.error('V4 Resume session error:', error);
    // Fallback to starting a new session if resume fails
    console.log('Treatment V5 API: Resume failed, falling back to new session');
    return await handleStartSession(sessionId, userId);
  }
}

// Note: The remaining functions (handleAIValidation, handleAIAssistance, handleGetStatus, handleUndo, 
// saveSessionToDatabase, saveInteractionToDatabase, updateSessionContextInDatabase, getPhaseForStep)
// are identical to V2 for now and will be updated as V4 features are implemented.
// For brevity, I'm including the essential ones and noting that others should be copied from V2.

/**
 * Handle AI assistance when triggered (only 5% of interactions)
 */
async function handleAIAssistance(
  needsAI: { trigger: any; context: string; userInput: string },
  sessionId: string,
  userId: string,
  aiModelOverrides?: AIModelOverrides
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
        currentStep: 'mind_shifting_explanation_dynamic', // Use actual step instead of hardcoded
        userResponses: {},
        startTime: new Date(),
        lastActivity: new Date(),
        metadata: {}
      },
      currentStep: {
        id: 'mind_shifting_explanation_dynamic', // Use actual step ID
        scriptedResponse: '',
        expectedResponseType: 'problem', // Correct response type for introduction
        validationRules: [],
        aiTriggers: []
      }
    };

    const aiResponse = await aiAssistance.processAssistanceRequest(assistanceRequest, aiModelOverrides);

    // Log AI usage for monitoring
    console.log(`V4 AI assistance used for session ${sessionId}:`, {
      trigger: needsAI.trigger.condition,
      tokens: aiResponse.tokenCount,
      cost: aiResponse.cost
    });

    return aiResponse;
  } catch (error) {
    console.error('V4 AI assistance error:', error);
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
  userId: string,
  aiModelOverrides?: AIModelOverrides
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

    const validationResult = await aiAssistance.processValidationAssistance(validationRequest, aiModelOverrides);

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
      if (treatmentContext.currentStep === 'mind_shifting_explanation_dynamic' && treatmentContext.metadata.selectedMethod) {
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
    console.error('V4 AI validation error:', error);
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
        { error: 'V4 Session not found' },
        { status: 404 }
      );
    }

    // Get AI usage stats
    const aiStats = aiAssistance.getUsageStats(sessionId);
    const systemStats = aiAssistance.getSystemStats();

    return NextResponse.json({
      success: true,
      version: 'v4',
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
    console.error('V4 Get status error:', error);
    return NextResponse.json(
      { error: 'Failed to get V4 session status' },
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
    console.log('Treatment V5 API: Saving session to database:', { sessionId, userId });

    const supabase = createServerClient();

    // Get user's profile to determine tenant_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Treatment V5 API: Profile fetch error:', profileError);
      // Continue without tenant_id for super admins
    }

    console.log('Treatment V5 API: User profile:', profile);

    const sessionData = {
      session_id: sessionId,
      user_id: userId,
      tenant_id: profile?.tenant_id || null, // Allow null for super admins
      status: 'active',
      current_phase: 'introduction', // Use proper phase name from state machine
      current_step: result.nextStep || 'mind_shifting_explanation_dynamic', // Use proper step name from state machine
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      avg_response_time: Math.round(responseTime),
      scripted_responses: 1,
      ai_responses: 0,
      duration_minutes: 0,
      total_ai_cost: 0.00,
      total_ai_tokens: 0,
      // Metrics tracking fields
      session_type: 'problem_shifting', // Default, will be updated based on method selection
      method_used: 'mind_shifting',
      problems_count: 0,
      goals_count: 0,
      experiences_count: 0
    };

    console.log('Treatment V5 API: Inserting session data:', sessionData);

    const { data, error } = await supabase
      .from('treatment_sessions')
      .upsert(sessionData, { onConflict: 'session_id' });

    if (error) {
      console.error('Treatment V5 API: Database insert error:', error);
      // Don't fail the request if database save fails - the session can still work
      console.warn('Treatment V5 API: Continuing without database save');
    } else {
      console.log('Treatment V5 API: Session saved successfully');
    }
  } catch (error) {
    console.error('V4 Database save error:', error);
    // Don't fail the request if database save fails
    console.warn('Treatment V5 API: Continuing without database save');
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
      created_at: new Date().toISOString()
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
        console.error('V4 Background stats update failed:', error, {
          sessionId,
          step: response.currentStep,
          timestamp: new Date().toISOString()
        });
        // Stats are non-critical - log error but don't fail the request
        // Could implement retry queue here in the future
      }
    })();
  } catch (error) {
    console.error('V4 Database interaction save error:', error);
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
      treatment_version: 'v4'
    };

    // If session is completed, update status and completion timestamp
    if (isCompleted) {
      updateData.status = 'completed';
      updateData.completed_at = new Date().toISOString();
      
      // Increment the appropriate counter based on session type/method
      const selectedMethod = context.metadata?.selectedMethod || 'mind_shifting';
      const sessionType = getSessionTypeFromMethod(selectedMethod);
      
      // Update session type and method used
      updateData.session_type = sessionType;
      updateData.method_used = selectedMethod;
      
      // Increment the appropriate counter
      switch (sessionType) {
        case 'goal_optimization':
          updateData.goals_count = 1;
          break;
        case 'experience_clearing':
          updateData.experiences_count = 1;
          break;
        case 'problem_shifting':
        default:
          updateData.problems_count = 1;
          break;
      }
      
      console.log(`🎉 TREATMENT_COMPLETION_V4: Marking session ${sessionId} as completed (type: ${sessionType}, method: ${selectedMethod})`);
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
            treatment_version: 'v4'
          }, {
            onConflict: 'session_id,phase_id,step_id'
          })
      );
    }

    // Execute all operations in parallel
    await Promise.all(operations);
  } catch (error) {
    console.error('V4 Database context update error:', error);
    // Don't fail the request if database update fails
  }
}

/**
 * Get the correct phase for a given step ID
 */
function getPhaseForStep(stepId: string): string {
  // Map steps to their correct phases based on V4 state machine definition
  // Note: This will need to be updated based on actual V4 phase/step structure
  const stepToPhaseMap: Record<string, string> = {
    // Introduction phase
    'mind_shifting_explanation_dynamic': 'introduction',

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
    'problem_shifting_intro_static': 'problem_shifting',
    'problem_shifting_intro_dynamic': 'problem_shifting',
    'body_sensation_check': 'problem_shifting',
    'what_needs_to_happen_step': 'problem_shifting',
    'feel_solution_state': 'problem_shifting',
    'feel_good_state': 'problem_shifting',
    'what_happens_step': 'problem_shifting',
    'check_if_still_problem': 'problem_shifting',

    // Blockage shifting phase
    'blockage_shifting_intro': 'blockage_shifting',
    'blockage_shifting_intro_static': 'blockage_shifting',
    'blockage_shifting_intro_dynamic': 'blockage_shifting',
    'blockage_step_b': 'blockage_shifting',
    'blockage_step_c': 'blockage_shifting',
    'blockage_step_d': 'blockage_shifting',
    'blockage_step_e': 'blockage_shifting',
    'blockage_check_if_still_problem': 'blockage_shifting',
    'blockage_integration_awareness_1': 'blockage_shifting',
    'blockage_integration_awareness_2': 'blockage_shifting',
    'blockage_integration_awareness_3': 'blockage_shifting',
    'blockage_integration_awareness_4': 'blockage_shifting',
    'blockage_integration_awareness_5': 'blockage_shifting',
    'blockage_integration_action_1': 'blockage_shifting',
    'blockage_integration_action_2': 'blockage_shifting',
    'blockage_integration_action_3': 'blockage_shifting',

    // Identity shifting phase
    'identity_shifting_intro': 'identity_shifting',
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
    'identity_problem_check': 'identity_shifting',
    'identity_future_projection': 'identity_shifting',
    'identity_future_step_b': 'identity_shifting',
    'identity_future_step_c': 'identity_shifting',
    'identity_future_step_d': 'identity_shifting',
    'identity_future_step_e': 'identity_shifting',
    'identity_future_step_f': 'identity_shifting',
    'identity_session_complete': 'identity_shifting',

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
    'trauma_integration_awareness_1': 'trauma_shifting',
    'trauma_integration_awareness_2': 'trauma_shifting',
    'trauma_integration_awareness_3': 'trauma_shifting',
    'trauma_integration_awareness_4': 'trauma_shifting',
    'trauma_integration_awareness_5': 'trauma_shifting',
    'trauma_integration_action_1': 'trauma_shifting',
    'trauma_integration_action_2': 'trauma_shifting',
    'trauma_integration_action_3': 'trauma_shifting',

    // Belief shifting phase
    'belief_shifting_intro': 'belief_shifting',
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
    'belief_integration_awareness_1': 'belief_shifting',
    'belief_integration_awareness_2': 'belief_shifting',
    'belief_integration_awareness_3': 'belief_shifting',
    'belief_integration_awareness_4': 'belief_shifting',
    'belief_integration_awareness_5': 'belief_shifting',
    'belief_integration_action_1': 'belief_shifting',
    'belief_integration_action_2': 'belief_shifting',
    'belief_integration_action_3': 'belief_shifting',

    // Digging deeper phase
    'digging_deeper_start': 'digging_deeper',
    'future_problem_check': 'digging_deeper',
    'restate_problem_future': 'digging_deeper',
    'digging_method_selection': 'digging_deeper',
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

  const mappedPhase = stepToPhaseMap[stepId];
  if (mappedPhase) {
    return mappedPhase;
  }

  // Fallback: discover phase dynamically from state machine definitions.
  // This protects undo when new steps are added but the static map is not updated yet.
  const allPhases = [
    'introduction',
    'work_type_selection',
    'method_selection',
    'discovery',
    'problem_shifting',
    'identity_shifting',
    'belief_shifting',
    'blockage_shifting',
    'reality_shifting',
    'trauma_shifting',
    'digging_deeper',
    'integration'
  ];

  for (const phaseName of allPhases) {
    const steps = treatmentMachine.getPhaseSteps(phaseName);
    if (steps?.some((step) => step.id === stepId)) {
      console.log(`Treatment V5 API: Dynamically resolved phase "${phaseName}" for step "${stepId}"`);
      return phaseName;
    }
  }

  return 'introduction'; // Default fallback
}

/**
 * Handle undo action - synchronize backend state with UI rollback
 */
async function handleUndo(sessionId: string, undoToStep: string, userId: string) {
  try {
    console.log('Treatment V5 API: Handling undo to step:', undoToStep, 'for session:', sessionId);

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
      console.log('Treatment V5 API: Context retrieved successfully');
    } catch (contextError) {
      console.error('Treatment V5 API: Failed to get context:', contextError);
      throw new Error(`Failed to get V4 treatment context: ${contextError instanceof Error ? contextError.message : 'Unknown context error'}`);
    }

    if (!context) {
      throw new Error('V4 Treatment context is null or undefined');
    }

    console.log('V4 Current context before undo:', {
      currentStep: context.currentStep,
      currentPhase: context.currentPhase,
      userResponses: context.userResponses ? Object.keys(context.userResponses) : []
    });

    // Determine the correct phase for the target step first.
    // Undo must clear responses based on the target phase, not the current phase.
    const targetPhase = getPhaseForStep(undoToStep);
    console.log('Treatment V5 API: Target step belongs to phase:', targetPhase);

    // Clear any user responses that were made AFTER the step we're undoing to.
    // This prevents the state machine from using stale responses.
    const stepsToKeep = new Set<string>();
    let phaseSteps;
    try {
      phaseSteps = treatmentMachine.getPhaseSteps(targetPhase);
      console.log('Treatment V5 API: Phase steps retrieved for phase:', targetPhase);
    } catch (phaseError) {
      console.error('Treatment V5 API: Failed to get phase steps:', phaseError);
      // Clear all responses as a safe fallback
      await treatmentMachine.clearUserResponsesForUndo(sessionId, new Set());
      console.log('Treatment V5 API: Cleared all responses due to phase error');
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
          console.log('Treatment V5 API: Cleared user responses after target step');

          // CACHE FIX (v2 parity): Invalidate cached responses for cleared steps
          // Without this, stale cached responses with old user input get re-served
          const stepsToInvalidate: string[] = [];
          Object.keys(context.userResponses).forEach(stepId => {
            if (!stepsToKeep.has(stepId)) {
              stepsToInvalidate.push(stepId);
            }
          });
          if (stepsToInvalidate.length > 0) {
            treatmentMachine.invalidateCacheForSteps(stepsToInvalidate);
            console.log('Treatment V5 API: Invalidated cache for undone steps:', stepsToInvalidate);
          }
        } else {
          // If not found in current phase, clear all responses to be safe
          treatmentMachine.clearUserResponsesForUndo(sessionId, new Set());
          console.log('Treatment V5 API: Cleared all user responses - undoing to different phase');
        }
      } catch (clearError) {
        console.error('Treatment V5 API: Error clearing user responses:', clearError);
        // Continue - this isn't critical for the undo operation
      }
    } else {
      console.log('Treatment V5 API: No phase steps found, clearing all responses');
      try {
        treatmentMachine.clearUserResponsesForUndo(sessionId, new Set());
      } catch (clearError) {
        console.error('Treatment V5 API: Error clearing all responses:', clearError);
        // Continue - this isn't critical for the undo operation
      }
    }

    // POSITION-TRACKING CLEANUP (v2 parity): Clear return-to tracking variables
    // when their associated check responses were cleared by the undo.
    // This prevents returning to a check question that the user undid past.
    const clearedSteps = Object.keys(context.userResponses || {})
      .filter(stepId => !stepsToKeep.has(stepId));

    console.log('Treatment V5 API: Cleared steps:', clearedSteps);

    // Clear belief check tracking if any belief check responses were cleared
    if (clearedSteps.some(step => step.startsWith('belief_check_'))) {
      console.log('🧹 UNDO_TRACKING: Clearing returnToBeliefCheck');
      context.metadata.returnToBeliefCheck = undefined;
    }

    // Clear identity check tracking if any identity check responses were cleared
    if (clearedSteps.some(step => step === 'identity_future_check' || step === 'identity_scenario_check')) {
      console.log('🧹 UNDO_TRACKING: Clearing returnToIdentityCheck');
      context.metadata.returnToIdentityCheck = undefined;
    }

    // Clear digging deeper tracking if any digging deeper check responses were cleared
    if (clearedSteps.some(step =>
        step === 'future_problem_check' ||
        step.startsWith('scenario_check_') ||
        step.startsWith('clear_scenario_problem_') ||
        step.startsWith('clear_anything_else_problem_') ||
        step === 'trauma_dig_deeper' ||
        step === 'trauma_dig_deeper_2' ||
        step === 'anything_else_check_1' ||
        step === 'anything_else_check_2'
    )) {
      console.log('🧹 UNDO_TRACKING: Clearing returnToDiggingStep');
      context.metadata.returnToDiggingStep = undefined;
    }

    // Clear trauma check tracking if any trauma check responses were cleared
    if (clearedSteps.some(step => step === 'trauma_identity_check' || step === 'trauma_future_identity_check' || step === 'trauma_future_scenario_check')) {
      console.log('🧹 UNDO_TRACKING: Clearing returnToTraumaCheck');
      context.metadata.returnToTraumaCheck = undefined;
    }

    // Update context to the target step with correct phase
    try {
      treatmentMachine.updateContextForUndo(sessionId, {
        currentStep: undoToStep,
        currentPhase: targetPhase,
        lastActivity: new Date()
      });
      console.log('Treatment V5 API: Context updated successfully');
    } catch (updateError) {
      console.error('Treatment V5 API: Error updating context:', updateError);
      throw new Error(`Failed to update V4 context: ${updateError instanceof Error ? updateError.message : 'Unknown update error'}`);
    }

    // CRITICAL: Clear problem-statement and iteration metadata when undoing to steps
    // where these values get (re)set. Without this, stale metadata persists and causes:
    //   1. Digging Deeper showing the old problem ("BAD") instead of the corrected one ("PROBLEM 1")
    //   2. Blockage Shifting losing track of which iteration the user was on
    try {
      const ctx = treatmentMachine.getContextForUndo(sessionId);

      // Steps where the problem statement is initially defined or can be re-entered
      const problemDefiningSteps = [
        'mind_shifting_explanation', 'mind_shifting_explanation_dynamic',
        'work_type_description', 'restate_selected_problem',
        'negative_experience_description', 'goal_description',
        'restate_problem_future', 'confirm_statement'
      ];

      // If undoing to a problem-defining step (or earlier), clear originalProblemStatement
      // so that updateProblemStatement will re-set it with the new value.
      // Uses empty string '' (not undefined) to match v2 gold-standard pattern.
      if (problemDefiningSteps.includes(undoToStep)) {
        console.log(`🔄 UNDO_METADATA: Clearing originalProblemStatement (was "${ctx.metadata.originalProblemStatement}") because undoing to problem-defining step: ${undoToStep}`);
        ctx.metadata.originalProblemStatement = '';
        ctx.metadata.problemStatement = '';
        ctx.problemStatement = '';
      }

      // If undoing within blockage shifting, reset iteration-tracking metadata
      // so the cycle doesn't reference stale state from a later iteration
      const blockageSteps = [
        'blockage_shifting_intro', 'blockage_shifting_intro_static', 'blockage_shifting_intro_dynamic',
        'blockage_step_b', 'blockage_step_c', 'blockage_step_d', 'blockage_step_e',
        'blockage_check_if_still_problem'
      ];
      if (blockageSteps.includes(undoToStep)) {
        // Determine which iteration the target step was in by counting cleared responses
        // For safety, reset cycle-related metadata that may have advanced past the undo point
        console.log(`🔄 UNDO_METADATA: Resetting blockage iteration metadata for undo to: ${undoToStep}`);
        ctx.metadata.cycleCount = 0;
        ctx.metadata.skipIntroInstructions = false;
        ctx.metadata.hasAskedToGuess = false;
        ctx.metadata.hasAskedToGuessD = false;

        // If undoing back to the intro/start of blockage shifting, also clear
        // digging-related metadata that may have been set during later iterations
        if (undoToStep === 'blockage_shifting_intro_static' ||
            undoToStep === 'blockage_shifting_intro_dynamic' ||
            undoToStep === 'blockage_shifting_intro') {
          ctx.metadata.currentDiggingProblem = '';
          ctx.metadata.newDiggingProblem = '';
          console.log(`🔄 UNDO_METADATA: Cleared digging problem metadata for blockage intro undo`);
        }
      }

      // If undoing to a step in problem_shifting, reset its iteration metadata too
      const problemShiftingSteps = [
        'problem_shifting_intro', 'problem_shifting_intro_static', 'problem_shifting_intro_dynamic',
        'body_sensation_check', 'what_needs_to_happen_step', 'feel_solution_state',
        'feel_good_state', 'what_happens_step', 'check_if_still_problem'
      ];
      if (problemShiftingSteps.includes(undoToStep)) {
        console.log(`🔄 UNDO_METADATA: Resetting problem shifting iteration metadata for undo to: ${undoToStep}`);
        ctx.metadata.cycleCount = 0;
        ctx.metadata.skipIntroInstructions = false;
      }

      // If undoing to digging deeper steps, reset digging iteration metadata
      const diggingSteps = [
        'digging_deeper_start', 'future_problem_check', 'restate_problem_future', 'digging_method_selection'
      ];
      if (diggingSteps.includes(undoToStep)) {
        console.log(`🔄 UNDO_METADATA: Resetting digging deeper metadata for undo to: ${undoToStep}`);
        ctx.metadata.currentDiggingProblem = '';
        ctx.metadata.newDiggingProblem = '';
        // Don't reset diggingProblemNumber completely - but ensure it matches the restored state
        // Reset returnToDiggingStep since we're re-entering the digging flow
        if (undoToStep === 'digging_deeper_start' || undoToStep === 'future_problem_check') {
          ctx.metadata.returnToDiggingStep = undefined;
        }
      }

      await treatmentMachine.saveContextToDatabase(ctx);
      console.log('🔄 UNDO_METADATA: Problem/iteration metadata cleaned and saved successfully');
    } catch (metadataError) {
      console.error('Treatment V5 API: Error cleaning problem/iteration metadata:', metadataError);
      // Continue - undo should still work, just with potentially stale metadata
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
        console.error('Treatment V5 API: Error restoring goal metadata:', restoreError);
        // Continue - this isn't critical enough to fail the undo
      }
    }

    // Get updated context for logging
    let updatedContext;
    try {
      updatedContext = treatmentMachine.getContextForUndo(sessionId);
      console.log('V4 Context after undo:', {
        currentStep: updatedContext.currentStep,
        currentPhase: updatedContext.currentPhase,
        userResponses: updatedContext.userResponses ? Object.keys(updatedContext.userResponses) : []
      });
    } catch (contextError) {
      console.error('Treatment V5 API: Error getting updated context:', contextError);
      // Still try to return success since the main operation may have worked
      updatedContext = { userResponses: {} };
    }

    return NextResponse.json({
      success: true,
      message: 'V4 Undo successful',
      currentStep: undoToStep,
      version: 'v4',
      clearedResponses: updatedContext.userResponses ? Object.keys(updatedContext.userResponses).length : 0
    });

  } catch (error) {
    console.error('Treatment V5 API: Undo error:', error);
    return NextResponse.json(
      { error: 'V4 Undo failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Map method name to session type for metrics tracking
 */
function getSessionTypeFromMethod(method: string): string {
  const methodToSessionType: Record<string, string> = {
    'mind_shifting': 'problem_shifting',
    'problem_shifting': 'problem_shifting',
    'goal_optimization': 'goal_optimization',
    'trauma_shifting': 'experience_clearing',
    'belief_shifting': 'belief_shifting',
    'identity_shifting': 'identity_shifting',
    'reality_shifting': 'reality_shifting',
    'blockage_shifting': 'blockage_shifting'
  };
  
  return methodToSessionType[method] || 'problem_shifting';
} 