-- ===============================================
-- FIX TRIGGER TIMING - ONLY CREATE PROFILES ON EMAIL CONFIRMATION
-- ===============================================
-- Migration 053: Fix signup failures by creating profiles only after email confirmation
-- VERSION: 2025-01-05-v1
--
-- The trigger was running on INSERT (before email confirmation) which caused issues.
-- This migration makes profiles create ONLY after email is confirmed, which is safer.
-- ===============================================

BEGIN;

-- Drop existing triggers
DROP TRIGGER IF EXISTS handle_new_user_profile_insert ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_profile_update ON auth.users;

-- Update trigger function to be more defensive
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
    existing_user_count INTEGER;
    new_user_role user_role;
    default_tenant_id UUID;
    profile_exists BOOLEAN;
    tenant_slug TEXT;
BEGIN
    -- IMPORTANT: Only create profile AFTER email confirmation
    -- This prevents issues during the signup process
    IF TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN

        -- Check if profile already exists
        SELECT EXISTS(SELECT 1 FROM profiles WHERE id = NEW.id) INTO profile_exists;

        -- Only create profile if it doesn't exist
        IF NOT profile_exists THEN
            BEGIN
                -- Check if this is the first confirmed user in the system
                SELECT COUNT(*) INTO existing_user_count
                FROM auth.users
                WHERE id != NEW.id AND email_confirmed_at IS NOT NULL;

                -- Determine role and tenant slug
                IF existing_user_count = 0 THEN
                    new_user_role := 'super_admin';
                    tenant_slug := 'super-admin';
                ELSE
                    new_user_role := 'user';
                    tenant_slug := 'default';
                END IF;

                -- Get tenant ID (must exist from migration 052)
                SELECT id INTO default_tenant_id
                FROM tenants
                WHERE slug = tenant_slug;

                -- Verify tenant exists
                IF default_tenant_id IS NULL THEN
                    RAISE EXCEPTION 'Tenant with slug % does not exist. Run migration 052 first.', tenant_slug;
                END IF;

                -- Create the user profile
                INSERT INTO profiles (
                    id,
                    tenant_id,
                    email,
                    first_name,
                    last_name,
                    role,
                    is_active,
                    settings,
                    created_at,
                    updated_at
                ) VALUES (
                    NEW.id,
                    default_tenant_id,
                    NEW.email,
                    COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
                    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
                    new_user_role,
                    TRUE,
                    '{}',
                    NOW(),
                    NOW()
                );

                -- Log success
                RAISE LOG 'Profile created for user: % with role: % and tenant: %',
                    NEW.email, new_user_role, tenant_slug;

            EXCEPTION
                WHEN OTHERS THEN
                    -- Log detailed error
                    RAISE WARNING 'Failed to create profile for %: % (SQLSTATE: %)',
                        NEW.email, SQLERRM, SQLSTATE;
                    -- Don't re-raise - allow user creation to succeed
                    -- Profile can be created later via RPC function
            END;
        ELSE
            RAISE LOG 'Profile already exists for user: %', NEW.email;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO anon;

-- Create trigger ONLY for email confirmation (not INSERT)
-- This prevents trigger from running during signup and causing 500 errors
CREATE TRIGGER handle_new_user_profile_update
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
    EXECUTE FUNCTION handle_new_user_profile();

COMMIT;

-- Migration completed
-- Signups will now succeed, and profiles will be created when user confirms email
-- If trigger fails, the RPC function (handle_new_user_registration) will create the profile as fallback
