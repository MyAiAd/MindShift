# PRD: V5 Problem Shifting — Second-Cycle Prompt Regression

## Summary

On the second pass through Step 2 (Problem Shifting), the app reads back the user's
**first-cycle** answer to "what needs to happen?" rather than their **new** answer just
given. The doctor's script requires the question "What would you feel like if
`<their current answer>` had already happened?" to echo the answer the patient gave in
the very same cycle — yet on cycle 2 the app speaks the first cycle's phrase verbatim.

Affected session path: treatment-v5 → Problem Shifting → `check_if_still_problem` →
"yes" → second pass through `what_needs_to_happen_step` → `feel_solution_state`.

---

## V2 Gold Standard vs V5 Analysis

All v2 references are to `lib/v2/treatment-state-machine.ts`.

### Step definitions — identical between v2 and v5

Both versions define `feel_solution_state` the same way, reading the prior step's answer:

```typescript
// v2 line 2330 — and v5 lib/v5/treatment-modalities/problem-shifting.ts line 78
id: 'feel_solution_state',
scriptedResponse: (userInput, context) => {
  const previousAnswer = context?.userResponses?.['what_needs_to_happen_step'] || 'that';
  return `What would you feel like if ${previousAnswer} had already happened?`;
},
```

### Cycle-back logic — identical between v2 and v5

Both versions increment `cycleCount`, set `skipIntroInstructions`, and route back — **without clearing any `userResponses` keys**:

```typescript
// v2 lines 6234–6239
case 'check_if_still_problem':
  if (lastResponse.includes('yes') || lastResponse.includes('still')) {
    context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
    context.metadata.skipIntroInstructions = true;
    context.metadata.skipLinguisticProcessing = true;
    return 'problem_shifting_intro';   // v5 equivalent: problem_shifting_intro_dynamic
  }
```

### Cache skip for `feel_solution_state` — PRESENT in v2, MISSING in v5

This is the primary parity gap. V2 explicitly skips the response cache for
`feel_solution_state` (line 600), with the reason documented in source:

```typescript
// v2 lines 599–603 — inside shouldSkipCache condition
// CRITICAL: Steps that depend on previous userResponses - never cache to prevent cross-problem conflicts
step.id === 'feel_solution_state' ||  // Uses userResponses['what_needs_to_happen_step']
step.id === 'reality_cycle_b2' ||     // Uses userResponses['reality_doubt_reason']
step.id === 'reality_cycle_b4' ||     // Uses userResponses['reality_cycle_b3']
step.id === 'analyze_response';       // Uses userResponses['mind_shifting_explanation'] before problemStatement is set
```

V5's `alwaysSkipCacheSteps` list (`lib/v5/base-state-machine.ts` lines 372–428)
**does not contain `feel_solution_state`**.

### API-route DB persistence — v5 regressed from v2/v3/v4

V2, V3, and V4 all `await` the DB context write before returning a response:

```typescript
// v4 app/api/treatment-v4/route.ts lines 443–447 (and identical in v3)
// PHASE 1 OPTIMIZATION: Save interaction and update context in parallel
await Promise.all([
  saveInteractionToDatabase(sessionId, userInput, finalResponse),
  updateSessionContextInDatabase(...)
]);
```

V5 (`app/api/treatment-v5/route.ts` lines 741–745), after commit `c79ec20`, uses
fire-and-forget for both:

```typescript
// Fire-and-forget: DB writes don't block the API response
void Promise.all([
  saveInteractionToDatabase(sessionId, userInput, finalResponse),
  updateSessionContextInDatabase(...)
]).catch(err => console.error('Background DB save failed:', err));
```

This means `current_step` and `user_response` in the DB can lag behind the in-memory
state machine. When a cold serverless instance loads context for the next request, it
may read stale values.

### `generateContextHash` — neither v2 nor v5 includes `what_needs_to_happen_step` answer

Both v2 (lines 721–744) and v5 (lines 487–511) omit
`userResponses['what_needs_to_happen_step']` from the hash used to key cached responses.
V2 avoids this problem by never caching `feel_solution_state` at all. V5 must do the
same.

---

## Root Cause Analysis

### Root Cause 1 — `feel_solution_state` missing from cache skip list (primary)

**File:** `lib/v5/base-state-machine.ts`

`feel_solution_state` reads `context.userResponses['what_needs_to_happen_step']`, which
changes on every cycle. The response cache stores its output keyed on a hash that
includes `userInput` (the answer to `what_needs_to_happen_step` that triggered the
transition) but does NOT include `userResponses['what_needs_to_happen_step']` directly.

When the same serverless instance handles multiple cycles of a session:

| Event | State |
|-------|-------|
| Cycle 1: user answers `what_needs_to_happen_step` = "feel better" | Cache stores `feel_solution_state` response with hash keyed on `userInput="feel better"` |
| Cycle 2: user answers `what_needs_to_happen_step` = "feel better" (same answer) | Hash = same key → **cache hit** → stale "feel better" response returned even if context has been updated |
| Cycle 2: `userInput` passed as empty (any auto-advance path) | Fallback reads `context.userResponses['what_needs_to_happen_step']` = old value → same hash → **cache hit** |

V2's explicit skip of `feel_solution_state` prevents this entirely. V5 is missing this
guard.

**This is the direct v2 parity regression causing the observed symptom.**

---

### Root Cause 2 — Fire-and-forget DB write (v5 regression from v2/v3/v4)

**File:** `app/api/treatment-v5/route.ts`, introduced in commit `c79ec20`

`updateSessionContextInDatabase` writes the session's `current_step` and the current
step's `user_response` to the database. All versions prior to v5 awaited this write
before returning the HTTP response.

After commit `c79ec20` it became fire-and-forget. On the next incoming request, if a
cold serverless instance races the pending write, it loads stale context:

- Stale `current_step`: the state machine thinks the user is on the wrong step; line 203
  (`userResponses[currentStep] = userInput`) writes to the wrong key.
- Stale `userResponses['what_needs_to_happen_step']`: the fallback path in
  `getScriptedResponse` reads the old cycle-1 value when `currentUserInput` is
  absent or falsy.

`saveInteractionToDatabase` writes only to `treatment_interactions` (analytics), which
is never read by the state machine and can safely remain fire-and-forget.

---

### Root Cause 3 — Batch upsert uses post-transition `phase_id` for all step rows

**File:** `lib/v5/database-operations.ts`, introduced in commit `c79ec20`

The refactor replaced a per-step upsert loop with a single batch. Every row in the
batch uses `context.currentPhase` as its `phase_id`:

```typescript
.map(([stepId, response]) => ({
  session_id: context.sessionId,
  phase_id: context.currentPhase,   // ← always the current phase, not the step's phase
  step_id: stepId,
  user_response: response
}));
```

The DB unique constraint is `(session_id, phase_id, step_id)`. When a session
transitions between phases (e.g., `digging_deeper` → `problem_shifting`), responses
from the prior phase are re-saved with a new `phase_id`, creating phantom duplicate rows
for the same logical step. `loadContextFromDatabase` iterates all rows for a session
without phase filtering, so when two rows exist for the same `step_id` under different
`phase_id` values, the row returned depends on Postgres's undefined scan order.

This does not cause problems within a single phase (Problem Shifting stays in
`problem_shifting` throughout cycling), but it creates cross-phase contamination for
modalities that route through `digging_deeper` and back, and it is a latent correctness
hazard for Problem Shifting if the phase pointer ever diverges.

Prior versions used a per-row loop that explicitly set each row's `phase_id` only when
that row was the currently active step, avoiding phantom rows.

---

## What v2 Does NOT Do (Important Non-Finding)

V2 does **not** clear `userResponses` for cyclic problem shifting steps when routing
back from `check_if_still_problem`. V2 relies on line 203
(`treatmentContext.userResponses[currentStep] = userInput`) to overwrite the stale
cycle-1 value with the fresh cycle-2 answer, and on the cache skip to prevent stale
cached responses from being returned. The PRD **does not** propose clearing
`userResponses` on cycle-back; that would diverge from v2 behavior.

---

## Doctor's Script (Expected Behaviour on Cycle 2)

| Step | Doctor's prompt |
|------|-----------------|
| `problem_shifting_intro_dynamic` | "Feel the problem '`<problem>`'… what does it feel like?" |
| `body_sensation_check` | "Feel '`<cycle-2 feeling>`'… what happens in yourself…" |
| `what_needs_to_happen_step` | "Feel '`<problem>`'… what needs to happen for this to not be a problem?" |
| **`feel_solution_state`** | **"What would you feel like if `<cycle-2 answer>` had already happened?"** |
| `feel_good_state` | "Feel '`<cycle-2 solution feeling>`'… what does that feel like?" |
| `what_happens_step` | "Feel '`<cycle-2 good feeling>`'… what happens in yourself…" |
| `check_if_still_problem` | "Feel the problem '`<problem>`'… does it still feel like a problem?" |

---

## Affected Files

| File | Lines | Issue |
|------|-------|-------|
| `lib/v5/base-state-machine.ts` | `alwaysSkipCacheSteps` list (~line 372) | `feel_solution_state` missing — primary v2 parity gap |
| `app/api/treatment-v5/route.ts` | ~741–745 | `void Promise.all` — regression from v2/v3/v4 |
| `lib/v5/database-operations.ts` | ~102–117 | Batch upsert uses `context.currentPhase` for all rows |

---

## Fix Specification

### Fix 1 — Add `feel_solution_state` to `alwaysSkipCacheSteps` (primary, v2 parity)

**File:** `lib/v5/base-state-machine.ts`  
**Location:** `alwaysSkipCacheSteps` array (~line 372)

Add `'feel_solution_state'` to the list, matching v2's explicit skip with the same
rationale comment:

```typescript
// BEFORE (current v5): feel_solution_state is not in alwaysSkipCacheSteps

// AFTER: add inside alwaysSkipCacheSteps, after 'body_sensation_check':
'feel_solution_state',  // Uses userResponses['what_needs_to_happen_step'] — v2 parity
```

**V2 reference:** `lib/v2/treatment-state-machine.ts` line 600, comment:
`// Uses userResponses['what_needs_to_happen_step']`.

**Why this fixes the bug:** `feel_solution_state`'s prompt embeds
`userResponses['what_needs_to_happen_step']`, which changes every cycle. By always
bypassing the cache, the scriptedResponse closure runs fresh on every request and reads
the in-memory value written by line 203 in the same request cycle. This matches v2's
behaviour exactly.

---

### Fix 2 — Restore awaited DB write for context/progress persistence

**File:** `app/api/treatment-v5/route.ts`  
**Location:** inside `handleContinueSession`, end of response-building block (~line 741)

Restore the `await` on `updateSessionContextInDatabase` (context pointer + current step
response) while leaving `saveInteractionToDatabase` (analytics only) as fire-and-forget.

```typescript
// BEFORE (current v5 — c79ec20):
// Fire-and-forget: DB writes don't block the API response
void Promise.all([
  saveInteractionToDatabase(sessionId, userInput, finalResponse),
  updateSessionContextInDatabase(sessionId, finalResponse.currentStep, finalResponse.usedAI, finalResponse.responseTime)
]).catch(err => console.error('Background DB save failed:', err));

// AFTER: match v2/v3/v4 — await context write, keep interaction insert fire-and-forget
void saveInteractionToDatabase(sessionId, userInput, finalResponse)
  .catch(err => console.error('Background interaction save failed:', err));
await updateSessionContextInDatabase(sessionId, finalResponse.currentStep, finalResponse.usedAI, finalResponse.responseTime);
```

**V2/V3/V4 reference:** All three API routes use `await Promise.all([save, update])`.

**Why this fixes the secondary issue:** Ensures `current_step` and the latest
`user_response` are committed to the database before the HTTP response is returned.
Cold serverless instances that load context on the next request will always read
up-to-date state.

---

### Fix 3 — Use canonical `phase_id` per step in batch upsert

**File:** `lib/v5/database-operations.ts`  
**Location:** `saveContextToDatabase`, `progressRecords` map (~line 103)

Replace `context.currentPhase` with a helper that resolves the correct phase for each
step, preventing phantom duplicate rows when the session crosses phase boundaries.

```typescript
// BEFORE:
.map(([stepId, response]) => ({
  session_id: context.sessionId,
  phase_id: context.currentPhase,   // ← wrong for steps from prior phases
  step_id: stepId,
  user_response: response
}));

// AFTER:
.map(([stepId, response]) => ({
  session_id: context.sessionId,
  phase_id: getCanonicalPhaseForStep(stepId, context.currentPhase),
  step_id: stepId,
  user_response: response
}));
```

Add a module-level helper at the bottom of `database-operations.ts`:

```typescript
// Maps each step to its canonical phase.
// Falls back to `fallback` for any step not in the map (e.g., future steps).
function getCanonicalPhaseForStep(stepId: string, fallback: string): string {
  const map: Record<string, string> = {
    // Introduction
    'mind_shifting_explanation_dynamic': 'introduction',
    // Work-type selection
    'work_type_description': 'work_type_selection',
    'confirm_statement':     'work_type_selection',
    'route_to_method':       'work_type_selection',
    // Method selection
    'choose_method': 'method_selection',
    // Discovery
    'multiple_problems_selection': 'discovery',
    'restate_selected_problem':    'discovery',
    'analyze_response':            'discovery',
    // Problem Shifting
    'problem_shifting_intro_static':  'problem_shifting',
    'problem_shifting_intro_dynamic': 'problem_shifting',
    'body_sensation_check':           'problem_shifting',
    'what_needs_to_happen_step':      'problem_shifting',
    'feel_solution_state':            'problem_shifting',
    'feel_good_state':                'problem_shifting',
    'what_happens_step':              'problem_shifting',
    'check_if_still_problem':         'problem_shifting',
    // Identity Shifting
    'identity_shifting_intro_static':  'identity_shifting',
    'identity_shifting_intro_dynamic': 'identity_shifting',
    'identity_check':                  'identity_shifting',
    'identity_dissolve_step_a':        'identity_shifting',
    'identity_dissolve_step_b':        'identity_shifting',
    'identity_dissolve_step_c':        'identity_shifting',
    'identity_dissolve_step_d':        'identity_shifting',
    'identity_dissolve_step_e':        'identity_shifting',
    'identity_dissolve_step_f':        'identity_shifting',
    'identity_future_check':           'identity_shifting',
    'identity_scenario_check':         'identity_shifting',
    // Belief Shifting
    'belief_shifting_intro_static':  'belief_shifting',
    'belief_shifting_intro_dynamic': 'belief_shifting',
    'belief_step_a': 'belief_shifting',
    'belief_step_b': 'belief_shifting',
    'belief_step_c': 'belief_shifting',
    'belief_step_d': 'belief_shifting',
    'belief_step_e': 'belief_shifting',
    'belief_step_f': 'belief_shifting',
    'belief_check_1': 'belief_shifting',
    'belief_check_2': 'belief_shifting',
    'belief_check_3': 'belief_shifting',
    'belief_check_4': 'belief_shifting',
    // Blockage Shifting
    'blockage_shifting_intro_static':  'blockage_shifting',
    'blockage_shifting_intro_dynamic': 'blockage_shifting',
    'blockage_step_a': 'blockage_shifting',
    'blockage_step_b': 'blockage_shifting',
    'blockage_step_c': 'blockage_shifting',
    'blockage_step_d': 'blockage_shifting',
    'blockage_step_e': 'blockage_shifting',
    'blockage_check_if_still_problem': 'blockage_shifting',
    // Reality Shifting
    'reality_shifting_intro_static':  'reality_shifting',
    'reality_shifting_intro_dynamic': 'reality_shifting',
    // Trauma Shifting
    'trauma_shifting_intro':         'trauma_shifting',
    'trauma_identity_step_static':   'trauma_shifting',
    'trauma_identity_step_dynamic':  'trauma_shifting',
    'trauma_dissolve_step_a':        'trauma_shifting',
    'trauma_dissolve_step_b':        'trauma_shifting',
    'trauma_dissolve_step_c':        'trauma_shifting',
    'trauma_dissolve_step_d':        'trauma_shifting',
    'trauma_dissolve_step_e':        'trauma_shifting',
    'trauma_identity_check':         'trauma_shifting',
    'trauma_future_identity_check':  'trauma_shifting',
    'trauma_future_scenario_check':  'trauma_shifting',
    'trauma_experience_check':       'trauma_shifting',
    // Digging Deeper
    'digging_deeper_start':    'digging_deeper',
    'future_problem_check':    'digging_deeper',
    'digging_method_selection':'digging_deeper',
  };
  return map[stepId] ?? fallback;
}
```

**Why this fixes the tertiary issue:** Prevents phantom duplicate rows in
`treatment_progress` when a session crosses phase boundaries, ensuring
`loadContextFromDatabase` always reconstructs a clean `userResponses` map.

---

## V2 vs V5 Comparison Summary

| Aspect | V2 behaviour | V5 current | V5 target |
|--------|-------------|-----------|-----------|
| Cache skip for `feel_solution_state` | Always skipped (line 600) | NOT skipped | Add to `alwaysSkipCacheSteps` — Fix 1 |
| API-route DB write | `await Promise.all` (blocking) | `void` (fire-and-forget) | Restore `await` for `updateSessionContextInDatabase` — Fix 2 |
| DB batch upsert `phase_id` | Per-row loop (no batch, no issue) | Single `context.currentPhase` for all rows | `getCanonicalPhaseForStep` helper — Fix 3 |
| Clear `userResponses` on cycle-back | Does NOT clear | Does NOT clear | No change needed — both correct |
| `generateContextHash` | Does not include `what_needs_to_happen_step` response | Does not include it | No change needed — Fix 1 makes it irrelevant |

---

## Implementation Order

| Priority | Fix | Reason |
|----------|-----|--------|
| **1 — must deploy first** | Fix 1 (`alwaysSkipCacheSteps`) | Direct v2 parity gap; eliminates cache-layer bug without side effects |
| **2** | Fix 2 (restore `await`) | Eliminates cold-start race; matches all prior versions |
| **3** | Fix 3 (`getCanonicalPhaseForStep`) | Eliminates latent phantom-row hazard; low risk, no protocol change |

Fix 1 alone resolves the reported symptom on a warm instance. Fix 2 covers the cold-start
path. Fix 3 is defence-in-depth for multi-phase sessions.

---

## Regression Test Plan

All tests confined to v5. V2 and V4 code are untouched.

### Manual two-cycle session test

| Step | Input | Expected prompt |
|------|-------|-----------------|
| Work type → Method | "1", "1" (Problem Shifting) | `problem_shifting_intro_static` (full instructions + first feeling question combined) |
| Work type description | "I feel anxious about my presentation" | `problem_shifting_intro_dynamic`: "Feel the problem 'I feel anxious about my presentation'…" |
| `problem_shifting_intro_dynamic` | "fear" | `body_sensation_check`: "Feel 'fear'… what happens in yourself…" |
| `body_sensation_check` | "tight chest" | `what_needs_to_happen_step`: "Feel 'I feel anxious…'… what needs to happen…?" |
| **`what_needs_to_happen_step` (cycle 1)** | **"I need to prepare more"** | `feel_solution_state`: "What would you feel like if **I need to prepare more** had already happened?" |
| `feel_solution_state` (cycle 1) | "relieved" | `feel_good_state` |
| `feel_good_state` | "calm" | `what_happens_step` |
| `what_happens_step` | "I breathe easier" | `check_if_still_problem` |
| `check_if_still_problem` | **"yes"** | Cycles → `problem_shifting_intro_dynamic`: "Feel the problem 'I feel anxious…'…" |
| `problem_shifting_intro_dynamic` (cycle 2) | "less fear" | `body_sensation_check` |
| `body_sensation_check` (cycle 2) | "lighter" | `what_needs_to_happen_step` |
| **`what_needs_to_happen_step` (cycle 2)** | **"I need to trust myself"** | `feel_solution_state`: "What would you feel like if **I need to trust myself** had already happened?" ← must use cycle-2 answer |

**Pass criterion:** The `feel_solution_state` prompt on cycle 2 says "I need to trust
myself" — not "I need to prepare more" (cycle-1 answer).

### Existing automated tests

Run `tests/api/v5-all-flows.spec.ts` and `tests/api/v5-blockage-shifting.spec.ts` — both
must pass unchanged.

Optionally add a two-cycle case to `lib/v5/test-flows.ts` that:
1. Completes a full Problem Shifting cycle and answers `check_if_still_problem` with "yes".
2. Provides a **different** answer to `what_needs_to_happen_step` in cycle 2.
3. Asserts the `feel_solution_state` prompt contains the cycle-2 answer, not cycle-1.

### DB-level verification (post-Fix 3)

After applying Fix 3, confirm for a test session that `treatment_progress` has exactly
one row per `step_id` — no phantom duplicates from mismatched `phase_id` values.

---

## What This Does NOT Change

- V2 code is untouched.
- Therapeutic script wording is unchanged — no new questions, no reordering.
- No new database columns or migrations.
- `userResponses` is NOT cleared on cycle-back (matching v2 behaviour).
- All other modalities (Identity, Belief, Blockage, Reality, Trauma Shifting) benefit
  from Fixes 2 and 3; only Fix 1 is Problem Shifting–specific.
- No new dependencies.
