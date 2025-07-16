-- Treatment Sessions Table
CREATE TABLE IF NOT EXISTS treatment_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
    current_phase VARCHAR(100) NOT NULL,
    current_step VARCHAR(100) NOT NULL,
    problem_statement TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Performance metrics
    avg_response_time INTEGER DEFAULT 0, -- milliseconds
    scripted_responses INTEGER DEFAULT 0,
    ai_responses INTEGER DEFAULT 0,
    duration_minutes INTEGER DEFAULT 0,
    
    -- Cost tracking
    total_ai_cost DECIMAL(10,4) DEFAULT 0.00,
    total_ai_tokens INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Treatment Interactions Table (for detailed analytics)
CREATE TABLE IF NOT EXISTS treatment_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES treatment_sessions(session_id) ON DELETE CASCADE,
    user_input TEXT NOT NULL,
    response_message TEXT NOT NULL,
    response_time INTEGER NOT NULL, -- milliseconds
    used_ai BOOLEAN DEFAULT FALSE,
    ai_cost DECIMAL(10,4) DEFAULT 0.00,
    ai_tokens INTEGER DEFAULT 0,
    step_id VARCHAR(100),
    phase_id VARCHAR(100),
    validation_passed BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Treatment Session Progress (tracks user responses through the flow)
CREATE TABLE IF NOT EXISTS treatment_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES treatment_sessions(session_id) ON DELETE CASCADE,
    phase_id VARCHAR(100) NOT NULL,
    step_id VARCHAR(100) NOT NULL,
    user_response TEXT,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(session_id, phase_id, step_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_treatment_sessions_user_id ON treatment_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_treatment_sessions_tenant_id ON treatment_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_treatment_sessions_status ON treatment_sessions(status);
CREATE INDEX IF NOT EXISTS idx_treatment_sessions_created_at ON treatment_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_treatment_interactions_session_id ON treatment_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_treatment_interactions_created_at ON treatment_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_treatment_interactions_used_ai ON treatment_interactions(used_ai);

CREATE INDEX IF NOT EXISTS idx_treatment_progress_session_id ON treatment_progress(session_id);

-- RLS Policies
ALTER TABLE treatment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_progress ENABLE ROW LEVEL SECURITY;

-- Users can only access their own treatment sessions
CREATE POLICY "Users can access own treatment sessions" ON treatment_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Users can only access their own treatment interactions
CREATE POLICY "Users can access own treatment interactions" ON treatment_interactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM treatment_sessions ts 
            WHERE ts.session_id = treatment_interactions.session_id 
            AND ts.user_id = auth.uid()
        )
    );

-- Users can only access their own treatment progress
CREATE POLICY "Users can access own treatment progress" ON treatment_progress
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM treatment_sessions ts 
            WHERE ts.session_id = treatment_progress.session_id 
            AND ts.user_id = auth.uid()
        )
    );

-- Function to update session statistics
CREATE OR REPLACE FUNCTION update_session_stats(
    p_session_id VARCHAR(255),
    p_used_ai BOOLEAN,
    p_response_time INTEGER
) RETURNS VOID AS $$
BEGIN
    UPDATE treatment_sessions 
    SET 
        scripted_responses = CASE WHEN p_used_ai THEN scripted_responses ELSE scripted_responses + 1 END,
        ai_responses = CASE WHEN p_used_ai THEN ai_responses + 1 ELSE ai_responses END,
        avg_response_time = (
            (avg_response_time * (scripted_responses + ai_responses) + p_response_time) / 
            (scripted_responses + ai_responses + 1)
        ),
        updated_at = NOW()
    WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get treatment analytics
CREATE OR REPLACE FUNCTION get_treatment_analytics(
    p_user_id UUID DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 30
) RETURNS TABLE (
    total_sessions INTEGER,
    completed_sessions INTEGER,
    avg_session_duration DECIMAL,
    ai_usage_percentage DECIMAL,
    avg_response_time DECIMAL,
    total_ai_cost DECIMAL,
    success_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_sessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::INTEGER as completed_sessions,
        AVG(duration_minutes) as avg_session_duration,
        CASE 
            WHEN SUM(scripted_responses + ai_responses) > 0 
            THEN ROUND((SUM(ai_responses)::DECIMAL / SUM(scripted_responses + ai_responses) * 100), 2)
            ELSE 0
        END as ai_usage_percentage,
        AVG(avg_response_time) as avg_response_time,
        SUM(total_ai_cost) as total_ai_cost,
        CASE 
            WHEN COUNT(*) > 0 
            THEN ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END)::DECIMAL / COUNT(*) * 100), 2)
            ELSE 0
        END as success_rate
    FROM treatment_sessions
    WHERE 
        created_at >= NOW() - INTERVAL '1 day' * p_days
        AND (p_user_id IS NULL OR user_id = p_user_id)
        AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track AI usage limits
CREATE OR REPLACE FUNCTION check_ai_usage_limits(
    p_session_id VARCHAR(255)
) RETURNS TABLE (
    can_use_ai BOOLEAN,
    ai_calls_count INTEGER,
    cost_so_far DECIMAL,
    reason VARCHAR(255)
) AS $$
DECLARE
    v_ai_calls INTEGER;
    v_cost DECIMAL;
    v_max_calls INTEGER := 3; -- Max 3 AI calls per session
    v_max_cost DECIMAL := 0.05; -- Max $0.05 per session
BEGIN
    SELECT 
        COUNT(CASE WHEN used_ai THEN 1 END),
        COALESCE(SUM(ai_cost), 0)
    INTO v_ai_calls, v_cost
    FROM treatment_interactions
    WHERE session_id = p_session_id;

    IF v_ai_calls >= v_max_calls THEN
        RETURN QUERY SELECT FALSE, v_ai_calls, v_cost, 'Maximum AI calls exceeded'::VARCHAR(255);
    ELSIF v_cost >= v_max_cost THEN
        RETURN QUERY SELECT FALSE, v_ai_calls, v_cost, 'Maximum cost exceeded'::VARCHAR(255);
    ELSE
        RETURN QUERY SELECT TRUE, v_ai_calls, v_cost, 'OK'::VARCHAR(255);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_treatment_sessions_updated_at 
    BEFORE UPDATE ON treatment_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing (remove in production)
INSERT INTO treatment_sessions (session_id, user_id, tenant_id, current_phase, current_step, problem_statement) 
VALUES (
    'test-session-123',
    (SELECT id FROM auth.users LIMIT 1),
    (SELECT id FROM tenants LIMIT 1),
    'intro',
    'welcome',
    'Sample problem for testing'
) ON CONFLICT (session_id) DO NOTHING; 