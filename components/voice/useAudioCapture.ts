'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { TranscriptionDomainContext } from '@/lib/voice/transcription-domain-context';

// ============================================================================
// CLIENT-SIDE WHISPER HALLUCINATION FILTER (backup for server-side filter)
// ============================================================================
// Whisper hallucinates these phrases when given silence/noise/short audio.
// This is a well-known issue: https://github.com/openai/whisper/discussions/928
// The server-side filter should catch most cases, but this is a safety net.
//
// Common patterns include English YouTube phrases AND non-English text
// (especially Welsh, Chinese, Japanese) from silence.
// ============================================================================
const HALLUCINATION_PHRASES = new Set([
  "thanks for watching",
  "thank you for watching",
  "thanks for watching and i'll see you in the next video",
  "see you in the next video",
  "i'll see you in the next video",
  "see you in the next one",
  "see you next time",
  "thanks for listening",
  "thank you for listening",
  "thank you very much",
  "thank you so much",
  "thank you",
  "bye bye",
  "goodbye",
  "please subscribe",
  "subscribe to my channel",
  "like and subscribe",
  "please like and subscribe",
  "hey guys",
  "hi everyone",
  "hello everyone",
  "welcome back",
  "welcome to my channel",
  "that's all for today",
  "until next time",
]);

const HALLUCINATION_SUBSTRINGS = [
  "thanks for watching",
  "thank you for watching",
  "see you in the next video",
  "see you in the next one",
  "subscribe to my channel",
  "like and subscribe",
  "don't forget to subscribe",
  "welcome to my channel",
  // Welsh hallucinations (extremely common from silence)
  "diolch yn fawr",
  "am wylio'r fideo",
  "am wylior fideo",
  // Other non-English substring markers
  "subtitles by",
  "captions by",
  "amara.org",
];

// Unicode ranges for scripts that should never appear in an English therapy session.
// Whisper commonly hallucinates CJK, Hangul, Arabic, Devanagari etc. from silence.
const NON_LATIN_SCRIPT_RE = /[\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\u0600-\u06FF\u0900-\u097F\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/;

// Welsh/Celtic diacritics + common hallucination word patterns.
// These appear when Whisper guesses Welsh from background noise.
const WELSH_HALLUCINATION_RE = /\b(diolch|fideo|wylio|gwylio|fawr|iawn|ffilm)\b/i;

function isLikelyHallucination(transcript: string): boolean {
  const normalized = transcript.toLowerCase().replace(/[^\w\s']/g, '').replace(/\s+/g, ' ').trim();
  
  // Exact match
  if (HALLUCINATION_PHRASES.has(normalized)) return true;
  
  // Substring match
  for (const pattern of HALLUCINATION_SUBSTRINGS) {
    if (normalized.includes(pattern)) return true;
  }
  
  // Non-Latin script detection (CJK, Hangul, Arabic, Devanagari, etc.)
  if (NON_LATIN_SCRIPT_RE.test(transcript)) return true;
  
  // Welsh hallucination pattern (Whisper's most common non-English artifact)
  if (WELSH_HALLUCINATION_RE.test(transcript)) return true;
  
  return false;
}

interface UseAudioCaptureProps {
  enabled: boolean;
  onTranscript: (transcript: string) => void;
  onProcessingChange?: (isProcessing: boolean) => void; // Notify parent of processing state changes
  vadTrigger?: boolean; // External VAD can trigger transcription
  /**
   * Monotonically-increasing counter that the parent (useNaturalVoice) bumps every time the VAD
   * reports `onSpeechStart`. When vadAvailable=true, processAudioBuffer will refuse to upload
   * unless this has advanced since the last successful upload. Prevents silence/ambient audio
   * being uploaded to OpenAI STT.
   */
  speechDetectedTrigger?: number;
  /**
   * Whether the VAD is initialized and actually producing speech-start signals. If false, the
   * hook falls back to the legacy auto-process timer (the pre-US-001 safety-net behaviour).
   */
  vadAvailable?: boolean;
  /** Latest session context for Whisper domain bias (expectedResponseType, step, hotwords). */
  getTranscriptionContext?: () => TranscriptionDomainContext | null;
  treatmentVersion?: string;
  transcriptionProviderOverride?: 'existing' | 'openai';
  onProviderError?: (details: { kind: 'stt'; provider: 'openai' | 'existing'; message: string }) => void;
}

type ExtendedAudioConstraints = MediaTrackConstraints & {
  voiceIsolation?: boolean;
  suppressLocalAudioPlayback?: boolean;
};

export const useAudioCapture = ({
  enabled,
  onTranscript,
  onProcessingChange,
  vadTrigger,
  speechDetectedTrigger,
  vadAvailable,
  getTranscriptionContext,
  treatmentVersion,
  transcriptionProviderOverride,
  onProviderError,
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

  // US-001: VAD-gated upload flag. When true, the VAD has reported speech since the last
  // successful upload / buffer clear. processAudioBuffer refuses to POST when this is false
  // and vadAvailable=true, so silent-room ambient audio never reaches OpenAI STT.
  const hasSpeechSinceLastProcessRef = useRef(false);
  // Ensure we log `stt_vad_unavailable_fallback` only once per hook mount.
  const loggedVadUnavailableFallbackRef = useRef(false);
  // Snapshot vadAvailable for async callbacks so we don't trip the gate with a stale closure.
  const vadAvailableRef = useRef<boolean | undefined>(vadAvailable);
  useEffect(() => {
    vadAvailableRef.current = vadAvailable;
  }, [vadAvailable]);
  
  // Echo prevention: Track when AI is speaking to avoid capturing its own voice
  const isAISpeakingRef = useRef(false);
  const enabledRef = useRef(enabled);
  
  // Keep enabled ref in sync
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  
  // Keep callback refs current to avoid stale closures in async operations
  const onTranscriptRef = useRef(onTranscript);
  const onProcessingChangeRef = useRef(onProcessingChange);
  const getTranscriptionContextRef = useRef(getTranscriptionContext);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onProcessingChangeRef.current = onProcessingChange;
    getTranscriptionContextRef.current = getTranscriptionContext;
  }, [onTranscript, onProcessingChange, getTranscriptionContext]);
  
  // Configuration - TUNED for responsive speech capture
  const BUFFER_DURATION_MS = 8000;   // Keep last 8 seconds (safety margin for longer utterances)
  const SAMPLE_RATE = 16000;          // 16kHz (Whisper optimal)
  const MIN_PROCESS_INTERVAL_MS = 300; // Throttle: max once per 300ms (down from 1000ms)
  // Legacy auto-process cadence. The unconditional timer was removed in US-001; it now only
  // runs as a safety-net when the VAD is unavailable (see effect below).
  const AUTO_PROCESS_INTERVAL_MS = 1500;

  // US-001: raise the speech-detected flag whenever the parent bumps the trigger counter. The
  // flag is lowered again after each successful processAudioBuffer call and on clearBuffer().
  useEffect(() => {
    if (speechDetectedTrigger === undefined) return;
    if (speechDetectedTrigger <= 0) return;
    hasSpeechSinceLastProcessRef.current = true;
  }, [speechDetectedTrigger]);
  
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
    // ECHO PREVENTION: Don't process audio while AI is speaking
    // The buffer would contain the AI's own voice, producing phantom transcriptions
    if (isAISpeakingRef.current) {
      audioBufferRef.current = []; // Discard any AI voice that leaked in
      return;
    }
    
    // Throttle processing (unless bypassed for urgent triggers)
    if (!bypassThrottle) {
      const now = Date.now();
      if (now - lastProcessTimeRef.current < MIN_PROCESS_INTERVAL_MS) {
        return;
      }
    }

    // US-001 VAD UPLOAD GATE: only POST /api/transcribe when the VAD has detected real speech
    // since the last successful upload. `bypassThrottle=true` is reserved for processNow() —
    // PTT release and VAD speech-end — and those triggers skip the gate deliberately.
    // When vadAvailable is false (or explicitly disabled) we keep the pre-US-001 behaviour so
    // non-VAD environments still function as a safety-net.
    if (!bypassThrottle && vadAvailableRef.current && !hasSpeechSinceLastProcessRef.current) {
      return;
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
    // US-001: lower the VAD-gate flag. A subsequent upload requires a new speech-start event.
    // Reset here (not in the finally block) so any VAD onSpeechStart that fires while this
    // fetch is in-flight is correctly captured as "new speech since last process".
    hasSpeechSinceLastProcessRef.current = false;
    
    // Track concurrent requests for UI state
    activeRequestsRef.current++;
    setIsProcessing(true);
    onProcessingChangeRef.current?.(true);
    
    try {
      const wavBlob = createWavBlob(bufferSnapshot);
      console.log(`🎙️ AudioCapture: Processing ${(wavBlob.size / 1024).toFixed(1)}KB of audio (${activeRequestsRef.current} in-flight)`);

      const ctx = getTranscriptionContextRef.current?.() ?? null;
      const formData = new FormData();
      formData.append('audio', wavBlob, 'audio.wav');
      if (ctx?.expectedResponseType) {
        formData.append('expected_response_type', ctx.expectedResponseType);
      }
      if (ctx?.currentStep) {
        formData.append('current_step', ctx.currentStep);
      }
      if (ctx?.hotwords) {
        formData.append('hotwords', ctx.hotwords.slice(0, 500));
      }
      if (treatmentVersion) {
        formData.append('treatment_version', treatmentVersion);
      }
      if (transcriptionProviderOverride) {
        formData.append('provider', transcriptionProviderOverride);
      }

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        let errorText = 'Unknown error';
        let provider: 'openai' | 'existing' | null = null;
        try {
          const errorData = await response.json();
          errorText = errorData.message || errorData.error || 'Unknown error';
          provider = errorData.provider || null;
          if (errorData.code === 'stt_provider_failure' && provider) {
            onProviderError?.({
              kind: 'stt',
              provider,
              message: errorText,
            });
          }
        } catch {
          errorText = await response.text().catch(() => 'Unknown error');
        }
        throw new Error(`Transcription failed (${response.status}): ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.transcript && data.transcript.trim()) {
        // GUARD: Don't deliver transcript if capture was disabled or AI started speaking
        // during the in-flight Whisper request. This prevents phantom transcriptions
        // from completing API calls after mic disable or during AI speech.
        if (!enabledRef.current || isAISpeakingRef.current) {
          console.log('🎙️ AudioCapture: Discarding transcript (disabled or AI speaking):', data.transcript);
          return;
        }
        
        // HALLUCINATION FILTER: Check for known Whisper hallucination phrases
        // The server should catch most, but this is a client-side safety net
        if (data.hallucination_filtered || isLikelyHallucination(data.transcript)) {
          console.log('🎙️ AudioCapture: Filtered hallucination:', data.transcript, 
            data.hallucination_reason ? `(server: ${data.hallucination_reason})` : '(client-side filter)');
          return;
        }
        
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
  }, [createWavBlob, onProviderError, transcriptionProviderOverride, treatmentVersion]);
  
  /**
   * Process audio immediately, bypassing the throttle.
   * Use for barge-in and VAD speech-end triggers where latency matters.
   */
  const processNow = useCallback(() => {
    processAudioBuffer(true);
  }, [processAudioBuffer]);

  /**
   * Request microphone with progressively simpler constraints.
   * Mobile PWAs (especially iOS) can reject advanced/exact constraints.
   */
  const requestMicrophoneStream = useCallback(async (): Promise<MediaStream> => {
    const enhancedConstraints: ExtendedAudioConstraints = {
      channelCount: 1,
      sampleRate: SAMPLE_RATE,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      voiceIsolation: true, // iOS 16.4+ where available
      suppressLocalAudioPlayback: true,
    };

    const fallbackProfiles: MediaStreamConstraints[] = [
      {
        audio: {
          ...enhancedConstraints,
          // Request best-effort advanced features (not exact) for compatibility.
          advanced: [
            {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          ],
        },
      },
      {
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      },
      { audio: true },
    ];

    let lastError: unknown = null;
    for (let i = 0; i < fallbackProfiles.length; i++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(fallbackProfiles[i]);
        if (i > 0) {
          console.log(`🎙️ AudioCapture: Microphone initialized using fallback profile ${i + 1}/${fallbackProfiles.length}`);
        }
        return stream;
      } catch (err) {
        lastError = err;
        console.warn(`🎙️ AudioCapture: Mic profile ${i + 1} failed, trying fallback`, err);
      }
    }

    throw (lastError instanceof Error ? lastError : new Error('Failed to initialize microphone'));
  }, []);
  
  /**
   * Initialize audio capture pipeline:
   * Microphone → AudioContext → AudioWorklet → Buffer
   */
  const initializeCapture = useCallback(async () => {
    if (!enabled) return;
    
    try {
      console.log('🎙️ AudioCapture: Initializing...');
      
      // Request microphone access with compatibility fallback profiles.
      const stream = await requestMicrophoneStream();
      
      mediaStreamRef.current = stream;
      
      // Create audio context at Whisper's optimal sample rate
      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;

      // iOS/Safari may start suspended even after user granted mic.
      if (audioContext.state === 'suspended') {
        try {
          await audioContext.resume();
        } catch (resumeError) {
          console.warn('🎙️ AudioCapture: AudioContext resume warning:', resumeError);
        }
      }
      
      // Load audio worklet processor (runs on separate thread)
      await audioContext.audioWorklet.addModule('/audio-capture-processor.js');
      
      // Create worklet node
      const workletNode = new AudioWorkletNode(audioContext, 'audio-capture-processor');
      workletNodeRef.current = workletNode;
      
      // Handle audio data from worklet
      workletNode.port.onmessage = (event) => {
        const audioData = event.data.audioData as Float32Array;
        
        // ECHO PREVENTION: Don't buffer audio while AI is speaking
        // This prevents the AI's own voice from entering the buffer
        if (isAISpeakingRef.current) return;
        
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
      console.log('🎙️ AudioCapture: Initialized successfully (buffer: 8s, uploads gated on VAD speech-start)');
      
    } catch (err) {
      console.error('🎙️ AudioCapture: Initialization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize');
      setIsCapturing(false);
    }
  }, [enabled, requestMicrophoneStream]);
  
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
  
  // US-001: The unconditional auto-process timer has been removed. Uploads are now driven by
  // VAD speech-end (via processNow) and PTT release. The timer below only runs as a safety
  // net when the VAD is unavailable (vadAvailable=false), restoring the pre-US-001 behaviour
  // for environments where VAD couldn't initialize.
  useEffect(() => {
    if (!isCapturing) return;
    if (vadAvailable) return; // VAD-gated mode: no timer. processNow() flushes uploads.

    if (!loggedVadUnavailableFallbackRef.current) {
      console.warn('🎙️ AudioCapture: stt_vad_unavailable_fallback - VAD not available, using legacy auto-process timer');
      loggedVadUnavailableFallbackRef.current = true;
    }

    const interval = setInterval(() => {
      if (audioBufferRef.current.length > 0 && !isAISpeakingRef.current) {
        processAudioBuffer();
      }
    }, AUTO_PROCESS_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isCapturing, vadAvailable, processAudioBuffer]);
  
  /**
   * Notify audio capture that AI is speaking (echo prevention).
   * When true: clears buffer and prevents new audio from being buffered/processed.
   * When false: resumes normal capture.
   */
  const setAISpeaking = useCallback((speaking: boolean) => {
    const wasAISpeaking = isAISpeakingRef.current;
    isAISpeakingRef.current = speaking;
    if (speaking && !wasAISpeaking) {
      // Clear buffer when AI starts speaking - discard any captured audio
      audioBufferRef.current = [];
      console.log('🎙️ AudioCapture: AI speaking - buffer cleared, capture paused');
    } else if (!speaking && wasAISpeaking) {
      console.log('🎙️ AudioCapture: AI stopped speaking - capture resumed');
    }
  }, []);
  
  /**
   * Clear the audio buffer immediately.
   * Used during barge-in to discard mixed AI+user audio.
   */
  const clearBuffer = useCallback(() => {
    audioBufferRef.current = [];
    // US-001: buffer was discarded, so any previously-detected speech is no longer
    // represented. Require a fresh VAD speech-start before the next upload.
    hasSpeechSinceLastProcessRef.current = false;
    console.log('🎙️ AudioCapture: Buffer cleared');
  }, []);
  
  return {
    isCapturing,
    isProcessing,
    error,
    processNow, // Manual trigger (bypasses throttle)
    setAISpeaking, // Echo prevention: pause capture during AI speech
    clearBuffer, // Discard buffered audio
  };
};
