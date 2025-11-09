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
            // Safety check for context
            if (!context) {
              throw new Error('Context is undefined in work_type_description');
            }
            if (!context.metadata) {
              context.metadata = {};
            }
            
            const workType = context.metadata.workType || 'item';
            const selectedMethod = context.metadata.selectedMethod;

            console.log(`
╔════════════════════════════════════════════════════════════════
║ 📋 WORK_TYPE_DESCRIPTION - Step scriptedResponse() Called
╠════════════════════════════════════════════════════════════════
║ userInput: "${userInput}"
║ workType: "${workType}"
║ selectedMethod: "${selectedMethod}"
╚════════════════════════════════════════════════════════════════`);

            // Check if user input is actually a method name (not a problem description)
            const isMethodName = userInput && (
              userInput.toLowerCase().includes('problem shifting') ||
              userInput.toLowerCase().includes('identity shifting') ||
              userInput.toLowerCase().includes('belief shifting') ||
              userInput.toLowerCase().includes('blockage shifting') ||
              userInput.toLowerCase().includes('reality shifting') ||
              userInput.toLowerCase().includes('trauma shifting')
            );
            
            // If no user input OR if user input is a method name, ask for description
            if (!userInput || isMethodName) {
              const response = workType === 'problem' ? "Tell me what the problem is in a few words." :
                               workType === 'goal' ? "Tell me what the goal is in a few words." :
                               workType === 'negative_experience' ? "Tell me what the negative experience was in a few words." :
                               "Tell me what you want to work on in a few words.";
              console.log(`║ ➡️  RETURNING (asking for description): "${response}"\n╚════════════════════════════════════════════════════════════════\n`);
              return response;
            } else {
              // User provided description, store it and proceed directly to treatment
              const statement = userInput || '';
              context.metadata.problemStatement = statement;
              context.problemStatement = statement;
              
              let response = '';
              // Skip confirmation and route directly to treatment intro step
              if (workType === 'problem') {
                if (selectedMethod === 'identity_shifting') {
                  context.currentPhase = 'identity_shifting';
                  response = `Great! Let's begin Identity Shifting.`;
                } else if (selectedMethod === 'problem_shifting') {
                  context.currentPhase = 'problem_shifting';
                  response = `Great! Let's begin Problem Shifting.`;
                } else if (selectedMethod === 'belief_shifting') {
                  context.currentPhase = 'belief_shifting';
                  response = `Great! Let's begin Belief Shifting.`;
                } else if (selectedMethod === 'blockage_shifting') {
                  context.currentPhase = 'blockage_shifting';
                  response = `Great! Let's begin Blockage Shifting.`;
                } else {
                  response = `Great! Let's begin the treatment.`;
                }
              } else if (workType === 'goal') {
                context.currentPhase = 'reality_shifting';
                context.metadata.selectedMethod = 'reality_shifting';
                response = `Great! Let's begin Reality Shifting.`;
              } else if (workType === 'negative_experience') {
                context.currentPhase = 'trauma_shifting';
                context.metadata.selectedMethod = 'trauma_shifting';
                response = `Great! Let's begin Trauma Shifting.`;
              } else {
                response = `So you want to work on '${statement}'. Is that correct?`;
              }
              
              console.log(`║ ✅ STORED: problemStatement = "${statement}"
║ ➡️  RETURNING (confirmation): "${response}"
╚════════════════════════════════════════════════════════════════\n`);
              return response;
            }
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
              // User said no, go back to description step
              context.currentStep = 'work_type_description';
              if (workType === 'problem') {
                return "Tell me what the problem is in a few words.";
              } else if (workType === 'goal') {
                return "Tell me what the goal is in a few words.";
              } else if (workType === 'negative_experience') {
                return "Tell me what the negative experience was in a few words.";
              } else {
                return "Tell me what you want to work on in a few words.";
              }
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
            } else if (workType === 'goal') {
              // Goals automatically use Reality Shifting
              context.metadata.selectedMethod = 'reality_shifting';
              return "What do you want?";
            } else if (workType === 'negative_experience') {
              // Negative experiences automatically use Trauma Shifting
              context.metadata.selectedMethod = 'trauma_shifting';
              const negativeExperience = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the negative experience';
              return `Please close your eyes and keep them closed throughout the rest of the process.\n\nThink about and feel the negative experience of '${negativeExperience}'. Let your mind go to the worst part of the experience... now freeze it there. Keep feeling this frozen moment... what kind of person are you being in this moment?`;
            }
            
            // Should not reach here - method should be selected first
            return "Please select a method first.";
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
