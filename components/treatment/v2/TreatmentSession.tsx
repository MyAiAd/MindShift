'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Brain, Clock, Zap, AlertCircle, CheckCircle, MessageSquare, Undo2 } from 'lucide-react';
// Global voice system integration (accessibility-driven)
import { useGlobalVoice } from '@/components/voice/useGlobalVoice';

// Import shared types
import { 
  TreatmentMessage, 
  TreatmentSessionProps, 
  SessionStats, 
  PerformanceMetrics, 
  StepHistoryEntry 
} from './shared/types';

// Import modality components
import ProblemShifting from './modalities/ProblemShifting/ProblemShifting';
import ProblemShiftingDigging from './modalities/ProblemShifting/ProblemShiftingDigging';
import ProblemShiftingIntegration from './modalities/ProblemShifting/ProblemShiftingIntegration';
import ProblemShiftingGuardrails from './modalities/ProblemShifting/ProblemShiftingGuardrails';

import IdentityShifting from './modalities/IdentityShifting/IdentityShifting';
import IdentityShiftingDigging from './modalities/IdentityShifting/IdentityShiftingDigging';
import IdentityShiftingIntegration from './modalities/IdentityShifting/IdentityShiftingIntegration';
import IdentityShiftingGuardrails from './modalities/IdentityShifting/IdentityShiftingGuardrails';

import BeliefShifting from './modalities/BeliefShifting/BeliefShifting';
import BeliefShiftingDigging from './modalities/BeliefShifting/BeliefShiftingDigging';
import BeliefShiftingIntegration from './modalities/BeliefShifting/BeliefShiftingIntegration';
import BeliefShiftingGuardrails from './modalities/BeliefShifting/BeliefShiftingGuardrails';

import BlockageShifting from './modalities/BlockageShifting/BlockageShifting';
import BlockageShiftingDigging from './modalities/BlockageShifting/BlockageShiftingDigging';
import BlockageShiftingIntegration from './modalities/BlockageShifting/BlockageShiftingIntegration';
import BlockageShiftingGuardrails from './modalities/BlockageShifting/BlockageShiftingGuardrails';

import RealityShifting from './modalities/RealityShifting/RealityShifting';
import RealityShiftingDigging from './modalities/RealityShifting/RealityShiftingDigging';
import RealityShiftingIntegration from './modalities/RealityShifting/RealityShiftingIntegration';
import RealityShiftingGuardrails from './modalities/RealityShifting/RealityShiftingGuardrails';

import TraumaShifting from './modalities/TraumaShifting/TraumaShifting';
import TraumaShiftingDigging from './modalities/TraumaShifting/TraumaShiftingDigging';
import TraumaShiftingIntegration from './modalities/TraumaShifting/TraumaShiftingIntegration';
import TraumaShiftingGuardrails from './modalities/TraumaShifting/TraumaShiftingGuardrails';

// MOVED: All interfaces moved to ./shared/types.ts for modular architecture
// This allows each modality to use the same type definitions

export default function TreatmentSession({ 
  sessionId, 
  userId, 
  shouldResume = false,
  onComplete, 
  onError 
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
    aiUsagePercent: 0
  });
  
  // NEW: Performance metrics state
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    cacheHitRate: 0,
    averageResponseTime: 0,
    preloadedResponsesUsed: 0,
    totalResponses: 0
  });
  const [lastResponseTime, setLastResponseTime] = useState<number>(0);
  const [stepHistory, setStepHistory] = useState<StepHistoryEntry[]>([]);
  const [voiceError, setVoiceError] = useState<string>('');
  const [selectedWorkType, setSelectedWorkType] = useState<string | null>(null);
  const [clickedButton, setClickedButton] = useState<string | null>(null);
  const [sessionMethod, setSessionMethod] = useState<string>('mind_shifting');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Helper function to format method names
  const formatMethodName = (methodName: string) => {
    if (!methodName) return 'Mind Shifting';
    
    // Convert snake_case to Title Case
    return methodName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input after each response
  useEffect(() => {
    if (!isLoading && isSessionActive) {
      inputRef.current?.focus();
    }
  }, [isLoading, isSessionActive]);

  // Start session on mount
  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    setSelectedWorkType(null); // Reset work type selection
    
    try {
      // NEW: Check shouldResume flag - only resume if explicitly requested
      if (!shouldResume) {
        console.log('🆕 No resume flag detected, starting fresh session');
        await startNewSession();
        return;
      }
      
      // First try to resume existing session (only when shouldResume=true)
      console.log('🔄 Resume flag detected, attempting to resume existing session:', sessionId);
      const resumeResponse = await fetch('/api/treatment-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userId,
          action: 'resume'
        })
      });

      if (!resumeResponse.ok) {
        throw new Error(`HTTP error! status: ${resumeResponse.status}`);
      }

      const resumeData = await resumeResponse.json();
      
      if (resumeData.success) {
        console.log('✅ Successfully resumed existing session');
        
        // Load existing messages and state
        if (resumeData.messages && resumeData.messages.length > 0) {
          setMessages(resumeData.messages);
        }
        
        setCurrentStep(resumeData.currentStep);
        setIsSessionActive(true);
        
        // Update stats if available
        if (resumeData.performance) {
          setLastResponseTime(resumeData.performance.avgResponseTime || 0);
          updateStats({
            responseTime: resumeData.performance.avgResponseTime || 0,
            usedAI: false // This will be updated with actual usage
          });
        }

        // Global voice: Auto-speak the last message if voice is enabled
        if (voice.isVoiceOutputEnabled && resumeData.messages && resumeData.messages.length > 0) {
          const lastMessage = resumeData.messages[resumeData.messages.length - 1];
          if (!lastMessage.isUser) {
            voice.speakGlobally(lastMessage.content);
          }
        }

        // Save state to history
        setTimeout(() => {
          saveToHistory();
        }, 1000);
        
        return; // Successfully resumed, exit function
      }
      
      // If resume failed or returned no session, fall back to starting new session
      console.log('⚠️ Resume failed or no existing session, starting new session');
      await startNewSession();
      
    } catch (error) {
      console.error('Resume session error:', error);
      // Fallback to starting new session
      console.log('⚠️ Resume error, falling back to new session');
      await startNewSession();
    } finally {
      setIsLoading(false);
    }
  };

  const startNewSession = async () => {
    try {
      console.log('🆕 Starting new session');
      const response = await fetch('/api/treatment-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userId,
          action: 'start'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const welcomeMessage: TreatmentMessage = {
          id: Date.now().toString(),
          content: data.message,
          isUser: false,
          timestamp: new Date(),
          responseTime: data.responseTime,
          usedAI: data.usedAI
        };
        
        setMessages([welcomeMessage]);
        setCurrentStep(data.currentStep);
        setIsSessionActive(true);
        setLastResponseTime(data.responseTime);
        updateStats(data);

        // NEW: Update performance metrics if available
        if (data.performanceMetrics) {
          setPerformanceMetrics(data.performanceMetrics);
        }

        // Global voice: Auto-speak welcome message when enabled in accessibility settings
        if (voice.isVoiceOutputEnabled) {
          voice.speakGlobally(welcomeMessage.content);
        }

        // SAFE: Save initial state to history (after successful session start and voice initialization)
        setTimeout(() => {
          saveToHistory();
        }, 1000); // Longer delay to ensure voice system is fully initialized
      } else {
        throw new Error(data.error || 'Failed to start session');
      }
    } catch (error) {
      console.error('Session start error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Network error occurred';
      setErrorMessage(errorMsg);
      setHasError(true);
      onError?.(errorMsg);
    }
  };

  const startSession = async () => {
    // Keep this method for backward compatibility, but redirect to initializeSession
    await initializeSession();
  };

  const sendMessage = async () => {
    if (!userInput.trim() || isLoading) return;
    await sendMessageWithContent(userInput.trim());
  };

  const sendMessageWithContent = async (content: string) => {
    if (!content || isLoading) {
      return;
    }

    console.log('🔍 DEBUG: sendMessageWithContent called with:', content, 'from stack:', new Error().stack?.split('\n')[2]?.trim());

    const userMessage: TreatmentMessage = {
      id: Date.now().toString(),
      content: content,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);

    try {
      const requestBody = {
        sessionId,
        userId,
        userInput: userMessage.content,
        action: 'continue'
      };
      
      console.log('📤 API Request body:', requestBody);
      
      const response = await fetch('/api/treatment-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        console.error('📤 API Response not OK:', response.status, response.statusText);
        
        // Try to get error details from response
        try {
          const errorData = await response.json();
          console.error('📤 API Error details:', errorData);
        } catch (parseError) {
          console.error('📤 Could not parse error response:', parseError);
        }
        
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📤 API Response data:', data);
      console.log('📤 API Response message:', data.message);
      console.log('📤 API Response currentStep:', data.currentStep);
      console.log('📤 API Response success:', data.success);
      
      if (data.success) {
        // Update session method based on selection
        if (data.message === 'PROBLEM_SHIFTING_SELECTED') {
          setSessionMethod('problem_shifting');
        } else if (data.message === 'IDENTITY_SHIFTING_SELECTED') {
          setSessionMethod('identity_shifting');
        } else if (data.message === 'BELIEF_SHIFTING_SELECTED') {
          setSessionMethod('belief_shifting');
        } else if (data.message === 'BLOCKAGE_SHIFTING_SELECTED') {
          setSessionMethod('blockage_shifting');
        } else if (data.message === 'REALITY_SHIFTING_SELECTED') {
          setSessionMethod('reality_shifting');
        } else if (data.message === 'TRAUMA_SHIFTING_SELECTED') {
          setSessionMethod('trauma_shifting');
        } else if (data.message === 'GOAL_SELECTION_CONFIRMED') {
          setSessionMethod('reality_shifting'); // Goals use Reality Shifting
        } else if (data.message === 'NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED') {
          setSessionMethod('trauma_shifting'); // Negative experiences use Trauma Shifting
        }

        // Skip adding messages for backend confirmation messages that UI already handles
        const isUIHandledMessage = data.message === 'PROBLEM_SELECTION_CONFIRMED' || 
                                   data.message === 'METHOD_SELECTION_NEEDED' ||
                                   data.message === 'GOAL_SELECTION_CONFIRMED' ||
                                   data.message === 'NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED' ||
                                   data.message === 'SKIP_TO_TREATMENT_INTRO' ||
                                   data.message === 'PROBLEM_SHIFTING_SELECTED' ||
                                   data.message === 'IDENTITY_SHIFTING_SELECTED' ||
                                   data.message === 'BELIEF_SHIFTING_SELECTED' ||
                                   data.message === 'BLOCKAGE_SHIFTING_SELECTED' ||
                                   data.message === 'REALITY_SHIFTING_SELECTED' ||
                                   data.message === 'TRAUMA_SHIFTING_SELECTED';
        
        if (!isUIHandledMessage) {
          const botMessage: TreatmentMessage = {
            id: (Date.now() + 1).toString(),
            content: data.message,
            isUser: false,
            timestamp: new Date(),
            responseTime: data.responseTime,
            usedAI: data.usedAI,
            metadata: {
              aiCost: data.aiCost,
              aiTokens: data.aiTokens,
              requiresRetry: data.requiresRetry
            }
          };

          setMessages(prev => [...prev, botMessage]);

          // Global voice: Auto-speak bot response when enabled in accessibility settings
          if (voice.isVoiceOutputEnabled) {
            voice.speakGlobally(botMessage.content);
          }
        }
        
        setCurrentStep(data.currentStep);
        setLastResponseTime(data.responseTime);
        updateStats(data);

        // NEW: Update performance metrics if available
        if (data.performanceMetrics) {
          setPerformanceMetrics(data.performanceMetrics);
        }

        // SAFE: Save to history AFTER successful state update (doesn't interfere with state machine)
        // Delay to ensure all state updates are complete and voice system is stable
        setTimeout(() => {
          saveToHistory();
        }, 500);

        // Check if session is complete
        if (data.sessionComplete) {
          setIsSessionActive(false);
          onComplete?.(data);
        }
      } else {
        throw new Error(data.error || 'Failed to process message');
      }
    } catch (error) {
      console.error('Message send error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Network error occurred';
      
      // Add an error message to the chat
      const errorMessage: TreatmentMessage = {
        id: (Date.now() + 2).toString(),
        content: `Sorry, there was an error processing your message: ${errorMsg}. Please try again.`,
        isUser: false,
        timestamp: new Date(),
        responseTime: 0,
        usedAI: false
      };
      
      setMessages(prev => [...prev, errorMessage]);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Global voice system - integrates with accessibility settings
  const voice = useGlobalVoice({
    onVoiceTranscript: (transcript) => {
      console.log('🎤 TreatmentSession received transcript:', transcript, 'for step:', currentStep);
      console.log('🔍 DEBUG: Voice transcript from stack:', new Error().stack?.split('\n')[2]?.trim());
      // Smart routing based on current UI context
      if (currentStep === 'check_if_still_problem' || currentStep === 'blockage_check_if_still_problem' || currentStep === 'identity_check' || currentStep === 'identity_problem_check' || currentStep === 'confirm_identity_problem' || currentStep === 'identity_dissolve_step_f' || currentStep === 'identity_step_3_intro' || currentStep === 'reality_step_b' || currentStep === 'reality_doubts_check' || currentStep === 'trauma_identity_check' || currentStep === 'trauma_experience_check' || currentStep === 'trauma_dig_deeper' || currentStep === 'belief_step_f' || currentStep === 'belief_check_1' || currentStep === 'belief_check_2' || currentStep === 'belief_check_3' || currentStep === 'belief_check_4' || currentStep === 'belief_problem_check' || currentStep === 'confirm_belief_problem' || currentStep === 'goal_deadline_check' || currentStep === 'goal_confirmation') {
        if (transcript === 'yes' || transcript === 'no') {
          handleYesNoResponse(transcript as 'yes' | 'no');
          return;
        }
      }
      
      if (currentStep === 'mind_shifting_explanation' || currentStep === 'work_type_selection') {
        // Handle work type selection (1, 2, 3)
        if (['1', '2', '3', 'problem', 'goal', 'negative experience', 'negative'].includes(transcript.toLowerCase())) {
          handleWorkTypeSelection(transcript);
          return;
        }
        // Handle method selection by name (only for problem-clearing methods)
        if (['problem shifting', 'identity shifting', 'belief shifting', 'blockage shifting'].includes(transcript.toLowerCase())) {
          handleMethodSelection(transcript);
          return;
        }
      }
      
      // Handle method selection ONLY when we're actually on the method selection step
      if (currentStep === 'choose_method') {
        // Handle method selection by name or number
        if (['1', '2', '3', '4', '5', '6', 'problem shifting', 'identity shifting', 'belief shifting', 'blockage shifting', 'reality shifting', 'trauma shifting'].includes(transcript.toLowerCase())) {
          handleMethodSelection(transcript);
          return;
        }
      }
      
      if (currentStep === 'digging_deeper_start') {
        if (['yes', 'no'].includes(transcript)) {
          handleYesNoResponse(transcript as 'yes' | 'no');
          return;
        }
      }
      
      if (currentStep === 'digging_method_selection') {
        // Handle digging method selection by name or number
        if (['1', '2', '3', 'problem shifting', 'identity shifting', 'belief shifting'].includes(transcript.toLowerCase())) {
          handleMethodSelection(transcript);
          return;
        }
      }
      
      // Handle yes/no responses for steps matching the flowchart exactly
      const yesNoSteps = [
        'future_problem_check',           // General future problem check
        'identity_step_3_intro',          // Step 4: Check Identity (future identity check)
        'identity_problem_check',         // Step 5: Check Problem
        // Reality Shifting yes/no steps
        'reality_step_b',                 // Reality Shifting B section
        'reality_doubts_check',           // Reality Shifting doubts check
        'reality_certainty_check',        // Reality Shifting certainty check
        'goal_deadline_check',            // Goal deadline check
        'goal_confirmation',              // Goal confirmation
        // Dig Deeper section - all yes/no steps across all modalities
        'digging_deeper_start',           // Initial dig deeper question
        'scenario_check_1',               // Scenario check 1
        'scenario_check_2',               // Scenario check 2  
        'scenario_check_3',               // Scenario check 3
        'anything_else_check_1',          // Anything else check 1
        'anything_else_check_2',          // Anything else check 2
        'anything_else_check_3'           // Anything else check 3
      ];
      
      if (yesNoSteps.includes(currentStep)) {
        if (['yes', 'no', 'maybe'].includes(transcript)) {
          handleYesNoMaybeResponse(transcript as 'yes' | 'no' | 'maybe');
          return;
        }
      }
      
      // For text input contexts, fill the input field
      if (transcript && transcript !== 'yes' && transcript !== 'no' && transcript !== 'maybe') {
        setUserInput(transcript);
      }
    },
    onError: (error) => {
      console.log('🚨 Voice error received in TreatmentSession:', error);
      setVoiceError(error);
      // Auto-clear the error after 10 seconds
      setTimeout(() => setVoiceError(''), 10000);
    },
    currentStep,
    disabled: hasError || isLoading
  });

  const handleYesNoResponse = async (response: 'yes' | 'no') => {
    await sendMessageWithContent(response);
  };

  const handleYesNoMaybeResponse = async (response: 'yes' | 'no' | 'maybe') => {
    await sendMessageWithContent(response);
  };

  const handleMethodSelection = async (method: string) => {
    console.log('🔍 DEBUG: handleMethodSelection called with:', method, 'from stack:', new Error().stack?.split('\n')[2]?.trim());
    await sendMessageWithContent(method);
  };

  const handleWorkTypeSelection = async (method: string) => {
    // Prevent multiple clicks while processing
    if (isLoading) {
      return;
    }

    // Only accept valid selections
    if (!['1', '2', '3', 'PROBLEM', 'GOAL', 'NEGATIVE EXPERIENCE'].includes(method.toUpperCase())) {
      return;
    }

    // Set visual feedback immediately
    setClickedButton(method);
    setTimeout(() => setClickedButton(null), 300);

    // Set the selected work type for UI state management
    let workType = '';
    if (method === '1' || method.toUpperCase() === 'PROBLEM') {
      setSelectedWorkType('PROBLEM');
      workType = 'PROBLEM';
    } else if (method === '2' || method.toUpperCase() === 'GOAL') {
      setSelectedWorkType('GOAL');
      workType = 'GOAL';
    } else if (method === '3' || method.toUpperCase() === 'NEGATIVE EXPERIENCE') {
      setSelectedWorkType('NEGATIVE EXPERIENCE');
      workType = 'NEGATIVE EXPERIENCE';
    }

    // Let sendMessageWithContent handle the loading state
    console.log('🎯 handleWorkTypeSelection: Processing selection:', method, 'Selected work type:', workType);
    try {
      // For GOAL and NEGATIVE EXPERIENCE, automatically proceed with the designated method
      if (method === '2' || method.toUpperCase() === 'GOAL') {
        console.log('🎯 handleWorkTypeSelection: Sending GOAL selection to backend');
        await sendMessageWithContent('2'); // Send work type selection
        // The backend should automatically route to Reality Shifting
      } else if (method === '3' || method.toUpperCase() === 'NEGATIVE EXPERIENCE') {
        console.log('🎯 handleWorkTypeSelection: Sending NEGATIVE EXPERIENCE selection to backend');
        await sendMessageWithContent('3'); // Send work type selection
        // The backend should automatically route to Trauma Shifting
      } else {
        console.log('🎯 handleWorkTypeSelection: Sending PROBLEM selection to backend');
        // For PROBLEM (1), just send the work type selection and show method choices
        await sendMessageWithContent(method);
      }
      console.log('🎯 handleWorkTypeSelection: Selection processing completed successfully');
    } catch (error) {
      console.error('🎯 handleWorkTypeSelection: Error in work type selection:', error);
    }
  };

  // Save current state to history (called AFTER successful operations)
  const saveToHistory = () => {
    // Only save if we have a valid current step, messages, and session is active
    if (!currentStep || messages.length === 0 || !isSessionActive) {
      return;
    }

    // Don't save if currently loading to avoid interfering with voice system
    if (isLoading) {
      return;
    }

    const historyEntry: StepHistoryEntry = {
      messages: [...messages], // Deep copy
      currentStep,
      userInput,
      sessionStats: { ...sessionStats }, // Deep copy
      timestamp: new Date().getTime() // Use current timestamp
    };

    setStepHistory(prev => {
      const newHistory = [...prev, historyEntry];
      // Keep only last 10 steps to prevent memory issues
      return newHistory.slice(-10);
    });
  };

  const handleUndo = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    console.log('Undo button clicked, history length:', stepHistory.length);
    
    if (stepHistory.length === 0 || isLoading) {
      console.log('Undo blocked:', { historyLength: stepHistory.length, isLoading });
      return; // Button should be disabled, but double-check
    }

    const previousState = stepHistory[stepHistory.length - 1];
    console.log('Restoring previous state:', previousState);
    
    setIsLoading(true); // Prevent double-clicks during undo
    
    try {
      // Debug: Log the parameters being sent
      console.log('Frontend: Sending undo request with parameters:', {
        sessionId,
        userId,
        action: 'undo',
        undoToStep: previousState.currentStep
      });
      
      // Sync with backend state machine - clear user response for the step we're undoing FROM
      const response = await fetch('/api/treatment-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userId,
          action: 'undo',
          undoToStep: previousState.currentStep // Tell backend which step we're undoing TO
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📤 Undo API Response data:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Undo failed');
      }
      
      // CRITICAL FIX: Use backend's currentStep, not step history
      // Backend may have updated the step during undo processing
      const backendCurrentStep = data.currentStep || previousState.currentStep;
      
      // Force a small delay to ensure state synchronization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Only restore UI state if backend undo succeeded
      setMessages([...previousState.messages]);
      setCurrentStep(backendCurrentStep); // Use backend's step, not history step
      setUserInput(previousState.userInput);
      setSessionStats({ ...previousState.sessionStats });
              // Note: lastResponseTime will be updated by the response handler
      
      // Remove the last history entry
      setStepHistory(prev => prev.slice(0, -1));
      console.log('Undo complete - both UI and backend synchronized with step:', backendCurrentStep);
      
    } catch (error) {
      console.error('Undo failed:', error);
      // Don't restore UI state if backend sync failed
      // This prevents UI/backend desynchronization
    } finally {
      setIsLoading(false);
    }
  };

  const updateStats = (data: any) => {
    setSessionStats(prev => ({
      totalResponses: prev.totalResponses + 1, // Increment total responses
      avgResponseTime: data.responseTime || prev.avgResponseTime,
      aiUsagePercent: calculateAIUsagePercent(
        data.usedAI ? prev.totalResponses : prev.totalResponses, // Use total responses for AI usage
        data.usedAI ? prev.totalResponses - 1 : prev.totalResponses // Subtract 1 for scripted responses
      )
    }));
  };

  const calculateAIUsagePercent = (aiResponses: number, scriptedResponses: number): number => {
    const total = aiResponses + scriptedResponses;
    return total > 0 ? Math.round((aiResponses / total) * 100) : 0;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Helper function to detect if method has been selected and user should input problem description
  const isMethodSelectedAndWaitingForProblemDescription = () => {
    // Check if we have messages and the last bot message asks for problem description
    if (messages.length === 0) return false;
    
    // Get the last bot message
    const lastBotMessage = messages.filter(m => !m.isUser).pop();
    if (!lastBotMessage) return false;
    
    // Check for various problem description requests (including AI-generated ones)
    const problemDescriptionIndicators = [
      "Tell me what the problem is in a few words",
      "Which specific", // AI clarification questions
      "Please choose one to focus on", // AI focus requests
      "What is bothering you the most", // AI specificity requests
      "Please tell me what", // Other AI requests for clarification
      "Can you be more specific", // AI asking for specificity
      "What aspect of", // AI asking for aspect clarification
    ];
    
    return problemDescriptionIndicators.some(indicator => 
      lastBotMessage.content.includes(indicator)
    );
  };

  // Helper function to determine if we should show method selection UI
  const shouldShowMethodSelection = () => {
    // Don't show method selection if we're past the initial explanation step
    if (currentStep !== 'mind_shifting_explanation') return false;
    
    // Don't show if we're waiting for problem description or in AI clarification
    if (isMethodSelectedAndWaitingForProblemDescription()) return false;
    
    // Don't show if the last message indicates we're in treatment phase or AI is involved
    const lastBotMessage = messages.filter(m => !m.isUser).pop();
    if (lastBotMessage?.usedAI) return false; // AI is asking clarifying questions
    
    // Don't show if we have user responses that indicate we're past method selection
    const userMessages = messages.filter(m => m.isUser);
    if (userMessages.length >= 2) { // User has made multiple inputs, likely past method selection
      return false;
    }
    
    return true;
  };

  // Helper function to determine if we should show the choose_method buttons
  const shouldShowChooseMethodButtons = () => {
    // Only show for choose_method step
    if (currentStep !== 'choose_method') return false;
    
    // Don't show if AI is asking clarifying questions
    const lastBotMessage = messages.filter(m => !m.isUser).pop();
    if (lastBotMessage?.usedAI) return false;
    
    // Check if the last bot message contains clarifying question patterns
    if (lastBotMessage) {
      const clarifyingIndicators = [
        "Which specific", // AI clarification questions
        "Please choose one to focus on", // AI focus requests
        "What is bothering you the most", // AI specificity requests
        "Please tell me what", // Other AI requests for clarification
        "Can you be more specific", // AI asking for specificity
        "What aspect of", // AI asking for aspect clarification
        "Please describe", // AI asking for description
        "Tell me more about", // AI asking for more details
      ];
      
      if (clarifyingIndicators.some(indicator => lastBotMessage.content.includes(indicator))) {
        return false; // Don't show buttons, show text input instead
      }
    }
    
    return true;
  };

  // Helper function to determine if we should show the digging method selection buttons
  const shouldShowDiggingMethodButtons = () => {
    // Only show for digging_method_selection step
    if (currentStep !== 'digging_method_selection') return false;
    
    // Don't show if AI is asking clarifying questions
    const lastBotMessage = messages.filter(m => !m.isUser).pop();
    if (lastBotMessage?.usedAI) return false;
    
    return true;
  };

  // Helper function to determine if we should show the future_problem_check buttons (Yes/No/Maybe)
  const shouldShowFutureProblemCheckButtons = () => {
    // Show for yes/no steps matching the flowchart exactly
    const yesNoSteps = [
      'future_problem_check',           // General future problem check
      'identity_problem_check',         // Step 5: Check Problem
      // Dig Deeper section - all yes/no steps across all modalities
      'digging_deeper_start',           // Initial dig deeper question
      'scenario_check_1',               // Scenario check 1
      'scenario_check_2',               // Scenario check 2  
      'scenario_check_3',               // Scenario check 3
      'anything_else_check_1',          // Anything else check 1
      'anything_else_check_2',          // Anything else check 2
      'anything_else_check_3'           // Anything else check 3
    ];
    
    if (!yesNoSteps.includes(currentStep)) return false;
    
    // Don't show if AI is asking clarifying questions
    const lastBotMessage = messages.filter(m => !m.isUser).pop();
    if (lastBotMessage?.usedAI) return false;
    
    // Check if the last bot message contains clarifying question patterns
    if (lastBotMessage) {
      const clarifyingIndicators = [
        "Which specific", // AI clarification questions
        "Please choose one to focus on", // AI focus requests
        "What is bothering you the most", // AI specificity requests
        "Please tell me what", // Other AI requests for clarification
        "Can you be more specific", // AI asking for specificity
        "What aspect of", // AI asking for aspect clarification
        "Please describe", // AI asking for description
        "Tell me more about", // AI asking for more details
        "How would you", // AI asking for user perspective
        "What do you think", // AI asking for opinion
      ];
      
      if (clarifyingIndicators.some(indicator => lastBotMessage.content.includes(indicator))) {
        return false; // Don't show buttons, show text input instead
      }
    }
    
    return true;
  };

  // Helper function to determine if we should show the digging_deeper_start buttons
  const shouldShowDiggingDeeperButtons = () => {
    // Only show for digging_deeper_start step
    if (currentStep !== 'digging_deeper_start') return false;
    
    // Don't show if AI is asking clarifying questions
    const lastBotMessage = messages.filter(m => !m.isUser).pop();
    if (lastBotMessage?.usedAI) return false;
    
    // Check if the last bot message contains clarifying question patterns
    if (lastBotMessage) {
      const clarifyingIndicators = [
        "Which specific", // AI clarification questions
        "Please choose one to focus on", // AI focus requests
        "What is bothering you the most", // AI specificity requests
        "Please tell me what", // Other AI requests for clarification
        "Can you be more specific", // AI asking for specificity
        "What aspect of", // AI asking for aspect clarification
        "Please describe", // AI asking for description
        "Tell me more about", // AI asking for more details
        "How would you", // AI asking for user perspective
        "What do you think", // AI asking for opinion
      ];
      
      if (clarifyingIndicators.some(indicator => lastBotMessage.content.includes(indicator))) {
        return false; // Don't show buttons, show text input instead
      }
    }
    
    return true;
  };

  const getResponseTimeColor = (responseTime: number): string => {
    if (responseTime < 200) return 'text-green-600'; // Instant
    if (responseTime < 1000) return 'text-yellow-600'; // Fast
    if (responseTime < 3000) return 'text-orange-600'; // Acceptable
    return 'text-red-600'; // Slow
  };

  const getResponseTimeLabel = (responseTime: number): string => {
    if (responseTime < 200) return 'Instant';
    if (responseTime < 1000) return 'Fast';
    if (responseTime < 3000) return 'Normal';
    return 'Slow';
  };

  // If there's an error starting the session, show error state
  if (hasError && !isSessionActive && messages.length === 0) {
    return (
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 min-h-96">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Session Error
            </h2>
            <p className="text-gray-600 mb-4">
              {errorMessage || 'There seems to be an issue with the session flow. Please try again or contact support.'}
            </p>
            <button
              onClick={startSession}
              disabled={isLoading}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
            >
              {isLoading ? 'Retrying...' : 'Retry Session'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900">
      {/* Header with Session Stats */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-400 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-6 w-6 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{formatMethodName(sessionMethod)} Session</h2>
            <span className="text-sm text-gray-500 dark:text-gray-300">Step: {currentStep}</span>
          </div>
          
          <div className="flex items-center space-x-4 text-sm">
            {/* AI Usage Indicator */}
            <div className="flex items-center space-x-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-600 dark:text-gray-300">AI: {sessionStats.aiUsagePercent}%</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                (Target: &lt;5%)
              </span>
            </div>
            
            {/* Response Time */}
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className={`font-medium ${getResponseTimeColor(lastResponseTime)}`}>
                {lastResponseTime}ms
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({getResponseTimeLabel(lastResponseTime)})
              </span>
            </div>
            
            {/* Performance Badge */}
            {sessionStats.aiUsagePercent <= 5 && lastResponseTime < 200 && (
              <div className="flex items-center space-x-1 bg-green-100 dark:bg-green-900/20 px-2 py-1 rounded-full">
                <CheckCircle className="h-3 w-3 text-green-600" />
                <span className="text-xs text-green-700 dark:text-green-200 font-medium">Optimal</span>
              </div>
            )}


          </div>
        </div>
      </div>

      {/* Voice Error Banner */}
      {voiceError && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-400 p-4 mx-4 rounded-r-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-orange-400 mr-3 flex-shrink-0" />
              <p className="text-sm text-orange-700 dark:text-orange-200">
                {voiceError}
              </p>
            </div>
            <button
              onClick={() => setVoiceError('')}
              className="text-orange-400 hover:text-orange-600 ml-4"
              title="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Messages Area - No longer scrollable, uses page scroll instead */}
      <div className={`px-4 py-3 space-y-3 ${currentStep === 'digging_method_selection' ? 'pb-56' : 'pb-40'}`}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3xl px-4 py-3 rounded-lg ${
                message.isUser
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {/* Message metadata for bot responses */}
              {!message.isUser && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center space-x-3">
                    {message.usedAI ? (
                      <div className="flex items-center space-x-1 text-amber-600">
                        <Zap className="h-3 w-3" />
                        <span>AI Assisted</span>
                        {message.metadata?.aiCost && (
                          <span>(${message.metadata.aiCost.toFixed(4)})</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        <span>Scripted</span>
                      </div>
                    )}
                    
                    {message.metadata?.requiresRetry && (
                      <div className="flex items-center space-x-1 text-orange-600">
                        <AlertCircle className="h-3 w-3" />
                        <span>Retry Required</span>
                      </div>
                    )}
                  </div>
                  
                  <div className={`font-medium ${getResponseTimeColor(message.responseTime || 0)}`}>
                    {message.responseTime}ms
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        
        <div ref={messagesEndRef} />
      </div>

      {/* Guardrails Components - Run validation checks for all modalities */}
      <ProblemShiftingGuardrails 
        currentStep={currentStep} 
        messages={messages} 
        lastBotMessage={messages.filter(m => !m.isUser).pop()} 
      />
      <IdentityShiftingGuardrails 
        currentStep={currentStep} 
        messages={messages} 
        lastBotMessage={messages.filter(m => !m.isUser).pop()} 
      />
      <BeliefShiftingGuardrails 
        currentStep={currentStep} 
        messages={messages} 
        lastBotMessage={messages.filter(m => !m.isUser).pop()} 
      />
      <BlockageShiftingGuardrails 
        currentStep={currentStep} 
        messages={messages} 
        lastBotMessage={messages.filter(m => !m.isUser).pop()} 
      />
      <RealityShiftingGuardrails 
        currentStep={currentStep} 
        messages={messages} 
        lastBotMessage={messages.filter(m => !m.isUser).pop()} 
      />
      <TraumaShiftingGuardrails 
        currentStep={currentStep} 
        messages={messages} 
        lastBotMessage={messages.filter(m => !m.isUser).pop()} 
      />

      {/* Fixed Input Area at Bottom */}
      {isSessionActive && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 px-4 py-3 shadow-lg z-30">
          <div className="max-w-4xl mx-auto flex justify-end">
            {/* MODULAR APPROACH: Try each modality component in order */}
            <ProblemShifting 
              sessionId={sessionId}
              userId={userId}
              messages={messages}
              currentStep={currentStep}
              isLoading={isLoading}
              sessionStats={sessionStats}
              performanceMetrics={performanceMetrics}
              stepHistory={stepHistory}
              voice={voice}
              onSendMessage={sendMessageWithContent}
              onUndo={handleUndo}
              userInput={userInput}
              setUserInput={setUserInput}
              selectedWorkType={selectedWorkType}
              clickedButton={clickedButton}
            />
            <ProblemShiftingDigging 
              sessionId={sessionId}
              userId={userId}
              messages={messages}
              currentStep={currentStep}
              isLoading={isLoading}
              sessionStats={sessionStats}
              performanceMetrics={performanceMetrics}
              stepHistory={stepHistory}
              voice={voice}
              onSendMessage={sendMessageWithContent}
              onUndo={handleUndo}
              userInput={userInput}
              setUserInput={setUserInput}
              selectedWorkType={selectedWorkType}
              clickedButton={clickedButton}
              modalityType="problem"
            />
            <IdentityShifting 
              sessionId={sessionId}
              userId={userId}
              messages={messages}
              currentStep={currentStep}
              isLoading={isLoading}
              sessionStats={sessionStats}
              performanceMetrics={performanceMetrics}
              stepHistory={stepHistory}
              voice={voice}
              onSendMessage={sendMessageWithContent}
              onUndo={handleUndo}
              userInput={userInput}
              setUserInput={setUserInput}
              selectedWorkType={selectedWorkType}
              clickedButton={clickedButton}
            />
            <IdentityShiftingDigging 
              sessionId={sessionId}
              userId={userId}
              messages={messages}
              currentStep={currentStep}
              isLoading={isLoading}
              sessionStats={sessionStats}
              performanceMetrics={performanceMetrics}
              stepHistory={stepHistory}
              voice={voice}
              onSendMessage={sendMessageWithContent}
              onUndo={handleUndo}
              userInput={userInput}
              setUserInput={setUserInput}
              selectedWorkType={selectedWorkType}
              clickedButton={clickedButton}
              modalityType="identity"
            />
            <BeliefShifting 
              sessionId={sessionId}
              userId={userId}
              messages={messages}
              currentStep={currentStep}
              isLoading={isLoading}
              sessionStats={sessionStats}
              performanceMetrics={performanceMetrics}
              stepHistory={stepHistory}
              voice={voice}
              onSendMessage={sendMessageWithContent}
              onUndo={handleUndo}
              userInput={userInput}
              setUserInput={setUserInput}
              selectedWorkType={selectedWorkType}
              clickedButton={clickedButton}
            />
            <BeliefShiftingDigging 
              sessionId={sessionId}
              userId={userId}
              messages={messages}
              currentStep={currentStep}
              isLoading={isLoading}
              sessionStats={sessionStats}
              performanceMetrics={performanceMetrics}
              stepHistory={stepHistory}
              voice={voice}
              onSendMessage={sendMessageWithContent}
              onUndo={handleUndo}
              userInput={userInput}
              setUserInput={setUserInput}
              selectedWorkType={selectedWorkType}
              clickedButton={clickedButton}
              modalityType="belief"
            />
            <BlockageShifting 
              sessionId={sessionId}
              userId={userId}
              messages={messages}
              currentStep={currentStep}
              isLoading={isLoading}
              sessionStats={sessionStats}
              performanceMetrics={performanceMetrics}
              stepHistory={stepHistory}
              voice={voice}
              onSendMessage={sendMessageWithContent}
              onUndo={handleUndo}
              userInput={userInput}
              setUserInput={setUserInput}
              selectedWorkType={selectedWorkType}
              clickedButton={clickedButton}
            />
            <BlockageShiftingDigging 
              sessionId={sessionId}
              userId={userId}
              messages={messages}
              currentStep={currentStep}
              isLoading={isLoading}
              sessionStats={sessionStats}
              performanceMetrics={performanceMetrics}
              stepHistory={stepHistory}
              voice={voice}
              onSendMessage={sendMessageWithContent}
              onUndo={handleUndo}
              userInput={userInput}
              setUserInput={setUserInput}
              selectedWorkType={selectedWorkType}
              clickedButton={clickedButton}
              modalityType="blockage"
            />
            <RealityShifting 
              sessionId={sessionId}
              userId={userId}
              messages={messages}
              currentStep={currentStep}
              isLoading={isLoading}
              sessionStats={sessionStats}
              performanceMetrics={performanceMetrics}
              stepHistory={stepHistory}
              voice={voice}
              onSendMessage={sendMessageWithContent}
              onUndo={handleUndo}
              userInput={userInput}
              setUserInput={setUserInput}
              selectedWorkType={selectedWorkType}
              clickedButton={clickedButton}
            />
            <RealityShiftingDigging 
              sessionId={sessionId}
              userId={userId}
              messages={messages}
              currentStep={currentStep}
              isLoading={isLoading}
              sessionStats={sessionStats}
              performanceMetrics={performanceMetrics}
              stepHistory={stepHistory}
              voice={voice}
              onSendMessage={sendMessageWithContent}
              onUndo={handleUndo}
              userInput={userInput}
              setUserInput={setUserInput}
              selectedWorkType={selectedWorkType}
              clickedButton={clickedButton}
              modalityType="reality"
            />
            <TraumaShifting 
              sessionId={sessionId}
              userId={userId}
              messages={messages}
              currentStep={currentStep}
              isLoading={isLoading}
              sessionStats={sessionStats}
              performanceMetrics={performanceMetrics}
              stepHistory={stepHistory}
              voice={voice}
              onSendMessage={sendMessageWithContent}
              onUndo={handleUndo}
              userInput={userInput}
              setUserInput={setUserInput}
              selectedWorkType={selectedWorkType}
              clickedButton={clickedButton}
            />
            <TraumaShiftingDigging 
              sessionId={sessionId}
              userId={userId}
              messages={messages}
              currentStep={currentStep}
              isLoading={isLoading}
              sessionStats={sessionStats}
              performanceMetrics={performanceMetrics}
              stepHistory={stepHistory}
              voice={voice}
              onSendMessage={sendMessageWithContent}
              onUndo={handleUndo}
              userInput={userInput}
              setUserInput={setUserInput}
              selectedWorkType={selectedWorkType}
              clickedButton={clickedButton}
              modalityType="trauma"
            />
                         {/* FALLBACK: Original monolithic logic (will be commented out as modalities are completed) */}
             {/* COMMENTED OUT: Problem Shifting and Identity Shifting now handled by modality components above */}
             {false && (currentStep === 'check_if_still_problem' || currentStep === 'blockage_check_if_still_problem' || currentStep === 'identity_check' || currentStep === 'identity_problem_check' || currentStep === 'confirm_identity_problem' || currentStep === 'identity_dissolve_step_f' || currentStep === 'identity_step_3_intro' || currentStep === 'reality_step_b' || currentStep === 'reality_doubts_check' || currentStep === 'reality_certainty_check' || currentStep === 'trauma_identity_check' || currentStep === 'trauma_experience_check' || currentStep === 'trauma_dig_deeper' || currentStep === 'trauma_shifting_intro' || currentStep === 'belief_step_f' || currentStep === 'belief_check_1' || currentStep === 'belief_check_2' || currentStep === 'belief_check_3' || currentStep === 'belief_check_4' || currentStep === 'belief_problem_check' || currentStep === 'confirm_belief_problem' || currentStep === 'goal_deadline_check' || currentStep === 'goal_confirmation') ? (
              /* Yes/No Button Interface */
              <div className="flex space-x-3 max-w-4xl w-full">
                {/* Undo Button for Button Interface */}
                <div className="flex items-center">
                  <button
                    onClick={handleUndo}
                    disabled={isLoading || stepHistory.length === 0}
                    className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed border border-gray-300 rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-gray-600"
                    title={stepHistory.length === 0 ? "No previous steps to undo" : "Undo last step"}
                  >
                    <Undo2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>

                {/* Voice Indicator for Button Interface */}
                {((voice.isListening && voice.isVoiceInputEnabled) || (voice.isSpeaking && voice.isVoiceOutputEnabled)) && (
                  <div className="flex items-center">
                    <div className="flex items-center space-x-1 bg-black/80 text-white px-2 py-1 rounded-full text-xs">
                      {voice.isListening && voice.isVoiceInputEnabled && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          <span>Listening</span>
                        </div>
                      )}
                      {voice.isSpeaking && voice.isVoiceOutputEnabled && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span>Speaking</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col space-y-3 flex-1">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Please select Yes or No below..."
                    disabled={true}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    maxLength={500}
                  />
                  <div className="absolute right-3 top-3 text-xs text-gray-400">
                    Disabled
                  </div>
                </div>
                
                <div className="flex space-x-4 justify-center">
                  <button
                    onClick={() => handleYesNoResponse('yes')}
                    disabled={isLoading}
                    className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <span className="bg-red-700 px-2 py-1 rounded text-sm font-bold">1</span>
                    <span>Yes</span>
                  </button>
                  
                  <button
                    onClick={() => handleYesNoResponse('no')}
                    disabled={isLoading}
                    className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <span className="bg-green-700 px-2 py-1 rounded text-sm font-bold">2</span>
                    <span>No</span>
                  </button>
                </div>
                </div>
              </div>
            ) : shouldShowDiggingDeeperButtons() ? (
              /* Yes/No Button Interface for Digging Deeper */
              <div className="flex space-x-3 max-w-4xl w-full">
                {/* Undo Button for Digging Deeper Interface */}
                <div className="flex items-center">
                  <button
                    onClick={handleUndo}
                    disabled={isLoading || stepHistory.length === 0}
                    className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed border border-gray-300 rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-gray-600"
                    title={stepHistory.length === 0 ? "No previous steps to undo" : "Undo last step"}
                  >
                    <Undo2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>

                {/* Voice Indicator for Digging Deeper Interface */}
                {((voice.isListening && voice.isVoiceInputEnabled) || (voice.isSpeaking && voice.isVoiceOutputEnabled)) && (
                  <div className="flex items-center">
                    <div className="flex items-center space-x-1 bg-black/80 text-white px-2 py-1 rounded-full text-xs">
                      {voice.isListening && voice.isVoiceInputEnabled && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          <span>Listening</span>
                        </div>
                      )}
                      {voice.isSpeaking && voice.isVoiceOutputEnabled && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span>Speaking</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col space-y-3 flex-1">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Please select Yes or No below..."
                    disabled={true}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    maxLength={500}
                  />
                  <div className="absolute right-3 top-3 text-xs text-gray-400">
                    Disabled
                  </div>
                </div>
                
                <div className="flex space-x-4 justify-center">
                  <button
                    onClick={() => handleYesNoResponse('yes')}
                    disabled={isLoading}
                    className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <span className="bg-red-700 px-2 py-1 rounded text-sm font-bold">1</span>
                    <span>Yes</span>
                  </button>
                  
                  <button
                    onClick={() => handleYesNoResponse('no')}
                    disabled={isLoading}
                    className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <span className="bg-green-700 px-2 py-1 rounded text-sm font-bold">2</span>
                    <span>No</span>
                  </button>
                </div>
                </div>
              </div>
            ) : shouldShowFutureProblemCheckButtons() ? (
              /* Yes/No/Maybe Button Interface for Future Problem Check */
              <div className="flex space-x-3 max-w-4xl w-full">
                {/* Undo Button for Future Problem Check Interface */}
                <div className="flex items-center">
                  <button
                    onClick={handleUndo}
                    disabled={isLoading || stepHistory.length === 0}
                    className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed border border-gray-300 rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-gray-600"
                    title={stepHistory.length === 0 ? "No previous steps to undo" : "Undo last step"}
                  >
                    <Undo2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>

                {/* Voice Indicator for Future Problem Check Interface */}
                {((voice.isListening && voice.isVoiceInputEnabled) || (voice.isSpeaking && voice.isVoiceOutputEnabled)) && (
                  <div className="flex items-center">
                    <div className="flex items-center space-x-1 bg-black/80 text-white px-2 py-1 rounded-full text-xs">
                      {voice.isListening && voice.isVoiceInputEnabled && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          <span>Listening</span>
                        </div>
                      )}
                      {voice.isSpeaking && voice.isVoiceOutputEnabled && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span>Speaking</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col space-y-3 flex-1">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Please select Yes, No, or Maybe below..."
                    disabled={true}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    maxLength={500}
                  />
                  <div className="absolute right-3 top-3 text-xs text-gray-400">
                    Disabled
                  </div>
                </div>
                
                <div className="flex space-x-3 justify-center">
                  <button
                    onClick={() => handleYesNoMaybeResponse('yes')}
                    disabled={isLoading}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <span className="bg-red-700 px-2 py-1 rounded text-sm font-bold">1</span>
                    <span>Yes</span>
                  </button>
                  
                  <button
                    onClick={() => handleYesNoMaybeResponse('maybe')}
                    disabled={isLoading}
                    className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <span className="bg-orange-700 px-2 py-1 rounded text-sm font-bold">2</span>
                    <span>Maybe</span>
                  </button>
                  
                  <button
                    onClick={() => handleYesNoMaybeResponse('no')}
                    disabled={isLoading}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <span className="bg-green-700 px-2 py-1 rounded text-sm font-bold">3</span>
                    <span>No</span>
                  </button>
                </div>
                </div>
              </div>
            ) : false && shouldShowChooseMethodButtons() ? (
              /* COMMENTED OUT: Method Selection Interface for choose_method step - Now handled by modality components */
              <div className="flex space-x-3 max-w-4xl w-full">
                {/* Undo Button for Method Selection */}
                <div className="flex items-center">
                  <button
                    onClick={handleUndo}
                    disabled={isLoading || stepHistory.length === 0}
                    className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed border border-gray-300 rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-gray-600"
                    title={stepHistory.length === 0 ? "No previous steps to undo" : "Undo last step"}
                  >
                    <Undo2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>

                {/* Voice Indicator for Method Selection */}
                {((voice.isListening && voice.isVoiceInputEnabled) || (voice.isSpeaking && voice.isVoiceOutputEnabled)) && (
                  <div className="flex items-center">
                    <div className="flex items-center space-x-1 bg-black/80 text-white px-2 py-1 rounded-full text-xs">
                      {voice.isListening && voice.isVoiceInputEnabled && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          <span>Listening</span>
                        </div>
                      )}
                      {voice.isSpeaking && voice.isVoiceOutputEnabled && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span>Speaking</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col space-y-4 flex-1">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Choose your Mind Shifting method:
                    </h3>
                    {selectedWorkType === 'PROBLEM' ? (
                      // 2x2 grid layout for problem-clearing methods only
                      <div className="flex justify-center">
                        <div className="grid grid-cols-2 gap-3 max-w-lg">
                          <button
                            onClick={() => handleMethodSelection('Problem Shifting')}
                            disabled={isLoading}
                            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                          >
                            <span className="bg-blue-700 px-2 py-1 rounded text-xs font-bold">1</span>
                            <span>Problem Shifting</span>
                          </button>
                          
                          <button
                            onClick={() => handleMethodSelection('Identity Shifting')}
                            disabled={isLoading}
                            className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                          >
                            <span className="bg-purple-700 px-2 py-1 rounded text-xs font-bold">2</span>
                            <span>Identity Shifting</span>
                          </button>
                          
                          <button
                            onClick={() => handleMethodSelection('Belief Shifting')}
                            disabled={isLoading}
                            className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                          >
                            <span className="bg-green-700 px-2 py-1 rounded text-xs font-bold">3</span>
                            <span>Belief Shifting</span>
                          </button>
                          
                          <button
                            onClick={() => handleMethodSelection('Blockage Shifting')}
                            disabled={isLoading}
                            className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                          >
                            <span className="bg-orange-700 px-2 py-1 rounded text-xs font-bold">4</span>
                            <span>Blockage Shifting</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Original flexible layout for non-problem work types
                      <div className="flex flex-col space-y-3 items-center">
                        {/* First row - 3 buttons */}
                        <div className="flex space-x-3 justify-center">
                          <button
                            onClick={() => handleMethodSelection('Problem Shifting')}
                            disabled={isLoading}
                            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                          >
                            <span className="bg-blue-700 px-2 py-1 rounded text-xs font-bold">1</span>
                            <span>Problem Shifting</span>
                          </button>
                          
                          <button
                            onClick={() => handleMethodSelection('Blockage Shifting')}
                            disabled={isLoading}
                            className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                          >
                            <span className="bg-orange-700 px-2 py-1 rounded text-xs font-bold">2</span>
                            <span>Blockage Shifting</span>
                          </button>
                          
                          <button
                            onClick={() => handleMethodSelection('Identity Shifting')}
                            disabled={isLoading}
                            className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                          >
                            <span className="bg-purple-700 px-2 py-1 rounded text-xs font-bold">3</span>
                            <span>Identity Shifting</span>
                          </button>
                        </div>
                        
                        {/* Second row - Reality/Trauma/Belief Shifting */}
                        <div className="flex space-x-3 justify-center">
                          <button
                            onClick={() => handleMethodSelection('Reality Shifting')}
                            disabled={isLoading}
                            className="px-4 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                          >
                            <span className="bg-cyan-700 px-2 py-1 rounded text-xs font-bold">4</span>
                            <span>Reality Shifting</span>
                          </button>
                          
                          <button
                            onClick={() => handleMethodSelection('Trauma Shifting')}
                            disabled={isLoading}
                            className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                          >
                            <span className="bg-red-700 px-2 py-1 rounded text-xs font-bold">5</span>
                            <span>Trauma Shifting</span>
                          </button>
                          
                          <button
                            onClick={() => handleMethodSelection('Belief Shifting')}
                            disabled={isLoading}
                            className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                          >
                            <span className="bg-green-700 px-2 py-1 rounded text-xs font-bold">6</span>
                            <span>Belief Shifting</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : shouldShowDiggingMethodButtons() ? (
              /* Digging Method Selection Interface for digging_method_selection step */
              <div className="flex space-x-3 max-w-4xl w-full">
                {/* Undo Button for Digging Method Selection */}
                <div className="flex items-center">
                  <button
                    onClick={handleUndo}
                    disabled={isLoading || stepHistory.length === 0}
                    className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed border border-gray-300 rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-gray-600"
                    title={stepHistory.length === 0 ? "No previous steps to undo" : "Undo last step"}
                  >
                    <Undo2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>

                {/* Voice Indicator for Digging Method Selection */}
                {((voice.isListening && voice.isVoiceInputEnabled) || (voice.isSpeaking && voice.isVoiceOutputEnabled)) && (
                  <div className="flex items-center">
                    <div className="flex items-center space-x-1 bg-black/80 text-white px-2 py-1 rounded-full text-xs">
                      {voice.isListening && voice.isVoiceInputEnabled && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          <span>Listening</span>
                        </div>
                      )}
                      {voice.isSpeaking && voice.isVoiceOutputEnabled && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span>Speaking</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col space-y-4 flex-1">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Choose your method to clear this problem:
                    </h3>
                    <div className="flex justify-center">
                      <div className="grid grid-cols-2 gap-3 max-w-lg">
                        <button
                          onClick={() => handleMethodSelection('Problem Shifting')}
                          disabled={isLoading}
                          className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                        >
                          <span className="bg-blue-700 px-2 py-1 rounded text-xs font-bold">1</span>
                          <span>Problem Shifting</span>
                        </button>
                        
                        <button
                          onClick={() => handleMethodSelection('Identity Shifting')}
                          disabled={isLoading}
                          className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                        >
                          <span className="bg-purple-700 px-2 py-1 rounded text-xs font-bold">2</span>
                          <span>Identity Shifting</span>
                        </button>
                        
                        <button
                          onClick={() => handleMethodSelection('Belief Shifting')}
                          disabled={isLoading}
                          className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                        >
                          <span className="bg-green-700 px-2 py-1 rounded text-xs font-bold">3</span>
                          <span>Belief Shifting</span>
                        </button>
                        
                        <button
                          onClick={() => handleMethodSelection('Blockage Shifting')}
                          disabled={isLoading}
                          className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                        >
                          <span className="bg-orange-700 px-2 py-1 rounded text-xs font-bold">4</span>
                          <span>Blockage Shifting</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : shouldShowMethodSelection() ? (
              /* Combined Work Type and Method Selection Interface */
              <div className="flex space-x-3 max-w-4xl w-full">
                {/* Undo Button for Combined Selection */}
                <div className="flex items-center">
                  <button
                    onClick={handleUndo}
                    disabled={isLoading || stepHistory.length === 0}
                    className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed border border-gray-300 rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-gray-600"
                    title={stepHistory.length === 0 ? "No previous steps to undo" : "Undo last step"}
                  >
                    <Undo2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>

                {/* Voice Indicator for Combined Selection */}
                {((voice.isListening && voice.isVoiceInputEnabled) || (voice.isSpeaking && voice.isVoiceOutputEnabled)) && (
                  <div className="flex items-center">
                    <div className="flex items-center space-x-1 bg-black/80 text-white px-2 py-1 rounded-full text-xs">
                      {voice.isListening && voice.isVoiceInputEnabled && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          <span>Listening</span>
                        </div>
                      )}
                      {voice.isSpeaking && voice.isVoiceOutputEnabled && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span>Speaking</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col space-y-4 flex-1">
                  {/* Work Type Selection Section - Only show when no work type selected */}
                  {!selectedWorkType && (
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        What do you want to work on?
                      </h3>
                      <div className="flex space-x-4 justify-center mb-4">
                        <button
                          onClick={() => handleWorkTypeSelection('1')}
                          disabled={isLoading}
                          className={`px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2 font-semibold ${
                            isLoading ? 'opacity-50' : ''
                          } ${
                            clickedButton === '1' ? 'scale-105 bg-blue-700 shadow-lg' : ''
                          }`}
                        >
                          <span className="bg-blue-700 px-2 py-1 rounded text-sm font-bold">1</span>
                          <span>PROBLEM</span>
                        </button>
                        
                        <button
                          onClick={() => handleWorkTypeSelection('2')}
                          disabled={isLoading}
                          className={`px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2 font-semibold ${
                            isLoading ? 'opacity-50' : ''
                          } ${
                            clickedButton === '2' ? 'scale-105 bg-green-700 shadow-lg' : ''
                          }`}
                        >
                          <span className="bg-green-700 px-2 py-1 rounded text-sm font-bold">2</span>
                          <span>GOAL</span>
                        </button>
                        
                        <button
                          onClick={() => handleWorkTypeSelection('3')}
                          disabled={isLoading}
                          className={`px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2 font-semibold ${
                            isLoading ? 'opacity-50' : ''
                          } ${
                            clickedButton === '3' ? 'scale-105 bg-purple-700 shadow-lg' : ''
                          }`}
                        >
                          <span className="bg-purple-700 px-2 py-1 rounded text-sm font-bold">3</span>
                          <span>NEGATIVE EXPERIENCE</span>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Method Selection Section - Only show for PROBLEM work type */}
                  {selectedWorkType === 'PROBLEM' && (
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        Choose your preferred problem-clearing method:
                      </h3>
                      <div className="flex justify-center">
                        {/* Problem-clearing methods in 2x2 grid layout */}
                        <div className="grid grid-cols-2 gap-3 max-w-lg">
                          <button
                            onClick={() => handleMethodSelection('Problem Shifting')}
                            disabled={isLoading}
                            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                          >
                            <span className="bg-blue-700 px-2 py-1 rounded text-xs font-bold">1</span>
                            <span>Problem Shifting</span>
                          </button>
                          
                          <button
                            onClick={() => handleMethodSelection('Identity Shifting')}
                            disabled={isLoading}
                            className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                          >
                            <span className="bg-purple-700 px-2 py-1 rounded text-xs font-bold">2</span>
                            <span>Identity Shifting</span>
                          </button>
                          
                          <button
                            onClick={() => handleMethodSelection('Belief Shifting')}
                            disabled={isLoading}
                            className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                          >
                            <span className="bg-green-700 px-2 py-1 rounded text-xs font-bold">3</span>
                            <span>Belief Shifting</span>
                          </button>
                          
                          <button
                            onClick={() => handleMethodSelection('Blockage Shifting')}
                            disabled={isLoading}
                            className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                          >
                            <span className="bg-orange-700 px-2 py-1 rounded text-xs font-bold">4</span>
                            <span>Blockage Shifting</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : currentStep !== 'choose_method' ? (
              /* Regular Text Input Interface - Only show when NOT in method selection */
              <div className="flex space-x-2 max-w-4xl w-full">
                {/* Undo Button - Positioned to the left of voice indicator */}
                <div className="flex items-center">
                  <button
                    onClick={handleUndo}
                    disabled={isLoading || stepHistory.length === 0}
                    className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed border border-gray-300 rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-gray-600"
                    title={stepHistory.length === 0 ? "No previous steps to undo" : "Undo last step"}
                  >
                    <Undo2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>

                {/* Voice Indicator - Positioned immediately to the left of input */}
                {/* Only show indicators when voice features are enabled in accessibility settings */}
                {((voice.isListening && voice.isVoiceInputEnabled) || (voice.isSpeaking && voice.isVoiceOutputEnabled)) && (
                  <div className="flex items-center">
                    <div className="flex items-center space-x-1 bg-black/80 text-white px-2 py-1 rounded-full text-xs">
                      {voice.isListening && voice.isVoiceInputEnabled && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          <span>Listening</span>
                        </div>
                      )}
                      {voice.isSpeaking && voice.isVoiceOutputEnabled && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span>Speaking</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your response..."
                    disabled={isLoading}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    maxLength={500}
                  />
                  <div className="absolute right-3 top-3 text-xs text-gray-400">
                    {userInput.length}/500
                  </div>
                </div>
                
                <button
                  onClick={sendMessage}
                  disabled={!userInput.trim() || isLoading}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Send</span>
                </button>
              </div>
            ) : null}
          </div>
          
          <div className="max-w-4xl mx-auto mt-2 text-xs text-gray-500 text-center">
            {(currentStep === 'check_if_still_problem' || currentStep === 'blockage_check_if_still_problem' || currentStep === 'identity_check' || currentStep === 'identity_problem_check' || currentStep === 'confirm_identity_problem' || currentStep === 'reality_step_b' || currentStep === 'reality_doubts_check' || currentStep === 'trauma_identity_check' || currentStep === 'trauma_experience_check' || currentStep === 'trauma_dig_deeper' || currentStep === 'belief_step_f' || currentStep === 'belief_check_1' || currentStep === 'belief_check_2' || currentStep === 'belief_check_3' || currentStep === 'belief_check_4' || currentStep === 'belief_problem_check' || currentStep === 'confirm_belief_problem' || currentStep === 'goal_deadline_check' || currentStep === 'goal_confirmation') ? (
              'Select your answer using the buttons above'
            ) : shouldShowDiggingDeeperButtons() ? (
              'Select your answer using the buttons above'
            ) : shouldShowFutureProblemCheckButtons() ? (
              'Select your answer using the buttons above'
            ) : false && shouldShowChooseMethodButtons() ? (
              'Select your preferred Mind Shifting method using the buttons above'
            ) : shouldShowDiggingMethodButtons() ? (
              'Select your preferred method to clear this problem using the buttons above'
            ) : currentStep === 'mind_shifting_explanation' ? (
              selectedWorkType === 'PROBLEM' 
                ? 'First select PROBLEM above, then choose your preferred problem-clearing method'
                : 'Select what you want to work on above'
            ) : (
              'Press Enter to send • Voice controls in accessibility settings • This session uses 95% scripted responses for optimal performance'
            )}
          </div>
        </div>
      )}

      {/* Session Complete State - Fixed at Bottom */}
      {!isSessionActive && messages.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-green-50 dark:bg-green-900/20 border-t border-gray-200 dark:border-gray-600 px-4 py-3 shadow-lg z-30">
          <div className="max-w-4xl mx-auto text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-200">Session Complete!</h3>
            <p className="text-green-700 dark:text-green-200 mt-1">
                              Your {formatMethodName(sessionMethod)} session has been completed successfully.
            </p>
                                        <div className="mt-3 text-sm text-green-600 dark:text-green-200">
                Performance: {sessionStats.totalResponses} total responses ({sessionStats.aiUsagePercent}% AI usage)
                {performanceMetrics.totalResponses > 0 && (
                  <span className="ml-2 text-blue-600 dark:text-blue-400">
                    • Cache: {performanceMetrics.cacheHitRate.toFixed(1)}% hit rate
                    {performanceMetrics.preloadedResponsesUsed > 0 && (
                      <span> • {performanceMetrics.preloadedResponsesUsed} preloaded</span>
                    )}
                  </span>
                )}
              </div>
          </div>
        </div>
      )}
    </div>
  );
} 