-- ============================================================
-- Allow 'elevenlabs' as a valid stt_provider value.
--
-- Migration 062 seeded the system_voice_settings singleton with
-- CHECK (stt_provider IN ('openai', 'whisper-local')).  Adding
-- ElevenLabs Scribe as a third STT option requires that constraint
-- to be relaxed.
--
-- The tts_provider column and all other tables are untouched.
-- ============================================================

ALTER TABLE system_voice_settings
  DROP CONSTRAINT IF EXISTS system_voice_settings_stt_valid;

ALTER TABLE system_voice_settings
  ADD CONSTRAINT system_voice_settings_stt_valid
  CHECK (stt_provider IN ('openai', 'whisper-local', 'elevenlabs'));
