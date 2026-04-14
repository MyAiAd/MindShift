/**
 * V6 Static Audio Texts
 * 
 * These are hardcoded text segments from v6 treatment modalities that should be
 * preloaded for instant audio playback. All texts are extracted from the
 * *_intro_static steps in the treatment modality files.
 * 
 * IMPORTANT: If you change these texts, also update the corresponding modality file.
 */

export const V6_STATIC_AUDIO_TEXTS = {
  // Initial welcome message (shown when session starts) - SHORTENED
  // Note: This audio file will not be preloaded to save time
  INITIAL_WELCOME: "Would you like to work on:\n\n1. PROBLEM\n2. GOAL\n3. NEGATIVE EXPERIENCE",

  // Problem Shifting opener (lib/v6/treatment-modalities/problem-shifting.ts)
  PROBLEM_SHIFTING_INTRO: "Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. When I ask 'what needs to happen for the problem to not be a problem?' allow your answers to be different each time.",

  // Identity Shifting opener (lib/v6/treatment-modalities/identity-shifting.ts)
  IDENTITY_SHIFTING_INTRO: "Please close your eyes and keep them closed throughout the rest of the process. Please tell me the first thing that comes up when I ask this question.",

  // Belief Shifting opener (lib/v6/treatment-modalities/belief-shifting.ts)
  // Note: Same text as Problem Shifting
  BELIEF_SHIFTING_INTRO: "Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. When I ask 'what needs to happen for the problem to not be a problem?' allow your answers to be different each time.",

  // Blockage Shifting opener (lib/v6/treatment-modalities/blockage-shifting.ts)
  BLOCKAGE_SHIFTING_INTRO: "Please close your eyes and keep them closed throughout the process. Please give brief answers to my questions and allow the problem to keep changing...we're going to keep going until there is no problem left.",

  // Reality Shifting opener (lib/v6/treatment-modalities/reality-shifting.ts)
  REALITY_SHIFTING_INTRO: "Close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. If ever you feel your goal has changed just let me know.",

  // Trauma Shifting opener (lib/v6/treatment-modalities/trauma-shifting.ts)
  TRAUMA_SHIFTING_INTRO: "Please close your eyes and keep them closed throughout the rest of the process.",

  // Method Selection (lib/v6/treatment-modalities/method-selection.ts) - v2 parity
  METHOD_SELECTION: "Choose which Mind Shifting method you would like to use to clear the problem:",

  // Method Selection for Digging Deeper (lib/v6/treatment-modalities/digging-deeper.ts) - v2 parity (no numbered list)
  METHOD_SELECTION_DIGGING: "We need to clear this problem. Which method would you like to use?",

  // Work Type Descriptions (lib/v6/treatment-modalities/work-type-selection.ts)
  WORK_TYPE_PROBLEM_DESC: "Tell me what the problem is in a few words.",
  WORK_TYPE_GOAL_DESC: "Tell me what the goal is in a few words.",
  WORK_TYPE_NEGATIVE_EXP_DESC: "Tell me what the negative experience was in a few words.",

  // Reality Shifting Questions (lib/v6/treatment-modalities/reality-shifting.ts)
  REALITY_GOAL_CAPTURE: "What do you want?",
  REALITY_DEADLINE_CHECK: "Is there a deadline?",
  REALITY_DEADLINE_DATE: "When do you want to achieve this goal by?",
  REALITY_CERTAINTY: "How certain are you between 0% and 100% that you will achieve this goal?",

  // Discovery Phase (lib/v6/treatment-modalities/discovery.ts)
  RESTATE_PROBLEM: "OK so it is important we use your own words for the problem statement so please tell me what the problem is in a few words",

  // Digging Deeper (lib/v6/treatment-modalities/digging-deeper.ts)
  RESTATE_PROBLEM_SHORT: "How would you state the problem in a few words?"
} as const;

/**
 * Get all unique static texts for preloading
 * (Some modalities share the same text, so we deduplicate)
 */
export function getAllUniqueStaticTexts(): string[] {
  const texts = Object.values(V6_STATIC_AUDIO_TEXTS);
  // Remove duplicates by converting to Set and back to array
  return Array.from(new Set(texts));
}


