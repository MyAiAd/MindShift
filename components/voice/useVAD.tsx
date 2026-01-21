'use client';

import { useEffect, useRef, useState } from 'react';

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
  
  return {
    isInitialized,
    error,
  };
};
