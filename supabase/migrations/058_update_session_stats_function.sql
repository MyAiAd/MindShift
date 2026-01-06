-- =====================================================
-- Migration 058: Update Session Stats Function with Metrics
-- =====================================================
-- This migration updates the get_session_stats function to include:
-- - problems_cleared count
-- - goals_optimized count  
-- - experiences_cleared count
-- - avg_minutes_per_problem calculation
--
-- Also creates admin metrics functions for aggregate stats
--
-- All statements are IDEMPOTENT - safe to run multiple times
-- =====================================================

-- Drop existing function to recreate with new signature
DROP FUNCTION IF EXISTS get_session_stats(UUID, UUID, INTEGER);

-- Recreate get_session_stats with new metrics columns
CREATE OR REPLACE FUNCTION get_session_stats(
  p_user_id UUID,
  p_tenant_id UUID,
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
  total_treatment_hours_this_month NUMERIC,
  -- New metrics columns
  problems_cleared BIGINT,
  goals_optimized BIGINT,
  experiences_cleared BIGINT,
  avg_minutes_per_problem NUMERIC,
  unique_days_active BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff_date TIMESTAMPTZ;
  stats_cleared TIMESTAMPTZ;
BEGIN
  -- Calculate the cutoff date based on days parameter
  cutoff_date := NOW() - (p_days || ' days')::INTERVAL;
  
  -- Get the stats_cleared_at timestamp for this user (if any)
  SELECT p.stats_cleared_at INTO stats_cleared
  FROM profiles p
  WHERE p.id = p_user_id;
  
  -- Use the more recent of cutoff_date or stats_cleared_at
  IF stats_cleared IS NOT NULL AND stats_cleared > cutoff_date THEN
    cutoff_date := stats_cleared;
  END IF;

  RETURN QUERY
  WITH coaching_stats AS (
    SELECT
      COUNT(*)::BIGINT as total,
      COUNT(CASE WHEN cs.status = 'scheduled' AND cs.scheduled_at > NOW() THEN 1 END)::BIGINT as upcoming,
      COUNT(CASE WHEN cs.status = 'completed' THEN 1 END)::BIGINT as completed,
      COUNT(CASE WHEN cs.status = 'cancelled' THEN 1 END)::BIGINT as cancelled,
      COALESCE(SUM(CASE WHEN cs.status = 'completed' THEN cs.duration_minutes ELSE 0 END) / 60.0, 0)::NUMERIC as hours
    FROM coaching_sessions cs
    WHERE (cs.client_id = p_user_id OR cs.coach_id = p_user_id)
      AND cs.created_at >= cutoff_date
  ),
  treatment_stats AS (
    SELECT
      COUNT(*)::BIGINT as total,
      COUNT(CASE WHEN ts.status = 'active' OR ts.status = 'paused' THEN 1 END)::BIGINT as active,
      COUNT(CASE WHEN ts.status = 'completed' THEN 1 END)::BIGINT as completed,
      COALESCE(SUM(COALESCE(ts.duration_minutes, 0)) / 60.0, 0)::NUMERIC as hours,
      -- New metrics
      COALESCE(SUM(COALESCE(ts.problems_count, 0)), 0)::BIGINT as problems,
      COALESCE(SUM(COALESCE(ts.goals_count, 0)), 0)::BIGINT as goals,
      COALESCE(SUM(COALESCE(ts.experiences_count, 0)), 0)::BIGINT as experiences,
      COALESCE(SUM(COALESCE(ts.duration_minutes, 0)), 0)::NUMERIC as total_minutes,
      COUNT(DISTINCT DATE(ts.created_at))::BIGINT as unique_days
    FROM treatment_sessions ts
    WHERE ts.user_id = p_user_id
      AND ts.created_at >= cutoff_date
  )
  SELECT
    -- Coaching stats
    cs.total as total_sessions,
    cs.upcoming as upcoming_sessions,
    cs.completed as completed_sessions,
    cs.cancelled as cancelled_sessions,
    cs.hours as total_hours_this_month,
    0::BIGINT as available_slots,
    -- Treatment stats
    ts.total as treatment_sessions,
    ts.active as active_treatment_sessions,
    ts.completed as completed_treatment_sessions,
    ts.hours as total_treatment_hours_this_month,
    -- New metrics
    ts.problems as problems_cleared,
    ts.goals as goals_optimized,
    ts.experiences as experiences_cleared,
    CASE 
      WHEN ts.problems > 0 THEN ROUND(ts.total_minutes / ts.problems, 1)
      ELSE 0
    END as avg_minutes_per_problem,
    ts.unique_days as unique_days_active
  FROM coaching_stats cs, treatment_stats ts;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_session_stats(UUID, UUID, INTEGER) TO authenticated;

-- =====================================================
-- Admin Aggregate Metrics Function
-- =====================================================
-- This function returns aggregate metrics across ALL users
-- Only accessible by super_admin and admin roles

DROP FUNCTION IF EXISTS get_admin_aggregate_metrics(INTEGER);

CREATE OR REPLACE FUNCTION get_admin_aggregate_metrics(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_users BIGINT,
  total_sessions BIGINT,
  completed_sessions BIGINT,
  active_sessions BIGINT,
  problems_cleared BIGINT,
  goals_optimized BIGINT,
  experiences_cleared BIGINT,
  total_minutes BIGINT,
  avg_session_duration NUMERIC,
  avg_minutes_per_problem NUMERIC,
  total_active_days BIGINT,
  avg_sessions_per_user NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff_date TIMESTAMPTZ;
  calling_user_role TEXT;
BEGIN
  -- Check if calling user is admin
  SELECT role INTO calling_user_role
  FROM profiles
  WHERE id = auth.uid();
  
  IF calling_user_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  cutoff_date := NOW() - (p_days || ' days')::INTERVAL;
  
  RETURN QUERY
  SELECT
    COUNT(DISTINCT ts.user_id)::BIGINT as total_users,
    COUNT(ts.id)::BIGINT as total_sessions,
    COUNT(CASE WHEN ts.status = 'completed' THEN 1 END)::BIGINT as completed_sessions,
    COUNT(CASE WHEN ts.status = 'active' THEN 1 END)::BIGINT as active_sessions,
    COALESCE(SUM(COALESCE(ts.problems_count, 0)), 0)::BIGINT as problems_cleared,
    COALESCE(SUM(COALESCE(ts.goals_count, 0)), 0)::BIGINT as goals_optimized,
    COALESCE(SUM(COALESCE(ts.experiences_count, 0)), 0)::BIGINT as experiences_cleared,
    COALESCE(SUM(COALESCE(ts.duration_minutes, 0)), 0)::BIGINT as total_minutes,
    CASE 
      WHEN COUNT(ts.id) > 0 
      THEN ROUND(AVG(COALESCE(ts.duration_minutes, 0)), 1)
      ELSE 0
    END as avg_session_duration,
    CASE 
      WHEN SUM(COALESCE(ts.problems_count, 0)) > 0 
      THEN ROUND(SUM(COALESCE(ts.duration_minutes, 0))::NUMERIC / SUM(COALESCE(ts.problems_count, 0)), 1)
      ELSE 0
    END as avg_minutes_per_problem,
    COUNT(DISTINCT DATE(ts.created_at))::BIGINT as total_active_days,
    CASE 
      WHEN COUNT(DISTINCT ts.user_id) > 0 
      THEN ROUND(COUNT(ts.id)::NUMERIC / COUNT(DISTINCT ts.user_id), 1)
      ELSE 0
    END as avg_sessions_per_user
  FROM treatment_sessions ts
  WHERE ts.created_at >= cutoff_date;
END;
$$;

-- Grant execute permission to authenticated users (function checks role internally)
GRANT EXECUTE ON FUNCTION get_admin_aggregate_metrics(INTEGER) TO authenticated;

-- =====================================================
-- User Metrics by Session Type Function
-- =====================================================
-- Returns breakdown of metrics by session type for a user

DROP FUNCTION IF EXISTS get_user_metrics_by_type(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_user_metrics_by_type(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  session_type VARCHAR(50),
  session_count BIGINT,
  completed_count BIGINT,
  total_minutes BIGINT,
  problems_cleared BIGINT,
  goals_optimized BIGINT,
  experiences_cleared BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff_date TIMESTAMPTZ;
BEGIN
  cutoff_date := NOW() - (p_days || ' days')::INTERVAL;
  
  RETURN QUERY
  SELECT
    COALESCE(ts.session_type, 'problem_shifting')::VARCHAR(50) as session_type,
    COUNT(ts.id)::BIGINT as session_count,
    COUNT(CASE WHEN ts.status = 'completed' THEN 1 END)::BIGINT as completed_count,
    COALESCE(SUM(COALESCE(ts.duration_minutes, 0)), 0)::BIGINT as total_minutes,
    COALESCE(SUM(COALESCE(ts.problems_count, 0)), 0)::BIGINT as problems_cleared,
    COALESCE(SUM(COALESCE(ts.goals_count, 0)), 0)::BIGINT as goals_optimized,
    COALESCE(SUM(COALESCE(ts.experiences_count, 0)), 0)::BIGINT as experiences_cleared
  FROM treatment_sessions ts
  WHERE ts.user_id = p_user_id
    AND ts.created_at >= cutoff_date
  GROUP BY ts.session_type
  ORDER BY session_count DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_metrics_by_type(UUID, INTEGER) TO authenticated;

-- =====================================================
-- Verification queries (for manual checking)
-- =====================================================
-- Test get_session_stats:
-- SELECT * FROM get_session_stats(auth.uid(), NULL, 30);

-- Test admin metrics (must be admin):
-- SELECT * FROM get_admin_aggregate_metrics(30);

-- Test user metrics by type:
-- SELECT * FROM get_user_metrics_by_type(auth.uid(), 30);

