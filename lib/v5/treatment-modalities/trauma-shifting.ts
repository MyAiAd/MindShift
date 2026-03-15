import { TreatmentPhase } from '../types';
import { TextProcessingUtils } from '../text-processing-utils';

export class TraumaShiftingPhase {
  static create(): TreatmentPhase {
    return {
      name: 'Trauma Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'trauma_shifting_intro',
          scriptedResponse: (userInput, context) => {
            // Get the negative experience statement
            const negativeExperience = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the negative experience';
            return `Will you be comfortable recalling the worst part of this experience and freezing it briefly in your mind?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_identity_step_static',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_problem_redirect',
          scriptedResponse: (userInput, context) => {
            return `How do you feel now about the fact that this happened?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me how you feel about the fact that this happened.' }
          ],
          nextStep: 'choose_method',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_identity_step_static',
          scriptedResponse: (userInput, context) => {
            return `Please close your eyes and keep them closed throughout the rest of the process.`;
          },
          expectedResponseType: 'auto',
          validationRules: [],
          nextStep: 'trauma_identity_step_dynamic',
          aiTriggers: []
        },

        {
          id: 'trauma_identity_step_dynamic',
          scriptedResponse: (userInput, context) => {
            // Get the negative experience statement
            const negativeExperience = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the negative experience';
            return `Think about and feel the negative experience of '${negativeExperience}'. Let your mind go to the worst part of the experience...now freeze it there. Keep feeling this frozen moment...what kind of person are you being in this moment?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what kind of person you are being in this moment.' }
          ],
          nextStep: 'trauma_dissolve_step_a',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dissolve_step_a',
          scriptedResponse: (userInput, context) => {
            // Get the identity from the trauma_identity_step_dynamic response
            const traumaIdentityResponse = context.userResponses?.['trauma_identity_step_dynamic'];

            // Store the identity from the identity step if we don't have it yet
            if (!context.metadata.currentTraumaIdentity && traumaIdentityResponse) {
              // Process the trauma identity response to add "person" suffix like Identity Shifting does
              const processedTraumaIdentity = TextProcessingUtils.processIdentityResponse(traumaIdentityResponse.trim());
              context.metadata.currentTraumaIdentity = processedTraumaIdentity;
              context.metadata.originalTraumaIdentity = processedTraumaIdentity; // Store processed version for trauma_identity_check
              console.log(`🔍 TRAUMA_DISSOLVE_STEP_A: Processing trauma identity "${traumaIdentityResponse}" -> "${processedTraumaIdentity}"`);
            }

            // Use the stored identity, don't overwrite with current userInput
            const identity = context.metadata.currentTraumaIdentity || 'that identity';
            return `Feel yourself being ${identity}... what does it feel like?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'trauma_dissolve_step_b',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dissolve_step_b',
          scriptedResponse: (userInput, context) => {
            // Get the feeling from trauma_dissolve_step_a response
            const lastResponse = context.userResponses?.['trauma_dissolve_step_a'] || 'that feeling';
            return `Feel '${lastResponse}'... what happens in yourself when you feel '${lastResponse}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens in yourself when you feel that.' }
          ],
          nextStep: 'trauma_dissolve_step_c',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dissolve_step_c',
          scriptedResponse: (userInput, context) => {
            const identity = context.metadata.currentTraumaIdentity || 'that identity';
            return `What are you when you're not being '${identity}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you are when you are not being that.' }
          ],
          nextStep: 'trauma_dissolve_step_d',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dissolve_step_d',
          scriptedResponse: (userInput, context) => {
            const lastResponse = context.userResponses?.['trauma_dissolve_step_c'] || 'that';
            return `Feel yourself being '${lastResponse}'... what does it feel like?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'trauma_dissolve_step_e',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dissolve_step_e',
          scriptedResponse: (userInput, context) => {
            // FIXED: Use metadata to get the CURRENT step D response, not the cached one from userResponses
            // This prevents using old responses from previous iterations
            const lastResponse = context.metadata.currentStepDResponse || context.userResponses?.['trauma_dissolve_step_d'] || 'that feeling';
            return `Feel '${lastResponse}'... what happens in yourself when you feel '${lastResponse}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens in yourself when you feel that.' }
          ],
          nextStep: 'trauma_identity_check',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_identity_check',
          scriptedResponse: (userInput, context) => {
            const identity = context.metadata.originalTraumaIdentity || context.metadata.currentTraumaIdentity || 'that identity';
            return `Can you still feel yourself being ${identity}?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_future_identity_check',
          aiTriggers: [] // Purely scripted, no AI assistance
        },

        {
          id: 'trauma_future_identity_check',
          scriptedResponse: (userInput, context) => {
            const identity = context.metadata.originalTraumaIdentity || context.metadata.currentTraumaIdentity || 'that identity';
            return `Do you think you can ever feel yourself being ${identity} in the future?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_future_scenario_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_future_scenario_check',
          scriptedResponse: (userInput, context) => {
            const identity = context.metadata.originalTraumaIdentity || context.metadata.currentTraumaIdentity || 'that identity';
            return `Is there any scenario in which you might still feel yourself being ${identity}?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_experience_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        // FUTURE PROJECTION PATHWAY - 5 steps for when identity persists in future scenarios
        {
          id: 'trauma_future_projection',
          scriptedResponse: (userInput, context) => {
            // Step A: Ask them to project into the future and feel the identity
            const identity = context.metadata.originalTraumaIdentity || context.metadata.currentTraumaIdentity || 'that identity';

            console.log(`🔍 TRAUMA_FUTURE_PROJECTION: Asking to feel identity '${identity}' in the future`);
            return `Put yourself in the future and feel yourself being ${identity}... what does it feel like?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'trauma_future_step_c',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_future_step_c',
          scriptedResponse: (userInput, context) => {
            // Step C: Store response from future projection and ask what they are when not being the identity
            context.metadata.traumaFutureStepAResponse = userInput || 'that';

            const identity = context.metadata.originalTraumaIdentity || context.metadata.currentTraumaIdentity || 'that identity';

            console.log(`🔍 TRAUMA_FUTURE_STEP_C: Asking what they are when not being '${identity}' in the future`);
            return `What are you when you're not being '${identity}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you are when you are not being that.' }
          ],
          nextStep: 'trauma_future_step_d',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_future_step_d',
          scriptedResponse: (userInput, context) => {
            // Step D: Store response from C and ask them to feel that state
            context.metadata.traumaFutureStepCResponse = userInput || 'that';
            const stepCResponse = context.metadata.traumaFutureStepCResponse;

            console.log(`🔍 TRAUMA_FUTURE_STEP_D: Asking them to feel '${stepCResponse}'`);
            return `Feel yourself being '${stepCResponse}'... what does it feel like?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'trauma_future_step_e',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_future_step_e',
          scriptedResponse: (userInput, context) => {
            // Step E: Store response from D and ask what happens
            context.metadata.traumaFutureStepDResponse = userInput || 'that feeling';
            const stepDResponse = context.metadata.traumaFutureStepDResponse;

            console.log(`🔍 TRAUMA_FUTURE_STEP_E: Asking what happens when they feel '${stepDResponse}'`);
            return `Feel '${stepDResponse}'... what happens in yourself when you feel '${stepDResponse}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens in yourself when you feel that.' }
          ],
          nextStep: 'trauma_future_step_f',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_future_step_f',
          scriptedResponse: (userInput, context) => {
            // Step F: Check if they can still feel the identity in the future
            context.metadata.traumaFutureStepEResponse = userInput || 'that';

            const identity = context.metadata.originalTraumaIdentity || context.metadata.currentTraumaIdentity || 'that identity';

            console.log(`🔍 TRAUMA_FUTURE_STEP_F: Checking if they can still feel '${identity}' in the future`);
            return `Can you still feel yourself being ${identity}?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_experience_check',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_experience_check',
          scriptedResponse: (userInput, context) => {
            // Add specific experience reference for personalization
            const negativeExperience = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the negative experience';
            return `Take your mind back to the frozen moment which was the worst part of the negative experience (${negativeExperience}). Does it still feel like a problem to you?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_dig_deeper',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dig_deeper',
          scriptedResponse: (userInput, context) => {
            const negativeExperience = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'this incident';
            return `Do you feel you might feel bad about ${negativeExperience} again in the future?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_dig_deeper_2',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_dig_deeper_2',
          scriptedResponse: () => {
            return `Is there anything else about this that is still a problem for you?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'trauma_integration_awareness_1',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        // Integration Questions - AWARENESS Section
        {
          id: 'trauma_integration_awareness_1',
          scriptedResponse: (userInput, context) => {
            const subject = TextProcessingUtils.getIntegrationSubject(context, 'negative_experience');
            return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${subject}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how you feel about it now.' }
          ],
          nextStep: 'trauma_integration_awareness_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_integration_awareness_2',
          scriptedResponse: () => {
            return `What are you more aware of now than before we did this process?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what you are more aware of now.' }
          ],
          nextStep: 'trauma_integration_awareness_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_integration_awareness_3',
          scriptedResponse: () => {
            return `How has it helped you to do this process?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how this process has helped you.' }
          ],
          nextStep: 'trauma_integration_awareness_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_integration_awareness_4',
          scriptedResponse: () => {
            return `What is your new narrative about this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your new narrative.' }
          ],
          nextStep: 'trauma_integration_awareness_5',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_integration_awareness_5',
          scriptedResponse: () => {
            return `What's your intention now in relation to this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your intention now.' }
          ],
          nextStep: 'trauma_integration_action_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        // Integration Questions - ACTION Section
        {
          id: 'trauma_integration_action_1',
          scriptedResponse: () => {
            return `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?... What else needs to happen for you to realise your intention? (Until they are clear on their plan of action)`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what needs to happen.' }
          ],
          nextStep: 'trauma_integration_action_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_integration_action_2',
          scriptedResponse: () => {
            return `What is the one thing you can do that will make everything else easier or unnecessary?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'trauma_integration_action_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'trauma_integration_action_3',
          scriptedResponse: () => {
            return `What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action and when you will do it.' }
          ],
          nextStep: undefined, // End of Trauma Shifting process
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        }
      ]
    };
  }
}
