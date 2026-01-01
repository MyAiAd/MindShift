#!/usr/bin/env node

/**
 * Audio Pre-Generation Script for V4 Mind Shifting
 * 
 * This script generates all static audio files ONCE using ElevenLabs (Rachel voice).
 * After running this script once, you'll never need to pay for these segments again.
 * 
 * Usage:
 *   1. Make sure ELEVENLABS_API_KEY is set in your environment
 *   2. Run: node scripts/generate-static-audio.js
 *   3. Audio files will be saved to public/audio/v4/static/
 *   4. Commit the audio files to your repo
 *   5. Update preloader to use static files instead of API
 * 
 * Cost: ~10,000 credits ONE TIME (equivalent to $1-2)
 * Future cost: $0 (serving static files)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Import the static texts
const { V4_STATIC_AUDIO_TEXTS } = require('../lib/v4/static-audio-texts');

// Configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel (Premium voice)
const OUTPUT_DIR = path.join(__dirname, '../public/audio/v4/static');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`✅ Created output directory: ${OUTPUT_DIR}`);
}

/**
 * Generate a hash for the text to use as filename
 */
function generateHash(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

/**
 * Generate audio for a single text segment
 */
async function generateAudio(key, text) {
  const hash = generateHash(text);
  const filename = `${hash}.mp3`;
  const filepath = path.join(OUTPUT_DIR, filename);

  // Skip if already exists
  if (fs.existsSync(filepath)) {
    console.log(`⏭️  Skipping "${key}" (already exists: ${filename})`);
    return { key, hash, filename, skipped: true };
  }

  console.log(`🎤 Generating "${key}"...`);
  console.log(`   Text: ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`);

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`, {
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
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFileSync(filepath, buffer);
    console.log(`✅ Saved: ${filename} (${buffer.length} bytes)`);

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));

    return { key, hash, filename, skipped: false };
  } catch (error) {
    console.error(`❌ Failed to generate "${key}":`, error.message);
    return { key, hash, filename, skipped: false, error: error.message };
  }
}

/**
 * Generate a manifest file mapping text to audio files
 */
function generateManifest(results) {
  const manifest = {};
  
  for (const result of results) {
    if (!result.error) {
      manifest[result.key] = {
        filename: result.filename,
        hash: result.hash,
        path: `/audio/v4/static/${result.filename}`
      };
    }
  }

  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n📋 Generated manifest: ${manifestPath}`);
  
  return manifest;
}

/**
 * Main execution
 */
async function main() {
  console.log('🎵 V4 Static Audio Generator\n');
  console.log('=' .repeat(60));

  if (!ELEVENLABS_API_KEY) {
    console.error('❌ Error: ELEVENLABS_API_KEY environment variable is not set');
    console.error('   Set it with: export ELEVENLABS_API_KEY=your_api_key');
    process.exit(1);
  }

  console.log(`Voice: Rachel (${VOICE_ID})`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Segments: ${Object.keys(V4_STATIC_AUDIO_TEXTS).length}`);
  console.log('=' .repeat(60));
  console.log('');

  const results = [];

  // Generate audio for each segment
  for (const [key, text] of Object.entries(V4_STATIC_AUDIO_TEXTS)) {
    const result = await generateAudio(key, text);
    results.push(result);
  }

  // Generate manifest
  const manifest = generateManifest(results);

  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 Summary:');
  console.log(`   Total segments: ${results.length}`);
  console.log(`   Generated: ${results.filter(r => !r.skipped && !r.error).length}`);
  console.log(`   Skipped: ${results.filter(r => r.skipped).length}`);
  console.log(`   Failed: ${results.filter(r => r.error).length}`);
  console.log('=' .repeat(60));

  // Show failed segments if any
  const failed = results.filter(r => r.error);
  if (failed.length > 0) {
    console.log('\n❌ Failed segments:');
    failed.forEach(f => console.log(`   - ${f.key}: ${f.error}`));
  }

  console.log('\n✅ Audio generation complete!');
  console.log('\nNext steps:');
  console.log('   1. Commit the audio files: git add public/audio/v4/static/');
  console.log('   2. Update V4AudioPreloader to use static files');
  console.log('   3. Deploy - users will download pre-generated files');
  console.log('\n💰 Cost: This was a ONE-TIME expense');
  console.log('   Future cost: $0 (serving static files)');
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
