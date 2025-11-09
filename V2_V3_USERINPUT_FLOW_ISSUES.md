# V2-V3 UserInput Flow Architecture Issues

**Date**: November 9, 2025  
**Status**: 🔴 **CRITICAL - Architecture Divergence Discovered**  
**Impact**: All modalities affected by userInput propagation issues

---

## 🚨 The Core Problem

We successfully fixed **handler routing logic** (Phases 1-4), but discovered a **fundamental architectural difference** in how `userInput` flows from step to step.

### What We Fixed (Phases 1-4) ✅
- ✅ Handler routing logic in `determineNextStep`
- ✅ Metadata management and storage
- ✅ Permission optimization patterns
- ✅ Missing handlers implementation
- ✅ Database persistence

### What We Missed (Critical) ❌
- ❌ **How userInput propagates to `scriptedResponse`**
- ❌ **When `scriptedResponse` receives previous vs. current input**
- ❌ **Step-to-step data flow architecture**
- ❌ **Step definition expectations about userInput parameter**

---

## 🔍 Issue #1: UserInput Propagation in Base State Machine

### V2 Architecture (Correct)

**File**: `/lib/v2/treatment-state-machine.ts` lines 509-513

```typescript
// Use current user input if provided, otherwise fall back to previous step response
const userInput = currentUserInput || (() => {
  const previousStepId = this.getPreviousStep(step.id, context.currentPhase);
  return previousStepId ? context.userResponses[previousStepId] : undefined;
})();

response = step.scriptedResponse(userInput, context);
```

**Behavior**:
1. When rendering a NEW step after transition, `currentUserInput` is typically `undefined` or empty
2. Falls back to looking up the PREVIOUS step's response via `getPreviousStep()`
3. Each step's `scriptedResponse` can access the INPUT that brought you TO that step
4. Or it can access any historical input via `context.userResponses[stepId]`

**Result**: Step definitions work correctly because they receive appropriate context.

---

### V3 Architecture (Incorrect)

**File**: `/lib/v3/base-state-machine.ts` lines 565, 598

```typescript
// In handleInternalSignal:
const actualResponse = this.getScriptedResponse(nextStep, context, userInput);

// In handleRegularFlow:
const scriptedResponse = this.getScriptedResponse(nextStep, context, userInput);
```

Where `userInput` is the input from the CURRENT/PREVIOUS step being left, not the NEW step being entered.

**File**: `/lib/v3/base-state-machine.ts` line 161

```typescript
private getScriptedResponse(step: TreatmentStep, context: TreatmentContext, currentUserInput?: string): string {
  // ... caching logic ...
  
  if (typeof step.scriptedResponse === 'function') {
    // ❌ PROBLEM: Always uses currentUserInput from previous step
    // ❌ No fallback logic to get the NEW step's appropriate input
    response = step.scriptedResponse(currentUserInput, context);
  }
}
```

**Behavior**:
1. User clicks "1" (Problem) at `mind_shifting_explanation`
2. Routes to `choose_method`
3. `getScriptedResponse(choose_method, context, "1")` is called
4. Step receives userInput="1" from the previous step ✅ (correct here)
5. User clicks "1" (Problem Shifting) at `choose_method`
6. Routes to `work_type_description`
7. `getScriptedResponse(work_type_description, context, "1")` is called ❌
8. Step receives userInput="1" (the method selection) instead of undefined ❌

**Result**: Steps that expect to ASK for input receive PREVIOUS step's input instead.

---

## 🔍 Issue #2: Step Definition Expectations

### Problem Manifestation: `work_type_description` Step

**File**: `/lib/v3/treatment-modalities/work-type-selection.ts` lines 22-42

```typescript
// Check if user input is actually a method name (not a problem description)
const isMethodName = userInput && (
  userInput.toLowerCase().includes('problem shifting') ||
  // ... other method names
);

// If no user input OR if user input is a method name, ask for description
if (!userInput || isMethodName) {
  if (workType === 'problem') {
    return "Tell me what the problem is in a few words.";
  }
  // ...
} else {
  // ❌ This else block is triggered when userInput="1"
  const statement = userInput || '';
  return `Perfect! We'll work on "${statement}" using ${methodName}.`;
}
```

**What V2 Does**:
- `work_type_description` receives `undefined` or empty userInput on first render
- Triggers the `if (!userInput || isMethodName)` block
- Shows: "Tell me what the problem is in a few words."
- User enters problem: "I feel anxious"
- THEN shows: "Perfect! We'll work on 'I feel anxious' using Problem Shifting."

**What V3 Does**:
- `work_type_description` receives userInput="1" (method selection from previous step)
- "1" is truthy and not a method name string
- Skips the if block, goes to else block
- Shows: "Perfect! We'll work on **"1"** using Problem Shifting." ❌

---

## 🔍 Issue #3: Missing `getPreviousStep()` Method in V3

**V2 Has**: `getPreviousStep(stepId, phase)` method (line 511)
**V3 Has**: ❌ No equivalent method

This method is critical for:
- Looking up which step's response should be available
- Providing fallback logic when currentUserInput is not appropriate
- Maintaining proper step-to-step data flow

---

## 📋 Complete List of Fixes Needed

### Fix #1: Add `getPreviousStep()` Method to V3

**File**: `/lib/v3/base-state-machine.ts`

**Action**: Implement a method to determine the logical previous step for any given step.

**Complexity**: Medium - requires understanding of step relationships across all phases.

**Code Location**: Add as a private method in `BaseTreatmentStateMachine` class.

**Reference**: V2 implementation (if it exists - needs verification).

---

### Fix #2: Update `getScriptedResponse()` UserInput Logic

**File**: `/lib/v3/base-state-machine.ts` lines 161-200

**Current Code**:
```typescript
private getScriptedResponse(step: TreatmentStep, context: TreatmentContext, currentUserInput?: string): string {
  // ... caching logic ...
  
  if (typeof step.scriptedResponse === 'function') {
    // ❌ Problem: Always uses currentUserInput as-is
    response = step.scriptedResponse(currentUserInput, context);
  }
}
```

**Required Change**:
```typescript
private getScriptedResponse(step: TreatmentStep, context: TreatmentContext, currentUserInput?: string): string {
  // ... caching logic ...
  
  if (typeof step.scriptedResponse === 'function') {
    // ✅ Fix: Use smart fallback logic like V2
    const userInput = currentUserInput || (() => {
      const previousStepId = this.getPreviousStep(step.id, context.currentPhase);
      return previousStepId ? context.userResponses[previousStepId] : undefined;
    })();
    
    response = step.scriptedResponse(userInput, context);
  }
}
```

**Impact**: All step definitions will receive appropriate userInput.

---

### Fix #3: Update Step Transition Calls to Pass Correct Input

**Files**: 
- `/lib/v3/base-state-machine.ts` line 565 (`handleInternalSignal`)
- `/lib/v3/base-state-machine.ts` line 598 (`handleRegularFlow`)

**Current Code**:
```typescript
// handleInternalSignal (line 565):
const actualResponse = this.getScriptedResponse(nextStep, context, userInput);

// handleRegularFlow (line 598):
const scriptedResponse = this.getScriptedResponse(nextStep, context, userInput);
```

**Analysis Needed**:
- Determine if `userInput` should be passed at all for NEW steps
- Or if it should be `undefined` to trigger fallback logic
- Consider: Does the NEW step need the transition input or its own input?

**Possible Solutions**:

**Option A**: Don't pass userInput for new steps (let fallback handle it)
```typescript
const scriptedResponse = this.getScriptedResponse(nextStep, context); // No userInput
```

**Option B**: Pass userInput but ensure fallback logic handles it appropriately
```typescript
const scriptedResponse = this.getScriptedResponse(nextStep, context, userInput);
// Then rely on the smart fallback in Fix #2
```

**Recommendation**: Option B (keep passing it, fix the fallback logic)

---

### Fix #4: Add Method Selection Number Detection

**File**: `/lib/v3/treatment-modalities/work-type-selection.ts` line 22-30

**Current Code**:
```typescript
const isMethodName = userInput && (
  userInput.toLowerCase().includes('problem shifting') ||
  userInput.toLowerCase().includes('identity shifting') ||
  userInput.toLowerCase().includes('belief shifting') ||
  userInput.toLowerCase().includes('blockage shifting') ||
  userInput.toLowerCase().includes('reality shifting') ||
  userInput.toLowerCase().includes('trauma shifting')
);
```

**Required Addition**:
```typescript
// Check if user input is a single digit (method selection number)
const isMethodSelection = userInput && /^[1-6]$/.test(userInput.trim());

const isMethodName = userInput && (
  userInput.toLowerCase().includes('problem shifting') ||
  userInput.toLowerCase().includes('identity shifting') ||
  userInput.toLowerCase().includes('belief shifting') ||
  userInput.toLowerCase().includes('blockage shifting') ||
  userInput.toLowerCase().includes('reality shifting') ||
  userInput.toLowerCase().includes('trauma shifting')
);

// Line 33: Update condition
if (!userInput || isMethodName || isMethodSelection) {
  // Ask for description
}
```

**Note**: This is a BAND-AID fix. The real fix is Fix #2 above.

---

## 🔍 Issue #4: Other Steps Potentially Affected

### Steps That May Have Similar Issues:

1. **`confirm_statement`** 
   - Expected: Receives the problem statement
   - May receive: Previous step's confirmation input

2. **`choose_method`**
   - Expected: Receives "1" (Problem selection)
   - May receive: Unexpected input if coming from redirect

3. **`goal_description`**
   - Expected: Empty on first render to ask for goal
   - May receive: "2" (Goal selection number)

4. **`negative_experience_description`**
   - Expected: Empty on first render to ask for experience
   - May receive: "3" (Negative experience selection number)

5. **All modality intro steps** (`problem_shifting_intro`, etc.)
   - Expected: Problem statement from context
   - May receive: Method selection or other unrelated input

6. **All "restate" steps** in digging deeper
   - Expected: Empty to prompt for new problem
   - May receive: "yes" from previous permission question

---

## 📊 Testing Checklist After Fixes

### For Each Modality:

#### Problem Shifting
- [ ] Select "1" (Problem) → shows "Tell me what the problem is"
- [ ] Select "1" (Problem Shifting) → shows "Tell me what the problem is" (NOT "We'll work on '1'")
- [ ] Enter problem → shows correct confirmation with actual problem text
- [ ] All cycling steps receive correct problem statement

#### Identity Shifting
- [ ] Same as Problem Shifting flow
- [ ] Identity steps receive identity, not problem
- [ ] Bridge phrases use correct identity

#### Belief Shifting
- [ ] Same as Problem Shifting flow
- [ ] Belief steps receive belief, not problem
- [ ] All 4 checks use correct belief text

#### Blockage Shifting
- [ ] Same as Problem Shifting flow
- [ ] Blockage steps receive blockage, not problem

#### Reality Shifting (Goals)
- [ ] Select "2" (Goal) → shows "Tell me what the goal is"
- [ ] Enter goal → shows correct confirmation with actual goal text
- [ ] All goal steps receive goal, not "2"

#### Trauma Shifting
- [ ] Select "3" (Negative Experience) → shows "Tell me what the negative experience was"
- [ ] Enter experience → shows correct confirmation with actual experience
- [ ] All trauma steps receive experience, not "3"

---

## 🎯 Implementation Priority

### Phase 7: UserInput Flow Architecture Fixes

**Priority**: 🔴 **CRITICAL** - Blocks true V2-V3 parity

**Estimated Effort**: 3-4 hours

**Order of Implementation**:

1. **Fix #1**: Implement `getPreviousStep()` method (30 min)
   - Research V2's implementation
   - Determine step relationships
   - Add to v3 base state machine

2. **Fix #2**: Update `getScriptedResponse()` logic (1 hour)
   - Add fallback logic
   - Test with multiple step types
   - Verify caching still works

3. **Fix #3**: Review transition calls (1 hour)
   - Analyze when to pass userInput
   - Update `handleInternalSignal` and `handleRegularFlow`
   - Ensure consistent behavior

4. **Fix #4**: Add method selection detection (15 min)
   - Update `work_type_description` step
   - Update `goal_description` step
   - Update `negative_experience_description` step

5. **Testing**: Comprehensive flow testing (1-2 hours)
   - Test all 6 modalities
   - Test all step transitions
   - Verify no regressions

---

## 🔐 V2 Protection

**CRITICAL**: All fixes must ONLY modify V3 files:
- ✅ `/lib/v3/base-state-machine.ts`
- ✅ `/lib/v3/treatment-modalities/*.ts`
- ❌ **NO modifications to `/lib/v2/treatment-state-machine.ts`**

---

## 📝 Current Status

**Phases 1-4**: ✅ Complete (Handler routing logic)  
**Phase 5**: ✅ Complete (Verification)  
**Phase 6**: ✅ Complete (Testing guide created)  
**Phase 7**: ✅ **COMPLETE** (UserInput flow fixes - DEPLOYED)

### What Was Found:
- ✅ **Fix #1**: `getPreviousStep()` method already existed in V3 (line 759)
- ✅ **Fix #2**: Fallback logic already existed in V3 (lines 178-181)
- ❌ **Fix #3**: Transition calls were passing wrong userInput (NOW FIXED)
- 🚫 **Fix #4**: Not needed (root fix solved the problem)

### The Critical Issue:
Both `handleInternalSignal()` and `handleRegularFlow()` were passing `userInput` from the CURRENT step when calling `getScriptedResponse()` for the NEXT step. This made the fallback logic NEVER execute because `currentUserInput` was always truthy.

### The Fix:
Removed `userInput` parameter from both `getScriptedResponse()` calls. Now the fallback logic executes, using `getPreviousStep()` to determine appropriate input, or returning `undefined` for steps that should prompt for input.

### Files Changed:
- ✅ `/lib/v3/base-state-machine.ts` (lines 567, 602) - Removed userInput parameter

### V2 Protection:
- ✅ V2 completely untouched
- ✅ Only V3 files modified

---

## 💡 Why This Was Missed

1. **Focus on Handler Logic**: We focused on `determineNextStep()` routing, which was correct
2. **Assumed Step Definitions Were Correct**: Didn't verify step definitions matched v2's input expectations
3. **Architecture Difference**: V3's modular structure has different data flow than v2's monolithic approach
4. **Testing Gap**: No browser testing until after "completion" of Phases 1-6

---

## 🎓 Lessons Learned

1. **Backend ≠ User Experience**: Handler logic can be perfect but user-facing prompts can still be wrong
2. **Data Flow Matters**: How data moves between steps is as important as where steps route to
3. **Architecture Changes Have Ripple Effects**: Modularization changed more than just file structure
4. **Early Testing Critical**: Should test user-facing behavior earlier in the process

---

## 🚀 Next Steps

1. **Implement Fix #1**: Add `getPreviousStep()` method
2. **Implement Fix #2**: Update `getScriptedResponse()` fallback logic
3. **Implement Fix #3**: Review and update transition calls
4. **Implement Fix #4**: Add input type detection in step definitions
5. **Test All Modalities**: Verify each flow from user's perspective
6. **Update Parity Report**: Reflect true parity status after fixes

---

*Document Created: Phase 7 Discovery*  
*Status: Ready for Implementation*  
*Estimated Completion: 3-4 hours of focused work*

