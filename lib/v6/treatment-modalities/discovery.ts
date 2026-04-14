import { TreatmentPhase } from '../types';
import { TextProcessingUtils } from '../text-processing-utils';

export class DiscoveryPhase {
  static create(): TreatmentPhase {
    return {
      name: 'Discovery',
      maxDuration: 10,
      steps: [
        {
          id: 'multiple_problems_selection',
          scriptedResponse: (userInput, context) => {
            const problemCount = TextProcessingUtils.countProblems(userInput || '');
            const problems = TextProcessingUtils.extractProblems(userInput || '');
            
            // Fix grammar: "1 problem" vs "problems"
            const problemWord = problemCount === 1 ? 'problem' : 'problems';
            let response = `OK so you told me ${problemCount} ${problemWord} there, which one do you want to work on first?\n`;
            
            problems.forEach((problem, index) => {
              if (problem.trim()) { // Only show non-empty problems
                response += `${index + 1}. ${problem}\n`;
              }
            });
            return response;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please select which problem you want to work on first.' }
          ],
          nextStep: 'restate_selected_problem',
          aiTriggers: []
        },
        {
          id: 'restate_selected_problem',
          scriptedResponse: "OK so it is important we use your own words for the problem statement so please tell me what the problem is in a few words",
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me what the problem is in a few words.' }
          ],
          nextStep: 'analyze_response',
          aiTriggers: []
        },
        {
          id: 'analyze_response',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement from the previous step
            const problemStatement = context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || '';
            const words = problemStatement?.split(' ').length || 0;
            if (words <= 20 && problemStatement) {
              return `OK what I heard you say is '${problemStatement}' - is that right?`;
            } else if (problemStatement) {
              return "OK I understand what you have said, but please tell me what the problem is in just a few words";
            } else {
              return "Please tell me what you would like to work on in a few words.";
            }
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please confirm if this is correct.' }
          ],
          nextStep: 'choose_method',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'restate_identity_problem',
          scriptedResponse: () => {
            return `How would you state the problem now in a few words?`;
          },
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please describe the problem in a few words.' }
          ],
          nextStep: 'confirm_identity_problem',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'confirm_identity_problem',
          scriptedResponse: (userInput, context) => {
            // Store the new problem statement
            const newProblem = userInput || 'the problem';
            context.problemStatement = newProblem;
            return `So the problem is now '${newProblem}'. Is this correct?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please confirm if this is correct.' }
          ],
          nextStep: 'identity_shifting_intro',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'restate_belief_problem',
          scriptedResponse: () => {
            return `How would you state the problem now in a few words?`;
          },
          expectedResponseType: 'problem',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please describe the problem in a few words.' }
          ],
          nextStep: 'confirm_belief_problem',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'confirm_belief_problem',
          scriptedResponse: (userInput, context) => {
            // Store the new problem statement
            const newProblem = userInput || 'the problem';
            context.problemStatement = newProblem;
            return `So the problem is now '${newProblem}'. Is this correct?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please confirm if this is correct.' }
          ],
          nextStep: 'belief_shifting_intro',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        }
      ]
    };
  }
}
