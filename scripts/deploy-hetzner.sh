#!/bin/bash
set -e

APP_DIR=/opt/mind-shift/app
CERT_DIR=/opt/mind-shift/certs
CADDY_CFG=/etc/caddy/Caddyfile

echo "=== MindShift Deployment ==="
echo "Timestamp: $(date -u)"

cd "$APP_DIR"
echo "Working directory: $(pwd)"
echo "Current commit: $(git log --oneline -1)"

# --- Deploy Cloudflare Origin TLS certificates ---
if [ -f "$APP_DIR/OriginCert" ] && [ -f "$APP_DIR/PrivateKey" ]; then
  echo "Deploying TLS certificates..."
  sudo mkdir -p "$CERT_DIR"
  sudo cp "$APP_DIR/OriginCert" "$CERT_DIR/origin.pem"
  sudo cp "$APP_DIR/PrivateKey" "$CERT_DIR/origin-key.pem"
  sudo chmod 600 "$CERT_DIR/origin-key.pem"
  sudo chown caddy:caddy "$CERT_DIR"/*.pem 2>/dev/null || true
else
  echo "WARNING: Origin TLS certificate files not found in repo"
fi

# --- Write Caddyfile with correct TLS and proxy config ---
NEEDS_CADDY_RELOAD=false

# Check if Caddyfile has the TLS directive for the origin cert
if ! grep -q 'tls /opt/mind-shift/certs/origin.pem' "$CADDY_CFG" 2>/dev/null; then
  echo "Updating Caddyfile with TLS and reverse proxy configuration..."
  cat > /tmp/Caddyfile.new <<'EOF'
mind-shift.click {
    tls /opt/mind-shift/certs/origin.pem /opt/mind-shift/certs/origin-key.pem
    encode gzip

    reverse_proxy 127.0.0.1:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }

    @static {
        path /_next/static/* *.js *.css *.png *.jpg *.jpeg *.gif *.ico *.svg *.woff *.woff2 *.opus *.mp3 *.ogg
    }
    header @static Cache-Control "public, max-age=31536000, immutable"
}

api.mind-shift.click {
    tls /opt/mind-shift/certs/origin.pem /opt/mind-shift/certs/origin-key.pem

    reverse_proxy 127.0.0.1:8080 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }

    @streaming {
        path /tts/stream*
    }
    handle @streaming {
        reverse_proxy 127.0.0.1:8080 {
            flush_interval -1
        }
    }
}
EOF

  if sudo caddy validate --config /tmp/Caddyfile.new 2>/dev/null; then
    sudo cp /tmp/Caddyfile.new "$CADDY_CFG"
    NEEDS_CADDY_RELOAD=true
    echo "Caddyfile updated and validated."
  else
    echo "WARNING: New Caddyfile failed validation, keeping existing config"
    # Try a simpler config as fallback
    cat > /tmp/Caddyfile.simple <<'EOF'
mind-shift.click {
    tls /opt/mind-shift/certs/origin.pem /opt/mind-shift/certs/origin-key.pem
    reverse_proxy 127.0.0.1:3000
}

api.mind-shift.click {
    tls /opt/mind-shift/certs/origin.pem /opt/mind-shift/certs/origin-key.pem
    reverse_proxy 127.0.0.1:8080
}
EOF
    if sudo caddy validate --config /tmp/Caddyfile.simple 2>/dev/null; then
      sudo cp /tmp/Caddyfile.simple "$CADDY_CFG"
      NEEDS_CADDY_RELOAD=true
      echo "Using simplified Caddyfile as fallback."
    else
      echo "ERROR: Even simplified Caddyfile failed. Leaving existing config intact."
    fi
  fi
  rm -f /tmp/Caddyfile.new /tmp/Caddyfile.simple
fi

if [ "$NEEDS_CADDY_RELOAD" = true ]; then
  echo "Reloading Caddy..."
  sudo systemctl reload caddy || sudo systemctl restart caddy
  sleep 2
  echo "Caddy status: $(sudo systemctl is-active caddy)"
fi

# --- Build and restart Next.js app ---
echo "Installing dependencies..."
npm install

echo "Building Next.js app..."
npm run build

echo "Restarting app via PM2..."
pm2 restart mindshift-app

# --- Health check ---
echo "Running health checks..."
sleep 5
HEALTH_OK=false
for i in 1 2 3 4 5 6; do
  if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "Health check passed (attempt $i)"
    HEALTH_OK=true
    break
  fi
  echo "Health check attempt $i failed, retrying in 3s..."
  sleep 3
done

if [ "$HEALTH_OK" = false ]; then
  echo "WARNING: Health check failed after all attempts"
  echo "--- PM2 Logs (last 30 lines) ---"
  pm2 logs mindshift-app --lines 30 --nostream 2>&1 || true
fi

pm2 list
echo "=== Deployment complete ==="
