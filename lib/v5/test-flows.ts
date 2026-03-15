/**
 * V5 test-flow definitions — standalone lib version for use in API routes
 * and the in-app V5TestRunner component.
 *
 * Mirrors tests/helpers/test-flows.ts exactly, but lives in lib/ so it can
 * be imported from Next.js API routes and client components without pulling
 * in Playwright or Node-only test dependencies.
 */

export interface FlowStep {
  input: string;
  /** If set, assert the response lands on this step */
  expectStep?: string;
  /** If true, assert that quoted problem refs in the message match the problem */
  checkProblemRef?: boolean;
  /** Description for debugging / display in the test runner */
  label?: string;
}

// ---------------------------------------------------------------------------
// Flow 1: Problem Shifting — simple (no cycling, no digging deeper)
// ---------------------------------------------------------------------------
export const PROBLEM_SHIFTING_SIMPLE: FlowStep[] = [
  { input: '1', label: 'Select: Problem', expectStep: 'choose_method' },
  { input: '1', label: 'Select: Problem Shifting', expectStep: 'work_type_description' },
  { input: 'I feel anxious all the time', label: 'Describe problem', checkProblemRef: true, expectStep: 'problem_shifting_intro_dynamic' },
  { input: 'tightness in my chest', label: 'Feel problem → feeling', expectStep: 'body_sensation_check' },
  { input: 'my heart races', label: 'Body sensation check', checkProblemRef: true, expectStep: 'what_needs_to_happen_step' },
  { input: 'to feel calm', label: 'What needs to happen', expectStep: 'feel_solution_state' },
  { input: 'peaceful and relaxed', label: 'Feel solution state', expectStep: 'feel_good_state' },
  { input: 'warmth in my body', label: 'Feel good state', expectStep: 'what_happens_step' },
  { input: 'I feel lighter', label: 'What happens step', checkProblemRef: true, expectStep: 'check_if_still_problem' },
  { input: 'no', label: 'Still a problem? → No', checkProblemRef: true, expectStep: 'digging_deeper_start' },
  { input: 'no', label: 'Dig deeper? → No', expectStep: 'integration_start' },
  { input: 'I feel much better about it', label: 'Integration: how feel now', expectStep: 'awareness_question' },
  { input: 'I am more aware of my body signals', label: 'Integration: more aware', expectStep: 'how_helped_question' },
  { input: 'It helped me release the tension', label: 'Integration: how helped', expectStep: 'narrative_question' },
  { input: 'I can handle stress calmly', label: 'Integration: new narrative', expectStep: 'intention_question' },
  { input: 'To stay calm in difficult situations', label: 'Integration: intention', expectStep: 'action_question' },
  { input: 'Practice breathing exercises daily', label: 'Integration: action', expectStep: 'action_followup' },
  { input: 'nothing else', label: 'Integration: action followup done' },
];

// ---------------------------------------------------------------------------
// Flow 2: Problem Shifting with cycling (answer "yes" to still-a-problem)
// ---------------------------------------------------------------------------
export const PROBLEM_SHIFTING_WITH_CYCLING: FlowStep[] = [
  { input: '1', label: 'Select: Problem' },
  { input: '1', label: 'Select: Problem Shifting' },
  { input: 'I feel overwhelmed at work', label: 'Describe problem', checkProblemRef: true },
  { input: 'stress and pressure', label: 'C1: Feel problem' },
  { input: 'tension in my shoulders', label: 'C1: Body sensation', checkProblemRef: true },
  { input: 'to have more balance', label: 'C1: What needs to happen' },
  { input: 'free and light', label: 'C1: Feel solution' },
  { input: 'energy flowing', label: 'C1: Feel good state' },
  { input: 'I feel relaxed', label: 'C1: What happens', checkProblemRef: true },
  { input: 'yes', label: 'C1: Still a problem? → Yes', checkProblemRef: true },
  { input: 'less intense but still there', label: 'C2: Feel problem' },
  { input: 'slight headache', label: 'C2: Body sensation', checkProblemRef: true },
  { input: 'to let go completely', label: 'C2: What needs to happen' },
  { input: 'total peace', label: 'C2: Feel solution' },
  { input: 'calm and grounded', label: 'C2: Feel good state' },
  { input: 'I feel centered', label: 'C2: What happens', checkProblemRef: true },
  { input: 'no', label: 'C2: Still a problem? → No', checkProblemRef: true },
  { input: 'no', label: 'Dig deeper? → No' },
  { input: 'I feel relieved', label: 'Integration: how feel now' },
  { input: 'That I was holding onto stress', label: 'Integration: more aware' },
  { input: 'I released the pressure', label: 'Integration: how helped' },
  { input: 'Work is manageable', label: 'Integration: new narrative' },
  { input: 'To set boundaries at work', label: 'Integration: intention' },
  { input: 'Talk to my manager about workload', label: 'Integration: action' },
  { input: 'nothing else', label: 'Integration: done' },
];

// ---------------------------------------------------------------------------
// Flow 3: Identity Shifting
// ---------------------------------------------------------------------------
export const IDENTITY_SHIFTING_SIMPLE: FlowStep[] = [
  { input: '1', label: 'Select: Problem' },
  { input: '2', label: 'Select: Identity Shifting' },
  { input: 'I feel like a failure', label: 'Describe problem' },
  { input: 'failure', label: 'Identify the identity' },
  { input: 'heaviness', label: 'Dissolve A' },
  { input: 'in my stomach', label: 'Dissolve B' },
  { input: 'sadness', label: 'Dissolve C' },
  { input: 'it fades', label: 'Dissolve D' },
  { input: 'lighter', label: 'Dissolve E' },
  { input: 'more open', label: 'Dissolve F' },
  { input: 'no', label: 'Future identity check → No' },
  { input: 'no', label: 'Scenario check → No' },
  { input: 'no', label: 'Identity problem check → No' },
  { input: 'no', label: 'Dig deeper? → No' },
  { input: 'I feel free from that identity', label: 'Integration: how feel now' },
  { input: 'I am not defined by failure', label: 'Integration: more aware' },
  { input: 'It helped me let go', label: 'Integration: how helped' },
  { input: 'I am capable and growing', label: 'Integration: new narrative' },
  { input: 'To embrace challenges', label: 'Integration: intention' },
  { input: 'Take on a new project', label: 'Integration: action' },
  { input: 'nothing else', label: 'Integration: done' },
];

// ---------------------------------------------------------------------------
// Flow 4: Belief Shifting
// ---------------------------------------------------------------------------
export const BELIEF_SHIFTING_SIMPLE: FlowStep[] = [
  { input: '1', label: 'Select: Problem' },
  { input: '3', label: 'Select: Belief Shifting' },
  { input: 'I can never succeed', label: 'Describe problem' },
  { input: 'I am not good enough', label: 'Identify belief' },
  { input: 'tightness', label: 'Belief step A' },
  { input: 'in my throat', label: 'Belief step B' },
  { input: 'fear', label: 'Belief step C' },
  { input: 'it softens', label: 'Belief step D' },
  { input: 'calmer', label: 'Belief step E' },
  { input: 'more confident', label: 'Belief step F' },
  { input: 'no', label: 'Belief check 1 → No' },
  { input: 'no', label: 'Belief check 2 → No' },
  { input: 'no', label: 'Belief check 3 → No' },
  { input: 'no', label: 'Belief check 4 → No' },
  { input: 'no', label: 'Belief problem check → No' },
  { input: 'no', label: 'Dig deeper? → No' },
  { input: 'The belief feels dissolved', label: 'Integration: how feel now' },
  { input: 'That I was limiting myself', label: 'Integration: more aware' },
  { input: 'Cleared the blockage', label: 'Integration: how helped' },
  { input: 'I can succeed at what I try', label: 'Integration: new narrative' },
  { input: 'To pursue my goals', label: 'Integration: intention' },
  { input: 'Apply for that promotion', label: 'Integration: action' },
  { input: 'nothing else', label: 'Integration: done' },
];

// ---------------------------------------------------------------------------
// Flow 5: Blockage Shifting
// ---------------------------------------------------------------------------
export const BLOCKAGE_SHIFTING_SIMPLE: FlowStep[] = [
  { input: '1', label: 'Select: Problem' },
  { input: '4', label: 'Select: Blockage Shifting' },
  { input: 'I feel stuck in my career', label: 'Describe problem' },
  { input: 'frustration', label: 'Blockage step A', checkProblemRef: true },
  { input: 'in my chest', label: 'Blockage step B' },
  { input: 'like a wall', label: 'Blockage step C' },
  { input: 'it starts to crumble', label: 'Blockage step D' },
  { input: 'the blockage is gone', label: 'Blockage step E → resolved' },
  { input: 'no', label: 'Dig deeper? → No' },
  { input: 'The blockage is gone', label: 'Integration: how feel now' },
  { input: 'I was blocking myself', label: 'Integration: more aware' },
  { input: 'Removed the wall', label: 'Integration: how helped' },
  { input: 'Career growth is possible', label: 'Integration: new narrative' },
  { input: 'To actively pursue growth', label: 'Integration: intention' },
  { input: 'Network with colleagues', label: 'Integration: action' },
  { input: 'nothing else', label: 'Integration: done' },
];

// ---------------------------------------------------------------------------
// Flow 6: Reality Shifting (Goal)
// ---------------------------------------------------------------------------
export const REALITY_SHIFTING_GOAL: FlowStep[] = [
  { input: '2', label: 'Select: Goal' },
  { input: 'I want to start a business by December', label: 'Describe goal' },
  { input: 'yes', label: 'Confirm goal statement', checkProblemRef: true },
  { input: '40', label: 'Goal certainty: 40%' },
  { input: 'doubt and fear', label: 'Reality: feel doubt', checkProblemRef: true },
  { input: 'I might fail', label: 'Reality: why not possible' },
  { input: 'fear of failure', label: 'Reality: doubt reason' },
  { input: 'less intense', label: 'Reality: cycle check' },
  { input: 'no', label: 'Reality: still doubt? → No' },
  { input: 'I feel confident about my goal', label: 'Integration: how feel now' },
  { input: 'That I was holding myself back', label: 'Integration: more aware' },
  { input: 'Cleared my doubts', label: 'Integration: how helped' },
  { input: 'My business will succeed', label: 'Integration: new narrative' },
  { input: 'Research the market this week', label: 'Integration: action' },
  { input: 'nothing else', label: 'Integration: done' },
];

// ---------------------------------------------------------------------------
// Flow 7: Trauma Shifting (Negative Experience)
// ---------------------------------------------------------------------------
export const TRAUMA_SHIFTING_SIMPLE: FlowStep[] = [
  { input: '3', label: 'Select: Negative Experience' },
  { input: 'Car accident last year', label: 'Describe experience' },
  { input: 'yes', label: 'Agree to trauma process' },
  { input: 'victim', label: 'Trauma identity' },
  { input: 'fear', label: 'Trauma dissolve A' },
  { input: 'shaking', label: 'Trauma dissolve B' },
  { input: 'terror', label: 'Trauma dissolve C' },
  { input: 'it lessens', label: 'Trauma dissolve D' },
  { input: 'calmer', label: 'Trauma dissolve E' },
  { input: 'no', label: 'Future identity check → No' },
  { input: 'no', label: 'Future scenario check → No' },
  { input: 'no', label: 'Experience check → No' },
  { input: 'no', label: 'Trauma dig deeper 1 → No' },
  { input: 'no', label: 'Trauma dig deeper 2 → No' },
  { input: 'I feel at peace with what happened', label: 'Integration: how feel now' },
  { input: 'That I was carrying the trauma', label: 'Integration: more aware' },
  { input: 'Released the stuck emotions', label: 'Integration: how helped' },
  { input: 'The past does not define me', label: 'Integration: new narrative' },
  { input: 'To move forward freely', label: 'Integration: intention' },
  { input: 'Plan a road trip', label: 'Integration: action' },
  { input: 'nothing else', label: 'Integration: done' },
];

// ---------------------------------------------------------------------------
// Flow 8: Single-level digging deeper (Problem Shifting)
// ---------------------------------------------------------------------------
export const DIGGING_DEEPER_SINGLE: FlowStep[] = [
  { input: '1', label: 'Select: Problem' },
  { input: '1', label: 'Select: Problem Shifting' },
  { input: 'I feel angry', label: 'Describe problem' },
  { input: 'rage', label: 'C1: Feel problem' },
  { input: 'clenched fists', label: 'C1: Body sensation' },
  { input: 'to let it go', label: 'C1: What needs to happen' },
  { input: 'peaceful', label: 'C1: Feel solution' },
  { input: 'serenity', label: 'C1: Feel good state' },
  { input: 'calm', label: 'C1: What happens' },
  { input: 'no', label: 'C1: Still a problem? → No' },
  { input: 'yes', label: 'Dig deeper? → Yes' },
  { input: 'yes', label: 'Future problem check → Yes' },
  { input: 'I fear losing control', label: 'Restate future problem', checkProblemRef: false },
  { input: '1', label: 'Method for new problem: Problem Shifting' },
  { input: 'anxiety', label: 'C2: Feel problem' },
  { input: 'racing heart', label: 'C2: Body sensation', checkProblemRef: true },
  { input: 'to stay in control', label: 'C2: What needs to happen' },
  { input: 'confident', label: 'C2: Feel solution' },
  { input: 'strength', label: 'C2: Feel good state' },
  { input: 'empowered', label: 'C2: What happens', checkProblemRef: true },
  { input: 'no', label: 'C2: Still a problem? → No', checkProblemRef: true },
  { input: 'no', label: 'Scenario check → No' },
  { input: 'no', label: 'Anything else check → No' },
  { input: 'I feel in control', label: 'Integration: how feel now' },
  { input: 'The anger was masking fear', label: 'Integration: more aware' },
  { input: 'Released both layers', label: 'Integration: how helped' },
  { input: 'I am calm and in control', label: 'Integration: new narrative' },
  { input: 'To respond not react', label: 'Integration: intention' },
  { input: 'Pause before responding', label: 'Integration: action' },
  { input: 'nothing else', label: 'Integration: done' },
];

// ---------------------------------------------------------------------------
// Flow 9: Cross-modality digging (Problem Shifting → Identity Shifting)
// ---------------------------------------------------------------------------
export const CROSS_MODALITY_DIGGING: FlowStep[] = [
  { input: '1', label: 'Select: Problem' },
  { input: '1', label: 'Select: Problem Shifting' },
  { input: 'I feel worthless', label: 'Describe problem' },
  { input: 'emptiness', label: 'C1: Feel problem' },
  { input: 'hollow chest', label: 'C1: Body sensation' },
  { input: 'to feel valued', label: 'C1: What needs to happen' },
  { input: 'appreciated', label: 'C1: Feel solution' },
  { input: 'fullness', label: 'C1: Feel good state' },
  { input: 'whole', label: 'C1: What happens' },
  { input: 'no', label: 'C1: Still a problem? → No' },
  { input: 'yes', label: 'Dig deeper? → Yes' },
  { input: 'yes', label: 'Future problem → Yes' },
  { input: 'I feel like nobody cares', label: 'Restate future problem' },
  { input: '2', label: 'Method: Identity Shifting' },
  { input: 'invisible person', label: 'Identity identification', checkProblemRef: true },
  { input: 'sadness', label: 'Dissolve A' },
  { input: 'heavy heart', label: 'Dissolve B' },
  { input: 'loneliness', label: 'Dissolve C' },
  { input: 'it lifts', label: 'Dissolve D' },
  { input: 'seen', label: 'Dissolve E' },
  { input: 'present', label: 'Dissolve F' },
  { input: 'no', label: 'Future identity check → No' },
  { input: 'no', label: 'Scenario check → No' },
  { input: 'no', label: 'Identity problem check → No' },
  { input: 'no', label: 'Scenario check on original → No' },
  { input: 'no', label: 'Anything else → No' },
  { input: 'I feel seen and valued', label: 'Integration: how feel now' },
  { input: 'Two layers cleared', label: 'Integration: more aware' },
  { input: 'Deep shift happened', label: 'Integration: how helped' },
  { input: 'I matter', label: 'Integration: new narrative' },
  { input: 'To show up fully', label: 'Integration: intention' },
  { input: 'Reach out to a friend', label: 'Integration: action' },
  { input: 'nothing else', label: 'Integration: done' },
];

// ---------------------------------------------------------------------------
// All V5 flows keyed by name
// ---------------------------------------------------------------------------
export const ALL_V5_FLOWS: Record<string, FlowStep[]> = {
  'Problem Shifting (simple)': PROBLEM_SHIFTING_SIMPLE,
  'Problem Shifting (with cycling)': PROBLEM_SHIFTING_WITH_CYCLING,
  'Identity Shifting': IDENTITY_SHIFTING_SIMPLE,
  'Belief Shifting': BELIEF_SHIFTING_SIMPLE,
  'Blockage Shifting': BLOCKAGE_SHIFTING_SIMPLE,
  'Reality Shifting (Goal)': REALITY_SHIFTING_GOAL,
  'Trauma Shifting': TRAUMA_SHIFTING_SIMPLE,
  'Digging Deeper (single)': DIGGING_DEEPER_SINGLE,
  'Cross-modality Digging': CROSS_MODALITY_DIGGING,
};
