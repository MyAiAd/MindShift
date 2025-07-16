// ===============================================
// REUSABLE MYAI TEMPLATE - AI SERVICE
// ===============================================
// Centralized AI service using configuration system

import OpenAI from 'openai';
import config, { isFeatureEnabled } from '@/lib/config';

// OpenAI client singleton
let openaiInstance: OpenAI | null = null;

const getOpenAI = (): OpenAI => {
  if (!config.ai.openaiApiKey) {
    throw new Error('OpenAI API key is required for AI features. Please set OPENAI_API_KEY in your environment variables.');
  }
  
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: config.ai.openaiApiKey,
    });
  }
  
  return openaiInstance;
};

// AI service interfaces
export interface AITrigger {
  type: 'user_stuck' | 'needs_clarification' | 'multiple_problems' | 'too_long' | 'off_topic';
  reason: string;
  context?: any;
}

export interface AIAssistanceRequest {
  trigger: AITrigger;
  userInput: string;
  context: any;
  expectedResponseType?: string;
}

export interface AIAssistanceResponse {
  response: string;
  confidence: number;
  tokens: number;
  cost: number;
  metadata?: any;
}

// AI assistance manager
export class AIAssistanceManager {
  private openai: OpenAI;
  private totalTokens: number = 0;
  private totalCost: number = 0;
  private requestCount: number = 0;

  constructor() {
    if (!isFeatureEnabled('treatmentSessions')) {
      throw new Error('Treatment sessions feature is disabled');
    }
    
    this.openai = getOpenAI();
  }

  async processAssistanceRequest(request: AIAssistanceRequest): Promise<AIAssistanceResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(request.trigger, request.context);
      const userPrompt = this.buildUserPrompt(request.userInput, request.trigger);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 200,
        temperature: 0.3,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const response = completion.choices[0]?.message?.content || '';
      const tokens = completion.usage?.total_tokens || 0;
      const cost = this.calculateCost(tokens);

      // Update usage tracking
      this.totalTokens += tokens;
      this.totalCost += cost;
      this.requestCount++;

      return {
        response,
        confidence: 0.85, // Default confidence
        tokens,
        cost,
        metadata: {
          model: 'gpt-4o-mini',
          trigger: request.trigger.type,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('AI assistance request failed:', error);
      throw new Error('AI assistance unavailable. Please try again.');
    }
  }

  private buildSystemPrompt(trigger: AITrigger, context: any): string {
    const basePrompt = `You are an AI assistant for the Mind Shifting protocol. You must ONLY provide responses that help users continue the exact treatment process. You are NOT a therapist or counselor.

Protocol Context:
- Current Phase: ${context.currentPhase || 'Unknown'}
- Current Step: ${context.currentStep || 'Unknown'}
- Problem Statement: ${context.problemStatement || 'Not set'}

CRITICAL RULES:
1. Keep responses under 30 words
2. Guide users back to the exact protocol steps
3. Use only the doctor's exact words when possible
4. Never provide therapy or counseling advice
5. Never diagnose or treat conditions`;

    switch (trigger.type) {
      case 'user_stuck':
        return basePrompt + `\n\nThe user seems stuck. Provide gentle encouragement to continue with the process.`;
      
      case 'needs_clarification':
        return basePrompt + `\n\nThe user needs clarification about the current step. Explain what's expected in simple terms.`;
      
      case 'multiple_problems':
        return basePrompt + `\n\nThe user mentioned multiple problems. Ask them to choose one specific problem to work on.`;
      
      case 'too_long':
        return basePrompt + `\n\nThe user's response was too long. Ask them to be more concise and focus on the specific question.`;
      
      case 'off_topic':
        return basePrompt + `\n\nThe user went off-topic. Gently redirect them back to the current treatment step.`;
      
      default:
        return basePrompt + `\n\nProvide appropriate guidance for the current situation.`;
    }
  }

  private buildUserPrompt(userInput: string, trigger: AITrigger): string {
    return `User Input: "${userInput}"\n\nTrigger: ${trigger.type}\nReason: ${trigger.reason}\n\nProvide a brief, helpful response to guide the user back to the protocol.`;
  }

  private calculateCost(tokens: number): number {
    // GPT-4o-mini pricing (as of 2024)
    const costPerToken = 0.00015 / 1000; // $0.00015 per 1K tokens
    return tokens * costPerToken;
  }

  // Usage tracking
  getUsageStats() {
    return {
      totalTokens: this.totalTokens,
      totalCost: this.totalCost,
      requestCount: this.requestCount,
      averageTokensPerRequest: this.requestCount > 0 ? this.totalTokens / this.requestCount : 0,
      averageCostPerRequest: this.requestCount > 0 ? this.totalCost / this.requestCount : 0
    };
  }

  // Reset usage tracking
  resetUsageStats() {
    this.totalTokens = 0;
    this.totalCost = 0;
    this.requestCount = 0;
  }
}

// General AI utilities
export class AIUtilities {
  private openai: OpenAI;

  constructor() {
    this.openai = getOpenAI();
  }

  async generateInsight(userInput: string, context: any): Promise<string> {
    if (!isFeatureEnabled('analytics')) {
      throw new Error('Analytics feature is disabled');
    }

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Generate a brief, encouraging insight based on the user\'s progress. Keep it under 50 words.'
        },
        {
          role: 'user',
          content: `User input: ${userInput}\nContext: ${JSON.stringify(context)}`
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    });

    return completion.choices[0]?.message?.content || '';
  }

  async summarizeSession(sessionData: any): Promise<string> {
    if (!isFeatureEnabled('analytics')) {
      throw new Error('Analytics feature is disabled');
    }

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Summarize this treatment session in 2-3 sentences. Focus on progress and outcomes.'
        },
        {
          role: 'user',
          content: JSON.stringify(sessionData)
        }
      ],
      max_tokens: 150,
      temperature: 0.5
    });

    return completion.choices[0]?.message?.content || '';
  }
}

// Service instances
export const aiAssistanceManager = new AIAssistanceManager();
export const aiUtilities = new AIUtilities();

// Configuration validation
export const validateAIConfig = () => {
  const errors: string[] = [];
  
  if (isFeatureEnabled('treatmentSessions') && !config.ai.openaiApiKey) {
    errors.push('OPENAI_API_KEY is required when treatment sessions are enabled');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Export configuration info
export const getAIConfig = () => {
  return {
    hasApiKey: !!config.ai.openaiApiKey,
    treatmentSessionsEnabled: isFeatureEnabled('treatmentSessions'),
    analyticsEnabled: isFeatureEnabled('analytics'),
    environment: config.deployment.nodeEnv
  };
}; 