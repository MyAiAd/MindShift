import { AITrigger, TreatmentContext, TreatmentStep } from './treatment-state-machine';
import OpenAI from 'openai';

// Create OpenAI client only when needed
function createOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export interface AIAssistanceRequest {
  trigger: AITrigger;
  userInput: string;
  context: TreatmentContext;
  currentStep: TreatmentStep;
}

export interface AIAssistanceResponse {
  message: string;
  shouldReturnToScript: boolean;
  suggestedNextStep?: string;
  tokenCount: number;
  cost: number;
}

export interface ValidationAssistanceRequest {
  userInput: string;
  validationType: 'problem_vs_goal' | 'problem_vs_question' | 'single_negative_experience' | 'goal_vs_problem' | 'goal_vs_question';
  context: TreatmentContext;
  currentStep: TreatmentStep;
}

export interface ValidationAssistanceResponse {
  needsCorrection: boolean;
  correctionMessage?: string;
  tokenCount: number;
  cost: number;
}

export class AIAssistanceManager {
  private readonly MAX_TOKENS = 150; // Slightly increased for linguistic processing
  private readonly TARGET_COST_PER_SESSION = 0.05; // $0.05 per session target
  private usageStats: Map<string, SessionUsage> = new Map();

  // Define specific steps that need linguistic interpretation
  private readonly AI_LINGUISTIC_STEPS = [
    'body_sensation_check',    // Problem Shifting: "Feel [contextualized emotion]... what happens in yourself when you feel [contextualized emotion]?"
    'feel_solution_state',     // Problem Shifting: "What would you feel like if '[contextualized user response]' had already happened?"
    'reality_step_a2',         // Reality Shifting: "Feel [contextualized emotion]... what can you feel now?"
    'reality_feel_reason',     // Reality Shifting: "Feel [contextualized reason]... what does it feel like?"
    'reality_feel_reason_2',   // Reality Shifting: "Feel [contextualized emotion]... what can you feel now?"
    'reality_feel_reason_3',   // Reality Shifting: "Feel [contextualized emotion]... what's the first thing you notice about it?"
    'blockage_step_b',         // Blockage Shifting: "Feel [contextualized emotion]... what does [contextualized emotion] feel like?"
    'blockage_step_d',         // Blockage Shifting: "Feel [contextualized emotion]... what does [contextualized emotion] feel like?"
    'belief_step_b',           // Belief Shifting: "Feel [contextualized emotion]... what does [contextualized emotion] feel like?"
    'belief_step_e',           // Belief Shifting: "Feel [contextualized emotion]... what does [contextualized emotion] feel like?"
    'identity_dissolve_step_a', // Identity Shifting: "Feel yourself being [identity]... what does it feel like?"
    'identity_dissolve_step_b', // Identity Shifting: "Feel [last response]... what happens in yourself when you feel [last response]?"
    // 'identity_check' removed - should use stored originalProblemIdentity, not AI processing
    'trauma_dissolve_step_a',   // Trauma Shifting: "Feel yourself being [identity]... what does it feel like?"
    'trauma_dissolve_step_b',   // Trauma Shifting: "Feel [last response]... what happens in yourself when you feel [last response]?"
    // 'trauma_identity_check' removed - should use stored originalProblemIdentity, not AI processing
    // Intro steps that need user input contextualisation
    'problem_shifting_intro',  // Problem Shifting: Ensure input is stated as a problem
    'reality_shifting_intro',  // Reality Shifting: Ensure input is stated as a goal
    'reality_goal_capture',    // Reality Shifting: Ensure input is stated as a goal
    'blockage_shifting_intro', // Blockage Shifting: Ensure input is stated as a problem  
    // 'identity_shifting_intro' REMOVED - should store identity response directly, not process with AI
    'trauma_shifting_intro',   // Trauma Shifting: Ensure input is stated as a negative experience
    'belief_shifting_intro'    // Belief Shifting: Ensure input is stated as a problem
  ];

  /**
   * NEW: Process validation assistance for problem/goal/question and negative experience validation
   */
  async processValidationAssistance(request: ValidationAssistanceRequest): Promise<ValidationAssistanceResponse> {
    // Track usage for cost control
    this.trackUsage(request.context.sessionId);
    
    // Check if session has exceeded AI usage limits
    if (this.hasExceededLimits(request.context.sessionId)) {
      return {
        needsCorrection: false, // Fallback to allowing input
        tokenCount: 0,
        cost: 0
      };
    }

    const prompt = this.buildValidationPrompt(request);
    
    try {
      const aiResponse = await this.callOpenAIService(prompt, true);
      this.updateUsageStats(request.context.sessionId, aiResponse.tokenCount, aiResponse.cost);
      
      // Parse the AI response to determine if correction is needed
      const needsCorrection = aiResponse.content.toLowerCase().includes('needs correction');
      const correctionMessage = needsCorrection ? this.extractCorrectionMessage(aiResponse.content, request.validationType, request.userInput) : undefined;
      
      return {
        needsCorrection,
        correctionMessage,
        tokenCount: aiResponse.tokenCount,
        cost: aiResponse.cost
      };
    } catch (error) {
      console.error('Validation assistance failed:', error);
      return {
        needsCorrection: false, // Fallback to allowing input
        tokenCount: 0,
        cost: 0
      };
    }
  }

  /**
   * NEW: Build validation prompt for specific validation types
   */
  private buildValidationPrompt(request: ValidationAssistanceRequest): string {
    const { userInput, validationType } = request;
    
    switch (validationType) {
      case 'problem_vs_goal':
        return `The user was asked to state a PROBLEM but they said: "${userInput}"

This contains goal language like "want to", "wish to", "hope to", "achieve", "get", "become", "goal", or aspirational uses of "have" (like "want to have", "wish to have", "have more", "have better").

Note: Simple statements like "I have a headache" or "I have anxiety" are valid problem statements, not goals.

Since this is a GOAL instead of a PROBLEM, respond exactly: "NEEDS CORRECTION"

If this was actually a proper problem statement, respond exactly: "VALID PROBLEM STATEMENT"`;

      case 'problem_vs_question':
        return `The user was asked to state a PROBLEM but they said: "${userInput}"

This is a QUESTION (ends with ? or starts with how/what/why/when/where/should) instead of a PROBLEM.

Since this is a QUESTION instead of a PROBLEM, respond exactly: "NEEDS CORRECTION"

If this was actually a proper problem statement, respond exactly: "VALID PROBLEM STATEMENT"`;

      case 'single_negative_experience':
        return `The user was asked to describe a negative experience but they said: "${userInput}"

This contains words indicating MULTIPLE EVENTS like "always", "often", "repeatedly", "throughout", "as a child", "growing up", etc.

Since this refers to MULTIPLE EVENTS instead of a SINGLE EVENT, respond exactly: "NEEDS CORRECTION"

If this was actually a single specific event, respond exactly: "VALID SINGLE EVENT"`;

      case 'goal_vs_problem':
        return `The user was asked to state a GOAL (what they want) but they said: "${userInput}"

This contains problem language like "problem", "issue", "trouble", "difficulty", "struggle", "can't", "cannot", "unable to", "don't", "not able", "hard to", "difficult to".

Since this is a PROBLEM instead of a GOAL, respond exactly: "NEEDS CORRECTION"

If this was actually a proper goal statement, respond exactly: "VALID GOAL STATEMENT"`;

      case 'goal_vs_question':
        return `The user was asked to state a GOAL (what they want) but they said: "${userInput}"

This is a QUESTION (ends with ? or starts with how/what/why/when/where/should) instead of a GOAL.

Since this is a QUESTION instead of a GOAL, respond exactly: "NEEDS CORRECTION"

If this was actually a proper goal statement, respond exactly: "VALID GOAL STATEMENT"`;

      default:
        return `Analyze the user input: "${userInput}" and determine if it needs correction. Respond with either "NEEDS CORRECTION: [message]" or "VALID INPUT".`;
    }
  }

  /**
   * NEW: Extract correction message from AI response
   */
  private extractCorrectionMessage(aiResponse: string, validationType: string, userInput: string): string {
    // Always use the exact messages specified in requirements
    switch (validationType) {
      case 'problem_vs_goal':
        return 'How would you state that as a problem instead of a goal?';
      case 'problem_vs_question':
        return 'How would you state that as a problem instead of a question?';
      case 'single_negative_experience':
        // Extract the key theme from the user input for a more specific message
        const theme = this.extractThemeFromInput(userInput);
        return `It is important that we only work on one memory of a single event at a time, so please recall a significant event where ${theme} and tell me what the event was in a few words.`;
      case 'goal_vs_problem':
        return 'How would you state that as a goal instead of a problem?';
      case 'goal_vs_question':
        return 'How would you state that as a goal instead of a question?';
      default:
        return 'Please rephrase your response.';
    }
  }

  /**
   * Extract theme from user input for negative experience correction
   */
  private extractThemeFromInput(userInput: string): string {
    const input = userInput.toLowerCase();
    
    if (input.includes('bullied') || input.includes('bully')) {
      return 'you were bullied';
    }
    if (input.includes('abuse') || input.includes('abused')) {
      return 'you were abused';
    }
    if (input.includes('fight') || input.includes('fought') || input.includes('arguing')) {
      return 'there was fighting or conflict';
    }
    if (input.includes('difficult') || input.includes('hard') || input.includes('tough')) {
      return 'you experienced difficulty';
    }
    if (input.includes('trauma') || input.includes('traumatic')) {
      return 'you experienced trauma';
    }
    if (input.includes('hurt') || input.includes('pain')) {
      return 'you were hurt';
    }
    
    // Generic fallback
    return 'you experienced this negative situation';
  }

  /**
   * Process AI assistance request - Only called for specific scenarios
   */
  async processAssistanceRequest(request: AIAssistanceRequest): Promise<AIAssistanceResponse> {
    // Track usage for cost control
    this.trackUsage(request.context.sessionId);
    
    // Check if session has exceeded AI usage limits
    if (this.hasExceededLimits(request.context.sessionId)) {
      return this.getFallbackResponse(request);
    }

    // Determine if this is a linguistic processing request
    const isLinguisticProcessing = this.isLinguisticProcessingStep(request.currentStep.id);
    
    const prompt = isLinguisticProcessing 
      ? this.buildLinguisticPrompt(request)
      : this.buildMinimalPrompt(request);
    
    try {
      // Call actual OpenAI API
      const aiResponse = await this.callOpenAIService(prompt, isLinguisticProcessing);
      
      this.updateUsageStats(request.context.sessionId, aiResponse.tokenCount, aiResponse.cost);
      
      return {
        message: this.formatAIResponse(aiResponse.content, request.trigger),
        shouldReturnToScript: true,
        tokenCount: aiResponse.tokenCount,
        cost: aiResponse.cost
      };
    } catch (error) {
      console.error('AI assistance failed:', error);
      return this.getFallbackResponse(request);
    }
  }

  /**
   * Process linguistic interpretation for natural language flow
   * This gets called for the 2 specific cases where we need to avoid robotic responses:
   * 1. body_sensation_check - contextualizes emotions
   * 2. feel_solution_state - contextualizes user responses for natural flow
   */
  async processLinguisticInterpretation(
    scriptedResponse: string,
    userInput: string,
    stepId: string,
    sessionId: string
  ): Promise<{ success: boolean; improvedResponse: string; fallbackToScripted: boolean; cost: number; tokens: number }> {
    // Track usage for cost control
    this.trackUsage(sessionId);
    
    // Check if session has exceeded AI usage limits
    if (this.hasExceededLimits(sessionId)) {
      return {
        success: false,
        improvedResponse: scriptedResponse,
        fallbackToScripted: true,
        cost: 0,
        tokens: 0
      };
    }

    const prompt = this.buildLinguisticInterpretationPrompt(scriptedResponse, userInput, stepId);
    
    try {
      const aiResponse = await this.callOpenAIService(prompt, true);
      this.updateUsageStats(sessionId, aiResponse.tokenCount, aiResponse.cost);
      
      return {
        success: true,
        improvedResponse: aiResponse.content,
        fallbackToScripted: false,
        cost: aiResponse.cost,
        tokens: aiResponse.tokenCount
      };
    } catch (error) {
      console.error('Linguistic interpretation failed:', error);
      return {
        success: false,
        improvedResponse: scriptedResponse,
        fallbackToScripted: true,
        cost: 0,
        tokens: 0
      };
    }
  }

  /**
   * Check if current step requires linguistic processing
   */
  private isLinguisticProcessingStep(stepId: string): boolean {
    return this.AI_LINGUISTIC_STEPS.includes(stepId);
  }

  /**
   * Build linguistic interpretation prompt for natural language flow
   */
  private buildLinguisticPrompt(request: AIAssistanceRequest): string {
    const { userInput, context, currentStep } = request;
    const lastResponse = context.userResponses[context.currentStep] || '';
    
    // Get the template response that would normally be used
    const templateResponse = this.getTemplateResponse(currentStep.id, lastResponse);
    
    return `You are a linguistic interpreter for therapeutic Mind Shifting sessions.

Current therapeutic step: ${currentStep.id}
User's response: "${userInput}"
Template response: "${templateResponse}"

Your task is to rephrase the template response to use natural, conversational language while maintaining the exact therapeutic structure and intent.

Rules:
1. Extract the core emotional state or desired outcome from the user's response
2. Use the user's actual emotional words naturally in the rephrased response
3. Keep the same question structure and therapeutic intent
4. Make it sound conversational, not robotic or repetitive
5. Do not change the therapeutic protocol or add new content
6. Return only the rephrased response, nothing else

Examples:
- Instead of: "What would you feel like if 'I need to feel happy' had already happened"
- Say: "What would you feel like if you already felt happy?"

- Instead of: "Feel 'I would feel good'... what does 'I would feel good' feel like?"
- Say: "Feel GOOD... what does GOOD feel like?"

Rephrase the template response now:`;
  }

  /**
   * Build focused prompt for linguistic interpretation only
   */
  private buildLinguisticInterpretationPrompt(scriptedResponse: string, userInput: string, stepId: string): string {
    if (stepId === 'body_sensation_check') {
      return `You are a linguistic interpreter for Mind Shifting sessions. Your task is to use the user's EXACT words in the template.

User's response: "${userInput}"
Current scripted response: "${scriptedResponse}"

Task: Use the user's exact feeling words in the template without changing or interpreting them.

Template: "Feel [user's exact words]... what happens in yourself when you feel [user's exact words]?"

Rules:
1. Use the user's EXACT words - do NOT change, interpret, or paraphrase them
2. Only remove minimal filler words like "I feel", "it's", "like" if they prevent natural flow
3. Preserve the user's exact descriptive language (e.g., "like a loser" stays "like a loser", not "defeated")
4. Keep the exact template structure
5. Return only the rephrased response, nothing else

Examples:
- User: "like a loser" → "Feel like a loser... what happens in yourself when you feel like a loser?"
- User: "I feel anxious" → "Feel anxious... what happens in yourself when you feel anxious?"
- User: "overwhelmed and stressed" → "Feel overwhelmed and stressed... what happens in yourself when you feel overwhelmed and stressed?"
- User: "heavy" → "Feel heavy... what happens in yourself when you feel heavy?"

Use the user's exact words in the template now:`;
    } else if (stepId === 'feel_solution_state') {
      return `You are a linguistic interpreter for Mind Shifting sessions. Your task is to contextualize the user's response into a natural phrase that works with "What would you feel like if you already...?"

User's response: "${userInput}"
Current scripted response: "${scriptedResponse}"

Task: Transform the user's response into a natural phrase that completes "What would you feel like if you already...?"

Rules:
1. Convert the user's response to work naturally after "already"
2. Make it sound conversational, not robotic
3. Keep the user's core meaning intact
4. Return ONLY the phrase (no quotes), not the full question
5. Use past tense or state of being that flows naturally

Examples:
- User: "more money" → "had more money"
- User: "better job" → "had a better job"
- User: "lose weight" → "had lost weight"
- User: "be nicer" → "were nicer"
- User: "money issues need to be solved" → "had your money issues solved"
- User: "relationship" → "were in that relationship"
- User: "be happy" → "were happy"
- User: "feel confident" → "felt confident"

Transform the user's response now:`;
    } else if (stepId === 'reality_step_a2' || stepId === 'reality_feel_reason_2') {
      return `You are a linguistic interpreter for Mind Shifting sessions. Your task is to contextualize the user's feeling response.

User's response: "${userInput}"
Current scripted response: "${scriptedResponse}"

Task: Extract the core emotion/feeling from the user's response and use it in the template.

Template: "Feel [contextualized emotion]... what can you feel now?"

Rules:
1. Extract the core emotional word from the user's response
2. Remove unnecessary words like "like I am", "I feel", "it's", etc.
3. Use only the core emotion in the template
4. Keep the exact template structure
5. Return only the rephrased response, nothing else

Examples:
- User: "like I am excited" → "Feel excited... what can you feel now?"
- User: "I feel hopeful" → "Feel hopeful... what can you feel now?"
- User: "it's overwhelming" → "Feel overwhelmed... what can you feel now?"
- User: "nervous" → "Feel nervous... what can you feel now?"

Extract the core emotion and apply the template now:`;
    } else if (stepId === 'reality_feel_reason') {
      return `You are a linguistic interpreter for Mind Shifting sessions. Your task is to contextualize the user's reason response.

User's response: "${userInput}"
Current scripted response: "${scriptedResponse}"

Task: Extract the core reason/concern from the user's response and use it in the template.

Template: "Feel [contextualized reason]... what does it feel like?"

Rules:
1. Extract the core reason or concern from the user's response
2. Remove unnecessary words and make it concise
3. Use the core reason in the template
4. Keep the exact template structure
5. Return only the rephrased response, nothing else

Examples:
- User: "I might not be good enough for it" → "Feel not being good enough... what does it feel like?"
- User: "there's too much competition" → "Feel the competition... what does it feel like?"
- User: "I don't have the skills" → "Feel lacking the skills... what does it feel like?"
- User: "failure" → "Feel failure... what does it feel like?"

Extract the core reason and apply the template now:`;
    } else if (stepId === 'reality_feel_reason_3') {
      return `You are a linguistic interpreter for Mind Shifting sessions. Your task is to contextualize the user's feeling response.

User's response: "${userInput}"
Current scripted response: "${scriptedResponse}"

Task: Extract the core emotion/feeling from the user's response and use it in the template.

Template: "Feel [contextualized emotion]... what's the first thing you notice about it?"

Rules:
1. Extract the core emotional word from the user's response
2. Remove unnecessary words like "like I am", "I feel", "it's", etc.
3. Use only the core emotion in the template
4. Keep the exact template structure
5. Return only the rephrased response, nothing else

Examples:
- User: "like I am defeated" → "Feel defeated... what's the first thing you notice about it?"
- User: "I feel scared" → "Feel scared... what's the first thing you notice about it?"
- User: "it's frustrating" → "Feel frustrated... what's the first thing you notice about it?"
- User: "stuck" → "Feel stuck... what's the first thing you notice about it?"

Extract the core emotion and apply the template now:`;
    } else if (stepId === 'blockage_step_b' || stepId === 'blockage_step_d') {
      return `You are a linguistic interpreter for Mind Shifting sessions. Your task is to contextualize the user's feeling response.

User's response: "${userInput}"
Current scripted response: "${scriptedResponse}"

Task: Extract the core emotion/feeling from the user's response and use it in the template.

Template: "Feel [contextualized emotion]... what does [contextualized emotion] feel like?"

Rules:
1. Extract the core emotional word from the user's response
2. Remove unnecessary words like "like I am", "I feel", "it's", etc.
3. Use only the core emotion in both places in the template
4. Keep the exact template structure
5. Return only the rephrased response, nothing else

Examples:
- User: "like I am anxious" → "Feel anxious... what does anxious feel like?"
- User: "I feel overwhelmed" → "Feel overwhelmed... what does overwhelmed feel like?"
- User: "it's heavy and dark" → "Feel heavy... what does heavy feel like?"
- User: "stuck" → "Feel stuck... what does stuck feel like?"
- User: "frustrated and angry" → "Feel frustrated... what does frustrated feel like?"

Extract the core emotion and apply the template now:`;
    } else if (stepId === 'belief_step_b' || stepId === 'belief_step_e') {
      return `You are a linguistic interpreter for Mind Shifting sessions. Your task is to contextualize the user's feeling response.

User's response: "${userInput}"
Current scripted response: "${scriptedResponse}"

Task: Extract the core emotion/feeling from the user's response and use it in the template.

Template: "Feel [contextualized emotion]... what does [contextualized emotion] feel like?"

Rules:
1. Extract the core emotional word from the user's response
2. Remove unnecessary words like "like I am", "I feel", "it's", etc.
3. Use only the core emotion in both places in the template
4. Keep the exact template structure
5. Return only the rephrased response, nothing else

Examples:
- User: "like I am worthless" → "Feel worthless... what does worthless feel like?"
- User: "I feel ashamed" → "Feel ashamed... what does ashamed feel like?"
- User: "it's painful and heavy" → "Feel painful... what does painful feel like?"
- User: "confident" → "Feel confident... what does confident feel like?"
- User: "hopeful and light" → "Feel hopeful... what does hopeful feel like?"

Extract the core emotion and apply the template now:`;
    } else if (stepId === 'problem_shifting_intro' || stepId === 'blockage_shifting_intro' || stepId === 'identity_shifting_intro' || stepId === 'belief_shifting_intro') {
      return `You are assisting with Mind Shifting sessions. The user has provided their problem statement. Your task is to preserve their EXACT wording while only removing minimal filler phrases.

User's problem statement: "${userInput}"

CRITICAL: Return ONLY the problem statement that will go inside the quotes. Do NOT return a full conversational response or scripted response.

Rules:
1. Keep the user's EXACT words - do NOT change, interpret, or paraphrase them
2. Only remove minimal filler phrases like "my problem is", "I have a problem with", "the issue is" if present
3. Preserve their exact descriptive language (e.g., "need money" stays "need money", not "money issues")
4. Return ONLY the problem statement text, nothing else

Examples:
- User: "my problem is I need money" → "I need money"
- User: "I have a problem with being lazy" → "being lazy"
- User: "need money" → "need money"
- User: "I feel like a loser" → "I feel like a loser"

Return only the problem statement using their exact words:`;
    } else if (stepId === 'reality_shifting_intro') {
      return `You are assisting with Mind Shifting sessions. The user has already provided their goal statement. Your task is to preserve their EXACT wording.

User's goal statement: "${userInput}"

CRITICAL: You must use the user's EXACT words for their goal. Do not change, rephrase, or modify their goal statement in any way.

The scripted response should use their goal exactly as stated: "${userInput}"

Return the scripted response using their exact goal wording without any modifications.`;
    } else if (stepId === 'identity_dissolve_step_a') {
      return `You are a linguistic interpreter for Mind Shifting sessions. Your task is to use the user's exact identity words in the template.

User's response: "${userInput}"
Current scripted response: "${scriptedResponse}"

Task: Use the user's exact identity words in the template without changing or interpreting them.

Template: "Feel yourself being [user's exact words]... what does it feel like?"

🚨 ABSOLUTELY CRITICAL RULES - DO NOT VIOLATE THESE:
1. Use the user's COMPLETE and EXACT words - do NOT drop any words, especially nouns like "person", "man", "woman", etc.
2. ONLY remove these specific prefixes if present: "someone who is", "a person who is", "I am a", "I am"
3. NEVER EVER remove descriptive nouns like "person", "man", "woman", "child", "victim", etc.
4. Preserve ALL adjectives and descriptive words exactly as given
5. Return only the response using their exact words, nothing else

🔥 SPECIFIC EXAMPLES - FOLLOW THESE EXACTLY:
- User: "hurt person" → "Feel yourself being a hurt person... what does it feel like?"
- User: "angry person" → "Feel yourself being an angry person... what does it feel like?"
- User: "bad person" → "Feel yourself being a bad person... what does it feel like?"
- User: "victim" → "Feel yourself being a victim... what does it feel like?"
- User: "bad mother" → "Feel yourself being a bad mother... what does it feel like?"

⚠️ WRONG EXAMPLES - DO NOT DO THIS:
- User: "hurt person" → ❌ "Feel yourself being hurt... what does it feel like?" (WRONG - dropped "person")
- User: "angry person" → ❌ "Feel yourself being angry... what does it feel like?" (WRONG - dropped "person")

🎯 YOUR EXACT TASK:
If the user said "${userInput}", you must include ALL words from "${userInput}" in your response.

Use the user's exact words in the template now:`;
    } else if (stepId === 'identity_dissolve_step_b') {
      return `You are a linguistic interpreter for Mind Shifting sessions. Your task is to contextualize the user's identity response.

User's response: "${userInput}"
Current scripted response: "${scriptedResponse}"

Task: Extract the core identity from the user's response and use it naturally in the template.

Template: "Feel [user's exact words]... what happens in yourself when you feel [user's exact words]?"

Rules:
1. Use the user's exact words from their response - do NOT change, interpret, or paraphrase them
2. Only remove unnecessary phrases like "someone who is", "a person who", "I am" if present
3. Use the correct template ending "what happens in yourself when you feel [same words]?"
4. Use the same exact words in both places in the template
5. Return only the response using their exact words, nothing else

Examples:
- User: "bad" → "Feel bad... what happens in yourself when you feel bad?"
- User: "scared" → "Feel scared... what happens in yourself when you feel scared?"
- User: "powerless" → "Feel powerless... what happens in yourself when you feel powerless?"
- User: "like a victim" → "Feel like a victim... what happens in yourself when you feel like a victim?"
        - User: "in control of my own future" → "Feel in control of your future... what happens in yourself when you feel in control of your future?"

Extract the core identity and apply the template now:`;
    // REMOVED: identity_check should use stored originalProblemIdentity, not AI processing
    } else if (stepId === 'trauma_dissolve_step_a') {
      return `You are a linguistic interpreter for Mind Shifting sessions. Your task is to contextualize the user's identity response for Trauma Shifting.

User's response: "${userInput}"
Current scripted response: "${scriptedResponse}"

Task: Extract the core trauma identity from the user's response and use it naturally in the template.

Template: "Feel yourself being [user's exact words]... what does it feel like?"

🚨 ABSOLUTELY CRITICAL RULES - DO NOT VIOLATE THESE:
1. Use the user's COMPLETE and EXACT words - do NOT drop any words, especially nouns like "person", "man", "woman", "child", etc.
2. ONLY remove these specific prefixes if present: "someone who is", "a person who is", "I am a", "I am"
3. NEVER EVER remove descriptive nouns like "person", "man", "woman", "child", "victim", etc.
4. Preserve ALL adjectives and descriptive words exactly as given
5. Return only the response using their exact words, nothing else

🔥 SPECIFIC EXAMPLES - FOLLOW THESE EXACTLY:
- User: "hurt person" → "Feel yourself being a hurt person... what does it feel like?"
- User: "damaged child" → "Feel yourself being a damaged child... what does it feel like?"
- User: "angry person" → "Feel yourself being an angry person... what does it feel like?"
- User: "victim" → "Feel yourself being a victim... what does it feel like?"
- User: "abandoned child" → "Feel yourself being an abandoned child... what does it feel like?"

⚠️ WRONG EXAMPLES - DO NOT DO THIS:
- User: "hurt person" → ❌ "Feel yourself being hurt... what does it feel like?" (WRONG - dropped "person")
- User: "damaged child" → ❌ "Feel yourself being damaged... what does it feel like?" (WRONG - dropped "child")

🎯 YOUR EXACT TASK:
If the user said "${userInput}", you must include ALL words from "${userInput}" in your response.

Extract the core trauma identity and apply the template now:`;
    } else if (stepId === 'trauma_dissolve_step_b') {
      return `You are a linguistic interpreter for Mind Shifting sessions. Your task is to contextualize the user's trauma identity response.

User's response: "${userInput}"
Current scripted response: "${scriptedResponse}"

Task: Extract the core trauma identity from the user's response and use it naturally in the template.

Template: "Feel [contextualized feeling]... what happens in yourself when you feel [contextualized feeling]?"

Rules:
1. Extract the core identity concept from the user's response
2. Remove unnecessary words like "someone who is", "a person who", "I am", etc.
3. Make it sound natural and conversational for trauma processing
4. Keep the exact template structure
5. Return only the rephrased response, nothing else

Examples:
        - User: "angry and hurt" → "Feel angry and hurt... what happens in yourself when you feel angry and hurt?"
        - User: "unable to trust" → "Feel unable to trust... what happens in yourself when you feel unable to trust?"
        - User: "like a victim" → "Feel like a victim... what happens in yourself when you feel like a victim?"
        - User: "powerless" → "Feel powerless... what happens in yourself when you feel powerless?"
        - User: "abandoned and alone" → "Feel abandoned and alone... what happens in yourself when you feel abandoned and alone?"

Extract the core trauma identity and apply the template now:`;
    // REMOVED: trauma_identity_check should use stored originalTraumaIdentity, not AI processing
    } else if (stepId === 'trauma_shifting_intro') {
      return `You are assisting with Mind Shifting sessions. The user has already provided their negative experience statement. Your task is to preserve their EXACT wording.

User's negative experience statement: "${userInput}"

CRITICAL: You must use the user's EXACT words for their negative experience. Do not change, rephrase, or modify their statement in any way.

The scripted response should use their negative experience exactly as stated: "${userInput}"

Return the scripted response using their exact wording without any modifications.`;
    } else if (stepId === 'reality_goal_capture') {
      return `You are assisting with Mind Shifting sessions. The user has already provided their goal statement. Your task is to preserve their EXACT wording.

User's goal statement: "${userInput}"

CRITICAL: You must use the user's EXACT words for their goal. Do not change, rephrase, or modify their goal statement in any way.

The scripted response should use their goal exactly as stated: "${userInput}"

Return the scripted response using their exact goal wording without any modifications.`;
    }
    
    // Fallback for any other steps
    return `You are a linguistic interpreter for Mind Shifting sessions. Your task is to contextualize the user's response.

User's response: "${userInput}"
Current scripted response: "${scriptedResponse}"

Task: Make the response more natural and conversational while maintaining the therapeutic structure.

Rules:
1. Keep the therapeutic intent intact
2. Make it sound more conversational
3. Use the user's actual words naturally
4. Return only the rephrased response, nothing else

Rephrase now:`;
  }

  /**
   * Get template response for linguistic processing
   */
  private getTemplateResponse(stepId: string, userResponse: string): string {
    switch (stepId) {
      case 'feel_solution_state':
        return `What would you feel like if "${userResponse}" had already happened?`;
      case 'feel_good_state':
        return `Feel "${userResponse}"... what does "${userResponse}" feel like?`;
      case 'body_sensation_check':
        return `Feel "${userResponse}"... what happens in yourself when you feel "${userResponse}"?`;
      case 'deeper_feeling_inquiry':
        return `Feel "${userResponse}"... what does "${userResponse}" feel like in your body?`;
      case 'sensation_progression':
        return `Feel "${userResponse}"... what happens to "${userResponse}" when you feel "${userResponse}"?`;
      case 'identity_dissolve_step_a':
        return `Feel yourself being "${userResponse}"... as "${userResponse}", what do you want?`;
      case 'identity_dissolve_step_b':
        return `Feel "${userResponse}"... what happens in yourself when you feel "${userResponse}"?`;
      // REMOVED: identity_check should use stored originalProblemIdentity, not AI processing
      case 'trauma_dissolve_step_a':
        return `Feel yourself being "${userResponse}"... what does it feel like?`;
      case 'trauma_dissolve_step_b':
        return `Feel "${userResponse}"... what happens in yourself when you feel "${userResponse}"?`;
      // REMOVED: trauma_identity_check should use stored originalTraumaIdentity, not AI processing
      default:
        return `Feel "${userResponse}"... what does that feel like?`;
    }
  }

  /**
   * Build minimal, focused prompt for AI - strict context only
   */
  private buildMinimalPrompt(request: AIAssistanceRequest): string {
    const { trigger, userInput, context, currentStep } = request;
    
    const baseContext = `You are assisting with Mind Shifting treatment.
Current step: ${currentStep.id}
Expected response type: ${currentStep.expectedResponseType}
User said: "${userInput}"
Issue: ${trigger.condition}`;

    switch (trigger.action) {
      case 'clarify':
        return `${baseContext}

The user seems stuck or confused. Provide a brief, gentle clarification to help them understand what's being asked. Keep it under 30 words and guide them back to the treatment protocol. Do not deviate from the Mind Shifting methodology.`;

      case 'focus':
        return `${baseContext}

The user mentioned multiple problems. Help them focus on just one problem for this session. Ask them to choose the most pressing issue. Keep response under 25 words.`;

      case 'simplify':
        return `${baseContext}

The user's response was too long or complex. This is a 30-second interruption case. Use the exact Mind Shifting protocol: "I'm just going to stop you there because in order to apply a Mind Shifting method to this we need to define the problem, so please can you tell me what the problem is in a few words."`;

      case 'redirect':
        return `${baseContext}

The user went off-topic. Gently redirect them back to the current step of the treatment. Keep response under 15 words.`;

      default:
        return `${baseContext}

Provide brief guidance to help the user continue with the treatment. Keep response under 20 words.`;
    }
  }

  /**
   * Call OpenAI API with actual implementation
   */
  private async callOpenAIService(prompt: string, isLinguisticProcessing: boolean = false): Promise<{ content: string; tokenCount: number; cost: number }> {
    const openai = createOpenAIClient();
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Cost-effective model for linguistic processing
        messages: [{ role: "system", content: prompt }],
        max_tokens: isLinguisticProcessing ? 100 : this.MAX_TOKENS,
        temperature: isLinguisticProcessing ? 0.3 : 0.7, // Lower temperature for consistent linguistic processing
      });

      const content = completion.choices[0].message.content || "";
      const tokenCount = completion.usage?.total_tokens || 0;
      
      // Calculate cost based on gpt-4o-mini pricing
      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;
      const cost = (inputTokens * 0.00015 / 1000) + (outputTokens * 0.0006 / 1000); // gpt-4o-mini pricing
      
      return {
        content: content.trim(),
        tokenCount,
        cost
      };
    } catch (error) {
      console.error('OpenAI API call failed:', error);
      throw error;
    }
  }

  /**
   * Format AI response to maintain treatment consistency
   */
  private formatAIResponse(aiContent: string, trigger: AITrigger): string {
    // Clean up the response and ensure it follows treatment protocols
    return aiContent.replace(/^\"|\"$/g, '').trim();
  }

  /**
   * Get fallback response when AI fails or limits exceeded
   */
  private getFallbackResponse(request: AIAssistanceRequest): AIAssistanceResponse {
    let fallbackMessage = "Please continue with the current step of the process.";
    
    // Provide contextual fallback based on step type
    if (this.isLinguisticProcessingStep(request.currentStep.id)) {
      const userResponse = request.userInput;
      fallbackMessage = this.getTemplateResponse(request.currentStep.id, userResponse);
    } else {
      // Use step-specific fallbacks for other AI triggers
      switch (request.trigger.action) {
        case 'clarify':
          fallbackMessage = "Take a moment to notice what you're feeling. What do you notice in your body?";
          break;
        case 'focus':
          fallbackMessage = "Let's focus on just one problem for now. Which issue feels most important to you?";
          break;
        case 'simplify':
          fallbackMessage = "I'm just going to stop you there because in order to apply a Mind Shifting method to this we need to define the problem, so please can you tell me what the problem is in a few words.";
          break;
        case 'redirect':
          fallbackMessage = "Let's return to the current step. What are you feeling in your body?";
          break;
      }
    }
    
    return {
      message: fallbackMessage,
      shouldReturnToScript: true,
      tokenCount: 0,
      cost: 0
    };
  }

  /**
   * Track AI usage for cost control
   */
  private trackUsage(sessionId: string): void {
    if (!this.usageStats.has(sessionId)) {
      this.usageStats.set(sessionId, {
        aiCallCount: 0,
        totalTokens: 0,
        totalCost: 0,
        sessionStart: new Date()
      });
    }
    
    const stats = this.usageStats.get(sessionId)!;
    stats.aiCallCount++;
  }

  /**
   * Check if session has exceeded AI usage limits
   */
  private hasExceededLimits(sessionId: string): boolean {
    const stats = this.usageStats.get(sessionId);
    if (!stats) return false;
    
    const sessionDuration = (new Date().getTime() - stats.sessionStart.getTime()) / 1000 / 60; // minutes
    const costPerMinute = stats.totalCost / Math.max(sessionDuration, 1);
    
    // Limit: Max 10 AI calls per session OR cost exceeding target
    return stats.aiCallCount > 10 || stats.totalCost > this.TARGET_COST_PER_SESSION;
  }

  /**
   * Update usage statistics after AI call
   */
  private updateUsageStats(sessionId: string, tokens: number, cost: number): void {
    const stats = this.usageStats.get(sessionId);
    if (stats) {
      stats.totalTokens += tokens;
      stats.totalCost += cost;
    }
  }

  /**
   * Get usage statistics for a session
   */
  getUsageStats(sessionId: string): SessionUsage | null {
    return this.usageStats.get(sessionId) || null;
  }

  /**
   * Get system-wide usage statistics
   */
  getSystemStats(): SystemStats {
    const sessions = Array.from(this.usageStats.values());
    const totalSessions = sessions.length;
    const sessionsWithAI = sessions.filter(s => s.aiCallCount > 0).length;
    
    return {
      totalSessions,
      sessionsWithAI,
      aiUsagePercentage: totalSessions > 0 ? (sessionsWithAI / totalSessions) * 100 : 0,
      avgCostPerSession: sessions.reduce((sum, s) => sum + s.totalCost, 0) / Math.max(totalSessions, 1),
      avgTokensPerSession: sessions.reduce((sum, s) => sum + s.totalTokens, 0) / Math.max(totalSessions, 1)
    };
  }
}

interface SessionUsage {
  aiCallCount: number;
  totalTokens: number;
  totalCost: number;
  sessionStart: Date;
}

interface SystemStats {
  totalSessions: number;
  sessionsWithAI: number;
  aiUsagePercentage: number;
  avgCostPerSession: number;
  avgTokensPerSession: number;
} 