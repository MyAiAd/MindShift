# Whisper Transcription Service Configuration

## Environment Variables

Add these to your `.env.local` file:

```bash
# =========================
# WHISPER TRANSCRIPTION SERVICE
# =========================

# Whisper service URL (local development)
WHISPER_SERVICE_URL=http://localhost:8000

# Optional: API key for Whisper service authentication
# Generate with: openssl rand -hex 32
# WHISPER_API_KEY=your-secure-api-key-here

# Transcription provider: "webspeech" (default) or "whisper"
NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=webspeech
```

## Production Configuration

For production (`.env.production`):

```bash
# Whisper service URL (production - assuming co-located with Next.js app)
WHISPER_SERVICE_URL=http://localhost:8000

# API key for Whisper service authentication (REQUIRED in production)
# Generated with: openssl rand -hex 32
WHISPER_API_KEY=<generate-your-own-secure-key>

# Transcription provider: "webspeech" or "whisper"
# Start with "webspeech" for safe rollout, switch to "whisper" when ready
NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=webspeech
```

## Generate API Key

```bash
openssl rand -hex 32
```

## Configuration Notes

- **WHISPER_SERVICE_URL**: URL of the Whisper transcription service
  - Development: `http://localhost:8000`
  - Production: `http://localhost:8000` (if co-located) or remote URL
  
- **WHISPER_API_KEY**: Optional API key for authentication
  - Not required for development
  - Recommended for production
  - If set, service requires `X-API-Key` header
  
- **NEXT_PUBLIC_TRANSCRIPTION_PROVIDER**: Feature flag for provider selection
  - `webspeech`: Use Web Speech API (browser-native, default)
  - `whisper`: Use self-hosted Whisper service
  - Safe rollout: Start with `webspeech`, switch to `whisper` after testing

## Feature Flag Rollout Strategy

1. **0% (webspeech)**: Deploy with `NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=webspeech`
2. **Test locally**: Change to `whisper` in dev, verify transcriptions work
3. **10% rollout**: Switch 10% of traffic to `whisper` (requires load balancer or A/B testing)
4. **Monitor**: Watch error rates, latency, user feedback
5. **50% rollout**: If stable, increase to 50%
6. **100% rollout**: Switch all traffic to `whisper`
7. **Rollback**: If issues, set back to `webspeech` and redeploy
