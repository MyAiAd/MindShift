# V4 Step Not Advancing Issue
Date: 2025-01-29
Issue: problem_shifting_intro_dynamic not advancing to body_sensation_check

## SYMPTOMS

**What Should Happen:**
1. User sees: "Feel the problem 'test'... what does it feel like?"
2. User enters: "bad"
3. System advances to next step: `body_sensation_check`
4. User sees: "Feel 'bad'... what happens in yourself when you feel 'bad'?"

**What's Actually Happening:**
1. User sees: "Feel the problem 'test'... what does it feel like?"
2. User enters: "bad"
3. System STAYS on same step: `problem_shifting_intro_dynamic`
4. User sees SAME question: "Feel the problem 'test'... what does it feel like?"

## EVIDENCE FROM LOGS

### Frontend Logs
```
Sending V4 message: Object
  content: "bad"
  currentStep: "problem_shifting_intro_dynamic"

V4 Continue session response: Object
  aiCost: 0
  aiTokens: 0
  canContinue: true
  currentStep: "problem_shifting_intro_dynamic"  ← SAME STEP (should be body_sensation_check)
  expectedResponseType: "feeling"
  message: "Feel the problem 'test'... what does it feel like?"  ← SAME MESSAGE
  responseTime: 364
  usedAI: false  ← Good! Our AI fix is working
  version: "v4"
```

### What This Tells Us
- ✅ Frontend sent correct step: `problem_shifting_intro_dynamic`
- ✅ Frontend sent valid input: "bad" (3 characters, passes minLength validation of 2)
- ❌ Backend returned SAME step instead of next step
- ❌ Backend returned SAME message instead of next message
- ✅ No AI processing (our fix working)
- ✅ Fast response (364ms - our fix working)

## STEP DEFINITION VERIFICATION

File: `lib/v4/treatment-modalities/problem-shifting.ts` lines 22-42

```typescript
{
  id: 'problem_shifting_intro_dynamic',
  scriptedResponse: (userInput, context) => {
    const cleanProblemStatement = ...;
    return `Feel the problem '${cleanProblemStatement}'... what does it feel like?`;
  },
  expectedResponseType: 'feeling',
  validationRules: [
    { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
  ],
  nextStep: 'body_sensation_check',  ← CORRECTLY DEFINED
  aiTriggers: [
    { condition: 'userStuck', action: 'clarify' }
  ]
}
```

**Verification:**
- ✅ `nextStep` is correctly set to 'body_sensation_check'
- ✅ `validationRules` requires minLength: 2 (user entered "bad" = 3 chars, should pass)
- ✅ Both steps are in same phase ('Problem Shifting')
- ✅ `body_sensation_check` exists as next step (line 45)

## HYPOTHESIS

The issue is NOT in:
- ❌ Step definition (correct)
- ❌ Validation (should pass)
- ❌ Phase mismatch (same phase)
- ❌ Frontend (sending correct data)

The issue IS likely in:
- ⚠️ Backend routing logic (`determineNextStep` or `handleRegularFlow`)
- ⚠️ Context handling after our recent changes
- ⚠️ Auto-advance interference
- ⚠️ Unexpected routing override

## NEEDED: SERVER LOGS

To diagnose, we need to see the server logs showing:

1. **When user enters "bad":**
   ```
   Treatment V4 API: POST request received
   Treatment V4 API: Extracted parameters: { userInput: 'bad', currentStep: '...', ... }
   ```

2. **State machine processing:**
   ```
   🔍 PROCESS_INPUT_START: ...
   🔍 DETERMINE_NEXT_STEP: ...
   🎬 HANDLE_REGULAR_FLOW: determineNextStep returned: "..."
   ```

3. **What step was returned:**
   ```
   Treatment V4 API: Creating final response object...
   currentStep: "..." 
   message: "..."
   ```

## POSSIBLE CAUSES

### 1. determineNextStep Returning Wrong Value
- Maybe returning `context.currentStep` instead of `currentStep.nextStep`?
- Maybe there's a switch case we missed that handles this step?

### 2. Context Not Being Saved Correctly After Auto-Advance
- Auto-advance processes 2 steps with empty input
- Maybe context.currentStep isn't being set correctly?
- Maybe userResponses isn't being populated?

### 3. Validation Failing Silently
- Maybe minLength validation is failing for some reason?
- But logs show canContinue: true, so validation passed

### 4. Step Lookup Failing
- Maybe `body_sensation_check` isn't being found in the phase?
- But this would throw an error, not return same step

## DIAGNOSTIC STEPS

1. Add logging to see what `determineNextStep` returns
2. Add logging to see if step is being found in phase
3. Check if context.currentStep matches what frontend sent
4. Verify userResponses is being populated correctly

## TEMPORARY WORKAROUND

None - this blocks the entire treatment flow

## IMPACT

- 🔴 CRITICAL - Users cannot progress past first problem question
- 🔴 BLOCKS - Entire problem-shifting treatment flow blocked
- 🔴 AFFECTS - All users trying to use v4
- ⏱️ URGENT - Needs immediate fix

## NEXT ACTIONS

1. Get full server logs from when user enters "bad"
2. Check what `determineNextStep` is returning
3. Verify step lookup is working correctly
4. Check if our recent changes affected anything

