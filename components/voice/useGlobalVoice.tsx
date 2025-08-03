'use client';

import { useEffect, useState, useRef } from 'react';
import { useAccessibility } from '@/services/accessibility/accessibility.service';
import { useVoiceService } from '@/services/voice/voice.service';

interface GlobalVoiceOptions {
  onVoiceTranscript?: (transcript: string) => void;
  onAutoSpeak?: (text: string) => void;
  onError?: (error: string) => void;
  currentStep?: string;
  disabled?: boolean;
}

export const useGlobalVoice = ({
  onVoiceTranscript,
  onAutoSpeak,
  onError,
  currentStep,
  disabled = false
}: GlobalVoiceOptions) => {
  const { preferences: accessibilityPrefs } = useAccessibility();
  const { preferences: voicePrefs, speak, startListening, stopListening, status } = useVoiceService();
  
  const [isGlobalListening, setIsGlobalListening] = useState(false);
  const [isAutoSpeaking, setIsAutoSpeaking] = useState(false);
  const listeningTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSpokenMessageRef = useRef<string>('');
  const isStartingListening = useRef(false); // Prevent overlapping sessions
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  // Check if voice input is enabled globally via accessibility settings
  const isVoiceInputEnabled = voicePrefs.listeningEnabled;
  
  // Check if voice output is enabled globally via accessibility settings  
  const isVoiceOutputEnabled = voicePrefs.speechEnabled && voicePrefs.autoSpeak;

  // Global voice input - only when explicitly enabled  
  useEffect(() => {
    // Clear any existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    if (!isVoiceInputEnabled || disabled) {
      // Stop any ongoing listening
      isStartingListening.current = false;
      stopListening();
      
      // Clear restart callback to prevent unwanted restarts
      import('@/services/voice/voice.service').then(({ VoiceService }) => {
        const voiceService = VoiceService.getInstance();
        voiceService['restartCallback'] = null;
      });
      
      return;
    }

    const startGlobalListening = async () => {
      // Prevent overlapping sessions
      if (isStartingListening.current) {
        console.log('⚠️ Already starting listening, skipping...');
        return;
      }
      
      try {
        isStartingListening.current = true;
        setIsGlobalListening(true);
        
        // Set up restart callback for silence timeouts and recoverable errors
        const voiceService = (await import('@/services/voice/voice.service')).VoiceService.getInstance();
        voiceService['restartCallback'] = () => {
          console.log('🔄 Voice service requesting restart');
          console.log('Current state:', { isVoiceInputEnabled, disabled, isStartingListening: isStartingListening.current });
          
          // Force reset all states first
          voiceService.forceResetState();
          isStartingListening.current = false;
          
          if (isVoiceInputEnabled && !disabled) {
            // Add a delay to ensure complete cleanup
            setTimeout(() => {
              if (isVoiceInputEnabled && !disabled) {
                console.log('🔄 Attempting restart after cleanup...');
                console.log('Pre-restart state:', { isVoiceInputEnabled, disabled, isStartingListening: isStartingListening.current });
                
                // Double-check and reset the flag right before starting
                isStartingListening.current = false;
                startGlobalListening();
              } else {
                console.log('🚫 Restart cancelled - voice disabled during delay');
              }
            }, 500); // Even longer delay for complete cleanup
          } else {
            console.log('🚫 Restart blocked - voice disabled or invalid conditions:', { isVoiceInputEnabled, disabled });
          }
        };
        
        // Set up error callback for critical voice failures (like max retries reached)
        voiceService['errorCallback'] = (errorMessage: string) => {
          console.log('🚨 Voice service error:', errorMessage);
          if (onError) {
            onError(errorMessage);
          }
        };
        
        const transcript = await startListening();
        console.log('Received transcript:', transcript);
        
        if (transcript.trim() && onVoiceTranscript) {
          const processedTranscript = processTranscriptForContext(transcript.trim(), currentStep);
          console.log('Processed transcript:', processedTranscript);
          onVoiceTranscript(processedTranscript);
        }
        
        // Restart listening after a brief pause (always listening mode)
        listeningTimeoutRef.current = setTimeout(() => {
          if (isVoiceInputEnabled && !disabled && !isStartingListening.current) {
            startGlobalListening();
          }
        }, 1000);
        
      } catch (error) {
        console.error('Voice listening error:', error);
        // Restart listening after longer pause on error
        listeningTimeoutRef.current = setTimeout(() => {
          if (isVoiceInputEnabled && !disabled && !isStartingListening.current) {
            startGlobalListening();
          }
        }, 3000);
      } finally {
        setIsGlobalListening(false);
        isStartingListening.current = false;
      }
    };

    // Debounce the start to prevent rapid toggling
    debounceTimeoutRef.current = setTimeout(() => {
      if (isVoiceInputEnabled && !disabled) {
        startGlobalListening();
      }
    }, 500);
    
    return () => {
      console.log('🧹 Voice effect cleanup');
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current);
      }
      isStartingListening.current = false;
      stopListening();
      
      // Clear restart callback on cleanup
      import('@/services/voice/voice.service').then(({ VoiceService }) => {
        const voiceService = VoiceService.getInstance();
        voiceService['restartCallback'] = null;
      });
    };
  }, [isVoiceInputEnabled, disabled, voicePrefs.listeningEnabled]); // React to preference changes in real-time

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

    // Handle yes/no button contexts (buttons 1 and 2)
    if (step === 'analyze_response' || step === 'check_if_still_problem' || step === 'blockage_check_if_still_problem' || 
        step === 'identity_dissolve_step_e' || step === 'identity_check' || step === 'identity_problem_check' || 
        step === 'confirm_identity_problem' || step === 'reality_step_b' || step === 'reality_checking_questions' || 
        step === 'reality_doubts_check' || step === 'trauma_dissolve_step_e' || step === 'trauma_identity_check' || 
        step === 'trauma_experience_check' || step === 'trauma_dig_deeper' || step === 'belief_step_f' || 
        step === 'belief_check_1' || step === 'belief_check_2' || step === 'belief_check_3' || 
        step === 'belief_check_4' || step === 'belief_problem_check' || step === 'confirm_belief_problem' ||
        (step?.includes('digging_deeper') && !step?.includes('start'))) {
      // Number recognition for Yes/No
      if (lowerTranscript.includes('1') || lowerTranscript.includes('one')) {
        return 'yes';
      }
      if (lowerTranscript.includes('2') || lowerTranscript.includes('two')) {
        return 'no';
      }
      // Text recognition (fallback)
      if (lowerTranscript.includes('yes') && !lowerTranscript.includes('no')) {
        return 'yes';
      }
      if (lowerTranscript.includes('no') && !lowerTranscript.includes('yes')) {
        return 'no';
      }
    }

    // Handle yes/no/maybe button contexts (buttons 1, 2, and 3)
    if (step?.includes('digging_deeper_start')) {
      // Number recognition for Yes/Maybe/No
      if (lowerTranscript.includes('1') || lowerTranscript.includes('one')) {
        return 'yes';
      }
      if (lowerTranscript.includes('2') || lowerTranscript.includes('two')) {
        return 'maybe';
      }
      if (lowerTranscript.includes('3') || lowerTranscript.includes('three')) {
        return 'no';
      }
      // Text recognition (fallback)
      if (lowerTranscript.includes('yes') && !lowerTranscript.includes('no')) {
        return 'yes';
      }
      if (lowerTranscript.includes('maybe')) {
        return 'maybe';
      }
      if (lowerTranscript.includes('no') && !lowerTranscript.includes('yes')) {
        return 'no';
      }
    }

    // Handle method selection context (buttons 1-6)
    if (step === 'choose_method') {
      // Number recognition for method selection
      if (lowerTranscript.includes('1') || lowerTranscript.includes('one')) {
        return 'Problem Shifting';
      }
      if (lowerTranscript.includes('2') || lowerTranscript.includes('two')) {
        return 'Blockage Shifting';
      }
      if (lowerTranscript.includes('3') || lowerTranscript.includes('three')) {
        return 'Identity Shifting';
      }
      if (lowerTranscript.includes('4') || lowerTranscript.includes('four')) {
        return 'Reality Shifting';
      }
      if (lowerTranscript.includes('5') || lowerTranscript.includes('five')) {
        return 'Trauma Shifting';
      }
      if (lowerTranscript.includes('6') || lowerTranscript.includes('six')) {
        return 'Belief Shifting';
      }
      // Text recognition (fallback)
      if (lowerTranscript.includes('problem shifting') || lowerTranscript.includes('problem')) {
        return 'Problem Shifting';
      }
      if (lowerTranscript.includes('blockage shifting') || lowerTranscript.includes('blockage')) {
        return 'Blockage Shifting';
      }
      if (lowerTranscript.includes('identity shifting') || lowerTranscript.includes('identity')) {
        return 'Identity Shifting';
      }
      if (lowerTranscript.includes('reality shifting') || lowerTranscript.includes('reality')) {
        return 'Reality Shifting';
      }
      if (lowerTranscript.includes('trauma shifting') || lowerTranscript.includes('trauma')) {
        return 'Trauma Shifting';
      }
      if (lowerTranscript.includes('belief shifting') || lowerTranscript.includes('belief')) {
        return 'Belief Shifting';
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