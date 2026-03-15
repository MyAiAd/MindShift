import { TreatmentPhase } from '../types';

export class WorkTypeSelectionPhase {
  static create(): TreatmentPhase {
    return {
      name: 'Work Type Selection',
      maxDuration: 5,
      steps: [
        {
          id: 'work_type_description',
          scriptedResponse: (userInput, context) => {
            if (!context) {
              throw new Error('Context is undefined in work_type_description');
            }
            if (!context.metadata) {
              context.metadata = {};
            }

            const workType = context.metadata.workType || 'item';

            // Return the prompt only. All routing, phase changes, and problem
            // statement storage are handled by handleWorkTypeDescription in
            // determineNextStep — never in the scriptedResponse.
            if (workType === 'problem') {
              return "Tell me what the problem is in a few words.";
            } else if (workType === 'goal') {
              return "Tell me what the goal is in a few words.";
            } else if (workType === 'negative_experience') {
              return "Tell me what the negative experience was in a few words.";
            }
            return "Tell me what you want to work on in a few words.";
          },
          expectedResponseType: 'description',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me what you would like to work on in a few words.' }
          ],
          nextStep: 'confirm_statement',
          aiTriggers: [
            { condition: 'multipleProblems', action: 'focus' },
            { condition: 'tooLong', action: 'simplify' },
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'confirm_statement',
          scriptedResponse: (userInput, context) => {
            const workType = context.metadata.workType || 'item';
            const input = (userInput || '').toLowerCase();
            const statement = context.metadata.problemStatement || 'your request';

            // This step only handles confirmation - description should already be stored
            if (input === 'yes' || input === 'y' || input.includes('correct') || input.includes('right')) {
              // User confirmed, continue to treatment
              return "Great! Let's continue with the process.";
            } else if (input === 'no' || input === 'n' || input.includes('wrong') || input.includes('incorrect')) {
              // User said no, go back to description step (determineNextStep will handle routing)
              return "Let me ask you again.";
            } else {
              // Show confirmation again if unclear input
              if (workType === 'problem') {
                return `So you want to work on '${statement}'. Is that correct? Please say yes or no.`;
              } else if (workType === 'goal') {
                return `So you want to work on the goal of '${statement}'. Is that correct? Please say yes or no.`;
              } else if (workType === 'negative_experience') {
                return `So you want to work on the negative experience of '${statement}'. Is that correct? Please say yes or no.`;
              } else {
                return `So you want to work on '${statement}'. Is that correct? Please say yes or no.`;
              }
            }
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please confirm if this is correct.' }
          ],
          nextStep: 'route_to_method',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'route_to_method',
          scriptedResponse: (userInput, context) => {
            const workType = context.metadata.workType;
            const selectedMethod = context.metadata.selectedMethod;

            if (workType === 'problem' && selectedMethod) {
              // For problems with selected method, return routing signal
              if (selectedMethod === 'problem_shifting') {
                return "ROUTE_TO_PROBLEM_SHIFTING";
              } else if (selectedMethod === 'identity_shifting') {
                return "ROUTE_TO_IDENTITY_SHIFTING";
              } else if (selectedMethod === 'belief_shifting') {
                return "ROUTE_TO_BELIEF_SHIFTING";
              } else if (selectedMethod === 'blockage_shifting') {
                return "ROUTE_TO_BLOCKAGE_SHIFTING";
              }
            } else if (workType === 'problem' && !selectedMethod) {
              // Problem work type but no method yet - transition signal to route to choose_method
              return "METHOD_SELECTION_NEEDED";
            } else if (workType === 'goal') {
              // Goals automatically use Reality Shifting
              context.metadata.selectedMethod = 'reality_shifting';
              return "What do you want?";
            } else if (workType === 'negative_experience') {
              // Negative experiences automatically use Trauma Shifting
              context.metadata.selectedMethod = 'trauma_shifting';
              // Return static intro part
              return `Please close your eyes and keep them closed throughout the rest of the process.`;
            }

            // Fallback (should not reach here normally)
            return "Please select a method first.";
          },
          expectedResponseType: 'auto', // Changed to auto to support the trauma flow
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please continue.' }
          ],
          nextStep: 'route_to_method_dynamic', // Always go to dynamic step, which will handle final routing
          aiTriggers: []
        },
        {
          id: 'route_to_method_dynamic',
          scriptedResponse: (userInput, context) => {
            const workType = context.metadata.workType;

            if (workType === 'negative_experience') {
              const negativeExperience = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the negative experience';
              return `Think about and feel the negative experience of '${negativeExperience}'. Let your mind go to the worst part of the experience... now freeze it there. Keep feeling this frozen moment... what kind of person are you being in this moment?`;
            }

            // For other types, we shouldn't really be here if they routed away, 
            // BUT if the previous step returned a string (like "What do you want?" for goals),
            // we need to make sure we don't get stuck.
            // Actually, "What do you want?" for goals is a question. 
            // If route_to_method returns it, expectedResponseType='auto' will advance to this step immediately.
            // That's BAD for goals.

            // FIX: We need to handle the non-trauma cases correctly in the previous step or here.
            // Since we can't easily change expectedResponseType dynamically per step in the current architecture (it's defined in the step config),
            // we have a challenge.

            // Strategy:
            // 1. For Trauma: route_to_method (auto) -> route_to_method_dynamic (open)
            // 2. For Goals: route_to_method (auto) -> route_to_method_dynamic (goal/open)
            //    But "What do you want?" needs user input.
            //    If route_to_method is 'auto', it won't wait for input.
            //    It will play "What do you want?" and then immediately go to route_to_method_dynamic.

            // So route_to_method_dynamic needs to be the one asking "What do you want?" for goals?
            // Yes.

            if (workType === 'goal') {
              return "What do you want?";
            }

            return ""; // Should be handled by routing signals in previous step
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please continue.' }
          ],
          nextStep: undefined,
          aiTriggers: []
        }
      ]
    };
  }
}
