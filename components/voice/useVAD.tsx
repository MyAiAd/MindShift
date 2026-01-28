'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

/**
 * Props for the useVAD hook
 */
export interface UseVADProps {
  /** Whether VAD should be enabled and running */
  enabled: boolean;
  /** Detection sensitivity (0.1-0.9, where higher = more sensitive) */
  sensitivity: number;
  /** Callback when speech is detected starting */
  onSpeechStart?: () => void;
  /** Callback when speech is detected ending */
  onSpeechEnd?: (audio: Float32Array) => void;
  /** Callback for real-time VAD level updates (0-100) */
  onVadLevel?: (level: number) => void;
  /** End-of-speech timeout in milliseconds */
  endOfSpeechTimeoutMs?: number;
  /** Mid-speech pause tolerance in milliseconds */
  midSpeechPauseToleranceMs?: number;
}

/**
 * Voice Activity Detection hook
 * 
 * Monitors microphone input and detects when user is speaking using WASM-based VAD.
 * Provides real-time audio level updates and speech detection callbacks.
 * 
 * @example
 * ```tsx
 * const vad = useVAD({
 *   enabled: isMicEnabled && isSpeakerEnabled,
 *   sensitivity: 0.5, // 0.1 (least) to 0.9 (most sensitive)
 *   onSpeechStart: () => console.log('Speech started'),
 *   onVadLevel: (level) => setVadLevel(level), // 0-100
 * });
 * 
 * if (vad.error) {
 *   console.error('VAD error:', vad.error);
 * }
 * ```
 * 
 * @param props - Configuration options for VAD
 * @returns Object containing VAD state and control methods
 */
export const useVAD = ({
  enabled,
  sensitivity,
  onSpeechStart,
  onSpeechEnd,
  onVadLevel,
  endOfSpeechTimeoutMs,
  midSpeechPauseToleranceMs,
}: UseVADProps) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs to hold callback functions (prevents unnecessary re-initialization)
  const onSpeechStartRef = useRef(onSpeechStart);
  const onSpeechEndRef = useRef(onSpeechEnd);
  const onVadLevelRef = useRef(onVadLevel);
  
  // Ref to hold the VAD instance (MicVAD from @ricky0123/vad-web)
  const vadRef = useRef<any>(null);
  
  // Debounce timer ref for VAD level updates
  const vadLevelTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastVadLevelRef = useRef<number>(0);
  
  // Speech end timing refs (for configurable end-of-speech timeout)
  const speechEndTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSpeechAudioRef = useRef<Float32Array | null>(null);
  
  // Debounced VAD level update function (100ms debounce)
  const debouncedVadLevelUpdate = useMemo(() => {
    return (level: number) => {
      lastVadLevelRef.current = level;
      
      // Clear existing timer
      if (vadLevelTimerRef.current) {
        clearTimeout(vadLevelTimerRef.current);
      }
      
      // Set new timer
      vadLevelTimerRef.current = setTimeout(() => {
        onVadLevelRef.current?.(lastVadLevelRef.current);
      }, 100); // 100ms debounce
    };
  }, []);
  
  // Update callback refs when props change (without re-initializing VAD)
  useEffect(() => {
    onSpeechStartRef.current = onSpeechStart;
    onSpeechEndRef.current = onSpeechEnd;
    onVadLevelRef.current = onVadLevel;
  }, [onSpeechStart, onSpeechEnd, onVadLevel]);
  
  // Initialize and manage VAD lifecycle based on enabled state
  useEffect(() => {
    let mounted = true;
    
    const pauseToleranceMs = Math.max(0, midSpeechPauseToleranceMs ?? 400);
    const endOfSpeechMs = Math.max(pauseToleranceMs, endOfSpeechTimeoutMs ?? pauseToleranceMs);
    const endOfSpeechDelayMs = Math.max(0, endOfSpeechMs - pauseToleranceMs);
    
    const clearSpeechEndTimer = (clearPendingAudio: boolean) => {
      if (speechEndTimerRef.current) {
        clearTimeout(speechEndTimerRef.current);
        speechEndTimerRef.current = null;
      }
      if (clearPendingAudio) {
        pendingSpeechAudioRef.current = null;
      }
    };
    
    const mergeSpeechAudio = (first: Float32Array, second: Float32Array) => {
      const merged = new Float32Array(first.length + second.length);
      merged.set(first, 0);
      merged.set(second, first.length);
      return merged;
    };
    
    const scheduleSpeechEnd = (audio: Float32Array) => {
      if (!mounted) return;
      
      const pendingAudio = pendingSpeechAudioRef.current;
      pendingSpeechAudioRef.current = pendingAudio ? mergeSpeechAudio(pendingAudio, audio) : audio;
      
      if (speechEndTimerRef.current) {
        clearTimeout(speechEndTimerRef.current);
      }
      
      if (endOfSpeechDelayMs === 0) {
        const finalAudio = pendingSpeechAudioRef.current;
        pendingSpeechAudioRef.current = null;
        if (mounted && finalAudio) {
          onSpeechEndRef.current?.(finalAudio);
        }
        return;
      }
      
      speechEndTimerRef.current = setTimeout(() => {
        speechEndTimerRef.current = null;
        const finalAudio = pendingSpeechAudioRef.current;
        pendingSpeechAudioRef.current = null;
        
        if (mounted && finalAudio) {
          onSpeechEndRef.current?.(finalAudio);
        }
      }, endOfSpeechDelayMs);
    };
    
    const initVAD = async () => {
      if (!enabled) {
        // Clean up if disabled
        if (vadRef.current) {
          console.log('🎙️ VAD: Destroying instance (disabled)');
          try {
            await vadRef.current.destroy();
          } catch (e) {
            console.error('VAD destroy error:', e);
          }
          vadRef.current = null;
          setIsInitialized(false);
        }
        clearSpeechEndTimer(true);
        return;
      }
      
      // Destroy existing VAD instance if sensitivity changed
      if (vadRef.current && isInitialized) {
        console.log('🎙️ VAD: Destroying existing instance to apply new sensitivity');
        try {
          await vadRef.current.destroy();
          vadRef.current = null;
          setIsInitialized(false);
          clearSpeechEndTimer(true);
        } catch (e) {
          console.error('VAD destroy error during re-init:', e);
        }
      }
      
      // Initialize VAD when enabled
      try {
        console.log('🎙️ VAD: Initializing with sensitivity:', sensitivity);
        
        // Check for browser compatibility
        if (typeof window === 'undefined') {
          throw new Error('VAD requires browser environment');
        }
        
        // Check for WebAssembly support
        if (typeof WebAssembly === 'undefined') {
          throw new Error('Browser does not support WebAssembly');
        }
        
        // Check for microphone API
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Browser does not support microphone access');
        }
        
        // Dynamic import to avoid loading VAD until needed
        const { MicVAD } = await import('@ricky0123/vad-web');
        
        if (!mounted) return;
        
        // Configure VAD with sensitivity-based thresholds
        // IMPORTANT: Invert the sensitivity value for intuitive behavior
        // - High UI sensitivity (0.8) → Low threshold (0.2) = MORE sensitive (detects quieter speech)
        // - Low UI sensitivity (0.2) → High threshold (0.7) = LESS sensitive (needs louder speech)
        // Map to narrower band (0.25-0.75 instead of 0.1-0.9) to avoid extremes
        const invertedSensitivity = 1.0 - sensitivity;
        const minThreshold = 0.25; // More forgiving minimum
        const maxThreshold = 0.75; // Less strict maximum
        const thresholdRange = maxThreshold - minThreshold;
        const positiveSpeechThreshold = minThreshold + (invertedSensitivity * thresholdRange);
        const negativeSpeechThreshold = Math.max(0.05, positiveSpeechThreshold - 0.15); // 0.15 hysteresis
        
        console.log('🎙️ VAD: Configuring thresholds:', {
          uiSensitivity: sensitivity,
          invertedSensitivity,
          positiveSpeechThreshold: positiveSpeechThreshold.toFixed(3),
          negativeSpeechThreshold: negativeSpeechThreshold.toFixed(3),
          endOfSpeechMs,
          pauseToleranceMs,
          explanation: `UI ${sensitivity.toFixed(2)} → Threshold ${positiveSpeechThreshold.toFixed(3)} (${sensitivity >= 0.7 ? 'Very Sensitive' : sensitivity >= 0.5 ? 'Sensitive' : 'Less Sensitive'})`
        });
        
        const vad = await MicVAD.new({
          // Asset paths - where to load VAD models and WASM files from
          baseAssetPath: '/vad/',           // Path to VAD models (silero_vad_legacy.onnx)
          onnxWASMBasePath: '/vad/',        // Path to ONNX Runtime WASM files
          
          // Sensitivity thresholds
          positiveSpeechThreshold,
          negativeSpeechThreshold,
          
          // Timing parameters for responsiveness (in milliseconds)
          minSpeechMs: 150,          // Min duration to trigger speech (3 frames * 50ms)
          preSpeechPadMs: 50,        // Duration to include before speech (1 frame)
          redemptionMs: pauseToleranceMs, // Duration to wait before ending speech
          
          // WASM configuration (single-threaded for compatibility)
          ortConfig: (ort: any) => {
            ort.env.wasm.numThreads = 1;
          },
          
          // Event handlers
          onSpeechStart: () => {
            console.log('🎙️ VAD: Speech started');
            clearSpeechEndTimer(false);
            onSpeechStartRef.current?.();
          },
          
          onSpeechEnd: (audio: Float32Array) => {
            console.log('🎙️ VAD: Speech ended, audio samples:', audio.length);
            
            // Calculate RMS (Root Mean Square) audio level from audio data
            let sum = 0;
            for (let i = 0; i < audio.length; i++) {
              sum += audio[i] * audio[i];
            }
            const rms = Math.sqrt(sum / audio.length);
            const level = Math.min(100, Math.round(rms * 500)); // Scale to 0-100
            console.log('🎙️ VAD: Audio level:', level);
            
            scheduleSpeechEnd(audio);
          },
          
          onVADMisfire: () => {
            console.log('🎙️ VAD: Misfire detected (speech segment too short)');
          },
          
          onFrameProcessed: (probs: any, frame: Float32Array) => {
            // Log speech probability for debugging (throttled)
            if (Math.random() < 0.01) { // Log ~1% of frames to avoid spam
              console.log('🎙️ VAD: Speech probability:', probs.isSpeech.toFixed(3), 'Threshold:', positiveSpeechThreshold);
            }
            
            // Calculate RMS level from frame for real-time meter
            let sum = 0;
            for (let i = 0; i < frame.length; i++) {
              sum += frame[i] * frame[i];
            }
            const rms = Math.sqrt(sum / frame.length);
            const level = Math.min(100, Math.round(rms * 500)); // Scale to 0-100
            
            // Use debounced update to reduce re-renders
            debouncedVadLevelUpdate(level);
          },
        });
        
        if (!mounted) {
          await vad.destroy();
          return;
        }
        
        vadRef.current = vad;
        setIsInitialized(true);
        setError(null);
        console.log('🎙️ VAD: Initialized successfully');
        
      } catch (err) {
        console.error('🎙️ VAD: Initialization error:', err);
        if (mounted) {
          // Provide descriptive error messages based on error type
          let errorMessage = 'Failed to initialize voice detection';
          
          if (err instanceof Error) {
            const errMsg = err.message.toLowerCase();
            
            if (errMsg.includes('webassembly')) {
              errorMessage = 'Browser does not support required technology (WebAssembly)';
            } else if (errMsg.includes('microphone') || errMsg.includes('mediadevices')) {
              errorMessage = 'Microphone access lost or unavailable';
            } else if (errMsg.includes('network') || errMsg.includes('fetch') || errMsg.includes('load')) {
              errorMessage = 'Failed to download voice detection model';
            } else if (errMsg.includes('permission')) {
              errorMessage = 'Microphone permission denied';
            } else {
              errorMessage = `Voice detection error: ${err.message}`;
            }
          }
          
          setError(errorMessage);
          setIsInitialized(false);
          
          // Log full error for debugging but don't crash the app
          console.error('🎙️ VAD: Detailed error:', err);
        }
      }
    };
    
    initVAD();
    
    // Cleanup on unmount or when enabled changes
    return () => {
      mounted = false;
      
      // Clear debounce timer
      if (vadLevelTimerRef.current) {
        clearTimeout(vadLevelTimerRef.current);
        vadLevelTimerRef.current = null;
      }
      
      clearSpeechEndTimer(true);
      
      if (vadRef.current) {
        console.log('🎙️ VAD: Destroying instance (cleanup)');
        vadRef.current.destroy().catch(console.error);
        vadRef.current = null;
      }
    };
  }, [enabled, sensitivity, debouncedVadLevelUpdate, endOfSpeechTimeoutMs, midSpeechPauseToleranceMs]);
  
  // Control methods for VAD management
  
  /**
   * Start VAD listening
   * Must be called after VAD is initialized
   * @throws Error if VAD not initialized
   */
  const startVAD = useCallback(async () => {
    if (!vadRef.current) {
      console.error('🎙️ VAD: Cannot start - not initialized');
      return;
    }
    
    try {
      await vadRef.current.start();
      console.log('🎙️ VAD: Started listening');
    } catch (err) {
      console.error('🎙️ VAD: Start error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start VAD');
    }
  }, []);
  
  /**
   * Pause VAD listening
   * Temporarily stops monitoring without destroying the instance
   * Used during speech recognition to avoid interference
   */
  const pauseVAD = useCallback(async () => {
    if (!vadRef.current) {
      console.error('🎙️ VAD: Cannot pause - not initialized');
      return;
    }
    
    try {
      await vadRef.current.pause();
      console.log('🎙️ VAD: Paused listening');
    } catch (err) {
      console.error('🎙️ VAD: Pause error:', err);
      setError(err instanceof Error ? err.message : 'Failed to pause VAD');
    }
  }, []);
  
  /**
   * Destroy VAD instance
   * Cleans up all resources and resets state
   * Called automatically on unmount
   */
  const destroyVAD = useCallback(async () => {
    if (!vadRef.current) {
      console.error('🎙️ VAD: Cannot destroy - not initialized');
      return;
    }
    
    try {
      await vadRef.current.destroy();
      vadRef.current = null;
      setIsInitialized(false);
      console.log('🎙️ VAD: Destroyed successfully');
    } catch (err) {
      console.error('🎙️ VAD: Destroy error:', err);
      setError(err instanceof Error ? err.message : 'Failed to destroy VAD');
    }
  }, []);
  
  return {
    isInitialized,
    error,
    startVAD,
    pauseVAD,
    destroyVAD,
  };
};
