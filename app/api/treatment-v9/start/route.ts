import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { v9HandleStartSession, v9TreatmentMachine } from '@/lib/v9/core';
import { speakScripted } from '@/lib/v9/voice-adapter';
import type { TtsProviderId } from '@/lib/voice/tts-providers';

export const runtime = 'nodejs';

/**
 * V9 session start endpoint.
 *
 * - Accepts either JSON (`{ sessionId, userId, tts?: { ... } }`) or
 *   multipart with the same fields as form fields. (No audio is used on
 *   start; this endpoint exists for client symmetry with /turn and so
 *   that clients in "voice first" mode can also request the initial
 *   welcome audio in one round-trip.)
 * - Delegates session creation to the shared v9 core so that sessions
 *   created here are visible to /turn, /api/treatment-v9, and vice versa.
 * - If `tts.enabled` is true (or the request's Accept header is
 *   multipart/form-data), the JSON response will include base64 audio for
 *   the initial welcome message, synthesised verbatim via speakScripted.
 */

interface TtsOptions {
  enabled?: boolean;
  provider?: TtsProviderId;
  voice?: string;
  format?: 'mp3' | 'wav' | 'pcm16' | 'aac' | 'opus';
}

interface StartBody {
  sessionId?: string;
  userId?: string;
  tts?: TtsOptions;
}

async function parseBody(request: NextRequest): Promise<StartBody> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const raw = form.get('tts');
    let tts: TtsOptions | undefined;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      try {
        tts = JSON.parse(raw) as TtsOptions;
      } catch {
        tts = { enabled: raw.toLowerCase() === 'true' };
      }
    }
    return {
      sessionId: typeof form.get('sessionId') === 'string'
        ? (form.get('sessionId') as string)
        : undefined,
      userId: typeof form.get('userId') === 'string'
        ? (form.get('userId') as string)
        : undefined,
      tts,
    };
  }
  try {
    return (await request.json()) as StartBody;
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    const { sessionId, userId } = body;

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'sessionId and userId are required' },
        { status: 400 },
      );
    }

    try {
      const supabase = createServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && user.id !== userId) {
        return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
      }
    } catch {
      // continue — same lenient auth policy as the main v9 route
    }

    const startResponse = await v9HandleStartSession(sessionId, userId);
    const startJson = (await startResponse.clone().json()) as {
      message?: string;
      currentStep?: string;
      voicePair?: { stt?: string; tts?: string };
    };

    if (!body.tts?.enabled || !startJson.message) {
      return startResponse;
    }

    try {
      // Use the pair that v9HandleStartSession just pinned to the
      // session. This guarantees the initial welcome audio speaks in
      // the same voice every subsequent turn will use.
      const pinnedTts = (startJson.voicePair?.tts ?? null) as TtsProviderId | null;
      const tts = await speakScripted(startJson.message, {
        providerId: body.tts.provider ?? pinnedTts ?? null,
        voice: body.tts.voice ?? null,
        format: body.tts.format ?? 'mp3',
        sessionId,
        stepId: startJson.currentStep,
      });

      return NextResponse.json({
        ...(await startResponse.clone().json()),
        tts: {
          provider: tts.provider,
          voice: tts.voice,
          format: tts.format,
          mimeType: tts.mimeType,
          audioBase64: tts.audio.toString('base64'),
          cost: tts.cost,
        },
      });
    } catch (ttsError) {
      console.error('V9 start TTS error:', ttsError);
      const json = await startResponse.clone().json();
      return NextResponse.json({
        ...json,
        tts: {
          error: ttsError instanceof Error ? ttsError.message : 'TTS failed',
        },
      });
    }
  } catch (error) {
    console.error('V9 /start error:', error);
    return NextResponse.json(
      {
        error: 'V9 start failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// Ensure the singleton is loaded even if /turn is hit first in a fresh
// process, so that session state is consistent across endpoints.
void v9TreatmentMachine;
