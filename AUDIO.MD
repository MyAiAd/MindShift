I'll help you find all the documentation related to your audio system and then create a plan for replacing Paroli/Piper. Let me start by searching for all relevant documentation files.

[5 tools called]

Now let me read the key audio-related documentation files:

[6 tools called]

Now let me read a few more key documentation files:

[5 tools called]

Now let me search for more documentation related to audio generation and Chatterbox/Kokoro that might already exist:

[4 tools called]

Let me read the generation script and check the Docker setup:

[3 tools called]

Perfect! Now I have all the information I need. Let me create a comprehensive summary document for you.

## Step 1: Documentation Reference List

Based on my comprehensive search of your codebase, here's the **complete list of documentation files** related to your audio pre-generation/pre-loading system:

### **🔊 Core Audio System Documentation**

1. **`STATIC_AUDIO_SOLUTION.md`** ⭐ **Main Technical Guide**
   - Complete explanation of static audio approach
   - Cost comparison: ElevenLabs vs static files
   - Implementation steps and file structure
   - Now uses Opus format (30% smaller than MP3)
   - How V4AudioPreloader works

2. **`QUICK_START_STATIC_AUDIO.md`** ⚡ **Quick Setup Guide**
   - 3-step setup process (5 minutes)
   - Simple commands to generate and deploy
   - Verification steps

3. **`public/audio/v4/static/README.md`** 📁 **Directory-Specific Docs**
   - Explains why static audio in this directory
   - Generation instructions
   - Opus format benefits
   - Troubleshooting

4. **`ELEVENLABS_API_SETUP.md`** 🔑 **API Configuration** 
   - Secure ElevenLabs API key setup (original system)
   - References migration to Paroli
   - Now includes "Future: Self-Hosted TTS" section

### **🔄 Paroli/Piper Migration Documentation**

5. **`PAROLI_MIGRATION_SCOPE.md`** 📋 **Complete Migration Plan**
   - Technical scope document
   - Pattern 2: Hybrid Static + Dynamic streaming
   - Architecture diagrams
   - Cost analysis: $13/month vs $100s-$1000s with ElevenLabs
   - Implementation phases (3 weeks)
   - Code changes summary
   - Risk assessment

6. **`PAROLI_QA_SUMMARY.md`** 💡 **Q&A Document**
   - Answers to your specific questions
   - Pattern 1 vs Pattern 2 comparison
   - Opus vs MP3 technical comparison
   - Hardware recommendations (Hetzner CPX31 vs NPU)
   - Final recommendations

7. **`PAROLI_HETZNER_SETUP.md`** 🚀 **Production Server Setup**
   - Complete step-by-step Hetzner deployment (11 phases, ~2 hours)
   - Server provisioning, Docker installation
   - Nginx configuration with SSL
   - WebSocket + REST API setup
   - Monitoring and maintenance guide

8. **`LOCAL_PAROLI_SETUP.md`** 💻 **Local Development Setup**
   - Running Paroli locally on your NixOS laptop
   - Docker setup for development
   - Local audio generation workflow
   - Daily development commands

9. **`PAROLI_LOCAL_STATUS.md`** 📊 **Current Status Report**
   - Real-time progress of local Paroli setup
   - What's complete, what's running
   - Next steps after Docker build
   - Important model format discoveries

10. **`LOCAL_SETUP_PROGRESS.md`** 📝 **Progress Tracking**
    - Detailed progress log of local setup
    - Completed steps checklist
    - Troubleshooting notes
    - Success criteria

### **🔧 Opus Conversion Documentation**

11. **`CONVERT_MP3_TO_OPUS.md`** 🎵 **Conversion Guide**
    - Why Opus format is better
    - ffmpeg commands for conversion
    - Bitrate recommendations (24k optimal for voice)
    - Quality comparison table
    - Batch conversion scripts

12. **`OPUS_MIGRATION_SUMMARY.md`** 📋 **Migration Summary**
    - Summary of Opus format updates
    - Documentation files updated
    - Next steps and recommendations
    - Ready-to-commit checklist

13. **`scripts/convert-mp3-to-opus.sh`** 🔨 **Conversion Script**
    - Bash script to convert MP3 → Opus
    - Creates /opus/ subdirectory
    - Shows file size savings
    - Progress tracking and summary stats

### **🛠️ Generation Scripts & Code**

14. **`scripts/generate-static-audio.js`** 🎬 **Audio Generation Script**
    - Node.js script that generates all 17 static audio files
    - Connects to Paroli API (http://localhost:8080/api/v1/synthesise)
    - Creates manifest.json
    - Currently configured for Paroli (was ElevenLabs)
    - Outputs Opus format

### **📚 Meta Documentation**

15. **`DOCUMENTATION_INDEX.md`** 📑 **Complete File Inventory**
    - Inventory of all 152+ markdown files in project
    - Organized by category
    - Quick reference sections for finding docs

16. **`.audio-generation-reference.md`** 📌 **Quick Commands**
    - Copy-paste command reference
    - Links to migration docs

---

## Step 2: Migration Plan from Paroli/Piper to Chatterbox or Kokoro

Based on my research and analysis of your codebase, here's the comprehensive plan:

### **🔍 Current System Analysis**

**What you have now:**
- **Paroli** running in Docker (locally via `docker-compose.local.yml`)
- **Piper** as the TTS engine (libritts-high model)
- **Opus** output format (24 kbps)
- Generation script pointing to `http://localhost:8080/api/v1/synthesise`
- 17 static audio segments
- Plan for WebSocket streaming for dynamic content

**Issues you discovered:**
- ✅ Paroli works but uses Piper audio
- ❌ Piper has **low quality voices** (not usable for your therapy app)
- ✅ Opus format is great
- ✅ Infrastructure (Docker, Hetzner) is solid

### **🎯 Replacement Options: Chatterbox vs Kokoro**

Based on my research, here's what I found:

#### **Option A: Chatterbox TTS** ⭐ **RECOMMENDED**

**What it is:**
- Open-source TTS system with **high-quality voices**
- Emotion control support
- Ultra-fast inference
- 22 language support
- OpenAI-compatible API

**Why it's better than Piper:**
- 🏆 **Much higher voice quality** (9/10 vs Piper's 6-7/10)
- ✅ Natural-sounding voices
- ✅ Emotion and prosody control
- ✅ Active development (2026 releases)
- ✅ Enterprise-grade performance

**How to integrate:**
1. **Python Package** - `pip install chatterbox-io`
2. **Docker deployment** - Similar to your Paroli setup
3. **API endpoint** - REST API + can be wrapped with WebSocket
4. **Opus output** - Supports multiple formats including Opus

**Resources:**
- Official site: https://www.chatterbox.run/
- API docs: https://chatterboxtts.com/
- Python package: https://pypi.org/project/chatterbox-io/

#### **Option B: Kokoro TTS** 🎯 **ALSO EXCELLENT**

**What it is:**
- Lightweight, high-quality TTS
- Compact model size (~100MB)
- Natural voice synthesis
- Enterprise-grade performance
- Fast inference

**Why it's better than Piper:**
- 🏆 **Excellent voice quality** (8-9/10)
- ✅ Small model size (good for self-hosting)
- ✅ Fast generation
- ✅ Multiple voices available

**How to integrate:**
1. **Python Package** - `pip install kokoro`
2. **HeadTTS Server** - Node.js WebSocket/REST server for Kokoro
3. **speech-server** - FastAPI server supporting Kokoro ONNX
4. **Opus output** - Native support

**Resources:**
- Official site: https://kokorotts.net/
- Python package: https://pypi.org/project/kokoro/
- HeadTTS server: https://github.com/met4citizen/HeadTTS
- speech-server: https://pypi.org/project/speech-server/

### **📋 Drop-in Replacement Plan**

#### **Phase 1: Choose Your TTS Engine (15 minutes)**

**My Recommendation: Start with Chatterbox**
- Higher quality
- More features (emotion control)
- OpenAI-compatible API (easier migration)
- Better documentation

#### **Phase 2: Set Up Local Development (2-3 hours)**

**Option A: Chatterbox with speech-server**

```bash
# 1. Create new directory
mkdir -p ~/chatterbox-local
cd ~/chatterbox-local

# 2. Install speech-server (supports both Chatterbox and Kokoro)
pip install speech-server

# 3. Download Chatterbox model
# Models will be downloaded automatically on first use

# 4. Create simple Docker setup
cat > Dockerfile <<'EOF'
FROM python:3.11-slim

# Install dependencies
RUN pip install speech-server

# Expose port
EXPOSE 8080

# Run server
CMD ["speech-server", "--host", "0.0.0.0", "--port", "8080", "--engine", "chatterbox"]
EOF

# 5. Build Docker image
docker build -t chatterbox-local:latest .

# 6. Create docker-compose.yml
cat > docker-compose.yml <<'EOF'
version: '3.8'

services:
  chatterbox:
    image: chatterbox-local:latest
    container_name: chatterbox-tts
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      - TZ=America/New_York
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
EOF

# 7. Start the service
docker compose up -d

# 8. Test it
curl -X POST http://localhost:8080/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from Chatterbox","format":"opus"}' \
  --output test.opus

# 9. Play test file
ffplay test.opus
```

**Option B: Kokoro with HeadTTS**

```bash
# 1. Clone HeadTTS
cd ~
git clone https://github.com/met4citizen/HeadTTS.git
cd HeadTTS

# 2. Install dependencies
npm install

# 3. Download Kokoro model
# Models download automatically on first run

# 4. Start server
npm start

# Server runs on http://localhost:8080
```

#### **Phase 3: Update Generation Script (30 minutes)**

You need to update `scripts/generate-static-audio.js` to match the new API format:

```javascript
// Current (Paroli):
const PAROLI_API_URL = 'http://localhost:8080/api/v1/synthesise';

// Change to (Chatterbox with speech-server):
const TTS_API_URL = 'http://localhost:8080/tts';

// Update the fetch call:
const response = await fetch(TTS_API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ 
    text: text,
    format: 'opus',  // Request Opus output
    voice: 'default' // or specify voice ID
  }),
});
```

#### **Phase 4: Test Generation (15 minutes)**

```bash
# 1. Make sure service is running
docker ps | grep chatterbox  # or kokoro

# 2. Run generation script
cd /home/sage/Code/MindShifting
node scripts/generate-static-audio.js rachel

# 3. Check output
ls -lh public/audio/v4/static/rachel/

# 4. Test audio quality
ffplay public/audio/v4/static/rachel/*.opus
```

#### **Phase 5: WebSocket/WebRTC Setup (2-4 hours)**

For dynamic audio streaming, you'll need to add WebSocket support:

**Option 1: WebSocket (Simpler, Recommended)**

```javascript
// Client-side (in your React app)
const ws = new WebSocket('ws://localhost:8080/ws/tts');

ws.onopen = () => {
  ws.send(JSON.stringify({
    text: "Dynamic therapy response",
    format: "opus"
  }));
};

ws.onmessage = (event) => {
  // Receive Opus chunks
  const audioChunk = event.data;
  // Play immediately (streaming)
};
```

**Option 2: WebRTC (Lower latency, more complex)**

- Use WebRTC for peer-to-peer audio streaming
- Lower latency than WebSocket
- More complex setup
- Consider this only if WebSocket latency isn't good enough

#### **Phase 6: Deploy to Hetzner (2-3 hours)**

Follow the same Hetzner setup as documented in `PAROLI_HETZNER_SETUP.md`, but with Chatterbox/Kokoro instead:

```bash
# On Hetzner server
cd /opt
git clone [your-chatterbox-setup]
docker build -t chatterbox:latest .
docker compose up -d

# Configure Nginx (same as Paroli setup)
# Same SSL setup with Let's Encrypt
```

### **🔧 Technical Implementation Details**

#### **API Compatibility Matrix**

| Feature | Paroli/Piper | Chatterbox | Kokoro |
|---------|-------------|------------|--------|
| REST API | ✅ `/api/v1/synthesise` | ✅ `/tts` | ✅ `/synthesize` |
| WebSocket | ✅ Yes | ⚠️ Need wrapper | ✅ Yes (HeadTTS) |
| Opus output | ✅ Native | ✅ Supported | ✅ Supported |
| Voice quality | ❌ 6-7/10 | ✅ 9/10 | ✅ 8-9/10 |
| Latency | ✅ Low | ✅ Very low | ✅ Low |
| Docker | ✅ Yes | ✅ Yes | ✅ Yes |
| Cost | ✅ Free | ✅ Free | ✅ Free |

#### **Minimal Code Changes Required**

1. **Update API endpoint URL** in `scripts/generate-static-audio.js`
2. **Update request format** (JSON structure)
3. **No changes needed** to Opus conversion (already using Opus)
4. **No changes needed** to preloader (already loads Opus files)
5. **Add WebSocket wrapper** if using Chatterbox (Kokoro HeadTTS has built-in WS)

### **📊 Comparison: Which Should You Choose?**

| Factor | Chatterbox | Kokoro | Winner |
|--------|-----------|--------|--------|
| **Voice Quality** | 9/10 | 8-9/10 | 🏆 Chatterbox |
| **Setup Complexity** | Medium | Easy | 🏆 Kokoro |
| **WebSocket Support** | Need wrapper | ✅ Built-in | 🏆 Kokoro |
| **Emotion Control** | ✅ Yes | ❌ No | 🏆 Chatterbox |
| **Model Size** | ~500MB | ~100MB | 🏆 Kokoro |
| **Community** | Active | Growing | 🏆 Chatterbox |
| **Documentation** | Excellent | Good | 🏆 Chatterbox |

### **🎯 Final Recommendation**

**Start with Kokoro for fastest implementation:**

1. ✅ **Kokoro + HeadTTS** - Ready-made Node.js server with WebSocket
2. ✅ Drop-in replacement for Paroli
3. ✅ Good voice quality (8-9/10)
4. ✅ Small model, fast setup
5. ✅ Can switch to Chatterbox later if you need emotion control

**Migration path:**
```
Current: Paroli/Piper (low quality)
    ↓
Step 1: Kokoro + HeadTTS (quick win, good quality)
    ↓
Step 2: Evaluate voice quality with users
    ↓
Step 3: Switch to Chatterbox if need more features
```

### **⏱️ Timeline**

| Phase | Duration | Task |
|-------|----------|------|
| **Day 1** | 3 hours | Set up Kokoro locally, test audio quality |
| **Day 2** | 2 hours | Update generation script, regenerate all 17 files |
| **Day 3** | 2 hours | Test WebSocket streaming |
| **Day 4** | 3 hours | Deploy to Hetzner |
| **Week 2** | - | Monitor, optimize, consider Chatterbox if needed |

### **💰 Cost**

- **Development time**: ~10 hours
- **Hosting**: $13/month (Hetzner CPX31) - no change
- **Ongoing**: $0 per request - no change
- **Total savings vs ElevenLabs**: Still $987-$4,987/month at 10k users

Would you like me to proceed with creating the implementation files for Kokoro + HeadTTS setup, or would you prefer to start with Chatterbox instead?
