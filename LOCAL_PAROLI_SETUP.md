# Local Paroli Setup Guide (NixOS)

**Goal**: Run Paroli TTS locally on your laptop for development and static audio generation

**System**: NixOS with Docker 27.5.1 and Docker Compose 2.36.0 ✅

**Timeline**: ~30 minutes

**Deployment Architecture**:
```
Local (Your Laptop)
├─ Paroli in Docker → Generate static audio → Commit to GitHub
└─ Development & testing

GitHub Repository
└─ Source of truth for code + static audio files

Hetzner (Production)
├─ Next.js app (serves static files)
├─ Static audio files (pulled from GitHub)
└─ Paroli (for dynamic TTS streaming)
```

---

## What You Already Have ✅

- NixOS system
- Docker 27.5.1 installed
- Docker Compose 2.36.0 installed
- Docker daemon active and working
- Docker permissions configured (you can run without sudo)

---

## Phase 1: Create Local Directory Structure (2 minutes)

### Step 1.1: Create Piper Models Directory

```bash
# Create directory for Piper voice models
mkdir -p ~/paroli-local/models

# Create directory for Paroli source
mkdir -p ~/paroli-local/paroli

# Verify
ls -la ~/paroli-local/
```

---

## Phase 2: Download Piper Voice Models (5 minutes)

### Step 2.1: Download High-Quality Model (Rachel-like voice)

```bash
cd ~/paroli-local/models

# Download en_US-libritts-high model (~63 MB)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/en_US-libritts-high.onnx

# Download model config
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/en_US-libritts-high.onnx.json

# Verify downloads
ls -lh
```

**Expected output:**
```
-rw-r--r-- 1 sage users  63M Jan 09 12:00 en_US-libritts-high.onnx
-rw-r--r-- 1 sage users 1.2K Jan 09 12:00 en_US-libritts-high.onnx.json
```

### Step 2.2: (Optional) Download Additional Voices

```bash
# Female voice - Amy (lighter, faster, medium quality)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json

# Male voice - Ryan (high quality)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx.json
```

---

## Phase 3: Clone and Build Paroli (10 minutes)

### Step 3.1: Clone Paroli Repository (Your Fork)

```bash
cd ~/paroli-local

# Clone your Paroli fork
git clone https://github.com/MyAiAd/paroli.git

cd paroli

# Verify
ls -la
```

### Step 3.2: Build Paroli Docker Image

```bash
# Build image (takes ~5-8 minutes)
docker build -t paroli-local:latest .

# Verify image was created
docker images | grep paroli-local
```

**Expected output:**
```
paroli-local   latest   abc123def456   2 minutes ago   XXX MB
```

---

## Phase 4: Configure Local Paroli Service (5 minutes)

### Step 4.1: Create Docker Compose Configuration

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
      - "127.0.0.1:8080:8080"  # Only accessible from localhost
    volumes:
      - ~/paroli-local/models:/models:ro
    command: >
      --model /models/en_US-libritts-high.onnx
      --port 8080
      --host 0.0.0.0
    environment:
      - TZ=America/New_York
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

    # Resource limits (optional - adjust for your laptop)
    deploy:
      resources:
        limits:
          cpus: '2'      # Use max 2 CPU cores
          memory: 4G     # Use max 4GB RAM
        reservations:
          cpus: '1'
          memory: 1G
EOF
```

### Step 4.2: Start Paroli

```bash
# Start Paroli in detached mode
docker compose -f docker-compose.local.yml up -d

# Check if it's running
docker ps | grep paroli-local

# View logs
docker logs -f paroli-local
```

**Expected log output:**
```
[INFO] Paroli TTS Server starting...
[INFO] Loading model: /models/en_US-libritts-high.onnx
[INFO] Model loaded successfully
[INFO] Server listening on 0.0.0.0:8080
[INFO] Ready to accept requests
```

Press `Ctrl+C` to exit log view (container keeps running).

---

## Phase 5: Test Local Paroli (5 minutes)

### Step 5.1: Test Health Endpoint

```bash
curl http://localhost:8080/health

# Expected: {"status":"ok"} or similar
```

### Step 5.2: Test REST API Audio Generation

```bash
# Create test audio file
curl -X POST http://localhost:8080/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, this is a test of Paroli running locally on NixOS.","output_format":"opus"}' \
  --output ~/paroli-local/test-local.opus

# Check file was created and has reasonable size
ls -lh ~/paroli-local/test-local.opus
```

**Expected:**
- File size: ~20-50 KB (depends on text length)
- File exists and is not empty

### Step 5.3: (Optional) Play Audio to Verify Quality

```bash
# Install ffmpeg if needed (you might already have it on NixOS)
# Add to your NixOS config if not present: environment.systemPackages = [ pkgs.ffmpeg ];

# Play the test audio
ffplay ~/paroli-local/test-local.opus

# Or convert to WAV if you prefer
ffmpeg -i ~/paroli-local/test-local.opus ~/paroli-local/test-local.wav
```

### Step 5.4: Test WebSocket (Optional)

```bash
# Install wscat globally if not present
npm install -g wscat

# Connect to WebSocket endpoint
wscat -c ws://localhost:8080/ws/tts

# Send message (paste this):
{"text":"Testing WebSocket streaming","output_format":"opus"}

# You should receive audio data chunks
# Press Ctrl+C to disconnect
```

---

## Phase 6: Update Generation Script (5 minutes)

Now update your generation script to use local Paroli instead of ElevenLabs.

### Step 6.1: Backup Current Script

```bash
cd /home/sage/Code/MindShifting

cp scripts/generate-static-audio.js scripts/generate-static-audio.js.elevenlabs-backup
```

### Step 6.2: Update Script to Use Local Paroli

I'll create the updated script for you in the next step.

---

## Managing Local Paroli

### Start Paroli

```bash
cd ~/paroli-local/paroli
docker compose -f docker-compose.local.yml up -d
```

### Stop Paroli

```bash
cd ~/paroli-local/paroli
docker compose -f docker-compose.local.yml down
```

### Restart Paroli

```bash
cd ~/paroli-local/paroli
docker compose -f docker-compose.local.yml restart
```

### View Logs

```bash
docker logs -f paroli-local
```

### Check Status

```bash
docker ps | grep paroli-local
curl http://localhost:8080/health
```

### Remove Paroli (if needed)

```bash
cd ~/paroli-local/paroli
docker compose -f docker-compose.local.yml down
docker rmi paroli-local:latest
```

---

## Resource Usage

On your laptop, Paroli will use:
- **Idle**: ~200-500 MB RAM, minimal CPU
- **Generating audio**: ~500-1000 MB RAM, 50-100% of 1-2 CPU cores
- **Storage**: ~100 MB for Docker image + 63 MB per voice model

You can adjust resource limits in `docker-compose.local.yml` if needed.

---

## Troubleshooting

### Issue: "Cannot connect to Docker daemon"

**Solution:**
```bash
# Check if Docker is running
systemctl status docker

# If not active, start it
sudo systemctl start docker
```

### Issue: "Port 8080 already in use"

**Solution:**
```bash
# Check what's using port 8080
sudo lsof -i :8080

# Either stop that service, or change Paroli port
# Edit docker-compose.local.yml: "127.0.0.1:8081:8080"
```

### Issue: "Model not found" error in logs

**Solution:**
```bash
# Verify model files exist
ls -lh ~/paroli-local/models/

# Check Docker volume mount
docker inspect paroli-local | grep -A 5 Mounts
```

### Issue: Poor audio quality or robotic voice

**Solution:**
```bash
# Try different voice model
# Edit docker-compose.local.yml and change:
# --model /models/en_US-amy-medium.onnx

# Restart
docker compose -f docker-compose.local.yml restart
```

### Issue: Slow audio generation

**Solution:**
```bash
# Increase CPU allocation in docker-compose.local.yml
# Change cpus: '2' to cpus: '4'

# Restart
docker compose -f docker-compose.local.yml restart
```

---

## NixOS-Specific Notes

### If You Need to Add Docker to Your NixOS Config

Your Docker is already working, but if you ever need to reconfigure, here's the reference:

```nix
# /etc/nixos/configuration.nix
{
  virtualisation.docker = {
    enable = true;
    enableOnBoot = true;
  };

  # Add your user to docker group
  users.users.sage.extraGroups = [ "docker" ];
}
```

Then rebuild: `sudo nixos-rebuild switch`

### If You Need ffmpeg

```nix
# /etc/nixos/configuration.nix
{
  environment.systemPackages = with pkgs; [
    ffmpeg-full
    # or just: ffmpeg
  ];
}
```

---

## Development Workflow

### Daily Usage

1. **Start Paroli** (if not running):
   ```bash
   cd ~/paroli-local/paroli
   docker compose -f docker-compose.local.yml up -d
   ```

2. **Generate static audio** (after updating texts):
   ```bash
   cd /home/sage/Code/MindShifting
   node scripts/generate-static-audio.js rachel
   ```

3. **Test audio locally** (in your app):
   ```bash
   npm run dev
   # Test in browser
   ```

4. **Commit and push**:
   ```bash
   git add public/audio/v4/static/
   git commit -m "feat: update static audio (generated locally with Paroli)"
   git push origin main
   ```

5. **Stop Paroli** (when done for the day):
   ```bash
   docker compose -f docker-compose.local.yml down
   ```

### When You Update Voice Models

```bash
# Download new model
cd ~/paroli-local/models
wget https://huggingface.co/...new-model.onnx

# Update docker-compose.local.yml to point to new model
vim ~/paroli-local/paroli/docker-compose.local.yml

# Restart Paroli
cd ~/paroli-local/paroli
docker compose -f docker-compose.local.yml restart
```

---

## Advantages of Local Development

✅ **No internet required** - Generate audio offline
✅ **Fast iteration** - No API latency
✅ **Free** - No API costs for development
✅ **Privacy** - Text never leaves your laptop
✅ **Consistent** - Same environment as production (Hetzner)
✅ **Version control** - Audio files committed with code

---

## Production Deployment (Later)

Once you deploy to Hetzner, the workflow becomes:

```
Local:
  1. Run Paroli in Docker
  2. Generate static audio
  3. Commit to GitHub
  4. Push to main

GitHub:
  - Source of truth for code + static audio

Hetzner:
  1. Pull from GitHub
  2. Build Next.js app
  3. Deploy Paroli for dynamic TTS
  4. Serve everything from one server
```

**No Vercel** - Hetzner does it all:
- Static files (Next.js app + audio)
- Dynamic TTS (Paroli WebSocket streaming)
- One server, simple architecture

---

## Next Steps

1. ✅ Set up local Paroli (follow this guide)
2. ⏭️ Update generation script to use `http://localhost:8080`
3. ⏭️ Generate all 17 static audio files locally
4. ⏭️ Commit Opus files to GitHub
5. ⏭️ Later: Deploy to Hetzner for production

---

## Quick Reference Commands

```bash
# Start Paroli
cd ~/paroli-local/paroli && docker compose -f docker-compose.local.yml up -d

# Check status
docker ps | grep paroli-local

# View logs
docker logs -f paroli-local

# Test
curl http://localhost:8080/health

# Generate audio
cd /home/sage/Code/MindShifting
node scripts/generate-static-audio.js rachel

# Stop Paroli
cd ~/paroli-local/paroli && docker compose -f docker-compose.local.yml down
```

---

**Status**: Ready to start
**Next**: Follow Phase 1 to create directories
