-- ============================================================
-- Voice Pipeline Settings (V9)
-- Global admin-controlled STT + TTS provider selection.
--
-- This is a SINGLETON table: there is exactly one row, with id=1,
-- enforced by the CHECK constraint. Readable by any authenticated
-- user (the server code reads it on every new v9 session start),
-- writable only by super_admin.
--
-- The setting is applied to NEW sessions only. The v9 backend pins
-- the selected pair onto the session's metadata at start, so flipping
-- the radios mid-session never changes the voice of an in-flight
-- patient conversation.
-- ============================================================

CREATE TABLE IF NOT EXISTS system_voice_settings (
  id              SMALLINT PRIMARY KEY DEFAULT 1,
  stt_provider    TEXT NOT NULL DEFAULT 'openai',
  tts_provider    TEXT NOT NULL DEFAULT 'openai',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT system_voice_settings_singleton CHECK (id = 1),
  CONSTRAINT system_voice_settings_stt_valid
    CHECK (stt_provider IN ('openai', 'whisper-local')),
  CONSTRAINT system_voice_settings_tts_valid
    CHECK (tts_provider IN ('openai', 'elevenlabs', 'kokoro'))
);

-- Seed the singleton row so the backend's "read current setting"
-- call always succeeds, even on a fresh database.
INSERT INTO system_voice_settings (id, stt_provider, tts_provider)
VALUES (1, 'openai', 'openai')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE system_voice_settings ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can SELECT. The server needs this so that
-- treatment sessions (run under the patient's auth context) can read
-- the active pair at start. No PII is exposed by the read.
DROP POLICY IF EXISTS "Authenticated users can read voice settings"
  ON system_voice_settings;
CREATE POLICY "Authenticated users can read voice settings"
  ON system_voice_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Only super_admin can UPDATE. UPDATE is the only write we expect
-- because the row is pre-seeded; we still guard INSERT/DELETE out of
-- caution.
DROP POLICY IF EXISTS "Only super_admin can update voice settings"
  ON system_voice_settings;
CREATE POLICY "Only super_admin can update voice settings"
  ON system_voice_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Only super_admin can insert voice settings"
  ON system_voice_settings;
CREATE POLICY "Only super_admin can insert voice settings"
  ON system_voice_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Only super_admin can delete voice settings"
  ON system_voice_settings;
CREATE POLICY "Only super_admin can delete voice settings"
  ON system_voice_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- Keep updated_at accurate without relying on the app layer.
CREATE OR REPLACE FUNCTION touch_system_voice_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_system_voice_settings
  ON system_voice_settings;
CREATE TRIGGER trg_touch_system_voice_settings
  BEFORE UPDATE ON system_voice_settings
  FOR EACH ROW
  EXECUTE FUNCTION touch_system_voice_settings_updated_at();
