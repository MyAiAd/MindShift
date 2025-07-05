-- Add meeting fields to coaching_sessions table
ALTER TABLE coaching_sessions 
ADD COLUMN IF NOT EXISTS meeting_link TEXT,
ADD COLUMN IF NOT EXISTS meeting_type VARCHAR(50) DEFAULT 'video' CHECK (meeting_type IN ('video', 'phone', 'in_person', 'zoom', 'google_meet', 'teams'));

-- Add index for meeting type for better query performance
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_meeting_type ON coaching_sessions(meeting_type);

-- Add index for scheduled_at for better query performance on upcoming sessions
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_scheduled_at ON coaching_sessions(scheduled_at);

-- Update the RLS policies to ensure proper meeting link access
-- (The existing policies should already handle this, but making sure)

-- Add a function to get session statistics for dashboard
CREATE OR REPLACE FUNCTION get_session_stats(
    p_user_id UUID DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_sessions INTEGER,
    upcoming_sessions INTEGER,
    completed_sessions INTEGER,
    cancelled_sessions INTEGER,
    total_hours_this_month DECIMAL,
    available_slots INTEGER
) AS $$
DECLARE
    v_current_month_start DATE := DATE_TRUNC('month', CURRENT_DATE);
    v_user_profile RECORD;
BEGIN
    -- Get user profile info
    IF p_user_id IS NOT NULL THEN
        SELECT * INTO v_user_profile FROM profiles WHERE id = p_user_id;
    END IF;

    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_sessions,
        COUNT(CASE WHEN status = 'scheduled' AND scheduled_at > NOW() THEN 1 END)::INTEGER as upcoming_sessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::INTEGER as completed_sessions,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::INTEGER as cancelled_sessions,
        COALESCE(SUM(
            CASE 
                WHEN status = 'completed' 
                AND scheduled_at >= v_current_month_start 
                THEN duration_minutes::DECIMAL / 60 
                ELSE 0 
            END
        ), 0) as total_hours_this_month,
        -- Available slots calculation (simplified - could be more sophisticated)
        CASE 
            WHEN v_user_profile.role IN ('coach', 'manager', 'tenant_admin') 
            THEN 20 - COUNT(CASE WHEN status = 'scheduled' AND scheduled_at > NOW() THEN 1 END)::INTEGER
            ELSE 8 - COUNT(CASE WHEN status = 'scheduled' AND scheduled_at > NOW() AND client_id = p_user_id THEN 1 END)::INTEGER
        END as available_slots
    FROM coaching_sessions
    WHERE 
        (p_user_id IS NULL OR 
         coach_id = p_user_id OR 
         client_id = p_user_id OR
         (v_user_profile.role IN ('manager', 'tenant_admin', 'super_admin') AND 
          (p_tenant_id IS NULL OR tenant_id = p_tenant_id)))
        AND created_at >= NOW() - INTERVAL '1 day' * p_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on the function
GRANT EXECUTE ON FUNCTION get_session_stats TO authenticated; 