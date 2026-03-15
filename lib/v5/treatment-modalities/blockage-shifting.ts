import { TreatmentPhase } from '../types';
import { TextProcessingUtils } from '../text-processing-utils';

export class BlockageShiftingPhase {
  static create(): TreatmentPhase {
    return {
      name: 'Blockage Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'blockage_shifting_intro_static',
          scriptedResponse: (userInput, context) => {
            return `Please close your eyes and keep them closed throughout the process. Please give brief answers to my questions and allow the problem to keep changing...we're going to keep going until there is no problem left.`;
          },
          expectedResponseType: 'auto',
          validationRules: [],
          nextStep: 'blockage_shifting_intro_dynamic',
          aiTriggers: []
        },

        {
          id: 'blockage_shifting_intro_dynamic',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement - handle digging deeper context
            const problemStatement = context?.metadata?.currentDiggingProblem ||
              context?.metadata?.newDiggingProblem ||
              context?.problemStatement ||
              context?.metadata?.problemStatement ||
              context?.userResponses?.['restate_selected_problem'] ||
              context?.userResponses?.['mind_shifting_explanation'] ||
              'the problem';

            return `Feel '${problemStatement}'... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'blockage_step_b',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_step_b',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'blockage_step_c',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_step_c',
          scriptedResponse: (userInput, context) => {
            // Check if previous response was "I don't know" or "I can't feel it"
            const previousResponse = context?.userResponses?.[context.currentStep] || '';
            const unknownIndicators = ['don\'t know', 'can\'t feel', 'no idea', 'not sure'];
            const isUnknownResponse = unknownIndicators.some(indicator => previousResponse.toLowerCase().includes(indicator));

            if (isUnknownResponse && !context?.metadata?.hasAskedToGuess) {
              context.metadata.hasAskedToGuess = true;
              return `That's okay. Can you guess what it would feel like to not have this problem?`;
            } else if (isUnknownResponse && context?.metadata?.hasAskedToGuess) {
              context.metadata.hasAskedToGuess = false;
              return `Feel that you don't know... what does that feel like?`;
            }

            return `Feel the problem that you have right now... what would it feel like to not have this problem?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it would feel like to not have this problem.' }
          ],
          nextStep: 'blockage_step_d',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_step_d',
          scriptedResponse: (userInput, context) => {
            // Check if current response is "I don't know" or "I can't feel it"
            const unknownIndicators = ['don\'t know', 'can\'t feel', 'no idea', 'not sure'];
            const isUnknownResponse = unknownIndicators.some(indicator => (userInput || '').toLowerCase().includes(indicator));

            if (isUnknownResponse && !context?.metadata?.hasAskedToGuessD) {
              context.metadata.hasAskedToGuessD = true;
              return `That's okay. Can you guess what '${userInput || 'that feeling'}' feels like?`;
            } else if (isUnknownResponse && context?.metadata?.hasAskedToGuessD) {
              context.metadata.hasAskedToGuessD = false;
              return `Feel that you can't feel it... what does that feel like?`;
            }

            return `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'blockage_step_e',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_step_e',
          scriptedResponse: () => `What's the problem now?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please tell me what the problem is now.' }
          ],
          nextStep: 'blockage_shifting_intro_dynamic', // Direct cycle back to step A with new problem
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_check_if_still_problem',
          scriptedResponse: (userInput) => {
            // Check if they said "no problem", "nothing", "gone", etc.
            const noProblemIndicators = ['no problem', 'nothing', 'none', 'gone', 'resolved', 'fine', 'good', 'better', 'clear'];
            const response = (userInput || '').toLowerCase();
            const seemsResolved = noProblemIndicators.some(indicator => response.includes(indicator));

            if (seemsResolved) {
              // Signal that we should transition immediately - this message won't be shown
              return 'TRANSITION_TO_DIG_DEEPER';
            }

            return `Feel '${userInput || 'that problem'}'... what does it feel like?`;
          },
          expectedResponseType: 'open', // Can be feeling description or yes/no for dig deeper
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please tell me how you feel or if there is still a problem.' }
          ],
          nextStep: undefined, // Dynamic routing handled by processStep logic
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        // Integration Questions - Awareness Section
        {
          id: 'blockage_integration_awareness_1',
          scriptedResponse: (userInput, context) => {
            const subject = TextProcessingUtils.getIntegrationSubject(context, 'problem');
            return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${subject}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how you feel about it now.' }
          ],
          nextStep: 'blockage_integration_awareness_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_integration_awareness_2',
          scriptedResponse: () => `What are you more aware of now than before we did this process?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what you are more aware of now.' }
          ],
          nextStep: 'blockage_integration_awareness_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_integration_awareness_3',
          scriptedResponse: () => `How has it helped you to do this process?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how this process has helped you.' }
          ],
          nextStep: 'blockage_integration_awareness_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_integration_awareness_4',
          scriptedResponse: () => `What is your new narrative about this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your new narrative.' }
          ],
          nextStep: 'blockage_integration_awareness_5',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_integration_awareness_5',
          scriptedResponse: () => `What's your intention now in relation to this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your intention now.' }
          ],
          nextStep: 'blockage_integration_action_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        // Integration Questions - Action Section
        {
          id: 'blockage_integration_action_1',
          scriptedResponse: () => `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?... What else needs to happen for you to realise your intention? (Until they are clear on their plan of action)`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what needs to happen.' }
          ],
          nextStep: 'blockage_integration_action_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_integration_action_2',
          scriptedResponse: () => `What is the one thing you can do that will make everything else easier or unnecessary?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'blockage_integration_action_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'blockage_integration_action_3',
          scriptedResponse: () => `What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action and when you will do it.' }
          ],
          nextStep: undefined, // End of Blockage Shifting process
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        }
      ]
    };
  }
}
