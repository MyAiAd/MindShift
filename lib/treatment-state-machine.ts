export interface TreatmentPhase {
  name: string;
  steps: TreatmentStep[];
  maxDuration: number; // in minutes
}

export interface TreatmentStep {
  id: string;
  scriptedResponse: string | ((userInput?: string | undefined, context?: any) => string);
  expectedResponseType: 'feeling' | 'problem' | 'experience' | 'yesno' | 'open';
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
    context?: Partial<TreatmentContext>
  ): Promise<ProcessingResult> {
    // Special handling for session initialization
    if (userInput === 'start') {
      const treatmentContext = this.getOrCreateContext(sessionId, context);
      const currentPhase = this.phases.get(treatmentContext.currentPhase);
      
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

    // Validate user input FIRST
    const validationResult = this.validateUserInput(userInput, currentStep);
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

    // Input is valid - proceed to next step
    const nextStepId = this.determineNextStep(currentStep, treatmentContext);
    if (nextStepId) {
      treatmentContext.currentStep = nextStepId;
      
      // Get the correct phase after potential phase change
      const updatedPhase = this.phases.get(treatmentContext.currentPhase);
      if (!updatedPhase) {
        throw new Error(`Invalid updated phase: ${treatmentContext.currentPhase}`);
      }
      
      const nextStep = updatedPhase.steps.find(s => s.id === nextStepId);
      
      if (nextStep) {
        const scriptedResponse = this.getScriptedResponse(nextStep, treatmentContext);
        const needsLinguisticProcessing = this.isLinguisticProcessingStep(nextStep.id);
        
        return {
          canContinue: true,
          nextStep: nextStepId,
          scriptedResponse,
          needsLinguisticProcessing
        };
      } else {
        throw new Error(`Step '${nextStepId}' not found in phase '${treatmentContext.currentPhase}'`);
      }
    }

    // Phase complete or error
    return this.handlePhaseCompletion(treatmentContext);
  }

  /**
   * Check if current step requires linguistic processing (only the specific body sensation check)
   */
  private isLinguisticProcessingStep(stepId: string): boolean {
    // The 5th speaking opportunity (body sensation check) and 7th speaking opportunity (feel solution state)
    return stepId === 'body_sensation_check' || stepId === 'feel_solution_state';
  }

  /**
   * Get instant scripted response - <200ms performance target
   */
  private getScriptedResponse(step: TreatmentStep, context: TreatmentContext): string {
    if (typeof step.scriptedResponse === 'function') {
      const previousStepId = this.getPreviousStep(step.id, context.currentPhase);
      const lastResponse = previousStepId ? context.userResponses[previousStepId] : undefined;
      return step.scriptedResponse(lastResponse, context);
    }
    return step.scriptedResponse;
  }

  /**
   * Validate user input against step requirements
   */
  private validateUserInput(userInput: string, step: TreatmentStep): { isValid: boolean; error?: string } {
    const trimmed = userInput.trim();
    const words = trimmed.split(' ').length;
    const lowerInput = trimmed.toLowerCase();
    
    // Special validation for introduction phase
    if (step.id === 'mind_shifting_explanation') {
      // Check if user stated it as a goal instead of problem
      if (lowerInput.includes('want to') || lowerInput.includes('goal') || lowerInput.includes('achieve') || 
          lowerInput.includes('wish to') || lowerInput.includes('hope to') || lowerInput.includes('plan to')) {
        return { isValid: false, error: 'How would you state that as a problem instead of a goal?' };
      }
      
      // Check if user stated it as a question
      if (trimmed.endsWith('?')) {
        return { isValid: false, error: 'How would you state that as a problem instead of a question?' };
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
          scriptedResponse: "Mind Shifting is not like counselling, therapy or life coaching. The Mind Shifting methods are verbal guided processes that we apply to problems, goals, or negative experiences in order to clear them. The way Mind Shifting works is we won't just be talking about problems you want to work on, we will be applying Mind Shifting methods to those problems in order to clear them, and to do that we will need to define each problem into a problem statement by you telling me what the problem is in a few words. So I'll be asking you to do that when needed.\n\nWhen you are ready to begin, please tell me what you would like to work on in a few words.",
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me what you would like to work on.' }
          ],
          nextStep: 'analyze_response',
          aiTriggers: [
            { condition: 'multipleProblems', action: 'focus' },
            { condition: 'tooLong', action: 'simplify' },
            { condition: 'needsClarification', action: 'clarify' }
          ]
        }
      ]
    });

    // Phase 2: Discovery (Mostly Scripted)
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
        }
      ]
    });

    // Phase 3: Method Selection (Always Scripted)
    this.phases.set('method_selection', {
      name: 'Method Selection',
      maxDuration: 5,
      steps: [
        {
          id: 'choose_method',
          scriptedResponse: "Would you like to use Problem Shifting, Identity Shifting, Belief Shifting or Blockage Shifting?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose a method.' }
          ],
          aiTriggers: []
        }
      ]
    });

    // Phase 4: Problem Shifting Method (Script with AI Backup)
    this.phases.set('problem_shifting', {
      name: 'Problem Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'problem_shifting_intro',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement from the stored context or fallback to previous responses
            const problemStatement = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
            return `Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. When I ask 'what needs to happen for the problem to not be a problem?' allow your answers to be different each time.\n\nFeel the problem '${problemStatement}'... what does it feel like?`;
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
        }
      ]
    });

    // Phase 5: Digging Deeper (Optional)
    this.phases.set('digging_deeper', {
      name: 'Digging Deeper',
      maxDuration: 10,
      steps: [
        {
          id: 'digging_deeper_start',
          scriptedResponse: "Do you feel the problem will come back in the future?",
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes, no, or maybe.' }
          ],
          nextStep: 'scenario_check',
          aiTriggers: []
        },
        {
          id: 'restate_problem_future',
          scriptedResponse: "How would you state the problem now in a few words?",
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me how you would state the problem now.' }
          ],
          nextStep: 'scenario_check',
          aiTriggers: []
        },
        {
          id: 'scenario_check',
          scriptedResponse: "Is there any scenario in which this would still be a problem for you?",
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'anything_else_check',
          aiTriggers: []
        },
        {
          id: 'anything_else_check',
          scriptedResponse: "Is there anything else about this that's still a problem for you?",
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'integration_start',
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
            const problemStatement = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'this';
            return `How do you feel about ${problemStatement} now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me how you feel about it now.' }
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
          scriptedResponse: "What's your intention now in relation to this?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what your intention is now.' }
          ],
          nextStep: 'action_question',
          aiTriggers: []
        },
        {
          id: 'action_question',
          scriptedResponse: "What needs to happen for you to realise your intention?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what needs to happen.' }
          ],
          nextStep: 'action_followup',
          aiTriggers: []
        },
        {
          id: 'action_followup',
          scriptedResponse: "What else needs to happen for you to realise your intention?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what else needs to happen.' }
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
          problemType: 'problem' // default to problem type
        }
      });
    }
    return this.contexts.get(sessionId)!;
  }

  private determineNextStep(currentStep: TreatmentStep, context: TreatmentContext): string | null {
    const lastResponse = context.userResponses[context.currentStep]?.toLowerCase() || '';
    
    // Handle special flow logic based on current step
    switch (context.currentStep) {
      case 'mind_shifting_explanation':
        // Check if multiple problems were detected
        const userInput = context.userResponses[context.currentStep] || '';
        const problemConnectors = ['and', 'also', 'plus', 'additionally', 'another', 'other', 'too', 'as well', 'along with'];
        
        // Common phrase patterns that shouldn't be considered multiple problems
        const singleConceptPhrases = [
          'love and peace', 'peace and love', 'health and wellness', 'wellness and health',
          'happy and healthy', 'healthy and happy', 'mind and body', 'body and mind',
          'work and life', 'life and work', 'friends and family', 'family and friends',
          'joy and happiness', 'happiness and joy', 'calm and peaceful', 'peaceful and calm'
        ];
        
        // Check if the input contains a single concept phrase
        const isSingleConcept = singleConceptPhrases.some(phrase => userInput.toLowerCase().includes(phrase));
        
        if (!isSingleConcept) {
          const hasMultipleProblems = problemConnectors.some(connector => userInput.toLowerCase().includes(connector));
          if (hasMultipleProblems) {
            context.currentPhase = 'discovery';
            return 'multiple_problems_selection';
          }
        }
        
        // Check if it's a goal or negative experience
        if (userInput.toLowerCase().includes('want to') || userInput.toLowerCase().includes('goal')) {
          context.metadata.problemType = 'goal';
        } else if (userInput.toLowerCase().includes('happened') || userInput.toLowerCase().includes('experience')) {
          context.metadata.problemType = 'negative_experience';
        }
        
        context.currentPhase = 'discovery';
        return 'analyze_response';
        
      case 'multiple_problems_selection':
        return 'restate_selected_problem';
        
      case 'restate_selected_problem':
        return 'analyze_response';
        
      case 'analyze_response':
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
        // For now, always go to Problem Shifting (can be enhanced later for other methods)
        context.currentPhase = 'problem_shifting';
        return 'problem_shifting_intro';
        
      case 'check_if_still_problem':
        // Core cycling logic for Problem Shifting
        if (lastResponse.includes('yes') || lastResponse.includes('still')) {
          // Still a problem - cycle back to step 2
          context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
          return 'body_sensation_check';
        }
        if (lastResponse.includes('no') || lastResponse.includes('not')) {
          // No longer a problem - move to digging deeper
          context.currentPhase = 'digging_deeper';
          return 'digging_deeper_start';
        }
        break;
        
      case 'digging_deeper_start':
        // If user says "yes" or "maybe", ask them to restate the problem
        if (lastResponse.includes('yes') || lastResponse.includes('maybe')) {
          return 'restate_problem_future';
        }
        // If "no", continue to next digging deeper question
        if (lastResponse.includes('no')) {
          return currentStep.nextStep || null;
        }
        break;
        
      case 'restate_problem_future':
        // After restating the problem, continue with scenario check
        return 'scenario_check';
        
      case 'scenario_check':
      case 'anything_else_check':
        // If any digging deeper question is "yes", go back to asking for new problem
        if (lastResponse.includes('yes')) {
          context.currentPhase = 'discovery';
          return 'restate_selected_problem';
        }
        // If "no", continue to next digging deeper question or integration
        if (lastResponse.includes('no')) {
          if (context.currentStep === 'anything_else_check') {
            context.currentPhase = 'integration';
            return 'integration_start';
          }
          return currentStep.nextStep || null;
        }
        break;
        
      case 'session_complete':
        // Session is finished
        return null;
        
      default:
        // Default behavior - follow the nextStep
        return currentStep.nextStep || null;
    }
    
    // Default fallback
    return currentStep.nextStep || null;
  }

  private handlePhaseCompletion(context: TreatmentContext): ProcessingResult {
    // Check if this is truly session completion or just a phase transition
    if (context.currentStep === 'session_complete') {
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
} 