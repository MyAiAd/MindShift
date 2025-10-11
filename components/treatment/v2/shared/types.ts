export interface TreatmentMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  responseTime?: number;
  usedAI?: boolean;
  metadata?: any;
}

export interface TreatmentSessionProps {
  sessionId: string;
  userId: string;
  shouldResume?: boolean;
  onComplete?: (sessionData: any) => void;
  onError?: (error: string) => void;
}

export interface SessionStats {
  totalResponses: number;
  avgResponseTime: number;
  aiUsagePercent: number;
}

export interface PerformanceMetrics {
  cacheHitRate: number;
  averageResponseTime: number;
  preloadedResponsesUsed: number;
  totalResponses: number;
}

export interface StepHistoryEntry {
  messages: TreatmentMessage[];
  currentStep: string;
  userInput: string;
  sessionStats: SessionStats;
  timestamp: number;
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
  setSessionMethod?: (method: string) => void; // For setting active modality
}

export interface GuardrailsProps {
  currentStep: string;
  messages: TreatmentMessage[];
  lastBotMessage?: TreatmentMessage;
}

export interface DiggingDeeperProps extends ModalityComponentProps {
  modalityType: 'problem' | 'identity' | 'belief' | 'blockage' | 'reality' | 'trauma';
  sessionMethod?: string; // Tracks active modality to prevent multiple button renders
}

export interface IntegrationProps extends ModalityComponentProps {
  modalityType: 'problem' | 'identity' | 'belief' | 'blockage' | 'reality' | 'trauma';
} 