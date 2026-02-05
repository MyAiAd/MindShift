# Audio Fix Quick Start Guide

**Goal:** Get users heard on first try (not 3-4 times)

---

## Step 1: Start Whisper Service (5 minutes)

```bash
cd /home/sage/Code/MindShifting/whisper-service

# Activate virtual environment
source venv/bin/activate

# Install dependencies if needed
pip install -r requirements.txt

# Start service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

**Test it:**
```bash
# In another terminal
curl http://localhost:8000/health
# Should return: {"status":"healthy","model":"base"}
```

---

## Step 2: Enable Whisper in Environment (1 minute)

Edit `.env.local`:

```bash
# Change this line from:
NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=webspeech

# To:
NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=whisper
```

---

## Step 3: Integrate Audio Capture (30 minutes)

### 3a. Update useNaturalVoice.tsx

**File:** `components/voice/useNaturalVoice.tsx`

Add import at top (around line 6):
```typescript
import { useAudioCapture } from './useAudioCapture';
```

Replace Web Speech Recognition initialization (around line 45-48):
```typescript
// OLD CODE (DELETE):
// const isMicEnabled = micEnabled !== undefined ? micEnabled : enabled;
// const isSpeakerEnabled = speakerEnabled !== undefined ? speakerEnabled : enabled;

// NEW CODE (ADD):
const isMicEnabled = micEnabled !== undefined ? micEnabled : enabled;
const isSpeakerEnabled = speakerEnabled !== undefined ? speakerEnabled : enabled;

// Feature flag: Use Whisper or Web Speech
const useWhisper = process.env.NEXT_PUBLIC_TRANSCRIPTION_PROVIDER === 'whisper';
```

Add audio capture hook (around line 200, before VAD initialization):
```typescript
// Audio capture for Whisper transcription
const audioCapture = useAudioCapture({
    enabled: isMicEnabled && useWhisper,
    onTranscript: (transcript) => {
        console.log('🎤 Whisper transcript:', transcript);
        onTranscriptRef.current(transcript);
    },
    vadTrigger: false, // We'll handle VAD separately
});
```

Update VAD barge-in handler (around line 106):
```typescript
const handleVadBargeIn = useCallback(() => {
    console.log('🎙️ VAD: Barge-in detected - user interrupted AI');
    
    // CRITICAL SAFETY CHECK: If in test mode, don't trigger real barge-in
    if (testMode) {
        console.log('🧪 VAD: Test mode active - redirecting to test handler');
        handleTestModeInterruption();
        return;
    }
    
    // Stop AI audio immediately
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
    }
    
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    isAudioPlayingRef.current = false;
    
    // Clear any paused state
    if (pausedAudioRef.current) {
        pausedAudioRef.current = null;
        setIsPaused(false);
    }
    
    // NEW: If using Whisper, process buffered audio immediately
    if (useWhisper && audioCapture.isCapturing) {
        console.log('🎙️ VAD: Processing buffered audio via Whisper');
        audioCapture.processNow();
        return;
    }
    
    // OLD: Fall back to Web Speech fast-start (if not using Whisper)
    if (recognitionRef.current) {
        try {
            recognitionRef.current.stop();
        } catch (e) {
            console.log('🎙️ VAD: Recognition already stopped');
        }
    }
    
    // Fast-start retry loop for Web Speech
    const attemptStart = (attemptNumber: number, maxAttempts: number = 10, maxTotalTime: number = 500) => {
        const startTime = Date.now();
        
        if (attemptNumber >= maxAttempts || (Date.now() - startTime) > maxTotalTime) {
            console.log(`🎙️ VAD: Fast-start exhausted (${attemptNumber} attempts), falling back to normal restart`);
            setTimeout(() => {
                if (isMountedRef.current && prevMicEnabledRef.current) {
                    startListening();
                }
            }, 100);
            return;
        }
        
        if (!isMountedRef.current || !prevMicEnabledRef.current) {
            return;
        }
        
        try {
            recognitionRef.current?.start();
            console.log(`🎙️ VAD: Fast-start succeeded on attempt ${attemptNumber + 1}`);
        } catch (e) {
            const retryDelay = attemptNumber === 0 ? 0 : Math.min(25 + (attemptNumber * 10), 50);
            setTimeout(() => attemptStart(attemptNumber + 1, maxAttempts, maxTotalTime), retryDelay);
        }
    };
    
    attemptStart(0);
}, [testMode, handleTestModeInterruption, useWhisper, audioCapture]);
```

Update return statement (around line 836):
```typescript
return {
    isListening: useWhisper ? audioCapture.isCapturing : isListening,
    isSpeaking,
    isPaused,
    speak,
    prefetch,
    error: error || (useWhisper ? audioCapture.error : null),
    vadError,
    startListening,
    stopListening,
    stopSpeaking,
    pauseSpeaking,
    resumeSpeaking,
    hasPausedAudio,
    clearAudioFlags,
    interimTranscript: useWhisper ? '' : interimTranscript,
    listeningState: useWhisper 
        ? (audioCapture.isCapturing ? 'listening' : 'idle')
        : listeningState,
};
```

---

## Step 4: Test (15 minutes)

### Test 1: Basic Transcription

1. Start dev server: `npm run dev`
2. Open app: http://localhost:3000
3. Enable microphone
4. Say: "Hello, this is a test"
5. **Check console** for: `🎤 Whisper transcript: Hello, this is a test`

✅ **Pass criteria:** Transcript appears within 1-2 seconds

---

### Test 2: Barge-In (CRITICAL)

1. Enable mic + speaker
2. Start a treatment session
3. Wait for AI to start speaking
4. **Interrupt AI mid-sentence** with: "Wait, I need to tell you something important"
5. Check that:
   - ✅ AI stops immediately
   - ✅ **ENTIRE statement is captured** (not just "important")
   - ✅ Conversation continues naturally

**This is the key test!** If you capture the full statement without the user repeating, the fix works!

---

### Test 3: Rapid Speech

1. Enable microphone
2. Say quickly: "One. Two. Three. Four. Five."
3. Check all numbers appear in transcript

✅ **Pass criteria:** No numbers lost

---

### Test 4: Silent Audio

1. Enable microphone
2. Don't speak for 5 seconds
3. Check no spurious transcripts appear

✅ **Pass criteria:** No empty or random transcripts

---

## Step 5: Monitor (Ongoing)

### Console Logs to Watch

**Good signs:**
```
🎙️ AudioCapture: Initialized successfully
🎙️ AudioCapture: Processing 45.3KB of audio
🎤 Whisper transcript: [user's actual words]
[Transcribe] Success: 23 chars, 456ms, cached=false, rtf=0.234
```

**Bad signs:**
```
❌ [Transcribe] Whisper service error (500)
❌ 🎙️ AudioCapture: Processing error: Transcription failed
❌ 🎙️ AudioCapture: Failed to initialize: NotAllowedError
```

### Performance Metrics

Track in console:
- **Latency:** Should be 300-700ms (vs 500-1000ms with Web Speech)
- **Real-time factor:** Should be < 0.5 (processing faster than real-time)
- **Accuracy:** 95%+ (vs 60-70% with Web Speech)

---

## Troubleshooting

### "AudioWorklet not loading"

**Error in console:** `Failed to load audio-capture-processor.js`

**Fix:**
```bash
# Verify file exists
ls -la public/audio-capture-processor.js

# Restart dev server
npm run dev
```

---

### "Whisper service not responding"

**Error:** `[Transcribe] Whisper service error (500)`

**Fix:**
```bash
# Check if service is running
curl http://localhost:8000/health

# If not running, start it
cd whisper-service
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

### "No transcripts appearing"

**Issue:** Audio captured but nothing happens

**Debug checklist:**
1. Check Whisper service is running: `curl http://localhost:8000/health`
2. Check `.env.local` has: `NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=whisper`
3. Check console for audio capture logs
4. Check network tab for `/api/transcribe` requests

---

### "Transcripts are empty"

**Issue:** Response comes back but transcript is blank

**Possible causes:**
1. Speaking too quietly → Speak louder or closer to mic
2. Audio too short → Whisper needs ~0.5s minimum
3. Background noise only → Ensure actual speech is captured

**Debug:**
```typescript
// Add to useAudioCapture.ts after line 134
console.log('📊 Response data:', data);
console.log('📊 Transcript length:', data.transcript.length);
console.log('📊 Confidence:', data.confidence);
```

---

## Rollback (If Needed)

If things break, immediately revert:

```bash
# Edit .env.local
NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=webspeech

# Restart dev server
npm run dev
```

This switches back to Web Speech API (the old, buggy behavior) while you debug.

---

## Success Criteria

✅ **Before:**
- Users repeat 3-4 times
- Visible frustration
- ~60-70% accuracy

✅ **After:**
- Users speak once
- Smooth conversation
- ~95% accuracy

**Key metric:** Users no longer say "Did you hear me?" or repeat themselves!

---

## Next Steps After Success

1. **Test thoroughly** for 1-2 days
2. **Deploy to staging** environment
3. **Enable for 10% of users** (if you have feature flags)
4. **Monitor error rates** and user feedback
5. **Roll out to 100%** if stable
6. **Remove Web Speech code** (cleanup)

---

## Questions?

- **Root cause:** See `AUDIO_ISSUE_ROOT_CAUSE.md`
- **Implementation details:** See `whisperVersion.md`
- **Alternative approach:** See `deepgram.md`
- **Original analysis:** See `audioIssues.md`

---

**Status:** Ready to implement. Estimated time: 1 hour.
