import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/notifications/subscriptions - Get user's push subscriptions
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user's push subscriptions
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching push subscriptions:', error);
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    return NextResponse.json({ subscriptions });
  } catch (error) {
    console.error('Error in GET /api/notifications/subscriptions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/notifications/subscriptions - Subscribe to push notifications
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { subscription, userAgent } = body;

    // Validate subscription object
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ 
        error: 'Invalid subscription object' 
      }, { status: 400 });
    }

    if (!subscription.keys.p256dh || !subscription.keys.auth) {
      return NextResponse.json({ 
        error: 'Missing encryption keys' 
      }, { status: 400 });
    }

    // Get user's tenant ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile error:', profileError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Handle super_admin users who may not have tenant_id
    let effectiveTenantId = profile?.tenant_id;
    
    if (!effectiveTenantId && profile?.role === 'super_admin') {
      console.log('Super admin user subscribing to push without tenant_id');
      
      // For super admin, we need to ensure they have a tenant_id due to NOT NULL constraint
      // Try to get or create a default tenant for super admin
      const { data: firstTenant } = await supabase
        .from('tenants')
        .select('id')
        .limit(1)
        .single();
      
      if (firstTenant) {
        effectiveTenantId = firstTenant.id;
        console.log('Using first available tenant for super admin push subscription:', effectiveTenantId);
      } else {
        // Create a default tenant for super admin if none exists
        console.log('No tenants exist, creating default tenant for super admin push');
        const { data: newTenant, error: tenantError } = await supabase
          .from('tenants')
          .insert({
            name: 'Super Admin Default',
            slug: 'super-admin-default',
            status: 'active'
          })
          .select()
          .single();
        
        if (!tenantError && newTenant) {
          effectiveTenantId = newTenant.id;
          console.log('Created default tenant for super admin push:', effectiveTenantId);
        } else {
          console.error('Failed to create default tenant for push:', tenantError);
          return NextResponse.json({ 
            error: 'Failed to setup super admin tenant for push notifications',
            details: tenantError?.message 
          }, { status: 500 });
        }
      }
    }

    if (!effectiveTenantId && profile?.role !== 'super_admin') {
      console.error('User missing tenant_id:', user.id);
      return NextResponse.json({ error: 'User not associated with a tenant' }, { status: 400 });
    }

    if (!effectiveTenantId) {
      console.error('Could not determine effective tenant for push subscription:', user.id);
      return NextResponse.json({ error: 'Could not determine effective tenant for user' }, { status: 400 });
    }

    // Parse user agent for device info
    const deviceType = userAgent?.includes('Mobile') ? 'mobile' : 
                      userAgent?.includes('Tablet') ? 'tablet' : 'desktop';
    
    const browserName = userAgent?.includes('Chrome') ? 'Chrome' :
                       userAgent?.includes('Firefox') ? 'Firefox' :
                       userAgent?.includes('Safari') ? 'Safari' :
                       userAgent?.includes('Edge') ? 'Edge' : 'Unknown';

    // Insert or update push subscription
    const subscriptionData: any = {
      user_id: user.id,
      tenant_id: effectiveTenantId, // Always include tenant_id due to NOT NULL constraint
      endpoint: subscription.endpoint,
      p256dh_key: subscription.keys.p256dh,
      auth_key: subscription.keys.auth,
      user_agent: userAgent,
      device_type: deviceType,
      browser_name: browserName,
      is_active: true,
      last_used_at: new Date().toISOString()
    };

    console.log('Creating push subscription with data:', subscriptionData);

    const { data: pushSubscription, error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'tenant_id, user_id, endpoint'
      })
      .select()
      .single();

    if (subscriptionError) {
      console.error('Error saving push subscription:', subscriptionError);
      
      // Check if it's a table doesn't exist error
      if (subscriptionError.message?.includes('relation') && subscriptionError.message?.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'Notification system not yet initialized. Database migration required.',
          code: 'MIGRATION_REQUIRED',
          details: 'The push_subscriptions table does not exist. Please run migration 020_browser_notifications_system.sql'
        }, { status: 503 }); // Service Unavailable
      }
      
      return NextResponse.json({ 
        error: 'Failed to save subscription',
        details: subscriptionError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Push subscription saved successfully',
      subscription: pushSubscription 
    });
  } catch (error: any) {
    console.error('Error in POST /api/notifications/subscriptions:', error);
    
    // Check if it's a table doesn't exist error
    if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      return NextResponse.json({ 
        error: 'Notification system not yet initialized. Database migration required.',
        code: 'MIGRATION_REQUIRED',
        details: 'Database tables are missing. Please run migration 020_browser_notifications_system.sql'
      }, { status: 503 }); // Service Unavailable
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}

// DELETE /api/notifications/subscriptions - Unsubscribe from push notifications
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
    }

    // Deactivate the subscription
    const { data: subscription, error } = await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)
      .select()
      .single();

    if (error) {
      console.error('Error deactivating push subscription:', error);
      return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
    }

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'Successfully unsubscribed from push notifications' 
    });
  } catch (error) {
    console.error('Error in DELETE /api/notifications/subscriptions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 