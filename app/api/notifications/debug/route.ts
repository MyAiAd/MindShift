import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const diagnostics: any = {
      user_id: user.id,
      user_email: user.email,
      timestamp: new Date().toISOString()
    };

    // 1. Check if user profile exists and has tenant_id
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, tenant_id, role, email, first_name, last_name')
        .eq('id', user.id)
        .single();

      diagnostics.profile_check = {
        exists: !!profile,
        has_tenant_id: !!profile?.tenant_id,
        profile_data: profile,
        error: profileError?.message
      };
    } catch (error: any) {
      diagnostics.profile_check = {
        exists: false,
        error: error.message
      };
    }

    // 2. Check if notification_preferences table exists
    try {
      // Try direct access instead of information_schema
      const { data: testPrefs, error: tableError } = await supabase
        .from('notification_preferences')
        .select('id')
        .limit(1);

      diagnostics.notification_preferences_table = {
        exists: !tableError || !tableError.message?.includes('does not exist'),
        can_access: !tableError,
        error: tableError?.message
      };
    } catch (error: any) {
      diagnostics.notification_preferences_table = {
        exists: false,
        can_access: false,
        error: error.message
      };
    }

    // 3. Check if push_subscriptions table exists
    try {
      // Try direct access instead of information_schema
      const { data: testSubs, error: tableError } = await supabase
        .from('push_subscriptions')
        .select('id')
        .limit(1);

      diagnostics.push_subscriptions_table = {
        exists: !tableError || !tableError.message?.includes('does not exist'),
        can_access: !tableError,
        error: tableError?.message
      };
    } catch (error: any) {
      diagnostics.push_subscriptions_table = {
        exists: false,
        can_access: false,
        error: error.message
      };
    }

    // 4. Check if database function exists by trying to call it
    try {
      const { data: funcResult, error: funcError } = await supabase
        .rpc('get_user_notification_preferences', { p_user_id: user.id });

      diagnostics.database_function = {
        exists: !funcError || !funcError.message?.includes('does not exist'),
        can_execute: !funcError,
        result_exists: !!funcResult,
        error: funcError?.message
      };
    } catch (error: any) {
      diagnostics.database_function = {
        exists: false,
        can_execute: false,
        error: error.message
      };
    }

    // 5. Try to access notification_preferences table directly
    if (diagnostics.profile_check.has_tenant_id && diagnostics.notification_preferences_table.exists) {
      try {
        const { data: prefs, error: prefsError } = await supabase
          .from('notification_preferences')
          .select('id, tenant_id, user_id, email_notifications_enabled')
          .eq('user_id', user.id)
          .eq('tenant_id', diagnostics.profile_check.profile_data.tenant_id)
          .single();

        diagnostics.notification_preferences_access = {
          can_read: !!prefs,
          preferences_exist: !!prefs,
          error: prefsError?.message
        };
      } catch (error: any) {
        diagnostics.notification_preferences_access = {
          can_read: false,
          error: error.message
        };
      }
    } else if (!diagnostics.profile_check.has_tenant_id && diagnostics.profile_check.profile_data?.role === 'super_admin' && diagnostics.notification_preferences_table.exists) {
      // Test super admin access without tenant_id
      try {
        const { data: prefs, error: prefsError } = await supabase
          .from('notification_preferences')
          .select('id, user_id, email_notifications_enabled')
          .eq('user_id', user.id)
          .single();

        diagnostics.notification_preferences_access = {
          can_read: !!prefs,
          preferences_exist: !!prefs,
          super_admin_access: true,
          error: prefsError?.message
        };
      } catch (error: any) {
        diagnostics.notification_preferences_access = {
          can_read: false,
          super_admin_access: true,
          error: error.message
        };
      }
    }

    // 6. Try to access push_subscriptions table directly  
    if (diagnostics.profile_check.has_tenant_id && diagnostics.push_subscriptions_table.exists) {
      try {
        const { data: subs, error: subsError } = await supabase
          .from('push_subscriptions')
          .select('id, tenant_id, user_id, is_active')
          .eq('user_id', user.id)
          .eq('tenant_id', diagnostics.profile_check.profile_data.tenant_id);

        diagnostics.push_subscriptions_access = {
          can_read: !subsError,
          subscriptions_count: subs?.length || 0,
          error: subsError?.message
        };
      } catch (error: any) {
        diagnostics.push_subscriptions_access = {
          can_read: false,
          error: error.message
        };
      }
    } else if (!diagnostics.profile_check.has_tenant_id && diagnostics.profile_check.profile_data?.role === 'super_admin' && diagnostics.push_subscriptions_table.exists) {
      // Test super admin access without tenant_id
      try {
        const { data: subs, error: subsError } = await supabase
          .from('push_subscriptions')
          .select('id, user_id, is_active')
          .eq('user_id', user.id);

        diagnostics.push_subscriptions_access = {
          can_read: !subsError,
          subscriptions_count: subs?.length || 0,
          super_admin_access: true,
          error: subsError?.message
        };
      } catch (error: any) {
        diagnostics.push_subscriptions_access = {
          can_read: false,
          super_admin_access: true,
          error: error.message
        };
      }
    }

    return NextResponse.json({ 
      status: 'success',
      diagnostics 
    });

  } catch (error: any) {
    return NextResponse.json({ 
      status: 'error',
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 