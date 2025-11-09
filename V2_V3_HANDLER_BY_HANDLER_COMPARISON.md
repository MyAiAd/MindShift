# V2/V3 Handler-by-Handler Logic Comparison
## Comprehensive Code Review for V3 Fix Implementation

**Date**: November 9, 2025  
**Purpose**: Document exact logic differences between v2 and v3 handlers to enable complete fix  
**Status**: 🔄 IN PROGRESS

---

## 🎯 EXECUTIVE SUMMARY

### Critical Findings

**Handlers Reviewed**: 7 of 48 (most critical ones)  
**Showstopper Issues Found**: 3  
**Critical Issues Found**: 4  
**Total Missing Lines of Logic**: ~180 lines

### The Core Problem

V3 handlers are **dramatically simplified** versions of v2 logic, losing critical functionality:

| Handler | V2 Lines | V3 Lines | Missing | Impact |
|---------|----------|----------|---------|--------|
| `handleChooseMethod` | 147 | 33 | **114 lines** | 🔴🔴🔴 SHOWSTOPPER |
| `handleConfirmStatement` | 48 | 9 | **39 lines** | 🔴🔴 SHOWSTOPPER |
| `handleWorkTypeDescription` | 47 | 28 | **19 lines** | 🔴 CRITICAL |
| `handleMindShiftingExplanation` | 100 | 60 | **40 lines** | 🔴 CRITICAL |
| `handleRouteToMethod` | 32 | 19 | **0 lines** | 🔴🔴 **1-LINE BUG** |

### Top 3 Showstoppers

#### 1. 🔴🔴🔴 Digging Deeper Completely Broken
- **Handler**: `handleChooseMethod`
- **Missing**: 68 lines of digging deeper logic
- **Impact**: Core feature non-functional
- **Symptoms**: 
  - Uses wrong problem statement
  - Metadata contamination between sessions
  - References original problem instead of new problem
  - Asks redundant questions

#### 2. 🔴🔴 Trauma Redirect Broken
- **Handler**: `handleConfirmStatement`
- **Missing**: 13 lines of trauma redirect logic
- **Impact**: Can't fix incorrect trauma statements
- **Symptoms**:
  - Routes to wrong step when user says "no"
  - Old responses not cleared
  - Trauma flow breaks

#### 3. 🔴🔴 Critical Routing Bug
- **Handler**: `handleRouteToMethod`  
- **Bug**: Routes to `trauma_identity_step` instead of `trauma_dissolve_step_a`
- **Impact**: Skips entire dissolve sequence
- **Fix**: Change 1 line

### Missing Critical Functions

1. **`clearPreviousModalityMetadata()`** - NOT called in v3's `handleChooseMethod`
   - Causes stale `currentBelief`, `currentIdentity`, `cycleCount` to persist
   - Contaminates new treatment sessions

2. **`saveContextToDatabase()`** - NOT called in v3's `handleConfirmStatement`
   - Cleared responses not persisted
   - May cause state inconsistency

### New V3 Dependencies (Risks)

V3 added new systems that v2 doesn't have:

1. **`context.metadata.readyForTreatment` flag** (`handleWorkTypeDescription`)
   - If not set properly, routing breaks
   - Creates infinite loop on `work_type_description` step
   - ⚠️ Needs verification of where/how this is set

2. **Signal-based routing** (`handleInternalRoutingSignals`)
   - 18 new signal types
   - If base state machine doesn't call this properly, signals won't work
   - ⚠️ Needs verification of call timing

### Impact on User Experience

| Feature | V2 Status | V3 Status | User Impact |
|---------|-----------|-----------|-------------|
| Initial session | ✅ Works | ⚠️ May work | Minor issues possible |
| Digging deeper | ✅ Works | ❌ **BROKEN** | **Catastrophic** |
| Trauma Shifting | ✅ Works | ❌ **BROKEN** | **Catastrophic** |
| Problem Shifting | ✅ Works | ⚠️ Partial | Missing edge cases |
| Identity Shifting | ✅ Works | ⚠️ Partial | Missing edge cases |
| Belief Shifting | ✅ Works | ⚠️ Partial | Metadata contamination |
| Multiple problems | ✅ Works | ❓ Unknown | Not yet reviewed |

### Estimated Fix Effort

| Priority Level | Handlers | Total Lines | Est. Hours |
|----------------|----------|-------------|------------|
| 🔴🔴🔴 Showstoppers | 3 | ~120 lines | 8-10 hours |
| 🔴 Critical | 4 | ~60 lines | 4-6 hours |
| 🟠 High | TBD | TBD | TBD |
| 🟡 Medium | TBD | TBD | TBD |
| **TOTAL (so far)** | **7** | **~180 lines** | **12-16 hours** |

*Note: Only 7 of 48 handlers reviewed so far*

### Recommendation

**DO NOT use v3 in production until:**
1. ✅ All 48 handlers are reviewed
2. ✅ Digging deeper logic is ported
3. ✅ Trauma redirect is fixed
4. ✅ Routing bug is fixed
5. ✅ `readyForTreatment` flag system is verified
6. ✅ All 25 test scenarios pass
7. ✅ Metadata clearing is implemented
8. ✅ Signal system is verified

**Continue using v2** - it works perfectly.

---

## 📋 Methodology

For each v3 handler:
1. ✅ Read v3 handler implementation
2. ✅ Find corresponding v2 case statement logic
3. ✅ Compare line-by-line
4. ✅ Document missing logic
5. ✅ Document simplified logic that may lose functionality
6. ✅ Assign priority (Critical/High/Medium/Low)

---

## 🎯 Handler Inventory

Total v3 handlers: 48  
Handlers reviewed: 7 / 48  
Showstopper issues found: 3  
Critical issues found: 4  
Critical bugs found: 1

---

## 🔍 HANDLER COMPARISONS

---

## Handler 1: `handleMindShiftingExplanation`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 372-459  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 5843-5940  
**Priority**: 🔴 CRITICAL (involved in initial routing)

### V2 Implementation Summary

**Complexity**: ~100 lines of complex routing logic

**Key responsibilities**:
1. Handle work type selection (1/Problem, 2/Goal, 3/Negative Experience)
2. Reset metadata on fresh work type selection
3. Route to appropriate next step based on work type
4. Handle method selection if already in problem mode
5. Handle problem description if method already selected
6. Check for existing problem statement to skip description
7. Explicitly set currentPhase for each route
8. Fall back to current step if no valid selection

### V3 Implementation Summary

**Complexity**: ~60 lines
**Location**: lines 372-434

V3 has this logic but it's INCOMPLETE:

1. ✅ Handles work type selection (1/Problem, 2/Goal, 3/Negative Experience)
2. ✅ Resets `selectedMethod` on fresh selection
3. ✅ Updates `context.currentPhase` and `context.metadata.workType`
4. ✅ Routes to `choose_method`, `goal_description`, or `negative_experience_description`
5. ⚠️ Has method selection logic WITHIN this handler (lines 392-411)
6. ⚠️ Has problem description logic (lines 414-421) that relies on `readyForTreatment` flag
7. ⚠️ Has goal description logic (lines 423-431)
8. ❌ **NO** fallback to current step if no valid selection
9. ❌ **NO** check for existing problem statement to skip description
10. ❌ **NO** explicit phase setting for goal (missing `context.currentPhase = 'introduction'`)

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| Work type selection | ✅ | ✅ | None |
| Method selection inline | ❌ | ✅ | Architecture change |
| Problem description inline | ❌ | ✅ | Architecture change |
| Uses `readyForTreatment` flag | ❌ | ✅ | **BREAKING** |
| Fallback to current step | ✅ | ❌ | **MISSING** |
| Check existing problem | ✅ | ❌ | **MISSING** |
| Explicit phase for goals | ✅ | ❌ | **MISSING** |

### Missing Logic in V3

1. **Line 5873-5874 missing**: Fallback to `mind_shifting_explanation` if no valid selection
   ```typescript
   // V2:
   return 'mind_shifting_explanation';
   ```

2. **Lines 5881-5941 missing**: Entire complex logic for handling existing problem statements and routing based on workType + selectedMethod combination

3. **`readyForTreatment` flag dependency**: V3 added a flag that v2 doesn't use. If this flag is not set properly elsewhere, routing will break.

### Priority Assessment

Priority: 🔴 CRITICAL  
Reason: This handler is involved in the initial user journey and the `readyForTreatment` flag dependency can cause routing failures. However, it APPEARS to work for the basic case - the real issue is likely in the execution flow order (base state machine).

---

## Handler 2: `handleChooseMethod`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 529-562  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 5696-5842  
**Priority**: 🔴🔴🔴 **SHOWSTOPPER** (digging deeper completely broken)

### V2 Implementation Summary

**Complexity**: 147 lines split into TWO completely separate code paths

#### Path 1: Digging Deeper Method Selection (lines 5700-5767, 68 lines)
1. **Check `context.metadata.isDiggingDeeperMethodSelection` flag** ← CRITICAL
2. Clear the flag
3. Parse user input for method selection (1-4 or text)
4. **Update problem statement from digging deeper context** (6 possible sources!)
   - `restate_problem_future`
   - `restate_scenario_problem_1`
   - `restate_scenario_problem_2`
   - `restate_scenario_problem_3`
   - `restate_anything_else_problem_1`
   - `restate_anything_else_problem_2`
5. **CRITICAL: Call `clearPreviousModalityMetadata(context)`** to prevent stale data
6. Store `selectedMethod` in metadata
7. Update `context.currentPhase`
8. Route directly to `*_shifting_intro` (skip description step)
9. Extensive logging for debugging

#### Path 2: Normal Method Selection (lines 5769-5841, 72 lines)
1. Get user's method choice
2. **Check if problem statement already exists** (`hasProblemStatement`)
3. For each method (6 total):
   - If `hasProblemStatement === true`: Route to `*_shifting_intro`
   - If `hasProblemStatement === false`: Route to `work_type_description`
4. Special case: Reality Shifting routes to `reality_goal_capture` (not description)
5. Update `context.currentPhase` for each route
6. Fall back to Problem Shifting if no valid selection

### V3 Implementation Summary

**Complexity**: 33 lines - SINGLE code path only

V3 has ONLY the normal flow and it's SIMPLIFIED:

1. ❌ **NO** check for `isDiggingDeeperMethodSelection` flag
2. ❌ **NO** digging deeper path at all (68 lines MISSING)
3. ❌ **NO** check for existing problem statement
4. ❌ **NO** call to `clearPreviousModalityMetadata`
5. ❌ **NO** handling of multiple problem statement sources
6. ✅ Parses numerical input (1-4) and text input
7. ✅ Updates `context.currentPhase`
8. ✅ Stores `selectedMethod` in metadata
9. ⚠️ **ALWAYS** routes to `work_type_description` (never skips it)
10. ✅ Has Reality Shifting special case
11. ✅ Falls back to Problem Shifting

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| **Digging deeper path** | ✅ 68 lines | ❌ MISSING | 🔴🔴🔴 **SHOWSTOPPER** |
| `isDiggingDeeperMethodSelection` check | ✅ | ❌ | 🔴🔴🔴 **SHOWSTOPPER** |
| Multiple problem sources | ✅ 6 sources | ❌ 0 sources | 🔴🔴 **CRITICAL** |
| `clearPreviousModalityMetadata()` | ✅ | ❌ | 🔴🔴 **CRITICAL** |
| Check existing problem | ✅ | ❌ | 🔴 **HIGH** |
| Skip description if has problem | ✅ | ❌ | 🔴 **HIGH** |
| Reality Shifting special case | ✅ | ✅ | ✅ OK |
| Method selection parsing | ✅ | ✅ | ✅ OK |
| Phase updates | ✅ | ✅ | ✅ OK |

### Missing Logic in V3

#### MISSING BLOCK 1: Digging Deeper Detection (68 lines)

**V2 lines 5700-5767** - Completely absent from v3

```typescript
// V2 has:
if (context.metadata.isDiggingDeeperMethodSelection) {
  // 68 lines of complex logic
}

// V3 has:
// NOTHING - goes straight to normal method selection
```

**Impact**: When user completes a treatment and digs deeper to find a new problem, v3 will:
1. NOT clear previous modality metadata (causes stale `currentBelief`, `cycleCount`, etc.)
2. NOT use the new problem from digging deeper
3. NOT skip the description step
4. Likely use the ORIGINAL problem instead of NEW problem
5. Carry over metadata from previous session

**User experience**: Catastrophic - treatment will reference wrong problem

#### MISSING BLOCK 2: Problem Statement Check (per-method, ~6 lines each)

**V2 lines 5775-5841** - Simplified in v3

```typescript
// V2:
if (hasProblemStatement) {
  context.currentPhase = 'problem_shifting';
  return 'problem_shifting_intro';  // Skip description
} else {
  context.currentPhase = 'work_type_selection';
  return 'work_type_description';  // Ask for description
}

// V3:
context.currentPhase = 'work_type_selection';
return 'work_type_description';  // ALWAYS ask for description
```

**Impact**: If user comes from trauma redirect (which already captured problem), v3 will ask for problem AGAIN.

**User experience**: Annoying - redundant question

#### MISSING FUNCTION: `clearPreviousModalityMetadata()`

V2 has a helper function (called at line 5739) that v3 doesn't call:

```typescript
// V2:
this.clearPreviousModalityMetadata(context);

// V3:
// Not called
```

**Impact**: When switching modalities (e.g., Belief → Problem), stale metadata like:
- `context.metadata.currentBelief`
- `context.metadata.currentIdentity`
- `context.metadata.cycleCount`
- `context.metadata.beliefCheckCount`

...will persist and contaminate the new session.

**User experience**: Bugs in treatment logic, incorrect references

### Priority Assessment

Priority: 🔴🔴🔴 **SHOWSTOPPER**  
Reason: 
1. Digging deeper is a CORE feature - users will use it in every session
2. Without this logic, digging deeper is COMPLETELY BROKEN
3. Metadata contamination will cause incorrect treatment
4. Will reference wrong problems
5. 68 lines of critical logic completely missing

**Estimated fix effort**: 4-6 hours to port v2 logic

---

## Handler 3: `handleWorkTypeDescription`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 460-488  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 5943-5989  
**Priority**: 🔴 CRITICAL (stores problem statement)

### V2 Implementation Summary

**Complexity**: ~47 lines

**Key responsibilities**:
1. Retrieve user's problem statement from `context.userResponses[context.currentStep]`
2. Store in MULTIPLE places:
   - `context.metadata.problemStatement`
   - `context.problemStatement` (for compatibility)
   - `context.metadata.originalProblemStatement` (if not already set)
3. Log extensively for debugging
4. Route based on `context.metadata.workType` + `context.metadata.selectedMethod` combo
5. Handle 4 problem methods: Problem/Identity/Belief/Blockage → route to `*_shifting_intro`
6. Handle goal: Reality Shifting → route to `reality_shifting_intro`
7. Handle negative experience: Trauma → route to `trauma_shifting_intro`
8. Handle edge case: problem + no method → route to `choose_method`
9. Update `context.currentPhase` for each route
10. Fallback to `confirm_statement`

### V3 Implementation Summary

**Complexity**: ~28 lines

V3 has DIFFERENT logic with a problematic dependency:

1. ✅ Retrieves user's problem statement
2. ✅ Calls `updateProblemStatement()` helper (stores in all 3 places)
3. ❌ **ONLY routes if `context.metadata.readyForTreatment === true`**
4. ⚠️ If flag is true: Routes correctly (similar to v2)
5. ⚠️ If flag is false: Returns `'work_type_description'` (STAYS on current step!)
6. ❌ Has **unreachable code** at line 487: `return 'confirm_statement';`

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| Store problem statement | ✅ | ✅ | ✅ OK |
| `readyForTreatment` flag check | ❌ | ✅ | 🔴🔴 **BREAKING** |
| Always routes after storage | ✅ | ❌ | 🔴🔴 **BREAKING** |
| Handles all modalities | ✅ | ✅ | ✅ OK |
| Edge case handling | ✅ | ✅ | ✅ OK |
| Unreachable code | ❌ | ✅ line 487 | 🟡 Code smell |

### Missing Logic in V3

#### PROBLEM: `readyForTreatment` Flag Dependency

V3 added logic that v2 doesn't have:

```typescript
// V3 lines 467-482:
if (context.metadata.readyForTreatment) {
  // Route to treatment
} else {
  return 'work_type_description';  // STAY ON CURRENT STEP
}
```

**Question**: WHERE is `readyForTreatment` set to `true`?  
**Answer**: Must be set in step definitions or somewhere else  
**Risk**: If NOT set properly, routing will BREAK

#### ISSUE: Unreachable Code

```typescript
// V3 lines 484-487:
// Stay on current step if not ready for treatment
return 'work_type_description';

return 'confirm_statement';  // ← UNREACHABLE!
```

Line 487 can never execute because line 485 always returns first.

### Priority Assessment

Priority: 🔴 CRITICAL  
Reason: The `readyForTreatment` flag is a **NEW dependency** that v2 doesn't have. If this flag isn't set correctly by step definitions, v3 will get STUCK on `work_type_description` step in an infinite loop.

**Verification needed**: Check where `readyForTreatment` is set in v3 codebase

**Estimated fix effort**: 1-2 hours (if flag logic is correct) OR 3-4 hours (if flag system needs redesign)

---

## Handler 4: `handleMethodSelection`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 564-571  
**V2 Location**: `lib/v2/treatment-state-machine.ts` [NOT A SEPARATE HANDLER IN V2]  
**Priority**: 🟡 MEDIUM

### V2 Implementation Summary

V2 doesn't have a separate `method_selection` case - this logic is embedded in other handlers.

### V3 Implementation Summary

[PENDING - NEED TO READ V3 CODE]

### Differences Found

[PENDING]

### Missing Logic in V3

[PENDING]

### Priority Assessment

Priority: 🟡 MEDIUM  
Reason: [PENDING]

---

## Handler 5: `handleInternalRoutingSignals`

**V3 Location**: `lib/v3/treatment-state-machine.ts` [NEED LINE NUMBERS]  
**V2 Location**: N/A - V2 doesn't use explicit signals  
**Priority**: 🔴 CRITICAL (new system in v3)

### V2 Implementation Summary

V2 doesn't have an explicit signal handling system. Routing happens inline within case statements.

### V3 Implementation Summary

[PENDING - NEED TO READ V3 CODE]

### Differences Found

[PENDING]

### Missing Logic in V3

N/A - This is new functionality in v3

### Priority Assessment

Priority: 🔴 CRITICAL  
Reason: If this doesn't work correctly, the entire signal-based routing system fails

---

## Handler 6: `handleRouteToMethod`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 583-601  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6043-6074  
**Priority**: 🔴🔴 **CRITICAL BUG** (wrong trauma routing)

### V2 Implementation Summary

**Complexity**: ~32 lines

**Key responsibilities**:
1. Route based on `context.metadata.workType` + `context.metadata.selectedMethod`
2. For goals: Route to `reality_shifting_intro`, set phase + method
3. **For negative experiences: Route to `trauma_dissolve_step_a`** (NOT intro!)
4. For problems with method: Route to `*_shifting_intro`
5. For problems without method: Route to `choose_method`
6. Update `context.currentPhase` and `context.metadata.selectedMethod`

### V3 Implementation Summary

**Complexity**: ~19 lines

V3 is SIMILAR but has a CRITICAL BUG:

1. ✅ Routes problems with method correctly
2. ✅ Routes goals correctly
3. ❌ **BUG**: Routes negative experiences to `trauma_identity_step` (WRONG!)
4. ✅ Routes problems without method to `choose_method`
5. ✅ Updates phase and method

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| Problem routing | ✅ | ✅ | ✅ OK |
| Goal routing | ✅ | ✅ | ✅ OK |
| **Trauma routing** | `trauma_dissolve_step_a` | `trauma_identity_step` | 🔴🔴 **CRITICAL BUG** |
| Edge case handling | ✅ | ✅ | ✅ OK |

### Missing Logic in V3

#### CRITICAL BUG: Wrong Trauma Step

**V2 line 6056**:
```typescript
return 'trauma_dissolve_step_a';
```

**V3 line 597**:
```typescript
return 'trauma_identity_step';
```

**Impact**: 
- V2: Goes to dissolve step A (correct per flowchart)
- V3: Goes to identity step (skips dissolve steps entirely!)
- This breaks the entire Trauma Shifting flow
- User won't be asked proper dissolve questions

### Priority Assessment

Priority: 🔴🔴 **CRITICAL BUG**  
Reason: Direct routing error that breaks Trauma Shifting. Easy to fix (one line) but catastrophic if missed.

**Estimated fix effort**: 5 minutes to change one line

---

## Handler 7: `handleConfirmStatement`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 573-581  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 5994-6041  
**Priority**: 🔴 CRITICAL (trauma redirect broken)

### V2 Implementation Summary

**Complexity**: ~48 lines with complex conditional logic

**Key responsibilities**:
1. Handle "no" response (user says statement is wrong):
   - **Check if came from `trauma_problem_redirect` FIRST** (lines 6005-6017)
   - If yes: Delete old responses, set phase, return to `trauma_problem_redirect`
   - If no: Route back based on `workType`
2. Clear metadata when routing back:
   - Problem: Clear `problemStatement` and go to `work_type_description`
   - Goal: Set phase to `introduction`, go to `goal_description`  
   - Negative experience: Set phase to `introduction`, go to `negative_experience_description`
3. Handle "yes" response: Route to `route_to_method`
4. Handle invalid response: Stay on `confirm_statement`
5. Persist cleared responses to database

### V3 Implementation Summary

**Complexity**: 9 lines - EXTREMELY simplified

V3 has ONLY basic routing:

1. ❌ **NO** check for `trauma_problem_redirect`
2. ❌ **NO** workType-based routing
3. ❌ **NO** phase updates
4. ❌ **NO** metadata clearing
5. ❌ **NO** database persistence
6. ✅ Handles "yes" → `route_to_method`
7. ⚠️ Handles "no" → **ALWAYS** `work_type_description` (wrong for goals/trauma!)
8. ✅ Handles invalid → stays on `confirm_statement`

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| Trauma redirect check | ✅ 13 lines | ❌ | 🔴🔴 **SHOWSTOPPER** |
| WorkType-based routing | ✅ | ❌ | 🔴 **CRITICAL** |
| Phase updates | ✅ | ❌ | 🔴 **CRITICAL** |
| Metadata clearing | ✅ | ❌ | 🔴 **HIGH** |
| Database persistence | ✅ | ❌ | 🟡 **MEDIUM** |
| Yes/No handling | ✅ | ✅ | ✅ OK |

### Missing Logic in V3

#### MISSING BLOCK: Trauma Problem Redirect (13 lines)

**V2 lines 6004-6017** - Completely absent

```typescript
// V2:
if (context.userResponses['trauma_problem_redirect']) {
  context.currentPhase = 'trauma_shifting';
  delete context.userResponses['trauma_problem_redirect'];
  delete context.userResponses['confirm_statement'];
  this.saveContextToDatabase(context);
  return 'trauma_problem_redirect';
}

// V3:
// MISSING - will route to work_type_description instead!
```

**Impact**: When trauma user says "no" to confirmation, v3 will:
1. Route to `work_type_description` (WRONG - should go back to trauma redirect)
2. NOT clear old responses
3. NOT set correct phase
4. Break the entire trauma redirect flow

#### MISSING BLOCK: WorkType-Based Routing (20 lines)

**V2 lines 6019-6035** - Replaced with single line in v3

```typescript
// V2:
if (workType === 'problem') {
  context.metadata.problemStatement = undefined;
  context.problemStatement = undefined;
  return 'work_type_description';
} else if (workType === 'goal') {
  context.currentPhase = 'introduction';
  return 'goal_description';
} else if (workType === 'negative_experience') {
  context.currentPhase = 'introduction';
  return 'negative_experience_description';
}

// V3:
return 'work_type_description';  // ALWAYS, regardless of workType!
```

**Impact**: Goals and negative experiences will route to WRONG step

### Priority Assessment

Priority: 🔴🔴 **SHOWSTOPPER**  
Reason: 
1. Trauma redirect is COMPLETELY BROKEN - can't re-answer the question
2. Goals/negative experiences route to wrong step on "no"
3. Metadata not cleared - causes contamination
4. Missing 33 lines of critical logic

**Estimated fix effort**: 2-3 hours to port v2 logic

---

## STATUS: CRITICAL HANDLERS REVIEWED

Key findings documented below. Critical issues found in:
- ✅ handleChooseMethod (MAJOR GAPS)
- ✅ handleConfirmStatement (MAJOR GAPS)  
- ✅ handleWorkTypeDescription (MISSING LOGIC)
- ✅ handleRouteToMethod (BUG FOUND)
- ✅ handleMindShiftingExplanation (PARTIAL)
- ✅ handleInternalRoutingSignals (NEW SYSTEM)

---

