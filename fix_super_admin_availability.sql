-- Fix coach availability functions to handle super admin with NULL tenant_id
-- This allows super admins to test the availability system

-- Function to update coach availability
CREATE OR REPLACE FUNCTION update_coach_availability(
    p_coach_id UUID,
    p_weekly_schedule JSONB,
    p_timezone VARCHAR(50) DEFAULT 'UTC'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    current_profile RECORD;
    coach_profile RECORD;
    schedule_item JSONB;
    target_tenant_id UUID;
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
    
    -- Check permissions (coach can only update their own, admins can update any)
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
    
    -- Verify coach has coaching permissions
    IF coach_profile.role NOT IN ('coach', 'manager', 'tenant_admin', 'super_admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Selected user is not a coach');
    END IF;
    
    -- Determine target tenant_id
    target_tenant_id := coach_profile.tenant_id;
    
    -- Handle super admin with NULL tenant_id (for testing)
    IF target_tenant_id IS NULL AND coach_profile.role = 'super_admin' THEN
        SELECT id INTO target_tenant_id FROM tenants WHERE status = 'active' LIMIT 1;
        IF target_tenant_id IS NULL THEN
            SELECT id INTO target_tenant_id FROM tenants LIMIT 1;
        END IF;
        IF target_tenant_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'No tenant available for super admin testing');
        END IF;
    END IF;
    
    -- Verify access permissions (unless super admin)
    IF current_profile.role != 'super_admin' THEN
        IF current_profile.role != 'tenant_admin' OR target_tenant_id != current_profile.tenant_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Coach not found or access denied');
        END IF;
    END IF;
    
    -- Clear existing availability for this coach
    DELETE FROM coach_availability WHERE coach_id = p_coach_id;
    
    -- Insert new availability schedule
    FOR schedule_item IN SELECT * FROM jsonb_array_elements(p_weekly_schedule)
    LOOP
        INSERT INTO coach_availability (
            coach_id,
            tenant_id,
            day_of_week,
            start_time,
            end_time,
            timezone,
            is_available,
            buffer_minutes
        ) VALUES (
            p_coach_id,
            target_tenant_id,
            (schedule_item->>'day_of_week')::INTEGER,
            (schedule_item->>'start_time')::TIME,
            (schedule_item->>'end_time')::TIME,
            COALESCE(schedule_item->>'timezone', p_timezone),
            COALESCE((schedule_item->>'is_available')::BOOLEAN, TRUE),
            COALESCE((schedule_item->>'buffer_minutes')::INTEGER, 15)
        );
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Availability updated successfully',
        'tenant_id', target_tenant_id
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', SQLERRM
        );
END;
$$;

-- Function to add availability exception
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
    target_tenant_id UUID;
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
    
    -- Determine target tenant_id
    target_tenant_id := coach_profile.tenant_id;
    
    -- Handle super admin with NULL tenant_id (for testing)
    IF target_tenant_id IS NULL AND coach_profile.role = 'super_admin' THEN
        SELECT id INTO target_tenant_id FROM tenants WHERE status = 'active' LIMIT 1;
        IF target_tenant_id IS NULL THEN
            SELECT id INTO target_tenant_id FROM tenants LIMIT 1;
        END IF;
        IF target_tenant_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'No tenant available for super admin testing');
        END IF;
    END IF;
    
    -- Verify access permissions (unless super admin)
    IF current_profile.role != 'super_admin' THEN
        IF current_profile.role != 'tenant_admin' OR target_tenant_id != current_profile.tenant_id THEN
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
        target_tenant_id,
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
        'message', 'Exception added successfully',
        'tenant_id', target_tenant_id
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', SQLERRM
        );
END;
$$;
