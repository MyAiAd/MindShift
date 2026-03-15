import { TreatmentPhase } from '../types';
import { ValidationHelpers } from '../validation-helpers';

export class RealityShiftingPhase {
  static create(): TreatmentPhase {
    return {
      name: 'Reality Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'reality_goal_capture',
          scriptedResponse: () => `What do you want?`,
          expectedResponseType: 'goal',
          validationRules: [
            { type: 'minLength', value: 3, errorMessage: 'Please tell me what you want instead.' }
          ],
          nextStep: 'goal_deadline_check',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'goal_deadline_check',
          scriptedResponse: 'Is there a deadline?',
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'goal_deadline_date',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'goal_deadline_date',
          scriptedResponse: 'When do you want to achieve this goal by?',
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me when you want to achieve this goal.' }
          ],
          nextStep: 'goal_confirmation',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'goal_confirmation',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            const deadline = context?.userResponses?.['goal_deadline_date'] || '';
            const hasDeadline = context?.userResponses?.['goal_deadline_check']?.toLowerCase().includes('yes') || false;

            if (hasDeadline && deadline) {
              // Check if we already have a synthesized goal with deadline from AI detection
              const existingSynthesizedGoal = context?.metadata?.goalWithDeadline;
              if (existingSynthesizedGoal) {
                // Use the already synthesized goal to avoid duplication
                return `OK, so your goal statement including the deadline is '${existingSynthesizedGoal}', is that right?`;
              } else {
                // Fallback: construct it manually (for cases where user manually entered deadline)
                context.metadata.goalWithDeadline = `${goalStatement} by ${deadline}`;
                return `OK, so your goal statement including the deadline is '${goalStatement} by ${deadline}', is that right?`;
              }
            } else {
              return `OK, so your goal statement is '${goalStatement}', is that right?`;
            }
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please confirm yes or no.' }
          ],
          nextStep: 'goal_certainty',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'goal_certainty',
          scriptedResponse: 'How certain are you between 0% and 100% that you will achieve this goal?',
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please give me a percentage.' }
          ],
          nextStep: 'reality_shifting_intro_static',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_shifting_intro_static',
          scriptedResponse: (userInput, context) => {
            return `Close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. If ever you feel your goal has changed just let me know.`;
          },
          expectedResponseType: 'auto',
          validationRules: [],
          nextStep: 'reality_shifting_intro_dynamic',
          aiTriggers: []
        },

        {
          id: 'reality_shifting_intro_dynamic',
          scriptedResponse: (userInput, context) => {
            // Use the goal statement with deadline if available, otherwise use basic goal statement
            const goalWithDeadline = context?.metadata?.goalWithDeadline;
            const basicGoal = context?.metadata?.currentGoal || 'your goal';
            const goalStatement = goalWithDeadline || basicGoal;
            context.metadata.currentGoal = basicGoal; // Keep basic goal for other references

            return `Feel that '${goalStatement}' is coming to you... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'reality_step_a2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_step_a2',
          scriptedResponse: (userInput) => {
            // Use the LAST RESPONSE (from previous step) as per flowchart
            const lastResponse = userInput || 'that';
            return `Feel ${lastResponse}... what does ${lastResponse} feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'reality_step_a3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_step_a3',
          scriptedResponse: (userInput) => {
            // Use the LAST RESPONSE (from previous step A2) as per flowchart
            const lastResponse = userInput || 'that';
            return `Feel ${lastResponse}... what happens in yourself when you feel ${lastResponse}?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens in yourself.' }
          ],
          nextStep: 'reality_why_not_possible',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_why_not_possible',
          scriptedResponse: (userInput, context) => {
            // Use the goal statement with deadline if available, otherwise use basic goal statement
            const goalWithDeadline = context?.metadata?.goalWithDeadline;
            const basicGoal = context?.metadata?.currentGoal || 'your goal';
            const goalStatement = goalWithDeadline || basicGoal;
            return `Why might you not achieve your goal of '${goalStatement}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me why you might not achieve your goal.' }
          ],
          nextStep: undefined, // Use determineNextStep to check for "no reason"
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_feel_reason',
          scriptedResponse: (userInput, context) => {
            // Store the reason for use in subsequent steps
            context.metadata.currentReason = userInput || 'that reason';
            return `Feel '${userInput || 'that reason'}'... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'reality_feel_reason_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_feel_reason_2',
          scriptedResponse: () => `What would it feel like to not have that problem?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it would feel like.' }
          ],
          nextStep: 'reality_feel_reason_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_feel_reason_3',
          scriptedResponse: (userInput) => {
            // Use the LAST RESPONSE (from previous step B3) as per flowchart
            const lastResponse = userInput || 'that';
            return `Feel ${lastResponse}... what does ${lastResponse} feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'reality_column_a_restart', // Loop back to top of Column A only
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_column_a_restart',
          scriptedResponse: (userInput, context) => {
            // A1: Just the goal feeling question without full intro
            const goalWithDeadline = context?.metadata?.goalWithDeadline;
            const basicGoal = context?.metadata?.currentGoal || 'your goal';
            const goalStatement = goalWithDeadline || basicGoal;
            return `Feel that '${goalStatement}' is coming to you... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'reality_step_a2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_checking_questions',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            return `How certain are you now between 0% and 100% that you will achieve your goal of ${goalStatement}?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please give me a percentage.' }
          ],
          nextStep: 'reality_certainty_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'reality_doubt_reason',
          scriptedResponse: (userInput, context) => {
            // Check if we're coming from the second checking question (reality_certainty_check)
            const fromSecondCheck = context?.metadata?.fromSecondCheckingQuestion;
            console.log(`Reality doubt reason: fromSecondCheck=${fromSecondCheck}, doubtPercentage=${context?.metadata?.doubtPercentage}`);

            if (fromSecondCheck) {
              // Coming from "Are there any doubts left?" - don't reference old percentage
              context.metadata.doubtPercentage = undefined;
              console.log(`Using generic doubt message (from second check)`);
              return `What's the reason for the doubt?`;
            } else {
              // Coming from initial certainty percentage - use the calculated doubt percentage
              const doubtPercentage = context?.metadata?.doubtPercentage || '10';
              console.log(`Using percentage doubt message: ${doubtPercentage}%`);
              return `What's the reason for the ${doubtPercentage}% doubt?`;
            }
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me the reason for your doubt.' }
          ],
          nextStep: 'reality_cycle_b2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_cycle_b2',
          scriptedResponse: (userInput, context) => {
            // Use the doubt reason from the previous step
            const doubtReason = context?.userResponses?.['reality_doubt_reason'] || userInput || 'that reason';
            context.metadata.currentReason = doubtReason;
            return `Feel '${doubtReason}'... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'reality_cycle_b3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_cycle_b3',
          scriptedResponse: 'What would it feel like to not have that problem?',
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it would feel like.' }
          ],
          nextStep: 'reality_cycle_b4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_cycle_b4',
          scriptedResponse: (userInput, context) => {
            // Get the response from reality_cycle_b3
            const goodFeeling = context?.userResponses?.['reality_cycle_b3'] || userInput || 'good';
            return `Feel '${goodFeeling}'... what does '${goodFeeling}' feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'reality_checking_questions',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_certainty_check',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            return `Are there any doubts left in your mind that you will achieve your goal of ${goalStatement}?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'reality_integration_intro',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },
        {
          id: 'reality_integration_intro',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            return `OK now we have cleared all the blockages in the way of your goal, next I will ask you some questions about how your perspective has shifted and the steps you need to take to achieve your goal. So firstly, how do you feel about your goal of '${goalStatement}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me how you feel about your goal now.' }
          ],
          nextStep: 'reality_integration_helped',
          aiTriggers: []
        },
        {
          id: 'reality_integration_start',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            return `You can open your eyes now. How do you feel about '${goalStatement}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me how you feel about your goal now.' }
          ],
          nextStep: 'reality_integration_helped',
          aiTriggers: []
        },
        {
          id: 'reality_integration_helped',
          scriptedResponse: () => `How has it helped you to do this Mind Shifting method?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me how this method has helped you.' }
          ],
          nextStep: 'reality_integration_awareness',
          aiTriggers: []
        },
        {
          id: 'reality_integration_awareness',
          scriptedResponse: () => `What are you more aware of now than before you did this Mind Shifting method?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you are more aware of now.' }
          ],
          nextStep: 'reality_integration_action',
          aiTriggers: []
        },
        {
          id: 'reality_integration_action',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            return `What needs to happen for you to achieve your goal of '${goalStatement}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what needs to happen to achieve your goal.' }
          ],
          nextStep: 'reality_integration_action_more',
          aiTriggers: []
        },
        {
          id: 'reality_integration_action_more',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || 'your goal';
            return `What else needs to happen for you to achieve your goal of '${goalStatement}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please tell me what else needs to happen, or say "nothing".' }
          ],
          nextStep: 'reality_integration_awareness_1',
          aiTriggers: []
        },
        {
          id: 'reality_integration_awareness_1',
          scriptedResponse: (userInput, context) => {
            const goalStatement = context?.metadata?.currentGoal || context?.metadata?.goalStatement || 'your goal';
            return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${goalStatement}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how you feel about it now.' }
          ],
          nextStep: 'reality_integration_awareness_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_integration_awareness_2',
          scriptedResponse: () => `What are you more aware of now than before we did this process?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what you are more aware of now.' }
          ],
          nextStep: 'reality_integration_awareness_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_integration_awareness_3',
          scriptedResponse: () => `How has it helped you to do this process?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how this process has helped you.' }
          ],
          nextStep: 'reality_integration_awareness_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_integration_awareness_4',
          scriptedResponse: () => `What is your new narrative about this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your new narrative.' }
          ],
          nextStep: 'reality_integration_action_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        // Skip awareness_5 for goals (intention question not needed)
        {
          id: 'reality_integration_action_1',
          scriptedResponse: () => `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to achieve your goal?... What else needs to happen for you to achieve your goal? (Until they are clear on their plan of action)`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what needs to happen.' }
          ],
          nextStep: 'reality_integration_action_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_integration_action_2',
          scriptedResponse: () => `What is the one thing you can do that will make everything else easier or unnecessary?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'reality_integration_action_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'reality_integration_action_3',
          scriptedResponse: () => `What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action and when you will do it.' }
          ],
          nextStep: undefined, // End of Reality Shifting process
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        }
      ]
    };
  }
}
