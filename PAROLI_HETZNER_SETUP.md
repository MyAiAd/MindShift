# Paroli on Hetzner - Complete Setup Guide

**Goal**: Deploy self-hosted Paroli TTS server on Hetzner CPX31 for $13/month

**Timeline**: ~2 hours from start to production-ready

---

## Prerequisites

- Hetzner account (create at https://www.hetzner.com/)
- Domain name for TTS endpoint (e.g., `tts.yourdomain.com`)
- SSH client
- Basic Linux command line knowledge

---

## Phase 1: Provision Hetzner Server (15 minutes)

### Step 1.1: Create Hetzner Cloud Project

1. Log in to Hetzner Cloud Console: https://console.hetzner.cloud/
2. Click **"New Project"**
3. Name: `mindshifting-tts` (or your preferred name)
4. Click **"Create Project"**

### Step 1.2: Create SSH Key

**On your local machine:**

```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "your_email@example.com" -f ~/.ssh/hetzner_paroli

# Display public key (copy this)
cat ~/.ssh/hetzner_paroli.pub
```

**In Hetzner Console:**

1. Go to **Security → SSH Keys**
2. Click **"Add SSH Key"**
3. Paste your public key
4. Name: `paroli-server-key`
5. Click **"Add SSH Key"**

### Step 1.3: Create Server

1. Click **"Add Server"**
2. **Location**: Choose closest to your users (e.g., Nuremberg for EU, Ashburn for US)
3. **Image**: Ubuntu 24.04
4. **Type**: Shared vCPU
5. **Server Type**: **CPX31** (4 vCPU, 8 GB RAM, €11.90/month)
6. **Networking**:
   - ✅ Public IPv4
   - ✅ Public IPv6 (optional)
7. **SSH Keys**: Select your key from Step 1.2
8. **Firewall**: We'll configure this in Phase 2
9. **Backups**: Enable if desired (+20% cost)
10. **Name**: `paroli-tts-01`
11. Click **"Create & Buy Now"**

**Wait ~60 seconds for server to be ready.**

### Step 1.4: Note Server IP

Once server is ready, note the **IPv4 address** (e.g., `123.456.789.10`)

---

## Phase 2: Configure DNS (5 minutes)

### Step 2.1: Add DNS Record

In your domain registrar (Cloudflare, Namecheap, etc.):

1. Create **A record**:
   - **Name**: `tts` (or your preferred subdomain)
   - **Type**: A
   - **Value**: `123.456.789.10` (your Hetzner IP)
   - **TTL**: 300 (5 minutes)
   - **Proxy**: Disable (if using Cloudflare)

2. Verify DNS propagation:
   ```bash
   dig tts.yourdomain.com +short
   # Should show your Hetzner IP
   ```

---

## Phase 3: Initial Server Setup (20 minutes)

### Step 3.1: Connect to Server

```bash
ssh -i ~/.ssh/hetzner_paroli root@123.456.789.10
# Or: ssh -i ~/.ssh/hetzner_paroli root@tts.yourdomain.com
```

### Step 3.2: Update System

```bash
# Update package lists
apt update

# Upgrade installed packages
apt upgrade -y

# Install essential tools
apt install -y \
  curl \
  wget \
  git \
  vim \
  htop \
  ufw \
  certbot \
  python3-certbot-nginx
```

### Step 3.3: Configure Firewall

```bash
# Allow SSH (port 22)
ufw allow 22/tcp

# Allow HTTP (port 80) - for Let's Encrypt
ufw allow 80/tcp

# Allow HTTPS (port 443)
ufw allow 443/tcp

# Enable firewall
ufw --force enable

# Verify status
ufw status verbose
```

**Expected output:**
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                     ALLOW       Anywhere
```

---

## Phase 4: Install Docker (10 minutes)

### Step 4.1: Install Docker Engine

```bash
# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### Step 4.2: Configure Docker

```bash
# Enable Docker to start on boot
systemctl enable docker

# Start Docker service
systemctl start docker

# Verify Docker is running
systemctl status docker
```

---

## Phase 5: Download Piper Models (15 minutes)

### Step 5.1: Create Model Directory

```bash
mkdir -p /opt/piper-models
cd /opt/piper-models
```

### Step 5.2: Download Piper High-Quality Model (Rachel-like voice)

```bash
# Download en_US-libritts-high model
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/en_US-libritts-high.onnx

wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/en_US-libritts-high.onnx.json

# Verify files
ls -lh
```

**Expected output:**
```
-rw-r--r-- 1 root root  63M Jan 08 12:00 en_US-libritts-high.onnx
-rw-r--r-- 1 root root 1.2K Jan 08 12:00 en_US-libritts-high.onnx.json
```

### Step 5.3: (Optional) Download Additional Voices

```bash
# Female voice - Amy (lighter, faster)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json

# Male voice - Ryan
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx.json
```

---

## Phase 6: Build & Deploy Paroli (20 minutes)

### Step 6.1: Clone Paroli Repository

```bash
cd /opt
git clone https://github.com/MyAiAd/paroli.git
cd paroli
```

### Step 6.2: Build Paroli Docker Image

```bash
# Build image (this takes ~10 minutes)
docker build -t paroli:latest .

# Verify image
docker images | grep paroli
```

### Step 6.3: Create Docker Compose Configuration

```bash
cat > /opt/paroli/docker-compose.yml <<'EOF'
version: '3.8'

services:
  paroli:
    image: paroli:latest
    container_name: paroli-tts
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:8080"
    volumes:
      - /opt/piper-models:/models:ro
    command: >
      --model /models/en_US-libritts-high.onnx
      --port 8080
      --host 0.0.0.0
    environment:
      - TZ=UTC
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
EOF
```

### Step 6.4: Start Paroli

```bash
# Start Paroli container
docker compose up -d

# Verify container is running
docker ps

# Check logs
docker logs -f paroli-tts
```

**Expected log output:**
```
[INFO] Paroli TTS Server starting...
[INFO] Loading model: /models/en_US-libritts-high.onnx
[INFO] Model loaded successfully
[INFO] Server listening on 0.0.0.0:8080
```

Press `Ctrl+C` to exit log view.

### Step 6.5: Test Paroli Locally

```bash
# Test REST API endpoint
curl -X POST http://localhost:8080/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, this is a test.","output_format":"opus"}' \
  --output /tmp/test.opus

# Check file size (should be ~20-50 KB)
ls -lh /tmp/test.opus

# Play audio (optional, requires ffplay)
# apt install -y ffmpeg
# ffplay /tmp/test.opus
```

---

## Phase 7: Configure Nginx Reverse Proxy (20 minutes)

### Step 7.1: Install Nginx

```bash
apt install -y nginx

# Enable and start Nginx
systemctl enable nginx
systemctl start nginx
```

### Step 7.2: Create Nginx Configuration

```bash
cat > /etc/nginx/sites-available/paroli <<'EOF'
# Upstream Paroli backend
upstream paroli_backend {
    server 127.0.0.1:8080;
}

# HTTP server (redirects to HTTPS)
server {
    listen 80;
    listen [::]:80;
    server_name tts.yourdomain.com;

    # Allow Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name tts.yourdomain.com;

    # SSL certificates (will be added by certbot)
    ssl_certificate /etc/letsencrypt/live/tts.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tts.yourdomain.com/privkey.pem;

    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # WebSocket location
    location /ws/ {
        proxy_pass http://paroli_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # REST API location
    location /api/ {
        proxy_pass http://paroli_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # Health check
    location /health {
        proxy_pass http://paroli_backend;
        access_log off;
    }
}
EOF
```

**IMPORTANT**: Replace `tts.yourdomain.com` with your actual domain in the config above!

```bash
# Edit the config to use your domain
sed -i 's/tts.yourdomain.com/tts.YOURACTUAL DOMAIN.com/g' /etc/nginx/sites-available/paroli
```

### Step 7.3: Enable Site

```bash
# Create symlink
ln -s /etc/nginx/sites-available/paroli /etc/nginx/sites-enabled/

# Test configuration (should say "syntax is ok")
nginx -t

# Note: This will fail with SSL error - that's expected, we'll fix it with certbot
```

---

## Phase 8: SSL Certificate (10 minutes)

### Step 8.1: Obtain Let's Encrypt Certificate

```bash
# Temporarily disable the HTTPS server block
# (certbot needs port 80 to verify domain ownership)

# Get certificate
certbot certonly --nginx -d tts.yourdomain.com --non-interactive --agree-tos --email your-email@example.com

# Expected output:
# Successfully received certificate.
# Certificate is saved at: /etc/letsencrypt/live/tts.yourdomain.com/fullchain.pem
# Key is saved at: /etc/letsencrypt/live/tts.yourdomain.com/privkey.pem
```

### Step 8.2: Enable Full Nginx Config

```bash
# Reload Nginx with SSL
systemctl reload nginx

# Verify Nginx is running
systemctl status nginx
```

### Step 8.3: Test HTTPS

```bash
# Test HTTPS endpoint
curl -I https://tts.yourdomain.com/health

# Should return: HTTP/2 200
```

---

## Phase 9: Production Testing (10 minutes)

### Step 9.1: Test REST API

```bash
# From your local machine
curl -X POST https://tts.yourdomain.com/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Mind Shifting audio test.","output_format":"opus"}' \
  --output test-production.opus

# Check file
ls -lh test-production.opus

# Play audio
# ffplay test-production.opus
```

### Step 9.2: Test WebSocket (Optional)

```bash
# Install wscat globally
npm install -g wscat

# Connect to WebSocket
wscat -c wss://tts.yourdomain.com/ws/tts

# Send message (paste this):
{"text":"Hello from WebSocket","output_format":"opus"}

# You should receive audio data chunks in response
```

---

## Phase 10: Monitoring & Maintenance (15 minutes)

### Step 10.1: Set Up Log Rotation

```bash
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

# Restart Docker to apply log rotation
systemctl restart docker

# Restart Paroli container
cd /opt/paroli
docker compose restart
```

### Step 10.2: Create Monitoring Script

```bash
cat > /opt/paroli/monitor.sh <<'EOF'
#!/bin/bash

# Check if Paroli is running
if ! docker ps | grep -q paroli-tts; then
    echo "ERROR: Paroli container is not running!"
    docker compose -f /opt/paroli/docker-compose.yml up -d
    exit 1
fi

# Check if service is responding
if ! curl -sf http://localhost:8080/health > /dev/null; then
    echo "ERROR: Paroli health check failed!"
    docker compose -f /opt/paroli/docker-compose.yml restart
    exit 1
fi

echo "OK: Paroli is running and healthy"
exit 0
EOF

chmod +x /opt/paroli/monitor.sh
```

### Step 10.3: Add Cron Job for Monitoring

```bash
# Add to crontab (check every 5 minutes)
crontab -e

# Add this line:
*/5 * * * * /opt/paroli/monitor.sh >> /var/log/paroli-monitor.log 2>&1
```

### Step 10.4: Set Up Auto-Renewal for SSL

```bash
# Certbot auto-renewal is already set up by default
# Test renewal process
certbot renew --dry-run

# Should output: "Congratulations, all simulated renewals succeeded"
```

---

## Phase 11: Update Your Application (Next.js Config)

### Step 11.1: Add Environment Variables

In your Next.js project, add to `.env.local`:

```bash
# Paroli TTS Server
NEXT_PUBLIC_PAROLI_REST_URL=https://tts.yourdomain.com/api/tts
NEXT_PUBLIC_PAROLI_WS_URL=wss://tts.yourdomain.com/ws/tts

# Keep ElevenLabs as fallback during migration (optional)
ELEVENLABS_API_KEY=sk_xxx
```

### Step 11.2: Update Generation Script

Now you can update `scripts/generate-static-audio.js` to point to your Paroli server.

(See `PAROLI_MIGRATION_SCOPE.md` for code changes)

---

## Verification Checklist

Before moving to production, verify:

- [ ] Server accessible via SSH
- [ ] Docker running and healthy
- [ ] Paroli container running: `docker ps | grep paroli`
- [ ] Paroli logs show no errors: `docker logs paroli-tts`
- [ ] REST API works: `curl https://tts.yourdomain.com/api/tts`
- [ ] WebSocket works: `wscat -c wss://tts.yourdomain.com/ws/tts`
- [ ] SSL certificate valid: `curl -I https://tts.yourdomain.com/health`
- [ ] Firewall configured: `ufw status`
- [ ] Monitoring script works: `/opt/paroli/monitor.sh`
- [ ] Log rotation configured
- [ ] Auto-renewal set up: `certbot renew --dry-run`

---

## Common Issues & Troubleshooting

### Issue: "Connection refused" when testing

**Solution:**
```bash
# Check if Paroli is running
docker ps

# Check logs
docker logs paroli-tts

# Restart if needed
cd /opt/paroli
docker compose restart
```

### Issue: "502 Bad Gateway" from Nginx

**Solution:**
```bash
# Check if Paroli is listening on port 8080
netstat -tlnp | grep 8080

# Check Nginx logs
tail -f /var/log/nginx/error.log

# Check Paroli logs
docker logs paroli-tts
```

### Issue: SSL certificate error

**Solution:**
```bash
# Check certificate files exist
ls -lh /etc/letsencrypt/live/tts.yourdomain.com/

# Renew certificate
certbot renew --force-renewal

# Reload Nginx
systemctl reload nginx
```

### Issue: High CPU usage

**Solution:**
```bash
# Check container resource usage
docker stats paroli-tts

# If CPU > 80%, consider upgrading to CPX41
# Or reduce concurrent requests
```

### Issue: Audio quality is poor

**Solution:**
```bash
# Try a different model
# Edit docker-compose.yml and change model path
cd /opt/paroli

# Download and use en_US-libritts-high if not already
vim docker-compose.yml

# Restart
docker compose restart
```

---

## Performance Tuning

### For Higher Concurrent Users

If you need to handle more than 10 concurrent users:

1. **Upgrade server**:
   - CPX41: 8 vCPU, 16 GB RAM (€23.90/month)

2. **Add more Paroli instances**:
```bash
# Edit docker-compose.yml to add instance 2
# Map to different port (8081)
# Update Nginx to load balance
```

3. **Add GPU support** (requires different server type):
   - Not available on Hetzner Cloud VPS
   - Consider Vast.ai or dedicated server

---

## Cost Summary

| Item | Cost |
|------|------|
| Hetzner CPX31 | €11.90/month (~$13 USD) |
| Domain (if needed) | ~$10-15/year |
| **Total** | **~$13/month** |

**Compare to ElevenLabs:**
- 1,000 users/month: $100-500 → **Savings: $87-487/month**
- 10,000 users/month: $1,000-5,000 → **Savings: $987-4,987/month**

---

## Next Steps

1. ✅ Server is now production-ready
2. ⏭️ Update generation script to use Paroli: See `PAROLI_MIGRATION_SCOPE.md`
3. ⏭️ Regenerate static audio files with Opus format
4. ⏭️ Implement WebSocket streaming for dynamic audio
5. ⏭️ Deploy to production

---

## Maintenance Schedule

**Weekly:**
- Review monitoring logs: `cat /var/log/paroli-monitor.log`
- Check disk space: `df -h`

**Monthly:**
- Review server performance: `docker stats`
- Check for Docker image updates
- Review SSL certificate expiry

**Quarterly:**
- Update system packages: `apt update && apt upgrade`
- Review security advisories
- Test backup restoration

---

**Status**: ✅ Setup complete
**Server**: Production-ready
**Cost**: $13/month
**Next**: Update generation script and migrate audio

---

**Documentation References:**
- Paroli repo: https://github.com/MyAiAd/paroli
- Hetzner docs: https://docs.hetzner.com/
- Nginx docs: https://nginx.org/en/docs/
- Let's Encrypt: https://letsencrypt.org/docs/
