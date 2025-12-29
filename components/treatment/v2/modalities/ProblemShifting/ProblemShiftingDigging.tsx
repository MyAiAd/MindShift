'use client';

import React from 'react';
import { Undo2 } from 'lucide-react';
import { DiggingDeeperProps } from '../../shared/types';

export default function ProblemShiftingDigging({
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
    console.log('🔍 DEBUG: ProblemShiftingDigging handleMethodSelection called with:', method);
    await onSendMessage(method);
  };

  // Helper function to determine if we should show the digging deeper start buttons
  const shouldShowDiggingDeeperButtons = () => {
    // Only show for digging_deeper_start step
    if (currentStep !== 'digging_deeper_start') return false;
    
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
        "How would you", // AI asking for user perspective
        "What do you think", // AI asking for opinion
      ];
      
      if (clarifyingIndicators.some(indicator => lastBotMessage.content.includes(indicator))) {
        return false; // Don't show buttons, show text input instead
      }
    }
    
    return true;
  };

  // Helper function to determine if we should show the digging method selection buttons
  const shouldShowDiggingMethodButtons = () => {
    const lastBotMessage = messages.filter(m => !m.isUser).pop();
    
    // DIAGNOSTIC: Log entry to this function
    console.log('🔍 PROBLEM_DIGGING: Checking method buttons', {
      currentStep,
      sessionMethod,
      lastMessage: lastBotMessage?.content?.substring(0, 60),
      stepCheck: currentStep === 'clear_scenario_problem_1',
      sessionMethodCheck: sessionMethod === 'problem_shifting'
    });
    
    // Only show for digging_method_selection step
    if (currentStep !== 'digging_method_selection' &&
        currentStep !== 'clear_anything_else_problem_1' &&
        currentStep !== 'clear_anything_else_problem_2' &&
        currentStep !== 'clear_scenario_problem_1' &&
        currentStep !== 'clear_scenario_problem_2' &&
        currentStep !== 'clear_scenario_problem_3') {
      console.log('🔍 PROBLEM_DIGGING: Step check failed, returning false');
      return false;
    }
    
    // CRITICAL FIX: Only show if this is the active modality (prevents multiple button sets)
    if (sessionMethod !== 'problem_shifting') {
      console.log('🔍 PROBLEM_DIGGING: sessionMethod check failed, returning false');
      return false;
    }
    
    // Don't show if AI is asking clarifying questions
    if (lastBotMessage?.usedAI) return false;
    
    console.log('🔍 PROBLEM_DIGGING: All checks passed, returning true');
    return true;
  };

  // Helper function to determine if we should show the scenario check buttons (Yes/No/Maybe)
  const shouldShowScenarioCheckButtons = () => {
    // Show for scenario check steps specific to Problem Shifting
    const scenarioCheckSteps = [
      'scenario_check_1',               // Scenario check 1
      'scenario_check_2',               // Scenario check 2  
      'scenario_check_3',               // Scenario check 3
      'anything_else_check_1',          // Anything else check 1
      'anything_else_check_2',          // Anything else check 2
      'anything_else_check_3'           // Anything else check 3
    ];
    
    if (!scenarioCheckSteps.includes(currentStep)) return false;
    
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
        "How would you", // AI asking for user perspective
        "What do you think", // AI asking for opinion
      ];
      
      if (clarifyingIndicators.some(indicator => lastBotMessage.content.includes(indicator))) {
        return false; // Don't show buttons, show text input instead
      }
    }
    
    return true;
  };

  // Render digging deeper start UI
  if (shouldShowDiggingDeeperButtons()) {
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

  // Render digging method selection UI
  if (shouldShowDiggingMethodButtons()) {
    console.log('🔍 PROBLEM_DIGGING: Rendering method selection buttons');
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

  // Render scenario check buttons (Yes/No/Maybe)
  if (shouldShowScenarioCheckButtons()) {
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
            
            {/* Maybe button removed from all digging deeper steps (scenario_check and anything_else_check) */}
            
            <button
              onClick={() => handleYesNoMaybeResponse('no')}
              disabled={isLoading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-secondary disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-semibold"
            >
              <span className="bg-green-700 px-2 py-1 rounded text-sm font-bold">2</span>
              <span>No</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default: return null if this component shouldn't handle the current step
  return null;
} 