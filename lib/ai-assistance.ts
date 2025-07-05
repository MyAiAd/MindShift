import { AITrigger, TreatmentContext, TreatmentStep } from './treatment-state-machine';

export interface AIAssistanceRequest {
  trigger: AITrigger;
  userInput: string;
  context: TreatmentContext;
  currentStep: TreatmentStep;
}

export interface AIAssistanceResponse {
  message: string;
  shouldReturnToScript: boolean;
  suggestedNextStep?: string;
  tokenCount: number;
  cost: number;
}

export class AIAssistanceManager {
  private readonly MAX_TOKENS = 200; // Keep AI responses minimal
  private readonly TARGET_COST_PER_SESSION = 0.05; // $0.05 per session target
  private usageStats: Map<string, SessionUsage> = new Map();

  /**
   * Process AI assistance request - Only called for specific scenarios
   */
  async processAssistanceRequest(request: AIAssistanceRequest): Promise<AIAssistanceResponse> {
    // Track usage for cost control
    this.trackUsage(request.context.sessionId);
    
    // Check if session has exceeded AI usage limits
    if (this.hasExceededLimits(request.context.sessionId)) {
      return this.getFallbackResponse(request);
    }

    const prompt = this.buildMinimalPrompt(request);
    
    try {
      // This would integrate with your AI service (OpenAI, etc.)
      const aiResponse = await this.callAIService(prompt);
      
      this.updateUsageStats(request.context.sessionId, aiResponse.tokenCount, aiResponse.cost);
      
      return {
        message: this.formatAIResponse(aiResponse.content, request.trigger),
        shouldReturnToScript: true,
        tokenCount: aiResponse.tokenCount,
        cost: aiResponse.cost
      };
    } catch (error) {
      console.error('AI assistance failed:', error);
      return this.getFallbackResponse(request);
    }
  }

  /**
   * Build minimal, focused prompt for AI - strict context only
   */
  private buildMinimalPrompt(request: AIAssistanceRequest): string {
    const { trigger, userInput, context, currentStep } = request;
    
    const baseContext = `You are assisting with Mind Shifting treatment.
Current step: ${currentStep.id}
Expected response type: ${currentStep.expectedResponseType}
User said: "${userInput}"
Issue: ${trigger.condition}`;

    switch (trigger.action) {
      case 'clarify':
        return `${baseContext}

The user seems stuck or confused. Provide a brief, gentle clarification to help them understand what's being asked. Keep it under 30 words and guide them back to the treatment protocol. Do not deviate from the Mind Shifting methodology.`;

      case 'focus':
        return `${baseContext}

The user mentioned multiple problems. Help them focus on just one problem for this session. Ask them to choose the most pressing issue. Keep response under 25 words.`;

      case 'simplify':
        return `${baseContext}

The user's response was too long or complex. This is a 30-second interruption case. Use the exact Mind Shifting protocol: "I'm just going to stop you there because in order to apply a Mind Shifting method to this we need to define the problem, so please can you tell me what the problem is in a few words."`;

      case 'redirect':
        return `${baseContext}

The user went off-topic. Gently redirect them back to the current step of the treatment. Keep response under 15 words.`;

      default:
        return `${baseContext}

Provide brief guidance to help the user continue with the treatment. Keep response under 20 words.`;
    }
  }

  /**
   * Mock AI service call - replace with actual AI integration
   */
  private async callAIService(prompt: string): Promise<{ content: string; tokenCount: number; cost: number }> {
    // This would be replaced with actual OpenAI API call
    const simulatedResponse = this.getSimulatedAIResponse(prompt);
    
    return {
      content: simulatedResponse,
      tokenCount: Math.floor(prompt.length / 4) + Math.floor(simulatedResponse.length / 4), // Rough token estimation
      cost: 0.002 // Estimated cost per request
    };
  }

  /**
   * Simulated AI responses for development/testing
   */
  private getSimulatedAIResponse(prompt: string): string {
    if (prompt.includes('clarify')) {
      return "Take a moment to notice what you're feeling in your body right now. What physical sensation do you notice?";
    }
    if (prompt.includes('focus')) {
      return "Let's focus on just one problem for now. Which issue feels most important to you today?";
    }
    if (prompt.includes('simplify') || prompt.includes('30-second interruption')) {
      return "I'm just going to stop you there because in order to apply a Mind Shifting method to this we need to define the problem, so please can you tell me what the problem is in a few words.";
    }
    if (prompt.includes('redirect')) {
      return "Let's return to the current step. What are you feeling in your body?";
    }
    return "Please continue with the current step of the process.";
  }

  /**
   * Format AI response to maintain treatment consistency
   */
  private formatAIResponse(aiContent: string, trigger: AITrigger): string {
    const formatted = aiContent.trim();
    
    // Add context cue to return to script
    return `${formatted} Once you're ready, we'll continue with the process.`;
  }

  /**
   * Fallback response when AI is unavailable or limits exceeded
   */
  private getFallbackResponse(request: AIAssistanceRequest): AIAssistanceResponse {
    const fallbacks = {
      'clarify': "Take your time and describe what you notice. There's no right or wrong answer.",
      'focus': "Please choose one main problem to work on for this session.",
      'simplify': "I'm just going to stop you there because in order to apply a Mind Shifting method to this we need to define the problem, so please can you tell me what the problem is in a few words.",
      'redirect': "Let's focus on the current step of the process."
    };

    return {
      message: fallbacks[request.trigger.action] || "Please continue with the current step.",
      shouldReturnToScript: true,
      tokenCount: 0,
      cost: 0
    };
  }

  /**
   * Track AI usage for cost control
   */
  private trackUsage(sessionId: string): void {
    if (!this.usageStats.has(sessionId)) {
      this.usageStats.set(sessionId, {
        aiCallCount: 0,
        totalTokens: 0,
        totalCost: 0,
        sessionStart: new Date()
      });
    }
    
    const usage = this.usageStats.get(sessionId)!;
    usage.aiCallCount++;
  }

  /**
   * Check if session has exceeded AI usage limits
   */
  private hasExceededLimits(sessionId: string): boolean {
    const usage = this.usageStats.get(sessionId);
    if (!usage) return false;

    // Limit: No more than 3 AI calls per session (keeping it at 5% of interactions)
    if (usage.aiCallCount >= 3) return true;
    
    // Limit: No more than $0.05 cost per session
    if (usage.totalCost >= this.TARGET_COST_PER_SESSION) return true;
    
    return false;
  }

  /**
   * Update usage statistics
   */
  private updateUsageStats(sessionId: string, tokens: number, cost: number): void {
    const usage = this.usageStats.get(sessionId);
    if (usage) {
      usage.totalTokens += tokens;
      usage.totalCost += cost;
    }
  }

  /**
   * Get usage statistics for monitoring
   */
  getUsageStats(sessionId: string): SessionUsage | null {
    return this.usageStats.get(sessionId) || null;
  }

  /**
   * Get overall system statistics
   */
  getSystemStats(): SystemStats {
    const sessions = Array.from(this.usageStats.values());
    const totalSessions = sessions.length;
    const sessionsWithAI = sessions.filter(s => s.aiCallCount > 0).length;
    const avgAIUsagePercent = totalSessions > 0 ? (sessionsWithAI / totalSessions) * 100 : 0;
    
    return {
      totalSessions,
      sessionsWithAI,
      aiUsagePercentage: avgAIUsagePercent,
      avgCostPerSession: sessions.reduce((sum, s) => sum + s.totalCost, 0) / totalSessions || 0,
      avgTokensPerSession: sessions.reduce((sum, s) => sum + s.totalTokens, 0) / totalSessions || 0
    };
  }
}

interface SessionUsage {
  aiCallCount: number;
  totalTokens: number;
  totalCost: number;
  sessionStart: Date;
}

interface SystemStats {
  totalSessions: number;
  sessionsWithAI: number;
  aiUsagePercentage: number;
  avgCostPerSession: number;
  avgTokensPerSession: number;
} 