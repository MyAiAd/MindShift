'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Brain, Clock, Zap, AlertCircle, CheckCircle, MessageSquare, Undo2 } from 'lucide-react';
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
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Interactive demo of the treatment session functionality
              </p>
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
              Experience a complete treatment session workflow. This demo simulates the full 
              problem-shifting process used in the main application.
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

            {/* Input Area */}
            {isSessionActive && !sessionComplete && (
              <form onSubmit={handleSubmit} className="flex space-x-2">
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
                {canUndo && (
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                    title="Undo last step"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                )}
              </form>
            )}

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

            {/* Controls */}
            {isSessionActive && (
              <div className="mt-4 flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Current Step: <span className="font-medium">{currentStep.replace('_', ' ')}</span>
                </div>
                <button
                  onClick={resetSession}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm transition-colors"
                >
                  Reset Session
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 