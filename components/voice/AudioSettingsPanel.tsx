'use client';

import React from 'react';
import { Mic, Volume2, AlertCircle } from 'lucide-react';

interface AudioSettingsPanelProps {
  isMicEnabled: boolean;
  isSpeakerEnabled: boolean;
  onMicToggle: (enabled: boolean) => void;
  onSpeakerToggle: (enabled: boolean) => void;
  micPermission: 'granted' | 'denied' | 'prompt';
  className?: string;
}

export const AudioSettingsPanel: React.FC<AudioSettingsPanelProps> = ({
  isMicEnabled,
  isSpeakerEnabled,
  onMicToggle,
  onSpeakerToggle,
  micPermission,
  className = ''
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Microphone Toggle */}
      <div className="flex items-center justify-between p-3 bg-secondary/50 dark:bg-[#586e75]/50 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full ${
            isMicEnabled 
              ? 'bg-indigo-100 dark:bg-indigo-900/30' 
              : 'bg-muted dark:bg-[#073642]'
          }`}>
            <Mic className={`h-5 w-5 ${
              isMicEnabled 
                ? 'text-indigo-600 dark:text-indigo-400' 
                : 'text-muted-foreground dark:text-[#93a1a1]'
            }`} />
          </div>
          <div>
            <div className="font-medium text-foreground dark:text-[#fdf6e3]">
              🎤 Microphone
            </div>
            <div className="text-xs text-muted-foreground dark:text-[#93a1a1]">
              Speak your responses
            </div>
          </div>
        </div>
        <button
          onClick={() => onMicToggle(!isMicEnabled)}
          disabled={micPermission === 'denied'}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            isMicEnabled 
              ? 'bg-indigo-600' 
              : 'bg-gray-300 dark:bg-[#586e75]'
          }`}
          aria-label="Toggle microphone"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isMicEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Speaker Toggle */}
      <div className="flex items-center justify-between p-3 bg-secondary/50 dark:bg-[#586e75]/50 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full ${
            isSpeakerEnabled 
              ? 'bg-indigo-100 dark:bg-indigo-900/30' 
              : 'bg-muted dark:bg-[#073642]'
          }`}>
            <Volume2 className={`h-5 w-5 ${
              isSpeakerEnabled 
                ? 'text-indigo-600 dark:text-indigo-400' 
                : 'text-muted-foreground dark:text-[#93a1a1]'
            }`} />
          </div>
          <div>
            <div className="font-medium text-foreground dark:text-[#fdf6e3]">
              🔊 Audio Output
            </div>
            <div className="text-xs text-muted-foreground dark:text-[#93a1a1]">
              Hear AI responses
            </div>
          </div>
        </div>
        <button
          onClick={() => onSpeakerToggle(!isSpeakerEnabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
            isSpeakerEnabled 
              ? 'bg-indigo-600' 
              : 'bg-gray-300 dark:bg-[#586e75]'
          }`}
          aria-label="Toggle speaker"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isSpeakerEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Permission Status Indicators */}
      {micPermission === 'denied' && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700 dark:text-red-300">
              <div className="font-medium mb-1">Microphone access denied</div>
              <div className="text-xs">
                Please enable microphone access in your browser settings to use voice input.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info text */}
      <div className="text-xs text-muted-foreground dark:text-[#93a1a1] text-center pt-2 border-t border-border dark:border-[#586e75]">
        Use microphone and speaker independently for flexible interaction modes
      </div>
    </div>
  );
};

