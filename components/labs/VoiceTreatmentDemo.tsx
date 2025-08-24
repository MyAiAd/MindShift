'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Brain, Mic, MicOff, Phone, PhoneOff, Play, Square, AlertCircle, CheckCircle, MessageSquare, RotateCcw, Settings, Shield } from 'lucide-react';
import { TreatmentStateMachineDemo } from './TreatmentStateMachineDemo';

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

interface DemoContext {
  problemStatement: string;
  goalStatement: string;
  experienceStatement: string;
  userResponses: Record<string, string>;
}

type TreatmentModality = 'problem_shifting' | 'reality_shifting' | 'belief_shifting' | 'identity_shifting' | 'blockage_shifting' | 'trauma_shifting';

export default function VoiceTreatmentDemo() {
  const [status, setStatus] = useState<string>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [messages, setMessages] = useState<TreatmentMessage[]>([]);
  const [selectedModality, setSelectedModality] = useState<TreatmentModality>('problem_shifting');
  const [demoContext, setDemoContext] = useState<DemoContext>({
    problemStatement: '',
    goalStatement: '',
    experienceStatement: '',
    userResponses: {}
  });
  
  const [stateMachineDemo, setStateMachineDemo] = useState<TreatmentStateMachineDemo | null>(null);
  const [conversationItems, setConversationItems] = useState<Map<string, any>>(new Map());
  
  const sessionRef = useRef<VoiceSession>({
    pc: null,
    audioEl: null,
    dataChannel: null,
    micStream: null,
    remoteStream: null
  });

  // Context update helper
  const updateContextFromTranscript = (transcript: string) => {
    // Store user responses based on current step
    setDemoContext(prev => ({
      ...prev,
      userResponses: {
        ...prev.userResponses,
        [Date.now().toString()]: transcript.trim()
      }
    }));
  };

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
  }, []);

  // CRITICAL: Process transcript and create manual response
  const processTranscriptWithStateMachine = async (transcript: string) => {
    if (!stateMachineDemo) return;
    
    console.log(`🔍 VOICE_DEBUG: Processing transcript: "${transcript}"`);
    
    try {
      const result = await stateMachineDemo.processUserInput(transcript, undefined, true);
      console.log(`🔍 VOICE_DEBUG: State machine result:`, result);
      
      if (result.scriptedResponse) {
        console.log(`🔍 VOICE_DEBUG: Got scripted response: "${result.scriptedResponse}"`);
        return result.scriptedResponse;
      }
    } catch (error) {
      console.error(`🔍 VOICE_DEBUG: Error processing transcript with state machine:`, error);
    }
    
    return null;
  };

  const startVoiceSession = async () => {
    try {
      setError('');
      setStatus('starting');

      // Get initial response from state machine
      const initialResponse = "What problem would you like to work on today? Please state it in a few words.";

      // 1. Create ephemeral session with CRITICAL transcription settings
      const sessionResponse = await fetch('/api/labs/openai-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'verse',
          instructions: `You are a Mind Shifting treatment assistant. Speak exactly what you are instructed to speak.`,
          // CRITICAL: Enable transcription
          input_audio_transcription: {
            model: 'whisper-1'
          },
          // CRITICAL: Disable automatic responses - we control them manually
          turn_detection: null
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
        
        // Since we disabled automatic turn detection, manually create the initial response
        setTimeout(() => {
          if (sessionRef.current.dataChannel?.readyState === 'open') {
            try {
              const initialResponseMessage = {
                type: 'response.create',
                response: {
                  modalities: ['audio', 'text'],
                  instructions: `Speak exactly and only this text: "${initialResponse}". Do not add any other words before or after.`
                }
              };
              
              sessionRef.current.dataChannel.send(JSON.stringify(initialResponseMessage));
              console.log(`🔍 VOICE_DEBUG: Initial manual response creation sent`);
              
              // Add the initial treatment message
              addMessage(initialResponse, false, true);
              
            } catch (error) {
              console.error(`🔍 VOICE_DEBUG: Failed to create initial manual response:`, error);
            }
          }
        }, 1000);
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

      // 4. Set up data channel with MANUAL RESPONSE CONTROL
      const dataChannel = pc.createDataChannel('oai-events');
      sessionRef.current.dataChannel = dataChannel;

      dataChannel.addEventListener('open', () => {
        console.log('🔍 VOICE_DEBUG: DataChannel opened, configuring session...');
        
        // Configure session with manual control
        const sessionConfig = {
          type: 'session.update',
          session: {
            instructions: `You are a Mind Shifting treatment assistant. Speak exactly what you are instructed to speak.`,
            voice: 'verse',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: null  // CRITICAL: Disable automatic responses
          }
        };
        
        console.log('🔍 VOICE_DEBUG: Sending session config:', sessionConfig);
        dataChannel.send(JSON.stringify(sessionConfig));
      });

      // 5. CRITICAL: Manual response handling
      dataChannel.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log(`🔍 VOICE_DEBUG: Received message:`, message.type, message);
          
          // Handle user transcription completion - manually create response
          if (message.type === 'conversation.item.input_audio_transcription.completed') {
            const transcript = message.transcript?.trim();
            console.log(`🔍 VOICE_DEBUG: User transcript completed:`, transcript);
            
            if (transcript) {
              addMessage(transcript, true, true);
              
              // Process with state machine to get the scripted response
              if (stateMachineDemo) {
                processTranscriptWithStateMachine(transcript).then((scriptedResponse) => {
                  if (scriptedResponse) {
                    console.log(`🔍 VOICE_DEBUG: Creating manual response: "${scriptedResponse}"`);
                    
                    // Manually create the response with our exact text
                    if (sessionRef.current.dataChannel?.readyState === 'open') {
                      try {
                        const responseMessage = {
                          type: 'response.create',
                          response: {
                            modalities: ['audio', 'text'],
                            instructions: `Speak exactly and only this text: "${scriptedResponse}". Do not add any other words before or after.`
                          }
                        };
                        
                        sessionRef.current.dataChannel.send(JSON.stringify(responseMessage));
                        console.log(`🔍 VOICE_DEBUG: Manual response creation sent`);
                        
                        // Add the AI response to our message history
                        addMessage(scriptedResponse, false, true);
                        
                      } catch (error) {
                        console.error(`🔍 VOICE_DEBUG: Failed to create manual response:`, error);
                      }
                    }
                  } else {
                    console.log(`🔍 VOICE_DEBUG: No scripted response available for manual creation`);
                  }
                });
              }
              
              // Update context
              updateContextFromTranscript(transcript);
            }
          }
          
          // Handle AI responses (for logging)
          else if (message.type === 'response.audio_transcript.delta') {
            const aiText = message.delta;
            if (aiText) {
              console.log(`🔍 VOICE_DEBUG: AI saying:`, aiText);
            }
          }
          
          // Handle response completion
          else if (message.type === 'response.done') {
            console.log(`🔍 VOICE_DEBUG: AI response completed`);
          }
          
          // Handle conversation items (store for debugging)
          else if (message.type === 'conversation.item.created') {
            if (message.item?.id) {
              setConversationItems(prev => {
                const newMap = new Map(prev);
                newMap.set(message.item.id, message.item);
                return newMap;
              });
            }
          }
          
        } catch (err) {
          console.log(`🔍 VOICE_DEBUG: Non-JSON message:`, event.data);
        }
      });

      // 6. Create and send WebRTC offer
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

    } catch (err: any) {
      setError(err.message);
      setStatus('error');
      cleanup();
    }
  };

  // Initialize state machine
  const initializeStateMachine = async () => {
    if (!stateMachineDemo) {
      const demo = new TreatmentStateMachineDemo();
      setStateMachineDemo(demo);
      
      try {
        await demo.initializeSession(selectedModality, undefined, true);
      } catch (error) {
        console.error('Failed to initialize state machine:', error);
        setError('Failed to initialize treatment state machine');
      }
    }
  };

  useEffect(() => {
    initializeStateMachine();
  }, [selectedModality]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Brain className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Voice Treatment Demo</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Voice-guided Mind Shifting treatment with precise script control
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
          onClick={cleanup}
          disabled={!isConnected}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <PhoneOff className="h-4 w-4" />
          <span>End Session</span>
        </button>
      </div>

      {/* Connection Status */}
      {isConnected && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md flex items-center">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
          <div className="flex-1">
            <span className="text-sm text-green-800 dark:text-green-200">
              Voice session active! The AI will speak exactly the scripted responses from your state machine.
            </span>
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
    </div>
  );
} 