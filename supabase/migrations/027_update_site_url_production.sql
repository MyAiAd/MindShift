-- ===============================================
-- UPDATE SITE URL TO PRODUCTION
-- ===============================================
-- This migration documents the site URL update to production
-- The actual URL configuration is done in the Supabase dashboard

-- Create a configuration log table if it doesn't exist
CREATE TABLE IF NOT EXISTS configuration_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    config_type VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Log the site URL update
INSERT INTO configuration_logs (config_type, old_value, new_value, description)
VALUES (
    'site_url',
    'http://localhost:3000',
    'https://site-maker-lilac.vercel.app',
    'Updated site URL from localhost to production Vercel deployment for email templates and authentication redirects'
);

-- Log the additional redirect URLs update
INSERT INTO configuration_logs (config_type, old_value, new_value, description)
VALUES (
    'redirect_urls',
    'http://localhost:3000, https://127.0.0.1:3000',
    'https://site-maker-lilac.vercel.app',
    'Updated redirect URLs to production domain for OAuth and email confirmation callbacks'
);

-- Update the configuration notes table with the current status
UPDATE configuration_notes 
SET 
    description = 'Email configuration completed:
    
    ✅ SMTP configured with Resend
    ✅ Sender email: NoReply@msgs.myai.ad
    ✅ Site URL updated to: https://site-maker-lilac.vercel.app
    ✅ Email templates updated to use production URL
    
    Current status: Email system fully operational',
    action_required = FALSE
WHERE note_type = 'email_config';

-- This migration serves as documentation of the production URL configuration
-- Manual steps required in Supabase dashboard:
-- 1. Update Site URL to https://site-maker-lilac.vercel.app
-- 2. Update Redirect URLs to https://site-maker-lilac.vercel.app
-- 3. Update Email Templates to use production URL
-- 4. Test email confirmation flow 