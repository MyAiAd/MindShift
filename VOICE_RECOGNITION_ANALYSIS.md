# Voice Recognition Issues - Short Utterance Analysis

## Problem
User reports that short voice responses (e.g., "problem", "Pablo") are being misheard or not processed correctly in PTT guided mode.

## Investigation Findings

### 1. Audio Capture Duration Issues

**Current Configuration** (`components/voice/useAudioCapture.ts`):
- `BUFFER_DURATION_MS = 8000` (8 seconds rolling buffer)
- `AUTO_PROCESS_INTERVAL_MS = 1500` (auto-process every 1.5s)
- `MIN_PROCESS_INTERVAL_MS = 300` (throttle minimum)

**PTT Mode Behavior**:
- User presses button → starts audio capture
- User says brief word (e.g., "problem") in ~0.5 seconds
- User releases button → stops audio capture
- Audio is sent to Whisper for transcription

**Potential Issue #1: Insufficient Audio Length**
- Very short utterances (< 0.5s) may not provide enough context for Whisper
- Whisper is optimized for longer phrases (1-3 seconds)
- Brief audio can trigger hallucination filters or return empty transcripts

### 2. Whisper Hallucination Filtering

**Server-Side Filtering** (`app/api/transcribe/route.ts`):
- Line 82-83: `hallucination_filtered` flag from Whisper service
- Line 86-90: Logs when hallucination detected

**Client-Side Filtering** (`components/voice/useAudioCapture.ts`):
- Line 244-248: Additional hallucination check
- Known phrases like "thanks for watching", "thank you", etc.

**Potential Issue #2: Over-Aggressive Filtering**
- Short, common words might trigger false positives
- "Problem" → Could be misheard as "Pablo" due to phonetic similarity
- Hallucination filter might discard legitimate short responses

### 3. PTT Release Timing

**Current Flow**:
1. User presses button (Line 808: `naturalVoice.startListening()`)
2. User speaks
3. User releases button (Line 818: `naturalVoice.stopListening()`)
4. Audio buffer is processed

**Potential Issue #3: Early Cutoff**
- If user releases button too quickly after speaking, audio might be truncated
- No padding/delay after PTT release before processing
- Final syllable or word ending might be cut off

### 4. Whisper Model Limitations

**Short Utterance Challenges**:
- Whisper expects natural speech with context
- Single words lack acoustic and linguistic context
- Phonetically similar words are harder to distinguish:
  - "problem" ≈ "Pablo" (similar consonant patterns)
  - "identity" could be misheard as other i-words
  - "belief" could be "believe", "relief", etc.

### 5. Audio Quality Factors

**Potential Environmental Issues**:
- Background noise interference
- Mobile device microphone quality
- Network latency affecting audio transmission
- Audio compression/decompression artifacts

## Recommendations (For Future Implementation)

### Short-term Improvements:

1. **Add Post-PTT Buffer Delay**
   - Capture 200-300ms additional audio after PTT release
   - Prevents premature audio cutoff
   - Ensures complete word capture

2. **Enhanced Logging**
   - Log exact audio duration sent to Whisper
   - Track which responses get hallucination-filtered
   - Monitor confidence scores for short utterances

3. **User Feedback**
   - Show visual confirmation when audio is being processed
   - Display interim transcripts (if available)
   - Provide feedback if audio was too short

### Long-term Solutions:

1. **Prompt User for Confirmation**
   - When short/ambiguous response detected, ask "Did you say [X]?"
   - Allow user to correct misheard words

2. **Context-Aware Recognition**
   - Pass expected response type to transcription
   - Use language model to bias toward likely responses
   - E.g., at choose_method step, boost probability of method names

3. **Alternative Input Methods**
   - Show method buttons even in orb mode (overlay)
   - Allow tap-to-select as fallback
   - Support typing numbers (1-4) as alternative

4. **Minimum Audio Duration**
   - Require minimum 0.5-1.0 second audio capture
   - Alert user if they release too quickly
   - "Please hold button longer and speak clearly"

## Current Debug Points

To diagnose the exact issue, check logs for:

1. **Audio duration**: `🎙️ AudioCapture: Processing XX.XKB`
2. **Transcription result**: `🎙️ AudioCapture: Transcript: [text]`
3. **Empty responses**: `🎙️ AudioCapture: Empty transcript (likely silence)`
4. **Hallucination filtering**: `🎙️ AudioCapture: Filtered hallucination: [text]`
5. **Method matching**: `🔍 CHOOSE_METHOD: methodChoice="[text]"`

## Conclusion

The root cause is likely a combination of:
- **Short audio duration** (< 0.5s) not providing enough context for Whisper
- **PTT release timing** cutting off audio prematurely
- **Phonetic ambiguity** in single-word responses
- **Lack of contextual hints** to bias recognition toward expected responses

The fixes should focus on:
1. ✅ Slower orb pulse (completed)
2. ✅ Speaking full method list (completed)  
3. 🔄 Enhanced debug logging (completed)
4. ⏳ Analyzing logs from next test to pinpoint exact issue
5. ⏳ Consider adding post-PTT buffer delay if audio cutoff is confirmed
