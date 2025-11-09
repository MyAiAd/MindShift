# Problem Shifting: V2 vs V3 Detailed Comparison

## Summary
Problem Shifting is mostly in sync between v2 and v3. Only minor wording differences found.

## Differences Found

### 1. `what_needs_to_happen_step` (Step C)

**V2 (lines 2312-2328):**
```typescript
scriptedResponse: (userInput, context) => {
  // Step C should reference the PROBLEM (not the last response) per protocol flowchart
  // This matches the pattern used in problem_shifting_intro (Step A) and check_if_still_problem (Step G)
  const diggingProblem = context?.metadata?.currentDiggingProblem;
  const cleanProblemStatement = diggingProblem || context?.metadata?.problemStatement || context?.problemStatement || 'the problem';
  return `Feel '${cleanProblemStatement}'... what needs to happen for this to not be a problem?`;
},
```

**V3 (lines 58-65):**
```typescript
scriptedResponse: (userInput, context) => {
  // Get the problem statement - prioritize digging deeper, then metadata (set at work_type_description), then fallbacks
  const diggingProblem = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem;
  const problemStatement = diggingProblem || context?.metadata?.problemStatement || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
  console.log(`🔍 WHAT_NEEDS_TO_HAPPEN_STEP: Using problem statement: "${problemStatement}" (digging: "${diggingProblem}", metadata: "${context?.metadata?.problemStatement}", original: "${context?.problemStatement}")`);
  return `Feel the problem '${problemStatement}'... what needs to happen for this to not be a problem?`;
},
```

**Difference:**
- V2: Uses `Feel '${cleanProblemStatement}'...` (without "the problem")
- V3: Uses `Feel the problem '${problemStatement}'...` (with "the problem")
- V3 checks more fallback sources
- V3 also checks `newDiggingProblem`

**Recommendation:** Keep V2 wording (shorter, more direct)

### 2. `feel_solution_state` (Step D)

**V2 (lines 2330-2344):**
```typescript
scriptedResponse: (userInput, context) => {
  // Get the previous answer from what_needs_to_happen_step
  const previousAnswer = context?.userResponses?.['what_needs_to_happen_step'] || 'that';
  return `What would you feel like if ${previousAnswer} had already happened?`;
},
```

**V3 (lines 77-87):**
```typescript
scriptedResponse: (userInput) => `What would you feel like if you already ${userInput || 'had that'}?`,
```

**Difference:**
- V2: Uses previous step's response from context (`${previousAnswer} had already happened`)
- V3: Uses current userInput directly (`if you already ${userInput}`)

**Implication:** Different user experience!
- V2: "What would you feel like if I need to talk to my boss had already happened?"
- V3: "What would you feel like if you already I need to talk to my boss?" (grammatically awkward)

**Recommendation:** Use V2 approach (more grammatically correct)

## Status: ✅ MOSTLY ALIGNED

Problem Shifting only needs 2 minor updates to v3 to achieve full parity with v2.

## Action Items

1. Update v3 `what_needs_to_happen_step` to match v2 wording
2. Update v3 `feel_solution_state` to use previous response from context (v2 approach)

