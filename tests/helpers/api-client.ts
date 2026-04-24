import { APIRequestContext } from '@playwright/test';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

export interface TreatmentResponse {
  success: boolean;
  sessionId: string;
  message: string;
  currentStep: string;
  responseTime: number;
  usedAI: boolean;
  version?: string;
  expectedResponseType?: string;
  canContinue?: boolean;
  aiCost?: number;
  aiTokens?: number;
  metadata?: Record<string, any>;
  error?: string;
  details?: string;
}

export interface ResumeResponse {
  success: boolean;
  sessionId: string;
  currentStep: string;
  currentPhase: string;
  messages: Array<{ role: string; content: string }>;
  isExistingSession: boolean;
}

/**
 * Extract the authenticated user's Supabase ID from the saved storage state.
 * The Supabase auth token is a JWT stored in cookies or localStorage.
 */
export function getAuthUserId(): string | null {
  const storageStatePath = path.join(__dirname, '../.auth/storage-state.json');
  if (!fs.existsSync(storageStatePath)) return null;

  try {
    const state = JSON.parse(fs.readFileSync(storageStatePath, 'utf-8'));

    // Check localStorage origins for Supabase auth token
    for (const origin of state.origins || []) {
      for (const entry of origin.localStorage || []) {
        if (entry.name?.includes('auth-token') || entry.name?.includes('supabase')) {
          try {
            const parsed = JSON.parse(entry.value);
            // Supabase stores { access_token, user: { id } } or similar
            if (parsed?.user?.id) return parsed.user.id;
            if (parsed?.currentSession?.user?.id) return parsed.currentSession.user.id;
          } catch { /* not JSON, skip */ }
        }
      }
    }

    // Fallback: decode JWT from auth cookie
    for (const cookie of state.cookies || []) {
      if (cookie.name?.includes('auth-token') && cookie.value) {
        try {
          // JWT is base64url-encoded, second part is payload
          const parts = cookie.value.split('.');
          if (parts.length >= 2) {
            const payload = JSON.parse(
              Buffer.from(parts[1], 'base64url').toString('utf-8')
            );
            if (payload.sub) return payload.sub;
          }
        } catch { /* not a JWT, skip */ }
      }
    }
  } catch { /* file parse error */ }

  return null;
}

export class TreatmentApiClient {
  private request: APIRequestContext;
  private endpoint: string;
  readonly sessionId: string;
  readonly userId: string;
  private history: Array<{ input: string; response: TreatmentResponse }> = [];

  constructor(
    request: APIRequestContext,
    endpoint:
      | '/api/treatment-v2'
      | '/api/treatment-v4'
      | '/api/treatment-v5'
      | '/api/treatment-v6'
      | '/api/treatment-v7'
      | '/api/treatment-v9',
    options?: { sessionId?: string; userId?: string }
  ) {
    this.request = request;
    this.endpoint = endpoint;
    this.sessionId = options?.sessionId || randomUUID();
    // Use the real authenticated user ID so the live server accepts the requests
    this.userId = options?.userId || getAuthUserId() || `test-user-${randomUUID()}`;
  }

  get version(): string {
    if (this.endpoint.includes('v9')) return 'v9';
    if (this.endpoint.includes('v7')) return 'v7';
    if (this.endpoint.includes('v6')) return 'v6';
    if (this.endpoint.includes('v5')) return 'v5';
    if (this.endpoint.includes('v4')) return 'v4';
    return 'v2';
  }

  get conversationHistory(): Array<{ input: string; response: TreatmentResponse }> {
    return [...this.history];
  }

  get lastResponse(): TreatmentResponse | undefined {
    return this.history[this.history.length - 1]?.response;
  }

  private async post(body: Record<string, any>): Promise<TreatmentResponse> {
    const resp = await this.request.post(this.endpoint, { data: body });
    const json = await resp.json();

    if (!resp.ok()) {
      throw new Error(
        `${this.version} API ${body.action} failed (${resp.status()}): ${JSON.stringify(json)}`
      );
    }

    return json as TreatmentResponse;
  }

  async start(): Promise<TreatmentResponse> {
    const response = await this.post({
      sessionId: this.sessionId,
      userId: this.userId,
      action: 'start',
    });
    this.history.push({ input: 'start', response });
    return response;
  }

  async continue(userInput: string): Promise<TreatmentResponse> {
    const response = await this.post({
      sessionId: this.sessionId,
      userId: this.userId,
      action: 'continue',
      userInput,
    });
    this.history.push({ input: userInput, response });
    return response;
  }

  async resume(): Promise<ResumeResponse> {
    const resp = await this.request.post(this.endpoint, {
      data: {
        sessionId: this.sessionId,
        userId: this.userId,
        action: 'resume',
      },
    });
    return (await resp.json()) as ResumeResponse;
  }

  async undo(undoToStep: string): Promise<TreatmentResponse> {
    return this.post({
      sessionId: this.sessionId,
      userId: this.userId,
      action: 'undo',
      undoToStep,
    });
  }

  /**
   * Run a full sequence of inputs, returning all responses.
   * Useful for replaying a test flow in one call.
   */
  async runFlow(
    inputs: string[],
    options?: { startFirst?: boolean }
  ): Promise<TreatmentResponse[]> {
    const results: TreatmentResponse[] = [];

    if (options?.startFirst !== false) {
      results.push(await this.start());
    }

    for (const input of inputs) {
      results.push(await this.continue(input));
    }

    return results;
  }
}

/**
 * Create a matched pair of v2 + v4 clients sharing the same userId
 * but distinct sessionIds (each version gets its own session).
 * Uses the real authenticated user ID from the saved auth state.
 */
export function createParityPair(request: APIRequestContext) {
  const userId = getAuthUserId() || `test-parity-${randomUUID()}`;
  const v2 = new TreatmentApiClient(request, '/api/treatment-v2', { userId });
  const v4 = new TreatmentApiClient(request, '/api/treatment-v4', { userId });
  return { v2, v4, userId };
}

/**
 * Create a matched pair of v2 + v5 clients for parity testing.
 * V2 is the medical gold standard; V5 is the candidate under test.
 */
export function createParityPairV2V5(request: APIRequestContext) {
  const userId = getAuthUserId() || `test-parity-${randomUUID()}`;
  const v2 = new TreatmentApiClient(request, '/api/treatment-v2', { userId });
  const v5 = new TreatmentApiClient(request, '/api/treatment-v5', { userId });
  return { v2, v5, userId };
}

/**
 * Create a matched pair of v2 + v6 clients for parity testing.
 * V2 is the medical gold standard; V6 is the candidate under test.
 */
export function createParityPairV2V6(request: APIRequestContext) {
  const userId = getAuthUserId() || `test-parity-${randomUUID()}`;
  const v2 = new TreatmentApiClient(request, '/api/treatment-v2', { userId });
  const v6 = new TreatmentApiClient(request, '/api/treatment-v6', { userId });
  return { v2, v6, userId };
}

/**
 * Create a matched pair of v2 + v7 clients for parity testing.
 * V2 is the medical gold standard; V7 is the candidate under test.
 */
export function createParityPairV2V7(request: APIRequestContext) {
  const userId = getAuthUserId() || `test-parity-${randomUUID()}`;
  const v2 = new TreatmentApiClient(request, '/api/treatment-v2', { userId });
  const v7 = new TreatmentApiClient(request, '/api/treatment-v7', { userId });
  return { v2, v7, userId };
}

/**
 * Create a matched pair of v2 + v9 clients for parity testing.
 *
 * V9 is a voice wrapper around V2's state machine. The two routes MUST emit
 * byte-identical `message` text for every turn. Any divergence is a bug in
 * the V9 route adapter, not in V2.
 */
export function createParityPairV2V9(request: APIRequestContext) {
  const userId = getAuthUserId() || `test-parity-${randomUUID()}`;
  const v2 = new TreatmentApiClient(request, '/api/treatment-v2', { userId });
  const v9 = new TreatmentApiClient(request, '/api/treatment-v9', { userId });
  return { v2, v9, userId };
}
