-- ===============================================
-- TEMPORARILY DISABLE TRIGGERS TO ISOLATE 500 ERROR
-- ===============================================
-- This migration disables triggers to test if they're causing the signup failure

-- Disable the triggers that might be causing the 500 error
DROP TRIGGER IF EXISTS auto_create_profile_trigger ON auth.users;
DROP TRIGGER IF EXISTS auto_create_profile_on_confirm_trigger ON auth.users;

-- Create a simple logging function to see if triggers are the issue
CREATE OR REPLACE FUNCTION log_signup_attempt()
RETURNS TRIGGER AS $$
BEGIN
    -- Just log the signup attempt without creating profiles
    RAISE LOG 'User signup attempt: % with email: %', NEW.id, NEW.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a minimal trigger just for logging
CREATE TRIGGER log_signup_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION log_signup_attempt();

-- Migration completed
-- Triggers disabled - test signup now to see if 500 error persists 