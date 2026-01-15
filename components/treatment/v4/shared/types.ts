export interface TreatmentMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  responseTime?: number;
  usedAI?: boolean;
  metadata?: any;
  version?: 'v3' | 'v4'; // V3/V4 specific
  // Audio/Text timing metrics (for lag diagnosis)
  textRenderTime?: number;      // Time when text was rendered (ms from response start)
  audioStartTime?: number;       // Time when audio started playing (ms from response start)
  audioCompleteTime?: number;    // Time when audio completed (ms from response start)
}

export interface TreatmentSessionProps {
  sessionId: string;
  userId: string;
  shouldResume?: boolean;
  onComplete?: (sessionData: any) => void;
  onError?: (error: string) => void;
  version?: 'v3' | 'v4'; // V3/V4 specific
}

export interface SessionStats {
  totalResponses: number;
  avgResponseTime: number;
  aiUsagePercent: number;
  version?: 'v3' | 'v4'; // V3/V4 specific
}

export interface PerformanceMetrics {
  cacheHitRate: number;
  averageResponseTime: number;
  preloadedResponsesUsed: number;
  totalResponses: number;
  // V3 specific enhancements
  validationAccuracy?: number;
  stateTransitionTime?: number;
  memoryUsage?: number;
}

export interface StepHistoryEntry {
  messages: TreatmentMessage[];
  currentStep: string;
  userInput: string;
  sessionStats: SessionStats;
  timestamp: number;
  version?: 'v3' | 'v4'; // V3/V4 specific
}

export interface ModalityComponentProps {
  sessionId: string;
  userId: string;
  messages: TreatmentMessage[];
  currentStep: string;
  isLoading: boolean;
  sessionStats: SessionStats;
  performanceMetrics: PerformanceMetrics;
  stepHistory: StepHistoryEntry[];
  voice: any; // Voice system interface
  onSendMessage: (content: string) => Promise<void>;
  onUndo: () => Promise<void>;
  userInput: string;
  setUserInput: (input: string) => void;
  selectedWorkType: string | null;
  clickedButton: string | null;
  version?: 'v3' | 'v4'; // V3/V4 specific
}

export interface GuardrailsProps {
  currentStep: string;
  messages: TreatmentMessage[];
  lastBotMessage?: TreatmentMessage;
  version?: 'v3' | 'v4'; // V3/V4 specific
}

export interface DiggingDeeperProps extends ModalityComponentProps {
  modalityType: 'problem' | 'identity' | 'belief' | 'blockage' | 'reality' | 'trauma';
}

export interface IntegrationProps extends ModalityComponentProps {
  modalityType: 'problem' | 'identity' | 'belief' | 'blockage' | 'reality' | 'trauma';
}

// V3/V4 specific interfaces
export interface V3TreatmentContext {
  sessionId: string;
  userId: string;
  currentPhase: string;
  currentStep: string;
  userResponses: Record<string, string>;
  problemStatement?: string;
  startTime: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
  version: 'v3' | 'v4';
}

export interface V3ProcessingResult {
  canContinue: boolean;
  nextStep?: string;
  scriptedResponse?: string;
  needsLinguisticProcessing?: boolean;
  requiresRetry?: boolean;
  reason?: string;
  triggeredAI?: boolean;
  needsAIAssistance?: {
    trigger: any;
    context: string;
    userInput: string;
  };
  metadata?: {
    phase: string;
    step: string;
    userInput: string;
    version: 'v3' | 'v4';
  };
}

export interface V3ValidationResult {
  isValid: boolean;
  error?: string;
  confidence?: number;
  suggestions?: string[];
  version: 'v3' | 'v4';
} 