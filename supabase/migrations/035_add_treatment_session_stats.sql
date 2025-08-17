-- Update session stats function to include treatment sessions
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
    available_slots INTEGER,
    treatment_sessions INTEGER,
    active_treatment_sessions INTEGER,
    completed_treatment_sessions INTEGER,
    total_treatment_hours_this_month DECIMAL
) AS $$
DECLARE
    v_current_month_start DATE := DATE_TRUNC('month', CURRENT_DATE);
    v_user_profile RECORD;
    v_coaching_stats RECORD;
    v_treatment_stats RECORD;
BEGIN
    -- Get user profile info
    IF p_user_id IS NOT NULL THEN
        SELECT * INTO v_user_profile FROM profiles WHERE id = p_user_id;
    END IF;

    -- Get coaching session stats
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
    INTO v_coaching_stats
    FROM coaching_sessions
    WHERE 
        (p_user_id IS NULL OR 
         coach_id = p_user_id OR 
         client_id = p_user_id OR
         (v_user_profile.role IN ('manager', 'tenant_admin', 'super_admin') AND 
          (p_tenant_id IS NULL OR tenant_id = p_tenant_id)))
        AND created_at >= NOW() - INTERVAL '1 day' * p_days;

    -- Get treatment session stats
    SELECT 
        COUNT(*)::INTEGER as treatment_sessions,
        COUNT(CASE WHEN status = 'active' THEN 1 END)::INTEGER as active_treatment_sessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::INTEGER as completed_treatment_sessions,
        COALESCE(SUM(
            CASE 
                WHEN status = 'completed' 
                AND created_at >= v_current_month_start 
                THEN duration_minutes::DECIMAL / 60 
                ELSE 0 
            END
        ), 0) as total_treatment_hours_this_month
    INTO v_treatment_stats
    FROM treatment_sessions
    WHERE 
        (p_user_id IS NULL OR 
         user_id = p_user_id OR
         (v_user_profile.role IN ('manager', 'tenant_admin', 'super_admin') AND 
          (p_tenant_id IS NULL OR tenant_id = p_tenant_id)))
        AND created_at >= NOW() - INTERVAL '1 day' * p_days;

    -- Return combined stats
    RETURN QUERY
    SELECT 
        COALESCE(v_coaching_stats.total_sessions, 0) as total_sessions,
        COALESCE(v_coaching_stats.upcoming_sessions, 0) as upcoming_sessions,
        COALESCE(v_coaching_stats.completed_sessions, 0) as completed_sessions,
        COALESCE(v_coaching_stats.cancelled_sessions, 0) as cancelled_sessions,
        COALESCE(v_coaching_stats.total_hours_this_month, 0) as total_hours_this_month,
        COALESCE(v_coaching_stats.available_slots, 0) as available_slots,
        COALESCE(v_treatment_stats.treatment_sessions, 0) as treatment_sessions,
        COALESCE(v_treatment_stats.active_treatment_sessions, 0) as active_treatment_sessions,
        COALESCE(v_treatment_stats.completed_treatment_sessions, 0) as completed_treatment_sessions,
        COALESCE(v_treatment_stats.total_treatment_hours_this_month, 0) as total_treatment_hours_this_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on the function
GRANT EXECUTE ON FUNCTION get_session_stats TO authenticated; 