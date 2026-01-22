# Voice Activity Detection (VAD) with User-Tunable Sensitivity

**Date Created:** 2026-01-21  
**Status:** Planning Phase - Ready to Implement  
**Priority:** High (solves "can't hear user while AI speaking" problem)  
**Target:** V4 Treatment Sessions

---

## 🎯 Goal

Enable users to **interrupt the AI while it's speaking** without using Push-to-Talk (PTT), using Voice Activity Detection (VAD) with a user-adjustable sensitivity slider in the settings modal.

---

## 📋 Problem Statement

Currently in V4 treatment sessions with Kokoro on Hetzner:
- ✅ **Works:** Voice recognition when AI is silent
- ❌ **Broken:** User cannot speak while AI is talking
- **Root Cause:** `isAudioPlayingRef` blocks microphone to prevent feedback loop
- **Impact:** Unnatural conversation flow, users must wait for AI to finish

---

## 💡 Solution Overview

Implement **Option 1: VAD with Barge-In** using **@ricky0123/vad-web** library:

1. Run VAD in parallel with audio playback
2. Detect when user starts speaking (above sensitivity threshold)
3. Immediately stop AI audio and start full speech recognition
4. Add user-tunable sensitivity slider in Voice Settings modal (cog icon)
5. Place slider below Playback Speed slider, mirroring its design

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│  User Speaks (while AI talking)             │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│  VAD Library (@ricky0123/vad-web)           │
│  - Monitors microphone audio stream         │
│  - Compares volume to sensitivity threshold │
│  - Detects speech vs. noise                 │
└───────────────┬─────────────────────────────┘
                │
                ▼ (Speech detected)
┌─────────────────────────────────────────────┐
│  Barge-In Handler                           │
│  1. Stop AI audio immediately               │
│  2. Stop listening to prevent echo          │
│  3. Clear audio state flags                 │
│  4. Start full speech recognition           │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│  Process user transcript normally           │
└─────────────────────────────────────────────┘
```

---

## 📦 Library Choice: @ricky0123/vad-web

**Why this library:**
- ✅ ~30KB gzipped
- ✅ WebAssembly-based (fast, accurate)
- ✅ Designed for browser real-time use
- ✅ Built-in sensitivity tuning via `positiveSpeechThreshold`
- ✅ Handles false positives well
- ✅ No GPU required
- ✅ Works offline (no API calls)

**Installation:**
```bash
npm install @ricky0123/vad-web
# or
pnpm add @ricky0123/vad-web
```

**Size Impact:**
- Current bundle: ~X MB
- After VAD: ~X + 0.03 MB
- Lazy-loaded: Only when mic+speaker both enabled

---

## 🎨 UI Design: Settings Modal Integration

### Current Settings Modal Structure (from TreatmentSession.tsx:1784-1929)

```
┌──────────────────────────────────────────┐
│ Settings                              [×]│
├──────────────────────────────────────────┤
│                                          │
│ 👤 Voice Actor                           │
│ ┌──────────┬──────────┐                 │
│ │ Rachel   │ Michael  │                 │
│ └──────────┴──────────┘                 │
│                                          │
│ ⚡ Playback Speed                        │
│ Speed: 1.00x                    Normal   │
│ ◀━━━━━━━━●━━━━━━━▶                      │
│ 0.75x      1.0x      1.5x                │
│ [0.75][0.9][1.0][1.15][1.5]             │
│                                          │
│ 🧘 Guided Mode                      [ ]  │
│ Full-screen push-to-talk                 │
│                                          │
└──────────────────────────────────────────┘
```

### New Settings Modal Structure (with VAD)

```
┌──────────────────────────────────────────┐
│ Settings                              [×]│
├──────────────────────────────────────────┤
│                                          │
│ 👤 Voice Actor                           │
│ ┌──────────┬──────────┐                 │
│ │ Rachel   │ Michael  │                 │
│ └──────────┴──────────┘                 │
│                                          │
│ ⚡ Playback Speed                        │
│ Speed: 1.00x                    Normal   │
│ ◀━━━━━━━━●━━━━━━━▶                      │
│ 0.75x      1.0x      1.5x                │
│ [0.75][0.9][1.0][1.15][1.5]             │
│                                          │
│ ──────────────────────────────────────  │ ← Border separator
│                                          │
│ 🎙️ Interruption Sensitivity             │
│ Sensitivity: 50%               Medium    │
│ ◀━━━━━━━━●━━━━━━━▶                      │
│ 10%       50%      90%                   │
│ [Low][Medium][High]                      │
│                                          │
│ [●●●●●●○○○○] Voice Level: 60%           │ ← Real-time meter
│                                          │
│ ℹ️  Speak while AI talks to test it      │
│                                          │
│ ──────────────────────────────────────  │
│                                          │
│ 🧘 Guided Mode                      [ ]  │
│ Full-screen push-to-talk                 │
│                                          │
└──────────────────────────────────────────┘
```

**Key Design Notes:**
- VAD slider only visible when **both mic AND speaker enabled**
- Mirrors Playback Speed slider design exactly
- Same styling, spacing, preset buttons
- Real-time voice level meter for testing
- Info text encourages testing the feature

---

## 📝 Implementation Plan

### Phase 1: Install Dependencies ✅ (10 mins)

**Task:** Add VAD library to project

```bash
pnpm add @ricky0123/vad-web
```

**Files Modified:** 
- `package.json`
- `pnpm-lock.yaml`

---

### Phase 2: Add State Management (30 mins)

**File:** `components/treatment/v4/TreatmentSession.tsx`

**Add state variables:**

```typescript
// Around line 150, after playbackSpeed state
const [vadSensitivity, setVadSensitivity] = useState(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('v4_vad_sensitivity');
    return saved ? parseFloat(saved) : 0.5; // Default: 50% (Medium)
  }
  return 0.5;
});

const [vadLevel, setVadLevel] = useState(0); // 0-100, for real-time meter
const [isVadActive, setIsVadActive] = useState(false); // Track if VAD is running
```

**Add handler function:**

```typescript
// Around line 260, after handleSpeedChange
const handleVadSensitivityChange = (newSensitivity: number) => {
  setVadSensitivity(newSensitivity);
  localStorage.setItem('v4_vad_sensitivity', newSensitivity.toString());
  console.log(`🎙️ VAD: Sensitivity changed to ${(newSensitivity * 100).toFixed(0)}%`);
};

const getVadSensitivityLabel = (sensitivity: number): string => {
  if (sensitivity < 0.35) return 'Low';
  if (sensitivity < 0.65) return 'Medium';
  return 'High';
};
```

**Files Modified:**
- `components/treatment/v4/TreatmentSession.tsx` (state + handlers)

---

### Phase 3: Create VAD Hook (2 hours)

**File:** `components/voice/useVAD.tsx` (NEW)

**Purpose:** Encapsulate VAD logic in reusable hook

```typescript
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MicVAD } from '@ricky0123/vad-web';

interface UseVADProps {
  enabled: boolean; // Only run when mic+speaker both enabled
  sensitivity: number; // 0.1 - 0.9
  onSpeechStart: () => void; // Callback when user speech detected
  onSpeechEnd?: (audio: Float32Array) => void; // Optional: get audio data
  onVadLevel?: (level: number) => void; // Optional: real-time level for UI meter
}

export const useVAD = ({
  enabled,
  sensitivity,
  onSpeechStart,
  onSpeechEnd,
  onVadLevel,
}: UseVADProps) => {
  const vadRef = useRef<MicVAD | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSpeechStartRef = useRef(onSpeechStart);
  const onSpeechEndRef = useRef(onSpeechEnd);
  const onVadLevelRef = useRef(onVadLevel);

  // Update refs when callbacks change
  useEffect(() => {
    onSpeechStartRef.current = onSpeechStart;
    onSpeechEndRef.current = onSpeechEnd;
    onVadLevelRef.current = onVadLevel;
  }, [onSpeechStart, onSpeechEnd, onVadLevel]);

  // Initialize VAD
  useEffect(() => {
    if (!enabled) {
      // Clean up if disabled
      if (vadRef.current) {
        console.log('🎙️ VAD: Destroying (disabled)');
        vadRef.current.destroy();
        vadRef.current = null;
        setIsInitialized(false);
      }
      return;
    }

    // Initialize VAD
    const initVAD = async () => {
      try {
        console.log('🎙️ VAD: Initializing with sensitivity:', sensitivity);
        
        const vad = await MicVAD.new({
          // Core settings
          positiveSpeechThreshold: sensitivity, // 0.1 (less sensitive) - 0.9 (more sensitive)
          negativeSpeechThreshold: sensitivity - 0.15, // Hysteresis to prevent flapping
          
          // Timing parameters
          minSpeechFrames: 3, // ~90ms of speech required
          preSpeechPadFrames: 1, // Include 30ms before speech start
          redemptionFrames: 8, // Allow 240ms silence before speech end
          frameSamples: 1536, // 96ms per frame at 16kHz
          
          // Audio settings
          ortConfig: (ort) => {
            // Use WebAssembly backend for better performance
            ort.env.wasm.numThreads = 1;
          },
          
          // Callbacks
          onSpeechStart: () => {
            console.log('🎙️ VAD: Speech detected - triggering barge-in');
            onSpeechStartRef.current();
          },
          
          onSpeechEnd: (audio) => {
            console.log('🎙️ VAD: Speech ended');
            if (onSpeechEndRef.current) {
              onSpeechEndRef.current(audio);
            }
          },
          
          onVADMisfire: () => {
            console.log('🎙️ VAD: Misfire (false positive)');
          },
          
          onFrameProcessed: (probabilities) => {
            // Update real-time level for UI meter
            if (onVadLevelRef.current) {
              const level = Math.round(probabilities.isSpeech * 100);
              onVadLevelRef.current(level);
            }
          },
        });

        vadRef.current = vad;
        setIsInitialized(true);
        setError(null);
        console.log('🎙️ VAD: Initialized successfully');
        
        // Start listening
        await vad.start();
        console.log('🎙️ VAD: Started listening');

      } catch (err) {
        console.error('🎙️ VAD: Initialization failed:', err);
        setError(err instanceof Error ? err.message : 'VAD initialization failed');
        setIsInitialized(false);
      }
    };

    initVAD();

    // Cleanup on unmount
    return () => {
      if (vadRef.current) {
        console.log('🎙️ VAD: Destroying (cleanup)');
        vadRef.current.destroy();
        vadRef.current = null;
        setIsInitialized(false);
      }
    };
  }, [enabled, sensitivity]);

  // Pause/resume methods
  const pause = useCallback(() => {
    if (vadRef.current && isInitialized) {
      console.log('🎙️ VAD: Pausing');
      vadRef.current.pause();
    }
  }, [isInitialized]);

  const resume = useCallback(async () => {
    if (vadRef.current && isInitialized) {
      console.log('🎙️ VAD: Resuming');
      await vadRef.current.start();
    }
  }, [isInitialized]);

  return {
    isInitialized,
    error,
    pause,
    resume,
  };
};
```

**Files Created:**
- `components/voice/useVAD.tsx` (new hook)

---

### Phase 4: Integrate VAD with useNaturalVoice (1 hour)

**File:** `components/voice/useNaturalVoice.tsx`

**Modifications needed:**

1. **Import VAD hook:**

```typescript
import { useVAD } from './useVAD';
```

2. **Add VAD props to interface (line 10-22):**

```typescript
interface UseNaturalVoiceProps {
  // ... existing props
  vadEnabled?: boolean; // NEW: Enable VAD barge-in
  vadSensitivity?: number; // NEW: VAD sensitivity 0.1-0.9
  onVadLevel?: (level: number) => void; // NEW: Real-time level callback
}
```

3. **Update hook parameters (line 24-36):**

```typescript
export const useNaturalVoice = ({
  onTranscript,
  enabled,
  micEnabled,
  speakerEnabled,
  voiceProvider = 'kokoro',
  elevenLabsVoiceId = '21m00Tcm4TlvDq8ikWAM',
  kokoroVoiceId = 'af_heart',
  onAudioEnded,
  playbackRate = 1.0,
  onRenderText,
  guidedMode = false,
  vadEnabled = false, // NEW
  vadSensitivity = 0.5, // NEW
  onVadLevel, // NEW
}: UseNaturalVoiceProps) => {
```

4. **Add barge-in handler (after line 216):**

```typescript
// NEW: Handle VAD barge-in - user speaks while AI talking
const handleVadBargeIn = useCallback(() => {
  console.log('🎙️ VAD Barge-In: User started speaking while AI talking');
  
  // 1. Stop AI audio immediately
  if (audioRef.current) {
    console.log('🎙️ VAD Barge-In: Stopping AI audio');
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current = null;
  }
  
  // 2. Clear audio state flags
  setIsSpeaking(false);
  isSpeakingRef.current = false;
  isAudioPlayingRef.current = false;
  
  // 3. Clear paused state if any
  if (pausedAudioRef.current) {
    pausedAudioRef.current = null;
    setIsPaused(false);
  }
  
  // 4. Stop current listening (will restart via normal flow)
  stopListening();
  
  // 5. Brief delay, then start full speech recognition
  setTimeout(() => {
    if (isMicEnabled && isMountedRef.current && !guidedMode) {
      console.log('🎙️ VAD Barge-In: Starting speech recognition');
      startListening();
    }
  }, 100); // Small delay to ensure clean state
}, [isMicEnabled, guidedMode, startListening, stopListening]);
```

5. **Initialize VAD hook (after line 289):**

```typescript
// NEW: Initialize VAD (only when both mic and speaker enabled, not in guided mode)
const shouldEnableVad = vadEnabled && isMicEnabled && isSpeakerEnabled && !guidedMode;

const vad = useVAD({
  enabled: shouldEnableVad,
  sensitivity: vadSensitivity,
  onSpeechStart: handleVadBargeIn,
  onVadLevel: onVadLevel,
});
```

6. **Pause VAD during speech recognition (modify startListening ~line 179):**

```typescript
const startListening = useCallback(() => {
  // Don't start if audio is currently playing (prevents feedback loop)
  if (recognitionRef.current && !isSpeakingRef.current && !isAudioPlayingRef.current) {
    try {
      // NEW: Pause VAD while doing full speech recognition
      if (vad && vad.isInitialized) {
        vad.pause();
      }
      
      recognitionRef.current.start();
    } catch (e) {
      console.log('🎤 Natural Voice: Already listening or error starting:', e);
    }
  } else if (isAudioPlayingRef.current) {
    console.log('🎤 Natural Voice: Skipping start - audio is playing (feedback prevention)');
  }
}, [vad]);
```

7. **Resume VAD after speech recognition ends (modify onend handler ~line 82):**

```typescript
recognitionRef.current.onend = () => {
  console.log('🎤 Natural Voice: Listening ended');
  setIsListening(false);
  
  // NEW: Resume VAD after speech recognition ends
  if (vad && vad.isInitialized && isSpeakingRef.current) {
    vad.resume();
  }
  
  // ... rest of existing onend logic
};
```

8. **Update return object (line 560):**

```typescript
return {
  isListening,
  isSpeaking,
  isPaused,
  speak,
  prefetch,
  error,
  startListening,
  stopListening,
  stopSpeaking,
  pauseSpeaking,
  resumeSpeaking,
  hasPausedAudio,
  clearAudioFlags,
  vadError: vad.error, // NEW: Expose VAD error if any
  isVadActive: vad.isInitialized, // NEW: Expose VAD status
};
```

**Files Modified:**
- `components/voice/useNaturalVoice.tsx` (VAD integration)

---

### Phase 5: Update TreatmentSession to Enable VAD (30 mins)

**File:** `components/treatment/v4/TreatmentSession.tsx`

**Update naturalVoice hook call (line 441-457):**

```typescript
// Natural Voice Hook - Updated to use separate mic/speaker controls + VAD
const naturalVoice = useNaturalVoice({
  enabled: isNaturalVoiceEnabled, // DEPRECATED: backward compatibility
  micEnabled: isMicEnabled, // NEW: Controls microphone input
  speakerEnabled: isSpeakerEnabled, // NEW: Controls audio output
  guidedMode: isGuidedMode, // NEW: Guided mode disables auto-restart for PTT
  onTranscript: (transcript) => {
    console.log('🗣️ Natural Voice Transcript:', transcript);
    if (!isLoading) {
      sendMessage(transcript);
    }
  },
  voiceProvider: 'kokoro',
  kokoroVoiceId: getKokoroVoiceId(),
  onAudioEnded: handleAudioEnded,
  playbackRate: playbackSpeed,
  onRenderText: handleRenderText,
  
  // NEW: VAD configuration
  vadEnabled: true, // Enable VAD barge-in
  vadSensitivity: vadSensitivity, // User's sensitivity setting
  onVadLevel: (level) => setVadLevel(level), // Real-time level for meter
});

// NEW: Track VAD status for UI
useEffect(() => {
  setIsVadActive(naturalVoice.isVadActive || false);
}, [naturalVoice.isVadActive]);
```

**Files Modified:**
- `components/treatment/v4/TreatmentSession.tsx` (enable VAD)

---

### Phase 6: Add UI - VAD Sensitivity Slider (1 hour)

**File:** `components/treatment/v4/TreatmentSession.tsx`

**Add VAD slider section in settings modal (after line 1886, before Guided Mode):**

```typescript
{/* VAD Sensitivity Slider - Only show when both mic and speaker enabled */}
{isMicEnabled && isSpeakerEnabled && !isGuidedMode && (
  <>
    {/* Border separator */}
    <div className="mt-4 pt-4 border-t border-border dark:border-[#586e75]">
      <div className="space-y-3">
        <div className="flex items-center space-x-2 text-sm font-medium text-foreground dark:text-[#fdf6e3]">
          <Mic className="h-4 w-4 text-indigo-500" />
          <span>Interruption Sensitivity</span>
          {isVadActive && (
            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-[#93a1a1]">
          <span>Sensitivity: {(vadSensitivity * 100).toFixed(0)}%</span>
          <span className={`font-medium ${
            vadSensitivity < 0.35 ? 'text-orange-600 dark:text-orange-400' : 
            vadSensitivity < 0.65 ? 'text-green-600 dark:text-green-400' : 
            'text-blue-600 dark:text-blue-400'
          }`}>
            {getVadSensitivityLabel(vadSensitivity)}
          </span>
        </div>
        
        <input
          type="range"
          min="0.1"
          max="0.9"
          step="0.05"
          value={vadSensitivity}
          onChange={(e) => handleVadSensitivityChange(parseFloat(e.target.value))}
          className="w-full h-3 md:h-2 bg-secondary dark:bg-[#586e75] rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        
        <div className="flex justify-between text-xs text-muted-foreground dark:text-[#93a1a1]">
          <span>10%</span>
          <span className="text-green-600 dark:text-green-400">50%</span>
          <span>90%</span>
        </div>

        {/* Quick preset buttons */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border dark:border-[#586e75]">
          {[
            { value: 0.25, label: 'Low' },
            { value: 0.5, label: 'Medium' },
            { value: 0.75, label: 'High' }
          ].map((preset) => (
            <button
              key={preset.value}
              onClick={() => handleVadSensitivityChange(preset.value)}
              className={`px-2 py-2.5 md:py-1.5 text-xs rounded-lg transition-colors ${
                Math.abs(vadSensitivity - preset.value) < 0.1
                  ? 'bg-indigo-600 text-white'
                  : 'bg-secondary dark:bg-[#586e75] text-muted-foreground dark:text-[#93a1a1] hover:bg-secondary/80 dark:hover:bg-[#657b83]'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Real-time voice level meter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-[#93a1a1]">
            <span>Voice Level</span>
            <span className={`font-medium ${
              vadLevel > 50 ? 'text-green-600 dark:text-green-400' : ''
            }`}>
              {vadLevel}%
            </span>
          </div>
          <div className="w-full bg-secondary dark:bg-[#586e75] rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full transition-all duration-100 ${
                vadLevel > 50 ? 'bg-green-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${vadLevel}%` }}
            />
          </div>
        </div>

        {/* Help text */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-900 dark:text-blue-200">
              <strong>Try it:</strong> Speak while the AI is talking to test interruption.
              <div className="mt-1 space-y-0.5">
                <div>• <strong>Low:</strong> Requires louder speech (noisy places)</div>
                <div>• <strong>Medium:</strong> Balanced (most situations)</div>
                <div>• <strong>High:</strong> Easier to interrupt (quiet rooms)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
)}
```

**Files Modified:**
- `components/treatment/v4/TreatmentSession.tsx` (UI for VAD slider)

---

### Phase 7: Testing Strategy (3-4 hours)

**Test Cases:**

#### Test 1: Basic Barge-In
1. Enable both mic and speaker
2. Set VAD sensitivity to Medium (50%)
3. Start a treatment session
4. Let AI speak a long response
5. **Action:** Speak loudly while AI is talking
6. **Expected:** AI stops immediately, your speech is recognized

#### Test 2: Sensitivity Levels
1. Test with Low (25%) sensitivity:
   - Should require louder speech to interrupt
   - Less likely to trigger on background noise
2. Test with Medium (50%) sensitivity:
   - Balanced interruption
3. Test with High (75%) sensitivity:
   - Easy to interrupt with quiet speech
   - May trigger on louder background noise

#### Test 3: False Positives
1. Play background music/TV
2. AI speaks
3. **Expected:** Should NOT interrupt (VAD filters out non-speech)

#### Test 4: Edge Cases
1. **Rapid interruptions:** Interrupt AI, then let AI speak, interrupt again
2. **Network latency:** Test with slow connection
3. **Multiple speakers:** Test with other people talking nearby
4. **Echo:** Test with external speakers (not headphones)

#### Test 5: Device Testing
- [ ] Desktop Chrome (Windows)
- [ ] Desktop Chrome (Mac)
- [ ] Desktop Firefox
- [ ] iPhone Safari
- [ ] Android Chrome
- [ ] Headphones vs. speakers
- [ ] Bluetooth headset

#### Test 6: Performance
- Check CPU usage with VAD running
- Verify no memory leaks (run for 30+ minutes)
- Test with multiple treatment sessions

**Files to Create:**
- Manual test checklist (this section)

---

### Phase 8: Error Handling & Fallbacks (1 hour)

**Scenarios to handle:**

1. **VAD initialization fails:**
   ```typescript
   if (naturalVoice.vadError) {
     // Show warning in settings
     toast.warning('Voice interruption unavailable. Please use text.');
   }
   ```

2. **Browser doesn't support required APIs:**
   - WebAssembly
   - AudioWorklet
   - Fallback: Disable VAD, show message

3. **Microphone access lost mid-session:**
   - VAD auto-stops
   - Show notification
   - Offer to re-enable

4. **VAD misfire (false positive):**
   - Logged automatically by library
   - Can track frequency
   - Suggest lowering sensitivity

**Add error display in settings modal:**

```typescript
{naturalVoice.vadError && (
  <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
    <div className="flex items-start space-x-2">
      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
      <div className="text-xs text-red-900 dark:text-red-200">
        <strong>Voice interruption unavailable:</strong> {naturalVoice.vadError}
      </div>
    </div>
  </div>
)}
```

**Files Modified:**
- `components/treatment/v4/TreatmentSession.tsx` (error UI)
- `components/voice/useVAD.tsx` (error handling)

---

### Phase 9: Performance Optimization (1 hour)

**Optimizations:**

1. **Lazy load VAD library:**
   ```typescript
   const loadVAD = async () => {
     if (!vadLoadedRef.current) {
       await import('@ricky0123/vad-web');
       vadLoadedRef.current = true;
     }
   };
   ```

2. **Only initialize when needed:**
   - Not in guided mode
   - Only when both mic+speaker enabled
   - Destroy when disabled

3. **Debounce level updates:**
   ```typescript
   const debouncedVadLevel = useMemo(
     () => debounce((level: number) => setVadLevel(level), 100),
     []
   );
   ```

4. **Reduce audio processing:**
   - Use single-threaded WASM (already in config)
   - Lower sample rate if needed

**Files Modified:**
- `components/voice/useVAD.tsx` (optimizations)

---

### Phase 10: Documentation (30 mins)

**Update existing docs:**

1. **User-facing:**
   - Add "Interruption Sensitivity" to settings documentation
   - Explain when VAD is active
   - Troubleshooting tips

2. **Developer-facing:**
   - Update architecture diagrams
   - Document VAD hook API
   - Add inline comments

3. **README updates:**
   - Add to dependencies list
   - Note bundle size increase
   - Link to VAD library docs

**Files to Update:**
- `V4_READY_FOR_VOICE.md`
- `audioFix.md`
- README (if exists)
- Inline comments in code

---

## 🎯 Success Metrics

After implementation:

1. ✅ **User can interrupt AI naturally**
   - No need to wait for AI to finish
   - No PTT button required
   - Feels like natural conversation

2. ✅ **Low false positive rate**
   - < 5% false positives with Medium sensitivity
   - Background noise doesn't trigger

3. ✅ **Fast response time**
   - Barge-in happens within 100-200ms of speech
   - AI stops immediately

4. ✅ **User control**
   - Sensitivity slider works smoothly
   - Settings persist across sessions
   - Real-time feedback is helpful

5. ✅ **Performance acceptable**
   - < 5% CPU increase
   - No noticeable latency
   - No memory leaks

---

## 📊 Implementation Timeline

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Install dependencies | 10 mins | ⏳ Pending |
| 2 | Add state management | 30 mins | ⏳ Pending |
| 3 | Create VAD hook | 2 hours | ⏳ Pending |
| 4 | Integrate with useNaturalVoice | 1 hour | ⏳ Pending |
| 5 | Update TreatmentSession | 30 mins | ⏳ Pending |
| 6 | Add UI slider | 1 hour | ⏳ Pending |
| 7 | Testing | 3-4 hours | ⏳ Pending |
| 8 | Error handling | 1 hour | ⏳ Pending |
| 9 | Performance optimization | 1 hour | ⏳ Pending |
| 10 | Documentation | 30 mins | ⏳ Pending |
| **Total** | | **10-11 hours** | |

**Estimated completion:** 1.5-2 days of focused work

---

## 🔧 Technical Details

### VAD Configuration Parameters

```typescript
{
  // Core sensitivity
  positiveSpeechThreshold: 0.5,     // 0-1, higher = more sensitive
  negativeSpeechThreshold: 0.35,    // Hysteresis: 0.15 below positive
  
  // Timing (in frames, 1 frame = ~30ms at 16kHz)
  minSpeechFrames: 3,                // Minimum 90ms of speech
  preSpeechPadFrames: 1,             // Include 30ms before speech
  redemptionFrames: 8,               // Allow 240ms silence mid-speech
  
  // Audio processing
  frameSamples: 1536,                // 96ms per frame
  ortConfig: (ort) => {
    ort.env.wasm.numThreads = 1;     // Single-threaded for efficiency
  },
}
```

### Sensitivity Mapping

| UI Label | Slider Value | Threshold | Use Case |
|----------|-------------|-----------|----------|
| Low | 0.25 | 0.25 | Noisy environments, open office |
| Medium | 0.50 | 0.50 | Normal indoor use, default |
| High | 0.75 | 0.75 | Quiet room, sensitive users |

### Barge-In Flow

```
1. AI speaking + VAD monitoring
   ↓
2. User starts speaking
   ↓
3. VAD detects speech (above threshold)
   ↓
4. onSpeechStart callback fires
   ↓
5. handleVadBargeIn():
   - Stop AI audio
   - Clear audio flags
   - Stop VAD temporarily
   ↓
6. Start full speech recognition
   ↓
7. User finishes speaking
   ↓
8. Transcript processed normally
   ↓
9. Resume VAD monitoring
```

---

## 🚨 Known Limitations

1. **WebAssembly required:** Won't work on very old browsers
2. **Microphone required:** Obviously needs mic access
3. **CPU overhead:** ~2-5% CPU usage on modern devices
4. **Echo dependency:** Works best with headphones or good echo cancellation
5. **False positives possible:** Loud background noise may trigger (especially on High)
6. **Network dependency:** Initial WASM download (~30KB)

---

## 🎛️ Configuration Options

### For Power Users (Future)

Could add advanced settings (hidden by default):

```typescript
// Advanced VAD settings (for debugging/tuning)
{
  minSpeechFrames: number,      // How long before speech confirmed
  redemptionFrames: number,     // How much silence allowed mid-speech
  preSpeechPadFrames: number,   // Audio captured before speech
}
```

**Not implementing in Phase 1** - keep it simple

---

## 🔄 Rollback Plan

If VAD causes issues:

1. **Quick disable:** Set `vadEnabled: false` in TreatmentSession.tsx
2. **Remove UI:** Hide VAD slider (conditional render already in place)
3. **Uninstall library:** `pnpm remove @ricky0123/vad-web`
4. **Revert changes:** Git revert to commit before VAD implementation

**Rollback safety:**
- VAD is additive (doesn't break existing functionality)
- Can disable via feature flag
- Easy to remove if needed

---

## 📝 Notes & Considerations

1. **Guided Mode:** VAD disabled in guided mode (PTT takes precedence)
2. **Battery impact:** May increase battery usage slightly on mobile
3. **Privacy:** All processing happens locally (no audio sent to server for VAD)
4. **Accessibility:** VAD is optional enhancement, text input always works
5. **Future:** Could add per-voice sensitivity tuning if needed

---

## ✅ Ready to Implement

This plan is comprehensive and ready to execute. The implementation is:

- ✅ Well-scoped (10-11 hours)
- ✅ Clearly documented
- ✅ Testable at each phase
- ✅ Reversible if needed
- ✅ User-centric (tunable sensitivity)
- ✅ Performance-conscious
- ✅ Error-handling included

**Next Step:** Install `@ricky0123/vad-web` and begin Phase 1.

---

**Status:** 📋 **Ready for Implementation**  
**Priority:** 🔴 High  
**Complexity:** 🟡 Medium (well-defined with library)  
**Risk:** 🟢 Low (additive feature with rollback plan)
