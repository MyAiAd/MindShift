import { TreatmentPhase } from '../types';

export class DiggingDeeperPhase {
  static create(): TreatmentPhase {
    return {
      name: 'Digging Deeper',
      maxDuration: 20,
      steps: [
        {
          id: 'digging_deeper_start',
          scriptedResponse: (userInput, context) => {
            // Add specific problem reference for personalization
            const problemStatement = context?.metadata?.originalProblemStatement || context?.metadata?.problemStatement || context?.problemStatement || 'the problem';
            return `Take your mind back to '${problemStatement}'. Would you like to dig deeper in this area?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'future_problem_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'future_problem_check',
          scriptedResponse: (userInput, context) => {
            // Add specific problem reference for personalization
            const originalProblem = context?.metadata?.originalProblemStatement || context?.metadata?.problemStatement || context?.problemStatement || 'the problem';
            return `Do you feel '${originalProblem}' will come back in the future?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'restate_problem_future',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'restate_problem_future',
          scriptedResponse: (userInput, context) => {
            // Store the new problem statement when user provides it
            console.log('🔍 BELIEF_DEBUG restate_problem_future - userInput:', userInput);
            console.log('🔍 BELIEF_DEBUG restate_problem_future - context.metadata before:', JSON.stringify(context.metadata, null, 2));
            if (userInput && userInput.trim()) {
              console.log(`🔍 RESTATE_PROBLEM_FUTURE: Storing new problem: "${userInput}"`);
              context.metadata.newDiggingProblem = userInput.trim();
              // Clear currentDiggingProblem so digging_method_selection can promote the new problem
              // on subsequent digging passes (not just the first pass)
              context.metadata.currentDiggingProblem = undefined;
              console.log(`🔍 RESTATE_PROBLEM_FUTURE: Cleared currentDiggingProblem to allow re-promotion`);
            }
            console.log('🔍 BELIEF_DEBUG restate_problem_future - context.metadata after:', JSON.stringify(context.metadata, null, 2));
            return "How would you state the problem now in a few words?";
          },
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me how you would state the problem now.' }
          ],
          nextStep: 'digging_method_selection',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' },
            { condition: 'tooLong', action: 'simplify' }
          ]
        },
        {
          id: 'digging_method_selection',
          scriptedResponse: (userInput, context) => {
            const input = userInput || '';
            console.log('🔍 BELIEF_DEBUG digging_method_selection - userInput:', userInput);
            console.log('🔍 BELIEF_DEBUG digging_method_selection - context.metadata before:', JSON.stringify(context.metadata, null, 2));
            console.log('🔍 BELIEF_DEBUG digging_method_selection - context.problemStatement before:', context.problemStatement);
            
            // v2 parity: promote restate_problem_future into currentDiggingProblem without clobbering trauma return steps.
            const alreadySetup =
              context.metadata.currentDiggingProblem &&
              context.metadata.returnToDiggingStep &&
              context.metadata.returnToDiggingStep !== 'future_problem_check';
            const newProblemFromRestate = context.userResponses?.['restate_problem_future'];
            if (newProblemFromRestate && newProblemFromRestate.trim() && !alreadySetup) {
              const newProblem = newProblemFromRestate.trim();
              context.metadata.currentDiggingProblem = newProblem;
              context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 1) + 1;
              if (
                !context.metadata.returnToDiggingStep ||
                context.metadata.returnToDiggingStep === 'future_problem_check'
              ) {
                context.metadata.returnToDiggingStep = 'future_problem_check';
              }
              context.problemStatement = newProblem;
              context.metadata.problemStatement = newProblem;
              context.metadata.workType = 'problem';
              console.log(`🔍 DIGGING_METHOD_SELECTION: Stored new problem from restate_problem_future: "${newProblem}"`);
              console.log('🔍 BELIEF_DEBUG digging_method_selection - context.metadata after storing:', JSON.stringify(context.metadata, null, 2));
              return "We need to clear this problem. Which method would you like to use?";
            }

            // Legacy path: first input on this step without userResponses (should be rare in v5)
            if (!context.metadata.currentDiggingProblem && input && input !== 'METHOD_SELECTION_NEEDED') {
              const newProblem = context.metadata.newDiggingProblem || input;
              context.metadata.currentDiggingProblem = newProblem;
              context.metadata.problemStatement = newProblem;
              context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 1) + 1;
              if (
                !context.metadata.returnToDiggingStep ||
                context.metadata.returnToDiggingStep === 'future_problem_check'
              ) {
                context.metadata.returnToDiggingStep = 'future_problem_check';
              }
              context.problemStatement = newProblem;
              context.metadata.workType = 'problem';
              console.log(`🔍 DIGGING_METHOD_SELECTION: Stored new problem (legacy): "${newProblem}"`);
              return "We need to clear this problem. Which method would you like to use?";
            }
            
            // If we already have the problem stored and no new input, show the selection message
            if (!input || input === 'METHOD_SELECTION_NEEDED') {
              return "We need to clear this problem. Which method would you like to use?";
            }
            
            // Validate: full method phrases or a lone digit 1–4 only (avoid "problem 3" matching "3")
            const normalized = input.toLowerCase().trim();
            const numericOnly = /^[1-4]$/.test(normalized);
            const hasMethodPhrase = ['problem shifting', 'identity shifting', 'belief shifting', 'blockage shifting'].some(
              (p) => normalized.includes(p)
            );
            if (!numericOnly && !hasMethodPhrase) {
              return "Please choose a valid option (1-4) or method name.";
            }

            // Handle method selection - return routing signals instead of direct phase manipulation
            if (normalized.includes('problem shifting') || normalized === '1') {
              context.metadata.selectedMethod = 'problem_shifting';
              context.metadata.skipIntroInstructions = true; // Skip lengthy instructions for digging deeper
              console.log(`🔍 DIGGING_METHOD_SELECTION: Selected Problem Shifting for digging deeper`);
              return "PROBLEM_SHIFTING_SELECTED";
            } else if (normalized.includes('identity shifting') || normalized === '2') {
              context.metadata.selectedMethod = 'identity_shifting';
              context.metadata.skipIntroInstructions = true; // Skip lengthy instructions for digging deeper
              console.log(`🔍 DIGGING_METHOD_SELECTION: Selected Identity Shifting for digging deeper`);
              return "IDENTITY_SHIFTING_SELECTED";
            } else if (normalized.includes('belief shifting') || normalized === '3') {
              context.metadata.selectedMethod = 'belief_shifting';
              context.metadata.skipIntroInstructions = true; // Skip lengthy instructions for digging deeper
              console.log(`🔍 DIGGING_METHOD_SELECTION: Selected Belief Shifting for digging deeper`);
              return "BELIEF_SHIFTING_SELECTED";
            } else if (normalized.includes('blockage shifting') || normalized === '4') {
              context.metadata.selectedMethod = 'blockage_shifting';
              context.metadata.skipIntroInstructions = true; // Skip lengthy instructions for digging deeper
              console.log(`🔍 DIGGING_METHOD_SELECTION: Selected Blockage Shifting for digging deeper`);
              return "BLOCKAGE_SHIFTING_SELECTED";
            } else {
              return "Please choose Problem Shifting, Identity Shifting, Belief Shifting, or Blockage Shifting.";
            }
          },
          expectedResponseType: 'selection',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose a method.' }
          ],
          nextStep: undefined, // Handled by routing logic based on selected method
          aiTriggers: []
        },
        {
          id: 'scenario_check_1',
          scriptedResponse: (userInput, context) => {
            // Add specific problem reference for personalization
            const originalProblem = context?.metadata?.originalProblemStatement || context?.metadata?.problemStatement || context?.problemStatement || 'this';
            return `Is there any scenario in which '${originalProblem}' would still be a problem for you?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'restate_scenario_problem_1',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'restate_scenario_problem_1',
          scriptedResponse: "How would you state the problem in a few words?",
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me how you would state this scenario problem.' }
          ],
          nextStep: 'clear_scenario_problem_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' },
            { condition: 'tooLong', action: 'simplify' }
          ]
        },
        {
          id: 'clear_scenario_problem_1',
          scriptedResponse: (userInput, context) => {
            // Store the new scenario problem for clearing
            const newProblem = context?.userResponses?.['restate_scenario_problem_1'] || 'the problem';
            context.metadata.currentDiggingProblem = newProblem;
            context.metadata.problemStatement = newProblem;
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 2) + 1;
            context.metadata.returnToDiggingStep = 'scenario_check_1'; // Return to same scenario check after clearing
            context.problemStatement = newProblem;
            
            // Return routing signal based on original method used
            const originalMethod = context.metadata.selectedMethod;
            if (originalMethod === 'problem_shifting') {
              return "PROBLEM_SHIFTING_SELECTED";
            } else if (originalMethod === 'identity_shifting') {
              return "IDENTITY_SHIFTING_SELECTED";
            } else if (originalMethod === 'belief_shifting') {
              return "BELIEF_SHIFTING_SELECTED";
            } else if (originalMethod === 'blockage_shifting') {
              return "BLOCKAGE_SHIFTING_SELECTED";
            } else if (originalMethod === 'reality_shifting') {
              return "REALITY_SHIFTING_SELECTED";
            } else if (originalMethod === 'trauma_shifting') {
              return "TRAUMA_SHIFTING_SELECTED";
            } else {
              // Default to problem shifting
              return "PROBLEM_SHIFTING_SELECTED";
            }
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please continue with the process.' }
          ],
          nextStep: undefined, // Handled by routing logic
          aiTriggers: []
        },
        {
          id: 'scenario_check_2',
          scriptedResponse: (userInput, context) => {
            // Add specific problem reference for personalization
            const originalProblem = context?.metadata?.originalProblemStatement || context?.metadata?.problemStatement || context?.problemStatement || 'this';
            return `Is there any scenario in which '${originalProblem}' would still be a problem for you?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'restate_scenario_problem_2',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'restate_scenario_problem_2',
          scriptedResponse: "How would you state the problem in a few words?",
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me how you would state this scenario problem.' }
          ],
          nextStep: 'clear_scenario_problem_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' },
            { condition: 'tooLong', action: 'simplify' }
          ]
        },
        {
          id: 'clear_scenario_problem_2',
          scriptedResponse: (userInput, context) => {
            // Store the new scenario problem for clearing
            const newProblem = context?.userResponses?.['restate_scenario_problem_2'] || 'the problem';
            context.metadata.currentDiggingProblem = newProblem;
            context.metadata.problemStatement = newProblem;
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 3) + 1;
            context.metadata.returnToDiggingStep = 'scenario_check_2'; // Return to same scenario check after clearing
            context.problemStatement = newProblem;
            
            // Return routing signal based on original method used
            const originalMethod = context.metadata.selectedMethod;
            if (originalMethod === 'problem_shifting') {
              return "PROBLEM_SHIFTING_SELECTED";
            } else if (originalMethod === 'identity_shifting') {
              return "IDENTITY_SHIFTING_SELECTED";
            } else if (originalMethod === 'belief_shifting') {
              return "BELIEF_SHIFTING_SELECTED";
            } else if (originalMethod === 'blockage_shifting') {
              return "BLOCKAGE_SHIFTING_SELECTED";
            } else if (originalMethod === 'reality_shifting') {
              return "REALITY_SHIFTING_SELECTED";
            } else if (originalMethod === 'trauma_shifting') {
              return "TRAUMA_SHIFTING_SELECTED";
            } else {
              // Default to problem shifting
              return "PROBLEM_SHIFTING_SELECTED";
            }
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please continue with the process.' }
          ],
          nextStep: undefined, // Handled by routing logic
          aiTriggers: []
        },
        {
          id: 'scenario_check_3',
          scriptedResponse: (userInput, context) => {
            const originalProblem = context?.metadata?.originalProblemStatement || context?.metadata?.problemStatement || context?.problemStatement || 'this';
            return `Is there any scenario in which '${originalProblem}' would still be a problem for you?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'restate_scenario_problem_3',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'restate_scenario_problem_3',
          scriptedResponse: "How would you state the problem in a few words?",
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me how you would state this scenario problem.' }
          ],
          nextStep: 'clear_scenario_problem_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' },
            { condition: 'tooLong', action: 'simplify' }
          ]
        },
        {
          id: 'clear_scenario_problem_3',
          scriptedResponse: (userInput, context) => {
            // Store the new scenario problem for clearing
            const newProblem = context?.userResponses?.['restate_scenario_problem_3'] || 'the problem';
            context.metadata.currentDiggingProblem = newProblem;
            context.metadata.problemStatement = newProblem;
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 4) + 1;
            context.metadata.returnToDiggingStep = 'scenario_check_3'; // Return to same scenario check after clearing
            context.problemStatement = newProblem;
            
            // Return routing signal based on original method used
            const originalMethod = context.metadata.selectedMethod;
            if (originalMethod === 'problem_shifting') {
              return "PROBLEM_SHIFTING_SELECTED";
            } else if (originalMethod === 'identity_shifting') {
              return "IDENTITY_SHIFTING_SELECTED";
            } else if (originalMethod === 'belief_shifting') {
              return "BELIEF_SHIFTING_SELECTED";
            } else if (originalMethod === 'blockage_shifting') {
              return "BLOCKAGE_SHIFTING_SELECTED";
            } else if (originalMethod === 'reality_shifting') {
              return "REALITY_SHIFTING_SELECTED";
            } else if (originalMethod === 'trauma_shifting') {
              return "TRAUMA_SHIFTING_SELECTED";
            } else {
              // Default to problem shifting
              return "PROBLEM_SHIFTING_SELECTED";
            }
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please continue with the process.' }
          ],
          nextStep: undefined, // Handled by routing logic
          aiTriggers: []
        },
        
        {
          id: 'anything_else_check_1',
          scriptedResponse: (userInput, context) => {
            const originalProblem = context?.metadata?.originalProblemStatement || context?.metadata?.problemStatement || context?.problemStatement || 'the original problem';
            return `Is there anything else about '${originalProblem}' that's still a problem for you?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'restate_anything_else_problem_1',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'restate_anything_else_problem_1',
          scriptedResponse: "How would you state the problem in a few words?",
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me how you would state this problem.' }
          ],
          nextStep: 'clear_anything_else_problem_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' },
            { condition: 'tooLong', action: 'simplify' }
          ]
        },
        {
          id: 'clear_anything_else_problem_1',
          scriptedResponse: (userInput, context) => {
            // Store the new "anything else" problem for clearing
            const newProblem = context?.userResponses?.['restate_anything_else_problem_1'] || 'the problem';
            context.metadata.currentDiggingProblem = newProblem;
            context.metadata.problemStatement = newProblem;
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 5) + 1;
            context.metadata.returnToDiggingStep = 'integration_start'; // Where to return after clearing
            context.metadata.workType = 'problem'; // Set work type for method selection
            context.problemStatement = newProblem;
            
            // Return method selection signal
            return "METHOD_SELECTION_NEEDED";
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please continue with the process.' }
          ],
          nextStep: undefined, // Handled by routing logic
          aiTriggers: []
        },
        {
          id: 'anything_else_check_2',
          scriptedResponse: (userInput, context) => {
            const originalProblem = context?.metadata?.originalProblemStatement || context?.metadata?.problemStatement || context?.problemStatement || 'the original problem';
            return `Is there anything else about '${originalProblem}' that's still a problem for you?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'restate_anything_else_problem_2',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'restate_anything_else_problem_2',
          scriptedResponse: "How would you state the problem in a few words?",
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me how you would state this problem.' }
          ],
          nextStep: 'clear_anything_else_problem_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' },
            { condition: 'tooLong', action: 'simplify' }
          ]
        },
        {
          id: 'clear_anything_else_problem_2',
          scriptedResponse: (userInput, context) => {
            // Store the new "anything else" problem for clearing
            const newProblem = context?.userResponses?.['restate_anything_else_problem_2'] || 'the problem';
            context.metadata.currentDiggingProblem = newProblem;
            context.metadata.problemStatement = newProblem;
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 6) + 1;
            context.metadata.returnToDiggingStep = 'anything_else_check_3'; // Where to return after clearing
            context.metadata.workType = 'problem'; // Set work type for method selection
            context.problemStatement = newProblem;
            
            // Return method selection signal
            return "METHOD_SELECTION_NEEDED";
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please continue with the process.' }
          ],
          nextStep: undefined, // Handled by routing logic
          aiTriggers: []
        },
        {
          id: 'anything_else_check_3',
          scriptedResponse: (userInput, context) => {
            const originalProblem = context?.metadata?.originalProblemStatement || context?.metadata?.problemStatement || context?.problemStatement || 'the original problem';
            return `Is there anything else about '${originalProblem}' that's still a problem for you?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'route_to_integration',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'route_to_integration',
          scriptedResponse: "ROUTE_TO_INTEGRATION", // This should trigger special handling
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please continue.' }
          ],
          nextStep: undefined, // Handled by routing logic
          aiTriggers: []
        }
      ]
    };
  }
}
