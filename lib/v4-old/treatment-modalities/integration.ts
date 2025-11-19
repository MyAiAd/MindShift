import { TreatmentPhase } from '../types';
import { TextProcessingUtils } from '../text-processing-utils';

export class IntegrationPhase {
  static create(): TreatmentPhase {
    return {
      name: 'Integration',
      maxDuration: 15,
      steps: [
        {
          id: 'integration_start',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement from the stored context or fallback to previous responses
            // CRITICAL: Check metadata.problemStatement first (set at work_type_description) to prevent cached cross-session contamination
            const problemStatement = context?.metadata?.problemStatement || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the problem';
            return `Ok now we have cleared the problem, next I will ask you some questions about how your perspective has shifted and what you want to do next. So firstly, how do you feel about the former problem of '${problemStatement}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me how you feel about the former problem now.' }
          ],
          nextStep: 'awareness_question',
          aiTriggers: []
        },
        {
          id: 'awareness_question',
          scriptedResponse: "What are you more aware of now than before we did this process?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what you are more aware of now.' }
          ],
          nextStep: 'how_helped_question',
          aiTriggers: []
        },
        {
          id: 'how_helped_question',
          scriptedResponse: "How has it helped you to do this process?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me how this process has helped you.' }
          ],
          nextStep: 'narrative_question',
          aiTriggers: []
        },
        {
          id: 'narrative_question',
          scriptedResponse: "What is your new narrative about this?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me your new narrative about this.' }
          ],
          nextStep: 'intention_question',
          aiTriggers: []
        },
        {
          id: 'intention_question',
          scriptedResponse: (userInput, context) => {
            // Get the problem statement from the stored context or fallback to previous responses
            // CRITICAL: Check metadata.problemStatement first (set at work_type_description) to prevent cached cross-session contamination
            const problemStatement = context?.metadata?.problemStatement || context?.problemStatement || context?.userResponses?.['restate_selected_problem'] || context?.userResponses?.['mind_shifting_explanation'] || 'the former problem';
            return `What's your intention now in relation to the former problem of '${problemStatement}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what your intention is now.' }
          ],
          nextStep: 'action_question',
          aiTriggers: []
        },
        {
          id: 'action_question',
          scriptedResponse: (userInput, context) => {
            // Get the intention from the previous step (intention_question)
            const userIntention = context.userResponses?.['intention_question'] || 'your intention';
            return `What needs to happen for you to realise your intention of '${userIntention}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me what needs to happen.' }
          ],
          nextStep: 'action_followup',
          aiTriggers: []
        },
        {
          id: 'action_followup',
          scriptedResponse: (userInput, context) => {
            // Get the intention from the intention_question step
            const userIntention = context.userResponses?.['intention_question'] || 'your intention';
            return `What else needs to happen for you to realise your intention of '${userIntention}'?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please tell me what else needs to happen, or say "nothing" if nothing else comes to mind.' }
          ],
          nextStep: 'one_thing_question',
          aiTriggers: []
        },
        {
          id: 'one_thing_question',
          scriptedResponse: "What is the one thing you can do that will make everything else easier or unnecessary?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me the one thing that will make everything else easier.' }
          ],
          nextStep: 'first_action_question',
          aiTriggers: []
        },
        {
          id: 'first_action_question',
          scriptedResponse: "What is the first action that you can commit to now that will help you to realise your intention?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me the first action you can commit to.' }
          ],
          nextStep: 'when_will_you_do_this',
          aiTriggers: []
        },
        {
          id: 'when_will_you_do_this',
          scriptedResponse: "When will you do this?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please tell me when you will do this.' }
          ],
          nextStep: 'session_complete',
          aiTriggers: []
        },
        {
          id: 'session_complete',
          scriptedResponse: "Thank you for doing this Mind Shifting session. The process is now complete. How do you feel overall about the work we've done today?",
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 1, errorMessage: 'Please share how you feel about the session.' }
          ],
          nextStep: undefined,
          aiTriggers: []
        },

        // Modality-specific integration steps that may be called from other phases
        
        // Problem Shifting Integration
        {
          id: 'problem_integration_awareness_1',
          scriptedResponse: (userInput, context) => {
            const subject = TextProcessingUtils.getIntegrationSubject(context, 'problem');
            return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${subject}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how you feel about it now.' }
          ],
          nextStep: 'problem_integration_awareness_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'problem_integration_awareness_2',
          scriptedResponse: () => `What are you more aware of now than before we did this process?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what you are more aware of now.' }
          ],
          nextStep: 'problem_integration_awareness_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'problem_integration_awareness_3',
          scriptedResponse: () => `How has it helped you to do this process?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how this process has helped you.' }
          ],
          nextStep: 'problem_integration_awareness_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'problem_integration_awareness_4',
          scriptedResponse: () => `What is your new narrative about this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your new narrative.' }
          ],
          nextStep: 'problem_integration_awareness_5',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'problem_integration_awareness_5',
          scriptedResponse: () => `What's your intention now in relation to this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your intention now.' }
          ],
          nextStep: 'problem_integration_action_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'problem_integration_action_1',
          scriptedResponse: () => `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?... What else needs to happen for you to realise your intention? (Until they are clear on their plan of action)`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what needs to happen.' }
          ],
          nextStep: 'problem_integration_action_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'problem_integration_action_2',
          scriptedResponse: () => `What is the one thing you can do that will make everything else easier or unnecessary?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'problem_integration_action_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'problem_integration_action_3',
          scriptedResponse: () => `What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action and when you will do it.' }
          ],
          nextStep: undefined, // End of Problem Shifting integration
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        // Identity Shifting Integration
        {
          id: 'integration_awareness_1',
          scriptedResponse: (userInput, context) => {
            const subject = TextProcessingUtils.getIntegrationSubject(context, 'problem');
            return `How do you feel about '${subject}' now?`;
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
        {
          id: 'integration_action_1',
          scriptedResponse: () => `What needs to happen for you to realise your intention?`,
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
          nextStep: undefined,
          aiTriggers: []
        },

        // Belief Shifting Integration
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
          nextStep: undefined, // End of Belief Shifting integration
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        // Blockage Shifting Integration 
        {
          id: 'blockage_integration_awareness_1',
          scriptedResponse: (userInput, context) => {
            const subject = TextProcessingUtils.getIntegrationSubject(context, 'problem');
            return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${subject}' now?`;
          },
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how you feel about it now.' }
          ],
          nextStep: 'blockage_integration_awareness_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'blockage_integration_awareness_2',
          scriptedResponse: () => `What are you more aware of now than before we did this process?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what you are more aware of now.' }
          ],
          nextStep: 'blockage_integration_awareness_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'blockage_integration_awareness_3',
          scriptedResponse: () => `How has it helped you to do this process?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share how this process has helped you.' }
          ],
          nextStep: 'blockage_integration_awareness_4',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'blockage_integration_awareness_4',
          scriptedResponse: () => `What is your new narrative about this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your new narrative.' }
          ],
          nextStep: 'blockage_integration_awareness_5',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'blockage_integration_awareness_5',
          scriptedResponse: () => `What's your intention now in relation to this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your intention now.' }
          ],
          nextStep: 'blockage_integration_action_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'blockage_integration_action_1',
          scriptedResponse: () => `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?... What else needs to happen for you to realise your intention? (Until they are clear on their plan of action)`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share what needs to happen.' }
          ],
          nextStep: 'blockage_integration_action_2',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'blockage_integration_action_2',
          scriptedResponse: () => `What is the one thing you can do that will make everything else easier or unnecessary?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share the one thing you can do.' }
          ],
          nextStep: 'blockage_integration_action_3',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'blockage_integration_action_3',
          scriptedResponse: () => `What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action and when you will do it.' }
          ],
          nextStep: undefined, // End of Blockage Shifting integration
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        // Trauma Shifting Integration
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
          scriptedResponse: () => `What are you more aware of now than before we did this process?`,
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
          scriptedResponse: () => `How has it helped you to do this process?`,
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
          scriptedResponse: () => `What is your new narrative about this?`,
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
          scriptedResponse: () => `What's your intention now in relation to this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your intention now.' }
          ],
          nextStep: 'trauma_integration_action_1',
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },
        {
          id: 'trauma_integration_action_1',
          scriptedResponse: () => `Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?... What else needs to happen for you to realise your intention? (Until they are clear on their plan of action)`,
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
          scriptedResponse: () => `What is the one thing you can do that will make everything else easier or unnecessary?`,
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
          scriptedResponse: () => `What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?`,
          expectedResponseType: 'open',
          validationRules: [
            { type: 'minLength', value: 2, errorMessage: 'Please share your first action and when you will do it.' }
          ],
          nextStep: undefined, // End of Trauma Shifting integration
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        },

        // Reality Shifting Integration (Goals)
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
          nextStep: undefined, // End of Reality Shifting integration
          aiTriggers: [
            { condition: 'userStuck', action: 'clarify' }
          ]
        }
      ]
    };
  }
}
