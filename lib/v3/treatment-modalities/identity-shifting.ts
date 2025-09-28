import { TreatmentPhase } from '../types';
import { TextProcessingUtils } from '../text-processing-utils';

export class IdentityShiftingPhase {
  static create(): TreatmentPhase {
    return {
      name: 'Identity Shifting',
      maxDuration: 30,
      steps: [
        {
          id: 'identity_shifting_intro',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement - prioritize digging deeper restated problem
            const diggingProblem = context?.metadata?.currentDiggingProblem;
            const originalProblem = context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
            
            console.log(`🔍 IDENTITY_SHIFTING_INTRO: Digging problem: "${diggingProblem}", Original problem: "${originalProblem}"`);
            
            // Use the restated problem from digging deeper if available, otherwise use original
            const cleanProblemStatement = diggingProblem || context?.metadata?.problemStatement || context?.problemStatement || originalProblem;
            console.log(`🔍 IDENTITY_SHIFTING_INTRO: Using clean problem statement: "${cleanProblemStatement}"`);
            
            // Enhanced debug: Track what userInput we're receiving
            console.log(`🔍 IDENTITY_SHIFTING_INTRO: Called with userInput: "${userInput || 'NONE'}"`);
            console.log(`🔍 IDENTITY_SHIFTING_INTRO: Current step in context: "${context.currentStep}"`);
            
            // Only store identity if this is actually a user's identity response, not the problem statement
            if (userInput && userInput.trim() && userInput.trim() !== cleanProblemStatement) {
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: RAW userInput received: "${userInput}"`);
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: Problem statement for reference: "${cleanProblemStatement}"`);
              
              const processedIdentity = TextProcessingUtils.processIdentityResponse(userInput.trim());
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: Processing identity "${userInput}" -> "${processedIdentity}"`);
              
              // Check if user said "me" - need clarification
              if (userInput.toLowerCase().trim() === 'me') {
                return "What kind of me?";
              }
              
              // Store the processed identity with proper labeling
              context.metadata.identityResponse = {
                type: 'IDENTITY',
                value: processedIdentity,
                originalInput: userInput.trim()
              };
              
              // Keep currentIdentity for backward compatibility
              context.metadata.currentIdentity = processedIdentity;
              
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: ✅ STORED identity response:`, context.metadata.identityResponse);
            } else if (userInput && userInput.trim() === cleanProblemStatement) {
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: ❌ SKIPPED storage - userInput is problem statement, not identity response`);
            } else if (userInput && userInput.trim()) {
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: ❓ SKIPPED storage - userInput present but doesn't match problem statement`);
            } else {
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: ⏸️ NO userInput - showing question only`);
            }
            
            // Check if we're coming from digging deeper (shorter instructions)
            const isFromDigging = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem || context?.metadata?.skipIntroInstructions;
            
            if (isFromDigging) {
              // Short version for digging deeper - user has already seen full instructions
              console.log(`🔍 IDENTITY_SHIFTING_INTRO: Skipping lengthy instructions - isFromDigging: ${!!isFromDigging}`);
              return `Feel the problem '${cleanProblemStatement}'... what kind of person are you being when you're experiencing this problem?`;
            } else {
              // Full version for first-time users
              return `Please close your eyes and keep them closed throughout the rest of the process. Please tell me the first thing that comes up when I ask this question. Feel the problem of '${cleanProblemStatement}'... what kind of person are you being when you're experiencing this problem?`;
            }
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what kind of person you are being.' }
          ],
          nextStep: 'identity_dissolve_step_a',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_dissolve_step_a',
          scriptedResponse: (userInput, context) => {
            // Use the properly labeled identity response
            const identityData = context.metadata.identityResponse;
            let identity = 'that identity';
            
            if (identityData && identityData.type === 'IDENTITY') {
              identity = identityData.value;
            } else {
              // Fallback to currentIdentity for backward compatibility
              identity = context.metadata.currentIdentity || 'that identity';
            }
            
            return `Feel yourself being '${identity}'... what does it feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'identity_dissolve_step_b',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_dissolve_step_b',
          scriptedResponse: (userInput, context) => {
            // Store the response from step A for use in subsequent steps
            context.metadata.stepAResponse = userInput || 'that feeling';
            const stepAResponse = context.metadata.stepAResponse;
            return `Feel '${stepAResponse}'... what happens in yourself when you feel '${stepAResponse}'?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens in yourself.' }
          ],
          nextStep: 'identity_dissolve_step_c',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_dissolve_step_c',
          scriptedResponse: (userInput, context) => {
            // Store the response from step B
            context.metadata.stepBResponse = userInput || 'that';
            
            // Use the properly labeled identity response
            const identityData = context.metadata.identityResponse;
            let identity = 'that identity';
            
            if (identityData && identityData.type === 'IDENTITY') {
              identity = identityData.value;
            } else {
              // Fallback to currentIdentity for backward compatibility
              identity = context.metadata.currentIdentity || 'that identity';
            }
            
            return `What are you when you're not being '${identity}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you are when you\'re not being that identity.' }
          ],
          nextStep: 'identity_dissolve_step_d',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_dissolve_step_d',
          scriptedResponse: (userInput, context) => {
            // Store the response from step C (what they are when not being the identity)
            context.metadata.stepCResponse = userInput || 'that';
            const stepCResponse = context.metadata.stepCResponse;
            
            // Critical: Ensure originalProblemIdentity is preserved
            console.log(`🔍 IDENTITY_DISSOLVE_STEP_D: originalProblemIdentity: "${context.metadata.originalProblemIdentity}", currentIdentity: "${context.metadata.currentIdentity}", stepCResponse: "${stepCResponse}"`);
            
            return `Feel yourself being '${stepCResponse}'... what does '${stepCResponse}' feel like?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what it feels like.' }
          ],
          nextStep: 'identity_dissolve_step_e',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_dissolve_step_e',
          scriptedResponse: (userInput, context) => {
            // Store the response from step D
            context.metadata.stepDResponse = userInput || 'that feeling';
            const stepDResponse = context.metadata.stepDResponse;
            
            // Critical: Ensure originalProblemIdentity is preserved
            console.log(`🔍 IDENTITY_DISSOLVE_STEP_E: originalProblemIdentity: "${context.metadata.originalProblemIdentity}", currentIdentity: "${context.metadata.currentIdentity}", stepDResponse: "${stepDResponse}"`);
            
            return `Feel '${stepDResponse}'... what happens in yourself when you feel '${stepDResponse}'?`;
          },
          expectedResponseType: 'feeling',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what happens in yourself.' }
          ],
          nextStep: 'identity_dissolve_step_f',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_dissolve_step_f',
          scriptedResponse: (userInput, context) => {
            // Use the properly labeled identity response
            const identityData = context.metadata.identityResponse;
            let identity = 'that identity';
            
            if (identityData && identityData.type === 'IDENTITY') {
              identity = identityData.value;
            } else {
              // Fallback to currentIdentity for backward compatibility
              identity = context.metadata.currentIdentity || 'that identity';
            }
            
            return `Can you still feel yourself being '${identity}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'identity_future_check',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_future_check',
          scriptedResponse: (userInput, context) => {
            // Use the properly labeled identity response
            const identityData = context.metadata.identityResponse;
            let identity = 'that identity';
            
            if (identityData && identityData.type === 'IDENTITY') {
              identity = identityData.value;
            } else {
              // Fallback to currentIdentity for backward compatibility
              identity = context.metadata.currentIdentity || 'that identity';
            }
            
            return `Do you think you might feel yourself being '${identity}' in the future?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'identity_scenario_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'identity_scenario_check',
          scriptedResponse: (userInput, context) => {
            // Use the properly labeled identity response
            const identityData = context.metadata.identityResponse;
            let identity = 'that identity';
            
            if (identityData && identityData.type === 'IDENTITY') {
              identity = identityData.value;
            } else {
              // Fallback to currentIdentity for backward compatibility
              identity = context.metadata.currentIdentity || 'that identity';
            }
            
            return `Is there any scenario in which you might still feel yourself being '${identity}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'identity_check',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        {
          id: 'identity_check',
          scriptedResponse: (userInput, context) => {
            // Use the properly labeled identity response
            const identityData = context.metadata.identityResponse;
            let identity = 'that identity';
            
            if (identityData && identityData.type === 'IDENTITY') {
              identity = identityData.value;
              console.log(`🔍 IDENTITY_CHECK: Using labeled identity: "${identity}"`);
            } else {
              // Fallback to currentIdentity for backward compatibility
              identity = context.metadata.currentIdentity || 'that identity';
              console.log(`🔍 IDENTITY_CHECK: Using fallback identity: "${identity}"`);
            }
            
            return `Can you still feel yourself being '${identity}'?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'identity_problem_check',
          aiTriggers: [] // Identity check should be purely scripted, no AI assistance
        },

        {
          id: 'identity_problem_check',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement - prioritize digging deeper restated problem
            const diggingProblem = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem;
            const cleanProblemStatement = diggingProblem || context?.metadata?.problemStatement || context?.problemStatement || 'the problem';
            console.log(`🔍 IDENTITY_PROBLEM_CHECK: Using problem statement: "${cleanProblemStatement}" (digging: "${diggingProblem}", original: "${context?.problemStatement}")`);
            return `Feel '${cleanProblemStatement}'... does it still feel like a problem?`;
          },
          expectedResponseType: 'yesno',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please answer yes or no.' }
          ],
          nextStep: 'digging_deeper_start',
          aiTriggers: [
            { condition: 'needsClarification', action: 'clarify' }
          ]
        },

        // Integration Questions - Awareness Section
        {
          id: 'integration_awareness_1',
          scriptedResponse: (userInput, context) => {
            const subject = TextProcessingUtils.getIntegrationSubject(context, 'problem');
            return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${subject}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how you feel about it now.' }
          ],
          nextStep: 'integration_awareness_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_awareness_2',
          scriptedResponse: () => `What are you more aware of now than before we did this process?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what you are more aware of now.' }
          ],
          nextStep: 'integration_awareness_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_awareness_3',
          scriptedResponse: () => `How has it helped you to do this process?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how this process has helped you.' }
          ],
          nextStep: 'integration_awareness_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_awareness_4',
          scriptedResponse: () => `What is your new narrative about this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your new narrative.' }
          ],
          nextStep: 'integration_awareness_5',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_awareness_5',
          scriptedResponse: () => `What's your intention now in relation to this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your intention now.' }
          ],
          nextStep: 'integration_action_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        // Integration Questions - Action Section
        {
          id: 'integration_action_1',
          scriptedResponse: () => `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what needs to happen.' }
          ],
          nextStep: 'integration_action_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_action_2',
          scriptedResponse: () => `What else needs to happen for you to realise your intention?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what else needs to happen.' }
          ],
          nextStep: 'integration_action_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_action_3',
          scriptedResponse: () => `What is the one thing you can do that will make everything else easier or unnecessary?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'integration_action_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_action_4',
          scriptedResponse: () => `What is the first action that you can commit to now that will help you to realise your intention?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action.' }
          ],
          nextStep: 'integration_action_5',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'integration_action_5',
          scriptedResponse: () => `When will you do this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share when you will do this.' }
          ],
          nextStep: 'identity_session_complete',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        {
          id: 'identity_session_complete',
          scriptedResponse: "Thank you for doing this Mind Shifting session. The process is now complete. How do you feel overall about the work we've done today?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please share how you feel about the session.' }
          ],
          nextStep: undefined, // End of Identity Shifting process
          aiTriggers: []
        }
      ]
    };
  }
}
