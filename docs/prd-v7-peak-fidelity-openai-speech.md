# PRD: V7 Peak-Fidelity OpenAI Speech I/O

**Status:** Proposed
**Owner:** Engineering
**Supersedes (partial):** `docs/prd-v7-openai-speech-io.md`
**Related:** `v7-openai-speech-io.json`

---

## 1. Introduction / Overview

V7's explicit mandate is for speech I/O to be **fully outsourced to OpenAI** so that the therapy session uses one vendor end-to-end, removing the fidelity/cost trade-offs we hit with self-hosted Whisper + Kokoro and the cost-prohibitiveness of ElevenLabs.

The current V7 implementation wires OpenAI in, but the pipeline still has the shape of the old self-hosted system: the client auto-uploads audio chunks every 1.5 seconds, it ignores the quality signals OpenAI returns, and it uses `whisper-1` and a default TTS voice with a broken cache-key path. In a silent room, the user's first real utterance was concatenated with a Whisper hallucination ("Diolch yn fawr iawn am wylio'r fideo") which then propagated to the treatment engine. The user was never notified, because OpenAI returned HTTP 200.

This PRD brings V7 to **peak fidelity on an OpenAI-only stack** by:

1. **Fixing the pipeline so OpenAI can succeed** — gating uploads on actual speech, trusting the metadata OpenAI already returns, and eliminating the "unknown voice" cache-key bug.
2. **Upgrading to OpenAI's current-generation models** — `gpt-4o-mini-transcribe` for STT and `gpt-4o-mini-tts` (with `tts-1-hd` fallback) for TTS.
3. **Regenerating the static-audio library** with the new voice so every prompt (cached or streamed) sounds identical.
4. **Replacing the local Kokoro/Whisper fallback** with a pure text-mode fallback, matching the "fully outsourced" vision.
5. **Adding an OpenAI Realtime API track** (scaffolded behind a flag) so that once Track A is validated we can evaluate the truly server-VAD-gated path with zero client-side silence-upload risk.

This PRD explicitly does **not** include the self-hosted GPU / personaplex path. That remains a contingency if the peak-fidelity OpenAI stack falls short of our fidelity target after shipping.

---

## 2. Goals

- **Zero hallucination transcripts** reach the treatment engine in a silent room across a 10-minute session. Measured by manual QA + logged `hallucination_filtered` count.
- **100% voice consistency** across a session. Every patient-facing audio segment uses the same voice (no Kokoro/OpenAI voice drift mid-session).
- **TTS fidelity ≥ ElevenLabs parity** on a 20-utterance blind A/B test with prior session recordings. Target: at least 15/20 reviewers rate OpenAI as equivalent or better.
- **STT accuracy ≥ 98%** word-error-rate parity with the current self-hosted Whisper on a 50-utterance V7-domain corpus.
- **Median time-to-first-audio ≤ 800 ms** for cached static prompts, ≤ 1800 ms for streamed prompts.
- **No patient-facing mention** of "Whisper", "Kokoro", "OpenAI", "backup system", or any other vendor. Error states use neutral language.
- **One environment flag flip** cleanly toggles between the request/response pipeline and the OpenAI Realtime pipeline.

---

## 3. User Stories

### Track A — Peak-fidelity request/response pipeline (ship first)

#### US-001: Gate STT uploads on VAD-detected speech
**Description:** As a developer, I want `/api/transcribe` to only be called when the VAD has detected actual speech within the capture window, so that silence, ambient noise, and background TV are never sent to OpenAI Whisper.

**Acceptance Criteria:**
- [ ] `useAudioCapture.processAudioBuffer` is only invoked when the VAD has fired `onSpeechStart` at least once since the last successful upload or buffer clear.
- [ ] The existing `AUTO_PROCESS_INTERVAL_MS = 1500` timer is removed (not just disabled) so there is no parallel silence-upload path.
- [ ] The `onSpeechEnd` path continues to trigger `processNow()` immediately when the user finishes speaking.
- [ ] PTT (push-to-talk) release continues to flush the accumulator immediately.
- [ ] If VAD is unavailable (hook disabled, not supported, initialization failed), the system falls back to the existing timer as a safety net but logs `stt_vad_unavailable_fallback`.
- [ ] A silent 30-second capture produces zero `/api/transcribe` POSTs (verified in network tab + logs).
- [ ] Typecheck passes.

#### US-002: Quality-gate Whisper responses on metadata
**Description:** As a developer, I want the server-side transcribe route to reject transcripts flagged as low-quality by the model's own confidence metadata, so that silent-semantic-failures (HTTP 200 + hallucinated text) are treated as silence.

**Acceptance Criteria:**
- [ ] `app/api/transcribe/route.ts` `callOpenAIProvider` sets `response_format: 'verbose_json'` (already the case) and reads `segments[].no_speech_prob` and `segments[].avg_logprob`.
- [ ] When **any** of these hold, the transcript is replaced with `""` and `hallucination_filtered: true` is returned:
    - Detected `language !== 'en'` on a session where `treatmentVersion === 'v7'` (English is the only supported session language).
    - `avg(no_speech_prob) > 0.6` across segments.
    - `avg(avg_logprob) < -1.0` **and** `duration < 3.0s`.
    - `duration < 1.5s` **and** word count > 8.
    - Transcript matches any entry in the server-side `OPENAI_HALLUCINATION_PHRASES` / `OPENAI_HALLUCINATION_SUBSTRINGS` sets (include Welsh, CJK, and YouTube-boilerplate patterns).
- [ ] A structured log line is emitted for every filtered response containing: `reason`, `detected_language`, `avg_no_speech_prob`, `avg_logprob`, `duration`, `transcript_preview`.
- [ ] Client-side `useAudioCapture` continues to treat `hallucination_filtered: true` as "empty transcript / likely silence" (no user-visible side effect).
- [ ] Unit tests cover each of the 5 gate conditions.
- [ ] Typecheck passes.

#### US-003: Upgrade STT model to `gpt-4o-mini-transcribe`
**Description:** As a developer, I want to use OpenAI's current-generation STT model, which is purpose-built for real-time dictation and has materially better silence handling than `whisper-1`.

**Acceptance Criteria:**
- [ ] `app/api/transcribe/route.ts` OpenAI call uses `model: process.env.OPENAI_STT_MODEL || 'gpt-4o-mini-transcribe'`.
- [ ] Whenever the selected model supports `verbose_json`, it remains the response format. If it doesn't, the route gracefully falls back to `json` and the metadata-gate logic is skipped but a WARN log is emitted so we can detect the regression.
- [ ] `language: 'en'` parameter is always sent for `treatmentVersion === 'v7'`.
- [ ] The domain-bias `prompt` built from recent user messages is still sent.
- [ ] `OPENAI_STT_MODEL` is documented in `.env.production.example` and `.env.whisper.example`.
- [ ] STT regression suite (tasks/stt-regression-results.md) is rerun against the new model; WER and per-category accuracy are logged.
- [ ] Typecheck passes.

#### US-004: Upgrade TTS to `gpt-4o-mini-tts` with `tts-1-hd` fallback
**Description:** As a developer, I want V7 TTS to use OpenAI's steerable, natural-sounding current-generation TTS model, with `tts-1-hd` as an automatic same-vendor fallback if the primary is unavailable.

**Acceptance Criteria:**
- [ ] `app/api/tts/route.ts` primary model is `process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'`.
- [ ] If the primary model request returns 4xx / 5xx / times out, the route retries **once** with `tts-1-hd` and the same voice/text before returning an error.
- [ ] Both models support the same six voices used by V7. The `voice` parameter is forwarded unchanged.
- [ ] `gpt-4o-mini-tts` is called with an `instructions` field that steers tone to be "warm, calm, reassuring, unhurried — therapeutic but not clinical." Tweakable via `OPENAI_TTS_INSTRUCTIONS` env var.
- [ ] The compliance guard (spoken-text == apiMessage) runs unchanged against the resolved text regardless of model.
- [ ] Retry attempts and fallback events are logged with the original failure reason.
- [ ] Typecheck passes.

#### US-005: Switch V7 default voice to `shimmer` and make it tenant-configurable
**Description:** As a developer and tenant admin, I want V7 to use `shimmer` as the default voice (closest match to the prior Kokoro `af_heart` warmth), with tenant-level override support.

**Acceptance Criteria:**
- [ ] `components/treatment/v7/TreatmentSession.tsx` passes `voiceProvider: 'openai'` and a concrete voice id (default `shimmer`) to `useNaturalVoice`.
- [ ] Voice id is sourced in priority order: user preference → tenant configuration → env default → `shimmer`.
- [ ] The voice name mapping in `useNaturalVoice.getVoiceNameFromId` includes all OpenAI voices (`alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`) so `currentVoiceName` is never `"unknown"`.
- [ ] Cache keys (`${currentVoiceName}:${text}`) now match the voice actually requested, so pre-generated static audio is found and used.
- [ ] Typecheck passes.
- [ ] Verified in browser: on a cache hit the network tab shows zero `/api/tts` POSTs for V7 static prompts.

#### US-006: Fix the "unknown" voice cache-key bug (root cause)
**Description:** As a developer, I want the voice-prefixed cache key in `useNaturalVoice` to always reflect the actual voice used for synthesis, so that the static-audio library is never missed due to a name lookup returning `"unknown"`.

**Acceptance Criteria:**
- [ ] `getVoiceNameFromId` returns a stable, unique string for every supported voice (no `'unknown'` fallback reachable in the V7 happy path).
- [ ] If an unrecognized voice id is passed, the function logs `WARN voice_id_unrecognized` and uses the raw voice id as the cache key (so cache poisoning with `unknown:` keys is no longer possible).
- [ ] The `V7AudioPreloader` and the runtime cache use identical key construction (extracted into a shared helper).
- [ ] Typecheck passes.

#### US-007: Regenerate static-audio library with the new voice
**Description:** As a developer, I want the full static-audio library under `public/audio/v7/static/` regenerated with the selected OpenAI TTS model and voice, so every patient hears one consistent voice across cached and streamed prompts.

**Acceptance Criteria:**
- [ ] A generator script (`scripts/regenerate-v7-static-audio.ts`) reads every string in `lib/v7/static-audio-texts.ts`, calls `/api/tts` with the default V7 voice and model, writes the audio files into `public/audio/v7/static/<voice>/`, and writes an updated `manifest.json`.
- [ ] The generator is idempotent and skips files that already exist unless `--force` is passed.
- [ ] The manifest includes `{ voice, model, generated_at, checksum }` so regressions from voice/model changes are visible.
- [ ] `V7AudioPreloader.tsx` reads the manifest and verifies the voice matches the runtime voice; if it doesn't, it logs a warning and skips preload (preventing mixed-voice sessions).
- [ ] Regeneration runs in CI when `lib/v7/static-audio-texts.ts` is modified (check that no regeneration is committed without running the script — CI fails if drift is detected).
- [ ] The generated library is committed to the repo (not generated at build time) so production deploys are deterministic.
- [ ] Typecheck passes.

#### US-008: Replace self-hosted fallback with text-mode fallback
**Description:** As a product owner, I want "fully outsourced to OpenAI" to mean it. When OpenAI speech services are unavailable, we should not silently swap to self-hosted Whisper/Kokoro — we should retry once, then let the user continue in text mode.

**Acceptance Criteria:**
- [ ] The `sttProviderOverride` / `ttsProviderOverride` mechanism remains in code but is no longer reachable via the user fallback prompt.
- [ ] On `onSpeechProviderError` (STT or TTS) the flow becomes:
    1. Retry the failed request once silently.
    2. If retry fails, show a neutral dialog: "We're temporarily unable to use audio. Would you like to continue by typing?" with **Continue in text** / **Try again** buttons.
    3. Declining "Try again" up to 3 times in a 5-minute window surfaces the text-mode prompt automatically.
- [ ] Text mode: the mic orb is visually muted, the text input is focused, and TTS is suppressed. Session state is otherwise unchanged.
- [ ] No UI string references "Whisper", "Kokoro", "OpenAI", "backup system", "fallback provider", or any vendor name.
- [ ] The self-hosted whisper service dependency is removed from V7's runtime path. `WHISPER_SERVICE_URL` is marked deprecated in the env docs.
- [ ] Typecheck passes.
- [ ] Verified in browser: simulated 500 from `/api/tts` shows the text-mode dialog after the retry.

#### US-009: Retry-once on OpenAI speech failure
**Description:** As a developer, I want both STT and TTS routes to retry transient failures once on the server side before surfacing an error to the client, so that momentary OpenAI blips don't break the session flow.

**Acceptance Criteria:**
- [ ] `app/api/transcribe/route.ts` retries OpenAI once on: network error, 429, 500, 502, 503, 504, or timeout (15s primary).
- [ ] `app/api/tts/route.ts` retries OpenAI once on the same conditions, and if the retry also fails, attempts `tts-1-hd` fallback (per US-004) before returning an error.
- [ ] Retries use a 250 ms jittered backoff.
- [ ] Retry attempts are logged with `stt_retry` / `tts_retry` tags and the original and retry HTTP statuses.
- [ ] Tests cover: 500 then 200 → success; 500 then 500 → error with `stt_provider_failure`.
- [ ] Typecheck passes.

#### US-010: Telemetry — log OpenAI response quality metrics
**Description:** As an operator, I want every STT response's quality signals logged so we can tune thresholds and detect model regressions without user reports.

**Acceptance Criteria:**
- [ ] Each `/api/transcribe` OpenAI call logs: `treatment_version`, `detected_language`, `avg_no_speech_prob`, `avg_logprob`, `duration`, `word_count`, `domain_bias_applied`, `hallucination_filtered`, `hallucination_reason`, `model`, `processing_time_ms`.
- [ ] Each `/api/tts` OpenAI call logs: `treatment_version`, `text_length`, `voice`, `model`, `retry_count`, `fallback_used`, `processing_time_ms`.
- [ ] Logs are structured JSON (one field per key).
- [ ] A daily rollup query is documented in `docs/observability-v7-speech.md` for: hallucination rate, p50/p95 latency, fallback rate, retry rate.
- [ ] Typecheck passes.

#### US-011: Remove client-side English-only hallucination patches from US-001 (incremental)
**Description:** As a developer, once US-001 (VAD-gate) and US-002 (metadata gate) ship, the client-side string-match hallucination list becomes a safety net rather than a primary defense. Keep it, but it must not be the only thing between Whisper and the treatment engine.

**Acceptance Criteria:**
- [ ] Client-side `isLikelyHallucination` remains in place as a last-resort safety net.
- [ ] Client-side log line distinguishes `server-side filter caught it` vs `client safety-net caught it`.
- [ ] In production metrics, `client safety-net` should fire in < 1% of STT responses; if higher, US-002 thresholds need tuning.
- [ ] Typecheck passes.

#### US-018: Capture V7 regression audio corpus
**Description:** As a QA engineer, I need a committed corpus of real V7 utterance recordings so the regression suites in US-012 and US-016 can run against reproducible inputs instead of ad-hoc live sessions.

**Acceptance Criteria:**
- [ ] A capture plan is authored covering: 1-word answers (yes / no / sure / maybe), short phrases (3-10 words), long reflections with mid-utterance pauses, whispered responses, responses spoken over background TV, responses spoken over HVAC noise, and a silent-room control clip.
- [ ] Minimum 50 utterances recorded at 16 kHz mono WAV, committed under `tests/fixtures/v7-speech-corpus/`.
- [ ] Each file has a companion JSON with the ground-truth transcript, expected step context, and condition tags.
- [ ] An index file `tests/fixtures/v7-speech-corpus/INDEX.md` documents the corpus.
- [ ] The corpus is the single source of truth for US-012 and US-016 regression runs.
- [ ] Typecheck passes.

#### US-019: TTS determinism policy for static-audio regeneration
**Description:** As a product owner, I need a documented policy for how we handle `gpt-4o-mini-tts`'s non-deterministic output when adding new static prompts, so the static library never silently drifts in voice character over time.

**Acceptance Criteria:**
- [ ] `docs/v7-tts-determinism-policy.md` documents the chosen policy. Policy options to evaluate: (a) full regeneration on every prompt addition, (b) per-prompt regeneration with tolerance for slight variance, (c) lock to `tts-1-hd` (deterministic) for static library while using `gpt-4o-mini-tts` for streamed dynamic content.
- [ ] An empirical test is run: regenerate the same 10-sample subset 3 times under the chosen policy; document subjective voice-consistency results.
- [ ] The chosen policy is referenced in US-007 generator script comments and CI drift checks.
- [ ] If policy (c) is chosen, `OPENAI_TTS_STATIC_MODEL` env var is introduced separate from `OPENAI_TTS_MODEL`.
- [ ] Typecheck passes.

#### US-020: Confirm current OpenAI Realtime API pricing
**Description:** As a product owner, I need confirmed current pricing for the Realtime API before the Track B / Track A decision gate (US-017), so the cost column of the comparison is accurate rather than estimated.

**Acceptance Criteria:**
- [ ] Current per-minute pricing for Realtime API input audio and output audio is fetched from the official OpenAI pricing page and recorded in `docs/v7-pipeline-decision.md` with a timestamped citation.
- [ ] A projected per-session cost is calculated for: median V7 session length, 95th-percentile V7 session length, both with and without the V7 static-audio cache (cache misses drive audio minutes up).
- [ ] Results are compared against projected costs for the request/response pipeline at the same session lengths.
- [ ] Findings are summarized in §6 of the peak-fidelity PRD and referenced from US-017's acceptance criteria.
- [ ] Typecheck passes.

#### US-012: Full V7 peak-fidelity regression suite
**Description:** As a QA engineer, I need an end-to-end regression suite that exercises every V7 flow with the peak-fidelity OpenAI configuration (US-001..US-010 shipped), and confirms zero hallucinations, zero voice drift, and zero patient-facing vendor leaks.

**Acceptance Criteria:**
- [ ] Test plan covers all V7 flows: introduction, work-type selection, problem path, goal path, trauma path, integration path.
- [ ] Each flow is run in a quiet room, a room with background TV, and a room with HVAC noise.
- [ ] Each flow is run with orb-PTT, listen-only, and text-only interaction modes.
- [ ] Results table records per-flow: hallucinations reached engine (must be 0), voice drift events (must be 0), unintended fallback prompts (must be 0), session completion without error (must be 100%), p95 latency (must meet §2 targets).
- [ ] Results written to `tasks/v7-peak-fidelity-regression-results.md`.
- [ ] PRD passes only when all runs are clean.

---

### Track B — OpenAI Realtime API (parallel, feature-flagged)

This track is scaffolded in this PRD so it can be evaluated alongside Track A without blocking the incremental ship. It is the canonical answer to "let OpenAI do the whole thing" because OpenAI's server does VAD, transcription, LLM routing (optional — we bypass for V7's strict script), and TTS in one session.

#### US-013: Scaffold V7 Realtime session route
**Description:** As a developer, I want a `/api/treatment-v7/realtime-session` route that mints an ephemeral Realtime API session configured for V7 strict-script constraints.

**Acceptance Criteria:**
- [ ] Route returns a short-lived session token suitable for browser WebRTC/WebSocket connection.
- [ ] Session config disables the model's own text generation where possible (we inject exact scripted text). Where disabling isn't possible, `instructions` explicitly forbids model-generated content and instructs it to play only text provided via conversation items.
- [ ] Session config enables `input_audio_transcription` with `gpt-4o-mini-transcribe`, `language: 'en'`.
- [ ] Session config selects the V7 default TTS voice (`shimmer` per US-005).
- [ ] Server-side VAD parameters are set for conversational pacing (threshold 0.5, prefix_padding_ms 300, silence_duration_ms 500 — tune in US-016).
- [ ] The route reuses the auth check pattern of other V7 routes.
- [ ] The existing `app/api/labs/openai-session/route.ts` is adapted as the starting point and deprecated once this route is live.
- [ ] Typecheck passes.

#### US-014: V7RealtimeSession React component
**Description:** As a developer, I want a `components/treatment/v7/V7RealtimeSession.tsx` component that presents the same V7 UI but uses OpenAI Realtime for speech I/O.

**Acceptance Criteria:**
- [ ] Component mounts a WebRTC peer connection to the OpenAI Realtime session.
- [ ] User audio is streamed continuously to the server; OpenAI's server VAD decides when to produce a transcription event.
- [ ] Transcription events are forwarded to the V7 treatment state machine identically to the request/response pipeline (reuse `sendMessage`).
- [ ] Scripted responses from V7 are sent to the Realtime session as `conversation.item.create` with `type: 'message'` and played back via the session's built-in audio track.
- [ ] The compliance guard (spoken-text == apiMessage) runs before each `conversation.item.create`.
- [ ] Barge-in is handled by the Realtime session (server-side VAD interrupts playback on detected speech).
- [ ] Disconnection auto-reconnects once; subsequent failures trigger the text-mode fallback (US-008).
- [ ] Typecheck passes.
- [ ] Verified in browser: a full problem-shifting flow runs end-to-end with zero `/api/transcribe` and zero `/api/tts` calls.

#### US-015: Feature flag `V7_SPEECH_PIPELINE`
**Description:** As an operator, I want a single env flag to choose between the request/response and Realtime pipelines at the session boundary.

**Acceptance Criteria:**
- [ ] `V7_SPEECH_PIPELINE=request_response` (default) uses the existing `TreatmentSession`.
- [ ] `V7_SPEECH_PIPELINE=realtime` uses `V7RealtimeSession`.
- [ ] The dispatch happens at the page/route level, not inside any shared component.
- [ ] Both components render an identical UI shell, so QA can run the same test plan against both.
- [ ] Admin debug drawer has a per-session override for this flag.
- [ ] Typecheck passes.

#### US-016: Tune Realtime VAD parameters on the V7 corpus
**Description:** As a QA engineer, I need Realtime VAD settings tuned so that short answers ("yes", "no", single words) are never cut off and long reflective pauses are never interpreted as end-of-turn.

**Acceptance Criteria:**
- [ ] Recorded corpus of 50 V7 utterances spanning 1-word answers, short phrases, long reflections with pauses, and whispered responses.
- [ ] Grid search over `threshold`, `prefix_padding_ms`, `silence_duration_ms` with results scored on "captured full utterance" and "did not falsely segment a pause."
- [ ] Winning parameters written to `/api/treatment-v7/realtime-session` and documented in `docs/observability-v7-speech.md`.
- [ ] Retest US-012 regression suite on the Realtime pipeline; results written to `tasks/v7-peak-fidelity-realtime-regression-results.md`.

#### US-017: Decision gate — which pipeline ships as default?
**Description:** As a product owner, I want an explicit decision point where we compare Track A and Track B regression results and pick a default.

**Acceptance Criteria:**
- [ ] Comparison document `docs/v7-pipeline-decision.md` records: latency, fidelity, hallucination rate, voice drift, cost per session, and qualitative UX notes for both pipelines.
- [ ] A recommendation is stated explicitly.
- [ ] If Realtime is chosen, Track A remains available as a fallback (feature-flagged) for 30 days post-rollout.
- [ ] If Request/Response is chosen, Track B remains available for 30 days for continued evaluation.

---

## 4. Functional Requirements

**Configuration**

- FR-1: `OPENAI_STT_MODEL` env var selects the STT model. Default `gpt-4o-mini-transcribe`.
- FR-2: `OPENAI_TTS_MODEL` env var selects the primary TTS model. Default `gpt-4o-mini-tts`.
- FR-3: `OPENAI_TTS_FALLBACK_MODEL` env var selects the retry TTS model. Default `tts-1-hd`.
- FR-4: `OPENAI_TTS_INSTRUCTIONS` env var supplies the tone/style prompt for `gpt-4o-mini-tts`. Default: "Warm, calm, reassuring, unhurried — therapeutic but not clinical. No accent. Natural pacing."
- FR-5: `OPENAI_TTS_DEFAULT_VOICE` env var. Default `shimmer`.
- FR-6: `V7_SPEECH_PIPELINE` env var. Values: `request_response` (default) | `realtime`.
- FR-7: `STT_PROVIDER`, `TTS_PROVIDER` from the prior PRD are deprecated; if set to `existing` they must log a deprecation warning on boot.

**STT**

- FR-8: `/api/transcribe` with `treatmentVersion=v7` always calls OpenAI, never self-hosted. `providerOverride` is accepted but logged as a deprecation.
- FR-9: OpenAI STT call always sends `language: 'en'`, `response_format: 'verbose_json'`, and the domain-bias `prompt`.
- FR-10: Server-side hallucination filter applies all five gates in US-002 in order and returns `transcript: ""` with `hallucination_filtered: true` on any hit.
- FR-11: Server retries OpenAI once on 429/5xx/timeout per US-009.

**TTS**

- FR-12: `/api/tts` with `treatmentVersion=v7` always calls OpenAI, never Kokoro or ElevenLabs.
- FR-13: Primary model is `OPENAI_TTS_MODEL`. On failure, retry once; on second failure, call `OPENAI_TTS_FALLBACK_MODEL` with the same voice/text.
- FR-14: `gpt-4o-mini-tts` calls include `instructions: OPENAI_TTS_INSTRUCTIONS`.
- FR-15: Spoken-text-equals-server-message compliance guard (US-005 of prior PRD) runs unchanged.
- FR-16: Cache keys use `<voice_name>:<text>` where `voice_name` is a stable mapping — never `"unknown"`.

**Capture**

- FR-17: The audio-capture auto-process timer is removed. Uploads occur only on VAD `onSpeechEnd`, PTT release, or an explicit flush trigger.
- FR-18: If VAD is unavailable, the system falls back to the pre-existing timer and logs `stt_vad_unavailable_fallback`.
- FR-19: The accumulator must never concatenate a filtered transcript (`hallucination_filtered: true`) with a real one. If the server marks a response as filtered, the client treats it as empty.

**Fallback & errors**

- FR-20: On STT/TTS provider failure after retries, show the text-mode dialog. Self-hosted fallback is removed from V7's user-visible path.
- FR-21: No UI string mentions the underlying STT/TTS vendor.

**Voice identity**

- FR-22: Every V7 session uses exactly one voice from first audio to last audio. Voice drift between cached and streamed segments is a regression.
- FR-23: Voice is selected per FR-5 and propagated to both `V7AudioPreloader` and `useNaturalVoice` from one source of truth.

**Realtime pipeline (Track B)**

- FR-24: `V7_SPEECH_PIPELINE=realtime` routes all speech I/O through `/api/treatment-v7/realtime-session`.
- FR-25: In Realtime mode, `/api/transcribe` and `/api/tts` are not called during a normal session.
- FR-26: Realtime session config disables model-generated content where possible; where not possible, `instructions` forbid it and the compliance guard runs on every `conversation.item.create`.
- FR-27: The treatment state machine is unchanged between pipelines — it receives identical transcript events and emits identical scripted responses.

---

## 5. Non-Goals (Out of Scope)

- **No local GPU / personaplex / self-hosted model path.** This is held as a contingency and will be evaluated only if the OpenAI-only stack cannot meet the fidelity targets in §2.
- **No return to ElevenLabs.** Cost constraint is a hard no.
- **No multi-language support.** V7 is English-only; detection of any other language is treated as hallucination.
- **No in-session voice switching.** One voice per session per FR-22. Changing voices requires restarting the session.
- **No model-generated patient-facing wording.** V7 remains the sole author of all scripted text. The Realtime path uses OpenAI only for speech I/O, never for response generation.
- **No emotion / dynamic tone steering per utterance.** `gpt-4o-mini-tts` `instructions` is set once per session via env var; it is not varied per prompt.
- **No changes to the V7 treatment state machine.** This PRD is purely speech I/O.
- **No changes to payment, auth, or session lifecycle.**
- **No A/B testing framework for voice selection in this PRD.** Voice is configured per-tenant or per-env.

---

## 6. Technical Considerations

### Current pipeline flaws being fixed

Three bugs interact to produce the symptom you reported:

1. **Silence-upload path.** `useAudioCapture` auto-processes every 1.5 s regardless of speech. In a quiet room this uploads ambient audio, which `whisper-1` hallucinates into Welsh YouTube boilerplate.
2. **Metadata ignored.** OpenAI's `verbose_json` response includes `no_speech_prob`, `avg_logprob`, `language` — all of which clearly indicate hallucination on silence. The route discards them.
3. **`"unknown"` voice cache key.** `useNaturalVoice` falls through to `"unknown"` because `voiceProvider` is never passed from `TreatmentSession`. Every lookup misses the static cache, every prompt is streamed at full cost, and the voice drifts between cached (Kokoro) and streamed (OpenAI `alloy`) segments.

Each of these is independently sufficient to cause a session-level fidelity failure. All three ship fixes in Track A.

### Model choices — why these and not others

- **STT: `gpt-4o-mini-transcribe`** — newer than `whisper-1`, better silence handling, lower cost, same API shape. `gpt-4o-transcribe` is slightly higher quality but materially more expensive; `gpt-4o-mini-transcribe` is the right starting default and can be swapped via FR-1 without code changes.
- **TTS primary: `gpt-4o-mini-tts`** — steerable via `instructions`, naturalness generally equal to or better than `tts-1-hd` on conversational content, cheaper per character. Minor latency cost vs `tts-1-hd`.
- **TTS fallback: `tts-1-hd`** — mature, reliable, same voices, no `instructions` dependency. Good hedge if `gpt-4o-mini-tts` hits availability issues.

### Realtime API — why it's Track B and not Track A

Shipping Realtime requires a parallel `V7RealtimeSession` component, WebRTC plumbing, careful handling of the "model must not speak outside script" constraint, and VAD-parameter tuning against the V7 corpus. Track A delivers 90% of the fidelity win in a fraction of the engineering scope. Track B is the right long-term architecture but gating on it delays the hallucination fix the user is hitting today.

### Static-audio library regeneration

The current Kokoro library in `public/audio/v7/static/` was generated under an unspoken assumption: that every V7 session uses Kokoro. Once we move to OpenAI TTS, **any cached Kokoro segment played mid-session causes voice drift**, which is an immediate fidelity failure. The library must be regenerated with the chosen OpenAI voice, and the preloader must refuse to load a mismatched manifest (US-007).

### Cost

- `gpt-4o-mini-transcribe`: ~$0.003 / minute.
- `gpt-4o-mini-tts`: ~$0.015 / 1K chars output (roughly $0.002 per average V7 prompt).
- Realtime API: $0.06 / minute input audio + $0.24 / minute output audio (rough current pricing; confirm at implementation time).

Realtime is materially more expensive per minute than request/response. This is another reason Track B is parallel rather than mandatory.

### Compliance

STRICT_SPEECH_MODE, routing-token suppression, spoken-text-equals-apiMessage, and the non-English hallucination rejection (US-002) together enforce that no unauthorized wording reaches the patient — regardless of which pipeline is active.

### Observability

The existing console logs are insufficient for operating this in production. US-010 adds structured logs; the rollup queries in `docs/observability-v7-speech.md` are a prerequisite for shipping Track A to production.

---

## 7. Success Metrics

- Zero hallucinations reach the treatment engine in 10 consecutive silent-room sessions.
- Hallucination filter rate (`hallucination_filtered: true` / total STT calls) < 5% in production after one week. Higher indicates threshold drift or upstream regression.
- `client safety-net caught it` rate < 1% of STT responses (US-011).
- Voice drift events = 0 across 20 consecutive sessions (manual QA of audio recordings).
- p95 time-to-first-audio: ≤ 800 ms for cached, ≤ 1800 ms for streamed.
- Session-abort rate due to speech errors < 0.5%.
- User-visible vendor leak events = 0 across full regression suite.
- Blind TTS A/B test: ≥ 15/20 reviewers rate new voice as equivalent or better than baseline Kokoro.

---

## 8. Open Questions

- Do we want a **semantic plausibility gate** (a small GPT classifier on transcripts) as an additional line of defense, or are the metadata gates sufficient? Lean: defer until we see production hallucination rates after Track A.
- Should the **text-mode fallback** also disable TTS of *future* messages in the same session (because playback is broken), or only the one that failed (because maybe it was transient)? Lean: disable for the remainder of the session; re-enable on session resume.
- Do we want the regenerated static-audio library committed to git (deterministic deploys) or generated at build time (smaller repo)? Lean: committed. Size is bounded by the number of V7 scripted prompts; deterministic deploys are more important than repo size.
- When `gpt-4o-mini-tts` ships new voices in the future, what is our process for evaluating a switch? Lean: US-005's admin override + a lightweight comparison protocol to be written separately.
- Should Track B's Realtime pipeline also be used for **labs / VoiceTreatmentDemo**, or kept exclusive to V7? Lean: V7-only first; labs can adopt it after V7 ships.
- Is `WHISPER_SERVICE_URL` and the `whisper-service/` Python codebase deleted when Track A ships, or kept for non-V7 versions (v4/v5/v6)? Lean: keep — v4/v5/v6 still use it. Only V7 deprecates it.

---

## 9. Sequencing & Dependencies

```
Track A (must ship in this order):
  US-001 (VAD gate)            ─┐
  US-002 (metadata gate)        │
  US-003 (STT model upgrade)    ├── all independent, parallel OK
  US-010 (telemetry)           ─┘

  US-006 (voice cache bug fix) ──┐
  US-005 (voice = shimmer)        │── must ship before US-007
  US-004 (TTS model upgrade)    ──┘

  US-007 (regenerate static)   ── depends on US-004, US-005, US-006
  US-009 (retry logic)         ── can parallel with US-007
  US-008 (text-mode fallback)  ── depends on US-004, US-009
  US-011 (client safety net)   ── cleanup, post US-002
  US-012 (regression suite)    ── ships last in Track A

Track B (independent of Track A):
  US-013 (realtime session route)
  US-014 (V7RealtimeSession)
  US-015 (feature flag)
  US-016 (VAD tuning)
  US-017 (decision gate)  ── blocked on Track A + Track B regression data
```

Track A should ship end-to-end before Track B decision gate runs. Track B can begin in parallel but cannot be evaluated as a default-candidate until Track A is live and producing baseline metrics.

---

## 10. Rollback Plan

Each Track A story ships behind its model env var or feature flag. If any of the following happen in production after rollout:

- Hallucination rate > 10% over a 24-hour window
- p95 latency breaches §2 targets by > 50%
- Session-abort rate > 2%
- Voice drift reports from > 2 users

…revert by setting:

- `OPENAI_STT_MODEL=whisper-1`
- `OPENAI_TTS_MODEL=tts-1-hd` (the fallback becomes primary)
- Re-enable the auto-process timer via a temporary `STT_AUTO_PROCESS_TIMER=true` flag

…until the regression is diagnosed. No code revert is required for any of the above.
