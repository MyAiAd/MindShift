'use client';

import React from 'react';
import { Undo2 } from 'lucide-react';
import { ModalityComponentProps } from '../../shared/types';

interface BeliefShiftingProps extends ModalityComponentProps {
  // Additional props specific to Belief Shifting
}

export default function BeliefShifting({
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
}: BeliefShiftingProps) {

  const handleMethodSelection = async (method: string) => {
    console.log('🔍 DEBUG: BeliefShifting handleMethodSelection called with:', method);
    await onSendMessage(method);
  };

  const handleYesNoResponse = async (response: 'yes' | 'no') => {
    await onSendMessage(response);
  };

  const handleYesNoMaybeResponse = async (response: 'yes' | 'no' | 'maybe') => {
    await onSendMessage(response);
  };

  // Belief Shifting specific step checks
  const isBeliefShiftingYesNoStep = () => {
    const beliefShiftingYesNoSteps = [
      'belief_step_f',                  // Belief step F
      'belief_check_1',                 // Belief check 1
      'belief_check_2',                 // Belief check 2
      'belief_check_3',                 // Belief check 3
      'belief_check_4',                 // Belief check 4
      'belief_problem_check',           // Belief problem check
      'confirm_belief_problem',         // Confirm belief problem
    ];
    return beliefShiftingYesNoSteps.includes(currentStep);
  };

  // Helper function to determine if we should show the choose_method buttons for Belief Shifting
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

  // Render Belief Shifting specific Yes/No UI
  if (isBeliefShiftingYesNoStep()) {
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

  // Method selection for Belief Shifting (when part of problem-clearing methods)
  if (shouldShowChooseMethodButtons()) {
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
              Choose your Belief Shifting method:
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