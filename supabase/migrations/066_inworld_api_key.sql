-- ============================================================
-- Store the Inworld API key in the DB so it can be set from
-- the admin UI without requiring a server env var.
-- The column is nullable; NULL means "fall back to the
-- INWORLD_API_KEY environment variable".
-- Access is restricted to super_admin by the existing RLS
-- policy on system_voice_settings.
-- ============================================================

ALTER TABLE system_voice_settings
  ADD COLUMN IF NOT EXISTS inworld_api_key TEXT;
