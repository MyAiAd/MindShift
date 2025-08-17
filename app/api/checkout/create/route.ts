import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { customerService } from '@/services/payment/stripe.service';
import { stripe } from '@/services/payment/stripe.service';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, successUrl, cancelUrl } = await request.json();

    // Get user profile and plan details
    const [profileResult, planResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('subscription_plans').select('*').eq('id', planId).single()
    ]);

    if (!profileResult.data || !planResult.data) {
      return NextResponse.json({ error: 'User or plan not found' }, { status: 404 });
    }

    const profile = profileResult.data;
    const plan = planResult.data;

    // Create or get Stripe customer
    let stripeCustomerId = profile.stripe_customer_id;
    
    if (!stripeCustomerId) {
      const customer = await customerService.createCustomer({
        email: user.email!,
        name: profile.name || undefined,
        tenantId: profile.tenant_id,
        userId: user.id,
        metadata: {
          tenant_id: profile.tenant_id,
          user_id: user.id
        }
      });
      
      stripeCustomerId = customer.id;
      
      // Update profile with Stripe customer ID
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', user.id);
    }

    // Create Stripe Checkout session
    const session = await stripe().checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan.name,
              description: plan.description,
            },
            unit_amount: plan.price_monthly * 100, // Convert to cents
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/cancel`,
      metadata: {
        user_id: user.id,
        tenant_id: profile.tenant_id,
        plan_id: planId,
        plan_tier: plan.tier,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          tenant_id: profile.tenant_id,
          plan_id: planId,
          plan_tier: plan.tier,
        },
      },
    });

    return NextResponse.json({ 
      checkout_url: session.url,
      session_id: session.id 
    });

  } catch (error) {
    console.error('Checkout creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
} 