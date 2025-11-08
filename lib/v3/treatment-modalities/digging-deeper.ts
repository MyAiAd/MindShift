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
              console.log(`🔍 RESTATE_PROBLEM_FUTURE: Next step should be digging_method_selection`);
            }
            console.log('🔍 BELIEF_DEBUG restate_problem_future - context.metadata after:', JSON.stringify(context.metadata, null, 2));
            return "How would you state the problem in a few words?";
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
            
            // If this is the first time showing this step (coming from restate_problem_future), 
            // store the problem and show the selection message
            if (!context.metadata.currentDiggingProblem && input && input !== 'METHOD_SELECTION_NEEDED') {
              // Use the new problem statement that was stored in restate_problem_future step
              const newProblem = context.metadata.newDiggingProblem || input;
              context.metadata.currentDiggingProblem = newProblem;
              context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 1) + 1;
              context.metadata.returnToDiggingStep = 'scenario_check_1'; // Where to return after clearing
              context.problemStatement = newProblem;
              
              // CRITICAL: Set work type to 'problem' to ensure proper method selection
              context.metadata.workType = 'problem';
              console.log(`🔍 DIGGING_METHOD_SELECTION: Stored new problem: "${newProblem}"`);
              console.log(`🔍 DIGGING_METHOD_SELECTION: Using newDiggingProblem: "${context.metadata.newDiggingProblem}"`);
              console.log(`🔍 DIGGING_METHOD_SELECTION: Set workType to 'problem' for method selection`);
              console.log('🔍 BELIEF_DEBUG digging_method_selection - context.metadata after storing:', JSON.stringify(context.metadata, null, 2));
              console.log('🔍 BELIEF_DEBUG digging_method_selection - context.problemStatement after storing:', context.problemStatement);
              
              return `We need to clear this problem. Which method would you like to use?\n\n1. Problem Shifting\n2. Identity Shifting\n3. Belief Shifting\n4. Blockage Shifting`;
            }
            
            // If we already have the problem stored and no new input, show the selection message
            if (!input || input === 'METHOD_SELECTION_NEEDED') {
              return `We need to clear this problem. Which method would you like to use?\n\n1. Problem Shifting\n2. Identity Shifting\n3. Belief Shifting\n4. Blockage Shifting`;
            }
            
            // Validate input before proceeding
            const validInputs = ['1', '2', '3', '4', 'problem shifting', 'identity shifting', 'belief shifting', 'blockage shifting'];
            if (!validInputs.some(valid => input.toLowerCase().includes(valid.toLowerCase()))) {
              return "Please choose a valid option (1-4) or method name.";
            }
            
            // Handle method selection - return routing signals instead of direct phase manipulation
            if (input.toLowerCase().includes('problem shifting') || input === '1') {
              context.metadata.selectedMethod = 'problem_shifting';
              context.metadata.skipIntroInstructions = true; // Skip lengthy instructions for digging deeper
              console.log(`🔍 DIGGING_METHOD_SELECTION: Selected Problem Shifting for digging deeper`);
              return "PROBLEM_SHIFTING_SELECTED";
            } else if (input.toLowerCase().includes('identity shifting') || input === '2') {
              context.metadata.selectedMethod = 'identity_shifting';
              context.metadata.skipIntroInstructions = true; // Skip lengthy instructions for digging deeper
              console.log(`🔍 DIGGING_METHOD_SELECTION: Selected Identity Shifting for digging deeper`);
              return "IDENTITY_SHIFTING_SELECTED";
            } else if (input.toLowerCase().includes('belief shifting') || input === '3') {
              context.metadata.selectedMethod = 'belief_shifting';
              context.metadata.skipIntroInstructions = true; // Skip lengthy instructions for digging deeper
              console.log(`🔍 DIGGING_METHOD_SELECTION: Selected Belief Shifting for digging deeper`);
              return "BELIEF_SHIFTING_SELECTED";
            } else if (input.toLowerCase().includes('blockage shifting') || input === '4') {
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
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 2) + 1;
            context.metadata.returnToDiggingStep = 'anything_else_check_1'; // Where to return after clearing
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
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 3) + 1;
            context.metadata.returnToDiggingStep = 'scenario_check_3'; // Where to return after clearing
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
          scriptedResponse: "Is there any scenario in which this would still be a problem for you?",
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
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 4) + 1;
            context.metadata.returnToDiggingStep = 'anything_else_check_1'; // Move to "anything else" questions after this
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
        
        // SCENARIO CHECK 3 - Third scenario check (missing in original V3)
        {
          id: 'scenario_check_3',
          scriptedResponse: (userInput, context) => {
            const originalProblem = context?.metadata?.originalProblemStatement || context?.metadata?.problemStatement || context?.problemStatement || 'the original problem';
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
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 4) + 1;
            context.metadata.returnToDiggingStep = 'scenario_check_3'; // Return to this scenario check after clearing
            context.metadata.workType = 'problem'; // Set work type for method selection
            
            // Set the problem statement for the method selection
            context.problemStatement = newProblem;
            
            // Ask user to choose method instead of dictating
            return "We need to clear this problem. Which method would you like to use?";
          },
          expectedResponseType: 'selection',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose a method.' }
          ],
          nextStep: 'digging_method_selection',
          aiTriggers: []
        },
        
        {
          id: 'anything_else_check_1',
          scriptedResponse: "Is there anything else about this that's still a problem for you?",
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
          scriptedResponse: "Is there anything else about this that's still a problem for you?",
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
          scriptedResponse: "Is there anything else about this that's still a problem for you?",
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
