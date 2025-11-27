'use client';

import React from 'react';
import { Undo2, Sparkles } from 'lucide-react';
import { ModalityComponentProps } from '../../shared/types';

interface IdentityShiftingProps extends ModalityComponentProps {
  version?: 'v3';
}

export default function IdentityShifting({
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
}: IdentityShiftingProps) {

  const handleYesNoResponse = async (response: 'yes' | 'no') => {
    console.log('🔍 V4 DEBUG: IdentityShifting yes/no response:', response);
    await onSendMessage(response);
  };

  // V4 Enhanced: Identity Shifting specific step checks
  const isIdentityShiftingYesNoStep = () => {
    const identityShiftingYesNoSteps = [
      'identity_check',                 // Identity check
      'identity_problem_check',         // Identity problem check
    ];
    return identityShiftingYesNoSteps.includes(currentStep);
  };

  const isIdentityShiftingTextInputStep = () => {
    const identityShiftingTextSteps = [
      'identity_shifting_intro_dynamic', // Identity shifting intro
      'identity_dissolve_step_a',       // Identity dissolve step A
      'identity_dissolve_step_b',       // Identity dissolve step B
      'identity_dissolve_step_c',       // Identity dissolve step C
      'identity_dissolve_step_d',       // Identity dissolve step D
      'identity_dissolve_step_e',       // Identity dissolve step E
    ];
    return identityShiftingTextSteps.includes(currentStep);
  };

  return (
    <div className="space-y-4">
      {/* V4 Enhanced Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Identity Shifting
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

      {/* V4 Enhanced: Yes/No Response UI */}
      {isIdentityShiftingYesNoStep() && (
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

      {/* V4 Enhanced: Text Input UI */}
      {isIdentityShiftingTextInputStep() && (
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
    </div>
  );
} 