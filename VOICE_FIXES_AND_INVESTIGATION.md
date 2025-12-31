# Voice Recognition Fixes & Investigation Summary

## Date: December 31, 2025

---

## ✅ COMPLETED FIXES

### 1. Audio Preloader Provider Mismatch (FIXED)
**Problem:** Preloader used OpenAI, treatment used ElevenLabs
**Solution:** Changed preloader to use ElevenLabs with Rachel voice
**Result:** Audio now preloads successfully (✓ Cached: messages in console)

### 2. Audio Preloader Location (FIXED)
**Moved from:** Global dashboard layout
**Moved to:** Sessions page + all treatment pages
**Result:** Audio only loads when needed, better resource management

### 3. Voice Recognition Race Conditions (FIXED)
**Fixed Issues:**
- Cleanup running on every render (removed `naturalVoice` from deps)
- Speech Recognition recreating constantly (using refs for callbacks)
- Multiple auto-restart loops (added `isMountedRef` tracking)

### 4. Audio Feedback Loop Prevention (FIXED - Option B)
**Implementation:**
- Added `isAudioPlayingRef` to track actual audio playback
- Recognition won't start while audio is playing
- Force-clear on user input for rapid interaction support
- No artificial delays for UX

**Key Code:**
```typescript
// Set when audio actually starts playing
audio.onplay = () => {
  isAudioPlayingRef.current = true;
};

// Clear when audio ends
audio.onended = () => {
  isAudioPlayingRef.current = false;
  // Then restart recognition
};

// Check before starting recognition
if (!isAudioPlayingRef.current) {
  recognitionRef.current.start(); // Safe
}

// Force-clear on user input
naturalVoice.stopSpeaking(); // Clears isAudioPlayingRef
```

### 5. Play Button Overlay (FIXED)
**Added:**
- Full-screen overlay with "Start Session" button
- Ensures audio is preloaded before starting
- Beautiful animated Brain icon
- Mobile-responsive design
- User-initiated session start

### 6. Mobile Send Button (FIXED)
**Changed:**
- Mobile: Icon only (paper plane)
- Desktop: Icon + "Send" text
- Better UX for mobile users

### 7. Mobile Sessions Menu (FIXED)
**Updated Options:**
1. Start Session in-app (launches v4)
2. Book a Live Session (human coach)
3. Clear Stats

---

## 🔴 CURRENT ISSUE: 500 Error on Session Start

### Error Details:
```
POST /api/treatment-v4 500 (Internal Server Error)
V4 Start session error: Error: V4 HTTP error! status: 500
```

### What's Working:
- ✅ Audio preloading (17 segments cached successfully)
- ✅ Play button overlay shows correctly
- ✅ User can click "Start Session"

### What's Failing:
- ❌ Backend API call to `/api/treatment-v4` with `action: 'start'`

### Possible Causes:

1. **State Machine Initialization Error**
   - `TreatmentStateMachine` constructor failing
   - Missing dependency or import
   - Database connection issue

2. **Database Operation Failure**
   - `saveSessionToDatabase()` failing
   - Profile lookup failing
   - RLS policy blocking insert
   - Missing tenant_id for non-super-admin users

3. **Context Creation Error**
   - `treatmentMachine.getOrCreateContextAsync()` failing
   - Database read/write issue

4. **Environment Variable Missing**
   - Though this seems less likely since auth worked

### Investigation Steps Needed:

1. Check Vercel function logs for the actual error message
2. Check if `treatment_sessions` table insert is working
3. Verify RLS policies allow session creation
4. Check if v4 state machine has any initialization requirements

### Temporary Workaround (If Needed):
Add better error handling in `handleStartSession()` to return specific error messages instead of generic 500.

---

## 📋 REMAINING AUDIO FEEDBACK ISSUE

### The Good News:
The Option B implementation should prevent the feedback loop once the 500 error is fixed.

### How Option B Handles Rapid Interaction:

**Scenario 1: User clicks button while audio playing**
1. Audio playing → `isAudioPlayingRef = true`
2. User clicks → `stopSpeaking()` called
3. Flag cleared → recognition can restart ✅
4. New audio starts → flag set again

**Scenario 2: User rapid-fires through multiple steps**
1. Each click calls `stopSpeaking()` 
2. Flag cleared each time
3. Recognition restarts after final audio ends ✅
4. No blocking or stuck states

**Scenario 3: Normal conversation flow**
1. AI speaks → flag = true → mic OFF ✅
2. Audio ends → flag = false → mic ON ✅
3. User speaks → transcript captured ✅
4. Loop continues smoothly

### What to Test Once 500 Error is Fixed:
- [ ] Start session with voice OFF → should work normally
- [ ] Start session with voice ON → should speak without feedback
- [ ] Rapid-click through intro → should not get stuck
- [ ] Let AI finish speaking → mic should restart cleanly
- [ ] Mid-speech click next → should stop audio and advance

---

## 🎯 NEXT STEPS

1. **Fix 500 Error** (Priority 1)
   - Check Vercel logs for actual error
   - Verify database operations
   - Add detailed error logging to API route

2. **Test Audio Feedback Prevention** (After 500 fixed)
   - Verify mic doesn't hear AI voice
   - Test rapid interaction scenarios
   - Monitor console for "feedback prevention" logs

3. **Monitor Voice Recognition Stability**
   - Should see fewer cleanup cycles
   - No more "aborted" errors
   - Clean start/stop lifecycle

---

## 📝 FILES MODIFIED

### Voice Recognition Fixes:
- `components/voice/useNaturalVoice.tsx`
- `components/treatment/v4/TreatmentSession.tsx`

### Audio Preloader:
- `components/treatment/v4/V4AudioPreloader.tsx`
- `app/dashboard/layout.tsx` (removed from here)
- `app/dashboard/sessions/page.tsx` (added here)
- `app/dashboard/sessions/treatment-v2/page.tsx`
- `app/dashboard/sessions/treatment-v3/page.tsx`
- `app/dashboard/sessions/treatment-v4/page.tsx`
- `app/dashboard/sessions/treatment-v4-old/page.tsx`
- `app/dashboard/sessions/treatment/page.tsx`

### Mobile UX:
- `components/treatment/v4/TreatmentSession.tsx` (Send button)
- `components/treatment/v3/TreatmentSession.tsx` (Send button)
- `components/treatment/v2/TreatmentSession.tsx` (Send button)
- `components/treatment/v4-old/TreatmentSession.tsx` (Send button)
- `components/treatment/TreatmentSession.tsx` (Send button)
- `app/dashboard/sessions/page.tsx` (Mobile menu)

---

## 🔍 DEBUGGING THE 500 ERROR

Check these in Vercel logs:

1. **Look for error stack trace** starting with:
   - "Treatment V4 API error:"
   - "V4 Start session error:"

2. **Check for database errors:**
   - "Profile fetch error:"
   - "Database insert error:"
   - "Failed to start V4 session"

3. **Check for state machine errors:**
   - Check if `TreatmentStateMachine` constructor throws
   - Check if `processUserInput()` is failing
   - Check if `clearContext()` is failing

4. **Check authentication:**
   - Verify `createServerClient()` works
   - Check if user auth is valid
   - Verify profile exists

---

## 💡 SUGGESTED API ENHANCEMENT

Add more detailed error logging to `handleStartSession()`:

```typescript
async function handleStartSession(sessionId: string, userId: string) {
  try {
    console.log('[START] Clearing context...');
    await treatmentMachine.clearContext(sessionId);
    
    console.log('[START] Processing initial input...');
    const result = await treatmentMachine.processUserInput(sessionId, 'start', { userId });
    
    console.log('[START] Saving to database...');
    await saveSessionToDatabase(sessionId, userId, result, responseTime);
    
    console.log('[START] Success!');
    return NextResponse.json(finalResponse);
  } catch (error) {
    console.error('[START] Failed at:', error);
    console.error('[START] Error details:', {
      name: error?.constructor?.name,
      message: error?.message,
      stack: error?.stack
    });
    return NextResponse.json({ ... }, { status: 500 });
  }
}
```

This would help pinpoint exactly where the 500 error is occurring.
