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
  const [showModalitySelector, setShowModalitySelector] = useState(false);
  const [isListening, setIsListening] = useState(false);
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

  // Treatment modality definitions
  const TREATMENT_MODALITIES = {
    problem_shifting: { name: 'Problem Shifting', description: 'Transform problems into solutions' },
    reality_shifting: { name: 'Reality Shifting', description: 'Achieve your goals and desires' },
    belief_shifting: { name: 'Belief Shifting', description: 'Change limiting beliefs' },
    identity_shifting: { name: 'Identity Shifting', description: 'Transform your sense of self' },
    blockage_shifting: { name: 'Blockage Shifting', description: 'Remove internal obstacles' },
    trauma_shifting: { name: 'Trauma Shifting', description: 'Process and heal trauma' }
  };

  // Context update helper
  const updateContextFromTranscript = (transcript: string) => {
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
    setIsListening(false);
    setStatus('idle');
  }, []);

  // FIXED: Proper scripted response creation with better timing
  const createScriptedVoiceResponse = async (scriptedResponse: string, userTranscript: string = '') => {
    const dataChannel = sessionRef.current.dataChannel;
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.error('🔍 VOICE_DEBUG: DataChannel not ready for scripted response');
      await new Promise(resolve => setTimeout(resolve, 100)); // Brief wait
      if (!dataChannel || dataChannel.readyState !== 'open') {
        console.error('🔍 VOICE_DEBUG: DataChannel still not ready, skipping response');
        return;
      }
    }
    
    try {
      console.log(`🔍 VOICE_DEBUG: Creating scripted response: "${scriptedResponse}"`);
      
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
      
      dataChannel.send(JSON.stringify(assistantMessageEvent));
      console.log(`🔍 VOICE_DEBUG: Assistant message sent to conversation`);
      
      // Wait then trigger audio response
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const responseEvent = {
        type: 'response.create',
        response: {
          modalities: ['audio']
        }
      };
      
      dataChannel.send(JSON.stringify(responseEvent));
      console.log(`🔍 VOICE_DEBUG: Audio response generation triggered`);
      
      // Update UI
      addMessage(scriptedResponse, false, true);
      
    } catch (error) {
      console.error(`🔍 VOICE_DEBUG: Failed to create scripted response:`, error);
    }
  };

  // FIXED: Better transcript processing with proper state machine integration
  const processTranscriptWithStateMachine = async (transcript: string) => {
    if (!stateMachineDemo) {
      console.log(`🔍 VOICE_DEBUG: State machine not initialized, initializing now...`);
      const demo = new TreatmentStateMachineDemo();
      setStateMachineDemo(demo);
      
      try {
        await demo.initializeSession(selectedModality, transcript, true);
        console.log(`🔍 VOICE_DEBUG: State machine initialized for transcript processing`);
      } catch (error) {
        console.error(`🔍 VOICE_DEBUG: Failed to initialize state machine:`, error);
        return null;
      }
    }
    
    console.log(`🔍 VOICE_DEBUG: Processing transcript: "${transcript}"`);
    
    try {
      const result = await stateMachineDemo!.processUserInput(transcript, undefined, true);
      console.log(`🔍 VOICE_DEBUG: State machine result:`, result);
      
      if (result.scriptedResponse) {
        console.log(`🔍 VOICE_DEBUG: Got scripted response: "${result.scriptedResponse}"`);
        await createScriptedVoiceResponse(result.scriptedResponse, transcript);
        return result.scriptedResponse;
      }
    } catch (error) {
      console.error(`🔍 VOICE_DEBUG: Error processing transcript:`, error);
    }
    
    return null;
  };

  const startVoiceSession = async () => {
    try {
      setError('');
      setStatus('starting');

      // Initialize state machine first
      if (!stateMachineDemo) {
        console.log(`🔍 VOICE_DEBUG: Initializing state machine...`);
        const demo = new TreatmentStateMachineDemo();
        setStateMachineDemo(demo);
        await demo.initializeSession(selectedModality, undefined, true);
        console.log(`🔍 VOICE_DEBUG: State machine initialized`);
      }

      // Get initial response
      let initialResponse = "What problem would you like to work on today? Please state it in a few words.";
      if (stateMachineDemo) {
        try {
          const result = await stateMachineDemo.processUserInput("", undefined, true);
          if (result.scriptedResponse && result.scriptedResponse !== "Please provide a response.") {
            initialResponse = result.scriptedResponse;
          }
        } catch (error) {
          console.log(`🔍 VOICE_DEBUG: Using fallback initial response`);
        }
      }

      // 1. Create ephemeral session
      const sessionResponse = await fetch('/api/labs/openai-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'verse',
          instructions: `You are a Mind Shifting treatment assistant. Speak only the exact text from assistant messages. Never generate original responses.`,
          // FIXED: Enable transcription AND server VAD for better speech detection
          input_audio_transcription: {
            model: 'whisper-1'
          },
          // FIXED: Enable server-side voice activity detection
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 800
          }
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
        console.log('🔍 VOICE_DEBUG: Audio track received');
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
        setStatus('connected');
        setIsConnected(true);
        
        // Wait for data channel to be ready before sending initial response
        const checkDataChannel = () => {
          if (sessionRef.current.dataChannel?.readyState === 'open') {
            setTimeout(() => {
              createScriptedVoiceResponse(initialResponse, '');
            }, 1000);
          } else {
            setTimeout(checkDataChannel, 100);
          }
        };
        checkDataChannel();
      };

      pc.onconnectionstatechange = () => {
        console.log('🔍 VOICE_DEBUG: Connection state:', pc.connectionState);
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
          setStatus(pc.connectionState);
          if (pc.connectionState === 'failed') {
            setError('Connection failed');
          }
        }
      };

      // 3. Get microphone with better constraints
      console.log(`🔍 VOICE_DEBUG: Requesting microphone access...`);
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000
        }
      });
      
      console.log(`🔍 VOICE_DEBUG: Microphone access granted, tracks:`, micStream.getAudioTracks().length);
      
      const [track] = micStream.getAudioTracks();
      pc.addTrack(track, micStream);
      sessionRef.current.micStream = micStream;

      // 4. Set up data channel with improved event handling
      const dataChannel = pc.createDataChannel('oai-events');
      sessionRef.current.dataChannel = dataChannel;

      dataChannel.addEventListener('open', () => {
        console.log('🔍 VOICE_DEBUG: DataChannel opened');
        
        // FIXED: More comprehensive session configuration
        const sessionConfig = {
          type: 'session.update',
          session: {
            instructions: `You are conducting a Mind Shifting treatment session. Speak ONLY the exact text from assistant messages. Never generate original content.`,
            voice: 'verse',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            // FIXED: Use server VAD for automatic speech detection
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
        
        console.log('🔍 VOICE_DEBUG: Sending session config');
        dataChannel.send(JSON.stringify(sessionConfig));
      });

      // FIXED: Enhanced message handling with better speech detection
      dataChannel.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log(`🔍 VOICE_DEBUG: Event:`, message.type);
          
          // Speech detection events
          if (message.type === 'input_audio_buffer.speech_started') {
            console.log(`🔍 VOICE_DEBUG: User started speaking`);
            setIsListening(true);
          } 
          else if (message.type === 'input_audio_buffer.speech_stopped') {
            console.log(`🔍 VOICE_DEBUG: User stopped speaking`);
            setIsListening(false);
          } 
          else if (message.type === 'input_audio_buffer.committed') {
            console.log(`🔍 VOICE_DEBUG: Audio committed, waiting for transcription`);
          }
          
          // FIXED: Handle user transcription with better processing
          else if (message.type === 'conversation.item.input_audio_transcription.completed') {
            const transcript = message.transcript?.trim();
            console.log(`🔍 VOICE_DEBUG: Transcription completed:`, transcript);
            
            if (transcript && transcript.length > 1) {
              addMessage(transcript, true, true);
              updateContextFromTranscript(transcript);
              
              // Process with state machine
              if (stateMachineDemo) {
                processTranscriptWithStateMachine(transcript);
              }
            }
          }
          
          // AI response events
          else if (message.type === 'response.audio_transcript.delta') {
            const aiText = message.delta;
            if (aiText) {
              console.log(`🔍 VOICE_DEBUG: AI speaking:`, aiText);
            }
          }
          
          else if (message.type === 'response.done') {
            console.log(`🔍 VOICE_DEBUG: AI response completed`);
          }
          
          // Session events
          else if (message.type === 'session.created') {
            console.log(`🔍 VOICE_DEBUG: Session created`);
          }
          
          else if (message.type === 'session.updated') {
            console.log(`🔍 VOICE_DEBUG: Session updated successfully`);
          }
          
          // Error handling
          else if (message.type === 'error') {
            console.error(`🔍 VOICE_DEBUG: API Error:`, message.error);
            setError(`API Error: ${message.error?.message || 'Unknown error'}`);
          }
          
        } catch (err) {
          console.log(`🔍 VOICE_DEBUG: Non-JSON message received`);
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

      console.log(`🔍 VOICE_DEBUG: WebRTC connection established`);

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

  const resetDemo = () => {
    cleanup();
    setMessages([]);
    setDemoContext({
      problemStatement: '',
      goalStatement: '',
      experienceStatement: '',
      userResponses: {}
    });
    
    if (stateMachineDemo) {
      stateMachineDemo.resetSession();
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
              Voice-guided Mind Shifting treatment with automatic speech detection
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isListening && (
            <div className="flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 rounded-full text-sm">
              <Mic className="h-3 w-3" />
              <span>Listening</span>
            </div>
          )}
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

      {/* Modality Selector */}
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
        <div className="flex items-center justify-between">
          <div>
            <h5 className="font-medium text-blue-900 dark:text-blue-200">
              Treatment Modality: {TREATMENT_MODALITIES[selectedModality].name}
            </h5>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              {TREATMENT_MODALITIES[selectedModality].description}
            </p>
          </div>
          <button
            onClick={() => setShowModalitySelector(!showModalitySelector)}
            disabled={isConnected}
            className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Settings className="h-3 w-3" />
            <span>Change</span>
          </button>
        </div>
        
        {showModalitySelector && !isConnected && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(Object.keys(TREATMENT_MODALITIES) as TreatmentModality[]).map((modality) => (
              <button
                key={modality}
                onClick={() => {
                  setSelectedModality(modality);
                  setMessages([]);
                  setShowModalitySelector(false);
                  resetDemo();
                }}
                className={`p-2 text-sm rounded-md border transition-colors ${
                  selectedModality === modality
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
              >
                {TREATMENT_MODALITIES[modality].name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Working On Display */}
      {(demoContext.problemStatement || demoContext.goalStatement || demoContext.experienceStatement) && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <h5 className="font-medium text-green-900 dark:text-green-200 mb-1">
            Working On:
          </h5>
          <p className="text-sm text-green-700 dark:text-green-300">
            {selectedModality === 'reality_shifting' && demoContext.goalStatement && `Goal: "${demoContext.goalStatement}"`}
            {selectedModality === 'trauma_shifting' && demoContext.experienceStatement && `Experience: "${demoContext.experienceStatement}"`}
            {(selectedModality === 'problem_shifting' || selectedModality === 'belief_shifting' || selectedModality === 'identity_shifting' || selectedModality === 'blockage_shifting') && demoContext.problemStatement && `Problem: "${demoContext.problemStatement}"`}
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
              Voice session active! Speak naturally and the system will automatically detect when you're done speaking.
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