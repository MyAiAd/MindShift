'use client';

import React from 'react';
import { IntegrationProps } from '../../shared/types';

export default function BeliefShiftingIntegration({
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
  modalityType
}: IntegrationProps) {

  // Belief Shifting specific integration steps
  const isBeliefShiftingIntegrationStep = () => {
    const integrationSteps = [
      'belief_integration_1',
      'belief_integration_2',
      'belief_integration_3',
      'belief_integration_final'
    ];
    return integrationSteps.includes(currentStep);
  };

  // For now, Belief Shifting integration will use regular text input
  // This can be customized later with specific integration UI
  if (isBeliefShiftingIntegrationStep()) {
    // Return null to let the main component handle text input
    // This allows for future customization without breaking existing flow
    return null;
  }

  // Default: return null if this component shouldn't handle the current step
  return null;
} 