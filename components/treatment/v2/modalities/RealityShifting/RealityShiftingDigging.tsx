'use client';

import React from 'react';
import { DiggingDeeperProps } from '../../shared/types';

export default function RealityShiftingDigging({ modalityType, currentStep }: DiggingDeeperProps) {
  // Reality Shifting doesn't typically use digging deeper (goals are more straightforward)
  const realityDiggingSteps = ['reality_digging_deeper_start'];
  
  if (!realityDiggingSteps.includes(currentStep)) return null;
  
  // For now, return null - Reality Shifting (goals) uses simpler flow
  return null;
} 