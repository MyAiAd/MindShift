// ===============================================
// REUSABLE MYAI TEMPLATE - PAYMENT SERVICE
// ===============================================
// Centralized payment service using configuration system

import Stripe from 'stripe';
import config from '@/lib/config';

// Initialize Stripe with configuration
const getStripe = () => {
  if (!config.stripe.secretKey) {
    if (config.deployment.nodeEnv === 'production') {
      throw new Error('Stripe secret key is required in production');
    }
    console.warn('⚠️  Stripe secret key not configured - using placeholder for development');
    return new Stripe('sk_test_placeholder_for_development', {
      apiVersion: '2025-06-30.basil',
      typescript: true,
    });
  }
  
  return new Stripe(config.stripe.secretKey, {
    apiVersion: '2025-06-30.basil',
    typescript: true,
  });
};

// Singleton Stripe instance
let stripeInstance: Stripe | null = null;

export const stripe = () => {
  if (!stripeInstance) {
    stripeInstance = getStripe();
  }
  return stripeInstance;
};

// Webhook secret for signature verification
export const getWebhookSecret = () => {
  if (!config.stripe.webhookSecret) {
    if (config.deployment.nodeEnv === 'production') {
      throw new Error('Stripe webhook secret is required in production');
    }
    console.warn('⚠️  Stripe webhook secret not configured - webhook verification will fail');
    return 'whsec_placeholder_for_development';
  }
  
  return config.stripe.webhookSecret;
};

// Publishable key for frontend
export const getPublishableKey = () => {
  if (!config.stripe.publishableKey) {
    if (config.deployment.nodeEnv === 'production') {
      throw new Error('Stripe publishable key is required in production');
    }
    console.warn('⚠️  Stripe publishable key not configured');
    return 'pk_test_placeholder_for_development';
  }
  
  return config.stripe.publishableKey;
};

// Types for our application
export interface CustomerData {
  email: string;
  name?: string;
  tenantId: string;
  userId: string;
  metadata?: Record<string, string>;
}

export interface SubscriptionData {
  customerId: string;
  priceId: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}

// Customer management
export class CustomerService {
  private stripe = stripe();
  
  async createCustomer(data: CustomerData): Promise<Stripe.Customer> {
    return await this.stripe.customers.create({
      email: data.email,
      name: data.name,
      metadata: {
        tenant_id: data.tenantId,
        user_id: data.userId,
        ...data.metadata
      }
    });
  }
  
  async updateCustomer(customerId: string, data: Partial<CustomerData>): Promise<Stripe.Customer> {
    return await this.stripe.customers.update(customerId, {
      email: data.email,
      name: data.name,
      metadata: data.metadata
    });
  }
  
  async getCustomer(customerId: string): Promise<Stripe.Customer | null> {
    try {
      return await this.stripe.customers.retrieve(customerId) as Stripe.Customer;
    } catch (error) {
      console.error('Error retrieving customer:', error);
      return null;
    }
  }
  
  async deleteCustomer(customerId: string): Promise<boolean> {
    try {
      await this.stripe.customers.del(customerId);
      return true;
    } catch (error) {
      console.error('Error deleting customer:', error);
      return false;
    }
  }
}

// Subscription management
export class SubscriptionService {
  private stripe = stripe();
  
  async createSubscription(data: SubscriptionData): Promise<Stripe.Subscription> {
    const subscriptionData: Stripe.SubscriptionCreateParams = {
      customer: data.customerId,
      items: [{ price: data.priceId }],
      metadata: data.metadata || {}
    };
    
    if (data.trialDays) {
      subscriptionData.trial_period_days = data.trialDays;
    }
    
    return await this.stripe.subscriptions.create(subscriptionData);
  }
  
  async updateSubscription(subscriptionId: string, data: Partial<SubscriptionData>): Promise<Stripe.Subscription> {
    const updateData: Stripe.SubscriptionUpdateParams = {};
    
    if (data.metadata) {
      updateData.metadata = data.metadata;
    }
    
    return await this.stripe.subscriptions.update(subscriptionId, updateData);
  }
  
  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<Stripe.Subscription> {
    if (immediately) {
      return await this.stripe.subscriptions.cancel(subscriptionId);
    } else {
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    }
  }
  
  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });
  }
  
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.error('Error retrieving subscription:', error);
      return null;
    }
  }
}

// Webhook verification
export class WebhookService {
  private stripe = stripe();
  
  verifyWebhook(payload: string, signature: string): Stripe.Event | null {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, getWebhookSecret());
    } catch (error) {
      console.error('Webhook verification failed:', error);
      return null;
    }
  }
}

// Payment method management
export class PaymentMethodService {
  private stripe = stripe();
  
  async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<Stripe.PaymentMethod> {
    return await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });
  }
  
  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return await this.stripe.paymentMethods.detach(paymentMethodId);
  }
  
  async listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const response = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });
    return response.data;
  }
}

// Service instances
export const customerService = new CustomerService();
export const subscriptionService = new SubscriptionService();
export const webhookService = new WebhookService();
export const paymentMethodService = new PaymentMethodService();

// Configuration validation
export const validateStripeConfig = () => {
  const errors: string[] = [];
  
  if (!config.stripe.secretKey && config.deployment.nodeEnv === 'production') {
    errors.push('STRIPE_SECRET_KEY is required in production');
  }
  
  if (!config.stripe.webhookSecret && config.deployment.nodeEnv === 'production') {
    errors.push('STRIPE_WEBHOOK_SECRET is required in production');
  }
  
  if (!config.stripe.publishableKey && config.deployment.nodeEnv === 'production') {
    errors.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required in production');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Export configuration info
export const getStripeConfig = () => {
  return {
    hasSecretKey: !!config.stripe.secretKey,
    hasWebhookSecret: !!config.stripe.webhookSecret,
    hasPublishableKey: !!config.stripe.publishableKey,
    publishableKey: config.stripe.publishableKey,
    environment: config.deployment.nodeEnv
  };
}; 