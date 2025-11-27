'use client';

import React from 'react';
import { Undo2, Sparkles } from 'lucide-react';
import { ModalityComponentProps } from '../../shared/types';

interface BeliefShiftingProps extends ModalityComponentProps {
  // V4 specific props for Belief Shifting
  version?: 'v3';
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
  clickedButton,
  version = 'v3'
}: BeliefShiftingProps) {

  const handleMethodSelection = async (method: string) => {
    console.log('🔍 V4 DEBUG: BeliefShifting handleMethodSelection called with:', method);
    await onSendMessage(method);
  };

  const handleYesNoResponse = async (response: 'yes' | 'no') => {
    console.log('🔍 V4 DEBUG: BeliefShifting yes/no response:', response);
    await onSendMessage(response);
  };

  const handleYesNoMaybeResponse = async (response: 'yes' | 'no' | 'maybe') => {
    console.log('🔍 V4 DEBUG: BeliefShifting yes/no/maybe response:', response);
    await onSendMessage(response);
  };

  // V4 Enhanced: Belief Shifting specific step checks with improved logic
  const isBeliefShiftingYesNoStep = () => {
    const beliefShiftingYesNoSteps = [
      'belief_step_f',                  // Belief step F
      'belief_check_1',                 // Belief check 1
      'belief_check_2',                 // Belief check 2
      'belief_check_3',                 // Belief check 3
      'belief_check_4',                 // Belief check 4
      'belief_problem_check',           // Belief problem check
    ];
    return beliefShiftingYesNoSteps.includes(currentStep);
  };

  const isBeliefShiftingYesNoMaybeStep = () => {
    const beliefShiftingYesNoMaybeSteps: string[] = [
      // Add any steps that need yes/no/maybe responses
    ];
    return beliefShiftingYesNoMaybeSteps.includes(currentStep);
  };

  const isBeliefShiftingMethodSelectionStep = () => {
    return currentStep === 'choose_method';
  };

  const isBeliefShiftingTextInputStep = () => {
    const beliefShiftingTextSteps = [
      'belief_shifting_intro_dynamic',  // Belief shifting intro
      'belief_step_a',                  // Belief step A
      'belief_step_b',                  // Belief step B
      'belief_step_c',                  // Belief step C
      'belief_step_d',                  // Belief step D
      'belief_step_e',                  // Belief step E
    ];
    return beliefShiftingTextSteps.includes(currentStep);
  };

  // V4 Enhanced: Get last bot message with better error handling
  const getLastBotMessage = () => {
    const botMessages = messages.filter(msg => !msg.isUser);
    return botMessages.length > 0 ? botMessages[botMessages.length - 1] : null;
  };

  const lastBotMessage = getLastBotMessage();

  return (
    <div className="space-y-4">
      {/* V4 Enhanced Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Belief Shifting
          </h3>
          <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400 rounded-full flex items-center space-x-1">
            <Sparkles className="h-3 w-3" />
            <span>V3</span>
          </span>
        </div>

        {stepHistory.length > 0 && (
          <button
            onClick={onUndo}
            disabled={isLoading}
            className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
          >
            <Undo2 className="h-4 w-4" />
            <span>Undo</span>
          </button>
        )}
      </div>

      {/* V4 Enhanced: Method Selection UI */}
      {isBeliefShiftingMethodSelectionStep() && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { id: 'problem_shifting', name: 'Problem Shifting', description: 'Transform problems into solutions' },
            { id: 'identity_shifting', name: 'Identity Shifting', description: 'Shift limiting identity beliefs' },
            { id: 'belief_shifting', name: 'Belief Shifting', description: 'Transform limiting beliefs' },
            { id: 'blockage_shifting', name: 'Blockage Shifting', description: 'Clear emotional blockages' },
            { id: 'reality_shifting', name: 'Reality Shifting', description: 'Shift perception of reality' },
            { id: 'trauma_shifting', name: 'Trauma Shifting', description: 'Process traumatic experiences' }
          ].map((method) => (
            <button
              key={method.id}
              onClick={() => handleMethodSelection(method.id)}
              disabled={isLoading}
              className="p-4 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors disabled:opacity-50"
            >
              <div className="font-medium text-gray-900 dark:text-white">{method.name}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{method.description}</div>
            </button>
          ))}
        </div>
      )}

      {/* V4 Enhanced: Yes/No Response UI */}
      {isBeliefShiftingYesNoStep() && (
        <div className="flex space-x-3">
          <button
            onClick={() => handleYesNoResponse('yes')}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
          >
            Yes
          </button>
          <button
            onClick={() => handleYesNoResponse('no')}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
          >
            No
          </button>
        </div>
      )}

      {/* V4 Enhanced: Yes/No/Maybe Response UI */}
      {isBeliefShiftingYesNoMaybeStep() && (
        <div className="flex space-x-2">
          <button
            onClick={() => handleYesNoMaybeResponse('yes')}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
          >
            Yes
          </button>
          <button
            onClick={() => handleYesNoMaybeResponse('maybe')}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors font-medium"
          >
            Maybe
          </button>
          <button
            onClick={() => handleYesNoMaybeResponse('no')}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
          >
            No
          </button>
        </div>
      )}

      {/* V4 Enhanced: Text Input UI */}
      {isBeliefShiftingTextInputStep() && (
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your response..."
              disabled={isLoading}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && userInput.trim() && !isLoading) {
                  onSendMessage(userInput.trim());
                }
              }}
            />
            <div className="absolute right-3 top-3">
              <span className="text-xs text-gray-400">Press Enter to send</span>
            </div>
          </div>

          <button
            onClick={() => userInput.trim() && onSendMessage(userInput.trim())}
            disabled={isLoading || !userInput.trim()}
            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
          >
            {isLoading ? 'Processing...' : 'Send Response'}
          </button>
        </div>
      )}

      {/* V4 Enhanced: Debug Information (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-xs text-blue-600 dark:text-blue-400">
            <div><strong>V4 Debug:</strong></div>
            <div>Current Step: {currentStep}</div>
            <div>Session ID: {sessionId.slice(-8)}</div>
            <div>Messages: {messages.length}</div>
            <div>Selected Work Type: {selectedWorkType || 'None'}</div>
            <div>Version: {version}</div>
          </div>
        </div>
      )}
    </div>
  );
} 