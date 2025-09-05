import { createServerClient } from './database-server';

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
  reason?: string;
  triggeredAI?: boolean;
  scriptedResponse?: string;
  needsLinguisticProcessing?: boolean; // Flag for the 2 specific linguistic processing cases
  needsAIAssistance?: {
    trigger: AITrigger;
    context: string;
    userInput: string;
  };
}

export class TreatmentStateMachine {
  private phases: Map<string, TreatmentPhase>;
  private contexts: Map<string, TreatmentContext>;

  constructor() {
    this.phases = new Map();
    this.contexts = new Map();
    this.initializePhases();
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

    // Validate user input FIRST (unless bypassed)
    if (!bypassValidation) {
      const validationResult = this.validateUserInput(userInput, currentStep, treatmentContext);
      if (!validationResult.isValid) {
      // Special handling for multiple problems detected
      if (validationResult.error === 'MULTIPLE_PROBLEMS_DETECTED') {
        // Move to multiple problems selection step
        treatmentContext.currentStep = 'multiple_problems_selection';
        const multipleProblemsStep = currentPhase.steps.find(s => s.id === 'multiple_problems_selection');
        if (multipleProblemsStep) {
          const scriptedResponse = this.getScriptedResponse(multipleProblemsStep, treatmentContext);
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
                            currentStepResponse === 'ROUTE_TO_TRAUMA_INTEGRATION';
    
    if (isInternalSignal) {
      console.log(`🔍 PROCESS_INPUT: Internal signal detected, proceeding to determine next step automatically`);
      // For internal signals, we need to determine the next step and continue processing
      const nextStepId = this.determineNextStep(currentStep, treatmentContext);
      console.log(`🔍 PROCESS_INPUT: Auto-progression nextStepId="${nextStepId}", currentPhase="${treatmentContext.currentPhase}"`);
      
      if (nextStepId) {
        treatmentContext.currentStep = nextStepId;
        
        // Get the correct phase after potential phase change
        const updatedPhase = this.phases.get(treatmentContext.currentPhase);
        console.log(`🔍 PROCESS_INPUT: Auto-progression looking for step "${nextStepId}" in phase "${treatmentContext.currentPhase}"`);
        
        if (!updatedPhase) {
          throw new Error(`Invalid updated phase: ${treatmentContext.currentPhase}`);
        }
        
        const nextStep = updatedPhase.steps.find(s => s.id === nextStepId);
        console.log(`🔍 PROCESS_INPUT: Auto-progression found nextStep:`, nextStep ? `YES (${nextStep.id})` : 'NO');
        console.log(`🔍 PROCESS_INPUT: Available steps in phase "${treatmentContext.currentPhase}":`, updatedPhase.steps.map(s => s.id));
        
        if (nextStep) {
          const actualResponse = this.getScriptedResponse(nextStep, treatmentContext, userInput);
          const needsLinguisticProcessing = this.isLinguisticProcessingStep(nextStep.id, treatmentContext);
          
          console.log(`🔍 PROCESS_INPUT: Auto-progression final response="${actualResponse}"`);
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
      
      // Get the correct phase after potential phase change
      const updatedPhase = this.phases.get(treatmentContext.currentPhase);
      console.log(`🔍 PROCESS_INPUT: Looking for step "${nextStepId}" in phase "${treatmentContext.currentPhase}"`);
      
      if (!updatedPhase) {
        throw new Error(`Invalid updated phase: ${treatmentContext.currentPhase}`);
      }
      
      const nextStep = updatedPhase.steps.find(s => s.id === nextStepId);
      console.log(`🔍 PROCESS_INPUT: Found nextStep:`, nextStep ? `YES (${nextStep.id})` : 'NO');
      console.log(`🔍 PROCESS_INPUT: Available steps in phase "${treatmentContext.currentPhase}":`, updatedPhase.steps.map(s => s.id));
      
      if (nextStep) {
        const scriptedResponse = this.getScriptedResponse(nextStep, treatmentContext, userInput);
        const needsLinguisticProcessing = this.isLinguisticProcessingStep(nextStep.id, treatmentContext);
        
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
    const problemShiftingSteps = ['body_sensation_check', 'feel_solution_state'];
    
    // Reality Shifting steps that need linguistic processing
    const realityShiftingSteps = [
      'reality_step_a2',        // "Feel that 'feeling'... what can you feel now?"
      'reality_feel_reason',    // "Feel 'that reason'... what does it feel like?"
      'reality_feel_reason_2',  // "Feel that 'feeling'... what can you feel now?"
      'reality_feel_reason_3'   // "Feel that 'feeling'... what's the first thing you notice about it?"
    ];
    
    // Blockage Shifting steps that need linguistic processing
    const blockageShiftingSteps = [
      'blockage_step_b',        // "Feel 'that feeling'... what does 'that feeling' feel like?"
      'blockage_step_d'         // "Feel 'that feeling'... what does 'that feeling' feel like?"
    ];
    
    // Belief Shifting steps that need linguistic processing
    const beliefShiftingSteps = [
      'belief_step_b',          // "Feel 'that feeling'... what does 'that feeling' feel like?"
      'belief_step_e'           // "Feel 'that feeling'... what does 'that feeling' feel like?"
    ];
    
    // Identity Shifting steps that need linguistic processing
    const identityShiftingSteps = [
      'identity_dissolve_step_a', // "Feel yourself being [identity]... what does it feel like?"
      'identity_dissolve_step_b', // "Feel [last response]... what happens in yourself when you feel [last response]?"
      'identity_check'           // "Can you still feel yourself being [identity]?"
    ];
    
    // Trauma Shifting steps that need linguistic processing
    const traumaShiftingSteps = [
      'trauma_dissolve_step_a',   // "Feel yourself being [identity]... what does it feel like?"
      'trauma_dissolve_step_b',   // "Feel [last response]... what happens in yourself when you feel [last response]?"
      'trauma_identity_check'     // "Can you still feel yourself being [identity]?"
    ];
    
    // All modality intro steps that need linguistic processing for user input contextualisation
    const introSteps = [
      'problem_shifting_intro',  // Ensure problem is stated as a problem
      'reality_shifting_intro',  // Ensure goal is stated as a goal  
      'blockage_shifting_intro', // Ensure problem is stated as a problem
      'identity_shifting_intro', // Ensure problem is stated as a problem
      'trauma_shifting_intro',   // Ensure input is stated as a negative experience
      'belief_shifting_intro'    // Ensure problem is stated as a problem
    ];
    
    return problemShiftingSteps.includes(stepId) || realityShiftingSteps.includes(stepId) || blockageShiftingSteps.includes(stepId) || beliefShiftingSteps.includes(stepId) || identityShiftingSteps.includes(stepId) || traumaShiftingSteps.includes(stepId) || introSteps.includes(stepId);
  }

  /**
   * Get instant scripted response - <200ms performance target
   */
  private getScriptedResponse(step: TreatmentStep, context: TreatmentContext, currentUserInput?: string): string {
    if (typeof step.scriptedResponse === 'function') {
      // Use current user input if provided, otherwise fall back to previous step response
      const userInput = currentUserInput || (() => {
        const previousStepId = this.getPreviousStep(step.id, context.currentPhase);
        return previousStepId ? context.userResponses[previousStepId] : undefined;
      })();
      return step.scriptedResponse(userInput, context);
    }
    return step.scriptedResponse;
  }

  /**
   * Validate user input against step requirements
   */
  private validateUserInput(userInput: string, step: TreatmentStep, context?: TreatmentContext): { isValid: boolean; error?: string } {
    const trimmed = userInput.trim();
    const words = trimmed.split(' ').length;
    const lowerInput = trimmed.toLowerCase();
    
    console.log(`🔍 VALIDATE_USER_INPUT: Called for step "${step.id}" with input "${userInput}"`);
    
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
      
      // Check if user stated only an emotion
      const emotionWords = ['stressed', 'anxious', 'sad', 'angry', 'worried', 'depressed', 'frustrated', 'upset', 'scared', 'nervous'];
      if (words <= 2 && emotionWords.some(emotion => lowerInput.includes(emotion))) {
        const emotion = emotionWords.find(emotion => lowerInput.includes(emotion));
        return { isValid: false, error: `What are you ${emotion} about?` };
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
      // Improved logic to avoid false positives with "get" in problem contexts
      const goalIndicators = ['want to', 'wish to', 'hope to', 'plan to', 'goal', 'achieve', 'become', 'have', 'need to', 'would like to'];
      
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
      
      // Check if user stated it as a question
      const questionIndicators = ['how can', 'how do', 'what should', 'why do', 'when will', 'where can', 'should i', 'how do i', 'what can i'];
      const hasQuestionLanguage = questionIndicators.some(indicator => lowerInput.includes(indicator)) || trimmed.endsWith('?');
      
      if (hasQuestionLanguage) {
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:problem_vs_question' };
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
      
      console.log(`🔍 WORK_TYPE_DESCRIPTION: Goal indicators check - hasGoalLanguage: ${hasGoalLanguage}`);
      if (hasGoalLanguage) {
        const matchedIndicator = goalIndicators.find(indicator => lowerInput.includes(indicator));
        console.log(`🔍 WORK_TYPE_DESCRIPTION: Matched goal indicator: "${matchedIndicator}"`);
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:problem_vs_goal' };
      }
      
      // Check if user stated it as a question
      const questionIndicators = ['how can', 'how do', 'what should', 'why do', 'when will', 'where can', 'should i', 'how do i', 'what can i'];
      const hasQuestionLanguage = questionIndicators.some(indicator => lowerInput.includes(indicator)) || trimmed.endsWith('?');
      
      console.log(`🔍 WORK_TYPE_DESCRIPTION: Question indicators check - hasQuestionLanguage: ${hasQuestionLanguage}`);
      if (hasQuestionLanguage) {
        const matchedIndicator = questionIndicators.find(indicator => lowerInput.includes(indicator)) || (trimmed.endsWith('?') ? 'ends with ?' : '');
        console.log(`🔍 WORK_TYPE_DESCRIPTION: Matched question indicator: "${matchedIndicator}"`);
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
            if (input.includes('1') || (input.includes('problem') && !input.includes('shifting'))) {
              // Reset all work type metadata for fresh selection
              context.metadata.workType = 'problem';
              context.metadata.selectedMethod = undefined;
              console.log(`🎯 WORK_TYPE_SELECTION: Set workType to 'problem'`);
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
            if (context.metadata.workType === 'problem' && !context.metadata.selectedMethod) {
              // Handle method selection for problems - only respond to method names (frontend sends these)
              if (input.includes('problem shifting')) {
                context.metadata.selectedMethod = 'problem_shifting';
                return "Great! We'll use Problem Shifting.";
              } else if (input.includes('identity shifting')) {
                context.metadata.selectedMethod = 'identity_shifting';
                return "Great! We'll use Identity Shifting.";
              } else if (input.includes('belief shifting')) {
                context.metadata.selectedMethod = 'belief_shifting';
                return "Great! We'll use Belief Shifting.";
              } else if (input.includes('blockage shifting')) {
                context.metadata.selectedMethod = 'blockage_shifting';
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
              context.currentStep = 'reality_goal_capture';
              context.currentPhase = 'reality_shifting';
              context.metadata.selectedMethod = 'reality_shifting';
              return "SKIP_TO_TREATMENT_INTRO";
            }

            // Handle negative experience description after work type selection for negative experiences
            if (context.metadata.workType === 'negative_experience' && !context.metadata.selectedMethod) {
              // User has provided negative experience description, store it and proceed directly to trauma shifting
              context.metadata.negativeExperienceStatement = userInput;
              context.problemStatement = userInput; // Keep for compatibility
              context.currentStep = 'trauma_shifting_intro';  
              context.currentPhase = 'trauma_shifting';
              context.metadata.selectedMethod = 'trauma_shifting';
              return "SKIP_TO_TREATMENT_INTRO";
            }
            
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
              // If no user input, show the method selection options
              if (!userInput) {
                return "Great! For problems, you can choose from several methods:\n\n1. Problem Shifting (most common)\n2. Identity Shifting\n3. Belief Shifting\n4. Blockage Shifting\n\nPlease choose 1, 2, 3, or 4, or say the method name.";
              }
              
              // Process user's method selection
              const input = userInput.toLowerCase();
              
              if (input.includes('1') || input.includes('problem shifting')) {
                context.metadata.selectedMethod = 'problem_shifting';
                context.currentPhase = 'work_type_selection';
                return "Great! We'll use Problem Shifting.";
              } else if (input.includes('2') || input.includes('identity shifting')) {
                context.metadata.selectedMethod = 'identity_shifting';
                context.currentPhase = 'work_type_selection';
                return "Great! We'll use Identity Shifting.";
              } else if (input.includes('3') || input.includes('belief shifting')) {
                context.metadata.selectedMethod = 'belief_shifting';
                context.currentPhase = 'work_type_selection';
                return "Great! We'll use Belief Shifting.";
              } else if (input.includes('4') || input.includes('blockage shifting')) {
                context.metadata.selectedMethod = 'blockage_shifting';
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
            return "What do you want? Please tell me what your goal is in a few words.";
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you want to achieve.' }
          ],
          nextStep: undefined, // Will be determined by determineNextStep logic
          aiTriggers: []
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

            // Check if user input is actually a method name (not a problem description)
            const isMethodName = userInput && (
              userInput.toLowerCase().includes('problem shifting') ||
              userInput.toLowerCase().includes('identity shifting') ||
              userInput.toLowerCase().includes('belief shifting') ||
              userInput.toLowerCase().includes('blockage shifting') ||
              userInput.toLowerCase().includes('reality shifting') ||
              userInput.toLowerCase().includes('trauma shifting')
            );
            
            // If no user input OR if user input is a method name, ask for description
            if (!userInput || isMethodName) {
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
              context.metadata.problemStatement = statement;
              context.problemStatement = statement; // Keep for compatibility
              
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
              // User said no, go back to description step
              context.currentStep = 'work_type_description';
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
              // Show confirmation again if unclear input
              if (workType === 'problem') {
                return `So you want to work on '${statement}'. Is that correct? Please say yes or no.`;
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
          nextStep: 'route_to_method',
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
            
            // Should not reach here - method should be selected first
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
            return `How would you describe the problem now?`;
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
          scriptedResponse: "Please select your preferred Mind Shifting method.\n\n",
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
            
            // Check if we should skip intro instructions (when cycling back from check_if_still_problem)
            if (context?.metadata?.skipIntroInstructions) {
              // Clear both flags and return only the problem feeling question
              context.metadata.skipIntroInstructions = false;
              context.metadata.skipLinguisticProcessing = false;
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
            // Get the problem statement from the stored context or fallback to previous responses
            const problemStatement = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
            return `Feel the problem '${problemStatement}'... what needs to happen for this to not be a problem?`;
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
          scriptedResponse: (userInput) => `What would you feel like if you already ${userInput || 'had that'}?`,
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
            // Get the problem statement from the stored context or fallback to previous responses
            const problemStatement = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
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
            // Get the problem statement - use updated problem from cycling if available
            const problemStatement = context?.metadata?.problemStatement || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
            
            // On first iteration, include full instructions
            const cycleCount = context?.metadata?.cycleCount || 0;
            if (cycleCount === 0) {
              return `Please close your eyes and keep them closed throughout the process. Please give brief answers to my questions and allow the problem to keep changing...we're going to keep going until there is no problem left.\n\nFeel '${problemStatement}'... what does it feel like?`;
            } else {
              // On subsequent cycles, just ask the question
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
          nextStep: 'blockage_check_if_still_problem',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'blockage_check_if_still_problem',
          scriptedResponse: (userInput) => {
            // Check if they said "no problem", "nothing", "gone", etc.
            const noProblemIndicators = ['no problem', 'nothing', 'gone', 'resolved', 'fine', 'good', 'better', 'clear'];
            const response = (userInput || '').toLowerCase();
            const seemsResolved = noProblemIndicators.some(indicator => response.includes(indicator));
            
            if (seemsResolved) {
              return 'Great! It sounds like the problem has shifted. Let me check - do you feel the problem will come back in the future?';
            }
            
            return `I can see there's still something there. Let's continue the process. Feel '${userInput || 'that problem'}'... what does it feel like?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please tell me how you feel or if there is still a problem.' }
          ],
          nextStep: 'digging_deeper_start', // This will be handled by the state machine logic
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
            
            // If we have user input, process and store the identity
            if (userInput && userInput.trim()) {
              const processedIdentity = this.processIdentityResponse(userInput.trim());
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: Processing identity "${userInput}" -> "${processedIdentity}"`);
              
              // Check if user said "me" - need clarification
              if (userInput.toLowerCase().trim() === 'me') {
                return "What kind of me?";
              }
              
              // Store the processed identity
              context.metadata.currentIdentity = processedIdentity;
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: Stored identity: "${processedIdentity}"`);
            }
            
            return `Please close your eyes and keep them closed throughout the rest of the process. Please tell me the first thing that comes up when I ask this question. Feel the problem of '${cleanProblemStatement}'... what kind of person are you being when you're experiencing this problem?`;
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
            const identity = context.metadata.currentIdentity || 'that identity';
            return `Feel yourself being '${identity}'... what does it feel like?`;
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
            const identity = context.metadata.currentIdentity || 'that identity';
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
            return `Feel '${stepDResponse}'... what happens in yourself when you feel '${stepDResponse}'?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens in yourself.' }
          ],
          nextStep: 'identity_check',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_step_3_intro',
          scriptedResponse: (userInput, context) => {
            const identity = context.metadata.currentIdentity || 'that identity';
            return `Step 3: We're now going to check if the identity of '${identity}' is still there.`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please continue.' }
          ],
          nextStep: 'identity_check',
          aiTriggers: []
        },

        {
          id: 'identity_check',
          scriptedResponse: (userInput, context) => {
            const identity = context.metadata.currentIdentity || 'that identity';
            return `Can you still feel yourself being '${identity}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'identity_future_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'identity_future_check',
          scriptedResponse: (userInput, context) => {
            const identity = context.metadata.currentIdentity || 'that identity';
            return `Do you think you might feel yourself being '${identity}' in the future? Is there any scenario in which you might still feel yourself being '${identity}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'identity_problem_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'identity_problem_check',
          scriptedResponse: (userInput, context) => {
            const cleanProblemStatement = context?.metadata?.problemStatement || context?.problemStatement || 'the problem';
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
            return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${subject}' now?`;
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
            return `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?... What else needs to happen for you to realise your intention? (Until they are clear on their plan of action)`;
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
            return `What is the one thing you can do that will make everything else easier or unnecessary?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'integration_action_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_action_3',
          scriptedResponse: (userInput, context) => {
            return `What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action and when you will do it.' }
          ],
          nextStep: undefined, // End of Identity Shifting process
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
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
          nextStep: 'goal_deadline_check',
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
            const deadline = userInput || '';
            const hasDeadline = context?.userResponses?.['goal_deadline_check']?.toLowerCase().includes('yes') || false;
            
            if (hasDeadline && deadline) {
              context.metadata.goalWithDeadline = `${goalStatement} by ${deadline}`;
              return `OK, so your goal statement including the deadline is '${goalStatement} by ${deadline}', is that right?`;
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
            // Use the exact goal statement without changing wording
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            context.metadata.currentGoal = goalStatement;
            return `Close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. If ever you feel your goal has changed just let me know.

We're going to work with your goal of '${goalStatement}'.

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
            // Get the original feeling from reality_shifting_intro step
            const originalFeeling = context?.userResponses?.['reality_shifting_intro'] || userInput || 'that';
            return `Feel ${originalFeeling}... what does ${originalFeeling} feel like?`;
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
            // Get the original feeling from reality_shifting_intro step
            const originalFeeling = context?.userResponses?.['reality_shifting_intro'] || userInput || 'that';
            return `Feel ${originalFeeling}... what happens in yourself when you feel ${originalFeeling}?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens in yourself.' }
          ],
          nextStep: 'reality_step_b',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'reality_step_b',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            return `Is it possible that '${goalStatement}' will not come to you?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'reality_checking_questions',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'reality_why_not_possible',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            return `Why might you not achieve your goal of '${goalStatement}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me why you might not achieve your goal.' }
          ],
          nextStep: 'reality_feel_reason',
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
            // Get the response from reality_feel_reason_2 (what it would feel like to not have the problem)
            const goodFeeling = context?.userResponses?.['reality_feel_reason_2'] || userInput || 'good';
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
            const doubtPercentage = context?.metadata?.doubtPercentage || '10';
            return `What's the reason for the ${doubtPercentage}% doubt?`;
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
          nextStep: 'choose_method',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_identity_step',
          scriptedResponse: (userInput, context) => {
            // Get the negative experience statement
            const negativeExperience = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the negative experience';
            return `Please close your eyes and keep them closed throughout the rest of the process.\n\nThink about and feel the negative experience of '${negativeExperience}'. Let your mind go to the worst part of the experience...now freeze it there. Keep feeling this frozen moment...what kind of person are you being in this moment?`;
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
            
            // Store the identity from the identity step if we don't have it yet
            if (!context.metadata.currentTraumaIdentity && traumaIdentityResponse) {
              context.metadata.currentTraumaIdentity = traumaIdentityResponse.trim();
            }
            
            // Use the stored identity, don't overwrite with current userInput (which is the goal they want)
            const identity = context.metadata.currentTraumaIdentity || 'that identity';
            return `Feel yourself being '${identity}'... what does it feel like?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you want as that identity.' }
          ],
          nextStep: 'trauma_dissolve_step_b',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dissolve_step_b',
          scriptedResponse: (userInput, context) => {
            // Get the goal from trauma_dissolve_step_a response (what they want as that identity)
            const traumaGoalResponse = context.userResponses?.['trauma_dissolve_step_a'];
            
            // Store the goal from step_a response if we don't have it yet
            if (!context.metadata.currentTraumaGoal && traumaGoalResponse) {
              context.metadata.currentTraumaGoal = traumaGoalResponse.trim();
            }
            
            const identity = context.metadata.currentTraumaIdentity || 'that identity';
            return `Feel yourself being '${identity}'... exaggerate the feeling of it and tell me the first thing that you notice about it.`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you notice about exaggerating that feeling.' }
          ],
          nextStep: 'trauma_dissolve_step_c',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dissolve_step_c',
          scriptedResponse: (userInput, context) => {
            const goal = context.metadata.currentTraumaGoal || 'that goal';
            return `Now feel yourself achieving your goal of '${goal}', imagine whatever you need to imagine in order to achieve that goal in your mind and tell me when you've done it.`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me when you have achieved that goal.' }
          ],
          nextStep: 'trauma_dissolve_step_d',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dissolve_step_d',
          scriptedResponse: () => {
            return `What's the first thing you notice about it?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you notice about it.' }
          ],
          nextStep: 'trauma_dissolve_step_e',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dissolve_step_e',
          scriptedResponse: (userInput, context) => {
            const goal = context.metadata.currentTraumaGoal || 'that goal';
            return `Have you fully achieved your goal of '${goal}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_identity_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_identity_check',
          scriptedResponse: (userInput, context) => {
            const identity = context.metadata.currentTraumaIdentity || 'that identity';
            return `Can you still feel yourself being '${identity}'?`;
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
          id: 'trauma_experience_check',
          scriptedResponse: () => {
            return `Take your mind back to the frozen moment which was the worst part of the negative experience. Does it still feel like a problem to you?`;
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
            return `Is there anything else about this that is still a problem for you?`;
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
            const diggingProblem = context?.metadata?.currentDiggingProblem;
            const problemStatement = diggingProblem || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
            return `Please close your eyes and keep them closed throughout the process.\n\nFeel the problem that '${problemStatement}'... what do you believe about yourself that's causing you to experience this problem that '${problemStatement}'?`;
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
            context.metadata.currentBelief = userInput || context.metadata.currentBelief || 'that belief';
            const belief = context.metadata.currentBelief;
            return `Feel yourself believing '${belief}'... what does it feel like?`;
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
            const belief = context.metadata.currentBelief || 'that belief';
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
            const belief = context.metadata.currentBelief || 'that belief';
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
            const belief = context.metadata.currentBelief || 'that belief';
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
            const belief = context.metadata.currentBelief || 'that belief';
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
          id: 'belief_check_4',
          scriptedResponse: (userInput, context) => {
            const belief = context.metadata.currentBelief || 'that belief';
            // Create opposite belief (simplified approach)
            const oppositeBelief = belief.toLowerCase().includes('not') ? belief.replace(/not\s+/gi, '') : `not ${belief}`;
            return `Do you now believe '${oppositeBelief}'?`;
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
            const problemStatement = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
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
          scriptedResponse: "Would you like to dig deeper in this area?",
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
          scriptedResponse: "Do you feel the problem will come back in the future?",
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
          scriptedResponse: "How would you state the problem in a few words?",
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
            
            // If this is the first time showing this step (coming from restate_problem_future), 
            // store the problem and show the selection message
            if (!context.metadata.currentDiggingProblem && input && input !== 'METHOD_SELECTION_NEEDED') {
              // Store the new problem statement for clearing
              const newProblem = input;
              context.metadata.currentDiggingProblem = newProblem;
              context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 1) + 1;
              context.metadata.returnToDiggingStep = 'scenario_check_1'; // Where to return after clearing
              context.problemStatement = newProblem;
              
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
              return "PROBLEM_SHIFTING_SELECTED";
            } else if (input.toLowerCase().includes('identity shifting') || input === '2') {
              context.currentPhase = 'identity_shifting';
              context.metadata.selectedMethod = 'identity_shifting';
              return "IDENTITY_SHIFTING_SELECTED";
            } else if (input.toLowerCase().includes('belief shifting') || input === '3') {
              context.currentPhase = 'belief_shifting';
              context.metadata.selectedMethod = 'belief_shifting';
              return "BELIEF_SHIFTING_SELECTED";
            } else {
              return "Please choose Problem Shifting, Identity Shifting, or Belief Shifting.";
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
          scriptedResponse: "Is there any scenario in which this would still be a problem for you?",
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
            context.metadata.returnToDiggingStep = 'scenario_check_2'; // Where to return after clearing
            
            // Route to appropriate method based on original method used
            const originalMethod = context.metadata.selectedMethod;
            if (originalMethod === 'problem_shifting') {
              context.currentPhase = 'problem_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario problem using Problem Shifting. Feel the problem '${newProblem}'... what does it feel like?`;
            } else if (originalMethod === 'identity_shifting') {
              context.currentPhase = 'identity_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario problem using Identity Shifting. Feel the problem of '${newProblem}' - what kind of person are you being when you're experiencing this problem?`;
            } else if (originalMethod === 'belief_shifting') {
              context.currentPhase = 'belief_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario problem using Belief Shifting. Feel the problem that '${newProblem}'... what do you believe about yourself that's causing you to experience this problem?`;
            } else if (originalMethod === 'blockage_shifting') {
              context.currentPhase = 'blockage_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario problem using Blockage Shifting. Feel '${newProblem}'... what does it feel like?`;
            } else if (originalMethod === 'reality_shifting') {
              context.currentPhase = 'reality_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario using Reality Shifting. What do you want instead of '${newProblem}'?`;
            } else if (originalMethod === 'trauma_shifting') {
              context.currentPhase = 'trauma_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario using Trauma Shifting. Will you be comfortable recalling the worst part of '${newProblem}' and freezing it briefly in your mind?`;
            } else {
              // Default to problem shifting
              context.currentPhase = 'problem_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario problem. Feel the problem '${newProblem}'... what does it feel like?`;
            }
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please continue with the process.' }
          ],
          nextStep: undefined, // Handled by routing logic
          aiTriggers: []
        },
        {
          id: 'scenario_check_2',
          scriptedResponse: "Is there any other scenario in which this would still be a problem for you?",
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
            context.metadata.returnToDiggingStep = 'scenario_check_3'; // Where to return after clearing
            
            // Route to appropriate method based on original method used
            const originalMethod = context.metadata.selectedMethod;
            if (originalMethod === 'problem_shifting') {
              context.currentPhase = 'problem_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario problem using Problem Shifting. Feel the problem '${newProblem}'... what does it feel like?`;
            } else if (originalMethod === 'identity_shifting') {
              context.currentPhase = 'identity_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario problem using Identity Shifting. Feel the problem of '${newProblem}' - what kind of person are you being when you're experiencing this problem?`;
            } else if (originalMethod === 'belief_shifting') {
              context.currentPhase = 'belief_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario problem using Belief Shifting. Feel the problem that '${newProblem}'... what do you believe about yourself that's causing you to experience this problem?`;
            } else if (originalMethod === 'blockage_shifting') {
              context.currentPhase = 'blockage_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario problem using Blockage Shifting. Feel '${newProblem}'... what does it feel like?`;
            } else if (originalMethod === 'reality_shifting') {
              context.currentPhase = 'reality_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario using Reality Shifting. What do you want instead of '${newProblem}'?`;
            } else if (originalMethod === 'trauma_shifting') {
              context.currentPhase = 'trauma_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario using Trauma Shifting. Will you be comfortable recalling the worst part of '${newProblem}' and freezing it briefly in your mind?`;
            } else {
              // Default to problem shifting
              context.currentPhase = 'problem_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario problem. Feel the problem '${newProblem}'... what does it feel like?`;
            }
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please continue with the process.' }
          ],
          nextStep: undefined, // Handled by routing logic
          aiTriggers: []
        },
        {
          id: 'scenario_check_3',
          scriptedResponse: "Is there any other scenario in which this would still be a problem for you?",
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
            context.metadata.returnToDiggingStep = 'anything_else_check_1'; // Move to "anything else" questions after this
            
            // Route to appropriate method based on original method used
            const originalMethod = context.metadata.selectedMethod;
            if (originalMethod === 'problem_shifting') {
              context.currentPhase = 'problem_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario problem using Problem Shifting. Feel the problem '${newProblem}'... what does it feel like?`;
            } else if (originalMethod === 'identity_shifting') {
              context.currentPhase = 'identity_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario problem using Identity Shifting. Feel the problem of '${newProblem}' - what kind of person are you being when you're experiencing this problem?`;
            } else if (originalMethod === 'belief_shifting') {
              context.currentPhase = 'belief_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario problem using Belief Shifting. Feel the problem that '${newProblem}'... what do you believe about yourself that's causing you to experience this problem?`;
            } else if (originalMethod === 'blockage_shifting') {
              context.currentPhase = 'blockage_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario problem using Blockage Shifting. Feel '${newProblem}'... what does it feel like?`;
            } else if (originalMethod === 'reality_shifting') {
              context.currentPhase = 'reality_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario using Reality Shifting. What do you want instead of '${newProblem}'?`;
            } else if (originalMethod === 'trauma_shifting') {
              context.currentPhase = 'trauma_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario using Trauma Shifting. Will you be comfortable recalling the worst part of '${newProblem}' and freezing it briefly in your mind?`;
            } else {
              // Default to problem shifting
              context.currentPhase = 'problem_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this scenario problem. Feel the problem '${newProblem}'... what does it feel like?`;
            }
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please continue with the process.' }
          ],
          nextStep: undefined, // Handled by routing logic
          aiTriggers: []
        },
        {
          id: 'anything_else_check_1',
          scriptedResponse: "Is there anything else about this that is still a problem for you?",
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
            context.metadata.returnToDiggingStep = 'anything_else_check_2'; // Where to return after clearing
            
            // Route to appropriate method based on original method used
            const originalMethod = context.metadata.selectedMethod;
            if (originalMethod === 'problem_shifting') {
              context.currentPhase = 'problem_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this problem using Problem Shifting. Feel the problem '${newProblem}'... what does it feel like?`;
            } else if (originalMethod === 'identity_shifting') {
              context.currentPhase = 'identity_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this problem using Identity Shifting. Feel the problem of '${newProblem}' - what kind of person are you being when you're experiencing this problem?`;
            } else if (originalMethod === 'belief_shifting') {
              context.currentPhase = 'belief_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this problem using Belief Shifting. Feel the problem that '${newProblem}'... what do you believe about yourself that's causing you to experience this problem?`;
            } else if (originalMethod === 'blockage_shifting') {
              context.currentPhase = 'blockage_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this problem using Blockage Shifting. Feel '${newProblem}'... what does it feel like?`;
            } else if (originalMethod === 'reality_shifting') {
              context.currentPhase = 'reality_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this using Reality Shifting. What do you want instead of '${newProblem}'?`;
            } else if (originalMethod === 'trauma_shifting') {
              context.currentPhase = 'trauma_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this using Trauma Shifting. Will you be comfortable recalling the worst part of '${newProblem}' and freezing it briefly in your mind?`;
            } else {
              // Default to problem shifting
              context.currentPhase = 'problem_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this problem. Feel the problem '${newProblem}'... what does it feel like?`;
            }
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please continue with the process.' }
          ],
          nextStep: undefined, // Handled by routing logic
          aiTriggers: []
        },
        {
          id: 'anything_else_check_2',
          scriptedResponse: "Is there anything else about this that is still a problem for you?",
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
            context.metadata.returnToDiggingStep = 'anything_else_check_3'; // Where to return after clearing
            
            // Route to appropriate method based on original method used
            const originalMethod = context.metadata.selectedMethod;
            if (originalMethod === 'problem_shifting') {
              context.currentPhase = 'problem_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this problem using Problem Shifting. Feel the problem '${newProblem}'... what does it feel like?`;
            } else if (originalMethod === 'identity_shifting') {
              context.currentPhase = 'identity_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this problem using Identity Shifting. Feel the problem of '${newProblem}' - what kind of person are you being when you're experiencing this problem?`;
            } else if (originalMethod === 'belief_shifting') {
              context.currentPhase = 'belief_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this problem using Belief Shifting. Feel the problem that '${newProblem}'... what do you believe about yourself that's causing you to experience this problem?`;
            } else if (originalMethod === 'blockage_shifting') {
              context.currentPhase = 'blockage_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this problem using Blockage Shifting. Feel '${newProblem}'... what does it feel like?`;
            } else if (originalMethod === 'reality_shifting') {
              context.currentPhase = 'reality_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this using Reality Shifting. What do you want instead of '${newProblem}'?`;
            } else if (originalMethod === 'trauma_shifting') {
              context.currentPhase = 'trauma_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this using Trauma Shifting. Will you be comfortable recalling the worst part of '${newProblem}' and freezing it briefly in your mind?`;
            } else {
              // Default to problem shifting
              context.currentPhase = 'problem_shifting';
              context.problemStatement = newProblem;
              return `We need to clear this problem. Feel the problem '${newProblem}'... what does it feel like?`;
            }
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
          scriptedResponse: "Is there anything else about this that is still a problem for you?",
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
          scriptedResponse: (userInput, context) => {
            // Mark that multiple problems were worked on
            context.metadata.multipleProblems = true;
            
            // Route to appropriate integration questions based on original method
            const originalMethod = context.metadata.selectedMethod;
            
            if (originalMethod === 'problem_shifting') {
              context.currentPhase = 'problem_shifting';
              return 'ROUTE_TO_PROBLEM_INTEGRATION';
            } else if (originalMethod === 'identity_shifting') {
              context.currentPhase = 'identity_shifting';
              return 'ROUTE_TO_IDENTITY_INTEGRATION';
            } else if (originalMethod === 'belief_shifting') {
              context.currentPhase = 'belief_shifting';
              return 'ROUTE_TO_BELIEF_INTEGRATION';
            } else if (originalMethod === 'blockage_shifting') {
              context.currentPhase = 'blockage_shifting';
              return 'ROUTE_TO_BLOCKAGE_INTEGRATION';
            } else if (originalMethod === 'trauma_shifting') {
              context.currentPhase = 'trauma_shifting';
              return 'ROUTE_TO_TRAUMA_INTEGRATION';
            } else {
              // Default to problem shifting integration
              context.currentPhase = 'problem_shifting';
              return 'ROUTE_TO_PROBLEM_INTEGRATION';
            }
          },
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
            const problemStatement = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
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
            const problemStatement = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the former problem';
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
    }
    return this.contexts.get(sessionId)!;
  }

  /**
   * Get or create context with database persistence
   */
  private async getOrCreateContextAsync(sessionId: string, context?: Partial<TreatmentContext>): Promise<TreatmentContext> {
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
    
    // Save new context to database
    await this.saveContextToDatabase(newContext);
    
    return newContext;
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
    switch (context.currentStep) {
      case 'mind_shifting_explanation':
        console.log(`🔍 MIND_SHIFTING_DETERMINE: lastResponse="${lastResponse}", workType="${context.metadata.workType}", selectedMethod="${context.metadata.selectedMethod}"`);
        console.log(`🔍 MIND_SHIFTING_DETERMINE: Full metadata:`, JSON.stringify(context.metadata, null, 2));
        
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
        // User provided description, route to appropriate treatment intro
        const descWorkType = context.metadata.workType;
        const descSelectedMethod = context.metadata.selectedMethod;
        
        if (descWorkType === 'problem' && descSelectedMethod) {
          if (descSelectedMethod === 'identity_shifting') {
            return 'identity_shifting_intro';
          } else if (descSelectedMethod === 'problem_shifting') {
            return 'problem_shifting_intro';
          } else if (descSelectedMethod === 'belief_shifting') {
            return 'belief_shifting_intro';
          } else if (descSelectedMethod === 'blockage_shifting') {
            return 'blockage_shifting_intro';
          }
        } else if (descWorkType === 'goal') {
          return 'reality_shifting_intro';
        } else if (descWorkType === 'negative_experience') {
          return 'trauma_shifting_intro';
        }
        
        // Fallback to confirmation step
        return 'confirm_statement';
        
      case 'work_type_selection':
        // Already handled in the scriptedResponse, continue to next step
        return 'confirm_statement';
        
      case 'confirm_statement':
        const confirmInput = lastResponse.toLowerCase();
        
        // If user says "no", go back to work_type_description
        if (confirmInput.includes('no') || confirmInput.includes('not') || confirmInput.includes('wrong') || confirmInput.includes('incorrect')) {
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
        }
        break;
        
      case 'goal_description':
        // User provided goal description, store it and go to deadline check  
        context.problemStatement = lastResponse;
        context.metadata.problemStatement = lastResponse;
        context.metadata.currentGoal = lastResponse;
        context.currentPhase = 'reality_shifting';
        context.metadata.selectedMethod = 'reality_shifting';
        console.log(`🔍 GOAL_DESCRIPTION: Stored goal: "${lastResponse}"`);
        return 'goal_deadline_check';
        
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
          // If user says no, we might need to restart goal capture
          return 'goal_description';
        }
        
      case 'goal_certainty':
        // User provided certainty percentage, proceed to reality shifting intro
        return 'reality_shifting_intro';
        
      case 'negative_experience_description':
        // User provided negative experience description, store it and go to trauma shifting intro
        context.problemStatement = lastResponse;
        context.metadata.problemStatement = lastResponse;
        context.currentPhase = 'trauma_shifting';
        context.metadata.selectedMethod = 'trauma_shifting';
        console.log(`🔍 NEGATIVE_EXPERIENCE_DESCRIPTION: Stored description: "${lastResponse}"`);
        console.log(`🔍 NEGATIVE_EXPERIENCE_DESCRIPTION: Setting phase to trauma_shifting and returning trauma_shifting_intro`);
        console.log(`🔍 NEGATIVE_EXPERIENCE_DESCRIPTION: Context after update:`, JSON.stringify({
          currentPhase: context.currentPhase,
          currentStep: context.currentStep,
          problemStatement: context.problemStatement,
          selectedMethod: context.metadata.selectedMethod,
          workType: context.metadata.workType
        }, null, 2));
        return 'trauma_shifting_intro';
        
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
          context.currentPhase = 'problem_shifting';
          context.metadata.selectedMethod = 'problem_shifting';
          return 'problem_shifting_intro';
        } else if (methodChoice.includes('blockage shifting')) {
          context.currentPhase = 'blockage_shifting';
          context.metadata.selectedMethod = 'blockage_shifting';
          return 'blockage_shifting_intro';
        } else if (methodChoice.includes('identity shifting')) {
          context.currentPhase = 'identity_shifting';
          context.metadata.selectedMethod = 'identity_shifting';
          return 'identity_shifting_intro';
        } else if (methodChoice.includes('reality shifting')) {
          context.currentPhase = 'reality_shifting';
          context.metadata.selectedMethod = 'reality_shifting';
          return 'reality_goal_capture';
        } else if (methodChoice.includes('trauma shifting')) {
          context.currentPhase = 'trauma_shifting';
          context.metadata.selectedMethod = 'trauma_shifting';
          return 'trauma_shifting_intro';
        } else if (methodChoice.includes('belief shifting')) {
          context.currentPhase = 'belief_shifting';
          context.metadata.selectedMethod = 'belief_shifting';
          return 'belief_shifting_intro';
        } else {
          // Fallback to Problem Shifting (all methods now implemented)
          context.currentPhase = 'problem_shifting';
          context.metadata.selectedMethod = 'problem_shifting';
          return 'problem_shifting_intro';
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
          // No longer a problem - check if we're in digging deeper flow
          const returnStep = context.metadata?.returnToDiggingStep;
          if (returnStep) {
            // We're clearing a problem from digging deeper - return to that step
            context.currentPhase = 'digging_deeper';
            context.metadata.returnToDiggingStep = undefined; // Clear the return step
            return returnStep;
          } else {
            // Regular flow - move to digging deeper start
            context.currentPhase = 'digging_deeper';
            return 'digging_deeper_start';
          }
        }
        break;
        
      case 'blockage_check_if_still_problem':
        // Core cycling logic for Blockage Shifting
        // Check if the response indicates no problem left
        const noProblemIndicators = ['no problem', 'nothing', 'gone', 'resolved', 'fine', 'good', 'better', 'clear', 'no', 'not'];
        const seemsResolved = noProblemIndicators.some(indicator => lastResponse.includes(indicator));
        
        if (seemsResolved) {
          // Problem seems resolved - check if we're in digging deeper flow
          const returnStep = context.metadata?.returnToDiggingStep;
          if (returnStep) {
            // We're clearing a problem from digging deeper - return to that step
            context.currentPhase = 'digging_deeper';
            context.metadata.returnToDiggingStep = undefined; // Clear the return step
            return returnStep;
          } else {
            // Regular flow - move to digging deeper start
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
          // Still a problem - start new process
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          context.currentPhase = 'discovery';
          return 'restate_identity_problem';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No longer a problem - check if we're in digging deeper flow
          const returnStep = context.metadata?.returnToDiggingStep;
          if (returnStep) {
            // We're clearing a problem from digging deeper - return to that step
            context.currentPhase = 'digging_deeper';
            context.metadata.returnToDiggingStep = undefined; // Clear the return step
            return returnStep;
          } else {
            // Regular flow - move to digging deeper start
            context.currentPhase = 'digging_deeper';
            return 'digging_deeper_start';
          }
        }
        break;

      case 'identity_shifting_intro':
        // Identity Shifting intro completed, move to first dissolve step
        return 'identity_dissolve_step_a';
        
      case 'confirm_identity_problem':
        // If confirmed, go back to identity shifting
        if (lastResponse.includes('yes')) {
          context.currentPhase = 'identity_shifting';
          return 'identity_shifting_intro';
        }
        // If not confirmed, ask them to restate the problem
        if (lastResponse.includes('no')) {
          return 'restate_identity_problem';
        }
        break;
        
      case 'reality_step_b':
        // Reality Shifting: Check if goal might not come
        if (lastResponse.includes('yes')) {
          // Yes, it's possible it won't come - ask why
          return 'reality_why_not_possible';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No, it's not possible it won't come - proceed to checking questions
          return 'reality_checking_questions';
        }
        break;
        
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
           // Completed B2-B4 cycle, check if we came from first or second checking question
           const fromSecondCheck = context?.metadata?.fromSecondCheckingQuestion;
           if (fromSecondCheck) {
             // Clear the flag and go back to second checking question
             context.metadata.fromSecondCheckingQuestion = false;
             return 'reality_certainty_check';
           } else {
             // Go back to first checking question
             return 'reality_checking_questions';
           }
           
        case 'reality_certainty_check':
          // Second checking question: Are there any doubts left?
          if (lastResponse.includes('yes')) {
            // Yes, there are doubts - ask for the reason and cycle through B2-B4
            context.metadata.fromSecondCheckingQuestion = true;
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
        // User answered what needs to happen, ask what else
        return 'reality_integration_action_more';
        
      case 'reality_integration_action_more':
        // User answered what else needs to happen
        if (lastResponse.toLowerCase().includes('nothing') || lastResponse.toLowerCase().includes('no') || lastResponse.toLowerCase().includes('not')) {
          // User said nothing more needs to happen - check if we're in digging deeper flow
          const returnStep = context.metadata?.returnToDiggingStep;
          if (returnStep) {
            // We're clearing a problem from digging deeper - return to that step
            context.currentPhase = 'digging_deeper';
            context.metadata.returnToDiggingStep = undefined; // Clear the return step
            return returnStep;
          } else {
            // Regular flow - complete session
            return 'reality_session_complete';
          }
        } else {
          // User gave another action - keep asking what else
          return 'reality_integration_action_more';
        }
        
      case 'reality_session_complete':
        // Reality Shifting session is complete - let the API layer handle completion
        return null;
        
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
        // User answered how they feel about the fact it happened - now route to problem clearing methods
        // Store their feeling as the problem statement and reset to problem work type
        context.problemStatement = lastResponse;
        context.metadata.problemStatement = lastResponse;
        context.metadata.workType = 'problem';
        context.metadata.selectedMethod = undefined; // Reset method selection
        context.currentPhase = 'method_selection';
        return 'choose_method';
        break;

      case 'trauma_dissolve_step_e':
        // Trauma Shifting: Check if goal is fully achieved
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // Goal not achieved - repeat steps B-E (go back to step B)
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          return 'trauma_dissolve_step_b';
        }
        if (lastResponse.includes('yes')) {
          // Goal achieved - proceed to identity check
          return 'trauma_identity_check';
        }
        break;
        
      case 'trauma_identity_check':
        // Trauma Shifting: Check if still feeling the identity
        if (lastResponse.includes('yes') || lastResponse.includes('still')) {
          // Still feeling identity - repeat step 3 (go back to step A)
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          return 'trauma_dissolve_step_a';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No longer feeling identity - proceed to experience check
          return 'trauma_experience_check';
        }
        break;
        
      case 'trauma_experience_check':
        // Trauma Shifting: Check if negative experience still feels like problem
        if (lastResponse.includes('yes') || lastResponse.includes('still')) {
          // Still a problem - repeat Steps 2-5 (go back to intro)
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          return 'trauma_shifting_intro';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No longer a problem - proceed to dig deeper
          return 'trauma_dig_deeper';
        }
        break;
        
      case 'trauma_dig_deeper':
        // Trauma Shifting: Check if anything else is a problem
        if (lastResponse.includes('yes')) {
          // Yes, something else is a problem - ask them to define it in a few words first
          context.currentPhase = 'discovery';
          return 'restate_selected_problem';
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
          // Still believes - cycle back to step A
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          return 'belief_step_a';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No longer believes - proceed to belief checking questions
          return 'belief_check_1';
        }
        break;
        
      case 'belief_problem_check':
        // Belief Shifting: Check if problem still exists
        if (lastResponse.includes('yes') || lastResponse.includes('still')) {
          // Still a problem - start new process
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          context.currentPhase = 'discovery';
          return 'restate_belief_problem';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No longer a problem - check if we're in digging deeper flow
          const returnStep = context.metadata?.returnToDiggingStep;
          if (returnStep) {
            // We're clearing a problem from digging deeper - return to that step
            context.currentPhase = 'digging_deeper';
            context.metadata.returnToDiggingStep = undefined; // Clear the return step
            return returnStep;
          } else {
            // Regular flow - move to digging deeper start
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
        // If user says "yes", continue to future problem check
        if (lastResponse.includes('yes')) {
          return 'future_problem_check';
        }
        // If "no", skip digging deeper and go straight to integration
        if (lastResponse.includes('no')) {
          context.currentPhase = 'integration';
          return 'integration_start';
        }
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
        // Route to the proper intro steps of each treatment method
        const diggingSelectedMethod = context.metadata?.selectedMethod;
        if (diggingSelectedMethod === 'problem_shifting') {
          return 'problem_shifting_intro';
        } else if (diggingSelectedMethod === 'identity_shifting') {
          return 'identity_shifting_intro';
        } else if (diggingSelectedMethod === 'belief_shifting') {
          return 'belief_shifting_intro';
        }
        // Default fallback
        return 'problem_shifting_intro';
        
      // Handle all scenario check steps
      case 'scenario_check_1':
        if (lastResponse.includes('yes')) {
          return 'restate_scenario_problem_1';
        }
        if (lastResponse.includes('no')) {
          return 'scenario_check_2';
        }
        break;
        
      case 'restate_scenario_problem_1':
        return 'clear_scenario_problem_1';
        
      case 'clear_scenario_problem_1':
        // After clearing, return to next scenario check
        const returnStep1 = context.metadata?.returnToDiggingStep;
        if (returnStep1) {
          context.currentPhase = 'digging_deeper';
          return returnStep1;
        }
        return 'scenario_check_2';
        
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
        // After clearing, return to next scenario check
        const returnStep2 = context.metadata?.returnToDiggingStep;
        if (returnStep2) {
          context.currentPhase = 'digging_deeper';
          return returnStep2;
        }
        return 'scenario_check_3';
        
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
        // After clearing, move to anything else checks
        const returnStep3 = context.metadata?.returnToDiggingStep;
        if (returnStep3) {
          context.currentPhase = 'digging_deeper';
          return returnStep3;
        }
        return 'anything_else_check_1';
        
      // Handle all "anything else" check steps
      case 'anything_else_check_1':
        if (lastResponse.includes('yes')) {
          return 'restate_anything_else_problem_1';
        }
        if (lastResponse.includes('no')) {
          return 'anything_else_check_2';
        }
        break;
        
      case 'restate_anything_else_problem_1':
        return 'clear_anything_else_problem_1';
        
      case 'clear_anything_else_problem_1':
        // After clearing, return to next anything else check
        const returnStepAE1 = context.metadata?.returnToDiggingStep;
        if (returnStepAE1) {
          context.currentPhase = 'digging_deeper';
          return returnStepAE1;
        }
        return 'anything_else_check_2';
        
      case 'anything_else_check_2':
        if (lastResponse.includes('yes')) {
          return 'restate_anything_else_problem_2';
        }
        if (lastResponse.includes('no')) {
          return 'anything_else_check_3';
        }
        break;
        
      case 'restate_anything_else_problem_2':
        return 'clear_anything_else_problem_2';
        
      case 'clear_anything_else_problem_2':
        // After clearing, return to next anything else check
        const returnStepAE2 = context.metadata?.returnToDiggingStep;
        if (returnStepAE2) {
          context.currentPhase = 'digging_deeper';
          return returnStepAE2;
        }
        return 'anything_else_check_3';
        
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
        context.currentStep === 'reality_session_complete' ||
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
   * Save treatment context to database
   */
  private async saveContextToDatabase(context: TreatmentContext): Promise<void> {
    try {
      const supabase = createServerClient();

      // Update session data
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
   * Process identity response to convert emotions/adjectives to proper identity format
   */
  private processIdentityResponse(userInput: string): string {
    const input = userInput.toLowerCase().trim();
    
    // Common emotions that should become "X person"
    const emotionToIdentity: { [key: string]: string } = {
      'hurt': 'hurt person',
      'scared': 'scared person', 
      'angry': 'angry person',
      'sad': 'sad person',
      'frustrated': 'frustrated person',
      'anxious': 'anxious person',
      'worried': 'worried person',
      'stressed': 'stressed person',
      'overwhelmed': 'overwhelmed person',
      'helpless': 'helpless person',
      'powerless': 'powerless person',
      'weak': 'weak person',
      'strong': 'strong person',
      'confident': 'confident person',
      'happy': 'happy person',
      'peaceful': 'peaceful person',
      'calm': 'calm person'
    };
    
    // Check if it's a simple emotion that needs "person" added
    if (emotionToIdentity[input]) {
      return emotionToIdentity[input];
    }
    
    // If it already contains "person", "me", or other identity words, use as-is
    if (input.includes('person') || input.includes('me') || input.includes('someone') || input.includes('individual')) {
      return userInput; // Preserve original casing
    }
    
    // If it's an adjective without "person", add "person"
    const singleWords = ['lazy', 'tired', 'energetic', 'motivated', 'lost', 'found', 'broken', 'whole', 'empty', 'full'];
    if (singleWords.includes(input) || (input.split(' ').length === 1 && !input.includes('victim'))) {
      return `${userInput} person`;
    }
    
    // Return as-is for more complex responses
    return userInput;
  }
} 