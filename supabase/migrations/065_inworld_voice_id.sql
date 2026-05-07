-- ============================================================
-- Add inworld_voice_id to system_voice_settings.
--
-- Stores the admin-selected Inworld TTS voice alongside the
-- provider pair so INWORLD_VOICE_ID env var is not required
-- on the server.  Defaults to 'Ashley' so existing rows are
-- immediately usable without an explicit admin save.
-- ============================================================

ALTER TABLE system_voice_settings
  ADD COLUMN IF NOT EXISTS inworld_voice_id TEXT NOT NULL DEFAULT 'Ashley';
