# PRD: V6 Voice Cutover and Parity Gate

**Date**: April 14, 2026
**Status**: Draft
**Priority**: Critical - therapeutic fidelity, safe rollout, and platform consolidation
**Output**: A production-ready **V6** treatment system that is provably aligned with **V2**, inherits **V5** voice capability, replaces V5 as the main treatment route, and moves V5 into Labs.
**Dependency**: This PRD extends `docs/prd-v3-100-percent-alignment.md`. That PRD defines V6 as the modular V2-parity fork. This PRD defines how V6 is verified, voice-enabled, and promoted to the mainline product path.

---

## 1. Background

V6 was created as the clean modular successor to V3, with the explicit goal of matching the production-proven V2 monolith step-for-step and word-for-word. V5, meanwhile, became the live treatment experience because it was already wired into the app shell and had a mature voice stack: Kokoro text-to-speech, Whisper transcription, VAD, barge-in behavior, static audio preloading, and mobile-friendly interaction modes.

This leaves the product in an undesirable split state:

1. **V6** is the intended canonical treatment engine, but it is not yet the live entry point.
2. **V5** is the live experience, but it inherits behavioral drift from the V3 lineage and cannot be the long-term canonical version.
3. The app therefore needs a disciplined migration path:
   - first prove that V6 truly matches V2
   - then add voice to V6 using the proven V5 approach
   - then cut over the product from V5 to V6

The objective is not to invent a new treatment system. The objective is to make **V6 the single source of truth** for the modular future while preserving therapeutic fidelity and retaining the voice experience users already rely on.

---

## 2. Product Objective

Create a three-stage rollout for V6:

1. **Parity Gate**: produce automated evidence that V6 and V2 generate the same step progression and patient-facing outputs for the same inputs
2. **Voice Transplant**: port the V5 voice layer onto V6 without duplicating shared infrastructure
3. **Cutover**: make V6 the main treatment route in the product, move V5 into Labs, and keep V3 frozen

---

## 3. Guiding Principles

1. **V2 remains the gold standard.** If V2 and V6 differ, V6 is wrong.
2. **Voice is an interface layer, not treatment logic.** Do not copy voice logic into treatment-state-machine files.
3. **Shared infrastructure stays shared.** Reuse `useNaturalVoice`, `useGlobalVoice`, `useVAD`, `useAudioCapture`, `/api/tts`, and `/api/transcribe`.
4. **Do not mutate legacy versions to achieve V6 readiness.** V2 is read-only. V3 stays frozen. V5 is only retained as a Labs fallback once cutover is complete.
5. **Static audio must match V6 text exactly.** If V6 wording differs from V5, V6 needs its own static audio generation pass.
6. **Cutover happens only after parity and voice are both validated.**

---

## 4. Scope

### In Scope

- Automated V2 vs V6 parity verification
- New parity report output for V6
- Voice enablement for `lib/v6/`, `components/treatment/v6/`, and the V6 route
- Static audio assets and manifests for V6
- New V6 page route under dashboard sessions
- Navigation swap from V5 to V6
- Moving V5 into Labs
- Updating test helpers and scripts to recognize V6

### Out of Scope

- Rewriting the shared voice subsystem
- New treatment features unrelated to V2 parity
- Changes to therapeutic scripts for stylistic reasons
- Replacing Kokoro, Whisper, or the existing speech architecture
- Re-architecting Labs or settings beyond what is necessary for V5/V6 routing

---

## 5. Milestone 1 - Parity Gate (V6 = V2)

### Goal

Produce automated proof that V6 and V2 behave identically for the same input sequences.

### Problem Being Solved

The existing Playwright API parity suite compares versions through HTTP routes, but it is not optimized for exact patient-facing text comparison. The missing capability is a direct, state-machine-level comparator that can evaluate:

- `scriptedResponse`
- `nextStep`
- phase progression
- branching behavior through cycling and digging-deeper paths

### Required Deliverable

A direct comparison harness that:

1. imports `TreatmentStateMachine` from `lib/v2/treatment-state-machine.ts`
2. imports `TreatmentStateMachine` from `lib/v6/treatment-state-machine.ts`
3. replays shared flow definitions from `tests/helpers/test-flows.ts`
4. compares each turn's normalized output
5. writes a report to `tests/reports/V2_V6_PARITY_REPORT.md`

### Files

- `scripts/v2-v6-parity-check.ts`
- `tests/helpers/test-flows.ts`
- `tests/reports/V2_V6_PARITY_REPORT.md`

### Optional Integration-Level Follow-up

Once direct parity passes, the Playwright API harness may also be extended so V6 can participate in route-level parity testing:

- `tests/helpers/api-client.ts`
- `tests/helpers/parity-runner.ts`
- `package.json`

### Acceptance Criteria

1. Zero text mismatches across the covered flows
2. Zero routing mismatches across the covered flows
3. Coverage includes all 6 modalities plus digging deeper, cycling, and cross-modality digging
4. The parity report is machine-generated and repeatable

---

## 6. Milestone 2 - Voice Transplant (V5 voice into V6)

### Goal

Make V6 fully voice-capable using the proven V5 experience model.

### Existing Shared Voice Infrastructure

These systems already exist and must be reused:

- `components/voice/useNaturalVoice.tsx`
- `components/voice/useGlobalVoice.tsx`
- `components/voice/useVAD.tsx`
- `components/voice/useAudioCapture.ts`
- `services/voice/audioCache.ts`
- `app/api/tts/route.ts`
- `app/api/transcribe/route.ts`
- `lib/voice/transcription-domain-context.ts`

### V5-Specific Assets That Must Be Ported to V6

#### Library Files

- `lib/v5/v5-preferences.ts` -> create `lib/v6/v6-preferences.ts`
- `lib/v5/static-audio-texts.ts` -> create `lib/v6/static-audio-texts.ts`

#### Component Files

- `components/treatment/v5/V5AudioPreloader.tsx` -> create `components/treatment/v6/V6AudioPreloader.tsx`
- `components/treatment/v5/AdminDebugDrawer.tsx` -> create `components/treatment/v6/AdminDebugDrawer.tsx`
- `components/treatment/v5/TreatmentSession.tsx` -> port voice behavior into `components/treatment/v6/TreatmentSession.tsx`
- `components/treatment/v5/shared/types.ts` -> extend `components/treatment/v6/shared/types.ts`

#### Modality Components

All V6 modality components must accept and pass the `voice` prop in the same pattern used by V5:

- `components/treatment/v6/modalities/ProblemShifting/ProblemShifting.tsx`
- `components/treatment/v6/modalities/IdentityShifting/IdentityShifting.tsx`
- `components/treatment/v6/modalities/BeliefShifting/BeliefShifting.tsx`
- `components/treatment/v6/modalities/BlockageShifting/BlockageShifting.tsx`
- `components/treatment/v6/modalities/RealityShifting/RealityShifting.tsx`
- `components/treatment/v6/modalities/TraumaShifting/TraumaShifting.tsx`

### Voice Features V6 Must Inherit

1. Mic and speaker toggles
2. Kokoro TTS playback through `/api/tts`
3. Whisper transcription through `/api/transcribe`
4. VAD-based listening flow
5. Barge-in behavior
6. Orb/PTT and text-first interaction modes
7. Transcription domain context aligned with treatment step IDs
8. Static audio preloading and cache-aware playback
9. Debug drawer support for voice timing and playback inspection

### Static Audio Requirement

V6 must have its own static audio manifest and assets because its text must match V2, not V5. Static audio keys cannot be assumed to match.

Use:

- `scripts/generate-static-audio.js`
- output directory: `public/audio/v6/static/`

### Acceptance Criteria

1. V6 can operate in text-only mode and voice mode
2. V6 uses the shared TTS and STT APIs successfully
3. Static audio preloading works for V6
4. V6 localStorage keys are consistently `v6_*`
5. No V5-only imports remain in the V6 user-facing flow except where intentionally reused as shared infrastructure

---

## 7. Milestone 3 - Cutover

### Goal

Promote V6 to the primary treatment route and demote V5 to Labs.

### New V6 Page Route

Create:

- `app/dashboard/sessions/treatment-v6/page.tsx`

This route should mirror the V5 page route pattern while importing V6 components and using V6 voice preferences and audio preloading.

### Main Navigation Swap

Update:

- `app/dashboard/page.tsx`
- `app/dashboard/sessions/page.tsx`
- `components/layout/MobileNav.tsx`
- `app/dashboard/layout.tsx`

Required changes:

1. Main "Start Mind Shifting" flows point to `/dashboard/sessions/treatment-v6`
2. Continue-session flows point to `/dashboard/sessions/treatment-v6`
3. Session IDs use the `session-v6-` prefix where appropriate
4. Layout hides mobile nav on the V6 treatment route the same way it does for V5

### V5 to Labs

Update:

- `app/dashboard/settings/page.tsx`

Required result:

1. V5 is moved into Labs rather than remaining the default production experience
2. V6 becomes the mainline experience
3. If a toggle is retained for operational safety, it should be framed as fallback access, not the primary path

### Freeze V3

V3 is already conceptually frozen. After V6 cutover:

- keep V3 unchanged
- optionally add explicit deprecation documentation if helpful

### Test and Script Updates

Update:

- `tests/helpers/api-client.ts`
- `package.json`

Required result:

1. test helpers recognize `/api/treatment-v6`
2. test scripts can target V6 directly
3. V6 becomes the default candidate version for future parity/regression work

---

## 8. Success Criteria

The project is complete when all of the following are true:

1. `tests/reports/V2_V6_PARITY_REPORT.md` shows zero mismatches
2. V6 has full voice support equivalent to V5
3. V6 static audio assets exist and align with V6 text
4. `/dashboard/sessions/treatment-v6` is the primary live route
5. Main navigation points to V6
6. V5 remains accessible only through Labs
7. V3 remains unchanged
8. V2 remains unchanged
9. TypeScript compiles without errors
10. The V6 route works in both text and voice modes

---

## 9. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| V6 text differs from V5 static audio | Generate V6-specific static audio files and manifests |
| Voice port introduces behavior drift | Keep treatment logic in `lib/v6/` untouched; port voice only at component/page layer |
| V5 localStorage inconsistencies get copied forward | Normalize all V6 keys to `v6_*` during transplant |
| Direct parity script passes but route-level behavior diverges | Add V6 to route-level Playwright/API test helpers after direct parity succeeds |
| Shared voice hooks assume old step IDs | Audit `lib/voice/transcription-domain-context.ts` for V6-only step names such as belief future projection |
| Cutover removes access to fallback flow too early | Move V5 to Labs rather than deleting it |

---

## 10. Execution Order

1. Build and validate the direct V2-vs-V6 parity gate
2. Fix any remaining V6 mismatches until report shows zero diffs
3. Port V5 voice support into V6
4. Generate V6 static audio assets
5. Create the V6 dashboard route
6. Swap main navigation from V5 to V6
7. Move V5 into Labs
8. Update tests and package scripts so V6 is the active target

---

## 11. File Summary

| File / Area | Action |
|-------------|--------|
| `scripts/v2-v6-parity-check.ts` | Create direct parity harness |
| `tests/reports/V2_V6_PARITY_REPORT.md` | Generate parity report |
| `lib/v6/v6-preferences.ts` | Create |
| `lib/v6/static-audio-texts.ts` | Create |
| `components/treatment/v6/V6AudioPreloader.tsx` | Create |
| `components/treatment/v6/AdminDebugDrawer.tsx` | Create |
| `components/treatment/v6/TreatmentSession.tsx` | Upgrade with V5-equivalent voice support |
| `components/treatment/v6/shared/types.ts` | Extend with voice fields |
| `components/treatment/v6/modalities/*` | Accept/pass `voice` prop |
| `public/audio/v6/static/` | Generate |
| `app/dashboard/sessions/treatment-v6/page.tsx` | Create |
| `app/dashboard/page.tsx` | Swap to V6 |
| `app/dashboard/sessions/page.tsx` | Swap to V6 |
| `components/layout/MobileNav.tsx` | Swap to V6 |
| `app/dashboard/layout.tsx` | Add V6 treatment-route handling |
| `app/dashboard/settings/page.tsx` | Move V5 to Labs, make V6 primary |
| `tests/helpers/api-client.ts` | Add V6 endpoint support |
| `package.json` | Add/update V6 test scripts |
