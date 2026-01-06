-- =====================================================
-- Migration 057: Add Metrics Tracking Columns
-- =====================================================
-- This migration adds columns to treatment_sessions for tracking:
-- - Session type (problem_shifting, goal_optimization, etc.)
-- - Counts for problems cleared, goals optimized, experiences cleared
-- - Method used for the session
--
-- All statements are IDEMPOTENT - safe to run multiple times
-- =====================================================

-- Add session_type column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'treatment_sessions' 
    AND column_name = 'session_type'
  ) THEN
    ALTER TABLE treatment_sessions 
    ADD COLUMN session_type VARCHAR(50) DEFAULT 'problem_shifting';
    
    COMMENT ON COLUMN treatment_sessions.session_type IS 
      'Type of Mind Shifting session: problem_shifting, goal_optimization, experience_clearing, belief_shifting, identity_shifting, reality_shifting, blockage_shifting';
  END IF;
END $$;

-- Add problems_count column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'treatment_sessions' 
    AND column_name = 'problems_count'
  ) THEN
    ALTER TABLE treatment_sessions 
    ADD COLUMN problems_count INTEGER DEFAULT 0;
    
    COMMENT ON COLUMN treatment_sessions.problems_count IS 
      'Number of problems cleared in this session';
  END IF;
END $$;

-- Add goals_count column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'treatment_sessions' 
    AND column_name = 'goals_count'
  ) THEN
    ALTER TABLE treatment_sessions 
    ADD COLUMN goals_count INTEGER DEFAULT 0;
    
    COMMENT ON COLUMN treatment_sessions.goals_count IS 
      'Number of goals optimized in this session';
  END IF;
END $$;

-- Add experiences_count column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'treatment_sessions' 
    AND column_name = 'experiences_count'
  ) THEN
    ALTER TABLE treatment_sessions 
    ADD COLUMN experiences_count INTEGER DEFAULT 0;
    
    COMMENT ON COLUMN treatment_sessions.experiences_count IS 
      'Number of negative experiences cleared in this session';
  END IF;
END $$;

-- Add method_used column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'treatment_sessions' 
    AND column_name = 'method_used'
  ) THEN
    ALTER TABLE treatment_sessions 
    ADD COLUMN method_used VARCHAR(50);
    
    COMMENT ON COLUMN treatment_sessions.method_used IS 
      'The specific method/modality used (mind_shifting, goal_optimization, trauma_shifting, etc.)';
  END IF;
END $$;

-- Create index on session_type for faster filtering (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'treatment_sessions' 
    AND indexname = 'idx_treatment_sessions_session_type'
  ) THEN
    CREATE INDEX idx_treatment_sessions_session_type 
    ON treatment_sessions(session_type);
  END IF;
END $$;

-- Create index on created_at for time-based queries (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'treatment_sessions' 
    AND indexname = 'idx_treatment_sessions_created_at'
  ) THEN
    CREATE INDEX idx_treatment_sessions_created_at 
    ON treatment_sessions(created_at);
  END IF;
END $$;

-- =====================================================
-- Backfill existing completed sessions
-- =====================================================
-- Set problems_count = 1 for all completed sessions that don't have it set
-- This assumes each completed session cleared at least one problem

UPDATE treatment_sessions
SET 
  problems_count = 1,
  session_type = COALESCE(session_type, 'problem_shifting'),
  method_used = COALESCE(
    method_used,
    metadata->>'selectedMethod',
    'mind_shifting'
  )
WHERE status = 'completed'
  AND (problems_count IS NULL OR problems_count = 0);

-- Set session_type based on method in metadata for sessions that have it
UPDATE treatment_sessions
SET session_type = CASE metadata->>'selectedMethod'
  WHEN 'mind_shifting' THEN 'problem_shifting'
  WHEN 'goal_optimization' THEN 'goal_optimization'
  WHEN 'trauma_shifting' THEN 'experience_clearing'
  WHEN 'belief_shifting' THEN 'belief_shifting'
  WHEN 'identity_shifting' THEN 'identity_shifting'
  WHEN 'reality_shifting' THEN 'reality_shifting'
  WHEN 'blockage_shifting' THEN 'blockage_shifting'
  ELSE 'problem_shifting'
END
WHERE session_type IS NULL OR session_type = 'problem_shifting'
  AND metadata->>'selectedMethod' IS NOT NULL
  AND metadata->>'selectedMethod' != 'mind_shifting';

-- =====================================================
-- Verification query (for manual checking)
-- =====================================================
-- Run this to verify the migration worked:
-- SELECT 
--   session_type,
--   COUNT(*) as count,
--   SUM(problems_count) as total_problems,
--   SUM(goals_count) as total_goals,
--   SUM(experiences_count) as total_experiences
-- FROM treatment_sessions
-- GROUP BY session_type;

