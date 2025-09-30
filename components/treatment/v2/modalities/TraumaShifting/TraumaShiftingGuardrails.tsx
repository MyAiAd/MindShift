'use client';

import React from 'react';
import { GuardrailsProps } from '../../shared/types';

export default function TraumaShiftingGuardrails({ currentStep, messages, lastBotMessage }: GuardrailsProps) {
  const validateTraumaShiftingStep = (): boolean => {
    const traumaShiftingSteps = [
      'trauma_identity_check',
      'trauma_future_step_f',
      'trauma_experience_check',
      'trauma_dig_deeper',
      'trauma_shifting_intro'
    ];

    if (!traumaShiftingSteps.includes(currentStep)) return true;
    
    if (messages.length === 0) {
      console.warn('TraumaShiftingGuardrails: No messages in Trauma Shifting context');
      return false;
    }

    return true;
  };

  const checkTraumaShiftingSafety = (): string | null => {
    if (lastBotMessage) {
      const traumaWarningIndicators = [
        'self-harm',
        'suicide',
        'severe trauma',
        'abuse',
        'violence',
        'ptsd symptoms'
      ];

      const hasTraumaWarning = traumaWarningIndicators.some(indicator =>
        lastBotMessage.content.toLowerCase().includes(indicator)
      );

      if (hasTraumaWarning) {
        return 'CRITICAL: Trauma/crisis indicators detected. Professional help strongly recommended.';
      }

      // Check for recent trauma
      const recentTraumaIndicators = [
        'just happened',
        'yesterday',
        'last week',
        'still happening'
      ];

      const hasRecentTrauma = recentTraumaIndicators.some(indicator =>
        lastBotMessage.content.toLowerCase().includes(indicator)
      );

      if (hasRecentTrauma) {
        return 'Recent trauma detected. Consider immediate professional support.';
      }
    }

    return null;
  };

  const isValid = validateTraumaShiftingStep();
  const safetyWarning = checkTraumaShiftingSafety();

  React.useEffect(() => {
    if (!isValid) {
      console.log('TraumaShiftingGuardrails: Validation failed for step:', currentStep);
    }
    
    if (safetyWarning) {
      console.log('TraumaShiftingGuardrails: Safety warning:', safetyWarning);
    }
  }, [isValid, safetyWarning, currentStep]);

  return null;
} 