# PRD: V5 Trauma Shifting — Cycle Routing, Bridge Phrase, and Identity Bugs

## Problem

Three bugs in the v5 Trauma Shifting flow cause incorrect routing, repeated bridge phrases, and wrong identity display when cycling through dissolve loops and multiple identities. These issues deviate from the v2 gold-standard behavior and from the treatment protocol.

---

### Bug 1 — Step E returns to Step 4F instead of directly to the failed check

**What the user sees:**
After the scenario check ("Is there any scenario in which you might still feel yourself being IDENTITY 1?") is answered "yes", the app runs the dissolve sequence (Steps 4A–4E). When dissolve completes, the app shows `trauma_identity_check` (Step 4F: "Can you still feel yourself being IDENTITY 1?") before returning to the scenario check. This extra Step 4F question should not appear — the app should go directly back to the scenario check.

Additionally, when the user answers "no" at this extra Step 4F, the app skips `trauma_future_identity_check` entirely and jumps straight to `trauma_future_scenario_check`.

**V2 gold-standard behavior:**
In v2, `handleTraumaDissolveStepE` (line 6683–6688) returns directly to whichever check set the `returnToTraumaCheck` flag:

```typescript
// v2/treatment-state-machine.ts:6683-6688
const returnToTraumaCheck = context.metadata.returnToTraumaCheck;
if (returnToTraumaCheck) {
  context.metadata.returnToTraumaCheck = undefined;
  return returnToTraumaCheck;  // Goes directly to trauma_future_scenario_check
}
return 'trauma_identity_check';  // Only on first-time-through
```

**V5 buggy behavior:**
V5 added a special case for the scenario path that routes through Step 4F instead of returning directly (line 1694–1697), plus a `traumaResumeStep5AfterIdentityNo` mechanism to skip `trauma_future_identity_check` after the extra Step 4F:

```typescript
// v5/treatment-state-machine.ts:1694-1697 (BUG)
if (returnToTraumaCheck === 'trauma_future_scenario_check') {
  context.metadata.returnToTraumaCheck = undefined;
  return 'trauma_identity_check';  // Should return 'trauma_future_scenario_check'
}
```

**Root cause:**
- `handleTraumaDissolveStepE` (line 1694) does not return directly to `returnToTraumaCheck` for the scenario path — it routes through `trauma_identity_check` instead.
- The `traumaResumeStep5AfterIdentityNo` flag (set at line 1678, consumed at line 1640) causes `handleTraumaIdentityCheck` to skip `trauma_future_identity_check` when the user says "no" at the extra Step 4F.

**Files:**
- `lib/v5/treatment-state-machine.ts:1692–1705` — `handleTraumaDissolveStepE()`
- `lib/v5/treatment-state-machine.ts:1638–1644` — `handleTraumaIdentityCheck()` "no" branch
- `lib/v5/treatment-state-machine.ts:1676–1678` — `handleTraumaFutureScenarioCheck()` flag setting

**Fix:**
Change `handleTraumaDissolveStepE` to return directly to `returnToTraumaCheck` (matching v2). Remove the special-case for `'trauma_future_scenario_check'` at line 1694. The `traumaResumeStep5AfterIdentityNo` mechanism becomes unnecessary for this path and can be removed.

```typescript
// FIXED: Match v2 — return directly to the check that triggered the cycle
private handleTraumaDissolveStepE(context: TreatmentContext): string {
  const returnToTraumaCheck = context.metadata.returnToTraumaCheck as string | undefined;
  if (returnToTraumaCheck) {
    context.metadata.returnToTraumaCheck = undefined;
    return returnToTraumaCheck;
  }
  return 'trauma_identity_check';
}
```

---

### Bug 2 — "Imagine that scenario and..." bridge phrase repeats on second+ cycles

**What the user sees:**
When returning from the scenario check to Step 4A for the second time, the app still uses "Imagine that scenario and feel yourself being IDENTITY..." instead of the plain "Feel yourself being IDENTITY...". The bridge phrase should only appear the first time the user returns from a given check question.

**V2 gold-standard behavior:**
V2 Identity Shifting tracks bridge usage with an `identityBridgePhraseUsed` flag (line 2872–2884):

```typescript
// v2/treatment-state-machine.ts:2872-2884 (Identity Shifting — correct)
const bridgeUsed = context.metadata.identityBridgePhraseUsed;
if (returnTo === 'identity_future_check' && !bridgeUsed) {
  prefix = 'Put yourself in the future and feel yourself being';
  context.metadata.identityBridgePhraseUsed = true;
} else if (returnTo === 'identity_scenario_check' && !bridgeUsed) {
  prefix = 'Imagine that scenario and feel yourself being';
  context.metadata.identityBridgePhraseUsed = true;
}
```

V2 Trauma Shifting does NOT have this tracking — the bug exists in v2 Trauma Shifting too (line 4030–4042). However, v5 Identity Shifting already has the fix ported (line 79–88 in `identity-shifting.ts`), and Belief Shifting also has it (`usedBridgePhraseFor_belief_check_*`). Trauma Shifting is the only modality in v5 that's missing bridge tracking.

**V5 buggy behavior:**
`trauma-shifting.ts:91–96` always uses the bridge phrase when `returnToTraumaCheck === 'trauma_future_scenario_check'`, with no tracking:

```typescript
// v5/treatment-modalities/trauma-shifting.ts:91-96 (BUG)
const returnTo = context.metadata?.returnToTraumaCheck as string | undefined;
const prefix =
  returnTo === 'trauma_future_scenario_check'
    ? 'Imagine that scenario and feel yourself being'
    : 'Feel yourself being';
```

**Root cause:**
No `traumaBridgePhraseUsed` flag to prevent the bridge from repeating. Each time the scenario check triggers a new dissolve cycle, `returnToTraumaCheck` is re-set (line 1676), and Step 4A uses the bridge again.

**Files:**
- `lib/v5/treatment-modalities/trauma-shifting.ts:91–96` — bridge phrase selection in `trauma_dissolve_step_a`
- `lib/v5/treatment-state-machine.ts:1676` — flag re-set on each scenario cycle

**Fix:**
Port the `identityBridgePhraseUsed` pattern from Identity Shifting:

```typescript
// FIXED: trauma-shifting.ts, trauma_dissolve_step_a scriptedResponse
const returnTo = context.metadata?.returnToTraumaCheck as string | undefined;
const bridgeUsed = context.metadata?.traumaBridgePhraseUsed;
let prefix = 'Feel yourself being';

if (returnTo === 'trauma_future_scenario_check' && !bridgeUsed) {
  prefix = 'Imagine that scenario and feel yourself being';
  context.metadata.traumaBridgePhraseUsed = true;
}
```

Reset `traumaBridgePhraseUsed = false` when entering a new cycle from a check question (in `handleTraumaFutureScenarioCheck` "yes" branch, matching the pattern in `handleIdentityFutureCheck`/`handleIdentityScenarioCheck`).

---

### Bug 3 — Step 4 and Step 5 display wrong identity (IDENTITY 2 instead of IDENTITY 3)

**What the user sees:**
On the third identity (after answering "yes" twice at Step 6), `trauma_identity_check` correctly shows "Can you still feel yourself being IDENTITY 3?" but `trauma_future_identity_check` shows "Do you think you can ever feel yourself being **IDENTITY 2** in the future?" — the previous identity.

**V2 gold-standard behavior:**
V2 has no response caching. Every `scriptedResponse` function runs fresh on each request, reading the current identity from `context.metadata.originalTraumaIdentity` or `context.metadata.currentTraumaIdentity`. This always produces the correct identity text.

**V5 buggy behavior:**
V5 introduced a response caching system (`getScriptedResponse` → `generateContextHash` → cache lookup). The cache for trauma steps is stale because:

1. **Missing from `alwaysSkipCacheSteps`:** `trauma_future_identity_check`, `trauma_future_scenario_check`, `trauma_identity_check`, and `trauma_dissolve_step_a` through `trauma_dissolve_step_e` are NOT in the skip list. Their identity shifting equivalents (`identity_future_check`, `identity_scenario_check`, `identity_dissolve_step_a` through `identity_dissolve_step_f`) ARE in the skip list (lines 391–398).

2. **Missing from `generateContextHash`:** The hash includes `currentIdentity` (for identity shifting, line 495) but does NOT include `currentTraumaIdentity` or `originalTraumaIdentity`. When the user answers "no" at `trauma_identity_check` for Identity 2 vs Identity 3, the `userInput` ('no') and all other hashed fields are identical — producing the same cache key. The cached response from Identity 2 is returned for Identity 3.

3. **Side-effect suppression:** When a cached response is returned, the `scriptedResponse` function body never runs. For `trauma_dissolve_step_a`, this means the identity sync code (lines 81–86) that sets `currentTraumaIdentity` from `userResponses['trauma_identity_step_dynamic']` is skipped. This can cause downstream steps to also use the wrong identity.

**Root cause:**
The v5 `alwaysSkipCacheSteps` list and `generateContextHash` were updated for Identity Shifting but not for the equivalent Trauma Shifting steps.

**Files:**
- `lib/v5/base-state-machine.ts:372–418` — `alwaysSkipCacheSteps` list (missing trauma steps)
- `lib/v5/base-state-machine.ts:477–500` — `generateContextHash` (missing `currentTraumaIdentity`)
- `lib/v5/base-state-machine.ts:389–398` — comments reference identity shifting but no trauma equivalent

**Fix (two-part):**

**Part A — Add trauma steps to `alwaysSkipCacheSteps`:**
```typescript
// After the identity shifting block (lines 391-398), add:
'trauma_identity_check',
'trauma_future_identity_check',
'trauma_future_scenario_check',
'trauma_dissolve_step_a',
'trauma_dissolve_step_b',
'trauma_dissolve_step_c',
'trauma_dissolve_step_d',
'trauma_dissolve_step_e',
```

**Part B — Add trauma identity to `generateContextHash`:**
```typescript
// In generateContextHash relevantData (after line 495):
currentTraumaIdentity: context.metadata.currentTraumaIdentity,
originalTraumaIdentity: context.metadata.originalTraumaIdentity,
```

---

## V2 vs V5 Comparison Summary

| Aspect | V2 Behavior | V5 Current Behavior | V5 Target |
|--------|------------|-------------------|-----------|
| Step E → scenario check return | Direct return to `returnToTraumaCheck` | Routes through `trauma_identity_check` (Step 4F) first | Match v2: direct return |
| `traumaResumeStep5AfterIdentityNo` flag | Does not exist | Skips `trauma_future_identity_check` after extra Step 4F | Remove — unnecessary when Step E returns directly |
| Bridge phrase tracking (trauma) | Not tracked (bug in v2 too) | Not tracked | Add `traumaBridgePhraseUsed` (port from Identity Shifting) |
| Bridge phrase tracking (identity) | `identityBridgePhraseUsed` flag | `identityBridgePhraseUsed` flag | Already correct |
| Response caching | No caching | Caching enabled, trauma steps missing from skip list | Add trauma steps to skip list + hash |
| `generateContextHash` identity fields | N/A (no caching) | Has `currentIdentity` but not `currentTraumaIdentity` | Add `currentTraumaIdentity` + `originalTraumaIdentity` |

---

## Implementation Plan

### Step 1: Fix Step E routing (Bug 1)

**File:** `lib/v5/treatment-state-machine.ts`

1. In `handleTraumaDissolveStepE()` (line 1692), remove the special case for `'trauma_future_scenario_check'` and collapse to a single `if (returnToTraumaCheck)` branch that returns `returnToTraumaCheck` directly — matching v2.
2. Remove `traumaResumeStep5AfterIdentityNo` from `handleTraumaFutureScenarioCheck()` "yes" branch (line 1678).
3. Remove the `traumaResumeStep5AfterIdentityNo` check in `handleTraumaIdentityCheck()` "no" branch (lines 1639–1644).
4. Clean up any remaining `delete context.metadata.traumaResumeStep5AfterIdentityNo` references (lines 1641, 1682, 1745).

### Step 2: Add bridge phrase tracking (Bug 2)

**File:** `lib/v5/treatment-modalities/trauma-shifting.ts`

1. In `trauma_dissolve_step_a` scriptedResponse (line 91), add `traumaBridgePhraseUsed` check matching the Identity Shifting pattern in `identity-shifting.ts:77–89`.

**File:** `lib/v5/treatment-state-machine.ts`

2. In `handleTraumaFutureScenarioCheck()` "yes" branch (after line 1676), add `context.metadata.traumaBridgePhraseUsed = false` to reset the flag when starting a new cycle from the scenario check.
3. In `handleTraumaIdentityCheck()` "yes" branch, add `context.metadata.traumaBridgePhraseUsed = true` to prevent the bridge on inner-loop cycles (matching `identityBridgePhraseUsed = true` at line 1256).

### Step 3: Fix response caching for trauma steps (Bug 3)

**File:** `lib/v5/base-state-machine.ts`

1. Add all trauma shifting steps that embed identity to `alwaysSkipCacheSteps` (after line 398), with a comment referencing v2 parity — matching the identity shifting block at lines 389–398.
2. Add `currentTraumaIdentity` and `originalTraumaIdentity` to the `relevantData` object in `generateContextHash()` (after line 495) as defense-in-depth.

### Step 4: Verify no leftover references

1. Search for all uses of `traumaResumeStep5AfterIdentityNo` and confirm they're all removed.
2. Verify that `returnToTraumaCheck` is set/cleared consistently:
   - Set in `handleTraumaIdentityCheck` "yes" → `'trauma_identity_check'`
   - Set in `handleTraumaFutureScenarioCheck` "yes" → `'trauma_future_scenario_check'`
   - Cleared in `handleTraumaDissolveStepE` after use
   - Cleared in `handleTraumaExperienceCheck` "yes"

---

## What This Does NOT Change

- **V2 code is untouched.** All changes are in `lib/v5/` only.
- **No changes to other modalities.** Identity Shifting, Belief Shifting, Problem Shifting, Blockage Shifting, and Reality Shifting are unaffected.
- **No changes to the therapeutic protocol.** Step sequence and question wording remain identical. Only routing between steps and caching behavior are fixed.
- **No database changes.** All state is in existing `context.metadata` fields.
- **No new dependencies.**

---

## Testing

### Manual Testing Scenarios

**Bug 1 — Step E direct return:**

| Step | Action | Expected |
|------|--------|----------|
| Go through trauma dissolve (Steps 4A–4E) | Complete all five dissolve questions | Arrives at `trauma_identity_check` |
| Answer "no" at `trauma_identity_check` | | Shows `trauma_future_identity_check` ("Do you think you can ever feel yourself being X in the future?") |
| Answer "no" at `trauma_future_identity_check` | | Shows `trauma_future_scenario_check` ("Is there any scenario...?") |
| Answer "yes" at `trauma_future_scenario_check` | | Goes to `trauma_dissolve_step_a` (Step 4A) with bridge phrase |
| Complete dissolve (Steps 4A–4E) | | Returns DIRECTLY to `trauma_future_scenario_check` — NOT `trauma_identity_check` |
| Answer "no" at `trauma_future_scenario_check` | | Proceeds to `trauma_experience_check` |

**Bug 2 — Bridge phrase one-time use:**

| Step | Action | Expected |
|------|--------|----------|
| Answer "yes" at `trauma_future_scenario_check` | First time returning from scenario | Step 4A shows "**Imagine that scenario and** feel yourself being X..." |
| Complete dissolve, return to `trauma_future_scenario_check` | | Shows scenario check again |
| Answer "yes" at `trauma_future_scenario_check` | Second time returning from scenario | Step 4A shows "**Feel yourself being** X..." (NO bridge phrase) |

**Bug 3 — Correct identity across cycles:**

| Step | Action | Expected |
|------|--------|----------|
| Complete full cycle with IDENTITY 1 | Dissolve → checks → experience check "yes" | Returns to Step 3 for new identity |
| Provide IDENTITY 2 at Step 3 | | Step 4A shows "Feel yourself being IDENTITY 2..." |
| Complete full cycle with IDENTITY 2 | Dissolve → checks → experience check "yes" | Returns to Step 3 for new identity |
| Provide IDENTITY 3 at Step 3 | | Step 4A shows "Feel yourself being IDENTITY 3..." |
| Complete dissolve, answer "no" at `trauma_identity_check` | | `trauma_future_identity_check` shows "...feel yourself being **IDENTITY 3**..." (NOT IDENTITY 2) |
| All subsequent checks | | All show IDENTITY 3 consistently |
