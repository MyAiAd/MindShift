// ===============================================
// VOICE SERVICE - NON-INVASIVE ENHANCEMENT
// ===============================================
// Provides speech-to-text and text-to-speech capabilities
// This service is completely optional and additive

import { useState, useEffect } from 'react';

// Type declarations for Web Speech API (not in default TypeScript definitions)
declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognition;
    SpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

export interface VoicePreferences {
  speechEnabled: boolean;
  listeningEnabled: boolean;
  voiceRate: number; // 0.5 to 2.0
  voicePitch: number; // 0 to 2
  voiceVolume: number; // 0 to 1
  selectedVoice: string | null;
  autoSpeak: boolean; // Auto-speak bot responses
  pushToTalk: boolean; // Hold button to speak vs click to toggle
}

export interface VoiceCapabilities {
  speechRecognition: boolean;
  speechSynthesis: boolean;
  availableVoices: SpeechSynthesisVoice[];
}

export class VoiceService {
  private static instance: VoiceService;
  private preferences: VoicePreferences;
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private isListening: boolean = false;
  private isSpeaking: boolean = false;
  private onTranscriptCallback: ((transcript: string) => void) | null = null;
  private onStatusChangeCallback: ((status: VoiceStatus) => void) | null = null;

  private constructor() {
    this.preferences = this.getStoredPreferences();
    this.initializeVoiceServices();
  }

  public static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  private initializeVoiceServices() {
    if (typeof window === 'undefined') return;

    // Initialize Speech Synthesis (Text-to-Speech)
    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      
      // Ensure voices are loaded - some browsers need this
      if (this.synthesis.getVoices().length === 0) {
        this.synthesis.addEventListener('voiceschanged', () => {
          // Silent voice loading - no console logging
        }, { once: true });
      }
      
      // Wake up speech synthesis (Chrome workaround)
      if (this.synthesis.pending || this.synthesis.speaking) {
        this.synthesis.cancel();
      }
    }

    // Initialize Speech Recognition (Speech-to-Text)
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new (window as any).webkitSpeechRecognition();
      this.setupSpeechRecognition();
    } else if ('SpeechRecognition' in window) {
      this.recognition = new (window as any).SpeechRecognition();
      this.setupSpeechRecognition();
    }
  }

  private setupSpeechRecognition() {
    if (!this.recognition) return;

    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.notifyStatusChange({
        isListening: true,
        isSpeaking: false,
        error: null
      });
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      this.isListening = false;
      
      this.notifyStatusChange({
        isListening: false,
        isSpeaking: false,
        error: null
      });

      if (this.onTranscriptCallback) {
        this.onTranscriptCallback(transcript);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.isListening = false;
      this.notifyStatusChange({
        isListening: false,
        isSpeaking: false,
        error: `Speech recognition error: ${event.error}`
      });
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.notifyStatusChange({
        isListening: false,
        isSpeaking: false,
        error: null
      });
    };
  }

  private getStoredPreferences(): VoicePreferences {
    if (typeof window === 'undefined') {
      return {
        speechEnabled: true,
        listeningEnabled: true,
        voiceRate: 1.0,
        voicePitch: 1.0,
        voiceVolume: 0.8,
        selectedVoice: null,
        autoSpeak: true,
        pushToTalk: false
      };
    }

    const stored = localStorage.getItem('voice-preferences');
    if (stored) {
      return JSON.parse(stored);
    }

    return {
      speechEnabled: true,
      listeningEnabled: true,
      voiceRate: 1.0,
      voicePitch: 1.0,
      voiceVolume: 0.8,
      selectedVoice: null,
      autoSpeak: true,
      pushToTalk: false
    };
  }

  public updatePreferences(preferences: Partial<VoicePreferences>) {
    this.preferences = { ...this.preferences, ...preferences };
    localStorage.setItem('voice-preferences', JSON.stringify(this.preferences));
  }

  public disableAutoSpeak() {
    this.updatePreferences({ autoSpeak: false });
  }

  public isSpeechSynthesisWorking(): boolean {
    if (!this.synthesis) return false;
    
    // Check if we've had repeated failures
    const failures = localStorage.getItem('speech-synthesis-failures');
    if (failures && parseInt(failures) >= 3) {
      return false;
    }
    
    return true;
  }

  public getSpeechFailureCount(): number {
    return parseInt(localStorage.getItem('speech-synthesis-failures') || '0');
  }

  public resetSpeechFailures() {
    localStorage.removeItem('speech-synthesis-failures');
  }

  private recordSpeechFailure() {
    const currentFailures = parseInt(localStorage.getItem('speech-synthesis-failures') || '0');
    const newFailures = currentFailures + 1;
    localStorage.setItem('speech-synthesis-failures', newFailures.toString());
    
    // Auto-disable auto-speak after 3 failures to stop bothering the user
    if (newFailures >= 3 && this.preferences.autoSpeak) {
      this.updatePreferences({ autoSpeak: false });
      this.notifyStatusChange({
        isListening: false,
        isSpeaking: false,
        error: null // Still no UI error, just disable silently
      });
    }
  }

  private recordSpeechSuccess() {
    localStorage.removeItem('speech-synthesis-failures');
  }

  public getCapabilities(): VoiceCapabilities {
    const capabilities: VoiceCapabilities = {
      speechRecognition: !!this.recognition,
      speechSynthesis: !!this.synthesis,
      availableVoices: []
    };

    if (this.synthesis) {
      capabilities.availableVoices = this.synthesis.getVoices();
    }

    return capabilities;
  }

  public speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      // Always resolve, never reject - graceful degradation
      if (!this.synthesis || !this.preferences.speechEnabled || !text.trim() || !this.isSpeechSynthesisWorking()) {
        resolve();
        return;
      }

      try {
        // Stop any current speech
        this.synthesis.cancel();

        // Ensure voices are loaded
        let voices = this.synthesis.getVoices();
        if (voices.length === 0) {
          // Voices might not be loaded yet, try to trigger loading
          this.synthesis.addEventListener('voiceschanged', () => {
            this.speakWithRetry(text, resolve, 1);
          }, { once: true });
          
          // Fallback timeout
          setTimeout(() => {
            this.speakWithRetry(text, resolve, 1);
          }, 100);
          return;
        }

        this.speakWithRetry(text, resolve, 0);
      } catch (error) {
        // Always silent - no console logging
        this.recordSpeechFailure();
        resolve(); // Always resolve gracefully
      }
    });
  }

  private speakWithRetry(text: string, resolve: () => void, attempt: number = 0): void {
    if (!this.synthesis || attempt >= 3) {
      resolve();
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Use conservative settings for better compatibility
      utterance.rate = Math.max(0.5, Math.min(2.0, this.preferences.voiceRate));
      utterance.pitch = Math.max(0, Math.min(2, this.preferences.voicePitch));
      utterance.volume = Math.max(0, Math.min(1, this.preferences.voiceVolume));

      // Set selected voice if available and valid
      if (this.preferences.selectedVoice) {
        const voices = this.synthesis.getVoices();
        const selectedVoice = voices.find(voice => voice.name === this.preferences.selectedVoice);
        if (selectedVoice && !selectedVoice.localService === false) {
          utterance.voice = selectedVoice;
        }
      }

      let hasStarted = false;
      let hasEnded = false;

      utterance.onstart = () => {
        hasStarted = true;
        this.isSpeaking = true;
        this.recordSpeechSuccess(); // Track that speech is working
        this.notifyStatusChange({
          isListening: false,
          isSpeaking: true,
          error: null
        });
      };

      utterance.onend = () => {
        if (!hasEnded) {
          hasEnded = true;
          this.isSpeaking = false;
          this.notifyStatusChange({
            isListening: false,
            isSpeaking: false,
            error: null
          });
          resolve();
        }
      };

      utterance.onerror = (event) => {
        // Completely silent - no console logging at all
        
        if (!hasEnded) {
          hasEnded = true;
          this.isSpeaking = false;
          
          // Try again with simpler settings
          if (attempt < 2 && event.error !== 'synthesis-unavailable') {
            setTimeout(() => {
              this.speakWithRetry(this.simplifyTextForSpeech(text), resolve, attempt + 1);
            }, 200 * (attempt + 1)); // Progressive delay
          } else {
            // Final fallback - record failure and resolve silently
            this.recordSpeechFailure();
            this.notifyStatusChange({
              isListening: false,
              isSpeaking: false,
              error: null // Don't show error in UI, just fail silently
            });
            resolve();
          }
        }
      };

      // Safety timeout - ensure we always resolve
      setTimeout(() => {
        if (!hasEnded) {
          hasEnded = true;
          this.isSpeaking = false;
          this.notifyStatusChange({
            isListening: false,
            isSpeaking: false,
            error: null
          });
          resolve();
        }
      }, Math.max(5000, text.length * 100)); // Reasonable timeout based on text length

      // Attempt to speak
      this.synthesis.speak(utterance);

      // Double-check if it started after a brief delay
      setTimeout(() => {
        if (!hasStarted && !hasEnded) {
          // Completely silent - no console logging
          utterance.onerror?.({ error: 'synthesis-failed' } as any);
        }
      }, 1000);

    } catch (error) {
      // Completely silent - no console logging
      this.recordSpeechFailure();
      resolve(); // Always resolve gracefully
    }
  }

  private simplifyTextForSpeech(text: string): string {
    return text
      .replace(/[^\w\s.,!?]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
      .substring(0, 200); // Limit length for problematic texts
  }

  public startListening(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition || !this.preferences.listeningEnabled) {
        reject(new Error('Speech recognition not available'));
        return;
      }

      if (this.isListening) {
        reject(new Error('Already listening'));
        return;
      }

      // Set up one-time callback
      this.onTranscriptCallback = (transcript: string) => {
        this.onTranscriptCallback = null;
        resolve(transcript);
      };

      // Start recognition
      try {
        this.recognition.start();
      } catch (error) {
        reject(error);
      }
    });
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  public stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  public onStatusChange(callback: (status: VoiceStatus) => void) {
    this.onStatusChangeCallback = callback;
  }

  private notifyStatusChange(status: VoiceStatus) {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(status);
    }
  }

  public getPreferences(): VoicePreferences {
    return { ...this.preferences };
  }

  public isListeningActive(): boolean {
    return this.isListening;
  }

  public isSpeakingActive(): boolean {
    return this.isSpeaking;
  }
}

export interface VoiceStatus {
  isListening: boolean;
  isSpeaking: boolean;
  error: string | null;
}

// Export singleton instance
export const voiceService = VoiceService.getInstance();

// React hook for easy integration
export const useVoiceService = () => {
  const service = VoiceService.getInstance();
  const [status, setStatus] = useState<VoiceStatus>({
    isListening: false,
    isSpeaking: false,
    error: null
  });
  const [preferences, setPreferences] = useState(service.getPreferences());

  useEffect(() => {
    service.onStatusChange(setStatus);
    setPreferences(service.getPreferences());
  }, []);

  const updatePreferences = (newPreferences: Partial<VoicePreferences>) => {
    service.updatePreferences(newPreferences);
    setPreferences(service.getPreferences());
  };

  return {
    speak: service.speak.bind(service),
    startListening: service.startListening.bind(service),
    stopListening: service.stopListening.bind(service),
    stopSpeaking: service.stopSpeaking.bind(service),
    getCapabilities: service.getCapabilities.bind(service),
    preferences,
    updatePreferences,
    status,
    isListening: service.isListeningActive.bind(service),
    isSpeaking: service.isSpeakingActive.bind(service)
  };
}; 