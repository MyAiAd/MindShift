import { TreatmentPhase } from '../types';
import { TextProcessingUtils } from '../text-processing-utils';

export class BeliefShiftingPhase {
  static create(): TreatmentPhase {
    return {
      name: 'Belief Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'belief_shifting_intro_static',
          scriptedResponse: (userInput, context) => {
            // First time through - show full instructions
            return `Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. When I ask 'what needs to happen for the problem to not be a problem?' allow your answers to be different each time.`;
          },
          expectedResponseType: 'auto',
          validationRules: [],
          nextStep: 'belief_shifting_intro_dynamic',
          aiTriggers: []
        },

        {
          id: 'belief_shifting_intro_dynamic',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement - prioritize digging deeper restated problem
            console.log('🔍 BELIEF_DEBUG belief_shifting_intro - context.metadata:', JSON.stringify(context.metadata, null, 2));
            const diggingProblem = context?.metadata?.currentDiggingProblem;

            // Extended fallbacks to handle complex digging deeper scenarios
            const problemStatement = diggingProblem
              || context?.userResponses?.['restate_scenario_problem_1']
              || context?.userResponses?.['restate_scenario_problem_2']
              || context?.userResponses?.['restate_scenario_problem_3']
              || context?.userResponses?.['restate_anything_else_problem_1']
              || context?.userResponses?.['restate_anything_else_problem_2']
              || context?.problemStatement
              || context?.userResponses?.['restate_selected_problem']
              || context?.userResponses?.['mind_shifting_explanation']
              || 'the problem';

            // Check if we're coming from digging deeper (shorter instructions)
            // Note: If we skipped, we would have jumped straight here from the previous step

            return `Feel the problem that '${problemStatement}'... what do you believe about yourself that's causing you to experience this problem that '${problemStatement}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you believe about yourself.' }
          ],
          nextStep: 'belief_step_a',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_a',
          scriptedResponse: (userInput, context) => {
            // Store the belief for use throughout the process
            console.log('🔍 BELIEF_DEBUG belief_step_a - userInput:', userInput);
            console.log('🔍 BELIEF_DEBUG belief_step_a - context.metadata before:', JSON.stringify(context.metadata, null, 2));

            // Always store the belief from userInput (whether first iteration or cycling back with new belief)
            context.metadata.currentBelief = userInput || context.metadata.currentBelief || 'that belief';

            console.log('🔍 BELIEF_DEBUG belief_step_a - context.metadata after:', JSON.stringify(context.metadata, null, 2));
            const belief = context.metadata.currentBelief;
            return `Feel yourself believing '${belief}'... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like to believe that.' }
          ],
          nextStep: 'belief_step_b',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_b',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'belief_step_c',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_c',
          scriptedResponse: () => `What would you rather feel?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you would rather feel.' }
          ],
          nextStep: 'belief_step_d',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_d',
          scriptedResponse: (userInput, context) => {
            // Store the desired feeling for reference
            context.metadata.desiredFeeling = userInput || context.metadata.desiredFeeling || 'that feeling';
            const desiredFeeling = context.metadata.desiredFeeling;
            return `What would '${desiredFeeling}' feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that would feel like.' }
          ],
          nextStep: 'belief_step_e',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_e',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'belief_step_f',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_f',
          scriptedResponse: (userInput, context) => {
            console.log('🔍 BELIEF_DEBUG belief_step_f - context.metadata:', JSON.stringify(context.metadata, null, 2));

            // SURGICAL FIX: Use appropriate belief based on iteration
            const cycleCount = context.metadata.cycleCount || 0;
            let belief;

            if (cycleCount === 0) {
              // First iteration: use original belief from belief_shifting_intro_dynamic
              belief = context.userResponses?.['belief_shifting_intro_dynamic'] || context.metadata.currentBelief || 'that belief';
            } else {
              // Iterations 2+: use new belief from current cycle's belief_step_a
              belief = context.userResponses?.['belief_step_a'] || context.metadata.currentBelief || 'that belief';
            }

            console.log('🔍 BELIEF_DEBUG belief_step_f - cycleCount:', cycleCount);
            console.log('🔍 BELIEF_DEBUG belief_step_f - retrieved belief:', belief);
            console.log('🔍 BELIEF_DEBUG belief_step_f - belief_shifting_intro_dynamic:', context.userResponses?.['belief_shifting_intro_dynamic']);
            console.log('🔍 BELIEF_DEBUG belief_step_f - belief_step_a:', context.userResponses?.['belief_step_a']);

            return `Do you still believe '${belief}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_check_1',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_check_1',
          scriptedResponse: (userInput, context) => {
            const belief = context.metadata.currentBelief || 'that belief';
            return `Does any part of you still believe '${belief}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_check_2',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_check_2',
          scriptedResponse: (userInput, context) => {
            const belief = context.metadata.currentBelief || 'that belief';
            return `Do you feel you may believe '${belief}' again in the future?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_check_3',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_check_3',
          scriptedResponse: (userInput, context) => {
            const belief = context.metadata.currentBelief || 'that belief';
            return `Is there any scenario in which you would still believe '${belief}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_check_4',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_check_4',
          scriptedResponse: (userInput, context) => {
            console.log('🔍 BELIEF_DEBUG belief_check_4 - context.metadata:', JSON.stringify(context.metadata, null, 2));
            const belief = context.metadata.currentBelief || 'that belief';
            console.log('🔍 BELIEF_DEBUG belief_check_4 - retrieved belief:', belief);

            // Simple word rearrangement to preserve user's exact language while making it grammatically correct
            const positiveBeliefStatement = TextProcessingUtils.createPositiveBeliefStatement(belief);
            console.log('🔍 BELIEF_DEBUG belief_check_4 - positive statement:', positiveBeliefStatement);

            return `Do you now know ${positiveBeliefStatement}?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_problem_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_problem_check',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement - prioritize digging deeper restated problem
            const diggingProblem = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem;
            const problemStatement = diggingProblem || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
            console.log(`🔍 BELIEF_PROBLEM_CHECK: Using problem statement: "${problemStatement}" (digging: "${diggingProblem}", original: "${context?.problemStatement}")`);
            return `Feel '${problemStatement}'... does it still feel like a problem?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_integration_awareness_1',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        // Integration Questions - Awareness Section
        {
          id: 'belief_integration_awareness_1',
          scriptedResponse: (userInput, context) => {
            const subject = TextProcessingUtils.getIntegrationSubject(context, 'problem');
            return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${subject}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how you feel about it now.' }
          ],
          nextStep: 'belief_integration_awareness_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_awareness_2',
          scriptedResponse: () => `What are you more aware of now than before we did this process?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what you are more aware of now.' }
          ],
          nextStep: 'belief_integration_awareness_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_awareness_3',
          scriptedResponse: () => `How has it helped you to do this process?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how this process has helped you.' }
          ],
          nextStep: 'belief_integration_awareness_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_awareness_4',
          scriptedResponse: () => `What is your new narrative about this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your new narrative.' }
          ],
          nextStep: 'belief_integration_awareness_5',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_awareness_5',
          scriptedResponse: () => `What's your intention now in relation to this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your intention now.' }
          ],
          nextStep: 'belief_integration_action_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        // Integration Questions - Action Section
        {
          id: 'belief_integration_action_1',
          scriptedResponse: () => `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?... What else needs to happen for you to realise your intention? (Until they are clear on their plan of action)`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what needs to happen.' }
          ],
          nextStep: 'belief_integration_action_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_action_2',
          scriptedResponse: () => `What is the one thing you can do that will make everything else easier or unnecessary?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'belief_integration_action_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_action_3',
          scriptedResponse: () => `What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action and when you will do it.' }
          ],
          nextStep: undefined, // End of Belief Shifting process
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        }
      ]
    };
  }
}
