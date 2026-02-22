# PTT Mode: Turn-Taking Bugs & Fix Plan

> **Date:** 2026-02-22
> **Status:** ALL 7 FIXES IMPLEMENTED — ready for testing
> **Context:** Mobile app testing (orb_ptt mode) reveals back-and-forth conversation flow problems.
> **Symptoms:** App pre-empts user, user has to say things twice, short responses may get dropped.

---

## Architecture Context

On mobile, the app defaults to `orb_ptt` interaction mode (`isGuidedMode = true`). This disables VAD auto-listening and gives the user manual hold-to-speak control via the orb button. Production uses the **Web Speech API** (`NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=webspeech`); local dev uses **Whisper**.

### The intended PTT cycle

```
AI speaks → audio ends → user sees "Ready" → user holds orb →
mic starts → user speaks → releases orb → mic stops →
transcript delivered → sendMessage() → API → AI responds → AI speaks → repeat
```

---

## Bug 1: Mic auto-starts after AI audio ends — no `guidedMode` check

**Severity:** CRITICAL
**Symptoms:** App pre-empts user; phantom transcripts from ambient noise
**Affects:** Web Speech API path (production mobile)

### What happens

In `useNaturalVoice.tsx`, `playAudioSegment`'s `onended` callback (line ~935):

```javascript
// Inside audio.onended:
if (isMicEnabled && isMountedRef.current) {
    startListening();   // ← No guidedMode check!
}
onAudioEndedRef.current?.();
```

After every AI audio segment ends, `startListening()` is called **unconditionally**. For Web Speech, this calls `recognitionRef.current.start()`, making the mic "hot" before the user has pressed PTT.

The `guidedMode` check that prevents auto-restart **does** exist in the separate `recognition.onend` handler (line ~323), but `audio.onended` fires **first** and starts recognition before that guard has a chance to act.

### Consequence

SpeechRecognition listens to ambient noise, residual speaker vibration, or breathing. In continuous mode with the 1.5s silence timer, any speech-like sound gets finalized into a phantom transcript → `sendMessage()` → AI responds to garbage → user sees the app "pre-empting" them.

### Fix

Add a `guidedMode` guard to the `startListening()` call inside `playAudioSegment`'s `onended`:

```javascript
// Only auto-restart listening if NOT in guided/PTT mode
if (isMicEnabled && isMountedRef.current && !guidedMode) {
    startListening();
}
```

This requires threading `guidedMode` into the `playAudioSegment` callback (via ref or dependency). The existing `guidedMode` guard in `recognition.onend` already shows the pattern.

---

## Bug 2: `isLoading` guard silently drops user transcripts

**Severity:** CRITICAL
**Symptoms:** User has to say things twice
**Affects:** Both Web Speech and Whisper paths

### What happens

In `TreatmentSession.tsx` (line ~719):

```javascript
onTranscript: (transcript) => {
    console.log('🗣️ Natural Voice Transcript:', transcript);
    if (!isLoading) {
        sendMessage(transcript);
    }
    // ← No else clause. Transcript is silently lost.
},
```

If `isLoading` is `true` when a transcript arrives, it is **silently discarded**. No queuing, no buffering, no retry, no user feedback. The user must speak again.

### When this triggers

1. **Phantom transcript race (Bug 1 → Bug 2 chain):** A phantom transcript from ambient noise sets `isLoading = true`. The user's real input arrives during that loading window → dropped.
2. **API latency:** The previous API call hasn't returned yet when the user speaks again.
3. **Auto-advance overlap:** An auto-advance `sendMessage('', true)` is in flight when the user tries to speak.

### Fix

Queue the transcript and send it when loading completes:

```javascript
const pendingTranscriptRef = useRef<string | null>(null);

onTranscript: (transcript) => {
    if (!isLoading) {
        sendMessage(transcript);
    } else {
        console.log('⏳ Queuing transcript (loading in progress):', transcript);
        pendingTranscriptRef.current = transcript;
    }
},

// In a useEffect that watches isLoading:
useEffect(() => {
    if (!isLoading && pendingTranscriptRef.current) {
        const queued = pendingTranscriptRef.current;
        pendingTranscriptRef.current = null;
        sendMessage(queued);
    }
}, [isLoading]);
```

This ensures user input is never silently lost. The ref approach avoids re-render loops.

---

## Bug 3: No `processNow()` on PTT release in Whisper mode

**Severity:** HIGH
**Symptoms:** Short responses dropped; unnecessary delay before transcription
**Affects:** Whisper path (local dev; future production if Whisper is enabled)

### What happens

In `handlePTTEnd` (TreatmentSession.tsx, line ~955):

```javascript
const handlePTTEnd = useCallback(() => {
    if (!isGuidedMode) return;
    naturalVoice.stopListening();  // ← No-op for Whisper!
    setIsPTTActive(false);
}, [isGuidedMode, naturalVoice]);
```

For Whisper mode, `stopListening()` is a no-op (line ~569 in useNaturalVoice.tsx). The user's audio stays in the buffer until the auto-process timer fires (up to 1.5s later).

During that window, if an auto-advance fires and the AI starts speaking, `setAISpeaking(true)` **clears the buffer**, losing the user's input entirely.

### Fix

Expose `processNow()` from `useNaturalVoice` and call it on PTT end:

```javascript
// In useNaturalVoice, add to return:
return { ..., processNow: audioCapture.processNow };

// In handlePTTEnd:
const handlePTTEnd = useCallback(() => {
    if (!isGuidedMode) return;
    naturalVoice.stopListening();
    naturalVoice.processNow?.();  // Immediately flush Whisper buffer
    setIsPTTActive(false);
}, [isGuidedMode, naturalVoice]);
```

---

## Bug 4: Auto-advance pre-empts user on 'auto' steps

**Severity:** MEDIUM
**Symptoms:** App starts talking before user can respond
**Affects:** Both paths

### What happens

In `handleAudioEnded` (TreatmentSession.tsx, line ~610):

```javascript
if (currentStepTypeRef.current === 'auto') {
    setTimeout(() => {
        sendMessage('', true);
    }, 500);  // Only 500ms before auto-advancing
}
```

For `auto` step types, the app sends the next message after only 500ms. Combined with Bug 1 (mic is now hot), the user can't interject. Even without Bug 1, the 500ms window is very short in a voice-driven experience — the user may still be processing what they just heard.

### Fix

Two changes:

1. **Don't auto-advance while PTT is active** (user is trying to speak):
```javascript
if (currentStepTypeRef.current === 'auto' && !isPTTActive) {
    setTimeout(() => {
        if (!isPTTActive) {  // Double-check before firing
            sendMessage('', true);
        }
    }, 800);  // Slightly longer breathing room
}
```

2. **Consider a longer delay in PTT mode** since the user needs time to process audio-only content (no text on screen to re-read). 800ms–1200ms would feel more natural.

---

## Bug 5: PTT start doesn't reliably reset Web Speech Recognition

**Severity:** MEDIUM
**Symptoms:** Garbled transcripts; ambient noise mixed with user speech
**Affects:** Web Speech API path

### What happens

When `handlePTTStart` calls `naturalVoice.startListening()`, and recognition is **already running** (auto-started from Bug 1), `recognition.start()` throws and the error is swallowed:

```javascript
try {
    recognitionRef.current.start();
} catch (e) {
    console.log('🎤 Natural Voice: Already listening or error starting:', e);
}
```

The recognition continues from before PTT was pressed, which means any interim results from ambient noise may still be in the recognition buffer. These could finalize alongside the user's actual speech, producing a garbled or incorrect transcript.

### Fix

Stop-then-start recognition on PTT press to get a clean slate:

```javascript
// In startListening, or in a new forceRestartListening():
if (recognitionRef.current) {
    try { recognitionRef.current.stop(); } catch (e) { /* ok */ }
    // Brief delay for the browser to fully tear down the session
    setTimeout(() => {
        try { recognitionRef.current?.start(); } catch (e) { /* ok */ }
    }, 50);
}
```

However, if Bug 1 is fixed (mic doesn't auto-start in PTT mode), this becomes much less likely to trigger, because recognition won't already be running when PTT is pressed.

---

## Bug 6: Whisper's aggressive server-side VAD may drop short responses

**Severity:** LOW-MEDIUM
**Symptoms:** Short words like "yes" or "no" occasionally lost
**Affects:** Whisper path only

### What happens

In `whisper-service/app/transcribe.py` (line ~557):

```python
vad = webrtcvad.Vad(3)  # Aggressiveness 3 (most strict)
```

WebRTC VAD at aggressiveness 3 is the harshest at classifying audio as non-speech. For short, quiet responses, this can strip out actual speech frames. Combined with the aggressive preprocessing pipeline (90% noise reduction, Wiener filter, 80Hz high-pass), short speech patterns can be degraded before Whisper sees them.

### Fix

Reduce VAD aggressiveness from 3 to 2:

```python
vad = webrtcvad.Vad(2)  # Aggressiveness 2 (balanced)
```

This retains good noise rejection while being more permissive with short utterances. The hallucination detection layer downstream still catches false positives from noise.

---

## Bug 7: Stale closure in `handleAudioEnded`

**Severity:** LOW (latent bug, rarely triggers in practice)
**Symptoms:** Could theoretically cause double-sends or stale state reads
**Affects:** Both paths

### What happens

`handleAudioEnded` captures `sendMessage` in its closure but only lists `[resetSubtitles]` in its dependency array. Since `sendMessage` is recreated every render (not wrapped in `useCallback`), the closure holds a potentially stale version with outdated state values.

### Fix

Use a ref for `sendMessage` (same pattern already used for `onTranscript` and `onAudioEnded` in useNaturalVoice):

```javascript
const sendMessageRef = useRef(sendMessage);
useEffect(() => { sendMessageRef.current = sendMessage; });

const handleAudioEnded = useCallback(() => {
    resetSubtitles();
    if (currentStepTypeRef.current === 'auto') {
        setTimeout(() => {
            sendMessageRef.current('', true);
        }, 500);
    }
}, [resetSubtitles]);
```

---

## Fix Priority & Recommended Order

### Should we fix all of them?

**Yes.** These bugs are not independent — they form a chain reaction:

```
Bug 1 (mic auto-starts) → phantom transcript → Bug 2 (transcript dropped)
                         → or phantom sendMessage → Bug 4 (auto-advance overlap)
Bug 3 (no processNow) → delayed/lost Whisper input → user repeats
Bug 5 (stale recognition) → garbled transcript → user repeats
Bug 6 (aggressive VAD) → short words lost → user repeats
```

Fixing only some would leave the chain partially intact. For example, fixing Bug 1 alone stops phantom transcripts but doesn't help when a legitimate API call is slow and the user's next input hits the `isLoading` guard (Bug 2). Fixing Bug 2 alone would queue phantom transcripts instead of dropping them — better, but still wrong behavior.

These are not competing approaches or over-corrections. Each fix addresses a distinct failure mode with a targeted, minimal change. There is no "overfitting" risk because none of them change the fundamental architecture — they're guardrails that should have been there from the start.

### Recommended implementation order

| Order | Bug | Risk | Why this order |
|-------|-----|------|----------------|
| 1 | Bug 1 | Low | One-line guard. Eliminates the root cause of phantom transcripts. Highest impact-to-effort ratio. |
| 2 | Bug 2 | Low | Small ref + useEffect. Prevents silent data loss regardless of what causes `isLoading` overlap. |
| 3 | Bug 3 | Low | One-line addition. Critical for Whisper mode; no effect on Web Speech path. |
| 4 | Bug 7 | Low | Trivial ref pattern. Do it while touching `handleAudioEnded` for Bug 4. |
| 5 | Bug 4 | Low | Small timing + guard change. Pairs naturally with Bug 7 since both touch `handleAudioEnded`. |
| 6 | Bug 5 | Low | Only matters if Bug 1 fix is incomplete. Safety net. |
| 7 | Bug 6 | Low | Server-side change, independent of frontend. Test separately with short utterances. |

### What "done" looks like

After all fixes, the PTT cycle should be:

1. AI finishes speaking → mic stays OFF (Bug 1 fix)
2. User sees "Ready - Hold to speak" with a genuinely silent mic
3. User holds orb → clean recognition session starts (Bug 5 fix)
4. User speaks → transcript captured immediately on release (Bug 3 fix for Whisper)
5. `sendMessage()` fires → if still loading from a previous call, transcript is queued not dropped (Bug 2 fix)
6. API returns → AI speaks → auto-advance respects PTT state (Bug 4 fix)
7. Short words like "yes" survive the Whisper pipeline (Bug 6 fix)
8. All callback closures see current state (Bug 7 fix)

---

## Files to modify

| File | Bugs addressed |
|------|---------------|
| `components/voice/useNaturalVoice.tsx` | Bug 1, Bug 3 (expose processNow), Bug 5 |
| `components/treatment/v4/TreatmentSession.tsx` | Bug 2, Bug 3 (call processNow), Bug 4, Bug 5, Bug 7 |
| `whisper-service/app/transcribe.py` | Bug 6 |

---

---

## Bug 8: iOS silent audio — Audio element destroyed between plays

**Severity:** CRITICAL (iOS only)
**Symptoms:** Second AI audio shows "AI Speaking" but produces no sound on iPhone
**Affects:** iOS Safari / iOS PWA

### What happens

iOS requires a user gesture to "unlock" an `HTMLAudioElement` for playback. The first
audio works because it plays within the Start Session tap gesture chain. But in
`playAudioSegment`, the element is destroyed and recreated each time:

```javascript
if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current = null;   // ← kills the unlocked element
}
const audio = new Audio(audioUrl);  // ← new element, never unlocked
```

The second `speak()` is triggered after: PTT → transcript → API call → response. By
this point the user gesture context is long gone. The new `Audio` element's `play()`
"succeeds" (no error thrown) but produces no sound — iOS's audio session was lost with
the destroyed element.

### Fix (implemented)

1. **Reuse the audio element** across calls by setting `audio.src` instead of creating
   `new Audio()`. The element's "unlocked" state persists because it's the same object.
2. **Generation counter** replaces element-identity checks for AbortError supersession
   detection (since the element is now the same object across calls).
3. **iOS audio warmup** on `handlePTTStart`: plays a zero-length silent WAV during the
   user gesture as a belt-and-suspenders safety net.
4. **All `audioRef.current = null` sites** in stop/interrupt paths changed to just
   `pause()` + `currentTime = 0` (except on component unmount where cleanup is appropriate).

---

## Testing checklist (post-fix)

- [ ] **iPhone**: AI audio plays on EVERY turn (not just the first)
- [ ] **iPhone**: No silent "AI Speaking" state where audio is inaudible
- [ ] PTT mode: Mic does NOT activate after AI finishes speaking (verify via console logs)
- [ ] PTT mode: Ambient noise in a quiet room does NOT trigger phantom transcripts
- [ ] PTT mode: Say "yes" with a quick tap-and-release — transcript should arrive
- [ ] PTT mode: Say something while a previous API call is loading — it should queue and send after
- [ ] PTT mode: Auto-advance steps should not fire while user is holding the orb
- [ ] PTT mode: Full 10-step conversation flows smoothly without repeats or pre-emptions
- [ ] Non-PTT mode (listen_only, text_first): No regressions — existing behavior preserved
- [ ] Whisper mode: Short responses ("yes", "no", "okay") transcribe correctly
- [ ] Web Speech mode: Same short responses work
