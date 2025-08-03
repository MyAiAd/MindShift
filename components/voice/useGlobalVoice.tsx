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
  const isVoiceInputEnabled = voicePrefs.listeningEnabled;
  
  // Check if voice output is enabled globally via accessibility settings  
  const isVoiceOutputEnabled = voicePrefs.speechEnabled && voicePrefs.autoSpeak;

  // Global voice input - always listening when enabled
  useEffect(() => {
    if (!isVoiceInputEnabled || disabled) {
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
        // Restart listening after longer pause on error
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
    console.log('Processing transcript:', transcript, 'for step:', step, 'lowercase:', lowerTranscript);

    // Handle yes/no button contexts (buttons 1 and 2)
    if (step === 'check_if_still_problem' || step === 'blockage_check_if_still_problem' || 
        step === 'identity_dissolve_step_e' || step === 'identity_check' || step === 'identity_problem_check' || 
        step === 'confirm_identity_problem' || step === 'reality_step_b' || step === 'reality_checking_questions' || 
        step === 'reality_doubts_check' || step === 'trauma_dissolve_step_e' || step === 'trauma_identity_check' || 
        step === 'trauma_experience_check' || step === 'trauma_dig_deeper' || step === 'belief_step_f' || 
        step === 'belief_check_1' || step === 'belief_check_2' || step === 'belief_check_3' || 
        step === 'belief_check_4' || step === 'belief_problem_check' || step === 'confirm_belief_problem' ||
        (step?.includes('digging_deeper') && !step?.includes('start'))) {
      // Number recognition for Yes/No
      if (lowerTranscript.includes('1') || lowerTranscript.includes('one')) {
        console.log('Converting 1/one to yes');
        return 'yes';
      }
      if (lowerTranscript.includes('2') || lowerTranscript.includes('two')) {
        console.log('Converting 2/two to no');
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
        console.log('Converting 1/one to Problem Shifting');
        return 'Problem Shifting';
      }
      if (lowerTranscript.includes('2') || lowerTranscript.includes('two')) {
        console.log('Converting 2/two to Blockage Shifting');
        return 'Blockage Shifting';
      }
      if (lowerTranscript.includes('3') || lowerTranscript.includes('three')) {
        console.log('Converting 3/three to Identity Shifting');
        return 'Identity Shifting';
      }
      if (lowerTranscript.includes('4') || lowerTranscript.includes('four')) {
        console.log('Converting 4/four to Reality Shifting');
        return 'Reality Shifting';
      }
      if (lowerTranscript.includes('5') || lowerTranscript.includes('five')) {
        console.log('Converting 5/five to Trauma Shifting');
        return 'Trauma Shifting';
      }
      if (lowerTranscript.includes('6') || lowerTranscript.includes('six')) {
        console.log('Converting 6/six to Belief Shifting');
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
    console.log('Returning processed transcript:', transcript);
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