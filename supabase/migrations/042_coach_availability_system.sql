-- Coach Availability System Migration
-- This migration is IDEMPOTENT - safe to run multiple times
-- Creates coach availability calendar system with recurring schedules and exceptions

-- ============================================================================
-- Coach Availability Tables
-- ============================================================================

-- Coach recurring availability (weekly schedule)
CREATE TABLE IF NOT EXISTS coach_availability (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC' NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    buffer_minutes INTEGER DEFAULT 15, -- Buffer time between sessions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT coach_availability_time_check CHECK (end_time > start_time),
    CONSTRAINT coach_availability_buffer_check CHECK (buffer_minutes >= 0),
    CONSTRAINT coach_availability_unique_slot UNIQUE(coach_id, day_of_week, start_time, end_time)
);

-- Coach availability exceptions (specific date overrides)
CREATE TABLE IF NOT EXISTS coach_availability_exceptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    exception_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    is_available BOOLEAN NOT NULL DEFAULT FALSE,
    reason VARCHAR(255),
    all_day BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT coach_exceptions_time_check CHECK (
        all_day = TRUE OR 
        (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
    ),
    CONSTRAINT coach_exceptions_unique UNIQUE(coach_id, exception_date, start_time, end_time)
);

-- Create indexes for coach availability
CREATE INDEX IF NOT EXISTS idx_coach_availability_coach_id ON coach_availability(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_availability_tenant_id ON coach_availability(tenant_id);
CREATE INDEX IF NOT EXISTS idx_coach_availability_day ON coach_availability(day_of_week);
CREATE INDEX IF NOT EXISTS idx_coach_availability_time ON coach_availability(start_time, end_time);

-- Create indexes for coach availability exceptions
CREATE INDEX IF NOT EXISTS idx_coach_exceptions_coach_id ON coach_availability_exceptions(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_exceptions_tenant_id ON coach_availability_exceptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_coach_exceptions_date ON coach_availability_exceptions(exception_date);

-- ============================================================================
-- Coach Availability Functions
-- ============================================================================

-- Function to get coach's weekly availability
CREATE OR REPLACE FUNCTION get_coach_availability(
    p_coach_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    availability_data JSONB;
    exceptions_data JSONB;
BEGIN
    -- Get weekly recurring availability
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'day_of_week', day_of_week,
            'start_time', start_time,
            'end_time', end_time,
            'timezone', timezone,
            'is_available', is_available,
            'buffer_minutes', buffer_minutes
        ) ORDER BY day_of_week, start_time
    ) INTO availability_data
    FROM coach_availability
    WHERE coach_id = p_coach_id;
    
    -- Get exceptions for next 90 days
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'exception_date', exception_date,
            'start_time', start_time,
            'end_time', end_time,
            'is_available', is_available,
            'reason', reason,
            'all_day', all_day
        ) ORDER BY exception_date, start_time
    ) INTO exceptions_data
    FROM coach_availability_exceptions
    WHERE coach_id = p_coach_id
    AND exception_date >= CURRENT_DATE
    AND exception_date <= CURRENT_DATE + INTERVAL '90 days';
    
    RETURN jsonb_build_object(
        'weekly_schedule', COALESCE(availability_data, '[]'::jsonb),
        'exceptions', COALESCE(exceptions_data, '[]'::jsonb)
    );
END;
$$;

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
    
    -- Verify access permissions (unless super admin)
    IF current_profile.role != 'super_admin' THEN
        IF current_profile.role != 'tenant_admin' OR coach_profile.tenant_id != current_profile.tenant_id THEN
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
            coach_profile.tenant_id,
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
        'message', 'Availability updated successfully'
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
    
    -- Verify coach exists and belongs to same tenant (unless super admin)
    IF current_profile.role != 'super_admin' THEN
        IF NOT EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = p_coach_id 
            AND tenant_id = current_profile.tenant_id
        ) THEN
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
        current_profile.tenant_id,
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

-- Function to get available time slots for a coach on a specific date
CREATE OR REPLACE FUNCTION get_coach_available_slots(
    p_coach_id UUID,
    p_date DATE,
    p_duration_minutes INTEGER DEFAULT 60,
    p_timezone VARCHAR(50) DEFAULT 'UTC'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    day_of_week INTEGER;
    availability_record RECORD;
    exception_record RECORD;
    existing_sessions RECORD;
    available_slots JSONB := '[]'::jsonb;
    slot_start TIME;
    slot_end TIME;
    slot_time TIME;
    buffer_minutes INTEGER;
    is_slot_available BOOLEAN;
BEGIN
    -- Don't allow booking in the past
    IF p_date < CURRENT_DATE THEN
        RETURN jsonb_build_object(
            'success', true,
            'slots', '[]'::jsonb,
            'message', 'No slots available for past dates'
        );
    END IF;
    
    -- Get day of week (0=Sunday, 6=Saturday)
    day_of_week := EXTRACT(DOW FROM p_date);
    
    -- Check for all-day exceptions first
    SELECT * INTO exception_record
    FROM coach_availability_exceptions
    WHERE coach_id = p_coach_id
    AND exception_date = p_date
    AND all_day = TRUE
    AND is_available = FALSE;
    
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'slots', '[]'::jsonb,
            'message', COALESCE(exception_record.reason, 'Coach unavailable this day')
        );
    END IF;
    
    -- Get coach's regular availability for this day of week
    FOR availability_record IN
        SELECT * FROM coach_availability
        WHERE coach_id = p_coach_id
        AND day_of_week = day_of_week
        AND is_available = TRUE
        ORDER BY start_time
    LOOP
        buffer_minutes := COALESCE(availability_record.buffer_minutes, 15);
        slot_time := availability_record.start_time;
        
        -- Generate slots within this availability window
        WHILE slot_time + (p_duration_minutes || ' minutes')::INTERVAL <= availability_record.end_time LOOP
            slot_start := slot_time;
            slot_end := slot_time + (p_duration_minutes || ' minutes')::INTERVAL;
            is_slot_available := TRUE;
            
            -- Check for specific time exceptions
            SELECT * INTO exception_record
            FROM coach_availability_exceptions
            WHERE coach_id = p_coach_id
            AND exception_date = p_date
            AND all_day = FALSE
            AND start_time <= slot_start
            AND end_time >= slot_end
            AND is_available = FALSE;
            
            IF FOUND THEN
                is_slot_available := FALSE;
            END IF;
            
            -- Check for existing sessions (conflicts)
            IF is_slot_available THEN
                SELECT * INTO existing_sessions
                FROM coaching_sessions
                WHERE coach_id = p_coach_id
                AND scheduled_at::date = p_date
                AND status IN ('scheduled', 'confirmed')
                AND (
                    (scheduled_at::time <= slot_start AND scheduled_at::time + (duration_minutes || ' minutes')::INTERVAL > slot_start) OR
                    (scheduled_at::time < slot_end AND scheduled_at::time >= slot_start)
                );
                
                IF FOUND THEN
                    is_slot_available := FALSE;
                END IF;
            END IF;
            
            -- Add slot if available
            IF is_slot_available THEN
                available_slots := available_slots || jsonb_build_array(
                    jsonb_build_object(
                        'start_time', slot_start,
                        'end_time', slot_end,
                        'datetime', p_date || ' ' || slot_start,
                        'duration_minutes', p_duration_minutes
                    )
                );
            END IF;
            
            -- Move to next slot (duration + buffer)
            slot_time := slot_time + ((p_duration_minutes + buffer_minutes) || ' minutes')::INTERVAL;
        END LOOP;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'slots', available_slots,
        'date', p_date,
        'coach_id', p_coach_id
    );
END;
$$;

-- ============================================================================
-- Row Level Security Policies
-- ============================================================================

-- Enable RLS on coach availability tables
ALTER TABLE coach_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_availability_exceptions ENABLE ROW LEVEL SECURITY;

-- Coach availability policies
DROP POLICY IF EXISTS coach_availability_select_policy ON coach_availability;
CREATE POLICY coach_availability_select_policy ON coach_availability
    FOR SELECT
    USING (
        -- Coaches can see their own availability
        coach_id = auth.uid() OR
        -- Admins can see all availability in their tenant
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('tenant_admin', 'super_admin')
            AND (profiles.role = 'super_admin' OR profiles.tenant_id = coach_availability.tenant_id)
        ) OR
        -- Users can see coach availability in their tenant for booking purposes
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid()
            AND profiles.tenant_id = coach_availability.tenant_id
        )
    );

DROP POLICY IF EXISTS coach_availability_insert_policy ON coach_availability;
CREATE POLICY coach_availability_insert_policy ON coach_availability
    FOR INSERT
    WITH CHECK (
        -- Coaches can insert their own availability
        coach_id = auth.uid() OR
        -- Admins can insert availability for coaches in their tenant
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('tenant_admin', 'super_admin')
            AND (profiles.role = 'super_admin' OR profiles.tenant_id = coach_availability.tenant_id)
        )
    );

DROP POLICY IF EXISTS coach_availability_update_policy ON coach_availability;
CREATE POLICY coach_availability_update_policy ON coach_availability
    FOR UPDATE
    USING (
        coach_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('tenant_admin', 'super_admin')
            AND (profiles.role = 'super_admin' OR profiles.tenant_id = coach_availability.tenant_id)
        )
    );

DROP POLICY IF EXISTS coach_availability_delete_policy ON coach_availability;
CREATE POLICY coach_availability_delete_policy ON coach_availability
    FOR DELETE
    USING (
        coach_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('tenant_admin', 'super_admin')
            AND (profiles.role = 'super_admin' OR profiles.tenant_id = coach_availability.tenant_id)
        )
    );

-- Coach availability exceptions policies (similar structure)
DROP POLICY IF EXISTS coach_exceptions_select_policy ON coach_availability_exceptions;
CREATE POLICY coach_exceptions_select_policy ON coach_availability_exceptions
    FOR SELECT
    USING (
        coach_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('tenant_admin', 'super_admin')
            AND (profiles.role = 'super_admin' OR profiles.tenant_id = coach_availability_exceptions.tenant_id)
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid()
            AND profiles.tenant_id = coach_availability_exceptions.tenant_id
        )
    );

DROP POLICY IF EXISTS coach_exceptions_insert_policy ON coach_availability_exceptions;
CREATE POLICY coach_exceptions_insert_policy ON coach_availability_exceptions
    FOR INSERT
    WITH CHECK (
        coach_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('tenant_admin', 'super_admin')
            AND (profiles.role = 'super_admin' OR profiles.tenant_id = coach_availability_exceptions.tenant_id)
        )
    );

DROP POLICY IF EXISTS coach_exceptions_update_policy ON coach_availability_exceptions;
CREATE POLICY coach_exceptions_update_policy ON coach_availability_exceptions
    FOR UPDATE
    USING (
        coach_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('tenant_admin', 'super_admin')
            AND (profiles.role = 'super_admin' OR profiles.tenant_id = coach_availability_exceptions.tenant_id)
        )
    );

DROP POLICY IF EXISTS coach_exceptions_delete_policy ON coach_availability_exceptions;
CREATE POLICY coach_exceptions_delete_policy ON coach_availability_exceptions
    FOR DELETE
    USING (
        coach_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('tenant_admin', 'super_admin')
            AND (profiles.role = 'super_admin' OR profiles.tenant_id = coach_availability_exceptions.tenant_id)
        )
    );

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_coach_availability(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_coach_availability(UUID, JSONB, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION add_availability_exception(UUID, DATE, TIME, TIME, BOOLEAN, VARCHAR, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_coach_available_slots(UUID, DATE, INTEGER, VARCHAR) TO anon, authenticated;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE coach_availability IS 'Stores coach recurring weekly availability schedules';
COMMENT ON TABLE coach_availability_exceptions IS 'Stores specific date exceptions to regular availability (time off, extra hours, etc.)';
COMMENT ON FUNCTION get_coach_availability(UUID) IS 'Gets a coach complete availability including weekly schedule and exceptions';
COMMENT ON FUNCTION update_coach_availability(UUID, JSONB, VARCHAR) IS 'Updates a coach weekly availability schedule';
COMMENT ON FUNCTION add_availability_exception(UUID, DATE, TIME, TIME, BOOLEAN, VARCHAR, BOOLEAN) IS 'Adds or updates an availability exception for a specific date';
COMMENT ON FUNCTION get_coach_available_slots(UUID, DATE, INTEGER, VARCHAR) IS 'Gets available booking slots for a coach on a specific date, considering existing bookings and exceptions'; 