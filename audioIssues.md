# Audio / Voice Input Reliability Investigation (V4)

**Date:** 2026-01-27  
**Scope:** Investigation + report only (no code changes)  
**Symptom:** Users sometimes must repeat speech 3–4 times before the app “hears” them. Happens both:

- **While AI is speaking** (barge-in / interruption)
- **While AI is not speaking** (normal response)

This report focuses on likely causes in the current architecture and enumerates fix options.

---

## Executive summary

From code inspection, the “not being heard” behavior is most consistent with **listening gaps (“dead zones”)** caused by how Web Speech recognition is started/stopped, plus **handoff timing** between VAD (barge-in detection) and SpeechRecognition (actual transcription). When AI audio is playing, SpeechRecognition is intentionally blocked; if VAD does not trigger quickly/reliably, user speech is effectively ignored until retries.

The system has multiple points where:

- listening is **not active** for hundreds of milliseconds, and
- the **first words** of an interruption can be lost during a delayed restart/handoff.

These can easily look like “repeat 3–4 times” in real usage.

---

## Current architecture (as implemented)

There are two parallel mechanisms:

1. **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`)  
   - Produces transcripts (`onresult`) used as user input.
2. **VAD** (`@ricky0123/vad-web`)  
   - Detects speech activity, primarily used to enable **barge-in** while AI audio plays.

### High-level flow

#### When AI is silent

- SpeechRecognition is started automatically (unless guided mode / mic disabled).
- On end, it may auto-restart after a delay.

#### When AI is speaking

- SpeechRecognition is prevented from starting while audio is playing (feedback loop prevention).
- VAD runs in parallel **only when mic + speaker are enabled**.
- When VAD detects speech, it stops AI audio and then starts SpeechRecognition after a short delay.

---

## Key code locations reviewed

- `components/voice/useNaturalVoice.tsx`
  - SpeechRecognition lifecycle, auto-restart behavior, audio playback flags, VAD integration + barge-in.
- `components/voice/useVAD.tsx`
  - VAD threshold mapping + timing parameters.
- `components/treatment/v4/TreatmentSession.tsx`
  - Mic/speaker toggles, permission acquisition, wiring of VAD sensitivity + meter.
- `services/voice/voice.service.ts`
  - A separate voice service implementation with retry/backoff patterns (useful reference).
- Supporting docs:
  - `vad.md`, `VAD_FIX_SUMMARY.md`, `VOICE_FIXES_AND_INVESTIGATION.md`, `slider-prd.json`

---

## Findings: likely causes of “not being heard”

### 1) Listening “dead zones” due to SpeechRecognition lifecycle

In `useNaturalVoice.tsx`, recognition is configured for **single utterances**:

- `continuous = false`
- `interimResults = false`

Then on `onend`, an auto-restart is scheduled with a **500ms delay** (unless guided mode).

**Why this matters:** if the user speaks during that delay, there is no active recognition session—speech can be missed entirely. If their timing repeatedly lands in those gaps, they may need multiple attempts.

**Observed impact pattern:** “I said it, nothing happened; I said it again; eventually it heard me.”

### 2) When AI audio is playing, SpeechRecognition is intentionally blocked

In `useNaturalVoice.tsx`, `startListening()` refuses to start recognition when `isAudioPlayingRef.current` is true. This is done to avoid the system hearing its own AI audio (“feedback loop prevention”).

**Why this matters:** during playback, the *only* mechanism that can react to user speech is VAD. If VAD does not trigger (threshold too strict, noisy environment, mic far away, OS-level AGC variability), the user’s speech is ignored while the AI is talking.

### 3) VAD-to-recognition handoff delay can lose first words

On barge-in, the flow is:

- Stop AI audio
- Stop any current recognition
- Start SpeechRecognition after ~100ms

**Why this matters:** whatever the user says in the first \~100ms after they begin speaking may be missed by SpeechRecognition (because it hasn’t started yet). In real conversation, that can be the first word(s) (“yes”, “no”, “wait”, “I…”) which makes it *feel* like the app didn’t hear them.

### 4) VAD sensitivity mapping: default may be too strict in practice

In `useVAD.tsx`, UI “sensitivity” is mapped by **inverting** the value to produce thresholds:

- higher UI sensitivity → lower threshold → easier to trigger
- lower UI sensitivity → higher threshold → harder to trigger

Default \(0.5\) becomes a threshold around \(0.5\). If the environment is noisy, the user is quiet/far from mic, or OS-level gain/echo cancellation varies, this can lead to VAD **not firing reliably**, especially during AI playback when SpeechRecognition is blocked.

### 5) VAD is only enabled when mic **and** speaker are enabled

`useNaturalVoice.tsx` currently enables VAD via:

- `vadEnabled = isMicEnabled && isSpeakerEnabled`

This is logically consistent for “barge-in while audio plays,” but it also means:

- if users disable speaker but expect voice input to work seamlessly, VAD isn’t active (not necessarily a bug, but can confuse the mental model during testing).

### 6) SpeechRecognition error modes can look like “not heard”

Web Speech recognition can fail transiently (e.g., `no-speech`, `audio-capture`, `network`, `aborted`). If these happen during the “dead zone” timing or during frequent restarts, users experience “repeat it” behavior without clear UI feedback.

There’s also a separate `services/voice/voice.service.ts` implementation that includes backoff + max retries (especially for `no-speech`). Even if V4’s `useNaturalVoice` isn’t using that service directly, it’s a useful clue: **the team already observed that Web Speech can enter bad states and needs retry/backoff logic.**

---

## How these issues produce the exact symptom

### Scenario A: AI is silent, user speaks, but recognition is between cycles

1. SpeechRecognition ends (normal, or due to silence timeout)
2. Auto-restart is delayed (currently ~500ms)
3. User begins speaking during that delay
4. SpeechRecognition is not active → speech is missed → user repeats

This can repeat if the restart cadence aligns poorly with user timing.

### Scenario B: AI is speaking, SpeechRecognition is blocked; VAD doesn’t trigger reliably

1. AI audio playing → SpeechRecognition blocked
2. User speaks to interrupt
3. If VAD threshold isn’t met quickly, nothing happens
4. User repeats/louder → VAD triggers
5. Handoff delay to SpeechRecognition loses first word(s) → partial transcript → user repeats again

---

## Options to fix (no code changes made; this is a menu)

### Option 1: Run SpeechRecognition in `continuous` mode (reduce dead zones)

- **What it addresses:** missed speech while AI is silent; fewer restarts; fewer “gaps”.
- **Tradeoffs:** more complexity managing final vs interim results; can increase false triggers and duplicate results; higher CPU.

### Option 2: Enable `interimResults`

- **What it addresses:** perception of responsiveness and “it heard me” feedback; captures short utterances sooner.
- **Tradeoffs:** you must decide what to do with interim text (ignore, display, or treat as partial).

### Option 3: Reduce restart delays / eliminate the 500ms gap

- **What it addresses:** the most likely “missed speech” window while AI is silent.
- **Tradeoffs:** risk of tight restart loops if a browser returns immediate start/end failures; you may need a backoff strategy (like the one in `voice.service.ts`).

### Option 4: Improve barge-in handoff (reduce lost initial words)

Examples of approaches:

- start SpeechRecognition **immediately** on VAD speech start (minimize delay)
- keep SpeechRecognition “warm” (ready) but gated by logic (hard with Web Speech API)
- buffer a small chunk of mic audio for the handoff (requires a different STT approach; see Option 6)

### Option 5: Tune VAD thresholds and timing parameters

VAD parameters that affect “does it trigger?” and “how fast?”:

- `positiveSpeechThreshold`, `negativeSpeechThreshold`
- `minSpeechMs`, `preSpeechPadMs`, `redemptionMs`

**What it addresses:** “can’t interrupt / VAD doesn’t register” cases.

**Tradeoffs:** too sensitive → false barge-ins from noise; too strict → missed interruptions.

### Option 6: Move away from Web Speech API for mission-critical STT

If your reliability requirement is high and you need deterministic control:

- capture audio via `getUserMedia` + AudioWorklet / MediaRecorder
- send to server-side transcription (e.g., Whisper-like) or local model

**What it addresses:** nearly all Web Speech flakiness, allows true buffering, consistent barge-in.
**Tradeoffs:** cost, latency, implementation complexity, privacy implications.

---

## Recommended fix path (practical sequencing)

### Immediate “quick wins” (highest ROI)

- **Reduce / remove the ~500ms restart gap** when AI is silent.
- **Make VAD easier to trigger** by default (or ensure slider “High” really works as expected for real users).
- **Reduce barge-in handoff delay** so first words aren’t missed.

### Short-term reliability improvements

- **Turn on interim results** (even if you only use them for UI feedback).
- Add **clear UX states**:
  - “Listening…”
  - “Not listening (AI speaking)”
  - “Not listening (restarting…)”
  - “Mic blocked / permission denied”

### Medium-term (if you need near-100% reliability)

- Consider `continuous = true` with robust debouncing/backoff, or
- migrate to an audio-capture + transcription pipeline you fully control (Option 6).

---

## Diagnostics to confirm root cause (before changing anything)

These are “evidence gathering” steps to validate whether you’re seeing dead zones vs VAD misses.

### 1) Correlate failures with recognition lifecycle

Add timestamped logs around:

- recognition `onstart`
- recognition `onend`
- the restart timer start/end

Then compare to screen recordings: does the user speak during the restart delay windows?

### 2) Measure VAD trigger probability vs threshold

`useVAD.tsx` already logs speech probability for ~1% of frames. Temporarily increase logging rate during debugging to see:

- typical `probs.isSpeech` while user speaks normally
- whether it crosses `positiveSpeechThreshold` at all

If it rarely crosses the threshold in real scenarios, VAD tuning is required.

### 3) Capture SpeechRecognition `event.error` frequency

Track how often you see:

- `no-speech`
- `audio-capture`
- `aborted`
- `network`

If these spike during the “not heard” moments, you likely need backoff + better restart logic and/or a non–Web Speech STT.

---

## Bottom line

This does **not** look like “pure mic sensitivity” in the audio chain; it looks like:

- **state/timing gaps** in SpeechRecognition restarts (AI silent case), plus
- **VAD reliability + handoff timing** during AI playback (barge-in case).

Both can independently produce the observed “repeat 3–4 times” symptom.

