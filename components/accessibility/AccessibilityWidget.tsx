// ===============================================
// ACCESSIBILITY WIDGET COMPONENT
// ===============================================
// User-friendly accessibility controls for WCAG compliance

'use client';

import { useState, useEffect } from 'react';
import { useAccessibility } from '@/services/accessibility/accessibility.service';
import { useVoiceService } from '@/services/voice/voice.service';
import { Settings, Eye, Type, Keyboard, Volume2, Mic } from 'lucide-react';

interface AccessibilityWidgetProps {
  position?: 'fixed' | 'relative';
  className?: string;
}

export default function AccessibilityWidget({ 
  position = 'fixed',
  className = ''
}: AccessibilityWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const { preferences, updatePreferences, isEnabled } = useAccessibility();
  const { preferences: voicePrefs, updatePreferences: updateVoicePrefs, getCapabilities } = useVoiceService();

  useEffect(() => {
    // Hide widget if accessibility features are disabled
    if (!isEnabled()) {
      setIsVisible(false);
    }
  }, [isEnabled]);

  if (!isVisible) return null;

  const handleToggle = (key: keyof typeof preferences, value: any) => {
    updatePreferences({ [key]: value });
  };

  const positionClasses = position === 'fixed' 
    ? 'fixed bottom-4 right-4 z-50' 
    : 'relative';

  return (
    <div className={`${positionClasses} ${className}`}>
      {/* Accessibility Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors"
        aria-label="Open accessibility settings"
        aria-expanded={isOpen}
        aria-controls="accessibility-widget"
      >
        <Settings className="h-5 w-5" />
      </button>

      {/* Accessibility Panel */}
      {isOpen && (
        <div
          id="accessibility-widget"
          className="absolute bottom-16 right-0 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4"
          role="dialog"
          aria-labelledby="accessibility-title"
          aria-describedby="accessibility-description"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 id="accessibility-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              Accessibility Settings
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close accessibility settings"
            >
              ×
            </button>
          </div>

          <p id="accessibility-description" className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Customize your experience for better accessibility
          </p>

          <div className="space-y-4">
            {/* High Contrast */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Eye className="h-4 w-4 text-gray-500" />
                <label htmlFor="high-contrast" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  High Contrast
                </label>
              </div>
              <button
                id="high-contrast"
                role="switch"
                aria-checked={preferences.highContrast}
                onClick={() => handleToggle('highContrast', !preferences.highContrast)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.highContrast ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className="sr-only">Toggle high contrast</span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.highContrast ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Reduced Motion */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Volume2 className="h-4 w-4 text-gray-500" />
                <label htmlFor="reduced-motion" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Reduced Motion
                </label>
              </div>
              <button
                id="reduced-motion"
                role="switch"
                aria-checked={preferences.reducedMotion}
                onClick={() => handleToggle('reducedMotion', !preferences.reducedMotion)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.reducedMotion ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className="sr-only">Toggle reduced motion</span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.reducedMotion ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Font Size */}
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Type className="h-4 w-4 text-gray-500" />
                <label htmlFor="font-size" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Font Size
                </label>
              </div>
              <select
                id="font-size"
                value={preferences.fontSize}
                onChange={(e) => handleToggle('fontSize', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="xlarge">Extra Large</option>
              </select>
            </div>

            {/* Keyboard Navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Keyboard className="h-4 w-4 text-gray-500" />
                <label htmlFor="keyboard-nav" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Keyboard Navigation
                </label>
              </div>
              <button
                id="keyboard-nav"
                role="switch"
                aria-checked={preferences.keyboardNavigation}
                onClick={() => handleToggle('keyboardNavigation', !preferences.keyboardNavigation)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.keyboardNavigation ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className="sr-only">Toggle keyboard navigation</span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.keyboardNavigation ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Screen Reader Optimization */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Eye className="h-4 w-4 text-gray-500" />
                <label htmlFor="screen-reader" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Screen Reader Mode
                </label>
              </div>
              <button
                id="screen-reader"
                role="switch"
                aria-checked={preferences.screenReaderOptimized}
                onClick={() => handleToggle('screenReaderOptimized', !preferences.screenReaderOptimized)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.screenReaderOptimized ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className="sr-only">Toggle screen reader optimization</span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.screenReaderOptimized ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Voice Input */}
            {getCapabilities().speechRecognition && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Mic className="h-4 w-4 text-gray-500" />
                  <label htmlFor="voice-input" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Voice Input
                  </label>
                </div>
                <button
                  id="voice-input"
                  role="switch"
                  aria-checked={voicePrefs.listeningEnabled}
                  onClick={() => updateVoicePrefs({ listeningEnabled: !voicePrefs.listeningEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    voicePrefs.listeningEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span className="sr-only">Toggle voice input</span>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      voicePrefs.listeningEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Voice Output */}
            {getCapabilities().speechSynthesis && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Volume2 className="h-4 w-4 text-gray-500" />
                  <label htmlFor="voice-output" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Voice Output
                  </label>
                </div>
                <button
                  id="voice-output"
                  role="switch"
                  aria-checked={voicePrefs.speechEnabled}
                  onClick={() => updateVoicePrefs({ speechEnabled: !voicePrefs.speechEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    voicePrefs.speechEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span className="sr-only">Toggle voice output</span>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      voicePrefs.speechEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                updatePreferences({
                  highContrast: false,
                  reducedMotion: false,
                  fontSize: 'medium',
                  keyboardNavigation: true,
                  screenReaderOptimized: true,
                });
              }}
              className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Reset to Default
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 