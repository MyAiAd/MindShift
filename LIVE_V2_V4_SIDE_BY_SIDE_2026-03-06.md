# Live V2 vs V4 Side-by-Side Comparison

Date: 2026-03-06

Target: `https://mind-shift.click`

Method:

- I ran the same step inputs against the live `/api/treatment-v2` and `/api/treatment-v4` endpoints.
- This was a true live side-by-side comparison using the existing parity helpers.
- No code was changed.
- `v2` was treated as read-only and only observed.

## Executive Summary

- Full live side-by-side comparison was only possible for:
  - `Reality Shifting (Goal)`
  - `Trauma Shifting`
- For all problem-based flows, the currently deployed live `v2` endpoint failed at step 3, so comparison could only proceed through the first two steps.
- In the two flows that did complete side-by-side, I observed message differences between `v2` and `v4`.
- In `Trauma Shifting`, I also observed quoted-reference differences, where `v4` reused text from a different flow instead of the current trauma flow content.

## What This Means

The earlier suite did compare `v2` and `v4` side-by-side, but only for the flows where the live deployed `v2` endpoint is currently capable of completing:

- `Reality Shifting (Goal)`
- `Trauma Shifting`

That is why the original parity tests did not prove direct live `v2`/`v4` mismatch for every problem-based branch: live `v2` is currently breaking too early on those branches to allow a full comparison.

## Problem-Based Flows

These flows could not be fully compared live because `v2` failed at step 3 (`Describe problem`) with the same server-side error:

```text
State machine processing failed
Invalid step: work_type_description
```

Affected flows:

- `Problem Shifting (simple)`
- `Problem Shifting (with cycling)`
- `Identity Shifting`
- `Belief Shifting`
- `Blockage Shifting`
- `Digging Deeper (single)`
- `Cross-modality Digging`

### Common Pattern Before Failure

For these problem-based flows:

- Step 1 usually matched at the work-type selection level
- Step 2 landed on the same step name (`work_type_description`)
- But even before the crash, the live messages already differed

Observed step-2 pattern:

- `v2`: `"Great! Let's begin Problem Shifting."`
- `v4`: `"Tell me what the problem is in a few words."`

Then at step 3, `v2` failed while `v4` continued normally.

Example:

### Problem Shifting (simple)

- Step 3 input: `I feel anxious all the time`
- `v2`:
  - step: `v2_error`
  - message: `v2 API continue failed (500) ... Invalid step: work_type_description`
- `v4`:
  - step: `problem_shifting_intro_dynamic`
  - message began with:

```text
Please close your eyes and keep them closed throughout the process...
```

This same failure pattern occurred across all seven problem-based flows listed above.

## Reality Shifting (Goal)

This flow completed live side-by-side.

- Steps attempted: `15`
- `v2` status: completed
- `v4` status: completed
- Non-exempt divergences observed before completion: `2`

### Divergence 1

- Step: `12`
- Input: `Cleared my doubts`
- Step names matched:
  - `v2`: `reality_step_a2`
  - `v4`: `reality_step_a2`

Messages:

- `v2`:

```text
Feel Cleared my doubts... what does Cleared my doubts feel like?
```

- `v4`:

```text
Feel doubt and fear... what does doubt and fear feel like?
```

### Divergence 2

- Step: `13`
- Input: `My business will succeed`
- Step names matched:
  - `v2`: `reality_step_a3`
  - `v4`: `reality_step_a3`

Messages:

- `v2`:

```text
Feel My business will succeed... what happens in yourself when you feel My business will succeed?
```

- `v4`:

```text
Feel I might fail... what happens in yourself when you feel I might fail?
```

### Interpretation

In this flow, both versions completed, but they did not always respond with the same message text. The step names aligned, yet the live content diverged at those points.

## Trauma Shifting

This flow also completed live side-by-side.

- Steps attempted: `21`
- `v2` status: completed
- `v4` status: completed
- Non-exempt divergences observed before completion: `3`

### Divergence 1

- Step: `13`
- Input: `no`
- Step names matched:
  - `v2`: `digging_deeper_start`
  - `v4`: `digging_deeper_start`

Messages:

- `v2`:

```text
Take your mind back to 'car accident last year'. Would you like to dig deeper in this area?
```

- `v4`:

```text
Take your mind back to 'I feel anxious all the time'. Would you like to dig deeper in this area?
```

Quoted refs:

- `v2`: `car accident last year`
- `v4`: `I feel anxious all the time`

### Divergence 2

- Step: `19`
- Input: `To move forward freely`
- Step names matched:
  - `v2`: `action_question`
  - `v4`: `action_question`

Messages:

- `v2`:

```text
What needs to happen for you to realise your intention of 'To move forward freely'?
```

- `v4`:

```text
What needs to happen for you to realise your intention of 'To stay calm in difficult situations'?
```

Quoted refs:

- `v2`: `To move forward freely`
- `v4`: `To stay calm in difficult situations`

### Divergence 3

- Step: `20`
- Input: `Plan a road trip`
- Step names matched:
  - `v2`: `action_followup`
  - `v4`: `action_followup`

Messages:

- `v2`:

```text
What else needs to happen for you to realise your intention of 'To move forward freely'?
```

- `v4`:

```text
What else needs to happen for you to realise your intention of 'To stay calm in difficult situations'?
```

Quoted refs:

- `v2`: `To move forward freely`
- `v4`: `To stay calm in difficult situations`

### Interpretation

This is a direct live side-by-side mismatch, not just a test expectation issue.

In these steps:

- `v2` stayed anchored to the current trauma flow inputs
- `v4` substituted text from another context

That indicates that, at least in this live run, `v4` did not preserve the same active content as `v2`.

## Overall Conclusion

The live side-by-side comparison shows two different realities:

1. For most problem-based flows, the current deployed live `v2` endpoint crashes too early to permit a full branch-by-branch comparison.
2. For the flows that do complete side-by-side, I observed actual live response differences between `v2` and `v4`.

Most important direct finding:

- `Trauma Shifting` produced clear live `v2` vs `v4` mismatches in quoted references and integration text.

Also important:

- `Reality Shifting (Goal)` completed in both versions, but message content still diverged at specific steps even when the step names matched.

## Bottom Line

Yes, after running a true live side-by-side comparison, I can now say that there are observed cases where `v4` answered differently from live `v2`.

Those directly observed live mismatches were in:

- `Trauma Shifting`
- `Reality Shifting (Goal)`

And for the remaining problem-based flows, the live deployed `v2` endpoint failed too early to complete a full comparison.
