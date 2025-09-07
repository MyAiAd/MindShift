-- Fix Session Continuity - Idempotent SQL Script
-- This script ensures all necessary components are in place for session continuity to work

-- 1. Ensure treatment_sessions table has all required columns
DO $$ 
BEGIN
    -- Add any missing columns to treatment_sessions if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='treatment_sessions' AND column_name='metadata') THEN
        ALTER TABLE treatment_sessions ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='treatment_sessions' AND column_name='problem_statement') THEN
        ALTER TABLE treatment_sessions ADD COLUMN problem_statement TEXT;
    END IF;
END $$;

-- 2. Ensure treatment_progress table exists and has correct structure
CREATE TABLE IF NOT EXISTS treatment_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES treatment_sessions(session_id) ON DELETE CASCADE,
    phase_id VARCHAR(100) NOT NULL,
    step_id VARCHAR(100) NOT NULL,
    user_response TEXT,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(session_id, phase_id, step_id)
);

-- 3. Ensure treatment_interactions table exists and has correct structure
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

-- 4. Create or replace the update_session_stats function
CREATE OR REPLACE FUNCTION update_session_stats(
    p_session_id VARCHAR(255),
    p_used_ai BOOLEAN,
    p_response_time INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE treatment_sessions 
    SET 
        scripted_responses = CASE WHEN p_used_ai THEN scripted_responses ELSE scripted_responses + 1 END,
        ai_responses = CASE WHEN p_used_ai THEN ai_responses + 1 ELSE ai_responses END,
        avg_response_time = (
            CASE 
                WHEN scripted_responses + ai_responses = 0 THEN p_response_time
                ELSE (avg_response_time * (scripted_responses + ai_responses) + p_response_time) / (scripted_responses + ai_responses + 1)
            END
        ),
        updated_at = NOW()
    WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Ensure all necessary indexes exist
CREATE INDEX IF NOT EXISTS idx_treatment_sessions_user_id ON treatment_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_treatment_sessions_session_id ON treatment_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_treatment_sessions_status ON treatment_sessions(status);
CREATE INDEX IF NOT EXISTS idx_treatment_sessions_created_at ON treatment_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_treatment_interactions_session_id ON treatment_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_treatment_interactions_created_at ON treatment_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_treatment_interactions_used_ai ON treatment_interactions(used_ai);

CREATE INDEX IF NOT EXISTS idx_treatment_progress_session_id ON treatment_progress(session_id);
CREATE INDEX IF NOT EXISTS idx_treatment_progress_step_id ON treatment_progress(step_id);

-- 6. Ensure RLS policies are in place
ALTER TABLE treatment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can access own treatment sessions" ON treatment_sessions;
DROP POLICY IF EXISTS "Users can access own treatment interactions" ON treatment_interactions;
DROP POLICY IF EXISTS "Users can access own treatment progress" ON treatment_progress;

-- Super admin policy for treatment sessions
DROP POLICY IF EXISTS "Super admin can access all treatment sessions" ON treatment_sessions;
DROP POLICY IF EXISTS "Super admin can access all treatment interactions" ON treatment_interactions;
DROP POLICY IF EXISTS "Super admin can access all treatment progress" ON treatment_progress;

-- Recreate policies
CREATE POLICY "Users can access own treatment sessions" ON treatment_sessions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can access own treatment interactions" ON treatment_interactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM treatment_sessions 
            WHERE treatment_sessions.session_id = treatment_interactions.session_id 
            AND treatment_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can access own treatment progress" ON treatment_progress
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM treatment_sessions 
            WHERE treatment_sessions.session_id = treatment_progress.session_id 
            AND treatment_sessions.user_id = auth.uid()
        )
    );

-- Super admin policies
CREATE POLICY "Super admin can access all treatment sessions" ON treatment_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'super_admin'
        )
    );

CREATE POLICY "Super admin can access all treatment interactions" ON treatment_interactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'super_admin'
        )
    );

CREATE POLICY "Super admin can access all treatment progress" ON treatment_progress
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'super_admin'
        )
    );

-- 7. Add a helper function to get session with progress
CREATE OR REPLACE FUNCTION get_session_with_progress(p_session_id VARCHAR(255), p_user_id UUID)
RETURNS TABLE (
    session_id VARCHAR(255),
    current_phase VARCHAR(100),
    current_step VARCHAR(100),
    problem_statement TEXT,
    metadata JSONB,
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    user_responses JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ts.session_id,
        ts.current_phase,
        ts.current_step,
        ts.problem_statement,
        ts.metadata,
        ts.status,
        ts.created_at,
        ts.updated_at,
        COALESCE(
            jsonb_object_agg(tp.step_id, tp.user_response) FILTER (WHERE tp.step_id IS NOT NULL),
            '{}'::jsonb
        ) as user_responses
    FROM treatment_sessions ts
    LEFT JOIN treatment_progress tp ON ts.session_id = tp.session_id
    WHERE ts.session_id = p_session_id 
    AND ts.user_id = p_user_id
    GROUP BY ts.session_id, ts.current_phase, ts.current_step, ts.problem_statement, 
             ts.metadata, ts.status, ts.created_at, ts.updated_at;
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Session continuity fix applied successfully. Continue buttons should now work properly.';
END $$; 