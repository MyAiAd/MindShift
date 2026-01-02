'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, Clock, Zap, AlertCircle, CheckCircle, MessageSquare, Undo2, Sparkles, Mic, Volume2, Send, Play, Settings, Gauge, User } from 'lucide-react';
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

  // Natural Voice State - Init from localStorage if available
  const [isNaturalVoiceEnabled, setIsNaturalVoiceEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('v4_natural_voice') === 'true';
    }
    return false;
  });

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
      return localStorage.getItem('v4_selected_voice') || 'rachel';
    }
    return 'rachel';
  });
  const voiceSettingsRef = useRef<HTMLDivElement>(null);

  // Available voices - Add new voices here
  const AVAILABLE_VOICES = [
    { id: 'rachel', name: 'Rachel', elevenLabsId: '21m00Tcm4TlvDq8ikWAM', description: 'Warm, professional female voice' },
    // PLACEHOLDER: Add new voice here when ready
    // { id: 'new_voice', name: 'New Voice Name', elevenLabsId: 'ELEVENLABS_VOICE_ID', description: 'Description here' },
  ] as const;

  // Toggle handler with Sticky Settings and Retroactive Play
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
    }
  };

  // Get the ElevenLabs voice ID for the selected voice
  const getElevenLabsVoiceId = () => {
    const voice = AVAILABLE_VOICES.find(v => v.id === selectedVoice);
    return voice?.elevenLabsId || '21m00Tcm4TlvDq8ikWAM'; // Default to Rachel
  };

  // Get speed label for display
  const getSpeedLabel = (speed: number) => {
    if (speed <= 0.75) return 'Slower';
    if (speed <= 0.9) return 'Slow';
    if (speed <= 1.1) return 'Normal';
    if (speed <= 1.25) return 'Fast';
    return 'Faster';
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
    // Only run if we have an auto step and voice is disabled
    // (If voice is enabled, handleAudioEnded takes care of it)
    if (expectedResponseType === 'auto' && !isNaturalVoiceEnabled) {
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
  }, [expectedResponseType, isNaturalVoiceEnabled, messages]);

  // Natural Voice Hook
  const naturalVoice = useNaturalVoice({
    enabled: isNaturalVoiceEnabled,
    onTranscript: (transcript) => {
      console.log('🗣️ Natural Voice Transcript:', transcript);
      if (!isLoading) {
        sendMessage(transcript);
      }
    },
    voiceProvider: 'elevenlabs',
    elevenLabsVoiceId: getElevenLabsVoiceId(),
    onAudioEnded: handleAudioEnded,
    playbackRate: playbackSpeed
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
    if (!methodName) return 'Mind Shifting V4';

    // Convert snake_case to Title Case
    return methodName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + ' V4';
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        // Speak initial message if enabled - with delay to ensure state is settled
        if (isNaturalVoiceEnabled) {
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

    // Stop current audio if user is advancing to next step
    if (isNaturalVoiceEnabled && naturalVoice.isSpeaking) {
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

          // V3: Enhanced voice feedback (only if message is displayed)
          if (systemMessage.content) {
            if (isNaturalVoiceEnabled) {
              naturalVoice.speak(systemMessage.content);
            } else if (voice.isVoiceOutputEnabled) {
              voice.speakGlobally(systemMessage.content);
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
    if (isNaturalVoiceEnabled && naturalVoice.isSpeaking) {
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
    if (isNaturalVoiceEnabled && naturalVoice.isSpeaking) {
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
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Skip "Choose a method:" message if buttons will be shown
          const shouldSkipMessage = data.message === "Choose a method:" ||
            (data.currentStep === 'choose_method' &&
              data.message.includes('Choose a method'));

          if (!shouldSkipMessage) {
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

          // Speak the new message with Natural Voice or fallback to global voice
          if (data.message && !shouldSkipMessage) {
            if (isNaturalVoiceEnabled) {
              console.log('🔊 Playing new audio after work type selection');
              naturalVoice.speak(data.message);
            } else if (voice.isVoiceOutputEnabled) {
              voice.speakGlobally(data.message);
            }
          }
        }
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Work type selection error:', error);
        setHasError(true);
        setErrorMessage('Failed to process work type selection');
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
    if (isNaturalVoiceEnabled && naturalVoice.isSpeaking) {
      console.log('🛑 Stopping current audio - user clicked yes/no');
      naturalVoice.stopSpeaking();
    }
    setClickedButton(response);
    sendMessage(response);
  };

  // V3: Handle method selection button clicks
  const handleMethodSelection = (method: string) => {
    // Stop current audio if user is advancing to next step
    if (isNaturalVoiceEnabled && naturalVoice.isSpeaking) {
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

          // Speak the new message with Natural Voice or fallback to global voice
          if (systemMessage.content) {
            if (isNaturalVoiceEnabled) {
              console.log('🔊 Playing new audio after method selection');
              naturalVoice.speak(systemMessage.content);
            } else if (voice.isVoiceOutputEnabled) {
              voice.speakGlobally(systemMessage.content);
            }
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
    <div className="max-w-4xl mx-auto px-4 relative">
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

      {/* V4 Header - Mobile Responsive */}
      <div className="bg-card dark:bg-[#073642] rounded-lg shadow-sm border border-border dark:border-[#586e75] mb-6">
        <div className="px-4 sm:px-6 py-4 border-b border-border dark:border-[#586e75]">
          {/* Mobile Layout: Stack vertically */}
          <div className="flex flex-col space-y-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            {/* Title Section */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
              <h2 className="text-base sm:text-xl font-semibold text-foreground dark:text-[#fdf6e3] truncate">
                {formatMethodName(sessionMethod)}
              </h2>
              <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 rounded-full flex items-center space-x-1 flex-shrink-0">
                <Sparkles className="h-3 w-3" />
                <span>V4</span>
              </span>
            </div>

            {/* Step Info - Full width on mobile */}
            {currentStep && (
              <div className="text-xs sm:text-sm text-muted-foreground dark:text-[#93a1a1] truncate">
                Step: {currentStep}
              </div>
            )}

            {/* Controls Section - Stack on mobile, row on desktop */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4">
              {/* V4 Performance Indicators - Hide on very small screens */}
              <div className="hidden sm:flex items-center space-x-2 text-xs sm:text-sm text-muted-foreground dark:text-[#93a1a1]">
                <Clock className="h-4 w-4" />
                <span>{lastResponseTime}ms</span>
              </div>

              {performanceMetrics.cacheHitRate > 0 && (
                <div className="hidden sm:flex items-center space-x-2 text-xs sm:text-sm text-muted-foreground dark:text-[#93a1a1]">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span>{performanceMetrics.cacheHitRate.toFixed(0)}%</span>
                </div>
              )}

              {/* Natural Voice Toggle - Always visible, icon-only on mobile */}
              <button
                onClick={toggleNaturalVoice}
                className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors flex-shrink-0 ${isNaturalVoiceEnabled
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 ring-2 ring-indigo-500 ring-offset-1'
                  : 'bg-secondary text-muted-foreground dark:bg-[#586e75] dark:text-[#93a1a1] hover:bg-secondary dark:hover:bg-[#657b83]'
                  }`}
                title="Toggle Natural Voice (ElevenLabs)"
              >
                {isNaturalVoiceEnabled ? (
                  <>
                    {naturalVoice.isSpeaking ? (
                      <Volume2 className="h-4 w-4 animate-pulse" />
                    ) : naturalVoice.isListening ? (
                      <Mic className="h-4 w-4 animate-pulse text-red-500" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Voice On</span>
                    <span className="sm:hidden">On</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    <span className="hidden sm:inline">Voice Off</span>
                    <span className="sm:hidden">Off</span>
                  </>
                )}
              </button>

              {/* Voice Settings Button with Popover */}
              <div className="relative" ref={voiceSettingsRef}>
                <button
                  onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                  className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors flex-shrink-0 ${
                    showVoiceSettings
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                      : 'bg-secondary text-muted-foreground dark:bg-[#586e75] dark:text-[#93a1a1] hover:bg-secondary/80 dark:hover:bg-[#657b83]'
                  }`}
                  title="Voice Settings"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </button>

                {/* Settings Popover */}
                {showVoiceSettings && (
                  <div className="absolute top-full mt-2 right-0 sm:right-auto sm:left-0 w-64 bg-card dark:bg-[#073642] border border-border dark:border-[#586e75] rounded-lg shadow-xl p-4 z-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground dark:text-[#fdf6e3] flex items-center space-x-2">
                        <Gauge className="h-4 w-4 text-indigo-500" />
                        <span>Voice Speed</span>
                      </h3>
                      <button
                        onClick={() => setShowVoiceSettings(false)}
                        className="text-muted-foreground hover:text-foreground text-lg leading-none"
                        aria-label="Close settings"
                      >
                        ×
                      </button>
                    </div>

                    {/* Voice Selector */}
                    {AVAILABLE_VOICES.length > 1 && (
                      <div className="space-y-2 mb-4 pb-4 border-b border-border dark:border-[#586e75]">
                        <div className="flex items-center space-x-2 text-sm font-medium text-foreground dark:text-[#fdf6e3]">
                          <User className="h-4 w-4 text-indigo-500" />
                          <span>Voice</span>
                        </div>
                        <div className="space-y-1.5">
                          {AVAILABLE_VOICES.map((voice) => (
                            <button
                              key={voice.id}
                              onClick={() => handleVoiceChange(voice.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                selectedVoice === voice.id
                                  ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                                  : 'bg-secondary dark:bg-[#586e75] text-muted-foreground dark:text-[#93a1a1] hover:bg-secondary/80 dark:hover:bg-[#657b83]'
                              }`}
                            >
                              <div className="font-medium">{voice.name}</div>
                              <div className="text-xs opacity-75">{voice.description}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Speed Slider */}
                    <div className="space-y-3">
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
                        className="w-full h-2 bg-secondary dark:bg-[#586e75] rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      
                      <div className="flex justify-between text-xs text-muted-foreground dark:text-[#93a1a1]">
                        <span>0.75x</span>
                        <span className="text-green-600 dark:text-green-400">1.0x</span>
                        <span>1.5x</span>
                      </div>

                      {/* Quick preset buttons */}
                      <div className="flex gap-1.5 pt-2 border-t border-border dark:border-[#586e75]">
                        {[0.75, 0.9, 1.0, 1.15, 1.5].map((speed) => (
                          <button
                            key={speed}
                            onClick={() => handleSpeedChange(speed)}
                            className={`flex-1 px-1.5 py-1.5 text-xs rounded transition-colors ${
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

                    <p className="mt-3 text-xs text-muted-foreground dark:text-[#93a1a1]">
                      Adjust how fast the voice speaks during your session.
                    </p>
                  </div>
                )}
              </div>

              {/* Undo Button */}
              {stepHistory.length > 0 && (
                <button
                  onClick={handleUndo}
                  disabled={isLoading}
                  className="flex items-center space-x-1 px-2 sm:px-3 py-1 text-xs sm:text-sm text-muted-foreground dark:text-[#93a1a1] hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  <Undo2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Undo</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* V4 Messages Area */}
      <div className="h-96 overflow-y-auto p-6 space-y-4">
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
              {message.responseTime && (
                <div className="flex items-center justify-between mt-1 text-xs opacity-70">
                  <span>{message.usedAI ? 'AI Enhanced' : 'Scripted'}</span>
                  <span>{message.responseTime}ms</span>
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* V4 Input Area */}
      <div className="px-6 py-4 border-t border-border">
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
            <div className="text-center mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3">
                What do you want to work on?
              </h3>
            </div>
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

        {/* V3: Method Selection Buttons */}
        {shouldShowMethodSelection() && (
          <div className="mb-4">
            <div className="text-center mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3">
                Choose a method:
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-4 justify-center">
              <button
                onClick={() => handleMethodSelection('Problem Shifting')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
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
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === 'Identity Shifting' ? 'scale-105 bg-green-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-green-700 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">2</span>
                <span className="hidden sm:inline">Identity Shifting</span>
                <span className="sm:hidden">Identity</span>
              </button>

              <button
                onClick={() => handleMethodSelection('Belief Shifting')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === 'Belief Shifting' ? 'scale-105 bg-purple-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-purple-700 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">3</span>
                <span className="hidden sm:inline">Belief Shifting</span>
                <span className="sm:hidden">Belief</span>
              </button>

              <button
                onClick={() => handleMethodSelection('Blockage Shifting')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === 'Blockage Shifting' ? 'scale-105 bg-red-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-red-700 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">4</span>
                <span className="hidden sm:inline">Blockage Shifting</span>
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