# Why 5 Locations? - Simple Explanation

## The New Flag Lifecycle

We're adding a new flag `identityBridgePhraseUsed` that needs to be:
1. **INITIALIZED** when a check fails
2. **READ** to decide whether to use bridge phrase
3. **MARKED** after using the bridge phrase
4. **CLEARED** when checks pass (cleanup)

## Visual Flow

```
CHECK QUESTION                    STEP 3A                      CHECK QUESTION
   (fails)                       (uses flag)                    (passes)
      ↓                              ↓                              ↓
  Location 2 & 4               Location 1                   Location 3 & 5
  SET flag = false             READ flag                    CLEAR flag = false
                               IF not used → use bridge
                               MARK flag = true
```

## Why Each Location is Needed

### Location 1: Step 3A (lines 2870-2884)
**Purpose:** READ and USE the flag
**Why:** This is where we decide whether to use the bridge phrase
**Code:** 
- Read: `const bridgeUsed = context.metadata.identityBridgePhraseUsed;`
- Check: `if (returnTo === 'identity_future_check' && !bridgeUsed)`
- Mark: `context.metadata.identityBridgePhraseUsed = true;`

**This is the MAIN logic - the only place that reads the flag**

---

### Locations 2 & 4: When Checks FAIL (2 locations)
**Why 2 locations?** Because there are 2 different check questions:

**Location 2: Future check fails (line 6484)**
- Check question: "Do you think you might feel yourself being [IDENTITY] in the future?"
- User says: YES (check failed)
- Action: Initialize flag `identityBridgePhraseUsed = false`

**Location 4: Scenario check fails (line 6502)**
- Check question: "Is there any scenario in which you might still feel yourself being [IDENTITY]?"
- User says: YES (check failed)
- Action: Initialize flag `identityBridgePhraseUsed = false`

**Why needed:** Must initialize flag before step 3A reads it

---

### Locations 3 & 5: When Checks PASS (2 locations)
**Why 2 locations?** Because there are 2 different check questions:

**Location 3: Future check passes (line 6489)**
- Check question: "Do you think you might feel yourself being [IDENTITY] in the future?"
- User says: NO (check passed)
- Action: Clean up flag `identityBridgePhraseUsed = false`

**Location 5: Scenario check passes (line 6507)**
- Check question: "Is there any scenario in which you might still feel yourself being [IDENTITY]?"
- User says: NO (check passed)
- Action: Clean up flag `identityBridgePhraseUsed = false`

**Why needed:** Clean up when no longer needed

---

## Simplified View

Think of it as:
1. **1 place that USES the flag** (step 3A)
2. **2 places that SET the flag** (when each check fails)
3. **2 places that CLEAR the flag** (when each check passes)

Total: 1 + 2 + 2 = 5 locations

---

## Why Can't We Reduce This?

### Could we use 1 location instead of 2 for "check fails"?
❌ **NO** - There are 2 separate check questions in different parts of the code
- Future check is one case statement (line ~6484)
- Scenario check is a different case statement (line ~6502)
- They're separate code paths

### Could we use 1 location instead of 2 for "check passes"?
❌ **NO** - Same reason - 2 separate check questions, 2 separate success paths

### Could we skip the "cleanup" locations (3 & 5)?
⚠️ **NOT RECOMMENDED** - Would leave stale flag in memory
- Could cause issues in future sessions
- Best practice: clean up when done

---

## Analogy

Think of it like a light switch system with 2 rooms:

**Location 1 (Step 3A):** The light bulb (reads flag, uses it)

**Locations 2 & 4 (Checks fail):** 2 switches that turn the light ON
- Switch for Room 1 (future check)
- Switch for Room 2 (scenario check)

**Locations 3 & 5 (Checks pass):** 2 switches that turn the light OFF
- Switch for Room 1 (future check passes)
- Switch for Room 2 (scenario check passes)

You need both sets of switches because there are 2 different rooms (check questions).

---

## Could We Consolidate?

### Option: Use helper function
We COULD create a helper function to reduce duplication:

```typescript
private setIdentityCheckReturn(checkName: string, context: TreatmentContext) {
  context.metadata.returnToIdentityCheck = checkName;
  context.metadata.identityBridgePhraseUsed = false;
}

private clearIdentityCheckReturn(context: TreatmentContext) {
  context.metadata.returnToIdentityCheck = undefined;
  context.metadata.identityBridgePhraseUsed = false;
}
```

Then at each location:
```typescript
// Instead of 2 lines:
context.metadata.returnToIdentityCheck = 'identity_future_check';
context.metadata.identityBridgePhraseUsed = false;

// Use 1 line:
this.setIdentityCheckReturn('identity_future_check', context);
```

**Would this be better?**
- ✅ Slightly cleaner
- ✅ Less duplication
- ❌ Adds function call overhead
- ❌ More abstraction (less explicit)
- ❌ Still need to call it in 4 places

**Net change:** Same number of locations, just more abstracted

---

## Bottom Line

**5 locations is the minimum** because:
1. Need to READ flag somewhere (step 3A)
2. Need to SET flag when check 1 fails (future check)
3. Need to SET flag when check 2 fails (scenario check)
4. Need to CLEAR flag when check 1 passes (future check)
5. Need to CLEAR flag when check 2 passes (scenario check)

This is actually **elegant and symmetric**:
- Each check question has 2 outcomes (fail/pass)
- Each outcome needs to set/clear the flag
- The flag is used in one central place

**It's not complex - it's just thoroughness.**

