-- ============================================================
-- Allow 'inworld' as a valid stt_provider and tts_provider value.
--
-- Migration 063 left the STT constraint at ('openai', 'whisper-local',
-- 'elevenlabs') and the TTS constraint at ('openai', 'elevenlabs',
-- 'kokoro').  Adding Inworld as a fourth provider for both requires
-- both constraints to be relaxed.
--
-- No other tables or columns are touched.
-- ============================================================

ALTER TABLE system_voice_settings
  DROP CONSTRAINT IF EXISTS system_voice_settings_stt_valid;

ALTER TABLE system_voice_settings
  ADD CONSTRAINT system_voice_settings_stt_valid
  CHECK (stt_provider IN ('openai', 'whisper-local', 'elevenlabs', 'inworld'));

ALTER TABLE system_voice_settings
  DROP CONSTRAINT IF EXISTS system_voice_settings_tts_valid;

ALTER TABLE system_voice_settings
  ADD CONSTRAINT system_voice_settings_tts_valid
  CHECK (tts_provider IN ('openai', 'elevenlabs', 'kokoro', 'inworld'));
