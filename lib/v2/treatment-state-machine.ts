import { createServerClient } from '../database-server';

export interface TreatmentPhase {
  name: string;
  steps: TreatmentStep[];
  maxDuration: number; // in minutes
}

export interface TreatmentStep {
  id: string;
  scriptedResponse: string | ((userInput?: string | undefined, context?: any) => string);
  expectedResponseType: 'feeling' | 'problem' | 'experience' | 'yesno' | 'open' | 'goal' | 'selection' | 'description';
  validationRules: ValidationRule[];
  nextStep?: string;
  aiTriggers: AITrigger[];
}

export interface ValidationRule {
  type: 'minLength' | 'maxLength' | 'containsKeywords' | 'format';
  value: number | string | string[];
  errorMessage: string;
}

export interface AITrigger {
  condition: 'userStuck' | 'needsClarification' | 'multipleProblems' | 'tooLong' | 'offTopic';
  threshold?: number;
  action: 'clarify' | 'redirect' | 'simplify' | 'focus';
}

export interface TreatmentContext {
  userId: string;
  sessionId: string;
  currentPhase: string;
  currentStep: string;
  userResponses: Record<string, string>;
  problemStatement?: string;
  startTime: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
}

export interface ProcessingResult {
  canContinue: boolean;
  nextStep?: string;
  scriptedResponse?: string;
  needsLinguisticProcessing?: boolean;
  requiresRetry?: boolean;
  reason?: string;
  triggeredAI?: boolean;
  needsAIAssistance?: {
    trigger: AITrigger;
    context: string;
    userInput: string;
  };
  metadata?: {
    phase: string;
    step: string;
    userInput: string;
  };
}

// NEW: Response caching interfaces for performance optimization
interface CachedResponse {
  response: string;
  timestamp: number;
  stepId: string;
  contextHash: string; // Simple hash of relevant context
}

interface ResponseCache {
  cache: Map<string, CachedResponse>;
  hitCount: number;
  missCount: number;
  preloadedResponses: Set<string>;
}

// NEW: Performance metrics tracking
interface PerformanceMetrics {
  cacheHitRate: number;
  averageResponseTime: number;
  preloadedResponsesUsed: number;
  totalResponses: number;
}



export class TreatmentStateMachine {
  private phases: Map<string, TreatmentPhase>;
  private contexts: Map<string, TreatmentContext>;

  // NEW: Response caching system for performance optimization
  private responseCache: ResponseCache;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100; // Prevent memory bloat

  constructor() {
    this.phases = new Map();
    this.contexts = new Map();
    this.initializePhases();
    
    // NEW: Initialize response caching system
    this.responseCache = {
      cache: new Map(),
      hitCount: 0,
      missCount: 0,
      preloadedResponses: new Set()
    };
    
    console.log('🚀 RESPONSE_CACHE: Treatment State Machine initialized with response caching');
    
    // Clear any existing identity-related cache entries to fix caching bug
    this.clearIdentityCache();
    
    // Clear any existing goal-related cache entries to fix goal caching bug
    this.clearGoalCache();
  }

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
    console.log(`🔍 PROCESS_INPUT_START: Context metadata:`, JSON.stringify(treatmentContext.metadata, null, 2));
    
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
        scriptedResponse
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
    
    // CRITICAL FIX: For trauma dissolve step A, also store in metadata for immediate access by step B
    // This prevents step B from using cached responses from previous iterations
    if (treatmentContext.currentStep === 'trauma_dissolve_step_a') {
      treatmentContext.metadata.currentStepAResponse = userInput;
      console.log(`🔄 TRAUMA_STEP_A_SUBMITTED: Stored response "${userInput}" in metadata`);
    }
    
    // CRITICAL FIX: For trauma dissolve step D, also store in metadata for immediate access by step E
    // This prevents step E from using cached responses from previous iterations
    if (treatmentContext.currentStep === 'trauma_dissolve_step_d') {
      treatmentContext.metadata.currentStepDResponse = userInput;
      console.log(`🔄 TRAUMA_STEP_D_SUBMITTED: Stored response "${userInput}" in metadata`);
    }
    // Validate user input FIRST (unless bypassed)
    console.log(`🚨 MAIN_PROCESSING: About to validate - bypassValidation=${bypassValidation}, step="${currentStep.id}", input="${userInput}"`);
    if (!bypassValidation) {
      console.log(`🚨 MAIN_PROCESSING: Calling validateUserInput for step "${currentStep.id}" with input "${userInput}"`);
      const validationResult = this.validateUserInput(userInput, currentStep, treatmentContext);
      console.log(`🚨 MAIN_PROCESSING: Validation result:`, validationResult);
      if (!validationResult.isValid) {
      // Special handling for multiple problems detected
      if (validationResult.error === 'MULTIPLE_PROBLEMS_DETECTED') {
        // Move to multiple problems selection step
        treatmentContext.currentStep = 'multiple_problems_selection';
        const multipleProblemsStep = currentPhase.steps.find(s => s.id === 'multiple_problems_selection');
        if (multipleProblemsStep) {
          const scriptedResponse = await this.getScriptedResponse(multipleProblemsStep, treatmentContext);
          return {
            canContinue: true,
            nextStep: 'multiple_problems_selection',
            scriptedResponse
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
    console.log(`🔍 PROCESS_INPUT: currentStepResponse="${currentStepResponse}"`);
    
    // Check if this is an internal confirmation signal that should trigger automatic step progression
    const isInternalSignal = currentStepResponse === 'GOAL_SELECTION_CONFIRMED' || 
                            currentStepResponse === 'NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED' ||
                            currentStepResponse === 'PROBLEM_SELECTION_CONFIRMED' ||
                            currentStepResponse === 'SKIP_TO_TREATMENT_INTRO' ||
                            currentStepResponse === 'ROUTE_TO_PROBLEM_INTEGRATION' ||
                            currentStepResponse === 'ROUTE_TO_IDENTITY_INTEGRATION' ||
                            currentStepResponse === 'ROUTE_TO_BELIEF_INTEGRATION' ||
                            currentStepResponse === 'ROUTE_TO_BLOCKAGE_INTEGRATION' ||
                            currentStepResponse === 'ROUTE_TO_TRAUMA_INTEGRATION' ||
                            currentStepResponse === 'METHOD_SELECTION_NEEDED' ||
                            currentStepResponse === 'PROBLEM_SHIFTING_SELECTED' ||
                            currentStepResponse === 'IDENTITY_SHIFTING_SELECTED' ||
                            currentStepResponse === 'BELIEF_SHIFTING_SELECTED' ||
                            currentStepResponse === 'BLOCKAGE_SHIFTING_SELECTED';
    
    if (isInternalSignal) {
      console.log(`🔍 PROCESS_INPUT: Internal signal detected, proceeding to determine next step automatically`);
      // For internal signals, we need to determine the next step and continue processing
      const nextStepId = this.determineNextStep(currentStep, treatmentContext);
      console.log(`🔍 PROCESS_INPUT: Auto-progression nextStepId="${nextStepId}", currentPhase="${treatmentContext.currentPhase}"`);
      
      if (nextStepId) {
        treatmentContext.currentStep = nextStepId;
        console.log(`🔍 PROCESS_INPUT: Auto-progression UPDATED currentStep to "${nextStepId}"`);
        console.log(`🔍 PROCESS_INPUT: Auto-progression context after step update:`, JSON.stringify({
          sessionId: treatmentContext.sessionId,
          currentPhase: treatmentContext.currentPhase,
          currentStep: treatmentContext.currentStep,
          workType: treatmentContext.metadata.workType,
          selectedMethod: treatmentContext.metadata.selectedMethod
        }, null, 2));
        
        // Get the correct phase after potential phase change
        const updatedPhase = this.phases.get(treatmentContext.currentPhase);
        console.log(`🔍 PROCESS_INPUT: Auto-progression looking for step "${nextStepId}" in phase "${treatmentContext.currentPhase}"`);
        
        if (!updatedPhase) {
          throw new Error(`Invalid updated phase: ${treatmentContext.currentPhase}`);
        }
        
        const nextStep = updatedPhase.steps.find(s => s.id === nextStepId);
        console.log(`🔍 PROCESS_INPUT: Auto-progression found nextStep:`, nextStep ? `YES (${nextStep.id})` : 'NO');
        console.log(`🔍 PROCESS_INPUT: Available steps in phase "${treatmentContext.currentPhase}":`, updatedPhase.steps.map(s => s.id));
        console.log(`🔍 PROCESS_INPUT: Looking for step "${nextStepId}" in phase "${treatmentContext.currentPhase}"`);
        
        if (nextStep) {
          const actualResponse = this.getScriptedResponse(nextStep, treatmentContext, userInput);
          const needsLinguisticProcessing = this.isLinguisticProcessingStep(nextStep.id, treatmentContext);
          
          console.log(`🔍 PROCESS_INPUT: Auto-progression final response="${actualResponse}"`);
                  // Save the updated context back to the contexts map
        this.contexts.set(treatmentContext.sessionId, treatmentContext);
        console.log(`🔍 PROCESS_INPUT: Auto-progression SAVED context for session ${treatmentContext.sessionId}`);
        
        // Persist context to database
        this.saveContextToDatabase(treatmentContext).catch(error => 
          console.error('Failed to save context to database:', error)
        );
        
        // NEW: Pre-load next likely responses in background
        setTimeout(() => {
          this.preloadNextResponses(treatmentContext.sessionId);
        }, 100); // Small delay to avoid blocking current response
        
        return {
          canContinue: true,
          nextStep: nextStepId,
          scriptedResponse: actualResponse,
          needsLinguisticProcessing
        };
        } else {
          console.error(`❌ PROCESS_INPUT: Auto-progression step '${nextStepId}' not found in phase '${treatmentContext.currentPhase}'`);
          console.error(`❌ PROCESS_INPUT: Available steps:`, updatedPhase.steps.map(s => s.id));
          console.error(`❌ PROCESS_INPUT: Context metadata:`, JSON.stringify(treatmentContext.metadata, null, 2));
          throw new Error(`Step '${nextStepId}' not found in phase '${treatmentContext.currentPhase}'. Available steps: ${updatedPhase.steps.map(s => s.id).join(', ')}`);
        }
      }
    }

    // Regular flow - proceed to next step
    const nextStepId = this.determineNextStep(currentStep, treatmentContext);
    console.log(`🔍 PROCESS_INPUT: Regular flow nextStepId="${nextStepId}", currentPhase="${treatmentContext.currentPhase}"`);
    
    if (nextStepId) {
      treatmentContext.currentStep = nextStepId;
      console.log(`🔍 PROCESS_INPUT: Regular flow UPDATED currentStep to "${nextStepId}"`);
      console.log(`🔍 PROCESS_INPUT: Regular flow context after step update:`, JSON.stringify({
        sessionId: treatmentContext.sessionId,
        currentPhase: treatmentContext.currentPhase,
        currentStep: treatmentContext.currentStep,
        workType: treatmentContext.metadata.workType,
        selectedMethod: treatmentContext.metadata.selectedMethod
      }, null, 2));
      
      // Get the correct phase after potential phase change
      const updatedPhase = this.phases.get(treatmentContext.currentPhase);
      console.log(`🔍 PROCESS_INPUT: Looking for step "${nextStepId}" in phase "${treatmentContext.currentPhase}"`);
      
      if (!updatedPhase) {
        throw new Error(`Invalid updated phase: ${treatmentContext.currentPhase}`);
      }
      
              const nextStep = updatedPhase.steps.find(s => s.id === nextStepId);
        console.log(`🔍 PROCESS_INPUT: Regular flow found nextStep:`, nextStep ? `YES (${nextStep.id})` : 'NO');
        console.log(`🔍 PROCESS_INPUT: Regular flow available steps in phase "${treatmentContext.currentPhase}":`, updatedPhase.steps.map(s => s.id));
        console.log(`🔍 PROCESS_INPUT: Regular flow looking for step "${nextStepId}" in phase "${treatmentContext.currentPhase}"`);
      
      if (nextStep) {
        const scriptedResponse = this.getScriptedResponse(nextStep, treatmentContext, userInput);
        const needsLinguisticProcessing = this.isLinguisticProcessingStep(nextStep.id, treatmentContext);
        
        // CRITICAL FIX: Check if this new step's response is also a signal that needs auto-progression
        const isSignalResponse = scriptedResponse === 'GOAL_SELECTION_CONFIRMED' || 
                                scriptedResponse === 'NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED' ||
                                scriptedResponse === 'PROBLEM_SELECTION_CONFIRMED' ||
                                scriptedResponse === 'SKIP_TO_TREATMENT_INTRO' ||
                                scriptedResponse === 'ROUTE_TO_PROBLEM_INTEGRATION' ||
                                scriptedResponse === 'ROUTE_TO_IDENTITY_INTEGRATION' ||
                                scriptedResponse === 'ROUTE_TO_BELIEF_INTEGRATION' ||
                                scriptedResponse === 'ROUTE_TO_BLOCKAGE_INTEGRATION' ||
                                scriptedResponse === 'ROUTE_TO_TRAUMA_INTEGRATION' ||
                                scriptedResponse === 'METHOD_SELECTION_NEEDED' ||
                                scriptedResponse === 'PROBLEM_SHIFTING_SELECTED' ||
                                scriptedResponse === 'IDENTITY_SHIFTING_SELECTED' ||
                                scriptedResponse === 'BELIEF_SHIFTING_SELECTED' ||
                                scriptedResponse === 'BLOCKAGE_SHIFTING_SELECTED';
        
        if (isSignalResponse) {
          console.log(`🔍 PROCESS_INPUT: Signal detected in next step response: "${scriptedResponse}", continuing auto-progression`);
          // This is a signal, we need to auto-progress ONE MORE time
          const finalNextStepId = this.determineNextStep(nextStep, treatmentContext);
          console.log(`🔍 PROCESS_INPUT: Signal auto-progression to final step: "${finalNextStepId}"`);
          
          if (finalNextStepId) {
            treatmentContext.currentStep = finalNextStepId;
            const finalPhase = this.phases.get(treatmentContext.currentPhase);
            if (finalPhase) {
              const finalStep = finalPhase.steps.find(s => s.id === finalNextStepId);
              if (finalStep) {
                const finalResponse = this.getScriptedResponse(finalStep, treatmentContext, userInput);
                const finalNeedsLinguistic = this.isLinguisticProcessingStep(finalStep.id, treatmentContext);
                
                // Save context
                this.contexts.set(treatmentContext.sessionId, treatmentContext);
                this.saveContextToDatabase(treatmentContext).catch(error => 
                  console.error('Failed to save context to database:', error)
                );
                
                // Pre-load next responses
                setTimeout(() => {
                  this.preloadNextResponses(treatmentContext.sessionId);
                }, 100);
                
                return {
                  canContinue: true,
                  nextStep: finalNextStepId,
                  scriptedResponse: finalResponse,
                  needsLinguisticProcessing: finalNeedsLinguistic
                };
              }
            }
          }
        }
        
        // Not a signal, return normally
        // Save the updated context back to the contexts map
        this.contexts.set(treatmentContext.sessionId, treatmentContext);
        console.log(`🔍 PROCESS_INPUT: Regular flow SAVED context for session ${treatmentContext.sessionId}`);
        
        // Persist context to database
        this.saveContextToDatabase(treatmentContext).catch(error => 
          console.error('Failed to save context to database:', error)
        );
        
        // NEW: Pre-load next likely responses in background
        setTimeout(() => {
          this.preloadNextResponses(treatmentContext.sessionId);
        }, 100); // Small delay to avoid blocking current response
        
        return {
          canContinue: true,
          nextStep: nextStepId,
          scriptedResponse,
          needsLinguisticProcessing
        };
      } else {
        console.error(`❌ PROCESS_INPUT: Step '${nextStepId}' not found in phase '${treatmentContext.currentPhase}'`);
        console.error(`❌ PROCESS_INPUT: Available steps:`, updatedPhase.steps.map(s => s.id));
        console.error(`❌ PROCESS_INPUT: Context metadata:`, JSON.stringify(treatmentContext.metadata, null, 2));
        throw new Error(`Step '${nextStepId}' not found in phase '${treatmentContext.currentPhase}'. Available steps: ${updatedPhase.steps.map(s => s.id).join(', ')}`);
      }
    }

    // Phase complete or error
    return this.handlePhaseCompletion(treatmentContext);
  }

  /**
   * Check if current step requires linguistic processing (for natural language flow)
   */
  private isLinguisticProcessingStep(stepId: string, context?: TreatmentContext): boolean {
    // Check if we should skip linguistic processing (when cycling back)
    if (context?.metadata?.skipLinguisticProcessing) {
      return false;
    }
    
    // Problem Shifting steps
    // REMOVED: 'feel_solution_state' - Now uses scripted response with previous answer for instant performance
    const problemShiftingSteps: string[] = [];
    
    // Reality Shifting steps - ALL REMOVED: Now use pure scripted responses per flowchart
    // Previously included: reality_step_a2, reality_feel_reason, reality_feel_reason_2, reality_feel_reason_3
    
    
    // Blockage Shifting steps that need linguistic processing
    const blockageShiftingSteps: string[] = [
      // REMOVED: 'blockage_step_b' - Use user's exact words to preserve their agency
      // REMOVED: 'blockage_step_d' - Use user's exact words to preserve their agency
    ];
    
    // Belief Shifting steps that need linguistic processing
    const beliefShiftingSteps: string[] = [
      // REMOVED: 'belief_step_b' - Use scripted response with user's exact words
      // REMOVED: 'belief_step_e' - Use scripted response with user's exact words to preserve agency
    ];
    
    // Identity Shifting steps that need linguistic processing
    const identityShiftingSteps: string[] = [
      // REMOVED: 'identity_dissolve_step_a' - Use scripted response for faster performance (already has perfect scripted logic)
      // REMOVED: 'identity_dissolve_step_b' - Use scripted response for better performance (already has perfect scripted logic)
      // 'identity_check' REMOVED - should use stored originalProblemIdentity, not AI processing
    ];
    
    // Trauma Shifting steps that need linguistic processing
    // REMOVED: 'trauma_dissolve_step_a' - Use scripted response with user's exact words to preserve agency and match protocol flowchart
    // REMOVED: 'trauma_dissolve_step_b' - Use scripted response for faster performance (already has perfect scripted logic)
    const traumaShiftingSteps: string[] = [
      // 'trauma_identity_check' REMOVED - should use stored originalTraumaIdentity, not AI processing
    ];
    
    // All modality intro steps that need linguistic processing for user input contextualisation
    const introSteps = [
      'problem_shifting_intro',  // Ensure problem is stated as a problem
      'reality_shifting_intro',  // Ensure goal is stated as a goal  
      'blockage_shifting_intro', // Ensure problem is stated as a problem
      // 'identity_shifting_intro' REMOVED - should store identity response directly, not process with AI
      // 'trauma_shifting_intro',   // REMOVED - This is a simple yes/no question, no AI needed
      'belief_shifting_intro'    // Ensure problem is stated as a problem
    ];
    
    return problemShiftingSteps.includes(stepId) || blockageShiftingSteps.includes(stepId) || beliefShiftingSteps.includes(stepId) || identityShiftingSteps.includes(stepId) || traumaShiftingSteps.includes(stepId) || introSteps.includes(stepId);
  }

  /**
   * Get instant scripted response - <200ms performance target
   * NEW: Enhanced with caching for even faster responses
   */
  private getScriptedResponse(step: TreatmentStep, context: TreatmentContext, currentUserInput?: string): string {
    const startTime = performance.now();
    
    // NEW: Try cache first for static responses
    if (typeof step.scriptedResponse === 'string') {
      const cacheKey = `static_${step.id}`;
      const cached = this.getCachedResponse(cacheKey);
      if (cached) {
        this.responseCache.hitCount++;
        console.log(`🚀 CACHE_HIT: Static response for step "${step.id}" (${Math.round(performance.now() - startTime)}ms)`);
        return cached;
      }
    }
    
    // Generate response (existing logic)
    let response: string;
    if (typeof step.scriptedResponse === 'function') {
      // Use current user input if provided, otherwise fall back to previous step response
      const userInput = currentUserInput || (() => {
        const previousStepId = this.getPreviousStep(step.id, context.currentPhase);
        return previousStepId ? context.userResponses[previousStepId] : undefined;
      })();
      
      // NEW: Try cache for dynamic responses with context hash
      // CRITICAL FIX: Don't use cache for steps that depend on user input or digging context
      // All intro steps must skip cache to prevent cross-session contamination with session-specific problem statements
      const shouldSkipCache = step.id === 'identity_shifting_intro' ||
                            step.id === 'belief_shifting_intro' ||
                            step.id === 'problem_shifting_intro' ||
                            step.id === 'trauma_shifting_intro' ||
                            step.id === 'trauma_identity_step' ||
                            step.id === 'trauma_dissolve_step_a' ||
                            step.id === 'trauma_dissolve_step_b' ||
                            step.id === 'trauma_dissolve_step_c' ||
                            step.id === 'trauma_dissolve_step_d' ||
                            step.id === 'trauma_dissolve_step_e' ||
                            step.id === 'trauma_identity_check' ||
                            step.id === 'trauma_future_identity_check' ||
                            step.id === 'trauma_future_scenario_check' ||
                            step.id === 'trauma_future_step_c' ||
                            step.id === 'trauma_future_step_d' ||
                            step.id === 'trauma_future_step_e' ||
                            step.id === 'trauma_future_step_f' ||
                            step.id === 'blockage_shifting_intro' ||
                            // Integration steps that reference problem statement - must skip cache to prevent cross-session contamination
                            step.id === 'integration_start' ||
                            step.id === 'intention_question' ||
                            // Checking steps that embed session-specific identity/problem data - always skip cache
                            step.id === 'identity_future_check' ||
                            step.id === 'identity_scenario_check' ||
                            step.id === 'future_problem_check' ||
                            step.id === 'trauma_experience_check' ||
                            // CRITICAL: Blockage steps b and d embed userInput directly - never cache to prevent cross-cycle contamination
                            step.id === 'blockage_step_b' ||
                            step.id === 'blockage_step_d' ||
                            // CRITICAL: Problem Shifting steps that embed user-specific data - never cache
                            step.id === 'body_sensation_check' ||
                            step.id === 'what_needs_to_happen_step' ||
                            step.id === 'blockage_check_if_still_problem' ||
                            (step.id === 'check_if_still_problem' && context.metadata?.currentDiggingProblem) ||
                            (step.id === 'identity_problem_check' && context.metadata?.currentDiggingProblem) ||
                            (step.id === 'belief_problem_check' && context.metadata?.currentDiggingProblem) ||
                            step.id === 'digging_method_selection' ||
                                        // Steps that use user input directly and should never be cached
            (step.id === 'feel_good_state' && userInput?.trim()) ||
            (step.id === 'what_happens_step' && userInput?.trim()) ||
            (step.id === 'belief_step_a' && userInput?.trim()) ||
            (step.id === 'belief_step_b' && userInput?.trim()) ||
            (step.id === 'belief_step_d' && userInput?.trim()) ||
            (step.id === 'belief_step_e' && userInput?.trim()) ||
            // CRITICAL: Identity dissolve steps use user-specific identity/responses - never cache to prevent cross-session contamination
            step.id === 'identity_dissolve_step_a' ||
            step.id === 'identity_dissolve_step_b' ||
            step.id === 'identity_dissolve_step_c' ||
            step.id === 'identity_dissolve_step_d' ||
            step.id === 'identity_dissolve_step_e' ||
            step.id === 'identity_dissolve_step_f' ||
            // CRITICAL: Trauma dissolve steps that reference previous step responses - never cache to prevent iteration conflicts
            step.id === 'trauma_dissolve_step_b' ||
            step.id === 'trauma_dissolve_step_d' ||
            step.id === 'trauma_dissolve_step_e' ||
                                        // Goal-related steps that depend on dynamic goal context - never cache to prevent cross-session conflicts
            step.id === 'goal_confirmation' ||
            step.id === 'reality_shifting_intro' ||
            // Work type and problem-related steps that depend on dynamic context
            step.id === 'work_type_description' ||
            step.id === 'confirm_statement' ||  // CRITICAL: Skip cache to prevent stale problem statement in confirmation
                            // Reality Shifting A/B loop steps - never cache to prevent cross-iteration conflicts
                            step.id === 'reality_column_a_restart' ||
                            step.id === 'reality_step_a2' ||
                            step.id === 'reality_step_a3' ||
                            step.id === 'reality_feel_reason' ||
                            step.id === 'reality_feel_reason_2' ||
                            step.id === 'reality_feel_reason_3' ||
                            // Reality Shifting doubt reason - depends on dynamic doubt percentage that changes between iterations
                            step.id === 'reality_doubt_reason' ||
                            // CRITICAL: Steps that depend on previous userResponses - never cache to prevent cross-problem conflicts
                            step.id === 'feel_solution_state' ||  // Uses userResponses['what_needs_to_happen_step']
                            step.id === 'reality_cycle_b2' ||      // Uses userResponses['reality_doubt_reason']
                            step.id === 'reality_cycle_b4' ||      // Uses userResponses['reality_cycle_b3']
                            step.id === 'analyze_response';        // Uses userResponses['mind_shifting_explanation'] before problemStatement is set
      let cacheKey: string | undefined;
      
      if (!shouldSkipCache) {
        const contextHash = this.generateContextHash(step.id, userInput, context);
        cacheKey = `dynamic_${step.id}_${contextHash}`;
        const cached = this.getCachedResponse(cacheKey);
        if (cached) {
          this.responseCache.hitCount++;
          console.log(`🚀 CACHE_HIT: Dynamic response for step "${step.id}" (${Math.round(performance.now() - startTime)}ms)`);
          return cached;
        }
      } else {
        const diggingProblem = context.metadata?.currentDiggingProblem;
        if (step.id === 'identity_shifting_intro') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for identity_shifting_intro to prevent cross-session problem contamination`);
        } else if (step.id === 'belief_shifting_intro') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for belief_shifting_intro to prevent cross-session problem contamination`);
        } else if (step.id === 'problem_shifting_intro') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for problem_shifting_intro to prevent cross-session problem contamination`);
        } else if (step.id === 'blockage_shifting_intro') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for blockage_shifting_intro to prevent cross-session problem contamination`);
        } else if (step.id === 'identity_future_check') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for identity_future_check to prevent cross-session identity contamination`);
        } else if (step.id === 'identity_scenario_check') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for identity_scenario_check to prevent cross-session identity contamination`);
        } else if (step.id === 'future_problem_check') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for future_problem_check to prevent cross-session problem contamination`);
        } else if (step.id.startsWith('blockage_step_')) {
          console.log(`🚀 CACHE_SKIP: Skipping cache for ${step.id} on subsequent cycle (cycleCount: ${context.metadata?.cycleCount})`);
        } else if (step.id === 'check_if_still_problem') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for check_if_still_problem in digging deeper mode (currentDiggingProblem: ${diggingProblem})`);
        } else if (step.id === 'blockage_check_if_still_problem') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for blockage_check_if_still_problem in digging deeper mode (currentDiggingProblem: ${diggingProblem})`);
        } else if (step.id === 'identity_problem_check') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for identity_problem_check in digging deeper mode (currentDiggingProblem: ${diggingProblem})`);
        } else if (step.id === 'belief_problem_check') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for belief_problem_check in digging deeper mode (currentDiggingProblem: ${diggingProblem})`);
        } else if (step.id === 'goal_confirmation') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for goal_confirmation to prevent cross-session goal conflicts (currentGoal: ${context.metadata?.currentGoal})`);
        } else if (step.id === 'reality_shifting_intro') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for reality_shifting_intro to prevent cross-session goal conflicts (goalWithDeadline: ${context.metadata?.goalWithDeadline})`);
        } else if (step.id === 'work_type_description') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for work_type_description to prevent cross-session context conflicts (workType: ${context.metadata?.workType}, problemStatement: ${context.metadata?.problemStatement})`);
        } else if (step.id === 'confirm_statement') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for confirm_statement to prevent stale problem statement in confirmation (problemStatement: ${context.metadata?.problemStatement})`);
        } else if (step.id === 'problem_shifting_intro') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for problem_shifting_intro to prevent cross-session problem conflicts (problemStatement: ${context.metadata?.problemStatement || context.problemStatement})`);
        } else if (step.id === 'reality_doubt_reason') {
          console.log(`🚀 CACHE_SKIP: Skipping cache for reality_doubt_reason to prevent cross-iteration doubt percentage conflicts (doubtPercentage: ${context.metadata?.doubtPercentage}%)`);
        }
      }
      
      response = step.scriptedResponse(userInput, context);
      
      // NEW: Cache the dynamic response (only if we have a cacheKey)
      if (cacheKey) {
        this.setCachedResponse(cacheKey, response, step.id);
      }
    } else {
      response = step.scriptedResponse;
      
      // NEW: Cache the static response
      const cacheKey = `static_${step.id}`;
      this.setCachedResponse(cacheKey, response, step.id);
    }
    
    this.responseCache.missCount++;
    const responseTime = Math.round(performance.now() - startTime);
    console.log(`🚀 CACHE_MISS: Generated response for step "${step.id}" (${responseTime}ms)`);
    
    return response;
  }

  /**
   * NEW: Get cached response if valid
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
   * NEW: Set cached response
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
   * NEW: Generate simple hash for context-dependent responses
   */
  private generateContextHash(stepId: string, userInput: string | undefined, context: TreatmentContext): string {
    const relevantData = {
      stepId,
      userInput: userInput || '',
      workType: context.metadata.workType,
      selectedMethod: context.metadata.selectedMethod,
      currentPhase: context.currentPhase,
      // Only include relevant metadata that affects response generation
      problemStatement: context.problemStatement,
      originalProblemStatement: context.metadata.originalProblemStatement, // For digging deeper questions
      currentBelief: context.metadata.currentBelief,
      desiredFeeling: context.metadata.desiredFeeling,
      // Goal-related metadata for proper cache differentiation
      currentGoal: context.metadata.currentGoal,
      goalWithDeadline: context.metadata.goalWithDeadline,
      // Problem-related metadata for proper cache differentiation
      currentDiggingProblem: context.metadata.currentDiggingProblem,
      // Identity Shifting specific metadata for proper cache differentiation
      identityResponse: context.metadata.identityResponse,
      currentIdentity: context.metadata.currentIdentity
    };
    
    // Simple hash - could be improved with actual hash function if needed
    return btoa(JSON.stringify(relevantData)).substring(0, 16);
  }

  /**
   * NEW: Pre-load likely next responses in background
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
   * NEW: Predict most likely next steps based on current context
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
          // Most common flows after problem explanation
          predictions.push('work_type_description', 'goal_description', 'negative_experience_description');
        }
        break;
      
      case 'problem_shifting':
        // Sequential flow is predictable
        const problemSteps = ['problem_shifting_intro', 'body_sensation_check', 'feel_solution_state'];
        const currentIndex = problemSteps.indexOf(context.currentStep);
        if (currentIndex >= 0 && currentIndex < problemSteps.length - 1) {
          predictions.push(problemSteps[currentIndex + 1]);
        }
        break;
        
      // Add more phase-specific predictions as needed
    }
    
    return predictions.slice(0, 3); // Limit to top 3 predictions
  }

  /**
   * NEW: Get performance metrics for monitoring
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    const total = this.responseCache.hitCount + this.responseCache.missCount;
    return {
      cacheHitRate: total > 0 ? (this.responseCache.hitCount / total) * 100 : 0,
      averageResponseTime: 0, // Could be enhanced to track this
      preloadedResponsesUsed: this.responseCache.preloadedResponses.size,
      totalResponses: total
    };
  }

  /**
   * Clear identity-related cached responses to fix incorrect caching
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
   * Clear goal-related cached responses to fix incorrect goal caching
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
   * Clear cached responses for specific steps (called during undo)
   * This removes stale cached responses that may have old user input embedded
   */
  public invalidateCacheForSteps(stepIds: string[]): void {
    if (!stepIds || stepIds.length === 0) {
      console.log('🧹 CACHE_INVALIDATION: No steps to invalidate');
      return;
    }
    
    let clearedCount = 0;
    stepIds.forEach(stepId => {
      // Clear all cache entries that contain this stepId
      // This includes both static and dynamic cache entries
      this.responseCache.cache.forEach((_, key) => {
        if (key.includes(stepId)) {
          this.responseCache.cache.delete(key);
          clearedCount++;
        }
      });
    });
    
    console.log(`🧹 UNDO_CACHE_CLEAR: Invalidated ${clearedCount} cache entries for ${stepIds.length} undone steps`);
  }

  /**
   * Clear previous modality-specific metadata when switching modalities
   * This ensures a clean switch without interference from previous modality state
   */
  private clearPreviousModalityMetadata(context: TreatmentContext): void {
    console.log('🔍 MODALITY_CLEANUP: Clearing previous modality metadata');
    
    // Clear belief-specific metadata
    delete context.metadata.currentBelief;
    delete context.metadata.cycleCount;
    
    // Clear identity-specific metadata
    delete context.metadata.currentIdentity;
    
    // Clear blockage-specific metadata
    delete context.metadata.currentBlockage;
    
    // Clear reality-specific metadata
    delete context.metadata.currentReality;
    
    // Clear trauma-specific metadata
    delete context.metadata.currentTrauma;
    
    // Keep digging-deeper specific metadata as it's needed for the flow
    // Keep: currentDiggingProblem, newDiggingProblem, returnToDiggingStep, selectedMethod, workType
    
    console.log('🔍 MODALITY_CLEANUP: Cleared previous modality metadata, kept digging-deeper context');
  }

  /**
   * Validate percentage input (0-100)
   */
  private validatePercentageInput(userInput: string): { isValid: boolean; error?: string; percentage?: number } {
    const trimmed = userInput.trim();
    
    // Try to extract a number from the input (handles "50", "50%", "fifty", etc.)
    const numberMatch = trimmed.match(/(\d+)/);
    
    if (!numberMatch) {
      return { isValid: false, error: 'Please give me a percentage between 0 and 100.' };
    }
    
    const percentage = parseInt(numberMatch[1]);
    
    if (isNaN(percentage)) {
      return { isValid: false, error: 'Please give me a percentage between 0 and 100.' };
    }
    
    if (percentage < 0 || percentage > 100) {
      return { isValid: false, error: 'Please give me a percentage between 0 and 100.' };
    }
    
    return { isValid: true, percentage };
  }

  /**
   * Validate user input against step requirements
   */
  private validateUserInput(userInput: string, step: TreatmentStep, context?: TreatmentContext): { isValid: boolean; error?: string } {
    const trimmed = userInput.trim();
    const words = trimmed.split(' ').length;
    const lowerInput = trimmed.toLowerCase();
    
    console.log(`🚨 VALIDATION_CALLED: step="${step.id}", input="${userInput}", trimmed="${trimmed}", words=${words}`);
    
    // Special validation for percentage inputs in Reality Shifting
    if (step.id === 'goal_certainty' || step.id === 'reality_checking_questions') {
      const percentageValidation = this.validatePercentageInput(userInput);
      if (!percentageValidation.isValid) {
        return { isValid: false, error: percentageValidation.error };
      }
      return { isValid: true };
    }
    
    // Special validation for introduction phase
    if (step.id === 'mind_shifting_explanation') {
      // Skip validation for work type selection inputs (1, 2, 3)
      if (trimmed === '1' || trimmed === '2' || trimmed === '3') {
        return { isValid: true };
      }
      
      // Check if user stated it as a goal instead of problem - FLAG FOR AI VALIDATION
      // Improved logic to avoid false positives with "get" in problem contexts
      const goalIndicators = ['want to', 'want', 'wish to', 'hope to', 'plan to', 'goal', 'achieve', 'become', 'have', 'need to', 'would like to'];
      
      // Special handling for "get" - only flag as goal if used in positive/aspirational context
      const hasBasicGoalLanguage = goalIndicators.some(indicator => lowerInput.includes(indicator));
      const hasGetInGoalContext = lowerInput.includes('get') && (
        lowerInput.includes('get better') || 
        lowerInput.includes('get rid of') ||
        lowerInput.includes('get over') ||
        lowerInput.includes('get help') ||
        lowerInput.includes('get to') ||
        lowerInput.includes('get more') ||
        lowerInput.match(/\bget\s+(a|an|some|the)\s+\w+/) // "get a job", "get the promotion", etc.
      );
      
      const hasGoalLanguage = hasBasicGoalLanguage || hasGetInGoalContext;
      
      if (hasGoalLanguage) {
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:problem_vs_goal' };
      }
      
      // Check if user stated it as a question - FLAG FOR AI VALIDATION
      const questionIndicators = ['how can', 'what should', 'why do', 'when will', 'where can', 'should i'];
      const hasQuestionLanguage = questionIndicators.some(indicator => lowerInput.includes(indicator)) || trimmed.endsWith('?');
      
      if (hasQuestionLanguage) {
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:problem_vs_question' };
      }
      
      // Check if user stated only a general emotion without context - FLAG FOR AI VALIDATION
      const generalEmotionPatterns = [
        // Direct "I feel/am [emotion]" patterns
        /^i\s+(feel|am|feel\s+like)\s+(mad|angry|sad|upset|stressed|anxious|worried|depressed|frustrated|scared|nervous|happy|excited|overwhelmed|confused|lost|stuck|tired|exhausted|lonely|hurt|disappointed|ashamed|guilty|embarrassed|helpless|hopeless|irritated|annoyed|furious|devastated|miserable|panicked|terrified|disgusted|bitter|resentful|jealous|envious|insecure|worthless|empty|numb|restless|impatient|bored|content|peaceful|grateful|proud|confident|optimistic|motivated|inspired|relieved|surprised|curious|playful|loving|joyful|blissful|serene|calm|relaxed|unhappy|uncomfortable|uneasy|troubled|disturbed|distressed)\.?$/i,
        // Simple emotion words (1-3 words max)
        /^(mad|angry|sad|upset|stressed|anxious|worried|depressed|frustrated|scared|nervous|happy|excited|overwhelmed|confused|lost|stuck|tired|exhausted|lonely|hurt|disappointed|ashamed|guilty|embarrassed|helpless|hopeless|irritated|annoyed|furious|devastated|miserable|panicked|terrified|disgusted|bitter|resentful|jealous|envious|insecure|worthless|empty|numb|restless|impatient|bored|content|peaceful|grateful|proud|confident|optimistic|motivated|inspired|relieved|surprised|curious|playful|loving|joyful|blissful|serene|calm|relaxed|unhappy|uncomfortable|uneasy|troubled|disturbed|distressed)\.?$/i,
        // "Feeling [emotion]" patterns
        /^feeling\s+(mad|angry|sad|upset|stressed|anxious|worried|depressed|frustrated|scared|nervous|happy|excited|overwhelmed|confused|lost|stuck|tired|exhausted|lonely|hurt|disappointed|ashamed|guilty|embarrassed|helpless|hopeless|irritated|annoyed|furious|devastated|miserable|panicked|terrified|disgusted|bitter|resentful|jealous|envious|insecure|worthless|empty|numb|restless|impatient|bored|content|peaceful|grateful|proud|confident|optimistic|motivated|inspired|relieved|surprised|curious|playful|loving|joyful|blissful|serene|calm|relaxed|unhappy|uncomfortable|uneasy|troubled|disturbed|distressed)\.?$/i
      ];
      
      const hasGeneralEmotionPattern = generalEmotionPatterns.some(pattern => pattern.test(lowerInput));
      console.log(`🚨 EMOTION_PATTERN_CHECK: input="${lowerInput}", hasGeneralEmotionPattern=${hasGeneralEmotionPattern}`);
      
      if (hasGeneralEmotionPattern) {
        // Store the original emotion for later use
        if (context) {
          const emotion = this.extractEmotionFromInput(lowerInput);
          context.metadata.originalEmotion = emotion;
          console.log(`🔍 EMOTION_STORED: Stored originalEmotion="${emotion}" in context metadata`);
        }
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:general_emotion' };
      }
      
      // Legacy simple emotion check for backwards compatibility (now less likely to trigger due to above patterns)
      const emotionWords = ['stressed', 'anxious', 'sad', 'angry', 'worried', 'depressed', 'frustrated', 'upset', 'scared', 'nervous'];
      if (words <= 2 && emotionWords.some(emotion => lowerInput.includes(emotion))) {
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:general_emotion' };
      }
      
      // Only check for multiple problems if this is NOT trauma shifting
      // Trauma shifting handles single event validation separately
      const isTraumaShifting = context?.metadata?.workType === 'negative_experience' || 
                               context?.metadata?.selectedMethod === 'trauma_shifting';
      
      if (!isTraumaShifting) {
        // For non-trauma modalities, we no longer enforce single problem validation
        // Users can describe ongoing patterns or general issues
        console.log(`🔍 MIND_SHIFTING_EXPLANATION: Skipping multiple problems validation for non-trauma modality`);
      } else {
        // For trauma shifting, the single event validation is handled in work_type_description step
        console.log(`🔍 MIND_SHIFTING_EXPLANATION: Trauma shifting detected - single event validation handled elsewhere`);
      }
      
      // Check if too long (over 20 words)
      if (words > 20) {
        return { isValid: false, error: 'OK I understand what you have said, but please tell me what the problem is in just a few words' };
      }
    }
    
    // Special validation for negative experience description step
    if (step.id === 'negative_experience_description') {
      // Check for multiple event indicators
      const multipleEventIndicators = [
        'always', 'often', 'repeatedly', 'throughout', 'during my childhood',
        'as a child', 'growing up', 'my entire childhood', 'for years',
        'every time', 'whenever', 'all the time', 'when I was young',
        'in my childhood', 'as a kid', 'while growing up'
      ];
      
      const hasMultipleEventIndicators = multipleEventIndicators.some(indicator => 
        lowerInput.includes(indicator)
      );
      
      if (hasMultipleEventIndicators) {
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:single_negative_experience' };
      }
    }

    // Special validation for goal description and goal capture
    if (step.id === 'goal_description' || step.id === 'reality_goal_capture') {
      console.log(`🔍 GOAL_VALIDATION: Checking input in step "${step.id}": "${userInput}" (lowercase: "${lowerInput}")`);
      // Check if user stated it as a problem instead of goal - FLAG FOR AI VALIDATION
      const problemIndicators = ['problem', 'issue', 'trouble', 'difficulty', 'struggle', 'can\'t', 'cannot', 'unable to', 'don\'t', 'do not', 'not able', 'hard to', 'difficult to', 'not enough', 'lack of', 'need more'];
      const hasProblemLanguage = problemIndicators.some(indicator => lowerInput.includes(indicator));
      
      console.log(`🔍 GOAL_VALIDATION: Problem indicators check - hasProblemLanguage: ${hasProblemLanguage}`);
      if (hasProblemLanguage) {
        const matchedIndicator = problemIndicators.find(indicator => lowerInput.includes(indicator));
        console.log(`🔍 GOAL_VALIDATION: Matched problem indicator: "${matchedIndicator}"`);
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:goal_vs_problem' };
      }
      
      // Check if user stated it as a question - FLAG FOR AI VALIDATION  
      const questionIndicators = ['how can', 'what should', 'why do', 'when will', 'where can', 'should i', 'how do i', 'what can i'];
      const hasQuestionLanguage = questionIndicators.some(indicator => lowerInput.includes(indicator)) || trimmed.endsWith('?');
      
      console.log(`🔍 GOAL_VALIDATION: Question indicators check - hasQuestionLanguage: ${hasQuestionLanguage}`);
      if (hasQuestionLanguage) {
        const matchedIndicator = questionIndicators.find(indicator => lowerInput.includes(indicator));
        console.log(`🔍 GOAL_VALIDATION: Matched question indicator: "${matchedIndicator}"`);
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:goal_vs_question' };
      }
      
      console.log(`🔍 GOAL_VALIDATION: No validation issues found, allowing input`);
    }

    // Special validation for trauma shifting - negative experience should be single event
    if (step.id === 'trauma_shifting_intro') {
      // Check for multiple event indicators
      const multipleEventIndicators = [
        'always', 'often', 'repeatedly', 'throughout', 'during my childhood',
        'as a child', 'growing up', 'my entire childhood', 'for years',
        'every time', 'whenever', 'all the time'
      ];
      
      const hasMultipleEventIndicators = multipleEventIndicators.some(indicator => 
        lowerInput.includes(indicator)
      );
      
      if (hasMultipleEventIndicators) {
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:single_negative_experience' };
      }
    }
    
    // Special validation for work_type_description when asking for problems
    if (step.id === 'work_type_description' && context?.metadata?.workType === 'problem') {
      // Only validate for problem work type (not for goals or negative experiences)
      
      // Check if user stated it as a goal instead of problem
      // Improved logic to avoid false positives with "get" and "have" in problem contexts
      const goalIndicators = ['want to', 'wish to', 'hope to', 'plan to', 'goal', 'achieve', 'become', 'need to', 'would like to'];
      
      // Special handling for "get" - only flag as goal if used in positive/aspirational context
      const hasBasicGoalLanguage = goalIndicators.some(indicator => lowerInput.includes(indicator));
      const hasGetInGoalContext = lowerInput.includes('get') && (
        lowerInput.includes('get better') || 
        lowerInput.includes('get rid of') ||
        lowerInput.includes('get over') ||
        lowerInput.includes('get help') ||
        lowerInput.includes('get to') ||
        lowerInput.includes('get more') ||
        lowerInput.match(/\bget\s+(a|an|some|the)\s+\w+/) // "get a job", "get the promotion", etc.
      );
      
      // Special handling for "have" - only flag as goal if used in aspirational context, not when describing current problems
      const hasHaveInGoalContext = lowerInput.includes('have') && (
        lowerInput.includes('want to have') ||
        lowerInput.includes('wish to have') ||
        lowerInput.includes('hope to have') ||
        lowerInput.includes('would like to have') ||
        lowerInput.includes('plan to have') ||
        lowerInput.includes('need to have') ||
        // Positive aspirational "have" patterns
        lowerInput.match(/\bhave\s+(more|better|good|great|amazing|wonderful|perfect|ideal|successful|happy|peaceful|loving|healthy)\s+\w+/) ||
        lowerInput.match(/\bhave\s+(a|an)\s+(good|great|better|successful|happy|peaceful|loving|healthy|perfect|ideal|amazing|wonderful)\s+\w+/)
      );
      
      const hasGoalLanguage = hasBasicGoalLanguage || hasGetInGoalContext || hasHaveInGoalContext;
      
      if (hasGoalLanguage) {
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:problem_vs_goal' };
      }
      
      // Check if user stated it as a question
      const questionIndicators = ['how can', 'how do', 'what should', 'why do', 'when will', 'where can', 'should i', 'how do i', 'what can i'];
      const hasQuestionLanguage = questionIndicators.some(indicator => lowerInput.includes(indicator)) || trimmed.endsWith('?');
      
      if (hasQuestionLanguage) {
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:problem_vs_question' };
      }
      
      // Check if user stated only a general emotion without context - FLAG FOR AI VALIDATION
      const generalEmotionPatterns = [
        // Direct "I feel/am [emotion]" patterns
        /^i\s+(feel|am|feel\s+like)\s+(mad|angry|sad|upset|stressed|anxious|worried|depressed|frustrated|scared|nervous|happy|excited|overwhelmed|confused|lost|stuck|tired|exhausted|lonely|hurt|disappointed|ashamed|guilty|embarrassed|helpless|hopeless|irritated|annoyed|furious|devastated|miserable|panicked|terrified|disgusted|bitter|resentful|jealous|envious|insecure|worthless|empty|numb|restless|impatient|bored|content|peaceful|grateful|proud|confident|optimistic|motivated|inspired|relieved|surprised|curious|playful|loving|joyful|blissful|serene|calm|relaxed)\.?$/i,
        // Simple emotion words (1-3 words max)
        /^(mad|angry|sad|upset|stressed|anxious|worried|depressed|frustrated|scared|nervous|happy|excited|overwhelmed|confused|lost|stuck|tired|exhausted|lonely|hurt|disappointed|ashamed|guilty|embarrassed|helpless|hopeless|irritated|annoyed|furious|devastated|miserable|panicked|terrified|disgusted|bitter|resentful|jealous|envious|insecure|worthless|empty|numb|restless|impatient|bored|content|peaceful|grateful|proud|confident|optimistic|motivated|inspired|relieved|surprised|curious|playful|loving|joyful|blissful|serene|calm|relaxed)\.?$/i,
        // "Feeling [emotion]" patterns
        /^feeling\s+(mad|angry|sad|upset|stressed|anxious|worried|depressed|frustrated|scared|nervous|happy|excited|overwhelmed|confused|lost|stuck|tired|exhausted|lonely|hurt|disappointed|ashamed|guilty|embarrassed|helpless|hopeless|irritated|annoyed|furious|devastated|miserable|panicked|terrified|disgusted|bitter|resentful|jealous|envious|insecure|worthless|empty|numb|restless|impatient|bored|content|peaceful|grateful|proud|confident|optimistic|motivated|inspired|relieved|surprised|curious|playful|loving|joyful|blissful|serene|calm|relaxed)\.?$/i
      ];
      
      const hasGeneralEmotionPattern = generalEmotionPatterns.some(pattern => pattern.test(lowerInput));
      
      if (hasGeneralEmotionPattern) {
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:general_emotion' };
      }
      
      // Legacy simple emotion check for backwards compatibility
      const emotionWords = ['stressed', 'anxious', 'sad', 'angry', 'worried', 'depressed', 'frustrated', 'upset', 'scared', 'nervous'];
      if (words <= 2 && emotionWords.some(emotion => lowerInput.includes(emotion))) {
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:general_emotion' };
      }
      
      // Check if this is an incomplete response to emotion context question
      // This happens when user was previously asked about their emotion and gives 1-2 word response
      console.log(`🔍 INCOMPLETE_EMOTION_CHECK: originalEmotion="${context?.metadata?.originalEmotion}", words=${words}, input="${userInput}"`);
      if (context?.metadata?.originalEmotion && words <= 2 && !lowerInput.includes('yes') && !lowerInput.includes('no')) {
        console.log(`🔍 INCOMPLETE_EMOTION_CHECK: Triggering incomplete emotion context validation`);
        // Store the emotion context for later use
        if (context) {
          context.metadata.emotionContext = userInput;
          console.log(`🔍 INCOMPLETE_EMOTION_CHECK: Stored emotionContext="${userInput}"`);
        }
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:incomplete_emotion_context' };
      }
    }

    // Special validation for work_type_description when asking for negative experiences
    if (step.id === 'work_type_description' && context?.metadata?.workType === 'negative_experience') {
      // Check for multiple event indicators
      const multipleEventIndicators = [
        'always', 'often', 'repeatedly', 'throughout', 'during my childhood',
        'as a child', 'growing up', 'my entire childhood', 'for years',
        'every time', 'whenever', 'all the time', 'when I was young',
        'in my childhood', 'as a kid', 'while growing up'
      ];
      
      const hasMultipleEventIndicators = multipleEventIndicators.some(indicator => 
        lowerInput.includes(indicator)
      );
      
      if (hasMultipleEventIndicators) {
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:single_negative_experience' };
      }
    }

    // Special validation for problem-focused method intros
    const problemFocusedIntros = ['problem_shifting_intro', 'blockage_shifting_intro', 'identity_shifting_intro', 'belief_shifting_intro'];
    console.log(`🔍 PROBLEM_INTRO_CHECK: Step "${step.id}" - is in problemFocusedIntros: ${problemFocusedIntros.includes(step.id)}`);
    if (problemFocusedIntros.includes(step.id)) {
      console.log(`🔍 PROBLEM_INTRO_VALIDATION: Checking input in step "${step.id}": "${userInput}" (lowercase: "${lowerInput}")`);
      // Check if user stated it as a goal instead of problem
      // Improved logic to avoid false positives with "get" in problem contexts
      const goalIndicators = ['want to', 'want', 'wish to', 'hope to', 'plan to', 'goal', 'achieve', 'become', 'have', 'need to', 'would like to'];
      
      // Special handling for "get" - only flag as goal if used in positive/aspirational context
      const hasBasicGoalLanguage = goalIndicators.some(indicator => lowerInput.includes(indicator));
      const hasGetInGoalContext = lowerInput.includes('get') && (
        lowerInput.includes('get better') || 
        lowerInput.includes('get rid of') ||
        lowerInput.includes('get over') ||
        lowerInput.includes('get help') ||
        lowerInput.includes('get to') ||
        lowerInput.includes('get more') ||
        lowerInput.match(/\bget\s+(a|an|some|the)\s+\w+/) // "get a job", "get the promotion", etc.
      );
      
      const hasGoalLanguage = hasBasicGoalLanguage || hasGetInGoalContext;
      
      console.log(`🔍 PROBLEM_INTRO_VALIDATION: Goal indicators check - hasGoalLanguage: ${hasGoalLanguage}`);
      if (hasGoalLanguage) {
        const matchedIndicator = goalIndicators.find(indicator => lowerInput.includes(indicator));
        console.log(`🔍 PROBLEM_INTRO_VALIDATION: Matched goal indicator: "${matchedIndicator}"`);
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:problem_vs_goal' };
      }
      
      // Check if user stated it as a question
      const questionIndicators = ['how can', 'how do', 'what should', 'why do', 'when will', 'where can', 'should i', 'how do i', 'what can i'];
      const hasQuestionLanguage = questionIndicators.some(indicator => lowerInput.includes(indicator)) || trimmed.endsWith('?');
      
      console.log(`🔍 PROBLEM_INTRO_VALIDATION: Question indicators check - hasQuestionLanguage: ${hasQuestionLanguage}`);
      if (hasQuestionLanguage) {
        const matchedIndicator = questionIndicators.find(indicator => lowerInput.includes(indicator)) || (trimmed.endsWith('?') ? 'ends with ?' : '');
        console.log(`🔍 PROBLEM_INTRO_VALIDATION: Matched question indicator: "${matchedIndicator}"`);
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:problem_vs_question' };
      }
      
      console.log(`🔍 PROBLEM_INTRO_VALIDATION: No validation issues found, allowing input`);
    }

    // Special validation for work_type_description when collecting problem statements
    if (step.id === 'work_type_description' && context?.metadata?.workType === 'problem') {
      console.log(`🔍 WORK_TYPE_DESCRIPTION: Checking problem statement input "${userInput}" (lowercase: "${lowerInput}")`);
      
      // Enhanced goal detection with better context awareness
      const result = this.detectGoalLanguageInProblemContext(lowerInput, userInput);
      
      console.log(`🔍 WORK_TYPE_DESCRIPTION: Goal indicators check - hasGoalLanguage: ${result.hasGoalLanguage}`);
      if (result.hasGoalLanguage) {
        console.log(`🔍 WORK_TYPE_DESCRIPTION: Matched goal indicator: "${result.matchedIndicator}" (confidence: ${result.confidence})`);
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:problem_vs_goal' };
      }
      
      // Enhanced question detection
      const questionResult = this.detectQuestionLanguage(lowerInput, userInput);
      
      console.log(`🔍 WORK_TYPE_DESCRIPTION: Question indicators check - hasQuestionLanguage: ${questionResult.hasQuestionLanguage}`);
      if (questionResult.hasQuestionLanguage) {
        console.log(`🔍 WORK_TYPE_DESCRIPTION: Matched question indicator: "${questionResult.matchedIndicator}" (confidence: ${questionResult.confidence})`);
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:problem_vs_question' };
      }
      
      console.log(`🔍 WORK_TYPE_DESCRIPTION: No validation issues found, allowing input`);
    }
    
    // Standard validation rules
    for (const rule of step.validationRules) {
      switch (rule.type) {
        case 'minLength':
          if (trimmed.length < (rule.value as number)) {
            return { isValid: false, error: rule.errorMessage };
          }
          break;
          
        case 'maxLength':
          if (trimmed.length > (rule.value as number)) {
            return { isValid: false, error: rule.errorMessage };
          }
          break;
          
        case 'containsKeywords':
          const keywords = rule.value as string[];
          const hasKeyword = keywords.some(keyword => 
            trimmed.toLowerCase().includes(keyword.toLowerCase())
          );
          if (!hasKeyword) {
            return { isValid: false, error: rule.errorMessage };
          }
          break;
      }
    }
    
    return { isValid: true };
  }

  /**
   * Check if AI assistance is needed - only triggered in specific scenarios
   */
  private checkAITriggers(userInput: string, step: TreatmentStep, context: TreatmentContext): AITrigger | null {
    const trimmed = userInput.trim();
    const words = trimmed.split(' ').length;
    const lowerInput = trimmed.toLowerCase();
    
    for (const trigger of step.aiTriggers) {
      switch (trigger.condition) {
        case 'userStuck':
          // User says "I don't know", very short responses, or seems stuck
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
          // Response is too long - simulate 30 second interruption
          if (words > 30) {
            return trigger;
          }
          break;
          
        case 'multipleProblems':
          // Multiple problems detected in discovery phase
          const problemConnectors = ['and', 'also', 'plus', 'additionally', 'another', 'other', 'too', 'as well'];
          const problemCount = problemConnectors.filter(connector => 
            lowerInput.includes(connector)
          ).length;
          if (problemCount >= 1) {
            return trigger;
          }
          break;
          
        case 'needsClarification':
          // User seems confused or unclear about what's being asked
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
          // User went completely off-topic
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

  /**
   * Enhanced goal language detection with context awareness and confidence scoring
   */
  private detectGoalLanguageInProblemContext(lowerInput: string, originalInput: string): {
    hasGoalLanguage: boolean;
    matchedIndicator: string;
    confidence: number;
  } {
    // Define goal indicators with confidence weights
    const goalPatterns = [
      // High confidence - clear goal language
      { patterns: ['want to', 'wish to', 'hope to', 'plan to', 'would like to'], weight: 0.9, type: 'explicit_goal' },
      { patterns: ['goal', 'achieve', 'accomplish'], weight: 0.9, type: 'explicit_goal' },
      
      // Medium confidence - context dependent
      { patterns: ['become'], weight: 0.7, type: 'aspirational' },
      { patterns: ['need to', 'have to'], weight: 0.6, type: 'necessity' },
      { patterns: ['want', 'need'], weight: 0.5, type: 'desire' },
      
      // Lower confidence - highly context dependent
      { patterns: ['have'], weight: 0.3, type: 'possession' },
    ];

    // Special handling for "get" - context matters a lot
    const getPatterns = [
      // Goal contexts for "get"
      { patterns: ['get better', 'get help', 'get more', 'get to'], weight: 0.8, type: 'positive_get' },
      { patterns: ['get a job', 'get the promotion', 'get married'], weight: 0.9, type: 'achievement_get' },
      
      // Problem contexts for "get" (should NOT trigger goal detection)
      { patterns: ['get mad', 'get angry', 'get upset', 'get frustrated', 'get anxious', 'get depressed'], weight: -1.0, type: 'negative_get' },
      { patterns: ['get rid of', 'get over'], weight: 0.8, type: 'resolution_get' }, // These are actually goals
    ];

    let maxConfidence = 0;
    let matchedIndicator = '';
    let matchedType = '';

    // Check standard goal patterns
    for (const patternGroup of goalPatterns) {
      for (const pattern of patternGroup.patterns) {
        if (lowerInput.includes(pattern)) {
          // Context-aware confidence adjustment
          let adjustedWeight = patternGroup.weight;
          
          // Reduce confidence if in negative context
          if (this.isInNegativeContext(lowerInput, pattern)) {
            adjustedWeight *= 0.5;
          }
          
          // Increase confidence if in positive/aspirational context  
          if (this.isInPositiveContext(lowerInput, pattern)) {
            adjustedWeight *= 1.2;
          }
          
          if (adjustedWeight > maxConfidence) {
            maxConfidence = adjustedWeight;
            matchedIndicator = pattern;
            matchedType = patternGroup.type;
          }
        }
      }
    }

    // Check "get" patterns separately
    for (const getGroup of getPatterns) {
      for (const pattern of getGroup.patterns) {
        if (lowerInput.includes(pattern)) {
          if (getGroup.weight > maxConfidence) {
            maxConfidence = getGroup.weight;
            matchedIndicator = pattern;
            matchedType = getGroup.type;
          }
        }
      }
    }

    // Threshold for triggering AI assistance
    const threshold = 0.6;
    const hasGoalLanguage = maxConfidence >= threshold;

    return {
      hasGoalLanguage,
      matchedIndicator,
      confidence: maxConfidence
    };
  }

  /**
   * Enhanced question detection with context awareness
   */
  private detectQuestionLanguage(lowerInput: string, originalInput: string): {
    hasQuestionLanguage: boolean;
    matchedIndicator: string;
    confidence: number;
  } {
    const questionPatterns = [
      // High confidence question indicators
      { patterns: ['how can i', 'how do i', 'what should i', 'should i'], weight: 0.9 },
      { patterns: ['how can', 'how do', 'what should', 'why do', 'when will', 'where can'], weight: 0.8 },
      
      // Question mark
      { patterns: ['?'], weight: 0.7 },
    ];

    let maxConfidence = 0;
    let matchedIndicator = '';

    for (const patternGroup of questionPatterns) {
      for (const pattern of patternGroup.patterns) {
        if (pattern === '?' ? originalInput.trim().endsWith('?') : lowerInput.includes(pattern)) {
          if (patternGroup.weight > maxConfidence) {
            maxConfidence = patternGroup.weight;
            matchedIndicator = pattern === '?' ? 'ends with ?' : pattern;
          }
        }
      }
    }

    const threshold = 0.6;
    const hasQuestionLanguage = maxConfidence >= threshold;

    return {
      hasQuestionLanguage,
      matchedIndicator,
      confidence: maxConfidence
    };
  }

  /**
   * Helper method to detect if a pattern is in negative context
   */
  private isInNegativeContext(input: string, pattern: string): boolean {
    const negativeWords = ['not', 'never', 'can\'t', 'cannot', 'won\'t', 'don\'t', 'doesn\'t', 'shouldn\'t', 'couldn\'t'];
    const patternIndex = input.indexOf(pattern);
    if (patternIndex === -1) return false;
    
    // Check words before the pattern
    const beforePattern = input.substring(0, patternIndex);
    const wordsBeforePattern = beforePattern.split(' ').slice(-3); // Check last 3 words
    
    return negativeWords.some(negWord => wordsBeforePattern.includes(negWord));
  }

  /**
   * Helper method to detect if a pattern is in positive/aspirational context
   */
  private isInPositiveContext(input: string, pattern: string): boolean {
    const positiveWords = ['really', 'truly', 'definitely', 'absolutely', 'desperately', 'badly'];
    const patternIndex = input.indexOf(pattern);
    if (patternIndex === -1) return false;
    
    // Check words around the pattern
    const beforePattern = input.substring(0, patternIndex);
    const afterPattern = input.substring(patternIndex + pattern.length);
    const contextWords = [...beforePattern.split(' ').slice(-2), ...afterPattern.split(' ').slice(0, 2)];
    
    return positiveWords.some(posWord => contextWords.includes(posWord));
  }

  /**
   * AI-powered deadline detection in goal statements
   */
  private detectDeadlineInGoal(goalStatement: string): {
    hasDeadline: boolean;
    deadline?: string;
    synthesizedGoal?: string;
    confidence: number;
  } {
    const input = goalStatement.toLowerCase().trim();
    
    // Define deadline patterns with confidence weights
    const deadlinePatterns = [
      // High confidence - explicit time references
      { patterns: ['by tomorrow', 'by next week', 'by next month', 'by the end of'], weight: 0.95, type: 'explicit_deadline' },
      { patterns: ['by monday', 'by tuesday', 'by wednesday', 'by thursday', 'by friday', 'by saturday', 'by sunday'], weight: 0.9, type: 'day_deadline' },
      { patterns: ['by january', 'by february', 'by march', 'by april', 'by may', 'by june', 'by july', 'by august', 'by september', 'by october', 'by november', 'by december'], weight: 0.9, type: 'month_deadline' },
      
      // Medium confidence - relative time references
      { patterns: ['in january', 'in february', 'in march', 'in april', 'in may', 'in june', 'in july', 'in august', 'in september', 'in october', 'in november', 'in december'], weight: 0.85, type: 'month_deadline' },
      { patterns: ['tomorrow', 'next week', 'next month', 'this week', 'this month'], weight: 0.8, type: 'relative_deadline' },
      { patterns: ['soon', 'quickly', 'asap', 'as soon as possible'], weight: 0.7, type: 'urgency_deadline' },
      
      // Lower confidence - vague time references
      { patterns: ['today', 'now', 'immediately'], weight: 0.6, type: 'immediate_deadline' },
    ];

    let maxConfidence = 0;
    let matchedDeadline = '';
    let matchedType = '';

    // Check for deadline patterns
    for (const patternGroup of deadlinePatterns) {
      for (const pattern of patternGroup.patterns) {
        if (input.includes(pattern)) {
          if (patternGroup.weight > maxConfidence) {
            maxConfidence = patternGroup.weight;
            matchedDeadline = pattern;
            matchedType = patternGroup.type;
          }
        }
      }
    }

    // Also check for date patterns (numbers + time units)
    const datePatterns = [
      /\b(\d{1,2})\s*(days?|weeks?|months?|years?)\b/i,
      /\bin\s*(\d{1,2})\s*(days?|weeks?|months?|years?)\b/i,
      /\bwithin\s*(\d{1,2})\s*(days?|weeks?|months?|years?)\b/i,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{1,2})\b/i,
      /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/,
      /\b(\d{1,2})-(\d{1,2})-(\d{2,4})\b/,
    ];

    for (const datePattern of datePatterns) {
      const match = goalStatement.match(datePattern);
      if (match && maxConfidence < 0.85) {
        maxConfidence = 0.85;
        matchedDeadline = match[0];
        matchedType = 'numeric_deadline';
      }
    }

    // Threshold for deadline detection
    const threshold = 0.6;
    const hasDeadline = maxConfidence >= threshold;

    if (hasDeadline) {
      // Extract the deadline and synthesize the goal
      const deadline = this.extractDeadlineFromGoal(goalStatement, matchedDeadline);
      const synthesizedGoal = this.synthesizeGoalWithDeadline(goalStatement, deadline);
      
      return {
        hasDeadline: true,
        deadline,
        synthesizedGoal,
        confidence: maxConfidence
      };
    }

    return {
      hasDeadline: false,
      confidence: maxConfidence
    };
  }

  /**
   * Extract clean deadline from goal statement
   */
  private extractDeadlineFromGoal(goalStatement: string, matchedPattern: string): string {
    // Find the deadline phrase in the original statement (preserving case)
    const lowerGoal = goalStatement.toLowerCase();
    const lowerPattern = matchedPattern.toLowerCase();
    const index = lowerGoal.indexOf(lowerPattern);
    
    if (index !== -1) {
      // Extract the actual deadline phrase from the original statement
      const deadline = goalStatement.substring(index, index + matchedPattern.length);
      
      // Clean up common prefixes
      return deadline.replace(/^(by |in |within |on )/i, '').trim();
    }
    
    return matchedPattern;
  }

     /**
    * Synthesize goal statement with deadline properly formatted
    */
   private synthesizeGoalWithDeadline(goalStatement: string, deadline: string): string {
     // If the goal already contains the deadline in a valid format, return as-is
     const lowerGoal = goalStatement.toLowerCase();
     const lowerDeadline = deadline.toLowerCase();
     
     // Check if goal already contains deadline with any preposition - if so, return as-is
     if (lowerGoal.includes(`by ${lowerDeadline}`) || 
         lowerGoal.includes(`in ${lowerDeadline}`) ||
         lowerGoal.includes(`on ${lowerDeadline}`) ||
         lowerGoal.includes(`within ${lowerDeadline}`)) {
       return goalStatement; // Return as-is, preserving the user's original preposition
     }
     
     // Find and remove deadline patterns to get clean goal
     let cleanGoal = goalStatement;
     
     // Escape special regex characters in deadline
     const escapedDeadline = deadline.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
     
     // Remove various deadline patterns (more comprehensive)
     cleanGoal = cleanGoal.replace(new RegExp(`\\s*by\\s+${escapedDeadline}\\b`, 'gi'), '');
     cleanGoal = cleanGoal.replace(new RegExp(`\\s*in\\s+${escapedDeadline}\\b`, 'gi'), '');
     cleanGoal = cleanGoal.replace(new RegExp(`\\s*within\\s+${escapedDeadline}\\b`, 'gi'), '');
     cleanGoal = cleanGoal.replace(new RegExp(`\\s*on\\s+${escapedDeadline}\\b`, 'gi'), '');
     
     // Remove standalone deadline if it appears at the end
     cleanGoal = cleanGoal.replace(new RegExp(`\\s*${escapedDeadline}\\s*$`, 'gi'), '');
     
     // Clean up extra spaces and punctuation
     cleanGoal = cleanGoal.replace(/\s+/g, ' ').trim();
     cleanGoal = cleanGoal.replace(/[,\s]+$/, ''); // Remove trailing commas/spaces
     
     // Only reconstruct if we actually removed something
     if (cleanGoal !== goalStatement) {
       return `${cleanGoal} by ${deadline}`;
     }
     
     // If no deadline patterns were found to remove, just append
     return `${goalStatement} by ${deadline}`;
   }

  /**
   * Initialize all treatment phases with exact Mind Shifting protocols
   */
  private initializePhases(): void {
    // Phase 1: Introduction (Always Scripted)
    this.phases.set('introduction', {
      name: 'Introduction',
      maxDuration: 5,
      steps: [
        {
          id: 'mind_shifting_explanation',
          scriptedResponse: (userInput, context) => {
            // Safety check for context
            if (!context) {
              throw new Error('Context is undefined in mind_shifting_explanation');
            }
            if (!context.metadata) {
              context.metadata = {};
            }
            
            // If no user input, show the initial explanation and options
            if (!userInput) {
              return "Mind Shifting is not like counselling, therapy or life coaching. The Mind Shifting methods are verbal guided processes that we apply to problems, goals, or negative experiences in order to clear them. The way Mind Shifting works is we won't just be talking about what you want to work on, we will be applying Mind Shifting methods in order to clear them, and to do that we will need to define what you want to work on into a clear statement by you telling me what it is in a few words. So I'll be asking you to do that when needed.\n\nWhen you are ready to begin, would you like to work on:\n\n1. PROBLEM\n2. GOAL\n3. NEGATIVE EXPERIENCE";
            }
            
            const input = userInput.toLowerCase();
            
            // Handle initial work type selection FIRST (reset state for fresh selection)
            // Use more specific checks to avoid conflicts with method names
            console.log(`🔍 WORK_TYPE_CHECK: input="${input}", contains '1': ${input.includes('1')}, contains 'problem': ${input.includes('problem')}, contains 'shifting': ${input.includes('shifting')}`);
            if (input.includes('1') || (input.includes('problem') && !input.includes('shifting'))) {
              // Reset all work type metadata for fresh selection
              context.metadata.workType = 'problem';
              context.metadata.selectedMethod = undefined;
              console.log(`🎯 WORK_TYPE_SELECTION: Set workType to 'problem', returning PROBLEM_SELECTION_CONFIRMED`);
              // For problems, show method selection (UI will show buttons, this is for backend logic)
              return "PROBLEM_SELECTION_CONFIRMED";
            } else if (input.includes('2') || (input.includes('goal') && !input.includes('shifting'))) {
              // Reset all work type metadata for fresh selection
              context.metadata.workType = 'goal';
              context.metadata.selectedMethod = undefined;
              console.log(`🎯 WORK_TYPE_SELECTION: Set workType to 'goal'`);
              // Signal that we'll ask for description in next step
              return "GOAL_SELECTION_CONFIRMED";
            } else if (input.includes('3') || (input.includes('negative') && !input.includes('shifting')) || (input.includes('experience') && !input.includes('shifting'))) {
              // Reset all work type metadata for fresh selection
              context.metadata.workType = 'negative_experience';
              context.metadata.selectedMethod = undefined;
              console.log(`🎯 WORK_TYPE_SELECTION: Set workType to 'negative_experience'`);
              // Signal that we'll ask for description in next step  
              return "NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED";
            }
            

            
            // Check if we're already in problem method selection mode
            console.log(`🔍 METHOD_SELECTION_CHECK: workType="${context.metadata.workType}", selectedMethod="${context.metadata.selectedMethod}", input="${input}"`);
            if (context.metadata.workType === 'problem' && !context.metadata.selectedMethod) {
              // Handle method selection for problems - only respond to method names (frontend sends these)
              // Use toLowerCase() for case-insensitive matching
              const lowerInput = input.toLowerCase();
              console.log(`🔍 METHOD_SELECTION_MATCHING: lowerInput="${lowerInput}"`);
              if (lowerInput.includes('problem shifting')) {
                console.log(`🔍 METHOD_SELECTION: Matched problem shifting, setting selectedMethod`);
                context.metadata.selectedMethod = 'problem_shifting';
                context.metadata.workType = 'problem'; // BUGFIX: Set workType for validation
                return "Great! We'll use Problem Shifting.";
              } else if (lowerInput.includes('identity shifting')) {
                context.metadata.selectedMethod = 'identity_shifting';
                context.metadata.workType = 'problem'; // BUGFIX: Set workType for validation
                return "Great! We'll use Identity Shifting.";
              } else if (lowerInput.includes('belief shifting')) {
                context.metadata.selectedMethod = 'belief_shifting';
                context.metadata.workType = 'problem'; // BUGFIX: Set workType for validation
                return "Great! We'll use Belief Shifting.";
              } else if (lowerInput.includes('blockage shifting')) {
                context.metadata.selectedMethod = 'blockage_shifting';
                context.metadata.workType = 'problem'; // BUGFIX: Set workType for validation
                return "Great! We'll use Blockage Shifting.";
              } else {
                // If we get here with work type 'problem' but no method selected,
                // UI will show method buttons - return confirmation for backend logic
                return "METHOD_SELECTION_NEEDED";
              }
            }
            
            // Handle problem description after method selection
            console.log(`🔍 MIND_SHIFTING_EXPLANATION: Checking skip logic - workType="${context.metadata.workType}", selectedMethod="${context.metadata.selectedMethod}", userInput="${userInput}"`);
            if (context.metadata.workType === 'problem' && context.metadata.selectedMethod) {
              console.log(`🔍 MIND_SHIFTING_EXPLANATION: Both workType and selectedMethod present, skipping to treatment intro`);
              // User has provided problem description, store it and proceed directly to treatment intro
              context.metadata.problemStatement = userInput;
              context.problemStatement = userInput; // Keep for compatibility
              // Store the original problem statement for digging deeper questions
              if (!context.metadata.originalProblemStatement) {
                context.metadata.originalProblemStatement = userInput;
              }
              // Skip confirmation and routing - go directly to treatment intro
              if (context.metadata.selectedMethod === 'problem_shifting') {
                context.currentStep = 'problem_shifting_intro';
                context.currentPhase = 'problem_shifting';
              } else if (context.metadata.selectedMethod === 'identity_shifting') {
                context.currentStep = 'identity_shifting_intro';
                context.currentPhase = 'identity_shifting';
              } else if (context.metadata.selectedMethod === 'belief_shifting') {
                context.currentStep = 'belief_shifting_intro';
                context.currentPhase = 'belief_shifting';
              } else if (context.metadata.selectedMethod === 'blockage_shifting') {
                context.currentStep = 'blockage_shifting_intro';
                context.currentPhase = 'blockage_shifting';
              }
              console.log(`🔍 MIND_SHIFTING_EXPLANATION: Returning SKIP_TO_TREATMENT_INTRO`);
              return "SKIP_TO_TREATMENT_INTRO";
            }
            
            // Handle goal description after work type selection for goals
            if (context.metadata.workType === 'goal' && !context.metadata.selectedMethod) {
              // User has provided goal description, store it and proceed directly to reality shifting
              context.metadata.goalStatement = userInput;
              context.problemStatement = userInput; // Keep for compatibility
              // Store the original goal statement for digging deeper questions
              if (!context.metadata.originalProblemStatement) {
                context.metadata.originalProblemStatement = userInput;
              }  
              context.currentStep = 'reality_goal_capture';
              context.currentPhase = 'reality_shifting';
              context.metadata.selectedMethod = 'reality_shifting';
              return "SKIP_TO_TREATMENT_INTRO";
            }

            // Negative experience descriptions are now handled by the dedicated negative_experience_description step
            // This logic has been removed to avoid conflicts
            
            // If we get here, it's not a valid work type selection
            return "Please choose 1 for Problem, 2 for Goal, or 3 for Negative Experience.";
          },
          expectedResponseType: 'selection',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose 1, 2, or 3.' }
          ],
          nextStep: 'method_selection', // This will be handled by determineNextStep logic
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'method_selection',
          scriptedResponse: (userInput, context) => {
            const workType = context.metadata.workType;
            
            if (workType === 'problem') {
              // If no user input OR if this is the first time on this step, signal UI to show method buttons
              if (!userInput || !context.metadata.methodSelectionShown) {
                context.metadata.methodSelectionShown = true; // Mark that we've shown the options
                return "METHOD_SELECTION_NEEDED"; // Signal UI to show method selection buttons
              }
              
              // Process user's method selection
              const input = userInput.toLowerCase();
              
              if (input.includes('1') || input.includes('problem shifting')) {
                context.metadata.selectedMethod = 'problem_shifting';
                context.metadata.workType = 'problem'; // BUGFIX: Set workType for validation
                context.currentPhase = 'work_type_selection';
                return "Great! We'll use Problem Shifting.";
              } else if (input.includes('2') || input.includes('identity shifting')) {
                context.metadata.selectedMethod = 'identity_shifting';
                context.metadata.workType = 'problem'; // BUGFIX: Set workType for validation
                context.currentPhase = 'work_type_selection';
                return "Great! We'll use Identity Shifting.";
              } else if (input.includes('3') || input.includes('belief shifting')) {
                context.metadata.selectedMethod = 'belief_shifting';
                context.metadata.workType = 'problem'; // BUGFIX: Set workType for validation
                context.currentPhase = 'work_type_selection';
                return "Great! We'll use Belief Shifting.";
              } else if (input.includes('4') || input.includes('blockage shifting')) {
                context.metadata.selectedMethod = 'blockage_shifting';
                context.metadata.workType = 'problem'; // BUGFIX: Set workType for validation
                context.currentPhase = 'work_type_selection';
                return "Great! We'll use Blockage Shifting.";
              } else {
                return "Please choose 1 for Problem Shifting, 2 for Identity Shifting, 3 for Belief Shifting, or 4 for Blockage Shifting.";
              }
            }
            
            // This shouldn't be reached for goals/negative experiences
            return "Please select a work type first.";
          },
          expectedResponseType: 'selection',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose a method.' }
          ],
          nextStep: 'work_type_description',
          aiTriggers: []
        },
        {
          id: 'goal_description',
          scriptedResponse: (userInput, context) => {
            return "Please tell me what your goal is in a few words, including any deadline, if there is one.";
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you want to achieve.' }
          ],
          nextStep: undefined, // Will be determined by determineNextStep logic with AI assistance
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'negative_experience_description',
          scriptedResponse: (userInput, context) => {
            return "Tell me what the negative experience was in a few words";
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please describe the negative experience.' }
          ],
          nextStep: undefined, // Will be determined by determineNextStep logic
          aiTriggers: []
        }
      ]
    });

    // Phase 2: Work Type Selection (Always Scripted)
    this.phases.set('work_type_selection', {
      name: 'Work Type Selection',
      maxDuration: 5,
      steps: [
        {
          id: 'work_type_description',
          scriptedResponse: (userInput, context) => {
            // Safety check for context
            if (!context) {
              throw new Error('Context is undefined in work_type_description');
            }
            if (!context.metadata) {
              context.metadata = {};
            }
            
            const workType = context.metadata.workType || 'item';

            // Check if we should skip user input (e.g., coming from trauma_problem_redirect)
            const skipUserInput = context.metadata.skipUserInput;
            if (skipUserInput) {
              context.metadata.skipUserInput = false; // Clear flag
            }

            // Check if user input is actually a method name (not a problem description)
            const isMethodName = userInput && (
              userInput.toLowerCase().includes('problem shifting') ||
              userInput.toLowerCase().includes('identity shifting') ||
              userInput.toLowerCase().includes('belief shifting') ||
              userInput.toLowerCase().includes('blockage shifting') ||
              userInput.toLowerCase().includes('reality shifting') ||
              userInput.toLowerCase().includes('trauma shifting')
            );
            
            // If no user input OR if user input is a method name OR skipUserInput flag is set, ask for description
            if (!userInput || isMethodName || skipUserInput) {
              if (workType === 'problem') {
                return "Tell me what the problem is in a few words.";
              } else if (workType === 'goal') {
                return "Tell me what the goal is in a few words.";
              } else if (workType === 'negative_experience') {
                return "Tell me what the negative experience was in a few words.";
              } else {
                return "Tell me what you want to work on in a few words.";
              }
            } else {
              // User provided description, store it and proceed directly to treatment
              const statement = userInput || '';
              console.log(`🔍 WORK_TYPE_DESCRIPTION: Storing problem statement: "${statement}"`);
              context.metadata.problemStatement = statement;
              context.problemStatement = statement; // Keep for compatibility
              console.log(`🔍 WORK_TYPE_DESCRIPTION: Stored in metadata.problemStatement: "${context.metadata.problemStatement}"`);
              console.log(`🔍 WORK_TYPE_DESCRIPTION: Stored in problemStatement: "${context.problemStatement}"`);
              
              // Skip confirmation and route directly to treatment intro step  
              if (workType === 'problem') {
                const selectedMethod = context.metadata.selectedMethod;
                if (selectedMethod === 'identity_shifting') {
                  context.currentPhase = 'identity_shifting';
                  // Set step for next transition but return simple acknowledgment
                  return `Great! Let's begin Identity Shifting.`;
                } else if (selectedMethod === 'problem_shifting') {
                  context.currentPhase = 'problem_shifting';
                  return `Great! Let's begin Problem Shifting.`;
                } else if (selectedMethod === 'belief_shifting') {
                  context.currentPhase = 'belief_shifting';
                  return `Great! Let's begin Belief Shifting.`;
                } else if (selectedMethod === 'blockage_shifting') {
                  context.currentPhase = 'blockage_shifting';
                  return `Great! Let's begin Blockage Shifting.`;
                }
              } else if (workType === 'goal') {
                context.currentPhase = 'reality_shifting';
                context.metadata.selectedMethod = 'reality_shifting';
                return `Great! Let's begin Reality Shifting.`;
              } else if (workType === 'negative_experience') {
                context.currentPhase = 'trauma_shifting';
                context.metadata.selectedMethod = 'trauma_shifting';
                return `Great! Let's begin Trauma Shifting.`;
              }
              
              // Fallback to confirmation if no method set
              return `So you want to work on '${statement}'. Is that correct?`;
            }
          },
          expectedResponseType: 'description',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me what you would like to work on in a few words.' }
          ],
          nextStep: 'work_type_description', // Will be updated dynamically based on selected method
          aiTriggers: [
            { condition: 'multipleProblems', action: 'focus' },
            { condition: 'tooLong', action: 'simplify' },
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'confirm_statement',
          scriptedResponse: (userInput, context) => {
            const workType = context.metadata.workType || 'item';
            const input = (userInput || '').toLowerCase();
            const statement = context.metadata.problemStatement || 'your request';
            
            // This step only handles confirmation - description should already be stored
            if (input === 'yes' || input === 'y' || input.includes('correct') || input.includes('right')) {
              // User confirmed, continue to treatment
              return "Great! Let's continue with the process.";
            } else if (input === 'no' || input === 'n' || input.includes('wrong') || input.includes('incorrect')) {
              // User said no, go back to description step (determineNextStep will handle routing)
              return "Let me ask you again.";
            } else {
              // Show confirmation again if unclear input
              if (workType === 'problem') {
                return `Ok so the problem is '${statement}' is that right?`;
              } else if (workType === 'goal') {
                return `So you want to work on the goal of '${statement}'. Is that correct? Please say yes or no.`;
              } else if (workType === 'negative_experience') {
                return `So you want to work on the negative experience of '${statement}'. Is that correct? Please say yes or no.`;
              } else {
                return `So you want to work on '${statement}'. Is that correct? Please say yes or no.`;
              }
            }
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please confirm if this is correct.' }
          ],
          nextStep: 'choose_method',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'route_to_method',
          scriptedResponse: (userInput, context) => {
            const workType = context.metadata.workType;
            const selectedMethod = context.metadata.selectedMethod;
            
            if (workType === 'problem' && selectedMethod) {
              // For problems with selected method, start treatment
              if (selectedMethod === 'problem_shifting') {
                context.currentPhase = 'problem_shifting';
                return "Great! Let's begin Problem Shifting.";
              } else if (selectedMethod === 'identity_shifting') {
                context.currentPhase = 'identity_shifting';
                return "Great! Let's begin Identity Shifting.";
              } else if (selectedMethod === 'belief_shifting') {
                context.currentPhase = 'belief_shifting';
                return "Great! Let's begin Belief Shifting.";
              } else if (selectedMethod === 'blockage_shifting') {
                context.currentPhase = 'blockage_shifting';
                return "Great! Let's begin Blockage Shifting.";
              }
            } else if (workType === 'problem' && !selectedMethod) {
              // Problem work type but no method yet - transition signal to route to choose_method
              return "METHOD_SELECTION_NEEDED";
            } else if (workType === 'goal') {
              // Goals automatically use Reality Shifting - go directly to first step
              context.currentPhase = 'reality_shifting';
              context.metadata.selectedMethod = 'reality_shifting';
              return `What do you want?`;
            } else if (workType === 'negative_experience') {
              // Negative experiences automatically use Trauma Shifting - go directly to first step
              context.currentPhase = 'trauma_shifting';
              context.metadata.selectedMethod = 'trauma_shifting';
              // Get the negative experience statement
              const negativeExperience = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the negative experience';
              return `Please close your eyes and keep them closed throughout the rest of the process.\n\nThink about and feel the negative experience of '${negativeExperience}'. Let your mind go to the worst part of the experience... now freeze it there. Keep feeling this frozen moment... what kind of person are you being in this moment?`;
            }
            
            // Fallback (should not reach here normally)
            return "Please select a method first.";
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please continue.' }
          ],
                    nextStep: undefined, // Will be determined by custom logic based on work type
          aiTriggers: []
        }
      ]
    });

    // Phase 3: Discovery (Mostly Scripted) - Keep for handling multiple problems
    this.phases.set('discovery', {
      name: 'Discovery',
      maxDuration: 10,
      steps: [
        {
          id: 'multiple_problems_selection',
          scriptedResponse: (userInput, context) => {
            const problemCount = this.countProblems(userInput || '');
            const problems = this.extractProblems(userInput || '');
            
            // Fix grammar: "1 problem" vs "problems"
            const problemWord = problemCount === 1 ? 'problem' : 'problems';
            let response = `OK so you told me ${problemCount} ${problemWord} there, which one do you want to work on first?\n`;
            
            problems.forEach((problem, index) => {
              if (problem.trim()) { // Only show non-empty problems
                response += `${index + 1}. ${problem}\n`;
              }
            });
            return response;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please select which problem you want to work on first.' }
          ],
          nextStep: 'restate_selected_problem',
          aiTriggers: []
        },
        {
          id: 'restate_selected_problem',
          scriptedResponse: "OK so it is important we use your own words for the problem statement so please tell me what the problem is in a few words",
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me what the problem is in a few words.' }
          ],
          nextStep: 'analyze_response',
          aiTriggers: []
        },
        {
          id: 'analyze_response',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement from the previous step (mind_shifting_explanation or restate_selected_problem)
            const problemStatement = context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || '';
            const words = problemStatement?.split(' ').length || 0;
            if (words <= 20 && problemStatement) {
              return `OK what I heard you say is '${problemStatement}' - is that right?`;
            } else if (problemStatement) {
              return "OK I understand what you have said, but please tell me what the problem is in just a few words";
            } else {
              return "Please tell me what you would like to work on in a few words.";
            }
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please confirm if this is correct.' }
          ],
          nextStep: 'choose_method',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'restate_identity_problem',
          scriptedResponse: () => {
            return `How would you state the problem now in a few words?`;
          },
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please describe the problem in a few words.' }
          ],
          nextStep: 'confirm_identity_problem',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'confirm_identity_problem',
          scriptedResponse: (userInput, context) => {
            // Store the new problem statement
            const newProblem = userInput || 'the problem';
            context.problemStatement = newProblem;
            // Mark that problem has been restated to skip cache for intro steps
            context.metadata = context.metadata || {};
            context.metadata.problemRestated = true;
            return `So the problem is now '${newProblem}'. Is this correct?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please confirm if this is correct.' }
          ],
          nextStep: 'identity_shifting_intro',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'restate_belief_problem',
          scriptedResponse: () => {
            return `How would you state the problem now in a few words?`;
          },
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please describe the problem in a few words.' }
          ],
          nextStep: 'confirm_belief_problem',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'confirm_belief_problem',
          scriptedResponse: (userInput, context) => {
            // Store the new problem statement
            const newProblem = userInput || 'the problem';
            context.problemStatement = newProblem;
            return `So the problem is now '${newProblem}'. Is this correct?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please confirm if this is correct.' }
          ],
          nextStep: 'belief_shifting_intro',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        }
      ]
    });

    // Phase 4: Method Selection (Always Scripted)
    this.phases.set('method_selection', {
      name: 'Method Selection',
      maxDuration: 5,
      steps: [
        {
          id: 'choose_method',
          scriptedResponse: "Choose which Mind Shifting method you would like to use to clear the problem:",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose a method.' }
          ],
          aiTriggers: []
        }
      ]
    });

    // Phase 5: Problem Shifting Method (Script with AI Backup) 
    this.phases.set('problem_shifting', {
      name: 'Problem Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'problem_shifting_intro',
          scriptedResponse: (userInput, context) => {
            // Use the cleanest version of the problem statement - prioritize digging deeper restated problem
            const diggingProblem = context?.metadata?.currentDiggingProblem;
            const cleanProblemStatement = diggingProblem || context?.metadata?.problemStatement || context?.problemStatement || 'the problem';
            console.log(`🔍 PROBLEM_SHIFTING_INTRO: Using clean problem statement: "${cleanProblemStatement}" (digging: "${diggingProblem}")`);
            console.log(`🔍 PROBLEM_SHIFTING_INTRO: Available sources - metadata.problemStatement: "${context?.metadata?.problemStatement}", problemStatement: "${context?.problemStatement}", userInput: "${userInput}"`);
            
            // Check if we should skip intro instructions (when cycling back from check_if_still_problem OR coming from digging deeper)
            const isFromDigging = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem;
            if (context?.metadata?.skipIntroInstructions || isFromDigging) {
              // Clear flags and return only the problem feeling question
              context.metadata.skipIntroInstructions = false;
              context.metadata.skipLinguisticProcessing = false;
              console.log(`🔍 PROBLEM_SHIFTING_INTRO: Skipping lengthy instructions - isFromDigging: ${!!isFromDigging}, skipFlag: ${!!context?.metadata?.skipIntroInstructions}`);
              return `Feel the problem '${cleanProblemStatement}'... what does it feel like?`;
            }
            
            // First time through - show full instructions
            return `Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. When I ask 'what needs to happen for the problem to not be a problem?' allow your answers to be different each time.

Feel the problem '${cleanProblemStatement}'... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'body_sensation_check',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'body_sensation_check',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`,
          expectedResponseType: 'experience',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens when you feel that.' }
          ],
          nextStep: 'what_needs_to_happen_step',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'what_needs_to_happen_step',
          scriptedResponse: (userInput, context) => {
            // Get the previous response from body_sensation_check to maintain flow continuity
            const previousResponse = context?.userResponses?.['body_sensation_check'] || userInput || 'this';
            return `Feel '${previousResponse}'... what needs to happen for this to not be a problem?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what needs to happen.' }
          ],
          nextStep: 'feel_solution_state',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'feel_solution_state',
          scriptedResponse: (userInput, context) => {
            // Get the previous answer from what_needs_to_happen_step
            const previousAnswer = context?.userResponses?.['what_needs_to_happen_step'] || 'that';
            return `What would you feel like if ${previousAnswer} had already happened?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you would feel like.' }
          ],
          nextStep: 'feel_good_state',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'feel_good_state',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feeling feels like.' }
          ],
          nextStep: 'what_happens_step',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'what_happens_step',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`,
          expectedResponseType: 'experience',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens when you feel that.' }
          ],
          nextStep: 'check_if_still_problem',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'check_if_still_problem',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement - prioritize digging deeper restated problem
            const diggingProblem = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem;
            const problemStatement = diggingProblem || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
            console.log(`🔍 CHECK_IF_STILL_PROBLEM: Using problem statement: "${problemStatement}" (digging: "${diggingProblem}", original: "${context?.problemStatement}")`);
            return `Feel the problem '${problemStatement}'... does it still feel like a problem?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please tell me if it still feels like a problem.' }
          ],
          nextStep: 'digging_deeper_start',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'problem_integration_awareness_1',
          scriptedResponse: (userInput, context) => {
            const subject = this.getIntegrationSubject(context, 'problem');
            return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${subject}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how you feel about it now.' }
          ],
          nextStep: 'problem_integration_awareness_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'problem_integration_awareness_2',
          scriptedResponse: (userInput, context) => {
            return `What are you more aware of now than before we did this process?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what you are more aware of now.' }
          ],
          nextStep: 'problem_integration_awareness_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'problem_integration_awareness_3',
          scriptedResponse: (userInput, context) => {
            return `How has it helped you to do this process?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how this process has helped you.' }
          ],
          nextStep: 'problem_integration_awareness_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'problem_integration_awareness_4',
          scriptedResponse: (userInput, context) => {
            return `What is your new narrative about this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your new narrative.' }
          ],
          nextStep: 'problem_integration_awareness_5',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'problem_integration_awareness_5',
          scriptedResponse: (userInput, context) => {
            return `What's your intention now in relation to this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your intention now.' }
          ],
          nextStep: 'problem_integration_action_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'problem_integration_action_1',
          scriptedResponse: (userInput, context) => {
            return `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?... What else needs to happen for you to realise your intention? (Until they are clear on their plan of action)`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what needs to happen.' }
          ],
          nextStep: 'problem_integration_action_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'problem_integration_action_2',
          scriptedResponse: (userInput, context) => {
            return `What is the one thing you can do that will make everything else easier or unnecessary?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'problem_integration_action_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'problem_integration_action_3',
          scriptedResponse: (userInput, context) => {
            return `What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action and when you will do it.' }
          ],
          nextStep: undefined, // End of Problem Shifting process
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        }
      ]
    });

    // Phase 6: Blockage Shifting Method (Script with AI Backup)
    this.phases.set('blockage_shifting', {
      name: 'Blockage Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'blockage_shifting_intro',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement - handle digging deeper context
            const problemStatement = context?.metadata?.currentDiggingProblem || 
                                   context?.metadata?.newDiggingProblem || 
                                   context?.problemStatement || 
                                   context?.metadata?.problemStatement || 
                                   context?.userResponses?.['restate_selected_problem'] || 
                                   context?.userResponses?.['mind_shifting_explanation'] || 
                                   'the problem';
            
            // Check if we're in digging deeper mode or subsequent cycle
            const cycleCount = context?.metadata?.cycleCount || 0;
            const isDiggingDeeper = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem;
            console.log(`🔍 BLOCKAGE_SHIFTING_INTRO: problemStatement="${problemStatement}", cycleCount=${cycleCount}, isDiggingDeeper=${!!isDiggingDeeper}`);
            
            if (cycleCount === 0 && !isDiggingDeeper) {
              return `Please close your eyes and keep them closed throughout the process. Please give brief answers to my questions and allow the problem to keep changing...we're going to keep going until there is no problem left.\n\nFeel '${problemStatement}'... what does it feel like?`;
            } else {
              // On subsequent cycles or digging deeper, just ask the question
              return `Feel '${problemStatement}'... what does it feel like?`;
            }
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'blockage_step_b',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_step_b',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'blockage_step_c',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'blockage_step_c',
          scriptedResponse: (userInput, context) => {
            // Check if previous response was "I don't know" or "I can't feel it"
            const previousResponse = context?.userResponses?.[context.currentStep] || '';
            const unknownIndicators = ['don\'t know', 'can\'t feel', 'no idea', 'not sure'];
            const isUnknownResponse = unknownIndicators.some(indicator => previousResponse.toLowerCase().includes(indicator));
            
            if (isUnknownResponse && !context?.metadata?.hasAskedToGuess) {
              context.metadata.hasAskedToGuess = true;
              return `That's okay. Can you guess what it would feel like to not have this problem?`;
            } else if (isUnknownResponse && context?.metadata?.hasAskedToGuess) {
              context.metadata.hasAskedToGuess = false;
              return `Feel that you don't know... what does that feel like?`;
            }
            
            return `Feel the problem that you have right now... what would it feel like to not have this problem?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it would feel like to not have this problem.' }
          ],
          nextStep: 'blockage_step_d',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'blockage_step_d',
          scriptedResponse: (userInput, context) => {
            // Check if current response is "I don't know" or "I can't feel it"
            const unknownIndicators = ['don\'t know', 'can\'t feel', 'no idea', 'not sure'];
            const isUnknownResponse = unknownIndicators.some(indicator => (userInput || '').toLowerCase().includes(indicator));
            
            if (isUnknownResponse && !context?.metadata?.hasAskedToGuessD) {
              context.metadata.hasAskedToGuessD = true;
              return `That's okay. Can you guess what '${userInput || 'that feeling'}' feels like?`;
            } else if (isUnknownResponse && context?.metadata?.hasAskedToGuessD) {
              context.metadata.hasAskedToGuessD = false;
              return `Feel that you can't feel it... what does that feel like?`;
            }
            
            return `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'blockage_step_e',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'blockage_step_e',
          scriptedResponse: () => `What's the problem now?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please tell me what the problem is now.' }
          ],
          nextStep: 'blockage_shifting_intro', // Direct cycle back to step A with new problem
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'blockage_check_if_still_problem',
          scriptedResponse: (userInput) => {
            // Check if they said "no problem", "nothing", "gone", etc.
            const noProblemIndicators = ['no problem', 'nothing', 'none', 'gone', 'resolved', 'fine', 'good', 'better', 'clear'];
            const response = (userInput || '').toLowerCase();
            const seemsResolved = noProblemIndicators.some(indicator => response.includes(indicator));
            
            if (seemsResolved) {
              // Signal that we should transition immediately - this message won't be shown
              return 'TRANSITION_TO_DIG_DEEPER';
            }
            
            return `Feel '${userInput || 'that problem'}'... what does it feel like?`;
          },
          expectedResponseType: 'open', // Can be feeling description or yes/no for dig deeper
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please tell me how you feel or if there is still a problem.' }
          ],
          nextStep: undefined, // Dynamic routing handled by processStep logic
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_integration_awareness_1',
          scriptedResponse: (userInput, context) => {
            const subject = this.getIntegrationSubject(context, 'problem');
            return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${subject}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how you feel about it now.' }
          ],
          nextStep: 'blockage_integration_awareness_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_integration_awareness_2',
          scriptedResponse: (userInput, context) => {
            return `What are you more aware of now than before we did this process?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what you are more aware of now.' }
          ],
          nextStep: 'blockage_integration_awareness_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_integration_awareness_3',
          scriptedResponse: (userInput, context) => {
            return `How has it helped you to do this process?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how this process has helped you.' }
          ],
          nextStep: 'blockage_integration_awareness_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_integration_awareness_4',
          scriptedResponse: (userInput, context) => {
            return `What is your new narrative about this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your new narrative.' }
          ],
          nextStep: 'blockage_integration_awareness_5',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_integration_awareness_5',
          scriptedResponse: (userInput, context) => {
            return `What's your intention now in relation to this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your intention now.' }
          ],
          nextStep: 'blockage_integration_action_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_integration_action_1',
          scriptedResponse: (userInput, context) => {
            return `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?... What else needs to happen for you to realise your intention? (Until they are clear on their plan of action)`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what needs to happen.' }
          ],
          nextStep: 'blockage_integration_action_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_integration_action_2',
          scriptedResponse: (userInput, context) => {
            return `What is the one thing you can do that will make everything else easier or unnecessary?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'blockage_integration_action_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_integration_action_3',
          scriptedResponse: (userInput, context) => {
            return `What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action and when you will do it.' }
          ],
          nextStep: undefined, // End of Blockage Shifting process
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        }
      ]
    });

    // Phase 4c: Identity Shifting Method (Script with AI Backup)
    this.phases.set('identity_shifting', {
      name: 'Identity Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'identity_shifting_intro',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement - prioritize digging deeper restated problem
            const diggingProblem = context?.metadata?.currentDiggingProblem;
            const originalProblem = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
            
            console.log(`🔍 IDENTITY_SHIFTING_INTRO: Digging problem: "${diggingProblem}", Original problem: "${originalProblem}"`);
            console.log(`🔍 IDENTITY_SHIFTING_INTRO: Available sources - problemStatement: "${context?.problemStatement}", metadata.problemStatement: "${context?.metadata?.problemStatement}"`);
            
            // Use the restated problem from digging deeper if available, otherwise use original
            const cleanProblemStatement = diggingProblem || context?.metadata?.problemStatement || context?.problemStatement || originalProblem;
            console.log(`🔍 IDENTITY_SHIFTING_INTRO: Using clean problem statement: "${cleanProblemStatement}"`);
            
            // ENHANCED DEBUG: Track what userInput we're receiving
            console.log(`🔍 IDENTITY_SHIFTING_INTRO: Called with userInput: "${userInput || 'NONE'}"`);
            console.log(`🔍 IDENTITY_SHIFTING_INTRO: Current step in context: "${context.currentStep}"`);
            console.log(`🔍 IDENTITY_SHIFTING_INTRO: User responses keys:`, Object.keys(context.userResponses));
            console.log(`🔍 IDENTITY_SHIFTING_INTRO: Latest user response:`, context.userResponses[context.currentStep] || 'NONE');
            
            // Only store identity if this is actually a user's identity response, not the problem statement
            if (userInput && userInput.trim() && userInput.trim() !== cleanProblemStatement) {
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: RAW userInput received: "${userInput}"`);
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: Problem statement for reference: "${cleanProblemStatement}"`);
              
              const processedIdentity = this.processIdentityResponse(userInput.trim());
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: Processing identity "${userInput}" -> "${processedIdentity}"`);
              
              // Check if user said "me" - need clarification
              if (userInput.toLowerCase().trim() === 'me') {
                return "What kind of me?";
              }
              
              // Store the processed identity with proper labeling
              context.metadata.identityResponse = {
                type: 'IDENTITY',
                value: processedIdentity,
                originalInput: userInput.trim()
              };
              
              // Keep currentIdentity for backward compatibility
              context.metadata.currentIdentity = processedIdentity;
              
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: ✅ STORED identity response:`, context.metadata.identityResponse);
            } else if (userInput && userInput.trim() === cleanProblemStatement) {
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: ❌ SKIPPED storage - userInput is problem statement, not identity response`);
            } else if (userInput && userInput.trim()) {
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: ❓ SKIPPED storage - userInput present but doesn't match problem statement`);
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: userInput: "${userInput.trim()}"`);
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: cleanProblemStatement: "${cleanProblemStatement}"`);
            } else {
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: ⏸️  NO userInput - showing question only`);
            }
            
            // Check if we're coming from digging deeper (shorter instructions)
            const isFromDigging = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem || context?.metadata?.skipIntroInstructions;
            
            if (isFromDigging) {
              // Short version for digging deeper - user has already seen full instructions
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: Skipping lengthy instructions - isFromDigging: ${!!isFromDigging}`);
              return `Feel the problem '${cleanProblemStatement}'... what kind of person are you being when you're experiencing this problem?`;
            } else {
              // Full version for first-time users
              return `Please close your eyes and keep them closed throughout the rest of the process. Please tell me the first thing that comes up when I ask this question. Feel the problem of '${cleanProblemStatement}'... what kind of person are you being when you're experiencing this problem?`;
            }
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what kind of person you are being.' }
          ],
          nextStep: 'identity_dissolve_step_a',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_dissolve_step_a',
          scriptedResponse: (userInput, context) => {
            // Use the properly labeled identity response
            const identityData = context.metadata.identityResponse;
            let identity = 'that identity';
            
            if (identityData && identityData.type === 'IDENTITY') {
              identity = identityData.value;
            } else {
              // Fallback to currentIdentity for backward compatibility
              identity = context.metadata.currentIdentity || 'that identity';
            }
            
            // Determine the appropriate prefix based on which checking question we're returning from
            const returnTo = context.metadata.returnToIdentityCheck;
            let prefix = 'Feel yourself being';
            
            if (returnTo === 'identity_future_check') {
              // Coming from future check: "Do you think you might feel yourself being ... in the future?"
              prefix = 'Put yourself in the future and feel yourself being';
              // DON'T clear the flag here - we need it in identity_dissolve_step_f to know where to return
            } else if (returnTo === 'identity_scenario_check') {
              // Coming from scenario check: "Is there any scenario in which you might still feel yourself being..."
              prefix = 'Imagine that scenario and feel yourself being';
              // DON'T clear the flag here - we need it in identity_dissolve_step_f to know where to return
            }
            
            return `${prefix} '${identity}'... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'identity_dissolve_step_b',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_dissolve_step_b',
          scriptedResponse: (userInput, context) => {
            // Store the response from step A for use in subsequent steps
            context.metadata.stepAResponse = userInput || 'that feeling';
            const stepAResponse = context.metadata.stepAResponse;
            return `Feel '${stepAResponse}'... what happens in yourself when you feel '${stepAResponse}'?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens in yourself.' }
          ],
          nextStep: 'identity_dissolve_step_c',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_dissolve_step_c',
          scriptedResponse: (userInput, context) => {
            // Store the response from step B
            context.metadata.stepBResponse = userInput || 'that';
            
            // Use the properly labeled identity response
            const identityData = context.metadata.identityResponse;
            let identity = 'that identity';
            
            if (identityData && identityData.type === 'IDENTITY') {
              identity = identityData.value;
            } else {
              // Fallback to currentIdentity for backward compatibility
              identity = context.metadata.currentIdentity || 'that identity';
            }
            
            return `What are you when you're not being '${identity}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you are when you\'re not being that identity.' }
          ],
          nextStep: 'identity_dissolve_step_d',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_dissolve_step_d',
          scriptedResponse: (userInput, context) => {
            // Store the response from step C (what they are when not being the identity)
            context.metadata.stepCResponse = userInput || 'that';
            const stepCResponse = context.metadata.stepCResponse;
            
            // CRITICAL: Ensure originalProblemIdentity is preserved
            console.log(`🔍 IDENTITY_DISSOLVE_STEP_D: originalProblemIdentity: "${context.metadata.originalProblemIdentity}", currentIdentity: "${context.metadata.currentIdentity}", stepCResponse: "${stepCResponse}"`);
            
            return `Feel yourself being '${stepCResponse}'... what does '${stepCResponse}' feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'identity_dissolve_step_e',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_dissolve_step_e',
          scriptedResponse: (userInput, context) => {
            // Store the response from step D
            context.metadata.stepDResponse = userInput || 'that feeling';
            const stepDResponse = context.metadata.stepDResponse;
            
            // CRITICAL: Ensure originalProblemIdentity is preserved
            console.log(`🔍 IDENTITY_DISSOLVE_STEP_E: originalProblemIdentity: "${context.metadata.originalProblemIdentity}", currentIdentity: "${context.metadata.currentIdentity}", stepDResponse: "${stepDResponse}"`);
            
            return `Feel '${stepDResponse}'... what happens in yourself when you feel '${stepDResponse}'?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens in yourself.' }
          ],
          nextStep: 'identity_dissolve_step_f',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_dissolve_step_f',
          scriptedResponse: (userInput, context) => {
            // Use the properly labeled identity response
            const identityData = context.metadata.identityResponse;
            let identity = 'that identity';
            
            if (identityData && identityData.type === 'IDENTITY') {
              identity = identityData.value;
            } else {
              // Fallback to currentIdentity for backward compatibility
              identity = context.metadata.currentIdentity || 'that identity';
            }
            
            return `Can you still feel yourself being '${identity}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'identity_step_3_intro',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_future_check',
          scriptedResponse: (userInput, context) => {
            // Use the properly labeled identity response
            const identityData = context.metadata.identityResponse;
            let identity = 'that identity';
            
            if (identityData && identityData.type === 'IDENTITY') {
              identity = identityData.value;
            } else {
              // Fallback to currentIdentity for backward compatibility
              identity = context.metadata.currentIdentity || 'that identity';
            }
            
            return `Do you think you might feel yourself being '${identity}' in the future?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'identity_scenario_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'identity_scenario_check',
          scriptedResponse: (userInput, context) => {
            // Use the properly labeled identity response
            const identityData = context.metadata.identityResponse;
            let identity = 'that identity';
            
            if (identityData && identityData.type === 'IDENTITY') {
              identity = identityData.value;
            } else {
              // Fallback to currentIdentity for backward compatibility
              identity = context.metadata.currentIdentity || 'that identity';
            }
            
            return `Is there any scenario in which you might still feel yourself being '${identity}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'identity_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'identity_check',
          scriptedResponse: (userInput, context) => {
            // Use the properly labeled identity response
            const identityData = context.metadata.identityResponse;
            let identity = 'that identity';
            
            if (identityData && identityData.type === 'IDENTITY') {
              identity = identityData.value;
              console.log(`🔍 IDENTITY_CHECK: Using labeled identity: "${identity}"`);
            } else {
              // Fallback to currentIdentity for backward compatibility
              identity = context.metadata.currentIdentity || 'that identity';
              console.log(`🔍 IDENTITY_CHECK: Using fallback identity: "${identity}"`);
            }
            
            return `Can you still feel yourself being '${identity}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'identity_problem_check',
          aiTriggers: [] // REMOVED: identity_check should be purely scripted, no AI assistance
        },



        {
          id: 'identity_future_projection',
          scriptedResponse: (userInput, context) => {
            // Step A: Ask them to project into the future and feel the identity
            const identityData = context.metadata.identityResponse;
            const identity = (identityData && identityData.type === 'IDENTITY') 
              ? identityData.value 
              : (context.metadata.currentIdentity || context.metadata.originalProblemIdentity || 'that identity');
            
            console.log(`🔍 IDENTITY_FUTURE_PROJECTION_A: Asking to feel identity '${identity}' in the future`);
            return `Put yourself in the future and feel yourself being '${identity}'... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'identity_future_step_b',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_future_step_b',
          scriptedResponse: (userInput, context) => {
            // Step B: Store response from A and ask what happens
            context.metadata.futureStepAResponse = userInput || 'that feeling';
            const stepAResponse = context.metadata.futureStepAResponse;
            
            console.log(`🔍 IDENTITY_FUTURE_STEP_B: Asking what happens when they feel '${stepAResponse}'`);
            return `Feel '${stepAResponse}'... what happens in yourself when you feel '${stepAResponse}'?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens in yourself.' }
          ],
          nextStep: 'identity_future_step_c',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_future_step_c',
          scriptedResponse: (userInput, context) => {
            // Step C: Store response from B and ask what they are when not being the identity
            context.metadata.futureStepBResponse = userInput || 'that';
            
            const identityData = context.metadata.identityResponse;
            const identity = (identityData && identityData.type === 'IDENTITY') 
              ? identityData.value 
              : (context.metadata.currentIdentity || context.metadata.originalProblemIdentity || 'that identity');
            
            console.log(`🔍 IDENTITY_FUTURE_STEP_C: Asking what they are when not being '${identity}' in the future`);
            return `What are you when you're not being '${identity}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you are when you\'re not being that identity.' }
          ],
          nextStep: 'identity_future_step_d',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_future_step_d',
          scriptedResponse: (userInput, context) => {
            // Step D: Store response from C and ask them to feel that state
            context.metadata.futureStepCResponse = userInput || 'that';
            const stepCResponse = context.metadata.futureStepCResponse;
            
            console.log(`🔍 IDENTITY_FUTURE_STEP_D: Asking them to feel '${stepCResponse}'`);
            return `Feel yourself being '${stepCResponse}'... what does '${stepCResponse}' feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'identity_future_step_e',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_future_step_e',
          scriptedResponse: (userInput, context) => {
            // Step E: Store response from D and ask what happens
            context.metadata.futureStepDResponse = userInput || 'that feeling';
            const stepDResponse = context.metadata.futureStepDResponse;
            
            console.log(`🔍 IDENTITY_FUTURE_STEP_E: Asking what happens when they feel '${stepDResponse}'`);
            return `Feel '${stepDResponse}'... what happens in yourself when you feel '${stepDResponse}'?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens in yourself.' }
          ],
          nextStep: 'identity_future_step_f',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_future_step_f',
          scriptedResponse: (userInput, context) => {
            // Step F: Check if they can still feel the identity in the future
            context.metadata.futureStepEResponse = userInput || 'that';
            
            const identityData = context.metadata.identityResponse;
            const identity = (identityData && identityData.type === 'IDENTITY') 
              ? identityData.value 
              : (context.metadata.currentIdentity || context.metadata.originalProblemIdentity || 'that identity');
            
            console.log(`🔍 IDENTITY_FUTURE_STEP_F: Checking if they can still feel '${identity}' in the future`);
            return `Can you still feel yourself being '${identity}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'identity_problem_check',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_problem_check',
          scriptedResponse: (userInput, context) => {
            // Normal problem check
            const diggingProblem = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem;
            const cleanProblemStatement = diggingProblem || context?.metadata?.problemStatement || context?.problemStatement || 'the problem';
            console.log(`🔍 IDENTITY_PROBLEM_CHECK: Using problem statement: "${cleanProblemStatement}" (digging: "${diggingProblem}", original: "${context?.problemStatement}")`);
            return `Feel '${cleanProblemStatement}'... does it still feel like a problem?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'digging_deeper_start',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },



        {
          id: 'integration_awareness_1',
          scriptedResponse: (userInput, context) => {
            const subject = this.getIntegrationSubject(context, 'problem');
            return `How do you feel about '${subject}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how you feel about it now.' }
          ],
          nextStep: 'integration_awareness_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_awareness_2',
          scriptedResponse: (userInput, context) => {
            return `What are you more aware of now than before we did this process?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what you are more aware of now.' }
          ],
          nextStep: 'integration_awareness_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_awareness_3',
          scriptedResponse: (userInput, context) => {
            return `How has it helped you to do this process?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how this process has helped you.' }
          ],
          nextStep: 'integration_awareness_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_awareness_4',
          scriptedResponse: (userInput, context) => {
            return `What is your new narrative about this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your new narrative.' }
          ],
          nextStep: 'integration_awareness_5',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_awareness_5',
          scriptedResponse: (userInput, context) => {
            return `What's your intention now in relation to this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your intention now.' }
          ],
          nextStep: 'integration_action_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_action_1',
          scriptedResponse: (userInput, context) => {
            return `What needs to happen for you to realise your intention?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what needs to happen.' }
          ],
          nextStep: 'integration_action_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_action_2',
          scriptedResponse: (userInput, context) => {
            return `What else needs to happen for you to realise your intention?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what else needs to happen.' }
          ],
          nextStep: 'integration_action_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_action_3',
          scriptedResponse: (userInput, context) => {
            return `What is the one thing you can do that will make everything else easier or unnecessary?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'integration_action_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_action_4',
          scriptedResponse: (userInput, context) => {
            return `What is the first action that you can commit to now that will help you to realise your intention?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action.' }
          ],
          nextStep: 'integration_action_5',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_action_5',
          scriptedResponse: (userInput, context) => {
            return `When will you do this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share when you will do this.' }
          ],
          nextStep: 'identity_session_complete',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_session_complete',
          scriptedResponse: "Thank you for doing this Mind Shifting session. The process is now complete. How do you feel overall about the work we've done today?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please share how you feel about the session.' }
          ],
          nextStep: undefined,
          aiTriggers: []
        }
      ]
    });

    // Phase 4d: Reality Shifting Method (Script with AI Backup)
    this.phases.set('reality_shifting', {
      name: 'Reality Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'reality_goal_capture',
          scriptedResponse: (userInput, context) => {
            return `What do you want?`;
          },
          expectedResponseType: 'goal',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me what you want instead.' }
          ],
          nextStep: undefined, // Will be determined by determineNextStep logic with AI deadline detection
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'goal_deadline_check',
          scriptedResponse: 'Is there a deadline?',
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'goal_deadline_date',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'goal_deadline_date',
          scriptedResponse: 'When do you want to achieve this goal by?',
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me when you want to achieve this goal.' }
          ],
          nextStep: 'goal_confirmation',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'goal_confirmation',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            const deadline = context?.userResponses?.['goal_deadline_date'] || '';
            const hasDeadline = context?.userResponses?.['goal_deadline_check']?.toLowerCase().includes('yes') || false;
            
            if (hasDeadline && deadline) {
              // Check if we already have a synthesized goal with deadline from AI detection
              const existingSynthesizedGoal = context?.metadata?.goalWithDeadline;
              if (existingSynthesizedGoal) {
                // Use the already synthesized goal to avoid duplication
                return `OK, so your goal statement including the deadline is '${existingSynthesizedGoal}', is that right?`;
              } else {
                // Fallback: construct it manually (for cases where user manually entered deadline)
                context.metadata.goalWithDeadline = `${goalStatement} by ${deadline}`;
                return `OK, so your goal statement including the deadline is '${goalStatement} by ${deadline}', is that right?`;
              }
            } else {
              return `OK, so your goal statement is '${goalStatement}', is that right?`;
            }
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please confirm yes or no.' }
          ],
          nextStep: 'goal_certainty',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'goal_certainty',
          scriptedResponse: 'How certain are you between 0% and 100% that you will achieve this goal?',
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please give me a percentage.' }
          ],
          nextStep: 'reality_shifting_intro',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_shifting_intro',
          scriptedResponse: (userInput, context) => {
            // Use the goal statement with deadline if available, otherwise use basic goal statement
            const goalWithDeadline = context?.metadata?.goalWithDeadline;
            const basicGoal = context?.metadata?.currentGoal || 'your goal';
            const goalStatement = goalWithDeadline || basicGoal;
            context.metadata.currentGoal = basicGoal; // Keep basic goal for other references
            return `Close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. If ever you feel your goal has changed just let me know.

Feel that '${goalStatement}' is coming to you... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'reality_step_a2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_step_a2',
          scriptedResponse: (userInput, context) => {
            // Use the LAST RESPONSE (from previous step) as per flowchart
            const lastResponse = userInput || 'that';
            return `Feel ${lastResponse}... what does ${lastResponse} feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'reality_step_a3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        
        {
          id: 'reality_step_a3',
          scriptedResponse: (userInput, context) => {
            // Use the LAST RESPONSE (from previous step A2) as per flowchart
            const lastResponse = userInput || 'that';
            return `Feel ${lastResponse}... what happens in yourself when you feel ${lastResponse}?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens in yourself.' }
          ],
          nextStep: 'reality_why_not_possible',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_why_not_possible',
          scriptedResponse: (userInput, context) => {
            // Use the goal statement with deadline if available, otherwise use basic goal statement
            const goalWithDeadline = context?.metadata?.goalWithDeadline;
            const basicGoal = context?.metadata?.currentGoal || 'your goal';
            const goalStatement = goalWithDeadline || basicGoal;
            return `Why might you not achieve your goal of '${goalStatement}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me why you might not achieve your goal.' }
          ],
          nextStep: undefined, // Use determineNextStep to check for "no reason"
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_feel_reason',
          scriptedResponse: (userInput, context) => {
            // Store the reason for use in subsequent steps
            context.metadata.currentReason = userInput || 'that reason';
            return `Feel '${userInput || 'that reason'}'... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'reality_feel_reason_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_feel_reason_2',
          scriptedResponse: (userInput, context) => {
            return `What would it feel like to not have that problem?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it would feel like.' }
          ],
          nextStep: 'reality_feel_reason_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_feel_reason_3',
          scriptedResponse: (userInput, context) => {
            // Use the LAST RESPONSE (from previous step B3) as per flowchart
            const lastResponse = userInput || 'that';
            return `Feel ${lastResponse}... what does ${lastResponse} feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'reality_column_a_restart', // Loop back to top of Column A only
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_column_a_restart',
          scriptedResponse: (userInput, context) => {
            // A1: Just the goal feeling question without full intro
            const goalWithDeadline = context?.metadata?.goalWithDeadline;
            const basicGoal = context?.metadata?.currentGoal || 'your goal';
            const goalStatement = goalWithDeadline || basicGoal;
            return `Feel that '${goalStatement}' is coming to you... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'reality_step_a2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_checking_questions',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            return `How certain are you now between 0% and 100% that you will achieve your goal of ${goalStatement}?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please give me a percentage.' }
          ],
          nextStep: 'reality_certainty_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'reality_doubt_reason',
          scriptedResponse: (userInput, context) => {
            // Check if we're coming from the second checking question (reality_certainty_check)
            const fromSecondCheck = context?.metadata?.fromSecondCheckingQuestion;
            console.log(`🔍 REALITY_DOUBT_REASON: fromSecondCheck=${fromSecondCheck}, doubtPercentage=${context?.metadata?.doubtPercentage}`);
            
            if (fromSecondCheck) {
              // Coming from "Are there any doubts left?" - don't reference old percentage
              // Clear the old doubt percentage to prevent confusion
              context.metadata.doubtPercentage = undefined;
              console.log(`🔍 REALITY_DOUBT_REASON: Using generic doubt message (from second check)`);
              return `What's the reason for the doubt?`;
            } else {
              // Coming from initial certainty percentage - use the calculated doubt percentage
              const doubtPercentage = context?.metadata?.doubtPercentage || '10';
              console.log(`🔍 REALITY_DOUBT_REASON: Using percentage doubt message: ${doubtPercentage}%`);
              return `What's the reason for the ${doubtPercentage}% doubt?`;
            }
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me the reason for your doubt.' }
          ],
          nextStep: 'reality_cycle_b2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_cycle_b2',
          scriptedResponse: (userInput, context) => {
            // Use the doubt reason from the previous step
            const doubtReason = context?.userResponses?.['reality_doubt_reason'] || userInput || 'that reason';
            context.metadata.currentReason = doubtReason;
            return `Feel '${doubtReason}'... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'reality_cycle_b3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_cycle_b3',
          scriptedResponse: 'What would it feel like to not have that problem?',
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it would feel like.' }
          ],
          nextStep: 'reality_cycle_b4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_cycle_b4',
          scriptedResponse: (userInput, context) => {
            // Get the response from reality_cycle_b3
            const goodFeeling = context?.userResponses?.['reality_cycle_b3'] || userInput || 'good';
            return `Feel '${goodFeeling}'... what does '${goodFeeling}' feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'reality_checking_questions',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_certainty_check',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            return `Are there any doubts left in your mind that you will achieve your goal of ${goalStatement}?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'reality_integration_intro',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },



        {
          id: 'reality_integration_intro',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            return `OK now we have cleared all the blockages in the way of your goal, next I will ask you some questions about how your perspective has shifted and the steps you need to take to achieve your goal. So firstly, how do you feel about your goal of '${goalStatement}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me how you feel about your goal now.' }
          ],
          nextStep: 'reality_integration_helped',
          aiTriggers: []
        },

        {
          id: 'reality_integration_start',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            return `You can open your eyes now. How do you feel about '${goalStatement}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me how you feel about your goal now.' }
          ],
          nextStep: 'reality_integration_helped',
          aiTriggers: []
        },

        {
          id: 'reality_integration_helped',
          scriptedResponse: () => {
            return `How has it helped you to do this Mind Shifting method?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me how this method has helped you.' }
          ],
          nextStep: 'reality_integration_awareness',
          aiTriggers: []
        },

        {
          id: 'reality_integration_awareness',
          scriptedResponse: () => {
            return `What are you more aware of now than before you did this Mind Shifting method?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you are more aware of now.' }
          ],
          nextStep: 'reality_integration_action',
          aiTriggers: []
        },

        {
          id: 'reality_integration_action',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            return `What needs to happen for you to achieve your goal of '${goalStatement}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what needs to happen to achieve your goal.' }
          ],
          nextStep: 'reality_integration_action_more',
          aiTriggers: []
        },

        {
          id: 'reality_integration_action_more',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            return `What else needs to happen for you to achieve your goal of '${goalStatement}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please tell me what else needs to happen, or say "nothing".' }
          ],
          nextStep: 'reality_integration_awareness_1',
          aiTriggers: []
        },

        {
          id: 'reality_integration_awareness_1',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || context?.metadata?.goalStatement || 'your goal';
            return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${goalStatement}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how you feel about it now.' }
          ],
          nextStep: 'reality_integration_awareness_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_integration_awareness_2',
          scriptedResponse: (userInput, context) => {
            return `What are you more aware of now than before we did this process?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what you are more aware of now.' }
          ],
          nextStep: 'reality_integration_awareness_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_integration_awareness_3',
          scriptedResponse: (userInput, context) => {
            return `How has it helped you to do this process?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how this process has helped you.' }
          ],
          nextStep: 'reality_integration_awareness_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_integration_awareness_4',
          scriptedResponse: (userInput, context) => {
            return `What is your new narrative about this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your new narrative.' }
          ],
          nextStep: 'reality_integration_action_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        // Skip awareness_5 for goals (intention question not needed)

        {
          id: 'reality_integration_action_1',
          scriptedResponse: (userInput, context) => {
            return `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to achieve your goal?... What else needs to happen for you to achieve your goal? (Until they are clear on their plan of action)`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what needs to happen.' }
          ],
          nextStep: 'reality_integration_action_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_integration_action_2',
          scriptedResponse: (userInput, context) => {
            return `What is the one thing you can do that will make everything else easier or unnecessary?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'reality_integration_action_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_integration_action_3',
          scriptedResponse: (userInput, context) => {
            return `What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action and when you will do it.' }
          ],
          nextStep: undefined, // End of Reality Shifting process
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        }
      ]
    });

    // Phase 4e: Trauma Shifting Method (Script with AI Backup)
    this.phases.set('trauma_shifting', {
      name: 'Trauma Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'trauma_shifting_intro',
          scriptedResponse: (userInput, context) => {
            // Get the negative experience statement
            const negativeExperience = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the negative experience';
            return `Will you be comfortable recalling the worst part of this experience and freezing it briefly in your mind?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_identity_step',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_problem_redirect',
          scriptedResponse: (userInput, context) => {
            return `How do you feel now about the fact that this happened?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me how you feel about the fact that this happened.' }
          ],
          nextStep: 'work_type_description',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_identity_step',
          scriptedResponse: (userInput, context) => {
            // Check if this is a repeat cycle (user's eyes are already closed)
            const cycleCount = context.metadata.cycleCount || 0;
            
            if (cycleCount > 0) {
              // Eyes already closed from previous cycle, skip the intro
              return `Keep feeling this frozen moment...what kind of person are you being in this moment?`;
            } else {
              // First time through - include full instructions
              const negativeExperience = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the negative experience';
              return `Please close your eyes and keep them closed throughout the rest of the process.\n\nThink about and feel the negative experience of '${negativeExperience}'. Let your mind go to the worst part of the experience...now freeze it there. Keep feeling this frozen moment...what kind of person are you being in this moment?`;
            }
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what kind of person you are being in this moment.' }
          ],
          nextStep: 'trauma_dissolve_step_a',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dissolve_step_a',
          scriptedResponse: (userInput, context) => {
            // Get the identity from the trauma_identity_step response
            const traumaIdentityResponse = context.userResponses?.['trauma_identity_step'];
            
            // ALWAYS update the identity when we have a fresh trauma_identity_step response
            // This prevents using cached identities from earlier in the session (e.g., from trauma redirect)
            if (traumaIdentityResponse) {
              // CRITICAL FIX: Process the trauma identity response to add "person" suffix like Identity Shifting does
              const processedTraumaIdentity = this.processIdentityResponse(traumaIdentityResponse.trim());
              context.metadata.currentTraumaIdentity = processedTraumaIdentity;
              context.metadata.originalTraumaIdentity = processedTraumaIdentity; // Store processed version for trauma_identity_check
              console.log(`🔧 TRAUMA_DISSOLVE_STEP_A: Processing trauma identity "${traumaIdentityResponse}" -> "${processedTraumaIdentity}"`);
            }
            
            // Use the stored identity, don't overwrite with current userInput
            const identity = context.metadata.currentTraumaIdentity || 'that identity';
            
            // Determine the appropriate prefix based on which checking question we're returning from
            const returnTo = context.metadata.returnToTraumaCheck;
            let prefix = 'Feel yourself being';
            
            if (returnTo === 'trauma_identity_check') {
              // Coming from identity check: "Can you still feel yourself being..."
              prefix = 'Feel yourself being';
              // DON'T clear the flag here - we need it at the end to know where to return
            } else if (returnTo === 'trauma_future_scenario_check') {
              // Coming from scenario check: "Is there any scenario in which you might still feel yourself being..."
              prefix = 'Imagine that scenario and feel yourself being';
              // DON'T clear the flag here - we need it at the end to know where to return
            }
            
            return `${prefix} ${identity}... what does it feel like?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'trauma_dissolve_step_b',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dissolve_step_b',
          scriptedResponse: (userInput, context) => {
            // FIXED: Use metadata to get the CURRENT step A response, not the cached one from userResponses
            // This prevents using old responses from previous iterations
            const lastResponse = context.metadata.currentStepAResponse || context.userResponses?.['trauma_dissolve_step_a'] || 'that feeling';
            return `Feel '${lastResponse}'... what happens in yourself when you feel '${lastResponse}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens in yourself when you feel that.' }
          ],
          nextStep: 'trauma_dissolve_step_c',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dissolve_step_c',
          scriptedResponse: (userInput, context) => {
            const identity = context.metadata.currentTraumaIdentity || 'that identity';
            return `What are you when you're not being '${identity}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you are when you are not being that.' }
          ],
          nextStep: 'trauma_dissolve_step_d',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dissolve_step_d',
          scriptedResponse: (userInput, context) => {
            const lastResponse = context.userResponses?.['trauma_dissolve_step_c'] || 'that';
            return `Feel yourself being '${lastResponse}'... what does it feel like?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'trauma_dissolve_step_e',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dissolve_step_e',
          scriptedResponse: (userInput, context) => {
            // FIXED: Use metadata to get the CURRENT step D response, not the cached one from userResponses
            // This prevents using old responses from previous iterations
            const lastResponse = context.metadata.currentStepDResponse || context.userResponses?.['trauma_dissolve_step_d'] || 'that feeling';
            return `Feel '${lastResponse}'... what happens in yourself when you feel '${lastResponse}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens in yourself when you feel that.' }
          ],
          nextStep: 'trauma_identity_check',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_identity_check',
          scriptedResponse: (userInput, context) => {
            const identity = context.metadata.originalTraumaIdentity || context.metadata.currentTraumaIdentity || 'that identity';
            return `Can you still feel yourself being ${identity}?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_future_identity_check',
          aiTriggers: [] // REMOVED: trauma_identity_check should be purely scripted, no AI assistance
        },

        {
          id: 'trauma_future_identity_check',
          scriptedResponse: (userInput, context) => {
            const identity = context.metadata.originalTraumaIdentity || context.metadata.currentTraumaIdentity || 'that identity';
            return `Do you think you can ever feel yourself being ${identity} in the future?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_future_scenario_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_future_scenario_check',
          scriptedResponse: (userInput, context) => {
            const identity = context.metadata.originalTraumaIdentity || context.metadata.currentTraumaIdentity || 'that identity';
            return `Is there any scenario in which you might still feel yourself being ${identity}?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_experience_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_future_projection',
          scriptedResponse: (userInput, context) => {
            // Step A: Ask them to project into the future and feel the identity
            const identity = context.metadata.originalTraumaIdentity || context.metadata.currentTraumaIdentity || 'that identity';
            
            console.log(`🔍 TRAUMA_FUTURE_PROJECTION: Asking to feel identity '${identity}' in the future`);
            return `Put yourself in the future and feel yourself being ${identity}... what does it feel like?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'trauma_future_step_c',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_future_step_c',
          scriptedResponse: (userInput, context) => {
            // Step C: Store response from future projection and ask what they are when not being the identity
            context.metadata.traumaFutureStepAResponse = userInput || 'that';
            
            const identity = context.metadata.originalTraumaIdentity || context.metadata.currentTraumaIdentity || 'that identity';
            
            console.log(`🔍 TRAUMA_FUTURE_STEP_C: Asking what they are when not being '${identity}' in the future`);
            return `What are you when you're not being '${identity}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you are when you are not being that.' }
          ],
          nextStep: 'trauma_future_step_d',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_future_step_d',
          scriptedResponse: (userInput, context) => {
            // Step D: Store response from C and ask them to feel that state
            context.metadata.traumaFutureStepCResponse = userInput || 'that';
            const stepCResponse = context.metadata.traumaFutureStepCResponse;
            
            console.log(`🔍 TRAUMA_FUTURE_STEP_D: Asking them to feel '${stepCResponse}'`);
            return `Feel yourself being '${stepCResponse}'... what does it feel like?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'trauma_future_step_e',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_future_step_e',
          scriptedResponse: (userInput, context) => {
            // Step E: Store response from D and ask what happens
            context.metadata.traumaFutureStepDResponse = userInput || 'that feeling';
            const stepDResponse = context.metadata.traumaFutureStepDResponse;
            
            console.log(`🔍 TRAUMA_FUTURE_STEP_E: Asking what happens when they feel '${stepDResponse}'`);
            return `Feel '${stepDResponse}'... what happens in yourself when you feel '${stepDResponse}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens in yourself when you feel that.' }
          ],
          nextStep: 'trauma_future_step_f',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_future_step_f',
          scriptedResponse: (userInput, context) => {
            // Step F: Check if they can still feel the identity in the future
            context.metadata.traumaFutureStepEResponse = userInput || 'that';
            
            const identity = context.metadata.originalTraumaIdentity || context.metadata.currentTraumaIdentity || 'that identity';
            
            console.log(`🔍 TRAUMA_FUTURE_STEP_F: Checking if they can still feel '${identity}' in the future`);
            return `Can you still feel yourself being ${identity}?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_experience_check',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_experience_check',
          scriptedResponse: (userInput, context) => {
            const negativeExperience = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the negative experience';
            return `Take your mind back to the frozen moment which was the worst part of the negative experience (${negativeExperience}). Does it still feel like a problem to you?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_dig_deeper',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dig_deeper',
          scriptedResponse: () => {
            return `Do you feel you might feel bad about this incident in the future?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_dig_deeper_2',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dig_deeper_2',
          scriptedResponse: () => {
            return `Is there anything else about this that's still a problem for you?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_integration_awareness_1',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_integration_awareness_1',
          scriptedResponse: (userInput, context) => {
            const subject = this.getIntegrationSubject(context, 'negative_experience');
            return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${subject}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how you feel about it now.' }
          ],
          nextStep: 'trauma_integration_awareness_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_integration_awareness_2',
          scriptedResponse: (userInput, context) => {
            return `What are you more aware of now than before we did this process?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what you are more aware of now.' }
          ],
          nextStep: 'trauma_integration_awareness_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_integration_awareness_3',
          scriptedResponse: (userInput, context) => {
            return `How has it helped you to do this process?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how this process has helped you.' }
          ],
          nextStep: 'trauma_integration_awareness_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_integration_awareness_4',
          scriptedResponse: (userInput, context) => {
            return `What is your new narrative about this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your new narrative.' }
          ],
          nextStep: 'trauma_integration_awareness_5',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_integration_awareness_5',
          scriptedResponse: (userInput, context) => {
            return `What's your intention now in relation to this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your intention now.' }
          ],
          nextStep: 'trauma_integration_action_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_integration_action_1',
          scriptedResponse: (userInput, context) => {
            return `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?... What else needs to happen for you to realise your intention? (Until they are clear on their plan of action)`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what needs to happen.' }
          ],
          nextStep: 'trauma_integration_action_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_integration_action_2',
          scriptedResponse: (userInput, context) => {
            return `What is the one thing you can do that will make everything else easier or unnecessary?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'trauma_integration_action_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_integration_action_3',
          scriptedResponse: (userInput, context) => {
            return `What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action and when you will do it.' }
          ],
          nextStep: undefined, // End of Trauma Shifting process
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        }
      ]
    });

    // Phase 4f: Belief Shifting Method (Script with AI Backup)
    this.phases.set('belief_shifting', {
      name: 'Belief Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'belief_shifting_intro',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement - prioritize digging deeper restated problem
            console.log('🔍 BELIEF_DEBUG belief_shifting_intro - context.metadata:', JSON.stringify(context.metadata, null, 2));
            console.log('🔍 BELIEF_DEBUG belief_shifting_intro - userResponses:', JSON.stringify(context.userResponses, null, 2));
            
            // Priority order for problem statement in digging deeper flow:
            // 1. currentDiggingProblem (set by digging_method_selection)
            // 2. newDiggingProblem (set by restate_problem_future) 
            // 3. restate_problem_future user response
            // 4. context.problemStatement
            const diggingProblem = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem;
            const restatedProblem = context?.userResponses?.['restate_problem_future'] ||
                                    context?.userResponses?.['restate_scenario_problem_1'] ||
                                    context?.userResponses?.['restate_scenario_problem_2'] ||
                                    context?.userResponses?.['restate_scenario_problem_3'] ||
                                    context?.userResponses?.['restate_anything_else_problem_1'] ||
                                    context?.userResponses?.['restate_anything_else_problem_2'];
            const problemStatement = diggingProblem || restatedProblem || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
            
            console.log('🔍 BELIEF_DEBUG belief_shifting_intro - diggingProblem:', diggingProblem);
            console.log('🔍 BELIEF_DEBUG belief_shifting_intro - restatedProblem:', restatedProblem);
            console.log('🔍 BELIEF_DEBUG belief_shifting_intro - context.problemStatement:', context?.problemStatement);
            console.log('🔍 BELIEF_DEBUG belief_shifting_intro - final problemStatement:', problemStatement);
            // Check if we're coming from digging deeper (shorter instructions)
            const isFromDigging = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem || context?.metadata?.skipIntroInstructions;
            
            if (isFromDigging) {
              // Short version for digging deeper - user has already seen full instructions
              console.log(`🔍 BELIEF_SHIFTING_INTRO: Skipping lengthy instructions - isFromDigging: ${!!isFromDigging}`);
              return `Feel the problem '${problemStatement}'... what do you believe about yourself that's causing you to experience this problem?`;
            } else {
              // Full version for first-time users
              return `Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. When I ask 'what needs to happen for the problem to not be a problem?' allow your answers to be different each time.

Feel the problem '${problemStatement}'... what do you believe about yourself that's causing you to experience this problem '${problemStatement}'?`;
            }
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you believe about yourself.' }
          ],
          nextStep: 'belief_step_a',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_a',
          scriptedResponse: (userInput, context) => {
            // Store the belief for use throughout the process
            console.log('🔍 BELIEF_DEBUG belief_step_a - userInput:', userInput);
            console.log('🔍 BELIEF_DEBUG belief_step_a - context.metadata before:', JSON.stringify(context.metadata, null, 2));
            
            // Determine if we're cycling back from belief_step_f
            const isCyclingBack = context.metadata.cycleCount > 0;
            
            let belief;
            if (isCyclingBack) {
              // When cycling back, ALWAYS use the original belief from belief_shifting_intro
              const rawBelief = context.userResponses?.['belief_shifting_intro'] || context.metadata.currentBelief || 'that belief';
              // Strip "I believe" prefix and optional "that" if present
              belief = rawBelief.replace(/^i\s+believe\s+(that\s+)?/i, '').trim();
              console.log('🔍 BELIEF_DEBUG belief_step_a - CYCLING BACK, using original belief:', belief);
            } else {
              // First time through - retrieve the belief from belief_shifting_intro response (not userInput which is the feeling)
              const rawBelief = context.userResponses?.['belief_shifting_intro'] || context.metadata.currentBelief || 'that belief';
              // Strip "I believe" prefix and optional "that" if present
              belief = rawBelief.replace(/^i\s+believe\s+(that\s+)?/i, '').trim();
              context.metadata.currentBelief = belief;
              console.log('🔍 BELIEF_DEBUG belief_step_a - FIRST TIME, setting belief:', belief);
            }
            
            console.log('🔍 BELIEF_DEBUG belief_step_a - context.metadata after:', JSON.stringify(context.metadata, null, 2));
            
            // Determine the appropriate prefix based on which checking question we're returning from
            const returnTo = context.metadata.returnToBeliefCheck;
            let prefix = 'Feel yourself believing';
            
            if (returnTo === 'belief_check_2') {
              // Coming from future check: "Do you feel you may believe ... again in the future?"
              prefix = 'Put yourself in the future and feel yourself believing';
            } else if (returnTo === 'belief_check_3') {
              // Coming from scenario check: "Is there any scenario in which you would still believe..."
              prefix = 'Imagine that scenario and feel yourself believing';
            }
            // For belief_check_1 and belief_check_4, use the standard prefix
            
            return `${prefix} '${belief}'... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like to believe that.' }
          ],
          nextStep: 'belief_step_b',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_b',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'belief_step_c',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_c',
          scriptedResponse: () => `What would you rather feel?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you would rather feel.' }
          ],
          nextStep: 'belief_step_d',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_d',
          scriptedResponse: (userInput, context) => {
            // Store the desired feeling for reference
            context.metadata.desiredFeeling = userInput || context.metadata.desiredFeeling || 'that feeling';
            const desiredFeeling = context.metadata.desiredFeeling;
            return `What would '${desiredFeeling}' feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that would feel like.' }
          ],
          nextStep: 'belief_step_e',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_e',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'belief_step_f',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_f',
          scriptedResponse: (userInput, context) => {
            console.log('🔍 BELIEF_DEBUG belief_step_f - context.metadata:', JSON.stringify(context.metadata, null, 2));
            // Use the cleaned belief from metadata (cleaned in belief_step_a)
            const belief = context.metadata.currentBelief || context.userResponses?.['belief_shifting_intro'] || 'that belief';
            console.log('🔍 BELIEF_DEBUG belief_step_f - retrieved belief:', belief);
            console.log('🔍 BELIEF_DEBUG belief_step_f - originalBelief from belief_shifting_intro:', context.userResponses?.['belief_shifting_intro']);
            console.log('🔍 BELIEF_DEBUG belief_step_f - currentBelief from metadata:', context.metadata.currentBelief);
            return `Do you still believe '${belief}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_check_1',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_check_1',
          scriptedResponse: (userInput, context) => {
            // Use the cleaned belief from metadata (cleaned in belief_step_a)
            const belief = context.metadata.currentBelief || context.userResponses?.['belief_shifting_intro'] || 'that belief';
            return `Does any part of you still believe '${belief}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_check_2',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_check_2',
          scriptedResponse: (userInput, context) => {
            // Use the cleaned belief from metadata (cleaned in belief_step_a)
            const belief = context.metadata.currentBelief || context.userResponses?.['belief_shifting_intro'] || 'that belief';
            return `Do you feel you may believe '${belief}' again in the future?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_check_3',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_check_3',
          scriptedResponse: (userInput, context) => {
            // Use the cleaned belief from metadata (cleaned in belief_step_a)
            const belief = context.metadata.currentBelief || context.userResponses?.['belief_shifting_intro'] || 'that belief';
            return `Is there any scenario in which you would still believe '${belief}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_check_4',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_future_projection',
          scriptedResponse: (userInput, context) => {
            // Step A: Ask them to project into the future and feel the belief
            const belief = context.userResponses?.['belief_shifting_intro'] || context.metadata.currentBelief || 'that belief';
            
            console.log(`🔍 BELIEF_FUTURE_PROJECTION: Asking to feel belief '${belief}' in the future`);
            return `Put yourself in the future and feel yourself believing '${belief}'... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like to believe that.' }
          ],
          nextStep: 'belief_future_step_b',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_future_step_b',
          scriptedResponse: (userInput, context) => {
            // Step B: Store response from future projection and ask what it feels like
            context.metadata.beliefFutureStepAResponse = userInput || 'that feeling';
            const stepAResponse = context.metadata.beliefFutureStepAResponse;
            
            console.log(`🔍 BELIEF_FUTURE_STEP_B: Asking what '${stepAResponse}' feels like`);
            return `Feel '${stepAResponse}'... what does '${stepAResponse}' feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'belief_future_step_c',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_future_step_c',
          scriptedResponse: (userInput, context) => {
            // Step C: Store response from B and ask what they would rather feel
            context.metadata.beliefFutureStepBResponse = userInput || 'that';
            
            console.log(`🔍 BELIEF_FUTURE_STEP_C: Asking what they would rather feel`);
            return `What would you rather feel?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you would rather feel.' }
          ],
          nextStep: 'belief_future_step_d',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_future_step_d',
          scriptedResponse: (userInput, context) => {
            // Step D: Store the desired feeling and ask what it would feel like
            context.metadata.beliefFutureDesiredFeeling = userInput || 'that feeling';
            const desiredFeeling = context.metadata.beliefFutureDesiredFeeling;
            
            console.log(`🔍 BELIEF_FUTURE_STEP_D: Asking what '${desiredFeeling}' would feel like`);
            return `What would '${desiredFeeling}' feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that would feel like.' }
          ],
          nextStep: 'belief_future_step_e',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_future_step_e',
          scriptedResponse: (userInput, context) => {
            // Step E: Store response from D and ask what it feels like
            context.metadata.beliefFutureStepDResponse = userInput || 'that feeling';
            const stepDResponse = context.metadata.beliefFutureStepDResponse;
            
            console.log(`🔍 BELIEF_FUTURE_STEP_E: Asking what '${stepDResponse}' feels like`);
            return `Feel '${stepDResponse}'... what does '${stepDResponse}' feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'belief_future_step_f',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_future_step_f',
          scriptedResponse: (userInput, context) => {
            // Step F: Check if they still believe it
            context.metadata.beliefFutureStepEResponse = userInput || 'that';
            
            const belief = context.userResponses?.['belief_shifting_intro'] || context.metadata.currentBelief || 'that belief';
            
            console.log(`🔍 BELIEF_FUTURE_STEP_F: Checking if they still believe '${belief}'`);
            return `Do you still believe '${belief}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_check_3',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_check_4',
          scriptedResponse: (userInput, context) => {
            console.log('🔍 BELIEF_DEBUG belief_check_4 - context.metadata:', JSON.stringify(context.metadata, null, 2));
            // Use the cleaned belief from metadata (cleaned in belief_step_a)
            const belief = context.metadata.currentBelief || context.userResponses?.['belief_shifting_intro'] || 'that belief';
            console.log('🔍 BELIEF_DEBUG belief_check_4 - retrieved belief:', belief);
            
            // Enhanced pattern matching to preserve user's exact language while making it grammatically correct
            const positiveBeliefStatement = this.createPositiveBeliefStatement(belief);
            console.log('🔍 BELIEF_DEBUG belief_check_4 - positive statement:', positiveBeliefStatement);
            
            return `Do you now know ${positiveBeliefStatement}?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_problem_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_problem_check',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement - prioritize digging deeper restated problem
            const diggingProblem = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem;
            const problemStatement = diggingProblem || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
            console.log(`🔍 BELIEF_PROBLEM_CHECK: Using problem statement: "${problemStatement}" (digging: "${diggingProblem}", original: "${context?.problemStatement}")`);
            return `Feel '${problemStatement}'... does it still feel like a problem?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_integration_awareness_1',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_awareness_1',
          scriptedResponse: (userInput, context) => {
            const subject = this.getIntegrationSubject(context, 'problem');
            return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${subject}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how you feel about it now.' }
          ],
          nextStep: 'belief_integration_awareness_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_awareness_2',
          scriptedResponse: (userInput, context) => {
            return `What are you more aware of now than before we did this process?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what you are more aware of now.' }
          ],
          nextStep: 'belief_integration_awareness_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_awareness_3',
          scriptedResponse: (userInput, context) => {
            return `How has it helped you to do this process?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how this process has helped you.' }
          ],
          nextStep: 'belief_integration_awareness_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_awareness_4',
          scriptedResponse: (userInput, context) => {
            return `What is your new narrative about this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your new narrative.' }
          ],
          nextStep: 'belief_integration_awareness_5',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_awareness_5',
          scriptedResponse: (userInput, context) => {
            return `What's your intention now in relation to this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your intention now.' }
          ],
          nextStep: 'belief_integration_action_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_action_1',
          scriptedResponse: (userInput, context) => {
            return `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?... What else needs to happen for you to realise your intention? (Until they are clear on their plan of action)`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what needs to happen.' }
          ],
          nextStep: 'belief_integration_action_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_action_2',
          scriptedResponse: (userInput, context) => {
            return `What is the one thing you can do that will make everything else easier or unnecessary?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'belief_integration_action_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_action_3',
          scriptedResponse: (userInput, context) => {
            return `What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action and when you will do it.' }
          ],
          nextStep: undefined, // End of Belief Shifting process
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        }
      ]
    });

    // Phase 5: Digging Deeper (Comprehensive Implementation)
    this.phases.set('digging_deeper', {
      name: 'Digging Deeper',
      maxDuration: 20,
      steps: [
        {
          id: 'digging_deeper_start',
          scriptedResponse: (userInput, context) => {
            // CRITICAL: Use originalProblemStatement - digging deeper should reference the FIRST problem, not subsequent ones
            const problemStatement = context?.metadata?.originalProblemStatement || context?.metadata?.problemStatement || context?.problemStatement || 'the problem';
            return `Take your mind back to '${problemStatement}'. Would you like to dig deeper in this area?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'future_problem_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'future_problem_check',
          scriptedResponse: (userInput, context) => {
            const originalProblem = context?.metadata?.originalProblemStatement || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the original problem';
            return `Do you feel '${originalProblem}' will come back in the future?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'restate_problem_future',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'restate_problem_future',
          scriptedResponse: (userInput, context) => {
            // Don't store anything here - scriptedResponse is called when SHOWING the question,
            // not when processing the answer. The user's input ("prob 2") will be passed to
            // digging_method_selection, which will handle storage correctly.
            // BUGFIX: Previously this was storing "yes" (from future_problem_check) instead
            // of the actual problem statement, causing "Feel the problem 'yes'..." display.
            return "How would you state the problem now in a few words?";
          },
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me how you would state the problem now.' }
          ],
          nextStep: 'digging_method_selection',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' },
            { condition: 'tooLong', action: 'simplify' }
          ]
        },
        {
          id: 'digging_method_selection',
          scriptedResponse: (userInput, context) => {
            const input = userInput || '';
            console.log('🔍 BELIEF_DEBUG digging_method_selection - userInput:', userInput);
            console.log('🔍 BELIEF_DEBUG digging_method_selection - context.metadata before:', JSON.stringify(context.metadata, null, 2));
            console.log('🔍 BELIEF_DEBUG digging_method_selection - context.problemStatement before:', context.problemStatement);
            
            // BUGFIX: Always check for new problem from restate_problem_future, even on subsequent iterations
            // This ensures we use "issue 3" instead of sticking with "issue 2"
            const newProblemFromRestate = context.userResponses?.['restate_problem_future'];
            if (newProblemFromRestate && newProblemFromRestate.trim()) {
              // User just came from restate_problem_future - update to the new problem (overwrite old one)
              const newProblem = newProblemFromRestate.trim();
              context.metadata.currentDiggingProblem = newProblem;
              context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 1) + 1;
              context.metadata.returnToDiggingStep = 'future_problem_check'; // Always return to first digging deeper question
              context.problemStatement = newProblem;
              
              // CRITICAL: Set work type to 'problem' to ensure proper method selection
              context.metadata.workType = 'problem';
              console.log(`🔍 DIGGING_METHOD_SELECTION: Stored new problem from restate_problem_future: "${newProblem}"`);
              console.log(`🔍 DIGGING_METHOD_SELECTION: Iteration #${context.metadata.diggingProblemNumber}`);
              console.log(`🔍 DIGGING_METHOD_SELECTION: Set workType to 'problem' for method selection`);
              console.log('🔍 BELIEF_DEBUG digging_method_selection - context.metadata after storing:', JSON.stringify(context.metadata, null, 2));
              console.log('🔍 BELIEF_DEBUG digging_method_selection - context.problemStatement after storing:', context.problemStatement);
              
              return `We need to clear this problem. Which method would you like to use?`;
            }
            
            const problemStatement = context.metadata.currentDiggingProblem || context.problemStatement || 'the problem';
            
            // If we already have the problem stored and no new input, show the selection message
            if (!input || input === 'METHOD_SELECTION_NEEDED') {
              return `We need to clear this problem. Which method would you like to use?`;
            }
            
            // Handle method selection - route to proper treatment intro steps
            if (input.toLowerCase().includes('problem shifting') || input === '1') {
              context.currentPhase = 'problem_shifting';
              context.metadata.selectedMethod = 'problem_shifting';
              context.metadata.skipIntroInstructions = true; // Skip lengthy instructions for digging deeper
              console.log(`🔍 DIGGING_METHOD_SELECTION: Selected Problem Shifting for digging deeper`);
              return "PROBLEM_SHIFTING_SELECTED";
            } else if (input.toLowerCase().includes('identity shifting') || input === '2') {
              context.currentPhase = 'identity_shifting';
              context.metadata.selectedMethod = 'identity_shifting';
              context.metadata.skipIntroInstructions = true; // Skip lengthy instructions for digging deeper
              console.log(`🔍 DIGGING_METHOD_SELECTION: Selected Identity Shifting for digging deeper`);
              return "IDENTITY_SHIFTING_SELECTED";
            } else if (input.toLowerCase().includes('belief shifting') || input === '3') {
              context.currentPhase = 'belief_shifting';
              context.metadata.selectedMethod = 'belief_shifting';
              context.metadata.skipIntroInstructions = true; // Skip lengthy instructions for digging deeper
              console.log(`🔍 DIGGING_METHOD_SELECTION: Selected Belief Shifting for digging deeper`);
              return "BELIEF_SHIFTING_SELECTED";
            } else if (input.toLowerCase().includes('blockage shifting') || input === '4') {
              context.currentPhase = 'blockage_shifting';
              context.metadata.selectedMethod = 'blockage_shifting';
              context.metadata.skipIntroInstructions = true; // Skip lengthy instructions for digging deeper
              console.log(`🔍 DIGGING_METHOD_SELECTION: Selected Blockage Shifting for digging deeper`);
              return "BLOCKAGE_SHIFTING_SELECTED";
            } else {
              return "Please choose Problem Shifting, Identity Shifting, Belief Shifting, or Blockage Shifting.";
            }
          },
          expectedResponseType: 'selection',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose a method.' }
          ],
          nextStep: undefined, // Handled by routing logic based on selected method
          aiTriggers: []
        },
        {
          id: 'scenario_check_1',
          scriptedResponse: (userInput, context) => {
            // Always reference the ORIGINAL problem (Problem 1), not any digging problems
            const originalProblem = context?.metadata?.originalProblemStatement || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the original problem';
            return `Is there any scenario in which '${originalProblem}' would still be a problem for you?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'restate_scenario_problem_1',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'restate_scenario_problem_1',
          scriptedResponse: "How would you state the problem in a few words?",
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me how you would state this scenario problem.' }
          ],
          nextStep: 'clear_scenario_problem_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' },
            { condition: 'tooLong', action: 'simplify' }
          ]
        },
        {
          id: 'clear_scenario_problem_1',
          scriptedResponse: (userInput, context) => {
            // Store the new scenario problem for clearing
            const newProblem = context?.userResponses?.['restate_scenario_problem_1'] || 'the problem';
            context.metadata.currentDiggingProblem = newProblem;
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 2) + 1;
            context.metadata.returnToDiggingStep = 'scenario_check_1'; // Return to this scenario check after clearing
            context.metadata.workType = 'problem'; // Set work type for method selection
            
            // Set the problem statement for the method selection
            context.problemStatement = newProblem;
            
            // Ask user to choose method instead of dictating
            return "We need to clear this problem. Which method would you like to use?";
          },
          expectedResponseType: 'selection',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose a method.' }
          ],
          nextStep: 'digging_method_selection',
          aiTriggers: []
        },
        {
          id: 'scenario_check_2',
          scriptedResponse: (userInput, context) => {
            const originalProblem = context?.metadata?.originalProblemStatement || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the original problem';
            return `Is there any scenario in which '${originalProblem}' would still be a problem for you?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'restate_scenario_problem_2',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'restate_scenario_problem_2',
          scriptedResponse: "How would you state the problem in a few words?",
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me how you would state this scenario problem.' }
          ],
          nextStep: 'clear_scenario_problem_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' },
            { condition: 'tooLong', action: 'simplify' }
          ]
        },
        {
          id: 'clear_scenario_problem_2',
          scriptedResponse: (userInput, context) => {
            // Store the new scenario problem for clearing
            const newProblem = context?.userResponses?.['restate_scenario_problem_2'] || 'the problem';
            context.metadata.currentDiggingProblem = newProblem;
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 3) + 1;
            context.metadata.returnToDiggingStep = 'scenario_check_2'; // Return to this scenario check after clearing
            context.metadata.workType = 'problem'; // Set work type for method selection
            
            // Set the problem statement for the method selection
            context.problemStatement = newProblem;
            
            // Ask user to choose method instead of dictating
            return "We need to clear this problem. Which method would you like to use?";
          },
          expectedResponseType: 'selection',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose a method.' }
          ],
          nextStep: 'digging_method_selection',
          aiTriggers: []
        },
        {
          id: 'scenario_check_3',
          scriptedResponse: (userInput, context) => {
            const originalProblem = context?.metadata?.originalProblemStatement || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the original problem';
            return `Is there any scenario in which '${originalProblem}' would still be a problem for you?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'restate_scenario_problem_3',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'restate_scenario_problem_3',
          scriptedResponse: "How would you state the problem in a few words?",
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me how you would state this scenario problem.' }
          ],
          nextStep: 'clear_scenario_problem_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' },
            { condition: 'tooLong', action: 'simplify' }
          ]
        },
        {
          id: 'clear_scenario_problem_3',
          scriptedResponse: (userInput, context) => {
            // Store the new scenario problem for clearing
            const newProblem = context?.userResponses?.['restate_scenario_problem_3'] || 'the problem';
            context.metadata.currentDiggingProblem = newProblem;
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 4) + 1;
            context.metadata.returnToDiggingStep = 'scenario_check_3'; // Return to this scenario check after clearing
            context.metadata.workType = 'problem'; // Set work type for method selection
            
            // Set the problem statement for the method selection
            context.problemStatement = newProblem;
            
            // Ask user to choose method instead of dictating
            return "We need to clear this problem. Which method would you like to use?";
          },
          expectedResponseType: 'selection',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose a method.' }
          ],
          nextStep: 'digging_method_selection',
          aiTriggers: []
        },
        {
          id: 'anything_else_check_1',
          scriptedResponse: "Is there anything else about this that's still a problem for you?",
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'restate_anything_else_problem_1',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'restate_anything_else_problem_1',
          scriptedResponse: "How would you state the problem in a few words?",
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me how you would state this problem.' }
          ],
          nextStep: 'clear_anything_else_problem_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' },
            { condition: 'tooLong', action: 'simplify' }
          ]
        },
        {
          id: 'clear_anything_else_problem_1',
          scriptedResponse: (userInput, context) => {
            // Store the new "anything else" problem for clearing
            const newProblem = context?.userResponses?.['restate_anything_else_problem_1'] || 'the problem';
            context.metadata.currentDiggingProblem = newProblem;
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 5) + 1;
            context.metadata.returnToDiggingStep = 'future_problem_check'; // Always return to first digging deeper question
            context.metadata.workType = 'problem'; // Set work type for method selection
            
            // Set the problem statement for the method selection
            context.problemStatement = newProblem;
            
            // Directly show method selection message instead of using signal
            return "We need to clear this problem. Which method would you like to use?";
          },
          expectedResponseType: 'selection',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose a method.' }
          ],
          nextStep: 'digging_method_selection',
          aiTriggers: []
        },
        {
          id: 'anything_else_check_2',
          scriptedResponse: "Is there anything else about this that's still a problem for you?",
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'restate_anything_else_problem_2',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'restate_anything_else_problem_2',
          scriptedResponse: "How would you state the problem in a few words?",
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me how you would state this problem.' }
          ],
          nextStep: 'clear_anything_else_problem_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' },
            { condition: 'tooLong', action: 'simplify' }
          ]
        },
        {
          id: 'clear_anything_else_problem_2',
          scriptedResponse: (userInput, context) => {
            // Store the new "anything else" problem for clearing
            const newProblem = context?.userResponses?.['restate_anything_else_problem_2'] || 'the problem';
            context.metadata.currentDiggingProblem = newProblem;
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 6) + 1;
            context.metadata.returnToDiggingStep = 'future_problem_check'; // Always return to first digging deeper question
            context.metadata.workType = 'problem'; // Set work type for method selection
            
            // Set the problem statement for the method selection
            context.problemStatement = newProblem;
            return "METHOD_SELECTION_NEEDED"; // Signal to show method selection
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please continue with the process.' }
          ],
          nextStep: undefined, // Handled by routing logic
          aiTriggers: []
        },
        {
          id: 'anything_else_check_3',
          scriptedResponse: "Is there anything else about this that's still a problem for you?",
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'route_to_integration',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'route_to_integration',
          scriptedResponse: "ROUTE_TO_INTEGRATION", // This should trigger special handling
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please continue.' }
          ],
          nextStep: undefined, // Handled by routing logic
          aiTriggers: []
        }
      ]
    });

    // Phase 6: Integration Questions (Always Required)
    this.phases.set('integration', {
      name: 'Integration',
      maxDuration: 15,
      steps: [
        {
          id: 'integration_start',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement from the stored context or fallback to previous responses
            // CRITICAL: Prioritize originalProblemStatement for Blockage Shifting - Integration Questions should reference the FIRST problem, not the last
            const problemStatement = context?.metadata?.originalProblemStatement || context?.metadata?.problemStatement || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
            return `Ok now we have cleared the problem, next I will ask you some questions about how your perspective has shifted and what you want to do next. So firstly, how do you feel about the former problem of '${problemStatement}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me how you feel about the former problem now.' }
          ],
          nextStep: 'awareness_question',
          aiTriggers: []
        },
        {
          id: 'awareness_question',
          scriptedResponse: "What are you more aware of now than before we did this process?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you are more aware of now.' }
          ],
          nextStep: 'how_helped_question',
          aiTriggers: []
        },
        {
          id: 'how_helped_question',
          scriptedResponse: "How has it helped you to do this process?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me how this process has helped you.' }
          ],
          nextStep: 'narrative_question',
          aiTriggers: []
        },
        {
          id: 'narrative_question',
          scriptedResponse: "What is your new narrative about this?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me your new narrative about this.' }
          ],
          nextStep: 'intention_question',
          aiTriggers: []
        },
        {
          id: 'intention_question',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement from the stored context or fallback to previous responses
            // CRITICAL: Prioritize originalProblemStatement for Blockage Shifting - Integration Questions should reference the FIRST problem, not the last
            const problemStatement = context?.metadata?.originalProblemStatement || context?.metadata?.problemStatement || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the former problem';
            return `What's your intention now in relation to the former problem of '${problemStatement}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what your intention is now.' }
          ],
          nextStep: 'action_question',
          aiTriggers: []
        },
        {
          id: 'action_question',
          scriptedResponse: (userInput, context) => {
            // Get the intention from the previous step (intention_question)
            const userIntention = context.userResponses?.['intention_question'] || 'your intention';
            return `What needs to happen for you to realise your intention of '${userIntention}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what needs to happen.' }
          ],
          nextStep: 'action_followup',
          aiTriggers: []
        },
        {
          id: 'action_followup',
          scriptedResponse: (userInput, context) => {
            // Get the intention from the intention_question step
            const userIntention = context.userResponses?.['intention_question'] || 'your intention';
            return `What else needs to happen for you to realise your intention of '${userIntention}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please tell me what else needs to happen, or say "nothing" if nothing else comes to mind.' }
          ],
          nextStep: 'one_thing_question',
          aiTriggers: []
        },
        {
          id: 'one_thing_question',
          scriptedResponse: "What is the one thing you can do that will make everything else easier or unnecessary?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me the one thing that will make everything else easier.' }
          ],
          nextStep: 'first_action_question',
          aiTriggers: []
        },
        {
          id: 'first_action_question',
          scriptedResponse: "What is the first action that you can commit to now that will help you to realise your intention?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me the first action you can commit to.' }
          ],
          nextStep: 'when_will_you_do_this',
          aiTriggers: []
        },
        {
          id: 'when_will_you_do_this',
          scriptedResponse: "When will you do this?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me when you will do this.' }
          ],
          nextStep: 'session_complete',
          aiTriggers: []
        },
        {
          id: 'session_complete',
          scriptedResponse: "Thank you for doing this Mind Shifting session. The process is now complete. How do you feel overall about the work we've done today?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please share how you feel about the session.' }
          ],
          nextStep: undefined,
          aiTriggers: []
        }
      ]
    });
  }

  // Helper methods for multiple problem detection
  private countProblems(userInput: string): number {
    const problemConnectors = ['and', 'also', 'plus', 'additionally', 'another', 'other', 'too', 'as well', 'along with'];
    let count = 1; // Start with 1 problem
    problemConnectors.forEach(connector => {
      if (userInput.toLowerCase().includes(connector)) {
        count++;
      }
    });
    return count;
  }

  private extractProblems(userInput: string): string[] {
    // Simple extraction - split by common connectors
    const problems: string[] = [];
    const connectors = ['and', 'also', 'plus', 'additionally', 'another', 'other', 'too', 'as well', 'along with'];
    
    let remaining = userInput;
    for (const connector of connectors) {
      if (remaining.toLowerCase().includes(connector)) {
        const parts = remaining.split(new RegExp(`\\b${connector}\\b`, 'i'));
        problems.push(...parts.map(p => p.trim()).filter(p => p.length > 0));
        break; // Only split on the first connector found
      }
    }
    
    // If no connectors found, treat as single problem
    if (problems.length === 0) {
      problems.push(remaining.trim());
    }
    
    return problems.filter(p => p.length > 0); // Remove any empty strings
  }

  private getOrCreateContext(sessionId: string, context?: Partial<TreatmentContext>): TreatmentContext {
    if (!this.contexts.has(sessionId)) {
      console.log(`🔍 GET_OR_CREATE_CONTEXT: Creating NEW context for session ${sessionId}`);
      this.contexts.set(sessionId, {
        userId: context?.userId || '',
        sessionId,
        currentPhase: 'introduction',
        currentStep: 'mind_shifting_explanation',
        userResponses: {},
        startTime: new Date(),
        lastActivity: new Date(),
        metadata: {
          cycleCount: 0,
          problemStatement: '',
          lastResponse: '',
          workType: 'problem' // default to problem type
        }
      });
    } else {
      console.log(`🔍 GET_OR_CREATE_CONTEXT: Using EXISTING context for session ${sessionId}`);
    }
    
    const retrievedContext = this.contexts.get(sessionId)!;
    console.log(`🔍 GET_OR_CREATE_CONTEXT: Retrieved context:`, JSON.stringify({
      sessionId: retrievedContext.sessionId,
      currentPhase: retrievedContext.currentPhase,
      currentStep: retrievedContext.currentStep,
      workType: retrievedContext.metadata.workType,
      selectedMethod: retrievedContext.metadata.selectedMethod
    }, null, 2));
    
    return retrievedContext;
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
    const dbContext = await this.loadContextFromDatabase(sessionId);
    if (dbContext) {
      this.contexts.set(sessionId, dbContext);
      return dbContext;
    }

    // Create new context if not found
    const newContext: TreatmentContext = {
      userId: context?.userId || '',
      sessionId,
      currentPhase: 'introduction',
      currentStep: 'mind_shifting_explanation',
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
    
    // Clear goal-related cache for new sessions to prevent stale goal data
    this.clearGoalCache();
    
    // Save new context to database
    await this.saveContextToDatabase(newContext);
    
    return newContext;
  }

  /**
   * Clear context for fresh session start
   */
  public async clearContext(sessionId: string): Promise<void> {
    console.log(`🗑️ CLEAR_CONTEXT: Clearing context for session ${sessionId}`);
    
    // Remove from memory
    this.contexts.delete(sessionId);
    
    // Clear from database (optional - you might want to keep for analytics)
    // For now, we'll just clear from memory to ensure fresh start
    console.log(`🗑️ CLEAR_CONTEXT: Context cleared for session ${sessionId}`);
  }

  private determineNextStep(currentStep: TreatmentStep, context: TreatmentContext): string | null {
    const lastResponse = context.userResponses[context.currentStep]?.toLowerCase() || '';
    
    console.log(`🔍 DETERMINE_NEXT_STEP: currentStep="${context.currentStep}", lastResponse="${lastResponse}", userResponses=`, context.userResponses);
    
    // Handle special routing signals for integration questions
    if (currentStep.scriptedResponse && typeof currentStep.scriptedResponse === 'function') {
      const response = currentStep.scriptedResponse('', context);
      if (response.startsWith('ROUTE_TO_')) {
        if (response === 'ROUTE_TO_PROBLEM_INTEGRATION') {
          return 'problem_integration_awareness_1';
        } else if (response === 'ROUTE_TO_IDENTITY_INTEGRATION') {
          return 'integration_awareness_1';
        } else if (response === 'ROUTE_TO_BELIEF_INTEGRATION') {
          return 'belief_integration_awareness_1';
        } else if (response === 'ROUTE_TO_BLOCKAGE_INTEGRATION') {
          return 'blockage_integration_awareness_1';
        } else if (response === 'ROUTE_TO_TRAUMA_INTEGRATION') {
          return 'trauma_integration_awareness_1';
        }
      }
    }

    // Handle special flow logic based on current step
    console.log(`🔍 DETERMINE_NEXT_STEP: *** SWITCH STATEMENT *** - context.currentStep="${context.currentStep}"`);
    switch (context.currentStep) {
      case 'choose_method':
        console.log(`🔍 CHOOSE_METHOD_DETERMINE: lastResponse="${lastResponse}", processing choose_method step`);
        // Route to different methods based on user choice
        const chosenMethod = context.userResponses[context.currentStep]?.toLowerCase() || '';
        console.log(`🔍 CHOOSE_METHOD_DETERMINE: chosenMethod="${chosenMethod}"`);
        
        // Check if problem statement already exists (e.g., from trauma redirect)
        const hasProblemStatement = !!(context.metadata.problemStatement || context.problemStatement);
        console.log(`🔍 CHOOSE_METHOD_DETERMINE: hasProblemStatement="${hasProblemStatement}", problemStatement="${context.metadata.problemStatement}"`);
        
        if (chosenMethod.includes('problem shifting')) {
          context.metadata.selectedMethod = 'problem_shifting';
          if (hasProblemStatement) {
            // Problem already stated, go directly to treatment
            context.currentPhase = 'problem_shifting';
            console.log(`🔍 CHOOSE_METHOD_DETERMINE: Problem Shifting with existing problem, going to problem_shifting_intro`);
            return 'problem_shifting_intro';
          } else {
            // Need to ask for problem first
            context.currentPhase = 'work_type_selection';
            console.log(`🔍 CHOOSE_METHOD_DETERMINE: Selected Problem Shifting, returning work_type_description`);
            return 'work_type_description';
          }
        } else if (chosenMethod.includes('blockage shifting')) {
          context.metadata.selectedMethod = 'blockage_shifting';
          if (hasProblemStatement) {
            context.currentPhase = 'blockage_shifting';
            console.log(`🔍 CHOOSE_METHOD_DETERMINE: Blockage Shifting with existing problem, going to blockage_shifting_intro`);
            return 'blockage_shifting_intro';
          } else {
            context.currentPhase = 'work_type_selection';
            console.log(`🔍 CHOOSE_METHOD_DETERMINE: Selected Blockage Shifting, returning work_type_description`);
            return 'work_type_description';
          }
        } else if (chosenMethod.includes('identity shifting')) {
          context.metadata.selectedMethod = 'identity_shifting';
          if (hasProblemStatement) {
            context.currentPhase = 'identity_shifting';
            console.log(`🔍 CHOOSE_METHOD_DETERMINE: Identity Shifting with existing problem, going to identity_shifting_intro`);
            return 'identity_shifting_intro';
          } else {
            context.currentPhase = 'work_type_selection';
            console.log(`🔍 CHOOSE_METHOD_DETERMINE: Selected Identity Shifting, returning work_type_description`);
            return 'work_type_description';
          }
        } else if (chosenMethod.includes('belief shifting')) {
          context.metadata.selectedMethod = 'belief_shifting';
          if (hasProblemStatement) {
            context.currentPhase = 'belief_shifting';
            console.log(`🔍 CHOOSE_METHOD_DETERMINE: Belief Shifting with existing problem, going to belief_shifting_intro`);
            return 'belief_shifting_intro';
          } else {
            context.currentPhase = 'work_type_selection';
            console.log(`🔍 CHOOSE_METHOD_DETERMINE: Selected Belief Shifting, returning work_type_description`);
            return 'work_type_description';
          }
        } else if (chosenMethod.includes('reality shifting')) {
          context.currentPhase = 'reality_shifting';
          context.metadata.selectedMethod = 'reality_shifting';
          console.log(`🔍 CHOOSE_METHOD_DETERMINE: Selected Reality Shifting, returning reality_goal_capture`);
          return 'reality_goal_capture';
        } else if (chosenMethod.includes('trauma shifting')) {
          context.currentPhase = 'work_type_selection';
          context.metadata.selectedMethod = 'trauma_shifting';
          console.log(`🔍 CHOOSE_METHOD_DETERMINE: Selected Trauma Shifting, returning work_type_description`);
          return 'work_type_description';
        } else {
          // Fallback to Problem Shifting (all methods now implemented)
          context.currentPhase = 'work_type_selection';
          context.metadata.selectedMethod = 'problem_shifting';
          console.log(`🔍 CHOOSE_METHOD_DETERMINE: No valid selection, fallback to Problem Shifting, returning work_type_description`);
          return 'work_type_description';
        }

      case 'mind_shifting_explanation':
        console.log(`🔍 MIND_SHIFTING_DETERMINE: lastResponse="${lastResponse}", workType="${context.metadata.workType}", selectedMethod="${context.metadata.selectedMethod}"`);
        console.log(`🔍 MIND_SHIFTING_DETERMINE: Full metadata:`, JSON.stringify(context.metadata, null, 2));
        
        // Handle work type selection based on user input
        if (lastResponse.includes('1') || (lastResponse.includes('problem') && !lastResponse.includes('shifting'))) {
          // Reset all work type metadata for fresh selection
          context.metadata.workType = 'problem';
          context.metadata.selectedMethod = undefined;
          console.log(`🎯 WORK_TYPE_SELECTION: Set workType to 'problem'`);
          // For problems, go to method selection phase and step
          context.currentPhase = 'method_selection';
          return 'choose_method';
        } else if (lastResponse.includes('2') || (lastResponse.includes('goal') && !lastResponse.includes('shifting'))) {
          // Reset all work type metadata for fresh selection
          context.metadata.workType = 'goal';
          context.metadata.selectedMethod = undefined;
          console.log(`🎯 WORK_TYPE_SELECTION: Set workType to 'goal'`);
          // Stay in introduction phase for goal description
          return 'goal_description';
        } else if (lastResponse.includes('3') || (lastResponse.includes('negative') && !lastResponse.includes('shifting')) || (lastResponse.includes('experience') && !lastResponse.includes('shifting'))) {
          // Reset all work type metadata for fresh selection
          context.metadata.workType = 'negative_experience';
          context.metadata.selectedMethod = undefined;
          console.log(`🎯 WORK_TYPE_SELECTION: Set workType to 'negative_experience'`);
          // Stay in introduction phase for negative experience description
          return 'negative_experience_description';
        }
        
        // If no valid selection, stay on current step
        console.log(`🔍 MIND_SHIFTING_DETERMINE: No valid work type selected, staying on mind_shifting_explanation`);
        return 'mind_shifting_explanation';
        
        const selectedWorkType = context.metadata.workType;
        const selectedMethod = context.metadata.selectedMethod;
        console.log(`🔍 MIND_SHIFTING_DETERMINE: selectedWorkType="${selectedWorkType}", selectedMethod="${selectedMethod}"`);  
        
        // If user selected a work type and method (for problems), check if we have problem statement
        if (selectedWorkType === 'problem' && selectedMethod) {
          // Only skip to treatment intro if we already have a problem statement
          if (context.problemStatement || context.metadata.problemStatement) {
            console.log(`🔍 MIND_SHIFTING_DETERMINE: Problem, method, and problem statement all present - going directly to treatment intro`);
            if (selectedMethod === 'problem_shifting') {
              context.currentPhase = 'problem_shifting';
              return 'problem_shifting_intro';
            } else if (selectedMethod === 'identity_shifting') {
              context.currentPhase = 'identity_shifting';
              return 'identity_shifting_intro';
            } else if (selectedMethod === 'belief_shifting') {
              context.currentPhase = 'belief_shifting';
              return 'belief_shifting_intro';
            } else if (selectedMethod === 'blockage_shifting') {
              context.currentPhase = 'blockage_shifting';
              return 'blockage_shifting_intro';
            }
          } else {
            // Method selected but no problem statement yet - need to collect it
            console.log(`🔍 MIND_SHIFTING_DETERMINE: Problem and method selected, but no problem statement - going to collect problem description`);
            context.currentPhase = 'work_type_selection';
            return 'work_type_description';
          }
        } else if (selectedWorkType === 'goal') {
          // Check if we have the goal description yet
          if (!context.problemStatement && !context.metadata.problemStatement) {
            // Go to dedicated goal description step - ensure we stay in introduction phase
            console.log(`🔍 MIND_SHIFTING_DETERMINE: Goal selected, going to goal_description step`);
            context.currentPhase = 'introduction'; // Explicitly set to ensure we're in correct phase
            return 'goal_description';
          } else {
            // Have description, go to reality shifting intro
            console.log(`🔍 MIND_SHIFTING_DETERMINE: Goal and description provided, going to reality_shifting_intro`);
            context.currentPhase = 'reality_shifting';
            context.metadata.selectedMethod = 'reality_shifting';
            return 'reality_shifting_intro';
          }
        } else if (selectedWorkType === 'negative_experience') {
          // Check if we have the negative experience description yet
          if (!context.problemStatement && !context.metadata.problemStatement) {
            // Go to dedicated negative experience description step - ensure we stay in introduction phase
            console.log(`🔍 MIND_SHIFTING_DETERMINE: Negative experience selected, going to negative_experience_description step`);
            context.currentPhase = 'introduction'; // Explicitly set to ensure we're in correct phase
            return 'negative_experience_description';
          } else {
            // Have description, go to trauma shifting intro
            console.log(`🔍 MIND_SHIFTING_DETERMINE: Negative experience and description provided, going to trauma_shifting_intro`);
            context.currentPhase = 'trauma_shifting';
            context.metadata.selectedMethod = 'trauma_shifting';
            return 'trauma_shifting_intro';
          }
        } else if (selectedWorkType === 'problem' && !selectedMethod) {
          // Problem selected but no method yet, stay on current step for method selection
          console.log(`🔍 MIND_SHIFTING_DETERMINE: Problem selected, waiting for method selection, staying on mind_shifting_explanation`);
          return 'mind_shifting_explanation';
        } else {
          // No valid work type selected yet, stay on current step
          console.log(`🔍 MIND_SHIFTING_DETERMINE: No valid work type selected, staying on mind_shifting_explanation`);
          return 'mind_shifting_explanation';
        }

        
      case 'work_type_description':
        // CRITICAL: Store the user's problem statement FIRST before routing
        const userProblemStatement = context.userResponses[context.currentStep] || '';
        if (userProblemStatement) {
          console.log(`🔍 WORK_TYPE_DESCRIPTION_DETERMINE: Storing user problem statement: "${userProblemStatement}"`);
          context.metadata.problemStatement = userProblemStatement;
          context.problemStatement = userProblemStatement; // Keep for compatibility
          // Store the original problem statement for digging deeper questions
          if (!context.metadata.originalProblemStatement) {
            context.metadata.originalProblemStatement = userProblemStatement;
          }
          console.log(`🔍 WORK_TYPE_DESCRIPTION_DETERMINE: Stored - metadata: "${context.metadata.problemStatement}", context: "${context.problemStatement}"`);
        }
        
        // User provided description, route to appropriate treatment intro
        const descWorkType = context.metadata.workType;
        const descSelectedMethod = context.metadata.selectedMethod;
        
        if (descWorkType === 'problem' && descSelectedMethod) {
          if (descSelectedMethod === 'identity_shifting') {
            context.currentPhase = 'identity_shifting';
            return 'identity_shifting_intro';
          } else if (descSelectedMethod === 'problem_shifting') {
            context.currentPhase = 'problem_shifting';
            return 'problem_shifting_intro';
          } else if (descSelectedMethod === 'belief_shifting') {
            context.currentPhase = 'belief_shifting';
            return 'belief_shifting_intro';
          } else if (descSelectedMethod === 'blockage_shifting') {
            context.currentPhase = 'blockage_shifting';
            return 'blockage_shifting_intro';
          }
        } else if (descWorkType === 'goal') {
          context.currentPhase = 'reality_shifting';
          return 'reality_shifting_intro';
        } else if (descWorkType === 'negative_experience') {
          context.currentPhase = 'trauma_shifting';
          return 'trauma_shifting_intro';
        } else if (descWorkType === 'problem' && !descSelectedMethod) {
          // Problem work type but no method selected yet - route to method selection
          context.currentPhase = 'method_selection';
          return 'choose_method';
        }
        
        // Fallback to confirmation step (for other cases like goal without method)
        return 'confirm_statement';
        
      case 'work_type_selection':
        // Already handled in the scriptedResponse, continue to next step
        return 'confirm_statement';
        
      case 'confirm_statement':
        const confirmInput = lastResponse.toLowerCase();
        
        // If user says "no", route back to appropriate input step based on workType
        if (confirmInput.includes('no') || confirmInput.includes('not') || confirmInput.includes('wrong') || confirmInput.includes('incorrect')) {
          const workType = context.metadata.workType;
          
          // DEBUG: Log the state
          console.log(`🔍 CONFIRM_STATEMENT "NO": workType=${workType}, hasTraumaRedirect=${!!context.userResponses['trauma_problem_redirect']}, userResponses keys:`, Object.keys(context.userResponses || {}));
          
          // Check if this came from trauma_problem_redirect - check FIRST before workType
          if (context.userResponses['trauma_problem_redirect']) {
            context.currentPhase = 'trauma_shifting'; // Set correct phase
            delete context.userResponses['trauma_problem_redirect']; // Clear old response
            delete context.userResponses['confirm_statement']; // Clear old confirmation too
            // Don't clear problemStatement - trauma_problem_redirect will overwrite it with new value
            
            // Persist the cleared responses to database
            this.saveContextToDatabase(context).catch(error => 
              console.error('Failed to save cleared responses to database:', error)
            );
            
            return 'trauma_problem_redirect'; // Go back to re-answer how they feel
          }
          
          // Otherwise route based on workType to re-enter description
          if (workType === 'problem') {
            // For regular problems, clear statement and ask again
            context.metadata.problemStatement = undefined;
            context.problemStatement = undefined;
            return 'work_type_description'; // Stay in work_type_selection phase
          } else if (workType === 'goal') {
            context.currentPhase = 'introduction';
            return 'goal_description';
          } else if (workType === 'negative_experience') {
            context.currentPhase = 'introduction'; // Set correct phase for negative_experience_description
            return 'negative_experience_description';
          }
          
          // Fallback (should rarely happen)
          return 'work_type_description';
        }
        // If user says "yes", route to treatment
        if (confirmInput.includes('yes') || confirmInput.includes('correct') || confirmInput.includes('right')) {
          return 'route_to_method';
        }
        // If it's not yes/no, stay on confirm_statement (it will handle showing confirmation)
        return 'confirm_statement';
        
      case 'route_to_method':
        const routeWorkType = context.metadata.workType;
        const routeSelectedMethod = context.metadata.selectedMethod;
        
        if (routeWorkType === 'goal') {
          // Goals: we showed reality_goal_capture content, so go to reality_shifting_intro next
          context.currentPhase = 'reality_shifting';
          context.metadata.selectedMethod = 'reality_shifting';
          return 'reality_shifting_intro';
        } else if (routeWorkType === 'negative_experience') {
          // Negative experiences: we showed trauma_shifting_intro content, so go to trauma_dissolve_step_a next
          context.currentPhase = 'trauma_shifting';
          context.metadata.selectedMethod = 'trauma_shifting';
          return 'trauma_dissolve_step_a';
        } else if (routeWorkType === 'problem' && routeSelectedMethod) {
          // Problems with selected method - route to appropriate intro
          if (routeSelectedMethod === 'problem_shifting') {
            return 'problem_shifting_intro';
          } else if (routeSelectedMethod === 'identity_shifting') {
            return 'identity_shifting_intro';
          } else if (routeSelectedMethod === 'belief_shifting') {
            return 'belief_shifting_intro';
          } else if (routeSelectedMethod === 'blockage_shifting') {
            return 'blockage_shifting_intro';
          }
        } else if (routeWorkType === 'problem' && !routeSelectedMethod) {
          // Problem work type but no method selected yet - route to method selection
          console.log(`🔧 ROUTE_TO_METHOD: Problem without method, routing to choose_method`);
          context.currentPhase = 'method_selection';
          return 'choose_method';
        }
        break;
        
      case 'goal_description':
        // User provided goal description, store it and check for deadline with AI assistance
        context.problemStatement = lastResponse;
        context.metadata.problemStatement = lastResponse;
        context.metadata.currentGoal = lastResponse;
        // Store the original problem statement for digging deeper questions
        if (!context.metadata.originalProblemStatement) {
          context.metadata.originalProblemStatement = lastResponse;
        }
        context.currentPhase = 'reality_shifting';
        context.metadata.selectedMethod = 'reality_shifting';
        console.log(`🔍 GOAL_DESCRIPTION: Stored goal: "${lastResponse}"`);
        
        // AI assistance: Check if deadline is already mentioned in the goal
        const hasDeadlineInGoal = this.detectDeadlineInGoal(lastResponse);
        if (hasDeadlineInGoal.hasDeadline && hasDeadlineInGoal.deadline && hasDeadlineInGoal.synthesizedGoal) {
          console.log(`🤖 AI_DEADLINE_DETECTION: Deadline detected in goal: "${hasDeadlineInGoal.deadline}"`);
          // Store the deadline and synthesized goal
          context.metadata.goalWithDeadline = hasDeadlineInGoal.synthesizedGoal;
          context.userResponses['goal_deadline_check'] = 'yes'; // Simulate yes response
          context.userResponses['goal_deadline_date'] = hasDeadlineInGoal.deadline;
          // Skip deadline questions and go directly to confirmation
          return 'goal_confirmation';
        } else {
          console.log(`🤖 AI_DEADLINE_DETECTION: No deadline detected, proceeding to deadline check`);
          return 'goal_deadline_check';
        }
        
      case 'reality_goal_capture':
        // User provided goal in reality shifting phase, store it and check for deadline with AI assistance
        context.problemStatement = lastResponse;
        context.metadata.problemStatement = lastResponse;
        context.metadata.currentGoal = lastResponse;
        // Store the original problem statement for digging deeper questions
        if (!context.metadata.originalProblemStatement) {
          context.metadata.originalProblemStatement = lastResponse;
        }
        console.log(`🔍 REALITY_GOAL_CAPTURE: Stored goal: "${lastResponse}"`);
        
        // AI assistance: Check if deadline is already mentioned in the goal
        const hasDeadlineInRealityGoal = this.detectDeadlineInGoal(lastResponse);
        if (hasDeadlineInRealityGoal.hasDeadline && hasDeadlineInRealityGoal.deadline && hasDeadlineInRealityGoal.synthesizedGoal) {
          console.log(`🤖 AI_DEADLINE_DETECTION (REALITY): Deadline detected in goal: "${hasDeadlineInRealityGoal.deadline}"`);
          // Store the deadline and synthesized goal
          context.metadata.goalWithDeadline = hasDeadlineInRealityGoal.synthesizedGoal;
          context.userResponses['goal_deadline_check'] = 'yes'; // Simulate yes response
          context.userResponses['goal_deadline_date'] = hasDeadlineInRealityGoal.deadline;
          // Skip deadline questions and go directly to confirmation
          return 'goal_confirmation';
        } else {
          console.log(`🤖 AI_DEADLINE_DETECTION (REALITY): No deadline detected, proceeding to deadline check`);
          return 'goal_deadline_check';
        }
        
      case 'goal_deadline_check':
        // Check if user said yes to deadline
        if (lastResponse.toLowerCase().includes('yes') || lastResponse.toLowerCase().includes('y')) {
          return 'goal_deadline_date';
        } else {
          return 'goal_confirmation';
        }
        
      case 'goal_deadline_date':
        // User provided deadline, proceed to confirmation
        return 'goal_confirmation';
        
      case 'goal_confirmation':
        // User confirmed goal statement, ask about certainty
        if (lastResponse.toLowerCase().includes('yes') || lastResponse.toLowerCase().includes('y')) {
          return 'goal_certainty';
        } else {
          // If user says no, clear goal metadata and restart goal capture
          context.metadata.currentGoal = '';
          context.metadata.goalWithDeadline = '';
          delete context.userResponses['goal_deadline_check'];
          delete context.userResponses['goal_deadline_date'];
          // Reset phase to introduction where goal_description lives
          context.currentPhase = 'introduction';
          return 'goal_description';
        }
        
      case 'goal_certainty':
        // User provided certainty percentage, proceed to reality shifting intro
        return 'reality_shifting_intro';
        
      case 'negative_experience_description':
        // User provided negative experience description, store it
        console.log(`🔍 NEGATIVE_EXPERIENCE_DESCRIPTION: *** CASE TRIGGERED *** - lastResponse="${lastResponse}"`);
        context.problemStatement = lastResponse;
        context.metadata.problemStatement = lastResponse;
        
        // Check if this is from dig deeper flow (originalProblemStatement exists means we're already working on something)
        const isFromDigDeeper = context.metadata.originalProblemStatement && 
                                context.metadata.originalProblemStatement !== lastResponse;
        
        if (isFromDigDeeper) {
          // Coming from dig deeper - route to method selection
          console.log(`🔍 NEGATIVE_EXPERIENCE_DESCRIPTION: From dig deeper flow, routing to method selection`);
          context.currentPhase = 'method_selection';
          context.metadata.selectedMethod = undefined; // Clear method so they can choose
          return 'choose_method';
        } else {
          // Initial flow - store as original and go straight to trauma shifting
          if (!context.metadata.originalProblemStatement) {
            context.metadata.originalProblemStatement = lastResponse;
          }
          context.currentPhase = 'trauma_shifting';
          context.metadata.selectedMethod = 'trauma_shifting';
          console.log(`🔍 NEGATIVE_EXPERIENCE_DESCRIPTION: Initial flow, going to trauma_shifting_intro`);
          console.log(`🔍 NEGATIVE_EXPERIENCE_DESCRIPTION: Context after update:`, JSON.stringify({
            currentPhase: context.currentPhase,
            currentStep: context.currentStep,
            problemStatement: context.problemStatement,
            selectedMethod: context.metadata.selectedMethod,
            workType: context.metadata.workType
          }, null, 2));
          return 'trauma_shifting_intro';
        }
        
      case 'multiple_problems_selection':
        return 'restate_selected_problem';
        
      case 'restate_selected_problem':
        return 'analyze_response';
        
      case 'analyze_response':
        // This is the problem selection analyze_response - use original logic
        // If user says "no", ask them to restate the problem
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          return 'restate_selected_problem';
        }
        // If user says "yes", move to method selection
        if (lastResponse.includes('yes') || lastResponse.includes('correct') || lastResponse.includes('right')) {
          // Store the problem statement for later use
          const problemResponse = context.userResponses['restate_selected_problem'] || context.userResponses['mind_shifting_explanation'] || '';
          context.problemStatement = problemResponse;
          context.metadata.problemStatement = problemResponse;
          context.currentPhase = 'method_selection';
          return 'choose_method';
        }
        break;
        
      case 'choose_method':
        // Route to different methods based on user choice
        const methodChoice = context.userResponses[context.currentStep]?.toLowerCase() || '';
        
        if (methodChoice.includes('problem shifting')) {
          context.currentPhase = 'work_type_selection';
          context.metadata.selectedMethod = 'problem_shifting';
          return 'work_type_description';
        } else if (methodChoice.includes('blockage shifting')) {
          context.currentPhase = 'work_type_selection';
          context.metadata.selectedMethod = 'blockage_shifting';
          return 'work_type_description';
        } else if (methodChoice.includes('identity shifting')) {
          context.currentPhase = 'work_type_selection';
          context.metadata.selectedMethod = 'identity_shifting';
          return 'work_type_description';
        } else if (methodChoice.includes('reality shifting')) {
          context.currentPhase = 'reality_shifting';
          context.metadata.selectedMethod = 'reality_shifting';
          return 'reality_goal_capture';
        } else if (methodChoice.includes('trauma shifting')) {
          context.currentPhase = 'work_type_selection';
          context.metadata.selectedMethod = 'trauma_shifting';
          return 'work_type_description';
        } else if (methodChoice.includes('belief shifting')) {
          context.currentPhase = 'work_type_selection';
          context.metadata.selectedMethod = 'belief_shifting';
          return 'work_type_description';
        } else {
          // Fallback to Problem Shifting (all methods now implemented)
          context.currentPhase = 'work_type_selection';
          context.metadata.selectedMethod = 'problem_shifting';
          return 'work_type_description';
        }

      case 'method_selection':
        // When user has selected a method, check if method is set and route appropriately
        const currentSelectedMethod = context.metadata.selectedMethod;
        console.log(`🔍 METHOD_SELECTION_DETERMINE: selectedMethod="${currentSelectedMethod}"`);
        
        if (currentSelectedMethod) {
          // Method was selected, now ask for problem description
          return 'work_type_description';
        } else {
          // No method selected yet, stay on method selection
          return 'method_selection';
        }
        
      case 'check_if_still_problem':
        // Core cycling logic for Problem Shifting
        if (lastResponse.includes('yes') || lastResponse.includes('still')) {
          // Still a problem - cycle back to problem_shifting_intro but skip the introductory instructions
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          context.metadata.skipIntroInstructions = true; // Flag to skip intro instructions
          context.metadata.skipLinguisticProcessing = true; // Flag to prevent AI processing on repeat
          return 'problem_shifting_intro';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No longer a problem - check if we've already asked permission to dig deeper
          const alreadyGrantedPermission = context.userResponses['digging_deeper_start'] === 'yes';
          const returnStep = context.metadata?.returnToDiggingStep;
          
          if (alreadyGrantedPermission && returnStep) {
            // Permission already granted and we're returning from a sub-problem - skip permission, continue digging
            context.currentPhase = 'digging_deeper';
            context.metadata.returnToDiggingStep = undefined; // Clear now that we're returning
            return returnStep;
          } else if (alreadyGrantedPermission) {
            // Permission already granted - skip permission, go to future_problem_check to continue digging
            context.currentPhase = 'digging_deeper';
            return 'future_problem_check';
          } else {
            // First time - ask permission
            context.currentPhase = 'digging_deeper';
            return 'digging_deeper_start';
          }
        }
        break;
        
      case 'blockage_step_e':
        // Check if user indicates no problem left (exit clause)
        const stepENoProblemIndicators = ['no problem', 'nothing', 'none', 'gone', 'resolved', 'fine', 'good', 'better', 'clear'];
        const stepESeemsResolved = stepENoProblemIndicators.some(indicator => lastResponse.includes(indicator)) ||
          // Check for standalone "no" or "not" responses (not part of problem descriptions)
          (lastResponse.trim() === 'no') || 
          (lastResponse.trim() === 'not') ||
          (lastResponse.trim() === 'no problem') ||
          (lastResponse.startsWith('no ') && lastResponse.length < 15) || // Short "no" responses
          (lastResponse.startsWith('not ') && lastResponse.length < 15);  // Short "not" responses
        
        if (stepESeemsResolved) {
          // Problem seems resolved - move to dig deeper
          console.log(`🔍 BLOCKAGE_STEP_E: Problem resolved (response: "${lastResponse}"), moving to dig deeper`);
          context.currentPhase = 'digging_deeper';
          return 'digging_deeper_start';
        } else {
          // Still a problem - update problem statement and cycle back to step A
          const newProblem = context.userResponses[context.currentStep] || lastResponse;
          if (newProblem) {
            // Update the problem statement with the new problem
            context.problemStatement = newProblem;
            context.metadata.problemStatement = newProblem;
            context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
            console.log(`🔍 BLOCKAGE_STEP_E: Updated problem to "${newProblem}", cycling back to blockage_shifting_intro`);
          }
          return 'blockage_shifting_intro';
        }
        
      case 'blockage_check_if_still_problem':
        // Core cycling logic for Blockage Shifting
        // Check if the response indicates no problem left
        const noProblemIndicators = ['no problem', 'nothing', 'none', 'gone', 'resolved', 'fine', 'good', 'better', 'clear'];
        const seemsResolved = noProblemIndicators.some(indicator => lastResponse.includes(indicator)) ||
          // Check for standalone "no" or "not" responses (not part of problem descriptions)
          (lastResponse.trim() === 'no') || 
          (lastResponse.trim() === 'not') ||
          (lastResponse.trim() === 'no problem') ||
          (lastResponse.startsWith('no ') && lastResponse.length < 15) || // Short "no" responses
          (lastResponse.startsWith('not ') && lastResponse.length < 15);  // Short "not" responses
        console.log(`🔍 BLOCKAGE_CHECK: lastResponse="${lastResponse}", seemsResolved=${seemsResolved}, noProblemIndicators matched:`, noProblemIndicators.filter(indicator => lastResponse.includes(indicator)));
        
        // Check if user is responding to dig deeper question with yes/no
        const isDigDeeperResponse = lastResponse.includes('yes') || lastResponse.includes('no');
        
        if (isDigDeeperResponse) {
          // User is responding to "Would you like to dig deeper in this area?"
          console.log(`🔍 BLOCKAGE_CHECK_DIG_DEEPER: User responded ${lastResponse} to dig deeper question`);
          context.currentPhase = 'digging_deeper';
          return 'digging_deeper_start';
        } else if (seemsResolved) {
          // Problem seems resolved - check if we've already asked permission to dig deeper
          console.log(`🔍 BLOCKAGE_CHECK_RESOLVED: Problem resolved, transitioning to dig deeper`);
          const alreadyGrantedPermission = context.userResponses['digging_deeper_start'] === 'yes';
          const returnStep = context.metadata?.returnToDiggingStep;
          
          if (alreadyGrantedPermission && returnStep) {
            // Permission already granted and we're returning from a sub-problem - skip permission, continue digging
            console.log(`🔍 BLOCKAGE_CHECK_RESOLVED: Permission already granted, returning to ${returnStep}`);
            context.currentPhase = 'digging_deeper';
            context.metadata.returnToDiggingStep = undefined; // Clear now that we're returning
            return returnStep;
          } else if (alreadyGrantedPermission) {
            // Permission already granted - skip permission, go to future_problem_check to continue digging
            console.log(`🔍 BLOCKAGE_CHECK_RESOLVED: Permission already granted, going to future_problem_check`);
            context.currentPhase = 'digging_deeper';
            return 'future_problem_check';
          } else {
            // First time - ask permission
            console.log(`🔍 BLOCKAGE_CHECK_RESOLVED: First time, asking permission`);
            context.currentPhase = 'digging_deeper';
            return 'digging_deeper_start';
          }
        } else {
          // Still a problem - cycle back to step A (blockage_shifting_intro)
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          // Don't update the problem statement when cycling back from yes/no response
          // Keep the original problem statement intact
          return 'blockage_shifting_intro';
        }
        break;
        
      case 'identity_dissolve_step_e':
        // Identity Shifting: Check if goal is fully achieved
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // Goal not achieved - repeat steps B-E (go back to step B)
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          return 'identity_dissolve_step_b';
        }
        if (lastResponse.includes('yes')) {
          // Goal achieved - proceed to identity check
          return 'identity_check';
        }
        break;
        
      case 'identity_check':
        // Identity Shifting: Check if still feeling the identity
        if (lastResponse.includes('yes') || lastResponse.includes('still')) {
          // Still feeling identity - repeat step 3 (go back to step A)
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          return 'identity_dissolve_step_a';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No longer feeling identity - proceed to problem check
          return 'identity_problem_check';
        }
        break;
        
      case 'identity_problem_check':
        // Identity Shifting: Check if problem still exists
        if (lastResponse.includes('yes') || lastResponse.includes('still')) {
          // Still a problem - route to digging deeper method selection flow
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          context.currentPhase = 'digging_deeper';
          console.log(`🔍 IDENTITY_PROBLEM_CHECK: Problem still exists, routing to digging deeper flow`);
          return 'restate_problem_future';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No longer a problem - check if we've already asked permission to dig deeper
          const alreadyGrantedPermission = context.userResponses['digging_deeper_start'] === 'yes';
          const returnStep = context.metadata?.returnToDiggingStep;
          
          if (alreadyGrantedPermission && returnStep) {
            // Permission already granted and we're returning from a sub-problem - skip permission, continue digging
            context.currentPhase = 'digging_deeper';
            context.metadata.returnToDiggingStep = undefined; // Clear now that we're returning
            return returnStep;
          } else if (alreadyGrantedPermission) {
            // Permission already granted - skip permission, go to future_problem_check to continue digging
            context.currentPhase = 'digging_deeper';
            return 'future_problem_check';
          } else {
            // First time - ask permission
            context.currentPhase = 'digging_deeper';
            return 'digging_deeper_start';
          }
        }
        break;

      case 'identity_shifting_intro':
        // Only move to next step if identity has been stored
        if (context.metadata.identityResponse && context.metadata.identityResponse.type === 'IDENTITY') {
          console.log(`🔍 IDENTITY_SHIFTING_INTRO: Identity stored, moving to dissolve step A`);
          return 'identity_dissolve_step_a';
        } else {
          console.log(`🔍 IDENTITY_SHIFTING_INTRO: Identity not stored yet, staying on intro step`);
          return 'identity_shifting_intro';
        }

      case 'identity_dissolve_step_f':
        // Step F: "Can you still feel yourself being [IDENTITY]?"
        if (lastResponse.includes('no') || lastResponse.includes('2')) {
          // If NO, check if we need to return to a specific check question (same pattern as Belief Shifting)
          console.log(`🔍 IDENTITY_DISSOLVE_STEP_F: User said NO, checking which identity check to proceed to`);
          const returnToCheck = context.metadata.returnToIdentityCheck;
          if (returnToCheck) {
            // Return to the check question we came from (skipping earlier passed checks)
            console.log(`🔍 IDENTITY_DISSOLVE_STEP_F: Returning to ${returnToCheck}`);
            return returnToCheck;
          }
          // First time through - proceed to first check question
          console.log(`🔍 IDENTITY_DISSOLVE_STEP_F: First time, proceeding to future identity check`);
          return 'identity_future_check';
        } else if (lastResponse.includes('yes') || lastResponse.includes('1')) {
          // If YES, they can still feel the identity - cycle back to step A
          console.log(`🔍 IDENTITY_DISSOLVE_STEP_F: User said YES, cycling back to dissolve step A`);
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          // Keep returnToIdentityCheck flag so we return to the correct Step 4 checking question after the cycle
          return 'identity_dissolve_step_a';
        }
        // If unclear response, default to proceeding (assume NO to avoid loops)
        console.log(`🔍 IDENTITY_DISSOLVE_STEP_F: Unclear response "${lastResponse}", defaulting to future identity check to avoid loop`);
        return 'identity_future_check';
        
      case 'confirm_identity_problem':
        // If confirmed, go back to identity shifting
        if (lastResponse.includes('yes')) {
          // CRITICAL: Store the confirmed restated problem for the new identity shifting cycle
          // This ensures identity_shifting_intro uses the NEW problem statement, not the old one
          const confirmedProblem = context.userResponses?.['restate_identity_problem'];
          if (confirmedProblem) {
            context.metadata.currentDiggingProblem = confirmedProblem;
            context.metadata.problemStatement = confirmedProblem;
            context.problemStatement = confirmedProblem;
            console.log(`🔍 CONFIRM_IDENTITY_PROBLEM: Stored restated problem: "${confirmedProblem}"`);
          }
          context.currentPhase = 'identity_shifting';
          return 'identity_shifting_intro';
        }
        // If not confirmed, ask them to restate the problem
        if (lastResponse.includes('no')) {
          return 'restate_identity_problem';
        }
        break;

      case 'identity_future_check':
        // First identity check question: "Do you think you might feel yourself being [IDENTITY] in the future?"
        if (lastResponse.includes('yes') || lastResponse.includes('1')) {
          // YES - identity not cleared, go back to Step 3 (Shifting) per flowchart
          console.log(`🔍 IDENTITY_FUTURE_CHECK: User said YES, going back to shifting steps`);
          // Set flag to indicate we're returning from future check (both for context-specific phrasing and to remember which check failed)
          context.metadata.returnToIdentityCheck = 'identity_future_check';
          return 'identity_dissolve_step_a';
        } else if (lastResponse.includes('no') || lastResponse.includes('2')) {
          // NO - this check passed, clear return marker and proceed to scenario check
          console.log(`🔍 IDENTITY_FUTURE_CHECK: User said NO, proceeding to scenario check`);
          context.metadata.returnToIdentityCheck = undefined;
          return 'identity_scenario_check';
        }
        // Default to scenario check
        console.log(`🔍 IDENTITY_FUTURE_CHECK: Unclear response, proceeding to scenario check`);
        return 'identity_scenario_check';

      case 'identity_scenario_check':
        // Second identity check question: "Is there any scenario in which you might still feel yourself being [IDENTITY]?"
        if (lastResponse.includes('yes') || lastResponse.includes('1')) {
          // YES - identity not cleared, go back to Step 3 (Shifting) per flowchart
          console.log(`🔍 IDENTITY_SCENARIO_CHECK: User said YES, going back to shifting steps`);
          // Set flag to indicate we're returning from scenario check (both for context-specific phrasing and to remember which check failed)
          context.metadata.returnToIdentityCheck = 'identity_scenario_check';
          return 'identity_dissolve_step_a';
        } else if (lastResponse.includes('no') || lastResponse.includes('2')) {
          // NO - both checks passed, clear return marker and proceed to Step 5 (Check Problem)
          console.log(`🔍 IDENTITY_SCENARIO_CHECK: User said NO, both checks passed - proceeding to problem check`);
          context.metadata.returnToIdentityCheck = undefined;
          return 'identity_problem_check';
        }
        // Default: treat unclear as needing more work, go back to shifting
        console.log(`🔍 IDENTITY_SCENARIO_CHECK: Unclear response, going back to shifting steps`);
        return 'identity_dissolve_step_a';
        
      case 'reality_why_not_possible':
        // B1: Check if user says "no reason" to break the A/B loop
        if (lastResponse.toLowerCase().includes('no reason') || 
            lastResponse.toLowerCase().includes('no') && lastResponse.toLowerCase().includes('reason') ||
            lastResponse.toLowerCase().includes('none') ||
            lastResponse.toLowerCase().includes('nothing')) {
          // No reason found - proceed to checking section
          // Check if we came from second checking question
          const fromSecondCheck = context?.metadata?.fromSecondCheckingQuestion;
          if (fromSecondCheck) {
            // Clear the flag and go back to second checking question
            context.metadata.fromSecondCheckingQuestion = false;
            return 'reality_certainty_check';
          } else {
            // Go to first checking question
            return 'reality_checking_questions';
          }
        }
        // Has a reason - continue with B2 (feel the reason)
        return 'reality_feel_reason';
        
      case 'reality_checking_questions':
        // Reality Shifting: Handle certainty percentage and doubt
        const certaintyMatch = lastResponse.match(/(\d+)%?/);
        const certaintyPercentage = certaintyMatch ? parseInt(certaintyMatch[1]) : 0;
        
        if (certaintyPercentage >= 100) {
          // 100% certainty - proceed to second checking question
          return 'reality_certainty_check';
        } else if (certaintyPercentage > 0) {
          // Less than 100% - ask about the doubt reason
          context.metadata.doubtPercentage = 100 - certaintyPercentage;
          return 'reality_doubt_reason';
        }
                 // If we can't parse percentage, ask for clarification
         break;
          
        case 'reality_doubt_reason':
          // User provided doubt reason, cycle back to B2
          return 'reality_cycle_b2';
          
        case 'reality_cycle_b2':
          // User provided feeling for doubt reason, go to B3
          return 'reality_cycle_b3';
          
        case 'reality_cycle_b3':
          // User provided what it would feel like without the problem, go to B4
          return 'reality_cycle_b4';
          
                 case 'reality_cycle_b4':
           // Completed B4, loop back to A1 to continue alternating A/B cycle
           // The flag is preserved so that when user says "no reason" at B1,
           // we know which checking question to return to
           return 'reality_column_a_restart';
           
        case 'reality_certainty_check':
          // Second checking question: Are there any doubts left?
          if (lastResponse.includes('yes')) {
            // Yes, there are doubts - ask for the reason and cycle through B2-B4
            context.metadata.fromSecondCheckingQuestion = true;
            console.log(`🔍 REALITY_CERTAINTY_CHECK: Set fromSecondCheckingQuestion=true, going to reality_doubt_reason`);
            return 'reality_doubt_reason';
          }
          if (lastResponse.includes('no') || lastResponse.includes('not')) {
            // No doubts left - proceed to integration
            return 'reality_integration_intro';
          }
          break;
           
        case 'reality_integration_intro':
        // User responded to integration intro, proceed to helped question
        return 'reality_integration_helped';
        
      case 'reality_integration_action':
        // User answered what needs to happen
        if (lastResponse.toLowerCase().includes('nothing') || lastResponse.toLowerCase().includes('no') || lastResponse.toLowerCase().includes('not')) {
          // User said nothing needs to happen - skip the "what else" question and complete directly
          const returnStep = context.metadata?.returnToDiggingStep;
          if (returnStep) {
            // We're clearing a problem from digging deeper - ALWAYS ask permission before continuing
            context.currentPhase = 'digging_deeper';
            // DON'T clear returnToDiggingStep yet - we need it to know where to return
            return 'digging_deeper_start';
          } else {
            // Regular flow - complete session, move to integration phase
            context.currentPhase = 'integration';
            return 'session_complete';
          }
        } else {
          // User gave a specific action - ask what else needs to happen
          return 'reality_integration_action_more';
        }
        
      case 'reality_integration_action_more':
        // User answered what else needs to happen
        if (lastResponse.toLowerCase().includes('nothing') || lastResponse.toLowerCase().includes('no') || lastResponse.toLowerCase().includes('not')) {
          // User said nothing more needs to happen - check if we're in digging deeper flow
          const returnStep = context.metadata?.returnToDiggingStep;
          if (returnStep) {
            // We're clearing a problem from digging deeper - ALWAYS ask permission before continuing
            context.currentPhase = 'digging_deeper';
            // DON'T clear returnToDiggingStep yet - we need it to know where to return
            return 'digging_deeper_start';
          } else {
            // Regular flow - complete session, move to integration phase
            context.currentPhase = 'integration';
            return 'session_complete';
          }
        } else {
          // User gave another action - keep asking what else
          return 'reality_integration_action_more';
        }
        
      case 'trauma_shifting_intro':
        // Trauma Shifting: Check if user is comfortable with recalling worst part
        if (lastResponse.includes('yes') || lastResponse.includes('y')) {
          // User is comfortable - proceed to identity step
          return 'trauma_identity_step';
        }
        if (lastResponse.includes('no') || lastResponse.includes('n')) {
          // User is not comfortable - ask how they feel about the fact it happened and route to problem clearing
          return 'trauma_problem_redirect';
        }
        break;

      case 'trauma_problem_redirect':
        // User answered how they feel about the fact it happened - construct problem statement
        const feeling = lastResponse || 'this way';
        const traumaDescription = context.userResponses['negative_experience_description'] || 
                                 context.metadata.originalProblemStatement || 
                                 'that happened';
        
        // Construct the full problem statement: "I feel [feeling] that [trauma] happened"
        const constructedProblem = `I feel ${feeling} that ${traumaDescription} happened`;
        console.log(`🔧 TRAUMA_REDIRECT: Constructed problem statement: "${constructedProblem}"`);
        
        // Store the constructed problem statement
        context.problemStatement = constructedProblem;
        context.metadata.problemStatement = constructedProblem;
        if (!context.metadata.originalProblemStatement) {
          context.metadata.originalProblemStatement = constructedProblem;
        }
        
        // Immediately persist to prevent database reload overwriting it
        this.saveContextToDatabase(context).catch(error => 
          console.error('Failed to save trauma problem statement to database:', error)
        );
        
        // Set to problem work type for method selection later
        context.metadata.workType = 'problem';
        context.metadata.selectedMethod = undefined; // Reset method selection
        context.currentPhase = 'work_type_selection';
        
        // Route to confirm_statement to get user confirmation
        return 'confirm_statement';
        break;


      case 'trauma_dissolve_step_e':
        // Trauma Shifting: After completing dissolve sequence, check if we need to return to a specific check question
        // This implements the same pattern as Identity Shifting (identity_dissolve_step_f)
        const returnToTraumaCheck = context.metadata.returnToTraumaCheck;
        if (returnToTraumaCheck) {
          // Return to the check question we came from (skipping earlier passed checks)
          console.log(`🔍 TRAUMA_DISSOLVE_STEP_E: Returning to ${returnToTraumaCheck}`);
          context.metadata.returnToTraumaCheck = undefined; // Clear the flag after using it
          return returnToTraumaCheck;
        }
        // First time through - proceed to first check question
        console.log(`🔍 TRAUMA_DISSOLVE_STEP_E: First time, proceeding to trauma_identity_check`);
        return 'trauma_identity_check';
      
      case 'trauma_identity_check':
        // Trauma Shifting: Check if still feeling the identity
        if (lastResponse.includes('yes') || lastResponse.includes('still')) {
          // Still feeling identity - repeat step 3 (go back to step A)
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          
          // CRITICAL FIX: Clear previous iteration responses to prevent cached feelings
          // This ensures step E uses the NEW step D response, not the old one
          delete context.userResponses['trauma_dissolve_step_a'];
          delete context.userResponses['trauma_dissolve_step_b'];
          delete context.userResponses['trauma_dissolve_step_c'];
          delete context.userResponses['trauma_dissolve_step_d'];
          delete context.userResponses['trauma_dissolve_step_e'];
          console.log(`🔄 TRAUMA_CYCLE: Starting iteration ${context.metadata.cycleCount}, cleared previous dissolve responses`);
          
          // CRITICAL: Immediately persist the cleared responses to database
          // This prevents the old responses from being reloaded on the next request
          this.saveContextToDatabase(context).catch(error => 
            console.error('Failed to save cleared trauma responses to database:', error)
          );
          
          // Set flag to indicate we're returning from identity check (same pattern as Identity Shifting)
          context.metadata.returnToTraumaCheck = 'trauma_identity_check';
          
          return 'trauma_dissolve_step_a';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No longer feeling identity - proceed to future identity check (Step 5)
          return 'trauma_future_identity_check';
        }
        break;
        
      case 'trauma_future_identity_check':
        // Trauma Shifting: First future question - "Do you think you can ever feel yourself being X in the future?"
        if (lastResponse.includes('yes') || lastResponse.includes('might') || lastResponse.includes('could')) {
          // Might feel identity in future - go to future projection sequence
          console.log(`🔍 TRAUMA_FUTURE_IDENTITY_CHECK: User said YES, going to future projection step`);
          return 'trauma_future_projection';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not') || lastResponse.includes('never')) {
          // Won't feel identity in future - proceed to second question
          return 'trauma_future_scenario_check';
        }
        break;
        
      case 'trauma_future_scenario_check':
        // Trauma Shifting: Second future question - "Is there any scenario in which you might still feel yourself being X?"
        if (lastResponse.includes('yes') || lastResponse.includes('might') || lastResponse.includes('could')) {
          // Might feel identity in scenarios - repeat Steps 3-5 starting from step A
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          
          // Clear previous iteration responses to prevent cached feelings
          delete context.userResponses['trauma_dissolve_step_a'];
          delete context.userResponses['trauma_dissolve_step_b'];
          delete context.userResponses['trauma_dissolve_step_c'];
          delete context.userResponses['trauma_dissolve_step_d'];
          delete context.userResponses['trauma_dissolve_step_e'];
          console.log(`🔄 TRAUMA_SCENARIO_CYCLE: Starting iteration ${context.metadata.cycleCount}, cleared previous dissolve responses`);
          
          // Persist the cleared responses to database
          this.saveContextToDatabase(context).catch(error => 
            console.error('Failed to save cleared trauma responses to database:', error)
          );
          
          // Set flag to indicate we're returning from scenario check for context-specific phrasing
          context.metadata.returnToTraumaCheck = 'trauma_future_scenario_check';
          
          return 'trauma_dissolve_step_a'; // Start full dissolve sequence from the beginning
        }
        if (lastResponse.includes('no') || lastResponse.includes('not') || lastResponse.includes('never')) {
          // Won't feel identity in any scenario - proceed to experience check (Step 6)
          return 'trauma_experience_check';
        }
        break;
        
      case 'trauma_future_step_f':
        // Trauma Shifting: Final check after future projection sequence (Step 5 repeat in future)
        // "Can you still feel yourself being X?" (in the future projection context)
        if (lastResponse.includes('yes') || lastResponse.includes('still')) {
          // Still feeling identity in future - loop back to step 4A to repeat shifting
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          
          // Clear previous iteration responses to prevent cached feelings
          delete context.userResponses['trauma_dissolve_step_a'];
          delete context.userResponses['trauma_dissolve_step_b'];
          delete context.userResponses['trauma_dissolve_step_c'];
          delete context.userResponses['trauma_dissolve_step_d'];
          delete context.userResponses['trauma_dissolve_step_e'];
          delete context.userResponses['trauma_future_projection'];
          delete context.userResponses['trauma_future_step_c'];
          delete context.userResponses['trauma_future_step_d'];
          delete context.userResponses['trauma_future_step_e'];
          delete context.userResponses['trauma_future_step_f'];
          console.log(`🔄 TRAUMA_FUTURE_F_CYCLE: Still feeling identity in future, starting iteration ${context.metadata.cycleCount}, cleared previous responses`);
          
          // Persist the cleared responses to database
          this.saveContextToDatabase(context).catch(error => 
            console.error('Failed to save cleared trauma future responses to database:', error)
          );
          
          return 'trauma_dissolve_step_a'; // Loop back to Step 4A
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No longer feeling identity in future - proceed to scenario check
          console.log(`🔍 TRAUMA_FUTURE_F: User said NO, proceeding to scenario check`);
          return 'trauma_future_scenario_check';
        }
        break;
        
      case 'trauma_experience_check':
        // Trauma Shifting: Check if negative experience still feels like problem
        if (lastResponse.includes('yes') || lastResponse.includes('still')) {
          // Still a problem - repeat Steps 3-5 (skip intro, they already answered that)
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          
          // Clear previous iteration responses to prevent cached identity/feelings
          delete context.userResponses['trauma_identity_step'];
          delete context.userResponses['trauma_dissolve_step_a'];
          delete context.userResponses['trauma_dissolve_step_b'];
          delete context.userResponses['trauma_dissolve_step_c'];
          delete context.userResponses['trauma_dissolve_step_d'];
          delete context.userResponses['trauma_dissolve_step_e'];
          console.log(`🔄 TRAUMA_EXPERIENCE_CYCLE: Starting iteration ${context.metadata.cycleCount}, cleared previous identity and dissolve responses`);
          
          // Persist the cleared responses to database
          this.saveContextToDatabase(context).catch(error => 
            console.error('Failed to save cleared trauma responses to database:', error)
          );
          
          return 'trauma_identity_step';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No longer a problem - check if we've already asked permission to dig deeper
          const alreadyGrantedPermission = context.userResponses['digging_deeper_start'] === 'yes';
          const returnStep = context.metadata?.returnToDiggingStep;
          
          if (alreadyGrantedPermission && returnStep) {
            // Permission already granted and we're returning from a sub-problem - skip permission, continue digging
            context.currentPhase = 'digging_deeper';
            context.metadata.returnToDiggingStep = undefined; // Clear now that we're returning
            return returnStep;
          } else if (alreadyGrantedPermission) {
            // Permission already granted but first trauma completion - skip permission, start digging questions
            context.currentPhase = 'digging_deeper';
            return 'trauma_dig_deeper';
          } else {
            // First time - ask permission
            context.currentPhase = 'digging_deeper';
            return 'digging_deeper_start';
          }
        }
        break;
        
      case 'trauma_dig_deeper':
        // Trauma Shifting: Check if might feel bad about this incident in future
        if (lastResponse.includes('yes') || lastResponse.includes('might') || lastResponse.includes('could')) {
          // Might feel bad in future - route to problem statement capture and method selection
          context.metadata.workType = 'negative_experience';
          context.metadata.selectedMethod = undefined;
          context.currentPhase = 'introduction';
          return 'negative_experience_description';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not') || lastResponse.includes('never')) {
          // Won't feel bad in future - ask second dig deeper question
          return 'trauma_dig_deeper_2';
        }
        break;
        
      case 'trauma_dig_deeper_2':
        // Trauma Shifting: Check if anything else is a problem
        if (lastResponse.includes('yes')) {
          // Yes, something else is a problem - route to problem statement capture and method selection
          context.metadata.workType = 'negative_experience';
          context.metadata.selectedMethod = undefined;
          context.currentPhase = 'introduction';
          return 'negative_experience_description';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No other problems - check if we're in digging deeper flow
          const returnStep = context.metadata?.returnToDiggingStep;
          if (returnStep) {
            // We're clearing a problem from digging deeper - return to that step
            context.currentPhase = 'digging_deeper';
            context.metadata.returnToDiggingStep = undefined; // Clear the return step
            return returnStep;
          } else {
            // Regular flow - proceed to integration
            context.currentPhase = 'integration';
            return 'integration_start';
          }
        }
        break;
        
      case 'belief_step_f':
        // Belief Shifting: Check if still believes the belief
        if (lastResponse.includes('yes') || lastResponse.includes('still')) {
          // Still believes - cycle back to step A (keep returnToBeliefCheck so we remember which check question to return to)
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          return 'belief_step_a';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No longer believes - check if we need to return to a specific check question
          const returnToCheck = context.metadata.returnToBeliefCheck;
          if (returnToCheck) {
            // Return to the check question we came from
            return returnToCheck;
          }
          // First time through - proceed to belief checking questions
          return 'belief_check_1';
        }
        break;

      case 'belief_check_1':
        // Belief Shifting: First check question - "Does any part of you still believe [belief]?"
        if (lastResponse.includes('yes') || lastResponse.includes('still')) {
          // Still believes - cycle back to step A and remember to return here
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          context.metadata.returnToBeliefCheck = 'belief_check_1';
          return 'belief_step_a';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No longer believes - clear return marker and proceed to next belief check
          context.metadata.returnToBeliefCheck = undefined;
          return 'belief_check_2';
        }
        break;

      case 'belief_check_2':
        // Belief Shifting: Future check question - "Do you feel you may believe [belief] again in the future?"
        if (lastResponse.includes('yes') || lastResponse.includes('might') || lastResponse.includes('could')) {
          // Still might believe it - cycle back to step A and remember to return here
          console.log(`🔍 BELIEF_CHECK_2: User said YES, cycling back to belief_step_a`);
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          context.metadata.returnToBeliefCheck = 'belief_check_2';
          return 'belief_step_a';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not') || lastResponse.includes('never')) {
          // Won't believe it in future - clear return marker and proceed to scenario check
          context.metadata.returnToBeliefCheck = undefined;
          return 'belief_check_3';
        }
        break;

      case 'belief_check_3':
        // Belief Shifting: Scenario check question - "Is there any scenario in which you would still believe [belief]?"
        if (lastResponse.includes('yes')) {
          // Still might believe it in some scenario - cycle back to step A and remember to return here
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          context.metadata.returnToBeliefCheck = 'belief_check_3';
          return 'belief_step_a';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // Won't believe it in any scenario - clear return marker and proceed to next check
          context.metadata.returnToBeliefCheck = undefined;
          return 'belief_check_4';
        }
        break;

      case 'belief_check_4':
        // Belief Shifting: Knowledge check question - "Do you now know [opposite of belief]?"
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // Don't know the opposite yet - cycle back to step A and remember to return here
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          context.metadata.returnToBeliefCheck = 'belief_check_4';
          return 'belief_step_a';
        }
        if (lastResponse.includes('yes')) {
          // Know the opposite - clear return marker and proceed to problem check
          context.metadata.returnToBeliefCheck = undefined;
          return 'belief_problem_check';
        }
        break;
        
      case 'belief_problem_check':
        // Belief Shifting: Check if problem still exists
        if (lastResponse.includes('yes') || lastResponse.includes('still')) {
          // Still a problem - route to digging deeper method selection flow
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          context.currentPhase = 'digging_deeper';
          console.log(`🔍 BELIEF_PROBLEM_CHECK: Problem still exists, routing to digging deeper flow`);
          return 'restate_problem_future';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No longer a problem - check if we've already asked permission to dig deeper
          const alreadyGrantedPermission = context.userResponses['digging_deeper_start'] === 'yes';
          const returnStep = context.metadata?.returnToDiggingStep;
          
          if (alreadyGrantedPermission && returnStep) {
            // Permission already granted and we're returning from a sub-problem - skip permission, continue digging
            context.currentPhase = 'digging_deeper';
            context.metadata.returnToDiggingStep = undefined; // Clear now that we're returning
            return returnStep;
          } else if (alreadyGrantedPermission) {
            // Permission already granted - skip permission, go to future_problem_check to continue digging
            context.currentPhase = 'digging_deeper';
            return 'future_problem_check';
          } else {
            // First time - ask permission
            context.currentPhase = 'digging_deeper';
            return 'digging_deeper_start';
          }
        }
        break;
        
      case 'confirm_belief_problem':
        // If confirmed, go back to belief shifting
        if (lastResponse.includes('yes')) {
          context.currentPhase = 'belief_shifting';
          return 'belief_shifting_intro';
        }
        // If not confirmed, ask them to restate the problem
        if (lastResponse.includes('no')) {
          return 'restate_belief_problem';
        }
        break;
        
      case 'digging_deeper_start':
        // Ensure we're in the correct phase for digging deeper flow
        console.log(`🔍 DIGGING_DEEPER_START: currentPhase="${context.currentPhase}", lastResponse="${lastResponse}"`);
        context.currentPhase = 'digging_deeper';
        console.log(`🔍 DIGGING_DEEPER_START: Set currentPhase to "digging_deeper"`);
        
        // If user says "yes", continue to saved position or future problem check
        if (lastResponse.includes('yes')) {
          const returnStep = context.metadata?.returnToDiggingStep;
          if (returnStep) {
            console.log(`🔍 DIGGING_DEEPER_START: User said yes, returning to saved step: ${returnStep}`);
            context.metadata.returnToDiggingStep = undefined; // Clear now that we're returning
            return returnStep;
          }
          console.log(`🔍 DIGGING_DEEPER_START: User said yes, going to future_problem_check`);
          return 'future_problem_check';
        }
        // If "no", skip digging deeper and go straight to integration
        if (lastResponse.includes('no')) {
          console.log(`🔍 DIGGING_DEEPER_START: User said no, going to integration`);
          context.metadata.returnToDiggingStep = undefined; // Clear saved position
          context.currentPhase = 'integration';
          return 'integration_start';
        }
        console.log(`🔍 DIGGING_DEEPER_START: Unexpected response, breaking`);
        break;
        
      case 'future_problem_check':
        // If user says "yes", ask them to restate the problem
        if (lastResponse.includes('yes')) {
          return 'restate_problem_future';
        }
        // If "maybe", also ask them to restate the problem (treat like yes)
        if (lastResponse.includes('maybe')) {
          return 'restate_problem_future';
        }
        // If "no", continue to scenario check
        if (lastResponse.includes('no')) {
          return 'scenario_check_1';
        }
        break;
        
      case 'restate_problem_future':
        // After restating the problem, route directly to method selection
        return 'digging_method_selection';
        
      case 'digging_method_selection':
        // This step routes to appropriate treatment method based on user choice
        // We need to change the phase here and route to the proper intro steps
        // Also update the problem statement to use the new problem from digging deeper
        
        // BUGFIX: Read from lastResponse (user input) directly, not from metadata.selectedMethod
        // because scriptedResponse runs AFTER getNextStep, so metadata isn't set yet
        const input = lastResponse.toLowerCase();
        let diggingSelectedMethod = '';
        
        if (input.includes('problem shifting') || input === '1') {
          diggingSelectedMethod = 'problem_shifting';
        } else if (input.includes('identity shifting') || input === '2') {
          diggingSelectedMethod = 'identity_shifting';
        } else if (input.includes('belief shifting') || input === '3') {
          diggingSelectedMethod = 'belief_shifting';
        } else if (input.includes('blockage shifting') || input === '4') {
          diggingSelectedMethod = 'blockage_shifting';
        }
        
        // Update problem statement to use the new problem from digging deeper flow
        const newProblemFromUserResponse = context.userResponses?.['restate_problem_future'] ||
                                            context.userResponses?.['restate_scenario_problem_1'] ||
                                            context.userResponses?.['restate_scenario_problem_2'] ||
                                            context.userResponses?.['restate_scenario_problem_3'] ||
                                            context.userResponses?.['restate_anything_else_problem_1'] ||
                                            context.userResponses?.['restate_anything_else_problem_2'];
        // CRITICAL FIX: Prioritize currentDiggingProblem (set by previous step) over userResponses (which may contain stale data from earlier iterations)
        const newDiggingProblem = context.metadata?.currentDiggingProblem || context.metadata?.newDiggingProblem || newProblemFromUserResponse;
        
        if (newDiggingProblem) {
          context.problemStatement = newDiggingProblem;
          context.metadata.currentDiggingProblem = newDiggingProblem;
          console.log(`🔍 DIGGING_METHOD_SELECTION_ROUTE: Using problem: "${newDiggingProblem}"`);
        } else {
          console.error(`❌ DIGGING_METHOD_SELECTION_ROUTE: NO PROBLEM FOUND! This will cause routing to fail!`);
        }
        
        // Clear previous modality-specific metadata to ensure clean switch
        this.clearPreviousModalityMetadata(context);
        
        // Store the selected method in metadata for reference
        context.metadata.selectedMethod = diggingSelectedMethod;
        
        if (diggingSelectedMethod === 'problem_shifting') {
          context.currentPhase = 'problem_shifting';
          context.metadata.workType = 'problem'; // Ensure correct work type for problem shifting
          console.log(`🔍 MODALITY_SWITCH: Switched to Problem Shifting with problem: "${newDiggingProblem}"`);
          console.log(`🔍 MODALITY_SWITCH: Phase set to: "${context.currentPhase}", returning step: "problem_shifting_intro"`);
          return 'problem_shifting_intro';
        } else if (diggingSelectedMethod === 'identity_shifting') {
          context.currentPhase = 'identity_shifting';
          context.metadata.workType = 'problem'; // Identity shifting also works with problems in digging deeper
          console.log(`🔍 MODALITY_SWITCH: Switched to Identity Shifting with problem: "${newDiggingProblem}"`);
          return 'identity_shifting_intro';
        } else if (diggingSelectedMethod === 'belief_shifting') {
          context.currentPhase = 'belief_shifting';
          context.metadata.workType = 'problem'; // Belief shifting also works with problems in digging deeper
          console.log(`🔍 MODALITY_SWITCH: Switched to Belief Shifting with problem: "${newDiggingProblem}"`);
          return 'belief_shifting_intro';
        } else if (diggingSelectedMethod === 'blockage_shifting') {
          context.currentPhase = 'blockage_shifting';
          context.metadata.workType = 'problem'; // Blockage shifting also works with problems in digging deeper
          console.log(`🔍 MODALITY_SWITCH: Switched to Blockage Shifting with problem: "${newDiggingProblem}"`);
          return 'blockage_shifting_intro';
        }
        // Default fallback
        context.currentPhase = 'problem_shifting';
        context.metadata.workType = 'problem';
        console.log(`🔍 MODALITY_SWITCH: Defaulted to Problem Shifting with problem: "${newDiggingProblem}"`);
        return 'problem_shifting_intro';
        
      // Handle all scenario check steps
      case 'scenario_check_1':
        if (lastResponse.includes('yes')) {
          return 'restate_scenario_problem_1';
        }
        if (lastResponse.includes('no')) {
          return 'anything_else_check_1';
        }
        break;
        
      case 'restate_scenario_problem_1':
        return 'clear_scenario_problem_1';
        
      case 'clear_scenario_problem_1':
        // User selected a method - route directly to that method
        const scenario1Input = lastResponse.toLowerCase();
        const scenario1Problem = context.userResponses?.['restate_scenario_problem_1'];
        
        if (scenario1Problem) {
          context.problemStatement = scenario1Problem;
          context.metadata.currentDiggingProblem = scenario1Problem;
          console.log(`🔍 SCENARIO_1_ROUTE: Using problem: "${scenario1Problem}"`);
        }
        
        this.clearPreviousModalityMetadata(context);
        
        if (scenario1Input.includes('problem shifting') || scenario1Input === '1') {
          context.currentPhase = 'problem_shifting';
          context.metadata.selectedMethod = 'problem_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 SCENARIO_1_ROUTE: Routing to Problem Shifting`);
          return 'problem_shifting_intro';
        } else if (scenario1Input.includes('identity shifting') || scenario1Input === '2') {
          context.currentPhase = 'identity_shifting';
          context.metadata.selectedMethod = 'identity_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 SCENARIO_1_ROUTE: Routing to Identity Shifting`);
          return 'identity_shifting_intro';
        } else if (scenario1Input.includes('belief shifting') || scenario1Input === '3') {
          context.currentPhase = 'belief_shifting';
          context.metadata.selectedMethod = 'belief_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 SCENARIO_1_ROUTE: Routing to Belief Shifting`);
          return 'belief_shifting_intro';
        } else if (scenario1Input.includes('blockage shifting') || scenario1Input === '4') {
          context.currentPhase = 'blockage_shifting';
          context.metadata.selectedMethod = 'blockage_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 SCENARIO_1_ROUTE: Routing to Blockage Shifting`);
          return 'blockage_shifting_intro';
        }
        // Default to problem shifting if unclear
        context.currentPhase = 'problem_shifting';
        context.metadata.workType = 'problem';
        return 'problem_shifting_intro';
        
      case 'scenario_check_2':
        if (lastResponse.includes('yes')) {
          return 'restate_scenario_problem_2';
        }
        if (lastResponse.includes('no')) {
          return 'scenario_check_3';
        }
        break;
        
      case 'restate_scenario_problem_2':
        return 'clear_scenario_problem_2';
        
      case 'clear_scenario_problem_2':
        // User selected a method - route directly to that method
        const scenario2Input = lastResponse.toLowerCase();
        const scenario2Problem = context.userResponses?.['restate_scenario_problem_2'];
        
        if (scenario2Problem) {
          context.problemStatement = scenario2Problem;
          context.metadata.currentDiggingProblem = scenario2Problem;
          console.log(`🔍 SCENARIO_2_ROUTE: Using problem: "${scenario2Problem}"`);
        }
        
        this.clearPreviousModalityMetadata(context);
        
        if (scenario2Input.includes('problem shifting') || scenario2Input === '1') {
          context.currentPhase = 'problem_shifting';
          context.metadata.selectedMethod = 'problem_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 SCENARIO_2_ROUTE: Routing to Problem Shifting`);
          return 'problem_shifting_intro';
        } else if (scenario2Input.includes('identity shifting') || scenario2Input === '2') {
          context.currentPhase = 'identity_shifting';
          context.metadata.selectedMethod = 'identity_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 SCENARIO_2_ROUTE: Routing to Identity Shifting`);
          return 'identity_shifting_intro';
        } else if (scenario2Input.includes('belief shifting') || scenario2Input === '3') {
          context.currentPhase = 'belief_shifting';
          context.metadata.selectedMethod = 'belief_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 SCENARIO_2_ROUTE: Routing to Belief Shifting`);
          return 'belief_shifting_intro';
        } else if (scenario2Input.includes('blockage shifting') || scenario2Input === '4') {
          context.currentPhase = 'blockage_shifting';
          context.metadata.selectedMethod = 'blockage_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 SCENARIO_2_ROUTE: Routing to Blockage Shifting`);
          return 'blockage_shifting_intro';
        }
        // Default to problem shifting if unclear
        context.currentPhase = 'problem_shifting';
        context.metadata.workType = 'problem';
        return 'problem_shifting_intro';
        
      case 'scenario_check_3':
        if (lastResponse.includes('yes')) {
          return 'restate_scenario_problem_3';
        }
        if (lastResponse.includes('no')) {
          return 'anything_else_check_1';
        }
        break;
        
      case 'restate_scenario_problem_3':
        return 'clear_scenario_problem_3';
        
      case 'clear_scenario_problem_3':
        // User selected a method - route directly to that method
        const scenario3Input = lastResponse.toLowerCase();
        const scenario3Problem = context.userResponses?.['restate_scenario_problem_3'];
        
        if (scenario3Problem) {
          context.problemStatement = scenario3Problem;
          context.metadata.currentDiggingProblem = scenario3Problem;
          console.log(`🔍 SCENARIO_3_ROUTE: Using problem: "${scenario3Problem}"`);
        }
        
        this.clearPreviousModalityMetadata(context);
        
        if (scenario3Input.includes('problem shifting') || scenario3Input === '1') {
          context.currentPhase = 'problem_shifting';
          context.metadata.selectedMethod = 'problem_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 SCENARIO_3_ROUTE: Routing to Problem Shifting`);
          return 'problem_shifting_intro';
        } else if (scenario3Input.includes('identity shifting') || scenario3Input === '2') {
          context.currentPhase = 'identity_shifting';
          context.metadata.selectedMethod = 'identity_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 SCENARIO_3_ROUTE: Routing to Identity Shifting`);
          return 'identity_shifting_intro';
        } else if (scenario3Input.includes('belief shifting') || scenario3Input === '3') {
          context.currentPhase = 'belief_shifting';
          context.metadata.selectedMethod = 'belief_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 SCENARIO_3_ROUTE: Routing to Belief Shifting`);
          return 'belief_shifting_intro';
        } else if (scenario3Input.includes('blockage shifting') || scenario3Input === '4') {
          context.currentPhase = 'blockage_shifting';
          context.metadata.selectedMethod = 'blockage_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 SCENARIO_3_ROUTE: Routing to Blockage Shifting`);
          return 'blockage_shifting_intro';
        }
        // Default to problem shifting if unclear
        context.currentPhase = 'problem_shifting';
        context.metadata.workType = 'problem';
        return 'problem_shifting_intro';
        
      // Handle all "anything else" check steps
      case 'anything_else_check_1':
        if (lastResponse.includes('yes')) {
          return 'restate_anything_else_problem_1';
        }
        if (lastResponse.includes('no')) {
          // Mark that multiple problems were worked on and go to integration
          context.metadata.multipleProblems = true;
          context.currentPhase = 'integration';
          return 'integration_start';
        }
        break;
        
      case 'restate_anything_else_problem_1':
        // Setup metadata for the new problem and route to method selection
        const anythingElseProblem = context.userResponses?.['restate_anything_else_problem_1'];
        if (anythingElseProblem) {
          context.problemStatement = anythingElseProblem;
          context.metadata.currentDiggingProblem = anythingElseProblem;
          context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 5) + 1;
          context.metadata.returnToDiggingStep = 'future_problem_check';
          context.metadata.workType = 'problem';
          // CRITICAL: Reset originalProblemStatement for new problem chain
          context.metadata.originalProblemStatement = anythingElseProblem;
          console.log(`🔍 ANYTHING_ELSE_1: Stored problem "${anythingElseProblem}", routing to method selection`);
        }
        this.clearPreviousModalityMetadata(context);
        return 'digging_method_selection';
        
      case 'clear_anything_else_problem_1':
        // User selected a method - route directly to that method
        const anythingElse1Input = lastResponse.toLowerCase();
        const anythingElse1Problem = context.userResponses?.['restate_anything_else_problem_1'];
        
        if (anythingElse1Problem) {
          context.problemStatement = anythingElse1Problem;
          context.metadata.currentDiggingProblem = anythingElse1Problem;
          // CRITICAL: Reset originalProblemStatement for new problem chain - prevents Integration Questions from referencing previous treatment's problem
          context.metadata.originalProblemStatement = anythingElse1Problem;
          console.log(`🔍 ANYTHING_ELSE_1_ROUTE: Using problem: "${anythingElse1Problem}"`);
        }
        
        this.clearPreviousModalityMetadata(context);
        
        if (anythingElse1Input.includes('problem shifting') || anythingElse1Input === '1') {
          context.currentPhase = 'problem_shifting';
          context.metadata.selectedMethod = 'problem_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 ANYTHING_ELSE_1_ROUTE: Routing to Problem Shifting`);
          return 'problem_shifting_intro';
        } else if (anythingElse1Input.includes('identity shifting') || anythingElse1Input === '2') {
          context.currentPhase = 'identity_shifting';
          context.metadata.selectedMethod = 'identity_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 ANYTHING_ELSE_1_ROUTE: Routing to Identity Shifting`);
          return 'identity_shifting_intro';
        } else if (anythingElse1Input.includes('belief shifting') || anythingElse1Input === '3') {
          context.currentPhase = 'belief_shifting';
          context.metadata.selectedMethod = 'belief_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 ANYTHING_ELSE_1_ROUTE: Routing to Belief Shifting`);
          return 'belief_shifting_intro';
        } else if (anythingElse1Input.includes('blockage shifting') || anythingElse1Input === '4') {
          context.currentPhase = 'blockage_shifting';
          context.metadata.selectedMethod = 'blockage_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 ANYTHING_ELSE_1_ROUTE: Routing to Blockage Shifting`);
          return 'blockage_shifting_intro';
        }
        // Default to problem shifting if unclear
        context.currentPhase = 'problem_shifting';
        context.metadata.workType = 'problem';
        return 'problem_shifting_intro';
        
      case 'anything_else_check_2':
        if (lastResponse.includes('yes')) {
          return 'restate_anything_else_problem_2';
        }
        if (lastResponse.includes('no')) {
          return 'anything_else_check_3';
        }
        break;
        
      case 'restate_anything_else_problem_2':
        // Setup metadata for the new problem and route to method selection
        const anythingElseProblem2 = context.userResponses?.['restate_anything_else_problem_2'];
        if (anythingElseProblem2) {
          context.problemStatement = anythingElseProblem2;
          context.metadata.currentDiggingProblem = anythingElseProblem2;
          context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 6) + 1;
          context.metadata.returnToDiggingStep = 'future_problem_check';
          context.metadata.workType = 'problem';
          context.metadata.originalProblemStatement = anythingElseProblem2;
          console.log(`🔍 ANYTHING_ELSE_2: Stored problem "${anythingElseProblem2}", routing to method selection`);
        }
        this.clearPreviousModalityMetadata(context);
        return 'digging_method_selection';
        
      case 'clear_anything_else_problem_2':
        // User selected a method - route directly to that method
        const anythingElse2Input = lastResponse.toLowerCase();
        const anythingElse2Problem = context.userResponses?.['restate_anything_else_problem_2'];
        
        if (anythingElse2Problem) {
          context.problemStatement = anythingElse2Problem;
          context.metadata.currentDiggingProblem = anythingElse2Problem;
          // CRITICAL: Reset originalProblemStatement for new problem chain - prevents Integration Questions from referencing previous treatment's problem
          context.metadata.originalProblemStatement = anythingElse2Problem;
          console.log(`🔍 ANYTHING_ELSE_2_ROUTE: Using problem: "${anythingElse2Problem}"`);
        }
        
        this.clearPreviousModalityMetadata(context);
        
        if (anythingElse2Input.includes('problem shifting') || anythingElse2Input === '1') {
          context.currentPhase = 'problem_shifting';
          context.metadata.selectedMethod = 'problem_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 ANYTHING_ELSE_2_ROUTE: Routing to Problem Shifting`);
          return 'problem_shifting_intro';
        } else if (anythingElse2Input.includes('identity shifting') || anythingElse2Input === '2') {
          context.currentPhase = 'identity_shifting';
          context.metadata.selectedMethod = 'identity_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 ANYTHING_ELSE_2_ROUTE: Routing to Identity Shifting`);
          return 'identity_shifting_intro';
        } else if (anythingElse2Input.includes('belief shifting') || anythingElse2Input === '3') {
          context.currentPhase = 'belief_shifting';
          context.metadata.selectedMethod = 'belief_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 ANYTHING_ELSE_2_ROUTE: Routing to Belief Shifting`);
          return 'belief_shifting_intro';
        } else if (anythingElse2Input.includes('blockage shifting') || anythingElse2Input === '4') {
          context.currentPhase = 'blockage_shifting';
          context.metadata.selectedMethod = 'blockage_shifting';
          context.metadata.workType = 'problem';
          console.log(`🔍 ANYTHING_ELSE_2_ROUTE: Routing to Blockage Shifting`);
          return 'blockage_shifting_intro';
        }
        // Default to problem shifting if unclear
        context.currentPhase = 'problem_shifting';
        context.metadata.workType = 'problem';
        return 'problem_shifting_intro';
        
      case 'anything_else_check_3':
        if (lastResponse.includes('yes')) {
          // If there are still more problems, we need to handle them
          // For now, continue the pattern by going to discovery phase
          context.currentPhase = 'discovery';
          return 'restate_selected_problem';
        }
        if (lastResponse.includes('no')) {
          // No more problems, proceed to integration
          context.currentPhase = 'integration';
          return 'integration_start';
        }
        break;
        
      case 'session_complete':
      case 'identity_session_complete':
        // Session is finished
        return null;
        
      case 'action_question':
        // First action question - always go to action_followup
        return 'action_followup';
        
      case 'action_followup':
        // Keep asking action_followup until user says nothing
        if (lastResponse.includes('nothing') || lastResponse.includes('Nothing') || 
            lastResponse.toLowerCase().includes('nothing coming up') || 
            lastResponse.toLowerCase().includes('nothing else') ||
            lastResponse.toLowerCase().trim() === 'no' ||
            lastResponse.toLowerCase().includes('that\'s it') ||
            lastResponse.toLowerCase().includes('thats it')) {
          // User has nothing more to add - proceed to next question
          return 'one_thing_question';
        } else {
          // User provided more actions - ask again
          return 'action_followup';
        }

      case 'identity_check':
        // Handle repeat A-F cycle logic
        if (lastResponse.includes('yes') || lastResponse.includes('still')) {
          // If they can still feel the identity, repeat A-F cycle
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          console.log(`🔍 IDENTITY_CHECK: Still feeling identity, repeating A-F cycle (cycle ${context.metadata.cycleCount})`);
          return 'identity_dissolve_step_a'; // Go back to step A
        } else if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // Identity is dissolved, proceed to next step
          console.log(`🔍 IDENTITY_CHECK: Identity dissolved, proceeding to future check`);
          return 'identity_future_check';
        }
        break;

      case 'identity_check':
        // Handle repeat A-F cycle logic
        if (lastResponse.includes('yes') || lastResponse.includes('still')) {
          // If they can still feel the identity, repeat A-F cycle
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          console.log(`🔍 IDENTITY_CHECK: Still feeling identity, repeating A-F cycle (cycle ${context.metadata.cycleCount})`);
          return 'identity_dissolve_step_a'; // Go back to step A
        } else if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // Identity is dissolved, proceed to next step
          console.log(`🔍 IDENTITY_CHECK: Identity dissolved, proceeding to future check`);
          return 'identity_future_check';
        }
        break;
        
      default:
        // Default behavior - follow the nextStep
        return currentStep.nextStep || null;
    }
    
    // Default fallback
    return currentStep.nextStep || null;
  }

  private handlePhaseCompletion(context: TreatmentContext): ProcessingResult {
    // Check if this is truly session completion or just a phase transition
    if (context.currentStep === 'session_complete' || 
        context.currentStep === 'identity_session_complete' ||
        context.currentStep?.includes('session_complete')) {
      return {
        canContinue: false,
        reason: 'Session completed successfully',
        scriptedResponse: 'Your Mind Shifting session is now complete. Thank you for your participation.'
      };
    }
    
    // If we reach here, there might be an issue with the flow
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
   * Public method to access treatment context for undo functionality
   */
  public getContextForUndo(sessionId: string): TreatmentContext {
    if (!sessionId) {
      throw new Error('SessionId is required for getContextForUndo');
    }
    console.log('TreatmentStateMachine: Getting context for sessionId:', sessionId);
    return this.getOrCreateContext(sessionId);
  }

  /**
   * Public method to update context for undo functionality
   */
  public updateContextForUndo(sessionId: string, updates: Partial<TreatmentContext>): void {
    if (!sessionId) {
      throw new Error('SessionId is required for updateContextForUndo');
    }
    if (!updates) {
      throw new Error('Updates object is required for updateContextForUndo');
    }
    console.log('TreatmentStateMachine: Updating context for sessionId:', sessionId, 'with updates:', updates);
    const context = this.getOrCreateContext(sessionId);
    Object.assign(context, updates);
  }

  /**
   * Public method to get the current step's scripted response
   */
  public getStepResponse(sessionId: string, stepId?: string): string | null {
    if (!sessionId) {
      throw new Error('SessionId is required for getStepResponse');
    }
    const context = this.getOrCreateContext(sessionId);
    const targetStepId = stepId || context.currentStep;
    const currentPhase = this.phases.get(context.currentPhase);
    
    if (!currentPhase) {
      return null;
    }
    
    const step = currentPhase.steps.find(s => s.id === targetStepId);
    if (!step) {
      return null;
    }
    
    return this.getScriptedResponse(step, context);
  }

  /**
   * Public method to clear user responses for undo functionality
   */
  public clearUserResponsesForUndo(sessionId: string, stepsToKeep: Set<string>): void {
    if (!sessionId) {
      throw new Error('SessionId is required for clearUserResponsesForUndo');
    }
    console.log('TreatmentStateMachine: Clearing user responses for sessionId:', sessionId);
    const context = this.getOrCreateContext(sessionId);
    
    if (!context.userResponses) {
      console.log('TreatmentStateMachine: No user responses to clear');
      return;
    }
    
    Object.keys(context.userResponses).forEach(stepId => {
      if (!stepsToKeep.has(stepId)) {
        console.log('TreatmentStateMachine: Clearing response for step:', stepId);
        delete context.userResponses[stepId];
      }
    });
  }

  /**
   * Public method to get phase information for undo functionality
   */
  public getPhaseSteps(phaseName: string): TreatmentStep[] | null {
    if (!phaseName) {
      console.error('TreatmentStateMachine: Phase name is required for getPhaseSteps');
      return null;
    }
    console.log('TreatmentStateMachine: Getting steps for phase:', phaseName);
    const phase = this.phases.get(phaseName);
    if (!phase) {
      console.error('TreatmentStateMachine: Phase not found:', phaseName);
      return null;
    }
    console.log('TreatmentStateMachine: Found', phase.steps.length, 'steps for phase:', phaseName);
    return phase.steps;
  }

  /**
   * Load treatment context from database
   */
  private async loadContextFromDatabase(sessionId: string): Promise<TreatmentContext | null> {
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
   * Save treatment context to database (public method)
   */
  public async saveContextToDatabase(context: TreatmentContext): Promise<void> {
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
   * Determine if multiple problems were worked on during the session
   */
  private hasMultipleProblems(context: TreatmentContext): boolean {
    // Check if digging deeper was used and additional problems were found
    const dugDeeper = context.userResponses['digging_deeper_start'] === 'yes' || 
                      context.userResponses['future_problem_check'] === 'yes' ||
                      context.userResponses['identity_dig_deeper'] === 'yes' ||
                      context.userResponses['belief_dig_deeper'] === 'yes' ||
                      context.userResponses['blockage_dig_deeper'] === 'yes' ||
                      context.userResponses['trauma_dig_deeper'] === 'yes';
    
    return dugDeeper || (context.metadata.multipleProblems === true);
  }

  /**
   * Get the appropriate subject for Integration Questions
   */
  private getIntegrationSubject(context: TreatmentContext, workType: 'problem' | 'goal' | 'negative_experience'): string {
    if (workType === 'goal') {
      return context?.metadata?.currentGoal || context?.metadata?.goalStatement || 'your goal';
    } else if (workType === 'negative_experience') {
      if (this.hasMultipleProblems(context)) {
        return 'the whole topic';
      }
      return context?.metadata?.negativeExperienceStatement || context?.problemStatement || 'the negative experience';
    } else { // problem
      if (this.hasMultipleProblems(context)) {
        return 'the whole topic';
      }
      return context?.metadata?.problemStatement || context?.problemStatement || 'the problem';
    }
  }

  /**
   * Extract emotion from user input for storing context
   */
  private extractEmotionFromInput(userInput: string): string {
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

  /**
   * Process identity response to convert emotions/adjectives to proper identity format
   */
  private processIdentityResponse(userInput: string): string {
    const input = userInput.toLowerCase().trim();
    const originalInput = userInput.trim(); // Preserve original casing
    
    // Handle patterns like "an angry one", "a sad one", "the frustrated one"
    const onePattern = /^(a|an|the)\s+(\w+)\s+one$/i;
    const match = input.match(onePattern);
    if (match) {
      const adjective = match[2];
      return `${adjective} person`;
    }
    
    // Handle patterns like "bad 1", "sad 2" - treat number as noise, extract adjective
    const numberPattern = /^(\w+)\s+(\d+)$/i;
    const numberMatch = input.match(numberPattern);
    if (numberMatch) {
      const adjective = numberMatch[1];
      return `${adjective} person`;
    }
    
    // Handle patterns like "an angry person", "a sad person" - extract the adjective
    const personPattern = /^(a|an|the)\s+(\w+)\s+person$/i;
    const personMatch = input.match(personPattern);
    if (personMatch) {
      const adjective = personMatch[2];
      return `${adjective} person`;
    }
    
    // If it already contains identity markers, use as-is (preserve user's exact language)
    const identityMarkers = ['person', 'people', 'man', 'woman', 'child', 'kid', 'adult', 'parent', 'mother', 'father', 'mom', 'dad', 'friend', 'partner', 'spouse', 'husband', 'wife', 'someone', 'somebody', 'individual', 'victim', 'survivor', 'one who', 'type of'];
    const hasIdentityMarker = identityMarkers.some(marker => input.includes(marker));
    
    if (hasIdentityMarker) {
      return originalInput; // Preserve original casing and exact words
    }
    
    // For single words without identity markers, add "person"
    const wordCount = input.split(' ').length;
    if (wordCount === 1) {
      return `${originalInput} person`;
    }
    
    // For multi-word phrases without identity markers, check if they're descriptive
    // If they seem like identity descriptions, add "person"
    const descriptivePatterns = [
      /^(very|really|quite|so|too)\s+\w+$/i, // "very sad", "really angry"
      /^\w+\s+(and|or)\s+\w+$/i, // "sad and angry", "hurt or angry"
      /^not\s+\w+$/i, // "not good", "not strong"
      /^like\s+/i // "like a failure" - keep as-is
    ];
    
    const matchesDescriptivePattern = descriptivePatterns.some(pattern => input.match(pattern));
    if (matchesDescriptivePattern && !input.startsWith('like')) {
      return `${originalInput} person`;
    }
    
    // Return as-is for complex responses or phrases starting with "like"
    return originalInput;
  }

  /**
   * Create positive belief statement using enhanced pattern matching
   * Preserves user's exact language while making minimal changes to negate negative beliefs
   * Examples:
   * - "i wont make it" → "i will make it"
   * - "I can't succeed" → "I can succeed"
   * - "I'm not good enough" → "I'm good enough"
   * - "nobody likes me" → "somebody likes me"
   */
  private createPositiveBeliefStatement(belief: string): string {
    const trimmedBelief = belief.trim();
    
    // Enhanced pattern matching for common belief transformations
    const result = this.tryEnhancedPatternMatching(trimmedBelief);
    if (result) {
      console.log(`🔍 ENHANCED_BELIEF_TRANSFORM: "${trimmedBelief}" → "${result}"`);
      return result;
    }

    // Fallback to original logic
    return this.fallbackPositiveBeliefStatement(trimmedBelief);
  }

  /**
   * Enhanced pattern matching for common belief transformations
   * Handles contractions and various negative patterns
   */
  private tryEnhancedPatternMatching(belief: string): string | null {
    let result = belief;
    
    // Handle contractions first (most common issue)
    // "wont" → "will" (handles "i wont make it" → "i will make it")
    if (result.match(/\bwont\b/i)) {
      return result.replace(/\bwont\b/gi, 'will');
    }
    
    // "cant" → "can"
    if (result.match(/\bcant\b/i)) {
      return result.replace(/\bcant\b/gi, 'can');
    }
    
    // "dont" → "do"
    if (result.match(/\bdont\b/i)) {
      return result.replace(/\bdont\b/gi, 'do');
    }
    
    // Handle formal contractions
    // "I can't" → "I can"
    if (result.match(/I can't/i)) {
      return result.replace(/I can't/gi, 'I can');
    }
    
    // "I won't" → "I will"
    if (result.match(/I won't/i)) {
      return result.replace(/I won't/gi, 'I will');
    }
    
    // "I don't" → "I do"
    if (result.match(/I don't/i)) {
      return result.replace(/I don't /gi, 'I ');
    }
    
    // "I'm not" → "I'm" (remove the "not")
    if (result.match(/I'm not /i)) {
      return result.replace(/I'm not /gi, "I'm ");
    }
    
    // "I am not" → "you are" (convert from first person negative to second person positive)
    // e.g., "i am not taking the right path" → "that you are taking the right path"
    if (result.match(/^I am not /i)) {
      return result.replace(/^I am not /gi, 'that you are ');
    }
    
    // Handle negative words
    // "nobody" → "somebody"
    if (result.match(/nobody/i)) {
      return result.replace(/nobody/gi, 'somebody');
    }
    
    // "nothing" → "something"
    if (result.match(/nothing/i)) {
      return result.replace(/nothing/gi, 'something');
    }
    
    // "never" → remove it or replace with "sometimes"
    if (result.match(/never /i)) {
      return result.replace(/never /gi, '');
    }
    
    // Handle "always fail" patterns
    if (result.match(/always fail/i)) {
      return result.replace(/always fail/gi, "don't always fail");
    }
    
    return null; // No pattern matched
  }



  /**
   * Fallback method using the original logic
   */
  private fallbackPositiveBeliefStatement(belief: string): string {
    let result = belief;
    
    // Handle "that I am [negative]" patterns
    if (result.match(/^that I am /i)) {
      if (!result.toLowerCase().includes(' not ')) {
        result = result.replace(/^(that I am )/i, '$1not ');
      }
      return result;
    }
    
    // Handle "I am [negative]" patterns
    if (result.match(/^I am /i)) {
      if (!result.toLowerCase().includes(' not ')) {
        result = result.replace(/^(I am )/i, '$1not ');
      }
      return result;
    }
    
    // If no specific pattern matched, try to add "not" in a sensible place
    if (result.match(/^that /i) && !result.toLowerCase().includes(' not ')) {
      result = result.replace(/^(that )/i, '$1I am not ');
      return result;
    }
    
    // Fallback: if we can't parse it, just add "not" after "I am"
    if (!result.toLowerCase().includes(' not ')) {
      if (result.match(/^I /i)) {
        result = result.replace(/^(I )/i, '$1am not ');
      } else {
        result = `that I am not ${result}`;
      }
    }
    
    return result;
  }
} 