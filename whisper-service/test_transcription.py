#!/usr/bin/env python3
"""Test script to verify Whisper transcription works correctly."""

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
    print("Testing Whisper transcription...")
    print("=" * 50)
    
    try:
        from app.transcribe import get_whisper_model, transcribe_audio, preprocess_audio
        
        print("✓ Transcription module imported successfully")
        
        # Test 1: Load model (singleton pattern)
        print("\nTest 1: Load Whisper model (singleton)")
        model1 = get_whisper_model()
        model2 = get_whisper_model()
        assert model1 is model2, "Model should be singleton (same instance)"
        print("  ✓ Model loaded as singleton")
        print(f"  ✓ Model type: {type(model1).__name__}")
        
        # Test 2: Transcribe simple audio
        # Note: Pure tone won't produce meaningful transcript, but tests the pipeline
        print("\nTest 2: Transcribe audio (3s pure tone)")
        audio_bytes = create_test_audio(duration=3.0)
        audio_file = io.BytesIO(audio_bytes)
        audio_data, sample_rate = preprocess_audio(audio_file, "test_tone.wav")
        
        result = transcribe_audio(audio_data, sample_rate)
        
        # Verify result structure
        assert "transcript" in result, "Result should have 'transcript'"
        assert "segments" in result, "Result should have 'segments'"
        assert "language" in result, "Result should have 'language'"
        assert "language_probability" in result, "Result should have 'language_probability'"
        assert "audio_duration" in result, "Result should have 'audio_duration'"
        assert "processing_time" in result, "Result should have 'processing_time'"
        assert "real_time_factor" in result, "Result should have 'real_time_factor'"
        
        print(f"  ✓ Transcript: '{result['transcript'][:50]}{'...' if len(result['transcript']) > 50 else ''}'")
        print(f"  ✓ Segments: {len(result['segments'])}")
        print(f"  ✓ Language: {result['language']} (probability: {result['language_probability']})")
        print(f"  ✓ Audio duration: {result['audio_duration']}s")
        print(f"  ✓ Processing time: {result['processing_time']['total']}s")
        print(f"  ✓ Real-time factor: {result['real_time_factor']}")
        
        # Test 3: Verify processing time breakdown
        assert "transcribe" in result["processing_time"], "Should have 'transcribe' time"
        assert "total" in result["processing_time"], "Should have 'total' time"
        assert result["processing_time"]["total"] >= result["processing_time"]["transcribe"], \
            "Total time should be >= transcribe time"
        print("  ✓ Processing time breakdown correct")
        
        # Test 4: Verify real-time factor calculation
        expected_rtf = result["processing_time"]["total"] / result["audio_duration"]
        assert abs(result["real_time_factor"] - expected_rtf) < 0.01, \
            f"RTF calculation incorrect: {result['real_time_factor']} vs {expected_rtf}"
        print("  ✓ Real-time factor calculation correct")
        
        # Test 5: Verify segments structure
        if result["segments"]:
            segment = result["segments"][0]
            assert "start" in segment, "Segment should have 'start'"
            assert "end" in segment, "Segment should have 'end'"
            assert "text" in segment, "Segment should have 'text'"
            # confidence might be None for some segments
            print(f"  ✓ Segment structure correct")
            print(f"    First segment: [{segment['start']}s - {segment['end']}s] '{segment['text'][:30]}'")
        
        print("\n" + "=" * 50)
        print("SUCCESS: Whisper transcription working correctly!")
        print("\nNOTE: Pure tone audio may not produce meaningful transcripts.")
        print("This test verifies the pipeline, not transcription accuracy.")
        return 0
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        print("=" * 50)
        print("FAILED: Whisper transcription test failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
