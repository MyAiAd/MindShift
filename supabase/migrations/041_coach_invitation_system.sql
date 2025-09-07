-- Coach Invitation System Migration
-- This migration is IDEMPOTENT - safe to run multiple times
-- Creates coach invitation system with secure tokens

-- Create coach invitations table
CREATE TABLE IF NOT EXISTS coach_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
    invitation_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT coach_invitations_email_tenant_unique UNIQUE(email, tenant_id),
    CONSTRAINT coach_invitations_status_check CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

-- Create indexes for coach invitations
CREATE INDEX IF NOT EXISTS idx_coach_invitations_tenant_id ON coach_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_coach_invitations_email ON coach_invitations(email);
CREATE INDEX IF NOT EXISTS idx_coach_invitations_token ON coach_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_coach_invitations_status ON coach_invitations(status);
CREATE INDEX IF NOT EXISTS idx_coach_invitations_expires_at ON coach_invitations(expires_at);

-- Function to generate secure invitation token
CREATE OR REPLACE FUNCTION generate_coach_invitation_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    token TEXT;
    exists_check BOOLEAN;
BEGIN
    LOOP
        -- Generate a random token
        token := encode(gen_random_bytes(32), 'base64');
        
        -- Remove any characters that might cause URL issues
        token := replace(replace(replace(token, '/', '_'), '+', '-'), '=', '');
        
        -- Check if token already exists
        SELECT EXISTS(SELECT 1 FROM coach_invitations WHERE invitation_token = token) INTO exists_check;
        
        -- If token doesn't exist, we can use it
        IF NOT exists_check THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN token;
END;
$$;

-- Function to create coach invitation
CREATE OR REPLACE FUNCTION create_coach_invitation(
    invitation_email VARCHAR(255),
    invitation_first_name VARCHAR(100) DEFAULT NULL,
    invitation_last_name VARCHAR(100) DEFAULT NULL,
    inviter_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    current_profile RECORD;
    invitation_token TEXT;
    invitation_id UUID;
    expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get current profile
    SELECT * INTO current_profile
    FROM profiles 
    WHERE id = current_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;
    
    -- Check if user has permission to invite coaches
    IF current_profile.role NOT IN ('tenant_admin', 'super_admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions to invite coaches');
    END IF;
    
    -- Use provided tenant_id or current user's tenant_id
    IF inviter_tenant_id IS NULL THEN
        inviter_tenant_id := current_profile.tenant_id;
    END IF;
    
    -- For super admins, allow cross-tenant invitations, for others enforce tenant isolation
    IF current_profile.role != 'super_admin' AND inviter_tenant_id != current_profile.tenant_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot invite coaches to other tenants');
    END IF;
    
    -- Check if email is already invited or registered
    IF EXISTS (SELECT 1 FROM coach_invitations WHERE email = invitation_email AND tenant_id = inviter_tenant_id AND status = 'pending') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Coach invitation already exists for this email');
    END IF;
    
    IF EXISTS (SELECT 1 FROM profiles WHERE email = invitation_email AND tenant_id = inviter_tenant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'User with this email already exists in the system');
    END IF;
    
    -- Generate invitation token
    invitation_token := generate_coach_invitation_token();
    
    -- Set expiration to 7 days from now
    expires_at := NOW() + INTERVAL '7 days';
    
    -- Create invitation
    INSERT INTO coach_invitations (
        tenant_id,
        email,
        first_name,
        last_name,
        invited_by,
        invitation_token,
        expires_at,
        status
    ) VALUES (
        inviter_tenant_id,
        invitation_email,
        invitation_first_name,
        invitation_last_name,
        current_user_id,
        invitation_token,
        expires_at,
        'pending'
    ) RETURNING id INTO invitation_id;
    
    -- Return success with invitation details
    RETURN jsonb_build_object(
        'success', true,
        'invitation_id', invitation_id,
        'invitation_token', invitation_token,
        'expires_at', expires_at,
        'invite_url', '/auth/coach-signup?token=' || invitation_token,
        'message', 'Coach invitation created successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', SQLERRM
        );
END;
$$;

-- Function to validate and accept coach invitation
CREATE OR REPLACE FUNCTION accept_coach_invitation(
    invitation_token TEXT,
    user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    invitation RECORD;
BEGIN
    -- Get invitation details
    SELECT * INTO invitation
    FROM coach_invitations 
    WHERE invitation_token = invitation_token;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid invitation token');
    END IF;
    
    -- Check if invitation is still valid
    IF invitation.status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invitation is no longer valid');
    END IF;
    
    IF invitation.expires_at < NOW() THEN
        -- Mark as expired
        UPDATE coach_invitations 
        SET status = 'expired', updated_at = NOW()
        WHERE id = invitation.id;
        
        RETURN jsonb_build_object('success', false, 'error', 'Invitation has expired');
    END IF;
    
    -- Mark invitation as accepted
    UPDATE coach_invitations 
    SET 
        status = 'accepted',
        accepted_at = NOW(),
        accepted_by = user_id,
        updated_at = NOW()
    WHERE id = invitation.id;
    
    -- Return invitation details for user creation
    RETURN jsonb_build_object(
        'success', true,
        'invitation', jsonb_build_object(
            'id', invitation.id,
            'email', invitation.email,
            'first_name', invitation.first_name,
            'last_name', invitation.last_name,
            'tenant_id', invitation.tenant_id
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', SQLERRM
        );
END;
$$;

-- Function to get invitation details (for signup form pre-population)
CREATE OR REPLACE FUNCTION get_coach_invitation_details(invitation_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    invitation RECORD;
    tenant RECORD;
BEGIN
    -- Get invitation details
    SELECT * INTO invitation
    FROM coach_invitations 
    WHERE invitation_token = invitation_token;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid invitation token');
    END IF;
    
    -- Check if invitation is still valid
    IF invitation.status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invitation is no longer valid');
    END IF;
    
    IF invitation.expires_at < NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invitation has expired');
    END IF;
    
    -- Get tenant details
    SELECT name, slug INTO tenant
    FROM tenants 
    WHERE id = invitation.tenant_id;
    
    -- Return invitation details (safe for public consumption)
    RETURN jsonb_build_object(
        'success', true,
        'invitation', jsonb_build_object(
            'email', invitation.email,
            'first_name', invitation.first_name,
            'last_name', invitation.last_name,
            'tenant_name', tenant.name,
            'expires_at', invitation.expires_at
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', SQLERRM
        );
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION generate_coach_invitation_token() TO authenticated;
GRANT EXECUTE ON FUNCTION create_coach_invitation(VARCHAR, VARCHAR, VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_coach_invitation(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_coach_invitation_details(TEXT) TO anon, authenticated;

-- RLS Policies for coach_invitations table
ALTER TABLE coach_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view invitations for their tenant (admins only)
CREATE POLICY coach_invitations_select_policy ON coach_invitations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('tenant_admin', 'super_admin')
            AND (profiles.role = 'super_admin' OR profiles.tenant_id = coach_invitations.tenant_id)
        )
    );

-- Policy: Users can insert invitations for their tenant (admins only)
CREATE POLICY coach_invitations_insert_policy ON coach_invitations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('tenant_admin', 'super_admin')
            AND (profiles.role = 'super_admin' OR profiles.tenant_id = coach_invitations.tenant_id)
        )
    );

-- Policy: Users can update invitations for their tenant (admins only)
CREATE POLICY coach_invitations_update_policy ON coach_invitations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('tenant_admin', 'super_admin')
            AND (profiles.role = 'super_admin' OR profiles.tenant_id = coach_invitations.tenant_id)
        )
    );

-- Add helpful comments
COMMENT ON TABLE coach_invitations IS 'Stores coach invitation tokens and tracking information';
COMMENT ON FUNCTION create_coach_invitation(VARCHAR, VARCHAR, VARCHAR, UUID) IS 'Creates a new coach invitation with secure token';
COMMENT ON FUNCTION accept_coach_invitation(TEXT, UUID) IS 'Validates and accepts a coach invitation during signup';
COMMENT ON FUNCTION get_coach_invitation_details(TEXT) IS 'Gets invitation details for pre-populating signup form'; 