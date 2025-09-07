-- Coach Profile Management Migration
-- This migration is IDEMPOTENT - safe to run multiple times
-- Ensures coach settings have proper structure and indexes

-- First, let's ensure we have proper indexes for coach queries
CREATE INDEX IF NOT EXISTS idx_profiles_role_active ON profiles(role, is_active) WHERE role IN ('coach', 'manager', 'tenant_admin');
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_role ON profiles(tenant_id, role) WHERE role IN ('coach', 'manager', 'tenant_admin');

-- Add a function to validate coach settings structure
CREATE OR REPLACE FUNCTION validate_coach_settings(settings_json JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    -- Ensure settings is a valid JSON object
    IF settings_json IS NULL THEN
        RETURN TRUE; -- Allow null settings
    END IF;
    
    -- Check if it's a valid JSON object (not array or primitive)
    IF jsonb_typeof(settings_json) != 'object' THEN
        RETURN FALSE;
    END IF;
    
    -- If specialties exists, ensure it's an array
    IF settings_json ? 'specialties' AND jsonb_typeof(settings_json->'specialties') != 'array' THEN
        RETURN FALSE;
    END IF;
    
    -- If preferred_meeting_types exists, ensure it's an array
    IF settings_json ? 'preferred_meeting_types' AND jsonb_typeof(settings_json->'preferred_meeting_types') != 'array' THEN
        RETURN FALSE;
    END IF;
    
    -- If bio exists, ensure it's a string
    IF settings_json ? 'bio' AND jsonb_typeof(settings_json->'bio') != 'string' THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Add a check constraint to ensure coach settings are valid (only for new records)
-- Note: We use a conditional approach to avoid conflicts with existing data
DO $$
BEGIN
    -- Only add constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_coach_settings_valid' 
        AND table_name = 'profiles'
    ) THEN
        ALTER TABLE profiles 
        ADD CONSTRAINT profiles_coach_settings_valid 
        CHECK (
            role NOT IN ('coach', 'manager') OR 
            validate_coach_settings(settings)
        );
    END IF;
END $$;

-- Create a function to get available coaches for a tenant with their settings
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
        p.role IN ('coach', 'manager', 'tenant_admin')
        AND p.is_active = TRUE
        AND (tenant_id_param IS NULL OR p.tenant_id = tenant_id_param)
    ORDER BY p.first_name, p.last_name;
END;
$$;

-- Create a function for coaches to update their own profile settings
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
    
    -- Check if user has coach permissions
    IF current_profile.role NOT IN ('coach', 'manager', 'tenant_admin') THEN
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_available_coaches(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_coach_profile(TEXT[], TEXT, TEXT[], TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_coach_settings(JSONB) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION get_available_coaches(UUID) IS 'Returns available coaches for a tenant with their specialties and preferences';
COMMENT ON FUNCTION update_coach_profile(TEXT[], TEXT, TEXT[], TEXT, TEXT) IS 'Allows coaches to update their own profile settings including specialties, bio, and preferences';
COMMENT ON FUNCTION validate_coach_settings(JSONB) IS 'Validates that coach settings JSON has the correct structure';

-- Create indexes for coach settings queries
CREATE INDEX IF NOT EXISTS idx_profiles_settings_specialties ON profiles USING GIN ((settings->'specialties')) WHERE role IN ('coach', 'manager', 'tenant_admin');
CREATE INDEX IF NOT EXISTS idx_profiles_settings_meeting_types ON profiles USING GIN ((settings->'preferred_meeting_types')) WHERE role IN ('coach', 'manager', 'tenant_admin'); 