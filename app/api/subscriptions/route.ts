import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export async function GET(request: NextRequest) {
  console.log('Subscription API: Starting request');
  
  try {
    // Create server client with proper auth context
    const supabase = createServerClient();
    console.log('Subscription API: Server client created');
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Subscription API: Auth check result', { user: !!user, error: authError?.message });
    
    if (authError || !user) {
      console.log('Subscription API: Authentication failed', { authError, hasUser: !!user });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Subscription API: User authenticated successfully', user.email);

    // Get user's subscription info
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans (
          name,
          tier,
          description,
          price_monthly,
          price_yearly,
          features,
          limits
        )
      `)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching subscription:', error);
      return NextResponse.json(
        { error: 'Failed to fetch subscription' },
        { status: 500 }
      );
    }

    // Get available plans
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('status', 'active')
      .order('price_monthly');

    if (plansError) {
      console.error('Error fetching plans:', plansError);
      return NextResponse.json(
        { error: 'Failed to fetch plans' },
        { status: 500 }
      );
    }

    console.log('Subscription API: Success - returning data', { hasSubscription: !!subscription, plansCount: plans?.length });
    return NextResponse.json({ subscription, plans });
  } catch (error) {
    console.error('Error in subscription fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Create server client with proper auth context
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { planId, action } = body;

    if (action === 'subscribe' || action === 'upgrade' || action === 'downgrade') {
      // Update user subscription using the database function
      const { data, error } = await supabase
        .rpc('update_user_subscription', {
          user_id_param: user.id,
          new_plan_id_param: planId,
          change_reason_param: action
        });

      if (error) {
        console.error('Error updating subscription:', error);
        return NextResponse.json(
          { error: 'Failed to update subscription' },
          { status: 500 }
        );
      }

      return NextResponse.json({ subscriptionId: data, success: true });
    }

    if (action === 'cancel') {
      const { cancelImmediately = false } = body;
      
      const { data, error } = await supabase
        .rpc('cancel_user_subscription', {
          user_id_param: user.id,
          cancel_immediately: cancelImmediately
        });

      if (error) {
        console.error('Error cancelling subscription:', error);
        return NextResponse.json(
          { error: 'Failed to cancel subscription' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: data });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in subscription management:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 