#!/bin/bash
# Quick verification that all components are in place

echo "🔍 Verifying Audio Fix Implementation..."
echo ""

ERRORS=0

# Check audio capture files
echo "1️⃣ Checking audio capture files..."
if [ -f "public/audio-capture-processor.js" ]; then
    echo "   ✅ public/audio-capture-processor.js exists"
else
    echo "   ❌ public/audio-capture-processor.js NOT FOUND"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "components/voice/useAudioCapture.ts" ]; then
    echo "   ✅ components/voice/useAudioCapture.ts exists"
else
    echo "   ❌ components/voice/useAudioCapture.ts NOT FOUND"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Check integration
echo "2️⃣ Checking integration in useNaturalVoice..."
if grep -q "useAudioCapture" components/voice/useNaturalVoice.tsx; then
    echo "   ✅ useAudioCapture imported"
else
    echo "   ❌ useAudioCapture NOT imported"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "NEXT_PUBLIC_TRANSCRIPTION_PROVIDER" components/voice/useNaturalVoice.tsx; then
    echo "   ✅ Feature flag check present"
else
    echo "   ❌ Feature flag check MISSING"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Check environment
echo "3️⃣ Checking environment configuration..."
if grep -q "NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=whisper" .env.local; then
    echo "   ✅ Whisper enabled in .env.local"
else
    echo "   ⚠️  Whisper not enabled (set NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=whisper)"
fi

if grep -q "WHISPER_SERVICE_URL" .env.local; then
    echo "   ✅ Whisper service URL configured"
else
    echo "   ❌ Whisper service URL NOT configured"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Check Whisper service
echo "4️⃣ Checking Whisper service..."
if [ -d "whisper-service" ]; then
    echo "   ✅ whisper-service directory exists"
else
    echo "   ❌ whisper-service directory NOT FOUND"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "whisper-service/start.sh" ]; then
    echo "   ✅ start.sh script exists"
else
    echo "   ❌ start.sh script NOT FOUND"
    ERRORS=$((ERRORS + 1))
fi

# Test if service is running
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "   ✅ Whisper service is RUNNING"
    HEALTH=$(curl -s http://localhost:8000/health)
    echo "      $HEALTH"
else
    echo "   ⚠️  Whisper service NOT running (start with: cd whisper-service && ./start.sh)"
fi

echo ""

# Check API proxy
echo "5️⃣ Checking API proxy..."
if [ -f "app/api/transcribe/route.ts" ]; then
    echo "   ✅ app/api/transcribe/route.ts exists"
else
    echo "   ❌ app/api/transcribe/route.ts NOT FOUND"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo "✅ All checks passed! Implementation is complete."
    echo ""
    echo "📋 Next steps:"
    echo "   1. Start Whisper service: cd whisper-service && ./start.sh"
    echo "   2. Start dev server: npm run dev"
    echo "   3. Test barge-in (critical!)"
    echo "   4. See IMPLEMENTATION_COMPLETE.md for testing guide"
else
    echo "❌ Found $ERRORS error(s). Please fix before testing."
    echo ""
    echo "See IMPLEMENTATION_COMPLETE.md for troubleshooting."
fi

echo ""
