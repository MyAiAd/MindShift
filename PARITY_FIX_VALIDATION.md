# V4 Parity Fix Implementation – Validation Note

**Date:** 2026-03-06

## Implementation completed

All planned v4 parity changes have been implemented:

1. **Active-problem state propagation** – `setActiveProblemFull()` added and used in all digging/restate handlers; `handleChooseMethod` digging branch prefers `currentDiggingProblem` over stale `userResponses`; `metadata.problemStatement` synced in digging-deeper.ts and discovery.ts.
2. **Integration state precedence** – `integration_start` and `intention_question` now use v2 order: `originalProblemStatement` then `metadata.problemStatement` then `problemStatement`.
3. **Cache and next-step behavior** – Additional steps (e.g. `action_question`, `action_followup`, `digging_deeper_start`, `reality_step_a2`/`a3`, trauma dig-deeper steps) skip cache; context hash includes `metadata.problemStatement`, `newDiggingProblem`, `intention_question`; next-step response generation passes `userInput` into `getScriptedResponse` so dynamic steps (e.g. Reality) use the latest answer.
4. **Route compatibility** – Intro-step checks in `app/api/treatment-v4/route.ts` include v4 step IDs (`*_intro_dynamic`, `*_intro_static`).
5. **V2 wording** – `choose_method` and digging-deeper method prompt text match v2 exactly in method-selection.ts, digging-deeper.ts, and static-audio-texts.ts.

## Parity test run (local code, tests hit live site)

- **Command:** `TEST_USER_EMAIL='...' TEST_USER_PASSWORD='...' npm test`
- **Target:** Live API at `https://mind-shift.click`
- **Result:** 34 passed, 6 failed (same failures as before).

The same six tests still fail because **the tests run against the live deployed API**. The fixes above exist only in the local codebase until they are built and deployed. After deployment, re-run:

```bash
TEST_USER_EMAIL=... TEST_USER_PASSWORD=... npm test
```

and the live side-by-side comparison script to confirm that the previously observed v2/v4 variances are resolved on the live site.

## Failing tests (pre-deployment)

- Blockage Shifting: simple flow, blockage step A references the problem
- Digging Deeper: single-level digging flow, new problem used after restatement
- Problem Shifting: with cycling – steps and problem refs; problem statement does not change across cycles

These failures are consistent with stale or wrong problem/intention state; the implemented fixes are intended to resolve them once deployed.
