'use client';

import React from 'react';
import { IntegrationProps } from '../../shared/types';

export default function ProblemShiftingIntegration({
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

  // Problem Shifting specific integration steps
  const isProblemShiftingIntegrationStep = () => {
    const integrationSteps = [
      'problem_integration_1',
      'problem_integration_2',
      'problem_integration_3',
      'problem_integration_final'
    ];
    return integrationSteps.includes(currentStep);
  };

  // For now, Problem Shifting integration will use regular text input
  // This can be customized later with specific integration UI
  if (isProblemShiftingIntegrationStep()) {
    // Return null to let the main component handle text input
    // This allows for future customization without breaking existing flow
    return null;
  }

  // Default: return null if this component shouldn't handle the current step
  return null;
} 