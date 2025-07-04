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
        scriptedResponse: this.getValidationPrompt(currentStep, validationResult.error)
      };
    }

    // Input is valid - proceed to next step
    const nextStepId = this.determineNextStep(currentStep, treatmentContext);
    if (nextStepId) {
      treatmentContext.currentStep = nextStepId;
      const nextStep = currentPhase.steps.find(s => s.id === nextStepId);
      
      if (nextStep) {
        const scriptedResponse = this.getScriptedResponse(nextStep, treatmentContext);
        return {
          canContinue: true,
          nextStep: nextStepId,
          scriptedResponse
        };
      }
    }

    // Phase complete or error
    return this.handlePhaseCompletion(treatmentContext);
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
    
    for (const trigger of step.aiTriggers) {
      switch (trigger.condition) {
        case 'userStuck':
          if (trimmed.length < 3 || 
              trimmed.toLowerCase().includes("i don't know") ||
              trimmed.toLowerCase().includes("not sure")) {
            return trigger;
          }
          break;
          
        case 'tooLong':
          if (trimmed.split(' ').length > (trigger.threshold || 20)) {
            return trigger;
          }
          break;
          
        case 'multipleProblems':
          const problemCount = (trimmed.match(/and|also|plus|additionally/gi) || []).length;
          if (problemCount > 1) {
            return trigger;
          }
          break;
          
        case 'offTopic':
          // Simple keyword-based detection - can be enhanced
          const offTopicKeywords = ['weather', 'politics', 'sports', 'food'];
          if (offTopicKeywords.some(keyword => trimmed.toLowerCase().includes(keyword))) {
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
    // Phase 1: Introduction
    this.phases.set('intro', {
      name: 'Introduction',
      maxDuration: 5,
      steps: [
        {
          id: 'welcome',
          scriptedResponse: "Welcome to your Mind Shifting session. I'm here to guide you through a powerful process that will help you transform limiting beliefs and problems into opportunities for growth. Are you ready to begin?",
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please respond with yes or no.' }
          ],
          nextStep: 'explain_process',
          aiTriggers: []
        },
        {
          id: 'explain_process',
          scriptedResponse: "Perfect! Here's how this works: I'll guide you through a series of questions and experiences designed to help you shift your perspective on a problem or limiting belief. Please be honest and open in your responses. What specific problem or challenge would you like to work on today?",
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 10, errorMessage: 'Please describe your problem in more detail.' },
            { type: 'maxLength', value: 200, errorMessage: 'Please keep your problem statement concise and focused.' }
          ],
          nextStep: 'confirm_problem',
          aiTriggers: [
            { condition: 'multipleProblems', action: 'focus' },
            { condition: 'tooLong', action: 'simplify' }
          ]
        },
        {
          id: 'confirm_problem',
          scriptedResponse: (userInput) => `Thank you for sharing that. So the problem you'd like to work on is: "${userInput || 'the issue you described'}". Is this correct, and are you ready to dive deeper into this?`,
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please confirm if this is the problem you want to work on.' }
          ],
          nextStep: 'preparation',
          aiTriggers: []
        }
      ]
    });

    // Phase 2: Problem Shifting (Core methodology)
    this.phases.set('problemShifting', {
      name: 'Problem Shifting',
      maxDuration: 20,
      steps: [
        {
          id: 'preparation',
          scriptedResponse: "Excellent. Now we're going to begin the Problem Shifting process. Please find a comfortable position, close your eyes, and keep them closed throughout this exercise. Take three deep breaths and let yourself relax. When you're ready, say 'ready'.",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please let me know when you\'re ready to continue.' }
          ],
          nextStep: 'feel_problem',
          aiTriggers: []
        },
        {
          id: 'feel_problem',
          scriptedResponse: (userInput, context) => {
            const problem = context?.userResponses?.['confirm_problem'] || context?.userResponses?.['explain_process'] || 'your problem';
            return `Good. Now, with your eyes closed, I want you to think about "${problem}". Feel this problem in your body. Where do you feel it? What does it feel like? Describe the physical sensation.`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 5, errorMessage: 'Please describe what you feel in your body when you think about this problem.' }
          ],
          nextStep: 'feeling_deeper',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'feeling_deeper',
          scriptedResponse: (userInput) => `Good. You feel "${userInput || 'that sensation'}". Now, go deeper. What happens in yourself when you feel "${userInput || 'that sensation'}"? What does that bring up for you?`,
          expectedResponseType: 'experience',
          validationRules: [
            { type: 'minLength', value: 5, errorMessage: 'Please explore what comes up when you feel this sensation.' }
          ],
          nextStep: 'shift_perspective',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'shift_perspective',
          scriptedResponse: (userInput) => `Interesting. You experience "${userInput || 'that feeling'}". Now I want you to consider something: What if this feeling, this experience, is not a problem but actually information? What if it's trying to tell you something important? What might that be?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 10, errorMessage: 'Please explore what this feeling might be trying to tell you.' }
          ],
          nextStep: 'new_perspective',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' },
            { condition: 'offTopic', action: 'redirect' }
          ]
        }
      ]
    });

    // Additional phases would be added here...
  }

  private getOrCreateContext(sessionId: string, context?: Partial<TreatmentContext>): TreatmentContext {
    if (!this.contexts.has(sessionId)) {
      this.contexts.set(sessionId, {
        userId: context?.userId || '',
        sessionId,
        currentPhase: 'intro',
        currentStep: 'welcome',
        userResponses: {},
        startTime: new Date(),
        lastActivity: new Date(),
        metadata: {}
      });
    }
    return this.contexts.get(sessionId)!;
  }

  private determineNextStep(currentStep: TreatmentStep, context: TreatmentContext): string | null {
    return currentStep.nextStep || null;
  }

  private handlePhaseCompletion(context: TreatmentContext): ProcessingResult {
    // Logic to handle phase transitions or session completion
    return {
      canContinue: false,
      reason: 'Phase completed',
      scriptedResponse: 'This phase of your treatment is complete. Well done!'
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