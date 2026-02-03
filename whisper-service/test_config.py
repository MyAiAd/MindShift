#!/usr/bin/env python3
"""Test script to verify configuration module works correctly."""

import sys
import json

def main():
    print("Testing Whisper service configuration...")
    print("=" * 50)
    
    try:
        from app.config import config, get_config_summary
        
        print("✓ Config module imported successfully")
        print("\nConfiguration Summary:")
        print(json.dumps(get_config_summary(), indent=2))
        
        # Verify all required attributes exist
        required_attrs = [
            "WHISPER_MODEL", "WHISPER_DEVICE", "WHISPER_COMPUTE_TYPE",
            "MAX_AUDIO_DURATION", "MIN_AUDIO_DURATION",
            "REDIS_URL", "CACHE_ENABLED", "CACHE_TTL",
            "API_HOST", "API_PORT", "API_WORKERS", "API_KEY",
            "MAX_FILE_SIZE", "ALLOWED_AUDIO_FORMATS", "MODEL_CACHE_DIR"
        ]
        
        for attr in required_attrs:
            assert hasattr(config, attr), f"Missing attribute: {attr}"
        
        print("\n✓ All configuration attributes present")
        
        # Verify types
        assert isinstance(config.MAX_AUDIO_DURATION, float), "MAX_AUDIO_DURATION should be float"
        assert isinstance(config.MIN_AUDIO_DURATION, float), "MIN_AUDIO_DURATION should be float"
        assert isinstance(config.CACHE_ENABLED, bool), "CACHE_ENABLED should be bool"
        assert isinstance(config.CACHE_TTL, int), "CACHE_TTL should be int"
        assert isinstance(config.API_PORT, int), "API_PORT should be int"
        assert isinstance(config.API_WORKERS, int), "API_WORKERS should be int"
        assert isinstance(config.MAX_FILE_SIZE, int), "MAX_FILE_SIZE should be int"
        assert isinstance(config.ALLOWED_AUDIO_FORMATS, set), "ALLOWED_AUDIO_FORMATS should be set"
        
        print("✓ All configuration types correct")
        
        # Verify default values
        assert config.WHISPER_MODEL == "base", "Default model should be 'base'"
        assert config.WHISPER_DEVICE == "cpu", "Default device should be 'cpu'"
        assert config.WHISPER_COMPUTE_TYPE == "int8", "Default compute type should be 'int8'"
        assert config.MAX_AUDIO_DURATION == 30.0, "Default max duration should be 30.0s"
        assert config.MIN_AUDIO_DURATION == 0.1, "Default min duration should be 0.1s"
        assert config.CACHE_TTL == 3600, "Default cache TTL should be 3600s"
        
        print("✓ Default values correct")
        
        print("=" * 50)
        print("SUCCESS: Configuration module working correctly!")
        return 0
        
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        print("=" * 50)
        print("FAILED: Configuration module test failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
