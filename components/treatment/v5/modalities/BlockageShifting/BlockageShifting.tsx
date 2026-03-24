'use client';

import React from 'react';
import { Undo2, Sparkles } from 'lucide-react';
import { ModalityComponentProps } from '../../shared/types';

interface BlockageShiftingProps extends ModalityComponentProps {
  version?: 'v3';
}

export default function BlockageShifting({
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
}: BlockageShiftingProps) {

  const handleYesNoResponse = async (response: 'yes' | 'no') => {
    console.log('🔍 V4 DEBUG: BlockageShifting yes/no response:', response);
    await onSendMessage(response);
  };

  // V4 Enhanced: Blockage Shifting specific step checks
  const isBlockageShiftingYesNoStep = () => {
    const blockageShiftingYesNoSteps = [
      'blockage_check_if_still_problem', // Check if still problem
    ];
    return blockageShiftingYesNoSteps.includes(currentStep);
  };

  const isBlockageShiftingTextInputStep = () => {
    const blockageShiftingTextSteps = [
      'blockage_shifting_intro_dynamic', // Blockage shifting intro
      'blockage_step_b',                // Blockage step B
      'blockage_step_c',                // Blockage step C
      'blockage_step_d',                // Blockage step D
      'blockage_step_e',                // Blockage step E
    ];
    return blockageShiftingTextSteps.includes(currentStep);
  };

  return (
    <div className="space-y-4">
      {/* V4 Enhanced Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-foreground">
            Blockage Shifting
          </h3>
          <span className="px-2 py-1 text-xs font-medium bg-warning/20 text-warning rounded-full flex items-center space-x-1">
            <Sparkles className="h-3 w-3" />
            <span>V3</span>
          </span>
        </div>

        {stepHistory.length > 0 && (
          <button
            onClick={onUndo}
            disabled={isLoading}
            className="flex items-center space-x-1 px-3 py-1 text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          >
            <Undo2 className="h-4 w-4" />
            <span>Undo</span>
          </button>
        )}
      </div>

      {/* V4 Enhanced: Yes/No Response UI */}
      {isBlockageShiftingYesNoStep() && (
        <div className="flex space-x-3">
          <button
            onClick={() => handleYesNoResponse('yes')}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors font-medium"
          >
            Yes
          </button>
          <button
            onClick={() => handleYesNoResponse('no')}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 transition-colors font-medium"
          >
            No
          </button>
        </div>
      )}

      {/* V4 Enhanced: Text Input UI */}
      {isBlockageShiftingTextInputStep() && (
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your response..."
              disabled={isLoading}
              className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && userInput.trim() && !isLoading) {
                  onSendMessage(userInput.trim());
                }
              }}
            />
            <div className="absolute right-3 top-3">
              <span className="text-xs text-muted-foreground">Press Enter to send</span>
            </div>
          </div>

          <button
            onClick={() => userInput.trim() && onSendMessage(userInput.trim())}
            disabled={isLoading || !userInput.trim()}
            className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
          >
            {isLoading ? 'Processing...' : 'Send Response'}
          </button>
        </div>
      )}
    </div>
  );
} 