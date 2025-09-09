'use client';

import React from 'react';
import { IntegrationProps } from '../../shared/types';

export default function BlockageShiftingIntegration({
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

  // Blockage Shifting specific integration steps
  const isBlockageShiftingIntegrationStep = () => {
    const integrationSteps = [
      'blockage_integration_1',
      'blockage_integration_2',
      'blockage_integration_3',
      'blockage_integration_final'
    ];
    return integrationSteps.includes(currentStep);
  };

  // For now, Blockage Shifting integration will use regular text input
  if (isBlockageShiftingIntegrationStep()) {
    return null;
  }

  return null;
} 