'use client';

import React from 'react';
import { Undo2, Sparkles } from 'lucide-react';
import { ModalityComponentProps } from '../../shared/types';

interface RealityShiftingProps extends ModalityComponentProps {
  version?: 'v3';
}

export default function RealityShifting({
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
}: RealityShiftingProps) {

  const handleYesNoResponse = async (response: 'yes' | 'no') => {
    console.log('🔍 V3 DEBUG: RealityShifting yes/no response:', response);
    await onSendMessage(response);
  };

  // V3 Enhanced: Reality Shifting specific step checks
  const isRealityShiftingYesNoStep = () => {
    const realityShiftingYesNoSteps = [
      'goal_deadline_check',            // Goal deadline check
      'goal_confirmation',              // Goal confirmation
      'reality_certainty_check',        // Reality certainty check
      'reality_integration_helped',     // Reality integration helped
    ];
    return realityShiftingYesNoSteps.includes(currentStep);
  };

  const isRealityShiftingTextInputStep = () => {
    const realityShiftingTextSteps = [
      'reality_shifting_intro',         // Reality shifting intro
      'reality_goal_capture',           // Reality goal capture
      'goal_deadline_date',             // Goal deadline date input
      'goal_certainty',                 // Goal certainty percentage
      'reality_step_a2',                // Reality step A2
      'reality_step_a3',                // Reality step A3
      'reality_step_b',                 // Reality step B
      'reality_why_not_possible',       // Reality why not possible
      'reality_feel_reason',            // Reality feel reason
      'reality_feel_reason_2',          // Reality feel reason 2
      'reality_feel_reason_3',          // Reality feel reason 3
      'reality_column_a_restart',       // Reality column A restart
      'reality_checking_questions',     // Reality checking questions
      'reality_doubt_reason',           // Reality doubt reason
      'reality_cycle_b2',               // Reality cycle B2
      'reality_cycle_b3',               // Reality cycle B3
      'reality_cycle_b4',               // Reality cycle B4
      'reality_integration_intro',      // Reality integration intro
      'reality_integration_start',      // Reality integration start
      'reality_integration_awareness',  // Reality integration awareness
      'reality_integration_action',     // Reality integration action
      'reality_integration_action_more', // Reality integration action more
      'reality_integration_awareness_1', // Reality integration awareness 1
      'reality_integration_awareness_2', // Reality integration awareness 2
      'reality_integration_awareness_3', // Reality integration awareness 3
      'reality_integration_awareness_4', // Reality integration awareness 4
      'reality_integration_action_1',   // Reality integration action 1
      'reality_integration_action_2',   // Reality integration action 2
      'reality_integration_action_3',   // Reality integration action 3
    ];
    return realityShiftingTextSteps.includes(currentStep);
  };

  return (
    <div className="space-y-4">
      {/* V3 Enhanced Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Reality Shifting
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

      {/* V3 Enhanced: Yes/No Response UI */}
      {isRealityShiftingYesNoStep() && (
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

      {/* V3 Enhanced: Text Input UI */}
      {isRealityShiftingTextInputStep() && (
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