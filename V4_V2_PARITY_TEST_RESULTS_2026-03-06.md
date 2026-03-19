# V4 vs V2 Parity Test Results

Date: 2026-03-06

Target site: `https://mind-shift.click/`

Command run:

```bash
TEST_USER_EMAIL='Sage@MyAi.ad' TEST_USER_PASSWORD='***' npm test
```

This executed the Playwright `api-parity` suite against the live site.

## Executive Summary

- Overall result: `34 passed`, `6 failed`
- The direct live parity checks that currently run against both versions passed:
  - `PARITY: Reality Shifting (Goal)`
  - `PARITY: Trauma Shifting`
- The failures were all in v4-only correctness tests and all point to the same class of issue:
  - v4 is not consistently preserving the active problem statement
  - in several places it substitutes a different phrase or an apparently stale prior problem
  - this is a parity risk because the doctor-authored v2 wording depends on carrying the correct original problem through the flow

## Important Scope Note

The live parity suite only compares v2 and v4 directly for the flows currently listed as v2-compatible on the deployed server:

- `Reality Shifting (Goal)`
- `Trauma Shifting`

Problem-based flows are still covered by v4 correctness tests, but not all of them are currently compared side-by-side with live v2 in this suite.

## Passing Areas

- V4 full-flow checks passed for:
  - Problem Shifting (simple)
  - Problem Shifting (with cycling) in the broad suite
  - Identity Shifting
  - Belief Shifting
  - Blockage Shifting in the broad suite
  - Reality Shifting (Goal)
  - Trauma Shifting
  - Digging Deeper (single) in the broad suite
  - Cross-modality Digging
- Live v2 vs v4 parity passed for:
  - Reality Shifting (Goal)
  - Trauma Shifting
- Additional targeted V4 checks passed for:
  - Belief Shifting sequence checks
  - Identity Shifting sequence checks
  - session resume
  - undo
  - static + dynamic intro auto-advance
  - empty input handling
  - digging permission asked once
  - reality shifting goal reference checks

## Failing Tests

### 1. Blockage Shifting uses the feeling instead of the original problem

Failed tests:

- `Blockage Shifting - V4 Correctness › simple flow: completes without errors`
- `Blockage Shifting - V4 Correctness › blockage step A references the problem`

Observed behavior:

- Expected problem: `I feel stuck in my career`
- Actual quoted references: `frustration`, `frustration`
- Observed message:

```text
Feel 'frustration'... what does 'frustration' feel like?
```

Interpretation:

- After the original problem is entered, v4 appears to pivot to the user's emotional label instead of continuing to carry the original problem statement forward.
- If v2 keeps the original problem in this branch, this is a parity deviation.

### 2. Digging Deeper reuses the wrong problem after restatement

Failed tests:

- `Digging Deeper - V4 Correctness › single-level digging: completes without errors`
- `Digging Deeper - V4 Correctness › new problem is used (not original) after digging deeper restatement`

Observed behavior in the single-level digging run:

- Expected original problem: `I feel angry`
- At later C2 prompts, v4 referenced:
  - `racing heart`
  - `I feel anxious all the time`

Observed messages included:

```text
Feel 'racing heart'... what does 'racing heart' feel like?
```

```text
Feel the problem 'I feel anxious all the time'... does it still feel like a problem?
```

```text
Take your mind back to 'I feel anxious all the time'. Would you like to dig deeper in this area?
```

Observed behavior in the targeted new-problem test:

- Original problem: `I feel angry`
- Restated deeper problem: `I fear losing control`
- Expected: the next prompt should reference the new problem
- Actual: no quoted reference to the new problem was found

Interpretation:

- v4 is not reliably updating the active problem when the user digs deeper and restates a new issue.
- The appearance of `I feel anxious all the time` strongly suggests stale problem state leakage from a different flow or previously used canonical problem text.

### 3. Problem Shifting cycling mutates the problem statement

Failed tests:

- `Problem Shifting - V4 Correctness › with cycling: steps and problem refs stay consistent`
- `Problem Shifting - V4 Correctness › with cycling: problem statement does not change across cycles`

Observed behavior:

- Expected problem: `I feel overwhelmed at work`
- Actual quoted references included:
  - `what needs to happen for the problem to not be a problem?`
  - `I feel anxious all the time`

Observed messages included:

```text
Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come...
```

```text
Feel the problem 'I feel anxious all the time'... does it still feel like a problem?
```

```text
Feel the problem 'I feel anxious all the time'... what does it feel like?
```

```text
Take your mind back to 'I feel anxious all the time'. Would you like to dig deeper in this area?
```

Interpretation:

- In cycling flows, v4 is not preserving the user-entered problem across cycle boundaries.
- Instead it sometimes falls back to a stale problem string that matches the simple problem-shifting fixture: `I feel anxious all the time`.
- This is the clearest parity risk in the run because the entire therapeutic direction depends on the exact doctor-authored problem wording remaining stable.

## Overall Assessment

The live site is partially successful:

- some v4 flows are functioning correctly
- the currently enabled direct v2-v4 parity flows passed

However, the failed tests show a serious parity risk in problem-carrying logic:

- v4 sometimes substitutes the user's temporary feeling for the original problem
- v4 sometimes fails to switch to a newly restated deeper problem
- v4 sometimes appears to reuse a stale problem from another flow

That means v4 is not yet reliably preserving the exact user problem wording through all branches, which is unsafe given the requirement that v2 remains the legal standard and v4 must follow it.

## Recommended Conclusion

Based on this run, I would not describe v4 as fully parity-safe yet for all problem-based branches on the live site.

The main issue is not the core modality scripts themselves, but state integrity:

- original problem reference is not stable across cycling
- deeper-problem restatement is not reliably honored
- some responses appear contaminated by prior problem text

## Raw Result Summary

- Passed: `34`
- Failed: `6`
- Duration: about `4.3 minutes`
- Exit code: `1`
