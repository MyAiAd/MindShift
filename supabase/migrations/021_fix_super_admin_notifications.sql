-- Fix notification system for super admin users without tenant_id
-- Super admins should be able to receive notifications even without a tenant

-- Update get_user_notification_preferences to handle super admin users
CREATE OR REPLACE FUNCTION get_user_notification_preferences(p_user_id UUID)
RETURNS notification_preferences AS $$
DECLARE
    v_tenant_id UUID;
    v_user_role user_role;
    v_preferences notification_preferences;
BEGIN
    -- Get user's tenant and role
    SELECT tenant_id, role INTO v_tenant_id, v_user_role
    FROM profiles
    WHERE id = p_user_id;
    
    -- Check if user exists
    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- For super admin users, tenant_id can be NULL
    IF v_tenant_id IS NULL AND v_user_role != 'super_admin' THEN
        RAISE EXCEPTION 'User not found or not in a tenant';
    END IF;
    
    -- Get preferences, create default if not exists
    -- For super admin, use NULL tenant_id
    SELECT * INTO v_preferences
    FROM notification_preferences
    WHERE (v_tenant_id IS NULL OR tenant_id = v_tenant_id) AND user_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO notification_preferences (tenant_id, user_id)
        VALUES (v_tenant_id, p_user_id)
        RETURNING * INTO v_preferences;
    END IF;
    
    RETURN v_preferences;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update can_user_receive_notifications to handle super admin users
CREATE OR REPLACE FUNCTION can_user_receive_notifications(
    p_user_id UUID,
    p_notification_type TEXT,
    p_delivery_method TEXT DEFAULT 'push'
) RETURNS BOOLEAN AS $$
DECLARE
    v_prefs notification_preferences;
    v_user_role user_role;
    v_current_time TIME;
    v_daily_count INTEGER;
BEGIN
    -- Check if user is super admin first
    SELECT role INTO v_user_role
    FROM profiles
    WHERE id = p_user_id;
    
    -- Super admins can always receive test notifications
    IF v_user_role = 'super_admin' AND p_notification_type = 'test' THEN
        RETURN true;
    END IF;
    
    -- Get user preferences (now handles super admin)
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
            -- Overnight quiet hours (e.g., 22:00 to 08:00 next day)
            IF v_current_time >= v_prefs.quiet_hours_start OR v_current_time < v_prefs.quiet_hours_end THEN
                RETURN false;
            END IF;
        END IF;
    END IF;
    
    -- Check daily frequency limits
    IF v_prefs.daily_frequency_limit > 0 THEN
        SELECT COUNT(*) INTO v_daily_count
        FROM notification_history
        WHERE user_id = p_user_id 
        AND delivery_method = p_delivery_method
        AND DATE(created_at) = CURRENT_DATE;
        
        IF v_daily_count >= v_prefs.daily_frequency_limit THEN
            RETURN false;
        END IF;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update record_notification function to handle super admin users
CREATE OR REPLACE FUNCTION record_notification(
    p_user_id UUID,
    p_notification_type TEXT,
    p_title TEXT,
    p_body TEXT,
    p_delivery_method TEXT DEFAULT 'push',
    p_delivery_status TEXT DEFAULT 'pending',
    p_related_entity_type TEXT DEFAULT NULL,
    p_related_entity_id TEXT DEFAULT NULL,
    p_push_subscription_id UUID DEFAULT NULL,
    p_scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_user_role user_role;
    v_notification_id UUID;
BEGIN
    -- Get user's tenant and role
    SELECT tenant_id, role INTO v_tenant_id, v_user_role
    FROM profiles
    WHERE id = p_user_id;
    
    -- For super admin users, tenant_id can be NULL
    IF v_tenant_id IS NULL AND v_user_role != 'super_admin' THEN
        RAISE EXCEPTION 'User not found or not in a tenant';
    END IF;
    
    INSERT INTO notification_history (
        tenant_id,
        user_id,
        notification_type,
        title,
        body,
        delivery_method,
        delivery_status,
        related_entity_type,
        related_entity_id,
        push_subscription_id,
        scheduled_for
    ) VALUES (
        v_tenant_id,
        p_user_id,
        p_notification_type,
        p_title,
        p_body,
        p_delivery_method,
        p_delivery_status,
        p_related_entity_type,
        p_related_entity_id,
        p_push_subscription_id,
        p_scheduled_for
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow super admin users to have push subscriptions without tenant_id
-- Update the push_subscriptions table constraint if needed
-- (Note: The table might already allow NULL tenant_id, this is just for safety)
ALTER TABLE push_subscriptions ALTER COLUMN tenant_id DROP NOT NULL;

-- Ensure notification_preferences table allows NULL tenant_id for super admin
ALTER TABLE notification_preferences ALTER COLUMN tenant_id DROP NOT NULL;

-- Update RLS policies to handle super admin users with NULL tenant_id
DROP POLICY IF EXISTS "Users can manage their push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can manage their push subscriptions" ON push_subscriptions
    FOR ALL USING (
        user_id = auth.uid() OR
        (tenant_id IS NOT NULL AND tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
        )) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

DROP POLICY IF EXISTS "Users can manage their notification preferences" ON notification_preferences;
CREATE POLICY "Users can manage their notification preferences" ON notification_preferences
    FOR ALL USING (
        user_id = auth.uid() OR
        (tenant_id IS NOT NULL AND tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
        )) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

DROP POLICY IF EXISTS "Users can view their notification history" ON notification_history;
CREATE POLICY "Users can view their notification history" ON notification_history
    FOR SELECT USING (
        user_id = auth.uid() OR
        (tenant_id IS NOT NULL AND tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
        )) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

DROP POLICY IF EXISTS "System can record notifications" ON notification_history;
CREATE POLICY "System can record notifications" ON notification_history
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR
        (tenant_id IS NOT NULL AND tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
        )) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    ); 