'use client';

import React from 'react';
import { GuardrailsProps } from '../../shared/types';

export default function BeliefShiftingGuardrails({
  currentStep,
  messages,
  lastBotMessage
}: GuardrailsProps) {

  // Belief Shifting specific guardrails
  const validateBeliefShiftingStep = (): boolean => {
    // Check if we're in a Belief Shifting context
    const beliefShiftingSteps = [
      'belief_step_f',
      'belief_check_1',
      'belief_check_2',
      'belief_check_3',
      'belief_check_4',
      'belief_future_step_f',
      'belief_problem_check',
      'confirm_belief_problem',
      'belief_description',
      'belief_analysis'
    ];

    if (!beliefShiftingSteps.includes(currentStep)) {
      return true; // Not our responsibility
    }

    // Validate that we have appropriate context for Belief Shifting
    if (messages.length === 0) {
      console.warn('BeliefShiftingGuardrails: No messages in Belief Shifting context');
      return false;
    }

    // Check for inappropriate content in belief descriptions
    if (lastBotMessage) {
      const inappropriateIndicators = [
        'self-harm',
        'suicide',
        'violence',
        'illegal activity',
        'harmful belief',
        'dangerous ideology'
      ];

      const hasInappropriateContent = inappropriateIndicators.some(indicator =>
        lastBotMessage.content.toLowerCase().includes(indicator)
      );

      if (hasInappropriateContent) {
        console.warn('BeliefShiftingGuardrails: Inappropriate content detected');
        return false;
      }
    }

    return true;
  };

  // Check for Belief Shifting specific safety concerns
  const checkBeliefShiftingSafety = (): string | null => {
    if (lastBotMessage) {
      // Check for extreme belief indicators
      const extremeBeliefIndicators = [
        'everyone is against me',
        'world is ending',
        'conspiracy',
        'they\'re all out to get',
        'nothing matters anymore'
      ];

      const hasExtremeBeliefContent = extremeBeliefIndicators.some(indicator =>
        lastBotMessage.content.toLowerCase().includes(indicator)
      );

      if (hasExtremeBeliefContent) {
        return 'Extreme belief patterns detected. Consider professional guidance.';
      }

      // Check for religious or cultural sensitivity
      const sensitiveBeliefIndicators = [
        'my religion says',
        'my culture believes',
        'god told me',
        'sacred belief'
      ];

      const hasSensitiveContent = sensitiveBeliefIndicators.some(indicator =>
        lastBotMessage.content.toLowerCase().includes(indicator)
      );

      if (hasSensitiveContent) {
        return 'Religious/cultural beliefs detected. Approach with sensitivity.';
      }
    }

    return null;
  };

  // Belief Shifting specific validation logic
  const isValid = validateBeliefShiftingStep();
  const safetyWarning = checkBeliefShiftingSafety();

  // This component doesn't render UI, it provides validation
  React.useEffect(() => {
    if (!isValid) {
      console.log('BeliefShiftingGuardrails: Validation failed for step:', currentStep);
    }
    
    if (safetyWarning) {
      console.log('BeliefShiftingGuardrails: Safety warning:', safetyWarning);
    }
  }, [isValid, safetyWarning, currentStep]);

  // This is a validation component, it doesn't render anything
  return null;
} 