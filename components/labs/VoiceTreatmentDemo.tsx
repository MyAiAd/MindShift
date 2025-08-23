'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Brain, Mic, MicOff, Phone, PhoneOff, Play, Square, AlertCircle, CheckCircle, MessageSquare, RotateCcw } from 'lucide-react';

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
  isVoice?: boolean;
}

interface TreatmentStep {
  id: string;
  phase: string;
  instruction: string;
  expectedResponse: string;
}

// Simple demo treatment flow - completely separate from production
const DEMO_TREATMENT_STEPS: TreatmentStep[] = [
  {
    id: 'welcome',
    phase: 'Introduction',
    instruction: 'Welcome to the Voice Treatment Demo. This is a safe demonstration that won\'t affect your actual treatment sessions. I\'m going to guide you through a simplified Mind Shifting process. Let\'s start by identifying something that\'s bothering you. What problem would you like to work on today?',
    expectedResponse: 'problem statement'
  },
  {
    id: 'problem_feeling',
    phase: 'Problem Identification', 
    instruction: 'Thank you for sharing that. Now, when you think about this problem, what do you feel in your body? Take a moment to notice any sensations, tension, or feelings that come up.',
    expectedResponse: 'body sensation'
  },
  {
    id: 'feeling_location',
    phase: 'Body Awareness',
    instruction: 'Good. Now focus on that feeling. Where exactly do you notice it in your body? Is it in your chest, stomach, shoulders, or somewhere else?',
    expectedResponse: 'location description'
  },
  {
    id: 'feeling_quality',
    phase: 'Sensation Exploration',
    instruction: 'Perfect. Now I want you to really feel that sensation. What does it feel like? Is it heavy, tight, hot, cold, moving, or still? Describe the quality of this feeling.',
    expectedResponse: 'sensation quality'
  },
  {
    id: 'completion',
    phase: 'Demo Complete',
    instruction: 'Excellent work! This concludes our voice treatment demo. In a real session, we would continue deeper into the Mind Shifting process, but this gives you a taste of how voice-guided treatment works. You can restart the demo anytime to try again.',
    expectedResponse: 'acknowledgment'
  }
];

export default function VoiceTreatmentDemo() {
  const [status, setStatus] = useState<string>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [messages, setMessages] = useState<TreatmentMessage[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  
  const sessionRef = useRef<VoiceSession>({
    pc: null,
    audioEl: null,
    dataChannel: null,
    micStream: null,
    remoteStream: null
  });

  const recognitionRef = useRef<any>(null);
  const currentStep = DEMO_TREATMENT_STEPS[currentStepIndex];

  const addMessage = useCallback((content: string, isUser: boolean, isVoice: boolean = false) => {
    const message: TreatmentMessage = {
      id: Date.now().toString(),
      content,
      isUser,
      timestamp: new Date(),
      isVoice
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
      if (recognitionRef.current) {
        recognitionRef.current.stop();
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
    setStatus('idle');
    setIsListening(false);
  }, []);

  const startVoiceSession = async () => {
    try {
      setError('');
      setStatus('starting');

      // 1. Create ephemeral session with treatment-specific instructions
      const treatmentInstructions = `You are a Mind Shifting treatment assistant conducting a voice-guided demo session. 

Current step: ${currentStep.phase}
Your instruction to give: "${currentStep.instruction}"

Rules:
1. Speak naturally and conversationally
2. Be empathetic and supportive
3. Keep responses concise but warm
4. Guide the user through the current step
5. Don't move to the next step - just focus on the current instruction
6. If user seems confused, gently repeat or clarify the current step
7. This is a DEMO - remind them it's safe and separate from real treatment`;

      const sessionResponse = await fetch('/api/labs/openai-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'verse',
          instructions: treatmentInstructions
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
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
        setStatus('connected');
        setIsConnected(true);
        
        // Add the initial treatment message
        addMessage(currentStep.instruction, false, true);
      };

      pc.onconnectionstatechange = () => {
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
          setStatus(pc.connectionState);
          if (pc.connectionState === 'failed') {
            setError('Connection failed');
          }
        }
      };

      // 3. Get microphone
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const [track] = micStream.getAudioTracks();
      pc.addTrack(track, micStream);
      sessionRef.current.micStream = micStream;

      // 4. Set up data channel
      const dataChannel = pc.createDataChannel('oai-events');
      sessionRef.current.dataChannel = dataChannel;

      dataChannel.addEventListener('open', () => {
        // Send initial session update
        dataChannel.send(JSON.stringify({
          type: 'session.update',
          session: { 
            instructions: treatmentInstructions,
            voice: 'verse'
          }
        }));
      });

      dataChannel.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          // Handle conversation events if needed
          if (message.type === 'conversation.item.input_audio_transcription.completed') {
            setLastTranscript(message.transcript || '');
            addMessage(message.transcript || '', true, true);
          }
        } catch (err) {
          // Ignore non-JSON messages
        }
      });

      // 5. Create and send offer
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

      setStatus('connected');
      setIsConnected(true);
      setIsListening(true);

    } catch (err: any) {
      setError(err.message);
      setStatus('error');
      cleanup();
    }
  };

  const nextStep = () => {
    if (currentStepIndex < DEMO_TREATMENT_STEPS.length - 1) {
      const newIndex = currentStepIndex + 1;
      setCurrentStepIndex(newIndex);
      const nextStepData = DEMO_TREATMENT_STEPS[newIndex];
      
      addMessage(nextStepData.instruction, false, false);
      
      // Update AI context if connected
      if (sessionRef.current.dataChannel?.readyState === 'open') {
        const newInstructions = `You are a Mind Shifting treatment assistant conducting a voice-guided demo session. 

Current step: ${nextStepData.phase}
Your instruction to give: "${nextStepData.instruction}"

Rules:
1. Speak naturally and conversationally
2. Be empathetic and supportive
3. Keep responses concise but warm
4. Guide the user through the current step
5. Don't move to the next step - just focus on the current instruction
6. If user seems confused, gently repeat or clarify the current step
7. This is a DEMO - remind them it's safe and separate from real treatment`;

        sessionRef.current.dataChannel.send(JSON.stringify({
          type: 'session.update',
          session: { instructions: newInstructions }
        }));
      }
    }
  };

  const resetDemo = () => {
    cleanup();
    setMessages([]);
    setCurrentStepIndex(0);
    setLastTranscript('');
  };

  const stopAudio = () => {
    if (sessionRef.current.audioEl) {
      sessionRef.current.audioEl.pause();
      sessionRef.current.audioEl.currentTime = 0;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Brain className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Voice Treatment Demo</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Safe demo of voice-guided Mind Shifting treatment
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            status === 'connected' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
            status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
            status === 'starting' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
            'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
          }`}>
            {status}
          </div>
        </div>
      </div>

      {/* Current Step Info */}
      <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-md">
        <div className="flex items-center justify-between">
          <div>
            <h5 className="font-medium text-indigo-900 dark:text-indigo-200">
              Step {currentStepIndex + 1} of {DEMO_TREATMENT_STEPS.length}: {currentStep.phase}
            </h5>
            <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
              Expected: {currentStep.expectedResponse}
            </p>
          </div>
          <div className="text-right">
            <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${((currentStepIndex + 1) / DEMO_TREATMENT_STEPS.length) * 100}%` }}
              ></div>
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {Math.round(((currentStepIndex + 1) / DEMO_TREATMENT_STEPS.length) * 100)}%
            </span>
          </div>
        </div>
      </div>

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
          <span>{status === 'starting' ? 'Starting...' : 'Start Voice Session'}</span>
        </button>

        <button
          onClick={nextStep}
          disabled={!isConnected || currentStepIndex >= DEMO_TREATMENT_STEPS.length - 1}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Next Step</span>
        </button>

        <button
          onClick={stopAudio}
          disabled={!isConnected}
          className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Square className="h-4 w-4" />
          <span>Stop Audio</span>
        </button>

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
      {isConnected && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md flex items-center">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
          <div className="flex-1">
            <span className="text-sm text-green-800 dark:text-green-200">
              Voice session active! Speak naturally and the AI will guide you through the treatment step.
            </span>
            {isListening && (
              <div className="flex items-center mt-1">
                <Mic className="h-4 w-4 text-green-600 dark:text-green-400 mr-1" />
                <span className="text-xs text-green-700 dark:text-green-300">Listening...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div>
          <h5 className="font-medium text-gray-900 dark:text-white mb-3">Session Conversation</h5>
          <div className="space-y-3 max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-900/20 rounded-lg p-4">
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
                  <div className="flex items-center space-x-1 mb-1">
                    {message.isVoice && (
                      <Mic className="h-3 w-3 opacity-70" />
                    )}
                    <span className="text-xs opacity-70">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demo Notice */}
      <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5" />
          <div className="text-sm text-yellow-800 dark:text-yellow-200">
            <p className="font-medium mb-1">Demo Mode Active</p>
            <p>This is a safe demonstration that doesn't affect your real treatment sessions. It uses a simplified treatment flow to showcase voice-guided therapy capabilities.</p>
          </div>
        </div>
      </div>
    </div>
  );
} 