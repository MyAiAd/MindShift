import { TreatmentStep, TreatmentContext, ValidationResult, GoalLanguageDetection, QuestionLanguageDetection, DeadlineDetection } from './types';

export class ValidationHelpers {
  /**
   * Validate user input against step requirements
   */
  static validateUserInput(userInput: string, step: TreatmentStep, context?: TreatmentContext): ValidationResult {
    const trimmed = userInput.trim();
    const words = trimmed.split(' ').length;
    const lowerInput = trimmed.toLowerCase();
    
    console.log(`🚨 VALIDATION_CALLED: step="${step.id}", input="${userInput}", trimmed="${trimmed}", words=${words}`);
    
    // Special validation for introduction phase
    if (step.id === 'mind_shifting_explanation') {
      return this.validateMindShiftingExplanation(trimmed, words, lowerInput, context);
    }
    
    // Special validation for negative experience description step
    if (step.id === 'negative_experience_description') {
      return this.validateNegativeExperienceDescription(lowerInput);
    }

    // Special validation for goal description and goal capture
    if (step.id === 'goal_description' || step.id === 'reality_goal_capture') {
      return this.validateGoalDescription(lowerInput);
    }

    // Special validation for trauma shifting - negative experience should be single event
    if (step.id === 'trauma_shifting_intro') {
      return this.validateTraumaShiftingIntro(lowerInput);
    }
    
    // Special validation for work_type_description when asking for problems
    if (step.id === 'work_type_description' && context?.metadata?.workType === 'problem') {
      return this.validateWorkTypeDescriptionProblem(lowerInput, context);
    }

    // Special validation for work_type_description when asking for negative experiences
    if (step.id === 'work_type_description' && context?.metadata?.workType === 'negative_experience') {
      return this.validateWorkTypeDescriptionNegativeExperience(lowerInput);
    }

    // Special validation for problem-focused method intros
    const problemFocusedIntros = ['problem_shifting_intro_static', 'blockage_shifting_intro', 'identity_shifting_intro', 'belief_shifting_intro'];
    if (problemFocusedIntros.includes(step.id)) {
      return this.validateProblemFocusedIntro(lowerInput);
    }

    // Standard validation rules
    return this.validateStandardRules(trimmed, step);
  }

  private static validateMindShiftingExplanation(trimmed: string, words: number, lowerInput: string, context?: TreatmentContext): ValidationResult {
    // Skip validation for work type selection inputs (1, 2, 3)
    if (trimmed === '1' || trimmed === '2' || trimmed === '3') {
      return { isValid: true };
    }
    
    // Check if user stated it as a goal instead of problem
    const goalResult = this.detectGoalLanguageInProblemContext(lowerInput, trimmed);
    if (goalResult.hasGoalLanguage) {
      return { isValid: false, error: 'AI_VALIDATION_NEEDED:problem_vs_goal' };
    }
    
    // Check if user stated it as a question
    const questionResult = this.detectQuestionLanguage(lowerInput, trimmed);
    if (questionResult.hasQuestionLanguage) {
      return { isValid: false, error: 'AI_VALIDATION_NEEDED:problem_vs_question' };
    }
    
    // Check if user stated only a general emotion without context
    if (this.hasGeneralEmotionPattern(lowerInput, context)) {
      return { isValid: false, error: 'AI_VALIDATION_NEEDED:general_emotion' };
    }
    
    // Check if too long (over 20 words)
    if (words > 20) {
      return { isValid: false, error: 'OK I understand what you have said, but please tell me what the problem is in just a few words' };
    }

    return { isValid: true };
  }

  private static validateNegativeExperienceDescription(lowerInput: string): ValidationResult {
    // Check for multiple event indicators
    const multipleEventIndicators = [
      'always', 'often', 'repeatedly', 'throughout', 'during my childhood',
      'as a child', 'growing up', 'my entire childhood', 'for years',
      'every time', 'whenever', 'all the time', 'when I was young',
      'in my childhood', 'as a kid', 'while growing up'
    ];
    
    const hasMultipleEventIndicators = multipleEventIndicators.some(indicator => 
      lowerInput.includes(indicator)
    );
    
    if (hasMultipleEventIndicators) {
      return { isValid: false, error: 'AI_VALIDATION_NEEDED:single_negative_experience' };
    }

    return { isValid: true };
  }

  private static validateGoalDescription(lowerInput: string): ValidationResult {
    console.log(`🔍 GOAL_VALIDATION: Checking input in goal description: "${lowerInput}"`);
    
    // Check if user stated it as a problem instead of goal
    const problemResult = this.detectProblemLanguageInGoalContext(lowerInput);
    if (problemResult.hasGoalLanguage) {
      return { isValid: false, error: 'AI_VALIDATION_NEEDED:goal_vs_problem' };
    }
    
    // Check if user stated it as a question
    const questionResult = this.detectQuestionLanguage(lowerInput, lowerInput);
    if (questionResult.hasQuestionLanguage) {
      return { isValid: false, error: 'AI_VALIDATION_NEEDED:goal_vs_question' };
    }
    
    return { isValid: true };
  }

  private static validateTraumaShiftingIntro(lowerInput: string): ValidationResult {
    // Check for multiple event indicators
    const multipleEventIndicators = [
      'always', 'often', 'repeatedly', 'throughout', 'during my childhood',
      'as a child', 'growing up', 'my entire childhood', 'for years',
      'every time', 'whenever', 'all the time'
    ];
    
    const hasMultipleEventIndicators = multipleEventIndicators.some(indicator => 
      lowerInput.includes(indicator)
    );
    
    if (hasMultipleEventIndicators) {
      return { isValid: false, error: 'AI_VALIDATION_NEEDED:single_negative_experience' };
    }

    return { isValid: true };
  }

  private static validateWorkTypeDescriptionProblem(lowerInput: string, context?: TreatmentContext): ValidationResult {
    // Enhanced goal detection
    const goalResult = this.detectGoalLanguageInProblemContext(lowerInput, lowerInput);
    if (goalResult.hasGoalLanguage) {
      return { isValid: false, error: 'AI_VALIDATION_NEEDED:problem_vs_goal' };
    }
    
    // Enhanced question detection
    const questionResult = this.detectQuestionLanguage(lowerInput, lowerInput);
    if (questionResult.hasQuestionLanguage) {
      return { isValid: false, error: 'AI_VALIDATION_NEEDED:problem_vs_question' };
    }
    
    // Check for general emotion pattern
    if (this.hasGeneralEmotionPattern(lowerInput, context)) {
      return { isValid: false, error: 'AI_VALIDATION_NEEDED:general_emotion' };
    }
    
    // Check if this is an incomplete response to emotion context question
    if (context?.metadata?.originalEmotion && lowerInput.split(' ').length <= 2 && 
        !lowerInput.includes('yes') && !lowerInput.includes('no')) {
      if (context) {
        context.metadata.emotionContext = lowerInput;
      }
      return { isValid: false, error: 'AI_VALIDATION_NEEDED:incomplete_emotion_context' };
    }

    return { isValid: true };
  }

  private static validateWorkTypeDescriptionNegativeExperience(lowerInput: string): ValidationResult {
    // Check for multiple event indicators
    const multipleEventIndicators = [
      'always', 'often', 'repeatedly', 'throughout', 'during my childhood',
      'as a child', 'growing up', 'my entire childhood', 'for years',
      'every time', 'whenever', 'all the time', 'when I was young',
      'in my childhood', 'as a kid', 'while growing up'
    ];
    
    const hasMultipleEventIndicators = multipleEventIndicators.some(indicator => 
      lowerInput.includes(indicator)
    );
    
    if (hasMultipleEventIndicators) {
      return { isValid: false, error: 'AI_VALIDATION_NEEDED:single_negative_experience' };
    }

    return { isValid: true };
  }

  private static validateProblemFocusedIntro(lowerInput: string): ValidationResult {
    console.log(`🔍 PROBLEM_INTRO_VALIDATION: Checking input: "${lowerInput}"`);
    
    // Check if user stated it as a goal instead of problem
    const goalResult = this.detectGoalLanguageInProblemContext(lowerInput, lowerInput);
    if (goalResult.hasGoalLanguage) {
      return { isValid: false, error: 'AI_VALIDATION_NEEDED:problem_vs_goal' };
    }
    
    // Check if user stated it as a question
    const questionResult = this.detectQuestionLanguage(lowerInput, lowerInput);
    if (questionResult.hasQuestionLanguage) {
      return { isValid: false, error: 'AI_VALIDATION_NEEDED:problem_vs_question' };
    }
    
    return { isValid: true };
  }

  private static validateStandardRules(trimmed: string, step: TreatmentStep): ValidationResult {
    for (const rule of step.validationRules) {
      switch (rule.type) {
        case 'minLength':
          if (trimmed.length < (rule.value as number)) {
            return { isValid: false, error: rule.errorMessage };
          }
          break;
          
        case 'maxLength':
          if (trimmed.length > (rule.value as number)) {
            return { isValid: false, error: rule.errorMessage };
          }
          break;
          
        case 'containsKeywords':
          const keywords = rule.value as string[];
          const hasKeyword = keywords.some(keyword => 
            trimmed.toLowerCase().includes(keyword.toLowerCase())
          );
          if (!hasKeyword) {
            return { isValid: false, error: rule.errorMessage };
          }
          break;
      }
    }
    
    return { isValid: true };
  }

  private static hasGeneralEmotionPattern(lowerInput: string, context?: TreatmentContext): boolean {
    const generalEmotionPatterns = [
      // Direct "I feel/am [emotion]" patterns
      /^i\s+(feel|am|feel\s+like)\s+(mad|angry|sad|upset|stressed|anxious|worried|depressed|frustrated|scared|nervous|happy|excited|overwhelmed|confused|lost|stuck|tired|exhausted|lonely|hurt|disappointed|ashamed|guilty|embarrassed|helpless|hopeless|irritated|annoyed|furious|devastated|miserable|panicked|terrified|disgusted|bitter|resentful|jealous|envious|insecure|worthless|empty|numb|restless|impatient|bored|content|peaceful|grateful|proud|confident|optimistic|motivated|inspired|relieved|surprised|curious|playful|loving|joyful|blissful|serene|calm|relaxed|unhappy|uncomfortable|uneasy|troubled|disturbed|distressed)\.?$/i,
      // Simple emotion words (1-3 words max)
      /^(mad|angry|sad|upset|stressed|anxious|worried|depressed|frustrated|scared|nervous|happy|excited|overwhelmed|confused|lost|stuck|tired|exhausted|lonely|hurt|disappointed|ashamed|guilty|embarrassed|helpless|hopeless|irritated|annoyed|furious|devastated|miserable|panicked|terrified|disgusted|bitter|resentful|jealous|envious|insecure|worthless|empty|numb|restless|impatient|bored|content|peaceful|grateful|proud|confident|optimistic|motivated|inspired|relieved|surprised|curious|playful|loving|joyful|blissful|serene|calm|relaxed|unhappy|uncomfortable|uneasy|troubled|disturbed|distressed)\.?$/i,
      // "Feeling [emotion]" patterns
      /^feeling\s+(mad|angry|sad|upset|stressed|anxious|worried|depressed|frustrated|scared|nervous|happy|excited|overwhelmed|confused|lost|stuck|tired|exhausted|lonely|hurt|disappointed|ashamed|guilty|embarrassed|helpless|hopeless|irritated|annoyed|furious|devastated|miserable|panicked|terrified|disgusted|bitter|resentful|jealous|envious|insecure|worthless|empty|numb|restless|impatient|bored|content|peaceful|grateful|proud|confident|optimistic|motivated|inspired|relieved|surprised|curious|playful|loving|joyful|blissful|serene|calm|relaxed|unhappy|uncomfortable|uneasy|troubled|disturbed|distressed)\.?$/i
    ];
    
    const hasGeneralEmotionPattern = generalEmotionPatterns.some(pattern => pattern.test(lowerInput));
    
    if (hasGeneralEmotionPattern && context) {
      const emotion = this.extractEmotionFromInput(lowerInput);
      context.metadata.originalEmotion = emotion;
      console.log(`🔍 EMOTION_STORED: Stored originalEmotion="${emotion}" in context metadata`);
    }
    
    return hasGeneralEmotionPattern;
  }

  /**
   * Enhanced goal language detection with context awareness and confidence scoring
   */
  static detectGoalLanguageInProblemContext(lowerInput: string, originalInput: string): GoalLanguageDetection {
    // Define goal indicators with confidence weights
    const goalPatterns = [
      // High confidence - clear goal language
      { patterns: ['want to', 'wish to', 'hope to', 'plan to', 'would like to'], weight: 0.9, type: 'explicit_goal' },
      { patterns: ['goal', 'achieve', 'accomplish'], weight: 0.9, type: 'explicit_goal' },
      
      // Medium confidence - context dependent
      { patterns: ['become'], weight: 0.7, type: 'aspirational' },
      { patterns: ['need to', 'have to'], weight: 0.6, type: 'necessity' },
      { patterns: ['want', 'need'], weight: 0.5, type: 'desire' },
      
      // Lower confidence - highly context dependent
      { patterns: ['have'], weight: 0.3, type: 'possession' },
    ];

    // Special handling for "get" - context matters a lot
    const getPatterns = [
      // Goal contexts for "get"
      { patterns: ['get better', 'get help', 'get more', 'get to'], weight: 0.8, type: 'positive_get' },
      { patterns: ['get a job', 'get the promotion', 'get married'], weight: 0.9, type: 'achievement_get' },
      
      // Problem contexts for "get" (should NOT trigger goal detection)
      { patterns: ['get mad', 'get angry', 'get upset', 'get frustrated', 'get anxious', 'get depressed'], weight: -1.0, type: 'negative_get' },
      { patterns: ['get rid of', 'get over'], weight: 0.8, type: 'resolution_get' }, // These are actually goals
    ];

    let maxConfidence = 0;
    let matchedIndicator = '';

    // Check standard goal patterns
    for (const patternGroup of goalPatterns) {
      for (const pattern of patternGroup.patterns) {
        if (lowerInput.includes(pattern)) {
          let adjustedWeight = patternGroup.weight;
          
          // Context-aware confidence adjustment
          if (this.isInNegativeContext(lowerInput, pattern)) {
            adjustedWeight *= 0.5;
          }
          
          if (this.isInPositiveContext(lowerInput, pattern)) {
            adjustedWeight *= 1.2;
          }
          
          if (adjustedWeight > maxConfidence) {
            maxConfidence = adjustedWeight;
            matchedIndicator = pattern;
          }
        }
      }
    }

    // Check "get" patterns separately
    for (const getGroup of getPatterns) {
      for (const pattern of getGroup.patterns) {
        if (lowerInput.includes(pattern)) {
          if (getGroup.weight > maxConfidence) {
            maxConfidence = getGroup.weight;
            matchedIndicator = pattern;
          }
        }
      }
    }

    const threshold = 0.6;
    const hasGoalLanguage = maxConfidence >= threshold;

    return {
      hasGoalLanguage,
      matchedIndicator,
      confidence: maxConfidence
    };
  }

  /**
   * Enhanced question detection with context awareness
   */
  static detectQuestionLanguage(lowerInput: string, originalInput: string): QuestionLanguageDetection {
    const questionPatterns = [
      // High confidence question indicators
      { patterns: ['how can i', 'how do i', 'what should i', 'should i'], weight: 0.9 },
      { patterns: ['how can', 'how do', 'what should', 'why do', 'when will', 'where can'], weight: 0.8 },
      
      // Question mark
      { patterns: ['?'], weight: 0.7 },
    ];

    let maxConfidence = 0;
    let matchedIndicator = '';

    for (const patternGroup of questionPatterns) {
      for (const pattern of patternGroup.patterns) {
        if (pattern === '?' ? originalInput.trim().endsWith('?') : lowerInput.includes(pattern)) {
          if (patternGroup.weight > maxConfidence) {
            maxConfidence = patternGroup.weight;
            matchedIndicator = pattern === '?' ? 'ends with ?' : pattern;
          }
        }
      }
    }

    const threshold = 0.6;
    const hasQuestionLanguage = maxConfidence >= threshold;

    return {
      hasQuestionLanguage,
      matchedIndicator,
      confidence: maxConfidence
    };
  }

  /**
   * Problem language detection for goal contexts
   */
  static detectProblemLanguageInGoalContext(lowerInput: string): GoalLanguageDetection {
    const problemIndicators = ['problem', 'issue', 'trouble', 'difficulty', 'struggle', 'can\'t', 'cannot', 'unable to', 'don\'t', 'do not', 'not able', 'hard to', 'difficult to', 'not enough', 'lack of', 'need more'];
    const hasProblemLanguage = problemIndicators.some(indicator => lowerInput.includes(indicator));
    
    const matchedIndicator = problemIndicators.find(indicator => lowerInput.includes(indicator)) || '';
    
    return {
      hasGoalLanguage: hasProblemLanguage,
      matchedIndicator,
      confidence: hasProblemLanguage ? 0.8 : 0
    };
  }

  /**
   * Helper method to detect if a pattern is in negative context
   */
  private static isInNegativeContext(input: string, pattern: string): boolean {
    const negativeWords = ['not', 'never', 'can\'t', 'cannot', 'won\'t', 'don\'t', 'doesn\'t', 'shouldn\'t', 'couldn\'t'];
    const patternIndex = input.indexOf(pattern);
    if (patternIndex === -1) return false;
    
    // Check words before the pattern
    const beforePattern = input.substring(0, patternIndex);
    const wordsBeforePattern = beforePattern.split(' ').slice(-3); // Check last 3 words
    
    return negativeWords.some(negWord => wordsBeforePattern.includes(negWord));
  }

  /**
   * Helper method to detect if a pattern is in positive/aspirational context
   */
  private static isInPositiveContext(input: string, pattern: string): boolean {
    const positiveWords = ['really', 'truly', 'definitely', 'absolutely', 'desperately', 'badly'];
    const patternIndex = input.indexOf(pattern);
    if (patternIndex === -1) return false;
    
    // Check words around the pattern
    const beforePattern = input.substring(0, patternIndex);
    const afterPattern = input.substring(patternIndex + pattern.length);
    const contextWords = [...beforePattern.split(' ').slice(-2), ...afterPattern.split(' ').slice(0, 2)];
    
    return positiveWords.some(posWord => contextWords.includes(posWord));
  }

  /**
   * Extract emotion from user input for storing context
   */
  static extractEmotionFromInput(userInput: string): string {
    const input = userInput.toLowerCase().trim();
    
    // Common emotions list for extraction
    const emotions = [
      'mad', 'angry', 'sad', 'upset', 'stressed', 'anxious', 'worried', 'depressed', 
      'frustrated', 'scared', 'nervous', 'happy', 'excited', 'overwhelmed', 'confused', 
      'lost', 'stuck', 'tired', 'exhausted', 'lonely', 'hurt', 'disappointed', 'ashamed', 
      'guilty', 'embarrassed', 'helpless', 'hopeless', 'irritated', 'annoyed', 'furious', 
      'devastated', 'miserable', 'panicked', 'terrified', 'disgusted', 'bitter', 'resentful', 
      'jealous', 'envious', 'insecure', 'worthless', 'empty', 'numb', 'restless', 'impatient', 
      'bored', 'content', 'peaceful', 'grateful', 'proud', 'confident', 'optimistic', 
      'motivated', 'inspired', 'relieved', 'surprised', 'curious', 'playful', 'loving', 
      'joyful', 'blissful', 'serene', 'calm', 'relaxed', 'unhappy', 'uncomfortable', 'uneasy', 
      'troubled', 'disturbed', 'distressed'
    ];
    
    // Find the emotion in the input
    const foundEmotion = emotions.find(emotion => input.includes(emotion));
    return foundEmotion || 'this way';
  }

  /**
   * AI-powered deadline detection in goal statements
   */
  static detectDeadlineInGoal(goalStatement: string): DeadlineDetection {
    const input = goalStatement.toLowerCase().trim();
    
    // Define deadline patterns with confidence weights
    const deadlinePatterns = [
      // High confidence - explicit time references
      { patterns: ['by tomorrow', 'by next week', 'by next month', 'by the end of'], weight: 0.95, type: 'explicit_deadline' },
      { patterns: ['by monday', 'by tuesday', 'by wednesday', 'by thursday', 'by friday', 'by saturday', 'by sunday'], weight: 0.9, type: 'day_deadline' },
      { patterns: ['by january', 'by february', 'by march', 'by april', 'by may', 'by june', 'by july', 'by august', 'by september', 'by october', 'by november', 'by december'], weight: 0.9, type: 'month_deadline' },
      
      // Medium confidence - relative time references
      { patterns: ['tomorrow', 'next week', 'next month', 'this week', 'this month'], weight: 0.8, type: 'relative_deadline' },
      { patterns: ['soon', 'quickly', 'asap', 'as soon as possible'], weight: 0.7, type: 'urgency_deadline' },
      
      // Lower confidence - vague time references
      { patterns: ['today', 'now', 'immediately'], weight: 0.6, type: 'immediate_deadline' },
    ];

    let maxConfidence = 0;
    let matchedDeadline = '';

    // Check for deadline patterns
    for (const patternGroup of deadlinePatterns) {
      for (const pattern of patternGroup.patterns) {
        if (input.includes(pattern)) {
          if (patternGroup.weight > maxConfidence) {
            maxConfidence = patternGroup.weight;
            matchedDeadline = pattern;
          }
        }
      }
    }

    // Also check for date patterns (numbers + time units)
    const datePatterns = [
      /\b(\d{1,2})\s*(days?|weeks?|months?|years?)\b/i,
      /\bin\s*(\d{1,2})\s*(days?|weeks?|months?|years?)\b/i,
      /\bwithin\s*(\d{1,2})\s*(days?|weeks?|months?|years?)\b/i,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{1,2})\b/i,
      /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/,
      /\b(\d{1,2})-(\d{1,2})-(\d{2,4})\b/,
    ];

    for (const datePattern of datePatterns) {
      const match = goalStatement.match(datePattern);
      if (match && maxConfidence < 0.85) {
        maxConfidence = 0.85;
        matchedDeadline = match[0];
      }
    }

    // Threshold for deadline detection
    const threshold = 0.6;
    const hasDeadline = maxConfidence >= threshold;

    if (hasDeadline) {
      // Extract the deadline and synthesize the goal
      const deadline = this.extractDeadlineFromGoal(goalStatement, matchedDeadline);
      const synthesizedGoal = this.synthesizeGoalWithDeadline(goalStatement, deadline);
      
      return {
        hasDeadline: true,
        deadline,
        synthesizedGoal,
        confidence: maxConfidence
      };
    }

    return {
      hasDeadline: false,
      confidence: maxConfidence
    };
  }

  /**
   * Extract clean deadline from goal statement
   */
  static extractDeadlineFromGoal(goalStatement: string, matchedPattern: string): string {
    // Find the deadline phrase in the original statement (preserving case)
    const lowerGoal = goalStatement.toLowerCase();
    const lowerPattern = matchedPattern.toLowerCase();
    const index = lowerGoal.indexOf(lowerPattern);
    
    if (index !== -1) {
      // Extract the actual deadline phrase from the original statement
      const deadline = goalStatement.substring(index, index + matchedPattern.length);
      
      // Clean up common prefixes
      return deadline.replace(/^(by |in |within |on )/i, '').trim();
    }
    
    return matchedPattern;
  }

  /**
   * Synthesize goal statement with deadline properly formatted
   */
  static synthesizeGoalWithDeadline(goalStatement: string, deadline: string): string {
    // If the goal already contains the deadline in the correct format, return as-is
    const lowerGoal = goalStatement.toLowerCase();
    const lowerDeadline = deadline.toLowerCase();
    
    // Check if goal already ends with "by [deadline]" - if so, return as-is
    if (lowerGoal.endsWith(`by ${lowerDeadline}`)) {
      return goalStatement;
    }
    
    // Find and remove deadline patterns to get clean goal
    let cleanGoal = goalStatement;
    
    // Escape special regex characters in deadline
    const escapedDeadline = deadline.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Remove various deadline patterns (more comprehensive)
    cleanGoal = cleanGoal.replace(new RegExp(`\\s*by\\s+${escapedDeadline}\\b`, 'gi'), '');
    cleanGoal = cleanGoal.replace(new RegExp(`\\s*in\\s+${escapedDeadline}\\b`, 'gi'), '');
    cleanGoal = cleanGoal.replace(new RegExp(`\\s*within\\s+${escapedDeadline}\\b`, 'gi'), '');
    cleanGoal = cleanGoal.replace(new RegExp(`\\s*on\\s+${escapedDeadline}\\b`, 'gi'), '');
    
    // Remove standalone deadline if it appears at the end
    cleanGoal = cleanGoal.replace(new RegExp(`\\s*${escapedDeadline}\\s*$`, 'gi'), '');
    
    // Clean up extra spaces and punctuation
    cleanGoal = cleanGoal.replace(/\s+/g, ' ').trim();
    cleanGoal = cleanGoal.replace(/[,\s]+$/, ''); // Remove trailing commas/spaces
    
    // Only reconstruct if we actually removed something
    if (cleanGoal !== goalStatement) {
      return `${cleanGoal} by ${deadline}`;
    }
    
    // If no deadline patterns were found to remove, just append
    return `${goalStatement} by ${deadline}`;
  }
}
