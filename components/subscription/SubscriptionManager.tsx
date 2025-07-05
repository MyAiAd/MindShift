'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Crown, Check, Zap, Star, ArrowUp, ArrowDown, X } from 'lucide-react';

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

  useEffect(() => {
    if (user) {
      fetchSubscriptionData();
    }
  }, [user]);

  const fetchSubscriptionData = async () => {
    try {
      const response = await fetch('/api/subscriptions', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
        setPlans(data.plans);
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriptionAction = async (planId: string, action: string) => {
    setActionLoading(planId);
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, action }),
      });

      if (response.ok) {
        await fetchSubscriptionData();
        // Refresh auth context to update subscription tier
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update subscription');
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      alert('Failed to update subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (immediate = false) => {
    if (!confirm(immediate ? 'Cancel subscription immediately?' : 'Cancel at period end?')) {
      return;
    }

    setActionLoading('cancel');
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', cancelImmediately: immediate }),
      });

      if (response.ok) {
        await fetchSubscriptionData();
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      alert('Failed to cancel subscription');
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
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Subscription Management</h1>
        <p className="text-gray-600">Choose the plan that's right for your mindset transformation journey</p>
      </div>

      {/* Current Subscription Status */}
      {subscription && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Current Subscription</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getTierIcon(subscription.current_tier)}
              <div>
                <h3 className="font-medium">{subscription.subscription_plans.name}</h3>
                <p className="text-sm text-gray-600">
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
                  className="px-4 py-2 text-gray-600 hover:text-red-600 transition-colors"
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
            className={`bg-white rounded-lg shadow-sm border-2 p-6 ${
              subscription?.current_tier === plan.tier 
                ? 'border-indigo-500 ring-2 ring-indigo-100' 
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                {getTierIcon(plan.tier)}
                <h3 className="text-xl font-semibold">{plan.name}</h3>
              </div>
              {plan.tier === 'level_2' && (
                <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                  Most Popular
                </span>
              )}
            </div>

            <p className="text-gray-600 mb-4">{plan.description}</p>

            <div className="mb-6">
              <div className="text-3xl font-bold">
                ${isYearly ? plan.price_yearly : plan.price_monthly}
                <span className="text-lg font-normal text-gray-600">
                  /{isYearly ? 'year' : 'month'}
                </span>
              </div>
              {isYearly && plan.price_yearly && (
                <p className="text-sm text-green-600">
                  Save ${(plan.price_monthly * 12 - plan.price_yearly).toFixed(2)} per year
                </p>
              )}
            </div>

            <div className="mb-6">
              <h4 className="font-medium mb-3">Features:</h4>
              <ul className="space-y-2">
                {Object.entries(plan.features).map(([feature, enabled]) => 
                  enabled && (
                    <li key={feature} className="flex items-center space-x-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm capitalize">
                        {feature.replace(/_/g, ' ')}
                      </span>
                    </li>
                  )
                )}
              </ul>
              
              {plan.limits && Object.keys(plan.limits).length > 0 && (
                <div className="mt-3">
                  <h5 className="font-medium text-sm mb-2">Limits:</h5>
                  <ul className="space-y-1">
                    {Object.entries(plan.limits).map(([limit, value]) => (
                      <li key={limit} className="text-xs text-gray-600">
                        {limit.replace(/_/g, ' ')}: {value === -1 ? 'Unlimited' : value}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {getActionButton(plan)}
          </div>
        ))}
      </div>
    </div>
  );
} 