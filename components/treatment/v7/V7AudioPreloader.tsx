'use client';

import { useEffect } from 'react';
import { globalAudioCache } from '@/services/voice/audioCache';
import { V7_STATIC_AUDIO_TEXTS } from '@/lib/v7/static-audio-texts';
import { getVoiceCacheName } from '@/lib/voice/voice-cache-name';

/**
 * V7 Audio Preloader - Static File Version (Multi-Voice Support)
 * 
 * Preloads all static audio segments for v7 treatment sessions from pre-generated files.
 * This eliminates the need for TTS API calls, reducing costs to $0.
 * 
 * How it works:
 * 1. Audio files are pre-generated once per voice using scripts/generate-static-audio.js
 * 2. Files are stored in public/audio/v7/static/[voice-name]/
 * 3. This component loads the manifest for the selected voice and preloads the files
 * 4. Users download static MP3 files (no API calls = no cost)
 * 
 * Cost: $0 per user (vs ~10,000 credits per user with dynamic generation)
 */

// Manifest shape accepted by V7AudioPreloader. Supports both the legacy Kokoro-era format
// (keyed entries) and the new US-012 format (top-level voice + model + entries[] array).
type AudioManifestEntry = {
  filename?: string;
  hash: string;
  path?: string;
  checksum?: string;
  formats?: Record<string, {
    filename: string;
    path: string;
    mime?: string;
  }>;
};

type LegacyAudioManifest = Record<string, AudioManifestEntry>;

type NewAudioManifest = {
  voice: string;
  model: string;
  generated_at: string;
  entries: Array<{
    key: string;
    text: string;
    file: string;
    hash: string;
    checksum: string;
    path: string;
    size_bytes?: number;
  }>;
};

type AudioManifest = LegacyAudioManifest | NewAudioManifest;

function isNewFormatManifest(m: AudioManifest): m is NewAudioManifest {
  return typeof (m as NewAudioManifest).voice === 'string'
    && Array.isArray((m as NewAudioManifest).entries);
}

interface V7AudioPreloaderProps {
  voice?: string; // 'heart' | 'michael' etc.
}

export default function V7AudioPreloader({ voice = 'heart' }: V7AudioPreloaderProps) {
  useEffect(() => {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOSClient =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent));

    const preloadStaticAudio = async () => {
      let successCount = 0;
      let skipCount = 0;
      let failCount = 0;
      const selectedFormatsCount: Record<string, number> = {};

      const normalizeAudioBlobType = (blob: Blob, selectedFormat?: string): Blob => {
        if (selectedFormat === 'wav') {
          return blob.slice(0, blob.size, 'audio/wav');
        }

        const unsupportedOrGenericType = !blob.type ||
          blob.type === 'audio/opus' ||
          blob.type === 'application/opus' ||
          blob.type === 'application/octet-stream';

        if (!unsupportedOrGenericType) {
          return blob;
        }

        return blob.slice(0, blob.size, 'audio/ogg; codecs=opus');
      };

      const chooseBestFormat = (entry: AudioManifestEntry): { format: string; path: string; filename: string } | null => {
        const formats = entry.formats || {};
        const audioProbe = typeof Audio !== 'undefined' ? new Audio() : null;
        const supportsOggOpus = Boolean(audioProbe?.canPlayType('audio/ogg; codecs=opus'));
        const supportsWav = Boolean(audioProbe?.canPlayType('audio/wav'));

        const orderedCandidates = isIOSClient
          ? ['wav', 'opus']
          : supportsOggOpus
            ? ['opus', 'wav']
            : supportsWav
              ? ['wav', 'opus']
              : ['opus', 'wav'];

        for (const candidate of orderedCandidates) {
          const info = formats[candidate];
          if (info?.path) {
            return { format: candidate, path: info.path, filename: info.filename };
          }
        }

        if (entry.path && entry.filename) {
          return { format: 'legacy', path: entry.path, filename: entry.filename };
        }

        return null;
      };

      console.log(`🎵 V7: Starting audio preload for voice "${voice}" from static files...`);

      try {
        // Load the manifest for the selected voice
        const manifestResponse = await fetch(`/audio/v7/static/${voice}/manifest.json`);

        if (!manifestResponse.ok) {
          // US-013: missing manifest is a soft failure — log and exit. TreatmentSession streams
          // every prompt via /api/tts when the cache is empty.
          console.log(JSON.stringify({
            event: 'v7_static_audio_manifest_missing',
            runtime_voice: voice,
            status: manifestResponse.status,
          }));
          return;
        }

        const manifest: AudioManifest = await manifestResponse.json();

        // US-013: voice-mismatch guard. If the manifest was generated for a different voice, we
        // refuse to load it (preloading foreign audio into a voice-prefixed cache would silently
        // mix voices).
        if (isNewFormatManifest(manifest) && manifest.voice !== voice) {
          console.log(JSON.stringify({
            event: 'v7_static_audio_voice_mismatch',
            manifest_voice: manifest.voice,
            runtime_voice: voice,
          }));
          return;
        }

        // Flatten into the legacy keyed shape so the rest of the loop is unchanged.
        const entries: Array<[string, AudioManifestEntry]> = isNewFormatManifest(manifest)
          ? manifest.entries.map((e) => [e.key, {
              filename: e.file,
              hash: e.hash,
              path: e.path,
              checksum: e.checksum,
            } as AudioManifestEntry])
          : Object.entries(manifest);

        const manifestKeys = entries.map(([k]) => k);
        if (isNewFormatManifest(manifest)) {
          console.log(`📋 Loaded manifest for "${voice}" (model=${manifest.model}, generated=${manifest.generated_at}) with ${manifestKeys.length} audio files`);
        } else {
          console.log(`📋 Loaded manifest for "${voice}" with ${manifestKeys.length} audio files`);
        }

        for (const [key, audioInfo] of entries) {
          // Skip INITIAL_WELCOME to save initial load time (it's now very short)
          if (key === 'INITIAL_WELCOME') {
            skipCount++;
            console.log(`   ⏭️  Skipped: INITIAL_WELCOME (will generate on-demand if needed)`);
            continue;
          }

          const text = V7_STATIC_AUDIO_TEXTS[key as keyof typeof V7_STATIC_AUDIO_TEXTS];
          
          if (!text) {
            console.warn(`⚠️ Unknown key in manifest: ${key}`);
            continue;
          }

          // US-006: use the shared helper so preloader keys align with runtime cache keys.
          const cacheKey = `${getVoiceCacheName(voice)}:${text}`;

          // Skip if already in cache
          if (globalAudioCache.has(cacheKey)) {
            skipCount++;
            continue;
          }

          try {
            const selected = chooseBestFormat(audioInfo);
            if (!selected) {
              throw new Error(`No compatible format found for key "${key}"`);
            }

            // Fetch the selected static audio file
            const audioResponse = await fetch(selected.path);
            
            if (!audioResponse.ok) {
              throw new Error(`Failed to load ${selected.filename}: ${audioResponse.status}`);
            }

            const audioBlob = normalizeAudioBlobType(await audioResponse.blob(), selected.format);
            const audioUrl = URL.createObjectURL(audioBlob);
            globalAudioCache.set(cacheKey, audioUrl);
            successCount++;
            selectedFormatsCount[selected.format] = (selectedFormatsCount[selected.format] || 0) + 1;
            
            // Log preview of what was cached
            const preview = text.substring(0, 50).replace(/\n/g, ' ');
            const ellipsis = text.length > 50 ? '...' : '';
            console.log(`   ✓ Cached: "${preview}${ellipsis}"`);
          } catch (err) {
            failCount++;
            const preview = text.substring(0, 50).replace(/\n/g, ' ');
            console.error(`   ✗ Failed: "${preview}..."`, err);
          }
        }

        console.log(`✅ V7 Audio preload complete for "${voice}"!`);
        console.log(`   Successfully cached: ${successCount} segment(s)`);
        console.log(`   Already cached: ${skipCount} segment(s)`);
        console.log(`   Failed: ${failCount} segment(s)`);
        console.log(`   Selected formats:`, selectedFormatsCount);
        console.log(`   Total cache size: ${globalAudioCache.size()} audio file(s)`);
        console.log(`   💰 Cost: $0 (using static files)`);
      } catch (err) {
        console.error('❌ Failed to load audio manifest:', err);
        console.error('   Audio preloading disabled - no dynamic TTS fallback (prevents charges)');
        // No fallback to dynamic TTS - prevents accidental API charges
      }
    };

    // Start preloading (static files only - no API fallback)
    // Note: Using voice-prefixed cache keys allows multiple voices to be cached simultaneously
    preloadStaticAudio();
  }, [voice]); // Re-run when voice changes

  // This component doesn't render anything
  return null;
}
