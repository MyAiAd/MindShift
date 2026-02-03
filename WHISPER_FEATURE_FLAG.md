# Whisper Feature Flag Implementation

## Overview

The transcription provider feature flag allows safe switching between Web Speech API and self-hosted Whisper service without code changes.

## Configuration

Set `NEXT_PUBLIC_TRANSCRIPTION_PROVIDER` environment variable:
- `webspeech`: Use browser-native Web Speech API (default, safe fallback)
- `whisper`: Use self-hosted Whisper transcription service

## Implementation

### 1. Configuration Module (`lib/config.ts`)

```typescript
export function getTranscriptionProvider(): "whisper" | "webspeech" {
  const provider = process.env.NEXT_PUBLIC_TRANSCRIPTION_PROVIDER;
  return provider === "whisper" ? "whisper" : "webspeech";
}
```

### 2. API Route (`app/api/transcribe/route.ts`)

- Proxies audio to Whisper service
- Handles authentication via `X-API-Key` header
- Maps Whisper response to existing interface
- Falls back gracefully on errors

### 3. Provider Indicator (Dev Mode Only)

`<TranscriptionProviderIndicator />` shows active provider in development:
- 🎯 Green dot + "Whisper" for Whisper service
- 🌐 Blue dot + "WebSpeech" for Web Speech API

## Usage in Components

```typescript
import { getTranscriptionProvider } from '@/lib/config';

const provider = getTranscriptionProvider();

if (provider === 'whisper') {
  // Use /api/transcribe endpoint
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    body: audioBlob,
  });
} else {
  // Use Web Speech API (existing code)
  // ... SpeechRecognition implementation
}
```

## Testing the Feature Flag

### Local Testing

1. **Test with WebSpeech** (default):
   ```bash
   # .env.local
   NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=webspeech
   npm run dev
   ```

2. **Test with Whisper**:
   ```bash
   # Start Whisper service
   cd whisper-service
   docker-compose up -d
   
   # Update .env.local
   NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=whisper
   WHISPER_SERVICE_URL=http://localhost:8000
   
   # Restart Next.js
   npm run dev
   ```

3. **Verify provider**: Check dev indicator in bottom-left corner

### Testing Scenarios

- ✅ Transcription with WebSpeech works
- ✅ Transcription with Whisper works
- ✅ Switching between providers without code changes
- ✅ Graceful fallback when Whisper unavailable
- ✅ Cache hit/miss logging (Whisper only)
- ✅ Performance comparison (RTF metrics)

## Rollout Strategy

### Phase 1: Internal Testing (webspeech)
- Deploy with `NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=webspeech`
- Verify everything works as before
- Whisper service running but not used

### Phase 2: Dev Testing (whisper)
- Developers switch to `whisper` locally
- Test all transcription flows
- Monitor error rates and latency
- Verify cache effectiveness

### Phase 3: Canary Rollout (10%)
- Requires load balancer with A/B testing OR
- Use Vercel environment variables per deployment
- Monitor:
  - Error rate (target: <1%)
  - Latency (target: <2s p95)
  - User feedback
  - Cache hit rate

### Phase 4: Gradual Increase
- 10% → 25% → 50% → 75% → 100%
- At each step: monitor for 24-48 hours
- Pause rollout if error rate >1% or latency >2s

### Phase 5: Full Rollout
- Set `NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=whisper` everywhere
- Monitor for 1 week
- Document success metrics

## Rollback Procedure

If issues detected:

1. **Immediate Rollback** (< 5 minutes):
   ```bash
   # Set environment variable
   NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=webspeech
   
   # Redeploy (Vercel will rebuild with new env var)
   vercel --prod
   ```

2. **Verify Rollback**:
   - Check provider indicator shows "WebSpeech"
   - Test transcription works
   - Monitor error rates return to normal

3. **Root Cause Analysis**:
   - Check Whisper service logs: `docker-compose logs whisper`
   - Check Next.js logs for API errors
   - Check Redis connection
   - Verify model loaded correctly

## Monitoring

### Key Metrics

1. **Success Rate**: % of successful transcriptions
2. **Latency**: Time from audio upload to transcript return
3. **Cache Hit Rate**: % of cached transcriptions (Whisper only)
4. **Real-Time Factor**: Processing time / audio duration (Whisper only)

### Logging

All transcription requests logged:
```
[Transcribe] Received audio: 45623 bytes
[Transcribe] Forwarding to Whisper service: http://localhost:8000
[Transcribe] Success: 125 chars, 487ms, cached=false, rtf=0.057
```

### Alerts

Set up alerts for:
- Error rate >1% (5 minute window)
- P95 latency >2s (5 minute window)
- Cache hit rate <10% (indicates cache issues)
- Whisper service down (health check fails)

## Success Criteria

Feature flag rollout considered successful when:
- ✅ 95% uptime maintained
- ✅ P95 latency <2s
- ✅ Error rate <1%
- ✅ User satisfaction maintained or improved
- ✅ No rollbacks needed for 1 week
- ✅ Cache hit rate >30% (shows caching working)

## Troubleshooting

### Issue: "Transcription service not configured"
- **Cause**: `WHISPER_SERVICE_URL` not set
- **Fix**: Add to `.env.local`: `WHISPER_SERVICE_URL=http://localhost:8000`

### Issue: "401 Unauthorized" from Whisper service
- **Cause**: API key mismatch
- **Fix**: Ensure `WHISPER_API_KEY` matches in both Next.js and Whisper service

### Issue: Slow transcriptions with Whisper
- **Cause**: Model loading on first request, or CPU limited
- **Fix**: 
  - Model preloads on startup (check health endpoint)
  - Increase Docker resource limits
  - Consider GPU acceleration

### Issue: Cache not working
- **Cause**: Redis not running or connection failed
- **Fix**: `docker-compose up -d redis` and check logs

## Integration with useNaturalVoice

Future enhancement: Fully integrate Whisper with `useNaturalVoice` hook:

```typescript
// In useNaturalVoice.tsx
import { getTranscriptionProvider } from '@/lib/config';

const provider = getTranscriptionProvider();

if (provider === 'whisper') {
  // Use MediaRecorder to capture audio
  // Send to /api/transcribe
  // Handle response with transcript
} else {
  // Existing Web Speech API code
  const SpeechRecognition = ...
}
```

Current implementation: Feature flag infrastructure ready, switch in environment variables works, API route ready. Full hook integration can be completed in future PR.
