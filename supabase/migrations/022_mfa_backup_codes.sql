-- ===============================================
-- REUSABLE MYAI TEMPLATE - MFA BACKUP CODES
-- ===============================================
-- Database schema for Two-Factor Authentication backup codes

-- MFA Backup Codes Table
-- This table stores hashed backup codes that users can use to bypass 2FA
CREATE TABLE IF NOT EXISTS mfa_backup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- Hashed backup code
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one backup code per user
    UNIQUE(user_id, code)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_user_id ON mfa_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_code ON mfa_backup_codes(code);
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_used ON mfa_backup_codes(used);

-- Enable Row Level Security
ALTER TABLE mfa_backup_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mfa_backup_codes
-- Users can only access their own backup codes
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage their own backup codes" ON mfa_backup_codes;
    CREATE POLICY "Users can manage their own backup codes" ON mfa_backup_codes
        FOR ALL USING (auth.uid() = user_id);
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Super admins can manage all backup codes
DO $$ BEGIN
    DROP POLICY IF EXISTS "Super admins can manage all backup codes" ON mfa_backup_codes;
    CREATE POLICY "Super admins can manage all backup codes" ON mfa_backup_codes
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_backup_codes TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Add function to clean up expired backup codes (optional)
CREATE OR REPLACE FUNCTION cleanup_expired_mfa_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Remove backup codes older than 1 year
    DELETE FROM mfa_backup_codes 
    WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mfa_backup_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_mfa_backup_codes_updated_at ON mfa_backup_codes;
    CREATE TRIGGER update_mfa_backup_codes_updated_at
        BEFORE UPDATE ON mfa_backup_codes
        FOR EACH ROW
        EXECUTE FUNCTION update_mfa_backup_codes_updated_at();
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$; 