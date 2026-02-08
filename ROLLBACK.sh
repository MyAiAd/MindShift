#!/bin/bash
# ROLLBACK SCRIPT - In case Calm-Whisper upgrade breaks things
# Created: 2026-02-08

echo "🔄 Rolling back Whisper service to previous stable version..."

# 1. Restore git state
cd /home/sage/Code/MindShifting
git checkout whisper-service/

# 2. Restore original requirements if backed up
if [ -f whisper-service/requirements.txt.backup ]; then
    cp whisper-service/requirements.txt.backup whisper-service/requirements.txt
    echo "✅ Restored requirements.txt from backup"
fi

# 3. Reinstall original dependencies
cd whisper-service
pip install -r requirements.txt --force-reinstall

# 4. Restart whisper service if running
if pgrep -f "uvicorn.*8000" > /dev/null; then
    echo "🔄 Restarting Whisper service..."
    pkill -f "uvicorn.*8000"
    sleep 2
    nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > /dev/null 2>&1 &
    echo "✅ Service restarted"
fi

# 5. Revert frontend env var
cd /home/sage/Code/MindShifting
sed -i 's/NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=whisper/NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=webspeech/' .env.local

echo "✅ ROLLBACK COMPLETE"
echo "   - Whisper service reverted to original version"
echo "   - Frontend switched back to Web Speech API"
echo "   - Test your app to verify it's working"
