"""
FastAPI application for Whisper transcription service.

Provides REST API endpoints for audio transcription with caching.
"""

import io
import logging
import time
from typing import Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from .config import config, get_config_summary
from .transcribe import preprocess_audio, transcribe_audio, get_whisper_model
from .cache import get_cache

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
transcription_requests_total = Counter(
    'transcription_requests_total',
    'Total number of transcription requests',
    ['status', 'cached']
)
transcription_duration_seconds = Histogram(
    'transcription_duration_seconds',
    'Time spent processing transcriptions',
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
)
audio_duration_seconds = Histogram(
    'audio_duration_seconds',
    'Duration of input audio',
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 30.0]
)
real_time_factor_histogram = Histogram(
    'real_time_factor',
    'Real-time factor (processing_time / audio_duration)',
    buckets=[0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0]
)
cache_hits_total = Counter('cache_hits_total', 'Total number of cache hits')
cache_misses_total = Counter('cache_misses_total', 'Total number of cache misses')
active_requests = Gauge('active_requests', 'Number of requests currently being processed')

# Create FastAPI application
app = FastAPI(
    title="Whisper Transcription Service",
    description="Self-hosted OpenAI Whisper speech-to-text service with Redis caching",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://mind-shift.click"],  # Dev + Production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize cache
cache = get_cache()

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests with timing information."""
    start_time = time.time()
    
    # Process request
    response = await call_next(request)
    
    # Calculate duration
    duration = time.time() - start_time
    
    # Log request
    logger.info(
        f"{request.method} {request.url.path} - "
        f"Status: {response.status_code} - "
        f"Duration: {duration:.3f}s"
    )
    
    return response


def verify_api_key(x_api_key: Optional[str] = Header(None)) -> bool:
    """
    Verify API key if authentication is enabled.
    
    Args:
        x_api_key: API key from X-API-Key header
    
    Returns:
        True if valid or auth disabled
    
    Raises:
        HTTPException: 401 if API key invalid
    """
    if config.API_KEY is not None:
        if x_api_key != config.API_KEY:
            raise HTTPException(status_code=401, detail="Invalid API key")
    return True


@app.on_event("startup")
async def startup_event():
    """Preload Whisper model on application startup."""
    logger.info("=" * 50)
    logger.info("Whisper Transcription Service Starting")
    logger.info("=" * 50)
    
    # Log configuration
    config_summary = get_config_summary()
    logger.info(f"Configuration: {config_summary}")
    
    # Preload model
    try:
        logger.info("Preloading Whisper model...")
        get_whisper_model()
        logger.info("✓ Model preloaded successfully")
    except Exception as e:
        logger.error(f"✗ Failed to preload model: {e}")
        logger.warning("Service will continue, but first request will be slow")
    
    logger.info("=" * 50)
    logger.info("Service ready")
    logger.info("=" * 50)


@app.get("/")
async def root():
    """Simple health check endpoint."""
    return {
        "service": "Whisper Transcription Service",
        "status": "healthy",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    """Detailed health check endpoint."""
    try:
        # Check if model is loaded
        model = get_whisper_model()
        model_status = "loaded"
    except Exception as e:
        logger.error(f"Model health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "model": "failed",
                "error": str(e)
            }
        )
    
    return {
        "status": "healthy",
        "model": model_status,
        "cache": "enabled" if config.CACHE_ENABLED else "disabled",
        "config": get_config_summary()
    }


@app.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    x_api_key: Optional[str] = Header(None)
):
    """
    Transcribe audio file to text.
    
    Args:
        audio: Audio file (WAV, MP3, OGG, FLAC)
        x_api_key: Optional API key for authentication
    
    Returns:
        JSON with transcript, segments, language, duration, and metadata
    
    Raises:
        400: Invalid audio file
        401: Invalid API key
        500: Processing error
    """
    # Verify API key if required
    verify_api_key(x_api_key)
    
    # Track active requests
    active_requests.inc()
    
    start_time = time.time()
    status = "error"
    cached = False
    
    try:
        # Validate file format
        if not audio.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        file_ext = audio.filename.split(".")[-1].lower()
        if file_ext not in config.ALLOWED_AUDIO_FORMATS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported audio format: {file_ext}. "
                       f"Allowed formats: {', '.join(config.ALLOWED_AUDIO_FORMATS)}"
            )
        
        # Read audio data
        audio_bytes = await audio.read()
        
        # Validate file size
        if len(audio_bytes) > config.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large: {len(audio_bytes)} bytes > "
                       f"maximum {config.MAX_FILE_SIZE} bytes"
            )
        
        logger.info(f"Processing audio: {audio.filename} ({len(audio_bytes)} bytes)")
        
        # Check cache
        cached_result = cache.get(audio_bytes)
        if cached_result:
            logger.info(f"Cache HIT: Returning cached result")
            cached = True
            cache_hits_total.inc()
            return cached_result
        
        cache_misses_total.inc()
        
        # Preprocess audio
        audio_file = io.BytesIO(audio_bytes)
        audio_data, sample_rate = preprocess_audio(audio_file, audio.filename)
        
        # Transcribe
        result = transcribe_audio(audio_data, sample_rate)
        
        # Cache result
        cache.set(audio_bytes, result)
        
        # Add processing metadata
        total_time = time.time() - start_time
        result["total_processing_time"] = round(total_time, 3)
        
        logger.info(
            f"Transcription complete: {audio.filename} - "
            f"{len(result['transcript'])} chars - "
            f"{total_time:.3f}s"
        )
        
        # Record metrics
        status = "success"
        transcription_duration_seconds.observe(total_time)
        audio_duration_seconds.observe(result['audio_duration'])
        real_time_factor_histogram.observe(result['real_time_factor'])
        
        return result
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    
    except ValueError as e:
        # Validation errors (from preprocessing)
        logger.warning(f"Validation error: {e}")
        status = "validation_error"
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        # Unexpected errors
        logger.error(f"Transcription failed: {e}", exc_info=True)
        status = "error"
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(e)}"
        )
    
    finally:
        # Always record request and decrement active
        active_requests.dec()
        transcription_requests_total.labels(status=status, cached=str(cached)).inc()


@app.delete("/cache")
async def clear_cache(x_api_key: Optional[str] = Header(None)):
    """
    Clear all cached transcriptions.
    
    Requires API key if authentication is enabled.
    
    Args:
        x_api_key: Optional API key for authentication
    
    Returns:
        JSON with number of keys deleted
    
    Raises:
        401: Invalid API key
    """
    # Verify API key (always required for cache operations)
    if config.API_KEY is not None:
        verify_api_key(x_api_key)
    
    deleted = cache.clear()
    
    logger.info(f"Cache cleared: {deleted} keys deleted")
    
    return {
        "status": "success",
        "deleted": deleted,
        "message": f"Cleared {deleted} cached transcriptions"
    }


@app.get("/metrics")
async def metrics():
    """
    Expose Prometheus metrics.
    
    Returns:
        Prometheus metrics in text format
    """
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/stats")
async def stats():
    """
    Return JSON statistics for monitoring.
    
    Returns:
        JSON with cache hit rate and other stats
    """
    # Calculate cache hit rate
    total_hits = cache_hits_total._value.get()
    total_misses = cache_misses_total._value.get()
    total_requests = total_hits + total_misses
    
    cache_hit_rate = (total_hits / total_requests * 100) if total_requests > 0 else 0
    
    return {
        "cache": {
            "hits": total_hits,
            "misses": total_misses,
            "total_requests": total_requests,
            "hit_rate_percent": round(cache_hit_rate, 2)
        },
        "requests": {
            "total": transcription_requests_total._value.get(),
            "active": active_requests._value.get()
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=config.API_HOST,
        port=config.API_PORT,
        workers=1,  # Use 1 worker for development
        log_level="info"
    )
