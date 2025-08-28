// Labs Treatment State Machine - Demo version
// This contains all the treatment scripts from the main state machine
// but is kept separate to avoid modifying the working treatment system

export interface LabsTreatmentPhase {
  name: string;
  steps: LabsTreatmentStep[];
  maxDuration: number;
}

export interface LabsTreatmentStep {
  id: string;
  scriptedResponse: string | ((userInput?: string, context?: any) => string);
  expectedResponseType: 'feeling' | 'problem' | 'experience' | 'yesno' | 'open' | 'goal' | 'selection' | 'description';
  validationRules: LabsValidationRule[];
  nextStep?: string;
  aiTriggers?: LabsAITrigger[];
}

export interface LabsValidationRule {
  type: 'minLength' | 'maxLength' | 'containsKeywords' | 'format';
  value: number | string | string[];
  errorMessage: string;
}

export interface LabsAITrigger {
  condition: 'userStuck' | 'needsClarification' | 'multipleProblems' | 'tooLong' | 'offTopic';
  threshold?: number;
  action: 'clarify' | 'redirect' | 'simplify' | 'focus';
}

export interface LabsTreatmentContext {
  sessionId: string;
  currentPhase: string;
  currentStep: string;
  userResponses: Record<string, string>;
  problemStatement?: string;
  goalStatement?: string;
  negativeExperienceStatement?: string;
  startTime: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
}

export interface LabsProcessingResult {
  canContinue: boolean;
  nextStep?: string;
  reason?: string;
  scriptedResponse?: string;
  needsLinguisticProcessing?: boolean;
  triggeredAI?: boolean;
  needsAIAssistance?: {
    trigger: LabsAITrigger;
    context: string;
    userInput: string;
  };
}

export class LabsTreatmentStateMachine {
  private phases: Map<string, LabsTreatmentPhase>;
  private contexts: Map<string, LabsTreatmentContext>;

  constructor() {
    this.phases = new Map();
    this.contexts = new Map();
    this.initializePhases();
  }

  /**
   * Initialize a demo treatment session
   */
  initializeSession(sessionId: string, modality: string, initialInput?: string): LabsProcessingResult {
    const context: LabsTreatmentContext = {
      sessionId,
      currentPhase: 'introduction',
      currentStep: 'mind_shifting_explanation',
      userResponses: {},
      startTime: new Date(),
      lastActivity: new Date(),
      metadata: {
        modality,
        initialInput
      }
    };

    this.contexts.set(sessionId, context);

    const currentPhase = this.phases.get(context.currentPhase);
    if (!currentPhase) {
      throw new Error(`Invalid phase: ${context.currentPhase}`);
    }

    const currentStep = currentPhase.steps.find(s => s.id === context.currentStep);
    if (!currentStep) {
      throw new Error(`Invalid step: ${context.currentStep}`);
    }

    const scriptedResponse = this.getScriptedResponse(currentStep, context);
    return {
      canContinue: true,
      nextStep: context.currentStep,
      scriptedResponse
    };
  }

  /**
   * Process user input using the treatment state machine with full validation
   */
  processUserInput(sessionId: string, userInput: string): LabsProcessingResult {
    const context = this.contexts.get(sessionId);
    if (!context) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const currentPhase = this.phases.get(context.currentPhase);
    if (!currentPhase) {
      throw new Error(`Invalid phase: ${context.currentPhase}`);
    }

    const currentStep = currentPhase.steps.find(s => s.id === context.currentStep);
    if (!currentStep) {
      throw new Error(`Invalid step: ${context.currentStep}`);
    }

    // Update context with user response
    context.userResponses[context.currentStep] = userInput;
    context.lastActivity = new Date();

    // Validate user input with comprehensive validation from main system
    const validationResult = this.validateUserInput(userInput, currentStep, context);
    if (!validationResult.isValid) {
      // Special handling for multiple problems detected
      if (validationResult.error === 'MULTIPLE_PROBLEMS_DETECTED') {
        context.currentStep = 'multiple_problems_selection';
        const multipleProblemsStep = currentPhase.steps.find(s => s.id === 'multiple_problems_selection');
        if (multipleProblemsStep) {
          const scriptedResponse = this.getScriptedResponse(multipleProblemsStep, context);
          return {
            canContinue: true,
            nextStep: 'multiple_problems_selection',
            scriptedResponse
          };
        }
      }
      
      // Check if we need AI assistance
      const aiTrigger = this.checkAITriggers(userInput, currentStep, context);
      if (aiTrigger) {
        return {
          canContinue: false,
          triggeredAI: true,
          needsAIAssistance: {
            trigger: aiTrigger,
            context: this.buildAIContext(context, currentStep),
            userInput
          }
        };
      }
      
      return {
        canContinue: false,
        reason: validationResult.error,
        scriptedResponse: this.getValidationPrompt(currentStep, validationResult.error || 'Invalid input')
      };
    }

    // Get the current step's response to check for internal signals
    const currentStepResponse = this.getScriptedResponse(currentStep, context, userInput);
    
    // Check if this is an internal confirmation signal
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
      const nextStepId = this.determineNextStep(currentStep, context);
      if (nextStepId) {
        context.currentStep = nextStepId;
        const updatedPhase = this.phases.get(context.currentPhase);
        if (!updatedPhase) {
          throw new Error(`Invalid updated phase: ${context.currentPhase}`);
        }
        
        const nextStep = updatedPhase.steps.find(s => s.id === nextStepId);
        if (nextStep) {
          const actualResponse = this.getScriptedResponse(nextStep, context, userInput);
          const needsLinguisticProcessing = this.isLinguisticProcessingStep(nextStep.id);
          
          return {
            canContinue: true,
            nextStep: nextStepId,
            scriptedResponse: actualResponse,
            needsLinguisticProcessing
          };
        }
      }
    }

    // Regular flow - proceed to next step
    const nextStepId = this.determineNextStep(currentStep, context);
    if (nextStepId) {
      context.currentStep = nextStepId;
      
      const updatedPhase = this.phases.get(context.currentPhase);
      if (!updatedPhase) {
        throw new Error(`Invalid updated phase: ${context.currentPhase}`);
      }
      
      const nextStep = updatedPhase.steps.find(s => s.id === nextStepId);
      if (nextStep) {
        const scriptedResponse = this.getScriptedResponse(nextStep, context, userInput);
        const needsLinguisticProcessing = this.isLinguisticProcessingStep(nextStep.id);
        
        return {
          canContinue: true,
          nextStep: nextStepId,
          scriptedResponse,
          needsLinguisticProcessing
        };
      }
    }

    // Phase complete
    return this.handlePhaseCompletion(context);
  }

  /**
   * Get scripted response for a step
   */
  private getScriptedResponse(step: LabsTreatmentStep, context: LabsTreatmentContext, currentUserInput?: string): string {
    if (typeof step.scriptedResponse === 'function') {
      const userInput = currentUserInput || (() => {
        const previousStepId = this.getPreviousStep(step.id, context.currentPhase);
        return previousStepId ? context.userResponses[previousStepId] : undefined;
      })();
      return step.scriptedResponse(userInput, context);
    }
    return step.scriptedResponse;
  }

  /**
   * Comprehensive validation from main system
   */
  private validateUserInput(userInput: string, step: LabsTreatmentStep, context: LabsTreatmentContext): { isValid: boolean; error?: string } {
    const trimmed = userInput.trim();
    const words = trimmed.split(' ').length;
    const lowerInput = trimmed.toLowerCase();
    
    // Basic validation
    if (trimmed.length === 0) {
      return { isValid: false, error: 'Please provide a response.' };
    }

    // Special validation for introduction phase
    if (step.id === 'mind_shifting_explanation') {
      // Skip validation for work type selection inputs (1, 2, 3)
      if (trimmed === '1' || trimmed === '2' || trimmed === '3') {
        return { isValid: true };
      }
      
      // Check if user stated it as a goal instead of problem - FLAG FOR AI VALIDATION
      const goalIndicators = ['want to', 'want', 'wish to', 'hope to', 'plan to', 'goal', 'achieve', 'get', 'become', 'have', 'need to', 'would like to'];
      const hasGoalLanguage = goalIndicators.some(indicator => lowerInput.includes(indicator));
      
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
      
      // Check for multiple problems
      const problemConnectors = ['and', 'also', 'plus', 'additionally', 'another', 'other', 'too', 'as well', 'along with'];
      
      // Common phrase patterns that shouldn't be considered multiple problems
      const singleConceptPhrases = [
        'love and peace', 'peace and love', 'health and wellness', 'wellness and health',
        'happy and healthy', 'healthy and happy', 'mind and body', 'body and mind',
        'work and life', 'life and work', 'friends and family', 'family and friends',
        'joy and happiness', 'happiness and joy', 'calm and peaceful', 'peaceful and calm'
      ];
      
      // Check if the input contains a single concept phrase
      const isSingleConcept = singleConceptPhrases.some(phrase => lowerInput.includes(phrase));
      
      if (!isSingleConcept) {
        const hasMultipleProblems = problemConnectors.some(connector => lowerInput.includes(connector));
        if (hasMultipleProblems) {
          return { isValid: false, error: 'Let\'s make sure this is only one issue and not multiple. Can you tell me the main problem you\'d like to focus on?' };
        }
      }
      
      // Check if too long (over 20 words)
      if (words > 20) {
        return { isValid: false, error: 'OK I understand what you have said, but please tell me what the problem is in just a few words' };
      }
    }

    // Special validation for goal description steps
    if (step.id === 'goal_description' || step.id === 'reality_goal_capture') {
      // Check if user stated it as a problem instead of goal - FLAG FOR AI VALIDATION
      const problemIndicators = ['problem', 'issue', 'trouble', 'difficulty', 'struggle', 'can\'t', 'cannot', 'unable to', 'don\'t', 'do not', 'not able', 'hard to', 'difficult to', 'not enough', 'lack of', 'need more'];
      const hasProblemLanguage = problemIndicators.some(indicator => lowerInput.includes(indicator));
      
      if (hasProblemLanguage) {
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:goal_vs_problem' };
      }
      
      // Check if user stated it as a question - FLAG FOR AI VALIDATION  
      const questionIndicators = ['how can', 'what should', 'why do', 'when will', 'where can', 'should i', 'how do i', 'what can i'];
      const hasQuestionLanguage = questionIndicators.some(indicator => lowerInput.includes(indicator)) || trimmed.endsWith('?');
      
      if (hasQuestionLanguage) {
        return { isValid: false, error: 'AI_VALIDATION_NEEDED:goal_vs_question' };
      }
    }

    // Special validation for negative experience description
    if (step.id === 'negative_experience_description' || step.id === 'trauma_shifting_intro') {
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
    if (problemFocusedIntros.includes(step.id)) {
      // Check if user stated it as a goal instead of problem
      const goalIndicators = ['want to', 'want', 'wish to', 'hope to', 'plan to', 'goal', 'achieve', 'get', 'become', 'have', 'need to', 'would like to'];
      const hasGoalLanguage = goalIndicators.some(indicator => lowerInput.includes(indicator));
      
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
   * Check if AI assistance is needed - from main system
   */
  private checkAITriggers(userInput: string, step: LabsTreatmentStep, context: LabsTreatmentContext): LabsAITrigger | null {
    const trimmed = userInput.trim();
    const words = trimmed.split(' ').length;
    const lowerInput = trimmed.toLowerCase();
    
    for (const trigger of step.aiTriggers || []) {
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
   * Build AI context for assistance
   */
  private buildAIContext(context: LabsTreatmentContext, currentStep: LabsTreatmentStep): string {
    return `Current step: ${currentStep.id}, Phase: ${context.currentPhase}, Expected response: ${currentStep.expectedResponseType}`;
  }

  /**
   * Get validation prompt for errors
   */
  private getValidationPrompt(step: LabsTreatmentStep, error: string): string {
    if (error.startsWith('AI_VALIDATION_NEEDED:')) {
      const validationType = error.split(':')[1];
      switch (validationType) {
        case 'problem_vs_goal':
          return "I notice you've described this as something you want to achieve. For this process, please tell me what the problem is instead. What's the issue or difficulty you're experiencing?";
        case 'goal_vs_problem':
          return "I notice you've described this as a problem. For this process, please tell me what you want to achieve instead. What's your goal or desired outcome?";
        case 'problem_vs_question':
          return "I notice you've phrased this as a question. For this process, please tell me what the problem is as a statement instead.";
        case 'goal_vs_question':
          return "I notice you've phrased this as a question. For this process, please tell me what you want to achieve as a statement instead.";
        case 'single_negative_experience':
          return "For this process, please describe a single specific negative experience rather than a pattern of experiences. What's one particular incident you'd like to work on?";
        default:
          return error;
      }
    }
    return error;
  }

  /**
   * Process identity response - from main system
   */
  private processIdentityResponse(userInput: string): string {
    const input = userInput.toLowerCase().trim();
    
    // Handle common identity patterns
    if (input.startsWith('a ') || input.startsWith('an ')) {
      return input.substring(2);
    }
    
    if (input.startsWith('someone who ')) {
      return input.substring(12);
    }
    
    if (input.startsWith('i am ')) {
      return input.substring(5);
    }
    
    return input;
  }

  /**
   * Count problems in user input
   */
  private countProblems(userInput: string): number {
    const problemConnectors = ['and', 'also', 'plus', 'additionally', 'another', 'other', 'too', 'as well'];
    let count = 1; // Start with 1 problem
    
    problemConnectors.forEach(connector => {
      const regex = new RegExp(`\\b${connector}\\b`, 'gi');
      const matches = userInput.match(regex);
      if (matches) {
        count += matches.length;
      }
    });
    
    return Math.min(count, 5); // Cap at 5 problems for UI purposes
  }

  /**
   * Extract individual problems from user input
   */
  private extractProblems(userInput: string): string[] {
    const problemConnectors = ['and', 'also', 'plus', 'additionally', 'another', 'other', 'too', 'as well'];
    let problems = [userInput];
    
    problemConnectors.forEach(connector => {
      const newProblems: string[] = [];
      problems.forEach(problem => {
        const parts = problem.split(new RegExp(`\\s+${connector}\\s+`, 'i'));
        newProblems.push(...parts);
      });
      problems = newProblems;
    });
    
    return problems.map(p => p.trim()).filter(p => p.length > 0).slice(0, 5);
  }

  /**
   * Get integration subject for integration questions
   */
  private getIntegrationSubject(context: LabsTreatmentContext, type: string): string {
    if (type === 'problem') {
      return context.problemStatement || context.metadata?.problemStatement || 'this problem';
    } else if (type === 'goal') {
      return context.goalStatement || context.metadata?.goalStatement || 'this goal';
    } else if (type === 'experience') {
      return context.negativeExperienceStatement || context.metadata?.negativeExperienceStatement || 'this experience';
    }
    return 'this';
  }

  /**
   * Check if step requires linguistic processing
   */
  private isLinguisticProcessingStep(stepId: string): boolean {
    const linguisticSteps = [
      'body_sensation_check',
      'feel_solution_state',
      'reality_step_a2',
      'reality_feel_reason',
      'reality_feel_reason_2',
      'reality_feel_reason_3',
      'blockage_step_b',
      'blockage_step_d',
      'belief_step_b',
      'belief_step_e',
      'identity_dissolve_step_a',
      'identity_dissolve_step_b',
      'identity_check',
      'trauma_dissolve_step_a',
      'trauma_dissolve_step_b',
      'trauma_identity_check',
      'problem_shifting_intro',
      'reality_shifting_intro',
      'blockage_shifting_intro',
      'identity_shifting_intro',
      'trauma_shifting_intro',
      'belief_shifting_intro',
      'reality_goal_capture'
    ];
    
    return linguisticSteps.includes(stepId);
  }

  /**
   * Determine next step based on current step and context - enhanced from main system
   */
  private determineNextStep(currentStep: LabsTreatmentStep, context: LabsTreatmentContext): string | null {
    // Handle special routing logic
    if (currentStep.id === 'mind_shifting_explanation') {
      const response = this.getScriptedResponse(currentStep, context);
      if (response === 'PROBLEM_SELECTION_CONFIRMED') {
        return 'method_selection';
      } else if (response === 'GOAL_SELECTION_CONFIRMED') {
        return 'goal_description';
      } else if (response === 'NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED') {
        return 'negative_experience_description';
      } else if (response === 'SKIP_TO_TREATMENT_INTRO') {
        // Route to appropriate treatment intro based on metadata
        const method = context.metadata.selectedMethod;
        if (method === 'problem_shifting') {
          context.currentPhase = 'problem_shifting';
          return 'problem_shifting_intro';
        }
        if (method === 'identity_shifting') {
          context.currentPhase = 'identity_shifting';
          return 'identity_shifting_intro';
        }
        if (method === 'belief_shifting') {
          context.currentPhase = 'belief_shifting';
          return 'belief_shifting_intro';
        }
        if (method === 'blockage_shifting') {
          context.currentPhase = 'blockage_shifting';
          return 'blockage_shifting_intro';
        }
        if (method === 'reality_shifting') {
          context.currentPhase = 'reality_shifting';
          return 'reality_goal_capture';
        }
        if (method === 'trauma_shifting') {
          context.currentPhase = 'trauma_shifting';
          return 'trauma_shifting_intro';
        }
      }
    }

    // Handle method selection routing
    if (currentStep.id === 'method_selection') {
      return 'problem_description';
    }

    // Handle goal/negative experience routing
    if (currentStep.id === 'goal_description') {
      context.currentPhase = 'reality_shifting';
      context.metadata.selectedMethod = 'reality_shifting';
      return 'reality_goal_capture';
    }

    if (currentStep.id === 'negative_experience_description') {
      context.currentPhase = 'trauma_shifting';
      context.metadata.selectedMethod = 'trauma_shifting';
      return 'trauma_shifting_intro';
    }

    // Handle yes/no responses for problem checking
    if (currentStep.id === 'check_if_still_problem' || 
        currentStep.id === 'blockage_check_if_still_problem' ||
        currentStep.id === 'identity_problem_check' ||
        currentStep.id === 'belief_problem_check') {
      
      const userResponse = context.userResponses[currentStep.id]?.toLowerCase() || '';
      
      if (userResponse.includes('yes')) {
        // Problem still exists, start digging deeper process
        return 'digging_deeper_start';
      } else if (userResponse.includes('no')) {
        // Problem resolved, go to integration
        const method = context.metadata.selectedMethod;
        if (method === 'problem_shifting') return 'problem_integration_awareness_1';
        if (method === 'blockage_shifting') return 'blockage_integration_awareness_1';
        if (method === 'identity_shifting') return 'integration_awareness_1';
        if (method === 'belief_shifting') return 'belief_integration_awareness_1';
        return 'problem_integration_awareness_1'; // fallback
      }
    }

    // Handle digging deeper responses
    if (currentStep.id === 'digging_deeper_start') {
      const userResponse = context.userResponses[currentStep.id]?.toLowerCase() || '';
      
      if (userResponse.includes('yes')) {
        // Continue with current method
        const method = context.metadata.selectedMethod;
        if (method === 'blockage_shifting') {
          // Cycle back to beginning of blockage shifting
          return 'blockage_shifting_intro';
        }
        // For other methods, continue with their specific flow
        return currentStep.nextStep || null;
      } else if (userResponse.includes('no')) {
        // Go to integration
        const method = context.metadata.selectedMethod;
        if (method === 'problem_shifting') return 'problem_integration_awareness_1';
        if (method === 'blockage_shifting') return 'blockage_integration_awareness_1';
        if (method === 'identity_shifting') return 'integration_awareness_1';
        if (method === 'belief_shifting') return 'belief_integration_awareness_1';
        return 'problem_integration_awareness_1'; // fallback
      } else if (userResponse.includes('maybe')) {
        // Continue with method but with modified approach
        return currentStep.nextStep || null;
      }
    }

    // Use nextStep from step definition
    return currentStep.nextStep || null;
  }

  /**
   * Get previous step
   */
  private getPreviousStep(currentStepId: string, phaseName: string): string | null {
    const phase = this.phases.get(phaseName);
    if (!phase) return null;

    const currentIndex = phase.steps.findIndex(step => step.id === currentStepId);
    if (currentIndex <= 0) return null;

    return phase.steps[currentIndex - 1].id;
  }

  /**
   * Handle phase completion
   */
  private handlePhaseCompletion(context: LabsTreatmentContext): LabsProcessingResult {
    return {
      canContinue: false,
      reason: 'phase_complete',
      scriptedResponse: 'Treatment phase completed. Thank you for participating in this demo.'
    };
  }

  /**
   * Get current context
   */
  getContext(sessionId: string): LabsTreatmentContext | null {
    return this.contexts.get(sessionId) || null;
  }

  /**
   * Initialize all treatment phases with exact Mind Shifting protocols
   */
  private initializePhases(): void {
    // Phase 1: Introduction
    this.phases.set('introduction', {
      name: 'Introduction',
      maxDuration: 5,
      steps: [
        {
          id: 'mind_shifting_explanation',
          scriptedResponse: (userInput, context) => {
            if (!userInput) {
              return "Mind Shifting is not like counselling, therapy or life coaching. The Mind Shifting methods are verbal guided processes that we apply to problems, goals, or negative experiences in order to clear them. The way Mind Shifting works is we won't just be talking about what you want to work on, we will be applying Mind Shifting methods in order to clear them, and to do that we will need to define what you want to work on into a clear statement by you telling me what it is in a few words. So I'll be asking you to do that when needed.\n\nWhen you are ready to begin, would you like to work on:\n\n1. PROBLEM\n2. GOAL\n3. NEGATIVE EXPERIENCE";
            }
            
            const input = userInput.toLowerCase();
            
            if (input.includes('1') || (input.includes('problem') && !input.includes('shifting'))) {
              context.metadata.workType = 'problem';
              return "PROBLEM_SELECTION_CONFIRMED";
            } else if (input.includes('2') || (input.includes('goal') && !input.includes('shifting'))) {
              context.metadata.workType = 'goal';
              return "GOAL_SELECTION_CONFIRMED";
            } else if (input.includes('3') || (input.includes('negative') && !input.includes('shifting')) || (input.includes('experience') && !input.includes('shifting'))) {
              context.metadata.workType = 'negative_experience';
              return "NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED";
            }
            
            return "Please choose 1 for Problem, 2 for Goal, or 3 for Negative Experience.";
          },
          expectedResponseType: 'selection',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose 1, 2, or 3.' }
          ],
          nextStep: 'method_selection',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'method_selection',
          scriptedResponse: (userInput, context) => {
            if (!userInput) {
              return "Great! For problems, you can choose from several methods:\n\n1. Problem Shifting (most common)\n2. Identity Shifting\n3. Belief Shifting\n4. Blockage Shifting\n\nPlease choose 1, 2, 3, or 4, or say the method name.";
            }
            
            const input = userInput.toLowerCase();
            
            if (input.includes('1') || input.includes('problem shifting')) {
              context.metadata.selectedMethod = 'problem_shifting';
              return "Great! We'll use Problem Shifting. Please tell me what problem you'd like to work on in a few words.";
            } else if (input.includes('2') || input.includes('identity shifting')) {
              context.metadata.selectedMethod = 'identity_shifting';
              return "Great! We'll use Identity Shifting. Please tell me what problem you'd like to work on in a few words.";
            } else if (input.includes('3') || input.includes('belief shifting')) {
              context.metadata.selectedMethod = 'belief_shifting';
              return "Great! We'll use Belief Shifting. Please tell me what problem you'd like to work on in a few words.";
            } else if (input.includes('4') || input.includes('blockage shifting')) {
              context.metadata.selectedMethod = 'blockage_shifting';
              return "Great! We'll use Blockage Shifting. Please tell me what problem you'd like to work on in a few words.";
            }
            
            return "Please choose 1 for Problem Shifting, 2 for Identity Shifting, 3 for Belief Shifting, or 4 for Blockage Shifting.";
          },
          expectedResponseType: 'selection',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose a method.' }
          ],
          nextStep: 'problem_description',
          aiTriggers: []
        },
        {
          id: 'problem_description',
          scriptedResponse: (userInput, context) => {
            context.problemStatement = userInput;
            context.metadata.problemStatement = userInput;
            return "PROBLEM_SELECTION_CONFIRMED";
          },
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please describe your problem in a few words.' }
          ],
          nextStep: 'problem_confirmation',
          aiTriggers: []
        },
        {
          id: 'problem_confirmation',
          scriptedResponse: (userInput, context) => {
            const problemStatement = context.problemStatement || context.metadata.problemStatement || 'your problem';
            return `I heard you say '${problemStatement}'. Is that correct?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'problem_confirmation_response',
          aiTriggers: []
        },
        {
          id: 'problem_confirmation_response',
          scriptedResponse: (userInput, context) => {
            const input = (userInput || '').toLowerCase().trim();
            if (input.includes('yes') || input.includes('y') || input.includes('correct') || input.includes('right')) {
              return "SKIP_TO_TREATMENT_INTRO";
            } else if (input.includes('no') || input.includes('n') || input.includes('wrong') || input.includes('incorrect')) {
              // Reset and ask again
              context.problemStatement = '';
              context.metadata.problemStatement = '';
              context.currentStep = 'work_type_description';
              return "Let's try again. Please describe your problem in a few words.";
            } else {
              return "Please answer yes or no. Is that what you want to work on?";
            }
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          aiTriggers: []
        },
        {
          id: 'goal_description',
          scriptedResponse: (userInput, context) => {
            context.goalStatement = userInput;
            context.metadata.goalStatement = userInput;
            context.metadata.selectedMethod = 'reality_shifting';
            return "GOAL_SELECTION_CONFIRMED";
          },
          expectedResponseType: 'goal',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please describe your goal in a few words.' }
          ],
          nextStep: 'goal_confirmation',
          aiTriggers: []
        },
        {
          id: 'goal_confirmation',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context.goalStatement || context.metadata.goalStatement || 'your goal';
            return `I heard you say '${goalStatement}'. Is that correct?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'goal_confirmation_response',
          aiTriggers: []
        },
        {
          id: 'goal_confirmation_response',
          scriptedResponse: (userInput, context) => {
            const input = (userInput || '').toLowerCase().trim();
            if (input.includes('yes') || input.includes('y') || input.includes('correct') || input.includes('right')) {
              return "SKIP_TO_TREATMENT_INTRO";
            } else if (input.includes('no') || input.includes('n') || input.includes('wrong') || input.includes('incorrect')) {
              // Reset and ask again
              context.goalStatement = '';
              context.metadata.goalStatement = '';
              context.currentStep = 'work_type_description';
              return "Let's try again. Please describe your goal in a few words.";
            } else {
              return "Please answer yes or no. Is that what you want to work on?";
            }
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          aiTriggers: []
        },
        {
          id: 'negative_experience_description',
          scriptedResponse: (userInput, context) => {
            context.negativeExperienceStatement = userInput;
            context.metadata.negativeExperienceStatement = userInput;
            context.metadata.selectedMethod = 'trauma_shifting';
            return "NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED";
          },
          expectedResponseType: 'experience',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please describe the negative experience in a few words.' }
          ],
          nextStep: 'experience_confirmation',
          aiTriggers: []
        },
        {
          id: 'experience_confirmation',
          scriptedResponse: (userInput, context) => {
            const experienceStatement = context.negativeExperienceStatement || context.metadata.negativeExperienceStatement || 'your experience';
            return `I heard you say '${experienceStatement}'. Is that correct?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'experience_confirmation_response',
          aiTriggers: []
        },
        {
          id: 'experience_confirmation_response',
          scriptedResponse: (userInput, context) => {
            const input = (userInput || '').toLowerCase().trim();
            if (input.includes('yes') || input.includes('y') || input.includes('correct') || input.includes('right')) {
              return "SKIP_TO_TREATMENT_INTRO";
            } else if (input.includes('no') || input.includes('n') || input.includes('wrong') || input.includes('incorrect')) {
              // Reset and ask again
              context.negativeExperienceStatement = '';
              context.metadata.negativeExperienceStatement = '';
              context.currentStep = 'work_type_description';
              return "Let's try again. Please describe the negative experience in a few words.";
            } else {
              return "Please answer yes or no. Is that what you want to work on?";
            }
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          aiTriggers: []
        }
      ]
    });

    // Phase 2: Problem Shifting - Updated with exact scripts from main system
    this.phases.set('problem_shifting', {
      name: 'Problem Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'problem_shifting_intro',
          scriptedResponse: (userInput, context) => {
            const cleanProblemStatement = context?.metadata?.problemStatement || context?.problemStatement || 'the problem';
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
            const problemStatement = context?.problemStatement || context?.metadata?.problemStatement || 'the problem';
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
          scriptedResponse: (userInput) => `What would you feel like if '${userInput || 'that'}'?`,
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
            const problemStatement = context?.problemStatement || context?.metadata?.problemStatement || 'the problem';
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
          id: 'digging_deeper_start',
          scriptedResponse: () => `Do you want to dig deeper?`,
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'problem_integration_awareness_1',
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
          scriptedResponse: () => `What are you more aware of now than before we did this process?`,
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
          scriptedResponse: () => `How has it helped you to do this process?`,
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
          scriptedResponse: () => `What is your new narrative about this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your new narrative.' }
          ],
          nextStep: 'problem_integration_awareness_5'
        },
        {
          id: 'problem_integration_awareness_5',
          scriptedResponse: () => `What's your intention now in relation to this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your intention now.' }
          ],
          nextStep: 'problem_integration_action_1'
        },
        {
          id: 'problem_integration_action_1',
          scriptedResponse: () => `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?... What else needs to happen for you to realise your intention? (Until they are clear on their plan of action)`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what needs to happen.' }
          ],
          nextStep: 'problem_integration_action_2'
        },
        {
          id: 'problem_integration_action_2',
          scriptedResponse: () => `What is the one thing you can do that will make everything else easier or unnecessary?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'problem_integration_action_3'
        },
        {
          id: 'problem_integration_action_3',
          scriptedResponse: () => `What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action and when you will do it.' }
          ],
          nextStep: 'problem_session_complete'
        },
        {
          id: 'problem_session_complete',
          scriptedResponse: () => `Excellent! You've completed the Problem Shifting process. You've transformed your problem into a clear action plan. Remember to follow through on your commitments. Thank you for participating in this demo.`,
          expectedResponseType: 'open',
          validationRules: []
        }
      ]
    });

    // Phase 3: Reality Shifting
    this.phases.set('reality_shifting', {
      name: 'Reality Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'reality_goal_capture',
          scriptedResponse: (userInput, context) => {
            const goal = context.goalStatement || userInput || 'your goal';
            return `We're going to use Reality Shifting to help you achieve "${goal}". This method helps you overcome obstacles and align your reality with your desires.\n\nLet's begin. Feel the goal "${goal}"... what can you feel now?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you can feel.' }
          ],
          nextStep: 'reality_step_a2'
        },
        {
          id: 'reality_step_a2',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what can you feel now?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you can feel now.' }
          ],
          nextStep: 'reality_step_a3'
        },
        {
          id: 'reality_step_a3',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`,
          expectedResponseType: 'experience',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens when you feel that.' }
          ],
          nextStep: 'reality_step_b'
        },
        {
          id: 'reality_step_b',
          scriptedResponse: (userInput, context) => {
            const goal = context.goalStatement || 'your goal';
            return `Feel the goal '${goal}'... what's stopping you from having this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what\'s stopping you.' }
          ],
          nextStep: 'reality_why_not_possible'
        },
        {
          id: 'reality_why_not_possible',
          scriptedResponse: (userInput) => `Why is it not possible for you to have '${userInput || 'that'}'?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me why it\'s not possible.' }
          ],
          nextStep: 'reality_feel_reason'
        },
        {
          id: 'reality_feel_reason',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that reason'}'... what does it feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'reality_feel_reason_2'
        },
        {
          id: 'reality_feel_reason_2',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what can you feel now?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you can feel now.' }
          ],
          nextStep: 'reality_feel_reason_3'
        },
        {
          id: 'reality_feel_reason_3',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what's the first thing you notice about it?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you notice.' }
          ],
          nextStep: 'reality_checking_questions'
        },
        {
          id: 'reality_checking_questions',
          scriptedResponse: (userInput, context) => {
            const goal = context.goalStatement || 'your goal';
            return `Feel the goal '${goal}'... is it possible for you to have this now?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please tell me if it\'s possible now.' }
          ],
          nextStep: 'reality_session_complete'
        },
        {
          id: 'reality_session_complete',
          scriptedResponse: () => `Excellent! You've completed the Reality Shifting process. You've identified and cleared the obstacles to your goal. Thank you for participating in this demo.`,
          expectedResponseType: 'open',
          validationRules: []
        }
      ]
    });

    // Phase 4: Identity Shifting
    this.phases.set('identity_shifting', {
      name: 'Identity Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'identity_shifting_intro',
          scriptedResponse: (userInput, context) => {
            const problem = context.problemStatement || 'your problem';
            return `We're going to use Identity Shifting to work on "${problem}". This method helps you transform the identity that's connected to this problem.\n\nLet's begin. Feel the problem "${problem}"... what identity do you have in relation to this problem?`;
          },
          expectedResponseType: 'description',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what identity you have.' }
          ],
          nextStep: 'identity_dissolve_step_a'
        },
        {
          id: 'identity_dissolve_step_a',
          scriptedResponse: (userInput) => `Feel yourself being '${userInput || 'that identity'}'... as '${userInput || 'that identity'}', what do you want?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you want.' }
          ],
          nextStep: 'identity_dissolve_step_b'
        },
        {
          id: 'identity_dissolve_step_b',
          scriptedResponse: (userInput) => `Feel yourself being '${userInput || 'that identity'}'... exaggerate the feeling of it and tell me the first thing that you notice about it.`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you notice.' }
          ],
          nextStep: 'identity_dissolve_step_c'
        },
        {
          id: 'identity_dissolve_step_c',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`,
          expectedResponseType: 'experience',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens when you feel that.' }
          ],
          nextStep: 'identity_dissolve_step_d'
        },
        {
          id: 'identity_dissolve_step_d',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feeling feels like.' }
          ],
          nextStep: 'identity_dissolve_step_e'
        },
        {
          id: 'identity_dissolve_step_e',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`,
          expectedResponseType: 'experience',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens when you feel that.' }
          ],
          nextStep: 'identity_check'
        },
        {
          id: 'identity_check',
          scriptedResponse: (userInput) => `Can you still feel yourself being '${userInput || 'that identity'}'?`,
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please tell me if you can still feel that identity.' }
          ],
          nextStep: 'identity_session_complete'
        },
        {
          id: 'identity_session_complete',
          scriptedResponse: () => `Excellent! You've completed the Identity Shifting process. You've transformed the identity that was connected to your problem. Thank you for participating in this demo.`,
          expectedResponseType: 'open',
          validationRules: []
        }
      ]
    });

    // Phase 5: Belief Shifting
    this.phases.set('belief_shifting', {
      name: 'Belief Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'belief_shifting_intro',
          scriptedResponse: (userInput, context) => {
            const problem = context.problemStatement || 'your problem';
            return `We're going to use Belief Shifting to work on "${problem}". This method helps you identify and transform limiting beliefs.\n\nLet's begin. Feel the problem "${problem}"... what belief do you have about this?`;
          },
          expectedResponseType: 'description',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what belief you have.' }
          ],
          nextStep: 'belief_step_b'
        },
        {
          id: 'belief_step_b',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that belief'}'... what does '${userInput || 'that belief'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that belief feels like.' }
          ],
          nextStep: 'belief_step_c'
        },
        {
          id: 'belief_step_c',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`,
          expectedResponseType: 'experience',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens when you feel that.' }
          ],
          nextStep: 'belief_step_d'
        },
        {
          id: 'belief_step_d',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feeling feels like.' }
          ],
          nextStep: 'belief_step_e'
        },
        {
          id: 'belief_step_e',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feeling feels like.' }
          ],
          nextStep: 'belief_step_f'
        },
        {
          id: 'belief_step_f',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`,
          expectedResponseType: 'experience',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens when you feel that.' }
          ],
          nextStep: 'belief_check'
        },
        {
          id: 'belief_check',
          scriptedResponse: (userInput, context) => {
            const problem = context.problemStatement || 'your problem';
            return `Feel the problem '${problem}'... does this belief still feel true?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please tell me if the belief still feels true.' }
          ],
          nextStep: 'belief_session_complete'
        },
        {
          id: 'belief_session_complete',
          scriptedResponse: () => `Excellent! You've completed the Belief Shifting process. You've transformed the limiting belief that was connected to your problem. Thank you for participating in this demo.`,
          expectedResponseType: 'open',
          validationRules: []
        }
      ]
    });

    // Phase 6: Blockage Shifting
    this.phases.set('blockage_shifting', {
      name: 'Blockage Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'blockage_shifting_intro',
          scriptedResponse: (userInput, context) => {
            const problem = context.problemStatement || 'your problem';
            return `We're going to use Blockage Shifting to work on "${problem}". This method helps you identify and clear internal blockages.\n\nLet's begin. Feel the problem "${problem}"... what blockage do you feel inside?`;
          },
          expectedResponseType: 'description',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what blockage you feel.' }
          ],
          nextStep: 'blockage_step_b'
        },
        {
          id: 'blockage_step_b',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that blockage'}'... what does '${userInput || 'that blockage'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that blockage feels like.' }
          ],
          nextStep: 'blockage_step_c'
        },
        {
          id: 'blockage_step_c',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`,
          expectedResponseType: 'experience',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens when you feel that.' }
          ],
          nextStep: 'blockage_step_d'
        },
        {
          id: 'blockage_step_d',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feeling feels like.' }
          ],
          nextStep: 'blockage_step_e'
        },
        {
          id: 'blockage_step_e',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`,
          expectedResponseType: 'experience',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens when you feel that.' }
          ],
          nextStep: 'blockage_check_if_still_problem'
        },
        {
          id: 'blockage_check_if_still_problem',
          scriptedResponse: (userInput, context) => {
            const problem = context.problemStatement || 'your problem';
            return `Feel the problem '${problem}'... does it still feel like a problem?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please tell me if it still feels like a problem.' }
          ],
          nextStep: 'blockage_session_complete'
        },
        {
          id: 'blockage_session_complete',
          scriptedResponse: () => `Excellent! You've completed the Blockage Shifting process. You've identified and cleared the internal blockage that was connected to your problem. Thank you for participating in this demo.`,
          expectedResponseType: 'open',
          validationRules: []
        }
      ]
    });

    // Phase 7: Trauma Shifting
    this.phases.set('trauma_shifting', {
      name: 'Trauma Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'trauma_shifting_intro',
          scriptedResponse: (userInput, context) => {
            const experience = context.negativeExperienceStatement || 'your negative experience';
            return `We're going to use Trauma Shifting to work on "${experience}". This method helps you process and heal from traumatic experiences.\n\nLet's begin. Feel the experience "${experience}"... what identity do you have in relation to this experience?`;
          },
          expectedResponseType: 'description',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what identity you have.' }
          ],
          nextStep: 'trauma_dissolve_step_a'
        },
        {
          id: 'trauma_dissolve_step_a',
          scriptedResponse: (userInput) => `Feel yourself being '${userInput || 'that identity'}'... as '${userInput || 'that identity'}', what do you want?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you want.' }
          ],
          nextStep: 'trauma_dissolve_step_b'
        },
        {
          id: 'trauma_dissolve_step_b',
          scriptedResponse: (userInput) => `Feel yourself being '${userInput || 'that identity'}'... exaggerate the feeling of it and tell me the first thing that you notice about it.`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you notice.' }
          ],
          nextStep: 'trauma_dissolve_step_c'
        },
        {
          id: 'trauma_dissolve_step_c',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`,
          expectedResponseType: 'experience',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens when you feel that.' }
          ],
          nextStep: 'trauma_dissolve_step_d'
        },
        {
          id: 'trauma_dissolve_step_d',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feeling feels like.' }
          ],
          nextStep: 'trauma_dissolve_step_e'
        },
        {
          id: 'trauma_dissolve_step_e',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`,
          expectedResponseType: 'experience',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens when you feel that.' }
          ],
          nextStep: 'trauma_identity_check'
        },
        {
          id: 'trauma_identity_check',
          scriptedResponse: (userInput) => `Can you still feel yourself being '${userInput || 'that identity'}'?`,
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please tell me if you can still feel that identity.' }
          ],
          nextStep: 'trauma_session_complete'
        },
        {
          id: 'trauma_session_complete',
          scriptedResponse: () => `Excellent! You've completed the Trauma Shifting process. You've processed and transformed the traumatic experience. Thank you for participating in this demo.`,
          expectedResponseType: 'open',
          validationRules: []
        }
      ]
    });
  }
} 