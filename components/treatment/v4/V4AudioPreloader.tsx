'use client';

import { useEffect } from 'react';
import { globalAudioCache } from '@/services/voice/audioCache';
import { getAllUniqueStaticTexts } from '@/lib/v4/static-audio-texts';

/**
 * V4 Audio Preloader
 * 
 * Preloads all static audio segments for v4 treatment sessions.
 * This includes:
 * - Initial welcome message
 * - All modality openers (Problem, Goal, Negative Experience paths)
 * 
 * This ensures instant playback when Natural Voice is enabled.
 * Audio is cached globally and persists across component lifecycles.
 */

export default function V4AudioPreloader() {
  useEffect(() => {
    const preloadAllAudio = async () => {
      const textsToPreload = getAllUniqueStaticTexts();
      let successCount = 0;
      let skipCount = 0;
      let failCount = 0;

      console.log(`🎵 V4: Starting audio preload for ${textsToPreload.length} unique segments...`);

      // Preload each text segment
      for (const text of textsToPreload) {
        // Skip if already in cache
        if (globalAudioCache.has(text)) {
          skipCount++;
          continue;
        }

        try {
          const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              provider: 'elevenlabs',
              voice: '21m00Tcm4TlvDq8ikWAM', // Rachel voice
            }),
          });

          if (!response.ok) {
            throw new Error(`TTS request failed: ${response.status}`);
          }

          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          globalAudioCache.set(text, audioUrl);
          successCount++;
          
          // Log preview of what was cached (first 50 chars)
          const preview = text.substring(0, 50).replace(/\n/g, ' ') + '...';
          console.log(`   ✓ Cached: "${preview}"`);
        } catch (err) {
          failCount++;
          const preview = text.substring(0, 50).replace(/\n/g, ' ') + '...';
          console.error(`   ✗ Failed: "${preview}"`, err);
        }
      }

      console.log(`✅ V4 Audio preload complete!`);
      console.log(`   Successfully cached: ${successCount} new segment(s)`);
      console.log(`   Already cached: ${skipCount} segment(s)`);
      console.log(`   Failed: ${failCount} segment(s)`);
      console.log(`   Total cache size: ${globalAudioCache.size()} audio file(s)`);
    };

    // Start preloading immediately
    preloadAllAudio();
  }, []); // Empty deps = runs once on mount

  // This component doesn't render anything
  return null;
}

