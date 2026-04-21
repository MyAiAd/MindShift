# V7 Speech Pipeline — Decision (Track A adopted, Track B removed)

**Status:** FINAL, 2026-04-21. The v7 speech pipeline is the request /
response (`/api/tts` + `/api/stt-v7`) path driven by a pinned
`gpt-4o-mini-tts-2025-03-20` snapshot with the `marin` voice and a
shared therapeutic `instructions` string. The Realtime (Track B)
alternative was evaluated, tuned, and removed.

## Decision

- **Speech I/O:** `gpt-4o-mini-tts-2025-03-20` (static + live), voice
  `marin`, single shared `instructions` string. See
  `docs/v7-tts-determinism-policy.md`.
- **Transcription:** `gpt-4o-mini-transcribe` via `/api/stt-v7`.
- **Realtime (speech-to-speech) pipeline:** **removed.** The code for
  Track B — `/api/treatment-v7/realtime-session/route.ts`,
  `components/treatment/v7/V7RealtimeSession.tsx`,
  `scripts/tune-realtime-vad.ts`, and the
  `V7_SPEECH_PIPELINE` feature flag plumbing in the v7 page — was
  deleted on 2026-04-21 in the same commit that pinned the marin
  voice.
- **If the current policy is ever revisited:** the next step is
  ElevenLabs Professional Voice Clone (re-introducing the original
  provider for quality reasons), not re-adding OpenAI Realtime.

## Why Track A

1. **Cost.** At 2026-04-19 pricing, Track B was 5×–26× more expensive
   per session than Track A on `gpt-realtime` and 2×–8× on
   `gpt-realtime-mini` (see Appendix A). Even if Track B had performed
   flawlessly, cost alone made it a non-default.
2. **Voice consistency is load-bearing.** V7 is a strictly-scripted
   clinician dialog where the patient-facing text is authored by a
   deterministic state machine, not by a model. Scripted prompts are
   pre-rendered once (US-014) and streamed live for clarifications.
   Both sides must sound like the same speaker. Track A's pinned
   snapshot + shared instructions guarantees this. Track B generates
   every clip per-session from a speech-to-speech model, so clip-to-clip
   timbre has drift that we cannot control.
3. **Compliance surface is simpler.** Track A runs
   `validateSpeechOutput` on every TTS call with a clean
   request/response signal. Track B runs the same guard but over an
   opaque audio-token event stream that is harder to reason about and
   log.
4. **Observability.** Track A's `stt_call` / `tts_call` structured
   telemetry (US-005) gives per-call cost / latency / quality.
   Realtime collapses these into audio-token streams.
5. **STT quality is equivalent.** Both tracks would have called
   `gpt-4o-mini-transcribe`. US-021's WER check (7.78 % overall on the
   synthetic corpus) applies to the Track A path that actually ships.
   Track B had no STT-quality advantage to justify its cost premium.

## What ran, and what is still manual

Scripted regression evidence gathered against the **synthetic corpus**
placeholder (US-020 real-human recapture is still pending per
`tests/fixtures/v7-speech-corpus/INDEX.md`):

| Check | Result | Source |
| ----- | ------ | ------ |
| US-014 static-audio regen (marin, gpt-4o-mini-tts-2025-03-20) | 18 clips, ~3.2 MB, manifest committed | `public/audio/v7/static/marin/` |
| US-021 automated WER (overall) | 7.78 % | `tasks/v7-speech-corpus-wer-summary.md` |
| US-021 WER — `short-phrase`    | 0.79 %  | ″ |
| US-021 WER — `long-utterance`  | 0.59 %  | ″ |
| US-021 WER — `background-tv`   | 13.33 % | ″ |
| US-021 WER — `hvac-noise`      | 0.00 %  | ″ |
| US-021 WER — `short-answer` (1-word) | 30.56 % (known weak spot) | ″ |
| `silent-control` false-positive rate | 0 / 2 (0 %) | ″ |

The 54-cell end-to-end matrix (hallucination count, voice-drift
events, unintended fallbacks, p50/p95 TTF audio, retry rate, fallback
rate, qualitative UX) still requires a manual QA pass against a
running v7 session, and a real human recapture of the US-020 corpus.
Those are tracked in `tasks/v7-peak-fidelity-regression-results.md`.

## Rollback plan

If Track A fails in production post-cutover:

- Text-mode fallback (US-015 / US-016) remains the universal last
  resort.
- V4 / V5 / V6 self-hosted paths are untouched (US-018) and can carry
  non-v7 traffic independently.
- If voice quality is the failure mode, escalate to ElevenLabs
  Professional Voice Clone — reintroducing the original provider for
  quality reasons is the next-step recovery, not re-adding Track B.

---

## Appendix A: Track A vs Track B per-session cost (historical)

Kept for the audit trail. Retrieved from the live OpenAI pricing pages
on 2026-04-19 before Track B was retired.

### Pricing snapshot

| Model                       | Input                | Output                | Source URL                                                       |
| --------------------------- | -------------------- | --------------------- | ---------------------------------------------------------------- |
| gpt-4o-mini-transcribe      | $0.003 / min audio   | n/a                   | https://platform.openai.com/docs/pricing                         |
| gpt-4o-mini-tts             | n/a                  | $0.015 / min audio    | https://platform.openai.com/docs/pricing                         |
| tts-1-hd                    | n/a                  | $30 / 1M chars        | https://platform.openai.com/docs/models/tts-1-hd                 |
| gpt-realtime (audio input)  | $32 / 1M tokens      | n/a                   | https://developers.openai.com/api/docs/models/gpt-realtime       |
| gpt-realtime (audio output) | n/a                  | $64 / 1M tokens       | https://developers.openai.com/api/docs/models/gpt-realtime       |
| gpt-realtime-mini (audio input)  | $10 / 1M tokens | n/a                   | https://developers.openai.com/api/docs/models/gpt-realtime-mini  |
| gpt-realtime-mini (audio output) | n/a             | $20 / 1M tokens       | https://developers.openai.com/api/docs/models/gpt-realtime-mini  |

Audio token rates per OpenAI's Realtime cost guide
(https://developers.openai.com/api/docs/guides/realtime-costs): user
audio = 10 tokens/sec, model audio = 20 tokens/sec.

### Session assumptions

- **Median:** 12 min wall-clock (4 min user speech, 4 min playback,
  4 min silence).
- **p95:** 24 min wall-clock (8 / 8 / 8).

### Comparison (median session)

| Scenario                  | Track A | Track B (gpt-realtime) | Ratio Track B / Track A | Track B (mini) | Ratio mini / Track A |
| ------------------------- | ------- | ---------------------- | ----------------------- | -------------- | -------------------- |
| hit=0 %                   | $0.072  | $0.384                 | **5.3×**                | $0.120         | **1.7×**             |
| hit=50 %                  | $0.042  | $0.384                 | **9.1×**                | $0.120         | **2.9×**             |
| hit=95 %                  | $0.015  | $0.384                 | **25.6×**               | $0.120         | **8.0×**             |
| p95, hit=95 %             | $0.030  | $0.768                 | **25.6×**               | $0.240         | **8.0×**             |

Track A scales down with static-cache hit rate. Track B does not
(scripted audio is re-synthesised by the Realtime model on every
session).

## Appendix B: Change log

- **2026-04-19:** Pricing snapshot refreshed against live OpenAI
  pricing pages. Corrected audio-token rates from the skeleton's
  50 tok/s assumption to the documented 10 tok/s (input) / 20 tok/s
  (output).
- **2026-04-21 (scripted regression):** US-014 marin regen committed;
  US-020 synthetic placeholder corpus committed; US-021 automated WER
  check run (overall 7.78 %); US-028 full `--engine=real` VAD tuner
  run (3000 Realtime sessions, winner
  `threshold=0.4 / prefix_padding_ms=200 / silence_duration_ms=1000`).
- **2026-04-21 (decision):** Recommendation upgraded from
  _conditional_ to **FINAL — Track A only**. Track B code (route +
  component + VAD tuner + feature flag + results docs) deleted in the
  same commit. If the pinned-marin policy is ever revisited, the next
  step is ElevenLabs Professional Voice Clone, not Realtime.
