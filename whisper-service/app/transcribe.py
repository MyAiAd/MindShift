"""
Audio preprocessing and transcription logic for Whisper service.

Handles audio file reading, format conversion, validation, and transcription.
Includes hallucination detection to filter out common Whisper artifacts.
Enhanced with advanced audio preprocessing for improved accuracy.
Option 5 complete implementation: adaptive noise profiling, VAD pre-filtering, dynamic range compression.
"""

import io
import re
import time
import logging
from typing import Tuple, BinaryIO, Dict, List, Any, Optional
import numpy as np
import soundfile as sf
import librosa
import noisereduce as nr
import webrtcvad
from scipy.signal import butter, filtfilt, wiener
from faster_whisper import WhisperModel
from .config import config

logger = logging.getLogger(__name__)

# ============================================================================
# WHISPER HALLUCINATION DETECTION
# ============================================================================
# Whisper (especially smaller models like base/small) hallucinates common
# phrases when given silence, short audio, or noisy input. These are
# well-documented patterns that appear across many users and use cases.
# See: https://github.com/openai/whisper/discussions/928
# ============================================================================

# Exact-match hallucination phrases (case-insensitive, stripped of punctuation)
# These are phrases Whisper generates from silence/noise, NOT from real speech
HALLUCINATION_PHRASES = {
    # YouTube-style hallucinations (most common)
    "thanks for watching",
    "thank you for watching",
    "thanks for watching and i'll see you in the next video",
    "thanks for watching and ill see you in the next video",
    "thank you for watching and i'll see you in the next video",
    "see you in the next video",
    "i'll see you in the next video",
    "ill see you in the next video",
    "see you in the next one",
    "i'll see you in the next one",
    "see you next time",
    "thanks for listening",
    "thank you for listening",
    "thank you very much",
    "thank you so much",
    "thank you",
    "thanks",
    "bye bye",
    "bye",
    "goodbye",
    "good bye",
    
    # Subscribe/engagement hallucinations
    "please subscribe",
    "subscribe to my channel",
    "like and subscribe",
    "please like and subscribe",
    "don't forget to subscribe",
    "hit the subscribe button",
    "hit the like button",
    "leave a comment",
    "please leave a like",
    
    # Intro hallucinations
    "hey guys",
    "hi everyone",
    "hello everyone",
    "what's up guys",
    "whats up guys",
    "welcome back",
    "welcome to my channel",
    "hey what's up",
    
    # Podcast-style hallucinations
    "you've been listening to",
    "this has been",
    "that's all for today",
    "thats all for today",
    "that's it for today",
    "until next time",
    
    # Music/subtitle hallucinations
    "♪",
    "music",
    "music playing",
    "background music",
    "applause",
    "laughter",
    
    # Silence acknowledgment hallucinations
    "...",
    "silence",
    "no speech detected",
    
    # Foreign language hallucinations (common in English-mode)
    "ご視聴ありがとうございました",
    "字幕由",
    "字幕",
    "請不吝點讚",
    "訂閱",
    "谢谢观看",
    "감사합니다",
    "소리",
}

# Substring patterns - if the transcript CONTAINS any of these, it's likely hallucinated
HALLUCINATION_SUBSTRINGS = [
    "thanks for watching",
    "thank you for watching",
    "see you in the next video",
    "see you in the next one",
    "subscribe to my channel",
    "like and subscribe",
    "don't forget to subscribe",
    "hit the subscribe button",
    "welcome to my channel",
    "mozilafoundation",
    "mozilla foundation",
    "amara.org",
    "subtitles by",
    "captions by",
    "transcribed by",
]


def _normalize_text(text: str) -> str:
    """Normalize text for hallucination comparison: lowercase, strip punctuation."""
    text = text.lower().strip()
    # Remove common punctuation but keep apostrophes for contractions
    text = re.sub(r"[^\w\s']", "", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def is_hallucination(transcript: str, segments: List[Dict], audio_duration: float) -> Tuple[bool, str]:
    """
    Check if a Whisper transcript is likely a hallucination.
    
    Uses multiple heuristics (Research-backed: https://arxiv.org/abs/2501.11378):
    1. Exact phrase matching against known hallucination phrases
    2. Substring matching for partial hallucination patterns
    3. Confidence score analysis (low avg_logprob = suspicious)
    4. No-speech probability (high no_speech_prob = likely silence/noise)
    5. Duration mismatch (very short audio producing long text)
    6. Compression ratio check (repetitive text patterns)
    7. Word repetition detection (hallucinations often repeat words/phrases)
    
    Args:
        transcript: The full transcript text
        segments: List of segment dicts with confidence scores
        audio_duration: Duration of audio in seconds
    
    Returns:
        Tuple of (is_hallucination: bool, reason: str)
    """
    if not transcript or not transcript.strip():
        return False, ""  # Empty is not a hallucination, just silence
    
    normalized = _normalize_text(transcript)
    
    # 1. Exact phrase match
    if normalized in HALLUCINATION_PHRASES:
        return True, f"exact_match: '{normalized}'"
    
    # 2. Substring match
    for pattern in HALLUCINATION_SUBSTRINGS:
        if pattern in normalized:
            return True, f"substring_match: '{pattern}' in '{normalized}'"
    
    # 3. Segment-level confidence analysis
    if segments:
        avg_logprobs = [s.get("avg_logprob", 0) for s in segments if s.get("avg_logprob") is not None]
        no_speech_probs = [s.get("no_speech_prob", 0) for s in segments if s.get("no_speech_prob") is not None]
        
        # High no-speech probability across segments = likely hallucination
        if no_speech_probs:
            avg_no_speech = sum(no_speech_probs) / len(no_speech_probs)
            if avg_no_speech > 0.6:
                return True, f"high_no_speech_prob: {avg_no_speech:.3f}"
        
        # Very low confidence + short audio = likely hallucination
        if avg_logprobs and audio_duration < 3.0:
            avg_confidence = sum(avg_logprobs) / len(avg_logprobs)
            if avg_confidence < -1.0:
                return True, f"low_confidence_short_audio: logprob={avg_confidence:.3f}, duration={audio_duration:.2f}s"
    
    # 4. Duration mismatch: very short audio producing suspiciously long transcript
    # Real speech is roughly 2-3 words per second; hallucinations often produce more
    if audio_duration < 1.5:
        word_count = len(transcript.split())
        if word_count > 8:  # More than ~5 words/sec is suspicious for <1.5s audio
            return True, f"duration_mismatch: {word_count} words in {audio_duration:.2f}s audio"
    
    # 5. Compression ratio check (NEW): Detect highly repetitive text
    # Hallucinations often repeat the same word/phrase many times
    words = transcript.lower().split()
    if len(words) > 3:
        unique_words = len(set(words))
        compression_ratio = len(words) / unique_words
        if compression_ratio > 3.0:  # More than 3x repetition
            return True, f"high_compression_ratio: {compression_ratio:.2f} ({len(words)} words, {unique_words} unique)"
    
    # 6. Word repetition detection (NEW): Check for repeated bigrams/trigrams
    # Example hallucination: "thank you thank you thank you"
    if len(words) >= 4:
        bigrams = [f"{words[i]} {words[i+1]}" for i in range(len(words)-1)]
        bigram_counts = {}
        for bg in bigrams:
            bigram_counts[bg] = bigram_counts.get(bg, 0) + 1
        
        max_repetitions = max(bigram_counts.values()) if bigram_counts else 0
        if max_repetitions >= 3:  # Same 2-word phrase repeated 3+ times
            repeated_bigram = [bg for bg, count in bigram_counts.items() if count == max_repetitions][0]
            return True, f"repeated_phrase: '{repeated_bigram}' repeated {max_repetitions}x"
    
    return False, ""

# Global Whisper model instance (singleton pattern)
_whisper_model: Optional[WhisperModel] = None


def get_whisper_model() -> WhisperModel:
    """
    Get or initialize the Whisper model (singleton pattern).
    
    Loads the model once and reuses it across requests for efficiency.
    
    Returns:
        WhisperModel: Loaded Whisper model instance
        
    Raises:
        RuntimeError: If model fails to load
    """
    global _whisper_model
    
    if _whisper_model is None:
        logger.info(f"Loading Whisper model '{config.WHISPER_MODEL}' "
                   f"(device={config.WHISPER_DEVICE}, compute_type={config.WHISPER_COMPUTE_TYPE})")
        start_time = time.time()
        
        try:
            _whisper_model = WhisperModel(
                config.WHISPER_MODEL,
                device=config.WHISPER_DEVICE,
                compute_type=config.WHISPER_COMPUTE_TYPE,
                download_root=config.MODEL_CACHE_DIR
            )
            load_time = time.time() - start_time
            logger.info(f"Whisper model loaded successfully in {load_time:.2f}s")
            
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise RuntimeError(f"Failed to load Whisper model: {e}")
    
    return _whisper_model


def transcribe_audio(audio_data: np.ndarray, sample_rate: int) -> Dict[str, Any]:
    """
    Transcribe audio using Whisper model.
    
    Args:
        audio_data: Preprocessed audio as float32 numpy array
        sample_rate: Audio sample rate (should be 16000 for Whisper)
    
    Returns:
        Dictionary containing:
            - transcript: Full transcription text
            - segments: List of segments with timestamps and confidence scores
            - language: Detected language code
            - language_probability: Confidence of language detection
            - audio_duration: Length of audio in seconds
            - processing_time: Time taken to transcribe in seconds
            - real_time_factor: processing_time / audio_duration (lower is better)
    
    Raises:
        RuntimeError: If transcription fails
    """
    start_time = time.time()
    
    try:
        # Get model instance
        model = get_whisper_model()
        
        # Calculate audio duration
        audio_duration = len(audio_data) / sample_rate
        
        logger.info(f"Starting transcription: duration={audio_duration:.2f}s, "
                   f"sample_rate={sample_rate}Hz")
        
        # Transcribe with VAD filter to skip silence
        transcribe_start = time.time()
        
        # ENHANCED HALLUCINATION PREVENTION (Research-backed techniques)
        # Suppress tokens known to cause hallucinations (from research + your data)
        # Token IDs for common hallucination phrases (Whisper English tokenizer)
        suppress_tokens = [
            # "thanks for watching" variants
            11176, 329, 6355,  # thanks for watching
            50364, 50365,      # silence tokens
            # Add more token IDs as needed
        ]
        
        segments_generator, info = model.transcribe(
            audio_data,
            vad_filter=False,  # Disabled: Stage 4 WebRTC VAD already strips silence before Whisper
            beam_size=5,  # Restored: beam search helps accuracy on ambiguous/emotional speech
            language="en",  # Default to English (can be overridden by caller in future)
            condition_on_previous_text=False,  # Prevent hallucination chain reactions
            temperature=0.0,  # Greedy decoding (most confident predictions only)
            compression_ratio_threshold=2.4,  # Reject overly repetitive text
            logprob_threshold=-1.0,  # Stricter confidence threshold
            no_speech_threshold=0.6,  # Higher threshold for "no speech" detection
            # suppress_tokens=suppress_tokens,  # Uncomment if needed (experimental)
        )
        
        # Extract segments and build full transcript
        segments = []
        transcript_parts = []
        
        for segment in segments_generator:
            segment_dict = {
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip(),
                "confidence": round(segment.avg_logprob, 3) if hasattr(segment, 'avg_logprob') else None,
                "no_speech_prob": round(segment.no_speech_prob, 3) if hasattr(segment, 'no_speech_prob') else None,
                "avg_logprob": round(segment.avg_logprob, 3) if hasattr(segment, 'avg_logprob') else None,
            }
            segments.append(segment_dict)
            transcript_parts.append(segment.text.strip())
        
        transcript = " ".join(transcript_parts).strip()
        transcribe_time = time.time() - transcribe_start
        
        # ================================================================
        # HALLUCINATION DETECTION: Filter out known Whisper hallucinations
        # ================================================================
        hallucinated, reason = is_hallucination(transcript, segments, audio_duration)
        if hallucinated:
            logger.warning(
                f"HALLUCINATION DETECTED: '{transcript}' (reason: {reason}, "
                f"duration={audio_duration:.2f}s, segments={len(segments)})"
            )
            # Return empty transcript instead of hallucinated text
            transcript = ""
            # Keep segments for debugging but mark as filtered
            for seg in segments:
                seg["filtered_as_hallucination"] = True
        
        # Calculate processing metrics
        total_time = time.time() - start_time
        real_time_factor = total_time / audio_duration if audio_duration > 0 else 0
        
        result = {
            "transcript": transcript,
            "segments": segments,
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
            "audio_duration": round(audio_duration, 2),
            "processing_time": {
                "transcribe": round(transcribe_time, 3),
                "total": round(total_time, 3),
            },
            "real_time_factor": round(real_time_factor, 3),
            "hallucination_filtered": hallucinated,
        }
        
        if hallucinated:
            result["hallucination_reason"] = reason
        
        logger.info(
            f"Transcription complete: {len(transcript)} chars, "
            f"{len(segments)} segments, language={info.language}, "
            f"rtf={real_time_factor:.3f}, time={total_time:.3f}s"
            f"{f', FILTERED (hallucination: {reason})' if hallucinated else ''}"
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise RuntimeError(f"Transcription failed: {e}")


def preprocess_audio(audio_file: BinaryIO, filename: str = "audio") -> Tuple[np.ndarray, int]:
    """
    Preprocess audio file for Whisper transcription with enhanced noise reduction.
    
    Handles multiple audio formats (WAV, MP3, OGG, FLAC), converts to mono,
    resamples to 16kHz, applies advanced noise reduction and filtering,
    normalizes amplitude, and validates duration.
    
    Enhancement features:
    - Spectral noise reduction
    - Wiener filtering for background noise
    - High-pass filter to remove low-frequency rumble
    - Dynamic range compression
    
    Args:
        audio_file: Binary file-like object containing audio data
        filename: Name of the audio file (for error messages)
    
    Returns:
        Tuple of (audio_array, sample_rate):
            - audio_array: Numpy array of float32 audio samples normalized to [-1, 1]
            - sample_rate: Sample rate in Hz (should be 16000 for Whisper)
    
    Raises:
        ValueError: If audio format is unsupported, duration is invalid, or audio is corrupted
    """
    start_time = time.time()
    
    try:
        # Read audio file using soundfile (supports WAV, FLAC, OGG)
        # For MP3, librosa will handle it via audioread backend
        audio_bytes = audio_file.read()
        audio_file.seek(0)  # Reset for potential re-reading
        
        logger.info(f"Processing audio file '{filename}' ({len(audio_bytes)} bytes)")
        
        # Try soundfile first (fast, supports WAV/FLAC/OGG natively)
        try:
            audio_data, sample_rate = sf.read(io.BytesIO(audio_bytes), dtype='float32')
        except Exception as sf_error:
            logger.debug(f"soundfile failed, trying librosa: {sf_error}")
            # Fall back to librosa for MP3 and other formats
            audio_data, sample_rate = librosa.load(
                io.BytesIO(audio_bytes),
                sr=None,  # Preserve original sample rate initially
                mono=False,  # Preserve channels initially
                dtype=np.float32
            )
        
        # Convert stereo to mono if needed
        if len(audio_data.shape) > 1:
            if audio_data.shape[0] == 2:  # soundfile format: (channels, samples)
                audio_data = np.mean(audio_data, axis=0)
                logger.debug("Converted stereo to mono (soundfile format)")
            elif audio_data.shape[1] == 2:  # librosa format: (samples, channels)
                audio_data = np.mean(audio_data, axis=1)
                logger.debug("Converted stereo to mono (librosa format)")
        
        # Ensure 1D array
        audio_data = np.squeeze(audio_data)
        
        # ================================================================
        # OPTION 5: COMPLETE ADVANCED AUDIO PREPROCESSING PIPELINE
        # ================================================================
        # Three-stage enhancement for maximum accuracy:
        # Stage 1: Adaptive noise profiling and reduction
        # Stage 2: Signal filtering and enhancement
        # Stage 3: Dynamic range compression (RMS normalization)
        # Stage 4: VAD-based voice isolation
        # ================================================================
        
        # ----------------------------------------------------------------
        # STAGE 1: ADAPTIVE NOISE PROFILING
        # ----------------------------------------------------------------
        # Sample first 300ms as noise profile (captures room tone/background)
        # More accurate than blind noise reduction
        try:
            noise_sample_duration = min(0.3, len(audio_data) / sample_rate * 0.1)  # 300ms or 10% of audio
            noise_sample_length = int(sample_rate * noise_sample_duration)
            
            if noise_sample_length > 0:
                noise_profile = audio_data[:noise_sample_length]
                
                # Apply adaptive noise reduction using actual room noise
                audio_data = nr.reduce_noise(
                    y=audio_data,
                    sr=sample_rate,
                    y_noise=noise_profile,  # Use actual background as reference
                    stationary=True,  # Room noise is relatively consistent
                    prop_decrease=0.9,  # Aggressive reduction (90%)
                    freq_mask_smooth_hz=500,
                    time_mask_smooth_ms=50
                )
                logger.debug(f"Applied adaptive noise reduction (profiled {noise_sample_duration:.2f}s)")
            else:
                # Fallback to non-stationary if audio too short
                audio_data = nr.reduce_noise(
                    y=audio_data,
                    sr=sample_rate,
                    stationary=False,
                    prop_decrease=0.8
                )
                logger.debug("Applied non-stationary noise reduction (audio too short for profiling)")
        except Exception as e:
            logger.warning(f"Adaptive noise reduction failed, skipping: {e}")
        
        # ----------------------------------------------------------------
        # STAGE 2: SIGNAL FILTERING AND ENHANCEMENT
        # ----------------------------------------------------------------
        
        # 2A. Wiener filter (additional background noise reduction)
        try:
            audio_data = wiener(audio_data, mysize=5)
            logger.debug("Applied Wiener filter")
        except Exception as e:
            logger.warning(f"Wiener filter failed, skipping: {e}")
        
        # 2B. High-pass filter (remove low-frequency rumble < 80Hz)
        # Removes traffic noise, HVAC rumble, low-frequency hum
        try:
            nyquist = sample_rate / 2
            cutoff = 80  # Hz
            b, a = butter(4, cutoff / nyquist, btype='high')
            audio_data = filtfilt(b, a, audio_data)
            logger.debug("Applied high-pass filter (80Hz cutoff)")
        except Exception as e:
            logger.warning(f"High-pass filter failed, skipping: {e}")
        
        # ----------------------------------------------------------------
        # STAGE 3: DYNAMIC RANGE COMPRESSION (RMS NORMALIZATION)
        # ----------------------------------------------------------------
        # Normalize both peak and RMS levels for consistent volume
        # Helps with quiet speakers and varying microphone gain
        try:
            target_rms = 0.1  # Target RMS level
            current_rms = np.sqrt(np.mean(audio_data ** 2))
            
            if current_rms > 0.001:  # Avoid division by zero for silent audio
                # RMS normalization
                audio_data = audio_data * (target_rms / current_rms)
                
                # Peak normalization (ensure no clipping)
                max_abs = np.max(np.abs(audio_data))
                if max_abs > 0.95:  # If close to clipping
                    audio_data = audio_data * (0.95 / max_abs)
                
                logger.debug(f"Applied dynamic range compression (RMS: {current_rms:.4f} → {target_rms:.4f})")
            else:
                logger.warning(f"Audio too quiet for RMS normalization (RMS={current_rms:.6f})")
        except Exception as e:
            logger.warning(f"Dynamic range compression failed, skipping: {e}")
        
        # ================================================================
        # END OPTION 5 PREPROCESSING
        # ================================================================
        
        # ----------------------------------------------------------------
        # STAGE 4: VAD PRE-FILTERING (Voice Activity Detection)
        # ----------------------------------------------------------------
        # Remove non-speech segments BEFORE sending to Whisper
        # Prevents hallucinations on silence/noise by only transcribing speech
        try:
            vad = webrtcvad.Vad(3)  # Aggressiveness 3 (most strict, 0-3 scale)
            
            # Resample to 16kHz if needed (VAD requires 8k, 16k, 32k, or 48k Hz)
            if sample_rate != 16000:
                audio_data = librosa.resample(audio_data, orig_sr=sample_rate, target_sr=16000)
                sample_rate = 16000
                logger.debug("Resampled to 16kHz for VAD compatibility")
            
            # Convert float32 to int16 for VAD (required format)
            audio_int16 = (audio_data * 32767).astype(np.int16)
            
            # Process in 30ms frames (WebRTC VAD requirement)
            frame_duration_ms = 30
            frame_size = int(sample_rate * frame_duration_ms / 1000)  # 480 samples at 16kHz
            
            # Extract voice frames only
            voice_frames = []
            total_frames = 0
            voice_frames_count = 0
            
            for i in range(0, len(audio_int16) - frame_size, frame_size):
                frame = audio_int16[i:i + frame_size]
                total_frames += 1
                
                # Check if frame contains speech
                is_speech = vad.is_speech(frame.tobytes(), sample_rate)
                if is_speech:
                    voice_frames.append(frame)
                    voice_frames_count += 1
            
            # Reconstruct audio from voice frames only
            if voice_frames:
                audio_int16 = np.concatenate(voice_frames)
                audio_data = audio_int16.astype(np.float32) / 32767.0
                
                voice_percentage = (voice_frames_count / total_frames * 100) if total_frames > 0 else 0
                logger.info(f"VAD pre-filtering: {voice_frames_count}/{total_frames} frames ({voice_percentage:.1f}% speech)")
                
                # If almost no speech detected, log warning
                if voice_percentage < 5:
                    logger.warning(f"Low speech activity detected ({voice_percentage:.1f}%), audio may be mostly silence/noise")
            else:
                logger.warning("VAD detected no speech in audio, sending original")
                # Keep original audio_data if no speech detected
        
        except Exception as e:
            logger.warning(f"VAD pre-filtering failed, using full audio: {e}")
        
        # ================================================================
        # FINAL NORMALIZATION AND VALIDATION
        # ================================================================
        
        # Resample to 16kHz (Whisper's expected sample rate)
        target_sr = 16000
        if sample_rate != target_sr:
            logger.debug(f"Resampling from {sample_rate}Hz to {target_sr}Hz")
            audio_data = librosa.resample(
                audio_data,
                orig_sr=sample_rate,
                target_sr=target_sr,
                res_type='kaiser_fast'  # Fast, good quality resampling
            )
            sample_rate = target_sr
        
        # Normalize audio to [-1, 1] range (dynamic range compression)
        max_abs = np.max(np.abs(audio_data))
        if max_abs > 0:
            audio_data = audio_data / max_abs
            logger.debug(f"Normalized audio (max_abs={max_abs:.4f})")
        
        # Calculate audio duration
        duration = len(audio_data) / sample_rate
        
        # Validate duration
        if duration < config.MIN_AUDIO_DURATION:
            raise ValueError(
                f"Audio too short: {duration:.2f}s < minimum {config.MIN_AUDIO_DURATION}s"
            )
        
        if duration > config.MAX_AUDIO_DURATION:
            raise ValueError(
                f"Audio too long: {duration:.2f}s > maximum {config.MAX_AUDIO_DURATION}s"
            )
        
        # Check for silent audio (RMS < 0.001 threshold)
        rms = np.sqrt(np.mean(audio_data ** 2))
        if rms < 0.001:
            logger.warning(
                f"Audio appears to be silent or very quiet (RMS={rms:.6f}). "
                "Transcription may not produce useful results."
            )
        
        preprocess_time = time.time() - start_time
        logger.info(
            f"Audio preprocessing complete: duration={duration:.2f}s, "
            f"sample_rate={sample_rate}Hz, rms={rms:.4f}, "
            f"preprocessing_time={preprocess_time:.3f}s (with noise reduction)"
        )
        
        return audio_data, sample_rate
        
    except ValueError:
        # Re-raise validation errors as-is
        raise
    
    except Exception as e:
        logger.error(f"Failed to preprocess audio '{filename}': {e}")
        raise ValueError(
            f"Failed to process audio file '{filename}': {str(e)}. "
            f"Ensure file is a valid audio format (WAV, MP3, OGG, FLAC) and not corrupted."
        )
