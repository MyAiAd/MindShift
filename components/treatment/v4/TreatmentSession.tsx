'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, Clock, Zap, AlertCircle, CheckCircle, MessageSquare, Undo2, Sparkles, Mic, Volume2 } from 'lucide-react';
// Global voice system integration (accessibility-driven)
import { useGlobalVoice } from '@/components/voice/useGlobalVoice';
// Natural voice integration (ElevenLabs + Web Speech)
import { useNaturalVoice } from '@/components/voice/useNaturalVoice';

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

  // Toggle handler with Sticky Settings and Retroactive Play
  const toggleNaturalVoice = () => {
    const newState = !isNaturalVoiceEnabled;
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

  // Ref to track the expected response type of the current step
  const currentStepTypeRef = useRef<string | null>(null);

  // Handle audio ended event for auto-advance steps
  const handleAudioEnded = useCallback(() => {
    console.log('🔊 Audio ended. Step type:', currentStepTypeRef.current);
    if (currentStepTypeRef.current === 'auto') {
      console.log('⏩ Auto-advancing step...');
      // Small delay to ensure natural flow
      setTimeout(() => {
        sendMessage(''); // Send empty message to trigger next step
      }, 500);
    }
  }, []);

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
    onAudioEnded: handleAudioEnded
  });

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

  // Initialize session on component mount
  useEffect(() => {
    if (sessionId && userId) {
      if (shouldResume) {
        resumeSession();
      } else {
        startSession();
      }
    }
  }, [sessionId, userId, shouldResume]);

  // Prefetch the introduction message for instant playback
  useEffect(() => {
    const introText = "Mind Shifting is not like counselling, therapy or life coaching. The Mind Shifting methods are verbal guided processes that we apply to problems, goals, or negative experiences in order to clear them. The way Mind Shifting works is we won't just be talking about what you want to work on, we will be applying Mind Shifting methods in order to clear them, and to do that we will need to define what you want to work on into a clear statement by you telling me what it is in a few words. So I'll be asking you to do that when needed.\n\nWhen you are ready to begin, would you like to work on:\n\n1. PROBLEM\n2. GOAL\n3. NEGATIVE EXPERIENCE";
    naturalVoice.prefetch(introText);
  }, []);

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
        content: "Mind Shifting is not like counselling, therapy or life coaching. The Mind Shifting methods are verbal guided processes that we apply to problems, goals, or negative experiences in order to clear them. The way Mind Shifting works is we won't just be talking about what you want to work on, we will be applying Mind Shifting methods in order to clear them, and to do that we will need to define what you want to work on into a clear statement by you telling me what it is in a few words. So I'll be asking you to do that when needed.\n\nWhen you are ready to begin, would you like to work on:\n\n1. PROBLEM\n2. GOAL\n3. NEGATIVE EXPERIENCE",
        isUser: false,
        timestamp: new Date(),
        version: 'v4'
      };

      setMessages([instantMessage]);
      setCurrentStep('mind_shifting_explanation');
      setIsSessionActive(true);
      setIsLoading(false); // Stop loading immediately - user can interact now

      // Focus input immediately for user interaction
      setTimeout(() => {
        inputRef.current?.focus();
        // Speak initial message if enabled
        if (isNaturalVoiceEnabled) {
          naturalVoice.speak(instantMessage.content);
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
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

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
    setClickedButton(buttonText);
    sendMessage(buttonText);
  };

  // V3: RACE CONDITION FIX - Use useEffect to compute button visibility after all state updates complete
  // This ensures we see consistent state, not partial updates during rapid re-renders
  useEffect(() => {
    // Check if we're in the initial explanation step
    const isInitialStep = currentStep === 'mind_shifting_explanation';

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

          if (voice.isVoiceOutputEnabled && data.message && !shouldSkipMessage) {
            voice.speakGlobally(data.message);
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

  // V3: Handle Yes/No button clicks for trauma intro and confirm statement
  const handleYesNoClick = (response: string) => {
    setClickedButton(response);
    sendMessage(response);
  };

  // V3: Handle method selection button clicks
  const handleMethodSelection = (method: string) => {
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

          if (voice.isVoiceOutputEnabled && systemMessage.content) {
            voice.speakGlobally(systemMessage.content);
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
    <div className="max-w-4xl mx-auto px-4">
      {/* V4 Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Brain className="h-6 w-6 text-indigo-600" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {formatMethodName(sessionMethod)}
                </h2>
                <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 rounded-full flex items-center space-x-1">
                  <Sparkles className="h-3 w-3" />
                  <span>V4</span>
                </span>
              </div>
              {currentStep && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Step: {currentStep}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {/* V4 Performance Indicators */}
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="h-4 w-4" />
                <span>{lastResponseTime}ms</span>
              </div>

              {performanceMetrics.cacheHitRate > 0 && (
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span>{performanceMetrics.cacheHitRate.toFixed(0)}%</span>
                </div>
              )}

              {/* Natural Voice Toggle */}
              <button
                onClick={toggleNaturalVoice}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${isNaturalVoiceEnabled
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 ring-2 ring-indigo-500 ring-offset-1'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                    <span>Natural Voice On</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    <span>Natural Voice Off</span>
                  </>
                )}
              </button>
            </div>


            {stepHistory.length > 0 && (
              <button
                onClick={handleUndo}
                disabled={isLoading}
                className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
              >
                <Undo2 className="h-4 w-4" />
                <span>Undo</span>
              </button>
            )}
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
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
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
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                What do you want to work on?
              </h3>
            </div>
            <div className="flex space-x-4 justify-center">
              <button
                onClick={() => handleWorkTypeSelection('1')}
                disabled={isLoading}
                className={`px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2 font-semibold ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === '1' ? 'scale-105 bg-blue-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-blue-700 px-2 py-1 rounded text-sm font-bold">1</span>
                <span>PROBLEM</span>
              </button>

              <button
                onClick={() => handleWorkTypeSelection('2')}
                disabled={isLoading}
                className={`px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2 font-semibold ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === '2' ? 'scale-105 bg-green-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-green-700 px-2 py-1 rounded text-sm font-bold">2</span>
                <span>GOAL</span>
              </button>

              <button
                onClick={() => handleWorkTypeSelection('3')}
                disabled={isLoading}
                className={`px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2 font-semibold ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === '3' ? 'scale-105 bg-purple-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-purple-700 px-2 py-1 rounded text-sm font-bold">3</span>
                <span>NEGATIVE EXPERIENCE</span>
              </button>
            </div>
          </div>
        )}

        {/* V3: Yes/No Buttons for Trauma Intro */}
        {shouldShowTraumaYesNoButtons() && (
          <div className="mb-4 flex space-x-3 justify-center">
            <button
              onClick={() => handleYesNoClick('yes')}
              disabled={isLoading}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-semibold"
            >
              Yes
            </button>
            <button
              onClick={() => handleYesNoClick('no')}
              disabled={isLoading}
              className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-semibold"
            >
              No
            </button>
          </div>
        )}

        {/* V3: Yes/No Buttons for Confirm Statement */}
        {shouldShowConfirmStatementButtons() && (
          <div className="mb-4 flex space-x-3 justify-center">
            <button
              onClick={() => handleYesNoClick('yes')}
              disabled={isLoading}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-semibold"
            >
              Yes
            </button>
            <button
              onClick={() => handleYesNoClick('no')}
              disabled={isLoading}
              className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-semibold"
            >
              No
            </button>
          </div>
        )}

        {/* V3: Yes/No Buttons for Goal Steps (goal_deadline_check, goal_confirmation) */}
        {shouldShowGoalYesNoButtons() && (
          <div className="mb-4 flex space-x-3 justify-center">
            <button
              onClick={() => handleYesNoClick('yes')}
              disabled={isLoading}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-semibold"
            >
              Yes
            </button>
            <button
              onClick={() => handleYesNoClick('no')}
              disabled={isLoading}
              className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-semibold"
            >
              No
            </button>
          </div>
        )}

        {/* V3: Method Selection Buttons */}
        {shouldShowMethodSelection() && (
          <div className="mb-4">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Choose a method:
              </h3>
            </div>
            <div className="flex space-x-4 justify-center">
              <button
                onClick={() => handleMethodSelection('Problem Shifting')}
                disabled={isLoading}
                className={`px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2 font-semibold ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === 'Problem Shifting' ? 'scale-105 bg-blue-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-blue-700 px-2 py-1 rounded text-sm font-bold">1</span>
                <span>Problem Shifting</span>
              </button>

              <button
                onClick={() => handleMethodSelection('Identity Shifting')}
                disabled={isLoading}
                className={`px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2 font-semibold ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === 'Identity Shifting' ? 'scale-105 bg-green-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-green-700 px-2 py-1 rounded text-sm font-bold">2</span>
                <span>Identity Shifting</span>
              </button>

              <button
                onClick={() => handleMethodSelection('Belief Shifting')}
                disabled={isLoading}
                className={`px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2 font-semibold ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === 'Belief Shifting' ? 'scale-105 bg-purple-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-purple-700 px-2 py-1 rounded text-sm font-bold">3</span>
                <span>Belief Shifting</span>
              </button>

              <button
                onClick={() => handleMethodSelection('Blockage Shifting')}
                disabled={isLoading}
                className={`px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2 font-semibold ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === 'Blockage Shifting' ? 'scale-105 bg-red-700 shadow-lg' : ''
                  }`}
              >
                <span className="bg-red-700 px-2 py-1 rounded text-sm font-bold">4</span>
                <span>Blockage Shifting</span>
              </button>
            </div>
          </div>
        )}

        {/* V3: Text Input Form - Hidden when buttons are shown */}
        {!showWorkTypeButtons && !shouldShowMethodSelection() && !shouldShowTraumaYesNoButtons() && !shouldShowConfirmStatementButtons() && !shouldShowGoalYesNoButtons() && (
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your response..."
              disabled={isLoading || !isSessionActive}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !userInput.trim() || !isSessionActive}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Send</span>
            </button>
          </form>
        )}
      </div>
    </div>

  );
} 