'use client';

import { useEffect } from 'react';
import { globalAudioCache } from '@/services/voice/audioCache';

/**
 * V4 Audio Preloader
 * 
 * Preloads the introduction audio for v4 treatment sessions.
 * This ensures instant playback when Natural Voice is first enabled.
 * Audio is cached globally and persists across component lifecycles.
 */

// The exact intro text from TreatmentSession.tsx
const V4_INTRO_TEXT = "Mind Shifting is not like counselling, therapy or life coaching. The Mind Shifting methods are verbal guided processes that we apply to problems, goals, or negative experiences in order to clear them. The way Mind Shifting works is we won't just be talking about what you want to work on, we will be applying Mind Shifting methods in order to clear them, and to do that we will need to define what you want to work on into a clear statement by you telling me what it is in a few words. So I'll be asking you to do that when needed.\n\nWhen you are ready to begin, would you like to work on:\n\n1. PROBLEM\n2. GOAL\n3. NEGATIVE EXPERIENCE";

export default function V4AudioPreloader() {
  useEffect(() => {
    // Only preload if not already in cache
    if (globalAudioCache.has(V4_INTRO_TEXT)) {
      console.log('🎵 V4 Intro audio already cached');
      return;
    }

    const preloadIntro = async () => {
      try {
        console.log('🎵 V4: Starting intro audio preload...');
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: V4_INTRO_TEXT,
            provider: 'elevenlabs',
            voice: '21m00Tcm4TlvDq8ikWAM', // Rachel voice
          }),
        });

        if (!response.ok) {
          throw new Error(`TTS request failed: ${response.status}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        globalAudioCache.set(V4_INTRO_TEXT, audioUrl);
        
        console.log('✅ V4: Intro audio preloaded and cached globally');
        console.log(`   Cache size: ${globalAudioCache.size()} audio file(s)`);
      } catch (err) {
        console.error('❌ V4: Failed to preload intro audio:', err);
      }
    };

    // Start preloading immediately
    preloadIntro();
  }, []); // Empty deps = runs once on mount

  // This component doesn't render anything
  return null;
}

