# V7 Peak-Fidelity Track A Regression — Plan and Results

**Status:** PLAN COMMITTED, EXECUTION PENDING OPERATOR.

Actual regression execution requires (a) a running v7 session with live
`OPENAI_API_KEY`, (b) the US-020 recorded corpus, (c) a QA engineer
available for end-to-end flow traversal. This document is the
authoritative plan so that when those prerequisites are met the same
report can be filled in verbatim.

## Scope

All **v7 Track A** (request/response) flows exercised against the
`OPENAI_STT_MODEL=gpt-4o-mini-transcribe` + `OPENAI_TTS_MODEL=gpt-4o-mini-tts`
+ `OPENAI_TTS_FALLBACK_MODEL=tts-1-hd` peak-fidelity configuration.

Track B (Realtime) regression is captured separately in
`tasks/v7-peak-fidelity-realtime-regression-results.md` (US-029).

### Flows

| Flow                      | Entry point                                          |
| ------------------------- | ---------------------------------------------------- |
| Introduction              | Session bootstrap through to "work-type" prompt      |
| Work-type selection       | User picks problem / goal / trauma / negative experience |
| Problem path              | Full Problem-Shifting cycle                          |
| Goal path                 | Full Goal-Shifting cycle including AI goal synthesis |
| Trauma path               | Full Trauma-Shifting cycle                           |
| Integration path          | Post-cycle Integration questions                     |

### Conditions

| Tag              | Description                                               |
| ---------------- | --------------------------------------------------------- |
| `quiet-room`     | Studio-quiet room, USB condenser mic, speaker near mic     |
| `background-tv`  | TV speech at ~-20 dBFS vs speaker, 2 m from mic            |
| `hvac-noise`     | HVAC / fan running, broadband noise at ~-30 dBFS           |

### Interaction modes

| Mode            | Description                                          |
| --------------- | ---------------------------------------------------- |
| `orb-ptt`       | Push-to-talk via mic orb, default v7 interaction     |
| `listen-only`   | User only listens; scripted responses auto-advance   |
| `text-only`     | Text-mode fallback active from the start (US-015)    |

### Coverage matrix

Every (flow, condition, mode) cell is a row in `results-matrix.csv`
during execution. Minimum coverage target: 6 flows × 3 conditions × 3
modes = 54 cells, each run at least once end-to-end.

## Method

1. **Seed the corpus.** Run `npm run test:v7-speech-corpus` to confirm
   the corpus passes schema validation. Use the US-020 recordings as
   the input side of the STT WER (word-error rate) check.

2. **WER check (automated).** Replay each corpus `.wav` into
   `/api/transcribe` with `treatmentVersion: 'v7'`. Compare the
   returned transcript to the ground truth in the companion `.json`
   after case-folding and punctuation stripping. Aggregate WER per
   condition tag.

3. **End-to-end flow check (manual + telemetry).** For each (flow,
   condition, mode) cell, a QA engineer runs a full v7 session, then
   mines the `stt_call` / `tts_call` / `stt_hallucination_filtered`
   JSON logs (US-005) to populate the results table.

4. **Voice drift check.** For each session, confirm that `tts_call`
   telemetry has the same `voice` and `model` for every call
   (or `model=tts-1-hd` with `fallback_used=true`, which is still
   the same vendor/voice). Any `v7_static_audio_voice_mismatch` log
   is an automatic fail.

5. **Vendor-leak check.** Tail the browser console during each session.
   Any user-visible string containing "Whisper", "Kokoro", "OpenAI",
   "ElevenLabs", "backup", "fallback", or "provider" is an automatic
   fail (US-017 should have eliminated these).

## Metrics

| Metric                               | Target              |
| ------------------------------------ | ------------------- |
| `hallucinations_reaching_engine`     | **0** per session   |
| `voice_drift_events`                 | **0** per session   |
| `unintended_fallback_prompts`        | **0** per session   |
| `session_completion_rate`            | **100%**            |
| `p50_time_to_first_audio_ms`         | ≤ 900 ms            |
| `p95_time_to_first_audio_ms`         | ≤ 2500 ms           |
| `p50_stt_latency_ms`                 | ≤ 1200 ms           |
| `p95_stt_latency_ms`                 | ≤ 3000 ms           |
| `stt_retry_rate`                     | ≤ 3 %               |
| `tts_fallback_rate`                  | ≤ 2 %               |
| `stt_hallucination_filter_rate`      | ≤ 5 % of calls      |
| `stt_client_safety_net_hit_rate`     | ≤ 1 % of calls      |

(The last row is the US-019 safety-net log; if this rate rises above
1 %, the server-side gates (US-002) likely need tuning.)

## Results template

When execution runs, copy the block below for each (flow, condition,
mode) cell and fill in the values from telemetry.

```
### Flow: <flow> | Condition: <condition> | Mode: <mode>

- Date: <YYYY-MM-DD>
- Operator: <initials>
- Session ID: <uuid>
- hallucinations_reaching_engine: <int>
- voice_drift_events: <int>
- unintended_fallback_prompts: <int>
- session_completed: <bool>
- time_to_first_audio_ms: <int>
- p50_stt_latency_ms / p95_stt_latency_ms: <int> / <int>
- stt_retry_rate: <float>
- tts_fallback_rate: <float>
- stt_hallucination_filter_rate: <float>
- Notes:
```

## Overall verdict template

```
- Overall verdict: PASS | FAIL
- Failing criteria (if any):
  - <criterion> — <root cause> — follow-up story id <US-xxx>
```

If any metric fails the targets above, a follow-up story is filed
(naming convention: `US-<next-available>-v7-<short-slug>`) and this
story is rerun after the fix.

## Change log

- **<YYYY-MM-DD>:** Plan committed. Execution pending.
