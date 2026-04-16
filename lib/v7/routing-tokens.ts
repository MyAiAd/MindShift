// Internal V7 control tokens. These are routing and orchestration signals,
// not patient-facing copy, so they must never be rendered or spoken.
export const ROUTING_TOKENS = [
  'GOAL_SELECTION_CONFIRMED', // Introduction work-type branch routes to goal capture.
  'NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED', // Introduction work-type branch routes to trauma capture.
  'PROBLEM_SELECTION_CONFIRMED', // Introduction work-type branch routes to problem method selection.
  'METHOD_SELECTION_NEEDED', // Discovery and digging-deeper flows trigger method-selection UI.
  'SKIP_TO_TREATMENT_INTRO', // Internal shortcut that bypasses intermediate setup prompts.
  'ROUTE_TO_PROBLEM_INTEGRATION', // Problem flow completion jumps into integration.
  'ROUTE_TO_IDENTITY_INTEGRATION', // Identity flow completion jumps into integration.
  'ROUTE_TO_BELIEF_INTEGRATION', // Belief flow completion jumps into integration.
  'ROUTE_TO_BLOCKAGE_INTEGRATION', // Blockage flow completion jumps into integration.
  'ROUTE_TO_TRAUMA_INTEGRATION', // Trauma flow completion jumps into integration.
  'ROUTE_TO_INTEGRATION', // Digging-deeper completion exits into integration.
  'PROBLEM_SHIFTING_SELECTED', // Digging-deeper method selection chose Problem Shifting.
  'IDENTITY_SHIFTING_SELECTED', // Digging-deeper method selection chose Identity Shifting.
  'BELIEF_SHIFTING_SELECTED', // Digging-deeper method selection chose Belief Shifting.
  'BLOCKAGE_SHIFTING_SELECTED', // Digging-deeper method selection chose Blockage Shifting.
  'TRANSITION_TO_DIG_DEEPER', // Blockage flow sentinel auto-advances into Digging Deeper.
] as const;

export type RoutingToken = (typeof ROUTING_TOKENS)[number];
