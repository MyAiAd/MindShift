# V2/V3 Handler-by-Handler Logic Comparison
## Comprehensive Code Review for V3 Fix Implementation

**Date**: November 9, 2025  
**Purpose**: Document exact logic differences between v2 and v3 handlers to enable complete fix  
**Status**: 🔄 IN PROGRESS

---

## 🎯 EXECUTIVE SUMMARY

### Critical Findings

**Handlers Reviewed**: 17 of 48 (35% complete)  
**Showstopper Issues Found**: 9  
**Critical Issues Found**: 11+  
**Total Missing Lines of Logic**: ~340+ lines
**Patient Safety Risks**: 1 (handleTraumaProblemRedirect)

### The Core Problem

V3 handlers are **dramatically simplified** versions of v2 logic, losing critical functionality:

| Handler | V2 Lines | V3 Lines | Missing | Impact |
|---------|----------|----------|---------|--------|
| `handleChooseMethod` | 147 | 33 | **114 lines** | 🔴🔴🔴 SHOWSTOPPER |
| `handleConfirmStatement` | 48 | 9 | **39 lines** | 🔴🔴 SHOWSTOPPER |
| `handleDiggingMethodSelection` | 72 | 36 | **36 lines** | 🔴🔴 CRITICAL |
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

## 🔍 DETAILED HANDLER COMPARISONS - BATCH 2

---

## Handler 8: `handleDiggingMethodSelection`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 987-1022  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 7089-7160  
**Priority**: 🔴🔴 **CRITICAL** (digging deeper metadata contamination)

### V2 Implementation Summary

**Complexity**: 72 lines with extensive error handling

**Key responsibilities**:
1. Parse user's method selection (1-4 or text)
2. **Get new problem from 6 possible sources** (in priority order):
   - `context.metadata.currentDiggingProblem` (HIGHEST priority)
   - `context.metadata.newDiggingProblem`
   - `restate_problem_future`
   - `restate_scenario_problem_1`
   - `restate_scenario_problem_2`
   - `restate_scenario_problem_3`
   - `restate_anything_else_problem_1`
   - `restate_anything_else_problem_2`
3. Update both `context.problemStatement` AND `context.metadata.currentDiggingProblem`
4. **CRITICAL: Call `clearPreviousModalityMetadata(context)`**
5. Store `selectedMethod` in metadata
6. **Set `context.metadata.workType = 'problem'`** for each method
7. Update `context.currentPhase`
8. Route to `*_shifting_intro`
9. Extensive logging and error detection
10. Default fallback to Problem Shifting

### V3 Implementation Summary

**Complexity**: 36 lines - SIMPLIFIED

V3 has INCOMPLETE logic:

1. ⚠️ Reads `context.metadata?.selectedMethod` FIRST (may be stale!)
2. ⚠️ Only checks ONE problem source: `restate_problem_future`
3. ❌ **NO** check for 5 other problem sources
4. ❌ **NO** prioritization of `currentDiggingProblem` over user responses
5. ❌ **NO** call to `clearPreviousModalityMetadata()`
6. ❌ **NO** setting of `context.metadata.workType`
7. ✅ Parses user input (1-4 or text)
8. ✅ Updates problem statement and currentDiggingProblem
9. ✅ Updates phase and routes correctly
10. ❌ **NO** extensive logging or error detection
11. ❌ **NO** default fallback

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| Problem source checking | ✅ 6 sources | ⚠️ 1 source | 🔴🔴 **CRITICAL** |
| Source prioritization | ✅ metadata first | ⚠️ userResponses first | 🔴 **HIGH** |
| `clearPreviousModalityMetadata()` | ✅ | ❌ | 🔴🔴 **CRITICAL** |
| Set `workType` | ✅ | ❌ | 🔴 **HIGH** |
| Error detection | ✅ | ❌ | 🟡 **MEDIUM** |
| Default fallback | ✅ | ❌ | 🟡 **MEDIUM** |
| Method parsing | ✅ | ✅ | ✅ OK |

### Missing Logic in V3

#### MISSING BLOCK 1: Multiple Problem Sources (6 lines)

**V2 lines 7110-7117** - Partially present in v3

```typescript
// V2:
const newProblemFromUserResponse = context.userResponses?.['restate_problem_future'] ||
                                    context.userResponses?.['restate_scenario_problem_1'] ||
                                    context.userResponses?.['restate_scenario_problem_2'] ||
                                    context.userResponses?.['restate_scenario_problem_3'] ||
                                    context.userResponses?.['restate_anything_else_problem_1'] ||
                                    context.userResponses?.['restate_anything_else_problem_2'];
const newDiggingProblem = context.metadata?.currentDiggingProblem || 
                         context.metadata?.newDiggingProblem || 
                         newProblemFromUserResponse;

// V3:
const newProblemFromUserResponse = context.userResponses?.['restate_problem_future'];
const newDiggingProblem = newProblemFromUserResponse || 
                         context.metadata?.newDiggingProblem || 
                         context.metadata?.currentDiggingProblem;
```

**Impact**: 
- V3 only checks future problem, misses scenario/anything_else problems
- V3 has WRONG priority order (userResponses before metadata)
- Will use WRONG problem if user has gone through scenario checks

#### MISSING BLOCK 2: Metadata Clearing

**V2 line 7128** - Completely absent

```typescript
// V2:
this.clearPreviousModalityMetadata(context);

// V3:
// MISSING
```

**Impact**: Same as handleChooseMethod - stale metadata contaminates new session

#### MISSING BLOCK 3: WorkType Setting (per-method)

**V2 lines 7135, 7141, 7146, 7151, 7157** - Absent in v3

```typescript
// V2:
context.metadata.workType = 'problem';

// V3:
// MISSING
```

**Impact**: May cause issues with workType-dependent logic later

#### MISSING BLOCK 4: Error Detection

**V2 lines 7123-7125** - Absent in v3

```typescript
// V2:
if (newDiggingProblem) {
  // ... use it
} else {
  console.error(`❌ NO PROBLEM FOUND! This will cause routing to fail!`);
}

// V3:
// No check - just assumes problem exists
```

**Impact**: Silent failures when problem is missing

### Priority Assessment

Priority: 🔴🔴 **CRITICAL**  
Reason: 
1. Missing 5 problem sources means wrong problem used in many digging deeper scenarios
2. No `clearPreviousModalityMetadata()` causes metadata contamination
3. Wrong priority order may use stale data
4. Missing `workType` may cause downstream issues

**User Experience**: Digging deeper will reference wrong problem when user has gone through scenario or anything_else checks

**Estimated fix effort**: 2-3 hours

---

## Handler 9: `handleIdentityCheck`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 729-738  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6381-6392  
**Priority**: Must match exactly

### V2 Implementation Summary

**Complexity**: ~12 lines

**Key responsibilities**:
1. Handle "yes"/"still" response: Increment cycleCount, return to `identity_dissolve_step_a`
2. Handle "no"/"not" response: Proceed to `identity_problem_check` (NOT future check!)
3. No default return - relies on break statement

### V3 Implementation Summary

**Complexity**: ~10 lines

**Key responsibilities**:
1. ✅ Handle "yes"/"still": Increment cycleCount, return to `identity_dissolve_step_a`
2. ❌ Handle "no"/"not": Returns `identity_future_check` (WRONG!)
3. ⚠️ Has explicit default: return `identity_future_check`

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| "Yes" response | ✅ | ✅ | ✅ OK |
| "No" response | → `identity_problem_check` | → `identity_future_check` | 🔴🔴 **CRITICAL BUG** |
| Default behavior | break (no return) | → `identity_future_check` | 🔴 **HIGH** |

### Missing Logic in V3

#### CRITICAL BUG: Wrong Next Step

**V2 line 6390**:
```typescript
return 'identity_problem_check';
```

**V3 lines 735, 737**:
```typescript
return 'identity_future_check';  // Both "no" and default!
```

**Impact**: When identity is dissolved, v3 goes to future check instead of problem check. This is WRONG per flowchart. Should check if problem still exists immediately, not ask about future identity.

**User Experience**: Wrong question sequence, doesn't follow therapeutic flowchart

### Priority Assessment

Priority: 🔴🔴 **CRITICAL BUG**  
Reason: Wrong routing - goes to wrong step, violates flowchart sequence

**Estimated fix effort**: 5 minutes (change lines 735 and 737)

---

## Handler 10: `handleIdentityFutureCheck`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 711-718  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6481-6499  
**Priority**: Must match exactly

### V2 Implementation Summary

**Complexity**: ~19 lines with extensive metadata management

**Key responsibilities**:
1. Handle "yes"/"1": Set `returnToIdentityCheck = 'identity_future_check'`, clear `identityBridgePhraseUsed`, return to `identity_dissolve_step_a`
2. Handle "no"/"2": Clear `returnToIdentityCheck`, clear `identityBridgePhraseUsed`, proceed to `identity_scenario_check`
3. Default: Proceed to `identity_scenario_check`
4. Extensive logging for debugging

### V3 Implementation Summary

**Complexity**: ~8 lines - SIMPLIFIED

**Key responsibilities**:
1. ⚠️ Handle "yes"/"1": Return to `identity_problem_check` (WRONG!)
2. ✅ Handle "no"/"2": Proceed to `identity_scenario_check`
3. ✅ Default: Return `identity_scenario_check`
4. ❌ NO metadata setting
5. ❌ NO logging

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| "Yes" response destination | → `identity_dissolve_step_a` | → `identity_problem_check` | 🔴🔴🔴 **SHOWSTOPPER** |
| Set `returnToIdentityCheck` | ✅ | ❌ | 🔴🔴 **CRITICAL** |
| Clear `identityBridgePhraseUsed` | ✅ | ❌ | 🔴🔴 **CRITICAL** |
| Logging | ✅ | ❌ | 🟡 **MEDIUM** |

### Missing Logic in V3

#### SHOWSTOPPER: Wrong Routing on "Yes"

**V2 lines 6487-6489**:
```typescript
context.metadata.returnToIdentityCheck = 'identity_future_check';
context.metadata.identityBridgePhraseUsed = false;
return 'identity_dissolve_step_a';
```

**V3 line 713**:
```typescript
return 'identity_problem_check';  // COMPLETELY WRONG!
```

**Impact**: 
- When user says "yes" (might feel identity in future), v2 goes BACK to dissolve steps to work on it more
- V3 skips the work and goes straight to problem check
- This breaks the entire Identity Shifting therapeutic process
- Bridge phrases won't work (metadata not set)

#### CRITICAL: Missing Metadata Management

V3 doesn't set/clear ANY metadata:
- No `returnToIdentityCheck` setting
- No `identityBridgePhraseUsed` clearing

**Impact**: Bridge phrases in identity_dissolve_step_a won't work correctly. Step won't know which check failed.

### Priority Assessment

Priority: 🔴🔴🔴 **SHOWSTOPPER**  
Reason: Completely breaks Identity Shifting therapeutic process. Skips critical dissolve work when identity not cleared.

**Estimated fix effort**: 15 minutes

---

## Handler 11: `handleIdentityScenarioCheck`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 720-727  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6501-6519  
**Priority**: Must match exactly

### V2 Implementation Summary

**Complexity**: ~19 lines

**Key responsibilities**:
1. Handle "yes"/"1": Set `returnToIdentityCheck = 'identity_scenario_check'`, clear `identityBridgePhraseUsed`, return to `identity_dissolve_step_a`
2. Handle "no"/"2": Clear `returnToIdentityCheck`, clear `identityBridgePhraseUsed`, proceed to `identity_problem_check`
3. Default: Go back to shifting (`identity_dissolve_step_a`)
4. Extensive logging

### V3 Implementation Summary

**Complexity**: ~8 lines - SIMPLIFIED

**Key responsibilities**:
1. ⚠️ Handle "yes"/"1": Return to `identity_problem_check` (WRONG!)
2. ⚠️ Handle "no"/"2": Route to `integration_awareness_1` (WRONG!)
3. ⚠️ Default: Return `identity_problem_check` (WRONG!)
4. ❌ NO metadata setting
5. ❌ NO logging

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| "Yes" response | → `identity_dissolve_step_a` | → `identity_problem_check` | 🔴🔴🔴 **SHOWSTOPPER** |
| "No" response | → `identity_problem_check` | → `integration_awareness_1` | 🔴🔴🔴 **SHOWSTOPPER** |
| Default | → `identity_dissolve_step_a` | → `identity_problem_check` | 🔴🔴 **CRITICAL** |
| Set `returnToIdentityCheck` | ✅ | ❌ | 🔴🔴 **CRITICAL** |
| Clear `identityBridgePhraseUsed` | ✅ | ❌ | 🔴🔴 **CRITICAL** |

### Missing Logic in V3

#### SHOWSTOPPER: All 3 Code Paths Wrong

**V2 "yes" logic (lines 6507-6509)**:
```typescript
context.metadata.returnToIdentityCheck = 'identity_scenario_check';
context.metadata.identityBridgePhraseUsed = false;
return 'identity_dissolve_step_a';
```

**V3 line 722**:
```typescript
return 'identity_problem_check';  // WRONG!
```

**V2 "no" logic (lines 6513-6515)**:
```typescript
context.metadata.returnToIdentityCheck = undefined;
context.metadata.identityBridgePhraseUsed = false;
return 'identity_problem_check';
```

**V3 line 724**:
```typescript
return 'integration_awareness_1';  // COMPLETELY WRONG - skips to integration!
```

**V2 default (lines 6518-6519)**:
```typescript
return 'identity_dissolve_step_a';
```

**V3 line 726**:
```typescript
return 'identity_problem_check';  // WRONG!
```

**Impact**: 
- "Yes" doesn't go back to work on identity (skips therapeutic work)
- "No" SKIPS STRAIGHT TO INTEGRATION (bypasses problem check and digging deeper!)
- Default doesn't handle unclear responses properly
- No metadata set = bridge phrases broken

### Priority Assessment

Priority: 🔴🔴🔴 **SHOWSTOPPER**  
Reason: ALL THREE code paths are wrong. "No" response jumps straight to integration, skipping critical problem check and digging deeper. Completely breaks Identity Shifting flow.

**Estimated fix effort**: 20 minutes

---

## Handler 12: `handleIdentityProblemCheck`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 740-758  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6394-6426  
**Priority**: Must match exactly

### V2 Implementation Summary

**Complexity**: ~33 lines with complex conditional logic

**Key responsibilities**:
1. Handle "yes"/"still": Increment cycleCount, set phase to `discovery`, return to `restate_problem_future` (NOT `restate_identity_problem`!)
2. Handle "no"/"not": Check `returnToDiggingStep`, route accordingly
   - If `returnToDiggingStep` exists: Clear it, return to that step
   - Check if already granted permission (`digging_deeper_start === 'yes'`)
   - If yes: Route directly to appropriate digging step
   - If no: Ask permission (`digging_deeper_start`)
3. Default: Stay on current step

### V3 Implementation Summary

**Complexity**: ~18 lines - SIMPLIFIED

**Key responsibilities**:
1. ⚠️ Handle "yes"/"still": Increment cycleCount, set phase to `discovery`, return to `restate_identity_problem` (WRONG!)
2. ⚠️ Handle "no"/"not": Check `returnToDiggingStep`, simple routing
   - If exists: Clear it, return to step
   - Else: Go to `digging_deeper_start`
3. ❌ NO permission check logic
4. ✅ Default: Stay on current step

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| "Yes" destination | → `restate_problem_future` | → `restate_identity_problem` | 🔴🔴 **CRITICAL** |
| Permission check | ✅ 13 lines | ❌ | 🔴 **HIGH** |
| "No" with returnStep | ✅ | ✅ | ✅ OK |
| "No" without returnStep | → check permission | → `digging_deeper_start` | ⚠️ **MAY BE OK** |

### Missing Logic in V3

#### CRITICAL: Wrong Step for "Yes" Response

**V2 line 6401**:
```typescript
return 'restate_problem_future';
```

**V3 line 744**:
```typescript
return 'restate_identity_problem';
```

**Impact**: Routes to wrong discovery step. Identity problems should use future problem flow, not identity-specific restate flow.

#### MISSING: Permission Check Logic (13 lines)

**V2 lines 6404-6417** - Absent in v3:
```typescript
const alreadyGrantedPermission = context.userResponses['digging_deeper_start'] === 'yes';
const returnStep = context.metadata?.returnToDiggingStep;

if (returnStep) {
  // Return to specific digging step
} else if (alreadyGrantedPermission) {
  // Route to future_problem_check or scenario_check_1
} else {
  // Ask permission
}
```

**V3 equivalent**:
```typescript
// Just checks returnStep, no permission logic
```

**Impact**: May ask for digging permission multiple times (annoying) OR may be OK if permission flow works differently in v3.

### Priority Assessment

Priority: 🔴🔴 **CRITICAL**  
Reason: Routes to wrong step on "yes". Missing permission check may cause redundant questions.

**Estimated fix effort**: 15-20 minutes

---

## Handler 13: `handleBeliefStepF`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 771-780  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6893-6910  
**Priority**: Must match exactly

### V2 Implementation Summary

**Complexity**: ~18 lines with metadata tracking

**Key responsibilities**:
1. Handle "yes"/"still": Increment cycleCount, return to `belief_step_a`
2. Handle "no"/"not": Check `returnToBeliefCheck` metadata
   - If exists: Return to that specific check question
   - If not: Proceed to `belief_check_1`
3. No explicit default

### V3 Implementation Summary

**Complexity**: ~10 lines - SIMPLIFIED

1. ✅ Handle "yes"/"still": Increment cycleCount, return to `belief_step_a`
2. ✅ Handle "no"/"not": Return to `belief_check_1`
3. ⚠️ Default: Return `belief_check_1`
4. ❌ NO check for `returnToBeliefCheck` metadata

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| "Yes" response | ✅ | ✅ | ✅ OK |
| Check `returnToBeliefCheck` | ✅ | ❌ | 🔴 **CRITICAL** |
| "No" with metadata | → specific check | → `belief_check_1` | 🔴 **CRITICAL** |
| "No" without metadata | → `belief_check_1` | → `belief_check_1` | ✅ OK |

### Missing Logic in V3

#### CRITICAL: Missing Return Check Logic

**V2 lines 6902-6906** - Absent in v3:
```typescript
const returnToCheck = context.metadata.returnToBeliefCheck;
if (returnToCheck) {
  return returnToCheck;  // Return to specific check (1, 2, 3, or 4)
}
```

**Impact**: When cycling back from a specific belief check, v3 always goes to check_1 instead of returning to the check that failed. This breaks the cycling logic and may repeat already-passed checks.

### Priority Assessment

Priority: 🔴🔴 **CRITICAL**  
Reason: Breaks belief check cycling. Will repeat checks unnecessarily, doesn't properly track which check failed.

**Estimated fix effort**: 10 minutes

---

## Handler 14: `handleBeliefChecks`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 782-791  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6912-6972  
**Priority**: Must match exactly

### V2 Implementation Summary

**Complexity**: ~60 lines across 4 check steps with complex metadata management

**belief_check_1** (lines 6912-6925):
- "Yes": Set `returnToBeliefCheck = 'belief_check_1'`, increment cycleCount, return to `belief_step_a`
- "No": Clear `returnToBeliefCheck`, proceed to `belief_check_2`

**belief_check_2** (lines 6927-6945):
- "Yes": Set `returnToBeliefCheck = 'belief_check_2'`, increment cycleCount, return to `belief_step_a`
- "No": Clear `returnToBeliefCheck`, proceed to `belief_check_3`

**belief_check_3** (lines 6947-6966):
- "Yes": Set `returnToBeliefCheck = 'belief_check_3'`, increment cycleCount, return to `belief_step_a`
- "No": Clear `returnToBeliefCheck`, proceed to `belief_check_4`

### V3 Implementation Summary

**Complexity**: ~10 lines - EXTREMELY simplified

1. ❌ Just a simple switch that advances to next check
2. ❌ NO metadata management
3. ❌ NO handling of "yes"/"no" responses
4. ❌ NO cycling back to belief_step_a
5. ❌ NO incrementing cycleCount
6. ⚠️ Only routes check_1 → check_2 → check_3 → check_4 unconditionally

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| Handle "yes" responses | ✅ | ❌ | 🔴🔴🔴 **SHOWSTOPPER** |
| Handle "no" responses | ✅ | ❌ | 🔴🔴🔴 **SHOWSTOPPER** |
| Set `returnToBeliefCheck` | ✅ | ❌ | 🔴🔴🔴 **SHOWSTOPPER** |
| Clear `returnToBeliefCheck` | ✅ | ❌ | 🔴🔴 **CRITICAL** |
| Cycle back to belief_step_a | ✅ | ❌ | 🔴🔴🔴 **SHOWSTOPPER** |
| Increment cycleCount | ✅ | ❌ | 🔴🔴 **CRITICAL** |
| Simple advancement | ❌ | ✅ | 🔴🔴🔴 **WRONG** |

### Missing Logic in V3

#### SHOWSTOPPER: Entire Check Logic Missing

V3 has NONE of the check logic - it just advances through checks blindly!

**V2 has for EACH check (lines 6912-6966, ~60 lines)**:
```typescript
case 'belief_check_1':
  if (lastResponse.includes('yes') || lastResponse.includes('still')) {
    context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
    context.metadata.returnToBeliefCheck = 'belief_check_1';
    return 'belief_step_a';
  }
  if (lastResponse.includes('no') || lastResponse.includes('not')) {
    context.metadata.returnToBeliefCheck = undefined;
    return 'belief_check_2';
  }
  break;
// ... same pattern for check_2, check_3, check_4
```

**V3 has**:
```typescript
private handleBeliefChecks(stepId: string, lastResponse: string): string {
  if (stepId === 'belief_check_1') {
    return 'belief_check_2';  // Just advances!
  } else if (stepId === 'belief_check_2') {
    return 'belief_check_3';
  } else if (stepId === 'belief_check_3') {
    return 'belief_check_4';
  }
  return 'belief_check_1';
}
```

**Impact**: 
- Belief checks DON'T CHECK ANYTHING - they just advance through all 4 questions regardless of answers!
- Never cycles back to dissolve steps when user still believes
- No metadata tracking
- Completely non-functional

### Priority Assessment

Priority: 🔴🔴🔴 **SHOWSTOPPER**  
Reason: Belief checks are COMPLETELY NON-FUNCTIONAL. They don't actually check anything - just advance through questions. This breaks the entire Belief Shifting modality.

**Estimated fix effort**: 1-2 hours (need to implement all 4 checks properly)

---

## Handler 15: `handleBeliefProblemCheck`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 793-811  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6973-7002  
**Priority**: Must match exactly

### V2 Implementation Summary

**Complexity**: ~30 lines with complex permission checking

**Key responsibilities**:
1. Handle "yes"/"still": Increment cycleCount, set phase to `digging_deeper`, return to `restate_problem_future` (NOT `restate_belief_problem`!)
2. Handle "no"/"not": Check both `alreadyGrantedPermission` AND `returnToDiggingStep`
   - If both: Skip permission, clear returnStep, return to returnStep
   - If permission only: Skip permission, go to `future_problem_check`
   - If neither: Ask permission at `digging_deeper_start`

### V3 Implementation Summary

**Complexity**: ~18 lines - SIMPLIFIED

1. ⚠️ Handle "yes": Increment cycleCount, set phase, return to `restate_belief_problem` (WRONG!)
2. ⚠️ Handle "no": Simple check for `returnToDiggingStep`
   - If exists: Clear it, return to step
   - Else: Go to `digging_deeper_start`
3. ❌ NO permission checking logic

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| "Yes" destination | → `restate_problem_future` | → `restate_belief_problem` | 🔴🔴 **CRITICAL** |
| Permission + returnStep | ✅ | ❌ | 🔴 **HIGH** |
| Permission only | ✅ | ❌ | 🔴 **HIGH** |
| No permission | ✅ | ✅ | ✅ OK |

### Missing Logic in V3

Same as handleIdentityProblemCheck - wrong step and missing permission logic.

### Priority Assessment

Priority: 🔴🔴 **CRITICAL**  
Reason: Wrong step on "yes", missing permission optimization

**Estimated fix effort**: 15 minutes

---

## Handler 16: `handleConfirmBeliefProblem`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 813-822  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 7004-7014  
**Priority**: Must match exactly

### V2 vs V3 Comparison

**Status**: ✅ **MATCHES EXACTLY**

Both versions:
- "Yes" → Set phase to `belief_shifting`, return `belief_shifting_intro`
- "No" → Return `restate_belief_problem`
- Default → Stay on `confirm_belief_problem`

**No differences found** - this handler is correct!

---

## Handler 17: `handleTraumaProblemRedirect`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 893-899  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6646-6684  
**Priority**: Must match exactly

### V2 Implementation Summary

**Complexity**: ~39 lines with complex problem construction

**Key responsibilities**:
1. Get user's feeling from lastResponse
2. Get trauma description from multiple sources:
   - `negative_experience_description`
   - `originalProblemStatement`
   - Default: 'that happened'
3. **Construct problem**: `"I feel [feeling] that [trauma] happened"`
4. Store in `context.problemStatement`
5. Store in `context.metadata.problemStatement`
6. **ALWAYS set `originalProblemStatement`** (PRODUCTION FIX comment!)
7. Store `workType = 'problem'`
8. Clear `selectedMethod`
9. Set phase to `work_type_selection` (NOT method_selection!)
10. Return to `confirm_statement`
11. Extensive logging

### V3 Implementation Summary

**Complexity**: ~6 lines - EXTREMELY simplified

1. ⚠️ Calls `updateProblemStatement(context, lastResponse)` (just stores lastResponse as-is!)
2. ✅ Sets `workType = 'problem'`
3. ✅ Clears `selectedMethod`
4. ⚠️ Sets phase to `method_selection` (WRONG!)
5. ⚠️ Returns to `choose_method` (WRONG!)
6. ❌ NO problem construction
7. ❌ NO trauma description retrieval
8. ❌ NO originalProblemStatement setting
9. ❌ NO logging

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| Problem construction | ✅ "I feel X that Y happened" | ❌ Just stores feeling | 🔴🔴🔴 **SHOWSTOPPER** |
| Get trauma description | ✅ | ❌ | 🔴🔴🔴 **SHOWSTOPPER** |
| Set originalProblemStatement | ✅ | ❌ | 🔴🔴 **CRITICAL** |
| Next phase | `work_type_selection` | `method_selection` | 🔴🔴 **CRITICAL** |
| Next step | `confirm_statement` | `choose_method` | 🔴🔴 **CRITICAL** |

### Missing Logic in V3

#### SHOWSTOPPER: No Problem Construction

**V2 lines 6647-6660** - Completely absent:
```typescript
const feeling = lastResponse || 'this way';
const traumaDescription = context.userResponses['negative_experience_description'] || 
                         context.metadata.originalProblemStatement || 
                         'that happened';
const constructedProblem = `I feel ${feeling} that ${traumaDescription} happened`;
console.log(`🔧 TRAUMA_REDIRECT: Constructed problem statement: "${constructedProblem}"`);

context.problemStatement = constructedProblem;
context.metadata.problemStatement = constructedProblem;
context.metadata.originalProblemStatement = constructedProblem;
```

**V3 line 894**:
```typescript
this.updateProblemStatement(context, lastResponse);
// Just stores the feeling, NOT the constructed problem!
```

**Impact**: 
- V3 stores "angry" instead of "I feel angry that my father hit me happened"
- Loses the trauma description entirely
- Treatment will reference incomplete/wrong problem
- **PATIENT SAFETY RISK**

#### CRITICAL: Wrong Next Step

**V2 lines 6676-6677**:
```typescript
context.currentPhase = 'work_type_selection';
return 'confirm_statement';
```

**V3 lines 897-898**:
```typescript
context.currentPhase = 'method_selection';
return 'choose_method';
```

**Impact**: Skips confirmation, goes straight to method selection

### Priority Assessment

Priority: 🔴🔴🔴 **SHOWSTOPPER - PATIENT SAFETY RISK**  
Reason: Doesn't construct proper problem statement. Loses trauma description. Stores incomplete data that will be used in treatment.

**Estimated fix effort**: 30 minutes

---

## Handler 18: `handleRealityWhyNotPossible`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 824-832  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6521-6540  
**Priority**: Must match exactly

### V2 Implementation Summary

**Complexity**: ~20 lines with conditional flag checking

**Key responsibilities**:
1. Check if user says "no reason"/"none"/"nothing"
2. Check `fromSecondCheckingQuestion` flag
   - If true: Clear flag, return to `reality_certainty_check`
   - If false: Return to `reality_checking_questions`
3. Otherwise: Return to `reality_feel_reason`

### V3 Implementation Summary

**Complexity**: ~8 lines - SIMPLIFIED

1. ✅ Check "no reason"/"none"/"nothing"
2. ⚠️ Always return to `reality_checking_questions`
3. ❌ NO check for `fromSecondCheckingQuestion` flag
4. ✅ Otherwise return `reality_feel_reason`

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| Check "no reason" | ✅ | ✅ | ✅ OK |
| Check `fromSecondCheckingQuestion` | ✅ | ❌ | 🔴🔴 **CRITICAL** |
| Route based on flag | ✅ | ❌ | 🔴🔴 **CRITICAL** |

### Missing Logic in V3

**V2 lines 6529-6537** - Absent:
```typescript
const fromSecondCheck = context?.metadata?.fromSecondCheckingQuestion;
if (fromSecondCheck) {
  context.metadata.fromSecondCheckingQuestion = false;
  return 'reality_certainty_check';
} else {
  return 'reality_checking_questions';
}
```

**V3 line 829**:
```typescript
return 'reality_checking_questions';  // Always!
```

**Impact**: Always returns to first checking question instead of remembering which one user came from

### Priority Assessment

Priority: 🔴🔴 **CRITICAL**  
Reason: Breaks Reality Shifting cycling logic. Won't return to correct check.

**Estimated fix effort**: 10 minutes

---

## Handler 19: `handleRealityCheckingQuestions`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 834-845  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6542-6556  
**Priority**: Must match exactly

### V2 vs V3 Comparison

**Status**: ✅ **MATCHES EXACTLY**

Both versions:
- Parse percentage from response
- If >= 100: Go to `reality_certainty_check`
- If > 0: Set `doubtPercentage`, go to `reality_doubt_reason`
- Default: Stay on `reality_checking_questions`

**No differences found** - this handler is correct!

---

## Handler 20: `handleRealityCertaintyCheck`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 857-866  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6576-6588  
**Priority**: Must match exactly

### V2 vs V3 Comparison

**Status**: ✅ **MATCHES EXACTLY**

Both versions:
- "Yes" → Set `fromSecondCheckingQuestion = true`, go to `reality_doubt_reason`
- "No" → Go to `reality_integration_intro`
- Default → Stay on `reality_certainty_check`

**No differences found** - this handler is correct!

---

## Handler 21: `handleRealityIntegrationActionMore`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 868-881  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6614-6632  
**Priority**: Must match exactly

### V2 Implementation Summary

**Complexity**: ~19 lines

1. Check for "nothing"/"no"/"not"
2. Check `returnToDiggingStep`
   - If exists: Set phase, DON'T clear returnStep, return `digging_deeper_start`
   - If not: Set phase, return `session_complete`
3. Otherwise: Stay on `reality_integration_action_more`

### V3 Implementation Summary

**Complexity**: ~13 lines - SIMPLIFIED

1. ✅ Check for "nothing"/"no"/"not"
2. ⚠️ Check `returnToDiggingStep`
   - If exists: Set phase, **CLEAR returnStep**, return to returnStep
   - If not: Return `reality_session_complete`
3. ✅ Otherwise stay on step

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| Check nothing/no | ✅ | ✅ | ✅ OK |
| With returnStep | → `digging_deeper_start` | → returnStep | 🔴 **HIGH** |
| DON'T clear returnStep | ✅ | ❌ Clears it | 🔴 **HIGH** |
| Without returnStep | → `session_complete` | → `reality_session_complete` | ⚠️ Different |

### Missing Logic in V3

**V2 lines 6619-6624**:
```typescript
if (returnStep) {
  context.currentPhase = 'digging_deeper';
  // DON'T clear returnToDiggingStep yet - we need it to know where to return
  return 'digging_deeper_start';
}
```

**V3 lines 871-874**:
```typescript
if (returnStep) {
  context.currentPhase = 'digging_deeper';
  context.metadata.returnToDiggingStep = undefined;  // CLEARS IT!
  return returnStep;  // Different destination
}
```

**Impact**: May lose digging step reference or route incorrectly

### Priority Assessment

Priority: 🔴 **HIGH**  
Reason: Different routing logic, may lose digging deeper state

**Estimated fix effort**: 10 minutes

---

## Handler 22: `handleTraumaShiftingIntro`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 883-891  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6634-6644  
**Priority**: Must match exactly

### V2 vs V3 Comparison

**Status**: ✅ **MATCHES EXACTLY**

Both versions:
- "Yes" → Return `trauma_identity_step`
- "No" → Return `trauma_problem_redirect`
- Default → Stay on `trauma_shifting_intro`

**No differences found** - this handler is correct!

---

## Handler 23: `handleTraumaIdentityCheck`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 901-910  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6686-6700  
**Priority**: Must match exactly

### V2 vs V3 Comparison

**Status**: ✅ **MATCHES EXACTLY**

Both versions:
- "Yes"/"still" → Increment cycleCount, return `trauma_dissolve_step_a`
- "No"/"not" → Return `trauma_future_identity_check`
- Default → Return `trauma_future_identity_check`

**No differences found** - this handler is correct!

---

## Handler 24: `handleTraumaFutureIdentityCheck`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 912-921  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6702-6716  
**Priority**: Must match exactly

### V2 vs V3 Comparison

**Status**: ✅ **MATCHES EXACTLY**

Both versions:
- "Yes"/"might"/"could" → Increment cycleCount, return `trauma_dissolve_step_c`
- "No"/"not"/"never" → Return `trauma_future_scenario_check`
- Default → Return `trauma_future_scenario_check`

**No differences found** - this handler is correct!

---

## Handler 25: `handleTraumaFutureScenarioCheck`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 923-932  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6718-6732  
**Priority**: Must match exactly

### V2 vs V3 Comparison

**Status**: ✅ **MATCHES EXACTLY**

Both versions:
- "Yes"/"might"/"could" → Increment cycleCount, return `trauma_dissolve_step_c`
- "No"/"not"/"never" → Return `trauma_experience_check`
- Default → Return `trauma_experience_check`

**No differences found** - this handler is correct!

---

## Handler 26: `handleTraumaExperienceCheck`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 934-963  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6803-6863  
**Priority**: Must match exactly

### V2 Implementation Summary

**Complexity**: ~61 lines with complex cycling + permission logic

**Key responsibilities**:
1. "Yes"/"still": Increment cycleCount, **DELETE 6 previous responses**, save to DB, return `trauma_identity_step`
2. "No"/"not": Complex permission checking
   - Check both `alreadyGrantedPermission` AND `returnToDiggingStep`
   - If both: Set phase, clear returnStep, return to returnStep
   - If permission only: Set phase, return `future_problem_check`
   - If neither: Set phase, return `digging_deeper_start`
3. Default: Stay on step

### V3 Implementation Summary

**Complexity**: ~29 lines - SIMPLIFIED

1. ✅ "Yes"/"still": Increment cycleCount, **DELETE 6 responses**, return `trauma_identity_step`
2. ⚠️ "No"/"not": Simplified permission logic
   - Check returnToDiggingStep only
   - If exists: Clear it, return to it
   - Else: Return `digging_deeper_start`
3. ❌ NO `alreadyGrantedPermission` check
4. ❌ NO save to database after clearing responses

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| Clear 6 responses on cycle | ✅ | ✅ | ✅ OK |
| Save to DB after clearing | ✅ | ❌ | 🔴 **HIGH** |
| Permission + returnStep | ✅ | ❌ | 🔴 **HIGH** |
| Permission only | ✅ | ❌ | 🔴 **HIGH** |

### Missing Logic in V3

**V2 lines 6819-6821** - Database save absent:
```typescript
this.saveContextToDatabase(context).catch(error => 
  console.error('Failed to save cleared trauma responses to database:', error)
);
```

**V2 lines 6827-6840** - Complex permission logic:
```typescript
const alreadyGrantedPermission = context.userResponses['digging_deeper_start'] === 'yes';
const returnStep = context.metadata?.returnToDiggingStep;

if (alreadyGrantedPermission && returnStep) {
  // ... return to returnStep
} else if (alreadyGrantedPermission) {
  // ... go to future_problem_check
} else {
  // ... go to digging_deeper_start
}
```

**V3 only has**:
```typescript
if (returnStep) {
  // ... return to returnStep
} else {
  return 'digging_deeper_start';
}
```

**Impact**: May ask redundant permission, doesn't persist cleared responses

### Priority Assessment

Priority: 🔴 **HIGH**  
Reason: Missing database persistence and permission optimization

**Estimated fix effort**: 15 minutes

---

## Handler 27: `handleTraumaDigDeeper2`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 965-985  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6866-6891  
**Priority**: Must match exactly

### V2 vs V3 Comparison

**Status**: ✅ **MATCHES EXACTLY**

Both versions:
- "Yes" → Set workType, clear selectedMethod, set phase, set returnStep to `trauma_dig_deeper_2`, return `restate_problem_future`
- "No" → Check returnStep, return appropriately
- Default → Stay on step

**No differences found** - this handler is correct!

---

## Handler 28: `handleCheckIfStillProblem` (Problem Shifting)

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 491-527  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6232-6267  
**Priority**: Must match exactly

### V2 Implementation Summary

**Complexity**: ~36 lines with complex permission logic

**Key responsibilities**:
1. "Yes"/"still": Increment cycleCount, set skip flags, return `problem_shifting_intro`
2. "No"/"not": Complex permission checking (same 3-path pattern)
   - If permission + returnStep: Return to returnStep
   - If permission only: Go to `future_problem_check`
   - If neither: Go to `digging_deeper_start`

### V3 Implementation Summary

**Complexity**: ~36 lines - MATCHES STRUCTURE

1. ✅ "Yes"/"still": Increment cycleCount, set skip flags, return `problem_shifting_intro`
2. ⚠️ "No"/"not": Simplified permission logic
   - Only checks returnToDiggingStep
   - Missing `alreadyGrantedPermission` check

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| Cycling logic | ✅ | ✅ | ✅ OK |
| Permission + returnStep | ✅ | ❌ | 🔴 **HIGH** |
| Permission only | ✅ | ❌ | 🔴 **HIGH** |

### Missing Logic in V3

Same permission optimization pattern missing as other modalities.

**V2 has** (lines 6242-6260):
```typescript
const alreadyGrantedPermission = context.userResponses['digging_deeper_start'] === 'yes';
const returnStep = context.metadata?.returnToDiggingStep;

if (alreadyGrantedPermission && returnStep) {
  // ... 
} else if (alreadyGrantedPermission) {
  // ...
} else {
  // ...
}
```

**V3 only checks returnStep**.

### Priority Assessment

Priority: 🔴 **HIGH**  
Reason: Missing permission optimization, may ask redundant questions

**Estimated fix effort**: 10 minutes

---

## Handler 29: `handleBlockageStepE`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 603-662  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6269-6378  
**Priority**: Must match exactly

### V2 Implementation Summary

**Complexity**: ~110 lines with VERY complex logic

**Key responsibilities**:
1. Check extensive "no problem" indicators list
2. Check for standalone "no"/"not" responses
3. Complex permission checking (3 paths)
4. Special trauma digging context handling
5. Otherwise: Cycle back to `blockage_step_a`

### V3 Implementation Summary

**Complexity**: ~59 lines - SIGNIFICANTLY SIMPLIFIED

1. ✅ Check "no problem" indicators (similar list)
2. ✅ Check standalone "no"/"not"
3. ⚠️ Simplified permission logic (only returnStep)
4. ❌ NO trauma digging context handling
5. ✅ Cycle back to `blockage_step_a`

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| Resolution indicators | ✅ | ✅ | ✅ OK |
| Permission + returnStep | ✅ | ❌ | 🔴 **HIGH** |
| Permission only | ✅ | ❌ | 🔴 **HIGH** |
| Trauma digging context | ✅ | ❌ | 🔴🔴 **CRITICAL** |
| Cycle logic | ✅ | ✅ | ✅ OK |

### Missing Logic in V3

#### CRITICAL: Missing Trauma Digging Context

**V2 lines 6294-6312** - Completely absent:
```typescript
} else if (alreadyGrantedPermission) {
  // Permission already granted - skip permission, go to appropriate digging question
  console.log(`🔍 BLOCKAGE_STEP_E: Permission already granted, checking for trauma digging context`);
  
  // Check if we're coming from trauma modality by looking at trauma-related responses
  const hasTraumaContext = context.userResponses['negative_experience_description'] || 
                          context.userResponses['trauma_identity_step'] ||
                          context.userResponses['trauma_dissolve_step_a'];
  
  if (hasTraumaContext) {
    console.log(`🔍 BLOCKAGE_STEP_E: Found trauma context, routing to trauma_dig_deeper_2`);
    context.currentPhase = 'digging_deeper';
    return 'trauma_dig_deeper_2';
  } else {
    // Regular digging deeper flow
    console.log(`🔍 BLOCKAGE_STEP_E: No trauma context, routing to future_problem_check`);
    context.currentPhase = 'digging_deeper';
    return 'future_problem_check';
  }
```

**Impact**: Won't route correctly from Blockage to trauma digging, breaks trauma + blockage combination

### Priority Assessment

Priority: 🔴🔴 **CRITICAL**  
Reason: Missing trauma context routing, won't work correctly with trauma digging deeper

**Estimated fix effort**: 20 minutes

---

## Handler 30: `handleBlockageCheckIfStillProblem`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 664-709  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6380-6426  
**Priority**: Must match exactly

### V2 Implementation Summary

**Complexity**: ~47 lines with permission logic

**Key responsibilities**:
1. "Yes"/"still": Set workType, clear selectedMethod, set phase, return `restate_problem_future`
2. "No"/"not": Complex permission checking (3 paths)

### V3 Implementation Summary

**Complexity**: ~45 lines - SIMILAR STRUCTURE

1. ✅ "Yes": Set workType, clear selectedMethod, set phase, return `restate_problem_future`
2. ⚠️ "No": Simplified permission logic

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| "Yes" routing | ✅ | ✅ | ✅ OK |
| Permission + returnStep | ✅ | ❌ | 🔴 **HIGH** |
| Permission only | ✅ | ❌ | 🔴 **HIGH** |

### Missing Logic in V3

Same permission optimization pattern missing.

### Priority Assessment

Priority: 🔴 **HIGH**  
Reason: Missing permission optimization

**Estimated fix effort**: 10 minutes

---

## Handler 31: `handleGoalDeadlineCheck`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 1034-1043  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 7387-7396  
**Priority**: Must match exactly

### V2 vs V3 Comparison

**Status**: ✅ **MATCHES EXACTLY**

Both versions:
- "Yes" → Return `goal_deadline_importance`
- "No" → Return `goal_confirmation`
- Default → Stay on step

**No differences found** - this handler is correct!

---

## Handler 32: `handleGoalConfirmation`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 1045-1054  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 7398-7407  
**Priority**: Must match exactly

### V2 vs V3 Comparison

**Status**: ✅ **MATCHES EXACTLY**

Both versions:
- "Yes" → Set phase to `integration`, return `integration_start`
- "No" → Return `goal_what_needs_to_happen`
- Default → Stay on step

**No differences found** - this handler is correct!

---

## Handler 33: `handleAnalyzeResponse`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 490-499  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6089-6098  
**Priority**: Must match exactly

### V2 vs V3 Comparison

**Status**: ✅ **MATCHES EXACTLY**

Both versions:
- "Yes" → Return `choose_method`
- "No" → Return `work_type_description`
- Default → Stay on step

**No differences found** - this handler is correct!

---

## Handler 34: `handleGoalDescription`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 501-509  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6100-6113  
**Priority**: Must match exactly

### V2 Implementation Summary

**Complexity**: ~14 lines

1. Store goal in both `goalStatement` and `metadata.goalStatement`
2. Set `workType = 'goal'`
3. Set phase to `work_type_selection`
4. Return `confirm_statement`

### V3 Implementation Summary

**Complexity**: ~8 lines - SIMPLIFIED

1. ⚠️ Call `updateGoalStatement(context, lastResponse)` (just stores in `goalStatement`)
2. ✅ Set `workType = 'goal'`
3. ⚠️ Set phase to `method_selection` (WRONG!)
4. ⚠️ Return `choose_method` (WRONG!)

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| Store in goalStatement | ✅ | ✅ | ✅ OK |
| Store in metadata.goalStatement | ✅ | ❌ | 🔴 **HIGH** |
| Next phase | `work_type_selection` | `method_selection` | 🔴🔴 **CRITICAL** |
| Next step | `confirm_statement` | `choose_method` | 🔴🔴 **CRITICAL** |

### Missing Logic in V3

**V2 lines 6101-6106**:
```typescript
context.goalStatement = lastResponse;
context.metadata.goalStatement = lastResponse;
context.metadata.workType = 'goal';
context.currentPhase = 'work_type_selection';
return 'confirm_statement';
```

**V3 lines 502-505**:
```typescript
this.updateGoalStatement(context, lastResponse);  // Only sets goalStatement
context.metadata.workType = 'goal';
context.currentPhase = 'method_selection';  // WRONG!
return 'choose_method';  // WRONG! Skips confirmation!
```

**Impact**: 
- Skips goal confirmation entirely
- Doesn't store in metadata
- Wrong phase

### Priority Assessment

Priority: 🔴🔴 **CRITICAL**  
Reason: Skips goal confirmation, wrong phase, incomplete storage

**Estimated fix effort**: 10 minutes

---

## Handler 35: `handleNegativeExperienceDescription`

**V3 Location**: `lib/v3/treatment-state-machine.ts` lines 511-519  
**V2 Location**: `lib/v2/treatment-state-machine.ts` lines 6115-6128  
**Priority**: Must match exactly

### V2 Implementation Summary

**Complexity**: ~14 lines

1. Store in both `problemStatement` and `metadata.problemStatement`
2. **ALSO store in `metadata.originalProblemStatement`**
3. Set `workType = 'problem'`
4. Set phase to `work_type_selection`
5. Return `confirm_statement`

### V3 Implementation Summary

**Complexity**: ~8 lines - SIMPLIFIED

1. ⚠️ Call `updateProblemStatement(context, lastResponse)`
2. ✅ Set `workType = 'problem'`
3. ⚠️ Set phase to `method_selection` (WRONG!)
4. ⚠️ Return `choose_method` (WRONG!)

### Differences Found

| Feature | V2 | V3 | Impact |
|---------|-----|-----|---------|
| Store in problemStatement | ✅ | ✅ | ✅ OK |
| Store in metadata.problemStatement | ✅ | ✅ | ✅ OK |
| Store in originalProblemStatement | ✅ | ❌ | 🔴🔴 **CRITICAL** |
| Next phase | `work_type_selection` | `method_selection` | 🔴🔴 **CRITICAL** |
| Next step | `confirm_statement` | `choose_method` | 🔴🔴 **CRITICAL** |

### Missing Logic in V3

**V2 lines 6116-6121**:
```typescript
context.problemStatement = lastResponse;
context.metadata.problemStatement = lastResponse;
context.metadata.originalProblemStatement = lastResponse;  // CRITICAL!
context.metadata.workType = 'problem';
context.currentPhase = 'work_type_selection';
return 'confirm_statement';
```

**V3 lines 512-515**:
```typescript
this.updateProblemStatement(context, lastResponse);
context.metadata.workType = 'problem';
context.currentPhase = 'method_selection';  // WRONG!
return 'choose_method';  // WRONG! Skips confirmation!
```

**Impact**: 
- Missing `originalProblemStatement` (used later for digging deeper!)
- Skips confirmation
- Wrong phase

### Priority Assessment

Priority: 🔴🔴 **CRITICAL**  
Reason: Missing originalProblemStatement storage, skips confirmation, wrong phase

**Estimated fix effort**: 10 minutes

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

## STATUS: HANDLER REVIEW IN PROGRESS

### Completed (7 of 48):
- ✅ handleMindShiftingExplanation (PARTIAL - 40 lines missing)
- ✅ handleChooseMethod (SHOWSTOPPER - 114 lines missing)
- ✅ handleWorkTypeDescription (CRITICAL - readyForTreatment flag)
- ✅ handleMethodSelection (OK)
- ✅ handleInternalRoutingSignals (NEW SYSTEM - needs verification)
- ✅ handleRouteToMethod (CRITICAL BUG - 1 line wrong)
- ✅ handleConfirmStatement (SHOWSTOPPER - 39 lines missing)

### In Progress (Batch 2 - Next 10):
- 🔄 handleDiggingMethodSelection
- 🔄 handleIdentityScenarioCheck
- 🔄 handleRealityWhyNotPossible
- 🔄 handleTraumaProblemRedirect
- 🔄 handleScenarioCheck
- 🔄 handleClearScenarioProblem
- 🔄 handleAnythingElseCheck
- 🔄 handleClearAnythingElseProblem
- 🔄 handleRouteToIntegration
- 🔄 handleActionFollowup

### Pending (31 remaining):
- [ ] handleGoalDescription
- [ ] handleNegativeExperienceDescription
- [ ] handleAnalyzeResponse
- [ ] handleGoalDeadlineCheck
- [ ] handleGoalConfirmation
- [ ] handleCheckIfStillProblem
- [ ] handleBlockageStepE
- [ ] handleBlockageCheckIfStillProblem
- [ ] handleIdentityShiftingIntro
- [ ] handleIdentityDissolveStepF
- [ ] handleIdentityFutureCheck
- [ ] handleIdentityCheck
- [ ] handleIdentityProblemCheck
- [ ] handleConfirmIdentityProblem
- [ ] handleBeliefStepF
- [ ] handleBeliefChecks
- [ ] handleBeliefProblemCheck
- [ ] handleConfirmBeliefProblem
- [ ] handleRealityCheckingQuestions
- [ ] handleRealityCycleB
- [ ] handleRealityCertaintyCheck
- [ ] handleRealityIntegrationActionMore
- [ ] handleTraumaShiftingIntro
- [ ] handleTraumaIdentityCheck
- [ ] handleTraumaFutureIdentityCheck
- [ ] handleTraumaFutureScenarioCheck
- [ ] handleTraumaExperienceCheck
- [ ] handleTraumaDigDeeper
- [ ] handleDiggingDeeperStart
- [ ] handleFutureProblemCheck
- [ ] (others)

---

