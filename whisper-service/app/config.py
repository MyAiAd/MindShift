"""
Configuration management for Whisper transcription service.

All settings can be controlled via environment variables for deployment flexibility.
"""

import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()


class Config:
    """Centralized configuration for Whisper service."""
    
    # Model Configuration
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "base")  # Options: tiny, base, small, medium, large
    WHISPER_DEVICE: str = os.getenv("WHISPER_DEVICE", "cpu")  # Options: cpu, cuda
    WHISPER_COMPUTE_TYPE: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")  # Options: int8, float16, float32
    
    # Audio Processing Limits
    MAX_AUDIO_DURATION: float = float(os.getenv("MAX_AUDIO_DURATION", "30"))  # Maximum audio length in seconds
    MIN_AUDIO_DURATION: float = float(os.getenv("MIN_AUDIO_DURATION", "0.1"))  # Minimum audio length in seconds
    
    # Redis Cache Configuration
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CACHE_ENABLED: bool = os.getenv("CACHE_ENABLED", "true").lower() == "true"
    CACHE_TTL: int = int(os.getenv("CACHE_TTL", "3600"))  # Cache time-to-live in seconds (1 hour default)
    
    # API Configuration
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))
    API_WORKERS: int = int(os.getenv("API_WORKERS", "2"))
    API_KEY: Optional[str] = os.getenv("API_KEY", None)  # Optional: Set for authentication
    
    # File Upload Limits
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", str(10 * 1024 * 1024)))  # 10MB default
    ALLOWED_AUDIO_FORMATS: set = {"wav", "mp3", "ogg", "flac"}
    
    # Model Storage
    MODEL_CACHE_DIR: str = os.getenv("MODEL_CACHE_DIR", "./models")


def get_config_summary() -> dict:
    """
    Get a summary of current configuration for logging.
    
    Returns:
        dict: Configuration summary with all settings (API_KEY masked for security)
    """
    return {
        "model": {
            "name": Config.WHISPER_MODEL,
            "device": Config.WHISPER_DEVICE,
            "compute_type": Config.WHISPER_COMPUTE_TYPE,
            "cache_dir": Config.MODEL_CACHE_DIR,
        },
        "audio": {
            "max_duration": Config.MAX_AUDIO_DURATION,
            "min_duration": Config.MIN_AUDIO_DURATION,
            "max_file_size_mb": Config.MAX_FILE_SIZE / (1024 * 1024),
            "allowed_formats": list(Config.ALLOWED_AUDIO_FORMATS),
        },
        "cache": {
            "enabled": Config.CACHE_ENABLED,
            "redis_url": Config.REDIS_URL.split("@")[-1] if "@" in Config.REDIS_URL else Config.REDIS_URL,  # Hide password
            "ttl_seconds": Config.CACHE_TTL,
        },
        "api": {
            "host": Config.API_HOST,
            "port": Config.API_PORT,
            "workers": Config.API_WORKERS,
            "auth_enabled": Config.API_KEY is not None,
        },
    }


# Create singleton config instance
config = Config()
