-- Create Super Admin User Migration
-- This migration creates a super admin user with full access to all tenants

-- Create super admin user directly with a specific UUID
DO $$
DECLARE
    admin_user_id UUID := 'e3b0c442-98fc-1c14-9afb-92266f7e1234'; -- Fixed UUID for super admin
    existing_user_id UUID;
BEGIN
    -- Check if user already exists
    SELECT id INTO existing_user_id FROM auth.users WHERE email = 'admin@yourdomain.com';
    
    -- If user doesn't exist, create them
    IF existing_user_id IS NULL THEN
        INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            created_at,
            updated_at,
            phone,
            phone_confirmed_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            admin_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'admin@yourdomain.com',
            crypt('CHANGE_ME_SUPER_ADMIN_PASSWORD', gen_salt('bf')),
            NOW(),
            NOW(),
            '{"provider": "email", "providers": ["email"]}',
            '{"first_name": "Sage", "last_name": "Administrator"}',
            false,
            NOW(),
            NOW(),
            NULL,
            NULL,
            '',
            '',
            '',
            ''
        );
        
        -- Set the user ID for creating the profile
        existing_user_id := admin_user_id;
    ELSE
        -- Update existing user's password
        UPDATE auth.users SET 
            encrypted_password = crypt('CHANGE_ME_SUPER_ADMIN_PASSWORD', gen_salt('bf')),
            updated_at = NOW()
        WHERE id = existing_user_id;
    END IF;
    
    -- Create the super admin profile
    INSERT INTO profiles (
        id,
        tenant_id,
        email,
        first_name,
        last_name,
        role,
        subscription_tier,
        is_active,
        settings,
        created_at,
        updated_at
    ) VALUES (
        existing_user_id,
        NULL, -- Super admin doesn't belong to any specific tenant
        'admin@yourdomain.com',
        'Sage',
        'Administrator',
        'super_admin',
        'level_2', -- Full access to all features
        true,
        '{"super_admin": true, "full_access": true}',
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        email = 'admin@yourdomain.com',
        first_name = 'Sage',
        last_name = 'Administrator',
        role = 'super_admin',
        subscription_tier = 'level_2',
        is_active = true,
        settings = '{"super_admin": true, "full_access": true}',
        updated_at = NOW();
    
    -- Create audit log entry
    INSERT INTO audit_logs (
        tenant_id,
        user_id,
        action,
        resource_type,
        resource_id,
        new_data,
        created_at
    ) VALUES (
        NULL,
        existing_user_id,
        'create_super_admin',
        'profile',
        existing_user_id,
        jsonb_build_object(
            'email', 'admin@yourdomain.com',
            'role', 'super_admin',
            'subscription_tier', 'level_2'
        ),
        NOW()
    );
END $$;

-- Create a special RLS policy to allow super admin to bypass tenant restrictions
DO $$ BEGIN
    DROP POLICY IF EXISTS "Super admins can access all data" ON tenants;
    CREATE POLICY "Super admins can access all data" ON tenants
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Add super admin policy to profiles table
DO $$ BEGIN
    DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
    CREATE POLICY "Super admins can view all profiles" ON profiles
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Update existing RLS policies to include super admin access
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON profiles;
    CREATE POLICY "Users can view profiles in their tenant" ON profiles
        FOR SELECT USING (
            tenant_id IN (
                SELECT tenant_id FROM profiles WHERE id = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$; 