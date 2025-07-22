'use client';

import { useEffect, useRef } from 'react';
import { useVoiceService } from '@/services/voice/voice.service';

interface TreatmentVoiceOptions {
  onVoiceTranscript?: (transcript: string) => void;
  enableAutoSpeak?: boolean;
  disabled?: boolean;
  currentStep?: string;
}

export const useTreatmentVoice = ({
  onVoiceTranscript,
  enableAutoSpeak = true,
  disabled = false,
  currentStep
}: TreatmentVoiceOptions) => {
  const { speak, preferences, status } = useVoiceService();
  const lastSpokenMessage = useRef<string>('');

  // Function to speak bot messages (for auto-speak functionality)
  const speakMessage = async (text: string, force = false) => {
    // Avoid speaking the same message twice
    if (!force && lastSpokenMessage.current === text) {
      return;
    }

    // Only speak if auto-speak is enabled and not disabled
    if (!enableAutoSpeak || disabled || !preferences.speechEnabled || !preferences.autoSpeak) {
      return;
    }

    // Clean up text for better speech (remove markdown, etc.)
    const cleanText = cleanTextForSpeech(text);
    
    try {
      await speak(cleanText);
      lastSpokenMessage.current = text;
    } catch (error) {
      // Gracefully handle speech errors - only log in development mode
      if (process.env.NODE_ENV === 'development') {
        console.warn('Speech not available:', error instanceof Error ? error.message : 'Unknown error');
      }
      // Don't throw the error - let the treatment session continue normally
    }
  };

  // Function to handle voice input transcription
  const handleVoiceTranscript = (transcript: string) => {
    if (disabled || !onVoiceTranscript) return;

    // Clean and process transcript based on current step
    const processedTranscript = processTranscriptForStep(transcript, currentStep);
    onVoiceTranscript(processedTranscript);
  };

  // Function to process transcript based on treatment session context
  const processTranscriptForStep = (transcript: string, step?: string): string => {
    // Convert speech to appropriate format based on current step
    const lowerTranscript = transcript.toLowerCase().trim();

    // Handle yes/no responses
    if (step === 'check_if_still_problem' || step === 'digging_deeper_start') {
      if (lowerTranscript.includes('yes') && !lowerTranscript.includes('no')) {
        return 'yes';
      }
      if (lowerTranscript.includes('no') && !lowerTranscript.includes('yes')) {
        return 'no';
      }
      if (step === 'digging_deeper_start' && lowerTranscript.includes('maybe')) {
        return 'maybe';
      }
    }

    // Handle method selection
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

    // For all other steps, return the transcript as-is
    return transcript;
  };

  // Function to clean text for better speech synthesis
  const cleanTextForSpeech = (text: string): string => {
    return text
      // Remove markdown formatting
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      // Replace common abbreviations with full words
      .replace(/\bOK\b/gi, 'okay')
      .replace(/\bID\b/gi, 'I D')
      // Add pauses for better speech flow
      .replace(/\n/g, '. ')
      .replace(/\. \./g, '.')
      // Clean up extra spaces
      .replace(/\s+/g, ' ')
      .trim();
  };

  return {
    // Voice output functions
    speakMessage,
    stopSpeaking: () => status.isSpeaking && speak(''),
    
    // Voice input functions
    handleVoiceTranscript,
    
    // Voice status
    isListening: status.isListening,
    isSpeaking: status.isSpeaking,
    voiceError: status.error,
    
    // Voice preferences
    voiceEnabled: preferences.speechEnabled && preferences.listeningEnabled,
    autoSpeakEnabled: preferences.autoSpeak && enableAutoSpeak,
    
    // Utility functions
    cleanTextForSpeech,
    processTranscriptForStep
  };
};

// Export a component that can be easily added to any treatment interface
export const TreatmentVoiceControls = ({
  onVoiceInput,
  onAutoSpeak,
  disabled = false,
  currentStep,
  className = ''
}: {
  onVoiceInput?: (transcript: string) => void;
  onAutoSpeak?: (text: string) => void;
  disabled?: boolean;
  currentStep?: string;
  className?: string;
}) => {
  const voice = useTreatmentVoice({
    onVoiceTranscript: onVoiceInput,
    enableAutoSpeak: true,
    disabled,
    currentStep
  });

  // Expose the speak function to parent component
  useEffect(() => {
    if (onAutoSpeak && voice.autoSpeakEnabled) {
      onAutoSpeak = voice.speakMessage;
    }
  }, [onAutoSpeak, voice.autoSpeakEnabled, voice.speakMessage]);

  return (
    <div className={`voice-treatment-controls ${className}`}>
      {/* This div can contain voice controls or be empty for invisible integration */}
      <div className="sr-only" aria-live="polite">
        {voice.isListening && "Voice input active"}
        {voice.isSpeaking && "Reading response"}
        {voice.voiceError && `Voice error: ${voice.voiceError}`}
      </div>
    </div>
  );
}; 