# Kokoro TTS Deployment Guide - Hetzner

**Server:** 77.42.72.2 (CPX32, Ubuntu, Hetzner)  
**Domain:** api.mind-shift.click  
**Status:** In Progress  

---

## Phase 3: Update Your Codebase to Use Hetzner Kokoro (20 minutes)

Now update your local codebase to use the new Hetzner endpoint:

### **3.1: Update Generation Script**

```bash
# On your local machine
cd /home/sage/Code/MindShifting
```

Update `scripts/generate-static-audio.js`:

```javascript
// Line 101: Change from local Paroli to Hetzner Kokoro
const KOKORO_API_URL = process.env.KOKORO_API_URL || 'https://api.mind-shift.click/tts';
```

### **3.2: Test Generation Locally**

```bash
# Generate one test file
node scripts/generate-static-audio.js rachel

# Check output
ls -lh public/audio/v4/static/rachel/

# Play a sample
ffplay public/audio/v4/static/rachel/*.opus
```

### **3.3: Update Environment Variables**

Create `.env.local`:

```bash
cat > .env.local <<'EOF'
# Kokoro TTS Server (Hetzner)
NEXT_PUBLIC_KOKORO_API_URL=https://api.mind-shift.click/tts
NEXT_PUBLIC_KOKORO_STREAM_URL=https://api.mind-shift.click/tts/stream

# Remove ElevenLabs (no longer needed)
# ELEVENLABS_API_KEY=xxx  # DEPRECATED
EOF
```

---

## Phase 4: GitHub → Hetzner Auto-Deployment (30 minutes)

### **4.1: Create Deployment Script on Hetzner**

SSH to Hetzner and create:

```bash
cat > /opt/mind-shift/deploy.sh <<'EOF'
#!/bin/bash
set -e

echo "🚀 Deploying MindShift..."

# Navigate to Kokoro directory
cd /opt/mind-shift/kokoro

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
git pull origin main

# Rebuild Docker image
echo "🔨 Rebuilding Docker image..."
docker compose build

# Restart service
echo "🔄 Restarting Kokoro service..."
docker compose up -d

# Wait for health check
echo "⏳ Waiting for service to be healthy..."
sleep 10

# Verify service is running
if curl -f http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Deployment successful!"
else
    echo "❌ Health check failed!"
    docker compose logs --tail=50
    exit 1
fi

echo "📊 Service status:"
docker compose ps
EOF

chmod +x /opt/mind-shift/deploy.sh
```

### **4.2: Test Deployment Script**

```bash
/opt/mind-shift/deploy.sh
```

### **4.3: Create GitHub Actions Workflow**

On your local machine:

```bash
mkdir -p .github/workflows

cat > .github/workflows/deploy-hetzner.yml <<'EOF'
name: Deploy to Hetzner

on:
  push:
    branches:
      - main
    paths:
      - 'scripts/**'
      - 'public/audio/**'
      - '.github/workflows/deploy-hetzner.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Hetzner
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: 77.42.72.2
          username: deploy
          key: ${{ secrets.HETZNER_SSH_KEY }}
          script: |
            /opt/mind-shift/deploy.sh
EOF
```

### **4.4: Add SSH Key to GitHub Secrets**

```bash
# On your local machine, get the SSH private key
cat ~/.ssh/hetzner_key

# Copy the ENTIRE output (including BEGIN and END lines)
```

Then:
1. Go to `https://github.com/[your-username]/MindShifting/settings/secrets/actions`
2. Click "New repository secret"
3. Name: `HETZNER_SSH_KEY`
4. Value: Paste your private key
5. Click "Add secret"

### **4.5: Commit and Test Auto-Deployment**

```bash
# Add all changes
git add .github/workflows/deploy-hetzner.yml
git add scripts/generate-static-audio.js
git add .env.local

git commit -m "feat: deploy Kokoro TTS on Hetzner with auto-deployment

- Add Kokoro FastAPI server with Opus support
- Configure Caddy reverse proxy for api.mind-shift.click
- Update generation script to use Hetzner endpoint
- Add GitHub Actions workflow for auto-deployment
- Remove ElevenLabs dependency"

# Push to main
git push origin main
```

Watch the deployment:
- Go to your GitHub repo → Actions tab
- You should see the workflow running
- It will SSH into Hetzner and run the deployment script

---

## 🎯 Summary of What You Now Have

✅ **Kokoro TTS** running on Hetzner (Docker, systemd restart on boot)  
✅ **Public API** at `https://api.mind-shift.click/tts`  
✅ **Streaming endpoint** at `https://api.mind-shift.click/tts/stream`  
✅ **Opus output** (24 kbps, optimized for voice)  
✅ **GitHub Actions** auto-deploy on push to main  
✅ **No ElevenLabs dependency** anymore  
✅ **$0 per request** (fixed $13/month hosting)  

---

## Next Steps

1. **Generate all 17 audio files** with Kokoro:
   ```bash
   node scripts/generate-static-audio.js rachel
   git add public/audio/v4/static/rachel/
   git commit -m "feat: regenerate static audio with Kokoro"
   git push origin main
   ```

2. **Deploy Next.js app** to Hetzner (we can do this next)

3. **Test end-to-end** with real users

---

## Troubleshooting

### Port Conflicts

If you get port 8080 conflicts, check what's using it:

```bash
sudo lsof -i :8080
# or
sudo ss -tlnp | grep 8080
```

Stop old services:
```bash
# If Paroli/Drogon is running
docker ps
docker stop <container-id>

# or if systemd service
sudo systemctl stop paroli
```

### Docker Logs

```bash
cd /opt/mind-shift/kokoro
docker compose logs -f
```

### Test API Locally on Server

```bash
# SSH to server
ssh deploy@77.42.72.2

# Test directly
curl http://localhost:8080/health

# Should return: {"status":"healthy"}
```

### Caddy Issues

```bash
# Check Caddy status
sudo systemctl status caddy

# View Caddy logs
sudo journalctl -u caddy -f

# Reload config
sudo systemctl reload caddy
```

---

## File Locations

- **Kokoro repo:** `/opt/mind-shift/kokoro/`
- **Dockerfile:** `/opt/mind-shift/kokoro/Dockerfile`
- **FastAPI server:** `/opt/mind-shift/kokoro/server.py`
- **Docker compose:** `/opt/mind-shift/kokoro/docker-compose.yml`
- **Deployment script:** `/opt/mind-shift/deploy.sh`
- **Caddyfile:** `/etc/caddy/Caddyfile`

---

## API Endpoints

### Health Check
```bash
GET https://api.mind-shift.click/health
```

### Generate TTS (Non-streaming)
```bash
POST https://api.mind-shift.click/tts
Content-Type: application/json

{
  "text": "Hello world",
  "voice": "af_heart",
  "speed": 1.0,
  "format": "opus"
}
```

### Stream TTS (Real-time)
```bash
POST https://api.mind-shift.click/tts/stream
Content-Type: application/json

{
  "text": "Hello world",
  "voice": "af_heart",
  "speed": 1.0,
  "format": "opus"
}
```

### Legacy Paroli-compatible Endpoint
```bash
POST https://api.mind-shift.click/api/v1/synthesise
Content-Type: application/json

{
  "text": "Hello world",
  "format": "opus"
}
```

---

## Available Voices

Based on [Kokoro documentation](https://github.com/MyAiAd/kokoro):

- `af_heart` - Female, American English (default)
- `af_bella` - Female, American English
- `af_sarah` - Female, American English
- `am_adam` - Male, American English
- `am_michael` - Male, American English
- `bf_emma` - Female, British English
- `bf_isabella` - Female, British English
- `bm_george` - Male, British English
- `bm_lewis` - Male, British English

See Kokoro repo for full list of voices in multiple languages.

---

## Cost Analysis

**Current Setup:**
- Hetzner CPX32: ~$21/month (4 vCPU, 8GB RAM)
- Domain: $10-15/year
- **Total: ~$21/month fixed**

**vs ElevenLabs:**
- 1,000 users/month: $100-500
- 10,000 users/month: $1,000-5,000
- **Savings: $79-$4,979/month**

**vs Paroli/Piper:**
- Same infrastructure cost
- 🏆 **Much better voice quality** (8-9/10 vs 6-7/10)
- ✅ Production-ready

---

## Monitoring

### Check Service Health

```bash
# From anywhere
curl https://api.mind-shift.click/health

# From server
curl http://localhost:8080/health
```

### Docker Stats

```bash
ssh deploy@77.42.72.2
cd /opt/mind-shift/kokoro
docker stats kokoro-tts
```

### Server Resources

```bash
ssh deploy@77.42.72.2
htop
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-10  
**Status:** Phase 1-2 Complete, Troubleshooting in progress

