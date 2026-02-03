#!/bin/bash
# Deploy Whisper service to Hetzner production server

set -e  # Exit on error

# Configuration
SERVER="root@your-hetzner-server.com"  # Update with your server
REMOTE_DIR="/opt/mindshifting/whisper-service"
LOCAL_DIR="./whisper-service"

echo "🚀 Deploying Whisper service to production..."
echo "================================================"

# Step 1: Copy whisper-service directory
echo "📦 Copying whisper-service directory..."
rsync -avz --exclude='venv' --exclude='models' --exclude='__pycache__' --exclude='*.pyc' \
    $LOCAL_DIR/ $SERVER:$REMOTE_DIR/

# Step 2: SSH to server and build
echo "🔨 Building Docker images on server..."
ssh $SERVER << 'ENDSSH'
cd /opt/mindshifting/whisper-service

# Build Docker images
docker-compose build --no-cache

# Start services with --build flag
echo "🎬 Starting services..."
docker-compose up -d --build

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
docker-compose ps

# Test Redis
echo "📊 Testing Redis..."
docker-compose exec -T redis redis-cli ping

# Test Whisper service
echo "🎤 Testing Whisper service..."
curl -f http://localhost:8000/health || echo "⚠️  Health check failed"

echo "================================================"
echo "✅ Deployment complete!"
echo "📝 Check logs with: docker-compose logs -f"
echo "🔍 Monitor health: curl http://localhost:8000/health"
echo "================================================"
ENDSSH

echo ""
echo "🎉 Deployment successful!"
echo ""
echo "Next steps:"
echo "  1. Test transcription: curl -X POST http://your-server:8000/transcribe -F 'audio=@test.wav'"
echo "  2. Monitor logs: ssh $SERVER 'cd $REMOTE_DIR && docker-compose logs -f'"
echo "  3. Update .env.production: WHISPER_SERVICE_URL=http://your-server:8000"
echo "  4. Test feature flag switch: NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=whisper"
echo ""
