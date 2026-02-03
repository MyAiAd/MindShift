#!/usr/bin/env python3
"""Test script to verify Whisper model loads successfully."""

import sys
import time
from faster_whisper import WhisperModel

def main():
    print("Testing Whisper model load...")
    print("=" * 50)
    
    try:
        start_time = time.time()
        print("Loading Whisper base model (this may take a while on first run)...")
        
        # Load the base model with CPU settings
        model = WhisperModel(
            "base",
            device="cpu",
            compute_type="int8",
            download_root="./models"
        )
        
        load_time = time.time() - start_time
        print(f"✓ Model loaded successfully in {load_time:.2f}s")
        print(f"✓ Model name: base")
        print(f"✓ Device: cpu")
        print(f"✓ Compute type: int8")
        print("=" * 50)
        print("SUCCESS: Whisper model is ready to use!")
        return 0
        
    except Exception as e:
        print(f"✗ Error loading model: {e}")
        print("=" * 50)
        print("FAILED: Could not load Whisper model")
        return 1

if __name__ == "__main__":
    sys.exit(main())
