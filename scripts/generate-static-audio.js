#!/usr/bin/env node

/**
 * Audio Pre-Generation Script for V4 Mind Shifting
 *
 * This script generates all static audio files using local Paroli TTS server.
 * After running this script once per voice, you'll have static Opus files forever.
 *
 * Usage:
 *   1. Make sure Paroli is running: docker compose -f ~/paroli-local/paroli/docker-compose.local.yml up -d
 *   2. Run: node scripts/generate-static-audio.js [voice-name]
 *   3. Audio files will be saved to public/audio/v4/static/[voice-name]/
 *   4. Commit the audio files to your repo
 *   5. Update preloader to use static files instead of API
 *
 * Examples:
 *   node scripts/generate-static-audio.js rachel   # Generate with ljspeech voice
 *
 * Cost: $0 (self-hosted Paroli)
 * Output: Opus format (30% smaller than MP3, lower latency)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Static audio texts (mirrored from lib/v4/static-audio-texts.ts)
// IMPORTANT: Keep this in sync with the TypeScript source file
const V4_STATIC_AUDIO_TEXTS = {
  // Initial welcome message (shown when session starts) - SHORTENED
  // Note: This audio file will not be preloaded to save time  
  INITIAL_WELCOME: "Would you like to work on:\n\n1. PROBLEM\n2. GOAL\n3. NEGATIVE EXPERIENCE",

  // Problem Shifting opener
  PROBLEM_SHIFTING_INTRO: "Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. When I ask 'what needs to happen for the problem to not be a problem?' allow your answers to be different each time.",

  // Identity Shifting opener
  IDENTITY_SHIFTING_INTRO: "Please close your eyes and keep them closed throughout the rest of the process. Please tell me the first thing that comes up when I ask this question.",

  // Belief Shifting opener (same text as Problem Shifting)
  BELIEF_SHIFTING_INTRO: "Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. When I ask 'what needs to happen for the problem to not be a problem?' allow your answers to be different each time.",

  // Blockage Shifting opener
  BLOCKAGE_SHIFTING_INTRO: "Please close your eyes and keep them closed throughout the process. Please give brief answers to my questions and allow the problem to keep changing...we're going to keep going until there is no problem left.",

  // Reality Shifting opener
  REALITY_SHIFTING_INTRO: "Close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. If ever you feel your goal has changed just let me know.",

  // Trauma Shifting opener
  TRAUMA_SHIFTING_INTRO: "Please close your eyes and keep them closed throughout the rest of the process.",

  // Method Selection
  METHOD_SELECTION: "Which method would you like to use for this problem?\n\n1. Problem Shifting\n2. Identity Shifting\n3. Belief Shifting\n4. Blockage Shifting",

  // Method Selection for Digging Deeper
  METHOD_SELECTION_DIGGING: "We need to clear this problem. Which method would you like to use?\n\n1. Problem Shifting\n2. Identity Shifting\n3. Belief Shifting\n4. Blockage Shifting",

  // Work Type Descriptions
  WORK_TYPE_PROBLEM_DESC: "Tell me what the problem is in a few words.",
  WORK_TYPE_GOAL_DESC: "Tell me what the goal is in a few words.",
  WORK_TYPE_NEGATIVE_EXP_DESC: "Tell me what the negative experience was in a few words.",

  // Reality Shifting Questions
  REALITY_GOAL_CAPTURE: "What do you want?",
  REALITY_DEADLINE_CHECK: "Is there a deadline?",
  REALITY_DEADLINE_DATE: "When do you want to achieve this goal by?",
  REALITY_CERTAINTY: "How certain are you between 0% and 100% that you will achieve this goal?",

  // Discovery Phase
  RESTATE_PROBLEM: "OK so it is important we use your own words for the problem statement so please tell me what the problem is in a few words",

  // Digging Deeper
  RESTATE_PROBLEM_SHORT: "How would you state the problem in a few words?"
};

// Available voices configuration
// Note: Paroli uses the loaded model (ljspeech), voice name is just for organization
const VOICES = {
  rachel: {
    name: 'Rachel',
    description: 'ljspeech voice (high-quality English)'
  },
  // Add more voices when you load different models in Paroli
};

// Parse command line argument for voice
const voiceArg = process.argv[2] || 'rachel';
const selectedVoice = VOICES[voiceArg];

if (!selectedVoice) {
  console.error(`❌ Unknown voice: "${voiceArg}"`);
  console.error(`\nAvailable voices:`);
  Object.entries(VOICES).forEach(([key, voice]) => {
    console.error(`   ${key}: ${voice.name} - ${voice.description}`);
  });
  console.error(`\nUsage: node scripts/generate-static-audio.js [voice-name]`);
  process.exit(1);
}

// Configuration
const KOKORO_API_URL = process.env.KOKORO_API_URL || 'https://api.mind-shift.click/tts';
const VOICE_NAME = selectedVoice.name;
const OUTPUT_DIR = path.join(__dirname, `../public/audio/v4/static/${voiceArg}`);

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
  const filename = `${hash}.opus`;
  const filepath = path.join(OUTPUT_DIR, filename);

  // Skip if already exists
  if (fs.existsSync(filepath)) {
    console.log(`⏭️  Skipping "${key}" (already exists: ${filename})`);
    return { key, hash, filename, skipped: true };
  }

  console.log(`🎤 Generating "${key}"...`);
  console.log(`   Text: ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`);

  try {
    const response = await fetch(KOKORO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Paroli API error: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFileSync(filepath, buffer);
    console.log(`✅ Saved: ${filename} (${buffer.length} bytes)`);

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));

    return { key, hash, filename, skipped: false };
  } catch (error) {
    console.error(`❌ Failed to generate "${key}":`, error.message);
    return { key, hash, filename, skipped: false, error: error.message };
  }
}

/**
 * Generate a manifest file mapping text to audio files
 */
function generateManifest(results, voiceName) {
  const manifest = {};
  
  for (const result of results) {
    if (!result.error) {
      manifest[result.key] = {
        filename: result.filename,
        hash: result.hash,
        path: `/audio/v4/static/${voiceName}/${result.filename}`
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
  console.log('🎵 V4 Static Audio Generator (Kokoro)\n');
  console.log('=' .repeat(60));

  // Test Kokoro connection
  try {
    const healthUrl = KOKORO_API_URL.replace('/tts', '/health');
    const testResponse = await fetch(healthUrl);
    if (!testResponse.ok) {
      throw new Error(`Cannot connect to Kokoro at ${KOKORO_API_URL}`);
    }
    console.log(`✅ Connected to Kokoro: ${KOKORO_API_URL}`);
  } catch (error) {
    console.error('❌ Error: Cannot connect to Kokoro TTS server');
    console.error(`   Make sure Kokoro is running at: ${KOKORO_API_URL}`);
    console.error(`   Test with: curl https://api.mind-shift.click/health`);
    process.exit(1);
  }

  console.log(`Voice: ${VOICE_NAME}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Format: Opus`);
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
  const manifest = generateManifest(results, voiceArg);

  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 Summary:');
  console.log(`   Voice: ${VOICE_NAME}`);
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
  console.log(`   1. Commit the audio files: git add public/audio/v4/static/${voiceArg}/`);
  console.log('   2. Ensure V4AudioPreloader loads the correct voice manifest');
  console.log('   3. Deploy - users will download pre-generated Opus files');
  console.log('\n💰 Cost: $0 (self-hosted Paroli)');
  console.log('   Future cost: $0 (serving static files)');
  console.log('   Savings: ~$100-1000/month vs ElevenLabs at scale');
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
