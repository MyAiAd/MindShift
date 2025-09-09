'use client';

import React from 'react';
import { IntegrationProps } from '../../shared/types';

export default function RealityShiftingIntegration({
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

  // Reality Shifting specific integration steps
  const isRealityShiftingIntegrationStep = () => {
    const integrationSteps = [
      'reality_integration_1',
      'reality_integration_2',
      'reality_integration_final'
    ];
    return integrationSteps.includes(currentStep);
  };

  // For now, Reality Shifting integration will use regular text input
  if (isRealityShiftingIntegrationStep()) {
    return null; // Let main component handle text input
  }

  return null;
} 