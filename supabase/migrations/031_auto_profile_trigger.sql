-- ===============================================
-- AUTO PROFILE CREATION TRIGGER
-- ===============================================
-- This migration creates a trigger to automatically create profiles
-- when users are created in auth.users, bypassing the manual registration process

-- Create a function to automatically create profiles
CREATE OR REPLACE FUNCTION auto_create_profile()
RETURNS TRIGGER AS $$
DECLARE
    existing_user_count INTEGER;
    new_user_role user_role;
    default_tenant_id UUID;
BEGIN
    -- Check if this is the first user in the system
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
    
    -- Create the user profile automatically
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
    )
    ON CONFLICT (id) DO UPDATE SET
        email = NEW.email,
        first_name = COALESCE(NEW.raw_user_meta_data->>'first_name', profiles.first_name),
        last_name = COALESCE(NEW.raw_user_meta_data->>'last_name', profiles.last_name),
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
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS auto_create_profile_trigger ON auth.users;
CREATE TRIGGER auto_create_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_profile();

-- Also create a trigger for when users are updated (email confirmed)
CREATE OR REPLACE FUNCTION auto_create_profile_on_confirm()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run if email_confirmed_at changed from NULL to a value
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
        -- Check if profile exists
        IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = NEW.id) THEN
            -- Use the same logic as the insert trigger
            PERFORM auto_create_profile();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the update trigger
DROP TRIGGER IF EXISTS auto_create_profile_on_confirm_trigger ON auth.users;
CREATE TRIGGER auto_create_profile_on_confirm_trigger
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
    EXECUTE FUNCTION auto_create_profile_on_confirm();

-- Create a function to manually fix existing users without profiles
CREATE OR REPLACE FUNCTION fix_users_without_profiles()
RETURNS JSONB AS $$
DECLARE
    user_record RECORD;
    result JSONB;
    fixed_count INTEGER := 0;
BEGIN
    -- Find all users in auth.users who don't have profiles
    FOR user_record IN 
        SELECT u.id, u.email, u.email_confirmed_at, u.raw_user_meta_data
        FROM auth.users u
        LEFT JOIN profiles p ON u.id = p.id
        WHERE p.id IS NULL
        AND u.email_confirmed_at IS NOT NULL
    LOOP
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
        
        fixed_count := fixed_count + 1;
    END LOOP;
    
    result := jsonb_build_object(
        'success', true,
        'message', 'Fixed users without profiles',
        'users_fixed', fixed_count
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION fix_users_without_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION fix_users_without_profiles() TO anon;

-- Migration completed successfully
-- Profiles will now be created automatically when users sign up or confirm their email 