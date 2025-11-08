'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Brain, Clock, Zap, AlertCircle, CheckCircle, MessageSquare, Undo2, Sparkles } from 'lucide-react';
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

// Import V3 modality components
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
  version = 'v3'
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
    version: 'v3'
  });
  
  // V3: Enhanced performance metrics state
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // V3: Enhanced voice integration
  const voice = useGlobalVoice({
    onError: (error: string) => {
      console.error('V3 Voice error:', error);
      setVoiceError(error);
    },
    currentStep: currentStep
  });

  // Helper function to format method names
  const formatMethodName = (methodName: string) => {
    if (!methodName) return 'Mind Shifting V3';
    
    // Convert snake_case to Title Case
    return methodName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + ' V3';
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

  // V3: Enhanced session start
  const startSession = async () => {
    setIsLoading(true);
    setHasError(false);
    
    try {
      console.log('Starting V3 treatment session:', { sessionId, userId });
      
      const response = await fetch('/api/treatment-v3', {
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
        throw new Error(`V3 HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('V3 Start session response:', data);

      if (data.success) {
        const newMessage: TreatmentMessage = {
          id: `system-${Date.now()}`,
          content: data.message,
          isUser: false,
          timestamp: new Date(),
          responseTime: data.responseTime,
          usedAI: data.usedAI,
          version: 'v3'
        };

        setMessages([newMessage]);
        setCurrentStep(data.currentStep);
        setIsSessionActive(true);
        setLastResponseTime(data.responseTime || 0);
        
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

        // Focus input for immediate interaction
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      } else {
        throw new Error(data.error || 'Failed to start V3 session');
      }
    } catch (error) {
      console.error('V3 Start session error:', error);
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown V3 error');
      onError?.(error instanceof Error ? error.message : 'Unknown V3 error');
    } finally {
      setIsLoading(false);
    }
  };

  // V3: Enhanced session resume
  const resumeSession = async () => {
    setIsLoading(true);
    setHasError(false);
    
    try {
      console.log('Resuming V3 treatment session:', { sessionId, userId });
      
      const response = await fetch('/api/treatment-v3', {
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
        throw new Error(`V3 HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('V3 Resume session response:', data);

      if (data.success) {
        // Restore conversation history
        const restoredMessages: TreatmentMessage[] = data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          version: 'v3'
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
        console.log('V3 Resume failed, starting new session');
        await startSession();
      }
    } catch (error) {
      console.error('V3 Resume session error:', error);
      // Fallback to starting new session
      console.log('V3 Resume failed, falling back to new session');
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
      version: 'v3'
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
      version: 'v3'
    };
    setStepHistory(prev => [...prev, historyEntry]);

    try {
      console.log('Sending V3 message:', { content, currentStep });
      
      const response = await fetch('/api/treatment-v3', {
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
        throw new Error(`V3 HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('V3 Continue session response:', data);

      if (data.success) {
        const systemMessage: TreatmentMessage = {
          id: `system-${Date.now()}`,
          content: data.message,
          isUser: false,
          timestamp: new Date(),
          responseTime: data.responseTime,
          usedAI: data.usedAI,
          version: 'v3'
        };

        setMessages(prev => [...prev, systemMessage]);
        setCurrentStep(data.currentStep);
        setLastResponseTime(data.responseTime || 0);
        
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
          version: 'v3'
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

        // V3: Enhanced voice feedback
        if (voice.isVoiceOutputEnabled && systemMessage.content) {
          voice.speakGlobally(systemMessage.content);
        }

      } else {
        throw new Error(data.error || 'Failed to process V3 message');
      }
    } catch (error) {
      console.error('V3 Send message error:', error);
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown V3 error');
      
      // Add error message to conversation
      const errorMessage: TreatmentMessage = {
        id: `error-${Date.now()}`,
        content: `V3 Error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        isUser: false,
        timestamp: new Date(),
        version: 'v3'
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
      console.log('V3 Undo to step:', lastEntry.currentStep);
      
      const response = await fetch('/api/treatment-v3', {
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
        throw new Error(`V3 Undo HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('V3 Undo response:', data);

      if (data.success) {
        // Restore previous state
        setMessages(lastEntry.messages);
        setCurrentStep(lastEntry.currentStep);
        setSessionStats(lastEntry.sessionStats);
        setUserInput(lastEntry.userInput);
        
        // Remove the last entry from history
        setStepHistory(prev => prev.slice(0, -1));
        
        console.log('V3 Undo successful');
      } else {
        throw new Error(data.error || 'V3 Undo failed');
      }
    } catch (error) {
      console.error('V3 Undo error:', error);
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : 'V3 Undo failed');
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

  // V3: Helper function to determine if we should show work type selection buttons
  const shouldShowWorkTypeSelection = () => {
    // Check if we're in the initial explanation step
    const isInitialStep = currentStep === 'mind_shifting_explanation';
    
    if (!isInitialStep) return false;
    
    // Don't show if we're loading or session isn't active
    if (isLoading || !isSessionActive) return false;
    
    // Check the last bot message to see if it contains the work type options
    const lastBotMessage = messages.filter(m => !m.isUser).pop();
    if (!lastBotMessage) return false;
    
    // Show buttons if the message contains the work type selection text
    const containsWorkTypeSelection = lastBotMessage.content.includes('1. PROBLEM') && 
                                    lastBotMessage.content.includes('2. GOAL') && 
                                    lastBotMessage.content.includes('3. NEGATIVE EXPERIENCE');
    
    // Don't show if AI is asking clarifying questions
    if (lastBotMessage.usedAI) return false;
    
    // Don't show if user has already made multiple inputs (likely past selection)
    const userMessages = messages.filter(m => m.isUser);
    if (userMessages.length >= 2) return false;
    
    return containsWorkTypeSelection;
  };

  // V3: Handle work type selection button clicks
  const handleWorkTypeSelection = (workType: string) => {
    setClickedButton(workType);
    sendMessage(workType);
  };

  // V3: Helper function to determine if we should show method selection buttons
  const shouldShowMethodSelection = () => {
    // Check if we're in the method selection step
    const isMethodSelectionStep = currentStep === 'choose_method';
    
    if (!isMethodSelectionStep) return false;
    
    // Don't show if we're loading or session isn't active
    if (isLoading || !isSessionActive) return false;
    
    // Check the last bot message to see if it contains the method selection signal
    const lastBotMessage = messages.filter(m => !m.isUser).pop();
    if (!lastBotMessage) return false;
    
    // Show buttons if the message contains the method selection text
    const containsMethodSelection = lastBotMessage.content.includes('Which method would you like to use') &&
                                  lastBotMessage.content.includes('1. Problem Shifting') &&
                                  lastBotMessage.content.includes('2. Identity Shifting');
    
    // Don't show if AI is asking clarifying questions
    if (lastBotMessage.usedAI) return false;
    
    return containsMethodSelection;
  };

  // V3: Handle method selection button clicks
  const handleMethodSelection = (method: string) => {
    setClickedButton(method);
    // Send the method number instead of the full name to match V3 state machine expectations
    const methodMap: { [key: string]: string } = {
      'Problem Shifting': '1',
      'Identity Shifting': '2', 
      'Belief Shifting': '3',
      'Blockage Shifting': '4'
    };
    sendMessage(methodMap[method] || method);
  };

  return (
    <div className="max-w-4xl mx-auto px-4">
      {/* V3 Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Brain className="h-6 w-6 text-indigo-600" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {formatMethodName(sessionMethod)}
                </h2>
                <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400 rounded-full flex items-center space-x-1">
                  <Sparkles className="h-3 w-3" />
                  <span>V3</span>
                </span>
              </div>
              {currentStep && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Step: {currentStep}
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {/* V3 Performance Indicators */}
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="h-4 w-4" />
                <span>{lastResponseTime}ms</span>
              </div>
              
              {performanceMetrics.cacheHitRate > 0 && (
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <Zap className="h-4 w-4" />
                  <span>{performanceMetrics.cacheHitRate.toFixed(1)}% cache</span>
                </div>
              )}
              
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

        {/* V3 Messages Area */}
        <div className="h-96 overflow-y-auto p-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.isUser
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                {message.responseTime && (
                  <div className="flex items-center justify-between mt-1 text-xs opacity-70">
                    <span>{message.usedAI ? 'AI Enhanced' : 'Scripted'}</span>
                    <span>{message.responseTime}ms</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">V3 Processing...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* V3 Input Area */}
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
          {shouldShowWorkTypeSelection() && (
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
                  className={`px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2 font-semibold ${
                    isLoading ? 'opacity-50' : ''
                  } ${
                    clickedButton === 'Problem Shifting' ? 'scale-105 bg-blue-700 shadow-lg' : ''
                  }`}
                >
                  <span className="bg-blue-700 px-2 py-1 rounded text-sm font-bold">1</span>
                  <span>Problem Shifting</span>
                </button>
                
                <button
                  onClick={() => handleMethodSelection('Identity Shifting')}
                  disabled={isLoading}
                  className={`px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2 font-semibold ${
                    isLoading ? 'opacity-50' : ''
                  } ${
                    clickedButton === 'Identity Shifting' ? 'scale-105 bg-green-700 shadow-lg' : ''
                  }`}
                >
                  <span className="bg-green-700 px-2 py-1 rounded text-sm font-bold">2</span>
                  <span>Identity Shifting</span>
                </button>
                
                <button
                  onClick={() => handleMethodSelection('Belief Shifting')}
                  disabled={isLoading}
                  className={`px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2 font-semibold ${
                    isLoading ? 'opacity-50' : ''
                  } ${
                    clickedButton === 'Belief Shifting' ? 'scale-105 bg-purple-700 shadow-lg' : ''
                  }`}
                >
                  <span className="bg-purple-700 px-2 py-1 rounded text-sm font-bold">3</span>
                  <span>Belief Shifting</span>
                </button>
                
                <button
                  onClick={() => handleMethodSelection('Blockage Shifting')}
                  disabled={isLoading}
                  className={`px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2 font-semibold ${
                    isLoading ? 'opacity-50' : ''
                  } ${
                    clickedButton === 'Blockage Shifting' ? 'scale-105 bg-red-700 shadow-lg' : ''
                  }`}
                >
                  <span className="bg-red-700 px-2 py-1 rounded text-sm font-bold">4</span>
                  <span>Blockage Shifting</span>
                </button>
              </div>
            </div>
          )}

          {/* V3: Text Input Form - Hidden when work type buttons are shown */}
          {!shouldShowWorkTypeSelection() && !shouldShowMethodSelection() && (
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
    </div>
  );
} 