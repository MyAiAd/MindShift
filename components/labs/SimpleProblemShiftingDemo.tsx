'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Brain, Mic, MicOff, Play, Square, AlertCircle, CheckCircle, MessageSquare, RotateCcw, ArrowRight, Volume2, Settings } from 'lucide-react';

type TreatmentModality = 'problem_shifting' | 'reality_shifting' | 'belief_shifting' | 'identity_shifting' | 'blockage_shifting' | 'trauma_shifting';

// Treatment modality definitions
const TREATMENT_MODALITIES = {
  problem_shifting: { name: 'Problem Shifting', description: 'Transform problems into solutions' },
  reality_shifting: { name: 'Reality Shifting', description: 'Achieve your goals and desires' },
  belief_shifting: { name: 'Belief Shifting', description: 'Change limiting beliefs' },
  identity_shifting: { name: 'Identity Shifting', description: 'Transform your sense of self' },
  blockage_shifting: { name: 'Blockage Shifting', description: 'Remove internal obstacles' },
  trauma_shifting: { name: 'Trauma Shifting', description: 'Process and heal trauma' }
};

interface TreatmentMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  stepId: string;
}

interface ProblemShiftingStep {
  id: string;
  title: string;
  script: string | ((userInput: string, context: any) => string);
  expectedResponseType: 'problem' | 'feeling' | 'experience' | 'open' | 'yesno';
  nextStep?: string;
}

// EXACT Problem Shifting steps from the working treatment state machine
const PROBLEM_SHIFTING_STEPS: ProblemShiftingStep[] = [
  {
    id: 'problem_capture',
    title: 'Problem Statement',
    script: 'Mind Shifting is not like counselling, therapy or life coaching. The Mind Shifting methods are verbal guided processes that we apply to problems, goals, or negative experiences in order to clear them. Please tell me what problem you want to work on in a few words.',
    expectedResponseType: 'problem',
    nextStep: 'problem_confirmation'
  },
  {
    id: 'problem_confirmation',
    title: 'Problem Confirmation',
    script: (userInput: string, context: any) => {
      const problemStatement = context?.problemStatement || userInput || 'your problem';
      return `I heard you say '${problemStatement}'. Is that correct?`;
    },
    expectedResponseType: 'yesno',
    nextStep: 'problem_confirmation_response'
  },
  {
    id: 'problem_confirmation_response',
    title: 'Problem Confirmation Response',
    script: (userInput: string, context: any) => {
      const input = (userInput || '').toLowerCase().trim();
      console.log(`🎯 SIMPLE_DEMO: Confirmation input analysis: "${input}"`);
      
      // Check for negative responses first (more specific)
      if (input.includes('no') || input.includes('not correct') || input.includes('wrong') || input.includes('incorrect')) {
        console.log(`🎯 SIMPLE_DEMO: Detected negative response`);
        return 'RESTART_PROBLEM_CAPTURE';
      } else if (input.includes('yes') || input.includes('correct') || input.includes('right')) {
        console.log(`🎯 SIMPLE_DEMO: Detected positive response`);
        return 'CONFIRMED_PROCEED_TO_TREATMENT';
      } else {
        console.log(`🎯 SIMPLE_DEMO: Ambiguous response, asking for clarification`);
        return 'Please answer yes or no. Is that what you want to work on?';
      }
    },
    expectedResponseType: 'yesno',
    nextStep: 'problem_shifting_intro'
  },
  {
    id: 'problem_shifting_intro',
    title: 'Problem Shifting Introduction',
    script: (userInput: string, context: any) => {
      const problemStatement = context?.problemStatement || 'the problem';
      return `Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. When I ask 'what needs to happen for the problem to not be a problem?' allow your answers to be different each time.

Feel the problem '${problemStatement}'... what does it feel like?`;
    },
    expectedResponseType: 'feeling',
    nextStep: 'body_sensation_check'
  },
  {
    id: 'body_sensation_check',
    title: 'Body Sensation Check',
    script: (userInput: string) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`,
    expectedResponseType: 'experience',
    nextStep: 'what_needs_to_happen_step'
  },
  {
    id: 'what_needs_to_happen_step',
    title: 'What Needs to Happen',
    script: 'What needs to happen for the problem to not be a problem?',
    expectedResponseType: 'open',
    nextStep: 'feel_solution_state'
  },
  {
    id: 'feel_solution_state',
    title: 'Feel Solution State',
    script: (userInput: string) => `What would you feel like if '${userInput || 'that'}' had already happened?`,
    expectedResponseType: 'feeling',
    nextStep: 'feel_good_state'
  },
  {
    id: 'feel_good_state',
    title: 'Feel Good State',
    script: (userInput: string) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
    expectedResponseType: 'experience',
    nextStep: 'what_happens_step'
  },
  {
    id: 'what_happens_step',
    title: 'What Happens in Good State',
    script: (userInput: string) => `What happens to '${userInput || 'that'}' when you feel '${userInput || 'that'}'?`,
    expectedResponseType: 'experience',
    nextStep: 'check_if_still_problem'
  },
  {
    id: 'check_if_still_problem',
    title: 'Check if Still Problem',
    script: (userInput: string, context: any) => {
      const problemStatement = context?.problemStatement || 'the problem';
      return `Can you still feel the problem '${problemStatement}'?`;
    },
    expectedResponseType: 'yesno',
    nextStep: 'session_complete'
  },
  {
    id: 'session_complete',
    title: 'Session Complete',
    script: 'Thank you for participating in this Mind Shifting demo. The treatment process has been completed.',
    expectedResponseType: 'open'
  }
];

// Complete treatment modality step definitions
const TREATMENT_MODALITY_STEPS = {
  problem_shifting: [
    { title: 'Problem Statement', description: 'State the problem you want to work on' },
    { title: 'Problem Shifting Introduction', description: 'Feel the problem and describe what it feels like' },
    { title: 'Body Sensation Check', description: 'Notice what happens in your body with that feeling' },
    { title: 'What Needs to Happen', description: 'Identify what needs to happen for the problem to not be a problem' },
    { title: 'Feel Solution State', description: 'Imagine how you would feel if that had already happened' },
    { title: 'Feel Good State', description: 'Experience and describe that good feeling' },
    { title: 'What Happens in Good State', description: 'Notice what happens when you feel that way' },
    { title: 'Check if Still Problem', description: 'Check if you can still feel the original problem' },
    { title: 'Session Complete', description: 'Treatment process completed' }
  ],
  reality_shifting: [
    { title: 'Goal Statement', description: 'State what you want to achieve' },
    { title: 'Goal Deadline Check', description: 'Determine if there is a deadline for your goal' },
    { title: 'Goal Confirmation', description: 'Confirm your goal statement' },
    { title: 'Goal Certainty', description: 'Rate your certainty about achieving this goal' },
    { title: 'Reality Shifting Introduction', description: 'Feel having achieved your goal' },
    { title: 'Reality Step A2', description: 'Notice what you can feel now' },
    { title: 'Reality Step A3', description: 'Describe what that feels like' },
    { title: 'Reality Step B', description: 'Explore why the goal might not be possible' },
    { title: 'Why Not Possible', description: 'Identify the main reason it might not be possible' },
    { title: 'Feel Reason', description: 'Feel that reason and describe what it feels like' },
    { title: 'Feel Reason 2', description: 'Notice what you can feel now' },
    { title: 'Feel Reason 3', description: 'Notice the first thing about that feeling' },
    { title: 'Checking Questions', description: 'Answer checking questions about your doubt' },
    { title: 'Doubt Reason', description: 'Explore the reason for your doubt' },
    { title: 'Reality Cycle B2', description: 'Continue the reality shifting cycle' },
    { title: 'Reality Cycle B3', description: 'Further exploration of the cycle' },
    { title: 'Reality Cycle B4', description: 'Complete the reality cycle' },
    { title: 'Certainty Check', description: 'Check your certainty level again' },
    { title: 'Integration', description: 'Integrate the insights and plan actions' }
  ],
  belief_shifting: [
    { title: 'Problem Statement', description: 'State the belief-related problem' },
    { title: 'Belief Shifting Introduction', description: 'Feel the problem and what it feels like' },
    { title: 'Belief Step B', description: 'Feel that feeling and describe what it feels like' },
    { title: 'Belief Step C', description: 'Notice what happens when you feel that' },
    { title: 'Belief Step D', description: 'Explore what needs to happen' },
    { title: 'Belief Step E', description: 'Feel that solution state' },
    { title: 'Belief Step F', description: 'Experience the good feeling' },
    { title: 'Belief Step G', description: 'Notice what happens in that good state' },
    { title: 'Belief Check', description: 'Check if you can still feel the original problem' },
    { title: 'Integration', description: 'Integrate insights and plan actions' }
  ],
  identity_shifting: [
    { title: 'Problem Statement', description: 'State the identity-related problem' },
    { title: 'Identity Shifting Introduction', description: 'Feel the problem and describe the feeling' },
    { title: 'Identity Dissolve Step A', description: 'Feel yourself being that identity and what you want' },
    { title: 'Identity Dissolve Step B', description: 'Exaggerate the feeling and notice what you observe' },
    { title: 'Identity Dissolve Step C', description: 'Continue the dissolving process' },
    { title: 'Identity Dissolve Step D', description: 'Further dissolution work' },
    { title: 'Identity Dissolve Step E', description: 'Complete the dissolution process' },
    { title: 'Identity Step 3 Intro', description: 'Introduction to identity checking' },
    { title: 'Identity Check', description: 'Check if you can still feel being that identity' },
    { title: 'Future Check', description: 'Check how you feel about the future' },
    { title: 'Problem Check', description: 'Check if the original problem is still there' },
    { title: 'Integration', description: 'Integrate insights and plan actions' }
  ],
  blockage_shifting: [
    { title: 'Problem Statement', description: 'State the blockage-related problem' },
    { title: 'Blockage Shifting Introduction', description: 'Feel the problem and describe the feeling' },
    { title: 'Blockage Step B', description: 'Feel that feeling and describe what it feels like' },
    { title: 'Blockage Step C', description: 'Notice what happens when you feel that' },
    { title: 'Blockage Step D', description: 'Feel the feeling again and describe it' },
    { title: 'Blockage Step E', description: 'Continue working with the blockage feeling' },
    { title: 'Blockage Check', description: 'Check if you can still feel the original problem' },
    { title: 'Integration', description: 'Integrate insights and plan actions' }
  ],
  trauma_shifting: [
    { title: 'Negative Experience Statement', description: 'Describe the negative experience' },
    { title: 'Trauma Shifting Introduction', description: 'Feel the experience and describe the feeling' },
    { title: 'Problem Redirect', description: 'Redirect if needed to focus on single experience' },
    { title: 'Identity Step', description: 'Identify how you see yourself from this experience' },
    { title: 'Trauma Dissolve Step A', description: 'Feel being that identity and what you want' },
    { title: 'Trauma Dissolve Step B', description: 'Exaggerate the feeling and notice what you observe' },
    { title: 'Trauma Dissolve Step C', description: 'Continue the trauma dissolution process' },
    { title: 'Trauma Dissolve Step D', description: 'Further dissolution work' },
    { title: 'Trauma Dissolve Step E', description: 'Complete the dissolution process' },
    { title: 'Trauma Identity Check', description: 'Check if you can still feel being that identity' },
    { title: 'Integration', description: 'Integrate insights and plan actions' }
  ]
};

export default function UnifiedTreatmentDemo() {
  const [status, setStatus] = useState<string>('idle');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string>('');
  const [messages, setMessages] = useState<TreatmentMessage[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedModality, setSelectedModality] = useState<TreatmentModality>('problem_shifting');
  const [showModalitySelector, setShowModalitySelector] = useState(false);
  const [sessionContext, setSessionContext] = useState<any>({
    problemStatement: '',
    userResponses: {}
  });
  
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const listeningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<string>('idle');
  const isListeningRef = useRef<boolean>(false);
  const currentStepIndexRef = useRef<number>(0);
  const lastSpokenTextRef = useRef<string>('');
  const recentSpokenTextsRef = useRef<string[]>([]); // Store multiple recent speeches
  const problemStatementRef = useRef<string>(''); // Persistent problem statement storage

  const currentStep = PROBLEM_SHIFTING_STEPS[currentStepIndex];

  // Keep refs in sync with state
  useEffect(() => {
    console.log(`🎯 SIMPLE_DEMO: STATUS CHANGED: "${statusRef.current}" → "${status}"`);
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  // Debug: Log step changes
  useEffect(() => {
    console.log(`🎯 SIMPLE_DEMO: STEP CHANGED: Now on step ${currentStepIndex + 1}/${PROBLEM_SHIFTING_STEPS.length} - ${currentStep.title}`);
  }, [currentStepIndex, currentStep.title]);

  const addMessage = useCallback((content: string, isUser: boolean, stepId: string) => {
    const message: TreatmentMessage = {
      id: Date.now().toString(),
      content,
      isUser,
      timestamp: new Date(),
      stepId
    };
    setMessages(prev => [...prev, message]);
  }, []);

  const getScriptedResponse = (step: ProblemShiftingStep, userInput: string = '', context?: any): string => {
    if (typeof step.script === 'function') {
      return step.script(userInput, context || sessionContext);
    }
    return step.script;
  };

  // Fast browser TTS for short texts
  const speakWithBrowserTTS = (text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => {
        console.log(`🎯 SIMPLE_DEMO: Browser TTS completed`);
        setIsSpeaking(false);
        
                  // Auto-start listening after TTS completes (if demo is active)
          if (statusRef.current === 'active') {
            console.log(`🎯 SIMPLE_DEMO: Auto-starting speech recognition after browser TTS`);
            setTimeout(() => {
              if (statusRef.current === 'active') {
                console.log(`🎯 SIMPLE_DEMO: Starting listening after browser TTS buffer`);
                startListening();
              }
            }, 800); // Longer buffer to prevent audio feedback
          }
        
        resolve();
      };

      utterance.onerror = (event) => {
        console.error(`🎯 SIMPLE_DEMO: Browser TTS error:`, event);
        setIsSpeaking(false);
        reject(new Error('Browser TTS failed'));
      };

      console.log(`🎯 SIMPLE_DEMO: Using browser TTS`);
      speechSynthesis.speak(utterance);
    });
  };

  // Validation logic from working treatment system
  const validateUserInput = (transcript: string, stepId: string): { isValid: boolean; error?: string } => {
    const trimmed = transcript.trim();
    const lowerInput = trimmed.toLowerCase();
    const words = trimmed.split(/\s+/).length;

    console.log(`🎯 SIMPLE_DEMO: Validating input "${transcript}" for step: ${stepId}`);

    // Validation for problem_capture step
    if (stepId === 'problem_capture') {
      // Check if user stated it as a goal instead of problem
      const goalIndicators = ['want to', 'want', 'wish to', 'hope to', 'plan to', 'goal', 'achieve', 'get', 'become', 'have', 'need to', 'would like to'];
      const hasGoalLanguage = goalIndicators.some(indicator => lowerInput.includes(indicator));
      
      if (hasGoalLanguage) {
        return { isValid: false, error: 'How would you state that as a problem instead of a goal?' };
      }
      
      // Check if user stated it as a question
      const questionIndicators = ['how can', 'how do', 'what should', 'why do', 'when will', 'where can', 'should i', 'how do i', 'what can i'];
      const hasQuestionLanguage = questionIndicators.some(indicator => lowerInput.includes(indicator)) || trimmed.endsWith('?');
      
      if (hasQuestionLanguage) {
        return { isValid: false, error: 'How would you state that as a problem instead of a question?' };
      }

      // Check if user stated only an emotion
      const emotionWords = ['stressed', 'anxious', 'sad', 'angry', 'worried', 'depressed', 'frustrated', 'upset', 'scared', 'nervous'];
      if (words <= 2 && emotionWords.some(emotion => lowerInput.includes(emotion))) {
        const emotion = emotionWords.find(emotion => lowerInput.includes(emotion));
        return { isValid: false, error: `What are you ${emotion} about?` };
      }

      // Check for multiple problems
      const problemConnectors = ['and', 'also', 'plus', 'additionally', 'another', 'other', 'too', 'as well', 'along with'];
      const singleConceptPhrases = [
        'love and peace', 'peace and love', 'health and wellness', 'wellness and health',
        'happy and healthy', 'healthy and happy', 'mind and body', 'body and mind',
        'work and life', 'life and work', 'friends and family', 'family and friends'
      ];
      
      const isSingleConcept = singleConceptPhrases.some(phrase => lowerInput.includes(phrase));
      
      if (!isSingleConcept) {
        const hasMultipleProblems = problemConnectors.some(connector => lowerInput.includes(connector));
        if (hasMultipleProblems) {
          return { isValid: false, error: 'Let\'s make sure this is only one issue and not multiple. Can you tell me the main problem you\'d like to focus on?' };
        }
      }

      // Check for too short input
      if (words < 2) {
        return { isValid: false, error: 'Please tell me a bit more about the problem you want to work on.' };
      }
    }

    return { isValid: true };
  };

  // Simple TTS using OpenAI API
  const speakText = async (text: string) => {
    if (isSpeaking) {
      console.log(`🎯 SIMPLE_DEMO: Already speaking, skipping`);
      return;
    }

    try {
      setIsSpeaking(true);
      lastSpokenTextRef.current = text.toLowerCase(); // Store what we're speaking
      
      // Store in recent speeches array (keep last 3 speeches)
      recentSpokenTextsRef.current.push(text.toLowerCase());
      if (recentSpokenTextsRef.current.length > 3) {
        recentSpokenTextsRef.current.shift(); // Remove oldest
      }
      
      console.log(`🎯 SIMPLE_DEMO: Speaking: "${text}"`);

      // DISABLED: Browser TTS to prevent voice switching mid-session
      // Browser TTS uses system default voice which can be different gender than OpenAI voices
      // This was causing voice switching when browser TTS failed and fell back to OpenAI
      // if ('speechSynthesis' in window && text.length < 200) {
      //   try {
      //     await speakWithBrowserTTS(text);
      //     return;
      //   } catch (browserError) {
      //     console.log(`🎯 SIMPLE_DEMO: Browser TTS failed, falling back to OpenAI TTS`);
      //   }
      // }

      // Fallback to OpenAI TTS
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          voice: 'nova', // Consistent female voice across all demos
          model: 'tts-1-hd', // Higher quality model for cleaner audio
          speed: 1.0 // Normal speed to avoid artifacts
        })
      });

      if (!response.ok) {
        throw new Error(`TTS API failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      return new Promise<void>((resolve, reject) => {
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;
        
        audio.onplay = () => {
          console.log(`🎯 SIMPLE_DEMO: TTS started`);
        };
        
        audio.onended = () => {
          console.log(`🎯 SIMPLE_DEMO: TTS completed`);
          console.log(`🎯 SIMPLE_DEMO: Current status: ${statusRef.current}`);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          setIsSpeaking(false);
          
          // Auto-start listening after TTS completes (if demo is active)
          if (statusRef.current === 'active') {
            console.log(`🎯 SIMPLE_DEMO: Auto-starting speech recognition after OpenAI TTS`);
            setTimeout(() => {
              console.log(`🎯 SIMPLE_DEMO: Starting listening after OpenAI TTS buffer`);
              console.log(`🎯 SIMPLE_DEMO: Current isListening state:`, isListening);
              if (statusRef.current === 'active') {
                startListening();
              }
            }, 600); // Buffer to prevent audio feedback
          } else {
            console.log(`🎯 SIMPLE_DEMO: Not auto-starting - status is: ${statusRef.current}`);
          }
          
          resolve();
        };
        
        audio.onerror = (event) => {
          console.error(`🎯 SIMPLE_DEMO: TTS error:`, event);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          setIsSpeaking(false);
          reject(new Error('TTS playback failed'));
        };
        
        audio.play().catch(reject);
      });
      
    } catch (error) {
      console.error(`🎯 SIMPLE_DEMO: TTS failed:`, error);
      setIsSpeaking(false);
      throw error;
    }
  };

  // Process user transcript
  const processUserTranscript = async (transcript: string) => {
    const currentStepFromRef = PROBLEM_SHIFTING_STEPS[currentStepIndexRef.current];
    console.log(`🎯 SIMPLE_DEMO: Processing transcript: "${transcript}" for step: ${currentStepFromRef.id}`);
    
    // Enhanced audio feedback filtering - check against multiple recent speeches
    const transcriptLower = transcript.toLowerCase().trim();
    const recentSpeeches = recentSpokenTextsRef.current;
    
    // Check if transcript matches any recent speech (using multiple strategies)
    for (const spokenText of recentSpeeches) {
      // Strategy 1: Check if transcript is contained in spoken text
      if (spokenText.includes(transcriptLower)) {
        console.log(`🎯 SIMPLE_DEMO: IGNORING AUDIO FEEDBACK: "${transcript}" is contained in recent TTS: "${spokenText}"`);
        return;
      }
      
      // Strategy 2: Check if spoken text is contained in transcript  
      if (transcriptLower.includes(spokenText)) {
        console.log(`🎯 SIMPLE_DEMO: IGNORING AUDIO FEEDBACK: "${transcript}" contains recent TTS: "${spokenText}"`);
        return;
      }
      
      // Strategy 3: Check for significant word overlap (for partial matches)
      // BUT exclude common conversational words that naturally appear in responses
      const transcriptWords = transcriptLower.split(' ').filter(w => w.length > 2);
      const spokenWords = spokenText.split(' ').filter(w => w.length > 2);
      
      // Exclude common conversational words that naturally overlap between questions and answers
      const conversationalWords = ['feel', 'would', 'like', 'what', 'when', 'how', 'that', 'this', 'the', 'and', 'but', 'for', 'with', 'you', 'your', 'can', 'could', 'will', 'have', 'had', 'been', 'was', 'were', 'are', 'is'];
      const meaningfulTranscriptWords = transcriptWords.filter(w => !conversationalWords.includes(w));
      const meaningfulSpokenWords = spokenWords.filter(w => !conversationalWords.includes(w));
      
      if (meaningfulTranscriptWords.length >= 3 && meaningfulSpokenWords.length >= 3) {
        const commonMeaningfulWords = meaningfulTranscriptWords.filter(word => meaningfulSpokenWords.includes(word));
        const meaningfulOverlapRatio = commonMeaningfulWords.length / Math.min(meaningfulTranscriptWords.length, meaningfulSpokenWords.length);
        
        // Higher threshold for meaningful words (80%) and require at least 3 meaningful overlaps
        if (meaningfulOverlapRatio > 0.8 && commonMeaningfulWords.length >= 3) {
          console.log(`🎯 SIMPLE_DEMO: IGNORING AUDIO FEEDBACK: "${transcript}" has ${Math.round(meaningfulOverlapRatio * 100)}% meaningful word overlap with recent TTS: "${spokenText}" (common: ${commonMeaningfulWords.join(', ')})`);
          return;
        }
      }
    }
    
    // Validate input for current step
    const validation = validateUserInput(transcript, currentStepFromRef.id);
    console.log(`🎯 SIMPLE_DEMO: VALIDATION: Step "${currentStepFromRef.id}" - Input "${transcript}" - Valid: ${validation.isValid}`);
    
    if (!validation.isValid) {
      console.log(`🎯 SIMPLE_DEMO: VALIDATION FAILED: ${validation.error}`);
      addMessage(transcript, true, currentStepFromRef.id);
      
      // Speak the correction message
      setTimeout(() => {
        speakText(validation.error!);
      }, 500);
      return; // Don't advance to next step
    }
    
    console.log(`🎯 SIMPLE_DEMO: VALIDATION PASSED: Proceeding to next step`);
    console.log(`🎯 SIMPLE_DEMO: Current sessionContext:`, JSON.stringify(sessionContext, null, 2));

    // Store user response in context
    const newContext = {
      ...sessionContext,
      userResponses: {
        ...sessionContext.userResponses,
        [currentStepFromRef.id]: transcript
      }
    };

    // Store problem statement from first step ONLY
    if (currentStepFromRef.id === 'problem_capture') {
      newContext.problemStatement = transcript;
      problemStatementRef.current = transcript; // Store in persistent ref
      console.log(`🎯 SIMPLE_DEMO: Stored problem statement: "${transcript}" (both in context and ref)`);
    }
    
    // CRITICAL: Ensure problem statement is preserved across all steps
    // If we have a problem statement in sessionContext, keep it in newContext
    if (sessionContext.problemStatement && !newContext.problemStatement) {
      newContext.problemStatement = sessionContext.problemStatement;
      console.log(`🎯 SIMPLE_DEMO: Preserved problem statement from session: "${sessionContext.problemStatement}"`);
    }

    console.log(`🎯 SIMPLE_DEMO: Context before processing:`, JSON.stringify(newContext, null, 2));
    console.log(`🎯 SIMPLE_DEMO: About to call setSessionContext with:`, JSON.stringify(newContext, null, 2));
    setSessionContext(newContext);
    console.log(`🎯 SIMPLE_DEMO: setSessionContext called (async, may not be updated yet)`);
    addMessage(transcript, true, currentStepFromRef.id);

    // Handle special confirmation responses AFTER we advance to the response step
    const currentStepIndex = currentStepIndexRef.current;
    if (currentStepIndex < PROBLEM_SHIFTING_STEPS.length - 1) {
      const nextIndex = currentStepIndex + 1;
      const nextStep = PROBLEM_SHIFTING_STEPS[nextIndex];
      
              // If we're moving to the confirmation response step, handle the logic
        if (nextStep.id === 'problem_confirmation_response') {
          // CRITICAL: Use newContext which has the correct problem statement
          const contextForConfirmation = {
            ...newContext,
            // Ensure we have the problem statement from the previous step
            problemStatement: newContext.problemStatement || sessionContext.problemStatement
          };
          const nextResponse = getScriptedResponse(nextStep, transcript, contextForConfirmation);
        console.log(`🎯 SIMPLE_DEMO: Confirmation response: "${nextResponse}"`);
        
        // Handle confirmation flow
        if (nextResponse === 'CONFIRMED_PROCEED_TO_TREATMENT') {
          console.log(`🎯 SIMPLE_DEMO: User confirmed, validating final problem statement`);
          
          // Now validate the confirmed problem statement against guardrails
          // CRITICAL: Get problem statement from userResponses since sessionContext is empty
          // The problem statement should be in the problem_capture response from userResponses
          let finalProblemStatement = newContext.problemStatement || 
                                    contextForConfirmation.problemStatement ||
                                    newContext.userResponses?.problem_capture ||
                                    sessionContext.userResponses?.problem_capture;
          
          // If still not found, search through all userResponses for problem_capture
          if (!finalProblemStatement) {
            // Check if we have any userResponses with problem_capture
            const allResponses = { ...sessionContext.userResponses, ...newContext.userResponses };
            finalProblemStatement = allResponses.problem_capture;
            console.log(`🎯 SIMPLE_DEMO: Searching all responses for problem statement:`, JSON.stringify(allResponses, null, 2));
          }
          
          // Final fallback: use the persistent ref
          if (!finalProblemStatement) {
            finalProblemStatement = problemStatementRef.current;
            console.log(`🎯 SIMPLE_DEMO: Using problem statement from persistent ref: "${finalProblemStatement}"`);
          }
          console.log(`🎯 SIMPLE_DEMO: Final problem statement to validate: "${finalProblemStatement}"`);
          console.log(`🎯 SIMPLE_DEMO: Full context:`, JSON.stringify(newContext, null, 2));
          
          // Check if it's stated as a goal instead of problem
          const lowerInput = (finalProblemStatement || '').toLowerCase();
          const goalIndicators = ['want to', 'want', 'wish to', 'hope to', 'plan to', 'goal', 'achieve', 'get', 'become', 'have', 'need to', 'would like to'];
          const hasGoalLanguage = goalIndicators.some(indicator => lowerInput.includes(indicator));
          
          if (hasGoalLanguage) {
            console.log(`🎯 SIMPLE_DEMO: Problem statement contains goal language, asking for reframe`);
            const goalReframeMessage = "How would you state that as a problem instead of a goal? Please tell me what problem you want to work on in a few words.";
            addMessage(goalReframeMessage, false, 'validation_error');
            speakText(goalReframeMessage);
            setCurrentStepIndex(0); // Go back to problem capture
            setSessionContext({ problemStatement: '', userResponses: {} });
            problemStatementRef.current = ''; // Reset persistent ref
            return;
          }
          
          // Check if it's stated as a question
          const questionIndicators = ['how can', 'how do', 'what should', 'why do', 'when will', 'where can', 'should i', 'how do i', 'what can i'];
          const hasQuestionLanguage = questionIndicators.some(indicator => lowerInput.includes(indicator)) || finalProblemStatement?.endsWith('?');
          
          if (hasQuestionLanguage) {
            console.log(`🎯 SIMPLE_DEMO: Problem statement is a question, asking for reframe`);
            const questionReframeMessage = "How would you state that as a problem instead of a question? Please tell me what problem you want to work on in a few words.";
            addMessage(questionReframeMessage, false, 'validation_error');
            speakText(questionReframeMessage);
            setCurrentStepIndex(0); // Go back to problem capture
            setSessionContext({ problemStatement: '', userResponses: {} });
            problemStatementRef.current = ''; // Reset persistent ref
            return;
          }
          
          // Skip to treatment intro (problem_shifting_intro) 
          const treatmentIntroIndex = PROBLEM_SHIFTING_STEPS.findIndex(step => step.id === 'problem_shifting_intro');
          if (treatmentIntroIndex !== -1) {
            console.log(`🎯 SIMPLE_DEMO: Validation passed, proceeding to treatment`);
            setCurrentStepIndex(treatmentIntroIndex);
            const treatmentStep = PROBLEM_SHIFTING_STEPS[treatmentIntroIndex];
            
            // CRITICAL: Create context with correct problem statement for treatment
            const treatmentContext = {
              ...newContext,
              problemStatement: finalProblemStatement // Use the validated problem statement
            };
            console.log(`🎯 SIMPLE_DEMO: Treatment context:`, JSON.stringify(treatmentContext, null, 2));
            
            const treatmentResponse = getScriptedResponse(treatmentStep, transcript, treatmentContext);
            addMessage(treatmentResponse, false, treatmentStep.id);
            speakText(treatmentResponse);
            return;
          }
        } else if (nextResponse === 'RESTART_PROBLEM_CAPTURE') {
          // Reset to problem capture
          console.log(`🎯 SIMPLE_DEMO: User said no, restarting problem capture`);
          setCurrentStepIndex(0);
          setSessionContext({ problemStatement: '', userResponses: {} });
          problemStatementRef.current = ''; // Reset persistent ref
          const shortRestartMessage = "Let's try again. Please tell me what problem you want to work on in a few words.";
          addMessage(shortRestartMessage, false, 'problem_capture');
          speakText(shortRestartMessage);
          return;
        } else {
          // Regular response, just show it and continue
          setCurrentStepIndex(nextIndex);
          addMessage(nextResponse, false, nextStep.id);
          speakText(nextResponse);
          return;
        }
      }
    }

    // Move to next step if available
    const currentIndex = currentStepIndexRef.current;
    if (currentIndex < PROBLEM_SHIFTING_STEPS.length - 1) {
      const nextIndex = currentIndex + 1;
      console.log(`🎯 SIMPLE_DEMO: ADVANCING: From step ${currentIndex + 1} to step ${nextIndex + 1}`);
      
      setCurrentStepIndex(nextIndex);
      
      const nextStep = PROBLEM_SHIFTING_STEPS[nextIndex];
      const nextResponse = getScriptedResponse(nextStep, transcript, newContext);
      
      console.log(`🎯 SIMPLE_DEMO: NEW STEP: ${nextIndex + 1}/${PROBLEM_SHIFTING_STEPS.length} - ${nextStep.title}`);
      console.log(`🎯 SIMPLE_DEMO: SPEAKING: "${nextResponse}"`);
      
      addMessage(nextResponse, false, nextStep.id);
      
      // Speak immediately (no delay needed)
      speakText(nextResponse);
    } else {
      // Session complete
      console.log(`🎯 SIMPLE_DEMO: Session completed`);
      setStatus('completed');
    }
  };

  // Start speech recognition
  const startListening = () => {
    console.log(`🎯 SIMPLE_DEMO: startListening called`);
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error(`🎯 SIMPLE_DEMO: Speech recognition not supported`);
      setError('Speech recognition not supported in this browser');
      return;
    }

    if (statusRef.current !== 'active') {
      console.log(`🎯 SIMPLE_DEMO: Not starting listening - status is: ${statusRef.current}`);
      return;
    }

    if (isListeningRef.current) {
      console.log(`🎯 SIMPLE_DEMO: Already listening, skipping`);
      return;
    }
    
    if (recognitionRef.current) {
      console.log(`🎯 SIMPLE_DEMO: Recognition already exists, stopping it first`);
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        console.log('🎯 SIMPLE_DEMO: ===== SPEECH RECOGNITION STARTED =====');
        console.log('🎯 SIMPLE_DEMO: Status:', statusRef.current);
        console.log('🎯 SIMPLE_DEMO: Current step:', currentStepIndexRef.current + 1, PROBLEM_SHIFTING_STEPS[currentStepIndexRef.current].title);
        setIsListening(true);
        setError('');
        
        // Set timeout to stop listening after 30 seconds
        listeningTimeoutRef.current = setTimeout(() => {
          console.log('🎯 SIMPLE_DEMO: Speech recognition timeout');
          stopListening();
        }, 30000);
      };
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log('🎯 SIMPLE_DEMO: ===== SPEECH RECOGNIZED =====');
        console.log('🎯 SIMPLE_DEMO: Transcript:', transcript);
        console.log('🎯 SIMPLE_DEMO: Current step:', currentStepIndexRef.current + 1, PROBLEM_SHIFTING_STEPS[currentStepIndexRef.current].title);
        console.log('🎯 SIMPLE_DEMO: Status:', statusRef.current);
        console.log('🎯 SIMPLE_DEMO: =============================');
        
        // Stop listening after receiving input
        setIsListening(false);
        
        processUserTranscript(transcript);
      };
      
      recognition.onerror = (event: any) => {
        console.error('🎯 SIMPLE_DEMO: Speech recognition error:', event.error);
        
        if (event.error === 'no-speech') {
          console.log('🎯 SIMPLE_DEMO: No speech detected - will auto-restart');
        } else if (event.error === 'audio-capture') {
          setError('Microphone access denied or not available. Please check your microphone permissions.');
        } else if (event.error === 'not-allowed') {
          setError('Microphone permission denied. Please allow microphone access and refresh the page.');
        } else if (event.error !== 'aborted') {
          setError(`Speech recognition error: ${event.error}`);
        }
        
        setIsListening(false);
      };
      
      recognition.onend = () => {
        console.log('🎯 SIMPLE_DEMO: ===== SPEECH RECOGNITION ENDED =====');
        console.log('🎯 SIMPLE_DEMO: Status:', statusRef.current);
        console.log('🎯 SIMPLE_DEMO: Was listening:', isListeningRef.current);
        console.log('🎯 SIMPLE_DEMO: Current step:', currentStepIndexRef.current + 1, PROBLEM_SHIFTING_STEPS[currentStepIndexRef.current].title);
        console.log('🎯 SIMPLE_DEMO: ==========================================');
        setIsListening(false);
        
        // Clear timeout
        if (listeningTimeoutRef.current) {
          clearTimeout(listeningTimeoutRef.current);
          listeningTimeoutRef.current = null;
        }
        
        // Auto-restart recognition if demo is still active
        if (statusRef.current === 'active') {
          console.log('🎯 SIMPLE_DEMO: Recognition ended, restarting in 1.5 seconds...');
          setTimeout(() => {
            if (statusRef.current === 'active') {
              console.log('🎯 SIMPLE_DEMO: Auto-restarting speech recognition...');
              startListening();
            }
          }, 1500);
        } else {
          console.log('🎯 SIMPLE_DEMO: Not restarting - status is:', statusRef.current);
        }
      };
      
      recognitionRef.current = recognition;
      
      console.log('🎯 SIMPLE_DEMO: About to start recognition...');
      recognition.start();
      console.log('🎯 SIMPLE_DEMO: Recognition.start() called');
      
    } catch (error) {
      console.error('🎯 SIMPLE_DEMO: Failed to start speech recognition:', error);
      setError('Failed to start speech recognition');
    }
  };

  // Stop speech recognition
  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    // Clear timeout
    if (listeningTimeoutRef.current) {
      clearTimeout(listeningTimeoutRef.current);
      listeningTimeoutRef.current = null;
    }
    
    setIsListening(false);
  };

  // Start demo
  const startDemo = async () => {
    setStatus('active');
    statusRef.current = 'active';
    setMessages([]);
    setCurrentStepIndex(0);
    setSessionContext({
      problemStatement: '',
      userResponses: {}
    });

    const initialResponse = getScriptedResponse(currentStep);
    addMessage(initialResponse, false, currentStep.id);
    
    // Speak initial response
    setTimeout(() => {
      speakText(initialResponse);
    }, 500);
  };

  // Stop demo
  const stopDemo = () => {
    stopListening();
    
    // Stop any playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    
    // Stop browser TTS
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    
    setStatus('idle');
    statusRef.current = 'idle';
    setIsSpeaking(false);
    setError('');
  };

  // Reset demo
  const resetDemo = () => {
    stopDemo();
    setMessages([]);
    setCurrentStepIndex(0);
    setSessionContext({
      problemStatement: '',
      userResponses: {}
    });
    problemStatementRef.current = ''; // Reset persistent ref
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Brain className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Voice Treatment Demo</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Voice-guided Mind Shifting treatment with manual speech control
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isSpeaking && (
            <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded-full text-sm">
              <Volume2 className="h-3 w-3" />
              <span>Speaking</span>
            </div>
          )}
          {isListening && (
            <div className="flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 rounded-full text-sm">
              <Mic className="h-3 w-3" />
              <span>Listening</span>
            </div>
          )}
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
            status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
            'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
          }`}>
            {status}
          </div>
        </div>
      </div>

      {/* Treatment Modality Selector */}
      <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h5 className="font-medium text-indigo-900 dark:text-indigo-200">
              Treatment Modality: {TREATMENT_MODALITIES[selectedModality].name}
            </h5>
            <p className="text-sm text-indigo-700 dark:text-indigo-300">
              {TREATMENT_MODALITIES[selectedModality].description}
            </p>
          </div>
          <button
            onClick={() => setShowModalitySelector(!showModalitySelector)}
            className="flex items-center space-x-2 px-3 py-2 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded-lg transition-colors"
          >
            <Settings className="h-4 w-4" />
            <span>Change</span>
          </button>
        </div>
        
        {showModalitySelector && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {Object.entries(TREATMENT_MODALITIES).map(([key, modality]) => (
              <button
                key={key}
                onClick={() => {
                  setSelectedModality(key as TreatmentModality);
                  setShowModalitySelector(false);
                }}
                className={`p-3 text-left rounded-lg border transition-colors ${
                  selectedModality === key
                    ? 'bg-indigo-100 dark:bg-indigo-800 border-indigo-300 dark:border-indigo-600 text-indigo-900 dark:text-indigo-100'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="font-medium">{modality.name}</div>
                <div className="text-sm opacity-75">{modality.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current Step Progress - Only show for Problem Shifting */}
      {selectedModality === 'problem_shifting' && (
        <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-medium text-indigo-900 dark:text-indigo-200">
              Step {currentStepIndex + 1} of {PROBLEM_SHIFTING_STEPS.length}: {currentStep.title}
            </h5>
            <span className="text-sm text-indigo-700 dark:text-indigo-300">
              Expected: {currentStep.expectedResponseType}
            </span>
          </div>
          <div className="w-full bg-indigo-200 dark:bg-indigo-800 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${((currentStepIndex + 1) / PROBLEM_SHIFTING_STEPS.length) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Working On Display */}
      {sessionContext.problemStatement && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <h5 className="font-medium text-green-900 dark:text-green-200 mb-1">
            Working On:
          </h5>
          <p className="text-sm text-green-700 dark:text-green-300">
            Problem: "{sessionContext.problemStatement}"
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
          <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        <button
          onClick={startDemo}
          disabled={status === 'active' || isSpeaking}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Play className="h-4 w-4" />
          <span>Start Voice Treatment</span>
        </button>

        {status === 'active' && !isListening && (
          <button
            onClick={startListening}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Mic className="h-4 w-4" />
            <span>Start Listening</span>
          </button>
        )}

        {status === 'active' && (
          <>
            <button
              onClick={startListening}
              disabled={isListening || isSpeaking}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Mic className="h-4 w-4" />
              <span>Start Speaking</span>
            </button>

            <button
              onClick={stopListening}
              disabled={!isListening}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <MicOff className="h-4 w-4" />
              <span>Stop Speaking</span>
            </button>
          </>
        )}

        <button
          onClick={stopDemo}
          disabled={status === 'idle'}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Square className="h-4 w-4" />
          <span>Stop Demo</span>
        </button>

        <button
          onClick={resetDemo}
          className="flex items-center space-x-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Reset</span>
        </button>
      </div>

      {/* Status */}
      {status === 'active' && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md flex items-center">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
          <div className="flex-1">
            <span className="text-sm text-green-800 dark:text-green-200">
              🎙️ Simple demo active! 
              {isSpeaking && " 🗣️ AI is speaking... (will auto-listen when done)"}
              {isListening && " 👂 Listening to your response... (speak now)"}
              {!isSpeaking && !isListening && " Ready for next interaction."}
            </span>
          </div>
        </div>
      )}

      {/* Completion Status */}
      {status === 'completed' && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md flex items-center">
          <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
          <div className="flex-1">
            <span className="text-sm text-blue-800 dark:text-blue-200">
              ✅ Problem Shifting session completed! You can open your eyes.
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div>
          <h5 className="font-medium text-gray-900 dark:text-white mb-3">Session Conversation</h5>
          <div className="space-y-3 max-h-80 overflow-y-auto bg-gray-50 dark:bg-gray-900/20 rounded-lg p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm ${
                    message.isUser
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs opacity-70">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                    <span className="text-xs opacity-70">
                      {PROBLEM_SHIFTING_STEPS.find(s => s.id === message.stepId)?.title || message.stepId}
                    </span>
                  </div>
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step Guide */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
        <h6 className="font-medium text-gray-900 dark:text-white mb-2">
          {TREATMENT_MODALITIES[selectedModality].name} Steps:
        </h6>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          {TREATMENT_MODALITY_STEPS[selectedModality].map((step, index) => (
            <div key={index} className={`flex items-start space-x-3 p-2 rounded ${
              selectedModality === 'problem_shifting' && index === currentStepIndex 
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100' 
                : selectedModality === 'problem_shifting' && index < currentStepIndex
                ? 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100'
                : ''
            }`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                selectedModality === 'problem_shifting' && index < currentStepIndex ? 'bg-green-500 text-white' :
                selectedModality === 'problem_shifting' && index === currentStepIndex ? 'bg-indigo-500 text-white' :
                'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
              }`}>
                {selectedModality === 'problem_shifting' && index < currentStepIndex ? '✓' : index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{step.title}</div>
                <div className="text-xs opacity-75 mt-1">{step.description}</div>
              </div>
              {selectedModality === 'problem_shifting' && index === currentStepIndex && (
                <ArrowRight className="h-4 w-4 flex-shrink-0 mt-0.5" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 