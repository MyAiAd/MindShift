import { TreatmentPhase } from '../types';
import { TextProcessingUtils } from '../text-processing-utils';

export class ProblemShiftingPhase {
  static create(): TreatmentPhase {
    return {
      name: 'Problem Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'problem_shifting_intro',
          scriptedResponse: (userInput, context) => {
            // Use the cleanest version of the problem statement - prioritize digging deeper restated problem
            const diggingProblem = context?.metadata?.currentDiggingProblem;
            const cleanProblemStatement = diggingProblem || context?.metadata?.problemStatement || context?.problemStatement || 'the problem';
            console.log(`🔍 PROBLEM_SHIFTING_INTRO: Using clean problem statement: "${cleanProblemStatement}" (digging: "${diggingProblem}")`);
            console.log(`🔍 PROBLEM_SHIFTING_INTRO: Available sources - metadata.problemStatement: "${context?.metadata?.problemStatement}", problemStatement: "${context?.problemStatement}", userInput: "${userInput}"`);
            
            // Check if we should skip intro instructions (when cycling back from check_if_still_problem OR coming from digging deeper)
            const isFromDigging = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem;
            if (context?.metadata?.skipIntroInstructions || isFromDigging) {
              // Clear flags and return only the problem feeling question
              context.metadata.skipIntroInstructions = false;
              context.metadata.skipLinguisticProcessing = false;
              console.log(`🔍 PROBLEM_SHIFTING_INTRO: Skipping lengthy instructions - isFromDigging: ${!!isFromDigging}, skipFlag: ${!!context?.metadata?.skipIntroInstructions}`);
              return `Feel the problem '${cleanProblemStatement}'... what does it feel like?`;
            }
            
            // First time through - show full instructions
            return `Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. When I ask 'what needs to happen for the problem to not be a problem?' allow your answers to be different each time.

Feel the problem '${cleanProblemStatement}'... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'body_sensation_check',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'body_sensation_check',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`,
          expectedResponseType: 'experience',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens when you feel that.' }
          ],
          nextStep: 'what_needs_to_happen_step',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'what_needs_to_happen_step',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement - prioritize digging deeper, then metadata (set at work_type_description), then fallbacks
            const diggingProblem = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem;
            const problemStatement = diggingProblem || context?.metadata?.problemStatement || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
            console.log(`🔍 WHAT_NEEDS_TO_HAPPEN_STEP: Using problem statement: "${problemStatement}" (digging: "${diggingProblem}", metadata: "${context?.metadata?.problemStatement}", original: "${context?.problemStatement}")`);
            return `Feel '${problemStatement}'... what needs to happen for this to not be a problem?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what needs to happen.' }
          ],
          nextStep: 'feel_solution_state',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'feel_solution_state',
          scriptedResponse: (userInput, context) => {
            // Get the response from the previous step (what_needs_to_happen_step)
            const previousAnswer = context?.userResponses?.['what_needs_to_happen_step'] || 'that';
            return `What would you feel like if ${previousAnswer} had already happened?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you would feel like.' }
          ],
          nextStep: 'feel_good_state',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'feel_good_state',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feeling feels like.' }
          ],
          nextStep: 'what_happens_step',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'what_happens_step',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`,
          expectedResponseType: 'experience',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens when you feel that.' }
          ],
          nextStep: 'check_if_still_problem',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'check_if_still_problem',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement - prioritize digging deeper restated problem
            const diggingProblem = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem;
            const problemStatement = diggingProblem || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
            console.log(`🔍 CHECK_IF_STILL_PROBLEM: Using problem statement: "${problemStatement}" (digging: "${diggingProblem}", original: "${context?.problemStatement}")`);
            return `Feel the problem '${problemStatement}'... does it still feel like a problem?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please tell me if it still feels like a problem.' }
          ],
          nextStep: 'digging_deeper_start',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        // Integration Questions - AWARENESS Section
        {
          id: 'problem_integration_awareness_1',
          scriptedResponse: (userInput, context) => {
            const subject = TextProcessingUtils.getIntegrationSubject(context, 'problem');
            return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${subject}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how you feel about it now.' }
          ],
          nextStep: 'problem_integration_awareness_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'problem_integration_awareness_2',
          scriptedResponse: (userInput, context) => {
            return `What are you more aware of now than before we did this process?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what you are more aware of now.' }
          ],
          nextStep: 'problem_integration_awareness_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'problem_integration_awareness_3',
          scriptedResponse: (userInput, context) => {
            return `How has it helped you to do this process?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how this process has helped you.' }
          ],
          nextStep: 'problem_integration_awareness_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'problem_integration_awareness_4',
          scriptedResponse: (userInput, context) => {
            return `What is your new narrative about this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your new narrative.' }
          ],
          nextStep: 'problem_integration_awareness_5',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'problem_integration_awareness_5',
          scriptedResponse: (userInput, context) => {
            return `What's your intention now in relation to this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your intention now.' }
          ],
          nextStep: 'problem_integration_action_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        // Integration Questions - ACTION Section
        {
          id: 'problem_integration_action_1',
          scriptedResponse: (userInput, context) => {
            return `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?... What else needs to happen for you to realise your intention? (Until they are clear on their plan of action)`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what needs to happen.' }
          ],
          nextStep: 'problem_integration_action_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'problem_integration_action_2',
          scriptedResponse: (userInput, context) => {
            return `What is the one thing you can do that will make everything else easier or unnecessary?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'problem_integration_action_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'problem_integration_action_3',
          scriptedResponse: (userInput, context) => {
            return `What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action and when you will do it.' }
          ],
          nextStep: undefined, // End of Problem Shifting process
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        }
      ]
    };
  }
}
