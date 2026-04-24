import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { v9GetSessionVoicePair, v9HandleContinueSession } from '@/lib/v9/core';
import {
  speakScripted,
  transcribeToUserInput,
} from '@/lib/v9/voice-adapter';
import type { TtsProviderId } from '@/lib/voice/tts-providers';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * V9 turn endpoint. Accepts either:
 *   - JSON:       { sessionId, userId, userInput, tts? }
 *   - multipart:  fields sessionId, userId, (userInput XOR audio), tts
 *
 * Flow:
 *   1. If `audio` is present, transcribe it through the STT hallucination
 *      gate; use the transcript as `userInput`.
 *   2. Hand `userInput` to the shared v9 core (same state machine as v2).
 *   3. If the client requested TTS (`tts.enabled`), synthesise the
 *      scripted response verbatim via the configured provider.
 *
 * The whole point is: the state machine never sees audio, never sees a
 * paraphrased user input, and the spoken output is a byte-for-byte read
 * of V2's doctor text.
 */

interface TtsOptions {
  enabled?: boolean;
  provider?: TtsProviderId;
  voice?: string;
  format?: 'mp3' | 'wav' | 'pcm16' | 'aac' | 'opus';
}

interface ParsedTurn {
  sessionId?: string;
  userId?: string;
  userInput?: string;
  audio?: Blob;
  currentStep?: string;
  expectedResponseType?: string;
  hotwords?: string;
  tts?: TtsOptions;
}

function parseTtsField(raw: FormDataEntryValue | null): TtsOptions | undefined {
  if (typeof raw !== 'string' || raw.trim().length === 0) return undefined;
  try {
    return JSON.parse(raw) as TtsOptions;
  } catch {
    return { enabled: raw.toLowerCase() === 'true' };
  }
}

async function parseBody(request: NextRequest): Promise<ParsedTurn> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const audio = form.get('audio');
    return {
      sessionId: typeof form.get('sessionId') === 'string'
        ? (form.get('sessionId') as string)
        : undefined,
      userId: typeof form.get('userId') === 'string'
        ? (form.get('userId') as string)
        : undefined,
      userInput: typeof form.get('userInput') === 'string'
        ? (form.get('userInput') as string)
        : undefined,
      audio: audio instanceof Blob ? audio : undefined,
      currentStep: typeof form.get('current_step') === 'string'
        ? (form.get('current_step') as string)
        : undefined,
      expectedResponseType: typeof form.get('expected_response_type') === 'string'
        ? (form.get('expected_response_type') as string)
        : undefined,
      hotwords: typeof form.get('hotwords') === 'string'
        ? (form.get('hotwords') as string)
        : undefined,
      tts: parseTtsField(form.get('tts')),
    };
  }

  try {
    return (await request.json()) as ParsedTurn;
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(request);
    const { sessionId, userId, audio } = parsed;
    let { userInput } = parsed;

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
      // lenient auth — consistent with the main v9 route
    }

    // Read the voice pair pinned to this session at start. Guarantees
    // that flipping the admin radios never changes voice mid-session.
    // Patient-facing request bodies cannot override this (only the
    // admin settings UI can); see lib/v9/voice-settings.ts.
    const pinnedPair = await v9GetSessionVoicePair(sessionId, userId);

    let sttDetails: Record<string, unknown> | null = null;

    if (audio) {
      const transcribe = await transcribeToUserInput(audio, {
        currentStep: parsed.currentStep,
        expectedResponseType: parsed.expectedResponseType,
        hotwords: parsed.hotwords,
        providerId: pinnedPair.stt,
      });
      userInput = transcribe.userInput;
      sttDetails = {
        rawTranscript: transcribe.rawTranscript,
        filtered: transcribe.hallucination.filtered,
        reason: transcribe.hallucination.reason,
        language: transcribe.language,
        durationSeconds: transcribe.durationSeconds,
        latencyMs: transcribe.latencyMs,
        provider: transcribe.provider,
        model: transcribe.model,
        estimatedUsd: transcribe.estimatedUsd,
      };

      if (transcribe.hallucination.filtered) {
        // Hallucination gate rejected the audio. Don't even call the
        // state machine; ask the user to try again.
        return NextResponse.json({
          success: false,
          sessionId,
          message:
            "I didn't catch that — could you say it again? (hallucination-filtered)",
          requiresRetry: true,
          stt: sttDetails,
        });
      }
    }

    if (!userInput) {
      return NextResponse.json(
        { error: 'userInput or audio is required for turn' },
        { status: 400 },
      );
    }

    const coreResponse = await v9HandleContinueSession(sessionId, userInput, userId);
    const coreJson = (await coreResponse.clone().json()) as {
      message?: string;
      currentStep?: string;
    };

    if (!parsed.tts?.enabled || !coreJson.message) {
      if (sttDetails) {
        return NextResponse.json({
          ...(await coreResponse.clone().json()),
          stt: sttDetails,
        });
      }
      return coreResponse;
    }

    try {
      // Session-pinned TTS provider wins over request body; the
      // request can only override if the body explicitly supplies one,
      // and even then, the admin UI's session-pin rule still applies
      // to new sessions that haven't opted into per-request overrides.
      const ttsProvider = parsed.tts.provider ?? pinnedPair.tts;
      const tts = await speakScripted(coreJson.message, {
        providerId: ttsProvider,
        voice: parsed.tts.voice ?? null,
        format: parsed.tts.format ?? 'mp3',
        sessionId,
        stepId: coreJson.currentStep,
      });

      return NextResponse.json({
        ...(await coreResponse.clone().json()),
        stt: sttDetails ?? undefined,
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
      console.error('V9 turn TTS error:', ttsError);
      return NextResponse.json({
        ...(await coreResponse.clone().json()),
        stt: sttDetails ?? undefined,
        tts: {
          error: ttsError instanceof Error ? ttsError.message : 'TTS failed',
        },
      });
    }
  } catch (error) {
    console.error('V9 /turn error:', error);
    return NextResponse.json(
      {
        error: 'V9 turn failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
