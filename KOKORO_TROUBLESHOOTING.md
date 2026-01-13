# Kokoro Deployment - Troubleshooting Guide

## Issues Found

### Issue 1: Port 8080 Conflict (Phase 1)

**Symptom:**
```
<html>
<head><title>404 Not Found</title></head>
<body bgcolor="white" text="black">
<center><h1>404 Not Found</h1></center>
<hr><center>drogon/1.9.11</center>
</body>
</html>
```

**Diagnosis:**
- Port 8080 is occupied by **Drogon** (C++ web framework)
- This is likely the old **Paroli** service still running
- Kokoro Docker container failed to bind to port 8080

**Solution Steps:**

### Step 1: SSH to Server and Check What's Running

```bash
ssh deploy@77.42.72.2

# Check what's using port 8080
sudo lsof -i :8080

# Or use ss command
sudo ss -tlnp | grep 8080

# Check all Docker containers
docker ps -a

# Check systemd services
systemctl list-units --type=service | grep -E 'paroli|drogon'
```

### Step 2: Stop the Old Paroli Service

```bash
# If it's a Docker container
docker ps
docker stop <paroli-container-name>
docker rm <paroli-container-name>

# If it's running via docker-compose
cd ~/paroli-local/paroli  # or wherever it is
docker compose down

# If it's a systemd service
sudo systemctl stop paroli
sudo systemctl disable paroli

# Verify port is free
sudo lsof -i :8080
# Should return nothing
```

### Step 3: Start Kokoro

```bash
cd /opt/mind-shift/kokoro

# Make sure nothing is running
docker compose down

# Start fresh
docker compose up -d

# Check logs
docker compose logs -f
```

### Step 4: Verify Kokoro is Running

```bash
# Check Docker container
docker ps | grep kokoro

# Should show:
# kokoro-tts   Up X seconds   127.0.0.1:8080->8080/tcp

# Test health endpoint
curl http://localhost:8080/health

# Should return:
# {"status":"healthy"}

# Test TTS
curl -X POST http://localhost:8080/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from Kokoro","format":"opus"}' \
  --output test.opus

# Check file size
ls -lh test.opus
# Should be ~20-50 KB, NOT 572 bytes

# Play it
ffplay test.opus
# Should play audio, NOT give "Invalid data" error
```

---

## Issue 2: Public API Not Responding (Phase 2.3)

**Symptom:**
```bash
curl https://api.mind-shift.click/tts
# Returns 0 bytes
test-remote.opus: Invalid data found when processing input
```

**Diagnosis:**
- Caddy is running but can't connect to Kokoro backend
- Either Kokoro isn't running, or Caddy is misconfigured

**Solution Steps:**

### Step 1: Verify Kokoro is Actually Running

```bash
ssh deploy@77.42.72.2

# Check if Kokoro container is up
docker ps | grep kokoro

# Check if it's listening on port 8080
curl http://localhost:8080/health

# If this fails, Kokoro isn't running - go back to Issue 1 steps
```

### Step 2: Check Caddy Configuration

```bash
# View current Caddyfile
sudo cat /etc/caddy/Caddyfile

# Should have:
# api.mind-shift.click {
#     reverse_proxy 127.0.0.1:8080
# }

# Test Caddy config
sudo caddy validate --config /etc/caddy/Caddyfile

# If validation fails, fix the config
```

### Step 3: Check Caddy Logs

```bash
# View Caddy logs
sudo journalctl -u caddy -f

# Look for errors like:
# "dial tcp 127.0.0.1:8080: connect: connection refused"
```

### Step 4: Reload Caddy

```bash
# Reload Caddy configuration
sudo systemctl reload caddy

# Check Caddy status
sudo systemctl status caddy

# Should be "active (running)"
```

### Step 5: Test Again

```bash
# From your local machine
curl https://api.mind-shift.click/health

# Should return:
# {"status":"healthy"}

# Test TTS
curl -X POST https://api.mind-shift.click/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Testing Kokoro","format":"opus"}' \
  --output test-remote.opus

# Check file
ls -lh test-remote.opus
# Should be ~20-50 KB

# Play it
ffplay test-remote.opus
# Should work!
```

---

## Complete Verification Checklist

Run these commands to verify everything is working:

### On Hetzner Server (SSH)

```bash
ssh deploy@77.42.72.2

# 1. Check Docker
docker ps | grep kokoro
# Expected: kokoro-tts container running

# 2. Check port 8080
sudo lsof -i :8080
# Expected: Shows docker-proxy

# 3. Test local health
curl http://localhost:8080/health
# Expected: {"status":"healthy"}

# 4. Test local TTS
curl -X POST http://localhost:8080/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Local test","format":"opus"}' \
  --output local-test.opus && ls -lh local-test.opus
# Expected: File ~20-50 KB

# 5. Check Caddy
sudo systemctl status caddy
# Expected: active (running)

# 6. View Caddy config
sudo cat /etc/caddy/Caddyfile | grep -A 5 api.mind-shift.click
# Expected: Shows reverse_proxy 127.0.0.1:8080
```

### From Your Local Machine

```bash
# 1. Test public health
curl https://api.mind-shift.click/health
# Expected: {"status":"healthy"}

# 2. Test public TTS
curl -X POST https://api.mind-shift.click/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Public test","format":"opus"}' \
  --output public-test.opus

# 3. Check file
ls -lh public-test.opus
# Expected: ~20-50 KB

# 4. Play it
ffplay public-test.opus
# Expected: Plays audio successfully
```

---

## If Still Having Issues

### Check Docker Logs

```bash
ssh deploy@77.42.72.2
cd /opt/mind-shift/kokoro
docker compose logs -f
```

Look for errors like:
- `ModuleNotFoundError` - Missing Python dependencies
- `Address already in use` - Port conflict
- `Model download failed` - Network issues
- `CUDA/GPU errors` - Should be CPU-only

### Rebuild from Scratch

```bash
ssh deploy@77.42.72.2
cd /opt/mind-shift/kokoro

# Stop everything
docker compose down

# Remove old images
docker images | grep kokoro
docker rmi kokoro-tts:latest

# Rebuild
docker compose build --no-cache

# Start
docker compose up -d

# Monitor logs
docker compose logs -f
```

### Check Firewall

```bash
ssh deploy@77.42.72.2

# Make sure Hetzner firewall allows Cloudflare IPs on ports 80/443
# (You already have this set up)

# Make sure UFW or iptables isn't blocking
sudo ufw status
```

---

## Quick Commands Reference

### Docker Operations

```bash
# Start Kokoro
cd /opt/mind-shift/kokoro && docker compose up -d

# Stop Kokoro
docker compose down

# Restart Kokoro
docker compose restart

# View logs
docker compose logs -f

# Check status
docker compose ps

# Rebuild
docker compose build
```

### Caddy Operations

```bash
# Reload config
sudo systemctl reload caddy

# Restart Caddy
sudo systemctl restart caddy

# Check status
sudo systemctl status caddy

# View logs
sudo journalctl -u caddy -f

# Validate config
sudo caddy validate --config /etc/caddy/Caddyfile
```

### Debug Commands

```bash
# What's on port 8080?
sudo lsof -i :8080

# What Docker containers are running?
docker ps -a

# Server resource usage
htop

# Network connections
sudo ss -tlnp

# Disk space
df -h
```

---

## Expected Behavior

### ✅ When Everything Works

**Local (on server):**
```bash
$ curl http://localhost:8080/health
{"status":"healthy"}

$ curl -X POST http://localhost:8080/tts -H "Content-Type: application/json" -d '{"text":"test","format":"opus"}' --output test.opus
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100 45231  100 45200  100    31  22600     15  0:00:02  0:00:02 --:--:-- 22615

$ ls -lh test.opus
-rw-r--r-- 1 deploy deploy 45K Jan 10 21:00 test.opus

$ ffplay test.opus
# Plays audio successfully
```

**Public (from internet):**
```bash
$ curl https://api.mind-shift.click/health
{"status":"healthy"}

$ curl -X POST https://api.mind-shift.click/tts -H "Content-Type: application/json" -d '{"text":"test","format":"opus"}' --output test.opus
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100 45231  100 45200  100    31   8400      5  0:00:05  0:00:05 --:--:--  9321

$ ffplay test.opus
# Plays audio successfully
```

---

**Next:** Once both tests pass, proceed to Phase 3 in KOKORO_DEPLOYMENT.md

