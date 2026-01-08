# Audio Generation for V4 Treatment

This directory will contain pre-generated audio files for v4 treatment sessions.

## Why Static Audio?

Instead of calling the TTS API every time (expensive), we pre-generate all audio files once and serve them as static files in Opus format.

**Cost Comparison:**
- Dynamic TTS: ~10,000 credits per new user = $300-400 per 1,000 users
- Static audio: ~10,000 credits ONE TIME = $0 per user after initial generation

**Why Opus Format?**
- ✅ 30% smaller than MP3 at equivalent quality
- ✅ Lower latency (designed for real-time streaming)
- ✅ Better quality at low bitrates (24 kbps excellent for voice)
- ✅ Native browser support (Chrome, Firefox, Safari, Edge)

## How to Generate Audio

### Prerequisites

**See `ELEVENLABS_API_SETUP.md` in project root for detailed setup instructions.**

1. Set your ElevenLabs API key (NEVER commit to git!):
   ```bash
   export ELEVENLABS_API_KEY=your_api_key_here
   ```

2. Make sure you have credits (need ~10,000 credits for all 17 segments)
   - Check your balance at: https://elevenlabs.io/app/billing
   - Cost: ~$1-2 USD for complete generation

### Generate Files

```bash
# From the project root - Rachel voice (female)
node scripts/generate-static-audio.js rachel

# Or Adam voice (male)
node scripts/generate-static-audio.js adam
```

This will:
- Generate 17 Opus files using Rachel's voice (21m00Tcm4TlvDq8ikWAM)
- Create a `manifest.json` mapping text to audio files
- Store everything in this directory
- Cost: ~10,000 credits ONE TIME
- File size: ~2.5 MB total (30% smaller than MP3)

### What Gets Generated

```
public/audio/v4/static/
├── manifest.json           # Maps text → audio files
├── a1b2c3d4e5f6.opus      # INITIAL_WELCOME
├── f6e5d4c3b2a1.opus      # PROBLEM_SHIFTING_INTRO
├── ... (15 more Opus files)
└── total: ~2.5 MB (30% smaller than MP3)
```

### Commit the Files

After generation, commit them to your repo:

```bash
git add public/audio/v4/static/
git commit -m "feat: add pre-generated Rachel voice audio files (Opus format)"
git push
```

### Deploy

The updated preloader will automatically use these static files instead of calling the TTS API.

## Fallback Behavior

If the manifest is not found, the preloader automatically falls back to dynamic TTS generation. This ensures the app never breaks.

Check console logs:
- ✅ Static files: `💰 Cost: $0 (using static files)`
- ⚠️ Fallback: `Using dynamic TTS (will incur API costs)`

## When to Regenerate

Only regenerate if you:
1. Change the therapy scripts in `lib/v4/static-audio-texts.ts`
2. Want to use a different voice
3. Add new static segments

Otherwise, use the same files forever.

## Troubleshooting

### "quota_exceeded" error
You need to add credits to your ElevenLabs account or upgrade your plan.

### "API key not configured"
Set the environment variable: `export ELEVENLABS_API_KEY=your_key`

### Files not loading in browser
Make sure you committed the files and deployed them. Check Network tab for 404 errors.

## Documentation

See project root for detailed guides:
- `STATIC_AUDIO_SOLUTION.md` - Full technical guide
- `QUICK_START_STATIC_AUDIO.md` - Quick setup instructions
