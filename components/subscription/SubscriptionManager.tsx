'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Crown, Check, Zap, Star, ArrowUp, ArrowDown, X, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'level_1' | 'level_2' | 'trial';
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: Record<string, boolean>;
  limits: Record<string, number>;
}

interface UserSubscription {
  id: string;
  current_tier: 'level_1' | 'level_2' | 'trial' | 'cancelled';
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  subscription_plans: SubscriptionPlan;
}

const tierOrder = { trial: 0, level_1: 1, level_2: 2, cancelled: -1 };

export default function SubscriptionManager() {
  const { user, profile } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchSubscriptionData();
    }
  }, [user]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const fetchSubscriptionData = async () => {
    try {
      clearMessages();
      const response = await fetch('/api/subscriptions', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
        
        // Remove duplicates by tier - keep only the first occurrence of each tier
        const uniquePlans = data.plans.filter((plan: SubscriptionPlan, index: number, array: SubscriptionPlan[]) => 
          array.findIndex(p => p.tier === plan.tier) === index
        );
        setPlans(uniquePlans);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load subscription data');
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
      setError('Failed to load subscription data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriptionAction = async (planId: string, action: string) => {
    setActionLoading(planId);
    clearMessages();
    
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, action }),
      });

      if (response.ok) {
        const actionMessages = {
          subscribe: 'Successfully subscribed to plan!',
          upgrade: 'Successfully upgraded your subscription!',
          downgrade: 'Successfully downgraded your subscription!'
        };
        
        setSuccess(actionMessages[action as keyof typeof actionMessages] || 'Subscription updated successfully!');
        
        // Wait a moment to show success message before reloading
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        
        await fetchSubscriptionData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update subscription. Please try again.');
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      setError('Failed to update subscription. Please check your connection and try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (immediate = false) => {
    const confirmMessage = immediate 
      ? 'Are you sure you want to cancel your subscription immediately? This action cannot be undone.'
      : 'Are you sure you want to cancel your subscription at the end of the current period?';
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setActionLoading('cancel');
    clearMessages();
    
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', cancelImmediately: immediate }),
      });

      if (response.ok) {
        const message = immediate 
          ? 'Your subscription has been cancelled immediately.'
          : 'Your subscription will be cancelled at the end of the current period.';
        
        setSuccess(message);
        
        // Wait a moment to show success message before reloading
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        
        await fetchSubscriptionData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to cancel subscription. Please try again.');
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      setError('Failed to cancel subscription. Please check your connection and try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const getActionButton = (plan: SubscriptionPlan) => {
    if (!subscription) {
      return (
        <button
          onClick={() => handleSubscriptionAction(plan.id, 'subscribe')}
          disabled={actionLoading === plan.id}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {actionLoading === plan.id ? 'Processing...' : 'Start Plan'}
        </button>
      );
    }

    const currentTierLevel = tierOrder[subscription.current_tier];
    const planTierLevel = tierOrder[plan.tier];

    if (subscription.current_tier === plan.tier) {
      return (
        <div className="w-full bg-green-100 text-green-800 py-2 px-4 rounded-lg text-center">
          <Check className="h-4 w-4 inline mr-2" />
          Current Plan
        </div>
      );
    }

    if (planTierLevel > currentTierLevel) {
      return (
        <button
          onClick={() => handleSubscriptionAction(plan.id, 'upgrade')}
          disabled={actionLoading === plan.id}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          {actionLoading === plan.id ? (
            'Processing...'
          ) : (
            <>
              <ArrowUp className="h-4 w-4 mr-2" />
              Upgrade
            </>
          )}
        </button>
      );
    }

    if (planTierLevel < currentTierLevel && planTierLevel >= 0) {
      return (
        <button
          onClick={() => handleSubscriptionAction(plan.id, 'downgrade')}
          disabled={actionLoading === plan.id}
          className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          {actionLoading === plan.id ? (
            'Processing...'
          ) : (
            <>
              <ArrowDown className="h-4 w-4 mr-2" />
              Downgrade
            </>
          )}
        </button>
      );
    }

    return null;
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'level_1': return <Zap className="h-6 w-6 text-blue-500" />;
      case 'level_2': return <Crown className="h-6 w-6 text-purple-500" />;
      default: return <Star className="h-6 w-6 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Subscription Management</h1>
        <p className="text-gray-600 dark:text-gray-300">Choose the plan that's right for your mindset transformation journey</p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
          <button
            onClick={clearMessages}
            className="text-red-500 hover:text-red-700 ml-3"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
          <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-green-800 font-medium">Success</p>
            <p className="text-green-700 text-sm">{success}</p>
          </div>
          <button
            onClick={clearMessages}
            className="text-green-500 hover:text-green-700 ml-3"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Current Subscription Status */}
      {subscription && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Current Subscription</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getTierIcon(subscription.current_tier)}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">{subscription.subscription_plans.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Status: {subscription.status} • 
                  {subscription.cancel_at_period_end 
                    ? ` Cancels on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                    : ` Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                  }
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              {!subscription.cancel_at_period_end && (
                <button
                  onClick={() => handleCancel(false)}
                  disabled={actionLoading === 'cancel'}
                  className="px-4 py-2 text-gray-600 hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  Cancel at Period End
                </button>
              )}
              <button
                onClick={() => handleCancel(true)}
                disabled={actionLoading === 'cancel'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {actionLoading === 'cancel' ? (
                  'Processing...'
                ) : (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Cancel Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Billing Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setIsYearly(false)}
            className={`px-4 py-2 rounded-md transition-colors ${
              !isYearly ? 'bg-white shadow-sm' : 'text-gray-600'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setIsYearly(true)}
            className={`px-4 py-2 rounded-md transition-colors ${
              isYearly ? 'bg-white shadow-sm' : 'text-gray-600'
            }`}
          >
            Yearly (Save 17%)
          </button>
        </div>
      </div>

      {/* Subscription Plans */}
      <div className="grid md:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 p-6 flex flex-col h-full ${
              subscription?.current_tier === plan.tier 
                ? 'border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900' 
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                {getTierIcon(plan.tier)}
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
              </div>
              {plan.tier === 'level_2' && (
                <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                  Most Popular
                </span>
              )}
            </div>

            {/* Description */}
                            <p className="text-gray-600 dark:text-gray-300 mb-4">{plan.description}</p>

            {/* Price */}
            <div className="mb-6">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                ${isYearly ? plan.price_yearly : plan.price_monthly}
                <span className="text-lg font-normal text-gray-600 dark:text-gray-400">
                  /{isYearly ? 'year' : 'month'}
                </span>
              </div>
              {isYearly && plan.price_yearly && (
                <p className="text-sm text-green-600">
                  Save ${(plan.price_monthly * 12 - plan.price_yearly).toFixed(2)} per year
                </p>
              )}
            </div>

            {/* Features - This section will grow to fill available space */}
            <div className="mb-6 flex-grow">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Features:</h4>
              <ul className="space-y-2">
                {Object.entries(plan.features).map(([feature, enabled]) => 
                  enabled && (
                    <li key={feature} className="flex items-center space-x-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm capitalize text-gray-600 dark:text-gray-300">
                        {feature.replace(/_/g, ' ')}
                      </span>
                    </li>
                  )
                )}
              </ul>
              
              {plan.limits && Object.keys(plan.limits).length > 0 && (
                <div className="mt-3">
                  <h5 className="font-medium text-sm text-gray-900 dark:text-white mb-2">Limits:</h5>
                  <ul className="space-y-1">
                    {Object.entries(plan.limits).map(([limit, value]) => (
                      <li key={limit} className="text-xs text-gray-600 dark:text-gray-400">
                        {limit.replace(/_/g, ' ')}: {value === -1 ? 'Unlimited' : value}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Action Button - This will stick to the bottom */}
            <div className="mt-auto">
              {getActionButton(plan)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 