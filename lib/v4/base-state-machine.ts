import { TreatmentPhase, TreatmentStep, TreatmentContext, ProcessingResult, AITrigger, ResponseCache, PerformanceMetrics, CachedResponse } from './types';
import { ValidationHelpers } from './validation-helpers';
import { DatabaseOperations } from './database-operations';
import { TextProcessingUtils } from './text-processing-utils';

// Import treatment modalities
import { IntroductionPhase } from './treatment-modalities/introduction';
import { WorkTypeSelectionPhase } from './treatment-modalities/work-type-selection';
import { MethodSelectionPhase } from './treatment-modalities/method-selection';
import { DiscoveryPhase } from './treatment-modalities/discovery';
import { ProblemShiftingPhase } from './treatment-modalities/problem-shifting';
import { IdentityShiftingPhase } from './treatment-modalities/identity-shifting';
import { BeliefShiftingPhase } from './treatment-modalities/belief-shifting';
import { BlockageShiftingPhase } from './treatment-modalities/blockage-shifting';
import { RealityShiftingPhase } from './treatment-modalities/reality-shifting';
import { TraumaShiftingPhase } from './treatment-modalities/trauma-shifting';
import { DiggingDeeperPhase } from './treatment-modalities/digging-deeper';
import { IntegrationPhase } from './treatment-modalities/integration';

export abstract class BaseTreatmentStateMachine {
  protected phases: Map<string, TreatmentPhase>;
  protected contexts: Map<string, TreatmentContext>;

  // Response caching system for performance optimization
  private responseCache: ResponseCache;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100; // Prevent memory bloat

  constructor() {
    this.phases = new Map();
    this.contexts = new Map();
    this.initializePhases();

    // Initialize response caching system
    this.responseCache = {
      cache: new Map(),
      hitCount: 0,
      missCount: 0,
      preloadedResponses: new Set()
    };

    console.log('🚀 RESPONSE_CACHE: Treatment State Machine initialized with response caching');

    // Clear any existing cache entries to fix caching bugs
    this.clearIdentityCache();
    this.clearIdentityCache();
    this.clearGoalCache();
  }

  protected abstract handleInternalRoutingSignals(signal: string, context: TreatmentContext): boolean;

  /**
   * Main processing function - handles 95% of interactions without AI
   */
  async processUserInput(
    sessionId: string,
    userInput: string,
    context?: Partial<TreatmentContext>,
    bypassValidation?: boolean
  ): Promise<ProcessingResult> {
    // CRITICAL FIX: Ensure context is loaded from database before processing
    await this.getOrCreateContextAsync(sessionId, context);

    // Special handling for session initialization
    if (userInput === 'start') {
      const treatmentContext = this.getOrCreateContext(sessionId, context);
      const currentPhase = this.phases.get(treatmentContext.currentPhase);

      console.log(`🔍 PROCESS_INPUT_START: sessionId="${sessionId}", currentPhase="${treatmentContext.currentPhase}", currentStep="${treatmentContext.currentStep}", userInput="${userInput}"`);

      if (!currentPhase) {
        throw new Error(`Invalid phase: ${treatmentContext.currentPhase}`);
      }

      const currentStep = currentPhase.steps.find(s => s.id === treatmentContext.currentStep);
      if (!currentStep) {
        throw new Error(`Invalid step: ${treatmentContext.currentStep}`);
      }

      // Return the initial welcome message
      const scriptedResponse = this.getScriptedResponse(currentStep, treatmentContext);
      return {
        canContinue: true,
        nextStep: treatmentContext.currentStep,
        scriptedResponse,
        expectedResponseType: currentStep.expectedResponseType
      };
    }

    const treatmentContext = this.getOrCreateContext(sessionId, context);
    const currentPhase = this.phases.get(treatmentContext.currentPhase);

    if (!currentPhase) {
      throw new Error(`Invalid phase: ${treatmentContext.currentPhase}`);
    }

    const currentStep = currentPhase.steps.find(s => s.id === treatmentContext.currentStep);
    if (!currentStep) {
      throw new Error(`Invalid step: ${treatmentContext.currentStep}`);
    }

    // Update context with user response
    treatmentContext.userResponses[treatmentContext.currentStep] = userInput;
    treatmentContext.lastActivity = new Date();

    // Validate user input FIRST (unless bypassed)
    if (!bypassValidation) {
      const validationResult = ValidationHelpers.validateUserInput(userInput, currentStep, treatmentContext);
      if (!validationResult.isValid) {
        // Special handling for multiple problems detected
        if (validationResult.error === 'MULTIPLE_PROBLEMS_DETECTED') {
          treatmentContext.currentStep = 'multiple_problems_selection';
          const multipleProblemsStep = currentPhase.steps.find(s => s.id === 'multiple_problems_selection');
          if (multipleProblemsStep) {
            const scriptedResponse = this.getScriptedResponse(multipleProblemsStep, treatmentContext);
            return {
              canContinue: true,
              nextStep: 'multiple_problems_selection',
              scriptedResponse,
              expectedResponseType: multipleProblemsStep.expectedResponseType
            };
          }
        }

        // Check if we need AI assistance
        const aiTrigger = this.checkAITriggers(userInput, currentStep, treatmentContext);
        if (aiTrigger) {
          return {
            canContinue: false,
            triggeredAI: true,
            needsAIAssistance: {
              trigger: aiTrigger,
              context: this.buildAIContext(treatmentContext, currentStep),
              userInput
            }
          };
        }

        // Return validation error with scripted response
        return {
          canContinue: false,
          reason: validationResult.error,
          scriptedResponse: this.getValidationPrompt(currentStep, validationResult.error || 'Invalid input')
        };
      }
    }

    // Get the current step's response to check for internal signals
    const currentStepResponse = this.getScriptedResponse(currentStep, treatmentContext, userInput);

    // Check if this is an internal confirmation signal that should trigger automatic step progression
    const isInternalSignal = this.isInternalConfirmationSignal(currentStepResponse);

    console.log(`
╔════════════════════════════════════════════════════════════════
║ 🔄 PROCESS_INPUT FLOW CHECK
╠════════════════════════════════════════════════════════════════
║ currentStep: "${currentStep.id}"
║ currentStepResponse: "${currentStepResponse.substring(0, 80)}${currentStepResponse.length > 80 ? '...' : ''}"
║ isInternalSignal: ${isInternalSignal}
╚════════════════════════════════════════════════════════════════`);

    if (isInternalSignal) {
      console.log(`║ ⚡ INTERNAL SIGNAL - Auto-progressing to next step
╚════════════════════════════════════════════════════════════════\n`);
      return this.handleInternalSignal(currentStepResponse, currentStep, treatmentContext, userInput);
    }

    // Regular flow - proceed to next step
    console.log(`║ ✅ REGULAR FLOW - Will call determineNextStep and transition
╚════════════════════════════════════════════════════════════════\n`);
    return this.handleRegularFlow(currentStep, treatmentContext, userInput);
  }

  /**
   * Get instant scripted response - <200ms performance target with caching
   */
  private getScriptedResponse(step: TreatmentStep, context: TreatmentContext, currentUserInput?: string): string {
    const startTime = performance.now();

    // Try cache first for static responses
    if (typeof step.scriptedResponse === 'string') {
      const cacheKey = `static_${step.id}`;
      const cached = this.getCachedResponse(cacheKey);
      if (cached) {
        this.responseCache.hitCount++;
        console.log(`🚀 CACHE_HIT: Static response for step "${step.id}" (${Math.round(performance.now() - startTime)}ms)`);
        return cached;
      }
    }

    // Generate response
    let response: string;
    if (typeof step.scriptedResponse === 'function') {
      const userInput = currentUserInput || (() => {
        const previousStepId = this.getPreviousStep(step.id, context.currentPhase);
        return previousStepId ? context.userResponses[previousStepId] : undefined;
      })();

      // Try cache for dynamic responses with context hash
      let cacheKey: string | undefined;
      const shouldSkipCache = this.shouldSkipCacheForStep(step.id, userInput, context);

      if (!shouldSkipCache) {
        const contextHash = this.generateContextHash(step.id, userInput, context);
        cacheKey = `dynamic_${step.id}_${contextHash}`;
        const cached = this.getCachedResponse(cacheKey);
        if (cached) {
          this.responseCache.hitCount++;
          console.log(`🚀 CACHE_HIT: Dynamic response for step "${step.id}" (${Math.round(performance.now() - startTime)}ms)`);
          return cached;
        }
      }

      response = step.scriptedResponse(userInput, context);

      // Cache the dynamic response (only if we have a cacheKey)
      if (cacheKey) {
        this.setCachedResponse(cacheKey, response, step.id);
      }
    } else {
      response = step.scriptedResponse;

      // Cache the static response
      const cacheKey = `static_${step.id}`;
      this.setCachedResponse(cacheKey, response, step.id);
    }

    this.responseCache.missCount++;
    const responseTime = Math.round(performance.now() - startTime);
    console.log(`🚀 CACHE_MISS: Generated response for step "${step.id}" (${responseTime}ms)`);

    return response;
  }

  /**
   * Check if step should skip caching
   */
  private shouldSkipCacheForStep(stepId: string, userInput: string | undefined, context: TreatmentContext): boolean {
    const diggingContext = userInput?.trim() || context.metadata?.currentDiggingProblem;
    const cycleCount = context.metadata?.cycleCount > 0;

    // Steps that should never be cached due to dynamic context
    const neverCacheSteps = [
      'identity_shifting_intro_static',
      'belief_shifting_intro_static',
      'problem_shifting_intro_static',
      'blockage_shifting_intro_static',
      'goal_confirmation',
      'reality_shifting_intro_static',
      'work_type_description'
    ];

    if (neverCacheSteps.includes(stepId) && (diggingContext || cycleCount)) {
      return true;
    }

    // Integration steps that reference problem statement - must always skip cache to prevent cross-session contamination
    // Blockage steps that embed userInput directly - must always skip cache to prevent cross-cycle contamination
    // Problem Shifting steps that embed user-specific data - must always skip cache
    const alwaysSkipCacheSteps = [
      'integration_start',
      'intention_question',
      'blockage_step_b',
      'blockage_step_d',
      'body_sensation_check',
      'what_needs_to_happen_step',
      'blockage_check_if_still_problem',
      'confirm_statement'  // References problemStatement which changes after trauma_problem_redirect
    ];

    if (alwaysSkipCacheSteps.includes(stepId)) {
      return true;
    }

    // Steps that use user input directly
    const userInputSteps = [
      'feel_good_state',
      'what_happens_step',
      'belief_step_a',
      'belief_step_b',
      'belief_step_d',
      'belief_step_e'
    ];

    return userInputSteps.includes(stepId) && !!userInput?.trim();
  }

  /**
   * Get cached response if valid
   */
  private getCachedResponse(cacheKey: string): string | null {
    const cached = this.responseCache.cache.get(cacheKey);
    if (!cached) return null;

    // Check if cache entry is still valid
    if (Date.now() - cached.timestamp > this.CACHE_TTL_MS) {
      this.responseCache.cache.delete(cacheKey);
      return null;
    }

    return cached.response;
  }

  /**
   * Set cached response
   */
  private setCachedResponse(cacheKey: string, response: string, stepId: string): void {
    // Prevent cache bloat
    if (this.responseCache.cache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entries
      const entries = Array.from(this.responseCache.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, 10); // Remove oldest 10 entries
      toRemove.forEach(([key]) => this.responseCache.cache.delete(key));
    }

    this.responseCache.cache.set(cacheKey, {
      response,
      timestamp: Date.now(),
      stepId,
      contextHash: cacheKey
    });
  }

  /**
   * Generate simple hash for context-dependent responses
   */
  private generateContextHash(stepId: string, userInput: string | undefined, context: TreatmentContext): string {
    const relevantData = {
      stepId,
      userInput: userInput || '',
      workType: context.metadata.workType,
      selectedMethod: context.metadata.selectedMethod,
      currentPhase: context.currentPhase,
      problemStatement: context.problemStatement,
      originalProblemStatement: context.metadata.originalProblemStatement,
      currentBelief: context.metadata.currentBelief,
      desiredFeeling: context.metadata.desiredFeeling,
      currentGoal: context.metadata.currentGoal,
      goalWithDeadline: context.metadata.goalWithDeadline,
      currentDiggingProblem: context.metadata.currentDiggingProblem,
      identityResponse: context.metadata.identityResponse,
      currentIdentity: context.metadata.currentIdentity
    };

    // Simple hash - could be improved with actual hash function if needed
    return btoa(JSON.stringify(relevantData)).substring(0, 16);
  }

  /**
   * Pre-load likely next responses in background
   */
  public preloadNextResponses(sessionId: string): void {
    try {
      const context = this.contexts.get(sessionId);
      if (!context) return;

      const currentPhase = this.phases.get(context.currentPhase);
      if (!currentPhase) return;

      const currentStep = currentPhase.steps.find(s => s.id === context.currentStep);
      if (!currentStep) return;

      // Predict next 2-3 most likely steps
      const likelyNextSteps = this.predictNextSteps(currentStep, context);

      // Pre-generate responses for likely steps
      likelyNextSteps.forEach(stepId => {
        const step = currentPhase.steps.find(s => s.id === stepId);
        if (step && typeof step.scriptedResponse === 'string') {
          // Pre-cache static responses
          const cacheKey = `static_${step.id}`;
          if (!this.responseCache.cache.has(cacheKey)) {
            this.setCachedResponse(cacheKey, step.scriptedResponse, step.id);
            this.responseCache.preloadedResponses.add(stepId);
            console.log(`🚀 PRELOAD: Cached static response for step "${stepId}"`);
          }
        }
      });

    } catch (error) {
      console.warn('🚀 PRELOAD: Error pre-loading responses:', error);
    }
  }

  /**
   * Predict most likely next steps based on current context
   */
  private predictNextSteps(currentStep: TreatmentStep, context: TreatmentContext): string[] {
    const predictions: string[] = [];

    // Use existing nextStep if defined
    if (currentStep.nextStep) {
      predictions.push(currentStep.nextStep);
    }

    // Add phase-specific predictions based on common flows
    switch (context.currentPhase) {
      case 'introduction':
        if (context.currentStep === 'mind_shifting_explanation') {
          predictions.push('work_type_description', 'goal_description', 'negative_experience_description');
        }
        break;

      case 'problem_shifting':
        const problemSteps = ['problem_shifting_intro_static', 'body_sensation_check', 'feel_solution_state'];
        const currentIndex = problemSteps.indexOf(context.currentStep);
        if (currentIndex >= 0 && currentIndex < problemSteps.length - 1) {
          predictions.push(problemSteps[currentIndex + 1]);
        }
        break;
    }

    return predictions.slice(0, 3);
  }

  /**
   * Get performance metrics for monitoring
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    const total = this.responseCache.hitCount + this.responseCache.missCount;
    return {
      cacheHitRate: total > 0 ? (this.responseCache.hitCount / total) * 100 : 0,
      averageResponseTime: 0,
      preloadedResponsesUsed: this.responseCache.preloadedResponses.size,
      totalResponses: total
    };
  }

  /**
   * Clear identity-related cached responses
   */
  public clearIdentityCache(): void {
    const identitySteps = [
      'identity_dissolve_step_a',
      'identity_dissolve_step_b',
      'identity_dissolve_step_c',
      'identity_dissolve_step_d',
      'identity_dissolve_step_e'
    ];

    let clearedCount = 0;
    this.responseCache.cache.forEach((_, key) => {
      const hasIdentityStep = identitySteps.some(step => key.includes(step));
      if (hasIdentityStep) {
        this.responseCache.cache.delete(key);
        clearedCount++;
      }
    });

    console.log(`🧹 CACHE_CLEAR: Cleared ${clearedCount} identity-related cache entries`);
  }

  /**
   * Clear goal-related cached responses
   */
  public clearGoalCache(): void {
    const goalSteps = [
      'goal_confirmation',
      'goal_description',
      'goal_deadline_check',
      'goal_deadline_date',
      'goal_certainty'
    ];

    let clearedCount = 0;
    this.responseCache.cache.forEach((_, key) => {
      const hasGoalStep = goalSteps.some(step => key.includes(step));
      if (hasGoalStep) {
        this.responseCache.cache.delete(key);
        clearedCount++;
      }
    });

    console.log(`🧹 CACHE_CLEAR: Cleared ${clearedCount} goal-related cache entries`);
  }

  /**
   * Check if AI assistance is needed
   */
  private checkAITriggers(userInput: string, step: TreatmentStep, context: TreatmentContext): AITrigger | null {
    const trimmed = userInput.trim();
    const words = trimmed.split(' ').length;
    const lowerInput = trimmed.toLowerCase();

    for (const trigger of step.aiTriggers) {
      switch (trigger.condition) {
        case 'userStuck':
          if (trimmed.length < 3 ||
            lowerInput.includes("i don't know") ||
            lowerInput.includes("not sure") ||
            lowerInput.includes("can't think") ||
            lowerInput.includes("don't feel") ||
            lowerInput.includes("can't feel")) {
            return trigger;
          }
          break;

        case 'tooLong':
          if (words > 30) {
            return trigger;
          }
          break;

        case 'multipleProblems':
          const problemConnectors = ['and', 'also', 'plus', 'additionally', 'another', 'other', 'too', 'as well'];
          const problemCount = problemConnectors.filter(connector =>
            lowerInput.includes(connector)
          ).length;
          if (problemCount >= 1) {
            return trigger;
          }
          break;

        case 'needsClarification':
          if (lowerInput.includes('what do you mean') ||
            lowerInput.includes('i don\'t understand') ||
            lowerInput.includes('confused') ||
            lowerInput.includes('unclear') ||
            lowerInput.includes('what should i') ||
            (step.expectedResponseType === 'yesno' && !lowerInput.includes('yes') && !lowerInput.includes('no'))) {
            return trigger;
          }
          break;

        case 'offTopic':
          const offTopicKeywords = ['weather', 'politics', 'sports', 'food', 'work', 'money', 'family'];
          if (offTopicKeywords.some(keyword => lowerInput.includes(keyword)) &&
            context.currentStep.includes('feel') || context.currentStep.includes('problem')) {
            return trigger;
          }
          break;
      }
    }

    return null;
  }

  private isInternalConfirmationSignal(response: string): boolean {
    const internalSignals = [
      'GOAL_SELECTION_CONFIRMED',
      'NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED',
      'PROBLEM_SELECTION_CONFIRMED',
      'METHOD_SELECTION_NEEDED',
      'SKIP_TO_TREATMENT_INTRO',
      'ROUTE_TO_PROBLEM_INTEGRATION',
      'ROUTE_TO_IDENTITY_INTEGRATION',
      'ROUTE_TO_BELIEF_INTEGRATION',
      'ROUTE_TO_BLOCKAGE_INTEGRATION',
      'ROUTE_TO_TRAUMA_INTEGRATION',
      'ROUTE_TO_INTEGRATION',
      // New routing signals
      'ROUTE_TO_PROBLEM_SHIFTING',
      'ROUTE_TO_IDENTITY_SHIFTING',
      'ROUTE_TO_BELIEF_SHIFTING',
      'ROUTE_TO_BLOCKAGE_SHIFTING',
      'ROUTE_TO_REALITY_SHIFTING',
      'ROUTE_TO_TRAUMA_SHIFTING',
      'PROBLEM_SHIFTING_SELECTED',
      'IDENTITY_SHIFTING_SELECTED',
      'BELIEF_SHIFTING_SELECTED',
      'BLOCKAGE_SHIFTING_SELECTED',
      'REALITY_SHIFTING_SELECTED',
      'TRAUMA_SHIFTING_SELECTED'
    ];

    return internalSignals.includes(response);
  }

  private handleInternalSignal(signal: string, currentStep: TreatmentStep, context: TreatmentContext, userInput: string): ProcessingResult {
    const nextStepId = this.determineNextStep(currentStep, context);

    if (nextStepId) {
      context.currentStep = nextStepId;

      const updatedPhase = this.phases.get(context.currentPhase);
      if (!updatedPhase) {
        throw new Error(`Invalid updated phase: ${context.currentPhase}`);
      }

      const nextStep = updatedPhase.steps.find(s => s.id === nextStepId);
      if (nextStep) {
        // PHASE 7 FIX: Don't pass userInput for new steps - let getScriptedResponse use fallback logic
        // This ensures each step receives appropriate context via getPreviousStep() or undefined
        const actualResponse = this.getScriptedResponse(nextStep, context);
        const needsLinguisticProcessing = this.isLinguisticProcessingStep(nextStep.id, context);

        this.saveContext(context);

        return {
          canContinue: true,
          nextStep: nextStepId,
          scriptedResponse: actualResponse,
          needsLinguisticProcessing,
          expectedResponseType: nextStep.expectedResponseType
        };
      } else {
        throw new Error(`Step '${nextStepId}' not found in phase '${context.currentPhase}'`);
      }
    }

    return this.handlePhaseCompletion(context);
  }

  private handleRegularFlow(currentStep: TreatmentStep, context: TreatmentContext, userInput: string): ProcessingResult {
    const nextStepId = this.determineNextStep(currentStep, context);

    console.log(`
╔════════════════════════════════════════════════════════════════
║ 🎬 HANDLE_REGULAR_FLOW
╠════════════════════════════════════════════════════════════════
║ determineNextStep returned: "${nextStepId}"
║ currentPhase: "${context.currentPhase}"
╚════════════════════════════════════════════════════════════════`);

    if (nextStepId) {
      context.currentStep = nextStepId;

      // CRITICAL FIX: Get the updated phase after determineNextStep may have changed it
      const updatedPhase = this.phases.get(context.currentPhase);
      if (!updatedPhase) {
        throw new Error(`Invalid updated phase: ${context.currentPhase}`);
      }

      const nextStep = updatedPhase.steps.find(s => s.id === nextStepId);
      if (nextStep) {
        // PHASE 7 FIX: Don't pass userInput for new steps - let getScriptedResponse use fallback logic
        // This ensures each step receives appropriate context via getPreviousStep() or undefined
        const scriptedResponse = this.getScriptedResponse(nextStep, context);
        const needsLinguisticProcessing = this.isLinguisticProcessingStep(nextStep.id, context);

        // CRITICAL FIX (V2 parity): Check if this new step's response is also a signal that needs auto-progression
        // This handles cases like route_to_method returning "METHOD_SELECTION_NEEDED"
        const isSignalResponse = this.isInternalConfirmationSignal(scriptedResponse);

        if (isSignalResponse) {
          console.log(`║ ⚡ SIGNAL IN NEXT STEP: "${scriptedResponse}" - Auto-progressing one more time
╚════════════════════════════════════════════════════════════════\n`);

          // This is a signal, we need to auto-progress ONE MORE time

          // CRITICAL FIX: Check if this signal is a routing signal first
          let finalNextStepId: string | null = null;

          if (this.handleInternalRoutingSignals(scriptedResponse, context)) {
            console.log(`║ ⚡ SIGNAL HANDLED BY ROUTING LOGIC: "${scriptedResponse}" -> "${context.currentStep}"`);
            finalNextStepId = context.currentStep;
          } else {
            finalNextStepId = this.determineNextStep(nextStep, context);
          }

          console.log(`║ 🎯 FINAL AUTO-PROGRESSION to: "${finalNextStepId}"`);

          if (finalNextStepId) {
            context.currentStep = finalNextStepId;
            const finalPhase = this.phases.get(context.currentPhase);

            if (finalPhase) {
              const finalStep = finalPhase.steps.find(s => s.id === finalNextStepId);

              if (finalStep) {
                const finalResponse = this.getScriptedResponse(finalStep, context);
                const finalNeedsLinguistic = this.isLinguisticProcessingStep(finalStep.id, context);

                console.log(`║ 💬 FINAL RESPONSE TO USER: "${finalResponse.substring(0, 80)}${finalResponse.length > 80 ? '...' : ''}"
╚════════════════════════════════════════════════════════════════\n`);

                this.saveContext(context);

                return {
                  canContinue: true,
                  nextStep: finalNextStepId,
                  scriptedResponse: finalResponse,
                  needsLinguisticProcessing: finalNeedsLinguistic,
                  expectedResponseType: finalStep.expectedResponseType
                };
              }
            }
          }
        }

        // Not a signal, return normally
        console.log(`║ 💬 RESPONSE TO USER: "${scriptedResponse.substring(0, 80)}${scriptedResponse.length > 80 ? '...' : ''}"
╚════════════════════════════════════════════════════════════════\n`);

        this.saveContext(context);

        return {
          canContinue: true,
          nextStep: nextStepId,
          scriptedResponse,
          needsLinguisticProcessing,
          expectedResponseType: nextStep.expectedResponseType
        };
      } else {
        // ENHANCED ERROR: Show which steps are available in the current phase for debugging
        const availableSteps = updatedPhase.steps.map(s => s.id).join(', ');
        console.error(`V4 PHASE_STEP_MISMATCH: Step '${nextStepId}' not found in phase '${context.currentPhase}'. Available steps: ${availableSteps}`);
        throw new Error(`Step '${nextStepId}' not found in phase '${context.currentPhase}'. Available steps: ${availableSteps}`);
      }
    }

    return this.handlePhaseCompletion(context);
  }

  private saveContext(context: TreatmentContext): void {
    this.contexts.set(context.sessionId, context);

    // Persist context to database
    DatabaseOperations.saveContextToDatabase(context).catch(error =>
      console.error('Failed to save context to database:', error)
    );

    // Pre-load next likely responses in background
    setTimeout(() => {
      this.preloadNextResponses(context.sessionId);
    }, 100);
  }

  /**
   * Check if current step requires linguistic processing
   */
  private isLinguisticProcessingStep(stepId: string, context?: TreatmentContext): boolean {
    // Check if we should skip linguistic processing (when cycling back)
    if (context?.metadata?.skipLinguisticProcessing) {
      return false;
    }

    // V4 PERFORMANCE OPTIMIZATION: Following V2's lead, removed ALL intro_static steps from AI processing
    // Investigation showed these steps are PURE static text that don't use the AI-processed results:
    // - problem_shifting_intro_static: Static instructions, doesn't use problem statement in message
    // - reality_shifting_intro_static: Static instructions, doesn't use goal in message  
    // - belief_shifting_intro_static: Static instructions, doesn't use problem statement in message
    // 
    // The AI would process user input, try to find/replace it in static text, find nothing, and discard the result.
    // All _dynamic steps use the original user input from context.problemStatement directly.
    // This optimization eliminates 2-3 seconds latency + cost on every first-time entry.
    //
    // V2 already removed most steps for performance - V4 now matches this optimization:
    const linguisticSteps: string[] = [
      // Empty - no steps require linguistic processing in v4
      // All scripted responses use original user input from context
    ];
    // REMOVED from V4 (following V2's optimization):
    // - 'problem_shifting_intro_static' - Pure static text, AI result never used
    // - 'reality_shifting_intro_static' - Pure static text, AI result never used
    // - 'belief_shifting_intro_static' - Pure static text, AI result never used
    // - 'blockage_shifting_intro_static' - Already removed
    // - 'identity_shifting_intro_static' - Already removed
    // - 'trauma_shifting_intro' - Already removed
    // - 'body_sensation_check' - V2 removed for performance
    // - 'feel_solution_state' - V2 removed for performance
    // - 'identity_dissolve_step_a' - V2 removed for performance
    // - 'identity_dissolve_step_b' - V2 removed for performance
    // - 'trauma_dissolve_step_a' - V2 removed for performance
    // - 'trauma_dissolve_step_b' - V2 removed for performance

    return linguisticSteps.includes(stepId);
  }

  protected getOrCreateContext(sessionId: string, context?: Partial<TreatmentContext>): TreatmentContext {
    if (!this.contexts.has(sessionId)) {
      this.contexts.set(sessionId, {
        userId: context?.userId || '',
        sessionId,
        currentPhase: 'introduction',
        currentStep: 'mind_shifting_explanation_static',
        userResponses: {},
        startTime: new Date(),
        lastActivity: new Date(),
        metadata: {
          cycleCount: 0,
          problemStatement: '',
          lastResponse: '',
          workType: 'problem'
        }
      });
    }

    return this.contexts.get(sessionId)!;
  }

  /**
   * Get or create context with database persistence (public method)
   */
  public async getOrCreateContextAsync(sessionId: string, context?: Partial<TreatmentContext>): Promise<TreatmentContext> {
    // Check if context exists in memory first
    if (this.contexts.has(sessionId)) {
      return this.contexts.get(sessionId)!;
    }

    // Try to load from database
    const dbContext = await DatabaseOperations.loadContextFromDatabase(sessionId);
    if (dbContext) {
      this.contexts.set(sessionId, dbContext);
      return dbContext;
    }

    // Create new context if not found
    const newContext: TreatmentContext = {
      userId: context?.userId || '',
      sessionId,
      currentPhase: 'introduction',
      currentStep: 'mind_shifting_explanation_static',
      userResponses: {},
      startTime: new Date(),
      lastActivity: new Date(),
      metadata: {
        cycleCount: 0,
        problemStatement: '',
        lastResponse: '',
        workType: 'problem'
      }
    };

    this.contexts.set(sessionId, newContext);

    // Clear goal-related cache for new sessions
    this.clearGoalCache();

    // Save new context to database
    await DatabaseOperations.saveContextToDatabase(newContext);

    return newContext;
  }

  /**
   * Clear context for fresh session start
   */
  public async clearContext(sessionId: string): Promise<void> {
    this.contexts.delete(sessionId);
  }

  // FIXED: Change from private to protected so it can be overridden
  protected determineNextStep(currentStep: TreatmentStep, context: TreatmentContext): string | null {
    // Default implementation - just use nextStep from step definition
    return currentStep.nextStep || null;
  }

  private handlePhaseCompletion(context: TreatmentContext): ProcessingResult {
    if (context.currentStep === 'session_complete' ||
      context.currentStep === 'reality_session_complete' ||
      context.currentStep === 'identity_session_complete' ||
      context.currentStep?.includes('session_complete')) {
      return {
        canContinue: false,
        reason: 'Session completed successfully',
        scriptedResponse: 'Your Mind Shifting session is now complete. Thank you for your participation.'
      };
    }

    return {
      canContinue: false,
      reason: 'Unexpected phase completion',
      scriptedResponse: 'There seems to be an issue with the session flow. Please try again or contact support.'
    };
  }

  private getPreviousStep(currentStepId: string, phaseId: string): string {
    const phase = this.phases.get(phaseId);
    if (!phase) return '';

    const currentIndex = phase.steps.findIndex(s => s.id === currentStepId);
    return currentIndex > 0 ? phase.steps[currentIndex - 1].id : '';
  }

  private getValidationPrompt(step: TreatmentStep, error: string): string {
    return `${error} Please try again.`;
  }

  private buildAIContext(context: TreatmentContext, step: TreatmentStep): string {
    return `Phase: ${context.currentPhase}, Step: ${step.id}, Problem: ${context.problemStatement || 'Not set'}`;
  }

  /**
   * Initialize all treatment phases
   */
  private initializePhases(): void {
    // Initialize each modality phase
    this.phases.set('introduction', IntroductionPhase.create());
    this.phases.set('work_type_selection', WorkTypeSelectionPhase.create());
    this.phases.set('method_selection', MethodSelectionPhase.create());
    this.phases.set('discovery', DiscoveryPhase.create());
    this.phases.set('problem_shifting', ProblemShiftingPhase.create());
    this.phases.set('identity_shifting', IdentityShiftingPhase.create());
    this.phases.set('belief_shifting', BeliefShiftingPhase.create());
    this.phases.set('blockage_shifting', BlockageShiftingPhase.create());
    this.phases.set('reality_shifting', RealityShiftingPhase.create());
    this.phases.set('trauma_shifting', TraumaShiftingPhase.create());
    this.phases.set('digging_deeper', DiggingDeeperPhase.create());
    this.phases.set('integration', IntegrationPhase.create());
  }

  // Public methods for undo functionality
  public getContextForUndo(sessionId: string): TreatmentContext {
    return this.getOrCreateContext(sessionId);
  }

  public updateContextForUndo(sessionId: string, updates: Partial<TreatmentContext>): void {
    const context = this.getOrCreateContext(sessionId);
    Object.assign(context, updates);
  }

  public clearUserResponsesForUndo(sessionId: string, stepsToKeep: Set<string>): void {
    const context = this.getOrCreateContext(sessionId);

    if (!context.userResponses) return;

    Object.keys(context.userResponses).forEach(stepId => {
      if (!stepsToKeep.has(stepId)) {
        delete context.userResponses[stepId];
      }
    });
  }

  public getPhaseSteps(phaseName: string): TreatmentStep[] | null {
    const phase = this.phases.get(phaseName);
    return phase ? phase.steps : null;
  }

  /**
   * Save treatment context to database (public method)
   */
  public async saveContextToDatabase(context: TreatmentContext): Promise<void> {
    return DatabaseOperations.saveContextToDatabase(context);
  }
}
