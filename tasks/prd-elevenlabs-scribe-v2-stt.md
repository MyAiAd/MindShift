# PRD: ElevenLabs Scribe v2 Realtime STT Provider

## Introduction

This feature adds **ElevenLabs Scribe v2 Realtime** (`scribe_v2_realtime`) as a third speech-to-text (STT) option in the V9 voice pipeline, alongside the existing **OpenAI** and **Whisper (self-hosted)** providers.

Currently, selecting ElevenLabs as the TTS output provider still routes microphone input through OpenAI's transcription API, splitting the session across two vendors. This feature lets an operator consolidate onto a single ElevenLabs account for both directions, or mix ElevenLabs STT freely with any TTS provider.

The Scribe realtime path streams audio directly from the browser to ElevenLabs over a WebSocket connection, rather than buffering a WAV file and uploading it on silence. Transcripts arrive in real-time as the patient speaks — reducing the round-trip between speaking and the next AI response. Scribe handles VAD and hallucination suppression server-side.

The feature reuses the existing `ELEVENLABS_API_KEY` (also used for TTS), is scoped to the V9 treatment session only, supports both the continuous-listening and guided PTT interaction modes, and is fully switchable at runtime from the existing admin voice-settings UI without a redeployment.

---

## Goals

- Add `elevenlabs` as a valid `stt_provider` value in `system_voice_settings`, the DB singleton that controls the active voice pair.
- Implement the client-side realtime WebSocket path using ElevenLabs Scribe `scribe_v2_realtime`, replacing the VAD → buffer → POST cycle when the provider is `elevenlabs`.
- Add a secure server-side endpoint that issues single-use Scribe tokens so the `ELEVENLABS_API_KEY` is never exposed to the browser.
- Add a server-side batch `ElevenLabsScribeSttProvider` class (using `scribe_v2`) that satisfies the existing `SttProvider` interface, enabling the admin round-trip test and availability check.
- Surface ElevenLabs as a third radio option in the admin voice-settings UI with a pricing estimate and a `ELEVENLABS_SCRIBE_USD_PER_MINUTE` env override.
- Support both continuous-listening mode (`commit_strategy=vad`) and guided PTT mode (`commit_strategy=manual`).
- Ensure free pairing: ElevenLabs STT may be combined with OpenAI, ElevenLabs, or Kokoro TTS without restriction.
- Leave the V7 and earlier voice paths completely untouched.

---

## User Stories

### US-001: DB migration — add `elevenlabs` to the STT constraint

**Description:** As a developer, I need the database to accept `elevenlabs` as a valid `stt_provider` value so that the admin UI can persist the new provider selection.

**Acceptance Criteria:**
- [ ] New Supabase migration file created (e.g. `063_elevenlabs_stt_provider.sql`).
- [ ] The `CHECK (stt_provider IN ('openai', 'whisper-local'))` constraint on `system_voice_settings` is replaced with one that also allows `'elevenlabs'`.
- [ ] Migration applies cleanly against the current schema without touching the `tts_provider` column or any other table.
- [ ] `lib/v9/voice-settings.ts` `sanitizeStt()` function updated to recognise `'elevenlabs'` as a valid `V9SttProvider` (no longer falls through to `'openai'`).
- [ ] `lib/voice/speech-config.ts` `V9SttProvider` type updated: `'openai' | 'whisper-local' | 'elevenlabs'`.
- [ ] Typecheck passes (`tsc --noEmit`).

---

### US-002: Server-side batch Scribe provider (for admin test + availability check)

**Description:** As a developer, I need a server-side `SttProvider` implementation that wraps ElevenLabs Scribe's batch endpoint (`scribe_v2`) so the admin "Test with my mic" button and the availability indicator work correctly, following the exact same pattern as `OpenAiSttProvider` and `WhisperLocalSttProvider`.

**Acceptance Criteria:**
- [ ] New file `lib/voice/stt-providers/elevenlabs-scribe.ts` created.
- [ ] `ElevenLabsScribeSttProvider` class implements the `SttProvider` interface (`id`, `displayName`, `isAvailable()`, `transcribe()`).
- [ ] `id` is `'elevenlabs'`, `displayName` is `'ElevenLabs (Scribe v2)'`.
- [ ] `isAvailable()` returns `true` iff `ELEVENLABS_API_KEY` is set in the environment.
- [ ] `transcribe()` POSTs the audio blob to `https://api.elevenlabs.io/v1/speech-to-text` with `model_id: 'scribe_v2'` and `xi-api-key: ELEVENLABS_API_KEY` as a header.
- [ ] Response is normalised into the shared `SttTranscribeResult` shape (`text`, `segments`, `language`, `durationSeconds`, `cost`). Where Scribe does not return a field (e.g. `segments`), an empty array or sensible default is used.
- [ ] `lib/voice/stt-providers/index.ts` registry updated: `elevenlabs: new ElevenLabsScribeSttProvider()`.
- [ ] `SttProviderId` type in `lib/voice/stt-providers/types.ts` updated to `'openai' | 'whisper-local' | 'elevenlabs'`.
- [ ] `lib/v9/voice-adapter.ts` `resolveSttProviderId()` recognises `'elevenlabs'` via the updated index.
- [ ] Typecheck passes.

---

### US-003: Server-side API route — issue single-use Scribe realtime token

**Description:** As a browser client, I need a server endpoint that returns a short-lived ElevenLabs single-use token for the Scribe realtime WebSocket, so the `ELEVENLABS_API_KEY` is never sent to or stored in the browser.

**Acceptance Criteria:**
- [ ] New route `app/api/elevenlabs-scribe-token/route.ts` created (method: `POST`).
- [ ] Route requires the caller to be authenticated (Supabase session) — returns `401` if no session.
- [ ] Route calls `POST https://api.elevenlabs.io/v1/single-use-token/realtime_scribe` with `xi-api-key: ELEVENLABS_API_KEY` as a server-to-server request.
- [ ] On success, returns `{ token: string }` to the client.
- [ ] On failure (missing key, ElevenLabs rejects), returns a structured error JSON — no raw API key, no raw ElevenLabs response body — with an appropriate HTTP status code (`500` for server misconfiguration, `502` for upstream rejection).
- [ ] Route uses `export const runtime = 'nodejs'`.
- [ ] Typecheck passes.

---

### US-004: Client-side realtime Scribe hook

**Description:** As a developer, I need a React hook that manages the full lifecycle of an ElevenLabs Scribe realtime WebSocket connection — including token fetching, audio capture from a dedicated microphone stream, automatic reconnection, PTT signalling, and transcript delivery — so that `useNaturalVoice` can use it as a drop-in replacement for `useAudioCapture` when the STT provider is ElevenLabs.

**Acceptance Criteria:**

_Interface_
- [ ] New file `components/voice/useElevenLabsScribeRealtime.ts` created.
- [ ] Hook accepts:
  - `enabled: boolean`
  - `guidedMode: boolean` — when `true`, uses `commit_strategy=manual` (PTT); when `false`, uses `commit_strategy=vad` (continuous).
  - `onTranscript: (t: string) => void` — called for each committed (final) transcript.
  - `onPartialTranscript?: (t: string) => void` — called for partial transcripts (interim display).
  - `onError?: (msg: string) => void` — called on non-recoverable errors.
  - `onProcessingChange?: (processing: boolean) => void` — mirrors `useAudioCapture`'s equivalent.
  - `languageCode?: string` — default `'en'`.
- [ ] Hook exposes:
  - `isCapturing: boolean`
  - `isProcessing: boolean`
  - `commitNow: () => void` — sends a manual commit message over the WebSocket (used by PTT release).
  - `pauseCapture: () => void` — stops sending audio without closing the WebSocket (used by PTT press start to discard pre-press audio).
  - `resumeCapture: () => void` — resumes audio streaming.

_Audio capture_
- [ ] Hook opens its own `getUserMedia({ audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })` stream — fully independent of the existing VAD AudioWorklet.
- [ ] Uses a `ScriptProcessorNode` (or `AudioWorkletNode` if supported) on an `AudioContext` at 16 000 Hz to extract raw PCM.
- [ ] Converts 32-bit float samples to 16-bit signed integers before sending.
- [ ] Buffers approximately 100 ms of audio (1 600 samples at 16 kHz) per WebSocket send to match ElevenLabs' recommended minimum chunk size.

_WebSocket lifecycle_
- [ ] On `enabled` becoming `true`: fetches a fresh token from `/api/elevenlabs-scribe-token`, then opens `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&commit_strategy=<vad|manual>&audio_format=pcm_16000&language_code=<languageCode>` using `?token=<token>` for authentication.
- [ ] On `enabled` becoming `false` or on unmount: closes the WebSocket with code 1000, stops the `getUserMedia` stream, and cancels any pending token fetch. No microphone access remains after disable.
- [ ] **Reconnect strategy:** If the WebSocket closes unexpectedly (non-1000 code), the hook waits 500 ms and fetches a fresh token + reopens the socket, up to a maximum of 3 reconnect attempts within a 30-second window. After 3 failures calls `onError`. The attempt counter resets on a successful `enabled=false → true` transition.
- [ ] Token is fetched fresh on every open (tokens are single-use; stale tokens must not be reused).

_Transcript handling_
- [ ] On `partial_transcript` message from server: call `onPartialTranscript` with `data.text`.
- [ ] On `committed_transcript` message from server: call `onTranscript` with `data.text`; call `onProcessingChange(false)`.
- [ ] Hallucination filtering is **not** applied client-side — ElevenLabs Scribe handles suppression server-side.

- [ ] Typecheck passes.

---

### US-005: Wire the realtime hook into `useNaturalVoice`

**Description:** As a developer, I need `useNaturalVoice` to activate `useElevenLabsScribeRealtime` for mic input when `sttProviderOverride` is `'elevenlabs'`, and continue using `useAudioCapture` for all other providers, so that the existing V9 voice experience is unchanged for OpenAI and Whisper sessions.

**Acceptance Criteria:**
- [ ] `useNaturalVoice.tsx` props interface: `sttProviderOverride` type updated to `'existing' | 'openai' | 'elevenlabs' | undefined`.
- [ ] When `sttProviderOverride === 'elevenlabs'` AND `treatmentVersion === 'v9'`:
  - `useElevenLabsScribeRealtime` is instantiated with `enabled = isMicEnabled && !isSpeechFallbackPaused`.
  - `useAudioCapture` is instantiated with `enabled: false`.
  - `useVAD` is instantiated with `enabled: false` (Scribe handles VAD server-side).
  - Committed transcripts from the Scribe hook call the existing `onTranscriptRef.current(transcript)` path unchanged.
  - Partial transcripts update `interimTranscript` state (displayed in the processing shimmer).
- [ ] When `sttProviderOverride` is NOT `'elevenlabs'`, `useAudioCapture` and `useVAD` run exactly as before. No behaviour change.
- [ ] `isProcessing` and `isCapturing` from the Scribe hook are exposed through the same returned state fields (`naturalVoice.isProcessing`, `naturalVoice.isListening`) that the treatment UI already reads.
- [ ] The `guidedMode` prop from `useNaturalVoice` is forwarded to `useElevenLabsScribeRealtime` unchanged.
- [ ] Typecheck passes.

---

### US-006: Wire `elevenlabs` STT through the V9 treatment session

**Description:** As a developer, I need `TreatmentSession.tsx` (V9) to correctly pass the `elevenlabs` STT override to `useNaturalVoice` so that when the admin has selected ElevenLabs as the STT provider, the session uses Scribe realtime for mic input.

**Acceptance Criteria:**
- [ ] `components/treatment/v9/TreatmentSession.tsx`: the `sttProviderOverride` derivation (around line 982) extended — when `activeSttProvider === 'elevenlabs'`, the value passed to `useNaturalVoice` is `'elevenlabs'`.
- [ ] The admin debug drawer's "Voice:" line correctly shows e.g. `elevenlabs → openai` when the Scribe provider is active.
- [ ] The Mic button UI behaves identically to the current OpenAI path — toggling it starts/stops the Scribe WebSocket connection.
- [ ] Typecheck passes.

---

### US-007: Update admin voice-settings API to accept `elevenlabs` as an STT value

**Description:** As a super_admin, I need the admin API PUT endpoint to accept `elevenlabs` as a valid STT provider so I can save the selection to the DB.

**Acceptance Criteria:**
- [ ] `app/api/admin/voice-settings/route.ts` `validateStt()` updated: accepts `'openai' | 'whisper-local' | 'elevenlabs'`.
- [ ] The 400 error response body updated: `'Body must be { stt: "openai" | "whisper-local" | "elevenlabs", tts: ... }'`.
- [ ] `reportStt()` includes a reason string for ElevenLabs when unavailable: `'ELEVENLABS_API_KEY not set'`.
- [ ] Typecheck passes.

---

### US-008: Admin UI — add ElevenLabs Scribe radio with cost estimate and env-overridable pricing

**Description:** As a super_admin, I want to see ElevenLabs Scribe as a third radio option in the Speech-to-Text section of the voice-settings admin panel, with an availability indicator and a projected cost estimate, so I can make an informed provider choice.

**Acceptance Criteria:**
- [ ] `app/dashboard/admin/settings/page.tsx`: local `SttProviderId` type updated to `'openai' | 'whisper-local' | 'elevenlabs'`.
- [ ] A third radio option appears in the STT provider list when the API returns it.
- [ ] Radio label: **ElevenLabs (Scribe v2 Realtime)** with monospace id `elevenlabs`.
- [ ] Description under the label: `"Streams audio over WebSocket in real time. VAD and hallucination filtering handled server-side by ElevenLabs. Requires ELEVENLABS_API_KEY."`.
- [ ] Radio is greyed-out and non-selectable when `available === false` (key not set on the server).
- [ ] `estimateSttCost()` updated: ElevenLabs STT cost = `minutes × ELEVENLABS_SCRIBE_USD_PER_MINUTE` (default `0.00667`, i.e. ~$0.40/hr). The constant is read from a `NEXT_PUBLIC_ELEVENLABS_SCRIBE_USD_PER_MINUTE` env var when set, so pricing can be corrected without a code deploy.
- [ ] Projected session cost recalculates correctly when the ElevenLabs radio is selected.
- [ ] `describeProjectedCostBasis()` updated to describe ElevenLabs STT pricing.
- [ ] The "Test with my mic" button works for ElevenLabs (routes to the batch `scribe_v2` provider via the existing `/api/admin/voice-settings/test` endpoint — see US-002).
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

---

### US-009: Guard V7 and earlier — no ElevenLabs STT bleed

**Description:** As a developer, I need to confirm that selecting ElevenLabs STT in the admin UI has absolutely no effect on V7 or older treatment sessions, which are hard-coded to use OpenAI STT.

**Acceptance Criteria:**
- [ ] `app/api/transcribe/route.ts`: the existing V7 guard (`if treatmentVersion === 'v7' → callOpenAIProvider`) continues to override to OpenAI even when the `provider` field is `'elevenlabs'`.
- [ ] Add log line `event: 'v7_elevenlabs_stt_override_ignored'` parallel to the existing `v7_legacy_stt_override_ignored` log.
- [ ] `useNaturalVoice.tsx`: add an explicit guard — `useElevenLabsScribeRealtime` is never activated unless `treatmentVersion === 'v9'`, even if `sttProviderOverride === 'elevenlabs'` is somehow passed in from an older session component.
- [ ] Typecheck passes.

---

### US-010: Propagate Scribe errors to the existing text-mode fallback system

**Description:** As a patient, if the ElevenLabs Scribe WebSocket fails (network drop, token expired, quota exceeded), I want the session to gracefully degrade to the existing text-mode fallback dialog rather than silently hanging — using the same `onSpeechProviderError` callback path already in place for OpenAI STT failures.

**Acceptance Criteria:**
- [ ] `useElevenLabsScribeRealtime` calls `onError` with a non-empty human-readable string on: WebSocket close with non-1000 code after exhausting retries, token fetch failure (non-2xx from `/api/elevenlabs-scribe-token`), and microphone permission denied.
- [ ] `useNaturalVoice` maps `onError` from the Scribe hook → `onSpeechProviderError({ kind: 'stt', provider: 'elevenlabs', message })`.
- [ ] Confirm that `TreatmentSession.tsx`'s existing `onSpeechProviderError` handler increments `textModeErrorTimestampsRef` correctly for `kind: 'stt'` regardless of provider, and that two errors within 10 s trigger the text-mode fallback dialog.
- [ ] Typecheck passes.

---

### US-011: PTT (guided mode) support with Scribe realtime

**Description:** As a patient using guided / push-to-talk mode, I want the Scribe realtime WebSocket to correctly capture only the audio I speak while holding the PTT orb, so my speech is transcribed accurately without picking up AI audio or ambient noise between turns.

**Acceptance Criteria:**
- [ ] `useElevenLabsScribeRealtime` implements the `guidedMode` prop:
  - When `guidedMode = true`: opens the WebSocket with `commit_strategy=manual`. Audio streaming is paused by default on connection.
  - When the PTT orb is pressed (`handlePTTStart` in `TreatmentSession.tsx`): calls `resumeCapture()` on the Scribe hook (begins sending PCM frames to the WebSocket).
  - When the PTT orb is released (`handlePTTEnd`): calls `commitNow()` on the Scribe hook (sends the ElevenLabs `input_audio_buffer.commit` message), then calls `pauseCapture()` (stops streaming).
  - `commitNow()` causes Scribe to emit a `committed_transcript` message, which flows through the existing `onTranscript` → `sendMessage` path as normal.
- [ ] `handlePTTStart` and `handlePTTEnd` in `TreatmentSession.tsx` updated to call the hook's `resumeCapture` and `commitNow`+`pauseCapture` methods when the active STT provider is `elevenlabs`.
- [ ] When `guidedMode = false`: hook operates in continuous VAD mode exactly as specified in US-004.
- [ ] `useNaturalVoice` forwards `guidedMode` to `useElevenLabsScribeRealtime` (it already receives it as a prop).
- [ ] No audio is sent to Scribe while the PTT button is not held — confirmed by the WebSocket binary message count being zero between PTT presses.
- [ ] Typecheck passes.

---

## Functional Requirements

- **FR-1:** The string `'elevenlabs'` must be accepted as a valid `stt_provider` value in the `system_voice_settings` DB table, enforced at the database constraint level (migration) and at the API validation layer (`validateStt()`).
- **FR-2:** A new server-side `ElevenLabsScribeSttProvider` class must implement the `SttProvider` interface using the ElevenLabs batch Scribe endpoint (`scribe_v2`), registered in `lib/voice/stt-providers/index.ts`.
- **FR-3:** A new authenticated server route (`POST /api/elevenlabs-scribe-token`) must fetch a single-use ElevenLabs Scribe realtime token from ElevenLabs using the server-side `ELEVENLABS_API_KEY`, returning only `{ token }` to the client.
- **FR-4:** A new client-side hook (`useElevenLabsScribeRealtime`) must open a dedicated `getUserMedia` microphone stream (16 kHz, mono), convert audio to 16-bit signed PCM, and stream it in ≥100 ms chunks over a WebSocket to `wss://api.elevenlabs.io/v1/speech-to-text/realtime`.
- **FR-5:** The hook must call `onTranscript` for each committed transcript and `onPartialTranscript` for each partial transcript received from the server.
- **FR-6:** The hook must attempt up to 3 automatic reconnections (with a fresh token each time) on unexpected WebSocket closure before calling `onError`.
- **FR-7:** `useNaturalVoice` must activate `useElevenLabsScribeRealtime` (and pass `enabled: false` to `useAudioCapture` and `useVAD`) when `sttProviderOverride === 'elevenlabs'` and `treatmentVersion === 'v9'` and `isMicEnabled`.
- **FR-8:** `TreatmentSession.tsx` (V9) must pass `sttProviderOverride: 'elevenlabs'` to `useNaturalVoice` when the session's pinned voice pair has `stt: 'elevenlabs'`.
- **FR-9:** ElevenLabs STT must be freely pairable with any TTS provider (`openai`, `elevenlabs`, or `kokoro`) without restriction at the API or UI layer.
- **FR-10:** The admin STT radio panel must show a third option for ElevenLabs Scribe with availability, description, and pricing estimate. The per-minute rate must be overridable via `NEXT_PUBLIC_ELEVENLABS_SCRIBE_USD_PER_MINUTE` without a code deploy.
- **FR-11:** V7 and earlier treatment versions must continue using OpenAI STT unconditionally, even if `stt_provider` is set to `'elevenlabs'` in the DB singleton.
- **FR-12:** All Scribe errors must propagate through the existing `onSpeechProviderError` path, triggering the text-mode fallback dialog after two failures within 10 seconds.
- **FR-13:** The hook must close the WebSocket and release the microphone stream on unmount or when `enabled` transitions to `false`. No background audio capture may persist.
- **FR-14:** `ELEVENLABS_API_KEY` must never appear in any client-side bundle, log line, API response body, or browser console output.
- **FR-15:** In guided PTT mode, the hook must operate with `commit_strategy=manual`. Audio streaming must be paused by default; `resumeCapture()` starts it, and `commitNow()` followed by `pauseCapture()` ends each turn.
- **FR-16:** Hallucination filtering is **not** applied client-side for the ElevenLabs path — Scribe handles it server-side. No `isLikelyHallucination()` call is made on Scribe committed transcripts.

---

## Non-Goals (Out of Scope)

- **No Scribe batch upload path in the live session** — the realtime WebSocket is the only in-session STT path for ElevenLabs. The batch `scribe_v2` provider is implemented only to satisfy the admin test button and availability check.
- **No ElevenLabs STT for V7 or earlier** — those versions are frozen at OpenAI STT.
- **No diarisation or word-level timestamps** surfaced in the UI — Scribe supports them but the session UI has no place to display them.
- **No separate `ELEVENLABS_STT_API_KEY`** — the same `ELEVENLABS_API_KEY` used for TTS covers Scribe.
- **No automatic failover from Scribe to OpenAI** — if Scribe fails after 3 reconnect attempts, the existing text-mode fallback dialog appears. Automatic provider switching would introduce unannounced cost/vendor changes.
- **No in-session cost tracking per-utterance for Scribe realtime** — ElevenLabs does not return per-utterance cost in the realtime WebSocket; the admin cost estimate is projected, not measured.

---

## Design Considerations

### Server-side token flow
```
Browser                    Next.js server              ElevenLabs
   │  POST /api/elevenlabs-scribe-token  │                    │
   │─────────────────────────────────────▶                    │
   │                       │  POST /v1/single-use-token/...   │
   │                       │──────────────────────────────────▶
   │                       │◀─────────────────── { token }  ──│
   │◀─────── { token } ────│                    │
   │                       │                    │
   │  WebSocket wss://...?token=<token>          │
   │────────────────────────────────────────────▶
   │  ◀──── partial / committed transcripts ─── │
```

### Audio capture architecture
The hook opens its **own** `getUserMedia` stream at 16 kHz mono, entirely separate from the existing VAD AudioWorklet. This avoids coupling to the VAD pipeline's internal buffer format, eliminates any VAD-related audio manipulation, and allows the Scribe hook to be cleanly enabled/disabled without touching the VAD instance at all. The tradeoff is two simultaneous mic acquisitions when both hooks are mounted — but because `useAudioCapture` is passed `enabled: false` when Scribe is active, only one mic stream is ever live at a time.

PCM conversion: `ScriptProcessorNode.onaudioprocess` → iterate `Float32Array` → `Int16Array` → send as `ArrayBuffer` over the WebSocket binary channel.

### Commit strategy by mode
| Mode | `commit_strategy` | Audio flow |
|---|---|---|
| Continuous (default) | `vad` | Stream continuously; Scribe commits on silence |
| Guided / PTT | `manual` | Stream only while PTT held; send commit on release |

### WebSocket authentication
ElevenLabs Scribe realtime accepts auth via `?token=<single-use-token>` query param. The `xi-api-key` header is NOT sent from the browser. The token is fetched fresh per connection; it must not be cached or reused.

### Reconnect backoff
Attempt 1: after 500 ms. Attempt 2: after 1 500 ms. Attempt 3: after 3 000 ms. After 3 failures within a 30-second window: call `onError`, do not attempt further reconnection until `enabled` transitions `false → true` again.

---

## Technical Considerations

### Files to create (new)
| File | Purpose |
|---|---|
| `supabase/migrations/063_elevenlabs_stt_provider.sql` | DB constraint update |
| `lib/voice/stt-providers/elevenlabs-scribe.ts` | Batch Scribe `SttProvider` implementation |
| `app/api/elevenlabs-scribe-token/route.ts` | Single-use Scribe token endpoint |
| `components/voice/useElevenLabsScribeRealtime.ts` | Client-side realtime WebSocket hook |

### Files to modify (existing)
| File | Change |
|---|---|
| `lib/voice/speech-config.ts` | Add `'elevenlabs'` to `V9SttProvider` type |
| `lib/voice/stt-providers/types.ts` | Add `'elevenlabs'` to `SttProviderId` |
| `lib/voice/stt-providers/index.ts` | Register `ElevenLabsScribeSttProvider`; update `resolveSttProviderId` |
| `lib/v9/voice-settings.ts` | `sanitizeStt()` recognises `'elevenlabs'` |
| `app/api/admin/voice-settings/route.ts` | `validateStt()` + `reportStt()` unavailability reason |
| `app/api/transcribe/route.ts` | V7 guard log event for ElevenLabs |
| `components/voice/useNaturalVoice.tsx` | Activate Scribe hook when provider is `elevenlabs`; disable VAD + AudioCapture |
| `components/treatment/v9/TreatmentSession.tsx` | Pass `elevenlabs` through `sttProviderOverride`; wire PTT calls |
| `app/dashboard/admin/settings/page.tsx` | Third STT radio + cost estimate + env-overridable rate |

### Recommended build order
1. **US-001** — types + migration (everything else depends on this).
2. **US-002** + **US-003** + **US-007** — server-side provider, token route, API validation (parallel; no client dependency).
3. **US-004** — client hook (depends on token endpoint existing).
4. **US-005** — wire into `useNaturalVoice` (depends on hook).
5. **US-006** — wire into `TreatmentSession` (depends on `useNaturalVoice`).
6. **US-009** + **US-010** — guards and error propagation (can be done alongside US-005/006).
7. **US-011** — PTT support (depends on US-004 + US-005 + US-006 being complete).
8. **US-008** — admin UI (depends on US-007; can be done in parallel with US-004 onwards).

### V9 session pinning
The V9 backend pins the `voicePair` at session start in `lib/v9/core.ts`. The `activeSttProvider` resolution in `TreatmentSession.tsx` (around line 978–981) currently only maps `'openai'` and `'whisper-local'` to a `sttProviderOverride` value. The `'elevenlabs'` case must be added to this switch.

### No regression path
The Scribe WebSocket is gated entirely behind `sttProviderOverride === 'elevenlabs'`. The default DB value for `stt_provider` remains `'openai'`. All existing sessions and all V7 sessions are unaffected unless an admin explicitly selects ElevenLabs in the voice-settings UI.

---

## Success Metrics

- A super_admin can select ElevenLabs STT in the voice-settings UI and save successfully without a redeployment.
- A V9 session started after saving shows `elevenlabs → <tts>` in the admin debug drawer.
- In that session, the patient speaks and the Mic toggle pulses; a committed transcript fires within 800 ms of the patient stopping speaking; the AI responds — end-to-end (speech-end → AI response start) latency ≤ 2 000 ms on a typical broadband connection.
- PTT mode: committing audio on PTT release triggers the transcript and AI response without requiring continuous listening.
- No regression: V9 sessions with OpenAI STT and V7 sessions continue to function identically to before this change.
- No `ELEVENLABS_API_KEY` value appears in any server log, client network response, or browser console output.
- After a forcibly-closed Scribe WebSocket in a test, the reconnect logic restores the connection within 5 s; after 3 forced failures the text-mode fallback dialog appears.

---

## Open Questions

_All five questions raised in the initial draft have been resolved:_

| # | Question | Resolution |
|---|---|---|
| 1 | Pricing accuracy | Defaulted to `$0.00667/min`; overridable via `NEXT_PUBLIC_ELEVENLABS_SCRIBE_USD_PER_MINUTE`. |
| 2 | Token TTL / reconnect | Implement reconnect-with-fresh-token, up to 3 attempts with exponential backoff. Token TTL is single-use; treat every new socket open as requiring a new token. |
| 3 | PTT mode | Now in scope — US-011. Uses `commit_strategy=manual`. |
| 4 | Hallucination filtering | Scribe handles suppression server-side. No client-side `isLikelyHallucination()` call on the Scribe path. |
| 5 | PCM streaming architecture | Dedicated `getUserMedia` stream inside the hook. Cleaner isolation, no AudioWorklet coupling, lowest latency, best fidelity. |
