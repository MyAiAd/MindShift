#!/usr/bin/env python3
"""Test script to verify audio preprocessing works correctly."""

import sys
import io
import numpy as np
import soundfile as sf

def create_test_audio(duration: float, sample_rate: int = 16000, frequency: float = 440.0) -> bytes:
    """Create a test audio WAV file in memory."""
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    audio_data = 0.5 * np.sin(2 * np.pi * frequency * t).astype(np.float32)
    
    buffer = io.BytesIO()
    sf.write(buffer, audio_data, sample_rate, format='WAV')
    buffer.seek(0)
    return buffer.read()

def main():
    print("Testing audio preprocessing...")
    print("=" * 50)
    
    try:
        from app.transcribe import preprocess_audio
        from app.config import config
        
        print("✓ Preprocessing module imported successfully")
        
        # Test 1: Valid audio (3 seconds)
        print("\nTest 1: Valid audio (3 seconds, 440Hz tone)")
        audio_bytes = create_test_audio(duration=3.0)
        audio_file = io.BytesIO(audio_bytes)
        audio_data, sample_rate = preprocess_audio(audio_file, "test_3s.wav")
        
        assert sample_rate == 16000, f"Sample rate should be 16000, got {sample_rate}"
        assert isinstance(audio_data, np.ndarray), "Audio data should be numpy array"
        assert audio_data.dtype == np.float32, f"Audio dtype should be float32, got {audio_data.dtype}"
        assert len(audio_data.shape) == 1, "Audio should be 1D array (mono)"
        assert np.max(np.abs(audio_data)) <= 1.0, "Audio should be normalized to [-1, 1]"
        duration = len(audio_data) / sample_rate
        assert abs(duration - 3.0) < 0.1, f"Duration should be ~3s, got {duration:.2f}s"
        
        print(f"  ✓ Audio shape: {audio_data.shape}")
        print(f"  ✓ Sample rate: {sample_rate}Hz")
        print(f"  ✓ Duration: {duration:.2f}s")
        print(f"  ✓ Range: [{np.min(audio_data):.3f}, {np.max(audio_data):.3f}]")
        print(f"  ✓ RMS: {np.sqrt(np.mean(audio_data**2)):.4f}")
        
        # Test 2: Audio too short (should fail)
        print("\nTest 2: Audio too short (0.05s) - should fail")
        try:
            audio_bytes = create_test_audio(duration=0.05)
            audio_file = io.BytesIO(audio_bytes)
            preprocess_audio(audio_file, "test_too_short.wav")
            print("  ✗ Should have raised ValueError for short audio")
            return 1
        except ValueError as e:
            if "too short" in str(e).lower():
                print(f"  ✓ Correctly rejected: {e}")
            else:
                print(f"  ✗ Wrong error message: {e}")
                return 1
        
        # Test 3: Audio too long (should fail)
        print("\nTest 3: Audio too long (35s) - should fail")
        try:
            audio_bytes = create_test_audio(duration=35.0)
            audio_file = io.BytesIO(audio_bytes)
            preprocess_audio(audio_file, "test_too_long.wav")
            print("  ✗ Should have raised ValueError for long audio")
            return 1
        except ValueError as e:
            if "too long" in str(e).lower():
                print(f"  ✓ Correctly rejected: {e}")
            else:
                print(f"  ✗ Wrong error message: {e}")
                return 1
        
        # Test 4: Silent audio (should warn but succeed)
        print("\nTest 4: Silent audio (should warn but succeed)")
        silence = np.zeros(int(16000 * 2.0), dtype=np.float32)
        buffer = io.BytesIO()
        sf.write(buffer, silence, 16000, format='WAV')
        buffer.seek(0)
        audio_data, sample_rate = preprocess_audio(buffer, "test_silent.wav")
        
        rms = np.sqrt(np.mean(audio_data ** 2))
        assert rms < 0.001, f"Silent audio RMS should be near 0, got {rms}"
        print(f"  ✓ Silent audio processed (RMS={rms:.6f})")
        
        # Test 5: Stereo to mono conversion
        print("\nTest 5: Stereo audio (should convert to mono)")
        t = np.linspace(0, 2.0, int(16000 * 2.0), False)
        left = 0.5 * np.sin(2 * np.pi * 440 * t).astype(np.float32)
        right = 0.5 * np.sin(2 * np.pi * 880 * t).astype(np.float32)
        stereo = np.stack([left, right], axis=1)
        
        buffer = io.BytesIO()
        sf.write(buffer, stereo, 16000, format='WAV')
        buffer.seek(0)
        audio_data, sample_rate = preprocess_audio(buffer, "test_stereo.wav")
        
        assert len(audio_data.shape) == 1, "Stereo should be converted to mono (1D)"
        print(f"  ✓ Stereo converted to mono: shape {audio_data.shape}")
        
        # Test 6: Resampling (22050Hz -> 16000Hz)
        print("\nTest 6: Resampling (22050Hz -> 16000Hz)")
        audio_22k = create_test_audio(duration=2.0, sample_rate=22050)
        buffer = io.BytesIO()
        t = np.linspace(0, 2.0, int(22050 * 2.0), False)
        audio_data_22k = 0.5 * np.sin(2 * np.pi * 440 * t).astype(np.float32)
        sf.write(buffer, audio_data_22k, 22050, format='WAV')
        buffer.seek(0)
        audio_data, sample_rate = preprocess_audio(buffer, "test_22khz.wav")
        
        assert sample_rate == 16000, f"Should resample to 16000Hz, got {sample_rate}"
        print(f"  ✓ Resampled to {sample_rate}Hz")
        
        print("\n" + "=" * 50)
        print("SUCCESS: All audio preprocessing tests passed!")
        return 0
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        print("=" * 50)
        print("FAILED: Audio preprocessing test failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
