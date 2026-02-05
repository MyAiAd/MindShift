#!/bin/bash
# Start Whisper Service for MindShifting Audio Transcription

echo "🎙️ Starting Whisper Service..."

cd "$(dirname "$0")"

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Creating..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Check if requirements are installed
if ! python -c "import faster_whisper" 2>/dev/null; then
    echo "📦 Installing requirements..."
    pip install -r requirements.txt
fi

echo "✅ Environment ready"
echo ""
echo "🚀 Starting Whisper service on http://localhost:8000"
echo "   - Health check: http://localhost:8000/health"
echo "   - API docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start the service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
