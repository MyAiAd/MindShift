# Problem Shifting v2 - Step 2C Variable Substitution Bug

## Bug Report Summary

**Location:** Step 2C (`what_needs_to_happen_step`)  
**Problem:** Using `[LAST RESPONSE]` instead of `[PROBLEM]`

**Current behavior:**
```
"Feel 'sad 1'... what needs to happen for this to not be a problem?"
```

**Expected behavior (per flowchart):**
```
"Feel 'problem 1'... what needs to happen for this to not be a problem?"
```

## Root Cause Analysis

### The Problematic Code
**Location:** `/lib/v2/treatment-state-machine.ts` lines 2309-2323

```typescript
{
  id: 'what_needs_to_happen_step',
  scriptedResponse: (userInput, context) => {
    // Get the previous response from body_sensation_check to maintain flow continuity
    const previousResponse = context?.userResponses?.['body_sensation_check'] || userInput || 'this';
    return `Feel '${previousResponse}'... what needs to happen for this to not be a problem?`;
    //                 ^^^^^^^^^^^^^^^^ WRONG: Uses LAST RESPONSE (from step B)
  },
```

### Why This Is Wrong

According to the Problem Shifting v2 flowchart:

- **Step A** (`problem_shifting_intro`): "Feel [PROBLEM]... what does it feel like?"
- **Step B** (`body_sensation_check`): "Feel [LAST RESPONSE]... what happens in yourself when you feel [LAST RESPONSE]?"
- **Step C** (`what_needs_to_happen_step`): "Feel [PROBLEM]... what needs to happen for this to not be a problem?" ← Should use PROBLEM

**The pattern:**
- Steps A and C reference the **original PROBLEM**
- Steps B, D, E, F reference **LAST RESPONSE** (creates the flow continuity)
- Step G (check) references the **original PROBLEM** again

### Comparison with Correct Implementation

**Step A (Correct)** - Lines 2264-2284:
```typescript
{
  id: 'problem_shifting_intro',
  scriptedResponse: (userInput, context) => {
    const diggingProblem = context?.metadata?.currentDiggingProblem;
    const cleanProblemStatement = diggingProblem || 
                                  context?.metadata?.problemStatement || 
                                  context?.problemStatement || 
                                  'the problem';
    return `Feel the problem '${cleanProblemStatement}'... what does it feel like?`;
    //                          ^^^^^^^^^^^^^^^^^^^^^ CORRECT: Uses PROBLEM
  },
```

**Step C (Incorrect)** - Lines 2309-2314:
```typescript
{
  id: 'what_needs_to_happen_step',
  scriptedResponse: (userInput, context) => {
    const previousResponse = context?.userResponses?.['body_sensation_check'] || userInput || 'this';
    return `Feel '${previousResponse}'... what needs to happen for this to not be a problem?`;
    //             ^^^^^^^^^^^^^^^^ WRONG: Should use cleanProblemStatement like Step A
  },
```

## User's Example

From the session log:
1. **Problem:** "problem 1"
2. **Step A response:** "bad 1"
3. **Step B response:** "sad 1"
4. **Step C shows:** "Feel 'sad 1'... what needs to happen for this to not be a problem?"
   - ❌ Should be: "Feel 'problem 1'... what needs to happen for this to not be a problem?"

## Impact Assessment

### Severity: MEDIUM
- **Clinical Impact:** MEDIUM - Changes the therapeutic context. Step C should ground back to the original problem, not continue with the feeling cascade
- **User Confusion:** MEDIUM - User expects to address the problem, but gets asked about the feeling
- **Code Complexity:** LOW - Simple variable substitution fix

### What Will Break if Fixed?
**NOTHING.** This is a straightforward variable substitution that aligns with protocol.

### What Will Be Fixed?
1. ✅ Step C will correctly reference the original problem
2. ✅ Flow will match the protocol flowchart exactly
3. ✅ Maintains proper grounding to the problem throughout the cycle

## The Fix

### Current Code (Lines 2309-2314):
```typescript
{
  id: 'what_needs_to_happen_step',
  scriptedResponse: (userInput, context) => {
    // Get the previous response from body_sensation_check to maintain flow continuity
    const previousResponse = context?.userResponses?.['body_sensation_check'] || userInput || 'this';
    return `Feel '${previousResponse}'... what needs to happen for this to not be a problem?`;
  },
```

### Corrected Code:
```typescript
{
  id: 'what_needs_to_happen_step',
  scriptedResponse: (userInput, context) => {
    // Step C should reference the PROBLEM (not the last response) per protocol flowchart
    const diggingProblem = context?.metadata?.currentDiggingProblem;
    const cleanProblemStatement = diggingProblem || 
                                  context?.metadata?.problemStatement || 
                                  context?.problemStatement || 
                                  'the problem';
    return `Feel '${cleanProblemStatement}'... what needs to happen for this to not be a problem?`;
  },
```

## Problem Shifting v2 Flow Pattern

### Correct Pattern (After Fix):

```
Step A: Feel [PROBLEM] ... what does it feel like?
    ↓ (captures feeling)
Step B: Feel [LAST RESPONSE] ... what happens in yourself?
    ↓ (explores the feeling)
Step C: Feel [PROBLEM] ... what needs to happen for this to not be a problem?
    ↓ (grounds back to problem, identifies solution)
Step D: What would you feel like if [SOLUTION] had already happened?
    ↓ (imagines outcome)
Step E: Feel [LAST RESPONSE] ... what does it feel like?
    ↓ (explores positive feeling)
Step F: Feel [LAST RESPONSE] ... what happens in yourself?
    ↓ (deepens positive feeling)
Step G: Feel [PROBLEM] ... does it still feel like a problem?
    ↓ (checks if resolved)
```

**Key insight:** Steps A, C, and G all reference the **PROBLEM** to maintain grounding  
Steps B, D, E, F reference **LAST RESPONSE** to explore feelings and solutions

## Testing Strategy

### Before Fix:
```
Problem: "I feel anxious"
Step A response: "tight"
Step B response: "pressure"
Step C shows: "Feel 'pressure'... what needs to happen..." ❌
```

### After Fix:
```
Problem: "I feel anxious"  
Step A response: "tight"
Step B response: "pressure"
Step C shows: "Feel 'I feel anxious'... what needs to happen..." ✅
```

### Regression Testing:
Verify these steps remain correct:
- Step A (problem_shifting_intro) → Uses PROBLEM ✓
- Step B (body_sensation_check) → Uses LAST RESPONSE ✓
- Step D (feel_solution_state) → Uses LAST RESPONSE (from C) ✓
- Step E (feel_good_state) → Uses LAST RESPONSE (from D) ✓
- Step F (what_happens_step) → Uses LAST RESPONSE (from E) ✓
- Step G (check_if_still_problem) → Uses PROBLEM ✓

## Related Code References

### Where cleanProblemStatement Pattern Is Used:
1. `problem_shifting_intro` (line 2267) - ✅ Correct
2. `check_if_still_problem` (likely uses problem) - Need to verify
3. `what_needs_to_happen_step` (line 2312) - ❌ **BUG: Needs fix**

### Cache Configuration:
Line 552 shows `what_needs_to_happen_step` is marked as never-cache:
```typescript
step.id === 'what_needs_to_happen_step' ||
```
This is correct - should remain after fix since it now uses dynamic problem statement.

## Recommendation

**Fix Priority:** HIGH (once current Identity Shifting fix is verified)

**Implementation Risk:** LOW
- Single-line variable change
- Matches established pattern from step A
- No control flow changes
- No database/API changes

**Validation:** Compare with Problem Shifting v2 protocol flowchart ✅

