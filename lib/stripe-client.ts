// ===============================================
// DEPRECATED: Please use services/payment/stripe.service.ts instead
// ===============================================
// This file is kept for backwards compatibility but should be migrated

import Stripe from 'stripe';
import { stripe, getWebhookSecret, getPublishableKey } from '@/services/payment/stripe.service';

// Export the service functions for backwards compatibility
export const webhookSecret = getWebhookSecret();
export const publishableKey = getPublishableKey();

// Legacy exports - get a fresh instance
export default stripe();

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
  trialPeriodDays?: number;
  metadata?: Record<string, string>;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  api_version: string;
  created: number;
}

// Error types
export class StripeError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public original?: Stripe.StripeRawError
  ) {
    super(message);
    this.name = 'StripeError';
  }
}

// Stripe client class with error handling
export class StripeClient {
  private stripe: Stripe;

  constructor() {
    this.stripe = stripe();
  }

  // Verify webhook signature and parse event
  async verifyWebhook(body: string, signature: string): Promise<WebhookEvent> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
      
      return {
        id: event.id,
        type: event.type,
        data: event.data,
        api_version: event.api_version || '2025-06-30.basil',
        created: event.created
      };
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new StripeError(
        'Invalid webhook signature',
        'webhook_signature_verification_failed',
        400,
        error as Stripe.StripeRawError
      );
    }
  }

  // Create a Stripe customer
  async createCustomer(data: CustomerData): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email: data.email,
        name: data.name,
        metadata: {
          tenant_id: data.tenantId,
          user_id: data.userId,
          ...data.metadata
        }
      });

      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw new StripeError(
        'Failed to create customer',
        'customer_creation_failed',
        500,
        error as Stripe.StripeRawError
      );
    }
  }

  // Update a Stripe customer
  async updateCustomer(
    customerId: string, 
    data: Partial<CustomerData>
  ): Promise<Stripe.Customer> {
    try {
      const updateData: Stripe.CustomerUpdateParams = {};
      
      if (data.email) updateData.email = data.email;
      if (data.name) updateData.name = data.name;
      
      if (data.metadata || data.tenantId || data.userId) {
        updateData.metadata = {
          ...data.metadata
        };
        if (data.tenantId) updateData.metadata.tenant_id = data.tenantId;
        if (data.userId) updateData.metadata.user_id = data.userId;
      }

      const customer = await this.stripe.customers.update(customerId, updateData);
      return customer;
    } catch (error) {
      console.error('Error updating Stripe customer:', error);
      throw new StripeError(
        'Failed to update customer',
        'customer_update_failed',
        500,
        error as Stripe.StripeRawError
      );
    }
  }

  // Get a Stripe customer
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      
      if (customer.deleted) {
        throw new StripeError(
          'Customer has been deleted',
          'customer_deleted',
          404
        );
      }

      return customer as Stripe.Customer;
    } catch (error) {
      console.error('Error retrieving Stripe customer:', error);
      throw new StripeError(
        'Failed to retrieve customer',
        'customer_retrieval_failed',
        500,
        error as Stripe.StripeRawError
      );
    }
  }

  // Create a subscription
  async createSubscription(data: SubscriptionData): Promise<Stripe.Subscription> {
    try {
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: data.customerId,
        items: [{ price: data.priceId }],
        metadata: {
          ...data.metadata
        },
        expand: ['customer', 'latest_invoice.payment_intent']
      };

      // Add trial period if specified
      if (data.trialPeriodDays && data.trialPeriodDays > 0) {
        subscriptionParams.trial_period_days = data.trialPeriodDays;
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionParams);
      return subscription;
    } catch (error) {
      console.error('Error creating Stripe subscription:', error);
      throw new StripeError(
        'Failed to create subscription',
        'subscription_creation_failed',
        500,
        error as Stripe.StripeRawError
      );
    }
  }

  // Update a subscription
  async updateSubscription(
    subscriptionId: string,
    updates: Stripe.SubscriptionUpdateParams
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(
        subscriptionId,
        {
          ...updates,
          expand: ['customer', 'latest_invoice.payment_intent']
        }
      );
      return subscription;
    } catch (error) {
      console.error('Error updating Stripe subscription:', error);
      throw new StripeError(
        'Failed to update subscription',
        'subscription_update_failed',
        500,
        error as Stripe.StripeRawError
      );
    }
  }

  // Cancel a subscription
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<Stripe.Subscription> {
    try {
      if (cancelAtPeriodEnd) {
        // Cancel at end of current billing period
        const subscription = await this.stripe.subscriptions.update(
          subscriptionId,
          {
            cancel_at_period_end: true,
            expand: ['customer']
          }
        );
        return subscription;
      } else {
        // Cancel immediately
        const subscription = await this.stripe.subscriptions.cancel(
          subscriptionId,
          {
            expand: ['customer']
          }
        );
        return subscription;
      }
    } catch (error) {
      console.error('Error canceling Stripe subscription:', error);
      throw new StripeError(
        'Failed to cancel subscription',
        'subscription_cancellation_failed',
        500,
        error as Stripe.StripeRawError
      );
    }
  }

  // Get a subscription
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(
        subscriptionId,
        {
          expand: ['customer', 'latest_invoice.payment_intent']
        }
      );
      return subscription;
    } catch (error) {
      console.error('Error retrieving Stripe subscription:', error);
      throw new StripeError(
        'Failed to retrieve subscription',
        'subscription_retrieval_failed',
        500,
        error as Stripe.StripeRawError
      );
    }
  }

  // Create a Stripe Checkout Session
  async createCheckoutSession(params: {
    customerId?: string;
    customerEmail?: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
    trialPeriodDays?: number;
  }): Promise<Stripe.Checkout.Session> {
    try {
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: 'subscription',
        line_items: [
          {
            price: params.priceId,
            quantity: 1,
          },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: params.metadata || {},
        expand: ['subscription']
      };

      // Set customer or email
      if (params.customerId) {
        sessionParams.customer = params.customerId;
      } else if (params.customerEmail) {
        sessionParams.customer_email = params.customerEmail;
      }

      // Add trial if specified
      if (params.trialPeriodDays && params.trialPeriodDays > 0) {
        sessionParams.subscription_data = {
          trial_period_days: params.trialPeriodDays,
          metadata: params.metadata || {}
        };
      }

      const session = await this.stripe.checkout.sessions.create(sessionParams);
      return session;
    } catch (error) {
      console.error('Error creating Stripe checkout session:', error);
      throw new StripeError(
        'Failed to create checkout session',
        'checkout_session_creation_failed',
        500,
        error as Stripe.StripeRawError
      );
    }
  }

  // Create a billing portal session
  async createBillingPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<Stripe.BillingPortal.Session> {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      return session;
    } catch (error) {
      console.error('Error creating billing portal session:', error);
      throw new StripeError(
        'Failed to create billing portal session',
        'billing_portal_creation_failed',
        500,
        error as Stripe.StripeRawError
      );
    }
  }

  // Get invoice
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      const invoice = await this.stripe.invoices.retrieve(invoiceId, {
        expand: ['subscription', 'payment_intent']
      });
      return invoice;
    } catch (error) {
      console.error('Error retrieving Stripe invoice:', error);
      throw new StripeError(
        'Failed to retrieve invoice',
        'invoice_retrieval_failed',
        500,
        error as Stripe.StripeRawError
      );
    }
  }

  // List customer's subscriptions
  async listCustomerSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        expand: ['data.latest_invoice.payment_intent']
      });
      return subscriptions.data;
    } catch (error) {
      console.error('Error listing customer subscriptions:', error);
      throw new StripeError(
        'Failed to list subscriptions',
        'subscription_listing_failed',
        500,
        error as Stripe.StripeRawError
      );
    }
  }

  // List prices for subscription plans
  async listPrices(active: boolean = true): Promise<Stripe.Price[]> {
    try {
      const prices = await this.stripe.prices.list({
        active,
        expand: ['data.product']
      });
      return prices.data;
    } catch (error) {
      console.error('Error listing Stripe prices:', error);
      throw new StripeError(
        'Failed to list prices',
        'price_listing_failed',
        500,
        error as Stripe.StripeRawError
      );
    }
  }

  // Get raw Stripe instance for advanced operations
  get rawStripe(): Stripe {
    return this.stripe;
  }
}

// Export singleton instance with lazy initialization
let _stripeClient: StripeClient | null = null;
export const stripeClient = (): StripeClient => {
  if (!_stripeClient) {
    _stripeClient = new StripeClient();
  }
  return _stripeClient;
};

// Export Stripe types for convenience
export { Stripe };

// Helper function to format currency
export function formatCurrency(amountInCents: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountInCents / 100);
}

// Helper function to get subscription status display
export function getSubscriptionStatusDisplay(status: Stripe.Subscription.Status): {
  label: string;
  color: string;
  description: string;
} {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        color: 'green',
        description: 'Subscription is active and current'
      };
    case 'trialing':
      return {
        label: 'Trial',
        color: 'blue',
        description: 'In trial period'
      };
    case 'past_due':
      return {
        label: 'Past Due',
        color: 'yellow',
        description: 'Payment failed, retrying'
      };
    case 'canceled':
      return {
        label: 'Canceled',
        color: 'red',
        description: 'Subscription has been canceled'
      };
    case 'unpaid':
      return {
        label: 'Unpaid',
        color: 'red',
        description: 'Payment failed multiple times'
      };
    case 'incomplete':
      return {
        label: 'Incomplete',
        color: 'gray',
        description: 'Subscription setup incomplete'
      };
    case 'incomplete_expired':
      return {
        label: 'Expired',
        color: 'red',
        description: 'Incomplete subscription expired'
      };
    case 'paused':
      return {
        label: 'Paused',
        color: 'gray',
        description: 'Subscription is paused'
      };
    default:
      return {
        label: 'Unknown',
        color: 'gray',
        description: 'Unknown subscription status'
      };
  }
} 