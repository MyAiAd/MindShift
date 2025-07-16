import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user is super_admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const results = {
      notification_preferences: { status: 'unknown', error: null as string | null },
      push_subscriptions: { status: 'unknown', error: null as string | null },
      database_functions: { status: 'unknown', error: null as string | null }
    };

    // Test notification_preferences table
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('id')
        .limit(1);
      
      if (error && error.message?.includes('does not exist')) {
        results.notification_preferences.status = 'missing';
        results.notification_preferences.error = error.message;
      } else {
        results.notification_preferences.status = 'exists';
      }
    } catch (error: any) {
      results.notification_preferences.status = 'error';
      results.notification_preferences.error = error.message;
    }

    // Test push_subscriptions table
    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id')
        .limit(1);
      
      if (error && error.message?.includes('does not exist')) {
        results.push_subscriptions.status = 'missing';
        results.push_subscriptions.error = error.message;
      } else {
        results.push_subscriptions.status = 'exists';
      }
    } catch (error: any) {
      results.push_subscriptions.status = 'error';
      results.push_subscriptions.error = error.message;
    }

    // Test database function
    try {
      const { data, error } = await supabase
        .rpc('get_user_notification_preferences', { p_user_id: user.id });
      
      if (error && error.message?.includes('does not exist')) {
        results.database_functions.status = 'missing';
        results.database_functions.error = error.message;
      } else {
        results.database_functions.status = 'exists';
      }
    } catch (error: any) {
      results.database_functions.status = 'error';
      results.database_functions.error = error.message;
    }

    // If tables are missing, try to create them manually
    const { force } = await request.json().catch(() => ({ force: false }));
    
    if (force && (results.notification_preferences.status === 'missing' || results.push_subscriptions.status === 'missing')) {
      try {
        // Execute the notification system migration manually
        const migrationSQL = `
-- Notification Preferences Table (simplified)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Master toggles
    browser_notifications_enabled BOOLEAN DEFAULT false,
    email_notifications_enabled BOOLEAN DEFAULT true,
    sms_notifications_enabled BOOLEAN DEFAULT false,
    
    -- Granular notification types
    new_messages BOOLEAN DEFAULT true,
    community_posts BOOLEAN DEFAULT true,
    community_comments BOOLEAN DEFAULT true,
    community_likes BOOLEAN DEFAULT false,
    community_events BOOLEAN DEFAULT true,
    
    -- Progress & goals
    progress_milestones BOOLEAN DEFAULT true,
    weekly_reports BOOLEAN DEFAULT true,
    goal_reminders BOOLEAN DEFAULT true,
    
    -- System notifications
    security_alerts BOOLEAN DEFAULT true,
    account_updates BOOLEAN DEFAULT true,
    
    -- Quiet hours
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME DEFAULT '22:00:00',
    quiet_hours_end TIME DEFAULT '08:00:00',
    quiet_hours_timezone TEXT DEFAULT 'UTC',
    
    -- Frequency limits
    max_daily_notifications INTEGER DEFAULT 10,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push Subscriptions Table (simplified)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Push subscription details
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    
    -- Device/browser info
    user_agent TEXT,
    device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
    browser_name TEXT,
    
    -- Status tracking
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for super admin
CREATE POLICY IF NOT EXISTS "Super admins can manage all notification preferences" ON notification_preferences
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY IF NOT EXISTS "Super admins can manage all push subscriptions" ON push_subscriptions
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;
        `;

        const { error: migrationError } = await supabase.rpc('exec', { 
          sql: migrationSQL 
        });

        if (migrationError) {
          return NextResponse.json({ 
            error: 'Failed to create tables manually',
            details: migrationError.message,
            results 
          }, { status: 500 });
        }

        results.notification_preferences.status = 'created';
        results.push_subscriptions.status = 'created';
      } catch (error: any) {
        return NextResponse.json({ 
          error: 'Failed to execute manual migration',
          details: error.message,
          results 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      status: 'success',
      message: 'Notification system diagnostics completed',
      results,
      migration_applied: '020_browser_notifications_system',
      suggestion: results.notification_preferences.status === 'missing' || results.push_subscriptions.status === 'missing' 
        ? 'Send POST request with {"force": true} to attempt manual table creation'
        : 'Tables appear to exist - check RLS policies or permissions'
    });

  } catch (error: any) {
    return NextResponse.json({ 
      status: 'error',
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 