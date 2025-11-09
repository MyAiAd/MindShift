# Comprehensive Fix for Triple-Nesting Issue

## Current Problem

The current fix uses a **single variable** (`returnToDiggingStep`) to track where to return after clearing a nested problem. This fails on triple-nesting scenarios where we need to track **multiple** return points.

### Failure Example:
```
Level 1: Trauma Shifting → trauma_dig_deeper_2
  ├─ User says YES → defines "issue 1" → selects Blockage Shifting
  │
  Level 2: Blockage completes → returns to trauma_dig_deeper_2 ✅
          User is now in Blockage's digging flow → scenario_check_1
          User says YES → defines "issue 3" → selects Problem Shifting
          │
          Level 3: Problem Shifting completes → where to return?
                   ❌ returnToDiggingStep was overwritten
```

**Result:** After clearing "issue 3", we've lost the original `trauma_dig_deeper_2` return point because `scenario_check_1` overwrote it.

---

## Solution: Stack-Based Return Tracking

Replace the single `returnToDiggingStep` variable with a **stack** that can hold multiple return points.

### 1. Update TreatmentContext Interface

**File:** `lib/v2/types.ts` (or wherever `TreatmentContext` is defined)

```typescript
export interface TreatmentContext {
  userId: string;
  sessionId: string;
  currentPhase: string;
  currentStep: string;
  userResponses: Record<string, string>;
  problemStatement?: string;
  metadata: {
    // ... existing fields ...
    
    // OLD (deprecated but keep for backward compatibility):
    returnToDiggingStep?: string;
    
    // NEW: Stack-based return tracking
    diggingReturnStack?: string[];
    
    // ... rest of metadata ...
  };
}
```

---

### 2. Helper Functions for Stack Management

Add these helper methods to `TreatmentStateMachine` class:

```typescript
/**
 * Push a return point onto the digging deeper stack
 * This marks where we should return after clearing a nested problem
 */
private pushDiggingReturn(context: TreatmentContext, returnStep: string): void {
  if (!context.metadata.diggingReturnStack) {
    context.metadata.diggingReturnStack = [];
  }
  context.metadata.diggingReturnStack.push(returnStep);
  console.log(`📚 STACK_PUSH: Added "${returnStep}" to return stack. Stack: [${context.metadata.diggingReturnStack.join(', ')}]`);
}

/**
 * Pop and return the most recent return point from the stack
 * Returns undefined if stack is empty
 */
private popDiggingReturn(context: TreatmentContext): string | undefined {
  if (!context.metadata.diggingReturnStack || context.metadata.diggingReturnStack.length === 0) {
    console.log('📚 STACK_POP: Stack is empty');
    return undefined;
  }
  const returnStep = context.metadata.diggingReturnStack.pop();
  console.log(`📚 STACK_POP: Popped "${returnStep}" from stack. Remaining: [${context.metadata.diggingReturnStack.join(', ')}]`);
  return returnStep;
}

/**
 * Peek at the top of the stack without removing it
 * Returns undefined if stack is empty
 */
private peekDiggingReturn(context: TreatmentContext): string | undefined {
  if (!context.metadata.diggingReturnStack || context.metadata.diggingReturnStack.length === 0) {
    return undefined;
  }
  return context.metadata.diggingReturnStack[context.metadata.diggingReturnStack.length - 1];
}

/**
 * Clear the entire digging return stack
 * Use when resetting digging deeper flow or on errors
 */
private clearDiggingReturnStack(context: TreatmentContext): void {
  console.log('📚 STACK_CLEAR: Clearing entire return stack');
  context.metadata.diggingReturnStack = [];
}
```

---

### 3. Update All "Push" Locations (Where We Set Return Points)

Replace all instances of:
```typescript
context.metadata.returnToDiggingStep = 'some_step';
```

With:
```typescript
this.pushDiggingReturn(context, 'some_step');
```

**Affected locations:**

#### A. Trauma Shifting Digging Questions
```typescript
// File: lib/v2/treatment-state-machine.ts

case 'trauma_dig_deeper':
  if (lastResponse.includes('yes')) {
    context.metadata.workType = 'problem';
    context.metadata.selectedMethod = undefined;
    context.currentPhase = 'digging_deeper';
    // OLD: context.metadata.returnToDiggingStep = 'trauma_dig_deeper';
    this.pushDiggingReturn(context, 'trauma_dig_deeper'); // NEW
    return 'restate_problem_future';
  }
  break;

case 'trauma_dig_deeper_2':
  if (lastResponse.includes('yes')) {
    context.metadata.workType = 'problem';
    context.metadata.selectedMethod = undefined;
    context.currentPhase = 'digging_deeper';
    // OLD: context.metadata.returnToDiggingStep = 'trauma_dig_deeper_2';
    this.pushDiggingReturn(context, 'trauma_dig_deeper_2'); // NEW
    return 'restate_problem_future';
  }
  break;
```

#### B. Blockage Shifting Digging Questions
```typescript
// These 5 cases we just added in the previous fix:

case 'clear_scenario_problem_1':
  if (scenario1Problem) {
    context.problemStatement = scenario1Problem;
    context.metadata.currentDiggingProblem = scenario1Problem;
  }
  // OLD: context.metadata.returnToDiggingStep = 'scenario_check_1';
  this.pushDiggingReturn(context, 'scenario_check_1'); // NEW
  this.clearPreviousModalityMetadata(context);
  // ... routing logic ...
  break;

case 'clear_scenario_problem_2':
  if (scenario2Problem) {
    context.problemStatement = scenario2Problem;
    context.metadata.currentDiggingProblem = scenario2Problem;
  }
  // OLD: context.metadata.returnToDiggingStep = 'scenario_check_2';
  this.pushDiggingReturn(context, 'scenario_check_2'); // NEW
  this.clearPreviousModalityMetadata(context);
  // ... routing logic ...
  break;

case 'clear_scenario_problem_3':
  if (scenario3Problem) {
    context.problemStatement = scenario3Problem;
    context.metadata.currentDiggingProblem = scenario3Problem;
  }
  // OLD: context.metadata.returnToDiggingStep = 'scenario_check_3';
  this.pushDiggingReturn(context, 'scenario_check_3'); // NEW
  this.clearPreviousModalityMetadata(context);
  // ... routing logic ...
  break;

case 'clear_anything_else_problem_1':
  if (anythingElse1Problem) {
    context.problemStatement = anythingElse1Problem;
    context.metadata.currentDiggingProblem = anythingElse1Problem;
  }
  // OLD: context.metadata.returnToDiggingStep = 'anything_else_check_1';
  this.pushDiggingReturn(context, 'anything_else_check_1'); // NEW
  this.clearPreviousModalityMetadata(context);
  // ... routing logic ...
  break;

case 'clear_anything_else_problem_2':
  if (anythingElse2Problem) {
    context.problemStatement = anythingElse2Problem;
    context.metadata.currentDiggingProblem = anythingElse2Problem;
  }
  // OLD: context.metadata.returnToDiggingStep = 'anything_else_check_2';
  this.pushDiggingReturn(context, 'anything_else_check_2'); // NEW
  this.clearPreviousModalityMetadata(context);
  // ... routing logic ...
  break;
```

#### C. Standard Digging Deeper Questions (Future, Scenario)
```typescript
case 'future_problem_check':
  if (lastResponse.includes('yes')) {
    context.metadata.workType = 'problem';
    context.metadata.selectedMethod = undefined;
    context.currentPhase = 'digging_deeper';
    // OLD: context.metadata.returnToDiggingStep = 'future_problem_check';
    this.pushDiggingReturn(context, 'future_problem_check'); // NEW
    return 'restate_problem_future';
  }
  break;

case 'scenario_check_1':
  if (lastResponse.includes('yes')) {
    // OLD: context.metadata.returnToDiggingStep = 'scenario_check_1';
    this.pushDiggingReturn(context, 'scenario_check_1'); // NEW
    return 'restate_scenario_problem_1';
  }
  break;

case 'scenario_check_2':
  if (lastResponse.includes('yes')) {
    // OLD: context.metadata.returnToDiggingStep = 'scenario_check_2';
    this.pushDiggingReturn(context, 'scenario_check_2'); // NEW
    return 'restate_scenario_problem_2';
  }
  break;

case 'scenario_check_3':
  if (lastResponse.includes('yes')) {
    // OLD: context.metadata.returnToDiggingStep = 'scenario_check_3';
    this.pushDiggingReturn(context, 'scenario_check_3'); // NEW
    return 'restate_scenario_problem_3';
  }
  break;

case 'anything_else_check_1':
  if (lastResponse.includes('yes')) {
    // OLD: context.metadata.returnToDiggingStep = 'anything_else_check_1';
    this.pushDiggingReturn(context, 'anything_else_check_1'); // NEW
    return 'restate_anything_else_problem_1';
  }
  break;

case 'anything_else_check_2':
  if (lastResponse.includes('yes')) {
    // OLD: context.metadata.returnToDiggingStep = 'anything_else_check_2';
    this.pushDiggingReturn(context, 'anything_else_check_2'); // NEW
    return 'restate_anything_else_problem_2';
  }
  break;
```

#### D. Conditional Preservation Logic (digging_method_selection, restate_problem_future)

**IMPORTANT:** These locations had conditional logic to preserve trauma steps. **Remove that logic** since the stack handles it naturally:

```typescript
case 'digging_method_selection':
  // ... other logic ...
  
  // OLD CONDITIONAL LOGIC - REMOVE THIS:
  // if (!context.metadata.returnToDiggingStep || 
  //     context.metadata.returnToDiggingStep === 'future_problem_check') {
  //   context.metadata.returnToDiggingStep = 'future_problem_check';
  // }
  
  // NEW: Just push if we haven't already (check if top of stack is already this step)
  const currentTop = this.peekDiggingReturn(context);
  if (currentTop !== 'future_problem_check') {
    this.pushDiggingReturn(context, 'future_problem_check');
  }
  
  return 'restate_problem_future';

case 'restate_problem_future':
  // ... other logic ...
  
  // OLD CONDITIONAL LOGIC - REMOVE THIS:
  // if (!context.metadata.returnToDiggingStep || 
  //     context.metadata.returnToDiggingStep === 'future_problem_check') {
  //   context.metadata.returnToDiggingStep = 'future_problem_check';
  // }
  
  // NEW: Don't push here at all - it's already been pushed by the question step
  // Just continue to method selection
  
  return 'digging_method_selection';
```

---

### 4. Update All "Pop" Locations (Where We Return After Clearing)

Replace all instances of:
```typescript
const returnStep = context.metadata?.returnToDiggingStep;
if (returnStep) {
  context.currentPhase = 'digging_deeper';
  context.metadata.returnToDiggingStep = undefined;
  return returnStep;
}
```

With:
```typescript
const returnStep = this.popDiggingReturn(context);
if (returnStep) {
  context.currentPhase = 'digging_deeper';
  return returnStep;
}
```

**Affected locations:**

```typescript
// Problem Shifting completion
case 'check_if_still_problem':
  if (lastResponse.includes('no') || lastResponse.includes('not')) {
    // OLD:
    // const returnStep = context.metadata?.returnToDiggingStep;
    // if (returnStep) {
    //   context.currentPhase = 'digging_deeper';
    //   context.metadata.returnToDiggingStep = undefined;
    //   return returnStep;
    // }
    
    // NEW:
    const returnStep = this.popDiggingReturn(context);
    if (returnStep) {
      context.currentPhase = 'digging_deeper';
      return returnStep;
    }
    
    // No return point - first completion
    context.currentPhase = 'digging_deeper';
    return 'digging_deeper_start';
  }
  break;

// Identity Shifting completion
case 'identity_dissolve_step_e':
  if (lastResponse.includes('no') || lastResponse.includes('not')) {
    // OLD:
    // const returnStep = context.metadata?.returnToDiggingStep;
    // if (returnStep) {
    //   context.currentPhase = 'digging_deeper';
    //   context.metadata.returnToDiggingStep = undefined;
    //   return returnStep;
    // }
    
    // NEW:
    const returnStep = this.popDiggingReturn(context);
    if (returnStep) {
      context.currentPhase = 'digging_deeper';
      return returnStep;
    }
    
    // No return point - first completion
    context.currentPhase = 'digging_deeper';
    return 'digging_deeper_start';
  }
  break;

// Belief Shifting completion
case 'belief_shift_step_d':
  if (lastResponse.includes('no') || lastResponse.includes('not')) {
    // OLD:
    // const returnStep = context.metadata?.returnToDiggingStep;
    // if (returnStep) {
    //   context.currentPhase = 'digging_deeper';
    //   context.metadata.returnToDiggingStep = undefined;
    //   return returnStep;
    // }
    
    // NEW:
    const returnStep = this.popDiggingReturn(context);
    if (returnStep) {
      context.currentPhase = 'digging_deeper';
      return returnStep;
    }
    
    // No return point - first completion
    context.currentPhase = 'digging_deeper';
    return 'digging_deeper_start';
  }
  break;

// Blockage Shifting completion
case 'blockage_step_e':
  if (lastResponse.includes('no') || lastResponse.includes('not')) {
    const alreadyGrantedPermission = context.userResponses['digging_deeper_start'] === 'yes';
    
    // OLD:
    // const returnStep = context.metadata?.returnToDiggingStep;
    
    // NEW:
    const returnStep = this.popDiggingReturn(context);
    
    if (alreadyGrantedPermission && returnStep) {
      context.currentPhase = 'digging_deeper';
      // OLD: context.metadata.returnToDiggingStep = undefined;
      // NEW: No need to clear - already popped
      return returnStep;
    } else if (alreadyGrantedPermission) {
      context.currentPhase = 'digging_deeper';
      return 'trauma_dig_deeper';
    } else {
      context.currentPhase = 'digging_deeper';
      context.metadata.diggingType = 'trauma';
      return 'digging_deeper_start';
    }
  }
  break;

// Similar updates for:
// - reality_shift_step_e
// - mind_shift_step_e  
// - Any other modality completion points
```

---

### 5. Update Undo Handler

**File:** `app/api/treatment-v2/route.ts`

Replace the `returnToDiggingStep` clearing logic with stack clearing:

```typescript
// OLD:
if (clearedSteps.some(step => 
    step === 'future_problem_check' || 
    step.startsWith('scenario_check_') ||
    step.startsWith('clear_scenario_problem_') ||
    step.startsWith('clear_anything_else_problem_') ||
    step === 'trauma_dig_deeper' ||
    step === 'trauma_dig_deeper_2' ||
    step === 'anything_else_check_1' ||
    step === 'anything_else_check_2'
)) {
  console.log('🧹 UNDO_TRACKING: Clearing returnToDiggingStep');
  context.metadata.returnToDiggingStep = undefined;
}

// NEW:
if (clearedSteps.some(step => 
    step === 'future_problem_check' || 
    step.startsWith('scenario_check_') ||
    step.startsWith('clear_scenario_problem_') ||
    step.startsWith('clear_anything_else_problem_') ||
    step === 'trauma_dig_deeper' ||
    step === 'trauma_dig_deeper_2' ||
    step === 'anything_else_check_1' ||
    step === 'anything_else_check_2'
)) {
  console.log('🧹 UNDO_TRACKING: Clearing digging return stack');
  context.metadata.diggingReturnStack = [];
  context.metadata.returnToDiggingStep = undefined; // Legacy cleanup
}
```

---

### 6. Update digging_deeper_start

**File:** `lib/v2/treatment-state-machine.ts`

```typescript
case 'digging_deeper_start':
  console.log(`🔍 DIGGING_DEEPER_START: currentPhase="${context.currentPhase}", lastResponse="${lastResponse}"`);
  context.currentPhase = 'digging_deeper';
  
  if (lastResponse.includes('yes')) {
    // OLD:
    // const returnStep = context.metadata?.returnToDiggingStep;
    // if (returnStep) {
    //   context.metadata.returnToDiggingStep = undefined;
    //   return returnStep;
    // }
    
    // NEW:
    const returnStep = this.popDiggingReturn(context);
    if (returnStep) {
      console.log(`🔍 DIGGING_DEEPER_START: Returning to saved step: ${returnStep}`);
      return returnStep;
    }
    
    // Check if coming from trauma shifting
    if (context.metadata?.diggingType === 'trauma') {
      context.metadata.diggingType = undefined;
      return 'trauma_dig_deeper';
    }
    
    return 'future_problem_check';
  }
  
  if (lastResponse.includes('no')) {
    // Clear the entire stack since user declined digging deeper
    this.clearDiggingReturnStack(context);
    return 'integration_start';
  }
  break;
```

---

### 7. Backward Compatibility Migration

Add migration logic in the `processStep` method to convert old single-value format to stack:

```typescript
private async processStep(
  currentStep: TreatmentStep,
  userInput: string,
  context: TreatmentContext
): Promise<ProcessStepResult> {
  // MIGRATION: Convert old returnToDiggingStep to stack format
  if (context.metadata.returnToDiggingStep && 
      (!context.metadata.diggingReturnStack || context.metadata.diggingReturnStack.length === 0)) {
    console.log(`🔄 MIGRATION: Converting returnToDiggingStep="${context.metadata.returnToDiggingStep}" to stack`);
    this.pushDiggingReturn(context, context.metadata.returnToDiggingStep);
    context.metadata.returnToDiggingStep = undefined; // Clear old format
  }
  
  // ... rest of processStep logic ...
}
```

---

## Testing Strategy

### Test Case 1: Single-Level Nesting (Baseline)
1. Start Trauma Shifting → define trauma
2. Answer YES to `trauma_dig_deeper_2`
3. Define "issue 1" → select Problem Shifting
4. Complete Problem Shifting
5. **Verify:** Returns to `trauma_dig_deeper_2` ✅

### Test Case 2: Double-Level Nesting (Blockage's Own Digging)
1. Start Blockage Shifting → define problem
2. Complete Blockage → answer YES to `scenario_check_1`
3. Define "issue 2" → select Problem Shifting
4. Complete Problem Shifting
5. **Verify:** Returns to `scenario_check_1` ✅

### Test Case 3: Triple-Level Nesting (THE BIG ONE)
1. Start Trauma Shifting → define trauma
2. Answer YES to `trauma_dig_deeper_2`
3. Define "issue 1" → select Blockage Shifting
4. Complete Blockage → answer YES to `scenario_check_1`
5. Define "issue 3" → select Problem Shifting
6. Complete Problem Shifting
7. **Verify:** Returns to `scenario_check_1` ✅
8. Answer NO to `scenario_check_1/2/3` and `anything_else_check_1/2`
9. Complete Blockage
10. **Verify:** Returns to `trauma_dig_deeper_2` ✅✅✅

### Test Case 4: Undo from Triple-Nesting
1. Follow Test Case 3 through step 7
2. Click undo multiple times
3. **Verify:** Stack is properly cleared and no 500 errors ✅

---

## Migration Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Existing sessions break** | HIGH | Migration logic converts old format to stack |
| **Stack grows unbounded** | LOW | Cleared on undo, digging completion, and "no" responses |
| **Race conditions** | LOW | Stack operations are synchronous |
| **Debugging complexity** | MEDIUM | Extensive logging added for stack operations |

---

## Estimated Impact

- **Files Changed:** 2 (treatment-state-machine.ts, route.ts)
- **Lines Changed:** ~100-150 lines
- **Risk Level:** MEDIUM (structural change but well-contained)
- **Testing Required:** EXTENSIVE (need all 4 test cases above)
- **Backward Compatible:** YES (with migration logic)

---

## Summary

This stack-based solution:
1. ✅ Fixes triple-nesting
2. ✅ Maintains backward compatibility
3. ✅ Adds comprehensive logging
4. ✅ Handles undo properly
5. ✅ Clears stack on digging completion or decline
6. ✅ Surgical and localized to digging deeper flow

**Recommendation:** Implement this as Phase 2 refactor after confirming current fix works in production.



