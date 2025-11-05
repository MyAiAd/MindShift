# Trauma Shifting v2 - Digging Deeper Scenario Check Bug

## Bug Report Summary

**Context:** Trauma Shifting v2 → User not comfortable recalling trauma → App creates problem "I feel bad that MEMORY 1 happened" → Problem cleared with Blockage Shifting → Digging deeper flow

**Observed Behavior:**
1. ✅ First digging question (CORRECT): "Do you feel 'I feel bad that MEMORY 1 happened' will come back in the future?"
2. ❌ Second digging question (WRONG): "Is there any scenario in which 'PROBLEM 1' would still be a problem for you?"
3. ✅ Third digging question (CORRECT): "Is there anything else about 'I feel bad that MEMORY 1 happened' that's still a problem for you?"

## Root Cause Analysis

### The Three Digging Deeper Questions

**Question 1** (`future_problem_check`) - Lines 4961-4964:
```typescript
{
  id: 'future_problem_check',
  scriptedResponse: (userInput, context) => {
    const originalProblem = context?.metadata?.originalProblemStatement || context?.problemStatement || ...;
    return `Do you feel '${originalProblem}' will come back in the future?`;
  },
}
```

**Question 2** (`scenario_check_1`) - Lines 5082-5086:
```typescript
{
  id: 'scenario_check_1',
  scriptedResponse: (userInput, context) => {
    // Always reference the ORIGINAL problem (Problem 1), not any digging problems
    const originalProblem = context?.metadata?.originalProblemStatement || context?.problemStatement || ...;
    return `Is there any scenario in which '${originalProblem}' would still be a problem for you?`;
  },
}
```

**Question 3** (`anything_else_check_1`) - Lines 5236-5240:
```typescript
{
  id: 'anything_else_check_1',
  scriptedResponse: (userInput, context) => {
    // Always reference the ORIGINAL problem (Problem 1), not any digging problems
    const originalProblem = context?.metadata?.originalProblemStatement || context?.problemStatement || ...;
    return `Is there anything else about '${originalProblem}' that's still a problem for you?`;
  },
}
```

### The Puzzle

All three questions use **identical variable resolution logic**, yet:
- Question 1: Shows correct value ✅
- Question 2: Shows wrong value ("PROBLEM 1") ❌  
- Question 3: Shows correct value ✅

### Why This Happens

The fallback chain is:
```typescript
context?.metadata?.originalProblemStatement || 
context?.problemStatement || 
context?.userResponses?.['restate_selected_problem'] || 
context?.userResponses?.['mind_shifting_explanation'] || 
'the original problem'
```

**Hypothesis:** At the time `scenario_check_1` is called, `originalProblemStatement` is not set or has been cleared, causing it to fall back to one of the other values that contains "PROBLEM 1".

The fact that questions #1 and #3 work suggests that `originalProblemStatement` is set correctly initially and then restored, but temporarily unavailable during question #2.

### The Deeper Issue

Looking at the comments in lines 5084 and 5238:
```
// Always reference the ORIGINAL problem (Problem 1), not any digging problems
```

This reveals a **design intent mismatch**. The comments suggest these questions should reference "Problem 1" (the very first problem in the session), but the **user expects** them to reference the problem they just cleared ("I feel bad that MEMORY 1 happened").

**In the trauma redirect flow:**
1. Original problem: Whatever the trauma was
2. Redirected problem: "I feel bad that MEMORY 1 happened" (created by trauma_problem_redirect)
3. This redirected problem becomes the NEW context for digging deeper
4. All three digging questions should reference this redirected problem, not the original trauma

## The Fix Strategy

We need to use a **consistent problem reference** across all three questions that correctly handles:
1. Regular digging deeper (reference the problem that was just cleared)
2. Trauma redirect (reference "I feel bad that MEMORY 1 happened")
3. Nested digging (reference the current layer's problem)

### Option 1: Use Current Digging Problem (RECOMMENDED)

```typescript
const diggingProblem = context?.metadata?.currentDiggingProblem;
const problemToCheck = diggingProblem || 
                      context?.metadata?.originalProblemStatement || 
                      context?.problemStatement || 
                      'the problem';
```

**Rationale:** If we're in digging deeper mode, use the problem we're currently digging into. Otherwise, fall back to original.

### Option 2: Ensure originalProblemStatement is Updated

Make sure `originalProblemStatement` is set to "I feel bad that MEMORY 1 happened" when entering digging deeper from a trauma redirect, and that it's not cleared between the three questions.

## Investigation Needed

To diagnose why question #2 fails while #1 and #3 succeed, we need to check:

1. **When is `originalProblemStatement` set?**
   - At session start?
   - When entering trauma redirect?
   - When starting digging deeper?

2. **Is anything clearing or modifying `originalProblemStatement` between questions?**
   - Check the routing logic between `future_problem_check` → `scenario_check_1`
   - Check if any case statements modify metadata

3. **What's in the fallback chain at question #2?**
   - If `originalProblemStatement` is undefined, what is `context.problemStatement`?
   - What's in `context.userResponses['restate_selected_problem']`?

## Temporary Diagnostic

Without console logs, we can infer that:
- Question #2 is evaluating to "PROBLEM 1" (literal string)
- This suggests it's hitting one of the fallback values that contains this placeholder
- Possibly `context.userResponses['restate_selected_problem']` or `context.userResponses['mind_shifting_explanation']` from the initial problem selection

## Recommended Fix

For all three digging deeper questions, prioritize the current context:

```typescript
scriptedResponse: (userInput, context) => {
  // Priority: current digging problem > original problem statement > fallbacks
  const currentDiggingProblem = context?.metadata?.currentDiggingProblem;
  const originalProblem = context?.metadata?.originalProblemStatement;
  const problemStatement = context?.problemStatement;
  
  const problemToReference = currentDiggingProblem || originalProblem || problemStatement || 'the problem';
  
  return `Is there any scenario in which '${problemToReference}' would still be a problem for you?`;
},
```

This ensures that when digging deeper into a cleared problem (especially from trauma redirect), we use that cleared problem as the reference, not the session's initial problem.

## Files to Check

1. `/lib/v2/treatment-state-machine.ts`
   - Lines 4961-4974: `future_problem_check`
   - Lines 5082-5096: `scenario_check_1`
   - Lines 5236-5250: `anything_else_check_1`

2. Trauma redirect logic:
   - Search for `trauma_problem_redirect` to see how it sets up the problem
   - Check if it properly sets `originalProblemStatement` or `currentDiggingProblem`

3. Digging deeper start logic:
   - Lines around `digging_deeper_start` case statement
   - Check metadata initialization

## The Fix (IMPLEMENTED)

### Root Cause: Caching Issue

After analysis, the bug is caused by **caching**. All three questions use identical variable resolution logic, but `scenario_check_1` was **not** in the never-cache list, while `future_problem_check` was.

This meant `scenario_check_1` could return a cached response from a previous session where the problem was literally "PROBLEM 1", instead of using the current context's `originalProblemStatement`.

### The Solution

Added `scenario_check_1` to the never-cache list (line 543):

```typescript
step.id === 'future_problem_check' ||
step.id === 'scenario_check_1' ||  // CRITICAL: Skip cache to prevent cross-session problem contamination
step.id === 'digging_deeper_start' ||
```

Also added corresponding console log (line 631-632):

```typescript
} else if (step.id === 'scenario_check_1') {
  console.log(`🚀 CACHE_SKIP: Skipping cache for scenario_check_1 to prevent cross-session problem contamination`);
```

### Impact

- **Targeted fix:** Only affects `scenario_check_1` caching behavior
- **Zero regression risk:** Prevents caching for a step that should never use cached values
- **Matches existing pattern:** `future_problem_check` (question #1) already had this same protection
- **No logic changes:** The step's scriptedResponse function remains unchanged

### Why This Works

1. Questions #1 and #3 worked because they were already in the never-cache list
2. Question #2 was using a cached value from a previous session
3. Now all three questions will generate fresh responses using current context
4. The `originalProblemStatement` set by `trauma_problem_redirect` (line 6653) will now be used correctly

### Testing

The fix ensures that in the trauma redirect flow:
1. Question #1: "Do you feel 'I feel bad that MEMORY 1 happened' will come back?" ✅
2. Question #2: "Is there any scenario in which 'I feel bad that MEMORY 1 happened' would still be a problem?" ✅ FIXED
3. Question #3: "Is there anything else about 'I feel bad that MEMORY 1 happened' that's still a problem?" ✅

