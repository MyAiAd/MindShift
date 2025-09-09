'use client';

import React from 'react';
import { Undo2 } from 'lucide-react';
import { ModalityComponentProps } from '../../shared/types';

interface ProblemShiftingProps extends ModalityComponentProps {
  // Additional props specific to Problem Shifting
}

export default function ProblemShifting({
  sessionId,
  userId,
  messages,
  currentStep,
  isLoading,
  sessionStats,
  performanceMetrics,
  stepHistory,
  voice,
  onSendMessage,
  onUndo,
  userInput,
  setUserInput,
  selectedWorkType,
  clickedButton
}: ProblemShiftingProps) {

  const handleMethodSelection = async (method: string) => {
    console.log('🔍 DEBUG: ProblemShifting handleMethodSelection called with:', method);
    await onSendMessage(method);
  };

  const handleYesNoResponse = async (response: 'yes' | 'no') => {
    await onSendMessage(response);
  };

  const handleYesNoMaybeResponse = async (response: 'yes' | 'no' | 'maybe') => {
    await onSendMessage(response);
  };

  // Helper function to determine if we should show method selection UI for Problem Shifting
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

  // Helper function to determine if we should show the choose_method buttons
  const shouldShowChooseMethodButtons = () => {
    // Only show for choose_method step
    if (currentStep !== 'choose_method') return false;
    
    // CRITICAL: Only show if PROBLEM work type was selected
    if (selectedWorkType !== 'PROBLEM') return false;
    
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

  // Problem Shifting specific step checks
  const isProblemShiftingYesNoStep = () => {
    const problemShiftingYesNoSteps = [
      'check_if_still_problem', // Main problem check
      'future_problem_check',   // Future problem check
    ];
    return problemShiftingYesNoSteps.includes(currentStep);
  };

  // Render Problem Shifting specific UI
  if (isProblemShiftingYesNoStep()) {
    return (
      <div className="flex space-x-3 max-w-4xl w-full">
        {/* Undo Button */}
        <div className="flex items-center">
          <button
            onClick={onUndo}
            disabled={isLoading || stepHistory.length === 0}
            className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed border border-gray-300 rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-gray-600"
            title={stepHistory.length === 0 ? "No previous steps to undo" : "Undo last step"}
          >
            <Undo2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Voice Indicator */}
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
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
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
        </div>
      </div>
    );
  }

  // Method selection for Problem Shifting
  if (shouldShowChooseMethodButtons() && selectedWorkType === 'PROBLEM') {
    return (
      <div className="flex space-x-3 max-w-4xl w-full">
        {/* Undo Button */}
        <div className="flex items-center">
          <button
            onClick={onUndo}
            disabled={isLoading || stepHistory.length === 0}
            className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed border border-gray-300 rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-gray-600"
            title={stepHistory.length === 0 ? "No previous steps to undo" : "Undo last step"}
          >
            <Undo2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Voice Indicator */}
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
              Choose your Problem Shifting method:
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
    );
  }

  // Default: return null if this modality shouldn't handle the current step
  return null;
} 