import { BaseTreatmentStateMachine } from './base-state-machine';
import { TreatmentStep, TreatmentContext } from './types';
import { TextProcessingUtils } from './text-processing-utils';
import { ValidationHelpers } from './validation-helpers';

export class TreatmentStateMachine extends BaseTreatmentStateMachine {
  constructor() {
    super();
  }

  /**
   * Helper method to get the current problem statement from context
   */
  private getCurrentProblemStatement(context: TreatmentContext): string {
    return context?.metadata?.currentDiggingProblem ||
      context?.metadata?.problemStatement ||
      context?.problemStatement ||
      'the problem';
  }

  /**
   * Helper method to update problem statement in context
   */
  private updateProblemStatement(context: TreatmentContext, problemStatement: string): void {
    context.problemStatement = problemStatement;
    context.metadata.problemStatement = problemStatement;
    if (!context.metadata.originalProblemStatement) {
      context.metadata.originalProblemStatement = problemStatement;
    }
  }

  /**
   * Determine next step logic - orchestrates the complex routing between treatment modalities
   */
  protected determineNextStep(currentStep: TreatmentStep, context: TreatmentContext): string | null {
    const lastResponse = context.userResponses[context.currentStep]?.toLowerCase() || '';

    console.log(`🔍 DETERMINE_NEXT_STEP: currentStep="${context.currentStep}", lastResponse="${lastResponse}"`);

    // Handle internal routing signals first
    if (typeof currentStep.scriptedResponse === 'function') {
      const testResponse = currentStep.scriptedResponse(context.userResponses[context.currentStep], context);
      if (this.handleInternalRoutingSignals(testResponse, context)) {
        return context.currentStep; // Step was updated by signal handler
      }
    }

    // Main routing logic based on current step
    switch (context.currentStep) {
      case 'mind_shifting_explanation_static':
        // If we have user input (e.g. button click), transition to dynamic step to handle it
        if (lastResponse) {
          return 'mind_shifting_explanation_dynamic';
        }
        return null; // Stay on static step until auto-advance or user input

      case 'mind_shifting_explanation_dynamic':
        return this.handleMindShiftingExplanation(lastResponse, context);

      // Auto-advance logic for all modality static intro steps
      case 'problem_shifting_intro_static':
      case 'identity_shifting_intro_static':
      case 'belief_shifting_intro_static':
      case 'blockage_shifting_intro_static':
      case 'reality_shifting_intro_static':
      case 'trauma_identity_step_static':
        // These steps have expectedResponseType: 'auto' and should auto-advance to their dynamic counterparts
        // Return the dynamic step name (replace _static with _dynamic)
        return context.currentStep.replace('_static', '_dynamic');

      case 'work_type_description':
        return this.handleWorkTypeDescription(lastResponse, context);

      case 'goal_description':
        return this.handleGoalDescription(lastResponse, context);

      case 'negative_experience_description':
        return this.handleNegativeExperienceDescription(lastResponse, context);

      case 'multiple_problems_selection':
        return 'restate_selected_problem';

      case 'restate_selected_problem':
        return 'analyze_response';

      case 'analyze_response':
        return this.handleAnalyzeResponse(lastResponse, context);

      case 'choose_method':
        return this.handleChooseMethod(lastResponse, context);

      case 'method_selection':
        return this.handleMethodSelection(context);

      case 'confirm_statement':
        return this.handleConfirmStatement(lastResponse, context);

      case 'route_to_method':
        return this.handleRouteToMethod(context);

      case 'goal_deadline_check':
        return this.handleGoalDeadlineCheck(lastResponse);

      case 'goal_deadline_date':
        return 'goal_confirmation';

      case 'goal_confirmation':
        return this.handleGoalConfirmation(lastResponse, context);

      case 'goal_certainty':
        return 'reality_shifting_intro_static';

      // Problem Shifting routing
      case 'check_if_still_problem':
        return this.handleCheckIfStillProblem(lastResponse, context);

      // Blockage Shifting routing
      case 'blockage_step_e':
        return this.handleBlockageStepE(lastResponse, context);

      case 'blockage_check_if_still_problem':
        return this.handleBlockageCheckIfStillProblem(lastResponse, context);

      // Identity Shifting routing
      case 'identity_shifting_intro_static':
        return this.handleIdentityShiftingIntro(context);

      case 'identity_dissolve_step_f':
        return this.handleIdentityDissolveStepF(lastResponse, context);

      case 'identity_future_check':
        return this.handleIdentityFutureCheck(lastResponse, context);

      case 'identity_scenario_check':
        return this.handleIdentityScenarioCheck(lastResponse, context);

      case 'identity_check':
        return this.handleIdentityCheck(lastResponse, context);

      case 'identity_problem_check':
        return this.handleIdentityProblemCheck(lastResponse, context);

      case 'confirm_identity_problem':
        return this.handleConfirmIdentityProblem(lastResponse, context);

      // Belief Shifting routing
      case 'belief_step_f':
        return this.handleBeliefStepF(lastResponse, context);

      case 'belief_check_1':
      case 'belief_check_2':
      case 'belief_check_3':
      case 'belief_check_4':
        return this.handleBeliefChecks(context.currentStep, lastResponse, context);

      case 'belief_problem_check':
        return this.handleBeliefProblemCheck(lastResponse, context);

      case 'confirm_belief_problem':
        return this.handleConfirmBeliefProblem(lastResponse, context);

      // Reality Shifting routing
      case 'reality_why_not_possible':
        return this.handleRealityWhyNotPossible(lastResponse, context);

      case 'reality_feel_reason':
        return 'reality_feel_reason_2';

      case 'reality_feel_reason_2':
        return 'reality_feel_reason_3';

      case 'reality_feel_reason_3':
        return 'reality_column_a_restart';

      case 'reality_checking_questions':
        return this.handleRealityCheckingQuestions(lastResponse, context);

      case 'reality_doubt_reason':
        return 'reality_cycle_b2';

      case 'reality_cycle_b2':
        return 'reality_cycle_b3';

      case 'reality_cycle_b3':
        return 'reality_cycle_b4';

      case 'reality_cycle_b4':
        return this.handleRealityCycleB4(context);

      case 'reality_certainty_check':
        return this.handleRealityCertaintyCheck(lastResponse, context);

      case 'reality_integration_action_more':
        return this.handleRealityIntegrationActionMore(lastResponse, context);

      // Trauma Shifting routing
      case 'trauma_shifting_intro':
        return this.handleTraumaShiftingIntro(lastResponse);

      case 'trauma_problem_redirect':
        return this.handleTraumaProblemRedirect(lastResponse, context);

      case 'trauma_identity_check':
        return this.handleTraumaIdentityCheck(lastResponse, context);

      case 'trauma_future_identity_check':
        return this.handleTraumaFutureIdentityCheck(lastResponse, context);

      case 'trauma_future_scenario_check':
        return this.handleTraumaFutureScenarioCheck(lastResponse, context);

      case 'trauma_experience_check':
        return this.handleTraumaExperienceCheck(lastResponse, context);

      case 'trauma_dig_deeper':
        return 'trauma_dig_deeper_2';

      case 'trauma_dig_deeper_2':
        return this.handleTraumaDigDeeper2(lastResponse, context);

      // Digging Deeper routing
      case 'digging_deeper_start':
        return this.handleDiggingDeeperStart(lastResponse, context);

      case 'future_problem_check':
        return this.handleFutureProblemCheck(lastResponse);

      case 'restate_problem_future':
        return this.handleRestateProblemFuture(lastResponse, context);

      case 'digging_method_selection':
        return this.handleDiggingMethodSelection(lastResponse, context);

      case 'scenario_check_1':
        return this.handleScenarioCheck(lastResponse, 'restate_scenario_problem_1', 'anything_else_check_1');

      case 'restate_scenario_problem_1':
        return 'clear_scenario_problem_1';

      case 'clear_scenario_problem_1':
        return this.handleClearScenarioProblem1(lastResponse, context);

      case 'scenario_check_2':
        return this.handleScenarioCheck(lastResponse, 'restate_scenario_problem_2', 'scenario_check_3');

      case 'restate_scenario_problem_2':
        return 'clear_scenario_problem_2';

      case 'clear_scenario_problem_2':
        return this.handleClearScenarioProblem2(lastResponse, context);

      case 'scenario_check_3':
        return this.handleScenarioCheck(lastResponse, 'restate_scenario_problem_3', 'anything_else_check_1');

      case 'restate_scenario_problem_3':
        return 'clear_scenario_problem_3';

      case 'clear_scenario_problem_3':
        return this.handleClearScenarioProblem3(lastResponse, context);

      case 'anything_else_check_1':
        return this.handleAnythingElseCheck(lastResponse, context, 'restate_anything_else_problem_1');

      case 'restate_anything_else_problem_1':
        return this.handleRestateAnythingElseProblem1(context);

      case 'clear_anything_else_problem_1':
        return this.handleClearAnythingElseProblem1(lastResponse, context);

      case 'anything_else_check_2':
        return this.handleAnythingElseCheck(lastResponse, context, 'restate_anything_else_problem_2');

      case 'restate_anything_else_problem_2':
        return this.handleRestateAnythingElseProblem2(context);

      case 'clear_anything_else_problem_2':
        return this.handleClearAnythingElseProblem2(lastResponse, context);

      case 'anything_else_check_3':
        return this.handleAnythingElseCheck3(lastResponse, context);

      case 'route_to_integration':
        return this.handleRouteToIntegration(context);

      // Integration routing
      case 'action_question':
        return 'action_followup';

      case 'action_followup':
        return this.handleActionFollowup(lastResponse);

      // Session completion
      case 'session_complete':
      case 'identity_session_complete':
      case 'reality_session_complete':
        return null; // Session finished

      default:
        // Default behavior - follow the nextStep
        return currentStep.nextStep || null;
    }
  }

  /**
   * Handle internal routing signals that bypass normal step progression
   */
  protected handleInternalRoutingSignals(response: string, context: TreatmentContext): boolean {
    switch (response) {
      case 'PROBLEM_SELECTION_CONFIRMED':
        context.currentPhase = 'method_selection';
        context.currentStep = 'choose_method';
        return true;

      case 'GOAL_SELECTION_CONFIRMED':
        context.currentPhase = 'introduction';
        context.currentStep = 'goal_description';
        return true;

      case 'NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED':
        context.currentPhase = 'introduction';
        context.currentStep = 'negative_experience_description';
        return true;

      case 'METHOD_SELECTION_NEEDED':
        // Route to method selection
        context.currentPhase = 'method_selection';
        context.currentStep = 'choose_method';
        return true;

      case 'SKIP_TO_TREATMENT_INTRO':
        // This should be handled by the calling step's routing
        return false;

      case 'ROUTE_TO_PROBLEM_INTEGRATION':
        context.currentPhase = 'integration';
        context.currentStep = 'problem_integration_awareness_1';
        return true;

      case 'ROUTE_TO_IDENTITY_INTEGRATION':
        context.currentPhase = 'integration';
        context.currentStep = 'integration_awareness_1';
        return true;

      case 'ROUTE_TO_BELIEF_INTEGRATION':
        context.currentPhase = 'integration';
        context.currentStep = 'belief_integration_awareness_1';
        return true;

      case 'ROUTE_TO_BLOCKAGE_INTEGRATION':
        context.currentPhase = 'integration';
        context.currentStep = 'blockage_integration_awareness_1';
        return true;

      case 'ROUTE_TO_TRAUMA_INTEGRATION':
        context.currentPhase = 'integration';
        context.currentStep = 'trauma_integration_awareness_1';
        return true;

      case 'PROBLEM_SELECTION_CONFIRMED':
        context.currentPhase = 'method_selection';
        context.currentStep = 'choose_method';
        return true;

      case 'GOAL_SELECTION_CONFIRMED':
        context.currentPhase = 'introduction';
        context.currentStep = 'goal_description';
        return true;

      case 'NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED':
        context.currentPhase = 'introduction';
        context.currentStep = 'negative_experience_description';
        return true;

      case 'PROBLEM_SHIFTING_SELECTED':
        context.currentPhase = 'problem_shifting';
        context.metadata.selectedMethod = 'problem_shifting';
        context.currentStep = this.getIntroStepForMethod('problem_shifting', context);
        return true;

      case 'IDENTITY_SHIFTING_SELECTED':
        context.currentPhase = 'identity_shifting';
        context.metadata.selectedMethod = 'identity_shifting';
        context.currentStep = this.getIntroStepForMethod('identity_shifting', context);
        return true;

      case 'BELIEF_SHIFTING_SELECTED':
        context.currentPhase = 'belief_shifting';
        context.metadata.selectedMethod = 'belief_shifting';
        context.currentStep = this.getIntroStepForMethod('belief_shifting', context);
        return true;

      case 'BLOCKAGE_SHIFTING_SELECTED':
        context.currentPhase = 'blockage_shifting';
        context.metadata.selectedMethod = 'blockage_shifting';
        context.currentStep = this.getIntroStepForMethod('blockage_shifting', context);
        return true;

      default:
        return false; // No signal handled
    }
  }

  // Helper methods for handling specific step logic

  private handleMindShiftingExplanation(lastResponse: string, context: TreatmentContext): string {
    console.log(`🔍 MIND_SHIFTING_DETERMINE: lastResponse="${lastResponse}", workType="${context.metadata.workType}", selectedMethod="${context.metadata.selectedMethod}"`);
    console.log(`🔍 MIND_SHIFTING_DETERMINE: Full metadata:`, JSON.stringify(context.metadata, null, 2));

    // Handle work type selection based on user input
    if (lastResponse.includes('1') || (lastResponse.includes('problem') && !lastResponse.includes('shifting'))) {
      // Reset all work type metadata for fresh selection
      context.metadata.workType = 'problem';
      context.metadata.selectedMethod = undefined;
      console.log(`🎯 WORK_TYPE_SELECTION: Set workType to 'problem'`);
      // For problems, go to method selection phase and step
      context.currentPhase = 'method_selection';
      return 'choose_method';
    } else if (lastResponse.includes('2') || (lastResponse.includes('goal') && !lastResponse.includes('shifting'))) {
      // Reset all work type metadata for fresh selection
      context.metadata.workType = 'goal';
      context.metadata.selectedMethod = undefined;
      console.log(`🎯 WORK_TYPE_SELECTION: Set workType to 'goal'`);
      // Stay in introduction phase for goal description
      context.currentPhase = 'introduction';
      return 'goal_description';
    } else if (lastResponse.includes('3') || (lastResponse.includes('negative') && !lastResponse.includes('shifting')) || (lastResponse.includes('experience') && !lastResponse.includes('shifting'))) {
      // Reset all work type metadata for fresh selection
      context.metadata.workType = 'negative_experience';
      context.metadata.selectedMethod = undefined;
      console.log(`🎯 WORK_TYPE_SELECTION: Set workType to 'negative_experience'`);
      // Stay in introduction phase for negative experience description
      context.currentPhase = 'introduction';
      return 'negative_experience_description';
    }

    // If no valid selection, stay on current step
    console.log(`🔍 MIND_SHIFTING_DETERMINE: No valid work type selected, staying on mind_shifting_explanation`);

    const selectedWorkType = context.metadata.workType;
    const selectedMethod = context.metadata.selectedMethod;
    console.log(`🔍 MIND_SHIFTING_DETERMINE: selectedWorkType="${selectedWorkType}", selectedMethod="${selectedMethod}"`);

    // If user selected a work type and method (for problems), check if we have problem statement
    if (selectedWorkType === 'problem' && selectedMethod) {
      // Only skip to treatment intro if we already have a problem statement
      if (context.problemStatement || context.metadata.problemStatement) {
        console.log(`🔍 MIND_SHIFTING_DETERMINE: Problem, method, and problem statement all present - going directly to treatment intro`);
        context.currentPhase = this.getPhaseForMethod(selectedMethod || 'problem_shifting');
        return this.getIntroStepForMethod(selectedMethod || 'problem_shifting', context);
      } else {
        // Method selected but no problem statement yet - need to collect it
        console.log(`🔍 MIND_SHIFTING_DETERMINE: Problem and method selected, but no problem statement - going to collect problem description`);
        context.currentPhase = 'work_type_selection';
        return 'work_type_description';
      }
    } else if (selectedWorkType === 'goal') {
      // Check if we have the goal description yet
      if (!context.problemStatement && !context.metadata.problemStatement) {
        // Go to dedicated goal description step - ensure we stay in introduction phase
        console.log(`🔍 MIND_SHIFTING_DETERMINE: Goal selected, going to goal_description step`);
        context.currentPhase = 'introduction'; // Explicitly set to ensure we're in correct phase
        return 'goal_description';
      } else {
        // Have description, go to reality shifting intro
        console.log(`🔍 MIND_SHIFTING_DETERMINE: Goal and description provided, going to reality_shifting_intro`);
        context.currentPhase = 'reality_shifting';
        context.metadata.selectedMethod = 'reality_shifting';
        return 'reality_shifting_intro_static';
      }
    } else if (selectedWorkType === 'negative_experience') {
      // Check if we have the negative experience description yet
      if (!context.problemStatement && !context.metadata.problemStatement) {
        // Go to dedicated negative experience description step - ensure we stay in introduction phase
        console.log(`🔍 MIND_SHIFTING_DETERMINE: Negative experience selected, going to negative_experience_description step`);
        context.currentPhase = 'introduction'; // Explicitly set to ensure we're in correct phase
        return 'negative_experience_description';
      } else {
        // Have description, go to trauma shifting intro
        console.log(`🔍 MIND_SHIFTING_DETERMINE: Negative experience and description provided, going to trauma_shifting_intro`);
        context.currentPhase = 'trauma_shifting';
        context.metadata.selectedMethod = 'trauma_shifting';
        return 'trauma_shifting_intro';
      }
    } else if (selectedWorkType === 'problem' && !selectedMethod) {
      // Problem selected but no method yet, stay on current step for method selection
      console.log(`🔍 MIND_SHIFTING_DETERMINE: Problem selected, waiting for method selection, staying on mind_shifting_explanation`);
      return 'mind_shifting_explanation';
    } else {
      // No valid work type selected yet, stay on current step
      console.log(`🔍 MIND_SHIFTING_DETERMINE: No valid work type selected, staying on mind_shifting_explanation`);
      return 'mind_shifting_explanation';
    }
  }

  private clearPreviousModalityMetadata(context: TreatmentContext): void {
    console.log('🔍 MODALITY_CLEANUP: Clearing previous modality metadata');

    // Clear belief-specific metadata
    delete context.metadata.currentBelief;
    delete context.metadata.cycleCount;

    // Clear identity-specific metadata
    delete context.metadata.currentIdentity;

    // Clear blockage-specific metadata
    delete context.metadata.currentBlockage;

    // Clear reality-specific metadata
    delete context.metadata.currentReality;

    // Clear trauma-specific metadata
    delete context.metadata.currentTrauma;

    // Keep digging-deeper specific metadata as it's needed for the flow
    // Keep: currentDiggingProblem, newDiggingProblem, returnToDiggingStep, selectedMethod, workType

    console.log('🔍 MODALITY_CLEANUP: Cleared previous modality metadata, kept digging-deeper context');
  }

  private getPhaseForMethod(method: string): string {
    const methodPhaseMap: Record<string, string> = {
      'problem_shifting': 'problem_shifting',
      'identity_shifting': 'identity_shifting',
      'belief_shifting': 'belief_shifting',
      'blockage_shifting': 'blockage_shifting',
      'reality_shifting': 'reality_shifting',
      'trauma_shifting': 'trauma_shifting'
    };
    return methodPhaseMap[method] || 'problem_shifting';
  }

  private getIntroStepForMethod(method: string, context?: TreatmentContext): string {
    // V4: Check if we should skip intro instructions (digging deeper, cycling back)
    const isFromDigging = context?.metadata?.currentDiggingProblem || context?.metadata?.newDiggingProblem;
    const shouldSkipIntro = context?.metadata?.skipIntroInstructions || isFromDigging;
    
    if (shouldSkipIntro) {
      // Clear the flag
      if (context?.metadata) {
        context.metadata.skipIntroInstructions = false;
      }
      console.log(`🔍 GET_INTRO_STEP: Skipping intro instructions, routing to dynamic step (isFromDigging: ${!!isFromDigging})`);
      
      // Route to _dynamic step (skip the _static intro)
      const methodDynamicStepMap: Record<string, string> = {
        'problem_shifting': 'problem_shifting_intro_dynamic',
        'identity_shifting': 'identity_shifting_intro_dynamic',
        'belief_shifting': 'belief_shifting_intro_dynamic',
        'blockage_shifting': 'blockage_shifting_intro_dynamic',
        'reality_shifting': 'reality_shifting_intro',  // Reality shifting doesn't have static/dynamic split
        'trauma_shifting': 'trauma_shifting_intro'      // Trauma shifting doesn't have static/dynamic split
      };
      return methodDynamicStepMap[method] || 'problem_shifting_intro_dynamic';
    }
    
    // First time - show full intro with _static step
    const methodStepMap: Record<string, string> = {
      'problem_shifting': 'problem_shifting_intro_static',
      'identity_shifting': 'identity_shifting_intro_static',
      'belief_shifting': 'belief_shifting_intro_static',
      'blockage_shifting': 'blockage_shifting_intro_static',
      'reality_shifting': 'reality_shifting_intro_static',
      'trauma_shifting': 'trauma_shifting_intro'
    };
    return methodStepMap[method] || 'problem_shifting_intro_static';
  }

  private handleWorkTypeDescription(lastResponse: string, context: TreatmentContext): string {
    // CRITICAL: Store the user's problem statement FIRST before routing
    const userProblemStatement = context.userResponses[context.currentStep] || '';

    console.log(`
╔════════════════════════════════════════════════════════════════
║ 🎯 WORK_TYPE_DESCRIPTION - Handler (determineNextStep)
╠════════════════════════════════════════════════════════════════
║ userProblemStatement: "${userProblemStatement}"
║ workType: "${context.metadata.workType}"
║ selectedMethod: "${context.metadata.selectedMethod}"
║ currentPhase: "${context.currentPhase}"
╚════════════════════════════════════════════════════════════════`);

    if (userProblemStatement) {
      this.updateProblemStatement(context, userProblemStatement);
      console.log(`║ ✅ STORED via updateProblemStatement: "${context.metadata.problemStatement}"`);
    }

    // User provided description, route to appropriate treatment intro
    const descWorkType = context.metadata.workType;
    const descSelectedMethod = context.metadata.selectedMethod;

    if (descWorkType === 'problem' && descSelectedMethod) {
      let nextStep = '';
      if (descSelectedMethod === 'identity_shifting') {
        context.currentPhase = 'identity_shifting';
        nextStep = 'identity_shifting_intro_static';
      } else if (descSelectedMethod === 'problem_shifting') {
        context.currentPhase = 'problem_shifting';
        nextStep = 'problem_shifting_intro_static';
      } else if (descSelectedMethod === 'belief_shifting') {
        context.currentPhase = 'belief_shifting';
        nextStep = 'belief_shifting_intro_static';
      } else if (descSelectedMethod === 'blockage_shifting') {
        context.currentPhase = 'blockage_shifting';
        nextStep = 'blockage_shifting_intro_static';
      }
      console.log(`║ 🚀 ROUTING TO: "${nextStep}" (phase: "${context.currentPhase}")
╚════════════════════════════════════════════════════════════════\n`);
      return nextStep;
    } else if (descWorkType === 'goal') {
      context.currentPhase = 'reality_shifting';
      console.log(`║ 🚀 ROUTING TO: "reality_shifting_intro" (phase: "${context.currentPhase}")
╚════════════════════════════════════════════════════════════════\n`);
      return 'reality_shifting_intro_static';
    } else if (descWorkType === 'negative_experience') {
      context.currentPhase = 'trauma_shifting';
      console.log(`║ 🚀 ROUTING TO: "trauma_shifting_intro" (phase: "${context.currentPhase}")
╚════════════════════════════════════════════════════════════════\n`);
      return 'trauma_shifting_intro';
    } else if (descWorkType === 'problem' && !descSelectedMethod) {
      // Problem work type but no method selected yet - route to method selection
      context.currentPhase = 'method_selection';
      console.log(`║ 🚀 ROUTING TO: "choose_method" (phase: "${context.currentPhase}")
╚════════════════════════════════════════════════════════════════\n`);
      return 'choose_method';
    }

    // Fallback to confirmation step (for other cases like goal without method)
    console.log(`║ ⚠️  FALLBACK: Routing to "confirm_statement"
╚════════════════════════════════════════════════════════════════\n`);
    return 'confirm_statement';
  }

  private handleGoalDescription(lastResponse: string, context: TreatmentContext): string {
    // Store goal and check for deadline
    this.updateProblemStatement(context, lastResponse);
    context.metadata.currentGoal = lastResponse;
    // Store the original problem statement for digging deeper questions
    if (!context.metadata.originalProblemStatement) {
      context.metadata.originalProblemStatement = lastResponse;
    }
    context.currentPhase = 'reality_shifting';
    context.metadata.selectedMethod = 'reality_shifting';
    console.log(`🔍 GOAL_DESCRIPTION: Stored goal: "${lastResponse}"`);

    // Check if deadline is already mentioned in the goal
    const hasDeadlineInGoal = ValidationHelpers.detectDeadlineInGoal(lastResponse);
    if (hasDeadlineInGoal.hasDeadline && hasDeadlineInGoal.deadline && hasDeadlineInGoal.synthesizedGoal) {
      console.log(`🤖 AI_DEADLINE_DETECTION: Deadline detected in goal: "${hasDeadlineInGoal.deadline}"`);
      context.metadata.goalWithDeadline = hasDeadlineInGoal.synthesizedGoal;
      context.userResponses['goal_deadline_check'] = 'yes';
      context.userResponses['goal_deadline_date'] = hasDeadlineInGoal.deadline;
      return 'goal_confirmation';
    } else {
      console.log(`🤖 AI_DEADLINE_DETECTION: No deadline detected, proceeding to deadline check`);
      return 'goal_deadline_check';
    }
  }

  private handleNegativeExperienceDescription(lastResponse: string, context: TreatmentContext): string {
    // Store negative experience description
    console.log(`🔍 NEGATIVE_EXPERIENCE_DESCRIPTION: Storing "${lastResponse}"`);
    this.updateProblemStatement(context, lastResponse);

    // Check if this is from dig deeper flow (originalProblemStatement exists means we're already working on something)
    const isFromDigDeeper = context.metadata.originalProblemStatement &&
      context.metadata.originalProblemStatement !== lastResponse;

    if (isFromDigDeeper) {
      // Coming from dig deeper - route to method selection
      console.log(`🔍 NEGATIVE_EXPERIENCE_DESCRIPTION: From dig deeper flow, routing to method selection`);
      context.currentPhase = 'method_selection';
      context.metadata.selectedMethod = undefined; // Clear method so they can choose
      context.metadata.isDiggingDeeperMethodSelection = true; // Critical: tells choose_method to preserve returnToDiggingStep
      return 'choose_method';
    } else {
      // Initial flow - store as original and go straight to trauma shifting
      if (!context.metadata.originalProblemStatement) {
        context.metadata.originalProblemStatement = lastResponse;
      }
      context.currentPhase = 'trauma_shifting';
      context.metadata.selectedMethod = 'trauma_shifting';
      console.log(`🔍 NEGATIVE_EXPERIENCE_DESCRIPTION: Initial flow, going to trauma_shifting_intro`);
      return 'trauma_shifting_intro';
    }
  }

  private handleAnalyzeResponse(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('no') || lastResponse.includes('not')) {
      return 'restate_selected_problem';
    }
    if (lastResponse.includes('yes') || lastResponse.includes('correct') || lastResponse.includes('right')) {
      const problemResponse = context.userResponses['restate_selected_problem'] || context.userResponses['mind_shifting_explanation'] || '';
      this.updateProblemStatement(context, problemResponse);
      context.currentPhase = 'method_selection';
      return 'choose_method';
    }
    return 'analyze_response';
  }

  private handleChooseMethod(lastResponse: string, context: TreatmentContext): string {
    // CRITICAL: Check if this is digging deeper method selection FIRST
    // This flag is set by restate_problem_future when routing here from digging deeper flow
    console.log(`🔍 CHOOSE_METHOD: isDiggingDeeperMethodSelection=${context.metadata.isDiggingDeeperMethodSelection}`);
    if (context.metadata.isDiggingDeeperMethodSelection) {
      console.log(`🔍 CHOOSE_METHOD_DIGGING: Processing digging deeper method selection`);

      // Clear the flag
      context.metadata.isDiggingDeeperMethodSelection = false;

      // Delegate to digging_method_selection logic
      const input = lastResponse.toLowerCase();
      let diggingSelectedMethod = '';

      if (input.includes('problem shifting') || input === '1') {
        diggingSelectedMethod = 'problem_shifting';
      } else if (input.includes('identity shifting') || input === '2') {
        diggingSelectedMethod = 'identity_shifting';
      } else if (input.includes('belief shifting') || input === '3') {
        diggingSelectedMethod = 'belief_shifting';
      } else if (input.includes('blockage shifting') || input === '4') {
        diggingSelectedMethod = 'blockage_shifting';
      }

      // Update problem statement to use the new problem from digging deeper flow
      const newProblemFromUserResponse = context.userResponses?.['restate_problem_future'] ||
        context.userResponses?.['restate_scenario_problem_1'] ||
        context.userResponses?.['restate_scenario_problem_2'] ||
        context.userResponses?.['restate_scenario_problem_3'] ||
        context.userResponses?.['restate_anything_else_problem_1'] ||
        context.userResponses?.['restate_anything_else_problem_2'];
      // CRITICAL: Prioritize newProblemFromUserResponse FIRST to use the latest restated problem
      const newDiggingProblem = newProblemFromUserResponse || context.metadata?.currentDiggingProblem || context.metadata?.newDiggingProblem;

      if (newDiggingProblem) {
        context.problemStatement = newDiggingProblem;
        context.metadata.currentDiggingProblem = newDiggingProblem;
        console.log(`🔍 CHOOSE_METHOD_DIGGING: Using problem: "${newDiggingProblem}"`);
      }

      // ⭐ THIS IS CRITICAL: Clear previous modality-specific metadata to ensure clean switch
      // This removes stale currentBelief, cycleCount, etc. from the previous modality session
      console.log(`🔍 CHOOSE_METHOD_DIGGING: Clearing previous modality metadata`);
      this.clearPreviousModalityMetadata(context);

      // Store the selected method in metadata for reference
      context.metadata.selectedMethod = diggingSelectedMethod;

      // Route to appropriate method intro (will use _dynamic step due to skipIntroInstructions)
      context.currentPhase = this.getPhaseForMethod(diggingSelectedMethod);
      console.log(`🔍 CHOOSE_METHOD_DIGGING: Routing to ${diggingSelectedMethod} intro`);
      return this.getIntroStepForMethod(diggingSelectedMethod, context);
    }

    // NORMAL FLOW: Original choose_method logic for non-digging-deeper scenarios
    console.log(`🔍 CHOOSE_METHOD: Processing normal method selection`);
    const methodChoice = context.userResponses[context.currentStep]?.toLowerCase() || '';
    console.log(`🔍 CHOOSE_METHOD: methodChoice="${methodChoice}"`);

    // Check if problem statement already exists (e.g., from trauma redirect)
    const hasExistingProblem = context.problemStatement || context.metadata.problemStatement;

    if (methodChoice.includes('problem shifting') || methodChoice.includes('1')) {
      context.currentPhase = hasExistingProblem ? 'problem_shifting' : 'work_type_selection';
      context.metadata.selectedMethod = 'problem_shifting';
      // Clear previous modality metadata for clean state
      this.clearPreviousModalityMetadata(context);
      return hasExistingProblem ? this.getIntroStepForMethod('problem_shifting', context) : 'work_type_description';
    } else if (methodChoice.includes('blockage shifting') || methodChoice.includes('4')) {
      context.currentPhase = hasExistingProblem ? 'blockage_shifting' : 'work_type_selection';
      context.metadata.selectedMethod = 'blockage_shifting';
      // Clear previous modality metadata for clean state
      this.clearPreviousModalityMetadata(context);
      return hasExistingProblem ? this.getIntroStepForMethod('blockage_shifting', context) : 'work_type_description';
    } else if (methodChoice.includes('identity shifting') || methodChoice.includes('2')) {
      context.currentPhase = hasExistingProblem ? 'identity_shifting' : 'work_type_selection';
      context.metadata.selectedMethod = 'identity_shifting';
      // Clear previous modality metadata for clean state
      this.clearPreviousModalityMetadata(context);
      return hasExistingProblem ? this.getIntroStepForMethod('identity_shifting', context) : 'work_type_description';
    } else if (methodChoice.includes('belief shifting') || methodChoice.includes('3')) {
      context.currentPhase = hasExistingProblem ? 'belief_shifting' : 'work_type_selection';
      context.metadata.selectedMethod = 'belief_shifting';
      // Clear previous modality metadata for clean state
      this.clearPreviousModalityMetadata(context);
      return hasExistingProblem ? this.getIntroStepForMethod('belief_shifting', context) : 'work_type_description';
    } else if (methodChoice.includes('reality shifting')) {
      context.currentPhase = 'reality_shifting';
      context.metadata.selectedMethod = 'reality_shifting';
      return 'reality_goal_capture';
    } else if (methodChoice.includes('trauma shifting')) {
      context.currentPhase = hasExistingProblem ? 'trauma_shifting' : 'work_type_selection';
      context.metadata.selectedMethod = 'trauma_shifting';
      // Clear previous modality metadata for clean state
      this.clearPreviousModalityMetadata(context);
      return hasExistingProblem ? 'trauma_shifting_intro' : 'work_type_description';
    }

    // No valid method selected yet - stay on choose_method to show buttons
    console.log(`🔍 CHOOSE_METHOD: No valid method detected, staying on choose_method`);
    return 'choose_method';
  }

  private handleMethodSelection(context: TreatmentContext): string {
    const currentSelectedMethod = context.metadata.selectedMethod;
    if (currentSelectedMethod) {
      return 'work_type_description';
    } else {
      return 'method_selection';
    }
  }

  private handleConfirmStatement(lastResponse: string, context: TreatmentContext): string {
    const confirmInput = lastResponse.toLowerCase();

    // If user says "no", route back to appropriate input step based on workType
    if (confirmInput.includes('no') || confirmInput.includes('not') || confirmInput.includes('wrong') || confirmInput.includes('incorrect')) {
      const workType = context.metadata.workType;

      // DEBUG: Log the state
      console.log(`🔍 CONFIRM_STATEMENT "NO": workType=${workType}, hasTraumaRedirect=${!!context.userResponses['trauma_problem_redirect']}`);
      console.log(`🔍 CONFIRM_STATEMENT "NO": userResponses keys:`, Object.keys(context.userResponses || {}));
      console.log(`🔍 CONFIRM_STATEMENT "NO": trauma_problem_redirect value:`, context.userResponses['trauma_problem_redirect']);

      // Check if this came from trauma_problem_redirect - check FIRST before workType
      if (context.userResponses['trauma_problem_redirect']) {
        context.currentPhase = 'trauma_shifting'; // Set correct phase
        delete context.userResponses['trauma_problem_redirect']; // Clear old response
        delete context.userResponses['confirm_statement']; // Clear old confirmation too
        // Don't clear problemStatement - trauma_problem_redirect will overwrite it with new value

        // Persist the cleared responses to database
        this.saveContextToDatabase(context).catch(error =>
          console.error('Failed to save cleared responses to database:', error)
        );

        return 'trauma_problem_redirect'; // Go back to re-answer how they feel
      }

      // Otherwise route based on workType to re-enter description
      if (workType === 'problem') {
        // For regular problems, clear statement and ask again
        context.metadata.problemStatement = undefined;
        context.problemStatement = undefined;
        return 'work_type_description'; // Stay in work_type_selection phase
      } else if (workType === 'goal') {
        context.currentPhase = 'introduction';
        return 'goal_description';
      } else if (workType === 'negative_experience') {
        context.currentPhase = 'introduction'; // Set correct phase for negative_experience_description
        return 'negative_experience_description';
      }

      // Fallback (should rarely happen)
      return 'work_type_description';
    }
    // If user says "yes", route to treatment
    if (confirmInput.includes('yes') || confirmInput.includes('correct') || confirmInput.includes('right')) {
      return 'route_to_method';
    }
    // If it's not yes/no, stay on confirm_statement (it will handle showing confirmation)
    return 'confirm_statement';
  }

  private handleRouteToMethod(context: TreatmentContext): string {
    const workType = context.metadata.workType;
    const selectedMethod = context.metadata.selectedMethod;

    if (workType === 'problem' && selectedMethod) {
      context.currentPhase = this.getPhaseForMethod(selectedMethod);
      return this.getIntroStepForMethod(selectedMethod, context);
    } else if (workType === 'goal') {
      // Goals: go to reality_shifting_intro
      context.currentPhase = 'reality_shifting';
      context.metadata.selectedMethod = 'reality_shifting';
      return 'reality_shifting_intro_static';
    } else if (workType === 'negative_experience') {
      // Negative experiences: we showed trauma_shifting_intro content, so go to trauma_dissolve_step_a next
      context.currentPhase = 'trauma_shifting';
      context.metadata.selectedMethod = 'trauma_shifting';
      console.log(`🔧 ROUTE_TO_METHOD: Negative experience, routing to trauma_dissolve_step_a`);
      return 'trauma_dissolve_step_a';  // NOT trauma_identity_step!
    }

    return 'choose_method';
  }

  private handleGoalDeadlineCheck(lastResponse: string): string {
    if (lastResponse.toLowerCase().includes('yes') || lastResponse.toLowerCase().includes('y')) {
      return 'goal_deadline_date';
    } else {
      return 'goal_confirmation';
    }
  }

  private handleGoalConfirmation(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.toLowerCase().includes('yes') || lastResponse.toLowerCase().includes('y')) {
      return 'goal_certainty';
    } else {
      // User said no - clear goal metadata and restart goal capture
      context.metadata.currentGoal = '';
      context.metadata.goalWithDeadline = '';
      delete context.userResponses['goal_deadline_check'];
      delete context.userResponses['goal_deadline_date'];
      delete context.userResponses['goal_confirmation'];
      // Clear goal cache to prevent stale responses
      this.clearGoalCache();
      // Reset phase to introduction where goal_description lives
      context.currentPhase = 'introduction';
      console.log('🔄 GOAL_CONFIRMATION: User said no, cleared metadata and returning to goal_description');
      return 'goal_description';
    }
  }

  private handleCheckIfStillProblem(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes') || lastResponse.includes('still')) {
      // Still a problem - cycle back to problem_shifting_intro but skip the introductory instructions
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      context.metadata.skipIntroInstructions = true; // Flag to skip intro instructions
      context.metadata.skipLinguisticProcessing = true; // Flag to prevent AI processing on repeat
      return this.getIntroStepForMethod('problem_shifting', context);
    }
    if (lastResponse.includes('no') || lastResponse.includes('not')) {
      // No longer a problem - check if we've already asked permission to dig deeper
      const alreadyGrantedPermission = context.userResponses['digging_deeper_start'] === 'yes';
      const returnStep = context.metadata?.returnToDiggingStep;

      console.log(`🔍 CHECK_IF_STILL_PROBLEM: alreadyGrantedPermission=${alreadyGrantedPermission}, returnStep=${returnStep}`);
      console.log(`🔍 CHECK_IF_STILL_PROBLEM: userResponses['digging_deeper_start']=${context.userResponses['digging_deeper_start']}`);

      if (alreadyGrantedPermission && returnStep) {
        // Permission already granted and we're returning from a sub-problem - skip permission, continue digging
        console.log(`🔍 CHECK_IF_STILL_PROBLEM: Returning to ${returnStep}`);
        context.currentPhase = 'digging_deeper';
        context.metadata.returnToDiggingStep = undefined; // Clear now that we're returning
        return returnStep;
      } else if (alreadyGrantedPermission) {
        // Permission already granted - skip permission, go to future_problem_check to continue digging
        console.log(`🔍 CHECK_IF_STILL_PROBLEM: Permission granted, going to future_problem_check`);
        context.currentPhase = 'digging_deeper';
        return 'future_problem_check';
      } else {
        // First time - ask permission
        console.log(`🔍 CHECK_IF_STILL_PROBLEM: First time, asking permission`);
        context.currentPhase = 'digging_deeper';
        return 'digging_deeper_start';
      }
    }
    return 'check_if_still_problem';
  }

  private handleBlockageStepE(lastResponse: string, context: TreatmentContext): string {
    const stepENoProblemIndicators = ['no problem', 'nothing', 'none', 'gone', 'resolved', 'fine', 'good', 'better', 'clear'];
    const stepESeemsResolved = stepENoProblemIndicators.some(indicator => lastResponse.includes(indicator)) ||
      (lastResponse.trim() === 'no') ||
      (lastResponse.trim() === 'not') ||
      (lastResponse.trim() === 'no problem') ||
      (lastResponse.startsWith('no ') && lastResponse.length < 15) ||
      (lastResponse.startsWith('not ') && lastResponse.length < 15);

    if (stepESeemsResolved) {
      // Problem seems resolved - check if we're returning from a sub-problem or this is first completion
      console.log(`🔍 BLOCKAGE_STEP_E: Problem resolved (response: "${lastResponse}"), checking dig deeper context`);
      const alreadyGrantedPermission = context.userResponses['digging_deeper_start'] === 'yes';
      const returnStep = context.metadata?.returnToDiggingStep;

      if (alreadyGrantedPermission && returnStep) {
        // Permission already granted and we're returning from a sub-problem - skip permission, continue digging
        console.log(`🔍 BLOCKAGE_STEP_E: Permission already granted, returning to ${returnStep}`);
        context.currentPhase = 'digging_deeper';
        context.metadata.returnToDiggingStep = undefined; // Clear now that we're returning
        return returnStep;
      } else if (alreadyGrantedPermission) {
        // Permission already granted - skip permission, go to appropriate digging question
        console.log(`🔍 BLOCKAGE_STEP_E: Permission already granted, checking for trauma digging context`);
        context.currentPhase = 'digging_deeper';
        // Check if we're in trauma shifting context
        if (context.metadata?.selectedMethod === 'trauma_shifting' || context.metadata?.diggingType === 'trauma') {
          console.log(`🔍 BLOCKAGE_STEP_E: Returning to trauma_dig_deeper`);
          return 'trauma_dig_deeper';
        } else {
          console.log(`🔍 BLOCKAGE_STEP_E: Returning to future_problem_check`);
          return 'future_problem_check';
        }
      } else {
        // First time - ask permission
        console.log(`🔍 BLOCKAGE_STEP_E: First time, asking permission via digging_deeper_start`);
        context.currentPhase = 'digging_deeper';
        return 'digging_deeper_start';
      }
    } else {
      // Still a problem - update problem statement and cycle back to step A
      const newProblem = context.userResponses[context.currentStep] || lastResponse;
      if (newProblem) {
        this.updateProblemStatement(context, newProblem);
        context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
        context.metadata.skipIntroInstructions = true; // Skip intro when cycling back
        console.log(`🔍 BLOCKAGE_STEP_E: Updated problem to "${newProblem}", cycling back to blockage_shifting_intro`);
      }
      return this.getIntroStepForMethod('blockage_shifting', context);
    }
  }

  private handleBlockageCheckIfStillProblem(lastResponse: string, context: TreatmentContext): string {
    // Core cycling logic for Blockage Shifting
    // Check if the response indicates no problem left
    const noProblemIndicators = ['no problem', 'nothing', 'none', 'gone', 'resolved', 'fine', 'good', 'better', 'clear'];
    const seemsResolved = noProblemIndicators.some(indicator => lastResponse.includes(indicator)) ||
      // Check for standalone "no" or "not" responses (not part of problem descriptions)
      (lastResponse.trim() === 'no') ||
      (lastResponse.trim() === 'not') ||
      (lastResponse.trim() === 'no problem') ||
      (lastResponse.startsWith('no ') && lastResponse.length < 15) || // Short "no" responses
      (lastResponse.startsWith('not ') && lastResponse.length < 15);  // Short "not" responses
    console.log(`🔍 BLOCKAGE_CHECK: lastResponse="${lastResponse}", seemsResolved=${seemsResolved}, noProblemIndicators matched:`, noProblemIndicators.filter(indicator => lastResponse.includes(indicator)));

    // Check if user is responding to dig deeper question with yes/no
    const isDigDeeperResponse = lastResponse.includes('yes') || lastResponse.includes('no');

    if (isDigDeeperResponse) {
      // User is responding to "Would you like to dig deeper in this area?"
      console.log(`🔍 BLOCKAGE_CHECK_DIG_DEEPER: User responded ${lastResponse} to dig deeper question`);
      context.currentPhase = 'digging_deeper';
      return 'digging_deeper_start';
    } else if (seemsResolved) {
      // Problem seems resolved - check if we've already asked permission to dig deeper
      console.log(`🔍 BLOCKAGE_CHECK_RESOLVED: Problem resolved, transitioning to dig deeper`);
      const alreadyGrantedPermission = context.userResponses['digging_deeper_start'] === 'yes';
      const returnStep = context.metadata?.returnToDiggingStep;

      if (alreadyGrantedPermission && returnStep) {
        // Permission already granted and we're returning from a sub-problem - skip permission, continue digging
        console.log(`🔍 BLOCKAGE_CHECK_RESOLVED: Permission already granted, returning to ${returnStep}`);
        context.currentPhase = 'digging_deeper';
        context.metadata.returnToDiggingStep = undefined; // Clear now that we're returning
        return returnStep;
      } else if (alreadyGrantedPermission) {
        // Permission already granted - skip permission, go to future_problem_check to continue digging
        console.log(`🔍 BLOCKAGE_CHECK_RESOLVED: Permission already granted, going to future_problem_check`);
        context.currentPhase = 'digging_deeper';
        return 'future_problem_check';
      } else {
        // First time - ask permission
        console.log(`🔍 BLOCKAGE_CHECK_RESOLVED: First time, asking permission`);
        context.currentPhase = 'digging_deeper';
        return 'digging_deeper_start';
      }
    } else {
      // Still a problem - cycle back to step A (blockage_shifting_intro)
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      context.metadata.skipIntroInstructions = true; // Skip intro when cycling back
      // Don't update the problem statement when cycling back from yes/no response
      // Keep the original problem statement intact
      return this.getIntroStepForMethod('blockage_shifting', context);
    }
  }

  private handleIdentityShiftingIntro(context: TreatmentContext): string {
    if (context.metadata.identityResponse && context.metadata.identityResponse.type === 'IDENTITY') {
      return 'identity_dissolve_step_a';
    } else {
      return this.getIntroStepForMethod('identity_shifting', context);
    }
  }

  private handleIdentityDissolveStepF(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('no') || lastResponse.includes('2')) {
      return 'identity_future_check';
    } else if (lastResponse.includes('yes') || lastResponse.includes('1')) {
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      return 'identity_dissolve_step_a';
    }
    return 'identity_future_check';
  }

  private handleIdentityFutureCheck(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes') || lastResponse.includes('1')) {
      // YES - identity not cleared, go back to Step 3 (Shifting) per flowchart
      console.log(`🔍 IDENTITY_FUTURE_CHECK: User said YES, going back to shifting steps`);
      // Set flag to indicate we're returning from future check (both for context-specific phrasing and to remember which check failed)
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      context.metadata.returnToIdentityCheck = 'identity_future_check';
      context.metadata.identityBridgePhraseUsed = false;
      return 'identity_dissolve_step_a';  // NOT identity_problem_check!
    } else if (lastResponse.includes('no') || lastResponse.includes('2')) {
      // NO - this check passed, clear return marker and proceed to scenario check
      console.log(`🔍 IDENTITY_FUTURE_CHECK: User said NO, proceeding to scenario check`);
      context.metadata.returnToIdentityCheck = undefined;
      context.metadata.identityBridgePhraseUsed = false;
      return 'identity_scenario_check';
    }
    // Default to scenario check
    console.log(`🔍 IDENTITY_FUTURE_CHECK: Unclear response, proceeding to scenario check`);
    return 'identity_scenario_check';
  }

  private handleIdentityScenarioCheck(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes') || lastResponse.includes('1')) {
      // YES - identity not cleared, go back to Step 3 (Shifting) per flowchart
      console.log(`🔍 IDENTITY_SCENARIO_CHECK: User said YES, going back to shifting steps`);
      // Set flag to indicate we're returning from scenario check (both for context-specific phrasing and to remember which check failed)
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      context.metadata.returnToIdentityCheck = 'identity_scenario_check';
      context.metadata.identityBridgePhraseUsed = false;
      return 'identity_dissolve_step_a';  // NOT identity_problem_check!
    } else if (lastResponse.includes('no') || lastResponse.includes('2')) {
      // NO - both checks passed, clear return marker and proceed to Step 5 (Check Problem)
      console.log(`🔍 IDENTITY_SCENARIO_CHECK: User said NO, both checks passed - proceeding to problem check`);
      context.metadata.returnToIdentityCheck = undefined;
      context.metadata.identityBridgePhraseUsed = false;
      return 'identity_problem_check';  // NOT integration_awareness_1!
    }
    // Default: treat unclear as needing more work, go back to shifting
    console.log(`🔍 IDENTITY_SCENARIO_CHECK: Unclear response, going back to shifting steps`);
    context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
    return 'identity_dissolve_step_a';  // NOT identity_problem_check!
  }

  private handleIdentityCheck(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes') || lastResponse.includes('still')) {
      // Still feeling identity - repeat step 3 (go back to step A)
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      return 'identity_dissolve_step_a';
    }
    if (lastResponse.includes('no') || lastResponse.includes('not')) {
      // No longer feeling identity - proceed to problem check
      console.log(`🔍 IDENTITY_CHECK: Identity dissolved, proceeding to problem check`);
      return 'identity_problem_check';  // NOT identity_future_check!
    }
    return 'identity_problem_check';  // Default: assume dissolved
  }

  private handleIdentityProblemCheck(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes') || lastResponse.includes('still')) {
      // Still a problem - route to digging deeper method selection flow
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      context.currentPhase = 'digging_deeper';
      console.log(`🔍 IDENTITY_PROBLEM_CHECK: Problem still exists, routing to digging deeper flow`);
      return 'restate_problem_future';  // NOT restate_identity_problem!
    }
    if (lastResponse.includes('no') || lastResponse.includes('not')) {
      // No longer a problem - check if we've already asked permission to dig deeper
      const alreadyGrantedPermission = context.userResponses['digging_deeper_start'] === 'yes';
      const returnStep = context.metadata?.returnToDiggingStep;

      if (alreadyGrantedPermission && returnStep) {
        // Permission already granted and we're returning from a sub-problem - skip permission, continue digging
        context.currentPhase = 'digging_deeper';
        context.metadata.returnToDiggingStep = undefined; // Clear now that we're returning
        return returnStep;
      } else if (alreadyGrantedPermission) {
        // Permission already granted - skip permission, go to future_problem_check to continue digging
        context.currentPhase = 'digging_deeper';
        return 'future_problem_check';
      } else {
        // First time - ask permission
        context.currentPhase = 'digging_deeper';
        return 'digging_deeper_start';
      }
    }
    return 'identity_problem_check';
  }

  private handleConfirmIdentityProblem(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes')) {
      context.currentPhase = 'identity_shifting';
      return this.getIntroStepForMethod('identity_shifting', context);
    }
    if (lastResponse.includes('no')) {
      return 'restate_identity_problem';
    }
    return 'confirm_identity_problem';
  }

  private handleBeliefStepF(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes') || lastResponse.includes('still')) {
      // Still believes - cycle back to step A (keep returnToBeliefCheck so we remember which check question to return to)
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      return 'belief_step_a';
    }
    if (lastResponse.includes('no') || lastResponse.includes('not')) {
      // No longer believes - check if we need to return to a specific check question
      const returnToCheck = context.metadata.returnToBeliefCheck;
      if (returnToCheck) {
        // Return to the check question we came from
        return returnToCheck;
      }
      // First time through - proceed to belief checking questions
      return 'belief_check_1';
    }
    return 'belief_check_1';
  }

  private handleBeliefChecks(stepId: string, lastResponse: string, context: TreatmentContext): string {
    if (stepId === 'belief_check_1') {
      // First check question - "Does any part of you still believe [belief]?"
      if (lastResponse.includes('yes') || lastResponse.includes('still')) {
        // Still believes - cycle back to step A and remember to return here
        context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
        context.metadata.returnToBeliefCheck = 'belief_check_1';
        return 'belief_step_a';
      }
      if (lastResponse.includes('no') || lastResponse.includes('not')) {
        // No longer believes - clear return marker and proceed to next belief check
        context.metadata.returnToBeliefCheck = undefined;
        return 'belief_check_2';
      }
      return 'belief_check_1'; // Stay on step if unclear response
    } else if (stepId === 'belief_check_2') {
      // Future check question - "Do you feel you may believe [belief] again in the future?"
      if (lastResponse.includes('yes') || lastResponse.includes('might') || lastResponse.includes('could')) {
        // Still might believe it - cycle back to step A and remember to return here
        console.log(`🔍 BELIEF_CHECK_2: User said YES, cycling back to belief_step_a`);
        context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
        context.metadata.returnToBeliefCheck = 'belief_check_2';
        return 'belief_step_a';
      }
      if (lastResponse.includes('no') || lastResponse.includes('not') || lastResponse.includes('never')) {
        // Won't believe it in future - clear return marker and proceed to scenario check
        context.metadata.returnToBeliefCheck = undefined;
        return 'belief_check_3';
      }
      return 'belief_check_2'; // Stay on step if unclear response
    } else if (stepId === 'belief_check_3') {
      // Scenario check question - "Is there any scenario in which you would still believe [belief]?"
      if (lastResponse.includes('yes')) {
        // Still might believe it in some scenario - cycle back to step A and remember to return here
        context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
        context.metadata.returnToBeliefCheck = 'belief_check_3';
        return 'belief_step_a';
      }
      if (lastResponse.includes('no') || lastResponse.includes('not')) {
        // Won't believe it in any scenario - clear return marker and proceed to next check
        context.metadata.returnToBeliefCheck = undefined;
        return 'belief_check_4';
      }
      return 'belief_check_3'; // Stay on step if unclear response
    } else if (stepId === 'belief_check_4') {
      // Knowledge check question - "Do you now know [opposite of belief]?"
      if (lastResponse.includes('no') || lastResponse.includes('not')) {
        // Don't know the opposite yet - cycle back to step A and remember to return here
        context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
        context.metadata.returnToBeliefCheck = 'belief_check_4';
        return 'belief_step_a';
      }
      if (lastResponse.includes('yes')) {
        // Know the opposite - clear return marker and proceed to problem check
        context.metadata.returnToBeliefCheck = undefined;
        return 'belief_problem_check';
      }
      return 'belief_check_4'; // Stay on step if unclear response
    }
    return 'belief_check_1';
  }

  private handleBeliefProblemCheck(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes') || lastResponse.includes('still')) {
      // Still a problem - route to digging deeper method selection flow
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      context.currentPhase = 'digging_deeper';
      console.log(`🔍 BELIEF_PROBLEM_CHECK: Problem still exists, routing to digging deeper flow`);
      return 'restate_problem_future';  // NOT restate_belief_problem!
    }
    if (lastResponse.includes('no') || lastResponse.includes('not')) {
      // No longer a problem - check if we've already asked permission to dig deeper
      const alreadyGrantedPermission = context.userResponses['digging_deeper_start'] === 'yes';
      const returnStep = context.metadata?.returnToDiggingStep;

      if (alreadyGrantedPermission && returnStep) {
        // Permission already granted and we're returning from a sub-problem - skip permission, continue digging
        context.currentPhase = 'digging_deeper';
        context.metadata.returnToDiggingStep = undefined; // Clear now that we're returning
        return returnStep;
      } else if (alreadyGrantedPermission) {
        // Permission already granted - skip permission, go to future_problem_check to continue digging
        context.currentPhase = 'digging_deeper';
        return 'future_problem_check';
      } else {
        // First time - ask permission
        context.currentPhase = 'digging_deeper';
        return 'digging_deeper_start';
      }
    }
    return 'belief_problem_check';
  }

  private handleConfirmBeliefProblem(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes')) {
      context.currentPhase = 'belief_shifting';
      return this.getIntroStepForMethod('belief_shifting', context);
    }
    if (lastResponse.includes('no')) {
      return 'restate_belief_problem';
    }
    return 'confirm_belief_problem';
  }

  private handleRealityWhyNotPossible(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.toLowerCase().includes('no reason') ||
      lastResponse.toLowerCase().includes('no') && lastResponse.toLowerCase().includes('reason') ||
      lastResponse.toLowerCase().includes('none') ||
      lastResponse.toLowerCase().includes('nothing')) {
      // User said "no reason" - check which checking question we came from
      const fromSecondCheck = context?.metadata?.fromSecondCheckingQuestion;
      if (fromSecondCheck) {
        // Came from second checking question - return there
        context.metadata.fromSecondCheckingQuestion = false;
        return 'reality_certainty_check';
      } else {
        // Came from first checking question - return there
        return 'reality_checking_questions';
      }
    }
    return 'reality_feel_reason';
  }

  private handleRealityCheckingQuestions(lastResponse: string, context: TreatmentContext): string {
    const certaintyMatch = lastResponse.match(/(\d+)%?/);
    const certaintyPercentage = certaintyMatch ? parseInt(certaintyMatch[1]) : 0;

    if (certaintyPercentage >= 100) {
      return 'reality_certainty_check';
    } else if (certaintyPercentage > 0) {
      context.metadata.doubtPercentage = 100 - certaintyPercentage;
      return 'reality_doubt_reason';
    }
    return 'reality_checking_questions';
  }

  private handleRealityCycleB4(context: TreatmentContext): string {
    const fromSecondCheck = context?.metadata?.fromSecondCheckingQuestion;
    if (fromSecondCheck) {
      context.metadata.fromSecondCheckingQuestion = false;
      return 'reality_certainty_check';
    } else {
      return 'reality_checking_questions';
    }
  }

  private handleRealityCertaintyCheck(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes')) {
      context.metadata.fromSecondCheckingQuestion = true;
      return 'reality_doubt_reason';
    }
    if (lastResponse.includes('no') || lastResponse.includes('not')) {
      return 'reality_integration_intro';
    }
    return 'reality_certainty_check';
  }

  private handleRealityIntegrationActionMore(lastResponse: string, context: TreatmentContext): string {
    // User answered what else needs to happen
    if (lastResponse.toLowerCase().includes('nothing') || lastResponse.toLowerCase().includes('no') || lastResponse.toLowerCase().includes('not')) {
      // User said nothing more needs to happen - check if we're in digging deeper flow
      const returnStep = context.metadata?.returnToDiggingStep;
      if (returnStep) {
        // We're clearing a problem from digging deeper - ALWAYS ask permission before continuing
        context.currentPhase = 'digging_deeper';
        // DON'T clear returnToDiggingStep yet - we need it to know where to return
        return 'digging_deeper_start';
      } else {
        // Regular flow - complete session, move to integration phase
        context.currentPhase = 'integration';
        return 'session_complete';
      }
    } else {
      // User gave another action - keep asking what else
      return 'reality_integration_action_more';
    }
  }

  private handleTraumaShiftingIntro(lastResponse: string): string {
    if (lastResponse.includes('yes') || lastResponse.includes('y')) {
      return 'trauma_identity_step_static';
    }
    if (lastResponse.includes('no') || lastResponse.includes('n')) {
      return 'trauma_problem_redirect';
    }
    return 'trauma_shifting_intro';
  }

  private handleTraumaProblemRedirect(lastResponse: string, context: TreatmentContext): string {
    // User answered how they feel about the fact it happened - construct problem statement
    const feeling = lastResponse || 'this way';
    const traumaDescription = context.userResponses['negative_experience_description'] ||
      context.metadata.originalProblemStatement ||
      'that happened';

    // Construct the full problem statement: "I feel [feeling] that [trauma] happened"
    const constructedProblem = `I feel ${feeling} that ${traumaDescription} happened`;
    console.log(`🔧 TRAUMA_REDIRECT: Constructed problem statement: "${constructedProblem}"`);

    // Store the constructed problem statement
    context.problemStatement = constructedProblem;
    context.metadata.problemStatement = constructedProblem;
    // PRODUCTION FIX: ALWAYS set originalProblemStatement to the constructed problem
    // When user declines trauma process, this constructed problem IS their original problem
    // This ensures digging deeper references the correct problem, not just the trauma descriptor
    context.metadata.originalProblemStatement = constructedProblem;

    // Set to problem work type for method selection later
    context.metadata.workType = 'problem';
    context.metadata.selectedMethod = undefined; // Reset method selection
    context.currentPhase = 'work_type_selection';  // NOT method_selection!

    // Route to confirm_statement to get user confirmation
    return 'confirm_statement';  // NOT choose_method!
  }

  private handleTraumaIdentityCheck(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes') || lastResponse.includes('still')) {
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      return 'trauma_dissolve_step_a';
    }
    if (lastResponse.includes('no') || lastResponse.includes('not')) {
      return 'trauma_future_identity_check';
    }
    return 'trauma_future_identity_check';
  }

  private handleTraumaFutureIdentityCheck(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes') || lastResponse.includes('might') || lastResponse.includes('could')) {
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      return 'trauma_dissolve_step_c';
    }
    if (lastResponse.includes('no') || lastResponse.includes('not') || lastResponse.includes('never')) {
      return 'trauma_future_scenario_check';
    }
    return 'trauma_future_scenario_check';
  }

  private handleTraumaFutureScenarioCheck(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes') || lastResponse.includes('might') || lastResponse.includes('could')) {
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      return 'trauma_dissolve_step_c';
    }
    if (lastResponse.includes('no') || lastResponse.includes('not') || lastResponse.includes('never')) {
      return 'trauma_experience_check';
    }
    return 'trauma_experience_check';
  }

  private handleTraumaExperienceCheck(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes') || lastResponse.includes('still')) {
      // Still a problem - repeat Steps 3-5 (skip intro, they already answered that)
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;

      // Clear previous iteration responses to prevent cached identity/feelings
      delete context.userResponses['trauma_identity_step_static'];
      delete context.userResponses['trauma_dissolve_step_a'];
      delete context.userResponses['trauma_dissolve_step_b'];
      delete context.userResponses['trauma_dissolve_step_c'];
      delete context.userResponses['trauma_dissolve_step_d'];
      delete context.userResponses['trauma_dissolve_step_e'];
      console.log(`🔄 TRAUMA_EXPERIENCE_CYCLE: Starting iteration ${context.metadata.cycleCount}, cleared previous identity and dissolve responses`);

      // Persist the cleared responses to database
      this.saveContextToDatabase(context).catch(error =>
        console.error('Failed to save cleared trauma responses to database:', error)
      );

      return 'trauma_identity_step_static';
    }
    if (lastResponse.includes('no') || lastResponse.includes('not')) {
      // No longer a problem - check if we've already asked permission to dig deeper
      const alreadyGrantedPermission = context.userResponses['digging_deeper_start'] === 'yes';
      const returnStep = context.metadata?.returnToDiggingStep;

      if (alreadyGrantedPermission && returnStep) {
        // Permission already granted and we're returning from a sub-problem - skip permission, continue digging
        context.currentPhase = 'digging_deeper';
        context.metadata.returnToDiggingStep = undefined; // Clear now that we're returning
        return returnStep;
      } else if (alreadyGrantedPermission) {
        // Permission already granted but first trauma completion - skip permission, start digging questions
        context.currentPhase = 'digging_deeper';
        return 'trauma_dig_deeper';
      } else {
        // First time - ask permission, then route to trauma-specific digging questions
        context.currentPhase = 'digging_deeper';
        context.metadata.diggingType = 'trauma'; // Flag for digging_deeper_start to route to trauma_dig_deeper
        return 'digging_deeper_start';
      }
    }
    return 'trauma_experience_check';
  }

  private handleTraumaDigDeeper2(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes')) {
      context.currentPhase = 'discovery';
      return 'restate_selected_problem';
    }
    if (lastResponse.includes('no') || lastResponse.includes('not')) {
      const returnStep = context.metadata?.returnToDiggingStep;
      if (returnStep) {
        context.currentPhase = 'digging_deeper';
        context.metadata.returnToDiggingStep = undefined;
        return returnStep;
      } else {
        context.currentPhase = 'integration';
        return 'integration_start';
      }
    }
    return 'trauma_dig_deeper_2';
  }

  private handleDiggingDeeperStart(lastResponse: string, context: TreatmentContext): string {
    context.currentPhase = 'digging_deeper';

    if (lastResponse.includes('yes')) {
      return 'future_problem_check';
    }
    if (lastResponse.includes('no')) {
      context.currentPhase = 'integration';
      return 'integration_start';
    }
    return 'digging_deeper_start';
  }

  private handleFutureProblemCheck(lastResponse: string): string {
    if (lastResponse.includes('yes') || lastResponse.includes('maybe')) {
      return 'restate_problem_future';
    }
    if (lastResponse.includes('no')) {
      return 'scenario_check_1';
    }
    return 'future_problem_check';
  }

  private handleRestateProblemFuture(lastResponse: string, context: TreatmentContext): string {
    // After restating the problem, update problem statement BEFORE routing to choose_method
    const newProblemFromRestate = context.userResponses?.['restate_problem_future'];
    if (newProblemFromRestate && newProblemFromRestate.trim()) {
      const newProblem = newProblemFromRestate.trim();
      context.metadata.currentDiggingProblem = newProblem;
      context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 1) + 1;

      // PRODUCTION FIX: Don't overwrite returnToDiggingStep if already set to a trauma step
      // This preserves the correct return point for trauma's two-question flow
      if (!context.metadata.returnToDiggingStep ||
        context.metadata.returnToDiggingStep === 'future_problem_check') {
        context.metadata.returnToDiggingStep = 'future_problem_check';
      }
      // else: Keep existing returnToDiggingStep (e.g., trauma_dig_deeper_2)

      context.problemStatement = newProblem;
      context.metadata.workType = 'problem';
      console.log(`🔍 RESTATE_PROBLEM_FUTURE: Updated problem to "${newProblem}" before routing to choose_method`);
    }
    // Set flag so choose_method handler knows to use digging deeper routing logic
    context.metadata.isDiggingDeeperMethodSelection = true;
    context.currentPhase = 'method_selection';  // Frontend recognizes this phase and shows buttons
    return 'choose_method';
  }

  private handleDiggingMethodSelection(lastResponse: string, context: TreatmentContext): string {
    // BUGFIX: Read from lastResponse (user input) directly, not from metadata.selectedMethod
    // because scriptedResponse runs AFTER getNextStep, so metadata isn't set yet
    const input = lastResponse.toLowerCase();
    let diggingSelectedMethod = '';

    if (input.includes('problem shifting') || input === '1') {
      diggingSelectedMethod = 'problem_shifting';
    } else if (input.includes('identity shifting') || input === '2') {
      diggingSelectedMethod = 'identity_shifting';
    } else if (input.includes('belief shifting') || input === '3') {
      diggingSelectedMethod = 'belief_shifting';
    } else if (input.includes('blockage shifting') || input === '4') {
      diggingSelectedMethod = 'blockage_shifting';
    }

    // Update problem statement to use the new problem from digging deeper flow
    // Check ALL 8 possible sources in correct priority order
    const newProblemFromUserResponse = context.userResponses?.['restate_problem_future'] ||
      context.userResponses?.['restate_scenario_problem_1'] ||
      context.userResponses?.['restate_scenario_problem_2'] ||
      context.userResponses?.['restate_scenario_problem_3'] ||
      context.userResponses?.['restate_anything_else_problem_1'] ||
      context.userResponses?.['restate_anything_else_problem_2'];
    // CRITICAL FIX: Prioritize currentDiggingProblem (set by previous step) over userResponses (which may contain stale data from earlier iterations)
    const newDiggingProblem = context.metadata?.currentDiggingProblem || context.metadata?.newDiggingProblem || newProblemFromUserResponse;

    if (newDiggingProblem) {
      context.problemStatement = newDiggingProblem;
      context.metadata.currentDiggingProblem = newDiggingProblem;
      console.log(`🔍 DIGGING_METHOD_SELECTION_ROUTE: Using problem: "${newDiggingProblem}"`);
    } else {
      console.error(`❌ DIGGING_METHOD_SELECTION_ROUTE: NO PROBLEM FOUND! This will cause routing to fail!`);
    }

    // Clear previous modality-specific metadata to ensure clean switch
    this.clearPreviousModalityMetadata(context);

    // Store the selected method in metadata for reference
    context.metadata.selectedMethod = diggingSelectedMethod;

    if (diggingSelectedMethod === 'problem_shifting') {
      context.currentPhase = 'problem_shifting';
      context.metadata.workType = 'problem'; // Ensure correct work type for problem shifting
      console.log(`🔍 MODALITY_SWITCH: Switched to Problem Shifting with problem: "${newDiggingProblem}"`);
      console.log(`🔍 MODALITY_SWITCH: Phase set to: "${context.currentPhase}", using getIntroStepForMethod`);
      return this.getIntroStepForMethod('problem_shifting', context);
    } else if (diggingSelectedMethod === 'identity_shifting') {
      context.currentPhase = 'identity_shifting';
      context.metadata.workType = 'problem'; // Identity shifting also works with problems in digging deeper
      console.log(`🔍 MODALITY_SWITCH: Switched to Identity Shifting with problem: "${newDiggingProblem}"`);
      return this.getIntroStepForMethod('identity_shifting', context);
    } else if (diggingSelectedMethod === 'belief_shifting') {
      context.currentPhase = 'belief_shifting';
      context.metadata.workType = 'problem'; // Belief shifting also works with problems in digging deeper
      console.log(`🔍 MODALITY_SWITCH: Switched to Belief Shifting with problem: "${newDiggingProblem}"`);
      return this.getIntroStepForMethod('belief_shifting', context);
    } else if (diggingSelectedMethod === 'blockage_shifting') {
      context.currentPhase = 'blockage_shifting';
      context.metadata.workType = 'problem'; // Blockage shifting also works with problems in digging deeper
      console.log(`🔍 MODALITY_SWITCH: Switched to Blockage Shifting with problem: "${newDiggingProblem}"`);
      return this.getIntroStepForMethod('blockage_shifting', context);
    }
    // Default fallback
    context.currentPhase = 'problem_shifting';
    context.metadata.workType = 'problem';
    console.log(`🔍 MODALITY_SWITCH: Defaulted to Problem Shifting with problem: "${newDiggingProblem}"`);
    return this.getIntroStepForMethod('problem_shifting', context);
  }

  private handleScenarioCheck(lastResponse: string, restateStep: string, noStep: string): string {
    if (lastResponse.includes('yes')) {
      return restateStep;
    }
    if (lastResponse.includes('no')) {
      return noStep;
    }
    return restateStep;
  }

  private handleClearScenarioProblem1(lastResponse: string, context: TreatmentContext): string {
    // User selected a method - route directly to that method
    const scenario1Input = lastResponse.toLowerCase();
    const scenario1Problem = context.userResponses?.['restate_scenario_problem_1'];

    if (scenario1Problem) {
      context.problemStatement = scenario1Problem;
      context.metadata.currentDiggingProblem = scenario1Problem;
      console.log(`🔍 SCENARIO_1_ROUTE: Using problem: "${scenario1Problem}"`);
    }

    // PRODUCTION FIX: Set return point for nested digging deeper
    // After clearing this nested problem, return to this same question
    context.metadata.returnToDiggingStep = 'scenario_check_1';

    this.clearPreviousModalityMetadata(context);

    if (scenario1Input.includes('problem shifting') || scenario1Input === '1') {
      context.currentPhase = 'problem_shifting';
      context.metadata.selectedMethod = 'problem_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 SCENARIO_1_ROUTE: Routing to Problem Shifting (will skip intro)`);
      return this.getIntroStepForMethod('problem_shifting', context);
    } else if (scenario1Input.includes('identity shifting') || scenario1Input === '2') {
      context.currentPhase = 'identity_shifting';
      context.metadata.selectedMethod = 'identity_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 SCENARIO_1_ROUTE: Routing to Identity Shifting (will skip intro)`);
      return this.getIntroStepForMethod('identity_shifting', context);
    } else if (scenario1Input.includes('belief shifting') || scenario1Input === '3') {
      context.currentPhase = 'belief_shifting';
      context.metadata.selectedMethod = 'belief_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 SCENARIO_1_ROUTE: Routing to Belief Shifting (will skip intro)`);
      return this.getIntroStepForMethod('belief_shifting', context);
    } else if (scenario1Input.includes('blockage shifting') || scenario1Input === '4') {
      context.currentPhase = 'blockage_shifting';
      context.metadata.selectedMethod = 'blockage_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 SCENARIO_1_ROUTE: Routing to Blockage Shifting (will skip intro)`);
      return this.getIntroStepForMethod('blockage_shifting', context);
    }
    // Default to problem shifting if unclear
    context.currentPhase = 'problem_shifting';
    context.metadata.workType = 'problem';
    return this.getIntroStepForMethod('problem_shifting', context);
  }

  private handleClearScenarioProblem2(lastResponse: string, context: TreatmentContext): string {
    // User selected a method - route directly to that method
    const scenario2Input = lastResponse.toLowerCase();
    const scenario2Problem = context.userResponses?.['restate_scenario_problem_2'];

    if (scenario2Problem) {
      context.problemStatement = scenario2Problem;
      context.metadata.currentDiggingProblem = scenario2Problem;
      console.log(`🔍 SCENARIO_2_ROUTE: Using problem: "${scenario2Problem}"`);
    }

    // PRODUCTION FIX: Set return point for nested digging deeper
    context.metadata.returnToDiggingStep = 'scenario_check_2';

    this.clearPreviousModalityMetadata(context);

    if (scenario2Input.includes('problem shifting') || scenario2Input === '1') {
      context.currentPhase = 'problem_shifting';
      context.metadata.selectedMethod = 'problem_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 SCENARIO_2_ROUTE: Routing to Problem Shifting (will skip intro)`);
      return this.getIntroStepForMethod('problem_shifting', context);
    } else if (scenario2Input.includes('identity shifting') || scenario2Input === '2') {
      context.currentPhase = 'identity_shifting';
      context.metadata.selectedMethod = 'identity_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 SCENARIO_2_ROUTE: Routing to Identity Shifting (will skip intro)`);
      return this.getIntroStepForMethod('identity_shifting', context);
    } else if (scenario2Input.includes('belief shifting') || scenario2Input === '3') {
      context.currentPhase = 'belief_shifting';
      context.metadata.selectedMethod = 'belief_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 SCENARIO_2_ROUTE: Routing to Belief Shifting (will skip intro)`);
      return this.getIntroStepForMethod('belief_shifting', context);
    } else if (scenario2Input.includes('blockage shifting') || scenario2Input === '4') {
      context.currentPhase = 'blockage_shifting';
      context.metadata.selectedMethod = 'blockage_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 SCENARIO_2_ROUTE: Routing to Blockage Shifting (will skip intro)`);
      return this.getIntroStepForMethod('blockage_shifting', context);
    }
    // Default to problem shifting if unclear
    context.currentPhase = 'problem_shifting';
    context.metadata.workType = 'problem';
    return this.getIntroStepForMethod('problem_shifting', context);
  }

  private handleClearScenarioProblem3(lastResponse: string, context: TreatmentContext): string {
    // User selected a method - route directly to that method
    const scenario3Input = lastResponse.toLowerCase();
    const scenario3Problem = context.userResponses?.['restate_scenario_problem_3'];

    if (scenario3Problem) {
      context.problemStatement = scenario3Problem;
      context.metadata.currentDiggingProblem = scenario3Problem;
      console.log(`🔍 SCENARIO_3_ROUTE: Using problem: "${scenario3Problem}"`);
    }

    // PRODUCTION FIX: Set return point for nested digging deeper
    context.metadata.returnToDiggingStep = 'scenario_check_3';

    this.clearPreviousModalityMetadata(context);

    if (scenario3Input.includes('problem shifting') || scenario3Input === '1') {
      context.currentPhase = 'problem_shifting';
      context.metadata.selectedMethod = 'problem_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 SCENARIO_3_ROUTE: Routing to Problem Shifting (will skip intro)`);
      return this.getIntroStepForMethod('problem_shifting', context);
    } else if (scenario3Input.includes('identity shifting') || scenario3Input === '2') {
      context.currentPhase = 'identity_shifting';
      context.metadata.selectedMethod = 'identity_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 SCENARIO_3_ROUTE: Routing to Identity Shifting (will skip intro)`);
      return this.getIntroStepForMethod('identity_shifting', context);
    } else if (scenario3Input.includes('belief shifting') || scenario3Input === '3') {
      context.currentPhase = 'belief_shifting';
      context.metadata.selectedMethod = 'belief_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 SCENARIO_3_ROUTE: Routing to Belief Shifting (will skip intro)`);
      return this.getIntroStepForMethod('belief_shifting', context);
    } else if (scenario3Input.includes('blockage shifting') || scenario3Input === '4') {
      context.currentPhase = 'blockage_shifting';
      context.metadata.selectedMethod = 'blockage_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 SCENARIO_3_ROUTE: Routing to Blockage Shifting (will skip intro)`);
      return this.getIntroStepForMethod('blockage_shifting', context);
    }
    // Default to problem shifting if unclear
    context.currentPhase = 'problem_shifting';
    context.metadata.workType = 'problem';
    return this.getIntroStepForMethod('problem_shifting', context);
  }

  private handleAnythingElseCheck(lastResponse: string, context: TreatmentContext, restateStep: string): string {
    if (lastResponse.includes('yes')) {
      return restateStep;
    }
    if (lastResponse.includes('no')) {
      context.metadata.multipleProblems = true;
      context.currentPhase = 'integration';
      return 'integration_start';
    }
    return restateStep;
  }

  private handleRestateAnythingElseProblem1(context: TreatmentContext): string {
    // Setup metadata for the new problem and route to method selection
    const anythingElseProblem = context.userResponses?.['restate_anything_else_problem_1'];
    if (anythingElseProblem) {
      context.problemStatement = anythingElseProblem;
      context.metadata.currentDiggingProblem = anythingElseProblem;
      context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 5) + 1;
      context.metadata.returnToDiggingStep = 'anything_else_check_1';
      context.metadata.workType = 'problem';
      // Keep originalProblemStatement intact - it should always refer to PROBLEM 1
      console.log(`🔍 ANYTHING_ELSE_1: Stored problem "${anythingElseProblem}", routing to method selection`);
    }
    this.clearPreviousModalityMetadata(context);
    return 'digging_method_selection';
  }

  private handleClearAnythingElseProblem1(lastResponse: string, context: TreatmentContext): string {
    // User selected a method - route directly to that method
    const anythingElse1Input = lastResponse.toLowerCase();
    const anythingElse1Problem = context.userResponses?.['restate_anything_else_problem_1'];

    if (anythingElse1Problem) {
      context.problemStatement = anythingElse1Problem;
      context.metadata.currentDiggingProblem = anythingElse1Problem;
      // Keep originalProblemStatement intact - it should always refer to PROBLEM 1
      console.log(`🔍 ANYTHING_ELSE_1_ROUTE: Using problem: "${anythingElse1Problem}"`);
    }

    // PRODUCTION FIX: Set return point for nested digging deeper
    // After clearing this nested problem, return to this same question
    context.metadata.returnToDiggingStep = 'anything_else_check_1';

    this.clearPreviousModalityMetadata(context);

    if (anythingElse1Input.includes('problem shifting') || anythingElse1Input === '1') {
      context.currentPhase = 'problem_shifting';
      context.metadata.selectedMethod = 'problem_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 ANYTHING_ELSE_1_ROUTE: Routing to Problem Shifting (will skip intro)`);
      return this.getIntroStepForMethod('problem_shifting', context);
    } else if (anythingElse1Input.includes('identity shifting') || anythingElse1Input === '2') {
      context.currentPhase = 'identity_shifting';
      context.metadata.selectedMethod = 'identity_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 ANYTHING_ELSE_1_ROUTE: Routing to Identity Shifting (will skip intro)`);
      return this.getIntroStepForMethod('identity_shifting', context);
    } else if (anythingElse1Input.includes('belief shifting') || anythingElse1Input === '3') {
      context.currentPhase = 'belief_shifting';
      context.metadata.selectedMethod = 'belief_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 ANYTHING_ELSE_1_ROUTE: Routing to Belief Shifting (will skip intro)`);
      return this.getIntroStepForMethod('belief_shifting', context);
    } else if (anythingElse1Input.includes('blockage shifting') || anythingElse1Input === '4') {
      context.currentPhase = 'blockage_shifting';
      context.metadata.selectedMethod = 'blockage_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 ANYTHING_ELSE_1_ROUTE: Routing to Blockage Shifting (will skip intro)`);
      return this.getIntroStepForMethod('blockage_shifting', context);
    }
    // Default to problem shifting if unclear
    context.currentPhase = 'problem_shifting';
    context.metadata.workType = 'problem';
    console.log(`🔍 ANYTHING_ELSE_1_ROUTE: Defaulted to Problem Shifting (will skip intro)`);
    return this.getIntroStepForMethod('problem_shifting', context);
  }

  private handleRestateAnythingElseProblem2(context: TreatmentContext): string {
    // Setup metadata for the new problem and route to method selection
    const anythingElseProblem2 = context.userResponses?.['restate_anything_else_problem_2'];
    if (anythingElseProblem2) {
      context.problemStatement = anythingElseProblem2;
      context.metadata.currentDiggingProblem = anythingElseProblem2;
      context.metadata.diggingProblemNumber = (context.metadata.diggingProblemNumber || 6) + 1;
      context.metadata.returnToDiggingStep = 'anything_else_check_2';
      context.metadata.workType = 'problem';
      // Keep originalProblemStatement intact - it should always refer to PROBLEM 1
      console.log(`🔍 ANYTHING_ELSE_2: Stored problem "${anythingElseProblem2}", routing to method selection`);
    }
    this.clearPreviousModalityMetadata(context);
    return 'digging_method_selection';
  }

  private handleClearAnythingElseProblem2(lastResponse: string, context: TreatmentContext): string {
    // User selected a method - route directly to that method
    const anythingElse2Input = lastResponse.toLowerCase();
    const anythingElse2Problem = context.userResponses?.['restate_anything_else_problem_2'];

    if (anythingElse2Problem) {
      context.problemStatement = anythingElse2Problem;
      context.metadata.currentDiggingProblem = anythingElse2Problem;
      // Keep originalProblemStatement intact - it should always refer to PROBLEM 1
      console.log(`🔍 ANYTHING_ELSE_2_ROUTE: Using problem: "${anythingElse2Problem}"`);
    }

    // PRODUCTION FIX: Set return point for nested digging deeper
    context.metadata.returnToDiggingStep = 'anything_else_check_2';

    this.clearPreviousModalityMetadata(context);

    if (anythingElse2Input.includes('problem shifting') || anythingElse2Input === '1') {
      context.currentPhase = 'problem_shifting';
      context.metadata.selectedMethod = 'problem_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 ANYTHING_ELSE_2_ROUTE: Routing to Problem Shifting (will skip intro)`);
      return this.getIntroStepForMethod('problem_shifting', context);
    } else if (anythingElse2Input.includes('identity shifting') || anythingElse2Input === '2') {
      context.currentPhase = 'identity_shifting';
      context.metadata.selectedMethod = 'identity_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 ANYTHING_ELSE_2_ROUTE: Routing to Identity Shifting (will skip intro)`);
      return this.getIntroStepForMethod('identity_shifting', context);
    } else if (anythingElse2Input.includes('belief shifting') || anythingElse2Input === '3') {
      context.currentPhase = 'belief_shifting';
      context.metadata.selectedMethod = 'belief_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 ANYTHING_ELSE_2_ROUTE: Routing to Belief Shifting (will skip intro)`);
      return this.getIntroStepForMethod('belief_shifting', context);
    } else if (anythingElse2Input.includes('blockage shifting') || anythingElse2Input === '4') {
      context.currentPhase = 'blockage_shifting';
      context.metadata.selectedMethod = 'blockage_shifting';
      context.metadata.workType = 'problem';
      console.log(`🔍 ANYTHING_ELSE_2_ROUTE: Routing to Blockage Shifting (will skip intro)`);
      return this.getIntroStepForMethod('blockage_shifting', context);
    }
    // Default to problem shifting if unclear
    context.currentPhase = 'problem_shifting';
    context.metadata.workType = 'problem';
    console.log(`🔍 ANYTHING_ELSE_2_ROUTE: Defaulted to Problem Shifting (will skip intro)`);
    return this.getIntroStepForMethod('problem_shifting', context);
  }

  private handleAnythingElseCheck3(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes')) {
      context.currentPhase = 'discovery';
      return 'restate_selected_problem';
    }
    if (lastResponse.includes('no')) {
      context.currentPhase = 'integration';
      return 'integration_start';
    }
    return 'anything_else_check_3';
  }

  private handleRouteToIntegration(context: TreatmentContext): string {
    // Route to appropriate integration based on selected method
    const selectedMethod = context.metadata.selectedMethod;

    if (selectedMethod === 'problem_shifting') {
      context.currentPhase = 'integration';
      return 'problem_integration_awareness_1';
    } else if (selectedMethod === 'identity_shifting') {
      context.currentPhase = 'integration';
      return 'integration_awareness_1';
    } else if (selectedMethod === 'belief_shifting') {
      context.currentPhase = 'integration';
      return 'belief_integration_awareness_1';
    } else if (selectedMethod === 'blockage_shifting') {
      context.currentPhase = 'integration';
      return 'blockage_integration_awareness_1';
    } else if (selectedMethod === 'trauma_shifting') {
      context.currentPhase = 'integration';
      return 'trauma_integration_awareness_1';
    } else if (selectedMethod === 'reality_shifting') {
      context.currentPhase = 'integration';
      return 'reality_integration_awareness_1';
    }

    // Default fallback
    context.currentPhase = 'integration';
    return 'integration_start';
  }

  private handleActionFollowup(lastResponse: string): string {
    if (lastResponse.includes('nothing') || lastResponse.includes('Nothing') ||
      lastResponse.toLowerCase().includes('nothing coming up') ||
      lastResponse.toLowerCase().includes('nothing else') ||
      lastResponse.toLowerCase().trim() === 'no' ||
      lastResponse.toLowerCase().includes('that\'s it') ||
      lastResponse.toLowerCase().includes('thats it')) {
      return 'one_thing_question';
    } else {
      return 'action_followup';
    }
  }
}
