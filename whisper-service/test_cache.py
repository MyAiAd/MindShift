#!/usr/bin/env python3
"""Test script to verify cache module works correctly."""

import sys
import json

def main():
    print("Testing cache module...")
    print("=" * 50)
    
    try:
        from app.cache import NoOpCache, RedisCache
        
        print("✓ Cache module imported successfully")
        
        # Test 1: NoOpCache
        print("\nTest 1: NoOpCache (disabled cache)")
        noop_cache = NoOpCache()
        
        test_audio = b"fake audio data for testing"
        test_result = {"transcript": "hello world", "duration": 3.5}
        
        # Get should always return None
        cached = noop_cache.get(test_audio)
        assert cached is None, "NoOpCache.get() should always return None"
        print("  ✓ get() returns None (cache miss)")
        
        # Set should always return False
        success = noop_cache.set(test_audio, test_result)
        assert success is False, "NoOpCache.set() should always return False"
        print("  ✓ set() returns False")
        
        # Clear should always return 0
        deleted = noop_cache.clear()
        assert deleted == 0, "NoOpCache.clear() should always return 0"
        print("  ✓ clear() returns 0")
        
        # Test 2: RedisCache hash computation
        print("\nTest 2: SHA256 hash computation")
        hash1 = RedisCache._compute_hash(b"test audio 1")
        hash2 = RedisCache._compute_hash(b"test audio 2")
        hash3 = RedisCache._compute_hash(b"test audio 1")  # Same as hash1
        
        assert len(hash1) == 64, f"SHA256 hash should be 64 chars, got {len(hash1)}"
        assert hash1 != hash2, "Different audio should produce different hashes"
        assert hash1 == hash3, "Same audio should produce same hash"
        print(f"  ✓ Hash length: {len(hash1)} chars")
        print(f"  ✓ Hash 1: {hash1[:16]}...")
        print(f"  ✓ Hash 2: {hash2[:16]}... (different)")
        print(f"  ✓ Hash 3: {hash3[:16]}... (same as hash 1)")
        
        # Test 3: URL masking
        print("\nTest 3: URL masking for security")
        url1 = "redis://localhost:6379/0"
        url2 = "redis://user:secret@localhost:6379/0"
        
        masked1 = RedisCache._mask_url(url1)
        masked2 = RedisCache._mask_url(url2)
        
        assert "secret" not in masked2, "Password should be masked in URL"
        assert "***" in masked2, "Masked URL should contain ***"
        print(f"  ✓ Original URL (no auth): {url1}")
        print(f"  ✓ Masked URL (no auth):   {masked1}")
        print(f"  ✓ Original URL (with auth): {url2}")
        print(f"  ✓ Masked URL (with auth):   {masked2}")
        
        # Test 4: RedisCache initialization (will fail to connect, but shouldn't crash)
        print("\nTest 4: RedisCache initialization (no Redis server)")
        cache = RedisCache("redis://localhost:6379/0", ttl=3600)
        
        # Should gracefully handle connection failure
        cached = cache.get(test_audio)
        assert cached is None, "Should return None when Redis unavailable"
        print("  ✓ Gracefully handles Redis unavailable (returns None)")
        
        success = cache.set(test_audio, test_result)
        assert success is False, "Should return False when Redis unavailable"
        print("  ✓ Gracefully handles set() when Redis unavailable (returns False)")
        
        deleted = cache.clear()
        assert deleted == 0, "Should return 0 when Redis unavailable"
        print("  ✓ Gracefully handles clear() when Redis unavailable (returns 0)")
        
        # Test 5: get_cache() factory function
        print("\nTest 5: get_cache() factory function")
        from app.cache import get_cache
        from app.config import config
        
        cache_instance = get_cache()
        
        if config.CACHE_ENABLED:
            assert isinstance(cache_instance, RedisCache), "Should return RedisCache when enabled"
            print(f"  ✓ Returns RedisCache (CACHE_ENABLED={config.CACHE_ENABLED})")
        else:
            assert isinstance(cache_instance, NoOpCache), "Should return NoOpCache when disabled"
            print(f"  ✓ Returns NoOpCache (CACHE_ENABLED={config.CACHE_ENABLED})")
        
        print("\n" + "=" * 50)
        print("SUCCESS: All cache module tests passed!")
        print("\nNOTE: Redis connection tests show graceful failure handling.")
        print("Full cache functionality requires Redis server running.")
        return 0
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        print("=" * 50)
        print("FAILED: Cache module test failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
