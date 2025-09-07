-- Fix get_coach_available_slots function to handle super admin with NULL tenant_id
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
    coach_profile RECORD;
    current_user_id UUID;
BEGIN
    -- Get current user for debugging
    current_user_id := auth.uid();
    
    -- Don't allow booking in the past
    IF p_date < CURRENT_DATE THEN
        RETURN jsonb_build_object(
            'success', true,
            'slots', '[]'::jsonb,
            'message', 'No slots available for past dates'
        );
    END IF;
    
    -- Get coach profile for debugging
    SELECT * INTO coach_profile
    FROM profiles 
    WHERE id = p_coach_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Coach profile not found'
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
    
    -- Return results with debug info
    RETURN jsonb_build_object(
        'success', true,
        'slots', available_slots,
        'date', p_date,
        'coach_id', p_coach_id,
        'day_of_week', day_of_week,
        'debug_info', jsonb_build_object(
            'coach_role', coach_profile.role,
            'coach_tenant_id', coach_profile.tenant_id,
            'current_user', current_user_id,
            'availability_count', (
                SELECT COUNT(*) 
                FROM coach_availability 
                WHERE coach_id = p_coach_id 
                AND day_of_week = day_of_week
            )
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'debug_info', jsonb_build_object(
                'coach_id', p_coach_id,
                'date', p_date,
                'current_user', auth.uid()
            )
        );
END;
$$;
