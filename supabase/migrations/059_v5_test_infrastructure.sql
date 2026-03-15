-- V5 Test Infrastructure
-- Creates tables for storing V5 protocol test runs, flow results, and step results

-- ============================================================
-- TABLE: v5_test_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS v5_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  run_name TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  total_steps INT NOT NULL DEFAULT 0,
  passed_steps INT NOT NULL DEFAULT 0,
  failed_steps INT NOT NULL DEFAULT 0,
  flagged_steps INT NOT NULL DEFAULT 0,
  unreviewed_steps INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: v5_test_flow_results
-- ============================================================
CREATE TABLE IF NOT EXISTS v5_test_flow_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES v5_test_runs(id) ON DELETE CASCADE,
  flow_name TEXT NOT NULL,
  flow_index INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'error')),
  total_steps INT NOT NULL DEFAULT 0,
  passed_steps INT NOT NULL DEFAULT 0,
  failed_steps INT NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: v5_test_step_results
-- ============================================================
CREATE TABLE IF NOT EXISTS v5_test_step_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_result_id UUID NOT NULL REFERENCES v5_test_flow_results(id) ON DELETE CASCADE,
  step_index INT NOT NULL,
  step_label TEXT,
  user_input TEXT,
  expected_step TEXT,
  actual_step TEXT,
  response_message TEXT,
  response_time_ms INT,
  used_ai BOOLEAN,
  step_matched BOOLEAN,
  problem_ref_found BOOLEAN,
  api_error TEXT,
  -- Doctor review fields
  review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed', 'pass', 'fail', 'flag')),
  review_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_v5_test_runs_run_by ON v5_test_runs(run_by);
CREATE INDEX IF NOT EXISTS idx_v5_test_flow_results_run_id ON v5_test_flow_results(run_id);
CREATE INDEX IF NOT EXISTS idx_v5_test_step_results_flow_result_id ON v5_test_step_results(flow_result_id);
CREATE INDEX IF NOT EXISTS idx_v5_test_step_results_review_status ON v5_test_step_results(review_status);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE v5_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE v5_test_flow_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE v5_test_step_results ENABLE ROW LEVEL SECURITY;

-- v5_test_runs policies
CREATE POLICY "Users can view their own test runs"
  ON v5_test_runs FOR SELECT
  USING (run_by = auth.uid());

CREATE POLICY "Super admins can view all test runs"
  ON v5_test_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Users can insert their own test runs"
  ON v5_test_runs FOR INSERT
  WITH CHECK (run_by = auth.uid());

CREATE POLICY "Users can update their own test runs"
  ON v5_test_runs FOR UPDATE
  USING (run_by = auth.uid());

-- v5_test_flow_results policies
CREATE POLICY "Users can view their own flow results"
  ON v5_test_flow_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM v5_test_runs
      WHERE v5_test_runs.id = run_id
      AND v5_test_runs.run_by = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all flow results"
  ON v5_test_flow_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Users can insert flow results for their runs"
  ON v5_test_flow_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v5_test_runs
      WHERE v5_test_runs.id = run_id
      AND v5_test_runs.run_by = auth.uid()
    )
  );

CREATE POLICY "Users can update flow results for their runs"
  ON v5_test_flow_results FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM v5_test_runs
      WHERE v5_test_runs.id = run_id
      AND v5_test_runs.run_by = auth.uid()
    )
  );

-- v5_test_step_results policies
CREATE POLICY "Users can view their own step results"
  ON v5_test_step_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM v5_test_flow_results
      JOIN v5_test_runs ON v5_test_runs.id = v5_test_flow_results.run_id
      WHERE v5_test_flow_results.id = flow_result_id
      AND v5_test_runs.run_by = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all step results"
  ON v5_test_step_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Users can insert step results for their runs"
  ON v5_test_step_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v5_test_flow_results
      JOIN v5_test_runs ON v5_test_runs.id = v5_test_flow_results.run_id
      WHERE v5_test_flow_results.id = flow_result_id
      AND v5_test_runs.run_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their own step results"
  ON v5_test_step_results FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM v5_test_flow_results
      JOIN v5_test_runs ON v5_test_runs.id = v5_test_flow_results.run_id
      WHERE v5_test_flow_results.id = flow_result_id
      AND v5_test_runs.run_by = auth.uid()
    )
  );
