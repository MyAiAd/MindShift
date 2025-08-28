'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Brain, Mic, MicOff, Play, Square, AlertCircle, CheckCircle, MessageSquare, RotateCcw, ArrowRight, Volume2 } from 'lucide-react';

interface TreatmentMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  stepId: string;
}

interface BeliefShiftingStep {
  id: string;
  title: string;
  script: string | ((userInput: string, context: any) => string);
  expectedResponseType: 'problem' | 'feeling' | 'experience' | 'open' | 'yesno';
  nextStep?: string;
}

// EXACT Belief Shifting steps from the working treatment state machine
const BELIEF_SHIFTING_STEPS: BeliefShiftingStep[] = [
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
      if (input.includes('yes') || input.includes('y') || input.includes('correct') || input.includes('right')) {
        return 'CONFIRMED_PROCEED_TO_TREATMENT';
      } else if (input.includes('no') || input.includes('n') || input.includes('wrong') || input.includes('incorrect')) {
        return 'RESTART_PROBLEM_CAPTURE';
      } else {
        return 'Please answer yes or no. Is that what you want to work on?';
      }
    },
    expectedResponseType: 'yesno',
    nextStep: 'belief_shifting_intro'
  },
  {
    id: 'belief_shifting_intro',
    title: 'Belief Shifting Introduction',
    script: (userInput: string, context: any) => {
      const problemStatement = context?.problemStatement || 'the problem';
      return `Please close your eyes and keep them closed throughout the process.

Feel the problem that '${problemStatement}'... what do you believe about yourself that's causing you to experience this problem that '${problemStatement}'?`;
    },
    expectedResponseType: 'open',
    nextStep: 'belief_step_a'
  },
  {
    id: 'belief_step_a',
    title: 'Belief Step A',
    script: (userInput: string, context: any) => {
      const belief = userInput || 'that belief';
      return `Feel yourself believing '${belief}'... what does it feel like?`;
    },
    expectedResponseType: 'feeling',
    nextStep: 'belief_step_b'
  },
  {
    id: 'belief_step_b',
    title: 'Belief Step B',
    script: (userInput: string) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
    expectedResponseType: 'feeling',
    nextStep: 'belief_step_c'
  },
  {
    id: 'belief_step_c',
    title: 'Belief Step C',
    script: 'What would you rather feel?',
    expectedResponseType: 'feeling',
    nextStep: 'belief_step_d'
  },
  {
    id: 'belief_step_d',
    title: 'Belief Step D',
    script: (userInput: string) => {
      const desiredFeeling = userInput || 'that feeling';
      return `What would '${desiredFeeling}' feel like?`;
    },
    expectedResponseType: 'feeling',
    nextStep: 'belief_step_e'
  },
  {
    id: 'belief_step_e',
    title: 'Belief Step E',
    script: (userInput: string) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
    expectedResponseType: 'feeling',
    nextStep: 'belief_step_f'
  },
  {
    id: 'belief_step_f',
    title: 'Belief Check',
    script: (userInput: string, context: any) => {
      const belief = context?.userResponses?.['belief_shifting_intro'] || 'that belief';
      return `Do you still believe '${belief}'?`;
    },
    expectedResponseType: 'yesno',
    nextStep: 'session_complete'
  },
  {
    id: 'session_complete',
    title: 'Session Complete',
    script: 'Thank you for participating in this Belief Shifting demo. The treatment process has been completed.',
    expectedResponseType: 'open'
  }
];

export default function BeliefShiftingDemo() {
  const [status, setStatus] = useState<string>('idle');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string>('');
  const [messages, setMessages] = useState<TreatmentMessage[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
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

  const currentStep = BELIEF_SHIFTING_STEPS[currentStepIndex];

  // Keep refs in sync with state
  useEffect(() => {
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
    console.log(`🎯 BELIEF_DEMO: STEP CHANGED: Now on step ${currentStepIndex + 1}/${BELIEF_SHIFTING_STEPS.length} - ${currentStep.title}`);
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

  const getScriptedResponse = (step: BeliefShiftingStep, userInput: string = '', context?: any): string => {
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
        console.log(`🎯 BELIEF_DEMO: Browser TTS completed`);
        setIsSpeaking(false);
        
        // Auto-start listening after TTS completes (if demo is active)
        if (statusRef.current === 'active') {
          console.log(`🎯 BELIEF_DEMO: Auto-starting speech recognition after browser TTS`);
          setTimeout(() => {
            if (statusRef.current === 'active') {
              console.log(`🎯 BELIEF_DEMO: Starting listening after browser TTS buffer`);
              startListening();
            }
          }, 800); // Longer buffer to prevent audio feedback
        }
        
        resolve();
      };

      utterance.onerror = (event) => {
        console.error(`🎯 BELIEF_DEMO: Browser TTS error:`, event);
        setIsSpeaking(false);
        reject(new Error('Browser TTS failed'));
      };

      console.log(`🎯 BELIEF_DEMO: Using browser TTS`);
      speechSynthesis.speak(utterance);
    });
  };

  // Validation logic for Belief Shifting (same as Problem Shifting)
  const validateUserInput = (transcript: string, stepId: string): { isValid: boolean; error?: string } => {
    const trimmed = transcript.trim();
    const lowerInput = trimmed.toLowerCase();
    const words = trimmed.split(/\s+/).length;

    console.log(`🎯 BELIEF_DEMO: Validating input "${transcript}" for step: ${stepId}`);

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

  const speakText = async (text: string) => {
    if (isSpeaking) {
      console.log(`🎯 BELIEF_DEMO: Already speaking, skipping`);
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
      
      console.log(`🎯 BELIEF_DEMO: Speaking: "${text}"`);

      // Try browser TTS first for speed (if available and working)
      if ('speechSynthesis' in window && text.length < 200) {
        try {
          await speakWithBrowserTTS(text);
          return;
        } catch (browserError) {
          console.log(`🎯 BELIEF_DEMO: Browser TTS failed, falling back to OpenAI TTS`);
        }
      }

      // Fallback to OpenAI TTS
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          voice: 'alloy', // Natural, clear voice without echo
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
          console.log(`🎯 BELIEF_DEMO: TTS started`);
        };
        
        audio.onended = () => {
          console.log(`🎯 BELIEF_DEMO: TTS completed`);
          console.log(`🎯 BELIEF_DEMO: Current status: ${statusRef.current}`);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          setIsSpeaking(false);
          
          // Auto-start listening after TTS completes (if demo is active)
          if (statusRef.current === 'active') {
            console.log(`🎯 BELIEF_DEMO: Auto-starting speech recognition after OpenAI TTS`);
            setTimeout(() => {
              console.log(`🎯 BELIEF_DEMO: Starting listening after OpenAI TTS buffer`);
              console.log(`🎯 BELIEF_DEMO: Current isListening state:`, isListening);
              if (statusRef.current === 'active') {
                startListening();
              }
            }, 600); // Buffer to prevent audio feedback
          } else {
            console.log(`🎯 BELIEF_DEMO: Not auto-starting - status is: ${statusRef.current}`);
          }
          
          resolve();
        };
        
        audio.onerror = (event) => {
          console.error(`🎯 BELIEF_DEMO: TTS error:`, event);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          setIsSpeaking(false);
          reject(new Error('TTS playback failed'));
        };
        
        audio.play().catch(reject);
      });
      
    } catch (error) {
      console.error(`🎯 BELIEF_DEMO: TTS failed:`, error);
      setIsSpeaking(false);
      throw error;
    }
  };

  // Process user transcript
  const processUserTranscript = async (transcript: string) => {
    const currentStepFromRef = BELIEF_SHIFTING_STEPS[currentStepIndexRef.current];
    console.log(`🎯 BELIEF_DEMO: Processing transcript: "${transcript}" for step: ${currentStepFromRef.id}`);
    
    // Enhanced audio feedback filtering - check against multiple recent speeches
    const transcriptLower = transcript.toLowerCase().trim();
    const recentSpeeches = recentSpokenTextsRef.current;
    
    // Check if transcript matches any recent speech (using multiple strategies)
    for (const spokenText of recentSpeeches) {
      // Strategy 1: Check if transcript is contained in spoken text
      if (spokenText.includes(transcriptLower)) {
        console.log(`🎯 BELIEF_DEMO: IGNORING AUDIO FEEDBACK: "${transcript}" is contained in recent TTS: "${spokenText}"`);
        return;
      }
      
      // Strategy 2: Check if spoken text is contained in transcript  
      if (transcriptLower.includes(spokenText)) {
        console.log(`🎯 BELIEF_DEMO: IGNORING AUDIO FEEDBACK: "${transcript}" contains recent TTS: "${spokenText}"`);
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
          console.log(`🎯 BELIEF_DEMO: IGNORING AUDIO FEEDBACK: "${transcript}" has ${Math.round(meaningfulOverlapRatio * 100)}% meaningful word overlap with recent TTS: "${spokenText}" (common: ${commonMeaningfulWords.join(', ')})`);
          return;
        }
      }
    }
    
    // Validate input for current step
    const validation = validateUserInput(transcript, currentStepFromRef.id);
    console.log(`🎯 BELIEF_DEMO: VALIDATION: Step "${currentStepFromRef.id}" - Input "${transcript}" - Valid: ${validation.isValid}`);
    
    if (!validation.isValid) {
      console.log(`🎯 BELIEF_DEMO: VALIDATION FAILED: ${validation.error}`);
      addMessage(transcript, true, currentStepFromRef.id);
      
      // Speak the correction message
      setTimeout(() => {
        speakText(validation.error!);
      }, 500);
      return; // Don't advance to next step
    }
    
    console.log(`🎯 BELIEF_DEMO: VALIDATION PASSED: Proceeding to next step`);

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
      console.log(`🎯 BELIEF_DEMO: Stored problem statement: "${transcript}"`);
    }

    setSessionContext(newContext);
    addMessage(transcript, true, currentStepFromRef.id);

    // Handle special confirmation responses
    const nextStep = BELIEF_SHIFTING_STEPS[currentStepIndexRef.current + 1];
    if (nextStep) {
      const nextResponse = getScriptedResponse(nextStep, transcript, newContext);
      
      // Handle confirmation flow
      if (nextResponse === 'CONFIRMED_PROCEED_TO_TREATMENT') {
        // Skip to treatment intro (belief_shifting_intro)
        const treatmentIntroIndex = BELIEF_SHIFTING_STEPS.findIndex(step => step.id === 'belief_shifting_intro');
        if (treatmentIntroIndex !== -1) {
          setCurrentStepIndex(treatmentIntroIndex);
          const treatmentStep = BELIEF_SHIFTING_STEPS[treatmentIntroIndex];
          const treatmentResponse = getScriptedResponse(treatmentStep, transcript, newContext);
          addMessage(treatmentResponse, false, treatmentStep.id);
          speakText(treatmentResponse);
          return;
        }
      } else if (nextResponse === 'RESTART_PROBLEM_CAPTURE') {
        // Reset to problem capture
        setCurrentStepIndex(0);
        setSessionContext({ problemStatement: '', userResponses: {} });
        const problemStep = BELIEF_SHIFTING_STEPS[0];
        const problemResponse = getScriptedResponse(problemStep, '', { problemStatement: '', userResponses: {} });
        addMessage("Let's try again. " + problemResponse, false, problemStep.id);
        speakText("Let's try again. " + problemResponse);
        return;
      }
    }

    // Move to next step if available
    const currentIndex = currentStepIndexRef.current;
    if (currentIndex < BELIEF_SHIFTING_STEPS.length - 1) {
      const nextIndex = currentIndex + 1;
      console.log(`🎯 BELIEF_DEMO: ADVANCING: From step ${currentIndex + 1} to step ${nextIndex + 1}`);
      
      setCurrentStepIndex(nextIndex);
      
      const nextStep = BELIEF_SHIFTING_STEPS[nextIndex];
      const nextResponse = getScriptedResponse(nextStep, transcript, newContext);
      
      console.log(`🎯 BELIEF_DEMO: NEW STEP: ${nextIndex + 1}/${BELIEF_SHIFTING_STEPS.length} - ${nextStep.title}`);
      console.log(`🎯 BELIEF_DEMO: SPEAKING: "${nextResponse}"`);
      
      addMessage(nextResponse, false, nextStep.id);
      
      // Speak immediately (no delay needed)
      speakText(nextResponse);
    } else {
      // Session complete
      console.log(`🎯 BELIEF_DEMO: Session completed`);
      setStatus('completed');
    }
  };

  // Start speech recognition
  const startListening = () => {
    console.log(`🎯 BELIEF_DEMO: startListening called`);
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error(`🎯 BELIEF_DEMO: Speech recognition not supported`);
      setError('Speech recognition not supported in this browser');
      return;
    }

    if (statusRef.current !== 'active') {
      console.log(`🎯 BELIEF_DEMO: Not starting listening - status is: ${statusRef.current}`);
      return;
    }

    if (isListeningRef.current) {
      console.log(`🎯 BELIEF_DEMO: Already listening, skipping`);
      return;
    }
    
    if (recognitionRef.current) {
      console.log(`🎯 BELIEF_DEMO: Recognition already exists, stopping it first`);
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
        console.log('🎯 BELIEF_DEMO: ===== SPEECH RECOGNITION STARTED =====');
        console.log('🎯 BELIEF_DEMO: Status:', statusRef.current);
        console.log('🎯 BELIEF_DEMO: Current step:', currentStepIndexRef.current + 1, BELIEF_SHIFTING_STEPS[currentStepIndexRef.current].title);
        setIsListening(true);
        setError('');
        
        // Set timeout to stop listening after 30 seconds
        listeningTimeoutRef.current = setTimeout(() => {
          console.log('🎯 BELIEF_DEMO: Speech recognition timeout');
          stopListening();
        }, 30000);
      };
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log('🎯 BELIEF_DEMO: ===== SPEECH RECOGNIZED =====');
        console.log('🎯 BELIEF_DEMO: Transcript:', transcript);
        console.log('🎯 BELIEF_DEMO: Current step:', currentStepIndexRef.current + 1, BELIEF_SHIFTING_STEPS[currentStepIndexRef.current].title);
        console.log('🎯 BELIEF_DEMO: Status:', statusRef.current);
        console.log('🎯 BELIEF_DEMO: =============================');
        
        // Stop listening after receiving input
        setIsListening(false);
        
        processUserTranscript(transcript);
      };
      
      recognition.onerror = (event: any) => {
        console.error('🎯 BELIEF_DEMO: Speech recognition error:', event.error);
        
        if (event.error === 'no-speech') {
          console.log('🎯 BELIEF_DEMO: No speech detected - will auto-restart');
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
        console.log('🎯 BELIEF_DEMO: ===== SPEECH RECOGNITION ENDED =====');
        console.log('🎯 BELIEF_DEMO: Status:', statusRef.current);
        console.log('🎯 BELIEF_DEMO: Was listening:', isListeningRef.current);
        console.log('🎯 BELIEF_DEMO: Current step:', currentStepIndexRef.current + 1, BELIEF_SHIFTING_STEPS[currentStepIndexRef.current].title);
        console.log('🎯 BELIEF_DEMO: ==========================================');
        setIsListening(false);
        
        // Clear timeout
        if (listeningTimeoutRef.current) {
          clearTimeout(listeningTimeoutRef.current);
          listeningTimeoutRef.current = null;
        }
        
        // Auto-restart recognition if demo is still active
        if (statusRef.current === 'active') {
          console.log('🎯 BELIEF_DEMO: Recognition ended, restarting in 1.5 seconds...');
          setTimeout(() => {
            if (statusRef.current === 'active') {
              console.log('🎯 BELIEF_DEMO: Auto-restarting speech recognition...');
              startListening();
            }
          }, 1500);
        } else {
          console.log('🎯 BELIEF_DEMO: Not restarting - status is:', statusRef.current);
        }
      };
      
      recognitionRef.current = recognition;
      
      console.log('🎯 BELIEF_DEMO: About to start recognition...');
      recognition.start();
      console.log('🎯 BELIEF_DEMO: Recognition.start() called');
      
    } catch (error) {
      console.error('🎯 BELIEF_DEMO: Failed to start speech recognition:', error);
      setError('Failed to start speech recognition');
    }
  };

  // Stop speech recognition
  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    
    // Clear timeout
    if (listeningTimeoutRef.current) {
      clearTimeout(listeningTimeoutRef.current);
      listeningTimeoutRef.current = null;
    }
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
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Brain className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Belief Shifting Demo</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Voice-guided Belief Shifting treatment with manual speech control
            </p>
          </div>
        </div>
      </div>

      {/* Current Step Progress */}
      {status === 'active' && (
        <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-medium text-indigo-900 dark:text-indigo-200">
              Step {currentStepIndex + 1} of {BELIEF_SHIFTING_STEPS.length}: {currentStep.title}
            </h5>
            <span className="text-sm text-indigo-700 dark:text-indigo-300">
              Expected: {currentStep.expectedResponseType}
            </span>
          </div>
          <div className="w-full bg-indigo-200 dark:bg-indigo-800 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${((currentStepIndex + 1) / BELIEF_SHIFTING_STEPS.length) * 100}%` }}
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
          <span>Start Belief Shifting</span>
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
          <button
            onClick={stopDemo}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Square className="h-4 w-4" />
            <span>Stop Demo</span>
          </button>
        )}

        <button
          onClick={resetDemo}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Reset</span>
        </button>
      </div>

      {/* Status Display */}
      {status === 'active' && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md flex items-center">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
          <div className="flex-1">
            <span className="text-sm text-green-800 dark:text-green-200">
              🎙️ Belief Shifting demo active! 
              {isSpeaking && " 🗣️ AI is speaking... (will auto-listen when done)"}
              {isListening && " 👂 Listening to your response... (speak now)"}
              {!isSpeaking && !isListening && " Ready for next interaction."}
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="mb-4 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
          <div className="p-3 space-y-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm ${
                    message.isUser
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
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
          Belief Shifting Steps:
        </h6>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          {BELIEF_SHIFTING_STEPS.map((step, index) => (
            <div key={index} className={`flex items-start space-x-3 p-2 rounded ${
              status === 'active' && index === currentStepIndex 
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100' 
                : status === 'active' && index < currentStepIndex
                ? 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100'
                : ''
            }`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                status === 'active' && index < currentStepIndex ? 'bg-green-500 text-white' :
                status === 'active' && index === currentStepIndex ? 'bg-indigo-500 text-white' :
                'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
              }`}>
                {status === 'active' && index < currentStepIndex ? '✓' : index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{step.title}</div>
              </div>
              {status === 'active' && index === currentStepIndex && (
                <ArrowRight className="h-4 w-4 flex-shrink-0 mt-0.5" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 