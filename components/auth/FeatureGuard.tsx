'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { Lock, Crown, ArrowUp } from 'lucide-react';

interface FeatureGuardProps {
  featureKey: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
}

export default function FeatureGuard({ 
  featureKey, 
  children, 
  fallback, 
  showUpgrade = true 
}: FeatureGuardProps) {
  const { hasFeatureAccess, subscriptionTier } = useAuth();

  if (hasFeatureAccess(featureKey)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgrade) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6 text-center">
      <div className="flex items-center justify-center mb-4">
        <div className="bg-indigo-100 p-3 rounded-full">
          <Crown className="h-8 w-8 text-indigo-600" />
        </div>
      </div>
      
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Premium Feature
      </h3>
      
      <p className="text-muted-foreground mb-4">
        This feature requires a {getRequiredTier(featureKey)} subscription or higher.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href="/dashboard/subscription"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <ArrowUp className="h-4 w-4 mr-2" />
          Upgrade Now
        </a>
        
        <button className="px-4 py-2 text-indigo-600 hover:text-indigo-700 transition-colors">
          Learn More
        </button>
      </div>
    </div>
  );
}

// Simple feature access check without component wrapper
export function useFeatureAccess(featureKey: string) {
  const { hasFeatureAccess } = useAuth();
  return hasFeatureAccess(featureKey);
}

// Get required tier for a feature
function getRequiredTier(featureKey: string): string {
  const featureRequirements: Record<string, string> = {
    'problem_shifting': 'Level 1',
    'advanced_methods': 'Level 2',
    'ai_insights': 'Level 2',
    'unlimited_sessions': 'Level 2',
    'priority_support': 'Level 2',
    'advanced_analytics': 'Level 2',
    'team_management': 'Level 2',
  };

  return featureRequirements[featureKey] || 'Level 2';
}

// Feature access banner for partial restrictions
export function FeatureBanner({ 
  featureKey, 
  message 
}: { 
  featureKey: string; 
  message?: string; 
}) {
  const { hasFeatureAccess } = useAuth();

  if (hasFeatureAccess(featureKey)) {
    return null;
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <div className="flex items-center">
        <Lock className="h-5 w-5 text-amber-600 mr-3" />
        <div className="flex-1">
          <p className="text-amber-800">
            {message || `This feature requires a ${getRequiredTier(featureKey)} subscription.`}
          </p>
        </div>
        <a
          href="/dashboard/subscription"
          className="ml-4 text-amber-600 hover:text-amber-700 font-medium"
        >
          Upgrade →
        </a>
      </div>
    </div>
  );
} 