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

**Adopt Policy C (original, 2025-Q4):** Static library → `tts-1-hd`. Dynamic streaming → `gpt-4o-mini-tts`.

### 2026-04-21 revision — Policy A with a pinned snapshot (ACTIVE)

Policy C was superseded after a listening audit revealed that the
"clear-but-minor timbre shift between static and streamed" called out
above is, in practice, audible enough to notice — especially on
back-to-back scripted-then-dynamic turns (e.g. "…so the problem is"
[static] → "…so when you think about &lt;user's problem&gt;" [dynamic]). The
two-source mismatch is exactly the degradation the pre-render pipeline
exists to prevent. Moving from `tts-1-hd`/`shimmer` to OpenAI's current
top-tier voice `marin` on `gpt-4o-mini-tts` forces the issue because
`marin` / `cedar` are **not supported** by `tts-1` / `tts-1-hd` — a
mixed-model Policy-C setup would have to downgrade one of the two paths
to an older voice.

**New policy — Policy A with a pinned model snapshot:**

- Both paths run on the **same** `gpt-4o-mini-tts` snapshot
  (`OPENAI_TTS_MODEL` = `OPENAI_TTS_STATIC_MODEL` =
  `gpt-4o-mini-tts-2025-03-20`).
- Both paths send the **same** `OPENAI_TTS_INSTRUCTIONS` therapeutic-tone
  prompt on every call.
- Both paths use the **same** voice (default `marin`).
- The streaming fallback (`OPENAI_TTS_FALLBACK_MODEL`) stays inside the
  `gpt-4o-mini-tts` family — falling back to `tts-1-hd` would swap the
  voice timbre mid-session, which is worse than failing and triggering
  the US-013 user-facing "having trouble with audio" prompt.

Trade-offs accepted:

- The static library is no longer guaranteed to be byte-identical across
  regenerations (gpt-4o-mini-tts is not deterministic). This was the
  original reason for Policy C. We now accept that trade-off because:
  (a) the checksums are re-written on every regen and the manifest
  records the source inputs, so diff review remains possible; and
  (b) the alternative (audible voice-timbre mismatch between the two
  paths) is a worse product defect than "binary diffs on regen."
- `gpt-4o-mini-tts` has been observed to silently degrade between
  snapshots (see the OpenAI developer-community thread about the
  `2025-12-15` snapshot producing darker, muddier audio than
  `2025-03-20`). Mitigation: we pin the snapshot explicitly; we do NOT
  use the floating `gpt-4o-mini-tts` alias for the primary model.
  Moving the pin forward requires a same-commit regeneration of the
  static library AND an A/B listen against the old snapshot.

If this policy fails a future listening audit — e.g. a pinned snapshot
is deprecated or drifts audibly — the next step is ElevenLabs with a
Professional Voice Clone used for both paths. ElevenLabs was the
pre-OpenAI incumbent in this project; its voice-clone offering produces
the same voice model for both pre-render and live synthesis by
construction, which is the strongest possible two-source alignment.

### Original (superseded) text

The environment-contract and monitoring sections below describe Policy
C and are retained for historical context. `OPENAI_TTS_STATIC_MODEL` and
`OPENAI_TTS_FALLBACK_MODEL` defaults have changed per the new policy —
see `app/api/tts/route.ts` and `scripts/regenerate-v7-static-audio.ts`
for current values.

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
