-- ===============================================
-- FIX AUTH.USERS FOREIGN KEY CONSTRAINT ERROR
-- ===============================================
-- This migration fixes the foreign key constraint violation by:
-- 1. Checking if user exists in auth.users before inserting profile
-- 2. Adding proper error handling and debugging information
-- 3. Ensuring the user ID is valid before proceeding

-- Fix the handle_new_user_registration function
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
    user_exists BOOLEAN;
    auth_user_record RECORD;
BEGIN
    -- First, check if the user exists in auth.users
    SELECT EXISTS(
        SELECT 1 FROM auth.users 
        WHERE id = user_id
    ) INTO user_exists;
    
    IF NOT user_exists THEN
        -- Log the error and return failure
        RAISE NOTICE 'User ID % does not exist in auth.users table', user_id;
        
        -- Try to get some debug info about the user
        SELECT id, email, email_confirmed_at, created_at INTO auth_user_record
        FROM auth.users 
        WHERE email = user_email
        LIMIT 1;
        
        IF auth_user_record IS NOT NULL THEN
            RAISE NOTICE 'Found user with email % but different ID: %', user_email, auth_user_record.id;
        END IF;
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'user_not_found',
            'message', 'User ID does not exist in auth.users table',
            'user_id', user_id,
            'email', user_email,
            'debug_info', jsonb_build_object(
                'user_exists', user_exists,
                'email_match', auth_user_record IS NOT NULL,
                'matched_user_id', auth_user_record.id
            )
        );
    END IF;
    
    -- Check if profile already exists
    IF EXISTS(SELECT 1 FROM profiles WHERE id = user_id) THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Profile already exists',
            'user_id', user_id,
            'action', 'profile_exists'
        );
    END IF;
    
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
    );
    
    -- Create audit log for super admin creation
    IF new_user_role = 'super_admin' THEN
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
                'reason', 'first_user_auto_promotion'
            ),
            NOW()
        );
    END IF;
    
    -- Return success result
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
    
EXCEPTION
    WHEN foreign_key_violation THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'foreign_key_violation',
            'message', 'Foreign key constraint violation - user may not exist in auth.users',
            'user_id', user_id,
            'email', user_email
        );
    WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'unique_violation',
            'message', 'Profile already exists for this user',
            'user_id', user_id,
            'email', user_email
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'unknown_error',
            'message', SQLERRM,
            'user_id', user_id,
            'email', user_email
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on the function
GRANT EXECUTE ON FUNCTION handle_new_user_registration(UUID, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_registration(UUID, VARCHAR, VARCHAR, VARCHAR) TO anon;

-- Add a helper function to debug auth.users vs session mismatch
CREATE OR REPLACE FUNCTION debug_auth_user_info(user_email VARCHAR(255))
RETURNS JSONB AS $$
DECLARE
    auth_user_record RECORD;
    current_user_id UUID;
    result JSONB;
BEGIN
    current_user_id := auth.uid();
    
    SELECT id, email, email_confirmed_at, created_at, updated_at INTO auth_user_record
    FROM auth.users 
    WHERE email = user_email
    LIMIT 1;
    
    result := jsonb_build_object(
        'current_session_user_id', current_user_id,
        'email_searched', user_email,
        'auth_user_found', auth_user_record IS NOT NULL,
        'auth_user_id', auth_user_record.id,
        'auth_user_email', auth_user_record.email,
        'auth_user_confirmed', auth_user_record.email_confirmed_at,
        'auth_user_created', auth_user_record.created_at,
        'id_match', current_user_id = auth_user_record.id
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on the debug function
GRANT EXECUTE ON FUNCTION debug_auth_user_info(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION debug_auth_user_info(VARCHAR) TO anon;

-- Migration completed successfully
-- This should fix the foreign key constraint violation by checking user existence first 