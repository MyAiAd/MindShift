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

// Add comprehensive interaction state tracking
type InteractionState = 'idle' | 'listening' | 'processing' | 'ai_speaking' | 'waiting_for_user' | 'error';

export default function VoiceTreatmentDemo() {
  const [status, setStatus] = useState<string>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [messages, setMessages] = useState<TreatmentMessage[]>([]);
  const [selectedModality, setSelectedModality] = useState<TreatmentModality>('problem_shifting');
  const [showModalitySelector, setShowModalitySelector] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAIResponding, setIsAIResponding] = useState(false); // Track AI response state
  
  // NEW: Comprehensive interaction state management
  const [interactionState, setInteractionState] = useState<InteractionState>('idle');
  const [stateMessage, setStateMessage] = useState<string>('');
  
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

  // NEW: Interaction state management helpers
  const setInteractionStateWithMessage = (state: InteractionState, message: string) => {
    console.log(`🔍 VOICE_DEBUG: State change: ${interactionState} → ${state} (${message})`);
    setInteractionState(state);
    setStateMessage(message);
    
    // Update legacy states for compatibility
    setIsListening(state === 'listening');
    setIsAIResponding(state === 'ai_speaking' || state === 'processing');
  };

  const getStateDisplayInfo = (state: InteractionState) => {
    switch (state) {
      case 'idle':
        return { 
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
          icon: '⏸️',
          canSpeak: false
        };
      case 'listening':
        return { 
          color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          icon: '🎙️',
          canSpeak: true
        };
      case 'processing':
        return { 
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
          icon: '🧠',
          canSpeak: false
        };
      case 'ai_speaking':
        return { 
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
          icon: '🗣️',
          canSpeak: false
        };
      case 'waiting_for_user':
        return { 
          color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400',
          icon: '👂',
          canSpeak: true
        };
      case 'error':
        return { 
          color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
          icon: '❌',
          canSpeak: false
        };
      default:
        return { 
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
          icon: '❓',
          canSpeak: false
        };
    }
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
    setIsAIResponding(false);
    setStatus('idle');
    setInteractionStateWithMessage('idle', 'Session ended');
  }, []);

  // COMPLETELY REWRITTEN: Simple response creation without custom IDs
  const createScriptedVoiceResponse = async (scriptedResponse: string, userTranscript: string = '') => {
    console.log(`🔍 VOICE_DEBUG: ====== Creating scripted response ======`);
    console.log(`🔍 VOICE_DEBUG: Script: "${scriptedResponse}"`);
    console.log(`🔍 VOICE_DEBUG: AI responding: ${isAIResponding}`);
    
    // Don't create response if AI is currently responding
    if (isAIResponding || interactionState === 'ai_speaking' || interactionState === 'processing') {
      console.log(`🔍 VOICE_DEBUG: ❌ Blocking - AI is currently responding (state: ${interactionState})`);
      return;
    }
    
    setInteractionStateWithMessage('processing', 'Preparing response...');
    
    // Wait for DataChannel to be ready
    let attempts = 0;
    const maxAttempts = 15;
    
    while (sessionRef.current.dataChannel?.readyState !== 'open' && attempts < maxAttempts) {
      console.log(`🔍 VOICE_DEBUG: Waiting for DataChannel, attempt ${attempts + 1}`);
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (sessionRef.current.dataChannel?.readyState !== 'open') {
      console.error('🔍 VOICE_DEBUG: ❌ DataChannel not ready after timeout, aborting');
      return;
    }
    
    try {
      setIsAIResponding(true);
      setInteractionStateWithMessage('ai_speaking', 'AI is speaking...');
      
      console.log(`🔍 VOICE_DEBUG: Creating assistant message`);
      
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
      console.log(`🔍 VOICE_DEBUG: ✅ Assistant message sent`);
      
      // Wait before triggering response
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Create simple response without custom ID
      const responseEvent = {
        type: 'response.create',
        response: {
          modalities: ['audio', 'text']
        }
      };
      
      sessionRef.current.dataChannel.send(JSON.stringify(responseEvent));
      console.log(`🔍 VOICE_DEBUG: ✅ Audio response triggered`);
      
      // Update UI immediately
      addMessage(scriptedResponse, false, true);
      console.log(`🔍 VOICE_DEBUG: ✅ UI updated with scripted response`);
      
    } catch (error) {
      console.error(`🔍 VOICE_DEBUG: ❌ Failed to create scripted response:`, error);
      setIsAIResponding(false);
      setInteractionStateWithMessage('error', 'Failed to create response');
    }
  };

  // ENHANCED: Transcript processing with comprehensive validation and guardrails
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
      
      // Handle validation errors with helpful guidance
      if (!result.canContinue) {
        if (result.reason === 'validation_error' || result.reason === 'ai_assistance_needed') {
          console.log(`🔍 VOICE_DEBUG: Validation error detected: "${result.scriptedResponse}"`);
          await createScriptedVoiceResponse(result.scriptedResponse || "Please rephrase your response.", transcript);
          return result.scriptedResponse || "Please rephrase your response.";
        }
        
        if (result.reason === 'phase_complete') {
          console.log(`🔍 VOICE_DEBUG: Session completed prematurely, checking if we should continue...`);
          
          // If we haven't really done much yet, restart the session
          const currentContext = stateMachineDemo!.getCurrentContext();
          if (currentContext && Object.keys(currentContext.userResponses || {}).length < 3) {
            console.log(`🔍 VOICE_DEBUG: Restarting session to continue treatment properly`);
            
            // Reset and reinitialize
            stateMachineDemo!.resetSession();
            await stateMachineDemo!.initializeSession(selectedModality, transcript, true);
            
            // Try processing again
            const retryResult = await stateMachineDemo!.processUserInput(transcript, undefined, true);
            console.log(`🔍 VOICE_DEBUG: Retry result:`, retryResult);
            
            if (retryResult.scriptedResponse) {
              await createScriptedVoiceResponse(retryResult.scriptedResponse, transcript);
              return retryResult.scriptedResponse;
            }
          }
          
          // If we've done substantial work, allow completion
          const completionResponse = "Thank you for participating in this Mind Shifting demo. The treatment process has been completed.";
          await createScriptedVoiceResponse(completionResponse, transcript);
          return completionResponse;
        }
      }
      
      if (result.scriptedResponse) {
        // Handle internal signals properly
        if (result.scriptedResponse.startsWith('SKIP_TO_TREATMENT_INTRO') || 
            result.scriptedResponse === 'GOAL_SELECTION_CONFIRMED' ||
            result.scriptedResponse === 'PROBLEM_SELECTION_CONFIRMED' ||
            result.scriptedResponse === 'NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED') {
          
          console.log(`🔍 VOICE_DEBUG: Got internal signal: "${result.scriptedResponse}"`);
          
          // Process the internal signal by making another call to get the actual response
          const followUpResult = await stateMachineDemo!.processUserInput('', undefined, true);
          if (followUpResult.scriptedResponse && !followUpResult.scriptedResponse.startsWith('SKIP_') && !followUpResult.scriptedResponse.endsWith('_CONFIRMED')) {
            console.log(`🔍 VOICE_DEBUG: Follow-up response: "${followUpResult.scriptedResponse}"`);
            await createScriptedVoiceResponse(followUpResult.scriptedResponse, transcript);
            return followUpResult.scriptedResponse;
          }
          
          // Fallback response for unhandled internal signals
          const fallbackResponse = "Thank you. Let's continue with the treatment process.";
          await createScriptedVoiceResponse(fallbackResponse, transcript);
          return fallbackResponse;
        } else {
          console.log(`🔍 VOICE_DEBUG: Got user-facing response: "${result.scriptedResponse}"`);
          await createScriptedVoiceResponse(result.scriptedResponse, transcript);
          return result.scriptedResponse;
        }
      }
    } catch (error) {
      console.error(`🔍 VOICE_DEBUG: Error processing transcript:`, error);
      
      // Provide recovery response
      const recoveryResponse = "I apologize, let me help you continue. What would you like to work on today?";
      await createScriptedVoiceResponse(recoveryResponse, transcript);
      return recoveryResponse;
    }
    
    return null;
  };

  const startVoiceSession = async () => {
    try {
      setError('');
      setStatus('starting');
      setInteractionStateWithMessage('processing', 'Starting voice session...');

      // Initialize state machine first
      if (!stateMachineDemo) {
        console.log(`🔍 VOICE_DEBUG: Initializing state machine...`);
        const demo = new TreatmentStateMachineDemo();
        setStateMachineDemo(demo);
        await demo.initializeSession(selectedModality, undefined, true);
        console.log(`🔍 VOICE_DEBUG: State machine initialized`);
      }

      // Get initial response - using exact protocol from main system
      let initialResponse = "Mind Shifting is not like counselling, therapy or life coaching. The Mind Shifting methods are verbal guided processes that we apply to problems, goals, or negative experiences in order to clear them. The way Mind Shifting works is we won't just be talking about what you want to work on, we will be applying Mind Shifting methods in order to clear them, and to do that we will need to define what you want to work on into a clear statement by you telling me what it is in a few words. So I'll be asking you to do that when needed.\n\nWhen you are ready to begin, would you like to work on:\n\n1. PROBLEM\n2. GOAL\n3. NEGATIVE EXPERIENCE";
      
      if (stateMachineDemo) {
        try {
          const result = await stateMachineDemo.processUserInput("", undefined, true);
          if (result.scriptedResponse && 
              result.scriptedResponse !== "Please provide a response." && 
              !result.scriptedResponse.startsWith('SKIP_') && 
              !result.scriptedResponse.endsWith('_CONFIRMED')) {
            initialResponse = result.scriptedResponse;
            console.log(`🔍 VOICE_DEBUG: Using state machine initial response: "${initialResponse}"`);
          } else {
            console.log(`🔍 VOICE_DEBUG: Using default initial response due to: "${result.scriptedResponse}"`);
          }
        } catch (error) {
          console.log(`🔍 VOICE_DEBUG: Using fallback initial response due to error:`, error);
        }
      }

      // 1. Create ephemeral session with manual control from start
      const sessionResponse = await fetch('/api/labs/openai-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'verse',
          instructions: `You are a Mind Shifting treatment assistant. Speak only exact text from assistant messages. Never generate automatic responses.`,
          // Enable transcription
          input_audio_transcription: {
            model: 'whisper-1'
          },
          // CRITICAL: Start with no turn detection to prevent automatic responses
          turn_detection: null,
          temperature: 0.8
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
        setInteractionStateWithMessage('processing', 'Initializing session...');
        
        // Wait for data channel to be ready before sending initial response
        const checkDataChannel = () => {
          if (sessionRef.current.dataChannel?.readyState === 'open') {
            console.log(`🔍 VOICE_DEBUG: 🎬 Sending initial response: "${initialResponse}"`);
            setTimeout(() => {
              createScriptedVoiceResponse(initialResponse, '');
            }, 1200); // Longer delay to ensure everything is ready
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
            temperature: 0.8
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
          
          // Speech detection events (may not fire with turn_detection: null)
          if (message.type === 'input_audio_buffer.speech_started') {
            console.log(`🔍 VOICE_DEBUG: User started speaking`);
            setInteractionStateWithMessage('listening', 'Listening to your voice...');
          } 
          else if (message.type === 'input_audio_buffer.speech_stopped') {
            console.log(`🔍 VOICE_DEBUG: User stopped speaking`);
            setInteractionStateWithMessage('processing', 'Processing your speech...');
            
            // With turn detection disabled, we need to manually commit audio
            try {
              sessionRef.current.dataChannel?.send(JSON.stringify({
                type: 'input_audio_buffer.commit'
              }));
              console.log(`🔍 VOICE_DEBUG: Manually committed audio buffer`);
            } catch (error) {
              console.log(`🔍 VOICE_DEBUG: Failed to commit audio:`, error);
            }
          } 
          else if (message.type === 'input_audio_buffer.committed') {
            console.log(`🔍 VOICE_DEBUG: Audio committed, waiting for transcription`);
          }
          
          // Handle user transcription - simplified without cancellation attempts  
          else if (message.type === 'conversation.item.input_audio_transcription.completed') {
            const transcript = message.transcript?.trim();
            console.log(`🔍 VOICE_DEBUG: Transcription completed:`, transcript);
            
            if (transcript && transcript.length > 1) {
              addMessage(transcript, true, true);
              updateContextFromTranscript(transcript);
              
              // Process with state machine 
              setTimeout(() => {
                if (stateMachineDemo) {
                  processTranscriptWithStateMachine(transcript);
                }
              }, 200); // Shorter delay since no cancellation needed
            }
          }
          
          // Simplified response tracking
          else if (message.type === 'response.created') {
            console.log(`🔍 VOICE_DEBUG: ✅ Response started`);
            setIsAIResponding(true);
            setInteractionStateWithMessage('ai_speaking', 'AI is speaking...');
          }
          
          else if (message.type === 'response.done') {
            console.log(`🔍 VOICE_DEBUG: ✅ Response completed`);
            setIsAIResponding(false);
            setInteractionStateWithMessage('waiting_for_user', 'Your turn to speak');
          }
          
          else if (message.type === 'response.cancelled') {
            console.log(`🔍 VOICE_DEBUG: ✅ Response cancelled`);
            setIsAIResponding(false);
            setInteractionStateWithMessage('waiting_for_user', 'Your turn to speak');
          }
          
          // Session events
          else if (message.type === 'session.created') {
            console.log(`🔍 VOICE_DEBUG: Session created`);
          }
          
          else if (message.type === 'session.updated') {
            console.log(`🔍 VOICE_DEBUG: Session updated successfully`);
          }
          
          // ENHANCED: Better error handling with filtering for manual control
          else if (message.type === 'error') {
            console.error(`🔍 VOICE_DEBUG: API Error:`, message.error);
            
            const errorCode = message.error?.code;
            const errorMessage = message.error?.message || '';
            
            // Filter out expected/recoverable errors from manual control approach
            if (errorCode === 'invalid_value' && errorMessage.includes('modalities')) {
              console.log(`🔍 VOICE_DEBUG: 🛠️ Modalities error (expected with manual control)`);
            } else if (errorCode === 'decimal_below_min_value' && errorMessage.includes('temperature')) {
              console.log(`🔍 VOICE_DEBUG: 🛠️ Temperature error (will be corrected by session update)`);
            } else if (errorCode === 'unknown_parameter') {
              console.log(`🔍 VOICE_DEBUG: 🛠️ Unknown parameter error (expected with manual control)`);
            } else if (errorCode === 'response_cancel_not_active') {
              console.log(`🔍 VOICE_DEBUG: 🛠️ No active response to cancel (expected with turn detection disabled)`);
            } else {
              // Show serious errors that need attention
              setError(`API Error: ${errorMessage}`);
              console.error(`🔍 VOICE_DEBUG: ❌ SERIOUS ERROR:`, message.error);
            }
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
    setInteractionStateWithMessage('idle', 'Demo reset');
    
    if (stateMachineDemo) {
      stateMachineDemo.resetSession();
    }
  };

  const stateInfo = getStateDisplayInfo(interactionState);
  
  return (
    <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      {/* Prominent State Overlay */}
      {isConnected && interactionState !== 'idle' && (
        <div className={`absolute inset-0 rounded-lg transition-all duration-300 ${
          !stateInfo.canSpeak ? 'bg-black/20 backdrop-blur-sm' : 'bg-green-50/30 dark:bg-green-900/10'
        } z-10 flex items-center justify-center`}>
          <div className={`px-8 py-6 rounded-xl shadow-lg border-2 ${
            stateInfo.canSpeak 
              ? 'bg-green-100 border-green-300 dark:bg-green-900/40 dark:border-green-600' 
              : 'bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-600'
          }`}>
            <div className="text-center">
              <div className="text-4xl mb-3">{stateInfo.icon}</div>
              <div className={`text-xl font-semibold mb-2 ${
                stateInfo.canSpeak 
                  ? 'text-green-800 dark:text-green-200' 
                  : 'text-gray-800 dark:text-gray-200'
              }`}>
                {stateMessage}
              </div>
              {stateInfo.canSpeak ? (
                <div className="text-sm text-green-700 dark:text-green-300">
                  🎙️ You can speak now
                </div>
              ) : (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Please wait...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
          {/* Enhanced State Indicator */}
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${stateInfo.color}`}>
            <span>{stateInfo.icon}</span>
            <span>{isConnected ? stateMessage : status}</span>
          </div>
          
          {/* Connection Status */}
          <div className={`px-2 py-1 rounded-full text-xs ${
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

        {/* Manual speech controls for when turn detection is disabled */}
        {isConnected && (
          <button
            onClick={() => {
              if (sessionRef.current.dataChannel?.readyState === 'open') {
                try {
                  setInteractionStateWithMessage('processing', 'Processing your speech...');
                  sessionRef.current.dataChannel.send(JSON.stringify({
                    type: 'input_audio_buffer.commit'
                  }));
                  console.log('🔍 VOICE_DEBUG: Manually committed speech');
                } catch (error) {
                  console.log('🔍 VOICE_DEBUG: Failed to commit speech:', error);
                  setInteractionStateWithMessage('error', 'Failed to process speech');
                }
              }
            }}
            disabled={interactionState === 'processing' || interactionState === 'ai_speaking'}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

      {/* Enhanced Connection Status */}
      {isConnected && (
        <div className={`mb-4 p-3 border rounded-md flex items-center transition-colors ${
          stateInfo.canSpeak 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        }`}>
          <div className="text-2xl mr-3">{stateInfo.icon}</div>
          <div className="flex-1">
            <div className={`text-sm font-medium ${
              stateInfo.canSpeak 
                ? 'text-green-800 dark:text-green-200'
                : 'text-blue-800 dark:text-blue-200'
            }`}>
              {stateMessage}
            </div>
            <div className={`text-xs mt-1 ${
              stateInfo.canSpeak 
                ? 'text-green-700 dark:text-green-300'
                : 'text-blue-700 dark:text-blue-300'
            }`}>
              {stateInfo.canSpeak 
                ? "Speak naturally - the system is listening"
                : "Please wait while the AI processes or responds"
              }
            </div>
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