'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

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
}

/**
 * Voice Activity Detection hook
 * Monitors microphone input and detects when user is speaking
 * Uses @ricky0123/vad-web for WASM-based detection
 */
export const useVAD = ({
  enabled,
  sensitivity,
  onSpeechStart,
  onSpeechEnd,
  onVadLevel,
}: UseVADProps) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs to hold callback functions (prevents unnecessary re-initialization)
  const onSpeechStartRef = useRef(onSpeechStart);
  const onSpeechEndRef = useRef(onSpeechEnd);
  const onVadLevelRef = useRef(onVadLevel);
  
  // Ref to hold the VAD instance (MicVAD from @ricky0123/vad-web)
  const vadRef = useRef<any>(null);
  
  // Update callback refs when props change (without re-initializing VAD)
  useEffect(() => {
    onSpeechStartRef.current = onSpeechStart;
    onSpeechEndRef.current = onSpeechEnd;
    onVadLevelRef.current = onVadLevel;
  }, [onSpeechStart, onSpeechEnd, onVadLevel]);
  
  // Initialize and manage VAD lifecycle based on enabled state
  useEffect(() => {
    let mounted = true;
    
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
        return;
      }
      
      // Initialize VAD when enabled
      try {
        console.log('🎙️ VAD: Initializing with sensitivity:', sensitivity);
        
        // Dynamic import to avoid loading VAD until needed
        const { MicVAD } = await import('@ricky0123/vad-web');
        
        if (!mounted) return;
        
        // Configure VAD with sensitivity-based thresholds
        const positiveSpeechThreshold = sensitivity;
        const negativeSpeechThreshold = Math.max(0.1, sensitivity - 0.15); // 0.15 hysteresis
        
        const vad = await MicVAD.new({
          // Sensitivity thresholds
          positiveSpeechThreshold,
          negativeSpeechThreshold,
          
          // Timing parameters for responsiveness (in milliseconds)
          minSpeechMs: 150,          // Min duration to trigger speech (3 frames * 50ms)
          preSpeechPadMs: 50,        // Duration to include before speech (1 frame)
          redemptionMs: 400,         // Duration to wait before ending speech (8 frames * 50ms)
          
          // WASM configuration (single-threaded for compatibility)
          ortConfig: (ort: any) => {
            ort.env.wasm.numThreads = 1;
          },
          
          // Event handlers
          onSpeechStart: () => {
            console.log('🎙️ VAD: Speech started');
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
            
            onSpeechEndRef.current?.(audio);
          },
          
          onVADMisfire: () => {
            console.log('🎙️ VAD: Misfire detected (speech segment too short)');
          },
          
          onFrameProcessed: (probs: any, frame: Float32Array) => {
            // Calculate RMS level from frame for real-time meter
            let sum = 0;
            for (let i = 0; i < frame.length; i++) {
              sum += frame[i] * frame[i];
            }
            const rms = Math.sqrt(sum / frame.length);
            const level = Math.min(100, Math.round(rms * 500)); // Scale to 0-100
            
            // Call callback with calculated level
            onVadLevelRef.current?.(level);
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
          setError(err instanceof Error ? err.message : 'Failed to initialize VAD');
          setIsInitialized(false);
        }
      }
    };
    
    initVAD();
    
    // Cleanup on unmount or when enabled changes
    return () => {
      mounted = false;
      if (vadRef.current) {
        console.log('🎙️ VAD: Destroying instance (cleanup)');
        vadRef.current.destroy().catch(console.error);
        vadRef.current = null;
      }
    };
  }, [enabled, sensitivity]);
  
  // Control methods for VAD management
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
