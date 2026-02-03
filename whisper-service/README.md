# Whisper Speech-to-Text Service

Self-hosted OpenAI Whisper transcription service with Redis caching and production monitoring.

## Prerequisites

- Python 3.10 or higher
- System dependencies:
  - `libsndfile1` - Audio file reading
  - `ffmpeg` - Audio format conversion
  - `libz-dev` - Compression library (zlib)

### Install System Dependencies

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y libsndfile1 ffmpeg libz-dev
```

**macOS:**
```bash
brew install libsndfile ffmpeg
```

**RHEL/CentOS:**
```bash
sudo yum install -y libsndfile ffmpeg zlib-devel
```

## Local Development Setup

### 1. Create Python Virtual Environment

```bash
cd whisper-service
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Python Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

This will install:
- `faster-whisper` - Optimized Whisper implementation
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- Audio processing libraries (`soundfile`, `librosa`)
- `redis` - Caching client
- Other required dependencies

### 3. Download Whisper Model

Run the test script to download and cache the Whisper base model:

```bash
python test_model_load.py
```

This will:
- Download the Whisper base model (~150MB)
- Cache it locally in `./models`
- Verify the model loads successfully

Expected output:
```
Testing Whisper model load...
==================================================
Loading Whisper base model (this may take a while on first run)...
✓ Model loaded successfully in X.XXs
✓ Model name: base
✓ Device: cpu
✓ Compute type: int8
==================================================
SUCCESS: Whisper model is ready to use!
```

### 4. Run Development Server

```bash
# Make sure you're in the whisper-service directory with venv activated
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Configuration

The service is configured via environment variables. Create a `.env` file in the `whisper-service` directory:

```bash
# Model Configuration
WHISPER_MODEL=base              # Options: tiny, base, small, medium, large
WHISPER_DEVICE=cpu              # Options: cpu, cuda
WHISPER_COMPUTE_TYPE=int8       # Options: int8, float16, float32

# Audio Processing
MAX_AUDIO_DURATION=30           # Maximum audio length in seconds
MIN_AUDIO_DURATION=0.1          # Minimum audio length in seconds

# Redis Cache
REDIS_URL=redis://localhost:6379/0
CACHE_ENABLED=true
CACHE_TTL=3600                  # Cache TTL in seconds (1 hour)

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
API_WORKERS=2
API_KEY=                        # Optional: Set for authentication
```

## Testing

### Test Model Load
```bash
python test_model_load.py
```

### Test API Endpoints

Start the server, then test with curl:

```bash
# Health check
curl http://localhost:8000/

# Detailed health check
curl http://localhost:8000/health

# Transcribe audio
curl -X POST http://localhost:8000/transcribe \
  -F "audio=@test_audio.wav"
```

## Troubleshooting

### ImportError: libz.so.1 or libsndfile not found

Install system dependencies:
```bash
sudo apt-get install -y libsndfile1 ffmpeg libz-dev
```

### Model download fails

Check internet connection and try downloading manually:
```bash
python -c "from faster_whisper import WhisperModel; WhisperModel('base', download_root='./models')"
```

### Out of memory errors

Try a smaller model:
```bash
export WHISPER_MODEL=tiny
```

Or increase available memory/swap.

## Next Steps

After completing local setup:
1. Implement the FastAPI application (`app/main.py`)
2. Set up Docker containers for production
3. Configure Redis for caching
4. Deploy to production server

## Project Structure

```
whisper-service/
├── app/
│   ├── main.py           # FastAPI application (to be created)
│   ├── config.py         # Configuration management (to be created)
│   ├── transcribe.py     # Whisper transcription logic (to be created)
│   └── cache.py          # Redis caching layer (to be created)
├── models/               # Cached Whisper models
├── venv/                 # Python virtual environment
├── requirements.txt      # Python dependencies
├── test_model_load.py   # Model verification script
└── README.md            # This file
```
