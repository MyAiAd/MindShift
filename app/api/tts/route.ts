import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { TTS_PROVIDER, STRICT_SPEECH_MODE } from '@/lib/voice/speech-config';
import { validateSpeechOutput } from '@/lib/voice/speech-compliance';
import { V7_STATIC_AUDIO_TEXTS } from '@/lib/v7/static-audio-texts';

type LegacyTtsProvider = 'kokoro' | 'elevenlabs' | 'openai' | 'existing';

type TtsRequestBody = {
  text?: string;
  apiMessage?: string;
  voice?: string;
  model?: string;
  provider?: LegacyTtsProvider;
  treatmentVersion?: string;
};

const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_flash_v2_5';
const ELEVENLABS_API_BASE = process.env.ELEVENLABS_API_BASE ?? 'https://api.elevenlabs.io';

function resolveProvider(requestedProvider: string | undefined, treatmentVersion?: string): LegacyTtsProvider {
  // US-018: v7 is fully outsourced to OpenAI. TTS_PROVIDER and `provider` are ignored for v7.
  if (treatmentVersion === 'v7') {
    if (requestedProvider === 'kokoro' || requestedProvider === 'existing') {
      console.log(JSON.stringify({ event: 'v7_legacy_tts_override_ignored', requested: requestedProvider }));
    }
    return 'openai';
  }

  if (requestedProvider === 'kokoro' || requestedProvider === 'elevenlabs' || requestedProvider === 'openai') {
    return requestedProvider;
  }

  return 'kokoro';
}

function getKokoroVoiceId(voice: string): string {
  const kokoroVoiceMap: Record<string, string> = {
    alloy: 'af_heart',
    echo: 'am_adam',
    fable: 'af_bella',
    onyx: 'am_michael',
    nova: 'af_nova',
    shimmer: 'af_sarah',
  };

  return kokoroVoiceMap[voice] || (voice.startsWith('af_') || voice.startsWith('am_') ? voice : 'af_heart');
}

// OpenAI voice ids supported by gpt-4o-mini-tts. The `marin` and `cedar` voices
// are OpenAI's current best-quality recommendation (post-2025-03 release) and are
// only available on gpt-4o-mini-tts — they are NOT supported by tts-1 / tts-1-hd.
// Any fallback model must therefore also be in the gpt-4o-mini-tts family or the
// voice will silently downgrade mid-session.
type OpenAITtsVoice =
  | 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'fable' | 'nova'
  | 'onyx' | 'sage' | 'shimmer' | 'verse' | 'marin' | 'cedar';

const OPENAI_TTS_VOICES: ReadonlySet<OpenAITtsVoice> = new Set<OpenAITtsVoice>([
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova',
  'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar',
]);

function getOpenAIVoice(voice: string): OpenAITtsVoice {
  const openAIVoiceMap: Record<string, OpenAITtsVoice> = {
    // Legacy Kokoro / short-form aliases — kept so a session migrated from the
    // prior provider does not suddenly change voice when the default is read.
    af_heart: 'alloy',
    am_adam: 'echo',
    af_bella: 'fable',
    am_michael: 'onyx',
    af_nova: 'nova',
    af_sarah: 'shimmer',
    heart: 'alloy',
    michael: 'onyx',
  };

  if (openAIVoiceMap[voice]) return openAIVoiceMap[voice];
  if (OPENAI_TTS_VOICES.has(voice as OpenAITtsVoice)) return voice as OpenAITtsVoice;
  return 'marin';
}

function isIOSClient(userAgent: string): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent));
}

function isStaticV7Text(text: string): boolean {
  return (Object.values(V7_STATIC_AUDIO_TEXTS) as string[]).includes(text);
}

function createOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function synthesizeWithKokoro(
  text: string,
  voice: string,
  userAgent: string,
  routeStartedAt: number,
): Promise<NextResponse> {
  const KOKORO_API_URL = process.env.KOKORO_INTERNAL_URL || 'http://localhost:8080/tts';
  const voiceId = getKokoroVoiceId(voice);
  const iosClient = isIOSClient(userAgent);
  const kokoroFormat = iosClient ? 'wav' : 'opus';
  const kokoroContentType = iosClient ? 'audio/wav' : 'audio/ogg; codecs=opus';

  console.log(
    `TTS: Calling Kokoro at ${KOKORO_API_URL} with voice=${voiceId}, format=${kokoroFormat}, text="${text.substring(0, 50)}..."`
  );

  // Stamp the moment we hand off to the upstream so the client can split
  // the chip's `→TTS chunk` segment into route-vs-upstream costs.
  const ttsRouteMs = Date.now() - routeStartedAt;

  let response: Response;
  try {
    response = await fetch(KOKORO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice: voiceId,
        format: kokoroFormat,
      }),
    });
  } catch (fetchError) {
    console.error('Kokoro TTS fetch error (network/connection):', fetchError instanceof Error ? fetchError.message : fetchError);
    return NextResponse.json({
      error: 'Kokoro TTS connection failed',
      code: 'tts_provider_failure',
      provider: 'existing',
      details: fetchError instanceof Error ? fetchError.message : 'Network error',
    }, { status: 502 });
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Kokoro TTS API error (status ${response.status}):`, errorText || '(empty response)');
    return NextResponse.json({
      error: 'Kokoro TTS synthesis failed',
      code: 'tts_provider_failure',
      provider: 'existing',
      details: errorText || 'Unknown error',
      status: response.status,
    }, { status: 500 });
  }

  return new NextResponse(response.body, {
    headers: {
      'Content-Type': kokoroContentType,
      'Cache-Control': 'public, max-age=31536000',
      'X-Tts-Route-Ms': String(ttsRouteMs),
      'X-Tts-Provider': 'kokoro',
    },
  });
}

async function synthesizeWithElevenLabs(text: string, voice: string, routeStartedAt: number): Promise<NextResponse> {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: 'ElevenLabs API key is not configured' }, { status: 500 });
  }

  const voiceId = voice === 'alloy' || !voice ? '21m00Tcm4TlvDq8ikWAM' : voice;
  const crypto = require('crypto');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  const hash = crypto
    .createHash('md5')
    .update(`${ELEVENLABS_MODEL_ID}-${text}-${voiceId}`)
    .digest('hex');
  const cacheDir = path.join(os.tmpdir(), 'mindshifting-tts-cache');
  const cacheFile = path.join(cacheDir, `${hash}.mp3`);

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  if (fs.existsSync(cacheFile)) {
    const fileBuffer = fs.readFileSync(cacheFile);
    const ttsRouteMsCached = Date.now() - routeStartedAt;
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000',
        'X-TTS-Cache': 'HIT',
        'X-Tts-Route-Ms': String(ttsRouteMsCached),
        'X-Tts-Provider': 'elevenlabs',
      },
    });
  }

  // Stamp the moment we hand off to the upstream so the client can split
  // the chip's `→TTS chunk` segment into route-vs-upstream costs.
  const ttsRouteMs = Date.now() - routeStartedAt;
  const response = await fetch(`${ELEVENLABS_API_BASE}/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let details = errorText;
    try {
      const parsed = JSON.parse(errorText) as {
        detail?: { message?: string } | string;
      };
      details = typeof parsed.detail === 'string'
        ? parsed.detail
        : parsed.detail?.message ?? errorText;
    } catch {
      // Keep the raw provider body if it is not JSON.
    }
    return NextResponse.json({
      error: 'ElevenLabs TTS synthesis failed',
      code: 'tts_provider_failure',
      provider: 'elevenlabs',
      details,
      model: ELEVENLABS_MODEL_ID,
      status: response.status,
    }, { status: 500 });
  }

  const responseClone = response.clone();
  const arrayBuffer = await responseClone.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  fs.writeFile(cacheFile, buffer, (err: unknown) => {
    if (err) {
      console.error('Failed to save TTS to cache:', err);
    }
  });

  return new NextResponse(response.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=31536000',
      'X-TTS-Cache': 'MISS',
      'X-Tts-Route-Ms': String(ttsRouteMs),
      'X-Tts-Provider': 'elevenlabs',
    },
  });
}

// Pin the snapshot (not the floating alias) so voice characteristics do not drift
// when OpenAI ships a new default behind the scenes. If this snapshot is ever
// deprecated or visibly regresses against the static-library recordings, bump the
// pin and re-run `scripts/regenerate-v7-static-audio.ts` in the same commit so the
// static and dynamic paths stay on the identical model revision.
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts-2025-03-20';
// Fallback deliberately stays inside the same model family. Falling back to a
// different TTS model (historically `tts-1-hd`) would swap the voice timbre
// mid-session, which is exactly the two-source mismatch we pre-render to avoid.
const OPENAI_TTS_FALLBACK_MODEL = process.env.OPENAI_TTS_FALLBACK_MODEL || 'gpt-4o-mini-tts';
const DEFAULT_TTS_INSTRUCTIONS =
  'Speak in a warm, calm, unhurried voice with a therapeutic presence. Pace slightly slower than conversational. Gentle vowel releases. Leave natural micro-pauses at commas and between clauses. Never sound rushed, bright, or upbeat. The speaker is a patient, caring clinician.';

/** Models that support the `instructions` parameter on `audio.speech.create`. */
function modelSupportsInstructions(model: string): boolean {
  // Every snapshot and alias of gpt-4o-mini-tts accepts `instructions`. Older
  // models (tts-1, tts-1-hd) do not. Matching by prefix keeps this guard
  // correct as new snapshots (gpt-4o-mini-tts-YYYY-MM-DD) ship.
  return model.startsWith('gpt-4o-mini-tts');
}

function isRetryableOpenAITtsError(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AbortError') return true;
  const anyErr = err as { status?: number; name?: string } | undefined;
  const status = anyErr?.status;
  if (typeof status === 'number') {
    if (status === 429 || status >= 500) return true;
    if (status >= 400 && status < 500) return false; // auth/validation — fail fast
  }
  if (err instanceof TypeError) return true;
  if (anyErr?.name === 'FetchError') return true;
  return false;
}

type TtsTelemetry = {
  treatmentVersion: string | null;
  textLength: number;
  voice: string;
};

async function synthesizeWithOpenAI(
  text: string,
  voice: string,
  model: string,
  telemetry: TtsTelemetry,
  routeStartedAt: number,
): Promise<NextResponse> {
  const startTime = Date.now();
  const openai = createOpenAIClient();
  const openaiVoice = getOpenAIVoice(voice);
  const instructions = process.env.OPENAI_TTS_INSTRUCTIONS || DEFAULT_TTS_INSTRUCTIONS;
  // Stamp route-process time as soon as we're about to hand off to OpenAI.
  // For OpenAI we currently buffer the full response before forwarding, so
  // the upstream portion measured by the client is "synth + buffer" rather
  // than "first byte" — we'll revisit when we move to true streaming.
  const ttsRouteMs = Date.now() - routeStartedAt;

  type TtsAttempt = { buffer: ArrayBuffer; modelUsed: string; fallbackUsed: boolean; retryCount: number };

  const callOnce = async (modelToUse: string, allowInstructions: boolean): Promise<ArrayBuffer> => {
    const payload: Parameters<OpenAI['audio']['speech']['create']>[0] = {
      model: modelToUse,
      input: text,
      voice: openaiVoice,
      response_format: 'mp3',
    };
    // US-008: only send `instructions` when the model supports it.
    if (allowInstructions && modelSupportsInstructions(modelToUse)) {
      (payload as unknown as { instructions?: string }).instructions = instructions;
    }
    const response = await openai.audio.speech.create(payload);
    return await response.arrayBuffer();
  };

  const attempt = async (): Promise<TtsAttempt> => {
    try {
      const buffer = await callOnce(model, true);
      return { buffer, modelUsed: model, fallbackUsed: false, retryCount: 0 };
    } catch (primaryError) {
      if (OPENAI_TTS_FALLBACK_MODEL === model || !isRetryableOpenAITtsError(primaryError)) {
        // Either the fallback isn't distinct, or the error is non-retryable (4xx auth/validation).
        throw primaryError;
      }
      // US-009: retry ONCE with tts-1-hd (same vendor, deterministic, proven). Never send
      // `instructions` on the fallback call — tts-1-hd doesn't understand it.
      console.log(JSON.stringify({
        event: 'tts_fallback_attempt',
        primary_model: model,
        fallback_model: OPENAI_TTS_FALLBACK_MODEL,
        reason: primaryError instanceof Error ? primaryError.message : 'unknown',
      }));
      const buffer = await callOnce(OPENAI_TTS_FALLBACK_MODEL, false);
      return { buffer, modelUsed: OPENAI_TTS_FALLBACK_MODEL, fallbackUsed: true, retryCount: 1 };
    }
  };

  try {
    const { buffer, modelUsed, fallbackUsed, retryCount } = await attempt();
    const processingTime = Date.now() - startTime;

    // US-005 TTS telemetry — single-line JSON, one per response.
    console.log(JSON.stringify({
      event: 'tts_call',
      treatment_version: telemetry.treatmentVersion ?? 'legacy',
      text_length: telemetry.textLength,
      voice: openaiVoice,
      model: modelUsed,
      retry_count: retryCount,
      fallback_used: fallbackUsed,
      processing_time_ms: processingTime,
    }));

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600',
        'X-Tts-Route-Ms': String(ttsRouteMs),
        'X-Tts-Provider': 'openai',
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('OpenAI TTS API error:', error);
    console.log(JSON.stringify({
      event: 'tts_call',
      treatment_version: telemetry.treatmentVersion ?? 'legacy',
      text_length: telemetry.textLength,
      voice: openaiVoice,
      model,
      retry_count: 1, // we attempted the fallback
      fallback_used: false,
      processing_time_ms: processingTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
    return NextResponse.json({
      error: 'TTS synthesis failed',
      code: 'tts_provider_failure',
      provider: 'openai',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Anchor for the X-Tts-Route-Ms response header. The synthesizer functions
  // each compute their own delta from this just before they dispatch the
  // upstream request, so the header reflects "time spent in this route
  // before the upstream provider was actually called".
  const routeStartedAt = Date.now();
  try {
    const {
      text,
      apiMessage,
      voice = 'alloy',
      model = OPENAI_TTS_MODEL,
      provider,
      treatmentVersion,
    } = await request.json() as TtsRequestBody;
    const userAgent = request.headers.get('user-agent') || '';

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (treatmentVersion === 'v7' || treatmentVersion === 'v9') {
      const complianceResult = validateSpeechOutput({
        textToSpeak: text,
        apiMessage: apiMessage ?? text,
      });

      if (!complianceResult.ok) {
        console.error({
          event: 'speech_compliance_violation',
          route: '/api/tts',
          reason: complianceResult.reason,
          token: complianceResult.token,
          details: complianceResult.details,
          strict: STRICT_SPEECH_MODE,
        });

        return NextResponse.json({
          error: 'Speech compliance violation',
          code: 'speech_compliance_violation',
          reason: complianceResult.reason,
          details: complianceResult.details,
        }, { status: 422 });
      }
    }

    const resolvedProvider = resolveProvider(provider, treatmentVersion);
    if (treatmentVersion === 'v7' && resolvedProvider === 'openai' && isStaticV7Text(text)) {
      console.log('TTS: static V7 text reached dynamic synthesis after cache miss', {
        provider: resolvedProvider,
        preview: text.substring(0, 80),
      });
    }

    if (resolvedProvider === 'kokoro') {
      return await synthesizeWithKokoro(text, voice, userAgent, routeStartedAt);
    }

    if (resolvedProvider === 'elevenlabs') {
      return await synthesizeWithElevenLabs(text, voice, routeStartedAt);
    }

    return await synthesizeWithOpenAI(text, voice, model, {
      treatmentVersion: treatmentVersion ?? null,
      textLength: text.length,
      voice,
    }, routeStartedAt);
  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}