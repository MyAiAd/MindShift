import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { getVoiceCacheName, isOpenAIVoiceId } from '@/lib/voice/voice-cache-name';

/**
 * /api/treatment-v7/realtime-session (US-022)
 *
 * Mints an ephemeral OpenAI Realtime API session tuned for v7's
 * strict-script constraints. The Realtime model is instructed explicitly
 * to NEVER generate patient-facing text; it only plays back conversation
 * items that the client sends. Scripted v7 responses are authored
 * server-side (lib/v7/treatment-state-machine.ts) and rendered verbatim.
 *
 * VAD starting defaults match US-028's grid-search starting point and are
 * the values tuned in that story. The defaults below are the PRD's
 * documented starting point, not final tuned values.
 */

const DEFAULT_REALTIME_MODEL = 'gpt-4o-realtime-preview-2024-12-17';
const DEFAULT_V7_REALTIME_VOICE = process.env.NEXT_PUBLIC_V7_DEFAULT_VOICE || 'shimmer';

const V7_REALTIME_INSTRUCTIONS = [
  'You are the audio pipeline for a strict-script therapeutic session.',
  'You must not generate or modify any patient-facing text.',
  'Only play back conversation items that are sent to you explicitly.',
  'When asked to speak, read the provided text exactly, verbatim, with no additions, omissions, or paraphrasing.',
  'Do not greet, summarise, or comment. Do not acknowledge user input.',
  'If no explicit message has been queued for playback, remain silent.',
].join(' ');

type RealtimeSessionRequestBody = {
  voice?: string;
  model?: string;
};

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 },
      );
    }

    let body: RealtimeSessionRequestBody = {};
    try {
      body = (await request.json()) as RealtimeSessionRequestBody;
    } catch {
      body = {};
    }

    try {
      const supabase = createServerClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.warn('v7 realtime-session: auth error, continuing for dev parity:', authError.message);
      }
      if (!user) {
        console.warn('v7 realtime-session: no authenticated user; continuing in dev-compat mode');
      }
    } catch (authErr) {
      console.warn('v7 realtime-session: auth check failed, continuing:', authErr);
    }

    const rawVoice = (body.voice || DEFAULT_V7_REALTIME_VOICE).toString();
    const voice = isOpenAIVoiceId(rawVoice) ? rawVoice : DEFAULT_V7_REALTIME_VOICE;

    const model = (body.model || DEFAULT_REALTIME_MODEL).toString();

    const sessionConfig = {
      model,
      voice,
      modalities: ['audio', 'text'],
      instructions: V7_REALTIME_INSTRUCTIONS,
      input_audio_transcription: {
        model: 'gpt-4o-mini-transcribe',
        language: 'en',
      },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      },
    };

    console.log(JSON.stringify({
      event: 'v7_realtime_session_mint_request',
      voice,
      voice_cache_name: getVoiceCacheName(voice),
      model,
    }));

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionConfig),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(JSON.stringify({
        event: 'v7_realtime_session_mint_failure',
        http_status: response.status,
        error_preview: errorText.slice(0, 200),
      }));
      let openaiError = errorText;
      try {
        const parsed = JSON.parse(errorText);
        openaiError = parsed.error?.message || parsed.message || errorText;
      } catch {
        // leave as raw
      }
      return NextResponse.json(
        { error: `OpenAI API Error: ${openaiError}` },
        { status: response.status },
      );
    }

    const sessionData = (await response.json()) as Record<string, unknown>;

    console.log(JSON.stringify({
      event: 'v7_realtime_session_mint_success',
      voice,
      model,
    }));

    return NextResponse.json(sessionData);
  } catch (error) {
    console.error('v7 realtime-session: unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
