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

interface BlockageShiftingStep {
  id: string;
  title: string;
  script: string | ((userInput: string, context: any) => string);
  expectedResponseType: 'problem' | 'feeling' | 'experience' | 'open' | 'yesno';
  nextStep?: string;
}

// Simplified Blockage Shifting steps
const BLOCKAGE_SHIFTING_STEPS: BlockageShiftingStep[] = [
  {
    id: 'problem_capture',
    title: 'Problem Statement',
    script: 'Mind Shifting is not like counselling, therapy or life coaching. The Mind Shifting methods are verbal guided processes that we apply to problems, goals, or negative experiences in order to clear them. Please tell me what problem you want to work on in a few words.',
    expectedResponseType: 'problem',
    nextStep: 'blockage_shifting_intro'
  },
  {
    id: 'blockage_shifting_intro',
    title: 'Blockage Shifting Introduction',
    script: (userInput: string, context: any) => {
      const problemStatement = context?.problemStatement || 'the problem';
      return `Please close your eyes and keep them closed throughout the process. Feel the problem '${problemStatement}'... what does it feel like?`;
    },
    expectedResponseType: 'feeling',
    nextStep: 'blockage_step_a'
  },
  {
    id: 'blockage_step_a',
    title: 'Blockage Step A',
    script: (userInput: string) => {
      const feeling = userInput || 'that feeling';
      return `Feel '${feeling}'... what does '${feeling}' feel like?`;
    },
    expectedResponseType: 'feeling',
    nextStep: 'blockage_step_b'
  },
  {
    id: 'blockage_step_b',
    title: 'Blockage Step B',
    script: (userInput: string) => {
      const feeling = userInput || 'that feeling';
      return `Feel '${feeling}'... what happens in yourself when you feel '${feeling}'?`;
    },
    expectedResponseType: 'feeling',
    nextStep: 'blockage_step_c'
  },
  {
    id: 'blockage_step_c',
    title: 'Blockage Step C',
    script: 'What would you rather feel?',
    expectedResponseType: 'feeling',
    nextStep: 'blockage_step_d'
  },
  {
    id: 'blockage_step_d',
    title: 'Blockage Step D',
    script: (userInput: string) => {
      const desiredFeeling = userInput || 'that feeling';
      return `Feel '${desiredFeeling}'... what does '${desiredFeeling}' feel like?`;
    },
    expectedResponseType: 'feeling',
    nextStep: 'blockage_check'
  },
  {
    id: 'blockage_check',
    title: 'Blockage Check',
    script: (userInput: string, context: any) => {
      const problemStatement = context?.problemStatement || 'the problem';
      return `Is '${problemStatement}' still a problem?`;
    },
    expectedResponseType: 'yesno',
    nextStep: 'session_complete'
  },
  {
    id: 'session_complete',
    title: 'Session Complete',
    script: 'Thank you for participating in this Blockage Shifting demo. The treatment process has been completed.',
    expectedResponseType: 'open'
  }
];

export default function BlockageShiftingDemo() {
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

  const currentStep = BLOCKAGE_SHIFTING_STEPS[currentStepIndex];

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

  const getScriptedResponse = (step: BlockageShiftingStep, userInput: string = '', context?: any): string => {
    if (typeof step.script === 'function') {
      return step.script(userInput, context || sessionContext);
    }
    return step.script;
  };

  // Validation logic (same as Problem Shifting)
  const validateUserInput = (transcript: string, stepId: string): { isValid: boolean; error?: string } => {
    const trimmed = transcript.trim();
    const lowerInput = trimmed.toLowerCase();
    const words = trimmed.split(/\s+/).length;

    if (stepId === 'problem_capture') {
      const goalIndicators = ['want to', 'want', 'wish to', 'hope to', 'plan to', 'goal', 'achieve', 'get', 'become', 'have', 'need to', 'would like to'];
      const hasGoalLanguage = goalIndicators.some(indicator => lowerInput.includes(indicator));
      
      if (hasGoalLanguage) {
        return { isValid: false, error: 'How would you state that as a problem instead of a goal?' };
      }
      
      const questionIndicators = ['how can', 'how do', 'what should', 'why do', 'when will', 'where can', 'should i', 'how do i', 'what can i'];
      const hasQuestionLanguage = questionIndicators.some(indicator => lowerInput.includes(indicator)) || trimmed.endsWith('?');
      
      if (hasQuestionLanguage) {
        return { isValid: false, error: 'How would you state that as a problem instead of a question?' };
      }

      if (words < 2) {
        return { isValid: false, error: 'Please tell me a bit more about the problem you want to work on.' };
      }
    }

    return { isValid: true };
  };

  const speakText = async (text: string) => {
    if (isSpeaking) return;

    try {
      setIsSpeaking(true);
      lastSpokenTextRef.current = text.toLowerCase();

      // Try browser TTS first
      if ('speechSynthesis' in window && text.length < 200) {
        try {
          await new Promise<void>((resolve, reject) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.1;
            utterance.onend = () => {
              setIsSpeaking(false);
              if (statusRef.current === 'active') {
                setTimeout(() => {
                  if (statusRef.current === 'active') startListening();
                }, 800);
              }
              resolve();
            };
            utterance.onerror = () => reject(new Error('Browser TTS failed'));
            speechSynthesis.speak(utterance);
          });
          return;
        } catch (browserError) {
          // Fall back to OpenAI TTS
        }
      }

      // OpenAI TTS fallback
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'nova', model: 'tts-1-hd', speed: 1.0 }) // Consistent female voice across all demos
      });

      if (!response.ok) throw new Error(`TTS API failed: ${response.status}`);

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      return new Promise<void>((resolve, reject) => {
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          setIsSpeaking(false);
          
          if (statusRef.current === 'active') {
            setTimeout(() => {
              if (statusRef.current === 'active') startListening();
            }, 600);
          }
          resolve();
        };
        
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          setIsSpeaking(false);
          reject(new Error('TTS playback failed'));
        };
        
        audio.play().catch(reject);
      });
      
    } catch (error) {
      setIsSpeaking(false);
      throw error;
    }
  };

  const processUserTranscript = async (transcript: string) => {
    const currentStepFromRef = BLOCKAGE_SHIFTING_STEPS[currentStepIndexRef.current];
    
    // Check for audio feedback
    const transcriptLower = transcript.toLowerCase();
    const lastSpoken = lastSpokenTextRef.current;
    
    if (lastSpoken && transcriptLower.includes(lastSpoken.substring(0, 20))) {
      return; // Ignore audio feedback
    }
    
    // Validate input
    const validation = validateUserInput(transcript, currentStepFromRef.id);
    
    if (!validation.isValid) {
      addMessage(transcript, true, currentStepFromRef.id);
      setTimeout(() => {
        speakText(validation.error!);
      }, 500);
      return;
    }

    // Store user response
    const newContext = {
      ...sessionContext,
      userResponses: {
        ...sessionContext.userResponses,
        [currentStepFromRef.id]: transcript
      }
    };

    if (currentStepFromRef.id === 'problem_capture') {
      newContext.problemStatement = transcript;
    }

    setSessionContext(newContext);
    addMessage(transcript, true, currentStepFromRef.id);

    // Move to next step
    const currentIndex = currentStepIndexRef.current;
    if (currentIndex < BLOCKAGE_SHIFTING_STEPS.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentStepIndex(nextIndex);
      
      const nextStep = BLOCKAGE_SHIFTING_STEPS[nextIndex];
      const nextResponse = getScriptedResponse(nextStep, transcript, newContext);
      
      addMessage(nextResponse, false, nextStep.id);
      speakText(nextResponse);
    } else {
      setStatus('completed');
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    if (statusRef.current !== 'active' || isListeningRef.current) return;
    
    if (recognitionRef.current) {
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
        setIsListening(true);
        setError('');
        listeningTimeoutRef.current = setTimeout(() => stopListening(), 30000);
      };
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        processUserTranscript(transcript);
      };
      
      recognition.onerror = (event: any) => {
        if (event.error === 'audio-capture') {
          setError('Microphone access denied or not available.');
        } else if (event.error === 'not-allowed') {
          setError('Microphone permission denied.');
        } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
          setError(`Speech recognition error: ${event.error}`);
        }
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
        
        if (listeningTimeoutRef.current) {
          clearTimeout(listeningTimeoutRef.current);
          listeningTimeoutRef.current = null;
        }
        
        if (statusRef.current === 'active') {
          setTimeout(() => {
            if (statusRef.current === 'active') startListening();
          }, 1500);
        }
      };
      
      recognitionRef.current = recognition;
      recognition.start();
      
    } catch (error) {
      setError('Failed to start speech recognition');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    
    if (listeningTimeoutRef.current) {
      clearTimeout(listeningTimeoutRef.current);
      listeningTimeoutRef.current = null;
    }
  };

  const startDemo = async () => {
    setStatus('active');
    statusRef.current = 'active';
    setMessages([]);
    setCurrentStepIndex(0);
    setSessionContext({ problemStatement: '', userResponses: {} });

    const initialResponse = getScriptedResponse(currentStep);
    addMessage(initialResponse, false, currentStep.id);
    
    setTimeout(() => {
      speakText(initialResponse);
    }, 500);
  };

  const stopDemo = () => {
    stopListening();
    
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    
    setStatus('idle');
    statusRef.current = 'idle';
    setIsSpeaking(false);
    setError('');
  };

  const resetDemo = () => {
    stopDemo();
    setMessages([]);
    setCurrentStepIndex(0);
    setSessionContext({ problemStatement: '', userResponses: {} });
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Brain className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Blockage Shifting Demo</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Voice-guided Blockage Shifting treatment with manual speech control
            </p>
          </div>
        </div>
      </div>

      {/* Current Step Progress */}
      {status === 'active' && (
        <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-medium text-indigo-900 dark:text-indigo-200">
              Step {currentStepIndex + 1} of {BLOCKAGE_SHIFTING_STEPS.length}: {currentStep.title}
            </h5>
            <span className="text-sm text-indigo-700 dark:text-indigo-300">
              Expected: {currentStep.expectedResponseType}
            </span>
          </div>
          <div className="w-full bg-indigo-200 dark:bg-indigo-800 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${((currentStepIndex + 1) / BLOCKAGE_SHIFTING_STEPS.length) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Working On Display */}
      {sessionContext.problemStatement && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <h5 className="font-medium text-green-900 dark:text-green-200 mb-1">Working On:</h5>
          <p className="text-sm text-green-700 dark:text-green-300">Problem: "{sessionContext.problemStatement}"</p>
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
          <span>Start Blockage Shifting</span>
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
              🎙️ Blockage Shifting demo active! 
              {isSpeaking && " 🗣️ AI is speaking..."}
              {isListening && " 👂 Listening..."}
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
              <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm ${
                  message.isUser ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}>
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step Guide */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
        <h6 className="font-medium text-gray-900 dark:text-white mb-2">Blockage Shifting Steps:</h6>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          {BLOCKAGE_SHIFTING_STEPS.map((step, index) => (
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