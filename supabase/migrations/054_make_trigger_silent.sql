-- ===============================================
-- MAKE TRIGGER COMPLETELY SILENT
-- ===============================================
-- Migration 054: Ensure trigger never blocks email confirmation
-- VERSION: 2025-01-05-v1
--
-- Even WARNINGS can cause Supabase to fail email confirmation.
-- This migration makes the trigger completely silent - it will
-- try to create the profile but won't raise ANY errors or warnings
-- that could block the confirmation process.
-- ===============================================

BEGIN;

-- Drop existing trigger
DROP TRIGGER IF EXISTS handle_new_user_profile_update ON auth.users;

-- Create completely silent trigger function
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
    existing_user_count INTEGER;
    new_user_role user_role;
    default_tenant_id UUID;
    profile_exists BOOLEAN;
    tenant_slug TEXT;
BEGIN
    -- Only run on email confirmation
    IF TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN

        -- Wrap everything in exception handler to prevent ANY errors from propagating
        BEGIN
            -- Check if profile already exists
            SELECT EXISTS(SELECT 1 FROM profiles WHERE id = NEW.id) INTO profile_exists;

            -- Only create if doesn't exist
            IF NOT profile_exists THEN
                -- Count confirmed users
                SELECT COUNT(*) INTO existing_user_count
                FROM auth.users
                WHERE id != NEW.id AND email_confirmed_at IS NOT NULL;

                -- Determine role and tenant
                IF existing_user_count = 0 THEN
                    new_user_role := 'super_admin';
                    tenant_slug := 'super-admin';
                ELSE
                    new_user_role := 'user';
                    tenant_slug := 'default';
                END IF;

                -- Get tenant ID
                SELECT id INTO default_tenant_id
                FROM tenants
                WHERE slug = tenant_slug;

                -- Only proceed if tenant exists
                IF default_tenant_id IS NOT NULL THEN
                    -- Create profile
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
                END IF;
            END IF;

        EXCEPTION
            WHEN OTHERS THEN
                -- Completely silent - don't even log
                -- The RPC function will create the profile if this fails
                NULL;
        END;
    END IF;

    -- ALWAYS return NEW to allow the confirmation to succeed
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO anon;

-- Recreate trigger
CREATE TRIGGER handle_new_user_profile_update
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
    EXECUTE FUNCTION handle_new_user_profile();

COMMIT;

-- Migration completed
-- The trigger will now NEVER block email confirmation
-- If profile creation fails, the frontend RPC function will create it as fallback
