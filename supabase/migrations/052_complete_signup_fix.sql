-- ===============================================
-- COMPLETE SIGNUP FIX - COMPREHENSIVE SOLUTION
-- ===============================================
-- Migration 052: Complete fix for new user signup and dashboard access
-- VERSION: 2025-01-05-v1
--
-- This migration does everything needed for signups to work:
-- 1. Creates default tenant for regular users
-- 2. Updates trigger to assign tenants automatically
-- 3. Fixes existing users without tenants
-- 4. Re-enables triggers
-- ===============================================

BEGIN;

-- ===============================================
-- STEP 1: ENSURE DEFAULT TENANT EXISTS
-- ===============================================

-- Create default tenant if it doesn't exist
INSERT INTO tenants (
    name,
    slug,
    status,
    subscription_status,
    trial_ends_at,
    created_at,
    updated_at
)
SELECT
    'Default Organization',
    'default',
    'trial',
    'trialing',
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM tenants WHERE slug = 'default'
);

-- Create super admin tenant if it doesn't exist
INSERT INTO tenants (
    name,
    slug,
    status,
    subscription_status,
    trial_ends_at,
    created_at,
    updated_at
)
SELECT
    'Super Admin Organization',
    'super-admin',
    'active',
    'active',
    NOW() + INTERVAL '10 years',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM tenants WHERE slug = 'super-admin'
);

-- ===============================================
-- STEP 2: UPDATE TRIGGER FUNCTION WITH TENANT LOGIC
-- ===============================================

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

                -- Determine role and tenant based on user count
                IF existing_user_count = 0 THEN
                    -- First user becomes super admin
                    new_user_role := 'super_admin';
                    SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'super-admin';
                ELSE
                    -- Regular users get default tenant
                    new_user_role := 'user';
                    SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'default';
                END IF;

                -- If tenant doesn't exist (shouldn't happen after migration), log warning
                IF default_tenant_id IS NULL THEN
                    RAISE WARNING 'No tenant found for user % (slug: %)',
                        NEW.email,
                        CASE WHEN existing_user_count = 0 THEN 'super-admin' ELSE 'default' END;
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

                -- Log successful profile creation
                RAISE LOG 'Profile created for user: % (%) with role: % and tenant: %',
                    NEW.email, NEW.id, new_user_role, default_tenant_id;

            EXCEPTION
                WHEN OTHERS THEN
                    -- Log detailed error
                    RAISE WARNING 'Error creating profile for user % (%): % (SQLSTATE: %)',
                        NEW.email, NEW.id, SQLERRM, SQLSTATE;
                    -- Re-raise to prevent user creation from succeeding with broken profile
                    RAISE;
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================================
-- STEP 3: UPDATE RPC FUNCTION WITH TENANT LOGIC
-- ===============================================

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

    -- Determine role and tenant
    IF existing_user_count = 0 THEN
        new_user_role := 'super_admin';
        SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'super-admin';
    ELSE
        new_user_role := 'user';
        SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'default';
    END IF;

    -- Create or update the user profile
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
        tenant_id = COALESCE(EXCLUDED.tenant_id, profiles.tenant_id),
        email = EXCLUDED.email,
        first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
        last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
        updated_at = NOW();

    -- Return result
    result := jsonb_build_object(
        'success', true,
        'user_id', user_id,
        'role', new_user_role,
        'tenant_id', default_tenant_id,
        'is_super_admin', new_user_role = 'super_admin',
        'message', CASE
            WHEN new_user_role = 'super_admin' THEN 'First user promoted to super admin'
            ELSE 'Regular user profile created with default tenant'
        END
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO anon;
GRANT EXECUTE ON FUNCTION handle_new_user_registration(UUID, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_registration(UUID, VARCHAR, VARCHAR, VARCHAR) TO anon;

-- ===============================================
-- STEP 4: FIX EXISTING USERS WITHOUT TENANTS
-- ===============================================

-- Get the default tenant ID
DO $$
DECLARE
    default_tenant_id UUID;
    updated_count INTEGER;
BEGIN
    -- Get default tenant ID
    SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'default';

    IF default_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Default tenant not found! This should not happen.';
    END IF;

    -- Update all regular users without tenants
    UPDATE profiles
    SET tenant_id = default_tenant_id,
        updated_at = NOW()
    WHERE tenant_id IS NULL
    AND role != 'super_admin';

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % existing users with default tenant', updated_count;
END $$;

-- ===============================================
-- STEP 5: RE-ENABLE TRIGGERS
-- ===============================================

-- Drop existing triggers first (idempotent)
DROP TRIGGER IF EXISTS handle_new_user_profile_insert ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_profile_update ON auth.users;

-- Create triggers
CREATE TRIGGER handle_new_user_profile_insert
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_profile();

CREATE TRIGGER handle_new_user_profile_update
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
    EXECUTE FUNCTION handle_new_user_profile();

COMMIT;

-- ===============================================
-- VERIFICATION
-- ===============================================

-- Check that tenants exist
DO $$
DECLARE
    default_exists BOOLEAN;
    super_admin_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM tenants WHERE slug = 'default') INTO default_exists;
    SELECT EXISTS(SELECT 1 FROM tenants WHERE slug = 'super-admin') INTO super_admin_exists;

    IF default_exists AND super_admin_exists THEN
        RAISE NOTICE '✓ Both default and super-admin tenants exist';
    ELSE
        RAISE WARNING '✗ Missing tenants: default=%, super-admin=%', default_exists, super_admin_exists;
    END IF;
END $$;

-- Migration completed successfully
-- All new users will now automatically get a tenant assigned
-- Existing users without tenants have been fixed
-- Dashboard access should work for all users
