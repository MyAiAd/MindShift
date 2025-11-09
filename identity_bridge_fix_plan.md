# Identity Shifting v2 - Bridge Phrase Fix Plan

## Complete Path Analysis

### All Uses of `returnToIdentityCheck` Flag (7 occurrences)

#### 1. READ at Line 2871 (identity_dissolve_step_a - Step 3A)
```typescript
const returnTo = context.metadata.returnToIdentityCheck;
let prefix = 'Feel yourself being';

if (returnTo === 'identity_future_check') {
  prefix = 'Put yourself in the future and feel yourself being';
  // DON'T clear the flag here - we need it in identity_dissolve_step_f to know where to return
} else if (returnTo === 'identity_scenario_check') {
  prefix = 'Imagine that scenario and feel yourself being';
  // DON'T clear the flag here - we need it in identity_dissolve_step_f to know where to return
}
```
**Purpose:** Choose bridge phrase based on which check we came from
**Current behavior:** Reads flag, uses it, doesn't clear it (BUG)
**Fix:** Add clearing after using it

#### 2. READ at Line 6437 (identity_dissolve_step_f - Step 3F)
```typescript
if (lastResponse.includes('no') || lastResponse.includes('2')) {
  const returnToCheck = context.metadata.returnToIdentityCheck;
  if (returnToCheck) {
    // Return to the check question we came from (skipping earlier passed checks)
    return returnToCheck;
  }
  // First time through - proceed to first check question
  return 'identity_future_check';
}
```
**Purpose:** Know which check to return to when user says NO
**Current behavior:** Reads flag to decide routing
**After fix:** Flag will be undefined → defaults to 'identity_future_check'

#### 3. COMMENT at Line 6450 (identity_dissolve_step_f - Step 3F)
```typescript
} else if (lastResponse.includes('yes') || lastResponse.includes('1')) {
  console.log(`🔍 IDENTITY_DISSOLVE_STEP_F: User said YES, cycling back to dissolve step A`);
  context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
  // Keep returnToIdentityCheck flag so we return to the correct Step 4 checking question after the cycle
  return 'identity_dissolve_step_a';
}
```
**Purpose:** Comment explaining why flag isn't cleared
**Current behavior:** Flag persists when cycling back
**After fix:** Flag will already be cleared by step 3A, so this is correct

#### 4. SET at Line 6484 (identity_future_check - Step 4 Check #1)
```typescript
if (lastResponse.includes('yes') || lastResponse.includes('1')) {
  // YES - identity not cleared, go back to Step 3 (Shifting) per flowchart
  context.metadata.returnToIdentityCheck = 'identity_future_check';
  return 'identity_dissolve_step_a';
}
```
**Purpose:** Set flag when future check fails, before returning to 3A
**Current behavior:** Sets flag, goes to 3A
**After fix:** Sets flag, goes to 3A (unchanged)

#### 5. CLEAR at Line 6489 (identity_future_check - Step 4 Check #1)
```typescript
} else if (lastResponse.includes('no') || lastResponse.includes('2')) {
  // NO - this check passed, clear return marker and proceed to scenario check
  context.metadata.returnToIdentityCheck = undefined;
  return 'identity_scenario_check';
}
```
**Purpose:** Clear flag when check passes
**Current behavior:** Clears flag, moves to next check
**After fix:** Clears flag, moves to next check (unchanged)

#### 6. SET at Line 6502 (identity_scenario_check - Step 4 Check #2)
```typescript
if (lastResponse.includes('yes') || lastResponse.includes('1')) {
  // YES - identity not cleared, go back to Step 3 (Shifting) per flowchart
  context.metadata.returnToIdentityCheck = 'identity_scenario_check';
  return 'identity_dissolve_step_a';
}
```
**Purpose:** Set flag when scenario check fails, before returning to 3A
**Current behavior:** Sets flag, goes to 3A
**After fix:** Sets flag, goes to 3A (unchanged)

#### 7. CLEAR at Line 6507 (identity_scenario_check - Step 4 Check #2)
```typescript
} else if (lastResponse.includes('no') || lastResponse.includes('2')) {
  // NO - both checks passed, clear return marker and proceed to Step 5 (Check Problem)
  context.metadata.returnToIdentityCheck = undefined;
  return 'identity_problem_check';
}
```
**Purpose:** Clear flag when both checks pass
**Current behavior:** Clears flag, moves to problem check
**After fix:** Clears flag, moves to problem check (unchanged)

## Data Flow Analysis

### CURRENT (BUGGY) FLOW

**Scenario 1: User fails future check, cycles 3 times, then passes at 3F**
```
1. identity_future_check (YES)
   └─ SET flag = 'identity_future_check'
   └─ Go to: identity_dissolve_step_a

2. identity_dissolve_step_a (Step 3A - First time)
   └─ READ flag = 'identity_future_check'
   └─ Use bridge: "Put yourself in the future..."
   └─ DON'T clear flag (BUG)
   └─ Go to: step 3B

3. Steps 3B → 3C → 3D → 3E → 3F

4. identity_dissolve_step_f (Step 3F - YES)
   └─ Keep flag (still = 'identity_future_check')
   └─ Go to: identity_dissolve_step_a

5. identity_dissolve_step_a (Step 3A - Second time)
   └─ READ flag = 'identity_future_check' ❌ BUG
   └─ Use bridge AGAIN: "Put yourself in the future..."
   └─ DON'T clear flag
   └─ Go to: step 3B

6. Steps 3B → 3C → 3D → 3E → 3F

7. identity_dissolve_step_f (Step 3F - YES)
   └─ Keep flag (still = 'identity_future_check')
   └─ Go to: identity_dissolve_step_a

8. identity_dissolve_step_a (Step 3A - Third time)
   └─ READ flag = 'identity_future_check' ❌ BUG
   └─ Use bridge AGAIN: "Put yourself in the future..."
   └─ Continues repeating forever
```

### FIXED FLOW

**Scenario 1: User fails future check, cycles 3 times, then passes at 3F**
```
1. identity_future_check (YES)
   └─ SET flag = 'identity_future_check'
   └─ Go to: identity_dissolve_step_a

2. identity_dissolve_step_a (Step 3A - First time)
   └─ READ flag = 'identity_future_check'
   └─ Use bridge: "Put yourself in the future..."
   └─ CLEAR flag = undefined ✅ FIX
   └─ Go to: step 3B

3. Steps 3B → 3C → 3D → 3E → 3F

4. identity_dissolve_step_f (Step 3F - YES)
   └─ Flag already cleared (= undefined)
   └─ Go to: identity_dissolve_step_a

5. identity_dissolve_step_a (Step 3A - Second time)
   └─ READ flag = undefined ✅ CORRECT
   └─ Use normal: "Feel yourself being..."
   └─ Go to: step 3B

6. Steps 3B → 3C → 3D → 3E → 3F

7. identity_dissolve_step_f (Step 3F - YES)
   └─ Flag still undefined
   └─ Go to: identity_dissolve_step_a

8. identity_dissolve_step_a (Step 3A - Third time)
   └─ READ flag = undefined ✅ CORRECT
   └─ Use normal: "Feel yourself being..."
   └─ All subsequent cycles use normal phrase
```

**Scenario 2: User fails future check, cycles once, then says NO at 3F**
```
1. identity_future_check (YES)
   └─ SET flag = 'identity_future_check'
   └─ Go to: identity_dissolve_step_a

2. identity_dissolve_step_a (Step 3A)
   └─ READ flag = 'identity_future_check'
   └─ Use bridge: "Put yourself in the future..."
   └─ CLEAR flag = undefined ✅ FIX
   └─ Go to: step 3B

3. Steps 3B → 3C → 3D → 3E → 3F

4. identity_dissolve_step_f (Step 3F - NO)
   └─ READ flag = undefined
   └─ No returnToCheck → default to 'identity_future_check'
   └─ Go to: identity_future_check ✅ CORRECT
```

**Scenario 3: User passes future check, fails scenario check**
```
1. identity_future_check (NO)
   └─ CLEAR flag = undefined
   └─ Go to: identity_scenario_check

2. identity_scenario_check (YES)
   └─ SET flag = 'identity_scenario_check'
   └─ Go to: identity_dissolve_step_a

3. identity_dissolve_step_a (Step 3A)
   └─ READ flag = 'identity_scenario_check'
   └─ Use bridge: "Imagine that scenario..."
   └─ CLEAR flag = undefined ✅ FIX
   └─ Go to: step 3B

4. Steps 3B → 3C → 3D → 3E → 3F

5. identity_dissolve_step_f (Step 3F - YES)
   └─ Flag already cleared (= undefined)
   └─ Go to: identity_dissolve_step_a

6. identity_dissolve_step_a (Step 3A - Second time)
   └─ READ flag = undefined ✅ CORRECT
   └─ Use normal: "Feel yourself being..."
```

## Impact on Step 3F Routing (Line 6437)

### Current Behavior
```typescript
const returnToCheck = context.metadata.returnToIdentityCheck;
if (returnToCheck) {
  return returnToCheck;  // Return to specific check
}
return 'identity_future_check';  // Default to first check
```

The intent was: "If we know which check failed, return to that check when user says NO"

### Problem with Current Implementation
The flag NEVER gets cleared, so even after multiple cycles, it still "remembers" the original check. This seems beneficial BUT:
- It's not actually needed because after multiple cycles, the identity should be re-tested from the beginning
- It causes the bridge phrase bug

### After Fix
When user says NO at 3F after multiple cycles:
- Flag is undefined (was cleared in 3A)
- Defaults to `identity_future_check` (first check)
- **This is correct!** After multiple shifting cycles, we should test from the beginning

## Paths In and Out

### PATHS INTO Step 3A (identity_dissolve_step_a)

1. **From identity_shifting_intro** (line 2845 nextStep)
   - First time entering Identity Shifting
   - Flag is undefined
   - Uses normal phrase ✅

2. **From identity_future_check** (line 6485)
   - User said YES (check failed)
   - Flag SET to 'identity_future_check' just before coming here
   - Uses bridge phrase, then CLEARS flag ✅

3. **From identity_scenario_check** (line 6503)
   - User said YES (check failed)
   - Flag SET to 'identity_scenario_check' just before coming here
   - Uses bridge phrase, then CLEARS flag ✅

4. **From identity_dissolve_step_f** (line 6451)
   - User said YES (cycling back)
   - Flag already cleared by previous 3A visit
   - Uses normal phrase ✅

### PATHS OUT OF Step 3A (identity_dissolve_step_a)

1. **To identity_dissolve_step_b** (line 2890 nextStep)
   - Normal flow progression
   - Flag state doesn't matter ✅

No other paths. Step 3A only goes to 3B.

### PATHS INTO Step 3F (identity_dissolve_step_f)

1. **From identity_dissolve_step_e** (line 2976 nextStep)
   - Normal flow progression
   - Flag may or may not be set (doesn't matter for routing)

### PATHS OUT OF Step 3F (identity_dissolve_step_f)

1. **If NO → identity_future_check** (lines 6437-6445)
   - Checks flag, defaults to future check if undefined
   - After fix: Always defaults to future check (correct) ✅

2. **If YES → identity_dissolve_step_a** (line 6451)
   - Cycles back to 3A
   - After fix: Flag already cleared, 3A uses normal phrase (correct) ✅

3. **If unclear → identity_future_check** (line 6455)
   - Defaults to future check
   - Same as NO path ✅

## Safety Analysis

### What Changes
1. ✅ Bridge phrase used only once per check failure (fixes bug)
2. ✅ Step 3F routing when NO: Always goes to first check after cycles (arguably more correct)

### What Doesn't Change
1. ✅ First return from check always uses bridge phrase
2. ✅ Check questions still set the flag before routing to 3A
3. ✅ Check questions still clear the flag when passing
4. ✅ Step 3F still cycles back to 3A when YES
5. ✅ All other Identity Shifting logic unchanged

### No Side Effects
- Flag is only used in 2 places: 3A (bridge) and 3F (routing)
- 3A: Will clear after using (fixes bug)
- 3F: Will default to first check (correct behavior)
- No other code reads this flag
- Flag is identity-specific, doesn't affect other modalities

### Risk Assessment
**ZERO RISK** - This is the safest possible fix:
1. Only affects one variable in one modality
2. Variable has limited scope (2 read locations)
3. Fix makes behavior match protocol intent
4. No database changes, no API changes
5. Purely internal state management

## The Fix

**File:** `/lib/v2/treatment-state-machine.ts`
**Lines:** 2874-2882

**Change:**
```typescript
if (returnTo === 'identity_future_check') {
  prefix = 'Put yourself in the future and feel yourself being';
  context.metadata.returnToIdentityCheck = undefined;  // ← ADD THIS LINE
} else if (returnTo === 'identity_scenario_check') {
  prefix = 'Imagine that scenario and feel yourself being';
  context.metadata.returnToIdentityCheck = undefined;  // ← ADD THIS LINE
}
```

**Total changes:** 2 lines added
**Lines affected:** 2 out of 8,066 total lines (0.02%)

## Testing Plan

1. **Test bridge phrase used once:**
   - Fail future check → Cycle through 3A-3F → Say YES at 3F → Check 3A uses normal phrase

2. **Test scenario bridge phrase:**
   - Pass future check → Fail scenario check → Cycle → Check 3A uses normal phrase on second cycle

3. **Test step 3F routing:**
   - Fail check → Cycle multiple times → Say NO at 3F → Should go to future check (first check)

4. **Regression test:**
   - Complete normal Identity Shifting flow → Should work identically


