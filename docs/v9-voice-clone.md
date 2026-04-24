# v9: V2 voice clone

V9 is a voice adapter around v2's state machine. V2 is the canonical
source of doctor text; v9 reuses v2's `TreatmentStateMachine` module
unchanged, wraps it in a turn-based voice adapter, and enforces a
byte-for-byte v2-v9 parity gate in CI so that v9's spoken text is
guaranteed to match the doctor script.

See [`/.cursor/plans/v9_voice_clone_plan_b3f48b14.plan.md`](/.cursor/plans/v9_voice_clone_plan_b3f48b14.plan.md)
for the rationale.

## Parity gates

| Gate | Scope | Runs | Failure mode |
| --- | --- | --- | --- |
| `npm run ci:v9-gate` | Direct state-machine (no server) | CI, every push | Block merge |
| `npm run test:v9` | Playwright direct state-machine | CI with auth | Block merge |
| `npm run test:v2-v9-route-parity` | End-to-end `/api/treatment-v2` vs `/api/treatment-v9` | CI / preview | Block release |

There is **no `KNOWN_ACCEPTABLE_DIFFERENCES` allowlist for v9**. Any
byte-level drift is treated as a bug — either in v9's route (fix v9) or
in v2's state machine (fix v2, which propagates to v9 automatically).

## Voice pipeline selection (admin UI + env)

V9 now ships with a super-admin-only UI for switching STT and TTS
providers at runtime, no redeploy. The UI lives at
`/dashboard/admin/settings` → the **Voice** tab (visible to
`super_admin` only).

### Providers

Speech-to-text (STT):

| Value | Cost center | Required env |
| --- | --- | --- |
| `openai` (default) | OpenAI API usage (~$0.003/min) | `OPENAI_API_KEY` |
| `whisper-local` | Self-hosted compute (hourly, not per-call) | `WHISPER_SERVICE_URL`, optional `WHISPER_API_KEY` |

Text-to-speech (TTS):

| Value | Cost center | Required env |
| --- | --- | --- |
| `openai` (default) | OpenAI API usage | `OPENAI_API_KEY` |
| `elevenlabs` | ElevenLabs monthly credit plan | `ELEVENLABS_API_KEY`, optional `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` (default `eleven_flash_v2_5`) |
| `kokoro` | Self-hosted compute | `KOKORO_SERVICE_URL`, optional `KOKORO_API_KEY`, `KOKORO_VOICE_ID` |

STT and TTS are selected **independently** — any valid STT can be paired
with any valid TTS (e.g. self-hosted Whisper for input + ElevenLabs for
output, if you want cheap input and premium output).

### Resolution precedence

For **TTS** (per-call, via `resolveTtsProviderId`):

1. `tts.provider` field / `?provider=` on the API request (used by the
   parity gate to force a known provider).
2. The pair pinned to the session at start
   (`context.metadata.voicePair.tts`).
3. `V9_TTS_PROVIDER` env var, then legacy `TTS_PROVIDER`.
4. Hard-coded `openai`.

For **STT** (per-call, via `resolveSttProviderId`):

1. Per-session pin (`context.metadata.voicePair.stt`), passed to
   `transcribeToUserInput` by the `/turn` endpoint.
2. `V9_STT_PROVIDER` env var.
3. Hard-coded `openai`.

The authoritative runtime source for the pin is the singleton row in
`system_voice_settings` (see
[migration 062](../supabase/migrations/062_voice_pipeline_settings.sql)).
The admin UI writes that row; the state machine's session start reads
it and pins the resolved pair into `context.metadata.voicePair`.

### Why pin at session start?

Flipping the admin radios while a patient is mid-conversation would
change the voice they hear on the very next turn — jarring at best,
a consent issue at worst. Instead, each session's pair is frozen at
start (`lib/v9/core.ts#v9HandleStartSession`), so the admin setting
only takes effect for **sessions that start after the flip**. In-flight
sessions finish on the pair they began with.

If the selected provider is not available in the current environment,
the request fails loud — v9 **never** silently switches voices.

### API surface

- `GET /api/admin/voice-settings` — current pair + per-provider
  availability (for UI greying). `tenant_admin | super_admin`.
- `PUT /api/admin/voice-settings` — persist a new pair. `super_admin`
  only, enforced both at the route and by RLS on
  `system_voice_settings`.
- `POST /api/admin/voice-settings/test` — dry-run TTS synth (JSON body)
  or STT round-trip (multipart with audio). Returns cost/latency so
  the admin UI can show a sanity check before saving.

## Cost telemetry

Every TTS call via `lib/v9/voice-adapter.ts#speakScripted` emits a
structured log line (`event: v9_tts_synth`) and records a per-session
sample in the in-memory aggregator at
[`lib/v9/tts-cost-metrics.ts`](../lib/v9/tts-cost-metrics.ts).

Query the running totals for a live session:

```
GET /api/treatment-v9/cost?sessionId=<id>&userId=<id>
```

The response breaks down totals by provider so you can ask "what would
this same session have cost on elevenlabs vs openai vs kokoro" after an
A/B test.

## Do not port from v7

- **`V7_STATIC_AUDIO_TEXTS.INITIAL_WELCOME`** — this is the shortened
  intro the v7 frontend splashes before the backend reply arrives. It is
  the direct cause of the UI/backend step mismatch bug. v9 renders
  exactly what v2 returns, no substitutions.
- **Linguistic processing / AI paraphrase on scripted text** — v2's own
  `needsLinguisticProcessing` flags are respected only to the extent
  that `STRICT_SPEECH_MODE=true` permits; by default, v9 bypasses every
  paraphrase path.

## Doctor-script workflow

All future doctor-script edits live in a single file:

```
lib/v2/treatment-state-machine.ts
```

Editing any other file to "fix" phrasing breaks the v2-v9 parity
invariant. The CI parity gate will block the merge.

## Known v2 bugs (pending doctor signoff)

V9 inherits v2's quirks on purpose. See
[`v2-bug-inventory.md`](./v2-bug-inventory.md) for the list requiring
doctor review before any v2 edit (triple-nesting return stack,
`clear_anything_else_problem_*` inconsistency, and any further drift
surfaced by the parity gate).

## V9 UX restoration (client shell)

See [`prd-v9-ux-restoration.md`](./prd-v9-ux-restoration.md) for the
full requirements document. The short version:

- **Client shell is a direct port of v7's `TreatmentSession.tsx`.**
  Same orb, same interaction-mode switcher (orb_ptt / listen_only /
  text_first), same admin debug drawer. The only hard line is R7:
  v9 renders **exactly** the string the backend returned for the
  first assistant message. No `INITIAL_WELCOME` substitution, no
  trimming, no prefix injection. The v2-v9 parity gate guards the
  byte-for-byte contract.
- **Preferences live under `v9_*` localStorage keys.** See
  `lib/v9/v9-preferences.ts`. Keys are never shared with v7 — moving
  from v7 to v9 always gives the user fresh, mode-appropriate
  defaults (R5/R6).
- **Static audio resolution is hash-based.** Canonical text →
  md5 → manifest lookup. The resolver checks v9's manifest first,
  falls back to v7's manifest (Phase 1 reuses v7 assets), and emits
  telemetry that surfaces in the admin drawer. See
  `lib/v9/static-audio-resolver.ts`. The shared hash function lives
  in `scripts/hash-audio-text.js` and must stay byte-identical with
  v7's `scripts/generate-static-audio.js`.
- **Admin debug drawer (`components/treatment/v9/AdminDebugDrawer.tsx`)
  surfaces two v9-only panels:** the pinned `voicePair`
  (`{ stt, tts }` from `action: 'start'`'s response — R9) and the
  resolver's hit/miss counters (R13.4). Both are gated behind the
  admin role check in the parent component.
- **CI:** three gates run per PR:
  1. `npm run ci:v9-gate` — v2/v9 byte-parity check (unchanged).
  2. `npm run ci:v9-theme-gate` — blocks raw Tailwind color
     classes in `components/treatment/v9/**` and `lib/v9/**`.
  3. `npm run ci:v9-unit` — node:test suite covering the
     resolver, preferences module, session-parity guards, and
     theme-gate regex.
  4. `npm run test:v9-visual` — Playwright screenshot matrix
     covering every interaction mode × viewport × theme combo.

### Adding a new voice to v9

1. Create `/public/audio/v9/static/<voice>/manifest.json` using the
   v9 generator script (R13.5 — follow-up PR) OR
2. Point `v9_voice_id` at a voice that already has a v7 manifest and
   rely on the resolver's v7 fallback. Phase 1 takes option 2.

Either way, the runtime `useNaturalVoice` hook caches static clips
into `globalAudioCache` under the same `${voiceName}:${text}` key
format v7 uses — so once the resolver returns a hit the playback
path is identical to v7's.
