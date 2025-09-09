'use client';

import React from 'react';
import { IntegrationProps } from '../../shared/types';

export default function TraumaShiftingIntegration({ modalityType, currentStep }: IntegrationProps) {
  const traumaIntegrationSteps = [
    'trauma_integration_1',
    'trauma_integration_2',
    'trauma_integration_final'
  ];
  
  if (!traumaIntegrationSteps.includes(currentStep)) return null;
  
  // For now, return null to let main component handle text input
  return null;
} 