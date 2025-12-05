/**
 * V4 Static Audio Texts
 * 
 * These are hardcoded text segments from v4 treatment modalities that should be
 * preloaded for instant audio playback. All texts are extracted from the
 * *_intro_static steps in the treatment modality files.
 * 
 * IMPORTANT: If you change these texts, also update the corresponding modality file.
 */

export const V4_STATIC_AUDIO_TEXTS = {
  // Initial welcome message (shown when session starts)
  INITIAL_WELCOME: "Mind Shifting is not like counselling, therapy or life coaching. The Mind Shifting methods are verbal guided processes that we apply to problems, goals, or negative experiences in order to clear them. The way Mind Shifting works is we won't just be talking about what you want to work on, we will be applying Mind Shifting methods in order to clear them, and to do that we will need to define what you want to work on into a clear statement by you telling me what it is in a few words. So I'll be asking you to do that when needed.\n\nWhen you are ready to begin, would you like to work on:\n\n1. PROBLEM\n2. GOAL\n3. NEGATIVE EXPERIENCE",

  // Problem Shifting opener (lib/v4/treatment-modalities/problem-shifting.ts)
  PROBLEM_SHIFTING_INTRO: "Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. When I ask 'what needs to happen for the problem to not be a problem?' allow your answers to be different each time.",

  // Identity Shifting opener (lib/v4/treatment-modalities/identity-shifting.ts)
  IDENTITY_SHIFTING_INTRO: "Please close your eyes and keep them closed throughout the rest of the process. Please tell me the first thing that comes up when I ask this question.",

  // Belief Shifting opener (lib/v4/treatment-modalities/belief-shifting.ts)
  // Note: Same text as Problem Shifting
  BELIEF_SHIFTING_INTRO: "Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. When I ask 'what needs to happen for the problem to not be a problem?' allow your answers to be different each time.",

  // Blockage Shifting opener (lib/v4/treatment-modalities/blockage-shifting.ts)
  BLOCKAGE_SHIFTING_INTRO: "Please close your eyes and keep them closed throughout the process. Please give brief answers to my questions and allow the problem to keep changing...we're going to keep going until there is no problem left.",

  // Reality Shifting opener (lib/v4/treatment-modalities/reality-shifting.ts)
  REALITY_SHIFTING_INTRO: "Close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. If ever you feel your goal has changed just let me know.",

  // Trauma Shifting opener (lib/v4/treatment-modalities/trauma-shifting.ts)
  TRAUMA_SHIFTING_INTRO: "Please close your eyes and keep them closed throughout the rest of the process."
} as const;

/**
 * Get all unique static texts for preloading
 * (Some modalities share the same text, so we deduplicate)
 */
export function getAllUniqueStaticTexts(): string[] {
  const texts = Object.values(V4_STATIC_AUDIO_TEXTS);
  // Remove duplicates by converting to Set and back to array
  return Array.from(new Set(texts));
}

