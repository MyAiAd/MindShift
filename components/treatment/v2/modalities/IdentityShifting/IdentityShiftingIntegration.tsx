'use client';

import React from 'react';
import { IntegrationProps } from '../../shared/types';

export default function IdentityShiftingIntegration({
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

  // Identity Shifting specific integration steps
  const isIdentityShiftingIntegrationStep = () => {
    const integrationSteps = [
      'identity_integration_1',
      'identity_integration_2',
      'identity_integration_3',
      'identity_integration_final'
    ];
    return integrationSteps.includes(currentStep);
  };

  // For now, Identity Shifting integration will use regular text input
  // This can be customized later with specific integration UI
  if (isIdentityShiftingIntegrationStep()) {
    // Return null to let the main component handle text input
    // This allows for future customization without breaking existing flow
    return null;
  }

  // Default: return null if this component shouldn't handle the current step
  return null;
} 