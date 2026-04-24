/**
 * V9 frontend shared types.
 *
 * Parallels components/treatment/v7/shared/types.ts but is intentionally
 * minimal. V9 is text-plus-voice: the only visible difference from v7
 * at the UI layer is that v9 does not port v7's shortened INITIAL_WELCOME
 * hack (that was the cause of the UI / backend step mismatch).
 */

export type V9TreatmentVersion = 'v9';

export interface V9TreatmentMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  responseTime?: number;
  usedAI?: boolean;
  metadata?: unknown;
  version?: V9TreatmentVersion;
}

export interface V9TreatmentSessionProps {
  sessionId: string;
  userId: string;
  shouldResume?: boolean;
  onComplete?: (sessionData: unknown) => void;
  onError?: (error: string) => void;
}

export interface V9SessionStats {
  totalResponses: number;
  avgResponseTime: number;
  aiUsagePercent: number;
}

export interface V9ApiResponse {
  success: boolean;
  sessionId: string;
  message?: string;
  currentStep?: string;
  responseTime?: number;
  usedAI?: boolean;
  requiresRetry?: boolean;
}
