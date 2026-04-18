# V7 Speech Pipeline — Cost Projection & Track A vs Track B Decision

**Status:** SKELETON COMMITTED. Pricing numbers below are the last-known
public OpenAI rates (Apr 2026 agent-training snapshot) and **MUST** be
re-verified against live pricing pages before this document is used to
make the go/no-go decision in US-031.

## Sources (must be refreshed)

Re-run the snapshot step every time you update this doc:

1. Navigate to https://platform.openai.com/docs/pricing and copy the
   rates for:
   - `gpt-4o-mini-transcribe` (STT)
   - `gpt-4o-mini-tts` (primary TTS)
   - `tts-1-hd` (fallback + static-audio model)
   - `gpt-realtime` (Track B speech-to-speech model; input + output
     audio token rates)
2. Record today's date + the exact URL below the table.

### Pricing snapshot (TO BE REPLACED BEFORE DECISION)

| Model                       | Input            | Output           | Source        | Snapshot date |
| --------------------------- | ---------------- | ---------------- | ------------- | ------------- |
| gpt-4o-mini-transcribe      | ~$0.003 / min*   | n/a              | docs/pricing  | _verify_      |
| gpt-4o-mini-tts             | n/a              | ~$0.015 / min*   | docs/pricing  | _verify_      |
| tts-1-hd                    | n/a              | ~$0.030 / 1K chars* | docs/pricing | _verify_    |
| gpt-realtime (audio input)  | ~$32 / 1M tokens*| n/a              | docs/pricing  | _verify_      |
| gpt-realtime (audio output) | n/a              | ~$64 / 1M tokens*| docs/pricing  | _verify_      |

\* Training-snapshot estimates; DO NOT TREAT AS AUTHORITATIVE. The whole
point of this doc is that the operator refreshes the table before the
decision in US-031.

## Session duration assumptions

From the v7 operational data (sourced from treatment-v7 session logs):

- **Median v7 session length:** 12 minutes of wall-clock, of which
  approximately 4 minutes is user speech, 4 minutes is scripted audio
  playback, and 4 minutes is silent "listen" time between turns.
- **p95 v7 session length:** 24 minutes of wall-clock, 8 min user,
  8 min playback, 8 min silence.

Both rounded for modelling convenience; refine from live telemetry.

## Cache-hit scenarios

v7's static-audio library (US-012, US-014) pre-generates every scripted
prompt. The cache hit rate for TTS is the fraction of scripted prompts
served from disk rather than synthesised live.

- **0 % hit:** no static library deployed.
- **50 % hit:** partial library, typical mid-rollout state.
- **95 % hit:** seeded library post-US-014 operator commit.

Cache hits do NOT affect STT costs (the user still speaks every turn).

## Track A (request / response) per-session cost

Track A cost = STT cost + TTS cost, where TTS cost = (1 − hit) × live
TTS synthesis cost. Static cache hits cost $0 at runtime (already paid
once via the US-012 regen script).

| Metric                             | Median session       | p95 session          |
| ---------------------------------- | -------------------- | -------------------- |
| STT (4 / 8 min)                    | 4 × $0.003 = $0.012  | 8 × $0.003 = $0.024  |
| TTS live-synth (hit=0%)            | 4 × $0.015 = $0.060  | 8 × $0.015 = $0.120  |
| TTS live-synth (hit=50%)           | 2 × $0.015 = $0.030  | 4 × $0.015 = $0.060  |
| TTS live-synth (hit=95%)           | 0.2 × $0.015 = $0.003| 0.4 × $0.015 = $0.006|
| **Total per session (hit=0%)**     | **$0.072**           | **$0.144**           |
| **Total per session (hit=50%)**    | **$0.042**           | **$0.084**           |
| **Total per session (hit=95%)**    | **$0.015**           | **$0.030**           |

## Track B (Realtime) per-session cost

Track B pays for audio input and audio output through the whole
session. The Realtime API bills by audio tokens (roughly 1 s ≈ 50
tokens at 24 kHz — verify against the docs before trusting this ratio).

At ~50 audio tokens/sec:
- Median user speech: 4 min = 12,000 tokens input
- Median model speech (includes scripted playback): 4 min = 12,000 tokens output
- p95 user: 8 min = 24,000 tokens input
- p95 model: 8 min = 24,000 tokens output

Static cache hits do **not** reduce Track B cost because even scripted
audio is produced by the Realtime model per US-025.

| Metric                     | Median session | p95 session |
| -------------------------- | -------------- | ----------- |
| Input audio cost           | 12,000 × $32/1M = **$0.384** | 24,000 × $32/1M = **$0.768** |
| Output audio cost          | 12,000 × $64/1M = **$0.768** | 24,000 × $64/1M = **$1.536** |
| **Total per session**      | **$1.152**     | **$2.304**  |

Track B cost is **independent of cache hit rate** by design.

## Comparison (using the placeholder numbers above)

| Scenario                  | Track A    | Track B   | Ratio Track B / Track A |
| ------------------------- | ---------- | --------- | ----------------------- |
| Median, hit=0%            | $0.072     | $1.152    | **16.0×**               |
| Median, hit=50%           | $0.042     | $1.152    | **27.4×**               |
| Median, hit=95%           | $0.015     | $1.152    | **76.8×**               |
| p95, hit=95%              | $0.030     | $2.304    | **76.8×**               |

**Qualitative flag:** at any cache-hit rate above 0 %, Track B costs
materially more per session (well above 2×). Under the snapshotted
numbers Track B is approximately **16× to 77× the cost** of Track A
before any Realtime-specific UX or quality benefits are considered.

## Regression-metric ingestion

This section is populated after US-021 (Track A) and US-029 (Track B)
regression runs are executed.

| Column                          | Track A (US-021) | Track B (US-029) |
| ------------------------------- | ---------------- | ---------------- |
| hallucinations_reaching_engine  | _pending_        | _pending_        |
| voice_drift_events              | _pending_        | _pending_        |
| unintended_fallback_prompts     | _pending_        | _pending_        |
| p50 time-to-first-audio (ms)    | _pending_        | _pending_        |
| p95 time-to-first-audio (ms)    | _pending_        | _pending_        |
| retry / reconnect rate          | _pending_        | _pending_        |
| fallback (text-mode) rate       | _pending_        | _pending_        |
| qualitative UX notes            | _pending_        | _pending_        |

## Recommendation (US-031)

**Recommendation: DEFAULT TO TRACK A (request / response).**

Justification (conditional on US-021 + US-029 results meeting targets):

1. **Cost.** At Track B's documented rates, per-session cost is roughly
   16× to 77× Track A's depending on cache-hit rate. Even if Track B
   performs flawlessly, cost makes it a non-default.
2. **Deterministic static audio.** Track A serves pre-rendered
   `tts-1-hd` audio (US-011 Policy C) for the bulk of scripted prompts.
   Voice consistency over time is guaranteed by re-running the US-012
   regen script with the same voice. Track B cannot guarantee the same
   word-for-word voice consistency because Realtime responses are
   generated per-session.
3. **Compliance guard.** Track A runs `validateSpeechOutput` on every
   TTS call before synthesis. Track B runs the same guard, but the
   Realtime session's instructions forbid the model from generating
   patient-facing text — if that instruction is ever violated the guard
   is the only defence, and the Realtime event shape is harder to
   reason about than the request/response pair.
4. **Observability.** Track A's `stt_call` / `tts_call` structured
   telemetry (US-005) gives a clean per-call cost / latency / quality
   breakdown. Track B collapses those into opaque audio-token streams.

## Rollback plan (matches §10 of the PRD)

If Track A fails in production post-cutover:

- Flip `NEXT_PUBLIC_V7_SPEECH_PIPELINE` to `realtime` (US-027) and rely
  on Track B's Realtime fallback.
- If the OpenAI outage is total, the text-mode fallback (US-015 / US-016)
  remains as the universal last resort.
- V4 / V5 / V6 self-hosted paths remain untouched (US-018) and can be
  activated for non-v7 traffic independently.

If Track B is selected instead, it remains available under
`V7_SPEECH_PIPELINE=request_response` via env override for at least
**30 days post-cutover** so the fall-back path is already warmed up.

## Change log

- **<YYYY-MM-DD>:** Skeleton committed with training-snapshot pricing
  placeholders. Operator to refresh pricing + fill regression-metric
  rows before using this for the final decision.
