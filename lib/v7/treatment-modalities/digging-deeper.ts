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

            // The v4+ UX adds a numbered method list to the v2 prompt. This
            // is flagged as an intentional improvement in
            // tests/helpers/comparator.ts (`digging_method_list`), so we
            // keep it for user-facing display while otherwise mirroring
            // v2's control flow below.
            const promptText = `We need to clear this problem. Which method would you like to use?\n\n1. Problem Shifting\n2. Identity Shifting\n3. Belief Shifting\n4. Blockage Shifting`;

            // MATCH V2: don't overwrite currentDiggingProblem or
            // returnToDiggingStep if they were set by determineNextStep
            // (e.g. coming from restate_anything_else_problem_1/2 which
            // correctly set these values).
            const alreadySetup = context.metadata.currentDiggingProblem &&
                                 context.metadata.returnToDiggingStep &&
                                 context.metadata.returnToDiggingStep !== 'future_problem_check';

            // MATCH V2: first-visit pulls the new problem from the
            // restate_problem_future response, not from the current input.
            // This prevents the step from accidentally treating a numeric
            // method selection as a problem statement.
            const newProblemFromRestate = context.userResponses?.['restate_problem_future'];
            if (newProblemFromRestate && newProblemFromRestate.trim() && !alreadySetup) {
              const newProblem = newProblemFromRestate.trim();
              context.metadata.currentDiggingProblem = newProblem;
              context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 1) + 1;

              if (!context.metadata.returnToDiggingStep ||
                  context.metadata.returnToDiggingStep === 'future_problem_check') {
                context.metadata.returnToDiggingStep = 'future_problem_check';
              }

              context.problemStatement = newProblem;
              context.metadata.workType = 'problem';

              console.log(`🔍 DIGGING_METHOD_SELECTION: Stored new problem from restate_problem_future: "${newProblem}"`);
              console.log(`🔍 DIGGING_METHOD_SELECTION: Iteration #${context.metadata.diggingProblemNumber}`);

              return promptText;
            }

            // If we already have the problem stored and no new input, show the selection message
            if (!input || input === 'METHOD_SELECTION_NEEDED') {
              return promptText;
            }

            // MATCH V2: handle method selection first, then fall through to
            // the re-prompt. v2 has no explicit "validate then bail" block;
            // invalid input lands on the final else below.
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
              // MATCH V2: validation re-prompt with no numbered list.
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
            const newProblem = context?.userResponses?.['restate_scenario_problem_1'] || 'the problem';
            context.metadata.currentDiggingProblem = newProblem;
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 2) + 1;
            context.metadata.returnToDiggingStep = 'scenario_check_1';
            context.metadata.workType = 'problem';
            context.problemStatement = newProblem;
            
            return "We need to clear this problem. Which method would you like to use?";
          },
          expectedResponseType: 'selection',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose a method.' }
          ],
          nextStep: undefined,
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
            const newProblem = context?.userResponses?.['restate_scenario_problem_2'] || 'the problem';
            context.metadata.currentDiggingProblem = newProblem;
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 3) + 1;
            context.metadata.returnToDiggingStep = 'scenario_check_2';
            context.metadata.workType = 'problem';
            context.problemStatement = newProblem;
            
            return "We need to clear this problem. Which method would you like to use?";
          },
          expectedResponseType: 'selection',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose a method.' }
          ],
          nextStep: undefined,
          aiTriggers: []
        },
        // SCENARIO CHECK 3
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
          scriptedResponse: (userInput, context) => {
            const originalProblem = context?.metadata?.originalProblemStatement || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the original problem';
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
            const newProblem = context?.userResponses?.['restate_anything_else_problem_1'] || 'the problem';
            context.metadata.currentDiggingProblem = newProblem;
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 5) + 1;
            context.metadata.returnToDiggingStep = 'anything_else_check_1';
            context.metadata.workType = 'problem'; // Set work type for method selection
            context.problemStatement = newProblem;

            // MATCH V2: emit the doctor-authored method-selection prompt
            // directly rather than leaking the METHOD_SELECTION_NEEDED
            // routing token. v2's sibling steps _2 and _3 still return the
            // token (and match v7 on that), so we only align _1 here.
            return 'We need to clear this problem. Which method would you like to use?';
          },
          expectedResponseType: 'selection',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose a method.' }
          ],
          nextStep: 'digging_method_selection',
          aiTriggers: []
        },
        {
          id: 'anything_else_check_2',
          scriptedResponse: (userInput, context) => {
            const originalProblem = context?.metadata?.originalProblemStatement || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the original problem';
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
            const newProblem = context?.userResponses?.['restate_anything_else_problem_2'] || 'the problem';
            context.metadata.currentDiggingProblem = newProblem;
            context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 6) + 1;
            context.metadata.returnToDiggingStep = 'anything_else_check_2';
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
            const originalProblem = context?.metadata?.originalProblemStatement || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the original problem';
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
