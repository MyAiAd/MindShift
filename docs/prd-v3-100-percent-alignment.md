# PRD: V6 Treatment System — V2-Parity Modular Architecture

**Date**: April 13, 2026
**Status**: Draft
**Priority**: Critical — Patient safety & therapeutic fidelity
**Output**: A new **V6** treatment system at `lib/v6/` with its own API route, frontend component, and 100% V2 parity.
**Constraint**: **ALL existing versions are FROZEN. NEVER modify V2, V3, V4, or V5.** V2 (`lib/v2/treatment-state-machine.ts`) is the gold standard — read-only, source of truth, zero changes permitted. V3 is the starting point to fork from — copy it, don't touch it.

---

## 1. Background

V2 is the monolithic (8,075-line) treatment state machine that has been battle-tested in production. V3 was created on Sep 28, 2025 as a modular refactor, splitting the monolith across 12 files under `lib/v3/treatment-modalities/`. A prior parity audit (Nov 8–9, 2025) fixed 29 handlers and added ~1,036 lines of logic to V3, achieving ~95% parity. V4 and V5 were built on top of V3's modular structure but introduced their own variances.

Phase 5 (final edge-case verification) and Phase 6 (comprehensive testing) of the original V3 alignment were **never completed**. A fresh audit on April 13, 2026 reveals **remaining gaps** in both scripted responses (patient-facing text) and routing/orchestration logic. Rather than patch V3 (which V4 and V5 depend on), this PRD specifies a **new V6** that forks from V3 and closes every remaining gap, producing a clean modular codebase with 100% V2 fidelity.

---

## 2. Guiding Principles

1. **V2 is the gold standard. Do not touch it.** V2 is read-only. No lines added, removed, or changed. Not even whitespace. Verify with `git diff lib/v2/` after every phase.
2. **Every word matters.** These are therapy scripts; even minor wording changes alter the patient experience.
3. **V2 is canonical.** When V2 and V3 differ, V6 must match V2 — not V3.
4. **Clean fork, no in-place mutation.** V6 lives at `lib/v6/` and `app/api/treatment-v6/`. V2, V3, V4, and V5 remain untouched.
5. **No regressions.** Each fix must be tested in isolation before moving to the next.
6. **Context fidelity.** Dynamic interpolation (which variable is read, in which priority order) must exactly match V2.

---

## 3. V6 Scaffolding

Before applying fixes, create the V6 skeleton by copying V3:

| Source | Destination |
|--------|-------------|
| `lib/v3/` | `lib/v6/` |
| `app/api/treatment-v3/route.ts` | `app/api/treatment-v6/route.ts` |
| `components/treatment/v3/` | `components/treatment/v6/` (if applicable) |

Update all internal imports within `lib/v6/` to reference `v6` paths (not `v3`). Update the API route to import from `lib/v6/`. Add a V6 entry to Labs toggles or navigation as needed.

---

## 4. Issues Catalogue

All fixes below target the **V6 fork**. File paths are relative to `lib/v6/`.

### TIER 1 — MISSING TREATMENT PATHWAYS (Patient cannot complete treatment)

#### T1-01: Belief Shifting — Missing 6 Future Projection Steps

**V2 has** (lines ~4660–4776): `belief_future_projection`, `belief_future_step_b`, `belief_future_step_c`, `belief_future_step_d`, `belief_future_step_e`, `belief_future_step_f`

**V3 has**: None of these steps exist.

**Patient impact**: When a patient's belief persists through the 4 checking questions AND the belief check cycles, V2 routes to a future-projection sequence that dissolves the belief through temporal re-framing. V3 has no equivalent pathway — the patient hits a dead end.

**Fix**:
- **File**: `lib/v6/treatment-modalities/belief-shifting.ts`
- Add 6 steps after `belief_check_4` with these V2 scripted responses:
  - `belief_future_projection`: `Put yourself in the future and feel yourself believing '${belief}'... what does it feel like?`
  - `belief_future_step_b`: `Feel '${stepAResponse}'... what does '${stepAResponse}' feel like?`
  - `belief_future_step_c`: `What would you rather feel?`
  - `belief_future_step_d`: `What would '${desiredFeeling}' feel like?`
  - `belief_future_step_e`: `Feel '${stepDResponse}'... what does '${stepDResponse}' feel like?`
  - `belief_future_step_f`: `Do you still believe '${belief}'?`
- **File**: `lib/v6/treatment-state-machine.ts`
  - Add routing for `belief_future_step_f` (yes → cycle back to `belief_step_a`, no → proceed to next check / `belief_problem_check`)
  - Update `handleBeliefChecks` to route to `belief_future_projection` when appropriate (matching V2 logic)

---

#### T1-02: Trauma Shifting — Missing `cycleCount` Branch in `trauma_identity_step`

**V2** (lines ~3992–3998): When `cycleCount > 0`, uses a shorter prompt:
> `Keep feeling this frozen moment...what kind of person are you being in this moment?`

**V3** (`trauma-shifting.ts` line 47): Always uses the full first-time prompt including "Please close your eyes" and the long preamble, even on repeat cycles.

**Patient impact**: On iterations 2+, the patient has already closed their eyes and heard the instructions. Repeating the full preamble is confusing and breaks therapeutic flow.

**Fix**:
- **File**: `lib/v6/treatment-modalities/trauma-shifting.ts`
- Add `cycleCount` check to `trauma_identity_step` scriptedResponse:
  ```
  if (cycleCount > 0) → short version
  else → full version (current)
  ```

---

### TIER 2 — WRONG PATIENT-FACING TEXT (Patient hears incorrect words)

#### T2-01: Belief Shifting Intro — Spurious "that" in Prompt

**V2** (~4448–4451):
> `Feel the problem '${problemStatement}'... what do you believe...`
> `...this problem '${problemStatement}'?`

**V3** (`belief-shifting.ts` lines 40–42):
> `Feel the problem **that** '${problemStatement}'...`
> `...this problem **that** '${problemStatement}'?`

**Fix**: Remove both "that" insertions in V6.

---

#### T2-02: Belief Shifting — `belief_step_a` Missing Bridge Phrases

**V2** (~4492–4513): `belief_step_a` uses dynamic prefix based on `returnToBeliefCheck`:
- Default: `Feel yourself believing '${belief}'...`
- From `belief_check_2` (future): `Put yourself in the future and feel yourself believing '${belief}'...`
- From `belief_check_3` (scenario): `Imagine that scenario and feel yourself believing '${belief}'...`
- Tracks `beliefBridgePhraseUsed` flag for one-time use.

**V3** (`belief-shifting.ts` line 67): Always uses `Feel yourself believing '${belief}'...` — no bridge phrases.

**Patient impact**: V2 calibrates the prompt to the patient's journey context. V3 is always generic.

**Fix**: Add full bridge-phrase logic from V2 into V6's `belief_step_a`.

---

#### T2-03: Belief Shifting — `belief_step_f` / `belief_check_1–3` Use Different Belief Source

**V2**: Reads belief from `userResponses['belief_shifting_intro']` with "I believe" prefix stripping.

**V3**: Reads from `metadata.currentBelief` (set in `belief_step_a`).

**Patient impact**: When `metadata.currentBelief` and `userResponses['belief_shifting_intro']` diverge (e.g., after cycling), the patient hears a different belief quoted back to them.

**Fix**: Align V6 to use V2's source logic: `userResponses['belief_shifting_intro']` with prefix stripping, falling back to `metadata.currentBelief`.

---

#### T2-04: Trauma Shifting — `trauma_dissolve_step_a` Missing Bridge Phrases

**V2** (~4030–4044): Uses dynamic prefix based on `returnToTraumaCheck`:
- From `trauma_future_identity_check`: `Put yourself in the future and feel yourself being...`
- From `trauma_future_scenario_check`: `Imagine that scenario and feel yourself being...`
- Default: `Feel yourself being...`
- Tracks `traumaBridgePhraseUsed` flag.

**V3** (`trauma-shifting.ts` line 76): Always uses `Feel yourself being ${identity}...` — no bridge phrases.

**Fix**: Add full bridge-phrase logic from V2 into V6's `trauma_dissolve_step_a`.

---

#### T2-05: Trauma Shifting — `trauma_dissolve_step_b` Missing Metadata Fallback

**V2** (~4059): `const lastResponse = context.metadata.currentStepAResponse || context.userResponses?.['trauma_dissolve_step_a'] || 'that feeling';`

**V3** (`trauma-shifting.ts` line 92): `const lastResponse = context.userResponses?.['trauma_dissolve_step_a'] || 'that feeling';`

**Patient impact**: On repeat iterations, V3 may use a stale cached response from a prior cycle instead of the current one.

**Fix**: Add `context.metadata.currentStepAResponse` as first priority in V6's fallback chain.

---

#### T2-06: Trauma Shifting — `trauma_dig_deeper_2` Missing Problem Reference

**V2** (~5388): `Is there anything else about '${originalProblem}' that's still a problem for you?`

**V3** (`trauma-shifting.ts` line 339): `Is there anything else about this that is still a problem for you?`

**Fix**: Add `originalProblem` interpolation in V6 to match V2.

---

#### T2-07: Digging Deeper — `restate_problem_future` Missing "now"

**V2** (~4989): `How would you state the problem **now** in a few words?`

**V3** (`digging-deeper.ts` line 53): `How would you state the problem in a few words?`

**Fix**: Add "now" back in V6.

---

#### T2-08: Digging Deeper — `scenario_check_3` Uses Generic "this" Instead of Problem Name

**V3** (`digging-deeper.ts` line 269): `Is there any scenario in which this would still be a problem for you?` (static string)

**V2** (~5189): `Is there any scenario in which '${originalProblem}' would still be a problem for you?` (dynamic)

**Note**: V3 actually has a **duplicate** `scenario_check_3` step (lines 267–344 AND 328–380). The first is static/generic, the second has the correct dynamic version. The duplicate must be removed and the dynamic version kept.

**Fix**: In V6, remove the duplicate static `scenario_check_3` (lines 267–327) and keep only the dynamic version.

---

#### T2-09: Work Type Selection — `confirm_statement` Wording Mismatch

**V2** (~2042): `Ok so the problem is '${statement}' is that right?`

**V3** (`work-type-selection.ts` ~119): `So you want to work on '${statement}'. Is that correct? Please say yes or no.`

**Fix**: Change V6 to match V2's exact wording.

---

#### T2-10: Identity Integration — Spurious Section Headers

**V2** identity `integration_awareness_1` (~3248): `How do you feel about '${subject}' now?` (no header)

**V3** (`identity-shifting.ts` ~471): `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${subject}' now?`

**V2** identity `integration_action_1` (~3324): `What needs to happen for you to realise your intention?` (no header)

**V3** (~540): `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?`

**Note**: V2 **does** use these headers for Problem Shifting integration (~2391) but NOT for Identity Shifting integration. V3 uses them for both.

**Fix**: In V6, remove `Integration Questions - AWARENESS Section:\n\n` and `Integration Questions - ACTION Section:\n\n` prefixes from Identity Shifting integration steps to match V2.

---

### TIER 3 — ROUTING / ORCHESTRATION DIFFERENCES (Patient may reach wrong step)

#### T3-01: `trauma_problem_redirect` — Wrong `nextStep`

**V2** (~3980): `nextStep: 'work_type_description'`
**V3** (`trauma-shifting.ts` line 36): `nextStep: 'choose_method'`

**Patient impact**: After the patient describes their feeling about the trauma, V2 routes to `work_type_description` (which in turn routes to `confirm_statement`). V3 routes directly to `choose_method`, skipping the confirmation step.

**Fix**: Change V6's `nextStep` to `'work_type_description'` to match V2.

---

#### T3-02: `route_to_method` Returns Signals vs Patient-Facing Text

**V2** (~2070–2081): Returns patient-facing strings like `Great! Let's begin Problem Shifting.`

**V3** (`work-type-selection.ts` ~147–154): Returns internal signals like `ROUTE_TO_PROBLEM_SHIFTING`.

**Impact**: If the UI or route handler expects to display the response from `route_to_method`, V3 shows a raw signal string instead of a human message. V2's approach lets the patient see confirmation text before entering the modality.

**Fix**: Change V6's `route_to_method` to return V2's patient-facing strings while still handling routing in `determineNextStep`.

---

#### T3-03: `mind_shifting_explanation` — Different Signal for Goals

**V2** (~1833): Returns `SKIP_TO_TREATMENT_INTRO` when goal already has a description.
**V3** (`introduction.ts` ~97): Returns `ROUTE_TO_REALITY_SHIFTING`.

**Impact**: Different signal names may not be handled by all code paths. Verify all consumers handle both or align to V2's signal.

**Fix**: In V6, audit signal handlers in `base-state-machine.ts` and `treatment-state-machine.ts`. Ensure consistent signal handling. Prefer aligning to V2's signal names.

---

#### T3-04: `clear_scenario_problem_1/2/3` — V3 Uses Signals; V2 Uses `determineNextStep` Routing

**V2**: The `clear_scenario_problem_*` steps route via `determineNextStep` handlers that read `lastResponse` and select the method, then route to the appropriate modality intro.

**V3** (`digging-deeper.ts`): The `clear_scenario_problem_*` steps return signals like `PROBLEM_SHIFTING_SELECTED` based on `context.metadata.selectedMethod` (the **original** method), ignoring the user's choice.

**Patient impact**: In V2, the user **chooses** which method to use for each scenario problem. In V3, the system **auto-selects** the original method without asking.

**Fix**: In V6, the `clear_scenario_problem_*` steps should present a method selection prompt (like `digging_method_selection` does) instead of auto-routing based on the original method. Match V2's behavior where the user picks the method each time.

---

#### T3-05: `clear_anything_else_problem_1/2` — Return Point Mismatch

**V3** `clear_anything_else_problem_1` (`digging-deeper.ts` line 414): Sets `returnToDiggingStep = 'integration_start'`

**V2** (via `handleClearAnythingElseProblem1`): Sets `returnToDiggingStep = 'anything_else_check_1'`

**Patient impact**: After clearing the anything-else problem, V2 returns to `anything_else_check_1` to ask if there's more. V3 jumps straight to integration, skipping further anything-else questioning.

**Fix**: Change V6's return point to `'anything_else_check_1'` (and `'anything_else_check_2'` for problem 2) to match V2.

---

#### T3-06: Integration Phase — `originalProblemStatement` Priority Mismatch

**V2** `integration_start` (~5417): Prioritizes `originalProblemStatement` first in the fallback chain.

**V3** (`integration.ts` ~15): Prioritizes `metadata.problemStatement` first.

**Patient impact**: After digging deeper, `metadata.problemStatement` may contain the latest sub-problem. V2 intentionally uses the **original** problem for the final integration reflection. V3 may accidentally use a sub-problem.

**Fix**: In V6, reorder the fallback chain to prioritize `originalProblemStatement` first, matching V2.

---

### TIER 4 — MINOR DIFFERENCES (Implementation quality, no patient-facing impact)

#### T4-01: `digging_method_selection` — Numbered List in Prompt

**V2** (~5041): `We need to clear this problem. Which method would you like to use?` (no numbered list; relies on UI buttons)

**V3** (`digging-deeper.ts` line 91): Same text + `\n\n1. Problem Shifting\n2. Identity Shifting\n3. Belief Shifting\n4. Blockage Shifting`

**Decision needed**: Keep V3's numbered list (helpful for voice/text-only) or strip to match V2 (cleaner with button UI). **Recommend: keep V3's version** since it supports voice-mode where buttons aren't visible.

---

#### T4-02: `work_type_description` — Missing `skipUserInput` Flag Support

**V2** (~1948–1952): Supports a `skipUserInput` flag that auto-advances without user input.

**V3**: No equivalent.

**Impact**: Minor — this was a niche optimization path. Low priority.

---

#### T4-03: Console Log Formatting

Various steps have different emoji prefixes and log message formatting between V2 and V3. No patient-facing impact. No fix required.

---

#### T4-04: Duplicate `scenario_check_3` Steps in V3

**V3** (`digging-deeper.ts`): Contains TWO `scenario_check_3` definitions — a static one (line 269) and a dynamic one (line 332). Only the last one in the array wins at runtime, but the dead code is confusing.

**Fix**: In V6, remove the first (static) `scenario_check_3` definition and its associated `restate_scenario_problem_3` / `clear_scenario_problem_3` duplicates.

---

## 5. Implementation Plan

### Phase 0: Scaffold V6
1. Copy `lib/v3/` → `lib/v6/`
2. Copy `app/api/treatment-v3/route.ts` → `app/api/treatment-v6/route.ts`
3. Copy `components/treatment/v3/` → `components/treatment/v6/` (if applicable)
4. Update all internal imports in V6 files to reference `lib/v6/` paths
5. Update API route to import from `lib/v6/`
6. Add V6 to navigation / Labs toggle
7. Verify V6 compiles and runs identically to V3 before making any fixes

### Phase 1: Critical Missing Pathways (Tier 1)
| # | Issue | File (under `lib/v6/`) | Est. Lines | Est. Time |
|---|-------|------|-----------|-----------|
| T1-01 | Belief future projection (6 steps) | `treatment-modalities/belief-shifting.ts` + `treatment-state-machine.ts` | ~130 | 2h |
| T1-02 | Trauma `cycleCount` branch | `treatment-modalities/trauma-shifting.ts` | ~10 | 15min |

### Phase 2: Wrong Patient Text (Tier 2)
| # | Issue | File (under `lib/v6/`) | Est. Lines |
|---|-------|------|-----------|
| T2-01 | Belief intro spurious "that" | `treatment-modalities/belief-shifting.ts` | 2 |
| T2-02 | Belief `step_a` bridge phrases | `treatment-modalities/belief-shifting.ts` | ~25 |
| T2-03 | Belief check belief source | `treatment-modalities/belief-shifting.ts` | ~15 |
| T2-04 | Trauma `step_a` bridge phrases | `treatment-modalities/trauma-shifting.ts` | ~20 |
| T2-05 | Trauma `step_b` metadata fallback | `treatment-modalities/trauma-shifting.ts` | 1 |
| T2-06 | Trauma dig_deeper_2 problem ref | `treatment-modalities/trauma-shifting.ts` | ~5 |
| T2-07 | Digging `restate_problem_future` "now" | `treatment-modalities/digging-deeper.ts` | 1 |
| T2-08 | Digging `scenario_check_3` duplicate | `treatment-modalities/digging-deeper.ts` | -60 (remove) |
| T2-09 | `confirm_statement` wording | `treatment-modalities/work-type-selection.ts` | 1 |
| T2-10 | Identity integration headers | `treatment-modalities/identity-shifting.ts` | 2 |

### Phase 3: Routing / Orchestration (Tier 3)
| # | Issue | File (under `lib/v6/`) |
|---|-------|------|
| T3-01 | `trauma_problem_redirect` nextStep | `treatment-modalities/trauma-shifting.ts` |
| T3-02 | `route_to_method` signals vs text | `treatment-modalities/work-type-selection.ts` |
| T3-03 | Goal signal name alignment | `treatment-modalities/introduction.ts` + `base-state-machine.ts` |
| T3-04 | `clear_scenario_problem_*` auto-select | `treatment-modalities/digging-deeper.ts` |
| T3-05 | `clear_anything_else_*` return points | `treatment-modalities/digging-deeper.ts` |
| T3-06 | Integration `originalProblemStatement` priority | `treatment-modalities/integration.ts` |

### Phase 4: Cleanup (Tier 4)
| # | Issue | File (under `lib/v6/`) |
|---|-------|------|
| T4-04 | Remove duplicate scenario_check_3 | `treatment-modalities/digging-deeper.ts` |

### Phase 5: Verification
- Run V2 and V6 side-by-side through every modality flow
- Test all 6 modalities: Problem, Identity, Belief, Blockage, Reality, Trauma
- Test multi-level digging deeper (3 scenarios + 2 anything-else)
- Test belief cycling through all 4 checks + future projection
- Test trauma cycling with repeat iterations
- **MANDATORY after every phase**: Verify V2 is untouched: `git diff lib/v2/` must show 0 lines changed
- Verify V3 is untouched: `git diff lib/v3/` must show 0 lines changed
- Verify V4 is untouched: `git diff lib/v4/` must show 0 lines changed
- Verify V5 is untouched: `git diff lib/v5/` must show 0 lines changed

---

## 6. Files Created / Affected

| File | Action |
|------|--------|
| `lib/v6/` (entire directory) | **CREATE** — fork from `lib/v3/` |
| `app/api/treatment-v6/route.ts` | **CREATE** — fork from `app/api/treatment-v3/route.ts` |
| `components/treatment/v6/` | **CREATE** — fork from `components/treatment/v3/` (if applicable) |
| `lib/v6/treatment-modalities/belief-shifting.ts` | T1-01, T2-01, T2-02, T2-03 |
| `lib/v6/treatment-modalities/trauma-shifting.ts` | T1-02, T2-04, T2-05, T2-06, T3-01 |
| `lib/v6/treatment-modalities/digging-deeper.ts` | T2-07, T2-08, T3-04, T3-05, T4-04 |
| `lib/v6/treatment-modalities/work-type-selection.ts` | T2-09, T3-02 |
| `lib/v6/treatment-modalities/identity-shifting.ts` | T2-10 |
| `lib/v6/treatment-modalities/introduction.ts` | T3-03 |
| `lib/v6/treatment-modalities/integration.ts` | T3-06 |
| `lib/v6/treatment-state-machine.ts` | T1-01 (routing for belief future projection) |

---

## 7. Success Criteria

1. **Zero** text differences between V2 and V6 scripted responses for the same step ID
2. **Zero** routing differences — given the same user input sequence, V2 and V6 produce the same step progression
3. **Zero** context/interpolation differences — the same metadata fields are read in the same priority order
4. **Zero** modifications to V2, V3, V4, or V5 files
5. All 6 modalities tested end-to-end with at least one full session each
6. Digging deeper tested with 3-level nesting (scenario_check_1 → 2 → 3 → anything_else)
7. V6 compiles with zero TypeScript errors
8. V6 API route is accessible and returns correct responses

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Fix in one modality breaks another | Each fix is isolated to a single step; test after each change |
| Signal name changes break frontend | Audit all signal consumers before changing signal names |
| V2 has bugs that V6 should NOT replicate | Document any V2 bugs found; replicate them anyway for parity in V6. Fix V2 bugs in a **separate** PRD later — never as part of this work |
| Missing test coverage | Create automated parity test that runs both V2 and V6 with identical inputs and compares outputs |
| V3 fork brings stale dependencies | After forking, audit all imports and shared utilities; ensure no circular references |
| Version sprawl (V3/V4/V5 still exist) | V6 is the canonical modular version; V3/V4/V5 can be deprecated once V6 is validated |

---

## 9. Out of Scope

- Modifying V2, V3, V4, or V5
- New features or improvements to the treatment flow
- UI/frontend redesign (V6 reuses V3's component patterns)
- Performance optimisation beyond what V3 already has
- Database schema changes
- Voice/audio integration (that is a V4/V5 concern, not a parity concern)
