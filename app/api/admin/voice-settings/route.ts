import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import {
  getVoicePair,
  setVoicePair,
  type VoicePair,
} from '@/lib/v9/voice-settings';
import {
  getSttProvider,
  listSttProviders,
  type SttProviderId,
} from '@/lib/voice/stt-providers';
import {
  getTtsProvider,
  listTtsProviders,
  type TtsProviderId,
} from '@/lib/voice/tts-providers';

export const runtime = 'nodejs';

/**
 * Admin API for the global V9 voice pipeline selection.
 *
 *   GET  /api/admin/voice-settings
 *       Returns the current pair + per-provider availability so the
 *       admin UI can grey-out radios whose keys / service URLs aren't
 *       configured in the deploy.
 *       Readable by any authenticated admin (tenant_admin | super_admin)
 *       for diagnostic UX; the read does not expose secrets.
 *
 *   PUT  /api/admin/voice-settings
 *       Writes a new { stt, tts } pair. super_admin only; enforced
 *       both at this layer and by the RLS policy attached to
 *       system_voice_settings.
 *
 * See migration 062 and lib/v9/voice-settings.ts for the data model
 * and resolution precedence.
 */

type AvailabilityReport = {
  id: string;
  displayName: string;
  available: boolean;
  reason?: string;
};

function reportStt(): AvailabilityReport[] {
  const reasonMap: Partial<Record<SttProviderId, string>> = {
    openai: 'OPENAI_API_KEY not set',
    'whisper-local': 'WHISPER_SERVICE_URL not set',
    elevenlabs: 'ELEVENLABS_API_KEY not set',
  };
  return listSttProviders().map((provider) => {
    const available = provider.isAvailable();
    return {
      id: provider.id,
      displayName: provider.displayName,
      available,
      reason: available ? undefined : reasonMap[provider.id],
    };
  });
}

function reportTts(): AvailabilityReport[] {
  return listTtsProviders().map((provider) => {
    const available = provider.isAvailable();
    const reasonMap: Partial<Record<TtsProviderId, string>> = {
      openai: 'OPENAI_API_KEY not set',
      elevenlabs: 'ELEVENLABS_API_KEY not set',
    };
    return {
      id: provider.id,
      displayName: provider.displayName,
      available,
      reason: available ? undefined : reasonMap[provider.id],
    };
  });
}

async function requireAdmin(minRole: 'tenant_admin' | 'super_admin') {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profileError || !profile) {
    return {
      error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }),
    };
  }
  const allowed =
    minRole === 'super_admin'
      ? profile.role === 'super_admin'
      : profile.role === 'super_admin' || profile.role === 'tenant_admin';
  if (!allowed) {
    return {
      error: NextResponse.json(
        { error: `Forbidden — ${minRole} required` },
        { status: 403 },
      ),
    };
  }
  return { userId: user.id, role: profile.role as string };
}

export async function GET() {
  const auth = await requireAdmin('tenant_admin');
  if ('error' in auth) return auth.error;

  const current = await getVoicePair();

  return NextResponse.json({
    current: {
      stt: current.stt,
      tts: current.tts,
      source: current.fromDatabase ? 'database' : 'environment',
      updatedAt: current.updatedAt ?? null,
      updatedBy: current.updatedBy ?? null,
    },
    providers: {
      stt: reportStt(),
      tts: reportTts(),
    },
  });
}

function validateStt(value: unknown): value is SttProviderId {
  return value === 'openai' || value === 'whisper-local' || value === 'elevenlabs';
}

function validateTts(value: unknown): value is TtsProviderId {
  return value === 'openai' || value === 'elevenlabs' || value === 'kokoro';
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin('super_admin');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const incoming = body as { stt?: unknown; tts?: unknown };
  if (!validateStt(incoming.stt) || !validateTts(incoming.tts)) {
    return NextResponse.json(
      {
        error:
          'Body must be { stt: "openai" | "whisper-local" | "elevenlabs", tts: "openai" | "elevenlabs" | "kokoro" }',
      },
      { status: 400 },
    );
  }

  // Refuse to persist a selection that can't actually run in this
  // deploy. Saving an unusable setting would break v9 for every
  // patient the moment a new session starts.
  const sttProvider = getSttProvider(incoming.stt);
  const ttsProvider = getTtsProvider(incoming.tts);
  if (!sttProvider.isAvailable()) {
    return NextResponse.json(
      {
        error: `STT provider "${incoming.stt}" is not configured in this environment. Set its required env vars first.`,
      },
      { status: 409 },
    );
  }
  if (!ttsProvider.isAvailable()) {
    return NextResponse.json(
      {
        error: `TTS provider "${incoming.tts}" is not configured in this environment. Set its required env vars first.`,
      },
      { status: 409 },
    );
  }

  const pair: VoicePair = { stt: incoming.stt, tts: incoming.tts };
  try {
    const persisted = await setVoicePair(pair, auth.userId);
    return NextResponse.json({
      success: true,
      current: {
        stt: persisted.stt,
        tts: persisted.tts,
        source: 'database',
        updatedAt: persisted.updatedAt ?? null,
        updatedBy: persisted.updatedBy ?? null,
      },
      note: 'Applies to new sessions only. In-flight sessions retain the pair they started with.',
    });
  } catch (err) {
    console.error('[admin/voice-settings] PUT failed:', err);
    return NextResponse.json(
      {
        error: 'Failed to save voice settings',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
