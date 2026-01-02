# Adding New ElevenLabs Voices

## Quick Reference

**ElevenLabs API Key:** `sk_a9cd0f0f45780ea86840cdb5a9b636c186c4a58ec6d60879`

**Current Voices:**
| Name | Voice ID | ElevenLabs ID | Gender | Status |
|------|----------|---------------|--------|--------|
| Rachel | `rachel` | `21m00Tcm4TlvDq8ikWAM` | Female | ✅ Active (default) |
| Adam | `adam` | `pNInz6obpgDQGcFmaJgB` | Male | ✅ Active |

---

## How the Voice System Works

The voice system has two parts:
1. **Pre-rendered static audio** - Downloaded once, costs $0 after generation
2. **Streaming TTS** - For dynamic text, costs credits per use

Both use the same ElevenLabs voice ID, configured in `AVAILABLE_VOICES`.

---

## Steps to Add a New Voice

### Step 1: Add Voice to the Selector (Required) ✅

**File:** `components/treatment/v4/TreatmentSession.tsx`

Find the `AVAILABLE_VOICES` array (around line 78) and add the new voice:

```typescript
const AVAILABLE_VOICES = [
  { id: 'rachel', name: 'Rachel', elevenLabsId: '21m00Tcm4TlvDq8ikWAM', description: 'Warm, professional female voice' },
  // ADD NEW VOICE HERE:
  { id: 'adam', name: 'Adam', elevenLabsId: 'pNInz6obpgDQGcFmaJgB', description: 'Deep, mature male voice' },
] as const;
```

**Note:** The voice selector UI automatically appears when there are 2+ voices in the array.

---

### Step 2: Generate Static Audio Files (Recommended for $0 cost) 🔶

**File:** `scripts/generate-static-audio.js`

#### Option A: Per-Voice Folders (Recommended)
Generate separate folders for each voice to allow user selection:

```bash
# Set API key
export ELEVENLABS_API_KEY=sk_a9cd0f0f45780ea86840cdb5a9b636c186c4a58ec6d60879

# Generate for Rachel (default - already done)
node scripts/generate-static-audio.js rachel

# Generate for Adam (new)
node scripts/generate-static-audio.js adam
```

Output structure:
```
public/audio/v4/static/
├── rachel/
│   ├── manifest.json
│   └── *.mp3 files
└── adam/
    ├── manifest.json
    └── *.mp3 files
```

#### Option B: Default Voice Only
Only pre-generate for the default voice, stream others (costs ~$0.30/1K chars for non-default voices).

---

### Step 3: Update the Preloader (Only if using Option A) 🔶

**File:** `components/treatment/v4/V4AudioPreloader.tsx`

If you create separate folders per voice, update to accept a voice prop:

```typescript
interface V4AudioPreloaderProps {
  voice?: string; // 'rachel' | 'adam' etc.
}

export default function V4AudioPreloader({ voice = 'rachel' }: V4AudioPreloaderProps) {
  useEffect(() => {
    const preloadStaticAudio = async () => {
      // Load the manifest for the selected voice
      const manifestResponse = await fetch(`/audio/v4/static/${voice}/manifest.json`);
      // ... rest of logic
    };
    preloadStaticAudio();
  }, [voice]);
  
  return null;
}
```

Then update `app/dashboard/sessions/treatment-v4/page.tsx` to pass the voice preference.

---

### Step 4: Update TTS API Fallback (Optional) ⚪

**File:** `app/api/tts/route.ts`

The default voice ID is set at line 23. This is already handled by the `useNaturalVoice` hook passing the correct voiceId, but you could update the fallback default if desired.

---

## Files Summary

| File | Purpose | Required? |
|------|---------|-----------|
| `components/treatment/v4/TreatmentSession.tsx` | Add voice to `AVAILABLE_VOICES` array | ✅ **Yes** |
| `scripts/generate-static-audio.js` | Generate pre-loaded audio files | 🔶 Optional |
| `public/audio/v4/static/[voice]/` | Static audio files per voice | 🔶 Optional |
| `components/treatment/v4/V4AudioPreloader.tsx` | Load correct voice's static files | 🔶 Only if multi-voice static |
| `app/api/tts/route.ts` | TTS API default voice | ⚪ No |

---

## Checklist for Adding a New Voice

### Minimum (Streaming Only)
- [ ] Add voice to `AVAILABLE_VOICES` in `TreatmentSession.tsx`
- [ ] Test voice selection UI appears
- [ ] Test streaming TTS works with new voice

### Full (Pre-rendered + Streaming)
- [ ] Add voice to `AVAILABLE_VOICES` in `TreatmentSession.tsx`
- [ ] Update `scripts/generate-static-audio.js` to support voice parameter
- [ ] Run: `node scripts/generate-static-audio.js [voice-name]`
- [ ] Verify files in `public/audio/v4/static/[voice-name]/`
- [ ] Update `V4AudioPreloader.tsx` to accept voice prop
- [ ] Update treatment page to pass voice to preloader
- [ ] Commit audio files to git
- [ ] Test both static (pre-rendered) and streaming audio
- [ ] Deploy

---

## Quick Commands

```bash
# Set API key
export ELEVENLABS_API_KEY=sk_a9cd0f0f45780ea86840cdb5a9b636c186c4a58ec6d60879

# Generate audio for a specific voice
node scripts/generate-static-audio.js rachel
node scripts/generate-static-audio.js adam

# List generated files
ls -la public/audio/v4/static/

# Commit new voice files
git add public/audio/v4/static/
git commit -m "feat: add [voice-name] voice audio files"
```

---

## Available ElevenLabs Voices

### Female Voices
| Name | Voice ID | Description |
|------|----------|-------------|
| Rachel | `21m00Tcm4TlvDq8ikWAM` | Warm, professional (current default) |
| Bella | `EXAVITQu4vr4xnSDxMaL` | Soft, gentle |
| Elli | `MF3mGyEYCl7XYWbV9V6O` | Young, friendly |

### Male Voices
| Name | Voice ID | Description |
|------|----------|-------------|
| Adam | `pNInz6obpgDQGcFmaJgB` | Deep, mature American |
| Antoni | `ErXwobaYiN019PkySvjV` | Calm, conversational |
| Josh | `TxGEqnHWrfWFTfGW9XjX` | Warm American |
| Arnold | `VR6AewLTigWG4xSOukaG` | American, crisp articulation |
| Sam | `yoZ06aMxZJJ28mfd3POQ` | Clear, articulate |

---

## Cost Structure

| Action | ElevenLabs Credits | When |
|--------|-------------------|------|
| Generate static audio (per voice) | ~10,000 credits | ONE TIME per voice |
| Serve pre-rendered audio | $0 | Every user visit |
| Stream dynamic text | ~50-500 credits per segment | Only for non-static text |

**Bottom Line:** After running the generation script once per voice, all pre-rendered segments cost $0 forever.

---

## Troubleshooting

### "quota_exceeded" error
- Your ElevenLabs account needs more credits
- Each voice generation needs ~10,000 credits

### Voice selector not appearing
- Check that `AVAILABLE_VOICES` has 2+ entries
- UI only shows when multiple voices exist

### Wrong voice playing
- Check `selectedVoice` state and localStorage
- Verify `getElevenLabsVoiceId()` returns correct ID
- Check browser console for which voice ID is being used

### Static audio not loading
- Check browser Network tab for 404 errors
- Verify manifest.json exists at correct path
- Ensure audio files were committed and deployed
