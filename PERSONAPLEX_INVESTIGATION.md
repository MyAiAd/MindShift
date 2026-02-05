# PersonaPlex Investigation for Audio Issue Resolution

**Date:** 2026-01-27  
**Project:** MindShifting V4 Voice System  
**Purpose:** Evaluate if PersonaPlex can resolve the "repeat 3-4 times" audio recognition issue  
**Status:** Fact-finding only (no code changes)

---

## What is PersonaPlex?

**PersonaPlex** is NVIDIA's open-source full-duplex conversational AI model released January 15, 2026.

### Key Specifications

- **Model Size:** 7 billion parameters
- **Audio Sampling:** 24 kHz
- **License:** NVIDIA Open Model License (commercial use allowed)
- **Code:** GitHub at `NVIDIA/personaplex`
- **Model Weights:** Hugging Face `nvidia/personaplex-7b-v1`

### Core Architecture Difference

```
Traditional System (Your Current Setup):
┌────────────────────────────────────────────────────────────┐
│ Microphone → VAD → Web Speech API (ASR) → LLM → TTS       │
│             ↑      ↑                        ↑     ↑        │
│          Separate  Separate             Separate Separate  │
│          component component            component component│
└────────────────────────────────────────────────────────────┘
Issues: Dead zones, handoff delays, VAD threshold sensitivity

PersonaPlex System:
┌────────────────────────────────────────────────────────────┐
│ Microphone → Single Full-Duplex Model → Audio Output      │
│             (listens + speaks + processes simultaneously)  │
└────────────────────────────────────────────────────────────┘
No VAD needed, no ASR→LLM handoff, no restart delays
```

---

## How PersonaPlex Addresses Your Current Issues

Referencing the problems documented in `audioIssues.md`:

### Issue 1: Dead Zones from SpeechRecognition Restarts (500ms gaps)

**Your Current Problem:**
- `continuous: false` with 500ms restart delay
- User speech during restart windows is completely missed

**PersonaPlex Solution:**
- **No restarts needed** - the model is always listening and processing
- Continuous audio stream processed in real-time
- No "recognition ended, wait 500ms, restart" cycle

**Resolution:** ✅ **SOLVED** - Eliminates dead zones entirely

### Issue 2: SpeechRecognition Blocked During AI Audio (isAudioPlayingRef)

**Your Current Problem:**
- While AI speaks, Web Speech API is blocked to prevent feedback
- Only VAD can detect user speech during AI playback
- If VAD doesn't trigger → user not heard

**PersonaPlex Solution:**
- **Full-duplex by design** - model listens while speaking
- Parallel audio streams for both user and model
- No need to block input during output

**Resolution:** ✅ **SOLVED** - Can always hear user, even while speaking

### Issue 3: VAD-to-Recognition Handoff Delay (100ms, loses first words)

**Your Current Problem:**
- VAD detects speech → 100ms delay → start SpeechRecognition
- User's first word(s) lost during handoff

**PersonaPlex Solution:**
- **No handoff** - single model handles everything
- Immediate response to user speech
- 0.07 second speaker switching latency (vs your ~100ms+ handoff)

**Resolution:** ✅ **SOLVED** - No handoff delay

### Issue 4: VAD Sensitivity Tuning (threshold too strict at default 0.5)

**Your Current Problem:**
- VAD threshold may not trigger reliably
- Varies by mic quality, environment, OS audio processing

**PersonaPlex Solution:**
- **No VAD needed** - model processes continuous audio directly
- Neural codec handles audio encoding/decoding
- No threshold tuning required

**Resolution:** ✅ **SOLVED** - Eliminates VAD entirely

### Issue 5: Web Speech API Reliability (no-speech, aborted, network errors)

**Your Current Problem:**
- Browser Web Speech API can fail transiently
- Errors cause restart loops and missed speech

**PersonaPlex Solution:**
- **Self-contained model** - no browser API dependency
- Consistent behavior across environments
- No browser API error states to handle

**Resolution:** ✅ **SOLVED** - Removes Web Speech API entirely

### Issue 6: Interruption Handling

**Your Current Problem:**
- Complex logic to stop AI, clear state, restart recognition
- Timing-sensitive coordination between multiple systems

**PersonaPlex Solution:**
- **Natural interruptions built-in** - 100% success rate in testing
- Model learns when to pause, interrupt, backchannel
- Handles overlapping speech natively

**Resolution:** ✅ **SOLVED** - Interruptions are a core model capability

---

## Technical Capabilities

### What PersonaPlex Does

1. **Speech-to-Speech Model**
   - Direct audio input → audio output
   - No separate ASR/TTS pipeline
   - Text tokens and audio tokens generated together

2. **Full-Duplex Operation**
   - Listens and speaks simultaneously
   - Updates internal state while user speaks
   - Streams responses in real-time

3. **Conversational Behaviors**
   - Backchannels ("uh-huh", "mm-hmm")
   - Natural pauses and turn-taking
   - Interruption handling
   - Non-verbal cues

4. **Customization**
   - Voice customization via audio prompts
   - Persona customization via text prompts
   - Can be any role: therapist, coach, teacher, etc.

5. **Performance**
   - 0.07 second speaker switching (vs Gemini Live's 1.3s)
   - 24 kHz audio quality
   - Real-time streaming

---

## Compatibility with Your Stack

### Current Tech Stack Analysis

Your current system uses:
- **Frontend:** Next.js / React (browser-based)
- **Audio Format:** OPUS (you mentioned this)
- **Voice Provider:** Kokoro TTS (server-side)
- **STT:** Web Speech API (browser-based)
- **Backend:** Supabase, Node.js serverless functions

### PersonaPlex Requirements

PersonaPlex is a **Python-based PyTorch model** that needs:
- GPU acceleration (CUDA) for real-time performance
- Python runtime environment
- ~7B parameter model weights (~14GB)
- Backend server infrastructure

### Integration Options

#### Option A: Full Server-Side (Most Reliable)

```
Browser → WebSocket → Backend Server (PersonaPlex) → WebSocket → Browser
         (OPUS)                    (GPU)                   (Audio)
```

**Pros:**
- Eliminates ALL browser voice API issues
- Consistent performance
- Full control over audio processing
- Works on any device/browser

**Cons:**
- Requires GPU server (expensive: ~$0.50-1/hr for inference GPU)
- Increased latency (network round-trip)
- More complex deployment

#### Option B: Hybrid Approach

Keep Kokoro TTS for pre-scripted responses, use PersonaPlex only for conversational parts:

```
Static prompts → Kokoro TTS (current system)
Dynamic conversation → PersonaPlex (new system)
```

**Pros:**
- Leverages existing cached audio infrastructure
- Only pays GPU costs for actual conversation
- Gradual migration path

**Cons:**
- More complex architecture
- Switching between systems mid-session

#### Option C: Edge Deployment (Future)

Wait for quantized/optimized versions that can run on:
- High-end consumer GPUs
- Edge devices with NPUs
- Browser WebGPU (speculative)

**Pros:**
- No server costs
- Low latency
- Privacy-preserving

**Cons:**
- Not currently feasible
- Would take 6-12+ months for ecosystem to mature

---

## Comparison: Current System vs PersonaPlex

| Issue | Current System | PersonaPlex |
|-------|---------------|-------------|
| **Dead zones (500ms restart)** | ❌ Yes, frequent | ✅ No restarts needed |
| **Blocked during AI speech** | ❌ Yes (feedback prevention) | ✅ Full-duplex, always listening |
| **Handoff delays** | ❌ 100ms+ VAD→ASR | ✅ No handoff, single model |
| **VAD sensitivity tuning** | ❌ Required, finicky | ✅ No VAD needed |
| **Web Speech API errors** | ❌ Frequent, uncontrollable | ✅ No browser API dependency |
| **Interruption handling** | ⚠️ Complex, timing-sensitive | ✅ 100% success, native |
| **Latency** | ⚠️ Variable (200-1000ms) | ✅ 70ms speaker switch |
| **Browser compatibility** | ⚠️ Chrome best, others vary | ✅ Server-side, consistent |
| **Infrastructure** | ✅ Serverless, low cost | ❌ GPU server required |
| **Deployment complexity** | ✅ Simple (browser APIs) | ❌ Complex (model serving) |
| **Cost** | ✅ ~$0.01/session (TTS only) | ❌ ~$0.50-1/hr (GPU) |

---

## Critical Questions to Answer

### 1. Infrastructure / Cost

**Q:** Can you afford GPU inference servers?
- PersonaPlex needs CUDA GPU for real-time performance
- Estimated cost: $0.50-1.00/hour on cloud GPU (A10/A100)
- For 100 concurrent sessions: ~$50-100/hour

**Q:** What's your current server setup?
- Vercel (serverless) can't run GPU workloads
- Would need separate GPU inference service (e.g., Modal, RunPod, AWS EC2 with GPU)

### 2. Latency / Network

**Q:** What's acceptable audio latency for your users?
- Current: Variable (200ms-1s+ including restarts/handoffs)
- PersonaPlex server-side: 70ms model + network RTT (50-200ms) = 120-270ms
- PersonaPlex would likely be **faster and more consistent** even with network

**Q:** Are your users on reliable networks?
- WebSocket audio streaming requires stable connection
- Could implement buffering/jitter handling

### 3. Feature Compatibility

**Q:** Do you need the LLM to access external context?
- Your current system: Treatment state machine calls OpenAI with context
- PersonaPlex: Self-contained model (no external LLM calls)
- You'd need to inject treatment protocol into PersonaPlex prompts

**Q:** Can PersonaPlex follow your treatment protocols?
- PersonaPlex can be conditioned with text prompts (persona, role, scenario)
- You'd need to test if it can follow therapy frameworks like:
  - Problem Shifting
  - Identity Shifting
  - Belief Shifting
  - etc.

### 4. Migration Path

**Q:** Can you run a gradual migration?
- Hybrid approach: Keep Kokoro for static, PersonaPlex for dynamic
- A/B test with subset of users
- Or pilot with internal/beta testers first

---

## Risks and Limitations

### Technical Risks

1. **Model Behavior Uncertainty**
   - PersonaPlex is pre-trained; you can't fine-tune easily
   - May not follow therapeutic protocols precisely
   - Need extensive testing to validate treatment fidelity

2. **Infrastructure Complexity**
   - Adds GPU server management
   - WebSocket connection stability
   - Audio buffering and streaming complexity

3. **Cost Scaling**
   - GPU costs scale linearly with concurrent users
   - May be prohibitive at scale
   - Need clear ROI from improved user experience

### Functional Limitations

1. **No Text Fallback**
   - Current system allows text input if voice fails
   - PersonaPlex is speech-to-speech only
   - Would need parallel text interface for accessibility

2. **Voice Cloning**
   - PersonaPlex needs voice samples for customization
   - Your Kokoro setup likely easier for multi-voice support

3. **Controlled Responses**
   - LLM-based system gives you fine control over responses
   - PersonaPlex is more autonomous, harder to constrain

---

## Proof of Concept Plan

To determine if PersonaPlex solves your issues:

### Phase 1: Local Testing (1-2 weeks)

1. **Set up PersonaPlex locally**
   - Clone NVIDIA/personaplex
   - Download model weights
   - Run inference on GPU machine (or rent hourly)

2. **Test Core Capabilities**
   - Can it be interrupted reliably? ✓
   - Does it handle overlapping speech? ✓
   - Can it be prompted to follow therapy framework? ?
   - What's actual latency over WebSocket? ?

3. **Test Treatment Protocol Compatibility**
   - Craft prompts for each modality (Problem Shifting, etc.)
   - Run sample sessions
   - Evaluate adherence to protocol vs. current system

### Phase 2: Integration Prototype (2-4 weeks)

1. **Build WebSocket Bridge**
   - Browser → WebSocket → PersonaPlex server
   - Audio streaming (OPUS encoding/decoding)
   - State synchronization (treatment session context)

2. **Minimal Frontend Integration**
   - Replace `useNaturalVoice` hook with WebSocket client
   - Keep existing UI
   - Test with real treatment scripts

3. **Compare User Experience**
   - Side-by-side with current system
   - Measure:
     - Interruption success rate
     - Speech recognition accuracy
     - User "repeat count" (the key metric!)
     - Latency

### Phase 3: Decision Point

Based on POC results:

**If PersonaPlex performs well:**
- Plan production deployment (GPU infrastructure)
- Cost model and scaling plan
- Migration strategy

**If PersonaPlex doesn't fit:**
- Fall back to fixing current system (audioIssues.md recommendations)
- Consider hybrid approach
- Wait for ecosystem maturity

---

## Recommendation

### Short Answer

**PersonaPlex could theoretically solve ALL the audio recognition issues** documented in `audioIssues.md` by eliminating the problematic architecture (VAD + Web Speech API restarts + handoff delays).

**However**, it's a significant architectural shift with meaningful tradeoffs:

- ✅ Fixes all timing/dead-zone issues
- ✅ Native interruption handling
- ✅ More natural conversation
- ❌ Requires GPU infrastructure ($$)
- ❌ More complex deployment
- ❓ Unknown if it can follow treatment protocols
- ❓ Unknown if cost is justified

### Recommended Next Steps

1. **Immediate (This Week):**
   - Test PersonaPlex locally if you have GPU access
   - Evaluate if it can be prompted to follow therapy frameworks
   - Measure actual latency for your use case

2. **If Promising (Next 2-4 Weeks):**
   - Build minimal POC with WebSocket integration
   - Compare interruption reliability vs current system
   - Calculate ROI: GPU cost vs improved UX → retention/revenue

3. **If Not Viable:**
   - Implement quick fixes from `audioIssues.md`:
     - Reduce 500ms restart delay → 100-150ms
     - Lower default VAD sensitivity → 0.65-0.7
     - Reduce handoff delay → 50ms
     - Enable `interimResults: true`

---

## MyAiAd Fork Investigation

**Repository:** [https://github.com/MyAiAd/personaplex](https://github.com/MyAiAd/personaplex)

### What's in the Fork

The MyAiAd fork is a **direct fork of NVIDIA/personaplex** with the standard PersonaPlex implementation:

**Key Components:**
- `moshi/` - Core PersonaPlex/Moshi Python package
- `client/` - Web client (TypeScript 24.2%, Python 74.8%)
- `Dockerfile` + `docker-compose.yaml` - Containerized deployment
- Web UI accessible at `localhost:8998` with HTTPS

**Server Setup:**
```bash
# Launch server (creates temporary SSL certs)
SSL_DIR=$(mktemp -d); python -m moshi.server --ssl "$SSL_DIR"
```

**GPU Requirement Confirmed:**
```bash
# If GPU has insufficient memory, offload to CPU
SSL_DIR=$(mktemp -d); python -m moshi.server --ssl "$SSL_DIR" --cpu-offload
```

The `--cpu-offload` flag exists BUT:
- Still requires GPU for primary computation
- Offloads **some** layers to CPU to reduce GPU memory usage
- NOT a pure CPU solution for real-time inference

**Pure CPU Mode:**
```bash
# CPU-only PyTorch for OFFLINE evaluation only
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
python -m moshi.offline ...  # Not real-time!
```

### GPU Requirement is Absolute for Real-Time Use

**The documentation is clear:**
- Real-time server: **Requires GPU**
- CPU offload: Still needs GPU, just uses less VRAM
- Pure CPU: **Offline evaluation only**, not real-time conversation

**This means:**
- No serverless deployment (Vercel, Netlify, etc.)
- Needs dedicated GPU server (AWS EC2 with GPU, RunPod, Modal, etc.)
- Minimum: ~$0.50-1.00/hour for GPU inference
- Not feasible for your current architecture without major infrastructure changes

---

## Conclusion

PersonaPlex is **architecturally superior** for real-time voice interaction and would eliminate the root causes identified in `audioIssues.md`. 

**However, the GPU requirement is a deal-breaker** for your current setup:

### Why PersonaPlex Won't Work (Now)

1. ❌ **Requires GPU for real-time operation** - confirmed in MyAiAd fork
2. ❌ **Your stack is serverless** (Vercel) - can't run GPU workloads
3. ❌ **Cost would be prohibitive** - $0.50-1/hr × concurrent users
4. ❌ **Major infrastructure rewrite** - need GPU server management
5. ❌ **CPU-only mode is offline evaluation only** - not real-time

### The Better Path Forward

Given the GPU constraint, **implement the quick fixes from `audioIssues.md`**:

#### Immediate Fixes (Highest ROI, No Infrastructure Changes)

1. **Reduce restart delay** from 500ms → 100ms
   - `useNaturalVoice.tsx` line ~206-209
   - Eliminates the largest "dead zone"

2. **Lower default VAD sensitivity** from 0.5 → 0.7
   - `TreatmentSession.tsx` line ~179
   - Makes barge-in easier to trigger

3. **Reduce handoff delay** from 100ms → 50ms
   - `useNaturalVoice.tsx` line ~137-141
   - Reduces lost initial words

4. **Enable interim results** 
   - `useNaturalVoice.tsx` line 185: `interimResults: true`
   - Gives users feedback that they're being heard

These changes should **significantly reduce** the "repeat 3-4 times" issue without requiring GPU infrastructure.

### Future: When GPU Becomes Viable

PersonaPlex would be worth revisiting if:
- Your scale justifies dedicated GPU costs ($50-100/hr for 100 users)
- Edge deployment becomes viable (WebGPU, quantized models)
- You get GPU inference credits/partnership

Until then, the architectural improvements to your existing Web Speech API + VAD system are the practical solution.

---

**Status:** Investigation complete. GPU requirement confirmed as blocker.  
**Recommendation:** Proceed with `audioIssues.md` quick fixes instead of PersonaPlex migration.  
**Next:** Implement the 4 immediate fixes above to improve voice reliability.
