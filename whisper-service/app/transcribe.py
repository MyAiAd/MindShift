"""
Audio preprocessing and transcription logic for Whisper service.

Handles audio file reading, format conversion, validation, and transcription.
"""

import io
import time
import logging
from typing import Tuple, BinaryIO
import numpy as np
import soundfile as sf
import librosa
from .config import config

logger = logging.getLogger(__name__)


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
