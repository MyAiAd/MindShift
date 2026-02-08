#!/usr/bin/env python3
"""
Test script for Calm-Whisper implementation
Tests hallucination detection with silence and real speech
"""

import os
import sys
import time
import numpy as np
import soundfile as sf

# Add whisper-service to path
sys.path.insert(0, '/home/sage/Code/MindShifting/whisper-service')

from app.transcribe import transcribe_audio, is_hallucination

print("=" * 70)
print("CALM-WHISPER IMPLEMENTATION TEST")
print("=" * 70)

# Test 1: Pure Silence (should return empty, not hallucinate)
print("\n📊 Test 1: Pure Silence (5 seconds)")
print("-" * 70)
silence_audio = np.zeros(16000 * 5, dtype=np.float32)  # 5 seconds of silence at 16kHz
try:
    result = transcribe_audio(silence_audio, 16000)
    transcript = result['transcript']
    hallucination_filtered = result.get('hallucination_filtered', False)
    
    if not transcript:
        print("✅ PASS: No transcript generated (silence correctly detected)")
    elif hallucination_filtered:
        print(f"✅ PASS: Hallucination filtered: '{transcript}'")
        print(f"   Reason: {result.get('hallucination_reason', 'N/A')}")
    else:
        print(f"❌ FAIL: Generated text from silence: '{transcript}'")
        print("   This is a hallucination!")
except Exception as e:
    print(f"❌ ERROR: {e}")

# Test 2: Very Short Audio (common hallucination trigger)
print("\n📊 Test 2: Very Short Audio (0.5 seconds)")
print("-" * 70)
short_audio = np.random.rand(16000 // 2).astype(np.float32) * 0.01  # 0.5s low-level noise
try:
    result = transcribe_audio(short_audio, 16000)
    transcript = result['transcript']
    hallucination_filtered = result.get('hallucination_filtered', False)
    
    if not transcript or hallucination_filtered:
        print(f"✅ PASS: Short audio handled correctly")
        if hallucination_filtered:
            print(f"   Filtered: '{transcript}' - Reason: {result.get('hallucination_reason')}")
    else:
        print(f"⚠️  WARN: Generated text from short noise: '{transcript}'")
except Exception as e:
    print(f"❌ ERROR: {e}")

# Test 3: Synthetic "thanks for watching" phrase detection
print("\n📊 Test 3: Known Hallucination Phrase Detection")
print("-" * 70)
test_phrases = [
    "thanks for watching",
    "subscribe to my channel",
    "see you in the next video",
    "thank you thank you thank you",  # Repetition
]

for phrase in test_phrases:
    is_hall, reason = is_hallucination(phrase, [], 1.0)
    if is_hall:
        print(f"✅ PASS: '{phrase}' detected as hallucination ({reason})")
    else:
        print(f"❌ FAIL: '{phrase}' NOT detected as hallucination")

# Test 4: Valid Speech Should Pass Through
print("\n📊 Test 4: Valid Speech (should NOT be filtered)")
print("-" * 70)
valid_phrases = [
    "I feel anxious about my work",
    "Can you help me understand this",
    "That makes sense to me",
]

for phrase in valid_phrases:
    is_hall, reason = is_hallucination(phrase, [], 2.0)
    if not is_hall:
        print(f"✅ PASS: '{phrase}' correctly passed through")
    else:
        print(f"❌ FAIL: '{phrase}' incorrectly filtered ({reason})")

# Test 5: Repetition Detection
print("\n📊 Test 5: Repetition Detection (hallucination indicator)")
print("-" * 70)
repetitive_text = "hello hello hello hello"  # Hallucinations often repeat
is_hall, reason = is_hallucination(repetitive_text, [], 1.0)
if is_hall and 'repeated' in reason:
    print(f"✅ PASS: Repetition detected: {reason}")
else:
    print(f"❌ FAIL: Repetition not detected")

print("\n" + "=" * 70)
print("TEST COMPLETE")
print("=" * 70)
print("\n✅ Check results above")
print("🔄 If tests fail, run: bash /home/sage/Code/MindShifting/ROLLBACK.sh")
