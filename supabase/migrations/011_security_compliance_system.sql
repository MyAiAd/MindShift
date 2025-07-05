-- ============================================================================
-- Migration 011: Security & Compliance System
-- ============================================================================
-- This migration adds security and compliance features including:
-- 1. Security event logging
-- 2. User consent management (GDPR)
-- 3. Enhanced session tracking
-- 4. Data retention and privacy tools

-- Security Events Table for audit logging
CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    location JSONB DEFAULT '{}', -- Store country, region info
    severity VARCHAR(20) DEFAULT 'info', -- info, warning, error, critical
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for security_events table
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_user ON security_events(user_id);
CREATE INDEX idx_security_events_tenant ON security_events(tenant_id);
CREATE INDEX idx_security_events_created ON security_events(created_at);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_ip ON security_events(ip_address);

-- User Consents Table for GDPR compliance
CREATE TABLE user_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL, -- marketing, analytics, data_processing, etc.
    granted BOOLEAN NOT NULL DEFAULT false,
    granted_at TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL,
    version VARCHAR(20) DEFAULT '1.0', -- Track consent version
    method VARCHAR(50) DEFAULT 'web', -- web, api, admin, etc.
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint per user and consent type
    UNIQUE(user_id, consent_type)
);

-- Indexes for user_consents table
CREATE INDEX idx_user_consents_user ON user_consents(user_id);
CREATE INDEX idx_user_consents_tenant ON user_consents(tenant_id);
CREATE INDEX idx_user_consents_type ON user_consents(consent_type);
CREATE INDEX idx_user_consents_granted ON user_consents(granted);
CREATE INDEX idx_user_consents_created ON user_consents(created_at);

-- Enhanced Session Tracking
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    location JSONB DEFAULT '{}',
    device_type VARCHAR(50), -- web, mobile, tablet, api
    is_active BOOLEAN DEFAULT true,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user_sessions table
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_tenant ON user_sessions(tenant_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active);
CREATE INDEX idx_user_sessions_activity ON user_sessions(last_activity_at);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- Rate Limiting Tracking (persistent storage)
CREATE TABLE rate_limit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier VARCHAR(255) NOT NULL, -- IP, user ID, or custom key
    endpoint VARCHAR(255) NOT NULL,
    limit_type VARCHAR(50) NOT NULL, -- general, auth, admin, etc.
    attempts INTEGER DEFAULT 1,
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Unique constraint for identifier and endpoint
    UNIQUE(identifier, endpoint)
);

-- Indexes for rate_limit_events table
CREATE INDEX idx_rate_limit_identifier ON rate_limit_events(identifier);
CREATE INDEX idx_rate_limit_endpoint ON rate_limit_events(endpoint);
CREATE INDEX idx_rate_limit_type ON rate_limit_events(limit_type);
CREATE INDEX idx_rate_limit_blocked ON rate_limit_events(blocked_until);
CREATE INDEX idx_rate_limit_last_attempt ON rate_limit_events(last_attempt_at);

-- Data Privacy Requests (GDPR)
CREATE TABLE data_privacy_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL, -- export, delete, anonymize, correct
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Admin who processed
    request_details JSONB DEFAULT '{}',
    processing_notes TEXT,
    completed_at TIMESTAMPTZ NULL,
    exported_data_url TEXT NULL, -- Secure URL for data export
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for data_privacy_requests table
CREATE INDEX idx_privacy_requests_user ON data_privacy_requests(user_id);
CREATE INDEX idx_privacy_requests_tenant ON data_privacy_requests(tenant_id);
CREATE INDEX idx_privacy_requests_type ON data_privacy_requests(request_type);
CREATE INDEX idx_privacy_requests_status ON data_privacy_requests(status);
CREATE INDEX idx_privacy_requests_created ON data_privacy_requests(created_at);

-- Add security-related columns to existing profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deletion_date TIMESTAMPTZ NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{"marketing": false, "analytics": true, "essential": true}';

-- ============================================================================
-- Enhanced Functions
-- ============================================================================

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_event_type VARCHAR(100),
    p_user_id UUID DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_severity VARCHAR(20) DEFAULT 'info'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO security_events (
        event_type,
        user_id,
        tenant_id,
        metadata,
        ip_address,
        user_agent,
        severity
    ) VALUES (
        p_event_type,
        p_user_id,
        p_tenant_id,
        p_metadata,
        p_ip_address,
        p_user_agent,
        p_severity
    ) RETURNING id INTO v_event_id;
    
    RETURN v_event_id;
END;
$$;

-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier VARCHAR(255),
    p_endpoint VARCHAR(255),
    p_limit_type VARCHAR(50),
    p_max_attempts INTEGER,
    p_window_minutes INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_attempts INTEGER := 0;
    v_window_start TIMESTAMPTZ;
    v_blocked_until TIMESTAMPTZ;
    v_is_blocked BOOLEAN := false;
    v_remaining INTEGER;
BEGIN
    v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
    
    -- Check if currently blocked
    SELECT blocked_until INTO v_blocked_until
    FROM rate_limit_events
    WHERE identifier = p_identifier 
      AND endpoint = p_endpoint
      AND blocked_until > NOW();
    
    IF v_blocked_until IS NOT NULL THEN
        v_is_blocked := true;
        v_remaining := 0;
    ELSE
        -- Count attempts in current window
        SELECT COALESCE(attempts, 0) INTO v_current_attempts
        FROM rate_limit_events
        WHERE identifier = p_identifier 
          AND endpoint = p_endpoint
          AND last_attempt_at > v_window_start;
        
        v_remaining := GREATEST(0, p_max_attempts - v_current_attempts - 1);
        
        IF v_current_attempts >= p_max_attempts THEN
            v_is_blocked := true;
            v_blocked_until := NOW() + (p_window_minutes || ' minutes')::INTERVAL;
        END IF;
        
        -- Update or insert rate limit record
        INSERT INTO rate_limit_events (
            identifier,
            endpoint,
            limit_type,
            attempts,
            last_attempt_at,
            blocked_until
        ) VALUES (
            p_identifier,
            p_endpoint,
            p_limit_type,
            1,
            NOW(),
            CASE WHEN v_is_blocked THEN v_blocked_until ELSE NULL END
        )
        ON CONFLICT (identifier, endpoint) 
        DO UPDATE SET
            attempts = CASE 
                WHEN rate_limit_events.last_attempt_at > v_window_start 
                THEN rate_limit_events.attempts + 1
                ELSE 1
            END,
            last_attempt_at = NOW(),
            blocked_until = CASE WHEN v_is_blocked THEN v_blocked_until ELSE NULL END;
    END IF;
    
    RETURN jsonb_build_object(
        'allowed', NOT v_is_blocked,
        'remaining', v_remaining,
        'blocked_until', v_blocked_until,
        'current_attempts', v_current_attempts
    );
END;
$$;

-- Function to clean up expired data
CREATE OR REPLACE FUNCTION cleanup_expired_security_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_sessions INTEGER := 0;
    v_deleted_events INTEGER := 0;
    v_deleted_rate_limits INTEGER := 0;
BEGIN
    -- Clean up expired sessions
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() OR last_activity_at < (NOW() - INTERVAL '30 days');
    GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;
    
    -- Clean up old security events (keep 6 months)
    DELETE FROM security_events 
    WHERE created_at < (NOW() - INTERVAL '6 months');
    GET DIAGNOSTICS v_deleted_events = ROW_COUNT;
    
    -- Clean up old rate limit events
    DELETE FROM rate_limit_events 
    WHERE last_attempt_at < (NOW() - INTERVAL '7 days') 
      AND (blocked_until IS NULL OR blocked_until < NOW());
    GET DIAGNOSTICS v_deleted_rate_limits = ROW_COUNT;
    
    RETURN jsonb_build_object(
        'deleted_sessions', v_deleted_sessions,
        'deleted_security_events', v_deleted_events,
        'deleted_rate_limits', v_deleted_rate_limits,
        'cleanup_timestamp', NOW()
    );
END;
$$;

-- Function to get user data for GDPR export
CREATE OR REPLACE FUNCTION get_user_gdpr_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_data JSONB := '{}';
    v_profile JSONB;
    v_subscriptions JSONB;
    v_consents JSONB;
    v_sessions JSONB;
    v_security_events JSONB;
BEGIN
    -- Profile data
    SELECT to_jsonb(p.*) INTO v_profile
    FROM profiles p
    WHERE p.id = p_user_id;
    
    -- Subscription data
    SELECT jsonb_agg(to_jsonb(us.*)) INTO v_subscriptions
    FROM user_subscriptions us
    WHERE us.user_id = p_user_id;
    
    -- Consent records
    SELECT jsonb_agg(to_jsonb(uc.*)) INTO v_consents
    FROM user_consents uc
    WHERE uc.user_id = p_user_id;
    
    -- Recent sessions (last 90 days)
    SELECT jsonb_agg(to_jsonb(us.*)) INTO v_sessions
    FROM user_sessions us
    WHERE us.user_id = p_user_id
      AND us.created_at > (NOW() - INTERVAL '90 days');
    
    -- Security events (last 90 days)
    SELECT jsonb_agg(to_jsonb(se.*)) INTO v_security_events
    FROM security_events se
    WHERE se.user_id = p_user_id
      AND se.created_at > (NOW() - INTERVAL '90 days');
    
    -- Build complete data package
    v_data := jsonb_build_object(
        'export_timestamp', NOW(),
        'user_id', p_user_id,
        'profile', v_profile,
        'subscriptions', COALESCE(v_subscriptions, '[]'::jsonb),
        'consents', COALESCE(v_consents, '[]'::jsonb),
        'recent_sessions', COALESCE(v_sessions, '[]'::jsonb),
        'recent_security_events', COALESCE(v_security_events, '[]'::jsonb)
    );
    
    RETURN v_data;
END;
$$;

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_privacy_requests ENABLE ROW LEVEL SECURITY;

-- Security Events Policies
CREATE POLICY "security_events_tenant_isolation" ON security_events
    FOR ALL USING (
        tenant_id IS NULL OR 
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "security_events_user_access" ON security_events
    FOR SELECT USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
        )
    );

-- User Consents Policies
CREATE POLICY "user_consents_own_data" ON user_consents
    FOR ALL USING (
        user_id = auth.uid() OR
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- User Sessions Policies
CREATE POLICY "user_sessions_own_data" ON user_sessions
    FOR ALL USING (
        user_id = auth.uid() OR
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Rate Limit Events Policies (admin only)
CREATE POLICY "rate_limit_admin_only" ON rate_limit_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
        )
    );

-- Data Privacy Requests Policies
CREATE POLICY "privacy_requests_user_admin" ON data_privacy_requests
    FOR ALL USING (
        user_id = auth.uid() OR
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Composite indexes for common queries
CREATE INDEX idx_security_events_user_tenant_created ON security_events(user_id, tenant_id, created_at DESC);
CREATE INDEX idx_user_consents_tenant_type_granted ON user_consents(tenant_id, consent_type, granted);
CREATE INDEX idx_user_sessions_user_active_activity ON user_sessions(user_id, is_active, last_activity_at DESC);
CREATE INDEX idx_privacy_requests_tenant_status_created ON data_privacy_requests(tenant_id, status, created_at DESC);

-- Partial indexes for active data
CREATE INDEX idx_user_sessions_active_only ON user_sessions(user_id, last_activity_at DESC) WHERE is_active = true;
CREATE INDEX idx_rate_limit_blocked_only ON rate_limit_events(identifier, blocked_until) WHERE blocked_until IS NOT NULL;

-- ============================================================================
-- Triggers for Automation
-- ============================================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_consents_updated_at
    BEFORE UPDATE ON user_consents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_privacy_requests_updated_at
    BEFORE UPDATE ON data_privacy_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT ON security_events TO authenticated;
GRANT ALL ON user_consents TO authenticated;
GRANT ALL ON user_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON data_privacy_requests TO authenticated;

-- Grant admin permissions
GRANT ALL ON rate_limit_events TO authenticated;

-- Grant function execution permissions
GRANT EXECUTE ON FUNCTION log_security_event TO authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_security_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_gdpr_data TO authenticated; 