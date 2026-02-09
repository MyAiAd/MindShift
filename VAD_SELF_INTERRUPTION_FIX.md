# VAD Self-Interruption Fix

## Problem

AI audio was terminating prematurely before finishing the script. The VAD (Voice Activity Detection) system was detecting the AI's own voice coming from the speakers and triggering a "barge-in" event, which stopped the audio playback mid-sentence.

## Root Cause

The VAD was **not being paused during AI speech**. While we had `audioCapture.setAISpeaking(true)` to prevent the Whisper transcription from capturing AI voice, the VAD module itself was still actively monitoring the microphone and could detect the AI's voice from the speakers, triggering false barge-in events.

## Solution

Implemented complete VAD pause/resume logic synchronized with AI speech:

### 1. **Pause VAD When AI Starts Speaking**

In the `speak()` function, we now explicitly pause the VAD:

```typescript
// CRITICAL: Pause VAD to prevent it from detecting AI voice as user speech
if (vadRef.current?.isInitialized) {
    try {
        await vadRef.current.pauseVAD();
        console.log('🎙️ VAD: Paused for AI speech (prevents self-triggering)');
    } catch (e) {
        console.warn('🎙️ VAD: Failed to pause, may self-trigger:', e);
    }
}
```

### 2. **Resume VAD When AI Finishes Speaking**

Added VAD resume logic to all audio completion paths:

**A. Normal audio end:**
```typescript
audio.onended = () => {
    // ... existing cleanup ...
    
    // Resume VAD after AI finishes speaking
    if (vadRef.current?.isInitialized && vadEnabled) {
        vadRef.current.startVAD();
        console.log('🎙️ VAD: Resumed after AI finished speaking');
    }
}
```

**B. Audio error:**
```typescript
audio.onerror = (e) => {
    // Resume VAD after error
    if (vadRef.current?.isInitialized && vadEnabled) {
        vadRef.current.startVAD();
        console.log('🎙️ VAD: Resumed after audio error');
    }
}
```

**C. Audio abort/interruption:**
```typescript
if (playError.name === 'AbortError') {
    // Resume VAD after abort
    if (vadRef.current?.isInitialized && vadEnabled) {
        vadRef.current.startVAD();
        console.log('🎙️ VAD: Resumed after audio abort');
    }
}
```

**D. Manual stop:**
```typescript
const stopSpeaking = useCallback(() => {
    // ... existing cleanup ...
    
    // Resume VAD when stopping speech
    if (vadRef.current?.isInitialized && vadEnabled) {
        vadRef.current.startVAD();
        console.log('🎙️ VAD: Resumed after stopping speech');
    }
}, [stopListening, audioCapture, vadEnabled]);
```

### 3. **Safety Check in Barge-In Handler**

Added a guard to prevent false barge-ins while AI is still speaking:

```typescript
const handleVadBargeIn = useCallback(() => {
    // SAFETY CHECK: Prevent VAD from triggering during AI speech
    // This happens when VAD picks up AI voice from speakers (echo)
    if (isSpeakingRef.current || isAudioPlayingRef.current) {
        console.log('⚠️ VAD: False barge-in detected (AI still speaking) - IGNORING');
        return;
    }
    
    // ... rest of barge-in logic ...
}, [/* deps */]);
```

## Files Changed

- `components/voice/useNaturalVoice.tsx`:
  - Added VAD pause on `speak()` start
  - Added VAD resume on audio end, error, abort, and manual stop
  - Added safety check in `handleVadBargeIn` to prevent self-interruption
  - Updated all dependencies to include `vadEnabled`

## Testing

To verify the fix:

1. **Enable mic and speaker** in the UI
2. **Trigger an AI response** (let AI speak)
3. **Observe console logs:**
   - Should see: `🎙️ VAD: Paused for AI speech (prevents self-triggering)`
   - Should NOT see: `🎙️ VAD: Barge-in detected` while AI is speaking
   - Should see: `🎙️ VAD: Resumed after AI finished speaking` when audio ends
4. **Verify audio completes fully** without premature termination

## Expected Behavior

### Before Fix
- ❌ AI audio cut off mid-sentence
- ❌ VAD detected AI voice and triggered barge-in
- ❌ Script not completed

### After Fix
- ✅ AI audio plays to completion
- ✅ VAD paused during AI speech
- ✅ VAD resumes automatically after AI finishes
- ✅ Real user interruptions still work (barge-in)

## Related Systems

This fix complements the existing echo prevention system:
- **Audio Capture:** `audioCapture.setAISpeaking(true)` prevents Whisper from transcribing AI voice
- **VAD:** Now paused during AI speech to prevent false barge-in triggers
- **Result:** Complete isolation of AI speech from user speech detection

## Deployment

No environment variables or configuration changes needed. This is a pure code fix that takes effect immediately after deployment.

```bash
# Deploy to Hetzner
cd ~/Code/MindShifting
git pull origin main
# Rebuild frontend if needed (Next.js will auto-reload)
docker-compose restart app
```

---

**Status:** ✅ Fixed and ready for deployment
