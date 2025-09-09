'use client';

import React from 'react';
import { IntegrationProps } from '../../shared/types';

export default function RealityShiftingIntegration({ modalityType, currentStep }: IntegrationProps) {
  const realityIntegrationSteps = [
    'reality_integration_1',
    'reality_integration_2',
    'reality_integration_final'
  ];
  
  if (!realityIntegrationSteps.includes(currentStep)) return null;
  
  // For now, return null to let main component handle text input
  return null;
} 