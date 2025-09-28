import { TreatmentPhase, TreatmentStep } from '../types';
import { TextProcessingUtils } from '../text-processing-utils';

export class IntroductionPhase {
  static create(): TreatmentPhase {
    return {
      name: 'Introduction',
      maxDuration: 5,
      steps: [
        {
          id: 'mind_shifting_explanation',
          scriptedResponse: (userInput, context) => {
            // Safety check for context
            if (!context) {
              throw new Error('Context is undefined in mind_shifting_explanation');
            }
            if (!context.metadata) {
              context.metadata = {};
            }
            
            // If no user input, show the initial explanation and options
            if (!userInput) {
              return "Mind Shifting is not like counselling, therapy or life coaching. The Mind Shifting methods are verbal guided processes that we apply to problems, goals, or negative experiences in order to clear them. The way Mind Shifting works is we won't just be talking about what you want to work on, we will be applying Mind Shifting methods in order to clear them, and to do that we will need to define what you want to work on into a clear statement by you telling me what it is in a few words. So I'll be asking you to do that when needed.\n\nWhen you are ready to begin, would you like to work on:\n\n1. PROBLEM\n2. GOAL\n3. NEGATIVE EXPERIENCE";
            }
            
            const input = userInput.toLowerCase();
            
            // Handle initial work type selection FIRST (reset state for fresh selection)
            console.log(`🔍 WORK_TYPE_CHECK: input="${input}", contains '1': ${input.includes('1')}, contains 'problem': ${input.includes('problem')}, contains 'shifting': ${input.includes('shifting')}`);
            if (input.includes('1') || (input.includes('problem') && !input.includes('shifting'))) {
              // Reset all work type metadata for fresh selection
              context.metadata.workType = 'problem';
              context.metadata.selectedMethod = undefined;
              console.log(`🎯 WORK_TYPE_SELECTION: Set workType to 'problem', returning PROBLEM_SELECTION_CONFIRMED`);
              return "PROBLEM_SELECTION_CONFIRMED";
            } else if (input.includes('2') || (input.includes('goal') && !input.includes('shifting'))) {
              context.metadata.workType = 'goal';
              context.metadata.selectedMethod = undefined;
              console.log(`🎯 WORK_TYPE_SELECTION: Set workType to 'goal'`);
              return "GOAL_SELECTION_CONFIRMED";
            } else if (input.includes('3') || (input.includes('negative') && !input.includes('shifting')) || (input.includes('experience') && !input.includes('shifting'))) {
              context.metadata.workType = 'negative_experience';
              context.metadata.selectedMethod = undefined;
              console.log(`🎯 WORK_TYPE_SELECTION: Set workType to 'negative_experience'`);
              return "NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED";
            }
            
            // Check if we're already in problem method selection mode
            if (context.metadata.workType === 'problem' && !context.metadata.selectedMethod) {
              // Handle method selection for problems
              const lowerInput = input.toLowerCase();
              if (lowerInput.includes('problem shifting')) {
                context.metadata.selectedMethod = 'problem_shifting';
                context.metadata.workType = 'problem';
                return "Great! We'll use Problem Shifting.";
              } else if (lowerInput.includes('identity shifting')) {
                context.metadata.selectedMethod = 'identity_shifting';
                context.metadata.workType = 'problem';
                return "Great! We'll use Identity Shifting.";
              } else if (lowerInput.includes('belief shifting')) {
                context.metadata.selectedMethod = 'belief_shifting';
                context.metadata.workType = 'problem';
                return "Great! We'll use Belief Shifting.";
              } else if (lowerInput.includes('blockage shifting')) {
                context.metadata.selectedMethod = 'blockage_shifting';
                context.metadata.workType = 'problem';
                return "Great! We'll use Blockage Shifting.";
              } else {
                return "METHOD_SELECTION_NEEDED";
              }
            }
            
            // Handle problem description after method selection
            if (context.metadata.workType === 'problem' && context.metadata.selectedMethod) {
              context.metadata.problemStatement = userInput;
              context.problemStatement = userInput;
              if (!context.metadata.originalProblemStatement) {
                context.metadata.originalProblemStatement = userInput;
              }
              
              // Set routing flag for determineNextStep to handle
              context.metadata.readyForTreatment = true;
              
              // Return user-friendly confirmation message
              const methodName = context.metadata.selectedMethod.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
              return `Great! We'll work on "${userInput}" using ${methodName}. Let's begin the treatment.`;
            }
            
            // Handle goal description after work type selection for goals
            if (context.metadata.workType === 'goal' && !context.metadata.selectedMethod) {
              context.metadata.goalStatement = userInput;
              context.problemStatement = userInput;
              if (!context.metadata.originalProblemStatement) {
                context.metadata.originalProblemStatement = userInput;
              }  
              context.metadata.selectedMethod = 'reality_shifting';
              return "ROUTE_TO_REALITY_SHIFTING";
            }
            
            // If we get here, it's not a valid work type selection
            return "Please choose 1 for Problem, 2 for Goal, or 3 for Negative Experience.";
          },
          expectedResponseType: 'selection',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose 1, 2, or 3.' }
          ],
          nextStep: 'method_selection',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'method_selection',
          scriptedResponse: (userInput, context) => {
            const workType = context.metadata.workType;
            
            if (workType === 'problem') {
              if (!userInput || !context.metadata.methodSelectionShown) {
                context.metadata.methodSelectionShown = true;
                return "METHOD_SELECTION_NEEDED";
              }
              
              const input = userInput.toLowerCase();
              
              if (input.includes('1') || input.includes('problem shifting')) {
                context.metadata.selectedMethod = 'problem_shifting';
                context.metadata.workType = 'problem';
                context.currentPhase = 'work_type_selection';
                return "Great! We'll use Problem Shifting.";
              } else if (input.includes('2') || input.includes('identity shifting')) {
                context.metadata.selectedMethod = 'identity_shifting';
                context.metadata.workType = 'problem';
                context.currentPhase = 'work_type_selection';
                return "Great! We'll use Identity Shifting.";
              } else if (input.includes('3') || input.includes('belief shifting')) {
                context.metadata.selectedMethod = 'belief_shifting';
                context.metadata.workType = 'problem';
                context.currentPhase = 'work_type_selection';
                return "Great! We'll use Belief Shifting.";
              } else if (input.includes('4') || input.includes('blockage shifting')) {
                context.metadata.selectedMethod = 'blockage_shifting';
                context.metadata.workType = 'problem';
                context.currentPhase = 'work_type_selection';
                return "Great! We'll use Blockage Shifting.";
              } else {
                return "Please choose 1 for Problem Shifting, 2 for Identity Shifting, 3 for Belief Shifting, or 4 for Blockage Shifting.";
              }
            }
            
            return "Please select a work type first.";
          },
          expectedResponseType: 'selection',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose a method.' }
          ],
          nextStep: 'work_type_description',
          aiTriggers: []
        },
        {
          id: 'goal_description',
          scriptedResponse: (userInput, context) => {
            return "Please tell me what your goal is in a few words, including any deadline, if there is one.";
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you want to achieve.' }
          ],
          nextStep: undefined,
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'negative_experience_description',
          scriptedResponse: (userInput, context) => {
            return "Tell me what the negative experience was in a few words";
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please describe the negative experience.' }
          ],
          nextStep: undefined,
          aiTriggers: []
        }
      ]
    };
  }
}
