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

interface RealityShiftingStep {
  id: string;
  title: string;
  script: string | ((userInput: string, context: any) => string);
  expectedResponseType: 'goal' | 'feeling' | 'experience' | 'open' | 'yesno';
  nextStep?: string;
}

// EXACT Reality Shifting steps from the working treatment state machine
const REALITY_SHIFTING_STEPS: RealityShiftingStep[] = [
  {
    id: 'reality_goal_capture',
    title: 'Goal Statement',
    script: 'What do you want?',
    expectedResponseType: 'goal',
    nextStep: 'goal_deadline_check'
  },
  {
    id: 'goal_deadline_check',
    title: 'Goal Deadline Check',
    script: 'Is there a deadline?',
    expectedResponseType: 'yesno',
    nextStep: 'goal_deadline_date'
  },
  {
    id: 'goal_deadline_date',
    title: 'Goal Deadline Date',
    script: 'When do you want to achieve this goal by?',
    expectedResponseType: 'open',
    nextStep: 'goal_confirmation'
  },
  {
    id: 'goal_confirmation',
    title: 'Goal Confirmation',
    script: (userInput: string, context: any) => {
      const goalStatement = context?.goalStatement || 'your goal';
      const deadline = userInput || '';
      const hasDeadline = context?.userResponses?.['goal_deadline_check']?.toLowerCase().includes('yes') || false;
      
      if (hasDeadline && deadline) {
        return `OK, so your goal statement including the deadline is '${goalStatement} by ${deadline}', is that right?`;
      } else {
        return `OK, so your goal statement is '${goalStatement}', is that right?`;
      }
    },
    expectedResponseType: 'yesno',
    nextStep: 'goal_certainty'
  },
  {
    id: 'goal_certainty',
    title: 'Goal Certainty',
    script: 'How certain are you between 0% and 100% that you will achieve this goal?',
    expectedResponseType: 'open',
    nextStep: 'reality_shifting_intro'
  },
  {
    id: 'reality_shifting_intro',
    title: 'Reality Shifting Introduction',
    script: (userInput: string, context: any) => {
      const goalStatement = context?.goalStatement || 'your goal';
      return `Close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. If ever you feel your goal has changed just let me know.

We're going to work with your goal of '${goalStatement}'.

Feel that '${goalStatement}' is coming to you... what does it feel like?`;
    },
    expectedResponseType: 'feeling',
    nextStep: 'reality_step_a2'
  },
  {
    id: 'reality_step_a2',
    title: 'Reality Step A2',
    script: (userInput: string, context: any) => {
      const originalFeeling = context?.userResponses?.['reality_shifting_intro'] || userInput || 'that';
      return `Feel ${originalFeeling}... what does ${originalFeeling} feel like?`;
    },
    expectedResponseType: 'feeling',
    nextStep: 'reality_step_a3'
  },
  {
    id: 'reality_step_a3',
    title: 'Reality Step A3',
    script: (userInput: string, context: any) => {
      const originalFeeling = context?.userResponses?.['reality_shifting_intro'] || userInput || 'that';
      return `Feel ${originalFeeling}... what happens in yourself when you feel ${originalFeeling}?`;
    },
    expectedResponseType: 'open',
    nextStep: 'reality_step_b'
  },
  {
    id: 'reality_step_b',
    title: 'Reality Step B',
    script: (userInput: string, context: any) => {
      const goalStatement = context?.goalStatement || 'your goal';
      return `Is it possible that '${goalStatement}' will not come to you?`;
    },
    expectedResponseType: 'yesno',
    nextStep: 'session_complete'
  },
  {
    id: 'session_complete',
    title: 'Session Complete',
    script: 'Thank you for participating in this Reality Shifting demo. The treatment process has been completed.',
    expectedResponseType: 'open'
  }
];

export default function RealityShiftingDemo() {
  const [status, setStatus] = useState<string>('idle');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string>('');
  const [messages, setMessages] = useState<TreatmentMessage[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [sessionContext, setSessionContext] = useState<any>({
    goalStatement: '',
    userResponses: {}
  });
  
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const listeningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<string>('idle');
  const isListeningRef = useRef<boolean>(false);
  const currentStepIndexRef = useRef<number>(0);
  const lastSpokenTextRef = useRef<string>('');

  const currentStep = REALITY_SHIFTING_STEPS[currentStepIndex];

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
    console.log(`🎯 REALITY_DEMO: STEP CHANGED: Now on step ${currentStepIndex + 1}/${REALITY_SHIFTING_STEPS.length} - ${currentStep.title}`);
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

  const getScriptedResponse = (step: RealityShiftingStep, userInput: string = '', context?: any): string => {
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
        console.log(`🎯 REALITY_DEMO: Browser TTS completed`);
        setIsSpeaking(false);
        
        // Auto-start listening after TTS completes (if demo is active)
        if (statusRef.current === 'active') {
          console.log(`🎯 REALITY_DEMO: Auto-starting speech recognition after browser TTS`);
          setTimeout(() => {
            if (statusRef.current === 'active') {
              console.log(`🎯 REALITY_DEMO: Starting listening after browser TTS buffer`);
              startListening();
            }
          }, 800); // Longer buffer to prevent audio feedback
        }
        
        resolve();
      };

      utterance.onerror = (event) => {
        console.error(`🎯 REALITY_DEMO: Browser TTS error:`, event);
        setIsSpeaking(false);
        reject(new Error('Browser TTS failed'));
      };

      console.log(`🎯 REALITY_DEMO: Using browser TTS`);
      speechSynthesis.speak(utterance);
    });
  };

  // Validation logic for Reality Shifting
  const validateUserInput = (transcript: string, stepId: string): { isValid: boolean; error?: string } => {
    const trimmed = transcript.trim();
    const lowerInput = trimmed.toLowerCase();
    const words = trimmed.split(/\s+/).length;

    console.log(`🎯 REALITY_DEMO: Validating input "${transcript}" for step: ${stepId}`);

    // Validation for reality_goal_capture step
    if (stepId === 'reality_goal_capture') {
      // Check if user stated it as a problem instead of goal
      const problemIndicators = ['problem', 'issue', 'trouble', 'difficulty', 'struggle', 'can\'t', 'cannot', 'unable to', 'don\'t', 'not able', 'hard to', 'difficult to'];
      const hasProblemLanguage = problemIndicators.some(indicator => lowerInput.includes(indicator));
      
      if (hasProblemLanguage) {
        return { isValid: false, error: 'How would you state that as a goal instead of a problem?' };
      }
      
      // Check if user stated it as a question
      const questionIndicators = ['how can', 'how do', 'what should', 'why do', 'when will', 'where can', 'should i', 'how do i', 'what can i'];
      const hasQuestionLanguage = questionIndicators.some(indicator => lowerInput.includes(indicator)) || trimmed.endsWith('?');
      
      if (hasQuestionLanguage) {
        return { isValid: false, error: 'How would you state that as a goal instead of a question?' };
      }

      // Check for too short input
      if (words < 2) {
        return { isValid: false, error: 'Please tell me a bit more about what you want.' };
      }
    }

    return { isValid: true };
  };

  const speakText = async (text: string) => {
    if (isSpeaking) {
      console.log(`🎯 REALITY_DEMO: Already speaking, skipping`);
      return;
    }

    try {
      setIsSpeaking(true);
      lastSpokenTextRef.current = text.toLowerCase(); // Store what we're speaking
      console.log(`🎯 REALITY_DEMO: Speaking: "${text}"`);

      // Try browser TTS first for speed (if available and working)
      if ('speechSynthesis' in window && text.length < 200) {
        try {
          await speakWithBrowserTTS(text);
          return;
        } catch (browserError) {
          console.log(`🎯 REALITY_DEMO: Browser TTS failed, falling back to OpenAI TTS`);
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
          console.log(`🎯 REALITY_DEMO: TTS started`);
        };
        
        audio.onended = () => {
          console.log(`🎯 REALITY_DEMO: TTS completed`);
          console.log(`🎯 REALITY_DEMO: Current status: ${statusRef.current}`);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          setIsSpeaking(false);
          
          // Auto-start listening after TTS completes (if demo is active)
          if (statusRef.current === 'active') {
            console.log(`🎯 REALITY_DEMO: Auto-starting speech recognition after OpenAI TTS`);
            setTimeout(() => {
              console.log(`🎯 REALITY_DEMO: Starting listening after OpenAI TTS buffer`);
              console.log(`🎯 REALITY_DEMO: Current isListening state:`, isListening);
              if (statusRef.current === 'active') {
                startListening();
              }
            }, 600); // Buffer to prevent audio feedback
          } else {
            console.log(`🎯 REALITY_DEMO: Not auto-starting - status is: ${statusRef.current}`);
          }
          
          resolve();
        };
        
        audio.onerror = (event) => {
          console.error(`🎯 REALITY_DEMO: TTS error:`, event);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          setIsSpeaking(false);
          reject(new Error('TTS playback failed'));
        };
        
        audio.play().catch(reject);
      });
      
    } catch (error) {
      console.error(`🎯 REALITY_DEMO: TTS failed:`, error);
      setIsSpeaking(false);
      throw error;
    }
  };

  // Process user transcript
  const processUserTranscript = async (transcript: string) => {
    const currentStepFromRef = REALITY_SHIFTING_STEPS[currentStepIndexRef.current];
    console.log(`🎯 REALITY_DEMO: Processing transcript: "${transcript}" for step: ${currentStepFromRef.id}`);
    
    // Check if this transcript is similar to what we just spoke (audio feedback)
    const transcriptLower = transcript.toLowerCase();
    const lastSpoken = lastSpokenTextRef.current;
    
    if (lastSpoken && transcriptLower.includes(lastSpoken.substring(0, 20))) {
      console.log(`🎯 REALITY_DEMO: IGNORING AUDIO FEEDBACK: "${transcript}" matches recent TTS`);
      return; // Ignore audio feedback
    }
    
    // Validate input for current step
    const validation = validateUserInput(transcript, currentStepFromRef.id);
    console.log(`🎯 REALITY_DEMO: VALIDATION: Step "${currentStepFromRef.id}" - Input "${transcript}" - Valid: ${validation.isValid}`);
    
    if (!validation.isValid) {
      console.log(`🎯 REALITY_DEMO: VALIDATION FAILED: ${validation.error}`);
      addMessage(transcript, true, currentStepFromRef.id);
      
      // Speak the correction message
      setTimeout(() => {
        speakText(validation.error!);
      }, 500);
      return; // Don't advance to next step
    }
    
    console.log(`🎯 REALITY_DEMO: VALIDATION PASSED: Proceeding to next step`);

    // Store user response in context
    const newContext = {
      ...sessionContext,
      userResponses: {
        ...sessionContext.userResponses,
        [currentStepFromRef.id]: transcript
      }
    };

    // Store goal statement from first step ONLY
    if (currentStepFromRef.id === 'reality_goal_capture') {
      newContext.goalStatement = transcript;
      console.log(`🎯 REALITY_DEMO: Stored goal statement: "${transcript}"`);
    }

    setSessionContext(newContext);
    addMessage(transcript, true, currentStepFromRef.id);

    // Move to next step if available
    const currentIndex = currentStepIndexRef.current;
    if (currentIndex < REALITY_SHIFTING_STEPS.length - 1) {
      const nextIndex = currentIndex + 1;
      console.log(`🎯 REALITY_DEMO: ADVANCING: From step ${currentIndex + 1} to step ${nextIndex + 1}`);
      
      setCurrentStepIndex(nextIndex);
      
      const nextStep = REALITY_SHIFTING_STEPS[nextIndex];
      const nextResponse = getScriptedResponse(nextStep, transcript, newContext);
      
      console.log(`🎯 REALITY_DEMO: NEW STEP: ${nextIndex + 1}/${REALITY_SHIFTING_STEPS.length} - ${nextStep.title}`);
      console.log(`🎯 REALITY_DEMO: SPEAKING: "${nextResponse}"`);
      
      addMessage(nextResponse, false, nextStep.id);
      
      // Speak immediately (no delay needed)
      speakText(nextResponse);
    } else {
      // Session complete
      console.log(`🎯 REALITY_DEMO: Session completed`);
      setStatus('completed');
    }
  };

  // Start speech recognition
  const startListening = () => {
    console.log(`🎯 REALITY_DEMO: startListening called`);
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error(`🎯 REALITY_DEMO: Speech recognition not supported`);
      setError('Speech recognition not supported in this browser');
      return;
    }

    if (statusRef.current !== 'active') {
      console.log(`🎯 REALITY_DEMO: Not starting listening - status is: ${statusRef.current}`);
      return;
    }

    if (isListeningRef.current) {
      console.log(`🎯 REALITY_DEMO: Already listening, skipping`);
      return;
    }
    
    if (recognitionRef.current) {
      console.log(`🎯 REALITY_DEMO: Recognition already exists, stopping it first`);
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
        console.log('🎯 REALITY_DEMO: ===== SPEECH RECOGNITION STARTED =====');
        console.log('🎯 REALITY_DEMO: Status:', statusRef.current);
        console.log('🎯 REALITY_DEMO: Current step:', currentStepIndexRef.current + 1, REALITY_SHIFTING_STEPS[currentStepIndexRef.current].title);
        setIsListening(true);
        setError('');
        
        // Set timeout to stop listening after 30 seconds
        listeningTimeoutRef.current = setTimeout(() => {
          console.log('🎯 REALITY_DEMO: Speech recognition timeout');
          stopListening();
        }, 30000);
      };
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log('🎯 REALITY_DEMO: ===== SPEECH RECOGNIZED =====');
        console.log('🎯 REALITY_DEMO: Transcript:', transcript);
        console.log('🎯 REALITY_DEMO: Current step:', currentStepIndexRef.current + 1, REALITY_SHIFTING_STEPS[currentStepIndexRef.current].title);
        console.log('🎯 REALITY_DEMO: Status:', statusRef.current);
        console.log('🎯 REALITY_DEMO: =============================');
        
        // Stop listening after receiving input
        setIsListening(false);
        
        processUserTranscript(transcript);
      };
      
      recognition.onerror = (event: any) => {
        console.error('🎯 REALITY_DEMO: Speech recognition error:', event.error);
        
        if (event.error === 'no-speech') {
          console.log('🎯 REALITY_DEMO: No speech detected - will auto-restart');
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
        console.log('🎯 REALITY_DEMO: ===== SPEECH RECOGNITION ENDED =====');
        console.log('🎯 REALITY_DEMO: Status:', statusRef.current);
        console.log('🎯 REALITY_DEMO: Was listening:', isListeningRef.current);
        console.log('🎯 REALITY_DEMO: Current step:', currentStepIndexRef.current + 1, REALITY_SHIFTING_STEPS[currentStepIndexRef.current].title);
        console.log('🎯 REALITY_DEMO: ==========================================');
        setIsListening(false);
        
        // Clear timeout
        if (listeningTimeoutRef.current) {
          clearTimeout(listeningTimeoutRef.current);
          listeningTimeoutRef.current = null;
        }
        
        // Auto-restart recognition if demo is still active
        if (statusRef.current === 'active') {
          console.log('🎯 REALITY_DEMO: Recognition ended, restarting in 1.5 seconds...');
          setTimeout(() => {
            if (statusRef.current === 'active') {
              console.log('🎯 REALITY_DEMO: Auto-restarting speech recognition...');
              startListening();
            }
          }, 1500);
        } else {
          console.log('🎯 REALITY_DEMO: Not restarting - status is:', statusRef.current);
        }
      };
      
      recognitionRef.current = recognition;
      
      console.log('🎯 REALITY_DEMO: About to start recognition...');
      recognition.start();
      console.log('🎯 REALITY_DEMO: Recognition.start() called');
      
    } catch (error) {
      console.error('🎯 REALITY_DEMO: Failed to start speech recognition:', error);
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
      goalStatement: '',
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
      goalStatement: '',
      userResponses: {}
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Brain className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Reality Shifting Demo</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Voice-guided Reality Shifting treatment with manual speech control
            </p>
          </div>
        </div>
      </div>

      {/* Current Step Progress - Only show for Reality Shifting */}
      {status === 'active' && (
        <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-medium text-indigo-900 dark:text-indigo-200">
              Step {currentStepIndex + 1} of {REALITY_SHIFTING_STEPS.length}: {currentStep.title}
            </h5>
            <span className="text-sm text-indigo-700 dark:text-indigo-300">
              Expected: {currentStep.expectedResponseType}
            </span>
          </div>
          <div className="w-full bg-indigo-200 dark:bg-indigo-800 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${((currentStepIndex + 1) / REALITY_SHIFTING_STEPS.length) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Working On Display */}
      {sessionContext.goalStatement && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <h5 className="font-medium text-green-900 dark:text-green-200 mb-1">
            Working On:
          </h5>
          <p className="text-sm text-green-700 dark:text-green-300">
            Goal: "{sessionContext.goalStatement}"
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
          <span>Start Reality Shifting</span>
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
              🎙️ Reality Shifting demo active! 
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
          Reality Shifting Steps:
        </h6>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          {REALITY_SHIFTING_STEPS.map((step, index) => (
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