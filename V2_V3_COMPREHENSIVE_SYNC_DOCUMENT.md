# V2 to V3 Comprehensive Synchronization Document
## ⚠️ CRITICAL: Patient Safety - Every Word Matters

**Date Created**: November 8, 2025
**Purpose**: Document EVERY difference between v2 and v3 treatment modalities
**Requirement**: 100% word-for-word parity in patient-facing scripted responses
**Constraint**: NEVER modify v2 - only update v3 files

---

## 📊 EXECUTIVE SUMMARY

### Critical Issues Found: 16+ differences

**Severity Breakdown:**
- 🔴 **CRITICAL (Patient Safety)**: 8 issues
- 🟡 **MODERATE (User Experience)**: 5 issues
- 🟢 **MINOR (Implementation)**: 3+ issues

### Most Severe Issues:
1. Identity Shifting missing 6 entire treatment steps
2. Identity Shifting missing bridge phrase logic
3. Digging Deeper missing problem statement references (makes responses impersonal)
4. Digging Deeper missing scenario_check_3 and related steps
5. Problem Shifting grammatical error

---

## 🔍 DETAILED FINDINGS BY MODALITY

---

## 1. PROBLEM SHIFTING

### Status: ⚠️ 3 Differences Found

#### Difference #1.1: `feel_solution_state` - GRAMMATICAL ERROR 🔴

**Location**: Step D - "What would you feel like if..."

**V2 (Lines 2330-2335):**
```typescript
scriptedResponse: (userInput, context) => {
  const previousAnswer = context?.userResponses?.['what_needs_to_happen_step'] || 'that';
  return `What would you feel like if ${previousAnswer} had already happened?`;
},
```

**V3 (Line 78):**
```typescript
scriptedResponse: (userInput) => `What would you feel like if you already ${userInput || 'had that'}?`,
```

**Patient Impact**: 🔴 CRITICAL
- V2: "What would you feel like if [I need to talk to my boss] **had already happened**?" ✅
- V3: "What would you feel like if you already [I need to talk to my boss]?" ❌

**Fix Required**: Change V3 to use context.userResponses approach from V2

---

#### Difference #1.2: `what_needs_to_happen_step` - Wording Variation 🟡

**Location**: Step C - "What needs to happen"

**V2 (Line 2318):**
```typescript
return `Feel '${cleanProblemStatement}'... what needs to happen for this to not be a problem?`;
```

**V3 (Line 64):**
```typescript
return `Feel the problem '${problemStatement}'... what needs to happen for this to not be a problem?`;
```

**Patient Impact**: 🟡 MODERATE
- V2: "Feel 'I can't sleep'..."
- V3: "Feel the problem 'I can't sleep'..." (adds "the problem")

**Fix Required**: Remove "the problem" prefix from V3

---

#### Difference #1.3: Context Fallbacks - Implementation Detail 🟢

**V2**: Simpler fallback chain
**V3**: More comprehensive fallback checks (includes newDiggingProblem, more userResponses)

**Patient Impact**: 🟢 MINOR - Implementation detail, doesn't affect patient-facing text

**Decision Needed**: Keep V2's simpler approach or adopt V3's comprehensive approach?

---

## 2. IDENTITY SHIFTING

### Status: 🔴 CRITICAL - Missing Entire Treatment Pathway

#### Difference #2.1: Missing Future Projection Steps 🔴

**V2 Has (Lines 3097-3224):**
1. `identity_future_projection` - Put yourself in the future, feel identity
2. `identity_future_step_b` - What happens when you feel that
3. `identity_future_step_c` - What are you when not being that identity
4. `identity_future_step_d` - Feel yourself being that state
5. `identity_future_step_e` - What happens when you feel that
6. `identity_future_step_f` - Can you still feel the identity (yes/no check)

**V3**: ❌ **COMPLETELY MISSING** - These 6 steps don't exist

**Patient Impact**: 🔴 CRITICAL
- Entire treatment pathway missing
- Could cause flow failures
- Patients won't receive complete treatment

**Fix Required**: Add all 6 future projection steps to V3

---

#### Difference #2.2: Missing Bridge Phrase Logic 🔴

**V2 `identity_dissolve_step_a` (Lines 2870-2887):**
```typescript
// Determine appropriate prefix based on which check failed
const returnTo = context.metadata.returnToIdentityCheck;
const bridgeUsed = context.metadata.identityBridgePhraseUsed;
let prefix = 'Feel yourself being';

if (returnTo === 'identity_future_check' && !bridgeUsed) {
  prefix = 'Put yourself in the future and feel yourself being';
  context.metadata.identityBridgePhraseUsed = true;
} else if (returnTo === 'identity_scenario_check' && !bridgeUsed) {
  prefix = 'Imagine that scenario and feel yourself being';
  context.metadata.identityBridgePhraseUsed = true;
}

return `${prefix} '${identity}'... what does it feel like?`;
```

**V3 `identity_dissolve_step_a` (Line 95):**
```typescript
return `Feel yourself being '${identity}'... what does it feel like?`;
```

**Patient Impact**: 🔴 CRITICAL
- V2 adapts wording based on user's journey
- V3 always uses static wording
- Doctor has carefully calibrated these bridge phrases

**Fix Required**: Add complete bridge phrase logic to V3

---

#### Difference #2.3: `identity_dissolve_step_f` NextStep Routing 🔴

**V2 (Line 3010):**
```typescript
nextStep: 'identity_step_3_intro',
```

**V3 (Line 218):**
```typescript
nextStep: 'identity_future_check',
```

**Patient Impact**: 🔴 CRITICAL - Treatment flow routing difference

**Fix Required**: Verify correct routing (note: `identity_step_3_intro` not found in excerpts - needs investigation)

---

#### Difference #2.4: Integration Action Steps - Potential Split 🟡

**V2**: May combine "first action" and "when will you do this" in one question
**V3**: Splits into separate steps (`integration_action_4` and `integration_action_5`)

**Status**: Needs verification of V2's exact structure

---

## 3. BELIEF SHIFTING

### Status: ⚠️ 1 Difference Found

#### Difference #3.1: Problem Statement Fallbacks 🟡

**V2 (Lines 4427-4434):**
Checks MULTIPLE digging deeper sources:
- `restate_scenario_problem_1`
- `restate_scenario_problem_2`
- `restate_scenario_problem_3`
- `restate_anything_else_problem_1`
- `restate_anything_else_problem_2`

**V3 (Line 18):**
Simpler fallback chain - missing scenario and anything_else checks

**Patient Impact**: 🟡 MODERATE
- May use wrong problem statement in complex digging scenarios

**Fix Required**: Add all V2 fallback sources to V3

---

## 4. BLOCKAGE SHIFTING

### Status: ✅ PERFECT MATCH

All steps, wording, validation, and integration questions match exactly between v2 and v3.

**No changes required**

---

## 5. REALITY SHIFTING

### Status: ⏳ Preliminary Check - Needs Detailed Audit

#### Difference #5.1: Integration Wording - Needs Verification 🟡

**V2 `reality_integration_intro` (Line 3761):**
```
OK now we have cleared all the blockages in the way of your goal, next I will ask you some questions about how your perspective has shifted and the steps you need to take to achieve your goal. So firstly, how do you feel about your goal of '${goalStatement}' now?
```

**V3**: Needs verification if exact wording matches

**Action Required**: Complete detailed comparison

---

## 6. TRAUMA SHIFTING

### Status: ✅ Appears Well-Synced

Preliminary check shows good alignment:
- Future projection steps exist
- Identity processing present
- Integration questions match

**Action Required**: Detailed line-by-line verification recommended

---

## 7. DIGGING DEEPER PHASE

### Status: 🔴 CRITICAL - Multiple Missing Elements

#### Difference #7.1: Missing Problem Statement References 🔴

**V2 `digging_deeper_start` (Lines 4952-4955):**
```typescript
const problemStatement = context?.metadata?.originalProblemStatement || 
                         context?.metadata?.problemStatement || 
                         context?.problemStatement || 'the problem';
return `Take your mind back to '${problemStatement}'. Would you like to dig deeper in this area?`;
```

**V3 `digging_deeper_start` (Line 11):**
```typescript
scriptedResponse: "Would you like to dig deeper in this area?",
```

**Patient Impact**: 🔴 CRITICAL
- V2: Personal, references specific problem
- V3: Generic, impersonal

---

#### Difference #7.2: `future_problem_check` Missing Problem Reference 🔴

**V2 (Lines 4968-4970):**
```typescript
const originalProblem = context?.metadata?.originalProblemStatement || 
                       context?.problemStatement || 
                       context?.userResponses?.['restate_selected_problem'] || 
                       context?.userResponses?.['mind_shifting_explanation'] || 'the original problem';
return `Do you feel '${originalProblem}' will come back in the future?`;
```

**V3 (Line 23):**
```typescript
scriptedResponse: "Do you feel the problem will come back in the future?",
```

**Patient Impact**: 🔴 CRITICAL
- V2: "Do you feel 'I can't sleep' will come back..."
- V3: "Do you feel the problem will come back..."

---

#### Difference #7.3: `scenario_check_1`, `_2`, `_3` Missing Problem References 🔴

**V2 ALL scenario checks (Lines 5089-5194):**
```typescript
const originalProblem = context?.metadata?.originalProblemStatement || 
                       context?.problemStatement || 
                       context?.userResponses?.['restate_selected_problem'] || 
                       context?.userResponses?.['mind_shifting_explanation'] || 'the original problem';
return `Is there any scenario in which '${originalProblem}' would still be a problem for you?`;
```

**V3 scenario checks (Lines 131, 191):**
```typescript
scriptedResponse: "Is there any scenario in which this would still be a problem for you?",
```

**Patient Impact**: 🔴 CRITICAL
- V2: References specific original problem throughout
- V3: Generic "this" or "the problem"

---

#### Difference #7.4: Missing `scenario_check_3` and Related Steps 🔴

**V2 Has (Lines 5190-5233):**
- `scenario_check_3`
- `restate_scenario_problem_3`
- `clear_scenario_problem_3`

**V3**: ❌ **MISSING** - Only has scenario_check_1 and scenario_check_2

**Patient Impact**: 🔴 CRITICAL
- Incomplete digging deeper flow
- Patients can only dig through 2 scenarios instead of 3

**Fix Required**: Add scenario_check_3 and related steps to V3

---

#### Difference #7.5: `clear_scenario_problem_1` Wording Difference 🟡

**V2 (Line 5130):**
```typescript
return "We need to clear this problem. Which method would you like to use?";
```

**V3 (Line 83):**
```typescript
return `We need to clear this problem. Which method would you like to use?\n\n1. Problem Shifting\n2. Identity Shifting\n3. Belief Shifting\n4. Blockage Shifting`;
```

**Patient Impact**: 🟡 MODERATE
- V3 adds numbered list
- May be helpful or may be different from doctor's intent

**Decision Needed**: Which version is preferred?

---

## 8. INTEGRATION PHASE (General)

### Status: ⏳ Needs Detailed Audit

Preliminary observations:
- General integration steps exist in both
- Modality-specific integration steps exist in V3
- Need to verify exact wording matches

**Action Required**: Complete comparison

---

## 9. OTHER PHASES

### Status: ⏳ Not Yet Audited

- Introduction Phase
- Work Type Selection
- Method Selection  
- Discovery Phase

**Action Required**: Complete audit of remaining phases

---

## 📋 COMPLETE PRIORITY FIX LIST

### 🔴 CRITICAL PRIORITY (Patient Safety)

**Must fix before any v3 deployment:**

1. **Identity Shifting**: ADD 6 missing future projection steps
   - Files: `lib/v3/treatment-modalities/identity-shifting.ts`
   - Lines to add: ~100-150 lines of code

2. **Identity Shifting**: ADD bridge phrase logic to `identity_dissolve_step_a`
   - Files: `lib/v3/treatment-modalities/identity-shifting.ts`
   - Lines: ~82-95

3. **Identity Shifting**: VERIFY and FIX `identity_dissolve_step_f` routing
   - Need to check if `identity_step_3_intro` exists or if routing should be different

4. **Problem Shifting**: FIX grammatical error in `feel_solution_state`
   - Files: `lib/v3/treatment-modalities/problem-shifting.ts`
   - Line: 77-87

5. **Digging Deeper**: ADD problem statement references to `digging_deeper_start`
   - Files: `lib/v3/treatment-modalities/digging-deeper.ts`
   - Line: 10-19

6. **Digging Deeper**: ADD problem statement reference to `future_problem_check`
   - Files: `lib/v3/treatment-modalities/digging-deeper.ts`
   - Line: 22-31

7. **Digging Deeper**: ADD problem statement references to ALL scenario checks
   - Files: `lib/v3/treatment-modalities/digging-deeper.ts`
   - Lines: 130-323

8. **Digging Deeper**: ADD missing `scenario_check_3` and related steps
   - Files: `lib/v3/treatment-modalities/digging-deeper.ts`
   - New steps to add: 3 steps (~50-70 lines)

### 🟡 MODERATE PRIORITY (User Experience)

**Should fix for optimal patient experience:**

9. **Problem Shifting**: REMOVE "the problem" prefix in `what_needs_to_happen_step`
   - Files: `lib/v3/treatment-modalities/problem-shifting.ts`
   - Line: 64

10. **Belief Shifting**: ADD extended problem statement fallbacks
    - Files: `lib/v3/treatment-modalities/belief-shifting.ts`
    - Line: 18

11. **Digging Deeper**: VERIFY method selection list (numbered vs unnumbered)
    - Files: `lib/v3/treatment-modalities/digging-deeper.ts`
    - Decision needed on preferred format

12. **Reality Shifting**: VERIFY integration wording matches exactly
    - Files: `lib/v3/treatment-modalities/reality-shifting.ts`
    - Needs detailed comparison

13. **Identity Integration**: VERIFY action step split vs combined
    - Files: `lib/v3/treatment-modalities/identity-shifting.ts`
    - Check if V2 combines two questions or splits them

### 🟢 MINOR PRIORITY (Implementation Details)

**Nice to have for consistency:**

14. **Problem Shifting**: DECIDE on fallback chain approach
    - Keep V2 simple or adopt V3 comprehensive?
    - Files: Both v2 and v3 problem-shifting files

---

## 📝 FILES REQUIRING UPDATES

### Confirmed Changes Needed:

1. `/home/sage/Code/MindShifting/lib/v3/treatment-modalities/problem-shifting.ts`
   - 2 critical fixes
   - 1 moderate fix

2. `/home/sage/Code/MindShifting/lib/v3/treatment-modalities/identity-shifting.ts`
   - 3 critical fixes (including adding 6 new steps)
   - 1 moderate verification

3. `/home/sage/Code/MindShifting/lib/v3/treatment-modalities/belief-shifting.ts`
   - 1 moderate fix

4. `/home/sage/Code/MindShifting/lib/v3/treatment-modalities/digging-deeper.ts`
   - 5 critical fixes (including adding 3 new steps)
   - 1 moderate decision

5. `/home/sage/Code/MindShifting/lib/v3/treatment-modalities/reality-shifting.ts`
   - Pending detailed audit

### No Changes Needed:

- `/home/sage/Code/MindShifting/lib/v3/treatment-modalities/blockage-shifting.ts` ✅
- `/home/sage/Code/MindShifting/lib/v3/treatment-modalities/trauma-shifting.ts` ✅ (preliminary)

---

## 🎯 RECOMMENDED IMPLEMENTATION PLAN

### Phase 1: Complete Remaining Audits (CURRENT)
- ⏳ Reality Shifting (detailed)
- ⏳ Trauma Shifting (detailed verification)
- ⏳ Integration Phase (general)
- ⏳ Introduction, Work Type Selection, Method Selection, Discovery

**Estimated Time**: 2-3 hours for thorough review

### Phase 2: Document All Findings
- ✅ Create comprehensive change list (this document)
- ⏳ Get approval on ambiguous decisions
- ⏳ Create implementation checklist

### Phase 3: Implementation
- Fix all CRITICAL issues (8 issues)
- Fix all MODERATE issues (5 issues)
- Test each modality individually
- Full regression testing

**Estimated Time**: 4-6 hours for implementation + testing

### Phase 4: Validation
- Side-by-side comparison testing
- Verify no V2 impact
- Document all changes made
- Final sign-off

---

## ⚠️ KEY CONSTRAINTS

1. **NEVER modify v2** - V2 is source of truth and production system
2. **Only modify v3 files** - Changes isolated to v3 directory
3. **Every word matters** - Patient safety depends on exact wording
4. **Test thoroughly** - Each modality must be verified
5. **No assumptions** - When in doubt, document and ask

---

## 📊 AUDIT STATUS TRACKING

### Completed Deep Dives:
- ✅ Problem Shifting (3 differences documented)
- ✅ Identity Shifting (4 critical differences documented)
- ✅ Belief Shifting (1 difference documented)
- ✅ Blockage Shifting (PERFECT MATCH ✅)
- ✅ Digging Deeper (5 differences documented)

### Preliminary Checks:
- ⏸️ Reality Shifting (1 potential difference flagged)
- ⏸️ Trauma Shifting (appears synced, needs verification)

### Not Yet Audited:
- ❌ Integration Phase (general steps)
- ❌ Introduction Phase
- ❌ Work Type Selection Phase
- ❌ Method Selection Phase
- ❌ Discovery Phase

---

## 🔄 NEXT IMMEDIATE STEPS

1. **Complete Reality Shifting detailed audit**
2. **Complete Trauma Shifting verification**
3. **Complete remaining phase audits**
4. **Get decisions on ambiguous items**:
   - Digging deeper method list format
   - Problem shifting fallback chain approach
   - Identity step routing verification
5. **Create final implementation checklist**
6. **Begin implementation of CRITICAL fixes**

---

## 📞 QUESTIONS FOR APPROVAL

1. **Digging Deeper Method Selection**: Numbered list (V3) or plain text (V2)?
2. **Problem Shifting Fallbacks**: Simple (V2) or comprehensive (V3)?
3. **Identity Routing**: Does `identity_step_3_intro` exist? What's the correct flow?
4. **Implementation Priority**: Fix ALL issues before any v3 use, or phased rollout?

---

**Document Status**: IN PROGRESS - Continue with remaining audits

**Last Updated**: November 8, 2025

**V2 Files Status**: ✅ UNTOUCHED - No modifications made or planned
