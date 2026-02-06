import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30; // Vercel timeout handling

/**
 * POST /api/transcribe
 * 
 * Proxy endpoint for audio transcription using Whisper service.
 * Accepts audio blob from frontend, forwards to Whisper service, returns transcript.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Read audio blob from request body
    const audioBlob = await request.blob();
    const audioSize = audioBlob.size;
    
    console.log(`[Transcribe] Received audio: ${audioSize} bytes`);
    
    // Get Whisper service URL from environment
    const whisperServiceUrl = process.env.WHISPER_SERVICE_URL;
    if (!whisperServiceUrl) {
      console.error('[Transcribe] WHISPER_SERVICE_URL not configured');
      return NextResponse.json(
        { error: 'Transcription service not configured' },
        { status: 500 }
      );
    }
    
    // Prepare multipart form data
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.wav');
    
    // Forward to Whisper service
    const headers: HeadersInit = {};
    if (process.env.WHISPER_API_KEY) {
      headers['X-API-Key'] = process.env.WHISPER_API_KEY;
    }
    
    console.log(`[Transcribe] Forwarding to Whisper service: ${whisperServiceUrl}`);
    
    const whisperResponse = await fetch(`${whisperServiceUrl}/transcribe`, {
      method: 'POST',
      headers,
      body: formData,
    });
    
    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error(`[Transcribe] Whisper service error (${whisperResponse.status}): ${errorText}`);
      
      return NextResponse.json(
        { 
          error: 'Transcription failed',
          details: errorText,
          status: whisperResponse.status
        },
        { status: 500 }
      );
    }
    
    // Parse Whisper response
    const whisperResult = await whisperResponse.json();
    
    // Calculate total processing time
    const processingTime = Date.now() - startTime;
    
    // Map to existing interface format
    const response = {
      transcript: whisperResult.transcript || '',
      confidence: whisperResult.language_probability || 0,
      language: whisperResult.language || 'en',
      duration: whisperResult.audio_duration || 0,
      // Additional metadata for debugging
      processing_time: processingTime,
      cached: whisperResult.cache_hit || false,
      segments: whisperResult.segments || [],
      real_time_factor: whisperResult.real_time_factor || 0,
    };
    
    console.log(
      `[Transcribe] Success: ${response.transcript.length} chars, ` +
      `${processingTime}ms, cached=${response.cached}, ` +
      `rtf=${response.real_time_factor}`
    );
    
    return NextResponse.json(response);
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[Transcribe] Error after ${processingTime}ms:`, error);
    
    return NextResponse.json(
      { 
        error: 'Transcription failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
