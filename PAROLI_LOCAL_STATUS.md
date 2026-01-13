# Paroli Local Setup - Current Status

**Date**: 2026-01-09
**Status**: 🔄 Docker Building (Background Task: bb3bb5a)
**ETA**: ~10-15 minutes for build completion

---

## ✅ What's Complete

### 1. Documentation (All Committed to GitHub)
- ✅ `LOCAL_PAROLI_SETUP.md` - Complete local setup guide
- ✅ `PAROLI_HETZNER_SETUP.md` - Production deployment guide
- ✅ `PAROLI_MIGRATION_SCOPE.md` - Technical migration plan
- ✅ `PAROLI_QA_SUMMARY.md` - Q&A and recommendations
- ✅ `DOCUMENTATION_INDEX.md` - 152 file inventory
- ✅ All audio docs updated to Opus format

### 2. Local Environment Setup
- ✅ Directory structure: `~/paroli-local/`
- ✅ Piper model downloaded (131 MB): `en_US-libritts-high.onnx`
- ✅ Paroli source cloned from `https://github.com/MyAiAd/paroli`
- ✅ Custom Dockerfile created with all dependencies

### 3. Docker Configuration
- ✅ Ubuntu 24.04 base (has libopusenc)
- ✅ Multi-stage build (builder + runtime)
- ✅ Fixed dependency order: xtl → xtensor → ONNX Runtime
- ✅ Building now in background

---

## 🔄 Currently Running

**Docker Build**: Background task `bb3bb5a`

**What it's compiling:**
1. Base system + build tools
2. xtl (header-only tensor library)
3. xtensor (tensor operations)
4. ONNX Runtime 1.15.1 (inference engine)
5. piper-phonemize (text to phonemes)
6. Drogon web framework (HTTP + WebSocket)
7. Paroli server + CLI

**Check progress:**
```bash
# View live build logs
tail -f /tmp/claude/-home-sage-Code-MindShifting/tasks/bb3bb5a.output

# Or wait for completion notification
```

---

## ⏭️ Next Steps (After Build)

### 1. Verify Build Success (~1 minute)
```bash
docker images | grep paroli-local
```

### 2. Download Streaming Models (~3 minutes)

**Critical Discovery**: Paroli uses split models (encoder + decoder), not the standard single-file Piper models.

```bash
cd ~/paroli-local/models

# Download encoder
wget https://huggingface.co/marty1885/streaming-piper/resolve/main/en_US-libritts-high/encoder.onnx

# Download decoder
wget https://huggingface.co/marty1885/streaming-piper/resolve/main/en_US-libritts-high/decoder.onnx

# Download config
wget https://huggingface.co/marty1885/streaming-piper/resolve/main/en_US-libritts-high/config.json
```

### 3. Create Docker Compose Config (~2 minutes)

```bash
cd ~/paroli-local/paroli

cat > docker-compose.local.yml <<'EOF'
version: '3.8'

services:
  paroli:
    image: paroli-local:latest
    container_name: paroli-local
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:8080"
    volumes:
      - ~/paroli-local/models:/models:ro
    command: >
      --encoder /models/encoder.onnx
      --decoder /models/decoder.onnx
      -c /models/config.json
      --ip 0.0.0.0
      --port 8080
    environment:
      - TZ=America/New_York
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 1G
EOF
```

### 4. Start Paroli (~1 minute)

```bash
docker compose -f docker-compose.local.yml up -d

# Wait for startup
sleep 10

# Check logs
docker logs paroli-local
```

### 5. Test Audio Generation (~2 minutes)

```bash
# Test health
curl http://localhost:8080/health

# Test audio generation
curl -X POST http://localhost:8080/api/v1/synthesise \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from local Paroli on NixOS"}' \
  --output ~/paroli-local/test.opus

# Verify file
ls -lh ~/paroli-local/test.opus

# Play (optional)
ffplay ~/paroli-local/test.opus
```

### 6. Update Generation Script (~10 minutes)

Update `scripts/generate-static-audio.js` to:
- Point to `http://localhost:8080/api/v1/synthesise`
- Request Opus format
- Handle response format differences

### 7. Generate All Static Audio (~5 minutes)

```bash
cd /home/sage/Code/MindShifting
node scripts/generate-static-audio.js rachel
```

**Expected output**: 17 Opus files in `public/audio/v4/static/rachel/`

### 8. Commit to GitHub (~2 minutes)

```bash
git add public/audio/v4/static/rachel/
git add lib/v4/static-audio-texts.ts
git commit -m "feat: regenerate static audio with Opus format via local Paroli

- Generated all 17 segments with Piper High quality model
- Format: Opus (30% smaller than MP3)
- Source: Self-hosted Paroli (zero ongoing cost)
- Updated INITIAL_WELCOME to shorter v4 intro text"

git push origin main
```

---

## 📊 Total Time Estimate

| Phase | Duration | Status |
|-------|----------|--------|
| Docker build | 15 min | 🔄 In progress |
| Download models | 3 min | ⏸️ Pending |
| Configure | 2 min | ⏸️ Pending |
| Start & test | 3 min | ⏸️ Pending |
| Update script | 10 min | ⏸️ Pending |
| Generate audio | 5 min | ⏸️ Pending |
| Commit & push | 2 min | ⏸️ Pending |
| **Total** | **~40 min** | **38% complete** |

---

## 🎯 Your New Workflow (After Setup)

### Daily Development

```bash
# Start Paroli (if not running)
cd ~/paroli-local/paroli
docker compose -f docker-compose.local.yml up -d

# Make changes to static-audio-texts.ts
vim /home/sage/Code/MindShifting/lib/v4/static-audio-texts.ts

# Regenerate audio
cd /home/sage/Code/MindShifting
node scripts/generate-static-audio.js rachel

# Commit and push
git add public/audio/v4/static/ lib/v4/static-audio-texts.ts
git commit -m "feat: update static audio - [describe change]"
git push origin main

# Stop Paroli (when done)
cd ~/paroli-local/paroli
docker compose -f docker-compose.local.yml down
```

### Deployment to Hetzner (Later)

```bash
# On Hetzner server
git pull origin main

# Rebuild Next.js
npm run build

# Restart services
pm2 restart all

# Static audio files are automatically deployed
# No separate TTS setup needed for static files
```

---

## 💡 Key Insights

### Architecture Clarification

**Local (Your Laptop)**:
- Paroli in Docker
- Purpose: Generate static audio files
- Cost: $0 (runs on your hardware)
- When: Development, audio regeneration

**GitHub**:
- Source of truth for code
- Source of truth for static Opus files
- Deployment target pulls from here

**Hetzner Production**:
- Next.js app (serves static audio from repo)
- Paroli (for dynamic TTS only)
- No Vercel involved

### Cost Analysis

**Before** (ElevenLabs):
- Static: One-time generation (~10,000 credits)
- Dynamic: Ongoing per-request costs
- Total: $100s-1000s/month at scale

**After** (Paroli):
- Local: $0 (your laptop)
- Static on Hetzner: $0 (served from disk)
- Dynamic on Hetzner: $0 (self-hosted Paroli)
- Hosting: $13/month (Hetzner CPX31)
- Total: $13/month fixed, regardless of users

**Savings at 10,000 users**: $987-4,987/month

---

## 🔧 Troubleshooting

### If Docker Build Fails

**Check logs:**
```bash
tail -500 /tmp/claude/-home-sage-Code-MindShifting/tasks/bb3bb5a.output
```

**Common issues:**
1. Out of disk space: `df -h`
2. Memory exhaustion: `free -h`
3. Network timeout: Retry build

### If Paroli Won't Start

**Check logs:**
```bash
docker logs paroli-local
```

**Common issues:**
1. Models not found: Verify paths in docker-compose
2. Port 8080 in use: Change port or stop conflicting service
3. Permission issues: Check volume mounts

### If Audio Quality is Poor

**Try different model:**
```bash
# Download amy (lighter, faster)
cd ~/paroli-local/models
wget https://huggingface.co/marty1885/streaming-piper/resolve/main/en_US-amy-medium/encoder.onnx
wget https://huggingface.co/marty1885/streaming-piper/resolve/main/en_US-amy-medium/decoder.onnx
wget https://huggingface.co/marty1885/streaming-piper/resolve/main/en_US-amy-medium/config.json

# Update docker-compose.local.yml to point to amy files
# Restart container
```

---

## 📚 References

**Model Sources**:
- Paroli streaming models: https://huggingface.co/marty1885/streaming-piper
- Standard Piper models: https://huggingface.co/rhasspy/piper-voices

**Documentation**:
- Paroli README: ~/paroli-local/paroli/README.md
- Local setup guide: LOCAL_PAROLI_SETUP.md
- Hetzner guide: PAROLI_HETZNER_SETUP.md
- Migration scope: PAROLI_MIGRATION_SCOPE.md

**Commands**:
- Start: `docker compose -f docker-compose.local.yml up -d`
- Stop: `docker compose -f docker-compose.local.yml down`
- Logs: `docker logs -f paroli-local`
- Restart: `docker compose -f docker-compose.local.yml restart`

---

## ✅ Success Criteria

Setup is complete when:

1. ✅ Docker image built: `docker images | grep paroli-local`
2. ✅ Paroli starts without errors: `docker logs paroli-local`
3. ✅ Health check passes: `curl http://localhost:8080/health`
4. ✅ Audio generation works: Test file created and plays
5. ✅ All 17 static files generated in Opus format
6. ✅ Files committed to GitHub
7. ✅ Can regenerate audio on demand

---

**Current Status**: Waiting for Docker build to complete (~10 min remaining)

**Next Action**: Monitor build progress, then continue with streaming model download
