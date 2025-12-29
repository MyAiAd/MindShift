'use client';

import React from 'react';
import { Undo2 } from 'lucide-react';
import { DiggingDeeperProps } from '../../shared/types';

export default function TraumaShiftingDigging({
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
  modalityType,
  sessionMethod
}: DiggingDeeperProps) {

  const handleMethodSelection = async (method: string) => {
    console.log('🔍 DEBUG: TraumaShiftingDigging handleMethodSelection called with:', method);
    await onSendMessage(method);
  };

  // Helper function to determine if we should show the digging method selection buttons
  const shouldShowDiggingMethodButtons = () => {
    // Show for method selection steps during digging deeper
    if (currentStep !== 'digging_method_selection' &&
        currentStep !== 'clear_anything_else_problem_1' &&
        currentStep !== 'clear_anything_else_problem_2' &&
        currentStep !== 'clear_scenario_problem_1' &&
        currentStep !== 'clear_scenario_problem_2' &&
        currentStep !== 'clear_scenario_problem_3') return false;
    
    // CRITICAL: Only show if this is the active modality (prevents multiple button sets)
    if (sessionMethod !== 'trauma_shifting') return false;
    
    // Don't show if AI is asking clarifying questions
    const lastBotMessage = messages.filter(m => !m.isUser).pop();
    if (lastBotMessage?.usedAI) return false;
    
    return true;
  };

  // Render digging method selection UI
  if (shouldShowDiggingMethodButtons()) {
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

        <div className="flex flex-col space-y-4 flex-1">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground mb-3">
              Choose your method to clear this problem:
            </h3>
            <div className="flex justify-center">
              <div className="grid grid-cols-2 gap-3 max-w-lg">
                <button
                  onClick={() => handleMethodSelection('Problem Shifting')}
                  disabled={isLoading}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-secondary disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                >
                  <span className="bg-blue-700 px-2 py-1 rounded text-xs font-bold">1</span>
                  <span>Problem Shifting</span>
                </button>
                
                <button
                  onClick={() => handleMethodSelection('Identity Shifting')}
                  disabled={isLoading}
                  className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-secondary disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                >
                  <span className="bg-purple-700 px-2 py-1 rounded text-xs font-bold">2</span>
                  <span>Identity Shifting</span>
                </button>
                
                <button
                  onClick={() => handleMethodSelection('Belief Shifting')}
                  disabled={isLoading}
                  className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-secondary disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
                >
                  <span className="bg-green-700 px-2 py-1 rounded text-xs font-bold">3</span>
                  <span>Belief Shifting</span>
                </button>
                
                <button
                  onClick={() => handleMethodSelection('Blockage Shifting')}
                  disabled={isLoading}
                  className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-secondary disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold text-sm"
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

  // Trauma Shifting specific digging deeper steps (for future expansion)
  const traumaDiggingSteps = [
    'trauma_digging_deeper_start',
    'trauma_scenario_check_1',
    'trauma_scenario_check_2',
    'trauma_scenario_check_3'
  ];
  
  if (traumaDiggingSteps.includes(currentStep)) {
    // For now, return null - Trauma Shifting uses specialized flow handled by main component
    // This can be expanded later with trauma-specific digging UI
    return null;
  }
  
  // Return null for steps not handled by this component
  return null;
} 