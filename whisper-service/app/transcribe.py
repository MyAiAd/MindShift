"""
Audio preprocessing and transcription logic for Whisper service.

Handles audio file reading, format conversion, validation, and transcription.
"""

import io
import time
import logging
from typing import Tuple, BinaryIO, Dict, List, Any, Optional
import numpy as np
import soundfile as sf
import librosa
from faster_whisper import WhisperModel
from .config import config

logger = logging.getLogger(__name__)

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
        segments_generator, info = model.transcribe(
            audio_data,
            vad_filter=True,  # Voice Activity Detection to skip silence
            vad_parameters=dict(
                min_silence_duration_ms=500,  # Minimum silence duration to split
                threshold=0.5,  # VAD threshold
            ),
            beam_size=5,  # Balance between accuracy and speed
            language="en",  # Default to English (can be overridden by caller in future)
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
            }
            segments.append(segment_dict)
            transcript_parts.append(segment.text.strip())
        
        transcript = " ".join(transcript_parts).strip()
        transcribe_time = time.time() - transcribe_start
        
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
        }
        
        logger.info(
            f"Transcription complete: {len(transcript)} chars, "
            f"{len(segments)} segments, language={info.language}, "
            f"rtf={real_time_factor:.3f}, time={total_time:.3f}s"
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise RuntimeError(f"Transcription failed: {e}")


def preprocess_audio(audio_file: BinaryIO, filename: str = "audio") -> Tuple[np.ndarray, int]:
    """
    Preprocess audio file for Whisper transcription.
    
    Handles multiple audio formats (WAV, MP3, OGG, FLAC), converts to mono,
    resamples to 16kHz, normalizes amplitude, and validates duration.
    
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
        
        # Normalize audio to [-1, 1] range
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
            f"sample_rate={sample_rate}Hz, rms={rms:.4f}, time={preprocess_time:.3f}s"
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
