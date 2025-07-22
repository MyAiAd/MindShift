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
    return new Promise((resolve, reject) => {
      if (!this.synthesis || !this.preferences.speechEnabled) {
        resolve();
        return;
      }

      // Stop any current speech
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.preferences.voiceRate;
      utterance.pitch = this.preferences.voicePitch;
      utterance.volume = this.preferences.voiceVolume;

      // Set selected voice if available
      if (this.preferences.selectedVoice) {
        const voices = this.synthesis.getVoices();
        const selectedVoice = voices.find(voice => voice.name === this.preferences.selectedVoice);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.notifyStatusChange({
          isListening: false,
          isSpeaking: true,
          error: null
        });
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.notifyStatusChange({
          isListening: false,
          isSpeaking: false,
          error: null
        });
        resolve();
      };

      utterance.onerror = (event) => {
        this.isSpeaking = false;
        this.notifyStatusChange({
          isListening: false,
          isSpeaking: false,
          error: `Speech synthesis error: ${event.error}`
        });
        reject(new Error(`Speech synthesis error: ${event.error}`));
      };

      this.synthesis.speak(utterance);
    });
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