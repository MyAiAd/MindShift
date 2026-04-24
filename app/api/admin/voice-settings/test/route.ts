import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import {
  getSttProvider,
  resolveSttProviderId,
  type SttProviderId,
} from '@/lib/voice/stt-providers';
import {
  getTtsProvider,
  resolveTtsProviderId,
  type TtsProviderId,
} from '@/lib/voice/tts-providers';

export const runtime = 'nodejs';

/**
 * Admin "test" endpoint for the voice pipeline UI.
 *
 *   POST /api/admin/voice-settings/test
 *     body:
 *       { kind: "tts", provider: "openai" | "elevenlabs" | "kokoro",
 *         text?: string, voice?: string }
 *     OR
 *       { kind: "stt", provider: "openai" | "whisper-local" }
 *       with an audio file in multipart form-data under key "audio"
 *
 * The endpoint runs a short round-trip against the selected provider
 * and returns timing + cost info plus (for TTS) base64 audio. The
 * admin UI uses the response to validate that keys / service URLs
 * are correctly configured before the super_admin persists the new
 * pair.
 *
 * NOTE: This endpoint does NOT persist anything. Saving the selection
 * is a separate PUT to /api/admin/voice-settings.
 */

const DEFAULT_TTS_SAMPLE =
  'This is a voice test for the Mind Shifting admin console.';

async function requireAdmin() {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role)) {
    return {
      error: NextResponse.json({ error: 'Admin required' }, { status: 403 }),
    };
  }
  return { userId: user.id };
}

async function testTts(
  providerRequest: string,
  text: string,
  voice?: string,
) {
  const providerId = resolveTtsProviderId(providerRequest);
  const provider = getTtsProvider(providerId as TtsProviderId);
  if (!provider.isAvailable()) {
    return NextResponse.json(
      {
        error: `TTS provider "${providerId}" is not configured on this server`,
      },
      { status: 409 },
    );
  }

  const start = performance.now();
  try {
    const result = await provider.synthesize({
      text,
      voice: voice ?? undefined,
      format: 'mp3',
    });
    const roundTripMs = Math.round(performance.now() - start);
    return NextResponse.json({
      kind: 'tts',
      provider: result.provider,
      voice: result.voice,
      format: result.format,
      mimeType: result.mimeType,
      audioBase64: result.audio.toString('base64'),
      text,
      cost: result.cost,
      roundTripMs,
    });
  } catch (err) {
    return NextResponse.json(
      {
        kind: 'tts',
        provider: providerId,
        error: err instanceof Error ? err.message : 'TTS test failed',
      },
      { status: 502 },
    );
  }
}

async function testStt(providerRequest: string, audio: Blob) {
  const providerId = resolveSttProviderId(providerRequest);
  const provider = getSttProvider(providerId as SttProviderId);
  if (!provider.isAvailable()) {
    return NextResponse.json(
      {
        error: `STT provider "${providerId}" is not configured on this server`,
      },
      { status: 409 },
    );
  }

  const start = performance.now();
  try {
    const result = await provider.transcribe({ audio });
    const roundTripMs = Math.round(performance.now() - start);
    return NextResponse.json({
      kind: 'stt',
      provider: result.provider,
      model: result.model,
      text: result.text,
      language: result.language,
      durationSeconds: result.durationSeconds,
      cost: result.cost,
      roundTripMs,
    });
  } catch (err) {
    return NextResponse.json(
      {
        kind: 'stt',
        provider: providerId,
        error: err instanceof Error ? err.message : 'STT test failed',
      },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const contentType = request.headers.get('content-type') || '';

  // Multipart path: STT with audio, or TTS with form-data fields.
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const kind = String(form.get('kind') || '').toLowerCase();
    const provider = String(form.get('provider') || '').toLowerCase();

    if (kind === 'stt') {
      const audio = form.get('audio');
      if (!(audio instanceof Blob)) {
        return NextResponse.json(
          { error: 'STT test requires an audio file under key "audio"' },
          { status: 400 },
        );
      }
      return testStt(provider, audio);
    }

    if (kind === 'tts') {
      const text = String(form.get('text') || DEFAULT_TTS_SAMPLE);
      const voice = form.get('voice');
      return testTts(
        provider,
        text,
        typeof voice === 'string' && voice.length > 0 ? voice : undefined,
      );
    }

    return NextResponse.json(
      { error: 'form field "kind" must be "stt" or "tts"' },
      { status: 400 },
    );
  }

  // JSON path: TTS only (STT needs a binary upload).
  let body: {
    kind?: string;
    provider?: string;
    text?: string;
    voice?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.kind !== 'tts') {
    return NextResponse.json(
      {
        error:
          'JSON requests only support TTS. For STT, upload audio via multipart/form-data.',
      },
      { status: 400 },
    );
  }

  if (!body.provider) {
    return NextResponse.json({ error: 'provider is required' }, { status: 400 });
  }

  return testTts(body.provider, body.text || DEFAULT_TTS_SAMPLE, body.voice);
}
