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

function resolveProvider(requestedProvider: string | undefined, treatmentVersion?: string): LegacyTtsProvider {
  if (treatmentVersion === 'v7') {
    if (requestedProvider === 'openai' || requestedProvider === 'existing') {
      return requestedProvider === 'existing' ? 'kokoro' : 'openai';
    }

    return TTS_PROVIDER === 'openai' ? 'openai' : 'kokoro';
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

function getOpenAIVoice(voice: string): 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' {
  const openAIVoiceMap: Record<string, 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'> = {
    af_heart: 'alloy',
    am_adam: 'echo',
    af_bella: 'fable',
    am_michael: 'onyx',
    af_nova: 'nova',
    af_sarah: 'shimmer',
    heart: 'alloy',
    michael: 'onyx',
  };

  return openAIVoiceMap[voice] || (['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(voice) ? voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' : 'alloy');
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

async function synthesizeWithKokoro(text: string, voice: string, userAgent: string): Promise<NextResponse> {
  const KOKORO_API_URL = process.env.KOKORO_INTERNAL_URL || 'http://localhost:8080/tts';
  const voiceId = getKokoroVoiceId(voice);
  const iosClient = isIOSClient(userAgent);
  const kokoroFormat = iosClient ? 'wav' : 'opus';
  const kokoroContentType = iosClient ? 'audio/wav' : 'audio/ogg; codecs=opus';

  console.log(
    `TTS: Calling Kokoro at ${KOKORO_API_URL} with voice=${voiceId}, format=${kokoroFormat}, text="${text.substring(0, 50)}..."`
  );

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
    },
  });
}

async function synthesizeWithElevenLabs(text: string, voice: string): Promise<NextResponse> {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: 'ElevenLabs API key is not configured' }, { status: 500 });
  }

  const voiceId = voice === 'alloy' || !voice ? '21m00Tcm4TlvDq8ikWAM' : voice;
  const crypto = require('crypto');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  const hash = crypto.createHash('md5').update(`${text}-${voiceId}`).digest('hex');
  const cacheDir = path.join(os.tmpdir(), 'mindshifting-tts-cache');
  const cacheFile = path.join(cacheDir, `${hash}.mp3`);

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  if (fs.existsSync(cacheFile)) {
    const fileBuffer = fs.readFileSync(cacheFile);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000',
        'X-TTS-Cache': 'HIT',
      },
    });
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json({
      error: 'ElevenLabs TTS synthesis failed',
      code: 'tts_provider_failure',
      provider: 'elevenlabs',
      details: errorText,
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
    },
  });
}

const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';

async function synthesizeWithOpenAI(text: string, voice: string, model: string): Promise<NextResponse> {
  try {
    const openai = createOpenAIClient();
    const openaiVoice = getOpenAIVoice(voice);
    const response = await openai.audio.speech.create({
      model,
      input: text,
      voice: openaiVoice,
      response_format: 'mp3',
    });
    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('OpenAI TTS API error:', error);
    return NextResponse.json({
      error: 'TTS synthesis failed',
      code: 'tts_provider_failure',
      provider: 'openai',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    if (treatmentVersion === 'v7') {
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
      return await synthesizeWithKokoro(text, voice, userAgent);
    }

    if (resolvedProvider === 'elevenlabs') {
      return await synthesizeWithElevenLabs(text, voice);
    }

    return await synthesizeWithOpenAI(text, voice, model);
  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}