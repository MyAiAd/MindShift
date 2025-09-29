-- Fix the get_session_stats function to properly count active and paused sessions
-- This addresses the issue where the function was failing after the previous update

DROP FUNCTION IF EXISTS get_session_stats(UUID, UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_session_stats(
    p_user_id UUID,
    p_tenant_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_sessions BIGINT,
    upcoming_sessions BIGINT,
    completed_sessions BIGINT,
    cancelled_sessions BIGINT,
    total_hours_this_month NUMERIC,
    available_slots BIGINT,
    treatment_sessions BIGINT,
    active_treatment_sessions BIGINT,
    completed_treatment_sessions BIGINT,
    total_treatment_hours_this_month NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_super_admin BOOLEAN;
    stats_cleared_at_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Check if user is super admin and get stats_cleared_at date
    SELECT (role = 'super_admin'), COALESCE(stats_cleared_at, '1970-01-01'::timestamp with time zone)
    INTO is_super_admin, stats_cleared_at_date
    FROM profiles
    WHERE id = p_user_id;

    RETURN QUERY
    WITH coaching_stats AS (
        SELECT 
            COUNT(*) as total_coaching_sessions,
            COUNT(*) FILTER (WHERE status = 'scheduled' AND scheduled_at > NOW()) as upcoming_coaching_sessions,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_coaching_sessions,
            COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_coaching_sessions,
            COALESCE(SUM(duration_minutes) FILTER (WHERE status = 'completed' AND scheduled_at >= date_trunc('month', CURRENT_DATE)), 0) / 60.0 as coaching_hours_this_month
        FROM coaching_sessions cs
        WHERE 
            (scheduled_at >= CURRENT_DATE - INTERVAL '1 day' * p_days)
            AND (scheduled_at >= stats_cleared_at_date) -- Respect stats clearing
            AND (
                is_super_admin 
                OR cs.coach_id = p_user_id 
                OR cs.client_id = p_user_id
                OR (p_tenant_id IS NOT NULL AND cs.tenant_id = p_tenant_id)
            )
    ),
    treatment_stats AS (
        SELECT 
            COUNT(*) as total_treatment_sessions,
            COUNT(*) FILTER (WHERE status IN ('active', 'paused')) as active_treatment_sessions,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_treatment_sessions,
            COALESCE(SUM(duration_minutes) FILTER (WHERE status = 'completed' AND created_at >= date_trunc('month', CURRENT_DATE)), 0) / 60.0 as treatment_hours_this_month
        FROM treatment_sessions ts
        WHERE 
            (created_at >= CURRENT_DATE - INTERVAL '1 day' * p_days)
            AND (created_at >= stats_cleared_at_date) -- Respect stats clearing
            AND (
                is_super_admin 
                OR ts.user_id = p_user_id
                OR (p_tenant_id IS NOT NULL AND ts.tenant_id = p_tenant_id)
            )
    )
    SELECT 
        COALESCE(cs.total_coaching_sessions, 0) as total_sessions,
        COALESCE(cs.upcoming_coaching_sessions, 0) as upcoming_sessions,
        COALESCE(cs.completed_coaching_sessions, 0) as completed_sessions,
        COALESCE(cs.cancelled_coaching_sessions, 0) as cancelled_sessions,
        COALESCE(cs.coaching_hours_this_month, 0) as total_hours_this_month,
        0 as available_slots, -- Placeholder for now
        COALESCE(ts.total_treatment_sessions, 0) as treatment_sessions,
        COALESCE(ts.active_treatment_sessions, 0) as active_treatment_sessions,
        COALESCE(ts.completed_treatment_sessions, 0) as completed_treatment_sessions,
        COALESCE(ts.treatment_hours_this_month, 0) as total_treatment_hours_this_month
    FROM coaching_stats cs
    FULL OUTER JOIN treatment_stats ts ON TRUE;
END;
$$; 