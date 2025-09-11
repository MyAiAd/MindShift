'use client';

import React from 'react';
import { GuardrailsProps } from '../../shared/types';

export default function IdentityShiftingGuardrails({
  currentStep,
  messages,
  lastBotMessage
}: GuardrailsProps) {

  // Identity Shifting specific guardrails
  const validateIdentityShiftingStep = (): boolean => {
    // Check if we're in an Identity Shifting context
    const identityShiftingSteps = [
      'identity_check',
      'identity_problem_check',
      'confirm_identity_problem',
      'identity_dissolve_step_f',
              'identity_future_check',
        'identity_scenario_check',
      'identity_description',
      'identity_analysis'
    ];

    if (!identityShiftingSteps.includes(currentStep)) {
      return true; // Not our responsibility
    }

    // Validate that we have appropriate context for Identity Shifting
    if (messages.length === 0) {
      console.warn('IdentityShiftingGuardrails: No messages in Identity Shifting context');
      return false;
    }

    // Check for inappropriate content in identity descriptions
    if (lastBotMessage) {
      const inappropriateIndicators = [
        'self-harm',
        'suicide',
        'violence',
        'illegal activity',
        'harmful identity'
      ];

      const hasInappropriateContent = inappropriateIndicators.some(indicator =>
        lastBotMessage.content.toLowerCase().includes(indicator)
      );

      if (hasInappropriateContent) {
        console.warn('IdentityShiftingGuardrails: Inappropriate content detected');
        return false;
      }
    }

    return true;
  };

  // Check for Identity Shifting specific safety concerns
  const checkIdentityShiftingSafety = (): string | null => {
    if (lastBotMessage) {
      // Check for identity crisis indicators
      const identityCrisisIndicators = [
        'don\'t know who i am',
        'lost my identity',
        'identity crisis',
        'no sense of self'
      ];

      const hasIdentityCrisisContent = identityCrisisIndicators.some(indicator =>
        lastBotMessage.content.toLowerCase().includes(indicator)
      );

      if (hasIdentityCrisisContent) {
        return 'Identity crisis indicators detected. Consider professional guidance.';
      }
    }

    return null;
  };

  // Identity Shifting specific validation logic
  const isValid = validateIdentityShiftingStep();
  const safetyWarning = checkIdentityShiftingSafety();

  // This component doesn't render UI, it provides validation
  React.useEffect(() => {
    if (!isValid) {
      console.log('IdentityShiftingGuardrails: Validation failed for step:', currentStep);
    }
    
    if (safetyWarning) {
      console.log('IdentityShiftingGuardrails: Safety warning:', safetyWarning);
    }
  }, [isValid, safetyWarning, currentStep]);

  // This is a validation component, it doesn't render anything
  return null;
} 