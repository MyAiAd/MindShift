'use client';

import React from 'react';
import { GuardrailsProps } from '../../shared/types';

export default function RealityShiftingGuardrails({ currentStep, messages, lastBotMessage }: GuardrailsProps) {
  const validateRealityShiftingStep = (): boolean => {
    const realityShiftingSteps = [
      'reality_step_b',
      'reality_doubts_check',
      'reality_certainty_check',
      'goal_deadline_check',
      'goal_confirmation'
    ];

    if (!realityShiftingSteps.includes(currentStep)) return true;
    
    if (messages.length === 0) {
      console.warn('RealityShiftingGuardrails: No messages in Reality Shifting context');
      return false;
    }

    return true;
  };

  const checkRealityShiftingSafety = (): string | null => {
    if (lastBotMessage) {
      const unrealisticGoalIndicators = [
        'impossible goal',
        'unrealistic timeline',
        'harmful to others',
        'illegal activity'
      ];

      const hasUnrealisticContent = unrealisticGoalIndicators.some(indicator =>
        lastBotMessage.content.toLowerCase().includes(indicator)
      );

      if (hasUnrealisticContent) {
        return 'Unrealistic or harmful goal detected. Consider professional guidance.';
      }
    }

    return null;
  };

  const isValid = validateRealityShiftingStep();
  const safetyWarning = checkRealityShiftingSafety();

  React.useEffect(() => {
    if (!isValid) {
      console.log('RealityShiftingGuardrails: Validation failed for step:', currentStep);
    }
    
    if (safetyWarning) {
      console.log('RealityShiftingGuardrails: Safety warning:', safetyWarning);
    }
  }, [isValid, safetyWarning, currentStep]);

  return null;
} 