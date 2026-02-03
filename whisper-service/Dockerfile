FROM python:3.10-slim

# Set build argument for model download
ARG WHISPER_MODEL=base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create directories for cache and logs
RUN mkdir -p /app/models /app/logs /app/cache && \
    chmod 755 /app/models /app/logs /app/cache

# Pre-download Whisper model during build
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('${WHISPER_MODEL}', download_root='/app/models')"

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run uvicorn with 2 workers
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
