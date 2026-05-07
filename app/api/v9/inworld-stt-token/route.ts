import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import crypto from 'crypto';

export const runtime = 'nodejs';

/**
 * GET /api/v9/inworld-stt-token
 *
 * Issues a short-lived authentication token for the Inworld STT realtime
 * WebSocket.  The browser uses this token to authenticate with the
 * server-side WebSocket proxy at /api/v9/inworld-stt-ws, which in turn
 * opens a backend socket to wss://api.inworld.ai/v1/stt/transcribe:stream
 * using the INWORLD_API_KEY.  The key is never sent to the browser.
 *
 * Two paths (documented per PRD US-006 open question):
 *
 *   Path A — Inworld has a token-issuance endpoint:
 *     If POST https://api.inworld.ai/v1/stt/sessions returns a short-lived
 *     token, we pass it through to the browser.  The hook connects directly
 *     to Inworld's WebSocket using that token as a query parameter.
 *     Response: { token, expiresAt, type: 'inworld' }
 *
 *   Path B — Inworld has no token endpoint (current fallback):
 *     We generate a server-signed HMAC token valid for 60 seconds.
 *     The hook connects to /api/v9/inworld-stt-ws?token=<hmac>.
 *     The proxy validates the HMAC and pipes the socket to Inworld.
 *     Response: { token, expiresAt, type: 'proxy' }
 *
 * Requires: active Supabase session.
 */

const TOKEN_TTL_MS = 60_000;
const INWORLD_SESSION_ENDPOINT = 'https://api.inworld.ai/v1/stt/sessions';

function generateProxyToken(userId: string, secret: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${userId}:${exp}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

export async function GET(): Promise<NextResponse> {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Inworld STT is not configured on this server (missing INWORLD_API_KEY).' },
      { status: 500 },
    );
  }

  // Path A: try Inworld's own session/token endpoint first.
  try {
    const upstream = await fetch(INWORLD_SESSION_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (upstream.ok) {
      const data = (await upstream.json()) as { token?: string; expiresAt?: string };
      if (data.token) {
        return NextResponse.json({
          token: data.token,
          expiresAt: data.expiresAt ?? null,
          type: 'inworld' as const,
        });
      }
    }
  } catch {
    // Token endpoint unreachable; fall through to proxy token.
  }

  // Path B: issue a server-signed HMAC proxy token.
  // The hook connects to /api/v9/inworld-stt-ws?token=<token> which
  // validates this token before proxying to Inworld with Basic auth.
  const secret = process.env.INWORLD_JWT_SECRET ?? apiKey;
  const token = generateProxyToken(user.id, secret);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  return NextResponse.json({
    token,
    expiresAt,
    type: 'proxy' as const,
  });
}
