# PRD: V5 Goal Statement AI Synthesis

## Problem

The Reality Shifting goal-setting flow produces broken goal statements because it relies on regex pattern matching and naive string concatenation to detect deadlines and construct goal sentences. Three bugs reported by beta tester:

### Bug 1 — "by by" duplication
- User goal: "to do bjj twice a week for a month"
- App asks: "When do you want to achieve this goal by?"
- User answers: "by next week"
- Result: "to do bjj twice a week for a month **by by** next week"
- Cause: `reality-shifting.ts:61` hard-codes `${goalStatement} by ${deadline}` where `deadline` is the raw user input

### Bug 2 — Redundant deadline question
- User goal: "To launch the app on May 1st"
- App still asks: "Is there a deadline?"
- Cause: The regex in `ValidationHelpers.detectDeadlineInGoal()` failed to recognize "on May 1st" as a deadline, OR the `reality_goal_capture` step never calls the deadline detection at all (it doesn't — it falls through to `default` in `determineNextStep`, which always routes to `goal_deadline_check`)

### Bug 3 — Lost deadline when user says "no"
- User goal: "to launch the app on 1st may"
- App asks: "Is there a deadline?" → User says "no" (because they already stated it)
- Result: "your goal statement is 'launch the app'" — the deadline is silently lost
- Cause: The regex strips "on 1st may" from the goal in the route-level pre-processing, but when the user says "no" to the deadline question, the stripped version is used without restoring the deadline

### Why regex can't solve this
English deadline expressions are unbounded: "before the conference", "end of Q1", "by the time school starts", "1st may", "May 1st", "next friday", "in a fortnight", "before summer". No regex set can cover the full permutation space. An LLM can.

---

## Solution

Replace regex-based deadline detection and template-based goal synthesis with **two targeted LLM calls** through OpenRouter, using existing infrastructure.

### LLM Call 1: Goal Parse (after goal capture)

**When:** Immediately after user submits their goal at `reality_goal_capture` or `goal_description`

**Purpose:** Determine whether a deadline is embedded in the goal text. If yes, extract it and produce a clean decomposition.

**Prompt:**
```
You parse goal statements. Given a user's goal, determine if it contains a deadline or time reference.

Return ONLY JSON:
{
  "hasDeadline": boolean,
  "goalWithoutDeadline": string,    // the goal with deadline phrase removed, preserving user's exact words otherwise
  "deadline": string | null,        // the extracted deadline phrase (e.g., "May 1st", "next week", "end of Q1"), null if none
  "goalWithDeadline": string | null // natural combined form (e.g., "launch the app by May 1st"), null if no deadline
}

Rules:
- Preserve the user's exact wording for the goal portion — do not rephrase, improve, or correct grammar
- A deadline is any explicit time/date reference: dates, durations, named periods, relative time ("next week", "by Friday", "end of Q1", "before summer")
- Vague urgency ("soon", "ASAP") is NOT a deadline — set hasDeadline: false
- The "by" preposition belongs in goalWithDeadline, NOT in the deadline field (e.g., deadline: "next week", not "by next week")
```

**Input:** `Goal: {userInput}`

**Model:** `openai/gpt-4o-mini` (fast, cheap — ~$0.00015 per call at ~150 input + 80 output tokens)

**Timeout:** 2000ms (matching existing `DEADLINE_AI_TIMEOUT_MS` pattern)

**Fallback:** If LLM call fails or times out, proceed to `goal_deadline_check` as today (no regression)

**Flow impact:**
- If `hasDeadline: true` → store all four fields in `context.metadata`, set `userResponses['goal_deadline_check'] = 'yes'` and `userResponses['goal_deadline_date'] = deadline`, skip directly to `goal_confirmation`. This fixes **Bug 2** (no redundant question) and **Bug 3** (deadline is never lost).
- If `hasDeadline: false` → proceed to `goal_deadline_check` as normal

### LLM Call 2: Goal Synthesis (after manual deadline entry)

**When:** Only when the user went through the manual path: `goal_deadline_check` → "yes" → `goal_deadline_date` → user typed a deadline

**Purpose:** Combine the goal and the user-provided deadline into a natural sentence.

**Prompt:**
```
Combine a goal statement with a deadline into a single natural sentence.

Goal: {goalStatement}
Deadline: {deadline}

Return ONLY JSON:
{
  "goalWithDeadline": string  // natural combined sentence, e.g., "do bjj twice a week for a month by next week"
}

Rules:
- Preserve the user's exact wording for both the goal and the deadline
- Use "by" as the connecting preposition unless another preposition is clearly more natural (e.g., "in", "before")
- Do not add, remove, or rephrase any words from the user's input beyond the connecting preposition
- If the deadline already contains a preposition like "by" or "in", do not duplicate it
```

**Input:** Goal + deadline from `context.metadata.currentGoal` and `context.userResponses['goal_deadline_date']`

**Model:** `openai/gpt-4o-mini`

**Timeout:** 2000ms

**Fallback:** Use existing template concatenation with simple preposition stripping: `deadline.replace(/^(by |in |within |on |before )/i, '').trim()` — this is the regex approach, kept only as a fallback for LLM failure

**Flow impact:** The synthesized `goalWithDeadline` is stored in `context.metadata.goalWithDeadline` and displayed at `goal_confirmation`. This fixes **Bug 1** (no "by by").

---

## Existing Infrastructure to Reuse

### OpenRouter Key Resolution
**File:** `app/api/treatment-v5/route.ts` → `getDeadlineDetectionOverrides()`

Already implements the three-tier priority chain:
1. Explicit `aiModelOverrides` from request body (labs test runner)
2. Per-user encrypted OpenRouter key from `user_labs_openrouter_keys` table
3. Fallback to `process.env.OPENAI_API_KEY` (auto-detects `sk-or-` prefix)

**Reuse as-is.** Both new LLM calls should use this same function to resolve credentials.

### LLM Call Pattern
**File:** `app/api/treatment-v5/route.ts` → `detectDeadlineWithOpenRouter()`

Already implements:
- Raw `fetch()` to `${baseURL}/chat/completions`
- `AbortController` with configurable timeout
- JSON response parsing via `safeParseDeadlineResult()`
- Silent failure (returns `null` on any error)

**Reuse this pattern.** The new calls should follow the same structure: `fetch` + abort timeout + safe JSON parse + null on failure.

### Safe JSON Parser
**File:** `app/api/treatment-v5/route.ts` → `safeParseDeadlineResult()`

Extracts the first `{...}` block from raw LLM output. Can be generalized to a `safeParseJSON<T>()` that validates required fields via a callback.

### AIModelOverrides Interface
**File:** `lib/v2/ai-assistance.ts`

The `AIModelOverrides` type (`{ apiKey?, baseURL?, model?, defaultHeaders? }`) is already imported by the v5 route. No new types needed.

### Encryption / Key Storage
**File:** `lib/server/labs-openrouter-key.ts`

`getUserOpenRouterKey()` and `upsertUserOpenRouterKey()` handle encrypted storage. Already integrated into the route.

---

## Implementation Plan

### Step 1: Generalize the LLM call utility

Extract from the existing `detectDeadlineWithOpenRouter()` a reusable function:

```typescript
async function callOpenRouterJSON<T>(
  systemPrompt: string,
  userMessage: string,
  overrides: AIModelOverrides,
  timeoutMs: number = 2000,
  validator: (parsed: any) => T | null
): Promise<T | null>
```

This encapsulates: fetch + abort + JSON parse + validate + null-on-failure. Both LLM calls and the existing deadline detection call should use this.

### Step 2: Implement Goal Parse call

Create `parseGoalWithAI()` using `callOpenRouterJSON`. Place it in `route.ts` alongside the existing deadline functions.

**Replace the current pre-processing block** (route lines 433–468) with:

```
if isGoalCaptureStep:
  overrides = await getDeadlineDetectionOverrides(userId, aiModelOverrides)
  if overrides:
    result = await parseGoalWithAI(userInput, overrides)
    if result?.hasDeadline:
      store result fields in a route-level variable (passed to state machine via options)
  // If no overrides or LLM failed, fall through to existing regex path
```

### Step 3: Propagate AI parse results into the state machine

The route currently mutates `userInput` before passing to the state machine. Instead, pass the parsed result as an option:

```typescript
result = await treatmentMachine.processUserInput(sessionId, userInput, {
  userId,
  goalParseResult: aiResult  // { hasDeadline, goalWithoutDeadline, deadline, goalWithDeadline }
});
```

In `handleGoalDescription()` and a new `handleRealityGoalCapture()` case:
- If `goalParseResult` exists and `hasDeadline`, use it to set metadata and skip to `goal_confirmation`
- If `goalParseResult` exists and `!hasDeadline`, proceed to `goal_deadline_check`
- If no `goalParseResult` (LLM failed), fall back to existing regex `detectDeadlineInGoal()`

This also fixes the asymmetry where `reality_goal_capture` never ran deadline detection — it now gets the same treatment as `goal_description`.

### Step 4: Implement Goal Synthesis call

Create `synthesizeGoalWithAI()` using `callOpenRouterJSON`. Call it from the `goal_confirmation` scriptedResponse in `reality-shifting.ts`.

**Problem:** `scriptedResponse` is currently synchronous. Two options:

**Option A (recommended):** Move the synthesis call to the route level. After `processUserInput` returns `goal_confirmation` as the next step, check if `goalWithDeadline` needs synthesis (i.e., user went through manual deadline path and `context.metadata.goalWithDeadline` is not yet set). If so, call `synthesizeGoalWithAI()` and patch the scripted response.

**Option B:** Make `scriptedResponse` async. This would require changes to `base-state-machine.ts` and all step definitions. Higher blast radius — not recommended for a minimal change.

### Step 5: Remove dead code

After both LLM calls are in place:
- Remove `ValidationHelpers.extractDeadlineFromGoal()` and `ValidationHelpers.synthesizeGoalWithDeadline()` (no longer called)
- Keep `ValidationHelpers.detectDeadlineInGoal()` as a fallback for when LLM is unavailable, but simplify it
- Remove the `normalizeGoalDeadlineInput()` function (LLM handles abbreviations natively)
- Remove the existing `detectDeadlineWithOpenRouter()` (replaced by the generalized utility)
- Remove the route-level `userInput` mutation pattern

### Step 6: Fix the undo-restore path

**File:** `app/api/treatment-v5/route.ts` ~line 1783

The undo path has the same template concatenation bug:
```typescript
ctx.metadata.goalWithDeadline = `${ctx.metadata.currentGoal} by ${deadline}`;
```

This should read from the stored `goalWithDeadline` in metadata (which was set by the AI at capture time) rather than re-concatenating. If `goalWithDeadline` is already stored, use it directly.

---

## Architecture Diagram

```
User submits goal
       │
       ▼
route.ts handleContinueSession()
       │
       ├─ isGoalCaptureStep?
       │   ├─ YES → getDeadlineDetectionOverrides()
       │   │         ├─ overrides available → parseGoalWithAI(userInput)
       │   │         │    returns { hasDeadline, goalWithoutDeadline, deadline, goalWithDeadline }
       │   │         │    pass as goalParseResult option to state machine
       │   │         └─ no overrides → pass null (regex fallback inside state machine)
       │   └─ NO → continue normally
       │
       ▼
treatmentMachine.processUserInput(sessionId, userInput, { goalParseResult })
       │
       ├─ handleGoalDescription() / handleRealityGoalCapture()
       │   ├─ goalParseResult?.hasDeadline === true
       │   │   → set metadata.currentGoal = goalParseResult.goalWithoutDeadline
       │   │   → set metadata.goalWithDeadline = goalParseResult.goalWithDeadline
       │   │   → set userResponses['goal_deadline_check'] = 'yes'
       │   │   → set userResponses['goal_deadline_date'] = goalParseResult.deadline
       │   │   → return 'goal_confirmation'  (SKIP deadline questions)
       │   │
       │   ├─ goalParseResult?.hasDeadline === false
       │   │   → set metadata.currentGoal = userInput
       │   │   → return 'goal_deadline_check'
       │   │
       │   └─ goalParseResult === null (LLM unavailable)
       │       → regex fallback: ValidationHelpers.detectDeadlineInGoal()
       │       → existing behavior
       │
       ├─ [user goes through manual deadline path]
       │   goal_deadline_check → "yes" → goal_deadline_date → user answers
       │
       ▼
route.ts post-processing (before returning response)
       │
       ├─ nextStep === 'goal_confirmation' AND !metadata.goalWithDeadline?
       │   → synthesizeGoalWithAI(currentGoal, deadline, overrides)
       │   │    returns { goalWithDeadline: "do bjj twice a week by next week" }
       │   → patch metadata.goalWithDeadline
       │   → patch scriptedResponse with synthesized goal
       │   └─ fallback: strip preposition + template concat
       │
       ▼
goal_confirmation scriptedResponse
       │
       └─ reads metadata.goalWithDeadline (always set by this point)
          "OK, so your goal statement is '{goalWithDeadline}', is that right?"
```

---

## What This Does NOT Change

- **No changes to the therapeutic conversation flow.** The step sequence, question wording, and user experience remain identical. The only visible difference is that the app correctly handles deadlines.
- **No changes to other modalities.** Problem Shifting, Identity Shifting, Belief Shifting, Blockage Shifting, and Trauma Shifting are unaffected.
- **No new dependencies.** Uses existing OpenRouter integration, existing key management, existing `AIModelOverrides` pattern.
- **No new environment variables.** Reuses `OPENAI_API_KEY` and `LABS_KEYS_ENCRYPTION_SECRET`.
- **No database changes.** All data stays in the existing `context.metadata` and `context.userResponses` in-memory objects.
- **Linguistic processing stays off.** The `isLinguisticProcessingStep()` empty array is not touched.

---

## Cost & Performance

| Call | Tokens (est.) | Cost (gpt-4o-mini) | Latency (p50) | Frequency |
|------|--------------|---------------------|---------------|-----------|
| Goal Parse | ~150 in + ~80 out | ~$0.00015 | ~400ms | Once per session |
| Goal Synthesis | ~100 in + ~40 out | ~$0.00008 | ~300ms | Once per session, only if manual deadline path taken |

**Maximum cost per session:** ~$0.00023 (two calls). At 1000 sessions/month: ~$0.23/month.

**Latency:** Both calls are on the critical path but are fast (~400ms). The existing deadline detection LLM call already adds ~400ms. Net change is roughly zero for the parse call (replaces existing), plus ~300ms for synthesis only on the manual deadline path.

**Timeout:** 2000ms hard abort. On timeout, falls back to regex (parse) or template concatenation with preposition stripping (synthesis). User never sees a delay beyond 2s.

---

## Testing

### Automated (Labs Test Runner)
The existing V5 test runner (`components/labs/V5TestRunner.tsx`) with Reality Shifting test flows (`lib/v5/test-flows.ts`) should cover these cases. Add new test steps:

| Test Case | Goal Input | Deadline Answer | Expected goalWithDeadline |
|-----------|-----------|-----------------|--------------------------|
| Inline deadline | "launch the app by May 1st" | (skipped) | "launch the app by May 1st" |
| Inline deadline variant | "to launch the app on 1st may" | (skipped) | "to launch the app on 1st may" or "to launch the app by 1st may" |
| Manual deadline, preposition in answer | "do bjj twice a week" | "by next week" | "do bjj twice a week by next week" |
| Manual deadline, no preposition | "do bjj twice a week" | "next friday" | "do bjj twice a week by next friday" |
| Manual deadline, "in" preposition | "lose 10 pounds" | "in 3 months" | "lose 10 pounds in 3 months" |
| No deadline at all | "be more confident" | (user says "no") | "be more confident" |
| Vague urgency | "get a new job soon" | (depends on LLM) | "get a new job soon" (no deadline extracted) |
| LLM timeout | any | any | Falls back to regex/template — no crash |

### Manual Testing
The beta tester should verify:
1. Entering a goal with an obvious deadline skips the "Is there a deadline?" question
2. Entering a goal without a deadline still shows the deadline questions
3. Answering "by next week" to the deadline question produces a natural sentence
4. Saying "no" to the deadline question when the goal contains a date preserves the full goal
5. The undo button correctly restores goal state at each step
