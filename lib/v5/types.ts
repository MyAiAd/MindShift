export interface TreatmentPhase {
  name: string;
  steps: TreatmentStep[];
  maxDuration: number; // in minutes
}

export interface TreatmentStep {
  id: string;
  scriptedResponse: string | ((userInput?: string | undefined, context?: any) => string);
  expectedResponseType: 'feeling' | 'problem' | 'experience' | 'yesno' | 'open' | 'goal' | 'selection' | 'description' | 'auto';
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
  expectedResponseType?: 'feeling' | 'problem' | 'experience' | 'yesno' | 'open' | 'goal' | 'selection' | 'description' | 'auto';
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

// Response caching interfaces for performance optimization
export interface CachedResponse {
  response: string;
  timestamp: number;
  stepId: string;
  contextHash: string; // Simple hash of relevant context
}

export interface ResponseCache {
  cache: Map<string, CachedResponse>;
  hitCount: number;
  missCount: number;
  preloadedResponses: Set<string>;
}

// Performance metrics tracking
export interface PerformanceMetrics {
  cacheHitRate: number;
  averageResponseTime: number;
  preloadedResponsesUsed: number;
  totalResponses: number;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface GoalLanguageDetection {
  hasGoalLanguage: boolean;
  matchedIndicator: string;
  confidence: number;
}

export interface QuestionLanguageDetection {
  hasQuestionLanguage: boolean;
  matchedIndicator: string;
  confidence: number;
}

export interface DeadlineDetection {
  hasDeadline: boolean;
  deadline?: string;
  synthesizedGoal?: string;
  confidence: number;
}
