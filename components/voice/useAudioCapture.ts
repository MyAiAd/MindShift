'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseAudioCaptureProps {
  enabled: boolean;
  onTranscript: (transcript: string) => void;
  onProcessingChange?: (isProcessing: boolean) => void; // Notify parent of processing state changes
  vadTrigger?: boolean; // External VAD can trigger transcription
}

export const useAudioCapture = ({
  enabled,
  onTranscript,
  onProcessingChange,
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
  const activeRequestsRef = useRef<number>(0); // Track concurrent API requests
  
  // Keep callback refs current to avoid stale closures in async operations
  const onTranscriptRef = useRef(onTranscript);
  const onProcessingChangeRef = useRef(onProcessingChange);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onProcessingChangeRef.current = onProcessingChange;
  }, [onTranscript, onProcessingChange]);
  
  // Configuration - TUNED for responsive speech capture
  const BUFFER_DURATION_MS = 8000;   // Keep last 8 seconds (up from 5 - more safety margin)
  const SAMPLE_RATE = 16000;          // 16kHz (Whisper optimal)
  const MIN_PROCESS_INTERVAL_MS = 300; // Throttle: max once per 300ms (down from 1000ms)
  const AUTO_PROCESS_INTERVAL_MS = 1500; // Auto-process every 1.5s (down from 3s)
  
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
   * Send audio buffer to Whisper for transcription.
   * 
   * Uses SNAPSHOT-AND-CLEAR pattern:
   * 1. Atomically snapshot current buffer and clear it
   * 2. New audio accumulates in the fresh buffer immediately
   * 3. Send snapshot to Whisper API
   * 4. Multiple calls can be in-flight concurrently (no blocking)
   * 
   * @param bypassThrottle - If true, skip the MIN_PROCESS_INTERVAL_MS throttle
   *                         (used for barge-in and VAD speech-end triggers)
   */
  const processAudioBuffer = useCallback(async (bypassThrottle = false) => {
    // Throttle processing (unless bypassed for urgent triggers)
    if (!bypassThrottle) {
      const now = Date.now();
      if (now - lastProcessTimeRef.current < MIN_PROCESS_INTERVAL_MS) {
        return;
      }
    }
    
    // Check if we have audio to process
    if (audioBufferRef.current.length === 0) {
      return;
    }
    
    lastProcessTimeRef.current = Date.now();
    
    // SNAPSHOT AND CLEAR: Atomically take current buffer and start fresh.
    // This is safe because JS is single-threaded: no audio worklet messages
    // can arrive between these two lines (they queue on the event loop).
    // New audio from the worklet will accumulate in the fresh empty buffer
    // while this batch is being sent to Whisper.
    const bufferSnapshot = audioBufferRef.current;
    audioBufferRef.current = [];
    
    // Track concurrent requests for UI state
    activeRequestsRef.current++;
    setIsProcessing(true);
    onProcessingChangeRef.current?.(true);
    
    try {
      const wavBlob = createWavBlob(bufferSnapshot);
      console.log(`🎙️ AudioCapture: Processing ${(wavBlob.size / 1024).toFixed(1)}KB of audio (${activeRequestsRef.current} in-flight)`);
      
      // Send to Whisper API
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: wavBlob,
        headers: {
          'Content-Type': 'audio/wav',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Transcription failed (${response.status}): ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.transcript && data.transcript.trim()) {
        console.log('🎙️ AudioCapture: Transcript:', data.transcript);
        onTranscriptRef.current(data.transcript.trim());
      } else {
        console.log('🎙️ AudioCapture: Empty transcript (likely silence)');
      }
      
    } catch (err) {
      console.error('🎙️ AudioCapture: Processing error:', err);
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      // Decrement active request counter
      activeRequestsRef.current = Math.max(0, activeRequestsRef.current - 1);
      if (activeRequestsRef.current === 0) {
        setIsProcessing(false);
        onProcessingChangeRef.current?.(false);
      }
    }
  }, [createWavBlob]);
  
  /**
   * Process audio immediately, bypassing the throttle.
   * Use for barge-in and VAD speech-end triggers where latency matters.
   */
  const processNow = useCallback(() => {
    processAudioBuffer(true);
  }, [processAudioBuffer]);
  
  /**
   * Initialize audio capture pipeline:
   * Microphone → AudioContext → AudioWorklet → Buffer
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
      
      // Create audio context at Whisper's optimal sample rate
      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;
      
      // Load audio worklet processor (runs on separate thread)
      await audioContext.audioWorklet.addModule('/audio-capture-processor.js');
      
      // Create worklet node
      const workletNode = new AudioWorkletNode(audioContext, 'audio-capture-processor');
      workletNodeRef.current = workletNode;
      
      // Handle audio data from worklet
      workletNode.port.onmessage = (event) => {
        const audioData = event.data.audioData as Float32Array;
        
        // Add to rolling buffer
        audioBufferRef.current.push(audioData);
        
        // Maintain buffer duration (remove oldest chunks when buffer exceeds max)
        const maxChunks = Math.ceil(BUFFER_DURATION_MS / (audioData.length / SAMPLE_RATE * 1000));
        while (audioBufferRef.current.length > maxChunks) {
          audioBufferRef.current.shift();
        }
      };
      
      // Connect audio pipeline: mic → worklet (don't connect to destination - no echo)
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(workletNode);
      
      setIsCapturing(true);
      setError(null);
      console.log('🎙️ AudioCapture: Initialized successfully (buffer: 8s, auto-process: 1.5s)');
      
    } catch (err) {
      console.error('🎙️ AudioCapture: Initialization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize');
      setIsCapturing(false);
    }
  }, [enabled]);
  
  /**
   * Cleanup audio capture: stop stream, close context, clear buffer
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
  
  // Process audio when external VAD triggers
  useEffect(() => {
    if (vadTrigger && isCapturing) {
      console.log('🎙️ AudioCapture: VAD trigger - processing audio immediately');
      processNow(); // Bypass throttle for VAD triggers
    }
  }, [vadTrigger, isCapturing, processNow]);
  
  // Auto-process timer
  // NOTE: No isProcessing gate! Concurrent API calls are safe because
  // each call snapshots its own portion of the buffer. The throttle
  // (MIN_PROCESS_INTERVAL_MS) prevents excessive API calls.
  useEffect(() => {
    if (!isCapturing) return;
    
    const interval = setInterval(() => {
      if (audioBufferRef.current.length > 0) {
        processAudioBuffer();
      }
    }, AUTO_PROCESS_INTERVAL_MS);
    
    return () => clearInterval(interval);
  }, [isCapturing, processAudioBuffer]);
  
  return {
    isCapturing,
    isProcessing,
    error,
    processNow, // Manual trigger (bypasses throttle)
  };
};
