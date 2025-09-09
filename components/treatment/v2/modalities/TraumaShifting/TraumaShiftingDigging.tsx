'use client';

import React from 'react';
import { DiggingDeeperProps } from '../../shared/types';

export default function TraumaShiftingDigging({ modalityType, currentStep }: DiggingDeeperProps) {
  const traumaDiggingSteps = [
    'trauma_digging_deeper_start',
    'trauma_scenario_check_1',
    'trauma_scenario_check_2',
    'trauma_scenario_check_3'
  ];
  
  if (!traumaDiggingSteps.includes(currentStep)) return null;
  
  // For now, return null - Trauma Shifting uses specialized flow handled by main component
  // This can be expanded later with trauma-specific digging UI
  return null;
} 