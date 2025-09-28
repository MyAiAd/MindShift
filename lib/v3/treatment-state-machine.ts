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
      case 'mind_shifting_explanation':
        return this.handleMindShiftingExplanation(lastResponse, context);
        
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
        return this.handleConfirmStatement(lastResponse);
        
      case 'route_to_method':
        return this.handleRouteToMethod(context);
        
      case 'goal_deadline_check':
        return this.handleGoalDeadlineCheck(lastResponse);
        
      case 'goal_deadline_date':
        return 'goal_confirmation';
        
      case 'goal_confirmation':
        return this.handleGoalConfirmation(lastResponse);
        
      case 'goal_certainty':
        return 'reality_shifting_intro';
        
      // Problem Shifting routing
      case 'check_if_still_problem':
        return this.handleCheckIfStillProblem(lastResponse, context);
        
      // Blockage Shifting routing
      case 'blockage_step_e':
        return this.handleBlockageStepE(lastResponse, context);
        
      case 'blockage_check_if_still_problem':
        return this.handleBlockageCheckIfStillProblem(lastResponse, context);
        
      // Identity Shifting routing
      case 'identity_shifting_intro':
        return this.handleIdentityShiftingIntro(context);
        
      case 'identity_dissolve_step_f':
        return this.handleIdentityDissolveStepF(lastResponse, context);
        
      case 'identity_future_check':
        return this.handleIdentityFutureCheck(lastResponse);
        
      case 'identity_scenario_check':
        return this.handleIdentityScenarioCheck(lastResponse);
        
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
        return this.handleBeliefChecks(context.currentStep, lastResponse);
        
      case 'belief_check_4':
        return 'belief_problem_check';
        
      case 'belief_problem_check':
        return this.handleBeliefProblemCheck(lastResponse, context);
        
      case 'confirm_belief_problem':
        return this.handleConfirmBeliefProblem(lastResponse, context);
        
      // Reality Shifting routing
      case 'reality_why_not_possible':
        return this.handleRealityWhyNotPossible(lastResponse);
        
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
        return 'digging_method_selection';
        
      case 'digging_method_selection':
        return this.handleDiggingMethodSelection(lastResponse, context);
        
      case 'scenario_check_1':
        return this.handleScenarioCheck(lastResponse, 'restate_scenario_problem_1', 'anything_else_check_1');
        
      case 'restate_scenario_problem_1':
        return 'clear_scenario_problem_1';
        
      case 'clear_scenario_problem_1':
        return this.handleClearScenarioProblem(context, 'anything_else_check_1');
        
      case 'scenario_check_2':
        return this.handleScenarioCheck(lastResponse, 'restate_scenario_problem_2', 'scenario_check_3');
        
      case 'restate_scenario_problem_2':
        return 'clear_scenario_problem_2';
        
      case 'clear_scenario_problem_2':
        return this.handleClearScenarioProblem(context, 'scenario_check_3');
        
      case 'scenario_check_3':
        return this.handleScenarioCheck(lastResponse, 'restate_scenario_problem_3', 'anything_else_check_1');
        
      case 'restate_scenario_problem_3':
        return 'clear_scenario_problem_3';
        
      case 'clear_scenario_problem_3':
        return this.handleClearScenarioProblem(context, 'anything_else_check_1');
        
      case 'anything_else_check_1':
        return this.handleAnythingElseCheck(lastResponse, context, 'restate_anything_else_problem_1');
        
      case 'restate_anything_else_problem_1':
        return 'clear_anything_else_problem_1';
        
      case 'clear_anything_else_problem_1':
        return this.handleClearAnythingElseProblem(context, 'integration_start');
        
      case 'anything_else_check_2':
        return this.handleAnythingElseCheck(lastResponse, context, 'restate_anything_else_problem_2');
        
      case 'restate_anything_else_problem_2':
        return 'clear_anything_else_problem_2';
        
      case 'clear_anything_else_problem_2':
        return this.handleClearAnythingElseProblem(context, 'anything_else_check_3');
        
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
  private handleInternalRoutingSignals(response: string, context: TreatmentContext): boolean {
    switch (response) {
      case 'PROBLEM_SELECTION_CONFIRMED':
        context.currentPhase = 'method_selection';
        context.currentStep = 'choose_method';
        return true;
        
      case 'GOAL_SELECTION_CONFIRMED':
        context.currentPhase = 'reality_shifting';
        context.currentStep = 'goal_description';
        return true;
        
      case 'NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED':
        context.currentPhase = 'trauma_shifting';
        context.currentStep = 'negative_experience_description';
        return true;
        
      case 'METHOD_SELECTION_NEEDED':
        // Show method selection options
        return false; // Let normal flow continue
        
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
        
      case 'PROBLEM_SHIFTING_SELECTED':
        context.currentPhase = 'problem_shifting';
        context.currentStep = 'problem_shifting_intro';
        context.metadata.selectedMethod = 'problem_shifting';
        return true;
        
      case 'IDENTITY_SHIFTING_SELECTED':
        context.currentPhase = 'identity_shifting';
        context.currentStep = 'identity_shifting_intro';
        context.metadata.selectedMethod = 'identity_shifting';
        return true;
        
      case 'BELIEF_SHIFTING_SELECTED':
        context.currentPhase = 'belief_shifting';
        context.currentStep = 'belief_shifting_intro';
        context.metadata.selectedMethod = 'belief_shifting';
        return true;
        
      case 'BLOCKAGE_SHIFTING_SELECTED':
        context.currentPhase = 'blockage_shifting';
        context.currentStep = 'blockage_shifting_intro';
        context.metadata.selectedMethod = 'blockage_shifting';
        return true;
        
      default:
        return false; // No signal handled
    }
  }

  // Helper methods for handling specific step logic

  private handleMindShiftingExplanation(lastResponse: string, context: TreatmentContext): string {
    console.log(`🔍 MIND_SHIFTING_DETERMINE: lastResponse="${lastResponse}", workType="${context.metadata.workType}", selectedMethod="${context.metadata.selectedMethod}"`);
    
    // Handle work type selection based on user input
    if (lastResponse.includes('1') || (lastResponse.includes('problem') && !lastResponse.includes('shifting'))) {
      context.metadata.workType = 'problem';
      context.metadata.selectedMethod = undefined;
      context.currentPhase = 'method_selection';
      return 'choose_method';
    } else if (lastResponse.includes('2') || (lastResponse.includes('goal') && !lastResponse.includes('shifting'))) {
      context.metadata.workType = 'goal';
      context.metadata.selectedMethod = undefined;
      return 'goal_description';
    } else if (lastResponse.includes('3') || (lastResponse.includes('negative') && !lastResponse.includes('shifting')) || (lastResponse.includes('experience') && !lastResponse.includes('shifting'))) {
      context.metadata.workType = 'negative_experience';
      context.metadata.selectedMethod = undefined;
      return 'negative_experience_description';
    }
    
    // Handle method selection for problems
    if (context.metadata.workType === 'problem' && !context.metadata.selectedMethod) {
      const lowerInput = lastResponse.toLowerCase();
      if (lowerInput.includes('problem shifting')) {
        context.metadata.selectedMethod = 'problem_shifting';
        context.currentPhase = 'work_type_selection';
        return 'work_type_description';
      } else if (lowerInput.includes('identity shifting')) {
        context.metadata.selectedMethod = 'identity_shifting';
        context.currentPhase = 'work_type_selection';
        return 'work_type_description';
      } else if (lowerInput.includes('belief shifting')) {
        context.metadata.selectedMethod = 'belief_shifting';
        context.currentPhase = 'work_type_selection';
        return 'work_type_description';
      } else if (lowerInput.includes('blockage shifting')) {
        context.metadata.selectedMethod = 'blockage_shifting';
        context.currentPhase = 'work_type_selection';
        return 'work_type_description';
      }
      return 'mind_shifting_explanation';
    }
    
    // Handle problem description after method selection
    if (context.metadata.workType === 'problem' && context.metadata.selectedMethod) {
      this.updateProblemStatement(context, context.userResponses[context.currentStep]);
      
      // Route to appropriate treatment phase
      context.currentPhase = this.getPhaseForMethod(context.metadata.selectedMethod);
      return this.getIntroStepForMethod(context.metadata.selectedMethod);
    }
    
    // Handle goal description
    if (context.metadata.workType === 'goal' && !context.metadata.selectedMethod) {
      context.metadata.goalStatement = context.userResponses[context.currentStep];
      this.updateProblemStatement(context, context.userResponses[context.currentStep]);
      context.currentStep = 'reality_goal_capture';
      context.currentPhase = 'reality_shifting';
      context.metadata.selectedMethod = 'reality_shifting';
      return context.currentStep;
    }
    
    return 'mind_shifting_explanation';
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

  private getIntroStepForMethod(method: string): string {
    const methodStepMap: Record<string, string> = {
      'problem_shifting': 'problem_shifting_intro',
      'identity_shifting': 'identity_shifting_intro',
      'belief_shifting': 'belief_shifting_intro', 
      'blockage_shifting': 'blockage_shifting_intro',
      'reality_shifting': 'reality_shifting_intro',
      'trauma_shifting': 'trauma_shifting_intro'
    };
    return methodStepMap[method] || 'problem_shifting_intro';
  }

  private handleWorkTypeDescription(lastResponse: string, context: TreatmentContext): string {
    // Store the user's problem statement
    const userProblemStatement = context.userResponses[context.currentStep] || '';
    if (userProblemStatement) {
      this.updateProblemStatement(context, userProblemStatement);
    }
    
    // Route to appropriate treatment intro
    const workType = context.metadata.workType;
    const selectedMethod = context.metadata.selectedMethod;
    
    if (workType === 'problem' && selectedMethod) {
      context.currentPhase = this.getPhaseForMethod(selectedMethod);
      return this.getIntroStepForMethod(selectedMethod);
    } else if (workType === 'goal') {
      context.currentPhase = 'reality_shifting';
      return 'reality_shifting_intro';
    } else if (workType === 'negative_experience') {
      context.currentPhase = 'trauma_shifting';
      return 'trauma_shifting_intro';
    }
    
    return 'confirm_statement';
  }

  private handleGoalDescription(lastResponse: string, context: TreatmentContext): string {
    // Store goal and check for deadline
    this.updateProblemStatement(context, lastResponse);
    context.metadata.currentGoal = lastResponse;
    context.currentPhase = 'reality_shifting';
    context.metadata.selectedMethod = 'reality_shifting';
    
    // Check if deadline is already mentioned in the goal
    const hasDeadlineInGoal = ValidationHelpers.detectDeadlineInGoal(lastResponse);
    if (hasDeadlineInGoal.hasDeadline && hasDeadlineInGoal.deadline && hasDeadlineInGoal.synthesizedGoal) {
      context.metadata.goalWithDeadline = hasDeadlineInGoal.synthesizedGoal;
      context.userResponses['goal_deadline_check'] = 'yes';
      context.userResponses['goal_deadline_date'] = hasDeadlineInGoal.deadline;
      return 'goal_confirmation';
    } else {
      return 'goal_deadline_check';
    }
  }

  private handleNegativeExperienceDescription(lastResponse: string, context: TreatmentContext): string {
    this.updateProblemStatement(context, lastResponse);
    context.currentPhase = 'trauma_shifting';
    context.metadata.selectedMethod = 'trauma_shifting';
    return 'trauma_shifting_intro';
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
    const methodChoice = context.userResponses[context.currentStep]?.toLowerCase() || '';
    
    if (methodChoice.includes('problem shifting') || methodChoice.includes('1')) {
      context.currentPhase = 'work_type_selection';
      context.metadata.selectedMethod = 'problem_shifting';
      return 'work_type_description';
    } else if (methodChoice.includes('blockage shifting') || methodChoice.includes('4')) {
      context.currentPhase = 'work_type_selection';
      context.metadata.selectedMethod = 'blockage_shifting';
      return 'work_type_description';
    } else if (methodChoice.includes('identity shifting') || methodChoice.includes('2')) {
      context.currentPhase = 'work_type_selection';
      context.metadata.selectedMethod = 'identity_shifting';
      return 'work_type_description';
    } else if (methodChoice.includes('belief shifting') || methodChoice.includes('3')) {
      context.currentPhase = 'work_type_selection';
      context.metadata.selectedMethod = 'belief_shifting';
      return 'work_type_description';
    } else if (methodChoice.includes('reality shifting')) {
      context.currentPhase = 'reality_shifting';
      context.metadata.selectedMethod = 'reality_shifting';
      return 'reality_goal_capture';
    } else if (methodChoice.includes('trauma shifting')) {
      context.currentPhase = 'work_type_selection';
      context.metadata.selectedMethod = 'trauma_shifting';
      return 'work_type_description';
    }
    
    // Fallback to Problem Shifting
    context.currentPhase = 'work_type_selection';
    context.metadata.selectedMethod = 'problem_shifting';
    return 'work_type_description';
  }

  private handleMethodSelection(context: TreatmentContext): string {
    const currentSelectedMethod = context.metadata.selectedMethod;
    if (currentSelectedMethod) {
      return 'work_type_description';
    } else {
      return 'method_selection';
    }
  }

  private handleConfirmStatement(lastResponse: string): string {
    if (lastResponse === 'yes' || lastResponse === 'y' || lastResponse.includes('correct') || lastResponse.includes('right')) {
      return 'route_to_method';
    } else if (lastResponse === 'no' || lastResponse === 'n' || lastResponse.includes('wrong') || lastResponse.includes('incorrect')) {
      return 'work_type_description';
    } else {
      return 'confirm_statement';
    }
  }

  private handleRouteToMethod(context: TreatmentContext): string {
    const workType = context.metadata.workType;
    const selectedMethod = context.metadata.selectedMethod;
    
    if (workType === 'problem' && selectedMethod) {
      context.currentPhase = this.getPhaseForMethod(selectedMethod);
      return this.getIntroStepForMethod(selectedMethod);
    } else if (workType === 'goal') {
      context.currentPhase = 'reality_shifting';
      context.metadata.selectedMethod = 'reality_shifting';
      return 'reality_shifting_intro';
    } else if (workType === 'negative_experience') {
      context.currentPhase = 'trauma_shifting';
      context.metadata.selectedMethod = 'trauma_shifting';
      return 'trauma_identity_step';
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

  private handleGoalConfirmation(lastResponse: string): string {
    if (lastResponse.toLowerCase().includes('yes') || lastResponse.toLowerCase().includes('y')) {
      return 'goal_certainty';
    } else {
      return 'goal_description';
    }
  }

  private handleCheckIfStillProblem(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes') || lastResponse.includes('still')) {
      // Still a problem - cycle back
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      context.metadata.skipIntroInstructions = true;
      context.metadata.skipLinguisticProcessing = true;
      return 'problem_shifting_intro';
    }
    if (lastResponse.includes('no') || lastResponse.includes('not')) {
      const returnStep = context.metadata?.returnToDiggingStep;
      if (returnStep) {
        context.currentPhase = 'digging_deeper';
        context.metadata.returnToDiggingStep = undefined;
        return returnStep;
      } else {
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
      context.currentPhase = 'digging_deeper';
      return 'digging_deeper_start';
    } else {
      const newProblem = context.userResponses[context.currentStep] || lastResponse;
      if (newProblem) {
        this.updateProblemStatement(context, newProblem);
        context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      }
      return 'blockage_shifting_intro';
    }
  }

  private handleBlockageCheckIfStillProblem(lastResponse: string, context: TreatmentContext): string {
    const noProblemIndicators = ['no problem', 'nothing', 'none', 'gone', 'resolved', 'fine', 'good', 'better', 'clear'];
    const seemsResolved = noProblemIndicators.some(indicator => lastResponse.includes(indicator)) ||
      (lastResponse.trim() === 'no') || 
      (lastResponse.trim() === 'not') ||
      (lastResponse.trim() === 'no problem') ||
      (lastResponse.startsWith('no ') && lastResponse.length < 15) ||
      (lastResponse.startsWith('not ') && lastResponse.length < 15);
    
    const isDigDeeperResponse = lastResponse.includes('yes') || lastResponse.includes('no');
    
    if (isDigDeeperResponse) {
      context.currentPhase = 'digging_deeper';
      return 'digging_deeper_start';
    } else if (seemsResolved) {
      const returnStep = context.metadata?.returnToDiggingStep;
      if (returnStep) {
        context.currentPhase = 'digging_deeper';
        context.metadata.returnToDiggingStep = undefined;
        return returnStep;
      } else {
        context.currentPhase = 'digging_deeper';
        return 'digging_deeper_start';
      }
    } else {
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      return 'blockage_shifting_intro';
    }
  }

  private handleIdentityShiftingIntro(context: TreatmentContext): string {
    if (context.metadata.identityResponse && context.metadata.identityResponse.type === 'IDENTITY') {
      return 'identity_dissolve_step_a';
    } else {
      return 'identity_shifting_intro';
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

  private handleIdentityFutureCheck(lastResponse: string): string {
    if (lastResponse.includes('yes') || lastResponse.includes('1')) {
      return 'identity_problem_check';
    } else if (lastResponse.includes('no') || lastResponse.includes('2')) {
      return 'identity_scenario_check';
    }
    return 'identity_scenario_check';
  }

  private handleIdentityScenarioCheck(lastResponse: string): string {
    if (lastResponse.includes('yes') || lastResponse.includes('1')) {
      return 'identity_problem_check';
    } else if (lastResponse.includes('no') || lastResponse.includes('2')) {
      return 'integration_awareness_1';
    }
    return 'identity_problem_check';
  }

  private handleIdentityCheck(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes') || lastResponse.includes('still')) {
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      return 'identity_dissolve_step_a';
    }
    if (lastResponse.includes('no') || lastResponse.includes('not')) {
      return 'identity_future_check';
    }
    return 'identity_future_check';
  }

  private handleIdentityProblemCheck(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes') || lastResponse.includes('still')) {
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      context.currentPhase = 'discovery';
      return 'restate_identity_problem';
    }
    if (lastResponse.includes('no') || lastResponse.includes('not')) {
      const returnStep = context.metadata?.returnToDiggingStep;
      if (returnStep) {
        context.currentPhase = 'digging_deeper';
        context.metadata.returnToDiggingStep = undefined;
        return returnStep;
      } else {
        context.currentPhase = 'digging_deeper';
        return 'digging_deeper_start';
      }
    }
    return 'identity_problem_check';
  }

  private handleConfirmIdentityProblem(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes')) {
      context.currentPhase = 'identity_shifting';
      return 'identity_shifting_intro';
    }
    if (lastResponse.includes('no')) {
      return 'restate_identity_problem';
    }
    return 'confirm_identity_problem';
  }

  private handleBeliefStepF(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes') || lastResponse.includes('still')) {
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      return 'belief_step_a';
    }
    if (lastResponse.includes('no') || lastResponse.includes('not')) {
      return 'belief_check_1';
    }
    return 'belief_check_1';
  }

  private handleBeliefChecks(stepId: string, lastResponse: string): string {
    if (stepId === 'belief_check_1') {
      return 'belief_check_2';
    } else if (stepId === 'belief_check_2') {
      return 'belief_check_3';
    } else if (stepId === 'belief_check_3') {
      return 'belief_check_4';
    }
    return 'belief_check_1';
  }

  private handleBeliefProblemCheck(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes') || lastResponse.includes('still')) {
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      context.currentPhase = 'discovery';
      return 'restate_belief_problem';
    }
    if (lastResponse.includes('no') || lastResponse.includes('not')) {
      const returnStep = context.metadata?.returnToDiggingStep;
      if (returnStep) {
        context.currentPhase = 'digging_deeper';
        context.metadata.returnToDiggingStep = undefined;
        return returnStep;
      } else {
        context.currentPhase = 'digging_deeper';
        return 'digging_deeper_start';
      }
    }
    return 'belief_problem_check';
  }

  private handleConfirmBeliefProblem(lastResponse: string, context: TreatmentContext): string {
    if (lastResponse.includes('yes')) {
      context.currentPhase = 'belief_shifting';
      return 'belief_shifting_intro';
    }
    if (lastResponse.includes('no')) {
      return 'restate_belief_problem';
    }
    return 'confirm_belief_problem';
  }

  private handleRealityWhyNotPossible(lastResponse: string): string {
    if (lastResponse.toLowerCase().includes('no reason') || 
        lastResponse.toLowerCase().includes('no') && lastResponse.toLowerCase().includes('reason') ||
        lastResponse.toLowerCase().includes('none') ||
        lastResponse.toLowerCase().includes('nothing')) {
      return 'reality_checking_questions';
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
    if (lastResponse.toLowerCase().includes('nothing') || lastResponse.toLowerCase().includes('no') || lastResponse.toLowerCase().includes('not')) {
      const returnStep = context.metadata?.returnToDiggingStep;
      if (returnStep) {
        context.currentPhase = 'digging_deeper';
        context.metadata.returnToDiggingStep = undefined;
        return returnStep;
      } else {
        return 'reality_session_complete';
      }
    } else {
      return 'reality_integration_action_more';
    }
  }

  private handleTraumaShiftingIntro(lastResponse: string): string {
    if (lastResponse.includes('yes') || lastResponse.includes('y')) {
      return 'trauma_identity_step';
    }
    if (lastResponse.includes('no') || lastResponse.includes('n')) {
      return 'trauma_problem_redirect';
    }
    return 'trauma_shifting_intro';
  }

  private handleTraumaProblemRedirect(lastResponse: string, context: TreatmentContext): string {
    this.updateProblemStatement(context, lastResponse);
    context.metadata.workType = 'problem';
    context.metadata.selectedMethod = undefined;
    context.currentPhase = 'method_selection';
    return 'choose_method';
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
      context.metadata.cycleCount = (context.metadata.cycleCount || 0) + 1;
      return 'trauma_shifting_intro';
    }
    if (lastResponse.includes('no') || lastResponse.includes('not')) {
      return 'trauma_dig_deeper';
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

  private handleDiggingMethodSelection(lastResponse: string, context: TreatmentContext): string {
    const diggingSelectedMethod = context.metadata?.selectedMethod;
    
    // Update problem statement to use the new problem from digging deeper flow
    const newProblemFromUserResponse = context.userResponses?.['restate_problem_future'];
    const newDiggingProblem = newProblemFromUserResponse || context.metadata?.newDiggingProblem || context.metadata?.currentDiggingProblem;
    if (newDiggingProblem) {
      this.updateProblemStatement(context, newDiggingProblem);
      context.metadata.currentDiggingProblem = newDiggingProblem;
    }
    
    // Handle method selection responses
    if (lastResponse.includes('problem shifting') || lastResponse === '1') {
      context.currentPhase = 'problem_shifting';
      context.metadata.selectedMethod = 'problem_shifting';
      return 'problem_shifting_intro';
    } else if (lastResponse.includes('identity shifting') || lastResponse === '2') {
      context.currentPhase = 'identity_shifting';
      context.metadata.selectedMethod = 'identity_shifting';
      return 'identity_shifting_intro';
    } else if (lastResponse.includes('belief shifting') || lastResponse === '3') {
      context.currentPhase = 'belief_shifting';
      context.metadata.selectedMethod = 'belief_shifting';
      return 'belief_shifting_intro';
    } else if (lastResponse.includes('blockage shifting') || lastResponse === '4') {
      context.currentPhase = 'blockage_shifting';
      context.metadata.selectedMethod = 'blockage_shifting';
      return 'blockage_shifting_intro';
    }
    
    // Default fallback
    context.currentPhase = 'problem_shifting';
    context.metadata.selectedMethod = 'problem_shifting';
    return 'problem_shifting_intro';
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

  private handleClearScenarioProblem(context: TreatmentContext, returnStep: string): string {
    const returnStepFromContext = context.metadata?.returnToDiggingStep;
    if (returnStepFromContext) {
      context.currentPhase = 'digging_deeper';
      return returnStepFromContext;
    }
    return returnStep;
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

  private handleClearAnythingElseProblem(context: TreatmentContext, fallbackStep: string): string {
    context.currentPhase = 'digging_deeper';
    return 'digging_method_selection';
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
