'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseAudioCaptureProps {
  enabled: boolean;
  onTranscript: (transcript: string) => void;
  vadTrigger?: boolean; // External VAD can trigger transcription
}

export const useAudioCapture = ({
  enabled,
  onTranscript,
  vadTrigger,
}: UseAudioCaptureProps) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Refs for audio infrastructure
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const lastProcessTimeRef = useRef<number>(0);
  
  // Configuration
  const BUFFER_DURATION_MS = 5000; // Keep last 5 seconds
  const SAMPLE_RATE = 16000; // 16kHz (Whisper optimal)
  const MIN_PROCESS_INTERVAL_MS = 1000; // Don't process more than once per second
  const AUTO_PROCESS_INTERVAL_MS = 3000; // Auto-process every 3 seconds if speech detected
  
  /**
   * Convert Float32Array audio buffers to WAV blob
   */
  const createWavBlob = useCallback((audioBuffers: Float32Array[]): Blob => {
    // Concatenate all buffers
    const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
    const audioData = new Float32Array(totalLength);
    let offset = 0;
    for (const buffer of audioBuffers) {
      audioData.set(buffer, offset);
      offset += buffer.length;
    }
    
    // Convert Float32 to Int16 for WAV format
    const int16Data = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    
    // Create WAV file structure
    const wavBuffer = new ArrayBuffer(44 + int16Data.length * 2);
    const view = new DataView(wavBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + int16Data.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, SAMPLE_RATE, true);
    view.setUint32(28, SAMPLE_RATE * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(36, 'data');
    view.setUint32(40, int16Data.length * 2, true);
    
    // Audio data
    const audioView = new Int16Array(wavBuffer, 44);
    audioView.set(int16Data);
    
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }, []);
  
  /**
   * Send audio buffer to Whisper for transcription
   */
  const processAudioBuffer = useCallback(async () => {
    // Throttle processing
    const now = Date.now();
    if (now - lastProcessTimeRef.current < MIN_PROCESS_INTERVAL_MS) {
      console.log('🎙️ AudioCapture: Throttling - too soon since last process');
      return;
    }
    
    // Check if we have audio to process
    if (audioBufferRef.current.length === 0) {
      console.log('🎙️ AudioCapture: No audio to process');
      return;
    }
    
    lastProcessTimeRef.current = now;
    setIsProcessing(true);
    
    try {
      // Create WAV blob from buffer
      const wavBlob = createWavBlob(audioBufferRef.current);
      console.log(`🎙️ AudioCapture: Processing ${(wavBlob.size / 1024).toFixed(1)}KB of audio`);
      
      // Clear buffer after capturing (so we don't re-process same audio)
      audioBufferRef.current = [];
      
      // Send to API
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: wavBlob,
        headers: {
          'Content-Type': 'audio/wav',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.transcript && data.transcript.trim()) {
        console.log('🎙️ AudioCapture: Transcript:', data.transcript);
        onTranscript(data.transcript.trim());
      } else {
        console.log('🎙️ AudioCapture: Empty transcript (likely silence)');
      }
      
    } catch (err) {
      console.error('🎙️ AudioCapture: Processing error:', err);
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsProcessing(false);
    }
  }, [createWavBlob, onTranscript]);
  
  /**
   * Initialize audio capture
   */
  const initializeCapture = useCallback(async () => {
    if (!enabled) return;
    
    try {
      console.log('🎙️ AudioCapture: Initializing...');
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      mediaStreamRef.current = stream;
      
      // Create audio context
      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;
      
      // Load audio worklet processor
      await audioContext.audioWorklet.addModule('/audio-capture-processor.js');
      
      // Create worklet node
      const workletNode = new AudioWorkletNode(audioContext, 'audio-capture-processor');
      workletNodeRef.current = workletNode;
      
      // Handle audio data from worklet
      workletNode.port.onmessage = (event) => {
        const audioData = event.data.audioData as Float32Array;
        
        // Add to circular buffer
        audioBufferRef.current.push(audioData);
        
        // Maintain buffer duration (remove old chunks)
        const maxChunks = Math.ceil(BUFFER_DURATION_MS / (audioData.length / SAMPLE_RATE * 1000));
        if (audioBufferRef.current.length > maxChunks) {
          audioBufferRef.current.shift();
        }
      };
      
      // Connect audio pipeline
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(workletNode);
      // Note: Don't connect to destination (we don't want to hear ourselves)
      
      setIsCapturing(true);
      setError(null);
      console.log('🎙️ AudioCapture: Initialized successfully');
      
    } catch (err) {
      console.error('🎙️ AudioCapture: Initialization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize');
      setIsCapturing(false);
    }
  }, [enabled]);
  
  /**
   * Cleanup audio capture
   */
  const cleanupCapture = useCallback(() => {
    console.log('🎙️ AudioCapture: Cleaning up...');
    
    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Clear worklet
    workletNodeRef.current = null;
    
    // Clear buffer
    audioBufferRef.current = [];
    
    setIsCapturing(false);
    console.log('🎙️ AudioCapture: Cleanup complete');
  }, []);
  
  // Initialize/cleanup on enabled state change
  useEffect(() => {
    if (enabled) {
      initializeCapture();
    } else {
      cleanupCapture();
    }
    
    return () => {
      cleanupCapture();
    };
  }, [enabled, initializeCapture, cleanupCapture]);
  
  // Process audio when VAD triggers
  useEffect(() => {
    if (vadTrigger && isCapturing && !isProcessing) {
      console.log('🎙️ AudioCapture: VAD trigger - processing audio');
      processAudioBuffer();
    }
  }, [vadTrigger, isCapturing, isProcessing, processAudioBuffer]);
  
  // Auto-process every N seconds
  useEffect(() => {
    if (!isCapturing) return;
    
    const interval = setInterval(() => {
      if (!isProcessing && audioBufferRef.current.length > 0) {
        console.log('🎙️ AudioCapture: Auto-processing audio buffer');
        processAudioBuffer();
      }
    }, AUTO_PROCESS_INTERVAL_MS);
    
    return () => clearInterval(interval);
  }, [isCapturing, isProcessing, processAudioBuffer]);
  
  return {
    isCapturing,
    isProcessing,
    error,
    processNow: processAudioBuffer, // Manual trigger
  };
};
