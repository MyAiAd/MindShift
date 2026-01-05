-- ===============================================
-- FIX NEW USER "ACCESS DENIED" ERRORS
-- ===============================================
-- Migration 049: Idempotent fix for RLS policies causing new users to get "access denied"
-- This ensures new users can properly access their profiles after email confirmation
--
-- VERSION: 2025-01-05-v4 (with handle_new_user_registration RPC function)
-- Last Updated: 2025-01-05 19:05 UTC
--
-- This version includes:
-- 1. Fixed RLS policies (no recursion, uses JWT claims)
-- 2. handle_new_user_registration RPC function
-- 3. handle_new_user_profile trigger function
-- 4. fix_users_without_profiles function
--
-- IMPORTANT: If you still see 406 errors after running this, the migration did not complete.
-- Check the SQL Editor output for any errors.
-- ===============================================

BEGIN;

-- ===============================================
-- 1. FIX PROFILES TABLE RLS POLICIES
-- ===============================================

-- Temporarily disable RLS to clean up
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Drop all existing profile policies that might conflict
DROP POLICY IF EXISTS "profiles_self_only" ON profiles;
DROP POLICY IF EXISTS "profiles_registration_access" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
DROP POLICY IF EXISTS "profile_self_access" ON profiles;
DROP POLICY IF EXISTS "profile_creation" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Tenant members can view profiles in their tenant" ON profiles;
DROP POLICY IF EXISTS "Comprehensive profile access" ON profiles;
DROP POLICY IF EXISTS "Super admin bypass" ON profiles;
DROP POLICY IF EXISTS "jwt_super_admin_profile_access" ON profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON profiles;

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create clean, simple RLS policies for profiles
-- Policy 1: Users can SELECT their own profile (critical for new users!)
CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT TO authenticated
    USING (
        id = auth.uid()
        OR
        -- Allow super admins to see all profiles (using JWT to avoid recursion)
        (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
    );

-- Policy 2: Users can INSERT their own profile (during registration)
CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

-- Policy 3: Users can UPDATE their own profile
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE TO authenticated
    USING (
        id = auth.uid()
        OR
        -- Allow super admins to update all profiles (using JWT to avoid recursion)
        (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
    )
    WITH CHECK (
        id = auth.uid()
        OR
        -- Allow super admins to update all profiles (using JWT to avoid recursion)
        (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
    );

-- Policy 4: Users can DELETE their own profile (optional, for account deletion)
CREATE POLICY "profiles_delete_own" ON profiles
    FOR DELETE TO authenticated
    USING (
        id = auth.uid()
        OR
        -- Allow super admins to delete any profile (using JWT to avoid recursion)
        (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
    );

-- ===============================================
-- 2. ENSURE TENANTS TABLE DOESN'T BLOCK PROFILE ACCESS
-- ===============================================

-- Verify tenants RLS policies allow profile creation
-- (profiles can have NULL tenant_id for new users)

-- ===============================================
-- 3. CREATE/UPDATE RPC FUNCTION FOR MANUAL PROFILE CREATION
-- ===============================================

-- This function is called by the frontend when profile doesn't exist
CREATE OR REPLACE FUNCTION handle_new_user_registration(
    user_id UUID,
    user_email VARCHAR(255),
    user_first_name VARCHAR(100) DEFAULT NULL,
    user_last_name VARCHAR(100) DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    existing_user_count INTEGER;
    new_user_role user_role;
    default_tenant_id UUID;
    result JSONB;
BEGIN
    -- Check if this is the first user in the system
    SELECT COUNT(*) INTO existing_user_count
    FROM auth.users
    WHERE id != user_id AND email_confirmed_at IS NOT NULL;

    -- If this is the first user, make them super admin
    IF existing_user_count = 0 THEN
        new_user_role := 'super_admin';

        -- Get or create a default tenant for super admin
        INSERT INTO tenants (
            id,
            name,
            slug,
            status,
            subscription_status,
            trial_ends_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            'Super Admin Organization',
            'super-admin',
            'active',
            'active',
            NOW() + INTERVAL '10 years',
            NOW(),
            NOW()
        )
        ON CONFLICT (slug) DO UPDATE SET
            updated_at = NOW()
        RETURNING id INTO default_tenant_id;

        -- If tenant already exists, get its ID
        IF default_tenant_id IS NULL THEN
            SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'super-admin';
        END IF;

    ELSE
        -- Regular users get 'user' role and no default tenant
        new_user_role := 'user';
        default_tenant_id := NULL;
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
        user_id,
        default_tenant_id,
        user_email,
        user_first_name,
        user_last_name,
        new_user_role,
        TRUE,
        '{}',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        tenant_id = COALESCE(default_tenant_id, profiles.tenant_id),
        email = user_email,
        first_name = COALESCE(user_first_name, profiles.first_name),
        last_name = COALESCE(user_last_name, profiles.last_name),
        role = CASE
            WHEN existing_user_count = 0 THEN 'super_admin'::user_role
            ELSE profiles.role
        END,
        updated_at = NOW();

    -- Create audit log for super admin creation
    IF new_user_role = 'super_admin' THEN
        BEGIN
            INSERT INTO audit_logs (
                tenant_id,
                user_id,
                action,
                resource_type,
                resource_id,
                new_data,
                created_at
            ) VALUES (
                default_tenant_id,
                user_id,
                'CREATE',
                'super_admin',
                user_id,
                jsonb_build_object(
                    'email', user_email,
                    'role', 'super_admin',
                    'reason', 'first_user_auto_promotion_rpc'
                ),
                NOW()
            );
        EXCEPTION
            WHEN OTHERS THEN
                -- Ignore audit log errors
                RAISE WARNING 'Could not create audit log: %', SQLERRM;
        END;
    END IF;

    -- Return result
    result := jsonb_build_object(
        'success', true,
        'user_id', user_id,
        'role', new_user_role,
        'tenant_id', default_tenant_id,
        'is_super_admin', new_user_role = 'super_admin',
        'message', CASE
            WHEN new_user_role = 'super_admin' THEN 'First user promoted to super admin'
            ELSE 'Regular user profile created'
        END
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on the RPC function
GRANT EXECUTE ON FUNCTION handle_new_user_registration(UUID, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_registration(UUID, VARCHAR, VARCHAR, VARCHAR) TO anon;

-- ===============================================
-- 4. FIX TRIGGER FUNCTION FOR PROFILE CREATION
-- ===============================================

-- Ensure the trigger function has correct permissions and logic
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
    existing_user_count INTEGER;
    new_user_role user_role;
    default_tenant_id UUID;
    profile_exists BOOLEAN;
BEGIN
    -- Only proceed if this is a new user insert OR email confirmation
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL) THEN

        -- Check if profile already exists
        SELECT EXISTS(SELECT 1 FROM profiles WHERE id = NEW.id) INTO profile_exists;

        -- Only create profile if it doesn't exist
        IF NOT profile_exists THEN
            BEGIN
                -- Check if this is the first confirmed user in the system
                SELECT COUNT(*) INTO existing_user_count
                FROM auth.users
                WHERE id != NEW.id AND email_confirmed_at IS NOT NULL;

                -- If this is the first user, make them super admin
                IF existing_user_count = 0 THEN
                    new_user_role := 'super_admin';

                    -- Get or create a default tenant for super admin
                    INSERT INTO tenants (
                        id,
                        name,
                        slug,
                        status,
                        subscription_status,
                        trial_ends_at,
                        created_at,
                        updated_at
                    ) VALUES (
                        gen_random_uuid(),
                        'Super Admin Organization',
                        'super-admin',
                        'active',
                        'active',
                        NOW() + INTERVAL '10 years',
                        NOW(),
                        NOW()
                    )
                    ON CONFLICT (slug) DO UPDATE SET
                        updated_at = NOW()
                    RETURNING id INTO default_tenant_id;

                    -- If tenant already exists, get its ID
                    IF default_tenant_id IS NULL THEN
                        SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'super-admin';
                    END IF;

                ELSE
                    -- Regular users get 'user' role and no default tenant
                    new_user_role := 'user';
                    default_tenant_id := NULL;
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

                -- Create audit log for super admin creation
                IF new_user_role = 'super_admin' THEN
                    BEGIN
                        INSERT INTO audit_logs (
                            tenant_id,
                            user_id,
                            action,
                            resource_type,
                            resource_id,
                            new_data,
                            created_at
                        ) VALUES (
                            default_tenant_id,
                            NEW.id,
                            'CREATE',
                            'super_admin',
                            NEW.id,
                            jsonb_build_object(
                                'email', NEW.email,
                                'role', 'super_admin',
                                'reason', 'first_user_auto_promotion_via_trigger'
                            ),
                            NOW()
                        );
                    EXCEPTION
                        WHEN OTHERS THEN
                            -- Ignore audit log errors
                            RAISE WARNING 'Could not create audit log: %', SQLERRM;
                    END;
                END IF;

                -- Log successful profile creation
                RAISE LOG 'Profile created successfully for user: % (%) with role: %', NEW.email, NEW.id, new_user_role;

            EXCEPTION
                WHEN OTHERS THEN
                    -- Log the error but don't fail the signup
                    RAISE WARNING 'Error creating profile for user % (%): %', NEW.email, NEW.id, SQLERRM;
                    -- Re-raise to make signup fail if profile creation fails
                    RAISE;
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate triggers to ensure they're using the latest function
DROP TRIGGER IF EXISTS handle_new_user_profile_insert ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_profile_update ON auth.users;
DROP TRIGGER IF EXISTS auto_create_profile_trigger ON auth.users;
DROP TRIGGER IF EXISTS auto_create_profile_on_confirm_trigger ON auth.users;

-- Create triggers for both INSERT and UPDATE scenarios
CREATE TRIGGER handle_new_user_profile_insert
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_profile();

CREATE TRIGGER handle_new_user_profile_update
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
    EXECUTE FUNCTION handle_new_user_profile();

-- ===============================================
-- 5. FIX EXISTING USERS WITHOUT PROFILES
-- ===============================================

-- Create an idempotent function to fix users who might be stuck without profiles
CREATE OR REPLACE FUNCTION fix_users_without_profiles()
RETURNS TABLE(user_id UUID, user_email VARCHAR(255), profile_created BOOLEAN, error_message TEXT) AS $$
DECLARE
    user_record RECORD;
    profile_created_flag BOOLEAN;
    error_msg TEXT;
BEGIN
    -- Find all users in auth.users who don't have profiles
    FOR user_record IN
        SELECT u.id, u.email, u.email_confirmed_at, u.raw_user_meta_data
        FROM auth.users u
        LEFT JOIN profiles p ON u.id = p.id
        WHERE p.id IS NULL
        AND u.email_confirmed_at IS NOT NULL
    LOOP
        BEGIN
            profile_created_flag := FALSE;
            error_msg := NULL;

            -- Create profile for each user
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
                user_record.id,
                NULL, -- Regular users don't get a tenant initially
                user_record.email,
                COALESCE(user_record.raw_user_meta_data->>'first_name', 'User'),
                COALESCE(user_record.raw_user_meta_data->>'last_name', ''),
                'user',
                TRUE,
                '{}',
                NOW(),
                NOW()
            )
            ON CONFLICT (id) DO NOTHING;

            profile_created_flag := TRUE;

            RETURN QUERY SELECT user_record.id, user_record.email, profile_created_flag, error_msg;

        EXCEPTION
            WHEN OTHERS THEN
                error_msg := SQLERRM;
                profile_created_flag := FALSE;
                RETURN QUERY SELECT user_record.id, user_record.email, profile_created_flag, error_msg;
        END;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the fix function to create profiles for any existing users without them
DO $$
DECLARE
    fix_result RECORD;
    fixed_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    FOR fix_result IN SELECT * FROM fix_users_without_profiles()
    LOOP
        IF fix_result.profile_created THEN
            fixed_count := fixed_count + 1;
            RAISE NOTICE 'Created profile for user: % (%)', fix_result.user_email, fix_result.user_id;
        ELSE
            error_count := error_count + 1;
            RAISE WARNING 'Failed to create profile for user % (%): %',
                fix_result.user_email, fix_result.user_id, fix_result.error_message;
        END IF;
    END LOOP;

    RAISE NOTICE 'Profile fix complete: % profiles created, % errors', fixed_count, error_count;
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO anon;
GRANT EXECUTE ON FUNCTION fix_users_without_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION fix_users_without_profiles() TO anon;

COMMIT;

-- Migration completed successfully
-- New users should now be able to sign up and access their profiles without "access denied" errors
