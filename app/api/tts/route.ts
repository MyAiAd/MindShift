import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'alloy', model = 'tts-1', provider = 'kokoro' } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    let audioBuffer: ArrayBuffer;

    if (provider === 'kokoro') {
      // Kokoro TTS (Hetzner self-hosted)
      // Use internal URL for server-side calls (avoids Cloudflare round-trip)
      const KOKORO_API_URL = process.env.KOKORO_INTERNAL_URL || 'http://localhost:8080/tts';
      
      // Map OpenAI/generic voice names to Kokoro voices, default to af_heart
      const kokoroVoiceMap: Record<string, string> = {
        'alloy': 'af_heart',
        'echo': 'am_adam',
        'fable': 'af_bella',
        'onyx': 'am_michael',
        'nova': 'af_nova',
        'shimmer': 'af_sarah',
      };
      const voiceId = kokoroVoiceMap[voice] || (voice?.startsWith('af_') || voice?.startsWith('am_') ? voice : 'af_heart');

      console.log(`TTS: Calling Kokoro at ${KOKORO_API_URL} with voice=${voiceId}, text="${text.substring(0, 50)}..."`);

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
            format: 'opus',
          }),
        });
      } catch (fetchError) {
        console.error('Kokoro TTS fetch error (network/connection):', fetchError instanceof Error ? fetchError.message : fetchError);
        return NextResponse.json({ 
          error: 'Kokoro TTS connection failed', 
          details: fetchError instanceof Error ? fetchError.message : 'Network error',
        }, { status: 502 });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Kokoro TTS API error (status ${response.status}):`, errorText || '(empty response)');
        return NextResponse.json({ 
          error: 'Kokoro TTS synthesis failed', 
          details: errorText || 'Unknown error',
          status: response.status 
        }, { status: 500 });
      }

      // Return the opus audio
      return new NextResponse(response.body, {
        headers: {
          'Content-Type': 'audio/opus',
          'Cache-Control': 'public, max-age=31536000',
        },
      });

    } else if (provider === 'elevenlabs') {
      // ElevenLabs TTS
      const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
      if (!ELEVENLABS_API_KEY) {
        console.error('ElevenLabs API key is missing');
        return NextResponse.json({ error: 'ElevenLabs API key is not configured' }, { status: 500 });
      }

      // Default to a nice voice if not specified or if it's an OpenAI voice name
      // '21m00Tcm4TlvDq8ikWAM' is "Rachel" (default)
      const voiceId = (voice === 'alloy' || !voice) ? '21m00Tcm4TlvDq8ikWAM' : voice;

      // Caching Logic
      const crypto = require('crypto');
      const fs = require('fs');
      const path = require('path');
      const os = require('os');

      // Create a unique hash for this request
      const hash = crypto.createHash('md5').update(`${text}-${voiceId}`).digest('hex');
      const cacheDir = path.join(os.tmpdir(), 'mindshifting-tts-cache');
      const cacheFile = path.join(cacheDir, `${hash}.mp3`);

      // Ensure cache directory exists
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      // Check if cached file exists
      if (fs.existsSync(cacheFile)) {
        console.log(`TTS Cache HIT: ${hash}`);
        const fileBuffer = fs.readFileSync(cacheFile);
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'public, max-age=31536000', // Cache forever
            'X-TTS-Cache': 'HIT',
          },
        });
      }

      console.log(`TTS Cache MISS: ${hash}`);

      // Use the stream endpoint
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
        console.error('ElevenLabs TTS API error:', errorText);
        return NextResponse.json({ 
          error: 'ElevenLabs TTS synthesis failed', 
          details: errorText,
          status: response.status 
        }, { status: 500 });
      }

      // Clone the response to save it while streaming
      const responseClone = response.clone();
      const arrayBuffer = await responseClone.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Save to cache asynchronously (don't block the stream)
      fs.writeFile(cacheFile, buffer, (err: any) => {
        if (err) console.error('Failed to save TTS to cache:', err);
        else console.log(`Saved TTS to cache: ${hash}`);
      });

      // Return the stream directly
      return new NextResponse(response.body, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=31536000',
          'X-TTS-Cache': 'MISS',
        },
      });

    } else {
      // OpenAI TTS (Default)
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          response_format: 'mp3'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI TTS API error:', errorText);
        return NextResponse.json({ error: 'TTS synthesis failed' }, { status: 500 });
      }

      audioBuffer = await response.arrayBuffer();

      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      });
    }

  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}