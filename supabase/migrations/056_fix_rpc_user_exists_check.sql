-- ===============================================
-- FIX RPC FUNCTION - ADD USER EXISTS CHECK
-- ===============================================
-- Migration 056: Add guard to prevent foreign key errors
-- VERSION: 2025-01-05-v3
--
-- The handle_new_user_registration RPC was failing with foreign key
-- constraint violations when called with user IDs that don't exist in auth.users.
-- This can happen with stale sessions from deleted users.
--
-- This migration adds a check to verify the user exists before attempting
-- to create a profile.
-- ===============================================

BEGIN;

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
    user_exists BOOLEAN;
    result JSONB;
BEGIN
    -- GUARD: Check if user exists in auth.users first
    SELECT EXISTS(
        SELECT 1 FROM auth.users WHERE id = user_id
    ) INTO user_exists;

    IF NOT user_exists THEN
        -- Return error if user doesn't exist
        RETURN jsonb_build_object(
            'success', false,
            'error', 'user_not_found',
            'message', 'User does not exist in auth.users. User may have been deleted or session is stale.'
        );
    END IF;

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

    -- Verify tenant exists
    IF default_tenant_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'tenant_not_found',
            'message', 'Required tenant does not exist. Run migration 052.'
        );
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

    -- Return success result
    result := jsonb_build_object(
        'success', true,
        'user_id', user_id,
        'role', new_user_role,
        'tenant_id', default_tenant_id,
        'is_super_admin', new_user_role = 'super_admin',
        'message', CASE
            WHEN new_user_role = 'super_admin' THEN 'First user promoted to super admin'
            ELSE 'User profile created with default tenant'
        END
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions (idempotent)
GRANT EXECUTE ON FUNCTION handle_new_user_registration(UUID, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_registration(UUID, VARCHAR, VARCHAR, VARCHAR) TO anon;

COMMIT;

-- Migration completed
-- The RPC function will now gracefully handle cases where the user doesn't exist
-- instead of failing with a foreign key constraint violation
