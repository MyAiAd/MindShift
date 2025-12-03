# V4 AI USAGE AUDIT
Date: 2025-01-29
Purpose: Identify where v4 is using AI when scripted responses should be used

## EXECUTIVE SUMMARY
Issue: v4 is invoking AI (linguistic processing) in cases where scripted responses should remain intact.
This causes:
- Off-script messages (AI paraphrasing)
- Truncated responses (AI cutting off text)
- Slower response times (AI processing delays)
- Higher costs (unnecessary AI tokens)
- Inconsistent user experience

---

## CRITICAL BUG #1: Auto-Advance Chaining Doesn't Update needsLinguisticProcessing

### Location
`app/api/treatment-v4/route.ts` lines 254-272

### The Bug
When auto-advance chaining combines two messages:
1. First step (`_intro_static`) has `needsLinguisticProcessing = true`
2. Second step (`_intro_dynamic`) has `needsLinguisticProcessing = false`
3. Messages are combined (line 262)
4. `expectedResponseType` is updated (line 264) ✅
5. **`needsLinguisticProcessing` is NEVER updated** ❌
6. Result: Combined message still has `needsLinguisticProcessing = true`
7. AI processes the ENTIRE combined message
8. AI paraphrases and truncates the scripted response

### Current Code
```typescript
if (result.expectedResponseType === 'auto' && result.scriptedResponse) {
  const firstMessage = result.scriptedResponse;
  const nextResult = await treatmentMachine.processUserInput(sessionId, '', { userId });
  if (nextResult.canContinue && nextResult.scriptedResponse) {
    result.scriptedResponse = `${firstMessage}\n\n${nextResult.scriptedResponse}`;
    result.nextStep = nextResult.nextStep;
    result.expectedResponseType = nextResult.expectedResponseType; // ✅ Updated
    // ❌ MISSING: result.needsLinguisticProcessing = nextResult.needsLinguisticProcessing;
  }
}
```

### Fix Needed
```typescript
if (result.expectedResponseType === 'auto' && result.scriptedResponse) {
  const firstMessage = result.scriptedResponse;
  const nextResult = await treatmentMachine.processUserInput(sessionId, '', { userId });
  if (nextResult.canContinue && nextResult.scriptedResponse) {
    result.scriptedResponse = `${firstMessage}\n\n${nextResult.scriptedResponse}`;
    result.nextStep = nextResult.nextStep;
    result.expectedResponseType = nextResult.expectedResponseType;
    result.needsLinguisticProcessing = nextResult.needsLinguisticProcessing; // ✅ Use second step's flag
  }
}
```

### Impact
- **CRITICAL** - Affects ALL first-time modality entries
- User sees AI-paraphrased/truncated messages instead of exact script
- Example: "Alright, let's take a moment to focus... Now, let's explore the feeling around" (TRUNCATED)
- Should be: "Please close your eyes... Feel 'test'... what does it feel like?" (FULL SCRIPT)

---

## LINGUISTIC PROCESSING STEPS AUDIT

### Current Configuration
`lib/v4/base-state-machine.ts` lines 733-740

```typescript
const linguisticSteps = [
  'problem_shifting_intro_static',  // Ensure problem is stated as a problem
  'reality_shifting_intro_static',  // Ensure goal is stated as a goal  
  'belief_shifting_intro_static'    // Ensure problem is stated as a problem
];
```

### Analysis of Each Step

#### 1. `problem_shifting_intro_static` - ⚠️ QUESTIONABLE

**Purpose (comment):** "Ensure problem is stated as a problem"

**Step Definition:** `lib/v4/treatment-modalities/problem-shifting.ts` line 12
```typescript
scriptedResponse: (userInput, context) => {
  return `Please close your eyes and keep them closed throughout the process...`;
}
```

**Problem:**
- This is a STATIC intro message with NO user input personalization
- It doesn't use the problem statement at all in the message
- AI processing happens BEFORE this step shows
- AI processes the problem statement the user entered at `work_type_description` step
- **Question:** Why do we need AI to "ensure problem is stated as a problem" if the scripted response doesn't even use it?

**When AI Runs:**
- User enters problem at `work_type_description` step (e.g., "test")
- Backend routes to `problem_shifting_intro_static`
- AI processes "test" to "ensure it's stated as a problem"
- But the scripted response just shows generic instructions
- AI result is ignored/unused in this step's message

**Investigation Results:**

**Scripted Response:** Lines 12-15
```typescript
scriptedResponse: (userInput, context) => {
  return `Please close your eyes and keep them closed throughout the process...`;
}
```

**Analysis:**
- ❌ This is a PURE static message
- ❌ Does NOT use user input
- ❌ Does NOT use problem statement
- ❌ Does NOT include any personalized content

**What AI Does:** `app/api/treatment-v4/route.ts` lines 323-327
```typescript
else if (['problem_shifting_intro', ...].includes(result.nextStep || '')) {
  // Replace the original problem statement with AI-processed version
  finalMessage = result.scriptedResponse.replace(
    new RegExp(`'${textToProcess.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g'), 
    `'${linguisticResult.improvedResponse}'`
  );
}
```

**The Problem:**
1. AI processes user input (e.g., "test" → "feeling anxious")
2. Tries to find and replace `'test'` in scripted response
3. **Scripted response doesn't contain 'test'** - it's just generic instructions
4. No replacement happens
5. **AI result is completely unused and wasted**

**Where Problem Statement is Actually Used:**
- The `_dynamic` step (line 23-32 in problem-shifting.ts)
- Uses `context?.metadata?.problemStatement` directly
- Does NOT use any AI-processed version

**Recommendation:** 
- ❌ **REMOVE from linguisticSteps immediately**
- AI processing is 100% wasted - result is never used
- Adds 2-3 seconds latency for no benefit
- Costs money for no benefit

---

#### 2. `reality_shifting_intro_static` - ❌ CONFIRMED USELESS

**Purpose (comment):** "Ensure goal is stated as a goal"

**Step Definition:** `lib/v4/treatment-modalities/reality-shifting.ts` line 90-93

**Scripted Response:**
```typescript
scriptedResponse: (userInput, context) => {
  return `Close your eyes and keep them closed throughout the process...`;
}
```

**Analysis:**
- ❌ PURE static message
- ❌ Does NOT use goal statement
- ❌ Does NOT use user input
- ❌ Goal statement only used in `_dynamic` step (line 101-109)

**Where Goal Statement is Actually Used:**
```typescript
// reality_shifting_intro_dynamic (line 101-109)
const goalStatement = context?.metadata?.goalWithDeadline || context?.metadata?.currentGoal;
return `Feel that '${goalStatement}' is coming to you... what does it feel like?`;
```

**Recommendation:** 
- ❌ **REMOVE from linguisticSteps immediately**
- Same issue as problem_shifting - AI result never used

---

#### 3. `belief_shifting_intro_static` - ❌ CONFIRMED USELESS

**Purpose (comment):** "Ensure problem is stated as a problem"

**Step Definition:** `lib/v4/treatment-modalities/belief-shifting.ts` line 11-15

**Scripted Response:**
```typescript
scriptedResponse: (userInput, context) => {
  return `Please close your eyes and keep them closed throughout the process...`;
}
```

**Analysis:**
- ❌ PURE static message
- ❌ Does NOT use problem statement
- ❌ Does NOT use user input
- ❌ Problem statement only used in `_dynamic` step (line 23-44)

**Where Problem Statement is Actually Used:**
```typescript
// belief_shifting_intro_dynamic (line 23-44)
const problemStatement = context?.metadata?.currentDiggingProblem || context?.problemStatement || ...;
return `Feel the problem that '${problemStatement}'... what do you believe about yourself?`;
```

**Recommendation:** 
- ❌ **REMOVE from linguisticSteps immediately**
- Same issue - AI result never used

---

## QUESTIONS TO INVESTIGATE - ✅ ANSWERED

### 1. Where is the AI-processed text actually USED?
**Answer:** ❌ **NOWHERE**

**Investigation Results:**
- AI processes problem/goal at intro_static steps
- Tries to find/replace the text in scripted response (line 326)
- Scripted responses are PURE static text with NO user input
- Find/replace finds nothing, does nothing
- AI result is discarded
- All subsequent steps use original `context.problemStatement`
- **CONCLUSION: AI processing is 100% wasted**

### 2. Do _dynamic steps use the AI-processed text?
**Answer:** ❌ **NO - They use the ORIGINAL user input**

**Evidence:**
```typescript
// problem_shifting_intro_dynamic (line 24-32)
const cleanProblemStatement = diggingProblem 
  || context?.metadata?.problemStatement    // ← Original user input
  || context?.problemStatement              // ← Original user input
  || 'the problem';
return `Feel the problem '${cleanProblemStatement}'... what does it feel like?`;
```

**Proof:**
- All _dynamic steps pull from `context.problemStatement`
- This is set from original user input at `work_type_description`
- AI-processed version is never stored in context
- **CONCLUSION: Original user input is used everywhere**

### 3. Is linguistic processing necessary at all for v4?
**Answer:** ❌ **NO - It's legacy waste from v3**

**Evidence:**
- V2 removed most linguistic processing for performance (proven working system)
- V4 comment says "V2 removed most steps for performance"
- V4 still has 3 intro steps with AI enabled
- Investigation shows AI result is NEVER used
- Just adds latency and cost for zero benefit
- **CONCLUSION: All 3 intro steps should be removed from linguisticSteps**

---

## ADDITIONAL AI USAGE TO CHECK

### 1. Check all step definitions for aiTriggers
- Find steps with `aiTriggers: [{ condition: 'userStuck', action: 'clarify' }]`
- These might invoke AI unnecessarily
- Should only be for truly ambiguous user responses

### 2. Check if AI is used for validation failures
- When user input fails validation, does AI generate the retry message?
- Should these be scripted?

### 3. Check digging deeper flows
- Are there any places where AI is invoked during digging deeper?
- Should ALL digging deeper be scripted?

---

## TESTING NEEDED

After fixes, test these scenarios:

### First-Time Problem Entry (CRITICAL)
1. Start session
2. Select "PROBLEM"
3. Enter problem: "test"
4. Expected: Exact scripted message (no AI)
5. Check logs: Should show "usedAI: false"

### Digging Deeper Entry
1. Get to digging deeper
2. Enter new problem: "fear of failure"
3. Expected: Exact scripted message (no AI)
4. Check logs: Should show "usedAI: false"

### Cycling Back
1. Complete a cycle
2. Answer "yes, still a problem"
3. Cycle back to step A
4. Expected: Exact scripted message (no AI)
5. Check logs: Should show "usedAI: false"

---

## PERFORMANCE IMPACT

**Current State:**
- Every first-time problem entry uses AI
- AI call adds ~2-3 seconds latency
- AI costs $0.00009 per call (example from logs)
- Most users will hit this multiple times per session

**After Fix:**
- First-time entry: NO AI (instant response)
- Digging deeper: NO AI (instant response)
- Cycling: NO AI (instant response)
- Only use AI where truly necessary

**Estimated Improvement:**
- 95% of responses: No AI → 2-3 second faster
- Cost reduction: ~90% fewer AI calls
- User experience: Consistent scripted messages

---

## COMPREHENSIVE FINDINGS SUMMARY

### The Core Issues

**1. Auto-Advance Chaining Bug (CRITICAL)**
- Combines messages from _static + _dynamic steps
- Updates `expectedResponseType` ✅
- **FORGETS to update `needsLinguisticProcessing`** ❌
- Result: Combined message gets AI-processed
- Causes: Truncated, off-script, paraphrased messages

**2. Useless AI Processing (PERFORMANCE ISSUE)**
- ALL 3 intro_static steps in linguisticSteps are PURE static text
- AI processes user input → tries to replace in static text → finds nothing → result unused
- Adds 2-3 seconds latency PER intro step
- Costs $0.00009 per call (adds up across users/sessions)
- **100% wasted processing**

**3. AI Result Never Stored or Used**
- AI-processed text is not saved to context
- All _dynamic steps use original `context.problemStatement`
- No step in v4 uses the AI-processed version
- The entire linguistic processing system in v4 is vestigial

---

## ROOT CAUSE ANALYSIS

### Why This Happened

**Historical Context:**
- V3 had extensive AI processing (slow, expensive)
- V2 optimization removed most AI processing (fast, cheap)
- V4 copied v3's architecture instead of v2's optimization
- V4 comments acknowledge v2's optimization but don't implement it
- Result: V4 has v2's split-step architecture BUT v3's wasteful AI processing

**Specific Issues:**
1. `linguisticSteps` list includes _static steps that don't use the AI result
2. Auto-advance chaining doesn't handle `needsLinguisticProcessing` correctly
3. No code path saves or uses AI-processed text in subsequent steps
4. Comments say "V2 removed for performance" but v4 didn't follow through

---

## IMPLEMENTATION PLAN

### ⚠️ CRITICAL Priority (Fix Immediately)

**1. Fix Auto-Advance Chaining Bug**
- **File:** `app/api/treatment-v4/route.ts` line 264
- **Change:**
  ```typescript
  if (result.expectedResponseType === 'auto' && result.scriptedResponse) {
    const firstMessage = result.scriptedResponse;
    const nextResult = await treatmentMachine.processUserInput(sessionId, '', { userId });
    if (nextResult.canContinue && nextResult.scriptedResponse) {
      result.scriptedResponse = `${firstMessage}\n\n${nextResult.scriptedResponse}`;
      result.nextStep = nextResult.nextStep;
      result.expectedResponseType = nextResult.expectedResponseType;
      result.needsLinguisticProcessing = nextResult.needsLinguisticProcessing; // ← ADD THIS LINE
    }
  }
  ```
- **Impact:** Fixes ALL first-time entry truncation/off-script issues
- **Testing:** Enter first problem, verify exact scripted text shows (no AI)

---

### 🚀 HIGH Priority (Major Performance Win)

**2. Remove Useless Intro Steps from linguisticSteps**
- **File:** `lib/v4/base-state-machine.ts` lines 733-740
- **Current:**
  ```typescript
  const linguisticSteps = [
    'problem_shifting_intro_static',  // ❌ Remove
    'reality_shifting_intro_static',  // ❌ Remove  
    'belief_shifting_intro_static'    // ❌ Remove
  ];
  ```
- **Change to:**
  ```typescript
  const linguisticSteps = [
    // V4 optimization: Following V2's lead, removed all intro_static steps
    // These steps don't use the AI-processed text (they're pure static instructions)
    // The _dynamic steps use original user input from context.problemStatement
    // This eliminates 2-3 seconds latency + cost on every first-time entry
  ];
  ```
- **Impact:** 
  - 2-3 seconds faster on EVERY first problem entry
  - ~90% reduction in AI costs
  - Exact scripted messages (no paraphrasing)
  - Better user experience

---

### 📝 MEDIUM Priority (Clean Architecture)

**3. Update Comments and Documentation**
- Remove misleading comments about "ensuring problem is stated as a problem"
- Document that v4 uses original user input throughout
- Clarify when/why AI would ever be needed (if at all)
- Update linguisticSteps comment to explain v4's optimization matches v2

---

### Phase 4: Performance Testing
- Measure latency before/after (expect 2-3 second improvement)
- Measure cost before/after (expect 90% reduction)
- Verify scripted responses are intact (no AI paraphrasing)
- Monitor logs to ensure usedAI: false for all intro steps

---

## EXPECTED IMPACT AFTER ALL FIXES

### User Experience
- ✅ Exact scripted messages (no AI paraphrasing)
- ✅ No truncated messages
- ✅ 2-3 seconds faster first-time problem entry
- ✅ Consistent, predictable responses
- ✅ Better match with training documentation

### Performance
- ✅ 95% of responses instant (no AI wait)
- ✅ ~90% reduction in AI API calls
- ✅ ~90% reduction in AI costs
- ✅ Faster perceived app responsiveness

### Technical
- ✅ Cleaner architecture (no unused AI results)
- ✅ Matches V2's proven optimization
- ✅ Simpler debugging (fewer code paths)
- ✅ Lower server costs

### Metrics to Track
- Response time before: ~3000ms (with AI)
- Response time after: ~100ms (scripted only)
- AI usage before: 100% of intro steps
- AI usage after: 0% of intro steps
- Cost per session before: $0.0003-0.0005
- Cost per session after: $0.00001 (only if user gets stuck)

---

## SUMMARY

### The Problem
V4 is using AI to process text that is NEVER used, causing:
1. Off-script, truncated messages (critical bug)
2. 2-3 second delays on every first-time entry
3. Unnecessary costs
4. Poor user experience

### The Solution
Two simple fixes:
1. Update `needsLinguisticProcessing` in auto-advance chaining (1 line)
2. Empty the `linguisticSteps` array (delete 3 lines)

### The Impact
- Instant responses
- Exact scripted text
- 90% cost reduction
- Better UX

### Why This Matters
Every new user experiences this issue on their first problem entry.
It's the first technical impression of the app.
Currently: "Why is it paraphrasing? Why did it cut off? Why is it slow?"
After fix: Fast, predictable, professional experience.

---

## NOTES

- V2 already went through this optimization (proven working)
- V2 removed most linguistic processing for performance
- V4 should follow V2's lead (as comments acknowledge but don't implement)
- Only use AI where absolutely necessary and clearly beneficial
- Default should be: scripted responses stay scripted
- This audit found that ZERO v4 steps actually benefit from linguistic processing
- **Recommendation: Remove ALL linguistic processing from v4**

