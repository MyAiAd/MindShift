# Local Paroli Setup - Progress Report

**Started**: 2026-01-09
**Status**: In Progress - Docker Building

---

## ✅ Completed Steps

### 1. Documentation Created
- ✅ `LOCAL_PAROLI_SETUP.md` - Complete setup guide
- ✅ All audio docs updated to Opus format
- ✅ `PAROLI_HETZNER_SETUP.md` - Production deployment guide
- ✅ `PAROLI_MIGRATION_SCOPE.md` - Technical scope
- ✅ `DOCUMENTATION_INDEX.md` - Complete file inventory

### 2. System Verification
- ✅ Confirmed NixOS with Docker 27.5.1
- ✅ Confirmed Docker Compose 2.36.0
- ✅ Docker daemon active and accessible

### 3. Directory Structure
- ✅ Created `~/paroli-local/models/`
- ✅ Created `~/paroli-local/paroli/`

### 4. Piper Models Downloaded
- ✅ Downloaded `en_US-libritts-high.onnx` (131 MB)
- ✅ Downloaded `en_US-libritts-high.onnx.json` (20 KB)
- Location: `~/paroli-local/models/`

### 5. Paroli Source
- ✅ Cloned from `https://github.com/MyAiAd/paroli`
- ✅ Created custom `Dockerfile` (multi-stage build)
- Location: `~/paroli-local/paroli/`

---

## 🔄 Currently Running

### Docker Build (Background Task: b3bb3d7)
- **Status**: Building Paroli Docker image
- **Expected time**: 10-15 minutes
- **Command**: `docker build -t paroli-local:latest .`
- **What it's doing**:
  - Stage 1 (Builder):
    - Installing build dependencies
    - Downloading ONNX Runtime 1.15.1
    - Downloading piper-phonemize 1.1.0
    - Building Drogon web framework
    - Compiling Paroli from source
  - Stage 2 (Runtime):
    - Creating minimal runtime image
    - Installing only runtime dependencies
    - Copying built binaries

### Monitor Progress
```bash
# Check build status
docker ps -a

# View live build logs
tail -f /tmp/claude/-home-sage-Code-MindShifting/tasks/b3bb3d7.output

# Or use TaskOutput tool to check status
```

---

## ⏭️ Next Steps (After Build Completes)

### 1. Verify Build Success
```bash
# Check if image was created
docker images | grep paroli-local
```

**Expected output:**
```
paroli-local   latest   [image-id]   X minutes ago   XXX MB
```

### 2. Download Paroli-Compatible Models

**Important Discovery**: Paroli uses a different model format than standard Piper:
- Standard Piper: Single `.onnx` file
- Paroli: Separate `encoder.onnx` + `decoder.onnx` files

**We need to download streaming models from HuggingFace:**

```bash
cd ~/paroli-local/models

# Download encoder
wget https://huggingface.co/marty1885/streaming-piper/resolve/main/en_US-libritts-high/encoder.onnx

# Download decoder
wget https://huggingface.co/marty1885/streaming-piper/resolve/main/en_US-libritts-high/decoder.onnx

# Download config
wget https://huggingface.co/marty1885/streaming-piper/resolve/main/en_US-libritts-high/config.json
```

### 3. Create Docker Compose Configuration

The docker-compose file will need to reference the encoder/decoder separately:

```yaml
command: >
  --encoder /models/encoder.onnx
  --decoder /models/decoder.onnx
  -c /models/config.json
  --ip 0.0.0.0
  --port 8080
```

### 4. Start Paroli
```bash
cd ~/paroli-local/paroli
docker compose -f docker-compose.local.yml up -d
```

### 5. Test Paroli
```bash
# Test health endpoint
curl http://localhost:8080/health

# Test audio generation
# Note: Paroli API endpoint might be /api/v1/synthesise (not /api/tts)
curl -X POST http://localhost:8080/api/v1/synthesise \
  -H "Content-Type: application/json" \
  -d '{"text":"Test from local Paroli"}' \
  --output test.opus
```

### 6. Update Generation Script
Once working, update `scripts/generate-static-audio.js` to point to:
- URL: `http://localhost:8080/api/v1/synthesise` (or whatever the correct endpoint is)
- Format: Opus

---

## 📝 Important Notes

### Model Format Difference
**Standard Piper** (what we downloaded):
- File: `en_US-libritts-high.onnx` (single file)
- Used by: piper CLI, most Piper wrappers

**Paroli/Streaming Piper**:
- Files: `encoder.onnx` + `decoder.onnx` (split model)
- Used by: Paroli server for streaming
- Download from: https://huggingface.co/marty1885/streaming-piper

**Solution**: We'll download the streaming models once the build completes.

### API Endpoint Differences
Based on Paroli README, the API might use:
- `/api/v1/synthesise` (from docs)
- Not `/api/tts` (as I documented for Hetzner)

We'll verify the correct endpoint after starting the server.

### Architecture Clarification

**Your Final Setup**:
```
Local Development (Your Laptop)
├─ Paroli Docker → Generate static audio
└─ Test and iterate

GitHub
└─ Source of truth (code + static Opus files)

Hetzner Production
├─ Next.js app
├─ Static Opus files (from GitHub)
└─ Paroli (for dynamic TTS streaming)

No Vercel - Everything on Hetzner
```

---

## 🔍 Troubleshooting

### If Docker Build Fails

**Check logs:**
```bash
# View full build output
cat /tmp/claude/-home-sage-Code-MindShifting/tasks/b3bb3d7.output
```

**Common issues:**
1. **Out of disk space**: Check with `df -h`
2. **Network timeout**: Retry build
3. **Missing dependencies**: Dockerfile should handle all deps

**Solution**: If build fails, we can try a simpler approach:
- Use pre-built Piper binary + Flask wrapper
- Or use original marty1885/paroli if they have Docker support

### If Build Takes Too Long

**Normal**: 10-15 minutes on modern laptop
**If >20 minutes**: Check if system is under load (`htop`)

---

## 🎯 Success Criteria

We'll know the setup is complete when:

1. ✅ Docker image builds successfully
2. ✅ Paroli server starts without errors
3. ✅ Health endpoint responds: `curl http://localhost:8080/health`
4. ✅ Can generate test audio file
5. ✅ Audio file plays correctly
6. ✅ Generation script updated and working
7. ✅ All 17 static audio files generated in Opus format
8. ✅ Committed to GitHub

---

## 📊 Current Status Summary

| Task | Status | Notes |
|------|--------|-------|
| Documentation | ✅ Complete | 5 new docs created + updates |
| System Check | ✅ Complete | Docker working on NixOS |
| Directories | ✅ Complete | Created in ~/paroli-local/ |
| Models (Standard) | ✅ Complete | Downloaded 131 MB Piper model |
| Models (Streaming) | ⏸️ Pending | Need to download after build |
| Paroli Clone | ✅ Complete | Cloned from your fork |
| Dockerfile | ✅ Complete | Custom multi-stage build |
| Docker Build | 🔄 In Progress | ~10-15 minutes remaining |
| Docker Compose | ⏸️ Pending | After build completes |
| Start Paroli | ⏸️ Pending | After config created |
| Test Audio | ⏸️ Pending | After server starts |
| Update Script | ⏸️ Pending | After testing confirms API |
| Generate Audio | ⏸️ Pending | Final step |

---

## ⏱️ Estimated Time Remaining

- Docker build: ~10-15 minutes (in progress)
- Download streaming models: ~2 minutes
- Configure & start: ~5 minutes
- Test & verify: ~5 minutes
- Update script: ~10 minutes
- Generate all audio: ~5 minutes

**Total**: ~37-47 minutes from now

---

## 🤔 Questions to Resolve

1. **Paroli API endpoint**: Is it `/api/v1/synthesise` or `/api/tts`?
   - Will verify after server starts

2. **Opus support**: Does Paroli output Opus natively?
   - README mentions libopusenc, so yes

3. **Model compatibility**: Do we need both standard AND streaming models?
   - Standard: For future Hetzner production (if different)
   - Streaming: For Paroli local development

---

**Next Action**: Wait for Docker build to complete (~10 min), then continue with streaming model download and server configuration.
