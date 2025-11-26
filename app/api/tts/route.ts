import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'alloy', model = 'tts-1', provider = 'openai' } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    let audioBuffer: ArrayBuffer;

    if (provider === 'elevenlabs') {
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
        return NextResponse.json({ error: 'ElevenLabs TTS synthesis failed' }, { status: 500 });
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