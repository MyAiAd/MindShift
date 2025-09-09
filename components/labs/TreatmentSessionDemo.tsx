'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Brain, Clock, Zap, AlertCircle, CheckCircle, MessageSquare, Undo2, Play, Pause, RotateCcw } from 'lucide-react';
// Global voice system integration (accessibility-driven)
import { useGlobalVoice } from '@/components/voice/useGlobalVoice';
import { useAuth } from '@/lib/auth';

interface TreatmentMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  responseTime?: number;
  usedAI?: boolean;
  metadata?: any;
}

interface TreatmentSessionDemoProps {
  sessionId?: string;
  userId?: string;
  shouldResume?: boolean;
  onComplete?: (sessionData: any) => void;
  onError?: (error: string) => void;
}

interface SessionStats {
  totalResponses: number;
  avgResponseTime: number;
  aiUsagePercent: number;
}

// NEW: Performance metrics from response caching
interface PerformanceMetrics {
  cacheHitRate: number;
  averageResponseTime: number;
  preloadedResponsesUsed: number;
  totalResponses: number;
}

interface StepHistoryEntry {
  messages: TreatmentMessage[];
  currentStep: string;
  userInput: string;
  sessionStats: SessionStats;
  timestamp: number;
}

export default function TreatmentSessionDemo({ 
  sessionId = `demo-${Date.now()}`, 
  userId, 
  shouldResume = false,
  onComplete, 
  onError 
}: TreatmentSessionDemoProps) {
  
  // Get authenticated user
  const { user, profile, loading: authLoading } = useAuth();
  const actualUserId = userId || user?.id;
  
  // State management
  const [messages, setMessages] = useState<TreatmentMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('problem_capture');
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    totalResponses: 0,
    avgResponseTime: 0,
    aiUsagePercent: 0
  });
  
  // Demo-specific state
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedWorkType, setSelectedWorkType] = useState<string | null>(null);
  const [clickedButton, setClickedButton] = useState<string | null>(null);
  const [sessionMethod, setSessionMethod] = useState<string>('mind_shifting');
  
  // Performance metrics
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    cacheHitRate: 0,
    averageResponseTime: 0,
    preloadedResponsesUsed: 0,
    totalResponses: 0
  });

  // Step history for undo functionality
  const [stepHistory, setStepHistory] = useState<StepHistoryEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  // Global voice integration
  const { isVoiceInputEnabled } = useGlobalVoice({});

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Helper function to format method names
  const formatMethodName = (methodName: string) => {
    if (!methodName) return 'Mind Shifting';
    
    // Convert snake_case to Title Case
    return methodName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Initialize demo session using real API
  const initializeSession = async () => {
    // Check if user is authenticated
    if (!actualUserId) {
      setError('Please sign in to use the treatment session demo.');
      return;
    }
    
    setIsSessionActive(true);
    setError('');
    setSessionComplete(false);
    setIsLoading(true);
    
    try {
      // Start new session using real API (same as original)
      const requestBody = {
        sessionId,
        userId: actualUserId,
        action: 'start'
      };
      
      console.log('📤 DEMO Session Init Request:', requestBody);
      
      const response = await fetch('/api/treatment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📤 DEMO Session Init Response:', data);
      
      if (data.success) {
        // Add welcome message from API
        const welcomeMessage: TreatmentMessage = {
          id: '1',
          content: data.message || 'Welcome to the Treatment Session Demo! Mind Shifting is not like counselling, therapy or life coaching. The Mind Shifting methods are verbal guided processes that we apply to problems, goals, or negative experiences in order to clear them. Please tell me what problem you want to work on in a few words.',
          isUser: false,
          timestamp: new Date(),
          responseTime: 0,
          usedAI: false
        };
        
        setMessages([welcomeMessage]);
        setCurrentStep(data.currentStep || 'problem_capture');
        setIsLoading(false);
        
        // Focus input
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      } else {
        throw new Error(data.error || 'Failed to initialize session');
      }
    } catch (error) {
      console.error('Session initialization error:', error);
      setError('Failed to initialize session. Please try again.');
      setIsLoading(false);
      setIsSessionActive(false);
    }
  };

  // Handle message submission using real API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || !isSessionActive || !actualUserId) return;

    const startTime = performance.now();
    const userMessage: TreatmentMessage = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      isUser: true,
      timestamp: new Date()
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Save current state to history for undo
    const historyEntry: StepHistoryEntry = {
      messages: [...messages],
      currentStep,
      userInput: inputValue.trim(),
      sessionStats: { ...sessionStats },
      timestamp: Date.now()
    };
    
    setStepHistory(prev => [...prev, historyEntry]);
    setCanUndo(true);

    try {
      // Use real API call (same as original TreatmentSession)
      const requestBody = {
        sessionId,
        userId: actualUserId,
        userInput: userMessage.content,
        action: 'continue'
      };
      
      console.log('📤 DEMO API Request body:', requestBody);
      
      const response = await fetch('/api/treatment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📤 DEMO API Response data:', data);
      
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);
      
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
          // Add AI response message
          const aiMessage: TreatmentMessage = {
            id: (Date.now() + 1).toString(),
            content: data.message,
            isUser: false,
            timestamp: new Date(),
            responseTime: responseTime,
            usedAI: data.usedAI || false,
            metadata: data.metadata
          };

          setMessages(prev => [...prev, aiMessage]);
        }
        
        setCurrentStep(data.currentStep || currentStep);
        setIsLoading(false);

        // Update stats
        setSessionStats(prev => ({
          totalResponses: prev.totalResponses + 1,
          avgResponseTime: ((prev.avgResponseTime * prev.totalResponses) + responseTime) / (prev.totalResponses + 1),
          aiUsagePercent: data.usedAI ? 
            ((prev.aiUsagePercent * prev.totalResponses) + 100) / (prev.totalResponses + 1) :
            (prev.aiUsagePercent * prev.totalResponses) / (prev.totalResponses + 1)
        }));

        // Check if session is complete
        if (data.sessionComplete) {
          setSessionComplete(true);
          setIsSessionActive(false);
          onComplete?.(data);
        }
      } else {
        throw new Error(data.error || 'Treatment API returned error');
      }

    } catch (error) {
      console.error('Treatment API error:', error);
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
      setError(errorMsg);
      setIsLoading(false);
      onError?.(errorMsg);
    }
  };

  // Handle Yes/No responses
  const handleYesNoResponse = async (response: 'yes' | 'no') => {
    console.log('🔍 DEBUG: handleYesNoResponse called with:', response);
    setClickedButton(response);
    
    // Create user message for the yes/no response
    const userMessage: TreatmentMessage = {
      id: Date.now().toString(),
      content: response.charAt(0).toUpperCase() + response.slice(1),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const requestBody = {
        sessionId,
        userId: actualUserId,
        userInput: response,
        action: 'continue'
      };
      
      const apiResponse = await fetch('/api/treatment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!apiResponse.ok) {
        throw new Error(`HTTP error! status: ${apiResponse.status}`);
      }

      const data = await apiResponse.json();
      
      if (data.success && data.message && !data.message.includes('_SELECTED')) {
        const aiMessage: TreatmentMessage = {
          id: (Date.now() + 1).toString(),
          content: data.message,
          isUser: false,
          timestamp: new Date(),
          responseTime: 0,
          usedAI: data.usedAI || false
        };

        setMessages(prev => [...prev, aiMessage]);
        setCurrentStep(data.currentStep || currentStep);
      }
      
      setIsLoading(false);
      setClickedButton(null);
    } catch (error) {
      console.error('Yes/No response error:', error);
      setError('Error processing response');
      setIsLoading(false);
      setClickedButton(null);
    }
  };

  // Handle method selection
  const handleMethodSelection = async (method: string) => {
    console.log('🔍 DEBUG: handleMethodSelection called with:', method);
    setClickedButton(method);
    
    // Create user message for the method selection
    const userMessage: TreatmentMessage = {
      id: Date.now().toString(),
      content: method,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const requestBody = {
        sessionId,
        userId: actualUserId,
        userInput: method,
        action: 'continue'
      };
      
      const response = await fetch('/api/treatment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('🔍 DEBUG: Method selection response:', data);
      
      if (data.success) {
        // Update session method
        const methodLower = method.toLowerCase().replace(' ', '_');
        setSessionMethod(methodLower);
        
        if (data.message && !data.message.includes('_SELECTED')) {
          const aiMessage: TreatmentMessage = {
            id: (Date.now() + 1).toString(),
            content: data.message,
            isUser: false,
            timestamp: new Date(),
            responseTime: 0,
            usedAI: data.usedAI || false
          };

          setMessages(prev => [...prev, aiMessage]);
        }
        
        console.log('🔍 DEBUG: Setting currentStep from', currentStep, 'to', data.currentStep);
        setCurrentStep(data.currentStep || currentStep);
      }
      
      setIsLoading(false);
      setClickedButton(null);
    } catch (error) {
      console.error('Method selection error:', error);
      setError('Error processing method selection');
      setIsLoading(false);
      setClickedButton(null);
    }
  };

  // Handle work type selection
  const handleWorkTypeSelection = async (workType: string) => {
    console.log('🎯 DEMO: handleWorkTypeSelection called with:', workType);
    setClickedButton(workType);
    
    // Set the selected work type for UI state management
    setSelectedWorkType(workType);
    
    // Send the numeric selection to the API (same as main TreatmentSession)
    const numericSelection = workType === 'PROBLEM' ? '1' : 
                            workType === 'GOAL' ? '2' : '3';
    
    const userMessage: TreatmentMessage = {
      id: Date.now().toString(),
      content: numericSelection,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const requestBody = {
        sessionId,
        userId: actualUserId,
        userInput: numericSelection,
        action: 'continue'
      };
      
      const response = await fetch('/api/treatment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('🎯 DEMO: Work type selection response:', data);
      
      if (data.success) {
        // Handle METHOD_SELECTION_NEEDED response
        if (data.message === 'METHOD_SELECTION_NEEDED') {
          console.log('🎯 DEMO: Method selection needed, setting currentStep to method_selection');
          setCurrentStep('method_selection');
          // Don't add METHOD_SELECTION_NEEDED as a message to UI
        } else if (data.message && !data.message.includes('_SELECTED') && !data.message.includes('_CONFIRMED')) {
          const aiMessage: TreatmentMessage = {
            id: (Date.now() + 1).toString(),
            content: data.message,
            isUser: false,
            timestamp: new Date(),
            responseTime: 0,
            usedAI: data.usedAI || false
          };

          setMessages(prev => [...prev, aiMessage]);
        }
        
        // Update current step from response, but prioritize our METHOD_SELECTION_NEEDED handling
        if (data.message !== 'METHOD_SELECTION_NEEDED') {
          setCurrentStep(data.currentStep || currentStep);
        }
      }
      
      setIsLoading(false);
      setClickedButton(null);
    } catch (error) {
      console.error('Work type selection error:', error);
      setError('Error processing work type selection');
      setIsLoading(false);
      setClickedButton(null);
    }
  };

  // Check if we should show Yes/No buttons
  const shouldShowYesNoButtons = () => {
    const yesNoSteps = [
      'problem_confirmation',
      'future_problem_check',
      'identity_step_3_intro',
      'identity_problem_check',
      'reality_step_b',
      'reality_doubts_check',
      'reality_certainty_check',
      'digging_deeper_start'
    ];
    return yesNoSteps.includes(currentStep);
  };

  // Check if we should show method selection buttons
  const shouldShowMethodSelection = () => {
    return currentStep === 'method_selection' || currentStep === 'digging_method_selection';
  };

  // Check if we should show work type selection
  const shouldShowWorkTypeSelection = () => {
    // Don't show work type selection if we're past the initial explanation
    // Be specific about which steps to exclude - don't use broad patterns that catch 'mind_shifting_explanation'
    if (currentStep === 'work_type_description' || 
        currentStep === 'method_selection' ||
        currentStep.includes('_intro') ||
        (currentStep.includes('_shifting') && currentStep !== 'mind_shifting_explanation')) {
      console.log('🔍 DEBUG: Not showing work type selection - past initial steps. currentStep:', currentStep);
      return false;
    }
    
    const shouldShow = (currentStep === 'mind_shifting_explanation' || currentStep === 'work_type_selection') && !selectedWorkType;
    console.log('🔍 DEBUG: shouldShowWorkTypeSelection -', {
      currentStep,
      selectedWorkType,
      shouldShow,
      stepMatch: (currentStep === 'mind_shifting_explanation' || currentStep === 'work_type_selection'),
      noWorkTypeSelected: !selectedWorkType
    });
    
    return shouldShow;
  };

  // Check if we should show problem description prompt
  const shouldShowProblemDescriptionPrompt = () => {
    return currentStep === 'work_type_description' && selectedWorkType === 'PROBLEM';
  };

  // Handle undo functionality
  const handleUndo = () => {
    if (stepHistory.length === 0) return;

    const lastEntry = stepHistory[stepHistory.length - 1];
    setMessages(lastEntry.messages);
    setCurrentStep(lastEntry.currentStep);
    setSessionStats(lastEntry.sessionStats);
    setStepHistory(prev => prev.slice(0, -1));
    setCanUndo(stepHistory.length > 1);
    setIsLoading(false);
  };

  // Reset session
  const resetSession = () => {
    setMessages([]);
    setInputValue('');
    setCurrentStep('problem_capture');
    setIsSessionActive(false);
    setSessionComplete(false);
    setError('');
    setStepHistory([]);
    setCanUndo(false);
    setIsLoading(false);
    setSelectedWorkType(null);
    setClickedButton(null);
    setSessionMethod('mind_shifting');
    setSessionStats({
      totalResponses: 0,
      avgResponseTime: 0,
      aiUsagePercent: 0
    });
    setPerformanceMetrics({
      cacheHitRate: 0,
      averageResponseTime: 0,
      preloadedResponsesUsed: 0,
      totalResponses: 0
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Brain className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Treatment Session Demo</h3>
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <span>Method: {formatMethodName(sessionMethod)}</span>
                {currentStep && (
                  <>
                    <span>•</span>
                    <span>Step: {currentStep.replace(/_/g, ' ')}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Session Stats */}
          {isSessionActive && (
            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-1">
                <MessageSquare className="h-4 w-4" />
                <span>{sessionStats.totalResponses}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>{Math.round(sessionStats.avgResponseTime)}ms</span>
              </div>
              <div className="flex items-center space-x-1">
                <Zap className="h-4 w-4" />
                <span>{Math.round(sessionStats.aiUsagePercent)}% AI</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4">
        {authLoading ? (
          // Loading authentication state
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Checking authentication...</p>
          </div>
        ) : !actualUserId ? (
          // Not authenticated
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Authentication Required
            </h4>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Please sign in to use the treatment session demo.
            </p>
          </div>
        ) : !isSessionActive && !sessionComplete ? (
          // Start Session View
          <div className="text-center py-8">
            <Brain className="h-12 w-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Treatment Session Demo
            </h4>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Experience a complete treatment session workflow. This demo uses the real 
              treatment API and provides the full authentic experience.
            </p>
            <button
              onClick={initializeSession}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Start Demo Session
            </button>
          </div>
        ) : (
          // Active Session View
          <div>
            {/* Messages Area */}
            <div className="h-96 overflow-y-auto mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-4 ${message.isUser ? 'text-right' : 'text-left'}`}
                >
                  <div
                    className={`inline-block max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.isUser
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    {message.responseTime && (
                      <p className="text-xs opacity-70 mt-1">
                        {message.responseTime}ms {message.usedAI && '• AI'}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              ))}
              
              {isLoading && (
                <div className="text-left mb-4">
                  <div className="inline-block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Processing...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Interactive Controls */}
            <div className="space-y-4">
              {/* Work Type Selection */}
              {shouldShowWorkTypeSelection() && (
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    What would you like to work on?
                  </h3>
                  <div className="flex justify-center space-x-3">
                    <button
                      onClick={() => handleWorkTypeSelection('PROBLEM')}
                      disabled={isLoading}
                      className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Problem
                    </button>
                    <button
                      onClick={() => handleWorkTypeSelection('GOAL')}
                      disabled={isLoading}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Goal
                    </button>
                    <button
                      onClick={() => handleWorkTypeSelection('EXPERIENCE')}
                      disabled={isLoading}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Negative Experience
                    </button>
                  </div>
                </div>
              )}

              {/* Yes/No Buttons */}
              {shouldShowYesNoButtons() && (
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => handleYesNoResponse('yes')}
                    disabled={isLoading}
                    className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold"
                  >
                    <span className="bg-red-700 px-2 py-1 rounded text-sm font-bold">1</span>
                    <span>Yes</span>
                  </button>
                  
                  <button
                    onClick={() => handleYesNoResponse('no')}
                    disabled={isLoading}
                    className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold"
                  >
                    <span className="bg-green-700 px-2 py-1 rounded text-sm font-bold">2</span>
                    <span>No</span>
                  </button>
                </div>
              )}

              {/* Method Selection Buttons */}
              {shouldShowMethodSelection() && (
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
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
                    // Flexible layout for other work types
                    <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
                      <button
                        onClick={() => handleMethodSelection('Reality Shifting')}
                        disabled={isLoading}
                        className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                      >
                        <span className="bg-indigo-700 px-2 py-1 rounded text-xs font-bold">1</span>
                        <span>Reality Shifting</span>
                      </button>
                      
                      <button
                        onClick={() => handleMethodSelection('Trauma Shifting')}
                        disabled={isLoading}
                        className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                      >
                        <span className="bg-red-700 px-2 py-1 rounded text-xs font-bold">2</span>
                        <span>Trauma Shifting</span>
                      </button>
                      
                      <button
                        onClick={() => handleMethodSelection('Belief Shifting')}
                        disabled={isLoading}
                        className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                      >
                        <span className="bg-green-700 px-2 py-1 rounded text-xs font-bold">3</span>
                        <span>Belief Shifting</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Problem Description Prompt */}
              {shouldShowProblemDescriptionPrompt() && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <h5 className="font-medium text-blue-900 dark:text-blue-200">
                      Describe Your Problem
                    </h5>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Please tell me what the problem is in a few words. Be specific and concise.
                  </p>
                </div>
              )}

              {/* Text Input Area */}
              {isSessionActive && !sessionComplete && !shouldShowYesNoButtons() && !shouldShowMethodSelection() && !shouldShowWorkTypeSelection() && (
                <div className="flex space-x-2 items-end">
                  {/* Undo Button */}
                  {canUndo && (
                    <button
                      onClick={handleUndo}
                      disabled={isLoading}
                      className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed border border-gray-300 rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-gray-600"
                      title="Undo last step"
                    >
                      <Undo2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    </button>
                  )}
                  
                  <form onSubmit={handleSubmit} className="flex-1 flex space-x-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Type your response..."
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !inputValue.trim()}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Send
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Session Complete */}
            {sessionComplete && (
              <div className="text-center py-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
                <h4 className="text-lg font-medium text-green-900 dark:text-green-100 mb-2">
                  Session Complete!
                </h4>
                <p className="text-green-700 dark:text-green-300 mb-4">
                  The treatment session has been successfully completed.
                </p>
                <button
                  onClick={resetSession}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Start New Session
                </button>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                  <p className="text-red-700 dark:text-red-300">{error}</p>
                </div>
              </div>
            )}

            {/* Session Controls */}
            {isSessionActive && (
              <div className="mt-4 flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Session: <span className="font-mono">{sessionId.slice(-8)}</span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Performance: {Math.round(performanceMetrics.averageResponseTime)}ms avg
                  </div>
                </div>
                <button
                  onClick={resetSession}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm transition-colors flex items-center space-x-1"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Reset Session</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 