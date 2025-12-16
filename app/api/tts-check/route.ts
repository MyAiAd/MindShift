import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY;
    
    // Show partial key for debugging (first 8 chars only)
    const openAIKeyPreview = process.env.OPENAI_API_KEY 
      ? `${process.env.OPENAI_API_KEY.substring(0, 8)}...` 
      : 'NOT SET';
    
    return NextResponse.json({
      openai: {
        configured: hasOpenAI,
        keyPreview: openAIKeyPreview,
        keyLength: process.env.OPENAI_API_KEY?.length || 0
      },
      elevenlabs: {
        configured: hasElevenLabs
      },
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV
    });
  } catch (error) {
    return NextResponse.json({ error: 'Check failed' }, { status: 500 });
  }
}
