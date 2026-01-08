# Paroli Migration Scope Document

## Project: Replace ElevenLabs TTS with Self-Hosted Paroli + Piper + Opus

**Goal**: Eliminate ongoing TTS API costs while maintaining/improving voice quality and performance

**Approach**: Pattern 2 (Hybrid Static + Dynamic Streaming)

---

## Executive Summary

### Current State
- **Static audio**: 17 system prompts pre-generated with ElevenLabs (one-time cost, $0 runtime)
- **Dynamic audio**: AI-generated responses use ElevenLabs API at runtime (ongoing $$$ per request)
- **Total cost**: $0 for static + variable for dynamic (potentially $100s-1000s/month at scale)

### Target State
- **Static audio**: 17 system prompts pre-generated with Paroli (one-time, $0 forever)
- **Dynamic audio**: AI responses streamed from Paroli WebSocket (self-hosted, $0 per request)
- **Total cost**: ~$13/month hosting (Hetzner CPX31) regardless of user volume

### ROI
- **Break-even**: After ~13 ElevenLabs requests
- **Savings at 1,000 users/month**: ~$100-500/month
- **Savings at 10,000 users/month**: ~$1,000-5,000/month

---

## Technical Stack

### Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| **TTS Engine** | Piper (libritts-high model) | Neural text-to-speech synthesis |
| **Streaming Server** | Paroli (fork: MyAiAd/paroli) | REST API + WebSocket streaming |
| **Audio Codec** | Opus (24 kbps) | Low-latency web audio streaming |
| **Hosting** | Hetzner CPX31 VPS | 4 vCPU AMD EPYC, 8GB RAM |
| **Container** | Docker | Paroli deployment |
| **Reverse Proxy** | Nginx | SSL + WebSocket proxying |

### Performance Targets

| Metric | Target | Current (ElevenLabs) |
|--------|--------|----------------------|
| Static audio latency | <50ms (preloaded) | <50ms (preloaded) |
| Dynamic audio TTFB | <300ms | ~500ms |
| Streaming chunk latency | <100ms | N/A (no streaming) |
| Audio quality | 8/10 (Piper High) | 10/10 (ElevenLabs) |
| Cost per request | $0 | ~$0.01 |
| Concurrent users | 5-10 (CPX31) | Unlimited (API) |

---

## Architecture

### Pattern 2: Hybrid Static + Dynamic Streaming

```
┌─────────────────────────────────────────────────────┐
│ Frontend (Next.js)                                  │
│                                                     │
│ ┌──────────────────┐      ┌────────────────────┐  │
│ │ Static Audio     │      │ Dynamic Audio      │  │
│ │ V4AudioPreloader │      │ WebSocketStreamer  │  │
│ │                  │      │                    │  │
│ │ - INITIAL_WELCOME│      │ - AI responses     │  │
│ │ - Intros (17)    │      │ - Personalized msgs│  │
│ │ - Preloaded      │      │ - Real-time stream │  │
│ └──────────────────┘      └────────────────────┘  │
│         │                          │               │
└─────────┼──────────────────────────┼───────────────┘
          │                          │
          │                          │
          ▼                          ▼
┌─────────────────┐    ┌──────────────────────────┐
│ CDN/Static      │    │ Paroli Server (Hetzner)  │
│ /audio/v4/      │    │                          │
│ - manifest.json │    │ ┌──────────────────────┐ │
│ - *.opus files  │    │ │ Piper TTS Engine     │ │
│                 │    │ │ (libritts-high)      │ │
│                 │    │ └──────────────────────┘ │
│                 │    │                          │
│                 │    │ ┌──────────────────────┐ │
│                 │    │ │ Paroli API Server    │ │
│                 │    │ │ - REST: /api/tts     │ │
│                 │    │ │ - WS: /ws/tts        │ │
│                 │    │ │ - Opus encoding      │ │
│                 │    │ └──────────────────────┘ │
│                 │    └──────────────────────────┘
└─────────────────┘              wss://
```

### Request Flow

**Static Audio (System Prompts):**
1. User starts session
2. V4AudioPreloader fetches manifest.json
3. Preloads all 17 Opus files from CDN
4. Playback is instant from memory cache
5. Cost: $0

**Dynamic Audio (AI Responses):**
1. User submits response
2. AI generates personalized message
3. Frontend opens WebSocket to Paroli
4. Sends text → Paroli generates Opus stream
5. Chunks arrive → play immediately (streaming)
6. Close WebSocket when done
7. Cost: $0 (self-hosted)

---

## Implementation Phases

### Phase 1: Infrastructure Setup (Week 1)

**1.1 Provision Hetzner Server**
- Create CPX31 instance (€11.90/month)
- Ubuntu 24.04 LTS
- SSH key setup
- Firewall: Allow 22 (SSH), 80 (HTTP), 443 (HTTPS), 8080 (Paroli internal)

**1.2 Deploy Paroli**
```bash
# Install Docker
apt update && apt install -y docker.io docker-compose

# Download Piper models
mkdir -p /opt/piper-models
cd /opt/piper-models
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/en_US-libritts-high.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/en_US-libritts-high.onnx.json

# Clone Paroli (your fork)
git clone https://github.com/MyAiAd/paroli.git
cd paroli

# Build and run
docker build -t paroli .
docker run -d \
  -p 8080:8080 \
  -v /opt/piper-models:/models \
  --restart unless-stopped \
  --name paroli \
  paroli \
  --model /models/en_US-libritts-high.onnx \
  --port 8080
```

**1.3 Configure Nginx**
```nginx
# /etc/nginx/sites-available/paroli
upstream paroli_backend {
    server 127.0.0.1:8080;
}

server {
    listen 443 ssl http2;
    server_name tts.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/tts.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tts.yourdomain.com/privkey.pem;

    # WebSocket support
    location /ws/ {
        proxy_pass http://paroli_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }

    # REST API
    location /api/ {
        proxy_pass http://paroli_backend;
        proxy_set_header Host $host;
        proxy_read_timeout 60s;
    }
}
```

**1.4 Test Deployment**
```bash
# Test REST API
curl -X POST https://tts.yourdomain.com/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","output_format":"opus"}' \
  --output test.opus

# Play test file
ffplay test.opus

# Test WebSocket (using wscat)
npm install -g wscat
wscat -c wss://tts.yourdomain.com/ws/tts
```

### Phase 2: Static Audio Generation (Week 1)

**2.1 Update Generation Script**

File: `scripts/generate-static-audio.js`

Changes:
- Replace ElevenLabs API URL with Paroli endpoint
- Update request format (Paroli expects different JSON structure)
- Change output format from MP3 to Opus
- Update manifest generation to use .opus extension

**2.2 Regenerate All Static Audio**
```bash
# Set Paroli server URL
export PAROLI_SERVER_URL=https://tts.yourdomain.com

# Regenerate Rachel voice (17 segments)
node scripts/generate-static-audio.js rachel

# Regenerate Adam voice
node scripts/generate-static-audio.js adam

# Verify files
ls -lh public/audio/v4/static/rachel/
# Should see: *.opus files + manifest.json
```

**2.3 Update Preloader (Minor)**

File: `components/treatment/v4/V4AudioPreloader.tsx`

Changes:
- Update file extension from .mp3 → .opus (minimal)
- Update MIME type: 'audio/opus' (one line)
- No other changes needed (preloader is format-agnostic)

**2.4 Update Service Worker**

File: `public/sw.js`

Changes:
- Add 'audio/opus' to cached MIME types
- Update audio file pattern: /audio/.*\.opus$/

### Phase 3: Dynamic Streaming Implementation (Week 2)

**3.1 Create WebSocket Audio Streamer**

New file: `lib/audio/ParoliWebSocketStreamer.ts`

```typescript
/**
 * Streams audio from Paroli WebSocket in real-time
 *
 * Features:
 * - Connects to wss://tts.yourdomain.com/ws/tts
 * - Sends text, receives Opus audio chunks
 * - Plays chunks as they arrive (low latency)
 * - Handles reconnection, buffering, errors
 */
export class ParoliWebSocketStreamer {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext;
  private audioQueue: AudioBuffer[] = [];

  async speak(text: string): Promise<void> {
    // 1. Connect to WebSocket
    // 2. Send { text, format: 'opus' }
    // 3. Receive Opus chunks
    // 4. Decode and play in real-time
    // 5. Close when done
  }
}
```

**3.2 Update TTS API Route (Backwards Compatible)**

File: `app/api/tts/route.ts`

Changes:
- Add Paroli as a provider option
- Keep ElevenLabs/OpenAI as fallbacks
- Route: `provider: 'paroli'` → call Paroli REST API
- Route: `provider: 'elevenlabs'` → call ElevenLabs (fallback)

**3.3 Update useNaturalVoice Hook**

File: `components/treatment/v4/hooks/useNaturalVoice.tsx`

Changes:
- Add streaming support via ParoliWebSocketStreamer
- For static texts: Use preloaded audio (no change)
- For dynamic texts: Use WebSocket streaming
- Fallback: If WebSocket fails, use REST API

### Phase 4: Testing & Optimization (Week 2)

**4.1 Load Testing**
- Simulate 10 concurrent users
- Measure latency, audio quality, server CPU
- Identify bottlenecks

**4.2 Quality Comparison**
- A/B test: Piper High vs ElevenLabs
- User feedback on voice quality
- Adjust if needed (try different Piper models)

**4.3 Monitoring Setup**
- Server metrics: CPU, RAM, network
- Application metrics: WebSocket connections, latency
- Alerts: Server down, high latency, high CPU

### Phase 5: Production Deployment (Week 3)

**5.1 Staged Rollout**
- Deploy to staging environment first
- Test all flows end-to-end
- Fix any issues

**5.2 Production Deployment**
- Update Next.js environment variables
- Deploy updated frontend
- Monitor closely for 24 hours

**5.3 ElevenLabs Sunset**
- Keep ElevenLabs as fallback for 1 week
- Monitor fallback usage
- If <1% fallback rate: Remove ElevenLabs completely
- If >1% fallback rate: Investigate and fix issues

---

## Configuration

### Environment Variables

**Frontend (.env.local):**
```bash
# Paroli server
NEXT_PUBLIC_PAROLI_REST_URL=https://tts.yourdomain.com/api/tts
NEXT_PUBLIC_PAROLI_WS_URL=wss://tts.yourdomain.com/ws/tts

# Fallback (keep for 1 week during migration)
ELEVENLABS_API_KEY=sk_xxx (optional fallback)
```

**Backend (Hetzner server):**
```bash
# Paroli configuration
PIPER_MODEL_PATH=/opt/piper-models/en_US-libritts-high.onnx
PAROLI_PORT=8080
PAROLI_OUTPUT_FORMAT=opus
```

### Voice Selection

**Piper Models to Use:**

| Voice | Model | Quality | Speed | Use Case |
|-------|-------|---------|-------|----------|
| **Primary** | en_US-libritts-high | 8/10 | Medium | Production default |
| **Female Alt** | en_US-amy-medium | 7/10 | Fast | Testing/fallback |
| **Male** | en_US-ryan-high | 8/10 | Medium | Male voice option |

Download from: https://huggingface.co/rhasspy/piper-voices

---

## Code Changes Summary

### Files to Modify

| File | Changes | Effort |
|------|---------|--------|
| `scripts/generate-static-audio.js` | Replace API endpoint, use Opus | 2 hours |
| `components/treatment/v4/V4AudioPreloader.tsx` | Update file extension .opus | 30 min |
| `public/sw.js` | Add Opus MIME type | 15 min |
| `app/api/tts/route.ts` | Add Paroli provider | 2 hours |
| `components/treatment/v4/hooks/useNaturalVoice.tsx` | Add streaming support | 3 hours |
| **NEW:** `lib/audio/ParoliWebSocketStreamer.ts` | WebSocket streaming client | 4 hours |
| **NEW:** `lib/audio/OpusDecoder.ts` | Opus decoding utilities | 2 hours |

**Total estimated effort:** ~14 hours (2 days)

### Files to Update (Documentation)

- `STATIC_AUDIO_SOLUTION.md` → Update to reference Paroli
- `QUICK_START_STATIC_AUDIO.md` → Update commands for Paroli
- `ELEVENLABS_API_SETUP.md` → Add Paroli setup section
- `public/audio/v4/static/README.md` → Update generation instructions
- **NEW:** `PAROLI_DEPLOYMENT_GUIDE.md` → Server setup instructions

---

## Risk Assessment

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Piper quality not acceptable | High | Medium | A/B test early, keep ElevenLabs fallback |
| Paroli server downtime | High | Low | Health checks, auto-restart, monitoring |
| WebSocket connection issues | Medium | Medium | Implement reconnection, fallback to REST |
| Server capacity insufficient | Medium | Low | Start small, scale up as needed |
| Opus not supported in old browsers | Low | Very Low | 98% support, fallback to MP3 |

### Mitigation Strategy

1. **Gradual rollout**: 10% users → 50% → 100%
2. **Feature flag**: Toggle Paroli on/off without deployment
3. **Fallback chain**: Paroli → ElevenLabs → OpenAI
4. **Monitoring**: Real-time alerts for failures
5. **Rollback plan**: Revert to ElevenLabs in <5 minutes

---

## Success Metrics

### Performance Metrics

- **Static audio latency**: <50ms (preloaded)
- **Dynamic audio TTFB**: <300ms (streaming first token)
- **Audio quality score**: >7/10 (user surveys)
- **Server uptime**: >99.5%
- **WebSocket success rate**: >95%

### Business Metrics

- **TTS cost reduction**: >90% (target: $0 per 1,000 users)
- **Server hosting cost**: <$20/month
- **User satisfaction**: No degradation (maintain current NPS)
- **Scalability**: Support 10x user growth without cost increase

---

## Cost Analysis

### Current Costs (ElevenLabs)

| Usage | Static | Dynamic | Total |
|-------|--------|---------|-------|
| 100 users/month | $0 | ~$10-50 | $10-50 |
| 1,000 users/month | $0 | ~$100-500 | $100-500 |
| 10,000 users/month | $0 | ~$1,000-5,000 | $1,000-5,000 |

### New Costs (Paroli Self-Hosted)

| Usage | Hosting | Static | Dynamic | Total |
|-------|---------|--------|---------|-------|
| 100 users/month | $13 | $0 | $0 | $13 |
| 1,000 users/month | $13 | $0 | $0 | $13 |
| 10,000 users/month | $13-26* | $0 | $0 | $13-26 |

*May need to scale to CPX41 or add load balancing at very high volume

### ROI Timeline

- **Initial setup cost**: ~14 hours @ $100/hr = $1,400 (one-time)
- **Break-even point**:
  - At 100 users/month: ~28 months
  - At 1,000 users/month: ~3 months
  - At 10,000 users/month: <1 month

**Conclusion**: High upfront cost, but pays for itself quickly at scale.

---

## Next Steps

1. **Decision**: Approve this scope document
2. **Setup**: Provision Hetzner server (30 min)
3. **Deploy**: Install Paroli + Piper (2 hours)
4. **Test**: Verify audio generation works (1 hour)
5. **Implement**: Code changes per Phase 2-3 (2 days)
6. **Deploy**: Staged rollout to production (1 day)
7. **Monitor**: Track metrics for 1 week
8. **Optimize**: Tune performance based on data

**Total timeline**: ~2 weeks from approval to full production

---

## Appendix: Alternative Approaches

### If Piper Quality is Insufficient

**Option 1: Coqui TTS**
- Higher quality than Piper (~9/10)
- Slower generation (2-3x slower)
- More GPU memory required
- Compatible with Paroli? (needs investigation)

**Option 2: Fine-tuned Piper**
- Train custom Piper model on specific voice
- Requires dataset + training time (~1 week)
- Better quality for specific use case

**Option 3: Hybrid Approach**
- Use ElevenLabs for critical prompts (INITIAL_WELCOME)
- Use Paroli for everything else
- Reduces cost by 80-90% while keeping quality for key moments

### If Server Capacity is Insufficient

**Scaling Options:**
1. **Vertical**: Upgrade to CPX41 (8 vCPU, 16GB, €23.90/month)
2. **Horizontal**: Add second Paroli server + load balancer
3. **GPU**: Migrate to Vast.ai GPU instance (~$110/month for 24/7)
4. **NPU**: Buy RK3588 board ($180 one-time, host yourself)

---

## Documentation References

- Paroli repo: https://github.com/MyAiAd/paroli
- Piper voices: https://huggingface.co/rhasspy/piper-voices
- Opus codec: https://opus-codec.org/
- Hetzner pricing: https://www.hetzner.com/cloud
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket

---

**Document Version**: 1.0
**Last Updated**: 2026-01-08
**Author**: AI Architecture Planning
**Status**: Pending Approval
