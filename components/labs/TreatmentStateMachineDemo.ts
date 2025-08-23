import { TreatmentStateMachine, TreatmentContext, ProcessingResult } from '@/lib/treatment-state-machine';

/**
 * Demo-safe wrapper around TreatmentStateMachine
 * Provides all the real treatment logic, validation, and AI triggers
 * but prevents any database writes to keep it isolated
 */
export class TreatmentStateMachineDemo {
  private stateMachine: TreatmentStateMachine;
  private demoSessionId: string;

  constructor() {
    this.stateMachine = new TreatmentStateMachine();
    this.demoSessionId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize a demo treatment session
   */
  async initializeSession(modality: string, initialInput?: string): Promise<ProcessingResult> {
    // Create initial context based on modality
    const initialContext: Partial<TreatmentContext> = {
      userId: 'demo_user',
      sessionId: this.demoSessionId,
      currentPhase: this.getInitialPhase(modality),
      currentStep: this.getInitialStep(modality),
      userResponses: {},
      startTime: new Date(),
      lastActivity: new Date(),
      metadata: {
        cycleCount: 0,
        problemStatement: '',
        lastResponse: '',
        workType: this.getWorkType(modality),
        selectedMethod: modality
      }
    };

    // Initialize with the state machine
    if (initialInput) {
      return await this.processUserInput(initialInput, initialContext);
    } else {
      return await this.processUserInput('start', initialContext);
    }
  }

  /**
   * Process user input using the real state machine
   * This provides all validation, AI triggers, and routing logic
   */
  async processUserInput(userInput: string, contextOverrides?: Partial<TreatmentContext>): Promise<ProcessingResult> {
    try {
      // Override database operations to prevent writes
      const originalSaveMethod = (this.stateMachine as any).saveContextToDatabase;
      (this.stateMachine as any).saveContextToDatabase = async () => {
        // No-op for demo - prevent database writes
        return Promise.resolve();
      };

      // Process with real state machine
      const result = await this.stateMachine.processUserInput(
        this.demoSessionId,
        userInput,
        contextOverrides,
        false // Don't bypass validation - we want full guardrails
      );

      // Restore original method (though it won't be used in demo)
      (this.stateMachine as any).saveContextToDatabase = originalSaveMethod;

      return result;
    } catch (error) {
      console.error('Demo state machine error:', error);
      // Return fallback response on error
      return {
        canContinue: true,
        scriptedResponse: "I'm having trouble processing that. Could you try rephrasing your response?",
        reason: 'processing_error'
      };
    }
  }

  /**
   * Get the current context for the demo session
   */
  getCurrentContext(): TreatmentContext | null {
    try {
      return this.stateMachine.getContextForUndo(this.demoSessionId);
    } catch (error) {
      return null;
    }
  }

  /**
   * Reset the demo session
   */
  resetSession(): void {
    // Clear the context from the state machine
    (this.stateMachine as any).contexts.delete(this.demoSessionId);
    // Generate new session ID
    this.demoSessionId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get validation assistance using the real AI assistance system
   */
  async getValidationAssistance(
    userInput: string,
    validationType: string,
    context: TreatmentContext,
    currentStep: any
  ): Promise<any> {
    // Use the real AI assistance for validation
    const { AIAssistanceManager } = await import('@/lib/ai-assistance');
    const aiManager = new AIAssistanceManager();
    
    return await aiManager.processValidationAssistance({
      userInput,
      validationType: validationType as any,
      context,
      currentStep
    });
  }

  /**
   * Get AI assistance using the real system
   */
  async getAIAssistance(
    trigger: any,
    userInput: string,
    context: TreatmentContext,
    currentStep: any
  ): Promise<any> {
    const { AIAssistanceManager } = await import('@/lib/ai-assistance');
    const aiManager = new AIAssistanceManager();
    
    return await aiManager.processAssistanceRequest({
      trigger,
      userInput,
      context,
      currentStep
    });
  }

  /**
   * Get linguistic interpretation using the real system
   */
  async getLinguisticInterpretation(
    scriptedResponse: string,
    userInput: string,
    stepId: string,
    sessionId: string
  ): Promise<any> {
    const { AIAssistanceManager } = await import('@/lib/ai-assistance');
    const aiManager = new AIAssistanceManager();
    
    return await aiManager.processLinguisticInterpretation(
      scriptedResponse,
      userInput,
      stepId,
      sessionId
    );
  }

  /**
   * Helper methods to map modalities to phases/steps
   */
  private getInitialPhase(modality: string): string {
    switch (modality) {
      case 'problem_shifting':
      case 'identity_shifting':
      case 'belief_shifting':
      case 'blockage_shifting':
        return 'introduction';
      case 'reality_shifting':
        return 'reality_shifting';
      case 'trauma_shifting':
        return 'trauma_shifting';
      default:
        return 'introduction';
    }
  }

  private getInitialStep(modality: string): string {
    switch (modality) {
      case 'problem_shifting':
      case 'identity_shifting':
      case 'belief_shifting':
      case 'blockage_shifting':
        return 'mind_shifting_explanation';
      case 'reality_shifting':
        return 'reality_goal_capture';
      case 'trauma_shifting':
        return 'trauma_shifting_intro';
      default:
        return 'mind_shifting_explanation';
    }
  }

  private getWorkType(modality: string): string {
    switch (modality) {
      case 'reality_shifting':
        return 'goal';
      case 'trauma_shifting':
        return 'negative_experience';
      default:
        return 'problem';
    }
  }
} 