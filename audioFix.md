# Audio System Fix - V4 Treatment Sessions

**Date Created:** 2026-01-15  
**Status:** Planning Phase - DO NOT START YET  
**Priority:** High (affects user experience on mobile)

---

## 🐛 Current Issues

### Issue 1: Audio Not Playing
- **Symptom:** Audio is not playing in V4 treatment sessions
- **Platform:** All platforms (but especially noticeable with voice enabled)
- **When:** Predates the timing diagnostic changes (2026-01-15)
- **Impact:** Users cannot hear AI responses even when voice is enabled

### Issue 2: Microphone Permission Modal Keeps Reopening (iPhone)
- **Symptom:** Modal/alert saying "microphone access allowed" keeps reopening
- **Platform:** iPhone specifically
- **When:** On every input box presentation
- **Expected:** Should only show once, or only when permission is first granted
- **Actual:** Shows repeatedly, annoying user experience
- **Impact:** Disrupts treatment flow, frustrates users

---

## 🎯 Proposed Solution

### Split Audio Controls into Two Independent Toggles

Currently there is one "Voice On/Off" toggle. We need to split this into:

1. **🎤 Microphone Toggle** (Input)
   - Controls whether the app listens to user speech
   - Independent from speaker output
   - Should remember permission state
   - Should not re-prompt if already granted

2. **🔊 Speaker/Output Toggle** (Output)
   - Controls whether the app plays audio responses
   - Independent from microphone input
   - Works even if mic is off
   - Uses Kokoro TTS streaming

### Why This Is Better

**User Flexibility:**
- Users who want to READ but SPEAK (mic on, speaker off)
- Users who want to LISTEN but TYPE (mic off, speaker on)
- Users who want full voice interaction (both on)
- Users who want text-only (both off)

**Better UX:**
- No more redundant permission prompts
- Clear separation of concerns
- Easier to debug issues
- Users understand what each toggle does

**Technical Benefits:**
- Can diagnose mic vs speaker issues separately
- Can handle permissions independently
- Cleaner state management
- Better error handling per component

---

## 🔢 Four State Combinations to Handle

### State 1: Both Off (Text-Only Mode)
**Mic:** ❌ Off | **Speaker:** ❌ Off

**Behavior:**
- ✅ Show standard text input box
- ✅ Display text responses immediately
- ❌ No audio playback
- ❌ No speech recognition
- ✅ No microphone permission requests
- ✅ Fastest response time (no audio delays)

**User Flow:**
1. User types response
2. Clicks send
3. Text appears immediately
4. No audio plays

**Implementation Notes:**
- Default mode if permissions not granted
- Fallback mode if audio systems fail
- Should work perfectly on all devices
- No special permissions needed

---

### State 2: Mic On, Speaker Off (Silent Reading Mode)
**Mic:** ✅ On | **Speaker:** ❌ Off

**Behavior:**
- ✅ Show microphone button/indicator
- ✅ Accept voice input via speech recognition
- ✅ Convert speech to text
- ✅ Display converted text in input box
- ✅ Display text responses immediately
- ❌ No audio playback of responses
- ✅ User can review/edit speech before sending

**User Flow:**
1. User clicks mic button (or speaks if auto-listening)
2. Speech is recognized → text appears in input box
3. User can edit text if needed
4. User clicks send
5. Text response appears (no audio)

**Use Cases:**
- User in quiet environment who wants to speak but not disturb others
- User wants to hear themselves think (no AI voice)
- User prefers to read AI responses
- Accessibility: user has hearing aids but still wants voice input

**Implementation Notes:**
- Request microphone permission ONLY (not audio output)
- Use browser's SpeechRecognition API
- Show visual feedback when listening
- Handle "no speech" gracefully
- Allow manual send if speech fails

**Edge Cases:**
- Microphone permission denied → fall back to text input
- Speech recognition not supported → fall back to text input
- Background noise → show confidence indicator
- Multiple speakers → use highest confidence transcript

---

### State 3: Mic Off, Speaker On (Listen-Only Mode)
**Mic:** ❌ Off | **Speaker:** ✅ On

**Behavior:**
- ✅ Show standard text input box (typing only)
- ✅ User types responses
- ✅ AI responses are spoken aloud (Kokoro TTS)
- ✅ Audio plays 150ms before text renders (perception fix)
- ✅ Show timing metrics (Text/Audio/Δ)
- ❌ No speech recognition
- ❌ No microphone permission requests

**User Flow:**
1. User types response
2. Clicks send
3. Audio starts playing (150ms delay)
4. Text appears on screen
5. User listens while reading

**Use Cases:**
- User prefers typing but wants to hear responses
- User has speech impediment or prefers not to speak
- User wants audio for accessibility (vision assistance)
- User multitasks and wants to listen while doing other things
- User learning language (wants to hear pronunciation)

**Implementation Notes:**
- No microphone permissions needed
- Use `useNaturalVoice` hook for audio playback
- Stream from Kokoro TTS API (`https://api.mind-shift.click/tts`)
- Cache audio with voice-prefixed keys (`heart:text`)
- Smart prefix matching for combined messages
- Apply playback rate preference
- Handle audio playback errors gracefully

**Edge Cases:**
- Audio fails to load → show text immediately, display error
- Network issues → retry with exponential backoff
- User clicks next before audio finishes → stop current audio
- Slow TTS API → show loading indicator, allow skip

---

### State 4: Both On (Full Voice Interaction)
**Mic:** ✅ On | **Speaker:** ✅ On

**Behavior:**
- ✅ Show microphone button/indicator
- ✅ Accept voice input via speech recognition
- ✅ Display transcribed text in input box (for confirmation)
- ✅ AI responses are spoken aloud (Kokoro TTS)
- ✅ Audio plays 150ms before text renders
- ✅ Show timing metrics
- ✅ Auto-advance after audio completes (for auto steps)
- ✅ Automatic listening restarts after AI finishes speaking
- ⚠️ CRITICAL: Prevent audio feedback loop

**User Flow:**
1. User speaks
2. Speech is recognized → text appears in input box
3. User can edit or just click send
4. Audio starts playing (AI response)
5. Text appears 150ms after audio
6. When audio finishes, mic automatically re-enables
7. User speaks again (conversational flow)

**Use Cases:**
- Full hands-free treatment session
- User driving or multitasking
- Most natural/conversational experience
- Accessibility: both input and output assistance
- User prefers voice-first interaction

**Implementation Notes:**
- Request BOTH microphone and audio permissions
- Use `useNaturalVoice` hook with full features enabled
- **CRITICAL:** Prevent feedback loop:
  - Stop listening while AI is speaking
  - Use `isAudioPlayingRef` flag
  - Browser speech recognition checks this flag
  - Only restart listening AFTER audio ends
  - Small delay (500-800ms) before restarting
- Handle timing for audio-first rendering
- Show clear visual indicators of mic state

**Edge Cases:**
- **Feedback Loop Prevention:**
  - User's device picks up AI voice → ignore if `isAudioPlayingRef.current === true`
  - Echo cancellation enabled in getUserMedia
  - Noise suppression enabled
  - Auto gain control enabled
- Microphone permission denied → fall back to State 3 (listen-only)
- Audio fails → fall back to State 2 (mic-only)
- Both fail → fall back to State 1 (text-only)
- User interrupts AI → stop audio immediately, start listening
- Multiple voices in room → use highest confidence transcript

---

## 📋 Implementation Checklist

### Phase 1: Planning & Design (Current Phase)
- [x] Document current issues
- [x] Design solution (split mic/speaker toggles)
- [x] Document all 4 state combinations
- [x] Review with team/user
- [x] Get approval to proceed
- [x] **IMPLEMENTATION COMPLETED** ✅

### Phase 2: UI/UX Updates
- [x] **Design new audio settings panel**
  - [x] Create mockup/wireframe
  - [x] Two separate toggle switches (mic + speaker)
  - [x] Clear labels: "🎤 Microphone" and "🔊 Audio Output"
  - [x] Visual indicators for each state
  - [x] Desktop and mobile layouts
  - [x] Dark mode support

- [x] **Update existing audio toggle locations**
  - [x] V4 TreatmentSession header (where "Voice On/Off" is now)
  - [x] Settings panel (if exists)
  - [x] Mobile bottom sheet (if on mobile)
  - [x] Ensure accessibility (ARIA labels, keyboard navigation)

- [x] **Add state indicators to UI**
  - [x] Show mic status (listening, idle, disabled)
  - [x] Show speaker status (playing, idle, disabled)
  - [x] Color coding (green=on, gray=off, red=error)
  - [x] Pulsing animation when active

### Phase 3: State Management Updates
- [x] **Create new state variables**
  ```typescript
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(false);
  ```

- [x] **Replace existing `isNaturalVoiceEnabled` logic**
  - [x] Audit all uses of `isNaturalVoiceEnabled`
  - [x] Split into separate mic/speaker checks
  - [x] Update all conditional logic

- [x] **Add state persistence**
  - [x] Save to localStorage: `v4_mic_enabled`, `v4_speaker_enabled`
  - [x] Load on component mount
  - [x] Respect user preferences across sessions

- [x] **Add permission state tracking**
  ```typescript
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [audioPermission, setAudioPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  ```

### Phase 4: Microphone Logic (State 2 & 4)
- [x] **Update `useNaturalVoice` hook**
  - [x] Accept separate `micEnabled` prop
  - [x] Only initialize speech recognition if `micEnabled === true`
  - [x] Don't request mic permission if `micEnabled === false`
  
- [x] **Improve microphone permission handling**
  - [x] Check permission state before requesting
  - [x] Only show modal if permission is 'prompt' (not granted)
  - [x] Cache permission state to avoid re-checks
  - [x] Handle denied state gracefully

- [x] **Fix repeated permission prompt issue (iPhone)**
  - [x] Check if permission already granted before showing modal
  - [x] Use `navigator.permissions.query({ name: 'microphone' })` if available
  - [x] Fallback: Track grant state in localStorage
  - [x] Don't show modal on every input box render

- [x] **Speech recognition management**
  - [x] Start listening only when mic enabled
  - [x] Stop listening when mic disabled
  - [x] Stop listening while audio playing (prevent feedback)
  - [x] Restart listening after audio ends (if both enabled)

### Phase 5: Speaker/Audio Logic (State 3 & 4)
- [x] **Update `useNaturalVoice` hook**
  - [x] Accept separate `speakerEnabled` prop
  - [x] Only play audio if `speakerEnabled === true`
  - [x] Skip audio generation if disabled

- [x] **Audio playback management**
  - [x] Only call `naturalVoice.speak()` if speaker enabled
  - [x] Show timing metrics only when audio plays
  - [x] Fall back to text-only if audio fails

- [x] **Pending message system**
  - [x] Only use pending message (audio-first) if speaker enabled
  - [x] Add message immediately if speaker disabled
  - [x] Update all 3 bot message locations:
    1. Main sendMessage responses
    2. Work type selection
    3. Method selection

### Phase 6: Combined State Logic (All 4 States)
- [x] **State 1 (Both Off) - Text Only**
  - [x] Verify text input works
  - [x] Verify text output works
  - [x] No audio requests
  - [x] No mic requests
  - [x] Fastest response time

- [x] **State 2 (Mic On, Speaker Off) - Silent Reading**
  - [x] Speech recognition starts
  - [x] Transcribed text appears in input
  - [x] User can edit before sending
  - [x] Text response appears (no audio)
  - [x] No audio playback

- [x] **State 3 (Mic Off, Speaker On) - Listen Only**
  - [x] Text input only (no speech recognition)
  - [x] Audio plays for responses
  - [x] Audio-first rendering (150ms delay)
  - [x] Timing metrics display
  - [x] No mic permission requests

- [x] **State 4 (Both On) - Full Voice**
  - [x] Speech recognition starts
  - [x] Transcribed text appears
  - [x] Audio plays for responses
  - [x] Audio-first rendering
  - [x] Auto-restart listening after audio ends
  - [x] **CRITICAL:** Feedback loop prevention active

### Phase 7: Feedback Loop Prevention (State 4)
- [x] **Verify existing protection**
  - [x] `isAudioPlayingRef` flag check
  - [x] Stop listening while speaking
  - [x] Restart delay after audio ends

- [x] **Add additional safeguards**
  - [x] Echo cancellation in getUserMedia
  - [x] Noise suppression
  - [x] Auto gain control
  - [ ] Confidence threshold for transcripts

- [ ] **Test feedback scenarios**
  - [ ] AI voice picked up by mic → should be ignored
  - [ ] User speaks while AI speaking → stop AI, listen to user
  - [ ] External speakers (no echo cancellation) → test behavior

### Phase 8: Error Handling & Fallbacks
- [ ] **Microphone errors**
  - [ ] Permission denied → disable mic, show text input
  - [ ] No microphone hardware → disable mic, show text input
  - [ ] Speech recognition not supported → disable mic, show text input
  - [ ] Network errors → retry with backoff

- [ ] **Speaker/Audio errors**
  - [ ] TTS API fails → show text immediately, display error
  - [ ] Network timeout → show text, allow retry
  - [ ] Audio playback error → show text, try alternative voice
  - [ ] Kokoro server down → fallback to browser TTS or text-only

- [ ] **Graceful degradation matrix**
  ```
  Requested: Mic ✅ + Speaker ✅
  Mic Fails: Fall back to Mic ❌ + Speaker ✅ (State 3)
  
  Requested: Mic ✅ + Speaker ✅
  Speaker Fails: Fall back to Mic ✅ + Speaker ❌ (State 2)
  
  Requested: Mic ✅ + Speaker ✅
  Both Fail: Fall back to Mic ❌ + Speaker ❌ (State 1)
  ```

### Phase 9: UI/UX Polish
- [ ] **Visual feedback**
  - [ ] Mic listening animation (pulsing)
  - [ ] Speaker playing animation
  - [ ] Clear disabled states
  - [ ] Error states (red indicator)

- [ ] **Accessibility**
  - [ ] ARIA labels for all toggles
  - [ ] Keyboard shortcuts (space to toggle mic?)
  - [ ] Screen reader announcements
  - [ ] High contrast mode support

- [ ] **Mobile optimizations**
  - [ ] Touch-friendly toggle sizes
  - [ ] Bottom sheet on mobile
  - [ ] iOS-specific fixes for modal issue
  - [ ] Android-specific testing

### Phase 10: Testing
- [ ] **Unit tests**
  - [ ] Test each state independently
  - [ ] Test state transitions
  - [ ] Test permission handling
  - [ ] Test error scenarios

- [ ] **Integration tests**
  - [ ] Test full treatment session in each state
  - [ ] Test state changes mid-session
  - [ ] Test permission revocation
  - [ ] Test audio/mic failures

- [ ] **Manual testing checklist**
  - [ ] **State 1 (Both Off)**
    - [ ] Can type and send messages
    - [ ] Responses appear as text only
    - [ ] No audio plays
    - [ ] No mic requests
  
  - [ ] **State 2 (Mic On, Speaker Off)**
    - [ ] Can speak to input
    - [ ] Transcript appears in input box
    - [ ] Can edit before sending
    - [ ] Responses appear as text only
    - [ ] No audio plays
  
  - [ ] **State 3 (Mic Off, Speaker On)**
    - [ ] Can type and send messages
    - [ ] Audio plays for responses
    - [ ] Text appears 150ms after audio starts
    - [ ] Timing metrics display correctly
    - [ ] No mic requests
  
  - [ ] **State 4 (Both On)**
    - [ ] Can speak to input
    - [ ] Audio plays for responses
    - [ ] Listening restarts after audio ends
    - [ ] No feedback loop
    - [ ] Timing metrics display correctly
    - [ ] Smooth conversational flow

- [ ] **Platform-specific testing**
  - [ ] **iPhone/iOS Safari**
    - [ ] Mic permission modal shows only once
    - [ ] Audio plays correctly
    - [ ] No repeated prompts
    - [ ] State persistence works
  
  - [ ] **Android Chrome**
    - [ ] Permissions work correctly
    - [ ] Audio plays correctly
    - [ ] No feedback loop
  
  - [ ] **Desktop Chrome**
    - [ ] All 4 states work
    - [ ] Keyboard shortcuts work
  
  - [ ] **Desktop Firefox**
    - [ ] All 4 states work
    - [ ] SpeechRecognition available (or graceful fallback)

### Phase 11: Documentation
- [ ] **Update user-facing docs**
  - [ ] How to enable microphone
  - [ ] How to enable speaker
  - [ ] What each state does
  - [ ] Troubleshooting guide

- [ ] **Update developer docs**
  - [ ] New state management system
  - [ ] Permission handling logic
  - [ ] Audio system architecture
  - [ ] Testing procedures

- [ ] **Update inline code comments**
  - [ ] Explain complex state logic
  - [ ] Document feedback loop prevention
  - [ ] Explain permission caching

### Phase 12: Deployment
- [ ] **Staging deployment**
  - [ ] Deploy to staging environment
  - [ ] Test all 4 states on staging
  - [ ] Get user feedback

- [ ] **Production deployment**
  - [ ] Deploy to production
  - [ ] Monitor error logs
  - [ ] Monitor user reports
  - [ ] Be ready to rollback if issues

- [ ] **Post-deployment monitoring**
  - [ ] Track audio playback success rate
  - [ ] Track microphone usage
  - [ ] Track permission grant/deny rates
  - [ ] Track error rates by state

---

## 🔧 Technical Implementation Details

### File Modifications Required

#### 1. `components/treatment/v4/TreatmentSession.tsx`
**Current:**
```typescript
const [isNaturalVoiceEnabled, setIsNaturalVoiceEnabled] = useState(false);
```

**New:**
```typescript
const [isMicEnabled, setIsMicEnabled] = useState(false);
const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(false);
const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
```

**Update all conditionals:**
```typescript
// Old:
if (isNaturalVoiceEnabled) {
  naturalVoice.speak(data.message);
}

// New:
if (isSpeakerEnabled) {
  naturalVoice.speak(data.message);
}
```

#### 2. `components/voice/useNaturalVoice.tsx`
**Update hook signature:**
```typescript
export const useNaturalVoice = ({
  onTranscript,
  micEnabled,      // NEW: separate from speakerEnabled
  speakerEnabled,  // NEW: separate from micEnabled
  voiceProvider = 'kokoro',
  kokoroVoiceId = 'af_heart',
  onAudioEnded,
  playbackRate = 1.0,
  onRenderText,
}: UseNaturalVoiceProps) => {
  // Only initialize speech recognition if micEnabled
  useEffect(() => {
    if (!micEnabled) return;
    // ... speech recognition setup
  }, [micEnabled]);

  // Only play audio if speakerEnabled
  const speak = useCallback(async (text: string) => {
    if (!speakerEnabled || !text) return;
    // ... audio playback
  }, [speakerEnabled]);
}
```

#### 3. New Component: `AudioSettingsPanel.tsx`
```typescript
interface AudioSettingsPanelProps {
  isMicEnabled: boolean;
  isSpeakerEnabled: boolean;
  onMicToggle: (enabled: boolean) => void;
  onSpeakerToggle: (enabled: boolean) => void;
  micPermission: 'granted' | 'denied' | 'prompt';
  className?: string;
}

export const AudioSettingsPanel = ({ ... }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">🎤 Microphone</div>
          <div className="text-sm text-muted-foreground">
            Speak your responses
          </div>
        </div>
        <Switch 
          checked={isMicEnabled}
          onCheckedChange={onMicToggle}
          disabled={micPermission === 'denied'}
        />
      </div>
      
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">🔊 Audio Output</div>
          <div className="text-sm text-muted-foreground">
            Hear AI responses
          </div>
        </div>
        <Switch 
          checked={isSpeakerEnabled}
          onCheckedChange={onSpeakerToggle}
        />
      </div>
      
      {/* Permission status indicators */}
      {micPermission === 'denied' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Microphone access denied. Please enable in browser settings.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
```

### Permission Checking Logic

```typescript
// Check microphone permission before requesting
const checkMicPermission = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  // Try modern Permissions API first
  if ('permissions' in navigator) {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state as 'granted' | 'denied' | 'prompt';
    } catch (e) {
      // Fallback for older browsers
    }
  }
  
  // Fallback: check localStorage
  const cached = localStorage.getItem('v4_mic_permission');
  if (cached) return cached as 'granted' | 'denied' | 'prompt';
  
  return 'prompt';
};

// Request permission only if not already granted
const requestMicPermission = async (): Promise<boolean> => {
  const currentState = await checkMicPermission();
  
  // Don't request if already granted
  if (currentState === 'granted') {
    console.log('🎤 Microphone already granted');
    return true;
  }
  
  // Don't request if denied
  if (currentState === 'denied') {
    console.log('🎤 Microphone denied');
    return false;
  }
  
  // Only request if 'prompt'
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop()); // Stop immediately, we just needed permission
    localStorage.setItem('v4_mic_permission', 'granted');
    setMicPermission('granted');
    return true;
  } catch (e) {
    localStorage.setItem('v4_mic_permission', 'denied');
    setMicPermission('denied');
    return false;
  }
};
```

### State Persistence

```typescript
// Save state to localStorage
const saveMicState = (enabled: boolean) => {
  localStorage.setItem('v4_mic_enabled', JSON.stringify(enabled));
  setIsMicEnabled(enabled);
};

const saveSpeakerState = (enabled: boolean) => {
  localStorage.setItem('v4_speaker_enabled', JSON.stringify(enabled));
  setIsSpeakerEnabled(enabled);
};

// Load state on mount
useEffect(() => {
  const savedMic = localStorage.getItem('v4_mic_enabled');
  const savedSpeaker = localStorage.getItem('v4_speaker_enabled');
  
  if (savedMic !== null) {
    setIsMicEnabled(JSON.parse(savedMic));
  }
  
  if (savedSpeaker !== null) {
    setIsSpeakerEnabled(JSON.parse(savedSpeaker));
  }
}, []);
```

---

## 🚨 Critical Issues to Address

### 1. iPhone Modal Reopening Issue
**Root Cause:**
- Permission modal shows on every input box render
- Likely checking permission state on every render
- Not caching the grant state

**Solution:**
- Check permission state ONCE on component mount
- Cache the result in localStorage
- Don't re-check unless user explicitly enables mic
- Use Permissions API where available

**Implementation:**
```typescript
const [hasCheckedPermission, setHasCheckedPermission] = useState(false);

useEffect(() => {
  if (!hasCheckedPermission && isMicEnabled) {
    checkMicPermission().then(state => {
      setMicPermission(state);
      setHasCheckedPermission(true);
    });
  }
}, [isMicEnabled, hasCheckedPermission]);
```

### 2. Audio Not Playing Issue
**Possible Causes:**
- Speaker disabled but code tries to play audio anyway
- TTS API failing silently
- Audio element not properly initialized
- Kokoro server down or slow
- Browser autoplay policy blocking audio

**Diagnostic Steps:**
1. Check browser console for audio errors
2. Check network tab for TTS API calls
3. Verify Kokoro server is responding
4. Test with simple Audio element
5. Check if issue is specific to cached vs. streamed audio

**Solution Approaches:**
- Add better error logging
- Show visual indicator when audio fails
- Add retry logic for failed audio
- Fallback to browser TTS if Kokoro fails
- Respect speaker toggle state

---

## 📊 Success Metrics

After implementation, we should see:

1. **Zero repeated permission prompts on iPhone**
   - Modal shows only once per session
   - Or only when permission state changes

2. **Audio plays reliably**
   - 99%+ success rate for audio playback
   - Clear error messages when it fails
   - Graceful fallback to text

3. **All 4 states work correctly**
   - Can use each combination independently
   - Smooth transitions between states
   - No unexpected behavior

4. **Better user experience**
   - Users understand what each toggle does
   - No confusion about voice settings
   - Flexible interaction modes

5. **Lower error rates**
   - Fewer microphone errors
   - Fewer audio playback errors
   - Better error messages when issues occur

---

## 🎨 UI Mockup Notes

### Desktop Layout
```
┌─────────────────────────────────────┐
│  Mind Shifting V4        [Settings] │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ Audio Settings                  ││
│  │                                 ││
│  │ 🎤 Microphone    [Toggle: Off] ││
│  │    Speak your responses         ││
│  │                                 ││
│  │ 🔊 Audio Output  [Toggle: On]  ││
│  │    Hear AI responses            ││
│  └─────────────────────────────────┘│
│                                     │
│  [Treatment messages here...]       │
└─────────────────────────────────────┘
```

### Mobile Layout (Bottom Sheet)
```
┌─────────────────────┐
│ [Drag handle]       │
│                     │
│ Audio Settings      │
│                     │
│ 🎤 Microphone       │
│    [Toggle: Off] ── │
│                     │
│ 🔊 Audio Output     │
│    [Toggle: On] ─── │
│                     │
│ [Close]             │
└─────────────────────┘
```

---

## ⚠️ Risks & Mitigations

### Risk 1: Breaking Existing Functionality
**Mitigation:**
- Extensive testing before deployment
- Feature flag to enable/disable new system
- Ability to rollback quickly
- Keep old code temporarily as fallback

### Risk 2: Permission Handling Complexity
**Mitigation:**
- Use well-tested permission checking libraries
- Extensive testing on all platforms
- Clear error messages
- Graceful fallbacks

### Risk 3: Feedback Loop in State 4
**Mitigation:**
- Rigorous testing of feedback prevention
- Echo cancellation enabled
- Clear visual indicators of mic state
- Ability to manually stop/start

### Risk 4: Audio Reliability
**Mitigation:**
- Monitor Kokoro server uptime
- Implement retry logic
- Fallback to browser TTS
- Clear error messages to user

---

## 🎯 Next Steps

1. **Review this document** - Ensure all requirements are captured
2. **Get user/team approval** - Confirm this is the right approach
3. **Create GitHub issue** - Track progress
4. **Start with Phase 2** - UI/UX design mockups
5. **Iterative implementation** - Build and test each phase
6. **Extensive testing** - All 4 states, all platforms
7. **Staged rollout** - Staging → Production

---

## 📝 Notes & Questions

### Questions to Answer Before Starting:
- [ ] Should we use a modal or bottom sheet for settings on mobile?
- [ ] Should toggles be in the header or in a separate settings panel?
- [ ] Do we need voice selection here too, or keep that separate?
- [ ] Should we show microphone level indicator (visual feedback)?
- [ ] Do we want keyboard shortcuts for toggling?
- [ ] Should we persist state across sessions or reset each time?

### Dependencies:
- Existing `useNaturalVoice` hook (already exists)
- Kokoro TTS API (already set up)
- Speech Recognition API (browser built-in)
- localStorage for persistence

### Estimated Timeline:
- **Phase 1 (Planning):** 1 day - CURRENT
- **Phase 2-3 (UI + State):** 2-3 days
- **Phase 4-5 (Mic + Speaker):** 2-3 days
- **Phase 6-7 (States + Feedback):** 2-3 days
- **Phase 8-9 (Errors + Polish):** 2-3 days
- **Phase 10 (Testing):** 3-5 days
- **Phase 11-12 (Docs + Deploy):** 1-2 days
- **Total:** 13-22 days (2-4 weeks)

---

**Status:** ✅ **CORE IMPLEMENTATION COMPLETED - Ready for Testing** (2026-01-15)
**Priority:** 🔴 High (user experience issue)
**Complexity:** 🟡 Medium-High (requires careful state management)

## 🎉 Implementation Summary

**What Was Implemented:**

1. ✅ **Split Audio Controls** - Microphone and Speaker are now independent toggles
2. ✅ **Permission System** - Smart permission checking prevents repeated prompts on iPhone
3. ✅ **State Management** - Complete separation of mic/speaker state with localStorage persistence
4. ✅ **Audio System Updates** - `useNaturalVoice` hook updated to support separate mic/speaker controls
5. ✅ **All 4 States Implemented** - Text-only, Mic-only, Speaker-only, and Full Voice modes
6. ✅ **UI Updates** - Mobile and desktop headers updated with new split toggles
7. ✅ **Feedback Loop Prevention** - Echo cancellation, noise suppression, and auto-gain control enabled
8. ✅ **Backward Compatibility** - Old `isNaturalVoiceEnabled` preserved during transition

**Files Modified:**
- `/components/voice/useNaturalVoice.tsx` - Updated hook with mic/speaker separation
- `/components/treatment/v4/TreatmentSession.tsx` - State management and UI updates
- `/components/voice/AudioSettingsPanel.tsx` - NEW component for audio settings

**Next Steps:**
- Manual testing of all 4 states on desktop and mobile
- iPhone-specific testing for permission modal fix
- Performance validation and error handling verification

**Rollback Point:**
- Git commit available if needed
- Old code preserved with DEPRECATED comments for easy rollback



---

## Voice Activity Detection (VAD) - Barge-In Flow

**Updated**: January 21, 2026

### Barge-In Integration

VAD enables users to interrupt AI audio mid-sentence. The system coordinates between VAD, audio playback, and speech recognition to provide seamless interruption.

### Flow Diagram

```
[AI Speaking] → [User Speaks] → [VAD Detects] → [Stop Audio] → [Pause VAD] → [Speech Recognition] → [Resume VAD]
```

### Implementation Details

**State Management**:
- `isAudioPlayingRef` tracks active audio playback
- `isSpeakingRef` prevents feedback loops
- `pausedAudioRef` cleared on interruption

**VAD Coordination**:
1. VAD monitors while `isSpeakerEnabled && isMicEnabled`
2. On speech detection: pause VAD, stop audio, start recognition
3. After recognition completes: resume VAD monitoring

**Audio Queue Handling**:
- All queued audio segments cleared on barge-in
- Paused audio state reset
- Audio flags immediately updated

### Preventing Feedback Loops

1. **VAD pauses during recognition**: Prevents detecting user's own speech multiple times
2. **Audio playing flag**: Speech recognition doesn't auto-start if audio is playing
3. **State synchronization**: All audio state refs updated atomically

### Console Logging

```
🎙️ VAD: Speech started
🎙️ VAD: Paused during speech recognition
🎤 Natural Voice: Listening started
🎤 Natural Voice: Listening ended
🎙️ VAD: Resumed monitoring after speech recognition
```

