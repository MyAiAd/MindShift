import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export const runtime = 'nodejs';

/**
 * POST /api/elevenlabs-scribe-token
 *
 * Issues a single-use ElevenLabs Scribe realtime authentication token.
 * The token is used by the browser to open a WebSocket connection to
 * wss://api.elevenlabs.io/v1/speech-to-text/realtime without ever
 * exposing ELEVENLABS_API_KEY to the client.
 *
 * Requires: active Supabase session (authenticated patient or admin).
 * Tokens are single-use and must be fetched fresh for every WebSocket
 * connection (including reconnects).
 */

const API_BASE = process.env.ELEVENLABS_API_BASE ?? 'https://api.elevenlabs.io';
const TOKEN_ENDPOINT = `${API_BASE}/v1/single-use-token/realtime_scribe`;

export async function POST(): Promise<NextResponse> {
  // Require an authenticated Supabase session.
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ElevenLabs STT is not configured on this server (missing ELEVENLABS_API_KEY).' },
      { status: 500 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
    });
  } catch (err) {
    console.error('[elevenlabs-scribe-token] Network error reaching ElevenLabs:', err);
    return NextResponse.json(
      { error: 'Failed to reach ElevenLabs token endpoint.' },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const body = await upstream.text().catch(() => '');
    console.error(
      `[elevenlabs-scribe-token] ElevenLabs rejected token request (${upstream.status}):`,
      body.slice(0, 200),
    );
    return NextResponse.json(
      { error: 'ElevenLabs declined the token request. Check your API key and account status.' },
      { status: 502 },
    );
  }

  const data = (await upstream.json()) as { token?: string };
  if (!data.token) {
    console.error('[elevenlabs-scribe-token] ElevenLabs response missing token field:', data);
    return NextResponse.json(
      { error: 'Unexpected response from ElevenLabs token endpoint.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ token: data.token });
}
