'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Brain, Clock, Zap, AlertCircle, CheckCircle, MessageSquare } from 'lucide-react';

interface TreatmentMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  responseTime?: number;
  usedAI?: boolean;
  metadata?: any;
}

interface TreatmentSessionProps {
  sessionId: string;
  userId: string;
  onComplete?: (sessionData: any) => void;
  onError?: (error: string) => void;
}

interface SessionStats {
  scriptedResponses: number;
  aiResponses: number;
  avgResponseTime: number;
  aiUsagePercent: number;
}

export default function TreatmentSession({ 
  sessionId, 
  userId, 
  onComplete, 
  onError 
}: TreatmentSessionProps) {
  const [messages, setMessages] = useState<TreatmentMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    scriptedResponses: 0,
    aiResponses: 0,
    avgResponseTime: 0,
    aiUsagePercent: 0
  });
  const [lastResponseTime, setLastResponseTime] = useState<number>(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    startSession();
  }, []);

  const startSession = async () => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    
    try {
      const response = await fetch('/api/treatment', {
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
      } else {
        throw new Error(data.error || 'Failed to start session');
      }
    } catch (error) {
      console.error('Session start error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Network error occurred';
      setErrorMessage(errorMsg);
      setHasError(true);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const userMessage: TreatmentMessage = {
      id: Date.now().toString(),
      content: userInput.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/treatment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userId,
          userInput: userMessage.content,
          action: 'continue'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
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
        setCurrentStep(data.currentStep);
        setLastResponseTime(data.responseTime);
        updateStats(data);

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

  const updateStats = (data: any) => {
    setSessionStats(prev => ({
      scriptedResponses: data.usedAI ? prev.scriptedResponses : prev.scriptedResponses + 1,
      aiResponses: data.usedAI ? prev.aiResponses + 1 : prev.aiResponses,
      avgResponseTime: data.responseTime || prev.avgResponseTime,
      aiUsagePercent: calculateAIUsagePercent(
        data.usedAI ? prev.aiResponses + 1 : prev.aiResponses,
        data.usedAI ? prev.scriptedResponses : prev.scriptedResponses + 1
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
      <div className="max-w-4xl mx-auto h-screen flex flex-col bg-white">
        <div className="flex-1 flex items-center justify-center">
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
    <div className="max-w-4xl mx-auto h-screen flex flex-col bg-white">
      {/* Header with Session Stats */}
      <div className="bg-indigo-50 border-b border-indigo-200 p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-6 w-6 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Mind Shifting Session</h2>
            <span className="text-sm text-gray-500">Step: {currentStep}</span>
          </div>
          
          <div className="flex items-center space-x-4 text-sm">
            {/* AI Usage Indicator */}
            <div className="flex items-center space-x-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-600">AI: {sessionStats.aiUsagePercent}%</span>
              <span className="text-xs text-gray-500">
                (Target: &lt;5%)
              </span>
            </div>
            
            {/* Response Time */}
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className={`font-medium ${getResponseTimeColor(lastResponseTime)}`}>
                {lastResponseTime}ms
              </span>
              <span className="text-xs text-gray-500">
                ({getResponseTimeLabel(lastResponseTime)})
              </span>
            </div>
            
            {/* Performance Badge */}
            {sessionStats.aiUsagePercent <= 5 && lastResponseTime < 200 && (
              <div className="flex items-center space-x-1 bg-green-100 px-2 py-1 rounded-full">
                <CheckCircle className="h-3 w-3 text-green-600" />
                <span className="text-xs text-green-700 font-medium">Optimal</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area - Scrollable with bottom padding for fixed input */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-32">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3xl px-4 py-3 rounded-lg ${
                message.isUser
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {/* Message metadata for bot responses */}
              {!message.isUser && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
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
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                <span className="text-gray-600">Processing...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Fixed Input Area at Bottom */}
      {isSessionActive && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
          <div className="max-w-4xl mx-auto">
            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your response..."
                  disabled={isLoading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                  maxLength={500}
                />
                <div className="absolute right-3 top-3 text-xs text-gray-400">
                  {userInput.length}/500
                </div>
              </div>
              
              <button
                onClick={sendMessage}
                disabled={!userInput.trim() || isLoading}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Send</span>
              </button>
            </div>
            
            <div className="mt-2 text-xs text-gray-500 text-center">
              Press Enter to send • This session uses 95% scripted responses for optimal performance
            </div>
          </div>
        </div>
      )}

      {/* Session Complete State - Fixed at Bottom */}
      {!isSessionActive && messages.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-green-50 border-t border-gray-200 px-4 py-3 shadow-lg">
          <div className="max-w-4xl mx-auto text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-green-900">Session Complete!</h3>
            <p className="text-green-700 mt-1">
              Your Mind Shifting session has been completed successfully.
            </p>
            <div className="mt-3 text-sm text-green-600">
              Performance: {sessionStats.scriptedResponses} scripted responses, 
              {sessionStats.aiResponses} AI-assisted ({sessionStats.aiUsagePercent}% AI usage)
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 