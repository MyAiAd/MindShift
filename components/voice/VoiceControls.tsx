'use client';

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings } from 'lucide-react';
import { useVoiceService, type VoiceStatus, VoiceService } from '@/services/voice/voice.service';

interface VoiceControlsProps {
  onTranscript?: (transcript: string) => void;
  onSpeak?: (text: string) => void;
  disabled?: boolean;
  showSettings?: boolean;
  autoSpeak?: boolean;
  className?: string;
}

export default function VoiceControls({
  onTranscript,
  onSpeak,
  disabled = false,
  showSettings = true,
  autoSpeak = true,
  className = ''
}: VoiceControlsProps) {
  const {
    speak,
    startListening,
    stopListening,
    stopSpeaking,
    getCapabilities,
    preferences,
    updatePreferences,
    status
  } = useVoiceService();
  
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [capabilities, setCapabilities] = useState(getCapabilities());
  const [speechFailures, setSpeechFailures] = useState(0);

  const voiceServiceInstance = VoiceService.getInstance();

  useEffect(() => {
    setCapabilities(getCapabilities());
    setSpeechFailures(voiceServiceInstance.getSpeechFailureCount());
  }, []);

  const handleResetSpeech = () => {
    voiceServiceInstance.resetSpeechFailures();
    setSpeechFailures(0);
    updatePreferences({ autoSpeak: true });
  };

  // Auto-speak when autoSpeak is enabled and onSpeak is provided
  useEffect(() => {
    if (autoSpeak && onSpeak && preferences.autoSpeak) {
      // This would be triggered by parent component when bot responds
      // Implementation handled by parent
    }
  }, [autoSpeak, onSpeak, preferences.autoSpeak]);

  const handleStartListening = async () => {
    if (disabled || !capabilities.speechRecognition) return;

    try {
      const transcript = await startListening();
      if (transcript.trim() && onTranscript) {
        onTranscript(transcript.trim());
      }
    } catch (error) {
      console.error('Voice recognition error:', error);
    }
  };

  const handleStopListening = () => {
    stopListening();
  };

  const handleSpeak = (text: string) => {
    if (disabled || !capabilities.speechSynthesis) return;
    speak(text);
  };

  const handleStopSpeaking = () => {
    stopSpeaking();
  };

  // Public method for parent components to trigger speech
  useEffect(() => {
    if (onSpeak) {
      // Replace onSpeak with our handleSpeak function
      // This is handled through the autoSpeak mechanism
    }
  }, [onSpeak]);

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Microphone Button */}
      {capabilities.speechRecognition && (
        <button
          onClick={status.isListening ? handleStopListening : handleStartListening}
          disabled={disabled}
          className={`p-2 rounded-full transition-all duration-200 ${
            status.isListening
              ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse'
              : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
          aria-label={status.isListening ? 'Stop listening' : 'Start voice input'}
          title={status.isListening ? 'Stop listening' : 'Click to speak'}
        >
          {status.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      )}

      {/* Speaker Button */}
      {capabilities.speechSynthesis && (
        <button
          onClick={status.isSpeaking ? handleStopSpeaking : undefined}
          disabled={disabled}
          className={`p-2 rounded-full transition-all duration-200 ${
            status.isSpeaking
              ? 'bg-green-100 text-green-600 hover:bg-green-200 animate-pulse'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={status.isSpeaking ? 'Stop speaking' : 'Voice output enabled'}
          title={status.isSpeaking ? 'Click to stop speaking' : 'Voice output active'}
        >
          {status.isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}

      {/* Settings Button */}
      {showSettings && (
        <button
          onClick={() => setShowSettingsPanel(!showSettingsPanel)}
          disabled={disabled}
          className={`p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          aria-label="Voice settings"
          title="Voice settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      )}

      {/* Status Indicator */}
      <div className="flex flex-col items-center">
        {status.isListening && (
          <div className="text-xs text-red-600 font-medium animate-pulse">
            Listening...
          </div>
        )}
        {status.isSpeaking && (
          <div className="text-xs text-green-600 font-medium animate-pulse">
            Speaking...
          </div>
        )}
        {status.error && (
          <div className="text-xs text-red-500" title={status.error}>
            Error
          </div>
        )}
      </div>

      {/* Settings Panel */}
      {showSettingsPanel && (
        <div className="absolute top-full mt-2 right-0 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Voice Settings
          </h3>

          {/* Auto-speak toggle */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs text-gray-700 dark:text-gray-300 block">
                  Auto-speak responses
                </label>
                {!capabilities.speechSynthesis && (
                  <span className="text-xs text-red-500">Voice output unavailable</span>
                )}
                {speechFailures >= 3 && capabilities.speechSynthesis && (
                  <span className="text-xs text-orange-500">Auto-disabled due to issues</span>
                )}
              </div>
              <button
                onClick={() => updatePreferences({ autoSpeak: !preferences.autoSpeak })}
                disabled={!capabilities.speechSynthesis}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  preferences.autoSpeak && capabilities.speechSynthesis ? 'bg-blue-600' : 'bg-gray-200'
                } ${!capabilities.speechSynthesis ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    preferences.autoSpeak && capabilities.speechSynthesis ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            {/* Reset button when auto-disabled */}
            {speechFailures >= 3 && capabilities.speechSynthesis && !preferences.autoSpeak && (
              <button
                onClick={handleResetSpeech}
                className="text-xs text-blue-600 hover:text-blue-700 mt-1 underline"
              >
                Reset and try again
              </button>
            )}
          </div>

          {/* Speech rate */}
          <div className="mb-3">
            <label className="text-xs text-gray-700 dark:text-gray-300 block mb-1">
              Speech Rate: {preferences.voiceRate.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={preferences.voiceRate}
              onChange={(e) => updatePreferences({ voiceRate: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Volume */}
          <div className="mb-3">
            <label className="text-xs text-gray-700 dark:text-gray-300 block mb-1">
              Volume: {Math.round(preferences.voiceVolume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={preferences.voiceVolume}
              onChange={(e) => updatePreferences({ voiceVolume: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Voice selection */}
          {capabilities.availableVoices.length > 0 && (
            <div>
              <label className="text-xs text-gray-700 dark:text-gray-300 block mb-1">
                Voice
              </label>
              <select
                value={preferences.selectedVoice || ''}
                onChange={(e) => updatePreferences({ selectedVoice: e.target.value || null })}
                className="w-full text-xs p-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Default</option>
                {capabilities.availableVoices.map((voice, index) => (
                  <option key={index} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Export utility component for easy integration
export const VoiceStatusDisplay = ({ status }: { status: VoiceStatus }) => {
  return (
    <div className="flex items-center space-x-2 text-xs">
      {status.isListening && (
        <span className="text-red-600 animate-pulse">🎤 Listening</span>
      )}
      {status.isSpeaking && (
        <span className="text-green-600 animate-pulse">🔊 Speaking</span>
      )}
      {status.error && (
        <span className="text-red-500" title={status.error}>❌ Error</span>
      )}
    </div>
  );
}; 