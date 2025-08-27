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
    script: (userInput: string, context: any) => {
      const problemStatement = context?.problemStatement || 'the problem';
      return `Feel the problem '${problemStatement}'... what needs to happen for this to not be a problem?`;
    },
    expectedResponseType: 'open',
    nextStep: 'feel_solution_state'
  },
  {
    id: 'feel_solution_state',
    title: 'Feel Solution State',
    script: (userInput: string) => `What would you feel like if '${userInput || 'that'}'?`,
    expectedResponseType: 'feeling',
    nextStep: 'feel_good_state'
  },
  {
    id: 'feel_good_state',
    title: 'Feel Good State',
    script: (userInput: string) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`,
    expectedResponseType: 'feeling',
    nextStep: 'what_happens_step'
  },
  {
    id: 'what_happens_step',
    title: 'What Happens in Good State',
    script: (userInput: string) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`,
    expectedResponseType: 'experience',
    nextStep: 'check_if_still_problem'
  },
  {
    id: 'check_if_still_problem',
    title: 'Check if Still Problem',
    script: (userInput: string, context: any) => {
      const problemStatement = context?.problemStatement || 'the problem';
      return `Feel the problem '${problemStatement}'... does it still feel like a problem?`;
    },
    expectedResponseType: 'yesno',
    nextStep: 'completion'
  },
  {
    id: 'completion',
    title: 'Session Complete',
    script: 'Excellent! The Problem Shifting process is now complete. You can open your eyes. The problem should feel different now.',
    expectedResponseType: 'open'
  }
];

export default function SimpleProblemShiftingDemo() {
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

  const currentStep = PROBLEM_SHIFTING_STEPS[currentStepIndex];

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
      console.log(`🎯 SIMPLE_DEMO: Speaking: "${text}"`);

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          voice: 'alloy',
          model: 'tts-1'
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
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          setIsSpeaking(false);
          
          // Auto-start listening after TTS completes (if demo is active)
          if (status === 'active') {
            console.log(`🎯 SIMPLE_DEMO: Auto-starting speech recognition after TTS`);
            setTimeout(() => {
              startListening();
            }, 1000);
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
    console.log(`🎯 SIMPLE_DEMO: Processing transcript: "${transcript}" for step: ${currentStep.id}`);
    
    // Validate input for current step
    const validation = validateUserInput(transcript, currentStep.id);
    if (!validation.isValid) {
      console.log(`🎯 SIMPLE_DEMO: Validation failed: ${validation.error}`);
      addMessage(transcript, true, currentStep.id);
      
      // Speak the correction message
      setTimeout(() => {
        speakText(validation.error!);
      }, 500);
      return; // Don't advance to next step
    }

    // Store user response in context
    const newContext = {
      ...sessionContext,
      userResponses: {
        ...sessionContext.userResponses,
        [currentStep.id]: transcript
      }
    };

    // Store problem statement from first step ONLY
    if (currentStep.id === 'problem_capture') {
      newContext.problemStatement = transcript;
      console.log(`🎯 SIMPLE_DEMO: Stored problem statement: "${transcript}"`);
    }

    setSessionContext(newContext);
    addMessage(transcript, true, currentStep.id);

    // Move to next step if available
    if (currentStepIndex < PROBLEM_SHIFTING_STEPS.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      
      const nextStep = PROBLEM_SHIFTING_STEPS[nextIndex];
      const nextResponse = getScriptedResponse(nextStep, transcript, newContext);
      
      console.log(`🎯 SIMPLE_DEMO: Moving to step ${nextIndex + 1}: ${nextStep.title}`);
      console.log(`🎯 SIMPLE_DEMO: Next response: "${nextResponse}"`);
      
      addMessage(nextResponse, false, nextStep.id);
      
      // Wait a moment before speaking
      setTimeout(() => {
        speakText(nextResponse);
      }, 1000);
    } else {
      // Session complete
      console.log(`🎯 SIMPLE_DEMO: Session completed`);
      setStatus('completed');
    }
  };

  // Start speech recognition
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        console.log('🎯 SIMPLE_DEMO: Speech recognition started');
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
        console.log('🎯 SIMPLE_DEMO: Speech recognized:', transcript);
        processUserTranscript(transcript);
      };
      
      recognition.onerror = (event: any) => {
        console.error('🎯 SIMPLE_DEMO: Speech recognition error:', event.error);
        
        // Don't show error for common non-critical issues
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setError(`Speech recognition error: ${event.error}`);
        }
        
        setIsListening(false);
      };
      
      recognition.onend = () => {
        console.log('🎯 SIMPLE_DEMO: Speech recognition ended');
        setIsListening(false);
        
        // Clear timeout
        if (listeningTimeoutRef.current) {
          clearTimeout(listeningTimeoutRef.current);
          listeningTimeoutRef.current = null;
        }
      };
      
      recognitionRef.current = recognition;
      recognition.start();
      
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
    
    setStatus('idle');
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Brain className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Simple Problem Shifting Demo</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Browser Speech Recognition + OpenAI TTS - No competing audio sources
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

      {/* Current Step Progress */}
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
          <span>Start Simple Demo</span>
        </button>

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
        <h6 className="font-medium text-gray-900 dark:text-white mb-2">Problem Shifting Steps:</h6>
        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          {PROBLEM_SHIFTING_STEPS.map((step, index) => (
            <div key={step.id} className={`flex items-center space-x-2 ${index === currentStepIndex ? 'text-indigo-600 dark:text-indigo-400 font-medium' : ''}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                index < currentStepIndex ? 'bg-green-500 text-white' :
                index === currentStepIndex ? 'bg-indigo-500 text-white' :
                'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
              }`}>
                {index < currentStepIndex ? '✓' : index + 1}
              </span>
              <span>{step.title}</span>
              {index === currentStepIndex && <ArrowRight className="h-3 w-3" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 