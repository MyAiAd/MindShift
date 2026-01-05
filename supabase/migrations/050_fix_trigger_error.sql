-- ===============================================
-- FIX TRIGGER CAUSING SIGNUP FAILURES
-- ===============================================
-- Migration 050: Simplified trigger with better error handling
-- VERSION: 2025-01-05-v1
--
-- This version removes problematic audit log creation and focuses
-- on just creating profiles successfully
-- ===============================================

BEGIN;

-- Drop existing triggers
DROP TRIGGER IF EXISTS handle_new_user_profile_insert ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_profile_update ON auth.users;

-- Create a simplified, safer trigger function
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
                    BEGIN
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
                    EXCEPTION
                        WHEN OTHERS THEN
                            -- If tenant creation fails, continue without it
                            RAISE WARNING 'Could not create/get tenant: %', SQLERRM;
                            default_tenant_id := NULL;
                    END;

                ELSE
                    -- Regular users get 'user' role and no default tenant
                    new_user_role := 'user';
                    default_tenant_id := NULL;
                END IF;

                -- Create the user profile (CRITICAL - must succeed)
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

                -- Skip audit log creation - it was causing errors
                -- Audit logs can be added later if needed

                -- Log successful profile creation
                RAISE LOG 'Profile created successfully for user: % (%) with role: %', NEW.email, NEW.id, new_user_role;

            EXCEPTION
                WHEN OTHERS THEN
                    -- Log the error with details
                    RAISE WARNING 'Error creating profile for user % (%): % (SQLSTATE: %)',
                        NEW.email, NEW.id, SQLERRM, SQLSTATE;
                    -- Re-raise to prevent user creation from succeeding
                    RAISE;
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

COMMIT;

-- Migration completed
-- The trigger now has better error handling and skips audit log creation
-- which was likely causing the "Database error saving new user" error
