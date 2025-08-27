'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Brain, Mic, MicOff, Phone, PhoneOff, Play, Square, AlertCircle, CheckCircle, MessageSquare, RotateCcw, ArrowRight, Volume2 } from 'lucide-react';

interface VoiceSession {
  pc: RTCPeerConnection | null;
  audioEl: HTMLAudioElement | null;
  dataChannel: RTCDataChannel | null;
  micStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

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

// Exact Problem Shifting steps from the treatment state machine
const PROBLEM_SHIFTING_STEPS: ProblemShiftingStep[] = [
  {
    id: 'intro',
    title: 'Introduction & Problem Statement',
    script: 'Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. When I ask "what needs to happen for the problem to not be a problem?" allow your answers to be different each time. What is the problem you want to work on? Please tell me in a few words.',
    expectedResponseType: 'problem',
    nextStep: 'feel_problem'
  },
  {
    id: 'feel_problem',
    title: 'Feel the Problem',
    script: (userInput: string) => `Feel the problem '${userInput}'... what does it feel like?`,
    expectedResponseType: 'feeling',
    nextStep: 'body_sensation'
  },
  {
    id: 'body_sensation',
    title: 'Body Sensation Check',
    script: (userInput: string) => `Feel '${userInput}'... what happens in yourself when you feel '${userInput}'?`,
    expectedResponseType: 'experience',
    nextStep: 'what_needs_to_happen'
  },
  {
    id: 'what_needs_to_happen',
    title: 'What Needs to Happen',
    script: (userInput: string, context: any) => `Feel the problem '${context.problemStatement}'... what needs to happen for this to not be a problem?`,
    expectedResponseType: 'open',
    nextStep: 'feel_solution'
  },
  {
    id: 'feel_solution',
    title: 'Feel Solution State',
    script: (userInput: string) => `What would you feel like if '${userInput}' had already happened?`,
    expectedResponseType: 'feeling',
    nextStep: 'feel_good_state'
  },
  {
    id: 'feel_good_state',
    title: 'Feel Good State',
    script: (userInput: string) => `Feel '${userInput}'... what does '${userInput}' feel like?`,
    expectedResponseType: 'feeling',
    nextStep: 'what_happens_good'
  },
  {
    id: 'what_happens_good',
    title: 'What Happens in Good State',
    script: (userInput: string) => `Feel '${userInput}'... what happens in yourself when you feel '${userInput}'?`,
    expectedResponseType: 'experience',
    nextStep: 'check_problem'
  },
  {
    id: 'check_problem',
    title: 'Check if Still Problem',
    script: (userInput: string, context: any) => `Feel the problem '${context.problemStatement}'... does it still feel like a problem?`,
    expectedResponseType: 'yesno',
    nextStep: 'completion'
  },
  {
    id: 'completion',
    title: 'Session Complete',
    script: 'Excellent! The Problem Shifting process is now complete. You can open your eyes. How do you feel about the problem now?',
    expectedResponseType: 'open'
  }
];

export default function ProblemShiftingVoiceDemo() {
  const [status, setStatus] = useState<string>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [messages, setMessages] = useState<TreatmentMessage[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [sessionContext, setSessionContext] = useState<any>({
    problemStatement: '',
    userResponses: {}
  });
  
  const sessionRef = useRef<VoiceSession>({
    pc: null,
    audioEl: null,
    dataChannel: null,
    micStream: null,
    remoteStream: null
  });

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

  const cleanup = useCallback(() => {
    const session = sessionRef.current;
    try {
      if (session.dataChannel?.readyState === 'open') {
        session.dataChannel.close();
      }
      if (session.pc) {
        session.pc.close();
      }
      if (session.micStream) {
        session.micStream.getTracks().forEach(track => track.stop());
      }
      if (session.audioEl) {
        session.audioEl.remove();
      }
    } catch (err) {
      console.error('Cleanup error:', err);
    }
    
    sessionRef.current = {
      pc: null,
      audioEl: null,
      dataChannel: null,
      micStream: null,
      remoteStream: null
    };
    
    setIsConnected(false);
    setIsListening(false);
    setIsAIResponding(false);
    setStatus('idle');
  }, []);

  const getScriptedResponse = (step: ProblemShiftingStep, userInput: string = ''): string => {
    if (typeof step.script === 'function') {
      return step.script(userInput, sessionContext);
    }
    return step.script;
  };

  const createScriptedVoiceResponse = async (scriptedResponse: string) => {
    console.log(`🎯 PROBLEM_SHIFTING: Creating scripted response: "${scriptedResponse}"`);
    
    if (isAIResponding) {
      console.log(`🎯 PROBLEM_SHIFTING: Blocking - AI is currently responding`);
      return;
    }
    
    // Wait for DataChannel to be ready
    let attempts = 0;
    const maxAttempts = 15;
    
    while (sessionRef.current.dataChannel?.readyState !== 'open' && attempts < maxAttempts) {
      console.log(`🎯 PROBLEM_SHIFTING: Waiting for DataChannel, attempt ${attempts + 1}`);
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (sessionRef.current.dataChannel?.readyState !== 'open') {
      console.error('🎯 PROBLEM_SHIFTING: DataChannel not ready, aborting');
      return;
    }
    
    try {
      setIsAIResponding(true);
      
      // Create assistant message with exact script
      const assistantMessageEvent = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{
            type: 'text',
            text: scriptedResponse
          }]
        }
      };
      
      sessionRef.current.dataChannel.send(JSON.stringify(assistantMessageEvent));
      console.log(`🎯 PROBLEM_SHIFTING: Assistant message sent`);
      
      // Wait before triggering response
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Create response
      const responseEvent = {
        type: 'response.create',
        response: {
          modalities: ['audio', 'text']
        }
      };
      
      sessionRef.current.dataChannel.send(JSON.stringify(responseEvent));
      console.log(`🎯 PROBLEM_SHIFTING: Audio response triggered`);
      
      // Update UI immediately
      addMessage(scriptedResponse, false, currentStep.id);
      console.log(`🎯 PROBLEM_SHIFTING: UI updated with scripted response`);
      
    } catch (error) {
      console.error(`🎯 PROBLEM_SHIFTING: Failed to create scripted response:`, error);
      setIsAIResponding(false);
    }
  };

  const processUserTranscript = async (transcript: string) => {
    console.log(`🎯 PROBLEM_SHIFTING: Processing transcript: "${transcript}" for step: ${currentStep.id}`);
    
    // Store user response
    const newContext = {
      ...sessionContext,
      userResponses: {
        ...sessionContext.userResponses,
        [currentStep.id]: transcript
      }
    };

    // Store problem statement from first step
    if (currentStep.id === 'intro') {
      newContext.problemStatement = transcript;
    }

    setSessionContext(newContext);
    addMessage(transcript, true, currentStep.id);

    // Move to next step if available
    if (currentStepIndex < PROBLEM_SHIFTING_STEPS.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      
      const nextStep = PROBLEM_SHIFTING_STEPS[nextIndex];
      const nextResponse = getScriptedResponse(nextStep, transcript);
      
      // Wait a moment before responding
      setTimeout(() => {
        createScriptedVoiceResponse(nextResponse);
      }, 1000);
    } else {
      // Session complete
      console.log(`🎯 PROBLEM_SHIFTING: Session completed`);
      setStatus('completed');
    }
  };

  const startVoiceSession = async () => {
    try {
      setError('');
      setStatus('starting');

      // 1. Create ephemeral session
      const sessionResponse = await fetch('/api/labs/openai-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'verse',
          instructions: `You are conducting a Problem Shifting treatment session. Speak ONLY the exact text from assistant messages. Never generate original content or deviate from the provided scripts.`,
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: null, // Manual control
          temperature: 0.1 // Very low for consistency
        })
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.error || 'Failed to create session');
      }

      const sessionData = await sessionResponse.json();
      const ephemeralKey = sessionData?.client_secret?.value;
      
      if (!ephemeralKey) {
        throw new Error('No ephemeral key received');
      }

      // 2. Set up WebRTC
      const pc = new RTCPeerConnection();
      const remoteStream = new MediaStream();
      const audioEl = document.createElement('audio');
      
      audioEl.autoplay = true;
      audioEl.setAttribute('playsinline', 'true');
      audioEl.srcObject = remoteStream;
      document.body.appendChild(audioEl);

      sessionRef.current.pc = pc;
      sessionRef.current.audioEl = audioEl;
      sessionRef.current.remoteStream = remoteStream;

      pc.ontrack = (event) => {
        console.log('🎯 PROBLEM_SHIFTING: Audio track received');
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
        setStatus('connected');
        setIsConnected(true);
        
        // Send initial response when ready
        const checkDataChannel = () => {
          if (sessionRef.current.dataChannel?.readyState === 'open') {
            const initialResponse = getScriptedResponse(currentStep);
            console.log(`🎯 PROBLEM_SHIFTING: Sending initial response: "${initialResponse}"`);
            setTimeout(() => {
              createScriptedVoiceResponse(initialResponse);
            }, 1200);
          } else {
            setTimeout(checkDataChannel, 100);
          }
        };
        checkDataChannel();
      };

      pc.onconnectionstatechange = () => {
        console.log('🎯 PROBLEM_SHIFTING: Connection state:', pc.connectionState);
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
          setStatus(pc.connectionState);
          if (pc.connectionState === 'failed') {
            setError('Connection failed');
          }
        }
      };

      // 3. Get microphone
      console.log(`🎯 PROBLEM_SHIFTING: Requesting microphone access...`);
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000
        }
      });
      
      const [track] = micStream.getAudioTracks();
      pc.addTrack(track, micStream);
      sessionRef.current.micStream = micStream;

      // 4. Set up data channel
      const dataChannel = pc.createDataChannel('oai-events');
      sessionRef.current.dataChannel = dataChannel;

      dataChannel.addEventListener('open', () => {
        console.log('🎯 PROBLEM_SHIFTING: DataChannel opened');
        
        const sessionConfig = {
          type: 'session.update',
          session: {
            instructions: `You are conducting a Problem Shifting treatment session. Speak ONLY the exact text from assistant messages. Never generate original content.`,
            voice: 'verse',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 800
            },
            modalities: ['text', 'audio'],
            temperature: 0.1
          }
        };
        
        console.log('🎯 PROBLEM_SHIFTING: Sending session config');
        dataChannel.send(JSON.stringify(sessionConfig));
      });

      dataChannel.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log(`🎯 PROBLEM_SHIFTING: Event:`, message.type);
          
          if (message.type === 'input_audio_buffer.speech_started') {
            console.log(`🎯 PROBLEM_SHIFTING: User started speaking`);
            setIsListening(true);
          } 
          else if (message.type === 'input_audio_buffer.speech_stopped') {
            console.log(`🎯 PROBLEM_SHIFTING: User stopped speaking`);
            setIsListening(false);
          }
          else if (message.type === 'conversation.item.input_audio_transcription.completed') {
            const transcript = message.transcript?.trim();
            console.log(`🎯 PROBLEM_SHIFTING: Transcription:`, transcript);
            
            if (transcript && transcript.length > 1) {
              processUserTranscript(transcript);
            }
          }
          else if (message.type === 'response.created') {
            console.log(`🎯 PROBLEM_SHIFTING: Response started`);
            setIsAIResponding(true);
          }
          else if (message.type === 'response.done') {
            console.log(`🎯 PROBLEM_SHIFTING: Response completed`);
            setIsAIResponding(false);
          }
          else if (message.type === 'error') {
            console.error(`🎯 PROBLEM_SHIFTING: API Error:`, message.error);
            const errorCode = message.error?.code;
            const errorMessage = message.error?.message || '';
            
            // Filter out expected errors
            if (!['invalid_value', 'decimal_below_min_value', 'unknown_parameter', 'response_cancel_not_active'].includes(errorCode)) {
              setError(`API Error: ${errorMessage}`);
            }
          }
          
        } catch (err) {
          console.log(`🎯 PROBLEM_SHIFTING: Non-JSON message received`);
        }
      });

      // 5. Create and send WebRTC offer
      await pc.setLocalDescription(await pc.createOffer());

      const sdpUrl = `https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;
      const sdpResponse = await fetch(sdpUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        },
        body: pc.localDescription!.sdp
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(`SDP exchange failed: ${errorText}`);
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      console.log(`🎯 PROBLEM_SHIFTING: WebRTC connection established`);

    } catch (err: any) {
      setError(err.message);
      setStatus('error');
      cleanup();
    }
  };

  const resetDemo = () => {
    cleanup();
    setMessages([]);
    setCurrentStepIndex(0);
    setSessionContext({
      problemStatement: '',
      userResponses: {}
    });
    setStatus('idle');
  };

  const manualCommitSpeech = () => {
    if (sessionRef.current.dataChannel?.readyState === 'open') {
      try {
        sessionRef.current.dataChannel.send(JSON.stringify({
          type: 'input_audio_buffer.commit'
        }));
        console.log('🎯 PROBLEM_SHIFTING: Manually committed speech');
      } catch (error) {
        console.log('🎯 PROBLEM_SHIFTING: Failed to commit speech:', error);
      }
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Brain className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Problem Shifting Voice Demo</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Voice-guided Problem Shifting treatment - stays perfectly on script
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isAIResponding && (
            <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded-full text-sm">
              <Volume2 className="h-3 w-3" />
              <span>AI Speaking</span>
            </div>
          )}
          {isListening && (
            <div className="flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 rounded-full text-sm">
              <Mic className="h-3 w-3" />
              <span>Listening</span>
            </div>
          )}
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            status === 'connected' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
            status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
            status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
            status === 'starting' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
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
          onClick={startVoiceSession}
          disabled={isConnected || status === 'starting'}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Phone className="h-4 w-4" />
          <span>{status === 'starting' ? 'Starting...' : 'Start Problem Shifting Session'}</span>
        </button>

        {isConnected && (
          <button
            onClick={manualCommitSpeech}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Mic className="h-4 w-4" />
            <span>Done Speaking</span>
          </button>
        )}

        <button
          onClick={cleanup}
          disabled={!isConnected}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <PhoneOff className="h-4 w-4" />
          <span>End Session</span>
        </button>

        <button
          onClick={resetDemo}
          className="flex items-center space-x-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Reset Demo</span>
        </button>
      </div>

      {/* Connection Status */}
      {isConnected && status !== 'completed' && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md flex items-center">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
          <div className="flex-1">
            <span className="text-sm text-green-800 dark:text-green-200">
              🎙️ Voice session active! Speak naturally when prompted.
              {isAIResponding && " 🗣️ AI is currently speaking..."}
              {isListening && " 👂 Listening to your response..."}
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