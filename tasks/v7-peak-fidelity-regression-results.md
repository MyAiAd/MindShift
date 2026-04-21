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
- **2026-04-19:** Status review — execution still pending operator. The
  three preconditions cited at the top of this doc are in the following
  state:
  - (a) Live `OPENAI_API_KEY` with paid TTS/STT credits — **operator-gated**,
    no action available to the autonomous agent.
  - (b) US-020 recorded corpus — **still empty** under
    `tests/fixtures/v7-speech-corpus/` (only `INDEX.md` + `schema.json`
    committed; capturing human speech with documented informed consent is
    the project-documented out-of-scope item for the agent).
  - (c) QA engineer to traverse the 54-cell matrix — operator-gated.
  No synthetic / fabricated rows are written to the results template
  below; filling the table with placeholder numbers would silently
  invalidate the US-031 decision that reads from it.

- **2026-04-21:** Operator authorised autonomous execution of the
  scriptable portions. Status update:
  - (a) Funded `OPENAI_API_KEY` now in scope.
  - (b) US-020 corpus is populated with a **synthetic placeholder**
    (50 clips, every companion `.json` flags it in `speaker_notes`).
    Real human-speech recapture per INDEX.md is still required before
    these WER numbers are treated as production-quality evidence.
  - (c) 54-cell end-to-end matrix still pending — manual QA traversal
    remains operator-gated.

### Automated WER — step 2 of the Method (scripted)

Ran `scripts/wer-check.ts` on 2026-04-21 against the synthetic corpus.
Script calls OpenAI STT directly (`OPENAI_STT_MODEL`, default
`gpt-4o-mini-transcribe`, language=`en`) and compares the returned
transcript to each clip's ground-truth `.json` after word-level
normalisation. Full per-clip results in
`tasks/v7-speech-corpus-wer-results.csv`; aggregate in
`tasks/v7-speech-corpus-wer-summary.md`.

| Condition tag         | Clips | Avg WER | Max WER |
| --------------------- | ----- | ------- | ------- |
| `short-answer`        | 12    | 30.56 % | 100.00 % |
| `short-phrase`        | 21    |  0.79 % |  16.67 % |
| `long-utterance`      | 10    |  0.59 % |   5.88 % |
| `mid-utterance-pause` | 10    |  0.59 % |   5.88 % |
| `whispered`           |  5    |  0.00 % |   0.00 % |
| `quiet-room`          | 40    |  8.06 % | 100.00 % |
| `background-tv`       |  5    | 13.33 % |  66.67 % |
| `hvac-noise`          |  3    |  0.00 % |   0.00 % |
| `silent-control`      |  2    |  0.00 % |   0.00 % |

- **Overall mean WER:** 7.78 %
- `silent-control`: 0 % means STT returned an empty transcript for
  both clips (the desired behaviour — no false-positive invented
  speech). A value of 100 % on a silent-control row would mean STT
  hallucinated words from silence.
- The `short-answer` bucket is the dominant contributor to overall
  WER: single-word utterances that hit the 100 % WER ceiling when
  STT returns either nothing or the wrong single word. This is a
  known weakness of general-purpose STT models on isolated tokens
  and the reason US-002's server-side gates exist. Re-measure after
  real-human-speech recapture; the synthetic TTS is biased toward
  over-articulation which may or may not reflect real patient audio.

### End-to-end flow metrics (steps 3 / 4 / 5 of the Method)

Still **PENDING MANUAL QA** — 54-cell matrix traversal with live v7
session + vendor-leak tailing + voice-drift check. No automation
substitute for this portion.
