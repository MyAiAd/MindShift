import { TreatmentPhase } from '../types';

export class MethodSelectionPhase {
  static create(): TreatmentPhase {
    return {
      name: 'Method Selection',
      maxDuration: 5,
      steps: [
        {
          id: 'choose_method',
          scriptedResponse: "METHOD_SELECTION_NEEDED",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please choose a method.' }
          ],
          nextStep: 'method_selection',
          aiTriggers: []
        },
        {
          id: 'method_selection',
          scriptedResponse: (userInput, context) => {
            const workType = context.metadata.workType;
            
            if (workType === 'problem') {
              if (!userInput || !context.metadata.methodSelectionShown) {
                context.metadata.methodSelectionShown = true;
                return "Which method would you like to use for this problem?\n\n1. Problem Shifting\n2. Identity Shifting\n3. Belief Shifting\n4. Blockage Shifting";
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
        }
      ]
    };
  }
}
