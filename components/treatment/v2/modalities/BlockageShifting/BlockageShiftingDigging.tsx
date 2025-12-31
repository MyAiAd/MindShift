'use client';

import React from 'react';
import { Undo2 } from 'lucide-react';
import { DiggingDeeperProps } from '../../shared/types';

export default function BlockageShiftingDigging({
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

  const handleYesNoResponse = async (response: 'yes' | 'no') => {
    await onSendMessage(response);
  };

  const handleYesNoMaybeResponse = async (response: 'yes' | 'no' | 'maybe') => {
    await onSendMessage(response);
  };

  const handleMethodSelection = async (method: string) => {
    console.log('🔍 DEBUG: BlockageShiftingDigging handleMethodSelection called with:', method);
    await onSendMessage(method);
  };

  // Blockage Shifting specific digging deeper steps
  const shouldShowBlockageDiggingButtons = () => {
    const blockageDiggingSteps = [
      'blockage_digging_deeper_start',
      'blockage_scenario_check_1',
      'blockage_scenario_check_2', 
      'blockage_scenario_check_3',
      'blockage_anything_else_check_1',
      'blockage_anything_else_check_2',
      'blockage_anything_else_check_3'
    ];
    
    if (!blockageDiggingSteps.includes(currentStep)) return false;
    
    // Don't show if AI is asking clarifying questions
    const lastBotMessage = messages.filter(m => !m.isUser).pop();
    if (lastBotMessage?.usedAI) return false;
    
    return true;
  };

  // Helper function for Blockage Shifting method selection during digging
  const shouldShowBlockageDiggingMethodButtons = () => {
    const lastBotMessage = messages.filter(m => !m.isUser).pop();
    
    // DIAGNOSTIC: Log entry to this function
    console.log('🔍 BLOCKAGE_DIGGING: Checking method buttons', {
      currentStep,
      sessionMethod,
      lastMessage: lastBotMessage?.content?.substring(0, 60),
      stepCheck: currentStep === 'clear_scenario_problem_1',
      sessionMethodCheck: sessionMethod === 'blockage_shifting'
    });
    
    // Show for method selection steps or when on clear step (which shows method selection message)
    if (currentStep !== 'blockage_digging_method_selection' && 
        currentStep !== 'digging_method_selection' &&
        currentStep !== 'clear_anything_else_problem_1' &&
        currentStep !== 'clear_anything_else_problem_2' &&
        currentStep !== 'clear_scenario_problem_1' &&
        currentStep !== 'clear_scenario_problem_2' &&
        currentStep !== 'clear_scenario_problem_3') {
      console.log('🔍 BLOCKAGE_DIGGING: Step check failed, returning false');
      return false;
    }
    
    // CRITICAL FIX: Only show if this is the active modality (prevents multiple button sets)
    if (sessionMethod !== 'blockage_shifting') {
      console.log('🔍 BLOCKAGE_DIGGING: sessionMethod check failed, returning false');
      return false;
    }
    
    if (lastBotMessage?.usedAI) return false;
    
    // PRODUCTION FIX: If we passed all checks above (step in allowed list, correct sessionMethod, not AI),
    // then show the buttons. Don't do redundant step checks that create timing issues with React state.
    console.log('🔍 BLOCKAGE_DIGGING: All checks passed, returning true');
    return true;
  };

  // Render Blockage Shifting digging deeper buttons
  if (shouldShowBlockageDiggingButtons()) {
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
              placeholder="Please select Yes, No, or Maybe below..."
              disabled={true}
              className="w-full px-4 py-3 border border-border rounded-lg bg-secondary text-muted-foreground cursor-not-allowed"
              maxLength={500}
            />
            <div className="absolute right-3 top-3 text-xs text-muted-foreground">
              Disabled
            </div>
          </div>
          
          <div className="flex space-x-3 justify-center">
            <button
              onClick={() => handleYesNoMaybeResponse('yes')}
              disabled={isLoading}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-secondary disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold"
            >
              <span className="bg-red-700 px-2 py-1 rounded text-sm font-bold">1</span>
              <span>Yes</span>
            </button>
            
            <button
              onClick={() => handleYesNoMaybeResponse('maybe')}
              disabled={isLoading}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-secondary disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold"
            >
              <span className="bg-orange-700 px-2 py-1 rounded text-sm font-bold">2</span>
              <span>Maybe</span>
            </button>
            
            <button
              onClick={() => handleYesNoMaybeResponse('no')}
              disabled={isLoading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-secondary disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold"
            >
              <span className="bg-green-700 px-2 py-1 rounded text-sm font-bold">3</span>
              <span>No</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Blockage Shifting digging method selection
  if (shouldShowBlockageDiggingMethodButtons()) {
    console.log('🔍 BLOCKAGE_DIGGING: Rendering method selection buttons');
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

  // Default: return null if this component shouldn't handle the current step
  console.log('🔍 BLOCKAGE_DIGGING: Returning null (not handling this step)', {
    currentStep,
    sessionMethod,
    showBlockageButtons: shouldShowBlockageDiggingButtons(),
    showMethodButtons: shouldShowBlockageDiggingMethodButtons()
  });
  return null;
} 