import { NextRequest, NextResponse } from 'next/server';
import { stripeClient, WebhookEvent, StripeError } from '@/lib/stripe-client';
import { createServerClient } from '@/lib/database-server';
import { rateLimit, RATE_LIMITS, logSecurityEvent } from '@/lib/security-middleware';

// Disable body parsing for webhooks
export const runtime = 'nodejs';

// GET method for webhook verification (Stripe CLI testing)
export async function GET() {
  return NextResponse.json({ message: 'Stripe webhook endpoint is active' });
}

// POST method for handling webhook events
export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is properly configured in production
    if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
      if (!process.env.STRIPE_SECRET_KEY) {
        console.error('Stripe secret key is required in production');
        return NextResponse.json(
          { error: 'Payment service unavailable' },
          { status: 503 }
        );
      }
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.error('Stripe webhook secret is required in production');
        return NextResponse.json(
          { error: 'Webhook verification unavailable' },
          { status: 503 }
        );
      }
    }

    // Apply rate limiting to webhook endpoint
    const rateLimitResult = await rateLimit(request, {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 100 // Allow 100 webhooks per 5 minutes
    });

    if (!rateLimitResult.success) {
      console.error('Webhook rate limit exceeded:', {
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime
      });
      
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
          }
        }
      );
    }

    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature header');
      return NextResponse.json(
        { error: 'Missing signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature and parse event
    let event: WebhookEvent;
    try {
      event = await stripeClient().verifyWebhook(body, signature);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      
      if (error instanceof StripeError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode || 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      );
    }

    console.log(`🔔 Stripe webhook received: ${event.type} (${event.id})`);

    // Process the webhook event
    const supabase = createServerClient();
    
    // Store the event in database with idempotency check
    const { data: processResult, error: processError } = await supabase
      .rpc('process_stripe_webhook_event', {
        p_stripe_event_id: event.id,
        p_event_type: event.type,
        p_api_version: event.api_version,
        p_event_data: event.data
      });

    if (processError) {
      console.error('Error storing webhook event:', processError);
      return NextResponse.json(
        { error: 'Failed to process webhook event' },
        { status: 500 }
      );
    }

    // Check if event was already processed
    if (processResult.status === 'already_processed') {
      console.log(`⚡ Event ${event.id} already processed`);
      return NextResponse.json({ received: true, status: 'already_processed' });
    }

    // Process specific event types
    try {
      await handleStripeEvent(event, supabase, processResult.event_id);
      
      // Mark event as successfully processed
      await supabase.rpc('mark_stripe_event_processed', {
        p_event_id: processResult.event_id,
        p_success: true
      });

      console.log(`✅ Successfully processed ${event.type} event`);
      
    } catch (error) {
      console.error(`❌ Error processing ${event.type} event:`, error);
      
      // Mark event as failed
      await supabase.rpc('mark_stripe_event_processed', {
        p_event_id: processResult.event_id,
        p_success: false,
        p_error_message: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Don't return error to Stripe - we've logged it and will retry
      console.log('Event marked as failed, returning success to prevent Stripe retries');
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Critical webhook processing error:', error);
    
    // Log critical error
    try {
      await logSecurityEvent(
        'stripe_webhook_critical_error',
        null,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        },
        request
      );
    } catch (logError) {
      console.error('Failed to log security event:', logError);
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle specific Stripe event types
async function handleStripeEvent(
  event: WebhookEvent,
  supabase: any,
  eventId: string
) {
  const eventObject = event.data.object;
  
  switch (event.type) {
    // Customer events
    case 'customer.created':
      await handleCustomerCreated(eventObject, supabase);
      break;
      
    case 'customer.updated':
      await handleCustomerUpdated(eventObject, supabase);
      break;
      
    case 'customer.deleted':
      await handleCustomerDeleted(eventObject, supabase);
      break;

    // Subscription events  
    case 'customer.subscription.created':
      await handleSubscriptionCreated(eventObject, supabase);
      break;
      
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(eventObject, supabase);
      break;
      
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(eventObject, supabase);
      break;
      
    case 'customer.subscription.trial_will_end':
      await handleTrialWillEnd(eventObject, supabase);
      break;

    // Invoice events
    case 'invoice.created':
      await handleInvoiceCreated(eventObject, supabase);
      break;
      
    case 'invoice.finalized':
      await handleInvoiceFinalized(eventObject, supabase);
      break;
      
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(eventObject, supabase);
      break;
      
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(eventObject, supabase);
      break;

    // Payment events
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(eventObject, supabase);
      break;
      
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(eventObject, supabase);
      break;

    // Checkout events
    case 'checkout.session.completed':
      await handleCheckoutCompleted(eventObject, supabase);
      break;

    default:
      console.log(`📋 Unhandled event type: ${event.type}`);
      // Just log unhandled events - don't fail
      break;
  }
}

// Event handlers
async function handleCustomerCreated(customer: any, supabase: any) {
  console.log(`👤 Customer created: ${customer.id}`);
  
  // Update our customer billing info if user exists
  if (customer.metadata?.user_id) {
    await supabase
      .from('customer_billing_info')
      .upsert({
        user_id: customer.metadata.user_id,
        tenant_id: customer.metadata.tenant_id,
        stripe_customer_id: customer.id,
        billing_name: customer.name,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
  }
}

async function handleCustomerUpdated(customer: any, supabase: any) {
  console.log(`👤 Customer updated: ${customer.id}`);
  
  // Update our customer billing info
  await supabase
    .from('customer_billing_info')
    .update({
      billing_name: customer.name,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', customer.id);
}

async function handleCustomerDeleted(customer: any, supabase: any) {
  console.log(`👤 Customer deleted: ${customer.id}`);
  
  // Remove Stripe customer ID from our records
  await supabase
    .from('customer_billing_info')
    .update({
      stripe_customer_id: null,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', customer.id);
}

async function handleSubscriptionCreated(subscription: any, supabase: any) {
  console.log(`🔄 Subscription created: ${subscription.id}`);
  
  // Sync subscription to our database
  await supabase.rpc('sync_subscription_from_stripe', {
    p_stripe_subscription_data: subscription
  });
}

async function handleSubscriptionUpdated(subscription: any, supabase: any) {
  console.log(`🔄 Subscription updated: ${subscription.id}`);
  
  // Sync subscription to our database
  await supabase.rpc('sync_subscription_from_stripe', {
    p_stripe_subscription_data: subscription
  });
}

async function handleSubscriptionDeleted(subscription: any, supabase: any) {
  console.log(`🔄 Subscription deleted: ${subscription.id}`);
  
  // Sync subscription to our database
  await supabase.rpc('sync_subscription_from_stripe', {
    p_stripe_subscription_data: subscription
  });
}

async function handleTrialWillEnd(subscription: any, supabase: any) {
  console.log(`⏰ Trial ending soon: ${subscription.id}`);
  
  // TODO: Send trial ending notification email
  // For now, just log the event
}

async function handleInvoiceCreated(invoice: any, supabase: any) {
  console.log(`📄 Invoice created: ${invoice.id}`);
  
  // Update subscription with latest invoice
  if (invoice.subscription) {
    await supabase
      .from('user_subscriptions')
      .update({
        stripe_invoice_id: invoice.id,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', invoice.subscription);
  }
}

async function handleInvoiceFinalized(invoice: any, supabase: any) {
  console.log(`📄 Invoice finalized: ${invoice.id}`);
  
  // Invoice is ready for payment - could send notification here
}

async function handleInvoicePaymentSucceeded(invoice: any, supabase: any) {
  console.log(`💰 Payment succeeded: ${invoice.id}`);
  
  // Record successful payment
  if (invoice.subscription) {
    // Get user from subscription
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('user_id, tenant_id')
      .eq('stripe_subscription_id', invoice.subscription)
      .single();
    
    if (subscription) {
      // Record payment transaction
      await supabase
        .from('payment_transactions')
        .insert({
          user_id: subscription.user_id,
          tenant_id: subscription.tenant_id,
          amount_cents: invoice.amount_paid,
          currency: invoice.currency.toLowerCase(),
          status: 'completed',
          processor_name: 'stripe',
          external_transaction_id: invoice.payment_intent,
          stripe_invoice_id: invoice.id,
          stripe_payment_intent_id: invoice.payment_intent,
          description: invoice.description || 'Subscription payment',
          transaction_date: new Date(invoice.created * 1000).toISOString(),
          metadata: {
            invoice_number: invoice.number,
            billing_period_start: new Date(invoice.period_start * 1000).toISOString(),
            billing_period_end: new Date(invoice.period_end * 1000).toISOString()
          }
        });
    }
  }
}

async function handleInvoicePaymentFailed(invoice: any, supabase: any) {
  console.log(`❌ Payment failed: ${invoice.id}`);
  
  // Record failed payment
  if (invoice.subscription) {
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('user_id, tenant_id')
      .eq('stripe_subscription_id', invoice.subscription)
      .single();
    
    if (subscription) {
      await supabase
        .from('payment_transactions')
        .insert({
          user_id: subscription.user_id,
          tenant_id: subscription.tenant_id,
          amount_cents: invoice.amount_due,
          currency: invoice.currency.toLowerCase(),
          status: 'failed',
          processor_name: 'stripe',
          external_transaction_id: invoice.payment_intent,
          stripe_invoice_id: invoice.id,
          stripe_payment_intent_id: invoice.payment_intent,
          description: invoice.description || 'Subscription payment',
          transaction_date: new Date(invoice.created * 1000).toISOString(),
          failure_message: 'Payment failed',
          metadata: {
            invoice_number: invoice.number,
            attempt_count: invoice.attempt_count
          }
        });
    }
  }
  
  // TODO: Send payment failed notification email
}

async function handlePaymentSucceeded(paymentIntent: any, supabase: any) {
  console.log(`💳 Payment intent succeeded: ${paymentIntent.id}`);
  
  // This is handled by invoice.payment_succeeded for subscriptions
  // Could handle one-time payments here if we support them
}

async function handlePaymentFailed(paymentIntent: any, supabase: any) {
  console.log(`💳 Payment intent failed: ${paymentIntent.id}`);
  
  // This is handled by invoice.payment_failed for subscriptions
}

async function handleCheckoutCompleted(session: any, supabase: any) {
  console.log(`🛒 Checkout completed: ${session.id}`);
  
  // Update subscription with checkout session info
  if (session.subscription) {
    await supabase
      .from('user_subscriptions')
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', session.subscription);
  }
  
  // TODO: Send welcome email after successful checkout
} 