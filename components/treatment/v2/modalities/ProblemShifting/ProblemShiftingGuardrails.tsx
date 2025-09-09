'use client';

import React from 'react';
import { GuardrailsProps } from '../../shared/types';

export default function ProblemShiftingGuardrails({
  currentStep,
  messages,
  lastBotMessage
}: GuardrailsProps) {

  // Problem Shifting specific guardrails
  const validateProblemShiftingStep = (): boolean => {
    // Check if we're in a Problem Shifting context
    const problemShiftingSteps = [
      'check_if_still_problem',
      'future_problem_check',
      'problem_description',
      'problem_analysis',
      'problem_resolution'
    ];

    if (!problemShiftingSteps.includes(currentStep)) {
      return true; // Not our responsibility
    }

    // Validate that we have appropriate context for Problem Shifting
    if (messages.length === 0) {
      console.warn('ProblemShiftingGuardrails: No messages in Problem Shifting context');
      return false;
    }

    // Check for inappropriate content in problem descriptions
    if (lastBotMessage) {
      const inappropriateIndicators = [
        'self-harm',
        'suicide',
        'violence',
        'illegal activity'
      ];

      const hasInappropriateContent = inappropriateIndicators.some(indicator =>
        lastBotMessage.content.toLowerCase().includes(indicator)
      );

      if (hasInappropriateContent) {
        console.warn('ProblemShiftingGuardrails: Inappropriate content detected');
        return false;
      }
    }

    // Validate problem clarity for Problem Shifting
    if (currentStep === 'problem_description') {
      const userMessages = messages.filter(m => m.isUser);
      const lastUserMessage = userMessages[userMessages.length - 1];
      
      if (lastUserMessage && lastUserMessage.content.length < 5) {
        console.warn('ProblemShiftingGuardrails: Problem description too short');
        return false;
      }
    }

    return true;
  };

  // Check for Problem Shifting specific safety concerns
  const checkProblemShiftingSafety = (): string | null => {
    if (lastBotMessage) {
      // Check for crisis indicators that should redirect to professional help
      const crisisIndicators = [
        'thoughts of hurting',
        'feeling hopeless',
        'can\'t go on',
        'end it all'
      ];

      const hasCrisisContent = crisisIndicators.some(indicator =>
        lastBotMessage.content.toLowerCase().includes(indicator)
      );

      if (hasCrisisContent) {
        return 'Crisis indicators detected. Please consider professional support.';
      }
    }

    return null;
  };

  // Problem Shifting specific validation logic
  const isValid = validateProblemShiftingStep();
  const safetyWarning = checkProblemShiftingSafety();

  // This component doesn't render UI, it provides validation
  // The main component can use these validations as needed
  React.useEffect(() => {
    if (!isValid) {
      console.log('ProblemShiftingGuardrails: Validation failed for step:', currentStep);
    }
    
    if (safetyWarning) {
      console.log('ProblemShiftingGuardrails: Safety warning:', safetyWarning);
    }
  }, [isValid, safetyWarning, currentStep]);

  // This is a validation component, it doesn't render anything
  return null;
} 