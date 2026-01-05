-- ===============================================
-- FIX REGULAR USERS NEED TENANT FOR DASHBOARD ACCESS
-- ===============================================
-- Migration 051: Give all users a default tenant
-- VERSION: 2025-01-05-v1
--
-- The dashboard layout requires users to have a tenant_id unless they're super_admin.
-- This migration ensures all users get a default tenant when they sign up.
-- ===============================================

BEGIN;

-- Update the RPC function to create a default tenant for ALL users
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
        -- Regular users get 'user' role and a DEFAULT tenant
        new_user_role := 'user';

        -- Create or get the default tenant for regular users
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
            'Default Organization',
            'default',
            'trial',
            'trialing',
            NOW() + INTERVAL '30 days',
            NOW(),
            NOW()
        )
        ON CONFLICT (slug) DO UPDATE SET
            updated_at = NOW()
        RETURNING id INTO default_tenant_id;

        -- If tenant already exists, get its ID
        IF default_tenant_id IS NULL THEN
            SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'default';
        END IF;
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

-- Grant execute permissions on the RPC function
GRANT EXECUTE ON FUNCTION handle_new_user_registration(UUID, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_registration(UUID, VARCHAR, VARCHAR, VARCHAR) TO anon;

-- Fix the existing user who has no tenant
UPDATE profiles
SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1)
WHERE tenant_id IS NULL
AND role != 'super_admin';

COMMIT;

-- Migration completed
-- All regular users now get a default tenant, allowing them to access the dashboard
