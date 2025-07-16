import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Debug cookie information
    console.log('Request cookies:', request.cookies.toString());
    
    // Add a small delay to allow session to establish properly
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('Auth check result:', {
      hasUser: !!user,
      hasAuthError: !!authError,
      userId: user?.id,
      userEmail: user?.email,
      authErrorMessage: authError?.message
    });
    
    if (authError || !user) {
      console.log('Authentication failed:', authError?.message || 'No user found');
      
      // For specific auth timing issues, return a more specific error
      if (authError?.message?.includes('session_not_found') || authError?.message?.includes('refresh_token')) {
        return NextResponse.json({ 
          error: 'Session establishing', 
          code: 'SESSION_ESTABLISHING' 
        }, { status: 202 }); // 202 Accepted - retry later
      }
      
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('Fetching preferences for user:', user.id);

    // Try to get user's notification preferences using the database function
    let preferences = null;
    let error = null;
    
    try {
      const result = await supabase
        .rpc('get_user_notification_preferences', { p_user_id: user.id });
      preferences = result.data;
      error = result.error;
      
      if (error) {
        console.error('Database function error:', error);
      }
    } catch (funcError) {
      console.error('Database function failed:', funcError);
      error = funcError;
    }

    // If the function fails, try direct table query as fallback
    if (error || !preferences) {
      console.log('Fallback: querying notification_preferences table directly');
      
      // Get user's tenant ID first
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Profile error:', profileError);
        return NextResponse.json({ 
          error: 'User profile not found',
          details: profileError?.message 
        }, { status: 404 });
      }

      // Handle super_admin users who may not have tenant_id
      let effectiveTenantId = profile?.tenant_id;
      
      if (!effectiveTenantId && profile?.role === 'super_admin') {
        console.log('Super admin user without tenant_id, using default tenant logic');
        
        // Try to get the first available tenant for super admin
        const { data: firstTenant } = await supabase
          .from('tenants')
          .select('id')
          .limit(1)
          .single();
        
        if (firstTenant) {
          effectiveTenantId = firstTenant.id;
          console.log('Using first available tenant for super admin:', effectiveTenantId);
        } else {
          // If no tenants exist, create notification preferences without tenant restriction
          console.log('No tenants exist, using super admin preferences without tenant');
          effectiveTenantId = null; // Will be handled specially below
        }
      }

      if (!effectiveTenantId && profile?.role !== 'super_admin') {
        return NextResponse.json({ 
          error: 'User not associated with a tenant',
          details: 'User profile missing tenant_id and is not super_admin' 
        }, { status: 400 });
      }

      // Try to get existing preferences
      let prefsQuery = supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id);
      
      // Add tenant filter only if we have an effective tenant ID
      if (effectiveTenantId) {
        prefsQuery = prefsQuery.eq('tenant_id', effectiveTenantId);
      }
      
      const { data: existingPrefs, error: prefsError } = await prefsQuery.maybeSingle();

      if (prefsError) {
        console.error('Error fetching preferences:', prefsError);
        return NextResponse.json({ 
          error: 'Failed to fetch preferences',
          details: prefsError.message 
        }, { status: 500 });
      }

      if (existingPrefs) {
        preferences = existingPrefs;
        console.log('Found existing preferences for super admin');
      } else {
        console.log('Creating default preferences for super admin');
        // Create default preferences
        const defaultPrefs: any = {
          user_id: user.id,
          browser_notifications_enabled: false,
          email_notifications_enabled: true,
          sms_notifications_enabled: false,
          new_messages: true,
          community_posts: true,
          community_comments: true,
          community_likes: false,
          community_events: true,
          progress_milestones: true,
          weekly_reports: true,
          goal_reminders: true,
          security_alerts: true,
          account_updates: true,
          quiet_hours_enabled: false,
          quiet_hours_start: '22:00:00',
          quiet_hours_end: '08:00:00',
          quiet_hours_timezone: 'UTC',
          max_daily_notifications: 10
        };

        // Add tenant_id only if we have one
        if (effectiveTenantId) {
          defaultPrefs.tenant_id = effectiveTenantId;
        }

        const { data: newPrefs, error: createError } = await supabase
          .from('notification_preferences')
          .insert(defaultPrefs)
          .select()
          .single();

        if (!createError && newPrefs) {
          preferences = newPrefs;
          console.log('Successfully created default preferences for super admin');
        } else {
          console.error('Failed to create default preferences:', createError);
          preferences = defaultPrefs; // Return defaults even if save failed
        }
      }
    }

    if (!preferences) {
      console.error('Failed to get or create notification preferences');
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    console.log('Returning preferences:', preferences);
    return NextResponse.json({ preferences });
  } catch (error: any) {
    console.error('Error in GET /api/notifications/preferences:', error);
    
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

export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    console.log('PUT request body:', body);
    
    // Validate the request body
    const validFields = [
      'browser_notifications_enabled',
      'email_notifications_enabled', 
      'sms_notifications_enabled',
      'new_messages',
      'community_posts',
      'community_comments',
      'community_likes',
      'community_events',
      'progress_milestones',
      'weekly_reports',
      'goal_reminders',
      'security_alerts',
      'account_updates',
      'quiet_hours_enabled',
      'quiet_hours_start',
      'quiet_hours_end',
      'quiet_hours_timezone',
      'max_daily_notifications'
    ];

    // Get user's tenant ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error in PUT:', profileError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    console.log('User profile in PUT:', profile);

    // Handle super_admin users who may not have tenant_id
    let effectiveTenantId = profile?.tenant_id;
    
    if (!effectiveTenantId && profile?.role === 'super_admin') {
      console.log('Super admin user updating preferences without tenant_id');
      
      // For super admin, we need to ensure they have a tenant_id due to NOT NULL constraint
      // Try to get or create a default tenant for super admin
      const { data: firstTenant } = await supabase
        .from('tenants')
        .select('id')
        .limit(1)
        .single();
      
      if (firstTenant) {
        effectiveTenantId = firstTenant.id;
        console.log('Using first available tenant for super admin:', effectiveTenantId);
      } else {
        // Create a default tenant for super admin if none exists
        console.log('No tenants exist, creating default tenant for super admin');
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
          console.log('Created default tenant for super admin:', effectiveTenantId);
        } else {
          console.error('Failed to create default tenant:', tenantError);
          return NextResponse.json({ 
            error: 'Failed to setup super admin tenant',
            details: tenantError?.message 
          }, { status: 500 });
        }
      }
    }

    if (!effectiveTenantId && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'User not associated with a tenant' }, { status: 400 });
    }

    if (!effectiveTenantId) {
      return NextResponse.json({ error: 'Could not determine effective tenant for user' }, { status: 400 });
    }

    // Filter and prepare update data
    const updateData: any = {
      user_id: user.id,
      tenant_id: effectiveTenantId // Always include tenant_id due to NOT NULL constraint
    };

    // Add only the fields that are being updated
    for (const [key, value] of Object.entries(body)) {
      if (validFields.includes(key)) {
        updateData[key] = value;
      }
    }

    console.log('Update data prepared:', updateData);

    // Use upsert to update or create preferences
    const { data: preferences, error: updateError } = await supabase
      .from('notification_preferences')
      .upsert(updateData, {
        onConflict: 'tenant_id, user_id'
      })
      .select()
      .single();

    if (updateError) {
      console.error('Error updating notification preferences:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update preferences',
        details: updateError.message 
      }, { status: 500 });
    }

    console.log('Successfully updated preferences:', preferences);

    return NextResponse.json({ 
      message: 'Preferences updated successfully',
      preferences 
    });
  } catch (error: any) {
    console.error('Error in PUT /api/notifications/preferences:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
} 