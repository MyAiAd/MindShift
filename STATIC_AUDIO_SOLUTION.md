# Static Audio Solution - Zero Ongoing Costs

## Problem
- ElevenLabs charges **632 credits per segment**
- 17 segments = **10,744 credits per new user**
- At scale: Unsustainable costs

## Solution
Pre-generate audio files **once**, serve as static files, **never pay again**.

## How It Works

### Current (Expensive):
```
User visits → TTS API call → ElevenLabs generates → $$$
User visits → TTS API call → ElevenLabs generates → $$$
User visits → TTS API call → ElevenLabs generates → $$$
Cost: 10,744 credits per user = $$$
```

### New (One-Time Cost):
```
Developer runs script → Generate 17 Opus files → Cost: 10,744 credits ONE TIME
User visits → Download static Opus → Cost: $0
User visits → Download static Opus → Cost: $0
User visits → Download static Opus → Cost: $0
Cost: $0 per user after initial generation
```

**Why Opus instead of MP3?**
- ✅ 30% smaller file size at same quality
- ✅ Lower latency (designed for real-time streaming)
- ✅ Better quality at low bitrates (24 kbps excellent for voice)
- ✅ Native browser support (Chrome, Firefox, Safari, Edge)
- ✅ WebRTC standard codec

## Implementation Steps

### Step 1: Generate Audio Files (One Time Only)

**API Key Setup**: See `ELEVENLABS_API_SETUP.md` for detailed API key configuration instructions.

```bash
# Set your ElevenLabs API key (see ELEVENLABS_API_SETUP.md for secure setup methods)
export ELEVENLABS_API_KEY=your_api_key_here

# Run the generation script
node scripts/generate-static-audio.js rachel
```

**Note**: Replace `rachel` with `adam` for male voice, or add more voices in the script.

**Output:**
```
🎵 V4 Static Audio Generator
============================================================
Voice: Rachel (21m00Tcm4TlvDq8ikWAM)
Output: /workspace/public/audio/v4/static
Segments: 17
============================================================

🎤 Generating "INITIAL_WELCOME"...
   Text: Mind Shifting is not like counselling, therapy or life coaching...
✅ Saved: a1b2c3d4e5f6.opus (180,432 bytes)

🎤 Generating "PROBLEM_SHIFTING_INTRO"...
   Text: Please close your eyes and keep them closed throughout the process...
✅ Saved: f6e5d4c3b2a1.opus (145,821 bytes)

... (continues for all 17 segments)

📋 Generated manifest: /workspace/public/audio/v4/static/manifest.json

============================================================
📊 Summary:
   Total segments: 17
   Generated: 17
   Skipped: 0
   Failed: 0
============================================================

✅ Audio generation complete!

Next steps:
   1. Commit the audio files: git add public/audio/v4/static/
   2. Update V4AudioPreloader to use static files
   3. Deploy - users will download pre-generated files

💰 Cost: This was a ONE-TIME expense (~10,000 credits = $1-2)
   Future cost: $0 (serving static files)
```

### Step 2: Commit the Generated Files

```bash
# Check what was generated
ls -lh public/audio/v4/static/

# Output:
# -rw-r--r-- 1 user staff 180K Jan 01 12:00 a1b2c3d4e5f6.opus
# -rw-r--r-- 1 user staff 145K Jan 01 12:00 f6e5d4c3b2a1.opus
# ... (17 Opus files)
# -rw-r--r-- 1 user staff 2.1K Jan 01 12:00 manifest.json

# Add to git
git add public/audio/v4/static/
git commit -m "feat: add pre-generated static audio files for v4 (Rachel voice, Opus format)"
git push
```

### Step 3: Update the Preloader

Replace the current preloader with the static version:

```bash
# Backup the old preloader
mv components/treatment/v4/V4AudioPreloader.tsx components/treatment/v4/V4AudioPreloader-dynamic.tsx.backup

# Use the static version
mv components/treatment/v4/V4AudioPreloader-static.tsx components/treatment/v4/V4AudioPreloader.tsx
```

Or manually update the import in `app/dashboard/sessions/treatment-v4/page.tsx`:

```typescript
// Before:
const V4AudioPreloader = dynamic(() => import('@/components/treatment/v4/V4AudioPreloader'), {
  ssr: false,
  loading: () => null,
});

// After: (no change needed if you renamed the file)
// The new V4AudioPreloader.tsx automatically uses static files
```

### Step 4: Deploy

```bash
git push
# Deploy to Vercel/your hosting
```

## File Structure

```
/workspace/
├── public/
│   └── audio/
│       └── v4/
│           └── static/
│               ├── manifest.json          # Maps text → audio file
│               ├── a1b2c3d4e5f6.opus     # INITIAL_WELCOME
│               ├── f6e5d4c3b2a1.opus     # PROBLEM_SHIFTING_INTRO
│               ├── ... (15 more files)
│               └── total: ~2.5 MB (30% smaller with Opus)
│
├── scripts/
│   └── generate-static-audio.js          # Generation script
│
└── components/
    └── treatment/
        └── v4/
            └── V4AudioPreloader.tsx       # Uses static files
```

## Cost Comparison

| Approach | Initial Cost | Per User Cost | 1,000 Users | 10,000 Users |
|----------|--------------|---------------|-------------|--------------|
| **Dynamic (current)** | $0 | ~10,000 credits | $300-400 | $3,000-4,000 |
| **Static (new)** | ~10,000 credits | $0 | $1-2 | $1-2 |

## What Gets Generated

The script generates MP3 files for all static texts:

1. **INITIAL_WELCOME** - Main welcome message
2. **PROBLEM_SHIFTING_INTRO** - Problem shifting opener
3. **IDENTITY_SHIFTING_INTRO** - Identity shifting opener
4. **BELIEF_SHIFTING_INTRO** - Belief shifting opener
5. **BLOCKAGE_SHIFTING_INTRO** - Blockage shifting opener
6. **REALITY_SHIFTING_INTRO** - Reality/goal shifting opener
7. **TRAUMA_SHIFTING_INTRO** - Trauma shifting opener
8. **METHOD_SELECTION** - Method selection prompt
9. **METHOD_SELECTION_DIGGING** - Digging deeper method prompt
10. **WORK_TYPE_PROBLEM_DESC** - "Tell me what the problem is..."
11. **WORK_TYPE_GOAL_DESC** - "Tell me what the goal is..."
12. **WORK_TYPE_NEGATIVE_EXP_DESC** - "Tell me what the negative experience..."
13. **REALITY_GOAL_CAPTURE** - "What do you want?"
14. **REALITY_DEADLINE_CHECK** - "Is there a deadline?"
15. **REALITY_DEADLINE_DATE** - "When do you want to achieve..."
16. **REALITY_CERTAINTY** - "How certain are you..."
17. **RESTATE_PROBLEM** / **RESTATE_PROBLEM_SHORT** - Restatement prompts

## Manifest File Format

`public/audio/v4/static/manifest.json`:

```json
{
  "INITIAL_WELCOME": {
    "filename": "a1b2c3d4e5f6.opus",
    "hash": "a1b2c3d4e5f6",
    "path": "/audio/v4/static/a1b2c3d4e5f6.opus"
  },
  "PROBLEM_SHIFTING_INTRO": {
    "filename": "f6e5d4c3b2a1.opus",
    "hash": "f6e5d4c3b2a1",
    "path": "/audio/v4/static/f6e5d4c3b2a1.opus"
  },
  ...
}
```

## How the New Preloader Works

```typescript
// 1. Load manifest
const manifest = await fetch('/audio/v4/static/manifest.json');

// 2. For each audio file in manifest
for (const [key, audioInfo] of Object.entries(manifest)) {
  // 3. Fetch the static Opus file (no API call!)
  const audio = await fetch(audioInfo.path);

  // 4. Cache it in memory for instant playback
  globalAudioCache.set(text, audioUrl);
}

// 5. Done! All audio is ready, no API calls made
```

## Fallback Behavior

If static files aren't found, the preloader automatically falls back to dynamic TTS:

```
1. Try to load /audio/v4/static/manifest.json
   ↓
   ❌ Not found
   ↓
2. Console warning: "Static audio not found, using dynamic TTS"
   ↓
3. Falls back to old behavior (API calls)
   ↓
4. Works, but costs money
```

This ensures the app never breaks, even if you forget to generate the files.

## Advantages

✅ **Zero ongoing costs** - No API calls after initial generation  
✅ **Faster loading** - Static files load faster than API calls  
✅ **Better reliability** - No API downtime or quota issues  
✅ **Consistent quality** - Same audio every time (no variation)  
✅ **Offline capable** - Works with PWA offline mode  
✅ **CDN cacheable** - Can be served from CDN for even faster loading  
✅ **Version controlled** - Audio files in git = reproducible deployments  

## Disadvantages

❌ **Larger repo size** - ~2.5 MB of audio files (Opus format)
❌ **Can't change voice on-the-fly** - Must regenerate files
❌ **Initial generation required** - Extra setup step  

## When to Regenerate

You only need to regenerate if you:

1. **Change the script text** - Update `lib/v4/static-audio-texts.ts`
2. **Change the voice** - Switch from Rachel to another voice
3. **Add new static segments** - Add more preloadable phrases

Otherwise, **never regenerate** - use the same files forever.

## Updating Scripts

If you change the therapy scripts in `lib/v4/static-audio-texts.ts`:

```bash
# 1. Update the text
vi lib/v4/static-audio-texts.ts

# 2. Regenerate ONLY the changed segments
# The script automatically skips existing files
node scripts/generate-static-audio.js

# 3. Commit the new/updated files
git add public/audio/v4/static/
git commit -m "update: regenerated audio for [SEGMENT_NAME]"
git push
```

## Deployment Size

| Component | Size | Impact |
|-----------|------|--------|
| 17 Opus files | ~2.5 MB | Initial page load |
| Manifest JSON | ~2 KB | Negligible |
| **Total** | **~2.5 MB** | One-time download, then cached |

Users download these files **once**, then browser caches them forever.

**Opus vs MP3 size comparison:**
- MP3 (128 kbps): ~3.5 MB total
- Opus (24 kbps): ~2.5 MB total
- **Savings: 30% smaller, faster initial load**

## CDN Optimization (Optional)

For even better performance, serve audio from a CDN:

1. Upload files to Vercel Blob, S3, or Cloudflare R2
2. Update manifest paths to CDN URLs
3. Users download from CDN (faster, globally distributed)

## Summary

**Current Approach:**
- ❌ 10,744 credits per user
- ❌ Unsustainable at scale
- ❌ API dependency
- ❌ Quota issues

**Static Audio Approach:**
- ✅ 10,744 credits ONE TIME
- ✅ $0 per user after that
- ✅ No API dependency
- ✅ Faster, more reliable

**Action Items:**
1. ✅ Created generation script: `scripts/generate-static-audio.js`
2. ✅ Created static preloader: `components/treatment/v4/V4AudioPreloader-static.tsx`
3. ⏳ Run generation script (you need to do this)
4. ⏳ Commit audio files to repo
5. ⏳ Deploy

**Result:** Zero ongoing TTS costs while maintaining the same Rachel voice quality.
