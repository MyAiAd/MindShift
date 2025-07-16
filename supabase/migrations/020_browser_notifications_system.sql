-- =============================================
-- Browser Notifications System
-- =============================================

-- Push Subscriptions Table
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique subscription per user/tenant/endpoint
    UNIQUE(tenant_id, user_id, endpoint)
);

-- Notification Preferences Table
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
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
    
    -- Progress & goals (non-therapy)
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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one preference per user/tenant
    UNIQUE(tenant_id, user_id)
);

-- Notification History Table (for tracking and analytics)
CREATE TABLE notification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Notification details
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    
    -- Delivery details
    delivery_method TEXT NOT NULL CHECK (delivery_method IN ('push', 'email', 'sms')),
    delivery_status TEXT NOT NULL CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'clicked')),
    
    -- Context
    related_entity_type TEXT, -- 'post', 'comment', 'message', 'event', etc.
    related_entity_id UUID,
    
    -- Push specific fields
    push_subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,
    
    -- Timestamps
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VAPID Keys Table (for push service authentication)
CREATE TABLE vapid_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- VAPID key details
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,
    subject TEXT NOT NULL, -- Usually email or URL
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one active key per tenant
    UNIQUE(tenant_id, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- =============================================
-- Indexes for Performance
-- =============================================

-- Push subscriptions indexes
CREATE INDEX idx_push_subscriptions_tenant_user ON push_subscriptions(tenant_id, user_id);
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_push_subscriptions_last_used ON push_subscriptions(last_used_at);

-- Notification preferences indexes
CREATE INDEX idx_notification_preferences_tenant_user ON notification_preferences(tenant_id, user_id);
CREATE INDEX idx_notification_preferences_browser_enabled ON notification_preferences(tenant_id, browser_notifications_enabled) WHERE browser_notifications_enabled = true;

-- Notification history indexes
CREATE INDEX idx_notification_history_tenant_user ON notification_history(tenant_id, user_id);
CREATE INDEX idx_notification_history_type ON notification_history(notification_type);
CREATE INDEX idx_notification_history_delivery_method ON notification_history(delivery_method);
CREATE INDEX idx_notification_history_status ON notification_history(delivery_status);
CREATE INDEX idx_notification_history_scheduled ON notification_history(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_notification_history_created_at ON notification_history(created_at);

-- VAPID keys indexes
CREATE INDEX idx_vapid_keys_tenant_active ON vapid_keys(tenant_id, is_active) WHERE is_active = true;

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vapid_keys ENABLE ROW LEVEL SECURITY;

-- Push subscriptions policies
CREATE POLICY "Users can manage their own push subscriptions"
    ON push_subscriptions
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND
        user_id = auth.uid()
    );

CREATE POLICY "Super admins can manage all push subscriptions"
    ON push_subscriptions
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ));

-- Notification preferences policies
CREATE POLICY "Users can manage their own notification preferences"
    ON notification_preferences
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND
        user_id = auth.uid()
    );

CREATE POLICY "Super admins can manage all notification preferences"
    ON notification_preferences
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ));

-- Notification history policies
CREATE POLICY "Users can view their own notification history"
    ON notification_history
    FOR SELECT
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND
        user_id = auth.uid()
    );

CREATE POLICY "System can insert notification history"
    ON notification_history
    FOR INSERT
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Super admins can manage all notification history"
    ON notification_history
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ));

-- VAPID keys policies (restricted to super admins and system)
CREATE POLICY "Super admins can manage VAPID keys"
    ON vapid_keys
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ));

-- =============================================
-- Utility Functions
-- =============================================

-- Function to get user's notification preferences
CREATE OR REPLACE FUNCTION get_user_notification_preferences(p_user_id UUID)
RETURNS notification_preferences AS $$
DECLARE
    v_tenant_id UUID;
    v_preferences notification_preferences;
BEGIN
    -- Get user's tenant
    SELECT tenant_id INTO v_tenant_id
    FROM profiles
    WHERE id = p_user_id;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'User not found or not in a tenant';
    END IF;
    
    -- Get preferences, create default if not exists
    SELECT * INTO v_preferences
    FROM notification_preferences
    WHERE tenant_id = v_tenant_id AND user_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO notification_preferences (tenant_id, user_id)
        VALUES (v_tenant_id, p_user_id)
        RETURNING * INTO v_preferences;
    END IF;
    
    RETURN v_preferences;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can receive notifications
CREATE OR REPLACE FUNCTION can_user_receive_notifications(
    p_user_id UUID,
    p_notification_type TEXT,
    p_delivery_method TEXT DEFAULT 'push'
) RETURNS BOOLEAN AS $$
DECLARE
    v_prefs notification_preferences;
    v_current_time TIME;
    v_daily_count INTEGER;
BEGIN
    -- Get user preferences
    SELECT * INTO v_prefs
    FROM get_user_notification_preferences(p_user_id);
    
    -- Check master toggle for delivery method
    IF p_delivery_method = 'push' AND NOT v_prefs.browser_notifications_enabled THEN
        RETURN false;
    END IF;
    
    IF p_delivery_method = 'email' AND NOT v_prefs.email_notifications_enabled THEN
        RETURN false;
    END IF;
    
    IF p_delivery_method = 'sms' AND NOT v_prefs.sms_notifications_enabled THEN
        RETURN false;
    END IF;
    
    -- Check specific notification type
    IF p_notification_type = 'new_messages' AND NOT v_prefs.new_messages THEN
        RETURN false;
    END IF;
    
    IF p_notification_type = 'community_posts' AND NOT v_prefs.community_posts THEN
        RETURN false;
    END IF;
    
    IF p_notification_type = 'community_comments' AND NOT v_prefs.community_comments THEN
        RETURN false;
    END IF;
    
    IF p_notification_type = 'community_likes' AND NOT v_prefs.community_likes THEN
        RETURN false;
    END IF;
    
    IF p_notification_type = 'community_events' AND NOT v_prefs.community_events THEN
        RETURN false;
    END IF;
    
    -- Check quiet hours
    IF v_prefs.quiet_hours_enabled THEN
        v_current_time := (NOW() AT TIME ZONE v_prefs.quiet_hours_timezone)::TIME;
        
        IF v_prefs.quiet_hours_start < v_prefs.quiet_hours_end THEN
            -- Same day quiet hours (e.g., 22:00 to 08:00 next day)
            IF v_current_time >= v_prefs.quiet_hours_start AND v_current_time < v_prefs.quiet_hours_end THEN
                RETURN false;
            END IF;
        ELSE
            -- Cross-midnight quiet hours (e.g., 22:00 to 08:00)
            IF v_current_time >= v_prefs.quiet_hours_start OR v_current_time < v_prefs.quiet_hours_end THEN
                RETURN false;
            END IF;
        END IF;
    END IF;
    
    -- Check daily limit
    SELECT COUNT(*) INTO v_daily_count
    FROM notification_history
    WHERE user_id = p_user_id
    AND delivery_method = p_delivery_method
    AND DATE(created_at) = CURRENT_DATE;
    
    IF v_daily_count >= v_prefs.max_daily_notifications THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record notification history
CREATE OR REPLACE FUNCTION record_notification(
    p_user_id UUID,
    p_notification_type TEXT,
    p_title TEXT,
    p_body TEXT,
    p_delivery_method TEXT,
    p_delivery_status TEXT DEFAULT 'pending',
    p_related_entity_type TEXT DEFAULT NULL,
    p_related_entity_id UUID DEFAULT NULL,
    p_push_subscription_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_notification_id UUID;
BEGIN
    -- Get user's tenant
    SELECT tenant_id INTO v_tenant_id
    FROM profiles
    WHERE id = p_user_id;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'User not found or not in a tenant';
    END IF;
    
    -- Insert notification record
    INSERT INTO notification_history (
        tenant_id, user_id, notification_type, title, body,
        delivery_method, delivery_status, related_entity_type,
        related_entity_id, push_subscription_id
    ) VALUES (
        v_tenant_id, p_user_id, p_notification_type, p_title, p_body,
        p_delivery_method, p_delivery_status, p_related_entity_type,
        p_related_entity_id, p_push_subscription_id
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Triggers for Updated At
-- =============================================

-- Update updated_at trigger for push_subscriptions
CREATE OR REPLACE FUNCTION update_push_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_push_subscriptions_updated_at
    BEFORE UPDATE ON push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_push_subscriptions_updated_at();

-- Update updated_at trigger for notification_preferences
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Update updated_at trigger for notification_history
CREATE OR REPLACE FUNCTION update_notification_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_history_updated_at
    BEFORE UPDATE ON notification_history
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_history_updated_at();

-- =============================================
-- Initial Data
-- =============================================

-- Create default notification preferences for existing users
INSERT INTO notification_preferences (tenant_id, user_id)
SELECT 
    p.tenant_id,
    p.id
FROM profiles p
WHERE p.tenant_id IS NOT NULL 
AND NOT EXISTS (
    SELECT 1 FROM notification_preferences np
    WHERE np.tenant_id = p.tenant_id AND np.user_id = p.id
)
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vapid_keys TO authenticated;

-- Grant permissions on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated; 