"""
Redis-based caching layer for transcription results.

Provides caching to avoid re-transcribing the same audio files.
"""

import hashlib
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any
import redis
from .config import config

logger = logging.getLogger(__name__)


class RedisCache:
    """Redis-based cache for transcription results."""
    
    def __init__(self, redis_url: str, ttl: int):
        """
        Initialize Redis cache connection.
        
        Args:
            redis_url: Redis connection URL (e.g., redis://localhost:6379/0)
            ttl: Time-to-live for cache entries in seconds
        """
        self.ttl = ttl
        self.redis_url = redis_url
        self._client: Optional[redis.Redis] = None
        self._connect()
    
    def _connect(self):
        """Establish Redis connection. Logs error but doesn't raise on failure."""
        try:
            self._client = redis.from_url(
                self.redis_url,
                decode_responses=True,  # Automatically decode bytes to strings
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            # Test connection
            self._client.ping()
            logger.info(f"Redis cache connected successfully: {self._mask_url(self.redis_url)}")
        except Exception as e:
            logger.error(f"Failed to connect to Redis at {self._mask_url(self.redis_url)}: {e}")
            logger.warning("Continuing without cache (NoOpCache fallback)")
            self._client = None
    
    @staticmethod
    def _mask_url(url: str) -> str:
        """Mask password in Redis URL for logging."""
        if "@" in url and "://" in url:
            parts = url.split("://", 1)
            if "@" in parts[1]:
                creds, host = parts[1].split("@", 1)
                return f"{parts[0]}://***:***@{host}"
        return url
    
    @staticmethod
    def _compute_hash(audio_data: bytes) -> str:
        """
        Compute SHA256 hash of audio data for cache key.
        
        Args:
            audio_data: Raw audio bytes
        
        Returns:
            Hex string of SHA256 hash
        """
        return hashlib.sha256(audio_data).hexdigest()
    
    def get(self, audio_data: bytes) -> Optional[Dict[str, Any]]:
        """
        Get cached transcription result for audio data.
        
        Args:
            audio_data: Raw audio bytes
        
        Returns:
            Cached transcription result dict, or None if cache miss or Redis unavailable
        """
        if self._client is None:
            return None
        
        try:
            cache_key = self._compute_hash(audio_data)
            cache_key_display = cache_key[:16] + "..."  # Truncate for logging
            
            cached_json = self._client.get(f"transcription:{cache_key}")
            
            if cached_json:
                result = json.loads(cached_json)
                # Add cache hit metadata
                result["cache_hit"] = True
                result["cache_hit_at"] = datetime.utcnow().isoformat()
                logger.info(f"Cache HIT: {cache_key_display}")
                return result
            else:
                logger.info(f"Cache MISS: {cache_key_display}")
                return None
                
        except Exception as e:
            logger.error(f"Redis get() failed: {e}. Continuing without cache.")
            return None
    
    def set(self, audio_data: bytes, result: Dict[str, Any]) -> bool:
        """
        Store transcription result in cache.
        
        Args:
            audio_data: Raw audio bytes
            result: Transcription result dictionary
        
        Returns:
            True if cached successfully, False otherwise
        """
        if self._client is None:
            return False
        
        try:
            cache_key = self._compute_hash(audio_data)
            cache_key_display = cache_key[:16] + "..."  # Truncate for logging
            
            # Add cache metadata
            cache_entry = result.copy()
            cache_entry["cached_at"] = datetime.utcnow().isoformat()
            cache_entry["cache_hit"] = False
            
            # Store with TTL
            self._client.setex(
                f"transcription:{cache_key}",
                self.ttl,
                json.dumps(cache_entry)
            )
            
            logger.info(f"Cache SET: {cache_key_display} (TTL={self.ttl}s)")
            return True
            
        except Exception as e:
            logger.error(f"Redis set() failed: {e}. Continuing without cache.")
            return False
    
    def clear(self) -> int:
        """
        Clear all transcription cache entries.
        
        Returns:
            Number of keys deleted, or 0 if Redis unavailable
        """
        if self._client is None:
            return 0
        
        try:
            keys = list(self._client.scan_iter("transcription:*"))
            if keys:
                deleted = self._client.delete(*keys)
                logger.info(f"Cache cleared: {deleted} keys deleted")
                return deleted
            else:
                logger.info("Cache clear: No keys to delete")
                return 0
                
        except Exception as e:
            logger.error(f"Redis clear() failed: {e}")
            return 0


class NoOpCache:
    """No-operation cache fallback when caching is disabled."""
    
    def __init__(self):
        logger.info("Cache disabled (NoOpCache)")
    
    def get(self, audio_data: bytes) -> None:
        """Always return cache miss."""
        return None
    
    def set(self, audio_data: bytes, result: Dict[str, Any]) -> bool:
        """Do nothing, return False."""
        return False
    
    def clear(self) -> int:
        """Do nothing, return 0."""
        return 0


def get_cache() -> RedisCache | NoOpCache:
    """
    Get cache instance based on configuration.
    
    Returns:
        RedisCache if enabled, NoOpCache otherwise
    """
    if config.CACHE_ENABLED:
        return RedisCache(config.REDIS_URL, config.CACHE_TTL)
    else:
        return NoOpCache()
