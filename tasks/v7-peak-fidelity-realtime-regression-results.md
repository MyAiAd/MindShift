# V7 Peak-Fidelity Track B Regression — Plan and Results

**Status:** PLAN COMMITTED, EXECUTION PENDING OPERATOR.

This is the Track B (Realtime API) counterpart to `v7-peak-fidelity-regression-results.md`
(US-021, Track A). Running it requires:

1. `V7_SPEECH_PIPELINE=realtime` (or the admin override from US-027) active for
   the duration of the run.
2. The `turn_detection` block in `app/api/treatment-v7/realtime-session/route.ts`
   updated with the tuned values from `tasks/v7-realtime-vad-tuning-summary.md`
   (US-028, `--engine=real`).
3. A running v7 session with a live `OPENAI_API_KEY` and the US-020 corpus
   populated.

## Coverage matrix

Identical to US-021:

- **Flows:** introduction, work-type selection, problem, goal, trauma, integration
- **Conditions:** quiet-room, background-tv, hvac-noise
- **Modes:** orb-ptt, listen-only, text-only (text-mode fallback end-to-end)

54 cells. Each cell run at least once end-to-end.

## Method

1. **Flag flip.** Set `NEXT_PUBLIC_V7_SPEECH_PIPELINE=realtime` in the test
   environment, or use the admin header select to force-override per session.
2. **VAD lock.** Before the run, confirm `app/api/treatment-v7/realtime-session/route.ts`
   has the winning VAD values (US-028). If it still carries the PRD-spec defaults
   (0.5 / 300 / 500), the regression results must be flagged as "defaults-only"
   in the header of this document.
3. **Telemetry.** Mine the same structured JSON log events as US-021 plus the
   Track B-specific ones (see below).
4. **Per-cell matrix entry.** Use the same per-cell template as US-021.

## Metrics and targets

| Metric                                     | Target              | Source event                                     |
| ------------------------------------------ | ------------------- | ------------------------------------------------ |
| `hallucinations_reaching_engine`           | **0** per session   | `v7_realtime_non_english_transcript_filtered` + engine-side post-facto review |
| `voice_drift_events`                       | **0** per session   | `v7_realtime_session_mint_success` (voice must be stable per session) |
| `unintended_fallback_prompts`              | **0** per session   | UI spot-check + `textModeFallbackState` timeline |
| `session_completion_rate`                  | **100%**            | Engine final-step count                          |
| `p50_time_to_first_audio_ms`               | ≤ 700 ms            | Measured from `response.create` send → remote audio track first chunk |
| `p95_time_to_first_audio_ms`               | ≤ 1800 ms           | Same                                             |
| `ice_reconnect_rate`                       | ≤ 5 % of sessions   | `v7_realtime_reconnect_attempt`                  |
| `textmode_fallback_rate`                   | ≤ 2 % of sessions   | Transitions to `textModeFallbackState === 'prompt'` / `'active'` |
| `speech_compliance_violations`             | **0**               | `v7_realtime_speech_compliance_violation`        |
| `non_english_transcripts_filtered`         | ≤ 1 % of calls      | `v7_realtime_non_english_transcript_filtered`    |

Track B is strictly stricter than Track A on latency — Realtime's principal
value proposition is sub-second response — but strictly looser on
`stt_hallucination_filter_rate` because the server-side metadata gates do not
apply.

## Per-cell results template

Same as US-021; copy that template verbatim.

## Track A vs Track B summary row

At the end of the run, write a single row into US-031's comparison table with:

| Column                     | Track A (US-021)                      | Track B (this doc)                   |
| -------------------------- | ------------------------------------- | ------------------------------------ |
| Median time-to-first-audio | (from US-021 results)                 | (from this doc)                      |
| Hallucinations reaching engine | (US-021)                          | (this doc)                           |
| Fallback rate              | (US-021)                              | (this doc)                           |
| Qualitative UX notes       | (US-021)                              | (this doc)                           |

## Overall verdict template

Same as US-021. If any metric fails, a follow-up story is filed
(`US-<next>-realtime-<slug>`) and the run is repeated after the fix.

## Change log

- **<YYYY-MM-DD>:** Plan committed. Execution pending.
