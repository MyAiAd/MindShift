-- ============================================================
-- User Labs OpenRouter Keys
-- Stores one encrypted OpenRouter key per user for Labs usage
-- ============================================================

CREATE TABLE IF NOT EXISTS user_labs_openrouter_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_labs_openrouter_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own labs OpenRouter key" ON user_labs_openrouter_keys;
CREATE POLICY "Users can read their own labs OpenRouter key"
  ON user_labs_openrouter_keys FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own labs OpenRouter key" ON user_labs_openrouter_keys;
CREATE POLICY "Users can insert their own labs OpenRouter key"
  ON user_labs_openrouter_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own labs OpenRouter key" ON user_labs_openrouter_keys;
CREATE POLICY "Users can update their own labs OpenRouter key"
  ON user_labs_openrouter_keys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

