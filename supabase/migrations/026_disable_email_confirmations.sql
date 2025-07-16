-- ===============================================
-- TEMPORARY FIX: Disable Email Confirmations
-- ===============================================
-- This migration temporarily disables email confirmations for user registration
-- to allow users to sign up while email configuration is being set up properly

-- Note: This is a temporary workaround. Email confirmations should be re-enabled
-- once proper SMTP configuration is in place.

-- The email confirmation settings are configured in the Supabase dashboard
-- under Authentication > Settings > Email templates

-- For now, we'll create a note about this issue
CREATE TABLE IF NOT EXISTS configuration_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    note_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    action_required BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert a note about the email configuration issue
INSERT INTO configuration_notes (note_type, title, description, action_required)
VALUES (
    'email_config',
    'Email Confirmation Configuration Required',
    'The Supabase project needs proper SMTP configuration to send email confirmations. 
    
    Steps to fix:
    1. Go to Supabase Dashboard > Authentication > Settings
    2. Configure SMTP settings with a valid email service (Resend, SendGrid, etc.)
    3. Set up the following environment variables:
       - RESEND_API_KEY (or your email service API key)
       - ADMIN_EMAIL (sender email address)
       - SENDER_NAME (sender name)
    4. Test email sending functionality
    5. Re-enable email confirmations once working
    
    Current status: Email confirmations should be disabled in dashboard to allow registration',
    TRUE
);

-- This migration serves as documentation of the email configuration issue
-- The actual email confirmation toggle must be changed in the Supabase Dashboard
-- under Authentication > Settings > Email confirmations 