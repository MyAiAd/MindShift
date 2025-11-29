# V4 Hardcoded Intro Steps Audit
Date: 2025-01-29
Issue: Many functions return hardcoded `_intro_static` steps instead of using `getIntroStepForMethod()`

## Summary
Found 45 return statements with hardcoded `_intro_static` steps across v4/treatment-state-machine.ts
These should respect `skipIntroInstructions` flag for proper digging deeper behavior.

## ✅ ALREADY FIXED (4 instances)
Lines 374-396: Signal handlers in `handleInternalRoutingSignals()`
- PROBLEM_SHIFTING_SELECTED
- IDENTITY_SHIFTING_SELECTED
- BELIEF_SHIFTING_SELECTED
- BLOCKAGE_SHIFTING_SELECTED
✅ Now use `getIntroStepForMethod(method, context)`

## ⚠️ NEEDS FIXING (Categorized by Priority)

### HIGH PRIORITY - Cycling Back (Affects all users)

**Line 920: handleCheckIfStillProblem() - Problem Shifting Cycle**
```typescript
if (lastResponse.includes('yes') || lastResponse.includes('still')) {
  context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
  context.metadata.skipIntroInstructions = true; // ✓ Sets flag
  context.metadata.skipLinguisticProcessing = true;
  return 'problem_shifting_intro_static'; // ❌ But returns _static anyway!
}
```
**Fix:** Should return result of `getIntroStepForMethod('problem_shifting', context)`
**Impact:** Every time problem persists and cycles back, shows full intro

---

**Line 998: handleBlockageStepE() - Blockage Shifting Cycle (after step E)**
```typescript
if (noProblemIndicators.some(...) || isUnknownResponse) {
  context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
  return 'blockage_shifting_intro_static'; // ❌ Always _static
}
```
**Fix:** Should check if cycleCount > 0 and use `getIntroStepForMethod('blockage_shifting', context)`
**Impact:** Every cycle back in blockage shifting shows full intro

---

**Line 1051: handleBlockageCheckIfStillProblem() - Blockage Shifting Cycle (check step)**
```typescript
} else {
  // Still a problem - cycle back to step A
  context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
  return 'blockage_shifting_intro_static'; // ❌ Always _static
}
```
**Fix:** Should set skipIntroInstructions and use `getIntroStepForMethod('blockage_shifting', context)`
**Impact:** Every cycle back shows full intro

---

### HIGH PRIORITY - Digging Deeper Method Selection

**Lines 1599-1620: handleModalitySwitch() - When user selects method during digging**
All 4 method selections + default return hardcoded _static:
- Line 1599: problem_shifting_intro_static
- Line 1604: identity_shifting_intro_static
- Line 1609: belief_shifting_intro_static
- Line 1614: blockage_shifting_intro_static
- Line 1620: problem_shifting_intro_static (fallback)

```typescript
if (diggingSelectedMethod === 'problem_shifting') {
  context.currentPhase = 'problem_shifting';
  return 'problem_shifting_intro_static'; // ❌ Always _static
}
```
**Fix:** All should use `getIntroStepForMethod(method, context)`
**Impact:** When switching modalities during digging, shows full intro every time
**Note:** This is IN digging deeper context, should DEFINITELY skip intro

---

**Lines 1655-1678: handleClearScenarioProblem1() - Scenario 1 method selection**
All 4 method selections + fallback return hardcoded _static:
- Line 1655: problem_shifting_intro_static
- Line 1661: identity_shifting_intro_static
- Line 1667: belief_shifting_intro_static
- Line 1673: blockage_shifting_intro_static
- Line 1678: problem_shifting_intro_static (fallback)

**Fix:** All should use `getIntroStepForMethod(method, context)`
**Impact:** Scenario check 1 always shows full intro
**Context:** This is during digging deeper (scenario checks), should skip intro

---

**Lines 1702-1725: handleClearScenarioProblem2() - Scenario 2 method selection**
Same pattern as above - all hardcoded _static

**Fix:** All should use `getIntroStepForMethod(method, context)`
**Impact:** Scenario check 2 always shows full intro

---

**Lines 1749-1772: handleClearScenarioProblem3() - Scenario 3 method selection**
Same pattern as above - all hardcoded _static

**Fix:** All should use `getIntroStepForMethod(method, context)`
**Impact:** Scenario check 3 always shows full intro

---

**Lines 1826-1850: handleClearAnythingElseProblem1() - Anything else 1 method selection**
Same pattern as above - all hardcoded _static

**Fix:** All should use `getIntroStepForMethod(method, context)`
**Impact:** "Anything else" check 1 always shows full intro

---

**Lines 1891-1915: handleClearAnythingElseProblem2() - Anything else 2 method selection**
Same pattern as above - all hardcoded _static

**Fix:** All should use `getIntroStepForMethod(method, context)`
**Impact:** "Anything else" check 2 always shows full intro

---

### MEDIUM PRIORITY - Normal Flow (First time - OK to show intro, but should still use helper for consistency)

**Lines 767, 773, 779, 785: handleChooseMethod() - Normal method selection**
```typescript
return hasExistingProblem ? 'problem_shifting_intro_static' : 'work_type_description';
```
**Context:** When user first selects a method from choose_method step
**Current:** Hardcoded _static if problem exists
**Fix:** Should use `getIntroStepForMethod(method, context)` for consistency
**Impact:** Low - these are first-time selections, should show full intro anyway
**Benefit:** Consistency and future-proofing

---

**Line 1059: handleIdentityShiftingIntro() - Identity intro routing**
```typescript
if (context.metadata.identityResponse && context.metadata.identityResponse.type === 'IDENTITY') {
  return 'identity_dissolve_step_a';
} else {
  return 'identity_shifting_intro_static'; // ❌ Always _static
}
```
**Fix:** Should use `getIntroStepForMethod('identity_shifting', context)`
**Impact:** Medium - depends on context if this is cycling or first time

---

**Line 1164: handleConfirmIdentityProblem() - After problem confirmation**
```typescript
if (lastResponse.includes('yes')) {
  context.currentPhase = 'identity_shifting';
  return 'identity_shifting_intro_static'; // ❌ Always _static
}
```
**Fix:** Should use `getIntroStepForMethod('identity_shifting', context)`
**Impact:** Medium - after user confirms identity problem

---

**Line 1287: handleConfirmBeliefProblem() - After problem confirmation**
```typescript
if (lastResponse.includes('yes')) {
  context.currentPhase = 'belief_shifting';
  return 'belief_shifting_intro_static'; // ❌ Always _static
}
```
**Fix:** Should use `getIntroStepForMethod('belief_shifting', context)`
**Impact:** Medium - after user confirms belief problem

---

### LOW PRIORITY - Reality Shifting (No _static/_dynamic split)

Lines with `reality_shifting_intro_static`:
- Line 111, 468, 613, 875 - various reality shifting routing

**Context:** Reality shifting doesn't have _static/_dynamic split
**Fix:** Not urgent, but should verify behavior
**Impact:** Low - reality shifting handles goals differently

---

## IMPLEMENTATION PLAN

### Phase 1: HIGH PRIORITY - Fix Cycling & Digging Deeper (8 functions)
1. handleCheckIfStillProblem() - Line 920
2. handleBlockageStepE() - Line 998
3. handleBlockageCheckIfStillProblem() - Line 1051
4. handleModalitySwitch() - Lines 1599-1620
5. handleClearScenarioProblem1() - Lines 1655-1678
6. handleClearScenarioProblem2() - Lines 1702-1725
7. handleClearScenarioProblem3() - Lines 1749-1772
8. handleClearAnythingElseProblem1() - Lines 1826-1850
9. handleClearAnythingElseProblem2() - Lines 1891-1915

### Phase 2: MEDIUM PRIORITY - First-time flows (4 functions)
1. handleChooseMethod() - Lines 767, 773, 779, 785
2. handleIdentityShiftingIntro() - Line 1059
3. handleConfirmIdentityProblem() - Line 1164
4. handleConfirmBeliefProblem() - Line 1287

### Phase 3: LOW PRIORITY - Reality Shifting review
- Review all reality shifting intro routing

## TESTING TARGETS

After fixes, test:
1. Problem Shifting cycle back (2nd, 3rd time through)
2. Blockage Shifting cycle back (2nd, 3rd time through)
3. Scenario check 1/2/3 - all should skip intro
4. "Anything else" check 1/2 - all should skip intro
5. Modality switching during digging deeper
6. Normal first-time flow (should still show intro)

## EXPECTED BEHAVIOR AFTER FIXES

**First Time Through Modality:**
- Show full intro: "Please close your eyes and keep them closed... Feel the problem 'X'... what does it feel like?"
- Uses auto-advance chaining of _static → _dynamic

**Cycling Back / Digging Deeper:**
- Skip intro, just ask question: "Feel the problem 'X'... what does it feel like?"
- Goes directly to _dynamic step
- No split message, no AI truncation

