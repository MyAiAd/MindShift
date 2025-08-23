// Client-safe interfaces that match the server-side types
interface TreatmentContext {
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

interface ProcessingResult {
  canContinue: boolean;
  nextStep?: string;
  reason?: string;
  triggeredAI?: boolean;
  scriptedResponse?: string;
  needsLinguisticProcessing?: boolean;
  needsAIAssistance?: {
    trigger: any;
    context: string;
    userInput: string;
  };
}

/**
 * Client-safe treatment state machine demo
 * Uses API calls to process treatment logic server-side
 * while maintaining all validation and guardrails
 */
export class TreatmentStateMachineDemo {
  private demoSessionId: string;
  private currentContext: TreatmentContext | null = null;

  constructor() {
    this.demoSessionId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize a demo treatment session
   */
  async initializeSession(modality: string, initialInput?: string): Promise<ProcessingResult> {
    try {
      const response = await fetch('/api/labs/treatment-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'initialize',
          sessionId: this.demoSessionId,
          modality,
          initialInput
        })
      });

      if (!response.ok) {
        throw new Error('Failed to initialize session');
      }

      const result = await response.json();
      if (result.context) {
        this.currentContext = result.context;
      }
      
      return result.processingResult || {
        canContinue: true,
        scriptedResponse: `Welcome to ${modality} treatment demo. This is a safe environment using real treatment logic.`
      };
    } catch (error) {
      console.error('Failed to initialize demo session:', error);
      return {
        canContinue: true,
        scriptedResponse: "Welcome to the treatment demo. Let's begin by telling me what you'd like to work on.",
        reason: 'initialization_error'
      };
    }
  }

  /**
   * Process user input using the real state machine via API
   */
  async processUserInput(userInput: string, contextOverrides?: Partial<TreatmentContext>): Promise<ProcessingResult> {
    try {
      const response = await fetch('/api/labs/treatment-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process',
          sessionId: this.demoSessionId,
          userInput,
          contextOverrides
        })
      });

      if (!response.ok) {
        throw new Error('Failed to process input');
      }

      const result = await response.json();
      if (result.context) {
        this.currentContext = result.context;
      }
      
      return result.processingResult || {
        canContinue: true,
        scriptedResponse: "Thank you for your response. Let's continue.",
        reason: 'processing_error'
      };
    } catch (error) {
      console.error('Failed to process user input:', error);
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
    return this.currentContext;
  }

  /**
   * Reset the demo session
   */
  resetSession(): void {
    this.demoSessionId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentContext = null;
  }

} 