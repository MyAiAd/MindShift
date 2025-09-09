'use client';

import React from 'react';
import { GuardrailsProps } from '../../shared/types';

export default function BlockageShiftingGuardrails({
  currentStep,
  messages,
  lastBotMessage
}: GuardrailsProps) {

  // Blockage Shifting specific guardrails
  const validateBlockageShiftingStep = (): boolean => {
    const blockageShiftingSteps = [
      'blockage_check_if_still_problem',
      'blockage_description',
      'blockage_analysis'
    ];

    if (!blockageShiftingSteps.includes(currentStep)) {
      return true; // Not our responsibility
    }

    if (messages.length === 0) {
      console.warn('BlockageShiftingGuardrails: No messages in Blockage Shifting context');
      return false;
    }

    return true;
  };

  // Check for Blockage Shifting specific safety concerns
  const checkBlockageShiftingSafety = (): string | null => {
    if (lastBotMessage) {
      const blockageWarningIndicators = [
        'can\'t move forward',
        'completely stuck',
        'no way out',
        'trapped forever'
      ];

      const hasBlockageWarning = blockageWarningIndicators.some(indicator =>
        lastBotMessage.content.toLowerCase().includes(indicator)
      );

      if (hasBlockageWarning) {
        return 'Severe blockage patterns detected. Consider professional support.';
      }
    }

    return null;
  };

  const isValid = validateBlockageShiftingStep();
  const safetyWarning = checkBlockageShiftingSafety();

  React.useEffect(() => {
    if (!isValid) {
      console.log('BlockageShiftingGuardrails: Validation failed for step:', currentStep);
    }
    
    if (safetyWarning) {
      console.log('BlockageShiftingGuardrails: Safety warning:', safetyWarning);
    }
  }, [isValid, safetyWarning, currentStep]);

  return null;
} 