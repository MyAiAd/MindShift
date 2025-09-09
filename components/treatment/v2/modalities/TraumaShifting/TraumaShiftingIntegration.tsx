'use client';

import React from 'react';
import { IntegrationProps } from '../../shared/types';

export default function TraumaShiftingIntegration({
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

  // Trauma Shifting specific integration steps
  const isTraumaShiftingIntegrationStep = () => {
    const integrationSteps = [
      'trauma_integration_1',
      'trauma_integration_2',
      'trauma_integration_final'
    ];
    return integrationSteps.includes(currentStep);
  };

  // For now, Trauma Shifting integration will use regular text input
  if (isTraumaShiftingIntegrationStep()) {
    return null; // Let main component handle text input
  }

  return null;
} 