-- ===============================================
-- ENABLE PROPER TRIGGERS FOR AUTOMATIC PROFILE CREATION
-- ===============================================
-- This migration creates working triggers that automatically create profiles
-- when users sign up, without causing 500 errors

-- Drop the existing logging trigger
DROP TRIGGER IF EXISTS log_signup_trigger ON auth.users;

-- Create a robust trigger function that handles profile creation
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
    existing_user_count INTEGER;
    new_user_role user_role;
    default_tenant_id UUID;
    profile_exists BOOLEAN;
BEGIN
    -- Only proceed if this is a new user with confirmed email
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
                
                -- Log successful profile creation
                RAISE LOG 'Profile created successfully for user: % with role: %', NEW.email, new_user_role;
                
            EXCEPTION
                WHEN OTHERS THEN
                    -- Log the error but don't fail the signup
                    RAISE WARNING 'Error creating profile for user %: %', NEW.email, SQLERRM;
                    -- Continue with signup even if profile creation fails
            END;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO anon;

-- Migration completed successfully
-- Automatic profile creation is now enabled with proper error handling 