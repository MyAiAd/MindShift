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
  private onPreferencesChangeCallback: ((preferences: VoicePreferences) => void) | null = null;
  private gotResult: boolean = false; // Track if we got a result before recognition ended
  private wasManualStop: boolean = false; // Track if recognition was manually stopped
  private restartCallback: (() => void) | null = null; // Callback to restart recognition after timeout
  private errorCallback: ((error: string) => void) | null = null; // Callback for critical voice errors
  private noSpeechRetryCount: number = 0; // Track consecutive no-speech errors
  private readonly MAX_NO_SPEECH_RETRIES = 3; // Maximum retries for no-speech errors
  private immediateEndCount: number = 0; // Track immediate start/end cycles
  private readonly MAX_IMMEDIATE_ENDS = 5; // Maximum immediate end cycles before backing off
  private recognitionStartTime: number = 0; // Track when recognition started
  private errorHandlerScheduledRestart: boolean = false; // Track if error handler already scheduled a restart
  private errorHandlerGaveUp: boolean = false; // Track if error handler exhausted retries and gave up

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
    console.log('🔍 Checking speech recognition support...');
    console.log('webkitSpeechRecognition available:', 'webkitSpeechRecognition' in window);
    console.log('SpeechRecognition available:', 'SpeechRecognition' in window);
    
    if ('webkitSpeechRecognition' in window) {
      console.log('✅ Using webkitSpeechRecognition');
      this.recognition = new (window as any).webkitSpeechRecognition();
      this.setupSpeechRecognition();
    } else if ('SpeechRecognition' in window) {
      console.log('✅ Using SpeechRecognition');
      this.recognition = new (window as any).SpeechRecognition();
      this.setupSpeechRecognition();
    } else {
      console.error('❌ No speech recognition API available in this browser');
    }
  }

  private setupSpeechRecognition() {
    if (!this.recognition) return;

    console.log('⚙️ Setting up speech recognition...');
    
    this.recognition.continuous = false;
    this.recognition.interimResults = true; // Enable interim results for better short word capture
    this.recognition.lang = 'en-US';
    
    // Set additional properties if available (Chrome-specific)
    if ('maxAlternatives' in this.recognition) {
      (this.recognition as any).maxAlternatives = 5; // Get multiple alternatives
      console.log('✅ Set maxAlternatives = 5');
    }
    if ('serviceURI' in this.recognition) {
      // Use more sensitive recognition if available
      console.log('✅ ServiceURI available');
    }
    
    console.log('✅ Speech recognition configured:', {
      continuous: this.recognition.continuous,
      interimResults: this.recognition.interimResults,
      lang: this.recognition.lang
    });
    
    // Check microphone permissions
    this.checkMicrophonePermissions();

    this.recognition.onstart = () => {
      console.log('🎙️ Speech recognition STARTED');
      this.isListening = true;
      this.recognitionStartTime = Date.now(); // Track start time for immediate end detection
      this.notifyStatusChange({
        isListening: true,
        isSpeaking: false,
        error: null
      });
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Mark that we got a result (prevents automatic restart on timeout)
      this.gotResult = true;
      // Reset no-speech retry counter on successful recognition
      this.noSpeechRetryCount = 0;
      // Reset error restart flag on successful recognition
      this.errorHandlerScheduledRestart = false;
      // Reset gave up flag on successful recognition - user proved microphone works
      this.errorHandlerGaveUp = false;
      
      // Log all results for debugging
      console.log('🎙️ Speech recognition results:', event.results);
      for (let i = 0; i < event.results.length; i++) {
        for (let j = 0; j < event.results[i].length; j++) {
          console.log(`Result [${i}][${j}]: "${event.results[i][j].transcript}" (confidence: ${event.results[i][j].confidence})`);
        }
      }
      
      // Get the best transcript, prioritizing known keywords even with lower confidence
      let bestTranscript = event.results[0][0].transcript;
      let bestConfidence = event.results[0][0].confidence || 0;
      
      // Check all results for our target keywords
      const keywords = ['yes', 'no', 'one', 'two', 'three', 'four', 'five', 'six', '1', '2', '3', '4', '5', '6'];
      
      for (let i = 0; i < event.results.length; i++) {
        // Check if this is a final result (more reliable) or interim (less reliable but faster)
        const isFinal = event.results[i].isFinal;
        console.log(`Checking result [${i}] - isFinal: ${isFinal}`);
        
        for (let j = 0; j < event.results[i].length; j++) {
          const transcript = event.results[i][j].transcript.toLowerCase().trim();
          const confidence = event.results[i][j].confidence || 0;
          
          // If this result contains one of our keywords, prioritize it
          if (keywords.some(keyword => transcript.includes(keyword))) {
            console.log(`🎯 Found keyword in result [${i}][${j}]: "${transcript}" (confidence: ${confidence}, final: ${isFinal})`);
            bestTranscript = event.results[i][j].transcript;
            bestConfidence = confidence;
            
            // If we found a keyword in a final result, we're done
            if (isFinal) break;
          }
          
          // For interim results, lower the confidence threshold for keywords
          const isKeywordMatch = keywords.some(keyword => transcript.includes(keyword));
          const confidenceThreshold = isKeywordMatch ? 0.3 : 0.7; // Lower threshold for keywords
          
          // Use highest confidence result above threshold
          if (confidence > bestConfidence && confidence >= confidenceThreshold) {
            bestTranscript = event.results[i][j].transcript;
            bestConfidence = confidence;
          }
        }
      }
      
      console.log(`🎤 Final selected transcript: "${bestTranscript}" (confidence: ${bestConfidence})`);
      
      this.isListening = false;
      
      this.notifyStatusChange({
        isListening: false,
        isSpeaking: false,
        error: null
      });

      if (this.onTranscriptCallback && bestTranscript.trim()) {
        this.onTranscriptCallback(bestTranscript);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('❌ Speech recognition ERROR:', event.error, event);
      this.isListening = false;
      
      // Handle different types of errors
      let shouldRestart = false;
      switch (event.error) {
        case 'no-speech':
          this.noSpeechRetryCount++;
          console.log(`🔇 No speech detected (attempt ${this.noSpeechRetryCount}/${this.MAX_NO_SPEECH_RETRIES})`);
          
          if (this.noSpeechRetryCount < this.MAX_NO_SPEECH_RETRIES) {
            console.log('🔄 Will retry - likely microphone issue or very quiet');
            console.log('💡 Troubleshooting tips:');
            console.log('   - Check if microphone is unmuted');
            console.log('   - Ensure microphone permission is granted');
            console.log('   - Try speaking closer to microphone');
            console.log('   - Check system audio input levels');
            shouldRestart = true;
          } else {
            const errorMessage = `❌ Max no-speech retries reached (${this.MAX_NO_SPEECH_RETRIES}). Stopping auto-restart.`;
            const userMessage = '🎤 Microphone issue detected. Please check your microphone setup and click the voice button to try again.';
            
            console.error(errorMessage);
            console.error(userMessage);
            
            // Notify UI of critical voice error
            if (this.errorCallback) {
              this.errorCallback(userMessage);
            }
            
            this.errorHandlerGaveUp = true; // Flag that error handler gave up - prevents onend from restarting
            shouldRestart = false;
          }
          break;
        case 'aborted':
          console.log('🛑 Recognition aborted - manual stop or system interrupt');
          shouldRestart = false;
          break;
        case 'audio-capture':
          console.error('🎤 Audio capture failed - microphone permission or hardware issue');
          shouldRestart = false; // Don't restart on hardware issues
          break;
        case 'not-allowed':
          console.error('🚫 Microphone permission denied');
          shouldRestart = false;
          break;
        case 'network':
          console.error('🌐 Network error during recognition');
          shouldRestart = true; // Try restarting for network issues
          break;
        default:
          console.error('❓ Unknown recognition error:', event.error);
          shouldRestart = false;
      }
      
              // Mark for potential restart if appropriate
        if (shouldRestart && this.restartCallback) {
          console.log(`🔄 Will attempt restart after ${event.error} error`);
          this.errorHandlerScheduledRestart = true; // Flag that error handler is handling the restart
          setTimeout(() => {
            if (this.restartCallback) {
              console.log(`🔄 Restarting recognition after ${event.error} error`);
              this.restartCallback();
            }
          }, 1000); // Longer delay for error recovery
        }
      
      this.notifyStatusChange({
        isListening: false,
        isSpeaking: false,
        error: `Speech recognition error: ${event.error}`
      });
    };

    this.recognition.onend = () => {
      console.log('🏁 Speech recognition ENDED');
      
      // CRITICAL: Immediately reset listening state to prevent race conditions
      this.isListening = false;
      
      // Check if recognition ended immediately (within 2 seconds of starting)
      const recognitionDuration = Date.now() - this.recognitionStartTime;
      const wasImmediateEnd = recognitionDuration < 2000; // Less than 2 seconds
      
      if (wasImmediateEnd && !this.gotResult && !this.wasManualStop) {
        this.immediateEndCount++;
        console.log(`⚡ Immediate recognition end detected (${recognitionDuration}ms duration)`);
        console.log(`🔢 Immediate end count: ${this.immediateEndCount}/${this.MAX_IMMEDIATE_ENDS}`);
      }
      
      // Check if this was a silence timeout (no result and no manual stop)
      const wasSilenceTimeout = !this.gotResult && !this.wasManualStop;
      
      // Check if error handler already scheduled a restart (avoid duplicate restarts)
      if (this.errorHandlerScheduledRestart) {
        console.log('🔄 Error handler already scheduled restart, onend will not restart');
        this.errorHandlerScheduledRestart = false; // Reset flag
        return; // Don't schedule another restart
      }
      
      // Check if error handler gave up due to max retries (don't restart if so)
      if (this.errorHandlerGaveUp) {
        console.log('🛑 Error handler gave up due to max retries - onend will not restart');
        console.log('🎤 Voice recognition stopped. User must manually re-enable or check microphone.');
        return; // Don't restart if error handler exhausted retries
      }
      
      if (wasSilenceTimeout) {
        // Check if we've had too many immediate ends - implement backoff
        if (this.immediateEndCount >= this.MAX_IMMEDIATE_ENDS) {
          console.error(`❌ Too many immediate recognition ends (${this.immediateEndCount}). Microphone access may be blocked.`);
          console.error('🔧 Troubleshooting: Check browser permissions, microphone hardware, and try refreshing the page.');
          console.log('⏸️ Pausing auto-restart for 30 seconds to prevent infinite loops...');
          
          // Long pause before allowing restarts again
          setTimeout(() => {
            console.log('🔄 Resetting immediate end counter, will try again...');
            this.immediateEndCount = 0;
          }, 30000); // 30 second pause
          
        } else if (wasImmediateEnd) {
          console.log('🔄 Will restart after immediate end (likely microphone access issue)');
          // Longer delay for immediate ends
          if (this.restartCallback) {
            setTimeout(() => {
              if (this.restartCallback) {
                console.log('🔄 Restarting recognition after immediate end');
                // Force reset listening state before restart
                this.isListening = false;
                this.restartCallback();
              }
            }, 2000); // Longer delay for immediate ends
          }
        } else {
          console.log('🔄 Recognition ended due to silence timeout, will restart...');
          // Normal restart for actual silence timeouts
          if (this.restartCallback) {
            setTimeout(() => {
              if (this.restartCallback) {
                console.log('🔄 Restarting recognition after silence timeout');
                // Force reset listening state before restart
                this.isListening = false;
                this.restartCallback();
              }
            }, 1000); // Normal delay for silence timeouts
          }
        }
      } else if (this.gotResult) {
        console.log('✅ Recognition ended after successful result');
        // Reset immediate end count on successful recognition
        this.immediateEndCount = 0;
      } else if (this.wasManualStop) {
        console.log('🛑 Recognition ended due to manual stop');
        // Reset immediate end count on manual stop (fresh start)
        this.immediateEndCount = 0;
      }
      
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
    
    // Notify listeners of preference changes
    if (this.onPreferencesChangeCallback) {
      this.onPreferencesChangeCallback(this.preferences);
    }
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
    return new Promise(async (resolve, reject) => {
      console.log('🎤 startListening called');
      console.log('Recognition available:', !!this.recognition);
      console.log('Listening enabled:', this.preferences.listeningEnabled);
      console.log('Currently listening:', this.isListening);
      
      if (!this.recognition || !this.preferences.listeningEnabled) {
        console.error('❌ Speech recognition not available:', { 
          recognition: !!this.recognition, 
          listeningEnabled: this.preferences.listeningEnabled 
        });
        reject(new Error('Speech recognition not available'));
        return;
      }

      if (this.isListening) {
        console.warn('⚠️ Already listening, rejecting new request');
        reject(new Error('Already listening'));
        return;
      }

      // Additional safety check - if recognition is still running from previous session
      try {
        this.recognition.stop();
        // Give a small delay for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        // Ignore errors - recognition might not be running
      }

      // Reset tracking flags
      this.gotResult = false;
      this.wasManualStop = false;
      this.errorHandlerScheduledRestart = false; // Reset error restart flag for new session
      this.errorHandlerGaveUp = false; // Reset gave up flag for new session - user gets fresh start
      // Note: Don't reset noSpeechRetryCount here - let it persist across retry attempts
      // It will be reset on successful recognition or manual stop
      
      // Set up one-time callback
      this.onTranscriptCallback = (transcript: string) => {
        console.log('📝 Transcript callback fired:', transcript);
        this.onTranscriptCallback = null;
        this.restartCallback = null; // Clear restart callback on successful result
        resolve(transcript);
      };

      // Start recognition
      try {
        console.log('🚀 Attempting to start speech recognition...');
        this.recognition.start();
        console.log('✅ Speech recognition.start() called successfully');
      } catch (error) {
        console.error('❌ Error starting speech recognition:', error);
        reject(error);
      }
    });
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      console.log('🛑 Manually stopping speech recognition');
      this.wasManualStop = true;
      this.restartCallback = null; // Clear any restart callback
      this.errorCallback = null; // Clear any error callback
      this.noSpeechRetryCount = 0; // Reset retry counter on manual stop
      this.immediateEndCount = 0; // Reset immediate end counter on manual stop
      this.errorHandlerScheduledRestart = false; // Reset error restart flag on manual stop
      this.errorHandlerGaveUp = false; // Reset gave up flag on manual stop - fresh start for user
      this.recognition.stop();
    }
  }

  // Force reset recognition state - used before restart attempts to prevent race conditions
  public forceResetState() {
    console.log('🔧 Force resetting recognition state');
    this.isListening = false;
    this.gotResult = false;
    this.wasManualStop = false;
    this.recognitionStartTime = 0;
    this.errorHandlerScheduledRestart = false;
    this.errorHandlerGaveUp = false;
    
    // Stop any ongoing recognition
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore errors - recognition might not be running
      }
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

  public onPreferencesChange(callback: (preferences: VoicePreferences) => void) {
    this.onPreferencesChangeCallback = callback;
  }

  private notifyStatusChange(status: VoiceStatus) {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(status);
    }
  }

  private async checkMicrophonePermissions() {
    try {
      console.log('🎤 Checking microphone permissions...');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ getUserMedia not supported in this browser');
        return;
      }

      // Check if we already have permission
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        console.log('🔐 Microphone permission status:', permission.state);
        
        if (permission.state === 'denied') {
          console.error('❌ Microphone permission denied');
          return;
        }
      }

      // Try to get microphone access to test
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Microphone access granted and working');
        // Stop the stream immediately
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.error('❌ Failed to get microphone access:', error);
      }
    } catch (error) {
      console.error('❌ Error checking microphone permissions:', error);
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
    service.onPreferencesChange(setPreferences);
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