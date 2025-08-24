import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Get request body for any custom session parameters
    const body = await request.json().catch(() => ({}));
    const { 
      model = 'gpt-4o-realtime-preview-2024-12-17', 
      voice = 'verse', 
      instructions,
      input_audio_transcription,
      turn_detection
    } = body;

    // Create ephemeral client secret for WebRTC
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        voice,
        ...(instructions && { instructions }),
        ...(input_audio_transcription && { input_audio_transcription }),
        ...(turn_detection && { turn_detection }) // Allow both null and object values
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Realtime session error:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to create session: ${response.status}` },
        { status: response.status }
      );
    }

    const sessionData = await response.json();
    return NextResponse.json(sessionData);
  } catch (error) {
    console.error('Error creating OpenAI session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 