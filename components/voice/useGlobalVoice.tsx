'use client';

import { useEffect, useState, useRef } from 'react';
import { useAccessibility } from '@/services/accessibility/accessibility.service';
import { useVoiceService } from '@/services/voice/voice.service';

interface GlobalVoiceOptions {
  onVoiceTranscript?: (transcript: string) => void;
  onAutoSpeak?: (text: string) => void;
  currentStep?: string;
  disabled?: boolean;
}

export const useGlobalVoice = ({
  onVoiceTranscript,
  onAutoSpeak,
  currentStep,
  disabled = false
}: GlobalVoiceOptions) => {
  const { preferences: accessibilityPrefs } = useAccessibility();
  const { preferences: voicePrefs, speak, startListening, stopListening, status } = useVoiceService();
  
  const [isGlobalListening, setIsGlobalListening] = useState(false);
  const [isAutoSpeaking, setIsAutoSpeaking] = useState(false);
  const listeningTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSpokenMessageRef = useRef<string>('');

  // Check if voice input is enabled globally via accessibility settings
  const isVoiceInputEnabled = voicePrefs.listeningEnabled && voicePrefs.speechEnabled;
  
  // Check if voice output is enabled globally via accessibility settings  
  const isVoiceOutputEnabled = voicePrefs.speechEnabled && voicePrefs.autoSpeak;

  // Global voice input - always listening when enabled
  useEffect(() => {
    if (!isVoiceInputEnabled || disabled || status.isListening) {
      return;
    }

    const startGlobalListening = async () => {
      try {
        setIsGlobalListening(true);
        const transcript = await startListening();
        
        if (transcript.trim() && onVoiceTranscript) {
          const processedTranscript = processTranscriptForContext(transcript.trim(), currentStep);
          onVoiceTranscript(processedTranscript);
        }
        
        // Restart listening after a brief pause (always listening mode)
        listeningTimeoutRef.current = setTimeout(() => {
          if (isVoiceInputEnabled && !disabled) {
            startGlobalListening();
          }
        }, 1000);
        
      } catch (error) {
        // Silent error handling - restart listening after longer pause
        listeningTimeoutRef.current = setTimeout(() => {
          if (isVoiceInputEnabled && !disabled) {
            startGlobalListening();
          }
        }, 3000);
      } finally {
        setIsGlobalListening(false);
      }
    };

    // Start listening with a small delay to avoid conflicts
    const initTimeout = setTimeout(startGlobalListening, 500);
    
    return () => {
      clearTimeout(initTimeout);
      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current);
      }
      stopListening();
    };
  }, [isVoiceInputEnabled, disabled, currentStep]);

  // Global voice output - auto-speak when enabled
  const speakGlobally = async (text: string, force = false) => {
    if (!isVoiceOutputEnabled || disabled || !text.trim()) {
      return;
    }

    // Avoid speaking the same message twice
    if (!force && lastSpokenMessageRef.current === text) {
      return;
    }

    try {
      setIsAutoSpeaking(true);
      const cleanText = cleanTextForSpeech(text);
      await speak(cleanText);
      lastSpokenMessageRef.current = text;
    } catch (error) {
      // Silent error handling
    } finally {
      setIsAutoSpeaking(false);
    }
  };

  // Process voice transcript based on current UI context
  const processTranscriptForContext = (transcript: string, step?: string): string => {
    const lowerTranscript = transcript.toLowerCase().trim();

    // Handle yes/no button contexts
    if (step === 'check_if_still_problem' || step?.includes('digging_deeper')) {
      if (lowerTranscript.includes('yes') && !lowerTranscript.includes('no')) {
        return 'yes';
      }
      if (lowerTranscript.includes('no') && !lowerTranscript.includes('yes')) {
        return 'no';
      }
      if (step?.includes('digging_deeper') && lowerTranscript.includes('maybe')) {
        return 'maybe';
      }
    }

    // Handle method selection context
    if (step === 'choose_method') {
      if (lowerTranscript.includes('problem shifting') || lowerTranscript.includes('problem')) {
        return 'Problem Shifting';
      }
      if (lowerTranscript.includes('identity shifting') || lowerTranscript.includes('identity')) {
        return 'Identity Shifting';
      }
      if (lowerTranscript.includes('belief shifting') || lowerTranscript.includes('belief')) {
        return 'Belief Shifting';
      }
      if (lowerTranscript.includes('blockage shifting') || lowerTranscript.includes('blockage')) {
        return 'Blockage Shifting';
      }
    }

    // For text input contexts, return transcript as-is
    return transcript;
  };

  // Clean text for better speech synthesis
  const cleanTextForSpeech = (text: string): string => {
    return text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/\bOK\b/gi, 'okay')
      .replace(/\bID\b/gi, 'I D')
      .replace(/\n/g, '. ')
      .replace(/\. \./g, '.')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current);
      }
      stopListening();
    };
  }, []);

  return {
    // Voice status
    isListening: status.isListening || isGlobalListening,
    isSpeaking: status.isSpeaking || isAutoSpeaking,
    voiceError: status.error,
    
    // Voice capabilities
    isVoiceInputEnabled,
    isVoiceOutputEnabled,
    
    // Functions
    speakGlobally,
    processTranscriptForContext,
    
    // Manual controls (for specific use cases)
    startManualListening: startListening,
    stopManualListening: stopListening,
  };
};

// Voice indicator is now handled inline within treatment session components 