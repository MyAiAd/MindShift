-- Fix the add_availability_exception function to use coach's tenant_id
CREATE OR REPLACE FUNCTION add_availability_exception(
    p_coach_id UUID,
    p_exception_date DATE,
    p_start_time TIME DEFAULT NULL,
    p_end_time TIME DEFAULT NULL,
    p_is_available BOOLEAN DEFAULT FALSE,
    p_reason VARCHAR(255) DEFAULT NULL,
    p_all_day BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    current_profile RECORD;
    coach_profile RECORD;
    exception_id UUID;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get current profile
    SELECT * INTO current_profile
    FROM profiles 
    WHERE id = current_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;
    
    -- Check permissions
    IF current_profile.role NOT IN ('super_admin', 'tenant_admin') AND current_user_id != p_coach_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;
    
    -- Get coach profile to determine tenant_id
    SELECT * INTO coach_profile
    FROM profiles 
    WHERE id = p_coach_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Coach not found');
    END IF;
    
    -- Verify access permissions (unless super admin)
    IF current_profile.role != 'super_admin' THEN
        IF current_profile.role != 'tenant_admin' OR coach_profile.tenant_id != current_profile.tenant_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Coach not found or access denied');
        END IF;
    END IF;
    
    -- Insert exception (will replace if exists due to unique constraint)
    INSERT INTO coach_availability_exceptions (
        coach_id,
        tenant_id,
        exception_date,
        start_time,
        end_time,
        is_available,
        reason,
        all_day
    ) VALUES (
        p_coach_id,
        coach_profile.tenant_id,
        p_exception_date,
        p_start_time,
        p_end_time,
        p_is_available,
        p_reason,
        p_all_day
    )
    ON CONFLICT (coach_id, exception_date, start_time, end_time)
    DO UPDATE SET
        is_available = EXCLUDED.is_available,
        reason = EXCLUDED.reason,
        all_day = EXCLUDED.all_day,
        updated_at = NOW()
    RETURNING id INTO exception_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'exception_id', exception_id,
        'message', 'Exception added successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', SQLERRM
        );
END;
$$;
