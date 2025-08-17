import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { stripe } from '@/services/payment/stripe.service';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { returnUrl } = await request.json();

    // Get user profile with Stripe customer ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      return NextResponse.json({ 
        error: 'No billing information found. Please subscribe to a plan first.' 
      }, { status: 404 });
    }

    // Create Stripe billing portal session
    const portalSession = await stripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/subscription`,
    });

    return NextResponse.json({ 
      portal_url: portalSession.url 
    });

  } catch (error) {
    console.error('Billing portal creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    );
  }
} 