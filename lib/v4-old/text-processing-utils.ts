import { TreatmentContext } from './types';

export class TextProcessingUtils {
  /**
   * Process identity response to convert emotions/adjectives to proper identity format
   */
  static processIdentityResponse(userInput: string): string {
    const input = userInput.toLowerCase().trim();
    const originalInput = userInput.trim(); // Preserve original casing
    
    // Handle patterns like "an angry one", "a sad one", "the frustrated one"
    const onePattern = /^(a|an|the)\s+(\w+)\s+one$/i;
    const match = input.match(onePattern);
    if (match) {
      const adjective = match[2];
      return `${adjective} person`;
    }
    
    // Handle patterns like "an angry person", "a sad person" - extract the adjective
    const personPattern = /^(a|an|the)\s+(\w+)\s+person$/i;
    const personMatch = input.match(personPattern);
    if (personMatch) {
      const adjective = personMatch[2];
      return `${adjective} person`;
    }
    
    // If it already contains identity markers, use as-is (preserve user's exact language)
    const identityMarkers = ['person', 'people', 'man', 'woman', 'child', 'kid', 'adult', 'parent', 'mother', 'father', 'mom', 'dad', 'friend', 'partner', 'spouse', 'husband', 'wife', 'someone', 'somebody', 'individual', 'victim', 'survivor', 'one who', 'type of'];
    const hasIdentityMarker = identityMarkers.some(marker => input.includes(marker));
    
    if (hasIdentityMarker) {
      return originalInput; // Preserve original casing and exact words
    }
    
    // For single words without identity markers, add "person"
    const wordCount = input.split(' ').length;
    if (wordCount === 1) {
      return `${originalInput} person`;
    }
    
    // For multi-word phrases without identity markers, check if they're descriptive
    const descriptivePatterns = [
      /^(very|really|quite|so|too)\s+\w+$/i, // "very sad", "really angry"
      /^\w+\s+(and|or)\s+\w+$/i, // "sad and angry", "hurt or angry"
      /^not\s+\w+$/i, // "not good", "not strong"
      /^like\s+/i // "like a failure" - keep as-is
    ];
    
    const matchesDescriptivePattern = descriptivePatterns.some(pattern => input.match(pattern));
    if (matchesDescriptivePattern && !input.startsWith('like')) {
      return `${originalInput} person`;
    }
    
    // Return as-is for complex responses or phrases starting with "like"
    return originalInput;
  }

  /**
   * Create positive belief statement by rearranging words while preserving user's exact language
   */
  static createPositiveBeliefStatement(belief: string): string {
    let result = belief.trim();
    
    // Handle "that I am [negative]" patterns
    if (result.match(/^that I am /i)) {
      if (!result.toLowerCase().includes(' not ')) {
        result = result.replace(/^(that I am )/i, '$1not ');
      }
      return result;
    }
    
    // Handle "that I must" → "that I don't have to"
    if (result.match(/^that I must/i)) {
      result = result.replace(/^that I must/gi, "that I don't have to");
      return result;
    }
    
    // Handle "I am [negative]" patterns
    if (result.match(/^I am /i)) {
      if (!result.toLowerCase().includes(' not ')) {
        result = result.replace(/^(I am )/i, '$1not ');
      }
      return result;
    }
    
    // Handle "I can't" → "I can"
    if (result.match(/I can't/i)) {
      result = result.replace(/I can't/gi, 'I can');
      return result;
    }
    
    // Handle "I must" → "I don't have to"
    if (result.match(/I must/i)) {
      result = result.replace(/I must/gi, "I don't have to");
      return result;
    }
    
    // Handle "I'm not" → "I'm"
    if (result.match(/I'm not /i)) {
      result = result.replace(/I'm not /gi, "I'm ");
      return result;
    }
    
    // Handle "I don't" → "I"
    if (result.match(/I don't/i)) {
      result = result.replace(/I don't /gi, 'I ');
      return result;
    }
    
    // Handle negation transformations
    result = result.replace(/nobody/gi, 'somebody');
    result = result.replace(/nothing/gi, 'something');
    result = result.replace(/never /gi, '');
    result = result.replace(/always fail/gi, "don't always fail");
    
    // If no specific pattern matched, try to add "not" in a sensible place
    if (result.match(/^that /i) && !result.toLowerCase().includes(' not ')) {
      result = result.replace(/^(that )/i, '$1I am not ');
      return result;
    }
    
    // Fallback: if we can't parse it, add "not" appropriately
    if (!result.toLowerCase().includes(' not ')) {
      if (result.match(/^I /i)) {
        result = result.replace(/^(I )/i, '$1am not ');
      } else {
        result = `that I am not ${result}`;
      }
    }
    
    return result;
  }

  /**
   * Count problems in user input for multiple problem detection
   */
  static countProblems(userInput: string): number {
    const problemConnectors = ['and', 'also', 'plus', 'additionally', 'another', 'other', 'too', 'as well', 'along with'];
    let count = 1; // Start with 1 problem
    problemConnectors.forEach(connector => {
      if (userInput.toLowerCase().includes(connector)) {
        count++;
      }
    });
    return count;
  }

  /**
   * Extract individual problems from user input
   */
  static extractProblems(userInput: string): string[] {
    const problems: string[] = [];
    const connectors = ['and', 'also', 'plus', 'additionally', 'another', 'other', 'too', 'as well', 'along with'];
    
    let remaining = userInput;
    for (const connector of connectors) {
      if (remaining.toLowerCase().includes(connector)) {
        const parts = remaining.split(new RegExp(`\\b${connector}\\b`, 'i'));
        problems.push(...parts.map(p => p.trim()).filter(p => p.length > 0));
        break; // Only split on the first connector found
      }
    }
    
    // If no connectors found, treat as single problem
    if (problems.length === 0) {
      problems.push(remaining.trim());
    }
    
    return problems.filter(p => p.length > 0);
  }

  /**
   * Determine if multiple problems were worked on during the session
   */
  static hasMultipleProblems(context: TreatmentContext): boolean {
    // Check if digging deeper was used and additional problems were found
    const dugDeeper = context.userResponses['digging_deeper_start'] === 'yes' || 
                      context.userResponses['future_problem_check'] === 'yes' ||
                      context.userResponses['identity_dig_deeper'] === 'yes' ||
                      context.userResponses['belief_dig_deeper'] === 'yes' ||
                      context.userResponses['blockage_dig_deeper'] === 'yes' ||
                      context.userResponses['trauma_dig_deeper'] === 'yes';
    
    return dugDeeper || (context.metadata.multipleProblems === true);
  }

  /**
   * Get the appropriate subject for Integration Questions
   */
  static getIntegrationSubject(context: TreatmentContext, workType: 'problem' | 'goal' | 'negative_experience'): string {
    if (workType === 'goal') {
      return context?.metadata?.currentGoal || context?.metadata?.goalStatement || 'your goal';
    } else if (workType === 'negative_experience') {
      if (this.hasMultipleProblems(context)) {
        return 'the whole topic';
      }
      return context?.metadata?.negativeExperienceStatement || context?.problemStatement || 'the negative experience';
    } else { // problem
      if (this.hasMultipleProblems(context)) {
        return 'the whole topic';
      }
      return context?.metadata?.problemStatement || context?.problemStatement || 'the problem';
    }
  }

  /**
   * Clean and format text responses
   */
  static cleanResponse(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }

  /**
   * Check if text contains emotional language
   */
  static containsEmotionalLanguage(text: string): boolean {
    const emotionWords = [
      'feel', 'feeling', 'felt', 'emotion', 'emotional', 'upset', 'angry', 'sad', 
      'happy', 'scared', 'worried', 'anxious', 'stressed', 'frustrated', 'hurt',
      'disappointed', 'excited', 'nervous', 'overwhelmed', 'confused'
    ];
    
    const lowerText = text.toLowerCase();
    return emotionWords.some(word => lowerText.includes(word));
  }

  /**
   * Extract key phrases from longer text
   */
  static extractKeyPhrases(text: string, maxPhrases: number = 3): string[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.slice(0, maxPhrases).map(s => s.trim());
  }

  /**
   * Normalize user input for consistent processing
   */
  static normalizeInput(input: string): string {
    return input.trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Check if input represents agreement (yes/positive response)
   */
  static isAgreement(input: string): boolean {
    const agreements = ['yes', 'y', 'yeah', 'yep', 'sure', 'ok', 'okay', 'correct', 'right', 'true', 'agree'];
    const normalized = this.normalizeInput(input);
    return agreements.some(agreement => normalized.includes(agreement));
  }

  /**
   * Check if input represents disagreement (no/negative response)
   */
  static isDisagreement(input: string): boolean {
    const disagreements = ['no', 'n', 'nope', 'wrong', 'incorrect', 'false', 'disagree', 'not right'];
    const normalized = this.normalizeInput(input);
    return disagreements.some(disagreement => normalized.includes(disagreement));
  }

  /**
   * Format response with proper capitalization and punctuation
   */
  static formatResponse(response: string): string {
    if (!response || response.length === 0) return response;
    
    // Capitalize first letter
    let formatted = response.charAt(0).toUpperCase() + response.slice(1);
    
    // Add period if not ending with punctuation
    if (!/[.!?]$/.test(formatted)) {
      formatted += '.';
    }
    
    return formatted;
  }

  /**
   * Truncate text to specified length with ellipsis
   */
  static truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}
