# Full Hetzner Deployment Guide - MindShift

**Goal**: Deploy both Next.js app AND Kokoro TTS to Hetzner, remove Vercel dependency

**Status**: Kokoro TTS ✅ Complete | Next.js App ⏸️ In Progress

---

## Current State

### ✅ Complete
- Ubuntu 24.04 on Hetzner CPX32
- Firewall configured (Cloudflare IP ranges only)
- Caddy installed and running
- Docker installed and working
- Kokoro TTS deployed at `api.mind-shift.click` ✅
- `deploy` user with sudo access
- SSH keys configured

### 🟡 Partial
- Caddyfile has `api.mind-shift.click` → Kokoro
- Caddyfile has `mind-shift.click` → placeholder "respond"

### ❌ To Do
- Deploy Next.js app to Hetzner
- Configure `mind-shift.click` → Next.js app
- Set up auto-deployment for Next.js
- Environment variables for production
- Database connections (if any)
- Disconnect from Vercel

---

## Architecture Plan

```
Cloudflare (CDN + Protection)
    │
    ├─→ mind-shift.click (A record: 77.42.72.2)
    │   └─→ Caddy :443
    │       └─→ Next.js :3000 (PM2 or Docker)
    │
    └─→ api.mind-shift.click (A record: 77.42.72.2)
        └─→ Caddy :443
            └─→ Kokoro :8080 (Docker) ✅
```

---

## Phase 1: Prepare Hetzner for Next.js (15 minutes)

### Step 1.1: Install Node.js

```bash
ssh deploy@77.42.72.2

# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version  # Should be v20.x
npm --version   # Should be v10.x

# Install PM2 globally (process manager)
sudo npm install -g pm2

# Verify PM2
pm2 --version
```

### Step 1.2: Clone Your Repository

```bash
# Navigate to project directory
cd /opt/mind-shift

# Clone your repo (should already have git credentials set up)
git clone git@github.com:[your-username]/MindShifting.git app

# Or if already cloned:
cd /opt/mind-shift
git clone git@github.com:[your-username]/MindShifting.git app

# Navigate to app
cd /opt/mind-shift/app

# Verify
ls -la
# Should see: package.json, next.config.js, etc.
```

### Step 1.3: Set Up Environment Variables

```bash
cd /opt/mind-shift/app

# Create .env.production file
cat > .env.production <<'EOF'
# Database (if using Supabase or similar)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Kokoro TTS (local on Hetzner)
NEXT_PUBLIC_KOKORO_API_URL=https://api.mind-shift.click/tts
NEXT_PUBLIC_KOKORO_STREAM_URL=https://api.mind-shift.click/tts/stream

# Other environment variables
NODE_ENV=production
# Add any other variables you need
EOF

# IMPORTANT: Edit this file with your actual values
nano .env.production
```

---

## Phase 2: Build and Deploy Next.js (20 minutes)

### Step 2.1: Install Dependencies and Build

```bash
cd /opt/mind-shift/app

# Install dependencies
npm install

# Build the production app
npm run build

# This will take 5-10 minutes
# Creates .next/ directory with optimized build
```

### Step 2.2: Test the Build Locally

```bash
# Start the app on port 3000
npm start

# In another terminal, test it
curl http://localhost:3000

# Should return HTML of your app
# Press Ctrl+C to stop when done
```

### Step 2.3: Set Up PM2 for Production

```bash
cd /opt/mind-shift/app

# Create PM2 ecosystem file
cat > ecosystem.config.js <<'EOF'
module.exports = {
  apps: [{
    name: 'mindshift-app',
    script: 'npm',
    args: 'start',
    cwd: '/opt/mind-shift/app',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/opt/mind-shift/logs/app-error.log',
    out_file: '/opt/mind-shift/logs/app-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
EOF

# Create logs directory
sudo mkdir -p /opt/mind-shift/logs
sudo chown -R deploy:deploy /opt/mind-shift/logs

# Start the app with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
# Follow the instructions it prints (run the sudo command)

# Check status
pm2 status
pm2 logs mindshift-app
```

### Step 2.4: Verify App is Running

```bash
# Test locally
curl http://localhost:3000

# Should return your app's HTML

# Check PM2 status
pm2 list

# Should show mindshift-app as "online"
```

---

## Phase 3: Update Caddy Configuration (10 minutes)

### Step 3.1: Update Caddyfile

```bash
sudo nano /etc/caddy/Caddyfile
```

Replace the content with:

```caddyfile
# Main application
mind-shift.click {
    # Reverse proxy to Next.js
    reverse_proxy 127.0.0.1:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }
    
    # Enable gzip compression
    encode gzip
    
    # Cache static assets
    @static {
        path *.js *.css *.png *.jpg *.jpeg *.gif *.ico *.svg *.woff *.woff2
    }
    header @static Cache-Control "public, max-age=31536000, immutable"
    
    # Don't cache HTML/API responses
    @dynamic {
        path *.html /api/*
    }
    header @dynamic Cache-Control "no-cache, no-store, must-revalidate"
}

# TTS API
api.mind-shift.click {
    # Reverse proxy to Kokoro
    reverse_proxy 127.0.0.1:8080 {
        health_uri /health
        health_interval 30s
        health_timeout 10s
        
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }
    
    # Disable caching for TTS endpoints
    header /tts/* {
        Cache-Control "no-store, no-cache, must-revalidate"
        X-Content-Type-Options "nosniff"
    }
    
    # Enable streaming for /tts/stream
    @streaming {
        path /tts/stream*
    }
    handle @streaming {
        reverse_proxy 127.0.0.1:8080 {
            flush_interval -1
            transport http {
                read_timeout 0
                write_timeout 0
            }
        }
    }
}
```

### Step 3.2: Reload Caddy

```bash
# Validate configuration
sudo caddy validate --config /etc/caddy/Caddyfile

# Reload Caddy
sudo systemctl reload caddy

# Check status
sudo systemctl status caddy
```

---

## Phase 4: Test Production Deployment (10 minutes)

### Step 4.1: Test from Local Machine

```bash
# On your local machine (NixOS)

# Test main app
curl -I https://mind-shift.click

# Should return:
# HTTP/2 200 OK
# content-type: text/html

# Test API
curl https://api.mind-shift.click/health

# Should return:
# {"status":"healthy"}

# Open in browser
firefox https://mind-shift.click
```

### Step 4.2: Verify Everything Works

- [ ] Main site loads at `https://mind-shift.click`
- [ ] All pages work correctly
- [ ] Audio plays correctly (using new Kokoro-generated files)
- [ ] API responds at `https://api.mind-shift.click`
- [ ] No console errors in browser
- [ ] All features functional

---

## Phase 5: Set Up Auto-Deployment (20 minutes)

### Step 5.1: Create Deployment Script on Hetzner

```bash
ssh deploy@77.42.72.2

cat > /opt/mind-shift/deploy-app.sh <<'EOF'
#!/bin/bash
set -e

echo "🚀 Deploying MindShift App..."

cd /opt/mind-shift/app

# Pull latest code
echo "📥 Pulling latest from GitHub..."
git pull origin main

# Install any new dependencies
echo "📦 Installing dependencies..."
npm install --production

# Build the app
echo "🔨 Building Next.js app..."
npm run build

# Restart PM2
echo "🔄 Restarting app..."
pm2 restart mindshift-app

# Wait for app to be ready
echo "⏳ Waiting for app to start..."
sleep 5

# Check health
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Deployment successful!"
    pm2 list
else
    echo "❌ Health check failed!"
    pm2 logs mindshift-app --lines 50
    exit 1
fi
EOF

chmod +x /opt/mind-shift/deploy-app.sh

# Test it
/opt/mind-shift/deploy-app.sh
```

### Step 5.2: Create Combined Deployment Script

```bash
ssh deploy@77.42.72.2

cat > /opt/mind-shift/deploy-all.sh <<'EOF'
#!/bin/bash
set -e

echo "🚀 Deploying All MindShift Services..."
echo ""

# Deploy Kokoro (if changed)
if [ -d "/opt/mind-shift/kokoro" ]; then
    echo "🎵 Checking Kokoro..."
    /opt/mind-shift/deploy-kokoro.sh
    echo ""
fi

# Deploy App
echo "💻 Deploying App..."
/opt/mind-shift/deploy-app.sh

echo ""
echo "✅ Full deployment complete!"
EOF

chmod +x /opt/mind-shift/deploy-all.sh
```

### Step 5.3: Update GitHub Actions Workflow

On your local machine:

```bash
cd /home/sage/Code/MindShifting

# Update the workflow to deploy everything
cat > .github/workflows/deploy-hetzner.yml <<'EOF'
name: Deploy to Hetzner

on:
  push:
    branches:
      - main

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
            /opt/mind-shift/deploy-all.sh
EOF
```

---

## Phase 6: Disconnect from Vercel (5 minutes)

### Step 6.1: Remove Vercel Integration (Optional)

1. Go to Vercel dashboard
2. Find your MindShifting project
3. Settings → Git → Disconnect Repository
4. OR just delete the project (data stays in GitHub)

### Step 6.2: Update DNS (if needed)

Make sure Cloudflare points to Hetzner:

1. Go to Cloudflare Dashboard
2. DNS Settings
3. Verify records:
   - `mind-shift.click` → A → `77.42.72.2`
   - `api.mind-shift.click` → A → `77.42.72.2`
4. Proxy status: ☁️ Proxied (Orange cloud)

---

## Phase 7: Monitoring and Maintenance

### Daily Operations

```bash
# Check app status
ssh deploy@77.42.72.2
pm2 list
pm2 logs mindshift-app

# Check Kokoro status
docker-compose -f /opt/mind-shift/kokoro/docker-compose.yml ps

# Check Caddy status
sudo systemctl status caddy

# View logs
pm2 logs mindshift-app --lines 100
docker-compose -f /opt/mind-shift/kokoro/docker-compose.yml logs --tail=100
sudo journalctl -u caddy -f
```

### Restart Services

```bash
# Restart Next.js app
pm2 restart mindshift-app

# Restart Kokoro
cd /opt/mind-shift/kokoro && docker-compose restart

# Restart Caddy
sudo systemctl restart caddy

# Restart everything
pm2 restart all && cd /opt/mind-shift/kokoro && docker-compose restart && sudo systemctl restart caddy
```

### Update Services

```bash
# Full update via deployment script
ssh deploy@77.42.72.2
/opt/mind-shift/deploy-all.sh

# Or trigger via git push
git push origin main  # GitHub Actions will deploy automatically
```

---

## Troubleshooting

### Next.js App Won't Start

```bash
# Check PM2 logs
pm2 logs mindshift-app

# Common issues:
# 1. Missing environment variables - check .env.production
# 2. Port 3000 in use - check: sudo lsof -i :3000
# 3. Build failed - check: npm run build
# 4. Node version mismatch - check: node --version
```

### Caddy Not Proxying

```bash
# Check Caddy logs
sudo journalctl -u caddy -f

# Test Caddy config
sudo caddy validate --config /etc/caddy/Caddyfile

# Check if app is actually running
curl http://localhost:3000
```

### PM2 Not Starting on Boot

```bash
# Re-setup PM2 startup
pm2 startup
# Run the command it outputs

# Save PM2 state
pm2 save

# Test reboot
sudo reboot
# Wait 2 minutes, then SSH back in
pm2 list  # Should show mindshift-app running
```

---

## Cost Summary

**Hetzner CPX32:**
- 4 vCPU, 8GB RAM, 160GB SSD
- ~€21/month (~$23 USD)

**Hosting on Hetzner:**
- Next.js app: $0
- Kokoro TTS: $0
- Caddy: $0
- **Total: $23/month fixed**

**vs Vercel + ElevenLabs:**
- Vercel: $20-50/month (Pro plan)
- ElevenLabs: $100-5,000/month (usage-based)
- **Total: $120-5,050/month**

**Savings: $97-5,027/month** 🎉

---

## Quick Reference

### Important Paths
- App code: `/opt/mind-shift/app/`
- Kokoro code: `/opt/mind-shift/kokoro/`
- Caddy config: `/etc/caddy/Caddyfile`
- PM2 config: `/opt/mind-shift/app/ecosystem.config.js`
- Logs: `/opt/mind-shift/logs/`

### Important Commands
```bash
# Deploy everything
ssh deploy@77.42.72.2 /opt/mind-shift/deploy-all.sh

# Check status
ssh deploy@77.42.72.2 'pm2 list && docker-compose -f /opt/mind-shift/kokoro/docker-compose.yml ps'

# View logs
ssh deploy@77.42.72.2 'pm2 logs mindshift-app --lines 50'

# Restart everything
ssh deploy@77.42.72.2 'pm2 restart all && cd /opt/mind-shift/kokoro && docker-compose restart'
```

---

**Status**: Ready to proceed with Phase 1
**Next Step**: Install Node.js on Hetzner

