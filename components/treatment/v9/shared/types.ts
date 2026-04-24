/**
 * V9 frontend shared types.
 *
 * Parallels `components/treatment/v7/shared/types.ts`. V9 is the voice
 * clone of V2 — the client shell is a port of V7's, so the shared shapes
 * are kept byte-compatible so the ported component just compiles.
 *
 * Unlike V7, V9 must NEVER substitute `INITIAL_WELCOME` in the first
 * assistant message — the V9 client renders exactly what the V9 backend
 * (which delegates to V2's state machine) returns. See R7 of
 * `docs/prd-v9-ux-restoration.md`.
 */

export type V9TreatmentVersion = 'v9';

// Compatibility alias: the ported V7 component imports `TreatmentMessage`
// from `./shared/types`. Structure matches V7's so the port is mechanical.
export interface TreatmentMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  responseTime?: number;
  usedAI?: boolean;
  metadata?: any;
  version?: 'v9';
  textRenderTime?: number;
  audioStartTime?: number;
  audioCompleteTime?: number;
}

export interface TreatmentSessionProps {
  sessionId: string;
  userId: string;
  shouldResume?: boolean;
  onComplete?: (sessionData: any) => void;
  onError?: (error: string) => void;
  version?: 'v9';
}

export interface SessionStats {
  totalResponses: number;
  avgResponseTime: number;
  aiUsagePercent: number;
  version?: 'v9';
}

export interface PerformanceMetrics {
  cacheHitRate: number;
  averageResponseTime: number;
  preloadedResponsesUsed: number;
  totalResponses: number;
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
  version?: 'v9';
  expectedResponseType?: string | null;
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
  voice: any;
  onSendMessage: (content: string) => Promise<void>;
  onUndo: () => Promise<void>;
  userInput: string;
  setUserInput: (input: string) => void;
  selectedWorkType: string | null;
  clickedButton: string | null;
  version?: 'v9';
}

export interface GuardrailsProps {
  currentStep: string;
  messages: TreatmentMessage[];
  lastBotMessage?: TreatmentMessage;
  version?: 'v9';
}

export interface DiggingDeeperProps extends ModalityComponentProps {
  modalityType: 'problem' | 'identity' | 'belief' | 'blockage' | 'reality' | 'trauma';
}

export interface IntegrationProps extends ModalityComponentProps {
  modalityType: 'problem' | 'identity' | 'belief' | 'blockage' | 'reality' | 'trauma';
}

// V9 treatment context (matches V3 shape used across versions).
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
  version: 'v9';
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
    version: 'v9';
  };
}

export interface V3ValidationResult {
  isValid: boolean;
  error?: string;
  confidence?: number;
  suggestions?: string[];
  version: 'v9';
}

// ---------------------------------------------------------------
// Legacy V9-prefixed aliases. Kept so any code that already imports
// `V9TreatmentMessage` / `V9TreatmentSessionProps` / `V9SessionStats` /
// `V9ApiResponse` continues to compile. New code should import the
// un-prefixed names above for symmetry with V7's shared/types.ts.
// ---------------------------------------------------------------
export type V9TreatmentMessage = TreatmentMessage;
export type V9TreatmentSessionProps = TreatmentSessionProps;
export type V9SessionStats = SessionStats;

export interface V9ApiResponse {
  success: boolean;
  sessionId: string;
  message?: string;
  currentStep?: string;
  responseTime?: number;
  usedAI?: boolean;
  requiresRetry?: boolean;
  voicePair?: {
    stt: string;
    tts: string;
  };
}
