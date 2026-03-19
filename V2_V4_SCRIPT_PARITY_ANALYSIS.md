# V2 vs V4 Script Parity Analysis (Doctor's Scripts)

> **Date:** 2026-03-04  
> **Context:** Comparing v2 (text-only, "perfect copy") with v4 (audio version) for adherence to the doctor's therapy scripts.

---

## Gaps (v4 differs from v2)

### 1. **Introduction / Initial Welcome**

| | v2 | v4 |
|---|-----|-----|
| **Content** | Full script: "Mind Shifting is not like counselling, therapy or life coaching. The Mind Shifting methods are verbal guided processes that we apply to problems, goals, or negative experiences in order to clear them. The way Mind Shifting works is we won't just be talking about what you want to work on, we will be applying Mind Shifting methods in order to clear them, and to do that we will need to define what you want to work on into a clear statement by you telling me what it is in a few words. So I'll be asking you to do that when needed.\n\nWhen you are ready to begin, would you like to work on:\n\n1. PROBLEM\n2. GOAL\n3. NEGATIVE EXPERIENCE" | Shortened: "Would you like to work on:\n\n1. PROBLEM\n2. GOAL\n3. NEGATIVE EXPERIENCE" |
| **Location** | `lib/v2/treatment-state-machine.ts` line 1728 | `lib/v4/static-audio-texts.ts` INITIAL_WELCOME |

**Gap:** v4 omits the full introductory paragraph.

---

### 2. **Method Selection (choose_method)**

| | v2 | v4 |
|---|-----|-----|
| **Content** | "Choose which Mind Shifting method you would like to use to clear the problem:" | "Which method would you like to use for this problem?\n\n1. Problem Shifting\n2. Identity Shifting\n3. Belief Shifting\n4. Blockage Shifting" |
| **Location** | `lib/v2/treatment-state-machine.ts` line 2250 | `lib/v4/treatment-modalities/method-selection.ts` line 11 |

**Gap:** v4 uses different wording and adds numbered list.

---

### 3. **Digging Deeper Method Selection**

| | v2 | v4 |
|---|-----|-----|
| **Content** | "We need to clear this problem. Which method would you like to use?" | "We need to clear this problem. Which method would you like to use?\n\n1. Problem Shifting\n2. Identity Shifting\n3. Belief Shifting\n4. Blockage Shifting" |
| **Location** | `lib/v2/treatment-state-machine.ts` lines 5041, 5130, 5181, etc. | `lib/v4/treatment-modalities/digging-deeper.ts` lines 91, 96 |

**Gap:** v4 adds the numbered list; v2 does not.

---

### 4. **Belief Shifting Intro (Dynamic Question)**

| | v2 | v4 |
|---|-----|-----|
| **Content** | "Feel the problem **'**${problemStatement}**'**... what do you believe about yourself that's causing you to experience this problem **'**${problemStatement}**'**?" | "Feel the problem **that '**${problemStatement}**'**... what do you believe about yourself that's causing you to experience this problem **that '**${problemStatement}**'**?" |
| **Location** | `lib/v2/treatment-state-machine.ts` line 4451 | `lib/v4/treatment-modalities/belief-shifting.ts` line 43 |

**Gap:** v4 inserts "that" before each quoted problem statement.

---

## Matches (v4 matches v2)

| Area | v2 | v4 | Notes |
|------|----|----|-------|
| **Discovery** | restate_selected_problem, analyze_response | Same | Same wording |
| **Problem Shifting** | Full intro + "Feel the problem..." | Split static/dynamic | Same content |
| **Identity Shifting** | Full intro + "Feel the problem of..." | Split static/dynamic | Same content |
| **Blockage Shifting** | Full intro + "Feel '${problemStatement}'..." | Split static/dynamic | Same content |
| **Reality Shifting** | "Close your eyes..." + "Feel that '${goal}' is coming to you..." | Split static/dynamic | Same content |
| **Trauma Shifting** | "Please close your eyes..." + "Think about and feel the negative experience..." | Split static/dynamic | Same content |
| **Work type descriptions** | "Tell me what the problem is in a few words" etc. | Same | Same wording |
| **Integration questions** | Awareness/Action sections | Same | Same wording |
| **Dissolve steps** | body_sensation_check, what_needs_to_happen_step, etc. | Same | Same wording |

---

## Summary

| Category | Count |
|----------|-------|
| **Gaps** | 4 |
| **Matches** | All modality core scripts (Problem, Identity, Belief, Blockage, Reality, Trauma), discovery, work type, integration |

Main differences:

1. **Introduction** – v4 omits the full Mind Shifting explanation.
2. **Method selection** – v4 uses different wording and adds numbered lists.
3. **Belief Shifting** – v4 adds "that" before quoted problem statements.

---

## To Restore Full Parity with v2

1. **Introduction** – Restore the full intro text in `V4_STATIC_AUDIO_TEXTS.INITIAL_WELCOME` (or equivalent).
2. **Method selection** – Change to: "Choose which Mind Shifting method you would like to use to clear the problem:".
3. **Digging deeper method selection** – Change to: "We need to clear this problem. Which method would you like to use?" (no numbered list).
4. **Belief Shifting** – Remove "that" so it matches v2: `Feel the problem '${problemStatement}'...` and `this problem '${problemStatement}'`.
