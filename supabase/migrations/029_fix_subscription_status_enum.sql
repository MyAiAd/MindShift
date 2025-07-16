-- ===============================================
-- FIX SUBSCRIPTION STATUS ENUM ERROR
-- ===============================================
-- This migration fixes the "invalid input value for enum subscription_status: 'premium'" error
-- by correcting the handle_new_user_registration function to use valid enum values

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
            'active',  -- Changed from 'premium' to 'active'
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

-- Grant execute permissions on the function
GRANT EXECUTE ON FUNCTION handle_new_user_registration(UUID, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_registration(UUID, VARCHAR, VARCHAR, VARCHAR) TO anon;

-- Migration completed successfully
-- The 400 error with invalid enum value should now be resolved 