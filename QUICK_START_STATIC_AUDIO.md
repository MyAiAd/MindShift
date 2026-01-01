# Quick Start: Eliminate TTS Costs

## Problem
You're paying for the same audio generation over and over. The therapy scripts don't change, so why keep paying?

## Solution
Generate the audio files **once** with Rachel's voice, serve them as static files, never pay again.

## 3-Step Setup (5 minutes)

### Step 1: Generate Audio (ONE TIME)

```bash
# Set your ElevenLabs API key
export ELEVENLABS_API_KEY=your_key_here

# Generate all 17 audio files
node scripts/generate-static-audio.js
```

**Cost:** ~10,000 credits one time (equivalent to $1-2)

**Output:** 17 MP3 files in `public/audio/v4/static/`

### Step 2: Commit the Files

```bash
git add public/audio/v4/static/
git commit -m "feat: add pre-generated Rachel voice audio files"
git push
```

### Step 3: Update Preloader

```bash
# Replace dynamic preloader with static version
mv components/treatment/v4/V4AudioPreloader.tsx components/treatment/v4/V4AudioPreloader-dynamic.backup
mv components/treatment/v4/V4AudioPreloader-static.tsx components/treatment/v4/V4AudioPreloader.tsx

git add components/treatment/v4/
git commit -m "feat: use static audio files instead of dynamic TTS"
git push
```

## Done!

**Before:**
- 💸 10,744 credits per new user
- 💸 Unsustainable costs

**After:**
- ✅ $0 per user
- ✅ Same Rachel voice quality
- ✅ Faster loading
- ✅ No quota issues

## If Scripts Change

Only regenerate if you update the therapy scripts:

```bash
# Update the text
vi lib/v4/static-audio-texts.ts

# Regenerate (only changed files)
node scripts/generate-static-audio.js

# Commit
git add public/audio/v4/static/ lib/v4/static-audio-texts.ts
git commit -m "update: regenerated audio for updated scripts"
```

## Verify It Works

After deploying, check console logs:

```javascript
✅ V4 Audio preload complete!
   Successfully cached: 17 segment(s)
   💰 Cost: $0 (using static files)
```

Instead of the old:

```javascript
❌ Failed: 16 segment(s)  // Quota exceeded
```

---

**Full Documentation:** See `STATIC_AUDIO_SOLUTION.md` for details.
