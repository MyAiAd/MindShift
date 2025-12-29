'use client';

import React from 'react';
import { Undo2 } from 'lucide-react';
import { ModalityComponentProps } from '../../shared/types';

interface IdentityShiftingProps extends ModalityComponentProps {
  // Additional props specific to Identity Shifting
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
  setSessionMethod
}: IdentityShiftingProps) {

  const handleMethodSelection = async (method: string) => {
    console.log('🔍 DEBUG: IdentityShifting handleMethodSelection called with:', method);
    
    // Set sessionMethod when user selects a method
    if (setSessionMethod) {
      const methodLower = method.toLowerCase();
      if (methodLower.includes('identity')) {
        setSessionMethod('identity_shifting');
      }
    }
    
    await onSendMessage(method);
  };

  const handleYesNoResponse = async (response: 'yes' | 'no') => {
    await onSendMessage(response);
  };

  const handleYesNoMaybeResponse = async (response: 'yes' | 'no' | 'maybe') => {
    await onSendMessage(response);
  };

  // Identity Shifting specific step checks
  const isIdentityShiftingYesNoStep = () => {
    const identityShiftingYesNoSteps = [
      'identity_check',                 // Identity check
      'identity_problem_check',         // Identity problem check
      'confirm_identity_problem',       // Confirm identity problem
      'identity_dissolve_step_f',       // Identity dissolve step F
      'identity_future_check',          // Identity future check
      'identity_future_step_f',         // Identity future step F (can still feel identity in future?)
      'identity_scenario_check',        // Identity scenario check
    ];
    return identityShiftingYesNoSteps.includes(currentStep);
  };

  // Helper function to determine if we should show the choose_method buttons for Identity Shifting
  const shouldShowChooseMethodButtons = () => {
    // Identity Shifting should NOT show method selection buttons on choose_method step
    // That step is only for problem-clearing methods when PROBLEM work type is selected
    return false;
  };

  // Render Identity Shifting specific Yes/No UI
  if (isIdentityShiftingYesNoStep()) {
    return (
      <div className="flex space-x-3 max-w-4xl w-full">
        {/* Undo Button */}
        <div className="flex items-center">
          <button
            onClick={onUndo}
            disabled={isLoading || stepHistory.length === 0}
            className="flex items-center justify-center w-10 h-10 bg-secondary hover:bg-secondary disabled:bg-secondary/20 disabled:cursor-not-allowed border border-border rounded-lg transition-colors"
            title={stepHistory.length === 0 ? "No previous steps to undo" : "Undo last step"}
          >
            <Undo2 className="h-4 w-4 text-muted-foreground" />
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
              className="w-full px-4 py-3 border border-border rounded-lg bg-secondary text-muted-foreground cursor-not-allowed"
              maxLength={500}
            />
            <div className="absolute right-3 top-3 text-xs text-muted-foreground">
              Disabled
            </div>
          </div>
          
          <div className="flex space-x-4 justify-center">
            <button
              onClick={() => handleYesNoResponse('yes')}
              disabled={isLoading}
              className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-secondary disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold"
            >
              <span className="bg-red-700 px-2 py-1 rounded text-sm font-bold">1</span>
              <span>Yes</span>
            </button>
            
            <button
              onClick={() => handleYesNoResponse('no')}
              disabled={isLoading}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-secondary disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold"
            >
              <span className="bg-green-700 px-2 py-1 rounded text-sm font-bold">2</span>
              <span>No</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // REMOVED: Method selection logic - Identity Shifting doesn't handle choose_method step
  // Only Problem Shifting handles method selection when PROBLEM work type is selected

  // Default: return null if this modality shouldn't handle the current step
  return null;
} 