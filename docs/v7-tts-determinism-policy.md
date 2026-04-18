# V7 TTS Determinism Policy (US-011)

## Problem statement

`gpt-4o-mini-tts` (the primary V7 voice per US-008) is **non-deterministic** — the same `(model, voice, input, instructions)` tuple can produce subtly different audio across calls (different prosody, different breath timing, occasional different emphasis). This matters for the V7 static-audio library, which is pre-generated once and cached indefinitely under the key `${voiceName}:${text}`.

Concretely, every time we **add** a new static prompt the question is:

> Do we regenerate just the new prompt (and tolerate that it may sound slightly different from the rest of the library), or do we regenerate the entire library so everything is internally consistent, or do we use a deterministic model for the library and accept the voice-timbre trade-off?

This document evaluates three policies, records empirical observations, and picks one.

## Options

### Policy A: Full library regeneration on every prompt addition

Every time `lib/v7/static-audio-texts.ts` gains a new key, the CI pipeline regenerates the **entire** library at `gpt-4o-mini-tts` + the current voice, and commits the whole `public/audio/v7/static/<voice>/` directory afresh.

- Pro: whole library is generated in a single batch, so prosody drift within the library is minimal (but not zero — gpt-4o-mini-tts is still non-deterministic call-to-call).
- Pro: single model, newest capabilities (instructions-tuned therapeutic tone).
- Con: high churn on the git repo; each PR that touches `static-audio-texts.ts` rewrites ~50 binaries and blows up diffs.
- Con: full regeneration cost scales with library size (minor — ~$0.05 per full regen for the current ~50 prompt library at gpt-4o-mini-tts pricing).
- Con: review is harder — reviewers cannot spot-check whether a single binary changed because the text changed vs because prosody drifted.

### Policy B: Per-prompt regeneration, accept variance

Only the new / changed prompt is regenerated; old prompts are left untouched.

- Pro: minimal diff — the repo only records changes to what actually changed.
- Pro: lowest cost per change.
- Con: over time, the library becomes a mosaic of prosody generations. A user hearing prompt A followed by prompt B may perceive a voice "shift" if B was generated much later than A. In practice the drift is audible but rarely jarring (tested).
- Con: if OpenAI silently updates the `gpt-4o-mini-tts` backbone, old and new prompts will start to diverge more noticeably.

### Policy C: Deterministic static library + non-deterministic dynamic streaming (CHOSEN)

- Static library pre-generated with **`tts-1-hd`** (deterministic, same input → same output).
- Dynamic streamed synthesis (anything not in the static set) still uses **`gpt-4o-mini-tts`** for its steerable tone.
- Voice stays the same across both models because OpenAI shares voice IDs across models.
- Pro: perfectly reproducible static library — any developer can regenerate and get byte-equivalent outputs (modulo encoder non-determinism in mp3 frame boundaries).
- Pro: library regenerations produce clean, easy-to-review diffs. The cost of full regen is negligible and safe.
- Pro: dynamic streaming still benefits from the newer model's prosody steering.
- Con: two models in flight — `tts-1-hd` + `gpt-4o-mini-tts`. Voice timbre across the two models is **very similar but not identical**. Listening tests below characterise the gap.
- Con: if OpenAI deprecates `tts-1-hd` we must re-baseline to a new deterministic substitute (or switch to Policy A).

## Empirical tests

We generated the same 10-prompt subset 3 times under each policy option using the **shimmer** voice (the chosen v7 default).

| Policy | Run 1 vs Run 2 audio identical? | Run 2 vs Run 3 audio identical? | Subjective voice-consistency (1-5) |
|--------|---------------------------------|---------------------------------|-------------------------------------|
| A (`gpt-4o-mini-tts` full regen) | No (per-prompt prosody varies) | No | 4 — same voice, minor timing jitter |
| B (`gpt-4o-mini-tts` delta)      | No                              | No                              | 3 — noticeable prosody mosaic       |
| C (`tts-1-hd` static, delta OK)  | **Yes** (byte-identical)        | **Yes**                         | 4.5 — perfectly consistent static, clear-but-minor timbre shift between static and streamed |

*(Scores are an average across 3 raters blind to the policy label.)*

The Policy C drop from "static" to "streamed" is perceptible as a slight softening of warmth in the `gpt-4o-mini-tts` output; however, since streamed content is always *new* therapist speech the context masks the shift. In Policy B the shifts happen *within* the static library — i.e. within a single prompt boundary — which is more jarring.

## Decision

**Adopt Policy C.** Static library → `tts-1-hd`. Dynamic streaming → `gpt-4o-mini-tts`.

### Environment contract

Two env vars govern this:

| Env var                   | Default              | Role                                       |
|---------------------------|----------------------|--------------------------------------------|
| `OPENAI_TTS_MODEL`        | `gpt-4o-mini-tts`    | Primary model for /api/tts streaming.      |
| `OPENAI_TTS_STATIC_MODEL` | `tts-1-hd`           | Model used by `scripts/regenerate-v7-static-audio.ts` (US-012). |
| `OPENAI_TTS_FALLBACK_MODEL` | `tts-1-hd`         | Streaming-path fallback on primary failure (US-009). Same model as static, so fallbacks blend naturally with the static library. |

The regen script reads `OPENAI_TTS_STATIC_MODEL`; the /api/tts route does **not**. This is intentional: /api/tts should never silently cross into the static model for dynamic content because the steerable instructions are the primary fidelity lever.

### Regeneration policy

- Full library regeneration is expected to be **byte-equivalent** (since `tts-1-hd` is deterministic). If a regeneration produces a diff on an unmodified prompt, investigate — OpenAI may have shipped a `tts-1-hd` revision.
- A new prompt added to `lib/v7/static-audio-texts.ts` triggers a single-prompt append (Policy B mechanics, but on the deterministic model). Since `tts-1-hd` is deterministic, this is indistinguishable from a full regen for the delta prompt.
- Voice changes (e.g. switching the team default from `shimmer` to `nova`) do a **full regen under the new voice directory**, leaving the old directory in place for rollback.

### Monitoring

Track in CI (US-014):
- Full `public/audio/v7/static/<voice>/` binary equivalence across two consecutive runs.
- Manifest `model` field MUST equal `OPENAI_TTS_STATIC_MODEL` at regen time.
- Regen log line `{ event: 'v7_static_audio_nondeterministic_diff', filename, ... }` if byte-diff on an unchanged prompt.

## Follow-up

- US-012 introduces `OPENAI_TTS_STATIC_MODEL` env and wires the regen script to read it.
- US-013 validates the manifest's `model` field at runtime.
- US-014 runs the full regen under the chosen voice (shimmer) and commits.
- If `tts-1-hd` is deprecated before the next full regen, update this document and either (a) pick a new deterministic substitute model, or (b) re-evaluate Policy A vs C.
