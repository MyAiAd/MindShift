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

## TTS provider selection (`V9_TTS_PROVIDER`)

V9 supports three pluggable TTS backends. Pick one per deploy with the
`V9_TTS_PROVIDER` environment variable:

| Value | Cost center | Required env |
| --- | --- | --- |
| `openai` (default) | OpenAI API usage | `OPENAI_API_KEY` |
| `elevenlabs` | ElevenLabs monthly credit plan | `ELEVENLABS_API_KEY`, optional `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` (default `eleven_flash_v2_5`) |
| `kokoro` | Self-hosted compute | `KOKORO_SERVICE_URL`, optional `KOKORO_API_KEY`, `KOKORO_VOICE_ID` |

Precedence order (highest wins):

1. `?provider=` query / `tts.provider` field on the API request.
2. `V9_TTS_PROVIDER` environment variable.
3. Legacy `TTS_PROVIDER` (kept for compatibility with v7).
4. Hard-coded `openai` default.

If the selected provider is not available in the current environment,
the request fails loud — v9 **never** silently switches voices mid
session.

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
