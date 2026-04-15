import { TreatmentPhase } from '../types';
import { TextProcessingUtils } from '../text-processing-utils';

export class BeliefShiftingPhase {
  static create(): TreatmentPhase {
    return {
      name: 'Belief Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'belief_shifting_intro',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement - prioritize digging deeper restated problem
            console.log('🔍 BELIEF_DEBUG belief_shifting_intro - context.metadata:', JSON.stringify(context.metadata, null, 2));
            const diggingProblem = context?.metadata?.currentDiggingProblem;
            console.log('🔍 BELIEF_DEBUG belief_shifting_intro - diggingProblem:', diggingProblem);
            console.log('🔍 BELIEF_DEBUG belief_shifting_intro - context.problemStatement:', context?.problemStatement);
            // Extended fallbacks to handle complex digging deeper scenarios
            const problemStatement = diggingProblem 
              || context?.userResponses?.['restate_scenario_problem_1'] 
              || context?.userResponses?.['restate_scenario_problem_2']
              || context?.userResponses?.['restate_scenario_problem_3']
              || context?.userResponses?.['restate_anything_else_problem_1']
              || context?.userResponses?.['restate_anything_else_problem_2']
              || context?.problemStatement 
              || context?.userResponses?.['restate_selected_problem'] 
              || context?.userResponses?.['mind_shifting_explanation'] 
              || 'the problem';
            console.log('🔍 BELIEF_DEBUG belief_shifting_intro - final problemStatement:', problemStatement);
            
            // Check if we're coming from digging deeper (shorter instructions)
            const isFromDigging = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem || context?.metadata?.skipIntroInstructions;
            
            if (isFromDigging) {
              // Short version for digging deeper - user has already seen full instructions
              console.log(`🔍 BELIEF_SHIFTING_INTRO: Skipping lengthy instructions - isFromDigging: ${!!isFromDigging}`);
              return `Feel the problem '${problemStatement}'... what do you believe about yourself that's causing you to experience this problem?`;
            } else {
              // Full version for first-time users
              return `Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. When I ask 'what needs to happen for the problem to not be a problem?' allow your answers to be different each time.

Feel the problem '${problemStatement}'... what do you believe about yourself that's causing you to experience this problem '${problemStatement}'?`;
            }
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you believe about yourself.' }
          ],
          nextStep: 'belief_step_a',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_a',
          scriptedResponse: (userInput, context) => {
            console.log('🔍 BELIEF_DEBUG belief_step_a - userInput:', userInput);
            console.log('🔍 BELIEF_DEBUG belief_step_a - context.metadata before:', JSON.stringify(context.metadata, null, 2));
            
            const isCyclingBack = context.metadata.cycleCount > 0;
            
            let belief;
            if (isCyclingBack) {
              const rawBelief = context.userResponses?.['belief_shifting_intro'] || context.metadata.currentBelief || 'that belief';
              belief = rawBelief.replace(/^i\s+believe\s+(that\s+)?/i, '').trim();
              console.log('🔍 BELIEF_DEBUG belief_step_a - CYCLING BACK, using original belief:', belief);
            } else {
              const rawBelief = context.userResponses?.['belief_shifting_intro'] || context.metadata.currentBelief || 'that belief';
              belief = rawBelief.replace(/^i\s+believe\s+(that\s+)?/i, '').trim();
              context.metadata.currentBelief = belief;
              console.log('🔍 BELIEF_DEBUG belief_step_a - FIRST TIME, setting belief:', belief);
            }
            
            console.log('🔍 BELIEF_DEBUG belief_step_a - context.metadata after:', JSON.stringify(context.metadata, null, 2));
            
            const returnTo = context.metadata.returnToBeliefCheck;
            let prefix = 'Feel yourself believing';
            
            if (returnTo === 'belief_check_2') {
              if (!context.metadata.usedBridgePhraseFor_belief_check_2) {
                prefix = 'Put yourself in the future and feel yourself believing';
                context.metadata.usedBridgePhraseFor_belief_check_2 = true;
              }
            } else if (returnTo === 'belief_check_3') {
              if (!context.metadata.usedBridgePhraseFor_belief_check_3) {
                prefix = 'Imagine that scenario and feel yourself believing';
                context.metadata.usedBridgePhraseFor_belief_check_3 = true;
              }
            }
            
            return `${prefix} '${belief}'... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like to believe that.' }
          ],
          nextStep: 'belief_step_b',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_b',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'belief_step_c',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_c',
          scriptedResponse: () => `What would you rather feel?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you would rather feel.' }
          ],
          nextStep: 'belief_step_d',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_d',
          scriptedResponse: (userInput, context) => {
            // Store the desired feeling for reference
            context.metadata.desiredFeeling = userInput || context.metadata.desiredFeeling || 'that feeling';
            const desiredFeeling = context.metadata.desiredFeeling;
            return `What would '${desiredFeeling}' feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that would feel like.' }
          ],
          nextStep: 'belief_step_e',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_e',
          scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'belief_step_f',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_step_f',
          scriptedResponse: (userInput, context) => {
            console.log('🔍 BELIEF_DEBUG belief_step_f - context.metadata:', JSON.stringify(context.metadata, null, 2));
            const rawBelief = context.userResponses?.['belief_shifting_intro'] || context.metadata.currentBelief || 'that belief';
            const belief = rawBelief.replace(/^i\s+believe\s+(that\s+)?/i, '').trim();
            console.log('🔍 BELIEF_DEBUG belief_step_f - retrieved belief:', belief);
            console.log('🔍 BELIEF_DEBUG belief_step_f - originalBelief from belief_shifting_intro:', context.userResponses?.['belief_shifting_intro']);
            console.log('🔍 BELIEF_DEBUG belief_step_f - currentBelief from metadata:', context.metadata.currentBelief);
            return `Do you still believe '${belief}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_check_1',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_check_1',
          scriptedResponse: (userInput, context) => {
            const rawBelief = context.userResponses?.['belief_shifting_intro'] || context.metadata.currentBelief || 'that belief';
            const belief = rawBelief.replace(/^i\s+believe\s+(that\s+)?/i, '').trim();
            return `Does any part of you still believe '${belief}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_check_2',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_check_2',
          scriptedResponse: (userInput, context) => {
            const rawBelief = context.userResponses?.['belief_shifting_intro'] || context.metadata.currentBelief || 'that belief';
            const belief = rawBelief.replace(/^i\s+believe\s+(that\s+)?/i, '').trim();
            return `Do you feel you may believe '${belief}' again in the future?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_check_3',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_check_3',
          scriptedResponse: (userInput, context) => {
            const rawBelief = context.userResponses?.['belief_shifting_intro'] || context.metadata.currentBelief || 'that belief';
            const belief = rawBelief.replace(/^i\s+believe\s+(that\s+)?/i, '').trim();
            return `Is there any scenario in which you would still believe '${belief}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_check_4',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_future_projection',
          scriptedResponse: (userInput, context) => {
            const belief = context.userResponses?.['belief_shifting_intro'] || context.metadata.currentBelief || 'that belief';
            console.log(`🔍 BELIEF_FUTURE_PROJECTION: Asking to feel belief '${belief}' in the future`);
            return `Put yourself in the future and feel yourself believing '${belief}'... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like to believe that.' }
          ],
          nextStep: 'belief_future_step_b',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_future_step_b',
          scriptedResponse: (userInput, context) => {
            context.metadata.beliefFutureStepAResponse = userInput || 'that feeling';
            const stepAResponse = context.metadata.beliefFutureStepAResponse;
            console.log(`🔍 BELIEF_FUTURE_STEP_B: Asking what '${stepAResponse}' feels like`);
            return `Feel '${stepAResponse}'... what does '${stepAResponse}' feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'belief_future_step_c',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_future_step_c',
          scriptedResponse: (userInput, context) => {
            context.metadata.beliefFutureStepBResponse = userInput || 'that';
            console.log(`🔍 BELIEF_FUTURE_STEP_C: Asking what they would rather feel`);
            return `What would you rather feel?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you would rather feel.' }
          ],
          nextStep: 'belief_future_step_d',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_future_step_d',
          scriptedResponse: (userInput, context) => {
            context.metadata.beliefFutureDesiredFeeling = userInput || 'that feeling';
            const desiredFeeling = context.metadata.beliefFutureDesiredFeeling;
            console.log(`🔍 BELIEF_FUTURE_STEP_D: Asking what '${desiredFeeling}' would feel like`);
            return `What would '${desiredFeeling}' feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that would feel like.' }
          ],
          nextStep: 'belief_future_step_e',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_future_step_e',
          scriptedResponse: (userInput, context) => {
            context.metadata.beliefFutureStepDResponse = userInput || 'that feeling';
            const stepDResponse = context.metadata.beliefFutureStepDResponse;
            console.log(`🔍 BELIEF_FUTURE_STEP_E: Asking what '${stepDResponse}' feels like`);
            return `Feel '${stepDResponse}'... what does '${stepDResponse}' feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what that feels like.' }
          ],
          nextStep: 'belief_future_step_f',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_future_step_f',
          scriptedResponse: (userInput, context) => {
            context.metadata.beliefFutureStepEResponse = userInput || 'that';
            const belief = context.userResponses?.['belief_shifting_intro'] || context.metadata.currentBelief || 'that belief';
            console.log(`🔍 BELIEF_FUTURE_STEP_F: Checking if they still believe '${belief}'`);
            return `Do you still believe '${belief}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_check_3',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_check_4',
          scriptedResponse: (userInput, context) => {
            console.log('🔍 BELIEF_DEBUG belief_check_4 - context.metadata:', JSON.stringify(context.metadata, null, 2));
            const rawBelief = context.userResponses?.['belief_shifting_intro'] || context.metadata.currentBelief || 'that belief';
            const belief = rawBelief.replace(/^i\s+believe\s+(that\s+)?/i, '').trim();
            console.log('🔍 BELIEF_DEBUG belief_check_4 - retrieved belief:', belief);
            
            let positiveBeliefStatement = TextProcessingUtils.createPositiveBeliefStatement(belief);
            if (/^i am not /i.test(belief)) {
              positiveBeliefStatement = `that you are ${belief.replace(/^i am not /i, '').trim()}`;
            }
            console.log('🔍 BELIEF_DEBUG belief_check_4 - positive statement:', positiveBeliefStatement);
            
            return `Do you now know ${positiveBeliefStatement}?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_problem_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'belief_problem_check',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement - prioritize digging deeper restated problem
            const diggingProblem = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem;
            const problemStatement = diggingProblem || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
            console.log(`🔍 BELIEF_PROBLEM_CHECK: Using problem statement: "${problemStatement}" (digging: "${diggingProblem}", original: "${context?.problemStatement}")`);
            return `Feel '${problemStatement}'... does it still feel like a problem?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'belief_integration_awareness_1',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        // Integration Questions - Awareness Section
        {
          id: 'belief_integration_awareness_1',
          scriptedResponse: (userInput, context) => {
            const subject = TextProcessingUtils.getIntegrationSubject(context, 'problem');
            return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${subject}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how you feel about it now.' }
          ],
          nextStep: 'belief_integration_awareness_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_awareness_2',
          scriptedResponse: () => `What are you more aware of now than before we did this process?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what you are more aware of now.' }
          ],
          nextStep: 'belief_integration_awareness_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_awareness_3',
          scriptedResponse: () => `How has it helped you to do this process?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how this process has helped you.' }
          ],
          nextStep: 'belief_integration_awareness_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_awareness_4',
          scriptedResponse: () => `What is your new narrative about this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your new narrative.' }
          ],
          nextStep: 'belief_integration_awareness_5',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_awareness_5',
          scriptedResponse: () => `What's your intention now in relation to this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your intention now.' }
          ],
          nextStep: 'belief_integration_action_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        // Integration Questions - Action Section
        {
          id: 'belief_integration_action_1',
          scriptedResponse: () => `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?... What else needs to happen for you to realise your intention? (Until they are clear on their plan of action)`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what needs to happen.' }
          ],
          nextStep: 'belief_integration_action_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_action_2',
          scriptedResponse: () => `What is the one thing you can do that will make everything else easier or unnecessary?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'belief_integration_action_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'belief_integration_action_3',
          scriptedResponse: () => `What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action and when you will do it.' }
          ],
          nextStep: undefined, // End of Belief Shifting process
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        }
      ]
    };
  }
}
