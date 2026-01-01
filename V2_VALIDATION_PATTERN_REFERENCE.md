# V2 Validation Pattern Reference for V4 Implementation

## Summary of Investigation

Your hypothesis was **100% CORRECT**. The frontend button labeled "PROBLEM" sends `userInput: "1"` to the backend, but V4's validation incorrectly treats this as a "userStuck" trigger because it checks for the wrong step ID.

## V2's Validation Approach (The Working Pattern)

### 1. **Button Input Validation (Lines 979-983)**

V2 explicitly skips validation for button-based selections:

```typescript
// Special validation for introduction phase
if (step.id === 'mind_shifting_explanation') {
  // Skip validation for work type selection inputs (1, 2, 3)
  if (trimmed === '1' || trimmed === '2' || trimmed === '3') {
    return { isValid: true };
  }
  // ... continue with other validation
}
```

**Key Points:**
- Checks specific step ID: `mind_shifting_explanation`
- Directly validates the input VALUE ("1", "2", "3"), not the step state
- Returns immediately with `{ isValid: true }` to bypass all other validation
- This prevents AI triggers from firing on button selections

### 2. **Method Selection Handling (Lines 1866-1883)**

V2 handles method selection buttons similarly:

```typescript
// Process user's method selection
const input = userInput.toLowerCase();

if (input.includes('1') || input.includes('problem shifting')) {
  context.metadata.selectedMethod = 'problem_shifting';
  context.metadata.workType = 'problem';
  context.currentPhase = 'work_type_selection';
  return "Great! We'll use Problem Shifting.";
} else if (input.includes('2') || input.includes('identity shifting')) {
  context.metadata.selectedMethod = 'identity_shifting';
  // ... etc
}
```

**Key Points:**
- Accepts EITHER the number ("1") OR the full name ("problem shifting")
- Sets context metadata appropriately
- Returns user-friendly confirmation message

### 3. **Yes/No Response Handling**

V2 doesn't have special validation for yes/no - it relies on:
- Step definition: `expectedResponseType: 'yesno'`
- Standard validation rules (minLength)
- AI trigger checks that look for yes/no presence (line 1377)

**No explicit "skip validation" for yes/no** - the validation is already lenient enough.

### 4. **AI Trigger Logic (Lines 1340-1348)**

```typescript
case 'userStuck':
  // User says "I don't know", very short responses, or seems stuck
  if (trimmed.length < 3 || 
      lowerInput.includes("i don't know") ||
      lowerInput.includes("not sure") ||
      lowerInput.includes("can't think") ||
      lowerInput.includes("don't feel") ||
      lowerInput.includes("can't feel")) {
    return trigger;
  }
```

**Important:** V2's `userStuck` trigger requires `trimmed.length < 3` (less than 3 characters).
- "1" is 1 character, so would normally trigger
- BUT the validation bypass (step 1 above) returns BEFORE AI triggers are checked!

### 5. **Yes/No AI Trigger Check (Line 1377)**

```typescript
(step.expectedResponseType === 'yesno' && !lowerInput.includes('yes') && !lowerInput.includes('no'))
```

For yes/no steps, AI is only triggered if user doesn't say yes or no.

## V4's Current Problem

### Issue in `/workspace/lib/v4/validation-helpers.ts` (Line 15)

```typescript
// Special validation for introduction phase
if (step.id === 'mind_shifting_explanation') {  // ❌ WRONG STEP ID!
  return this.validateMindShiftingExplanation(trimmed, words, lowerInput, context);
}
```

**Problems:**
1. Checks for step ID `'mind_shifting_explanation'` but actual step is `'mind_shifting_explanation_dynamic'` or `'problem_shifting_intro_dynamic'`
2. The bypass for "1", "2", "3" exists in `validateMindShiftingExplanation` (lines 55-58) but is never reached
3. Falls through to `validateStandardRules` which doesn't have button bypasses
4. Eventually triggers AI with `userStuck` condition

### V4's Validation Flow (Current)

```
User clicks "PROBLEM" button
  ↓
Frontend sends: userInput="1"
  ↓
Backend: step="problem_shifting_intro_dynamic"
  ↓
ValidationHelpers.validateUserInput() called
  ↓
Checks: step.id === 'mind_shifting_explanation' → FALSE
  ↓
Falls through to: validateStandardRules()
  ↓
No special handling for "1"
  ↓
Returns: { isValid: true } (passes standard rules)
  ↓
BUT THEN: checkAITriggers() is called (in base-state-machine.ts)
  ↓
userStuck trigger: trimmed.length < 3 → TRUE (because "1" is 1 char)
  ↓
AI assistance incorrectly triggered!
```

## V2's Validation Flow (Working)

```
User clicks "PROBLEM" button
  ↓
Frontend sends: userInput="1"
  ↓
Backend: step="mind_shifting_explanation"
  ↓
validateUserInput() called
  ↓
Checks: step.id === 'mind_shifting_explanation' → TRUE
  ↓
Checks: trimmed === '1' → TRUE
  ↓
Returns: { isValid: true } IMMEDIATELY
  ↓
BYPASSES all AI trigger checks
  ↓
Proceeds to next step normally
```

## Complete V2 Validation Pattern by Input Type

### 1. Work Type Selection (1, 2, 3)
- **Step:** `mind_shifting_explanation`
- **Validation:** Explicit bypass if `trimmed === '1' || trimmed === '2' || trimmed === '3'`
- **Location:** Line 981-983

### 2. Method Selection (1, 2, 3, 4)
- **Step:** `choose_method` (via routing logic)
- **Validation:** Handled in scriptedResponse function, not validation
- **Pattern:** `input.includes('1') || input.includes('problem shifting')`
- **Location:** Lines 1866-1883

### 3. Yes/No Responses
- **Step:** Any step with `expectedResponseType: 'yesno'`
- **Validation:** Standard minLength validation (usually 1-2 chars)
- **AI Trigger:** Only if doesn't contain 'yes' or 'no' (line 1377)
- **NO explicit bypass needed** - works with standard validation

### 4. Percentage Inputs
- **Steps:** `goal_certainty`, `reality_checking_questions`
- **Validation:** Custom percentage parser (lines 970-975)
- **Pattern:** Accepts numbers 0-100, with or without '%'

### 5. Problem/Goal/Experience Descriptions
- **Steps:** Various intro and description steps
- **Validation:** Extensive checks for:
  - Goal language in problem context
  - Question language
  - General emotions without context
  - Multiple problems/events (for trauma)
  - Length limits (> 20 words triggers simplification)

## Recommended V4 Fix Strategy

### Option 1: Direct Port (Simplest)
Update `/workspace/lib/v4/validation-helpers.ts` to check for correct step IDs:

```typescript
// Check for button-based selection steps
const buttonSelectionSteps = [
  'mind_shifting_explanation_static',
  'mind_shifting_explanation_dynamic',
  'problem_shifting_intro_dynamic',
  'identity_shifting_intro_dynamic',
  'belief_shifting_intro_dynamic',
  'blockage_shifting_intro_dynamic'
];

if (buttonSelectionSteps.includes(step.id)) {
  // Skip validation for work type selection inputs (1, 2, 3)
  if (trimmed === '1' || trimmed === '2' || trimmed === '3') {
    return { isValid: true };
  }
  // Skip validation for method selection inputs (1, 2, 3, 4)
  if (trimmed === '1' || trimmed === '2' || trimmed === '3' || trimmed === '4') {
    return { isValid: true };
  }
  // Continue with other validation...
}
```

### Option 2: Value-Based (Most Robust)
Check input VALUES before checking step IDs:

```typescript
static validateUserInput(userInput: string, step: TreatmentStep, context?: TreatmentContext): ValidationResult {
  const trimmed = userInput.trim();
  const words = trimmed.split(' ').length;
  const lowerInput = trimmed.toLowerCase();
  
  // PRIORITY 1: Button selections bypass ALL validation
  // Work type and method selections (1, 2, 3, 4)
  if (['1', '2', '3', '4'].includes(trimmed)) {
    return { isValid: true };
  }
  
  // PRIORITY 2: Yes/No responses bypass length validation
  if (lowerInput === 'yes' || lowerInput === 'no') {
    return { isValid: true };
  }
  
  // PRIORITY 3: Step-specific validation...
  if (step.id === 'mind_shifting_explanation_dynamic' || step.id === 'mind_shifting_explanation_static') {
    // ... rest of validation
  }
}
```

### Option 3: Context-Aware (V2 Style)
Use expectedResponseType to determine validation approach:

```typescript
// For selection-type responses, bypass complex validation
if (step.expectedResponseType === 'selection' && /^[1-4]$/.test(trimmed)) {
  return { isValid: true };
}

// For yes/no responses, only check for yes/no presence
if (step.expectedResponseType === 'yesno') {
  if (lowerInput.includes('yes') || lowerInput.includes('no')) {
    return { isValid: true };
  }
  // Don't trigger AI for short responses on yes/no questions
  return { isValid: false, error: 'Please answer yes or no.' };
}
```

## Key Differences Between V2 and V4

| Aspect | V2 | V4 |
|--------|----|----|
| **Architecture** | Monolithic state machine | Modular treatment system |
| **Step IDs** | Single static IDs | Dynamic step IDs per modality |
| **Validation** | In state machine class | Separate ValidationHelpers class |
| **Button Handling** | Step ID + value check | ❌ Broken - wrong step IDs |
| **Voice Support** | Text-only | Full voice integration |
| **Modularity** | Single file | Separate modality files |

## Critical Fix Locations

1. **Primary:** `/workspace/lib/v4/validation-helpers.ts`
   - Line 15: Wrong step ID check
   - Lines 55-58: Button bypass exists but never reached
   - Need to add correct step IDs or value-based bypass

2. **Secondary:** `/workspace/lib/v4/base-state-machine.ts`
   - Line 207: Where AI triggers are checked
   - May need to skip AI triggers for button selections

3. **Frontend:** `/workspace/components/treatment/v4/TreatmentSession.tsx`
   - Line 700: Sends "1" for "PROBLEM" button (CORRECT)
   - Line 899: Sends method number (CORRECT)
   - No changes needed here

## Testing Checklist

After fix, verify:
- [ ] Clicking "PROBLEM" button (1) advances to method selection
- [ ] Clicking "GOAL" button (2) advances to goal description
- [ ] Clicking "NEGATIVE EXPERIENCE" button (3) advances to trauma intro
- [ ] Clicking method buttons (1-4) advances to treatment intro
- [ ] Saying "yes"/"no" advances appropriately
- [ ] Typing actual problems still validates correctly
- [ ] Goal language in problem context still triggers AI
- [ ] Question language still triggers AI
- [ ] General emotions still trigger clarification

## V2 Code References

- **Main validation:** Lines 962-1328 (`validateUserInput`)
- **Button bypass:** Lines 980-983
- **Method selection:** Lines 1866-1883
- **AI triggers:** Lines 1333-1400 (`checkAITriggers`)
- **Yes/no handling:** Line 1377
- **processUserInput:** Lines 121-400+

## Next Steps

1. **Don't change code yet** ✓ (Investigation complete)
2. **Implement fix** using Option 2 (Value-Based) for robustness
3. **Test all button selections**
4. **Test all yes/no steps**
5. **Verify AI triggers still work for actual stuck users**
6. **Test voice mode** to ensure compatibility
