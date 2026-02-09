'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, Clock, Zap, AlertCircle, CheckCircle, MessageSquare, Undo2, Sparkles, Mic, Volume2, VolumeX, Send, Play, Settings, Gauge, User } from 'lucide-react';
// Global voice system integration (accessibility-driven)
import { useGlobalVoice } from '@/components/voice/useGlobalVoice';
// Natural voice integration (ElevenLabs + Web Speech)
import { useNaturalVoice } from '@/components/voice/useNaturalVoice';
// V4 static audio texts (for consistency with preloader)
import { V4_STATIC_AUDIO_TEXTS } from '@/lib/v4/static-audio-texts';

// Import shared types
import {
  TreatmentMessage,
  TreatmentSessionProps,
  SessionStats,
  PerformanceMetrics,
  StepHistoryEntry
} from './shared/types';

// Import V4 modality components
import ProblemShifting from './modalities/ProblemShifting/ProblemShifting';
import IdentityShifting from './modalities/IdentityShifting/IdentityShifting';
import BeliefShifting from './modalities/BeliefShifting/BeliefShifting';
import BlockageShifting from './modalities/BlockageShifting/BlockageShifting';
import RealityShifting from './modalities/RealityShifting/RealityShifting';
import TraumaShifting from './modalities/TraumaShifting/TraumaShifting';

export default function TreatmentSession({
  sessionId,
  userId,
  shouldResume = false,
  onComplete,
  onError,
  version = 'v4'
}: TreatmentSessionProps) {
  const [messages, setMessages] = useState<TreatmentMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showReadyOverlay, setShowReadyOverlay] = useState(true); // New: Start with overlay visible
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    totalResponses: 0,
    avgResponseTime: 0,
    aiUsagePercent: 0,
    version: 'v4'
  });

  // Natural Voice State - SPLIT into Mic and Speaker (Phase 2: Audio System Fix)
  // Load from localStorage if available
  const [isMicEnabled, setIsMicEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('v4_mic_enabled') === 'true';
    }
    return false;
  });
  
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('v4_speaker_enabled') === 'true';
    }
    return false;
  });
  
  // Permission state tracking
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [hasCheckedPermission, setHasCheckedPermission] = useState(false);

  // DEPRECATED: Keep for backward compatibility during transition
  const [isNaturalVoiceEnabled, setIsNaturalVoiceEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('v4_natural_voice') === 'true';
    }
    return false;
  });

  // Permission checking logic (prevents repeated prompts on iPhone)
  const checkMicPermission = useCallback(async (): Promise<'granted' | 'denied' | 'prompt'> => {
    // Try modern Permissions API first
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return result.state as 'granted' | 'denied' | 'prompt';
      } catch (e) {
        // Fallback for browsers that don't support microphone query
        console.log('Permissions API not available for microphone');
      }
    }
    
    // Fallback: check localStorage cache
    const cached = localStorage.getItem('v4_mic_permission');
    if (cached) return cached as 'granted' | 'denied' | 'prompt';
    
    return 'prompt';
  }, []);

  // Request microphone permission (only if not already granted)
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    const currentState = await checkMicPermission();
    
    // Don't request if already granted
    if (currentState === 'granted') {
      console.log('🎤 Microphone already granted');
      setMicPermission('granted');
      return true;
    }
    
    // Don't request if denied
    if (currentState === 'denied') {
      console.log('🎤 Microphone denied');
      setMicPermission('denied');
      return false;
    }
    
    // Only request if 'prompt'
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      stream.getTracks().forEach(track => track.stop()); // Stop immediately, we just needed permission
      localStorage.setItem('v4_mic_permission', 'granted');
      setMicPermission('granted');
      return true;
    } catch (e) {
      localStorage.setItem('v4_mic_permission', 'denied');
      setMicPermission('denied');
      return false;
    }
  }, [checkMicPermission]);

  // Check permission state on mount (only once)
  useEffect(() => {
    if (!hasCheckedPermission && isMicEnabled) {
      checkMicPermission().then(state => {
        setMicPermission(state);
        setHasCheckedPermission(true);
      });
    }
  }, [isMicEnabled, hasCheckedPermission, checkMicPermission]);

  // Voice Settings State
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('v4_playback_speed');
      return saved ? parseFloat(saved) : 1.0;
    }
    return 1.0;
  });
  const [selectedVoice, setSelectedVoice] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('v4_selected_voice') || 'heart';
    }
    return 'heart';
  });
  const [isGuidedMode, setIsGuidedMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('v4_guided_mode');
      return saved === 'true';
    }
    return false;
  });
  const [isPTTActive, setIsPTTActive] = useState(false);
  const voiceSettingsRef = useRef<HTMLDivElement>(null);

  // VAD (Voice Activity Detection) State
  const [vadSensitivity, setVadSensitivity] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('v4_vad_sensitivity');
      return saved ? parseFloat(saved) : 0.7; // Increased from 0.5 to 0.7 for more forgiving default
    }
    return 0.7; // Increased from 0.5 to 0.7 for more forgiving default
  });
  const [vadLevel, setVadLevel] = useState(0); // 0-100 for real-time meter display
  const [isVadActive, setIsVadActive] = useState(false); // Tracks if VAD is running

  // Test Audio State - for settings demo
  const [isTestPlaying, setIsTestPlaying] = useState(false);
  const [testInterrupted, setTestInterrupted] = useState(false);
  const testAudioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const testAutoStartTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Track the 300ms auto-start delay
  const isTestPlayingRef = useRef(false); // Ref for immediate access in callbacks
  
  // Test audio sample text - longer for better testing
  const TEST_AUDIO_SAMPLE = "This is a test of your voice settings. I will keep speaking so you can test interrupting me at any time. Try adjusting the sensitivity slider, then speak to interrupt. Higher sensitivity means it's easier to interrupt me. Lower sensitivity means I'm harder to interrupt. You can also adjust my speaking speed to find what works best for you. Go ahead and try interrupting me now by speaking. I'll keep looping until you stop the test.";

  // Available voices - Kokoro TTS voices
  const AVAILABLE_VOICES = [
    { id: 'heart', name: 'Heart', kokoroId: 'af_heart', description: 'Warm, professional female voice' },
    { id: 'michael', name: 'Michael', kokoroId: 'am_michael', description: 'Deep, mature male voice' },
  ] as const;

  // Toggle handlers with Sticky Settings and Retroactive Play
  const toggleMic = useCallback(async () => {
    const newState = !isMicEnabled;
    
    // If turning ON, request permission first
    if (newState) {
      const granted = await requestMicPermission();
      if (!granted) {
        console.log('🎤 Microphone permission denied, cannot enable');
        return;
      }
    }
    
    setIsMicEnabled(newState);
    
    // Sticky Settings - persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('v4_mic_enabled', String(newState));
    }
    
    console.log(`🎤 Microphone ${newState ? 'enabled' : 'disabled'}`);
  }, [isMicEnabled, requestMicPermission]);

  const toggleSpeaker = useCallback(() => {
    const newState = !isSpeakerEnabled;
    
    // If turning OFF, stop any playing audio
    if (!newState) {
      naturalVoice.stopSpeaking();
    }
    
    setIsSpeakerEnabled(newState);
    
    // Sticky Settings - persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('v4_speaker_enabled', String(newState));
    }
    
    // Retroactive Play: If turning ON, speak the last AI message
    if (newState) {
      const lastAiMessage = [...messages].reverse().find(m => !m.isUser);
      if (lastAiMessage?.content) {
        console.log('🔊 Retroactive Play:', lastAiMessage.content);
        naturalVoice.speak(lastAiMessage.content);
      }
    }
    
    console.log(`🔊 Speaker ${newState ? 'enabled' : 'disabled'}`);
  }, [isSpeakerEnabled, messages]);
  // Note: naturalVoice is not in deps because it's stable (from useNaturalVoice hook)

  // NEW: Pause/Resume handler for dedicated pause button
  // DEPRECATED: Old toggle handler (keep for backward compatibility during transition)
  const toggleNaturalVoice = () => {
    const newState = !isNaturalVoiceEnabled;
    
    // If turning OFF, immediately stop any playing audio
    if (!newState) {
      naturalVoice.stopSpeaking();
    }
    
    setIsNaturalVoiceEnabled(newState);

    // Sticky Settings
    if (typeof window !== 'undefined') {
      localStorage.setItem('v4_natural_voice', String(newState));
    }

    // Retroactive Play: If turning ON, speak the last AI message
    if (newState) {
      // Find the last message that is NOT from the user
      const lastAiMessage = [...messages].reverse().find(m => !m.isUser);
      if (lastAiMessage?.content) {
        console.log('🔊 Retroactive Play:', lastAiMessage.content);
        naturalVoice.speak(lastAiMessage.content);
      }
    } else {
      // If turning OFF, stop any current speech
      // (The hook handles this via the enabled prop, but explicit is good)
    }
  };

  // Handle playback speed change
  const handleSpeedChange = (newSpeed: number) => {
    setPlaybackSpeed(newSpeed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('v4_playback_speed', String(newSpeed));
    }
  };

  // Handle voice selection change
  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoice(voiceId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('v4_selected_voice', voiceId);
      // Dispatch custom event to notify parent components (same-tab updates)
      window.dispatchEvent(new CustomEvent('v4-voice-changed', { detail: voiceId }));
    }
  };

  // Get the Kokoro voice ID for the selected voice
  const getKokoroVoiceId = () => {
    const voice = AVAILABLE_VOICES.find(v => v.id === selectedVoice);
    return voice?.kokoroId || 'af_heart'; // Default to Heart
  };

  // Get speed label for display
  const getSpeedLabel = (speed: number) => {
    if (speed <= 0.75) return 'Slower';
    if (speed <= 0.9) return 'Slow';
    if (speed <= 1.1) return 'Normal';
    if (speed <= 1.25) return 'Fast';
    return 'Faster';
  };

  // Handle VAD sensitivity change
  const handleVadSensitivityChange = (newSensitivity: number) => {
    setVadSensitivity(newSensitivity);
    if (typeof window !== 'undefined') {
      localStorage.setItem('v4_vad_sensitivity', String(newSensitivity));
    }
    console.log(`🎙️ VAD Sensitivity changed to ${newSensitivity} (${getVadSensitivityLabel(newSensitivity)})`);
  };

  // Get VAD sensitivity label for display
  const getVadSensitivityLabel = (sensitivity: number) => {
    if (sensitivity <= 0.35) return 'Low';
    if (sensitivity <= 0.65) return 'Medium';
    return 'High';
  };

  // Close voice settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (voiceSettingsRef.current && !voiceSettingsRef.current.contains(event.target as Node)) {
        setShowVoiceSettings(false);
      }
    };

    if (showVoiceSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVoiceSettings]);

  // FIX #4: Request mic permission when entering guided mode
  useEffect(() => {
    if (isGuidedMode && micPermission !== 'granted') {
      console.log('🧘 Guided Mode: Requesting mic permission on entry...');
      requestMicPermission().then(granted => {
        if (granted) {
          console.log('🧘 Guided Mode: Mic permission granted');
          // Auto-enable mic for guided mode
          if (!isMicEnabled) {
            setIsMicEnabled(true);
            localStorage.setItem('v4_mic_enabled', 'true');
          }
        } else {
          console.warn('🧘 Guided Mode: Mic permission denied - PTT will not work');
        }
      });
    }
  }, [isGuidedMode, micPermission, isMicEnabled, requestMicPermission]);

  // V4: Enhanced performance metrics state
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    cacheHitRate: 0,
    averageResponseTime: 0,
    preloadedResponsesUsed: 0,
    totalResponses: 0,
    validationAccuracy: 0,
    stateTransitionTime: 0,
    memoryUsage: 0
  });
  const [lastResponseTime, setLastResponseTime] = useState<number>(0);
  const [stepHistory, setStepHistory] = useState<StepHistoryEntry[]>([]);
  const [voiceError, setVoiceError] = useState<string>('');
  const [selectedWorkType, setSelectedWorkType] = useState<string | null>(null);
  const [clickedButton, setClickedButton] = useState<string | null>(null);
  const [sessionMethod, setSessionMethod] = useState<string>('mind_shifting');
  const [showEmotionConfirmation, setShowEmotionConfirmation] = useState<boolean>(false);

  // V4: Button visibility state - managed by useEffect for race condition safety
  const [showWorkTypeButtons, setShowWorkTypeButtons] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // V4: Enhanced voice integration (Accessibility)
  const voice = useGlobalVoice({
    onError: (error: string) => {
      console.error('V4 Voice error:', error);
      setVoiceError(error);
    },
    currentStep: currentStep
  });

  // V4: Track expected response type for auto-advance
  const [expectedResponseType, setExpectedResponseType] = useState<string | null>(null);

  // Ref to track the expected response type of the current step (keep for ref access if needed)
  const currentStepTypeRef = useRef<string | null>(null);

  // Handle audio ended event for auto-advance steps
  const handleAudioEnded = useCallback(() => {
    console.log('🔊 Audio ended. Step type:', currentStepTypeRef.current);
    if (currentStepTypeRef.current === 'auto') {
      console.log('⏩ Auto-advancing step (Audio Ended)...');
      // Small delay to ensure natural flow
      setTimeout(() => {
        sendMessage('', true); // Send empty message to trigger next step
      }, 500);
    }
  }, []);

  // Auto-advance logic for Voice Off mode
  useEffect(() => {
    // Only run if we have an auto step and speaker is disabled
    // (If speaker is enabled, handleAudioEnded takes care of it)
    if (expectedResponseType === 'auto' && !isSpeakerEnabled) {
      console.log('⏩ Auto-advance timer started (Voice Off)...');

      // Calculate delay based on last message length
      const lastMessage = messages[messages.length - 1];
      // Default to 3 seconds if no message, otherwise 200ms per word (min 2s, max 10s)
      const wordCount = lastMessage?.content?.split(' ').length || 0;
      const readingDelay = Math.min(Math.max(2000, wordCount * 250), 10000);

      console.log(`⏱️ Waiting ${readingDelay}ms before auto-advancing`);

      const timer = setTimeout(() => {
        console.log('⏩ Auto-advancing step (Timer)...');
        sendMessage('', true);
      }, readingDelay);

      return () => clearTimeout(timer);
    }
  }, [expectedResponseType, isSpeakerEnabled, messages]);

  // State for pending message that's waiting for audio-then-text timing
  const [pendingMessage, setPendingMessage] = useState<{
    content: string;
    responseTime?: number;
    usedAI?: boolean;
    metadata?: any;
  } | null>(null);
  const pendingMessageTimingRef = useRef<{
    audioStartTime?: number;
    textRenderTime?: number;
  }>({});

  // Handler for when audio starts and text should be rendered (with 150ms delay)
  const handleRenderText = useCallback((timing: { audioStartTime: number; textRenderTime: number }) => {
    console.log(`⏱️ V4: Audio started at ${timing.audioStartTime.toFixed(2)}ms, rendering text at ${timing.textRenderTime.toFixed(2)}ms`);
    
    if (pendingMessage) {
      // Now actually add the message to the UI with timing data
      const timedMessage: TreatmentMessage = {
        id: (Date.now() + 1).toString(),
        content: pendingMessage.content,
        isUser: false,
        timestamp: new Date(),
        responseTime: pendingMessage.responseTime,
        usedAI: pendingMessage.usedAI,
        metadata: pendingMessage.metadata,
        version: 'v4',
        audioStartTime: timing.audioStartTime,
        textRenderTime: timing.textRenderTime,
      };
      
      setMessages(prev => [...prev, timedMessage]);
      setPendingMessage(null); // Clear pending message
    }
  }, [pendingMessage]);

  // Handle test audio interruption via VAD (defined before naturalVoice hook)
  const handleTestInterruption = useCallback(() => {
    if (isTestPlaying) {
      console.log('🧪 Test audio interrupted by VAD!');
      setTestInterrupted(true);
      
      // Show feedback briefly then reset
      setTimeout(() => {
        setTestInterrupted(false);
      }, 2000);
    }
  }, [isTestPlaying]);

  // Natural Voice Hook - Updated to use separate mic/speaker controls
  const naturalVoice = useNaturalVoice({
    enabled: isNaturalVoiceEnabled, // DEPRECATED: backward compatibility
    micEnabled: isMicEnabled, // NEW: Controls microphone input
    speakerEnabled: isSpeakerEnabled, // NEW: Controls audio output
    guidedMode: isGuidedMode, // NEW: Guided mode disables auto-restart for PTT
    testMode: isTestPlaying, // NEW: Test mode prevents VAD from triggering speech recognition
    onTranscript: (transcript) => {
      console.log('🗣️ Natural Voice Transcript:', transcript);
      if (!isLoading) {
        sendMessage(transcript);
      }
    },
    voiceProvider: 'kokoro',
    kokoroVoiceId: getKokoroVoiceId(),
    onAudioEnded: handleAudioEnded,
    playbackRate: playbackSpeed,
    onRenderText: handleRenderText, // NEW: Callback for text rendering timing
    vadSensitivity: vadSensitivity, // VAD sensitivity setting
    onVadLevel: (level) => setVadLevel(level), // Update VAD level for meter
    onTestInterruption: handleTestInterruption, // NEW: Handle test mode interruptions
  });

  // V4: Keep focus on input for voice input to work properly
  // This ensures the user can always speak and have their input registered
  useEffect(() => {
    // Only refocus when loading completes and session is active
    if (!isLoading && isSessionActive) {
      // Small delay to let button animations complete
      const focusTimer = setTimeout(() => {
        // Don't steal focus if user is actively typing somewhere else
        const activeElement = document.activeElement;
        const isTypingElsewhere = activeElement?.tagName === 'INPUT' || 
                                   activeElement?.tagName === 'TEXTAREA';
        
        // Focus the input if not already focused on an input
        if (!isTypingElsewhere || activeElement === inputRef.current) {
          inputRef.current?.focus();
        }
      }, 200);
      
      return () => clearTimeout(focusTimer);
    }
  }, [isLoading, isSessionActive]);

  // Cleanup: Stop audio when navigating away from treatment session
  useEffect(() => {
    return () => {
      console.log('🧹 TreatmentSession: Cleaning up - stopping audio');
      naturalVoice.stopSpeaking();
    };
  }, []); // Empty deps - only run on unmount, not on every render

  // Helper function to format method names
  const formatMethodName = (methodName: string) => {
    if (!methodName) return 'Mind Shifting V4.1';

    // Convert snake_case to Title Case
    return methodName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + ' V4.1';
  };

  // Handle pause/resume button click
  const handlePauseResume = useCallback(() => {
    if (naturalVoice.isPaused) {
      console.log('▶️ Resuming audio from pause button');
      naturalVoice.resumeSpeaking();
    } else if (naturalVoice.isSpeaking) {
      console.log('⏸️ Pausing audio from pause button');
      naturalVoice.pauseSpeaking();
    } else {
      console.log('⚠️ Cannot pause/resume - no audio active');
    }
  }, [naturalVoice]);

  // Test Audio Controls (for settings modal demo)
  const startTestAudio = useCallback(() => {
    if (!isSpeakerEnabled) return;
    
    console.log('🧪 Starting test audio loop');
    setIsTestPlaying(true);
    isTestPlayingRef.current = true;
    setTestInterrupted(false);
    
    // Function to play and auto-loop
    const playLoop = () => {
      if (!isTestPlayingRef.current) return;
      
      console.log('🧪 Playing test audio sample');
      naturalVoice.speak(TEST_AUDIO_SAMPLE);
      
      // Schedule next loop
      // Using setInterval would be cleaner but timeout works for variable durations
      testAudioTimeoutRef.current = setTimeout(() => {
        if (isTestPlayingRef.current) {
          console.log('🧪 Looping test audio');
          playLoop(); // Recursive loop
        }
      }, 25000); // ~25 seconds for long phrase at normal speed (adjust based on playbackSpeed)
    };
    
    playLoop(); // Start first iteration
  }, [isSpeakerEnabled, naturalVoice, TEST_AUDIO_SAMPLE]);

  const stopTestAudio = useCallback(() => {
    console.log('🧪 Stopping test audio');
    setIsTestPlaying(false);
    isTestPlayingRef.current = false;
    setTestInterrupted(false);
    
    // Clear timeout
    if (testAudioTimeoutRef.current) {
      clearTimeout(testAudioTimeoutRef.current);
      testAudioTimeoutRef.current = null;
    }
    
    // Stop any playing audio
    naturalVoice.stopSpeaking();
  }, [naturalVoice]);

  // Pause session audio when settings open, auto-start test when settings open
  useEffect(() => {
    if (showVoiceSettings) {
      // Pause any ongoing session audio
      if (naturalVoice.isSpeaking) {
        console.log('⚙️ Settings opened - pausing session audio');
        naturalVoice.pauseSpeaking();
      }
      
      // Auto-start test audio if speaker enabled AND not in guided mode
      // In guided mode (PTT), test audio auto-start is confusing - user must manually start it
      if (isSpeakerEnabled && !isTestPlaying && !isGuidedMode) {
        console.log('⚙️ Settings opened - auto-starting test audio');
        // Store the timeout so it can be cancelled if settings close quickly
        testAutoStartTimeoutRef.current = setTimeout(() => {
          testAutoStartTimeoutRef.current = null;
          startTestAudio();
        }, 300); // Small delay for smooth UX
      } else if (isGuidedMode) {
        console.log('⚙️ Settings opened in guided mode - skipping test audio auto-start');
      }
    } else {
      // Settings closed - cancel any pending auto-start and stop test audio
      if (testAutoStartTimeoutRef.current) {
        clearTimeout(testAutoStartTimeoutRef.current);
        testAutoStartTimeoutRef.current = null;
        console.log('⚙️ Settings closed - cancelled pending test audio auto-start');
      }
      
      if (isTestPlaying) {
        stopTestAudio();
      }
      
      if (naturalVoice.isPaused) {
        console.log('⚙️ Settings closed - resuming session audio');
        naturalVoice.resumeSpeaking();
      }
    }
  }, [showVoiceSettings, isSpeakerEnabled]); // Don't include isTestPlaying to avoid loops

  useEffect(() => {
    return () => {
      if (testAudioTimeoutRef.current) {
        clearTimeout(testAudioTimeoutRef.current);
      }
      if (testAutoStartTimeoutRef.current) {
        clearTimeout(testAutoStartTimeoutRef.current);
      }
    };
  }, []);

  // PTT (Push-to-Talk) handlers for Guided Mode
  const handlePTTStart = useCallback(() => {
    if (!isGuidedMode) return;
    
    console.log('🎙️ PTT: Starting recording');
    
    // FIX #1: Check mic permission first
    if (micPermission !== 'granted') {
      console.warn('🎙️ PTT: Mic permission not granted, requesting...');
      requestMicPermission().then(granted => {
        if (granted) {
          console.log('🎙️ PTT: Permission granted, retrying start');
          handlePTTStart(); // Retry after permission granted
        } else {
          console.error('🎙️ PTT: Permission denied by user');
        }
      });
      return;
    }
    
    // Stop any playing audio immediately
    if (naturalVoice.isSpeaking || naturalVoice.isPaused) {
      naturalVoice.stopSpeaking();
    }
    
    // FIX #3: Clear audio state flags to prevent false positives
    console.log('🎙️ PTT: Clearing audio state flags');
    naturalVoice.clearAudioFlags();
    
    // FIX #2: Force reset recognition state before starting
    // The SpeechRecognition API can get stuck in "starting" or "stopping" state
    console.log('🎙️ PTT: Force starting listening (with state reset)');
    
    // Start user's mic
    naturalVoice.startListening();
    setIsPTTActive(true);
  }, [isGuidedMode, naturalVoice, micPermission, requestMicPermission]);

  const handlePTTEnd = useCallback(() => {
    if (!isGuidedMode) return;
    
    console.log('🎙️ PTT: Ending recording');
    
    // Stop user's mic
    naturalVoice.stopListening();
    setIsPTTActive(false);
  }, [isGuidedMode, naturalVoice]);

  const handlePTTToggle = useCallback(() => {
    if (isPTTActive) {
      handlePTTEnd();
    } else {
      handlePTTStart();
    }
  }, [isPTTActive, handlePTTStart, handlePTTEnd]);

  // Keyboard handlers for desktop guided mode (Space bar PTT + ESC to exit)
  useEffect(() => {
    if (!isGuidedMode) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC key: Exit guided mode (always works, even in input fields)
      if (e.code === 'Escape') {
        e.preventDefault();
        console.log('⌨️ ESC pressed: Exiting guided mode');
        setIsGuidedMode(false);
        localStorage.setItem('v4_guided_mode', 'false');
        if (isPTTActive) {
          handlePTTEnd();
        }
        return;
      }
      
      // Ignore space bar if typing in input field
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Space bar: PTT start (on key press)
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault(); // Don't scroll page
        console.log('⌨️ Space pressed: PTT start', { isPTTActive });
        
        if (!isPTTActive) {
          handlePTTStart();
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // Ignore space bar if typing in input field
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Space bar: PTT end (on key release)
      if (e.code === 'Space') {
        e.preventDefault(); // Don't scroll page
        console.log('⌨️ Space released: PTT end', { isPTTActive });
        
        if (isPTTActive) {
          handlePTTEnd();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isGuidedMode, isPTTActive, handlePTTStart, handlePTTEnd]);

  // Auto-scroll to bottom when NEW messages arrive (not on initial load)
  const prevMessageCount = useRef(0);
  useEffect(() => {
    // Only auto-scroll if this is NOT the first message (initial load)
    // On first load, we want user to see the top of the intro message
    if (messages.length > 1 && messages.length > prevMessageCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCount.current = messages.length;
  }, [messages]);

  // Handler for starting the session (clicking the play button)
  const handleStartSession = () => {
    setShowReadyOverlay(false);
    // Start session immediately after hiding overlay
    if (sessionId && userId && !isSessionActive) {
      if (shouldResume) {
        resumeSession();
      } else {
        startSession();
      }
    }
  };

  // Initialize session on component mount - but wait for user to click Start
  // Removed auto-start useEffect - now controlled by play button

  // V3: Enhanced session start with instant initial message
  const startSession = async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      console.log('Starting V4 treatment session:', { sessionId, userId });

      // V4 OPTIMIZATION: Show hardcoded initial message IMMEDIATELY (0ms perceived delay)
      // This eliminates wait time for database operations on first message
      const instantMessage: TreatmentMessage = {
        id: 'system-init',
        content: V4_STATIC_AUDIO_TEXTS.INITIAL_WELCOME,
        isUser: false,
        timestamp: new Date(),
        version: 'v4'
      };

      setMessages([instantMessage]);
      setCurrentStep('mind_shifting_explanation_static');
      setIsSessionActive(true);
      setIsLoading(false); // Stop loading immediately - user can interact now

      // Focus input immediately for user interaction
      setTimeout(() => {
        inputRef.current?.focus();
        // Speak initial message if speaker enabled - with delay to ensure state is settled
        if (isSpeakerEnabled) {
          // Use setTimeout to ensure all React state updates and cleanups are complete
          setTimeout(() => {
            naturalVoice.speak(instantMessage.content);
          }, 150);
        }
      }, 100);

      // Backend processing happens in background (doesn't block UI)
      const response = await fetch('/api/treatment-v4', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start',
          sessionId,
          userId
        }),
      });

      if (!response.ok) {
        throw new Error(`V4 HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('V4 Start session response:', data);

      if (data.success) {
        // Update performance metrics from backend (but message already displayed)
        if (data.performanceMetrics) {
          setPerformanceMetrics(prev => ({
            ...prev,
            ...data.performanceMetrics,
            validationAccuracy: data.performanceMetrics.validationAccuracy || prev.validationAccuracy,
            stateTransitionTime: data.responseTime || prev.stateTransitionTime,
            memoryUsage: data.performanceMetrics.memoryUsage || prev.memoryUsage
          }));
        }
      } else {
        throw new Error(data.error || 'Failed to start V4 session');
      }
    } catch (error) {
      console.error('V4 Start session error:', error);
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown V4 error');
      onError?.(error instanceof Error ? error.message : 'Unknown V4 error');
      // Set loading false on error so user can retry
      setIsLoading(false);
    }
  };

  // V3: Enhanced session resume
  const resumeSession = async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      console.log('Resuming V4 treatment session:', { sessionId, userId });

      const response = await fetch('/api/treatment-v4', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'resume',
          sessionId,
          userId
        }),
      });

      if (!response.ok) {
        throw new Error(`V4 HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('V4 Resume session response:', data);

      if (data.success) {
        // Restore conversation history
        const restoredMessages: TreatmentMessage[] = data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          version: 'v4'
        }));

        setMessages(restoredMessages);
        setCurrentStep(data.currentStep);
        setIsSessionActive(true);

        // Restore session metadata
        if (data.session?.metadata) {
          setSelectedWorkType(data.session.metadata.workType || null);
          setSessionMethod(data.session.metadata.selectedMethod || 'mind_shifting');
        }

        // Focus input for continued interaction
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      } else {
        // If resume fails, start a new session
        console.log('V4 Resume failed, starting new session');
        await startSession();
      }
    } catch (error) {
      console.error('V4 Resume session error:', error);
      // Fallback to starting new session
      console.log('V4 Resume failed, falling back to new session');
      await startSession();
    } finally {
      setIsLoading(false);
    }
  };

  // V3: Enhanced message sending
  const sendMessage = async (content: string, isAutoAdvance = false) => {
    if ((!content.trim() && !isAutoAdvance) || isLoading) return;

    // Stop current audio if user is advancing to next step (only if speaker was enabled)
    if ((isMicEnabled || isSpeakerEnabled) && naturalVoice.isSpeaking) {
      console.log('🛑 Stopping current audio - user advancing to next step');
      naturalVoice.stopSpeaking();
    }

    const userMessage: TreatmentMessage = {
      id: `user-${Date.now()}`,
      content: content.trim(),
      isUser: true,
      timestamp: new Date(),
      version: 'v4'
    };

    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);
    setHasError(false);
    setClickedButton(null);

    // Save step history before processing
    const historyEntry: StepHistoryEntry = {
      messages: [...messages, userMessage],
      currentStep,
      userInput: content.trim(),
      sessionStats,
      timestamp: Date.now(),
      version: 'v4'
    };
    setStepHistory(prev => [...prev, historyEntry]);

    try {
      console.log('Sending V4 message:', { content, currentStep });

      const response = await fetch('/api/treatment-v4', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'continue',
          sessionId,
          userId,
          userInput: content.trim()
        }),
      });

      if (!response.ok) {
        throw new Error(`V4 HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('V4 Continue session response:', data);

      if (data.success) {
        // Don't display "Choose a method:" message when buttons will be shown
        const shouldSkipMessage = data.message === "Choose a method:" ||
          (data.currentStep === 'choose_method' &&
            data.message.includes('Choose a method'));

        if (!shouldSkipMessage) {
          // NEW: If speaker is enabled, set up pending message for audio-then-text timing
          if (isSpeakerEnabled && data.message) {
            console.log('⏱️ V4: Setting up pending message for audio-first rendering');
            setPendingMessage({
              content: data.message,
              responseTime: data.responseTime,
              usedAI: data.usedAI,
              metadata: { version: 'v4' }
            });
            
            // Start audio playback (will trigger handleRenderText after 150ms)
            naturalVoice.speak(data.message);
          } else {
            // Speaker disabled: add message immediately (no timing data)
            const systemMessage: TreatmentMessage = {
              id: `system-${Date.now()}`,
              content: data.message,
              isUser: false,
              timestamp: new Date(),
              responseTime: data.responseTime,
              usedAI: data.usedAI,
              version: 'v4'
            };

            setMessages(prev => [...prev, systemMessage]);

            // Use global voice if enabled
            if (voice.isVoiceOutputEnabled) {
              voice.speakGlobally(data.message);
            }
          }
        }

        setCurrentStep(data.currentStep);
        setLastResponseTime(data.responseTime || 0);

        // Update step type ref for auto-advance logic
        currentStepTypeRef.current = data.expectedResponseType || null;
        setExpectedResponseType(data.expectedResponseType || null);
        // V3: Update enhanced performance metrics
        if (data.performanceMetrics) {
          setPerformanceMetrics(prev => ({
            ...prev,
            ...data.performanceMetrics,
            validationAccuracy: data.performanceMetrics.validationAccuracy || prev.validationAccuracy,
            stateTransitionTime: data.responseTime || prev.stateTransitionTime,
            memoryUsage: data.performanceMetrics.memoryUsage || prev.memoryUsage
          }));
        }

        // Update session stats
        setSessionStats(prev => ({
          totalResponses: prev.totalResponses + 1,
          avgResponseTime: Math.round((prev.avgResponseTime * prev.totalResponses + (data.responseTime || 0)) / (prev.totalResponses + 1)),
          aiUsagePercent: data.usedAI ? Math.round(((prev.aiUsagePercent * prev.totalResponses) + 100) / (prev.totalResponses + 1)) : Math.round((prev.aiUsagePercent * prev.totalResponses) / (prev.totalResponses + 1)),
          version: 'v4'
        }));

        // Handle special UI states
        if (data.showEmotionConfirmation) {
          setShowEmotionConfirmation(true);
        } else {
          setShowEmotionConfirmation(false);
        }

        // Check for session completion
        if (data.currentStep === 'session_complete') {
          setIsSessionActive(false);
          onComplete?.(data);
        }

      } else {
        throw new Error(data.error || 'Failed to process V4 message');
      }
    } catch (error) {
      console.error('V4 Send message error:', error);
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown V4 error');

      // Add error message to conversation
      const errorMessage: TreatmentMessage = {
        id: `error-${Date.now()}`,
        content: `V4 Error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        isUser: false,
        timestamp: new Date(),
        version: 'v4'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Refocus input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  // V3: Enhanced undo functionality
  const handleUndo = async () => {
    if (stepHistory.length === 0 || isLoading) return;

    const lastEntry = stepHistory[stepHistory.length - 1];
    setIsLoading(true);

    try {
      console.log('V4 Undo to step:', lastEntry.currentStep);

      const response = await fetch('/api/treatment-v4', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'undo',
          sessionId,
          userId,
          undoToStep: lastEntry.currentStep
        }),
      });

      if (!response.ok) {
        throw new Error(`V4 Undo HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('V4 Undo response:', data);

      if (data.success) {
        // Restore previous state
        setMessages(lastEntry.messages);
        setCurrentStep(lastEntry.currentStep);
        setSessionStats(lastEntry.sessionStats);
        setUserInput(lastEntry.userInput);

        // Remove the last entry from history
        setStepHistory(prev => prev.slice(0, -1));

        console.log('V4 Undo successful');
      } else {
        throw new Error(data.error || 'V4 Undo failed');
      }
    } catch (error) {
      console.error('V4 Undo error:', error);
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : 'V4 Undo failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userInput.trim() && !isLoading) {
      sendMessage(userInput.trim());
    }
  };

  // Handle button clicks for emotion confirmation
  const handleButtonClick = (buttonText: string) => {
    // Stop current audio if user is advancing to next step
    if ((isMicEnabled || isSpeakerEnabled) && naturalVoice.isSpeaking) {
      console.log('🛑 Stopping current audio - user clicked button');
      naturalVoice.stopSpeaking();
    }
    setClickedButton(buttonText);
    sendMessage(buttonText);
  };

  // V3: RACE CONDITION FIX - Use useEffect to compute button visibility after all state updates complete
  // This ensures we see consistent state, not partial updates during rapid re-renders
  useEffect(() => {
    // Check if we're in the initial explanation step
    const isInitialStep = currentStep === 'mind_shifting_explanation_dynamic' || currentStep === 'mind_shifting_explanation_static';

    console.log('🔍 BUTTON CHECK (useEffect):', {
      currentStep,
      isInitialStep,
      isLoading,
      isSessionActive,
      messagesCount: messages.length,
      userMessagesCount: messages.filter(m => m.isUser).length
    });

    if (!isInitialStep) {
      console.log('❌ Not initial step');
      setShowWorkTypeButtons(false);
      return;
    }

    // Don't show if we're loading or session isn't active
    if (isLoading || !isSessionActive) {
      console.log('❌ Loading or session inactive:', { isLoading, isSessionActive });
      setShowWorkTypeButtons(false);
      return;
    }

    // Check the last bot message to see if it contains the work type options
    const lastBotMessage = messages.filter(m => !m.isUser).pop();
    if (!lastBotMessage) {
      console.log('❌ No bot message found');
      setShowWorkTypeButtons(false);
      return;
    }

    console.log('📝 Last bot message:', lastBotMessage.content.substring(0, 100) + '...');

    // Show buttons if the message contains the work type selection text
    const containsWorkTypeSelection = lastBotMessage.content.includes('1. PROBLEM') &&
      lastBotMessage.content.includes('2. GOAL') &&
      lastBotMessage.content.includes('3. NEGATIVE EXPERIENCE');

    console.log('✅ Contains work type text:', containsWorkTypeSelection);

    // Don't show if AI is asking clarifying questions
    if (lastBotMessage.usedAI) {
      console.log('❌ Message used AI');
      setShowWorkTypeButtons(false);
      return;
    }

    // Don't show if user has already made multiple inputs (likely past selection)
    const userMessages = messages.filter(m => m.isUser);
    if (userMessages.length >= 2) {
      console.log('❌ Too many user messages:', userMessages.length);
      setShowWorkTypeButtons(false);
      return;
    }

    console.log('✅ SETTING BUTTONS TO SHOW:', containsWorkTypeSelection);
    setShowWorkTypeButtons(containsWorkTypeSelection);
  }, [currentStep, isLoading, isSessionActive, messages]); // Run after these change

  // V3: Handle work type selection button clicks
  const handleWorkTypeSelection = (workType: string) => {
    // Stop current audio if user is advancing to next step
    if ((isMicEnabled || isSpeakerEnabled) && naturalVoice.isSpeaking) {
      console.log('🛑 Stopping current audio - user selected work type');
      naturalVoice.stopSpeaking();
    }
    
    setClickedButton(workType);

    // Display the full work type name in the UI
    const workTypeMap: { [key: string]: string } = {
      '1': 'PROBLEM',
      '2': 'GOAL',
      '3': 'NEGATIVE EXPERIENCE'
    };

    const displayText = workTypeMap[workType] || workType;

    // Create user message with display text
    const userMessage: TreatmentMessage = {
      id: `user-${Date.now()}`,
      content: displayText,
      isUser: true,
      timestamp: new Date(),
      version: 'v4'
    };
    setMessages(prev => [...prev, userMessage]);
    setClickedButton(null);
    setUserInput('');
    setIsLoading(true);
    setHasError(false);

    // Save step history
    const historyEntry: StepHistoryEntry = {
      messages: [...messages, userMessage],
      currentStep,
      userInput: workType,
      sessionStats,
      timestamp: Date.now(),
      version: 'v4'
    };
    setStepHistory(prev => [...prev, historyEntry]);

    // Continue with backend call using the number
    fetch('/api/treatment-v4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'continue',
        sessionId,
        userId,
        userInput: workType
      }),
    })
      .then(async response => {
        console.log('Work type selection response status:', response.status);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Work type selection HTTP error:', response.status, errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Work type selection response data:', data);
        
        // Check if response indicates an error
        if (data.error || !data.success) {
          console.error('Work type selection failed:', data.error || 'Unknown error', data.details);
          throw new Error(data.error || data.details || 'Failed to process work type selection');
        }
        
        if (data.success) {
          // Skip "Choose a method:" message if buttons will be shown
          const shouldSkipMessage = data.message === "Choose a method:" ||
            (data.currentStep === 'choose_method' &&
              data.message.includes('Choose a method'));

          if (!shouldSkipMessage) {
            // NEW: If speaker is enabled, set up pending message for audio-then-text timing
            if (isSpeakerEnabled && data.message) {
              console.log('⏱️ V4: Setting up pending message for audio-first rendering (work type)');
              setPendingMessage({
                content: data.message,
                responseTime: data.responseTime,
                usedAI: data.usedAI,
                metadata: { version: 'v4' }
              });
              
              // Start audio playback (will trigger handleRenderText after 150ms)
              console.log('🔊 Playing new audio after work type selection');
              naturalVoice.speak(data.message);
            } else {
              // Speaker disabled: add message immediately
              const systemMessage: TreatmentMessage = {
                id: `system-${Date.now()}`,
                content: data.message,
                isUser: false,
                timestamp: new Date(),
                responseTime: data.responseTime,
                usedAI: data.usedAI,
                version: 'v4'
              };
              setMessages(prev => [...prev, systemMessage]);
              
              // Use global voice if enabled
              if (voice.isVoiceOutputEnabled) {
                voice.speakGlobally(data.message);
              }
            }
          }

          setCurrentStep(data.currentStep);
          setLastResponseTime(data.responseTime || 0);

          if (data.performanceMetrics) {
            setPerformanceMetrics(prev => ({
              ...prev,
              ...data.performanceMetrics
            }));
          }

          if (data.currentStep) {
            setSessionStats(prev => ({
              ...prev,
              totalResponses: prev.totalResponses + 1
            }));
          }
        }
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Work type selection error:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        setHasError(true);
        setErrorMessage(`Failed to process work type selection: ${error.message || 'Unknown error'}`);
        setIsLoading(false);
      });
  };

  // V3: Helper function to determine if we should show method selection buttons
  const shouldShowMethodSelection = () => {
    // Check if we're in the method selection step
    const isMethodSelectionStep = currentStep === 'choose_method';

    if (!isMethodSelectionStep) return false;

    // Don't show if we're loading or session isn't active
    if (isLoading || !isSessionActive) return false;

    // Show buttons for choose_method step
    console.log('✅ METHOD BUTTONS: Showing buttons for choose_method step');
    return true;
  };

  // V3: Helper function to determine if we should show Yes/No buttons for trauma intro
  const shouldShowTraumaYesNoButtons = () => {
    // Check if we're in trauma_shifting_intro step
    if (currentStep !== 'trauma_shifting_intro') return false;

    // Don't show if we're loading or session isn't active
    if (isLoading || !isSessionActive) return false;

    console.log('✅ TRAUMA YES/NO BUTTONS: Showing for trauma_shifting_intro step');
    return true;
  };

  // V3: Helper function to determine if we should show Yes/No buttons for confirm statement
  const shouldShowConfirmStatementButtons = () => {
    // Check if we're in confirm_statement step
    if (currentStep !== 'confirm_statement') return false;

    // Don't show if we're loading or session isn't active
    if (isLoading || !isSessionActive) return false;

    console.log('✅ CONFIRM STATEMENT YES/NO BUTTONS: Showing for confirm_statement step');
    return true;
  };

  const shouldShowGoalYesNoButtons = () => {
    // Check if we're in goal yes/no steps
    const goalYesNoSteps = ['goal_deadline_check', 'goal_confirmation'];
    if (!goalYesNoSteps.includes(currentStep)) return false;

    // Don't show if we're loading or session isn't active
    if (isLoading || !isSessionActive) return false;

    console.log(`✅ GOAL YES/NO BUTTONS: Showing for ${currentStep} step`);
    return true;
  };

  // V4: GENERIC Yes/No button helper - automatically detects any yes/no step
  // This covers all 37 missing yes/no steps without needing individual helpers
  const shouldShowGenericYesNoButtons = () => {
    // Only show if expectedResponseType is 'yesno'
    if (expectedResponseType !== 'yesno') return false;

    // Don't show if we're loading or session isn't active
    if (isLoading || !isSessionActive) return false;

    // Exclude steps that have specific button implementations
    const specificYesNoSteps = [
      'trauma_shifting_intro',    // Has shouldShowTraumaYesNoButtons
      'confirm_statement',          // Has shouldShowConfirmStatementButtons
      'goal_deadline_check',        // Has shouldShowGoalYesNoButtons
      'goal_confirmation'           // Has shouldShowGoalYesNoButtons
    ];
    
    if (specificYesNoSteps.includes(currentStep)) return false;

    console.log(`✅ GENERIC YES/NO BUTTONS: Showing for ${currentStep} step (expectedResponseType: yesno)`);
    return true;
  };

  // V3: Handle Yes/No button clicks for trauma intro and confirm statement
  const handleYesNoClick = (response: string) => {
    // Stop current audio if user is advancing to next step
    if ((isMicEnabled || isSpeakerEnabled) && naturalVoice.isSpeaking) {
      console.log('🛑 Stopping current audio - user clicked yes/no');
      naturalVoice.stopSpeaking();
    }
    setClickedButton(response);
    sendMessage(response);
  };

  // V3: Handle method selection button clicks
  const handleMethodSelection = (method: string) => {
    // Stop current audio if user is advancing to next step
    if ((isMicEnabled || isSpeakerEnabled) && naturalVoice.isSpeaking) {
      console.log('🛑 Stopping current audio - user selected method');
      naturalVoice.stopSpeaking();
    }
    
    setClickedButton(method);
    // Send the method number to backend but display full name to user
    const methodMap: { [key: string]: string } = {
      'Problem Shifting': '1',
      'Identity Shifting': '2',
      'Belief Shifting': '3',
      'Blockage Shifting': '4'
    };

    // Display the full method name in the UI
    const userMessage: TreatmentMessage = {
      id: `user-${Date.now()}`,
      content: method,
      isUser: true,
      timestamp: new Date(),
      version: 'v4'
    };
    setMessages(prev => [...prev, userMessage]);
    setClickedButton(null);

    // Send the number to the backend (what it expects)
    const methodNumber = methodMap[method] || method;
    setUserInput('');
    setIsLoading(true);
    setHasError(false);

    // Save step history
    const historyEntry: StepHistoryEntry = {
      messages: [...messages, userMessage],
      currentStep,
      userInput: methodNumber,
      sessionStats,
      timestamp: Date.now(),
      version: 'v4'
    };
    setStepHistory(prev => [...prev, historyEntry]);

    // Continue with backend call
    fetch('/api/treatment-v4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'continue',
        sessionId,
        userId,
        userInput: methodNumber
      }),
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // NEW: If speaker is enabled, set up pending message for audio-then-text timing
          if (isSpeakerEnabled && data.message) {
            console.log('⏱️ V4: Setting up pending message for audio-first rendering (method selection)');
            setPendingMessage({
              content: data.message,
              responseTime: data.responseTime,
              usedAI: data.usedAI,
              metadata: { version: 'v4' }
            });
            
            // Start audio playback (will trigger handleRenderText after 150ms)
            console.log('🔊 Playing new audio after method selection');
            naturalVoice.speak(data.message);
          } else {
            // Speaker disabled: add message immediately
            const systemMessage: TreatmentMessage = {
              id: `system-${Date.now()}`,
              content: data.message,
              isUser: false,
              timestamp: new Date(),
              responseTime: data.responseTime,
              usedAI: data.usedAI,
              version: 'v4'
            };
            setMessages(prev => [...prev, systemMessage]);
            
            // Use global voice if enabled
            if (voice.isVoiceOutputEnabled) {
              voice.speakGlobally(data.message);
            }
          }
          
          setCurrentStep(data.currentStep);
          setLastResponseTime(data.responseTime || 0);

          if (data.performanceMetrics) {
            setPerformanceMetrics(prev => ({
              ...prev,
              ...data.performanceMetrics
            }));
          }

          if (data.currentStep) {
            setSessionStats(prev => ({
              ...prev,
              totalResponses: prev.totalResponses + 1
            }));
          }
        }
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Method selection error:', error);
        setHasError(true);
        setErrorMessage('Failed to process method selection');
        setIsLoading(false);
      });
  };

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 relative flex flex-col h-full min-h-[calc(100vh-140px)] md:min-h-[calc(100vh-120px)]">
      {/* Guided Mode Full-Screen PTT Interface */}
      {isGuidedMode && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center">
          {/* Exit button */}
          <button 
            onClick={() => {
              setIsGuidedMode(false);
              localStorage.setItem('v4_guided_mode', 'false');
              if (isPTTActive) {
                handlePTTEnd();
              }
            }}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-lg px-4 py-2 bg-black/20 hover:bg-black/30 rounded-lg transition-all backdrop-blur-sm"
          >
            ✕ Exit Guided Mode
          </button>

          {/* Status indicator at top */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {isPTTActive ? '🔴 Recording...' : 
             naturalVoice.isSpeaking ? '🔊 AI Speaking...' : 
             '🧘 Ready - Hold to speak'}
          </div>

          {/* Main PTT Button */}
          <button
            onPointerDown={handlePTTStart}
            onPointerUp={handlePTTEnd}
            onPointerLeave={handlePTTEnd}
            className={`
              w-64 h-64 md:w-80 md:h-80 rounded-full 
              ${isPTTActive 
                ? 'bg-red-500 animate-pulse ring-8 ring-red-300/50 scale-105' 
                : naturalVoice.isSpeaking
                ? 'bg-indigo-500 ring-8 ring-indigo-300/30 animate-pulse'
                : 'bg-purple-600 ring-4 ring-purple-300/50 hover:ring-8 hover:scale-105'
              }
              flex flex-col items-center justify-center
              text-white font-bold
              transition-all duration-300
              shadow-2xl
              active:scale-95
              cursor-pointer
              select-none
            `}
          >
            {isPTTActive ? (
              <>
                <div className="text-7xl mb-4 animate-bounce">🔴</div>
                <div className="text-2xl mb-2">Speaking...</div>
                <div className="text-sm opacity-75">Release to send</div>
              </>
            ) : naturalVoice.isSpeaking ? (
              <>
                <div className="text-7xl mb-4">🔊</div>
                <div className="text-2xl mb-2">AI Speaking</div>
                <div className="text-sm opacity-75">Hold to interrupt</div>
              </>
            ) : (
              <>
                <div className="text-7xl mb-4">🎙️</div>
                <div className="text-2xl mb-2">Hold to Speak</div>
                <div className="text-sm opacity-75 hidden md:block">or press Space</div>
              </>
            )}
          </button>

          {/* Instructions at bottom */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-sm text-center max-w-md px-4">
            <p className="mb-2">Close your eyes and speak when ready</p>
            <p className="text-xs opacity-75">
              <span className="md:hidden">Hold the button to speak</span>
              <span className="hidden md:inline">Hold button or press Space bar to speak</span>
            </p>
          </div>
        </div>
      )}

      {/* Ready Overlay - Shows before session starts */}
      {showReadyOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="text-center px-4">
            <div className="mb-8">
              <Brain className="h-16 w-16 sm:h-20 sm:w-20 text-indigo-600 mx-auto mb-4 animate-pulse" />
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                Ready to Begin?
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
                Audio is preloaded and ready. Click the button below to start your treatment session.
              </p>
            </div>
            <button
              onClick={handleStartSession}
              className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              <Play className="h-6 w-6 mr-2 group-hover:scale-110 transition-transform" />
              Start Session
            </button>
            <p className="mt-6 text-xs text-muted-foreground">
              Make sure you're in a quiet space where you can focus
            </p>
          </div>
        </div>
      )}

      {/* V4 Header - Mobile: Slim sticky bar / Desktop: Full card */}
      
      {/* Mobile Header - 2x2 Grid, sticky below page header (h-14 = 56px) */}
      <div className="flex md:hidden flex-col gap-2 px-3 py-2.5 mb-2 bg-card dark:bg-[#073642] rounded-lg border border-border dark:border-[#586e75] sticky top-14 z-30">
        {/* Audio Controls - 2x2 Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Microphone Toggle */}
          <button
            onClick={toggleMic}
            disabled={micPermission === 'denied'}
            className={`flex items-center justify-center space-x-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors ${isMicEnabled
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 ring-2 ring-indigo-500'
              : 'bg-secondary text-muted-foreground dark:bg-[#586e75] dark:text-[#93a1a1]'
              } ${micPermission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={
              !isMicEnabled ? 'Enable Microphone' :
              naturalVoice.listeningState === 'listening' ? 'Listening...' :
              naturalVoice.listeningState === 'restarting' ? 'Restarting...' :
              naturalVoice.listeningState === 'blockedByAudio' ? 'Blocked (AI speaking)' :
              naturalVoice.listeningState === 'micDisabled' ? 'Microphone disabled' :
              naturalVoice.listeningState === 'permissionDenied' ? 'Permission denied' :
              naturalVoice.listeningState === 'unsupported' ? 'Not supported' :
              naturalVoice.listeningState === 'error' ? 'Error' :
              'Ready'
            }
          >
            {isMicEnabled ? (
              <>
                {naturalVoice.isListening ? (
                  <Mic className="h-4 w-4 animate-pulse text-red-500" />
                ) : naturalVoice.listeningState === 'restarting' ? (
                  <Mic className="h-4 w-4 animate-spin text-yellow-500" />
                ) : naturalVoice.listeningState === 'blockedByAudio' ? (
                  <Mic className="h-4 w-4 text-gray-400" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                <span>🎤</span>
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                <span>🎤</span>
              </>
            )}
          </button>
          
          {/* Speaker Toggle */}
          <button
            onClick={toggleSpeaker}
            className={`flex items-center justify-center space-x-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors ${isSpeakerEnabled
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 ring-2 ring-indigo-500'
              : 'bg-secondary text-muted-foreground dark:bg-[#586e75] dark:text-[#93a1a1]'
              }`}
            title="Toggle Speaker"
          >
            {isSpeakerEnabled ? (
              <>
                {naturalVoice.isSpeaking ? (
                  <Volume2 className="h-4 w-4 animate-pulse" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
                <span>🔊</span>
              </>
            ) : (
              <>
                <VolumeX className="h-4 w-4" />
                <span>🔊</span>
              </>
            )}
          </button>

          {/* Pause/Play Button - ALWAYS visible, disabled when no audio */}
          <button
            onClick={handlePauseResume}
            disabled={!naturalVoice.isSpeaking && !naturalVoice.isPaused}
            className={`flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
              naturalVoice.isPaused
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 ring-2 ring-green-500'
                : naturalVoice.isSpeaking
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 ring-2 ring-yellow-500'
                : 'bg-secondary text-muted-foreground dark:bg-[#586e75] dark:text-[#93a1a1] opacity-50 cursor-not-allowed'
            }`}
            title={
              !naturalVoice.isSpeaking && !naturalVoice.isPaused
                ? "No audio playing"
                : naturalVoice.isPaused
                ? "Resume audio"
                : "Pause audio"
            }
          >
            {naturalVoice.isPaused ? (
              <Play className="h-5 w-5" />
            ) : (
              <span className="text-lg">⏸️</span>
            )}
          </button>

          {/* Settings & Undo - Split equally in the 4th grid cell */}
          <div className="flex gap-1">
            {/* Settings Button - Half width */}
            <button
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              className={`flex-1 flex items-center justify-center rounded-full transition-colors ${
                showVoiceSettings
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                  : 'bg-secondary text-muted-foreground dark:bg-[#586e75] dark:text-[#93a1a1]'
              }`}
              title="Voice Settings"
            >
              <Settings className="h-5 w-5" />
            </button>

            {/* Undo Button - Half width, always visible */}
            <button
              onClick={handleUndo}
              disabled={stepHistory.length === 0 || isLoading}
              className={`flex-1 flex items-center justify-center rounded-full transition-colors ${
                stepHistory.length > 0 && !isLoading
                  ? 'bg-secondary text-foreground dark:bg-[#586e75] dark:text-[#93a1a1]'
                  : 'bg-secondary text-muted-foreground dark:bg-[#586e75] dark:text-[#93a1a1] opacity-50 cursor-not-allowed'
              }`}
              title="Undo last message"
            >
              <Undo2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Header - STICKY to top */}
      <div className="hidden md:block bg-card dark:bg-[#073642] rounded-lg shadow-sm border border-border dark:border-[#586e75] mb-6 sticky top-0 z-30">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border dark:border-[#586e75]">
          
          {/* Desktop Layout: Full header */}
          <div className="flex flex-col space-y-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            {/* Title Section */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
              <h2 className="text-base sm:text-xl font-semibold text-foreground dark:text-[#fdf6e3] truncate">
                {formatMethodName(sessionMethod)}
              </h2>
              <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 rounded-full flex items-center space-x-1 flex-shrink-0">
                <Sparkles className="h-3 w-3" />
                <span>V4.1</span>
              </span>
            </div>

            {/* Controls Section - Desktop: 2x2 Grid for Audio Controls */}
            <div className="flex flex-col gap-3">
              {/* Performance Indicators Row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-3 text-xs sm:text-sm text-muted-foreground dark:text-[#93a1a1]">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span>{lastResponseTime}ms</span>
                  </div>

                  {performanceMetrics.cacheHitRate > 0 && (
                    <div className="flex items-center space-x-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span>{performanceMetrics.cacheHitRate.toFixed(0)}%</span>
                    </div>
                  )}
                </div>

                {/* Undo Button - Original code, just repositioned */}
                {stepHistory.length > 0 && (
                  <button
                    onClick={handleUndo}
                    disabled={isLoading}
                    className="flex items-center space-x-1 px-2 sm:px-3 py-1 text-xs sm:text-sm text-muted-foreground dark:text-[#93a1a1] hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    <Undo2 className="h-4 w-4" />
                    <span>Undo</span>
                  </button>
                )}
              </div>

              {/* Audio Controls - 2x2 Grid */}
              <div className="grid grid-cols-2 gap-2">
                {/* Microphone Toggle */}
                <button
                  onClick={toggleMic}
                  disabled={micPermission === 'denied'}
                  className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-full text-sm font-medium transition-colors ${isMicEnabled
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 ring-2 ring-indigo-500 ring-offset-1'
                    : 'bg-secondary text-muted-foreground dark:bg-[#586e75] dark:text-[#93a1a1] hover:bg-secondary dark:hover:bg-[#657b83]'
                    } ${micPermission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={
                    !isMicEnabled ? 'Enable Microphone' :
                    naturalVoice.listeningState === 'listening' ? 'Listening...' :
                    naturalVoice.listeningState === 'restarting' ? 'Restarting...' :
                    naturalVoice.listeningState === 'blockedByAudio' ? 'Blocked (AI speaking)' :
                    naturalVoice.listeningState === 'micDisabled' ? 'Microphone disabled' :
                    naturalVoice.listeningState === 'permissionDenied' ? 'Permission denied' :
                    naturalVoice.listeningState === 'unsupported' ? 'Not supported' :
                    naturalVoice.listeningState === 'error' ? 'Error' :
                    'Ready'
                  }
                >
                  {isMicEnabled ? (
                    <>
                      {naturalVoice.isListening ? (
                        <Mic className="h-4 w-4 animate-pulse text-red-500" />
                      ) : naturalVoice.listeningState === 'restarting' ? (
                        <Mic className="h-4 w-4 animate-spin text-yellow-500" />
                      ) : naturalVoice.listeningState === 'blockedByAudio' ? (
                        <Mic className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                      <span>🎤 Mic On</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      <span>🎤 Mic Off</span>
                    </>
                  )}
                </button>

                {/* Speaker Toggle */}
                <button
                  onClick={toggleSpeaker}
                  className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-full text-sm font-medium transition-colors ${isSpeakerEnabled
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 ring-2 ring-indigo-500 ring-offset-1'
                    : 'bg-secondary text-muted-foreground dark:bg-[#586e75] dark:text-[#93a1a1] hover:bg-secondary dark:hover:bg-[#657b83]'
                    }`}
                  title="Toggle Audio Output"
                >
                  {isSpeakerEnabled ? (
                    <>
                      {naturalVoice.isSpeaking ? (
                        <Volume2 className="h-4 w-4 animate-pulse" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                      <span>🔊 Audio On</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="h-4 w-4" />
                      <span>🔊 Audio Off</span>
                    </>
                  )}
                </button>

                {/* Pause/Play Button - ALWAYS visible, disabled when no audio */}
                <button
                  onClick={handlePauseResume}
                  disabled={!naturalVoice.isSpeaking && !naturalVoice.isPaused}
                  className={`flex items-center justify-center px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                    naturalVoice.isPaused
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 ring-2 ring-green-500 ring-offset-1'
                      : naturalVoice.isSpeaking
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 ring-2 ring-yellow-500 ring-offset-1'
                      : 'bg-secondary text-muted-foreground dark:bg-[#586e75] dark:text-[#93a1a1] opacity-50 cursor-not-allowed'
                  }`}
                  title={
                    !naturalVoice.isSpeaking && !naturalVoice.isPaused
                      ? "No audio playing"
                      : naturalVoice.isPaused
                      ? "Resume audio"
                      : "Pause audio"
                  }
                >
                  {naturalVoice.isPaused ? (
                    <span className="flex items-center space-x-1.5">
                      <Play className="h-4 w-4" />
                      <span>Resume</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1.5">
                      <span className="text-base">⏸️</span>
                      <span>Pause</span>
                    </span>
                  )}
                </button>

                {/* Settings Button */}
                <button
                  onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                  className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                    showVoiceSettings
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                      : 'bg-secondary text-muted-foreground dark:bg-[#586e75] dark:text-[#93a1a1] hover:bg-secondary/80 dark:hover:bg-[#657b83]'
                  }`}
                  title="Voice Settings"
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </button>
              </div>
            </div>
          </div>
          {/* End Desktop Layout */}
        </div>
      </div>

      {/* Voice Settings Modal - Separate from headers, bottom sheet on mobile, centered on desktop */}
      {showVoiceSettings && (
        <>
          {/* Overlay backdrop */}
          <div 
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowVoiceSettings(false)}
          />
          
          {/* Modal content - bottom sheet on mobile, centered modal on desktop */}
          <div className="fixed bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:w-80 md:max-w-[90vw] bg-card dark:bg-[#073642] border-t md:border border-border dark:border-[#586e75] md:rounded-xl shadow-xl p-4 pb-8 md:pb-4 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl md:rounded-xl">
            {/* Mobile drag handle */}
            <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-4 md:hidden" />
            
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg md:text-sm font-semibold text-foreground dark:text-[#fdf6e3] flex items-center space-x-2">
                <Settings className="h-5 w-5 md:h-4 md:w-4 text-indigo-500" />
                <span>Voice Settings</span>
              </h3>
              <button
                onClick={() => setShowVoiceSettings(false)}
                className="text-muted-foreground hover:text-foreground text-2xl md:text-xl leading-none p-1 -mr-1"
                aria-label="Close settings"
              >
                ×
              </button>
            </div>

            {/* Voice Selector */}
            {AVAILABLE_VOICES.length > 1 && (
              <div className="space-y-3 mb-4 pb-4 border-b border-border dark:border-[#586e75]">
                <div className="flex items-center space-x-2 text-sm font-medium text-foreground dark:text-[#fdf6e3]">
                  <User className="h-4 w-4 text-indigo-500" />
                  <span>Voice Actor</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_VOICES.map((voiceOption) => (
                    <button
                      key={voiceOption.id}
                      onClick={() => handleVoiceChange(voiceOption.id)}
                      className={`w-full text-left px-3 py-3 md:py-2 rounded-lg text-sm transition-colors ${
                        selectedVoice === voiceOption.id
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500'
                          : 'bg-secondary dark:bg-[#586e75] text-muted-foreground dark:text-[#93a1a1] hover:bg-secondary/80 dark:hover:bg-[#657b83]'
                      }`}
                    >
                      <div className="font-medium">{voiceOption.name}</div>
                      <div className="text-xs opacity-75 truncate">{voiceOption.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Speed Slider */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-sm font-medium text-foreground dark:text-[#fdf6e3]">
                <Gauge className="h-4 w-4 text-indigo-500" />
                <span>Playback Speed</span>
              </div>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-[#93a1a1]">
                <span>Speed: {playbackSpeed.toFixed(2)}x</span>
                <span className={`font-medium ${
                  playbackSpeed === 1.0 ? 'text-green-600 dark:text-green-400' : 'text-indigo-600 dark:text-indigo-400'
                }`}>
                  {getSpeedLabel(playbackSpeed)}
                </span>
              </div>
              
              <input
                type="range"
                min="0.75"
                max="1.5"
                step="0.05"
                value={playbackSpeed}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="w-full h-3 md:h-2 bg-secondary dark:bg-[#586e75] rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              
              <div className="flex justify-between text-xs text-muted-foreground dark:text-[#93a1a1]">
                <span>0.75x</span>
                <span className="text-green-600 dark:text-green-400">1.0x</span>
                <span>1.5x</span>
              </div>

              {/* Quick preset buttons */}
              <div className="grid grid-cols-5 gap-2 pt-3 border-t border-border dark:border-[#586e75]">
                {[0.75, 0.9, 1.0, 1.15, 1.5].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`px-2 py-2.5 md:py-1.5 text-xs rounded-lg transition-colors ${
                      Math.abs(playbackSpeed - speed) < 0.01
                        ? 'bg-indigo-600 text-white'
                        : 'bg-secondary dark:bg-[#586e75] text-muted-foreground dark:text-[#93a1a1] hover:bg-secondary/80 dark:hover:bg-[#657b83]'
                    }`}
                  >
                    {speed === 1.0 ? '1x' : `${speed}x`}
                  </button>
                ))}
              </div>
            </div>

            {/* VAD Interruption Sensitivity - Only visible when both mic AND speaker enabled */}
            {isMicEnabled && isSpeakerEnabled && (
              <div className="mt-4 pt-4 border-t border-border dark:border-[#586e75]">
                <div className="flex items-center space-x-3 mb-3">
                  <span className="text-2xl">🎙️</span>
                  <span className="text-sm font-medium text-foreground dark:text-[#fdf6e3]">
                    Interruption Sensitivity
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-[#93a1a1]">
                  <span>Sensitivity: {(vadSensitivity * 100).toFixed(0)}%</span>
                  <span className={`font-medium ${
                    getVadSensitivityLabel(vadSensitivity) === 'Medium' ? 'text-green-600 dark:text-green-400' : 'text-indigo-600 dark:text-indigo-400'
                  }`}>
                    {getVadSensitivityLabel(vadSensitivity)}
                  </span>
                </div>
                
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={vadSensitivity}
                  onChange={(e) => handleVadSensitivityChange(parseFloat(e.target.value))}
                  className="w-full h-3 md:h-2 bg-secondary dark:bg-[#586e75] rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                
                <div className="flex justify-between text-xs text-muted-foreground dark:text-[#93a1a1]">
                  <span>Low</span>
                  <span className="text-green-600 dark:text-green-400">Medium</span>
                  <span>High</span>
                </div>

                {/* Quick preset buttons */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border dark:border-[#586e75]">
                  {[
                    { label: 'Low', value: 0.25 },
                    { label: 'Medium', value: 0.5 },
                    { label: 'High', value: 0.75 }
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => handleVadSensitivityChange(preset.value)}
                      className={`px-2 py-2.5 md:py-1.5 text-xs rounded-lg transition-colors ${
                        Math.abs(vadSensitivity - preset.value) < 0.01
                          ? 'bg-indigo-600 text-white'
                          : 'bg-secondary dark:bg-[#586e75] text-muted-foreground dark:text-[#93a1a1] hover:bg-secondary/80 dark:hover:bg-[#657b83]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                
                {/* Real-time Voice Level Meter */}
                <div className="mt-4 pt-4 border-t border-border dark:border-[#586e75]">
                  <div className="text-xs text-muted-foreground dark:text-[#93a1a1] mb-2">
                    Voice Level: {vadLevel}%
                  </div>
                  
                  <div className="flex space-x-1">
                    {[...Array(10)].map((_, index) => {
                      const barThreshold = (index + 1) * 10;
                      const isFilled = vadLevel >= barThreshold;
                      return (
                        <div
                          key={index}
                          className={`flex-1 h-6 rounded-sm transition-colors duration-150 ${
                            isFilled
                              ? 'bg-indigo-600 dark:bg-indigo-500'
                              : 'bg-gray-300 dark:bg-[#586e75]'
                          }`}
                        />
                      );
                    })}
                  </div>
                  
                  {/* Help text */}
                  <div className="mt-3 flex items-start space-x-2 text-xs text-muted-foreground dark:text-[#93a1a1]">
                    <span>ℹ️</span>
                    <span>Speak while AI talks to test it</span>
                  </div>
                </div>

                {/* Test Your Settings - Interactive Demo */}
                <div className="mt-4 pt-4 border-t border-border dark:border-[#586e75]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">🧪</span>
                      <span className="text-sm font-medium text-foreground dark:text-[#fdf6e3]">
                        Test Your Settings
                      </span>
                    </div>
                    
                    {/* Play/Stop Button */}
                    <button
                      onClick={isTestPlaying ? stopTestAudio : startTestAudio}
                      disabled={!isSpeakerEnabled}
                      className={`px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                        isTestPlaying
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200'
                          : isSpeakerEnabled
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {isTestPlaying ? (
                        <span className="flex items-center space-x-1">
                          <span>⏹</span>
                          <span>Stop</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1">
                          <span>▶</span>
                          <span>Play Sample</span>
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Status Display */}
                  {isTestPlaying && (
                    <div className={`mb-3 px-3 py-2 rounded-lg text-sm transition-all ${
                      testInterrupted
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 animate-pulse'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    }`}>
                      {testInterrupted ? (
                        <div className="flex items-center space-x-2">
                          <span>✓</span>
                          <span>Interruption detected!</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="animate-pulse">🔊</span>
                          <span>Playing... Try speaking to interrupt!</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* VAD Level Meter - Enhanced for Testing */}
                  {isTestPlaying && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs text-muted-foreground dark:text-[#93a1a1]">
                        <span>Your Voice Level:</span>
                        <span className="font-medium">{vadLevel}%</span>
                      </div>
                      
                      <div className="flex space-x-1">
                        {[...Array(10)].map((_, index) => {
                          const barThreshold = (index + 1) * 10;
                          const isFilled = vadLevel >= barThreshold;
                          const isHighLevel = barThreshold > 70;
                          return (
                            <div
                              key={index}
                              className={`flex-1 h-8 rounded-sm transition-all duration-150 ${
                                isFilled
                                  ? isHighLevel
                                    ? 'bg-green-500 dark:bg-green-400 shadow-lg'
                                    : 'bg-indigo-600 dark:bg-indigo-500'
                                  : 'bg-gray-300 dark:bg-[#586e75]'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Help Text */}
                  <div className="mt-3 text-xs text-muted-foreground dark:text-[#93a1a1] space-y-1">
                    {!isSpeakerEnabled ? (
                      <div className="flex items-start space-x-2">
                        <span>⚠️</span>
                        <span>Enable speaker to test</span>
                      </div>
                    ) : !isTestPlaying ? (
                      <div className="flex items-start space-x-2">
                        <span>💡</span>
                        <span>Click Play to test your speed & sensitivity settings in a safe environment</span>
                      </div>
                    ) : (
                      <div className="flex items-start space-x-2">
                        <span>🎙️</span>
                        <span>Speak now to test interruption! Higher sensitivity = easier to interrupt</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* VAD Error Display */}
                {naturalVoice.vadError && (
                  <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <div className="flex items-start space-x-2 text-xs text-red-600 dark:text-red-400">
                      <span className="text-base">⚠️</span>
                      <div>
                        <div className="font-medium">Voice interruption unavailable</div>
                        <div className="mt-1">{naturalVoice.vadError}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Guided Mode Toggle */}
            <div className="mt-4 pt-4 border-t border-border dark:border-[#586e75]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`text-2xl ${isGuidedMode ? 'animate-pulse' : ''}`}>
                    🧘
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground dark:text-[#fdf6e3]">
                      Guided Mode
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-[#93a1a1]">
                      Full-screen push-to-talk
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const newState = !isGuidedMode;
                    setIsGuidedMode(newState);
                    localStorage.setItem('v4_guided_mode', newState.toString());
                  }}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    isGuidedMode 
                      ? 'bg-purple-600' 
                      : 'bg-gray-300 dark:bg-[#586e75]'
                  }`}
                  aria-label="Toggle guided mode"
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      isGuidedMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground dark:text-[#93a1a1] text-center md:text-left">
              Adjust voice and speed for your session.
            </p>
          </div>
        </>
      )}

      {/* V4 Messages Area - Flex-grow to fill available space */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-card/30 dark:bg-[#073642]/30 rounded-lg border border-border/30 dark:border-[#586e75]/30 min-h-0">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.isUser
                ? 'bg-indigo-600 text-white'
                : 'bg-secondary text-foreground'
                }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              
              {/* Existing responseTime display */}
              {message.responseTime && (
                <div className="flex items-center justify-between mt-1 text-xs opacity-70">
                  <span>{message.usedAI ? 'AI Enhanced' : 'Scripted'}</span>
                  <span>{message.responseTime}ms</span>
                </div>
              )}
              
              {/* NEW: Audio/Text timing metrics (only for bot messages with voice timing) */}
              {!message.isUser && (message.textRenderTime || message.audioStartTime) && (
                <div 
                  className="mt-2 pt-2 border-t border-border/30 text-xs text-muted-foreground font-mono"
                  aria-hidden="true"
                >
                  ⏱️ 
                  {message.textRenderTime && (
                    <span className="ml-1">
                      Text: <span className="font-semibold">{Math.round(message.textRenderTime)}ms</span>
                    </span>
                  )}
                  {message.audioStartTime && (
                    <span className="ml-2">
                      | Audio: <span className="font-semibold">{Math.round(message.audioStartTime)}ms</span>
                    </span>
                  )}
                  {message.textRenderTime && message.audioStartTime && (
                    <span className="ml-2">
                      | Δ: <span className={`font-semibold ${
                        (message.textRenderTime - message.audioStartTime) > 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {Math.round(message.textRenderTime - message.audioStartTime)}ms
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Processing shimmer - shows while Whisper is transcribing user speech */}
        {naturalVoice.isProcessing && (
          <div className="flex justify-end">
            <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-indigo-600/20 dark:bg-indigo-600/30 animate-pulse">
              <div className="space-y-2">
                <div className="h-3 bg-indigo-400/40 dark:bg-indigo-400/30 rounded w-3/4"></div>
                <div className="h-3 bg-indigo-400/40 dark:bg-indigo-400/30 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* V4 Input Area - Fixed at bottom, doesn't shrink */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-border mt-auto">
        {hasError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-700 dark:text-red-300">{errorMessage}</span>
            </div>
          </div>
        )}

        {voiceError && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <span className="text-sm text-yellow-700 dark:text-yellow-300">Voice: {voiceError}</span>
            </div>
          </div>
        )}

        {showEmotionConfirmation && (
          <div className="mb-4 flex space-x-2">
            <button
              onClick={() => handleButtonClick('yes')}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Yes
            </button>
            <button
              onClick={() => handleButtonClick('no')}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              No
            </button>
          </div>
        )}

        {/* V3: Work Type Selection Buttons */}
        {showWorkTypeButtons && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 sm:gap-4 justify-center">
              <button
                onClick={() => handleWorkTypeSelection('1')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === '1' ? 'scale-105 bg-blue-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-blue-700 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">1</span>
                <span>PROBLEM</span>
              </button>

              <button
                onClick={() => handleWorkTypeSelection('2')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === '2' ? 'scale-105 bg-green-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-green-700 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">2</span>
                <span>GOAL</span>
              </button>

              <button
                onClick={() => handleWorkTypeSelection('3')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === '3' ? 'scale-105 bg-purple-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-purple-700 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">3</span>
                <span className="hidden sm:inline">NEGATIVE EXPERIENCE</span>
                <span className="sm:hidden">NEG. EXP.</span>
              </button>
            </div>
          </div>
        )}

        {/* V3: Yes/No Buttons for Trauma Intro */}
        {shouldShowTraumaYesNoButtons() && (
          <div className="mb-4 flex gap-2 sm:gap-3 justify-center">
            <button
              onClick={() => handleYesNoClick('yes')}
              disabled={isLoading}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-semibold text-sm sm:text-base"
            >
              Yes
            </button>
            <button
              onClick={() => handleYesNoClick('no')}
              disabled={isLoading}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-semibold text-sm sm:text-base"
            >
              No
            </button>
          </div>
        )}

        {/* V3: Yes/No Buttons for Confirm Statement */}
        {shouldShowConfirmStatementButtons() && (
          <div className="mb-4 flex gap-2 sm:gap-3 justify-center">
            <button
              onClick={() => handleYesNoClick('yes')}
              disabled={isLoading}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-semibold text-sm sm:text-base"
            >
              Yes
            </button>
            <button
              onClick={() => handleYesNoClick('no')}
              disabled={isLoading}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-semibold text-sm sm:text-base"
            >
              No
            </button>
          </div>
        )}

        {/* V3: Yes/No Buttons for Goal Steps (goal_deadline_check, goal_confirmation) */}
        {shouldShowGoalYesNoButtons() && (
          <div className="mb-4 flex gap-2 sm:gap-3 justify-center">
            <button
              onClick={() => handleYesNoClick('yes')}
              disabled={isLoading}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-semibold text-sm sm:text-base"
            >
              Yes
            </button>
            <button
              onClick={() => handleYesNoClick('no')}
              disabled={isLoading}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-semibold text-sm sm:text-base"
            >
              No
            </button>
          </div>
        )}

        {/* V4: GENERIC Yes/No Buttons - Auto-detects all yes/no steps */}
        {/* Covers 37 steps: digging_deeper, trauma checks, identity checks, belief checks, etc. */}
        {shouldShowGenericYesNoButtons() && (
          <div className="mb-4 flex gap-2 sm:gap-3 justify-center">
            <button
              onClick={() => handleYesNoClick('yes')}
              disabled={isLoading}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-semibold text-sm sm:text-base"
            >
              Yes
            </button>
            <button
              onClick={() => handleYesNoClick('no')}
              disabled={isLoading}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-semibold text-sm sm:text-base"
            >
              No
            </button>
          </div>
        )}

        {/* V3: Method Selection Buttons - 2x2 Grid */}
        {shouldShowMethodSelection() && (
          <div className="mb-4">
            <div className="text-center mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3">
                Choose a method:
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-2xl mx-auto">
              <button
                onClick={() => handleMethodSelection('Problem Shifting')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === 'Problem Shifting' ? 'scale-105 bg-blue-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-blue-700 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">1</span>
                <span className="hidden sm:inline">Problem Shifting</span>
                <span className="sm:hidden">Problem</span>
              </button>

              <button
                onClick={() => handleMethodSelection('Identity Shifting')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === 'Identity Shifting' ? 'scale-105 bg-green-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-green-700 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">2</span>
                <span className="hidden sm:inline">Identity</span>
                <span className="sm:hidden">Identity</span>
              </button>

              <button
                onClick={() => handleMethodSelection('Belief Shifting')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === 'Belief Shifting' ? 'scale-105 bg-purple-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-purple-700 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">3</span>
                <span className="hidden sm:inline">Belief</span>
                <span className="sm:hidden">Belief</span>
              </button>

              <button
                onClick={() => handleMethodSelection('Blockage Shifting')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === 'Blockage Shifting' ? 'scale-105 bg-red-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-red-700 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">4</span>
                <span className="hidden sm:inline">Blockage</span>
                <span className="sm:hidden">Blockage</span>
              </button>
            </div>
          </div>
        )}

        {/* V3: Text Input Form - Hidden when buttons are shown */}
        {!showWorkTypeButtons && !shouldShowMethodSelection() && !shouldShowTraumaYesNoButtons() && !shouldShowConfirmStatementButtons() && !shouldShowGoalYesNoButtons() && !shouldShowGenericYesNoButtons() && (
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your response..."
              disabled={isLoading || !isSessionActive}
              className="flex-1 px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !userInput.trim() || !isSessionActive}
              className="px-4 sm:px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center sm:space-x-2"
            >
              <Send className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        )}
      </div>
    </div>

  );
} 