# Identity Shifting v2 - Bridge Phrase Repetition Bug

## Bug Report Summary

**Problem:** Bridge phrases ("Put yourself in the future and..." or "Imagine that scenario and...") are being used on EVERY cycle from Step 3F back to Step 3A, instead of just the FIRST cycle after returning from a Step 4 check question.

**Expected Behavior:**
1. User fails Step 4 check (future or scenario) → Return to 3A with bridge phrase (FIRST time)
2. Cycle 3A → 3F, step 3F says YES → Return to 3A without bridge phrase (subsequent cycles)
3. Only use bridge phrase once per check failure

**Actual Behavior:**
1. User fails Step 4 check → Return to 3A with bridge phrase ✓
2. Cycle 3A → 3F, step 3F says YES → Return to 3A with bridge phrase AGAIN ✗
3. Bridge phrase repeats on every cycle

## Root Cause Analysis

### The Problematic Code

**Location:** `/lib/v2/treatment-state-machine.ts` lines 2870-2882

```typescript
// Determine the appropriate prefix based on which checking question we're returning from
const returnTo = context.metadata.returnToIdentityCheck;
let prefix = 'Feel yourself being';

if (returnTo === 'identity_future_check') {
  // Coming from future check: "Do you think you might feel yourself being ... in the future?"
  prefix = 'Put yourself in the future and feel yourself being';
  // DON'T clear the flag here - we need it in identity_dissolve_step_f to know where to return
} else if (returnTo === 'identity_scenario_check') {
  // Coming from scenario check: "Is there any scenario in which you might still feel yourself being..."
  prefix = 'Imagine that scenario and feel yourself being';
  // DON'T clear the flag here - we need it in identity_dissolve_step_f to know where to return
}

return `${prefix} '${identity}'... what does it feel like?`;
```

**Line 6450:** When step 3F gets "yes" and cycles back:
```typescript
console.log(`🔍 IDENTITY_DISSOLVE_STEP_F: User said YES, cycling back to dissolve step A`);
context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
// Keep returnToIdentityCheck flag so we return to the correct Step 4 checking question after the cycle
return 'identity_dissolve_step_a';
```

### The Issue

The comment at lines 2877 and 2881 says "DON'T clear the flag here - we need it in identity_dissolve_step_f to know where to return"

This causes the flag to persist across ALL cycles, making step 3A use the bridge phrase every time.

**Flow with current code:**
```
1. identity_future_check (YES) → Set returnToIdentityCheck flag → Go to 3A
2. Step 3A: Check flag → Use bridge "Put yourself in the future..." → DON'T clear flag
3. Cycle: 3A → 3B → 3C → 3D → 3E → 3F
4. Step 3F (YES) → Keep flag → Go to 3A
5. Step 3A: Check flag AGAIN → Use bridge AGAIN ✗ BUG
6. Repeat: Every cycle uses the bridge phrase
```

## The Fix

Clear the `returnToIdentityCheck` flag in step 3A **after** using it for the bridge phrase.

### Why This Works

The flag serves one purpose: tell step 3A to use a bridge phrase on the **first** return from a check question.

**Corrected flow:**
```
1. identity_future_check (YES) → Set returnToIdentityCheck flag → Go to 3A
2. Step 3A: Check flag → Use bridge "Put yourself in the future..." → CLEAR flag ✓
3. Cycle: 3A → 3B → 3C → 3D → 3E → 3F
4. Step 3F (YES) → Go to 3A (no flag set)
5. Step 3A: No flag → Use normal "Feel yourself being..." ✓ CORRECT
6. Subsequent cycles: No bridge phrase
```

### What About Step 3F Returning to Check Questions?

Line 6437-6441 checks the flag to know where to return when user says NO:
```typescript
const returnToCheck = context.metadata.returnToIdentityCheck;
if (returnToCheck) {
  return returnToCheck;
}
// First time through - proceed to first check question
return 'identity_future_check';
```

**After the fix:**
- If flag is cleared in 3A, and user cycles multiple times saying YES at 3F, then finally says NO at 3F → Flag is undefined → Go to `identity_future_check` (first check)
- This is correct! If the identity persists through multiple cycles, we should restart from the first check

**If user says NO at 3F on first cycle:**
- Flag was cleared in 3A
- Step 3F says NO → returnToCheck is undefined → Go to `identity_future_check`
- This is also correct! They should go to the first check

Actually, this reveals the flag isn't needed for step 3F at all - it can just default to `identity_future_check`.

## Implementation

**Lines to change:** 2874-2882

**Current code:**
```typescript
if (returnTo === 'identity_future_check') {
  prefix = 'Put yourself in the future and feel yourself being';
  // DON'T clear the flag here - we need it in identity_dissolve_step_f to know where to return
} else if (returnTo === 'identity_scenario_check') {
  prefix = 'Imagine that scenario and feel yourself being';
  // DON'T clear the flag here - we need it in identity_dissolve_step_f to know where to return
}
```

**Fixed code:**
```typescript
if (returnTo === 'identity_future_check') {
  prefix = 'Put yourself in the future and feel yourself being';
  // Clear the flag after using it - bridge phrase should only be used on first return from check
  context.metadata.returnToIdentityCheck = undefined;
} else if (returnTo === 'identity_scenario_check') {
  prefix = 'Imagine that scenario and feel yourself being';
  // Clear the flag after using it - bridge phrase should only be used on first return from check
  context.metadata.returnToIdentityCheck = undefined;
}
```

## Impact Assessment

### What Changes
- ✅ Bridge phrases used only ONCE per check failure (correct behavior)
- ✅ Subsequent cycles from 3F use normal phrase (correct behavior)
- ✅ If 3F says NO after multiple cycles, returns to first check (correct behavior)

### What Doesn't Change
- ✅ First return from check uses bridge phrase (unchanged)
- ✅ Step 3F cycling logic (unchanged)
- ✅ Check question logic (unchanged)

### No Side Effects
- The flag is only used in two places: step 3A (for bridge) and step 3F (for return routing)
- Step 3F's routing logic still works correctly even without the flag (defaults to first check)
- No other code depends on this flag persisting

## Testing

Test flow:
1. Fail future check → First 3A uses "Put yourself in the future..." ✓
2. Cycle to 3F, say YES → Second 3A uses normal "Feel yourself being..." ✓
3. Cycle to 3F, say YES → Third 3A uses normal "Feel yourself being..." ✓
4. Same for scenario check

Verify bridge phrase is used exactly once per check failure.


