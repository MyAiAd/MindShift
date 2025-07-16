-- ============================================================================
-- Migration 019: Add Phone Number Support to Profiles
-- ============================================================================
-- This migration adds phone number fields to support SMS notifications

-- Add phone number field to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS phone_verification_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS phone_verification_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_verified ON profiles(phone_verified);

-- Add phone number to notification preferences in community system
ALTER TABLE community_notification_preferences 
ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT FALSE;

-- Update the database types to include phone fields
COMMENT ON COLUMN profiles.phone_number IS 'User phone number in E.164 format (e.g., +1234567890)';
COMMENT ON COLUMN profiles.phone_verified IS 'Whether the phone number has been verified';
COMMENT ON COLUMN profiles.phone_verification_code IS 'Temporary verification code for phone verification';
COMMENT ON COLUMN profiles.phone_verification_expires_at IS 'When the verification code expires';

-- Function to format phone number to E.164 format
CREATE OR REPLACE FUNCTION format_phone_number(input_phone TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Remove all non-digit characters
    input_phone := regexp_replace(input_phone, '[^0-9]', '', 'g');
    
    -- Add country code if missing (assumes US +1 if 10 digits)
    IF length(input_phone) = 10 THEN
        input_phone := '1' || input_phone;
    END IF;
    
    -- Add + prefix
    IF length(input_phone) = 11 AND left(input_phone, 1) = '1' THEN
        RETURN '+' || input_phone;
    END IF;
    
    -- Return null if invalid format
    RETURN NULL;
END;
$$ LANGUAGE plpgsql; 