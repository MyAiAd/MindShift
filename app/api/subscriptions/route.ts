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
    console.log('Subscription API: Auth check result', { 
      user: !!user, 
      userId: user?.id,
      userEmail: user?.email,
      error: authError?.message
    });
    
    if (authError || !user) {
      console.log('Subscription API: Authentication failed', { 
        authError: authError?.message, 
        hasUser: !!user
      });
      return NextResponse.json({ 
        error: 'Unauthorized',
        debug: {
          hasUser: !!user,
          authError: authError?.message
        }
      }, { status: 401 });
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
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
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

    // Get user profile to check admin permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single();

    const body = await request.json();
    const { planId, action, customerId, adminOverride = false } = body;

    // Determine target user ID (for admin overrides)
    const targetUserId = (adminOverride && customerId) ? customerId : user.id;
    
    // Check admin permissions for override actions
    if (adminOverride || customerId) {
      if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role)) {
        return NextResponse.json({ error: 'Insufficient permissions for admin override' }, { status: 403 });
      }

      // For tenant admins, verify they can access the target customer
      if (profile.role === 'tenant_admin' && customerId) {
        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', customerId)
          .single();

        if (!targetProfile || targetProfile.tenant_id !== profile.tenant_id) {
          return NextResponse.json({ error: 'Access denied to customer' }, { status: 403 });
        }
      }
    }

    if (action === 'subscribe' || action === 'upgrade' || action === 'downgrade') {
      // Determine change reason
      let changeReason = action;
      if (adminOverride) {
        changeReason = `admin_${action}`;
      }

      // Update user subscription using the database function
      const { data, error } = await supabase
        .rpc('update_user_subscription', {
          user_id_param: targetUserId,
          new_plan_id_param: planId,
          change_reason_param: changeReason
        });

      if (error) {
        console.error('Error updating subscription:', error);
        return NextResponse.json(
          { error: 'Failed to update subscription' },
          { status: 500 }
        );
      }

      // Log admin action if this was an override
      if (adminOverride) {
        await supabase.rpc('log_admin_action', {
          p_action: `admin_subscription_${action}`,
          p_resource_type: 'subscription',
          p_resource_id: data,
          p_new_data: { targetUserId, planId, action }
        });
      }

      return NextResponse.json({ subscriptionId: data, success: true });
    }

    if (action === 'cancel') {
      const { cancelImmediately = false } = body;
      
      const { data, error } = await supabase
        .rpc('cancel_user_subscription', {
          user_id_param: targetUserId,
          cancel_immediately: cancelImmediately
        });

      if (error) {
        console.error('Error cancelling subscription:', error);
        return NextResponse.json(
          { error: 'Failed to cancel subscription' },
          { status: 500 }
        );
      }

      // Log admin action if this was an override
      if (adminOverride) {
        await supabase.rpc('log_admin_action', {
          p_action: 'admin_subscription_cancel',
          p_resource_type: 'subscription',
          p_resource_id: targetUserId,
          p_new_data: { targetUserId, cancelImmediately }
        });
      }

      return NextResponse.json({ success: data });
    }

    // Admin-only actions
    if (adminOverride && ['extend_trial', 'pause_subscription', 'reactivate_subscription', 'manual_status_change'].includes(action)) {
      if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role)) {
        return NextResponse.json({ error: 'Admin permissions required' }, { status: 403 });
      }

      switch (action) {
        case 'extend_trial': {
          const { extensionDays = 14 } = body;
          
          // Update trial end date
          const newTrialEnd = new Date();
          newTrialEnd.setDate(newTrialEnd.getDate() + extensionDays);

          const { data: updatedSubscription, error } = await supabase
            .from('user_subscriptions')
            .update({ 
              trial_ends_at: newTrialEnd.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('user_id', targetUserId)
            .select()
            .single();

          if (error) {
            console.error('Error extending trial:', error);
            return NextResponse.json({ error: 'Failed to extend trial' }, { status: 500 });
          }

          // Record subscription change
          await supabase.from('subscription_changes').insert({
            user_id: targetUserId,
            subscription_id: updatedSubscription.id,
            admin_user_id: user.id,
            change_type: 'trial_extended',
            change_reason: 'admin_override',
            effective_date: new Date().toISOString(),
            trial_end_date: newTrialEnd.toISOString(),
            notes: `Trial extended by ${extensionDays} days`
          });

          // Log admin action
          await supabase.rpc('log_admin_action', {
            p_action: 'extend_trial',
            p_resource_type: 'subscription',
            p_resource_id: updatedSubscription.id,
            p_new_data: { targetUserId, extensionDays, newTrialEnd: newTrialEnd.toISOString() }
          });

          return NextResponse.json({ success: true, newTrialEnd });
        }

        case 'pause_subscription': {
          const { data: updatedSubscription, error } = await supabase
            .from('user_subscriptions')
            .update({ 
              status: 'paused',
              updated_at: new Date().toISOString()
            })
            .eq('user_id', targetUserId)
            .select()
            .single();

          if (error) {
            console.error('Error pausing subscription:', error);
            return NextResponse.json({ error: 'Failed to pause subscription' }, { status: 500 });
          }

          // Record subscription change
          await supabase.from('subscription_changes').insert({
            user_id: targetUserId,
            subscription_id: updatedSubscription.id,
            admin_user_id: user.id,
            change_type: 'paused',
            change_reason: 'admin_override',
            to_status: 'paused',
            effective_date: new Date().toISOString()
          });

          // Log admin action
          await supabase.rpc('log_admin_action', {
            p_action: 'pause_subscription',
            p_resource_type: 'subscription',
            p_resource_id: updatedSubscription.id,
            p_new_data: { targetUserId }
          });

          return NextResponse.json({ success: true });
        }

        case 'reactivate_subscription': {
          const { data: updatedSubscription, error } = await supabase
            .from('user_subscriptions')
            .update({ 
              status: 'active',
              cancel_at_period_end: false,
              cancelled_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', targetUserId)
            .select()
            .single();

          if (error) {
            console.error('Error reactivating subscription:', error);
            return NextResponse.json({ error: 'Failed to reactivate subscription' }, { status: 500 });
          }

          // Record subscription change
          await supabase.from('subscription_changes').insert({
            user_id: targetUserId,
            subscription_id: updatedSubscription.id,
            admin_user_id: user.id,
            change_type: 'reactivated',
            change_reason: 'admin_override',
            to_status: 'active',
            effective_date: new Date().toISOString()
          });

          // Log admin action
          await supabase.rpc('log_admin_action', {
            p_action: 'reactivate_subscription',
            p_resource_type: 'subscription',
            p_resource_id: updatedSubscription.id,
            p_new_data: { targetUserId }
          });

          return NextResponse.json({ success: true });
        }

        case 'manual_status_change': {
          const { newStatus, notes } = body;
          
          if (!newStatus || !['active', 'paused', 'canceled', 'past_due'].includes(newStatus)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
          }

          const { data: updatedSubscription, error } = await supabase
            .from('user_subscriptions')
            .update({ 
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', targetUserId)
            .select()
            .single();

          if (error) {
            console.error('Error updating subscription status:', error);
            return NextResponse.json({ error: 'Failed to update subscription status' }, { status: 500 });
          }

          // Record subscription change
          await supabase.from('subscription_changes').insert({
            user_id: targetUserId,
            subscription_id: updatedSubscription.id,
            admin_user_id: user.id,
            change_type: 'plan_changed',
            change_reason: 'admin_override',
            to_status: newStatus,
            effective_date: new Date().toISOString(),
            notes: notes || `Manual status change to ${newStatus}`
          });

          // Log admin action
          await supabase.rpc('log_admin_action', {
            p_action: 'manual_status_change',
            p_resource_type: 'subscription',
            p_resource_id: updatedSubscription.id,
            p_new_data: { targetUserId, newStatus, notes }
          });

          return NextResponse.json({ success: true });
        }
      }
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