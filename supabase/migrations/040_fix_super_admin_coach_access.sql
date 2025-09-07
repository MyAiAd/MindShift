-- Fix Super Admin Access to Coach Profile Management
-- This migration is IDEMPOTENT - safe to run multiple times
-- Updates coach profile functions to allow super_admin access

-- Update the get_available_coaches function to include super_admin
CREATE OR REPLACE FUNCTION get_available_coaches(tenant_id_param UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    role user_role,
    specialties JSONB,
    preferred_meeting_types JSONB,
    bio TEXT,
    is_active BOOLEAN,
    tenant_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.email,
        p.role,
        COALESCE(p.settings->'specialties', '[]'::jsonb) as specialties,
        COALESCE(p.settings->'preferred_meeting_types', '[]'::jsonb) as preferred_meeting_types,
        COALESCE(p.settings->>'bio', '') as bio,
        p.is_active,
        p.tenant_id
    FROM profiles p
    WHERE 
        p.role IN ('coach', 'manager', 'tenant_admin', 'super_admin')
        AND p.is_active = TRUE
        AND (tenant_id_param IS NULL OR p.tenant_id = tenant_id_param)
    ORDER BY p.first_name, p.last_name;
END;
$$;

-- Update the update_coach_profile function to allow super_admin
CREATE OR REPLACE FUNCTION update_coach_profile(
    coach_specialties TEXT[] DEFAULT NULL,
    coach_bio TEXT DEFAULT NULL,
    coach_meeting_types TEXT[] DEFAULT NULL,
    coach_credentials TEXT DEFAULT NULL,
    coach_availability_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    current_profile RECORD;
    new_settings JSONB;
    result JSONB;
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
    
    -- Check if user has coach permissions (now includes super_admin)
    IF current_profile.role NOT IN ('coach', 'manager', 'tenant_admin', 'super_admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;
    
    -- Build new settings object
    new_settings := COALESCE(current_profile.settings, '{}'::jsonb);
    
    -- Update specialties if provided
    IF coach_specialties IS NOT NULL THEN
        new_settings := new_settings || jsonb_build_object('specialties', to_jsonb(coach_specialties));
    END IF;
    
    -- Update bio if provided
    IF coach_bio IS NOT NULL THEN
        new_settings := new_settings || jsonb_build_object('bio', coach_bio);
    END IF;
    
    -- Update meeting types if provided
    IF coach_meeting_types IS NOT NULL THEN
        new_settings := new_settings || jsonb_build_object('preferred_meeting_types', to_jsonb(coach_meeting_types));
    END IF;
    
    -- Update credentials if provided
    IF coach_credentials IS NOT NULL THEN
        new_settings := new_settings || jsonb_build_object('credentials', coach_credentials);
    END IF;
    
    -- Update availability notes if provided
    IF coach_availability_notes IS NOT NULL THEN
        new_settings := new_settings || jsonb_build_object('availability_notes', coach_availability_notes);
    END IF;
    
    -- Update the profile
    UPDATE profiles 
    SET 
        settings = new_settings,
        updated_at = NOW()
    WHERE id = current_user_id;
    
    -- Return success with updated settings
    RETURN jsonb_build_object(
        'success', true, 
        'settings', new_settings,
        'message', 'Coach profile updated successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', SQLERRM
        );
END;
$$;

-- Update the constraint to include super_admin
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_coach_settings_valid;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_coach_settings_valid 
CHECK (
    role NOT IN ('coach', 'manager', 'super_admin') OR 
    validate_coach_settings(settings)
);

-- Add helpful comment
COMMENT ON FUNCTION update_coach_profile(TEXT[], TEXT, TEXT[], TEXT, TEXT) IS 'Allows coaches and super admins to update their own profile settings including specialties, bio, and preferences'; 