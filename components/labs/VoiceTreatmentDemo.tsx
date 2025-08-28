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

// NEW: Pre-loading and caching interfaces
interface CachedResponse {
  text: string;
  audioBlob?: Blob;
  audioUrl?: string;
  timestamp: number;
}

interface ResponseCache {
  responses: Map<string, CachedResponse>;
  preloadedSteps: Set<string>;
  isPreloading: boolean;
}

type TreatmentModality = 'problem_shifting' | 'reality_shifting' | 'belief_shifting' | 'identity_shifting' | 'blockage_shifting' | 'trauma_shifting';

// Add comprehensive interaction state tracking
type InteractionState = 'idle' | 'listening' | 'processing' | 'ai_speaking' | 'waiting_for_user' | 'error';

// NEW: Version tracking for deployment verification
const VOICE_DEMO_VERSION = "2.0.0-preload";
const BUILD_TIMESTAMP = new Date().toISOString();

export default function VoiceTreatmentDemo() {
  // NEW: Log version on component mount for verification
  useEffect(() => {
    console.log(`🚀 VOICE_DEMO: Version ${VOICE_DEMO_VERSION} loaded at ${BUILD_TIMESTAMP}`);
    console.log(`🚀 VOICE_DEMO: Pre-loading system active - expect significant performance improvements`);
    console.log(`🚀 VOICE_DEMO: Look for ⏱️ PERF_TIMER logs to see response times`);
    console.log(`🚀 VOICE_DEMO: Look for 🚀 CACHE_HIT logs to see cache usage`);
  }, []);
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
  
  // NEW: Response pre-loading and caching system
  const [responseCache, setResponseCache] = useState<ResponseCache>({
    responses: new Map(),
    preloadedSteps: new Set(),
    isPreloading: false
  });
  const [preloadingProgress, setPreloadingProgress] = useState<string>('');
  
  // NEW: Performance metrics tracking
  const [performanceMetrics, setPerformanceMetrics] = useState({
    lastResponseTime: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    totalResponses: 0,
    cachedResponses: 0,
    sessionStartTime: 0
  });
  const responseTimerRef = useRef<number>(0);
  
  // NEW: Browser speech recognition for automatic speech detection
  const speechRecognitionRef = useRef<any>(null);
  const [isBrowserListening, setIsBrowserListening] = useState(false);
  const processingBrowserTranscript = useRef<boolean>(false);
  
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

  // NEW: Pre-loading and caching system with beautiful overlay
  const preloadCommonResponses = async () => {
    if (responseCache.isPreloading) return;
    
    console.log('🚀 PRELOAD: Starting response pre-loading...');
    setResponseCache(prev => ({ ...prev, isPreloading: true }));
    setPreloadingProgress('🧠 Optimizing your experience...');
    
    try {
      // Get common responses from state machine
      const commonResponses = await getCommonResponses();
      let processed = 0;
      const total = commonResponses.length;
      
      for (const response of commonResponses) {
        try {
          // Show beautiful loading message without detailed countdown
          setPreloadingProgress('🧠 Pre-loading responses for instant delivery...');
          
          // Pre-synthesize audio using OpenAI TTS
          const audioBlob = await synthesizeAudio(response.text);
          const audioUrl = URL.createObjectURL(audioBlob);
          
          const cachedResponse: CachedResponse = {
            text: response.text,
            audioBlob,
            audioUrl,
            timestamp: Date.now()
          };
          
          setResponseCache(prev => ({
            ...prev,
            responses: new Map(prev.responses.set(response.key, cachedResponse)),
            preloadedSteps: new Set(prev.preloadedSteps.add(response.step))
          }));
          
          processed++;
          console.log(`🚀 PRELOAD: Cached response ${processed}/${total} for ${response.key}`);
          
        } catch (error) {
          console.warn(`🚀 PRELOAD: Failed to cache ${response.key}:`, error);
        }
      }
      
      // Show completion message briefly before hiding
      setPreloadingProgress('🚀 Ready for instant responses!');
      setTimeout(() => setPreloadingProgress(''), 2000);
      
    } catch (error) {
      console.error('🚀 PRELOAD: Pre-loading failed:', error);
      setPreloadingProgress('⚠️ Pre-loading encountered issues');
      setTimeout(() => setPreloadingProgress(''), 3000);
    } finally {
      setResponseCache(prev => ({ ...prev, isPreloading: false }));
    }
  };

  const getCommonResponses = async () => {
    // Get initial and common responses for the selected modality
    const responses = [
      {
        key: 'initial_intro',
        step: 'mind_shifting_explanation',
        text: "Mind Shifting is not like counselling, therapy or life coaching. The Mind Shifting methods are verbal guided processes that we apply to problems, goals, or negative experiences in order to clear them. The way Mind Shifting works is we won't just be talking about what you want to work on, we will be applying Mind Shifting methods in order to clear them, and to do that we will need to define what you want to work on into a clear statement by you telling me what it is in a few words. So I'll be asking you to do that when needed.\n\nWhen you are ready to begin, would you like to work on:\n\n1. PROBLEM\n2. GOAL\n3. NEGATIVE EXPERIENCE"
      },
      {
        key: 'problem_selection',
        step: 'problem_selection_confirmed',
        text: "Great! You've chosen to work on a problem. Please tell me about the problem you'd like to work on. Describe it in just a few words - be specific and concise."
      },
      {
        key: 'goal_selection',
        step: 'goal_selection_confirmed', 
        text: "Excellent! You've chosen to work on a goal. Please tell me about the goal you'd like to achieve. Describe it in just a few words - be specific about what you want to accomplish."
      },
      {
        key: 'experience_selection',
        step: 'negative_experience_selection_confirmed',
        text: "I understand. You've chosen to work on a negative experience. Please tell me about the negative experience you'd like to process. Describe it briefly but specifically."
      },
      {
        key: 'validation_error',
        step: 'validation_error',
        text: "I need you to be more specific. Please rephrase your response with more detail so I can help you effectively."
      },
      {
        key: 'clarification_needed',
        step: 'clarification_needed',
        text: "Could you clarify what you mean? I want to make sure I understand exactly what you'd like to work on."
      }
    ];
    
    // Add modality-specific responses
    if (stateMachineDemo) {
      try {
        // Get a few predicted next responses from the state machine
        const predictedResponses = await getPredictedResponses();
        responses.push(...predictedResponses);
      } catch (error) {
        console.warn('🚀 PRELOAD: Could not get predicted responses:', error);
      }
    }
    
    return responses;
  };

  const getPredictedResponses = async () => {
    // Get likely next responses based on current state
    const predictions = [];
    
    try {
      // Simulate common user inputs to get likely responses
      const commonInputs = ['anxiety', 'stress', 'confidence', 'relationship', 'work', 'health'];
      
      for (const input of commonInputs) {
        try {
          const result = await stateMachineDemo!.processUserInput(input, undefined, true);
          if (result.scriptedResponse && !result.scriptedResponse.startsWith('SKIP_')) {
            predictions.push({
              key: `predicted_${input}`,
              step: `predicted_response_${input}`,
              text: result.scriptedResponse
            });
          }
        } catch (error) {
          // Ignore prediction errors
        }
      }
    } catch (error) {
      console.warn('🚀 PRELOAD: Prediction generation failed:', error);
    }
    
    return predictions;
  };

  const synthesizeAudio = async (text: string): Promise<Blob> => {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: 'alloy', // Use alloy for consistency with realtime API
        model: 'tts-1'
      })
    });
    
    if (!response.ok) {
      throw new Error('TTS synthesis failed');
    }
    
    return await response.blob();
  };

  const getCachedResponse = (responseKey: string): CachedResponse | null => {
    return responseCache.responses.get(responseKey) || null;
  };

  // NEW: Enhanced automatic speech detection with better error handling
  const startAutomaticListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.log('🔍 VOICE_DEBUG: Browser speech recognition not supported, using manual mode');
      return;
    }

    // Only skip if there's already an active recognition instance
    if (speechRecognitionRef.current) {
      console.log('🔍 VOICE_DEBUG: Skipping speech recognition - already has active instance');
      return;
    }
    
    // Log the current state for debugging but don't block based on it
    console.log('🔍 VOICE_DEBUG: Starting speech recognition, current state:', interactionState);

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      // Enhanced configuration for better reliability
      recognition.continuous = true; // Keep listening continuously
      recognition.interimResults = true; // Get interim results for better responsiveness
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      
      let speechTimeout: NodeJS.Timeout;
      let hasSpeech = false;
      
      recognition.onstart = () => {
        console.log('🔍 VOICE_DEBUG: 🎙️ Enhanced browser speech recognition started');
        setIsBrowserListening(true);
        setInteractionStateWithMessage('listening', 'Listening to your voice...');
        hasSpeech = false;
        processingBrowserTranscript.current = false; // Reset for new interaction
      };
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Clear any existing timeout
        if (speechTimeout) {
          clearTimeout(speechTimeout);
        }
        
        if (finalTranscript.trim()) {
          console.log('🔍 VOICE_DEBUG: 🎯 Final speech recognized:', finalTranscript.trim());
          hasSpeech = true;
          
          // Stop recognition and process the speech directly with browser transcription
          recognition.stop();
          setInteractionStateWithMessage('processing', 'Processing your speech...');
          
          // Process the browser transcription directly instead of waiting for OpenAI
          console.log('🔍 VOICE_DEBUG: Using browser transcription directly:', finalTranscript.trim());
          processingBrowserTranscript.current = true;
          
          // Add the message to UI
          addMessage(finalTranscript.trim(), true, true);
          updateContextFromTranscript(finalTranscript.trim());
          
          // Process with state machine using browser transcription
          if (stateMachineDemo) {
            processTranscriptWithStateMachine(finalTranscript.trim());
          }
        } else if (interimTranscript.trim()) {
          console.log('🔍 VOICE_DEBUG: 🎙️ Interim speech:', interimTranscript.trim());
          hasSpeech = true;
          
          // Set a timeout to process speech if no more final results come
          speechTimeout = setTimeout(() => {
            if (hasSpeech && interimTranscript.trim()) {
              console.log('🔍 VOICE_DEBUG: 🎯 Processing interim speech due to timeout:', interimTranscript.trim());
              recognition.stop();
              
              // Process the interim transcription directly
              setInteractionStateWithMessage('processing', 'Processing your speech...');
              console.log('🔍 VOICE_DEBUG: Using interim transcription directly:', interimTranscript.trim());
              processingBrowserTranscript.current = true;
              
              // Add the message to UI
              addMessage(interimTranscript.trim(), true, true);
              updateContextFromTranscript(interimTranscript.trim());
              
              // Process with state machine using browser transcription
              if (stateMachineDemo) {
                processTranscriptWithStateMachine(interimTranscript.trim());
              }
            }
          }, 2000);
        }
      };
      
      recognition.onerror = (event: any) => {
        console.log('🔍 VOICE_DEBUG: Speech recognition error:', event.error);
        setIsBrowserListening(false);
        
        // Handle specific errors
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          console.log('🔍 VOICE_DEBUG: ❌ Microphone permission denied - falling back to manual mode');
          setInteractionStateWithMessage('waiting_for_user', 'Click "I\'m Done Speaking" when ready');
          return;
        }
        
        // Restart listening after a brief pause for other errors
        setTimeout(() => {
          if (isConnected && interactionState === 'waiting_for_user') {
            startAutomaticListening();
          }
        }, 1500);
      };
      
      recognition.onend = () => {
        console.log('🔍 VOICE_DEBUG: Browser speech recognition ended, hasSpeech:', hasSpeech);
        setIsBrowserListening(false);
        speechRecognitionRef.current = null;
        
        // Only restart if we haven't processed speech and we're still waiting
        if (!hasSpeech && isConnected && interactionState === 'waiting_for_user') {
          console.log('🔍 VOICE_DEBUG: Restarting speech recognition - no speech detected');
          setTimeout(() => {
            startAutomaticListening();
          }, 1000);
        }
      };
      
      speechRecognitionRef.current = recognition;
      recognition.start();
      
    } catch (error) {
      console.error('🔍 VOICE_DEBUG: Failed to start speech recognition:', error);
      setInteractionStateWithMessage('waiting_for_user', 'Click "I\'m Done Speaking" when ready');
    }
  };

  const stopAutomaticListening = () => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
      setIsBrowserListening(false);
      console.log('🔍 VOICE_DEBUG: Stopped automatic speech recognition');
    }
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
    
    // NEW: Stop automatic listening
    stopAutomaticListening();
    
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

  // ENHANCED: Response creation with pre-loading and caching + performance tracking
  const createScriptedVoiceResponse = async (scriptedResponse: string, userTranscript: string = '', responseKey?: string) => {
    // NEW: Start performance timer
    const startTime = performance.now();
    responseTimerRef.current = startTime;
    
    console.log(`🔍 VOICE_DEBUG: ====== Creating scripted response ======`);
    console.log(`🔍 VOICE_DEBUG: Script: "${scriptedResponse}"`);
    console.log(`🔍 VOICE_DEBUG: Response key: ${responseKey}`);
    console.log(`🔍 VOICE_DEBUG: AI responding: ${isAIResponding}`);
    console.log(`⏱️ PERF_TIMER: Response creation started at ${startTime.toFixed(2)}ms`);
    
    // Don't create response if AI is currently responding
    if (isAIResponding || interactionState === 'ai_speaking' || interactionState === 'processing') {
      console.log(`🔍 VOICE_DEBUG: ❌ Blocking - AI is currently responding (state: ${interactionState})`);
      return;
    }
    
    // NEW: Check for cached response first
    let cachedResponse: CachedResponse | null = null;
    let isCacheHit = false;
    if (responseKey) {
      cachedResponse = getCachedResponse(responseKey);
      if (cachedResponse) {
        isCacheHit = true;
        const cacheCheckTime = performance.now();
        console.log(`🚀 CACHE_HIT: Using pre-loaded response for ${responseKey}`);
        console.log(`⏱️ PERF_TIMER: Cache lookup completed in ${(cacheCheckTime - startTime).toFixed(2)}ms`);
        setInteractionStateWithMessage('processing', 'Using cached response...');
      }
    }
    
    if (!cachedResponse) {
      console.log(`⏱️ PERF_TIMER: No cache hit, proceeding with real-time synthesis`);
      setInteractionStateWithMessage('processing', 'Preparing response...');
    }
    
    // OPTIMIZED: Reduced DataChannel waiting with faster polling
    let attempts = 0;
    const maxAttempts = 10; // Reduced from 15
    
    while (sessionRef.current.dataChannel?.readyState !== 'open' && attempts < maxAttempts) {
      console.log(`🔍 VOICE_DEBUG: Waiting for DataChannel, attempt ${attempts + 1}`);
      await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 100ms to 50ms
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
      
      // NEW: Use cached audio if available, otherwise use real-time synthesis
      if (cachedResponse && cachedResponse.audioUrl) {
        const audioStartTime = performance.now();
        console.log(`🚀 CACHE_AUDIO: Playing pre-synthesized audio`);
        console.log(`⏱️ PERF_TIMER: Audio playback started at ${(audioStartTime - startTime).toFixed(2)}ms from request start`);
        
        // Play cached audio directly
        const audioEl = sessionRef.current.audioEl;
        if (audioEl) {
          const cachedAudioEl = new Audio(cachedResponse.audioUrl);
          cachedAudioEl.play().catch(error => {
            console.warn('🚀 CACHE_AUDIO: Cached audio playback failed, falling back to real-time:', error);
            // Fall back to real-time synthesis
            createRealTimeResponse(scriptedResponse, startTime, false);
          });
          
          // Update UI immediately with cached response
          addMessage(scriptedResponse, false, true);
          
          const endTime = performance.now();
          const totalTime = endTime - startTime;
          console.log(`🚀 CACHE_SUCCESS: Instant response delivered from cache`);
          console.log(`⏱️ PERF_TIMER: 🎯 CACHED RESPONSE TOTAL TIME: ${totalTime.toFixed(2)}ms`);
          
          // Update performance metrics
          updatePerformanceMetrics(totalTime, true);
          
          // Reset state when audio ends and start listening
          cachedAudioEl.addEventListener('ended', () => {
            console.log('🔍 VOICE_DEBUG: Cached audio ended, preparing for user input');
            setIsAIResponding(false);
            
            // Ensure clean state before starting listening
            if (speechRecognitionRef.current) {
              console.log('🔍 VOICE_DEBUG: Cleaning up existing speech recognition before restart');
              speechRecognitionRef.current.stop();
              speechRecognitionRef.current = null;
              setIsBrowserListening(false);
            }
            
            setInteractionStateWithMessage('waiting_for_user', 'Your turn to speak');
            
            // NEW: Start automatic listening after cached response with longer delay
            setTimeout(() => {
              console.log('🔍 VOICE_DEBUG: Force starting speech recognition after cached audio');
              // Force start regardless of state since we know we want to listen now
              if (speechRecognitionRef.current) {
                speechRecognitionRef.current.stop();
                speechRecognitionRef.current = null;
                setIsBrowserListening(false);
              }
              startAutomaticListening();
            }, 1000); // Increased delay to ensure state is clean
          });
          
          return; // Exit early - cached response handled
        }
      }
      
      // Fall back to real-time response creation
      await createRealTimeResponse(scriptedResponse, startTime, isCacheHit);
      
    } catch (error) {
      console.error(`🔍 VOICE_DEBUG: ❌ Failed to create scripted response:`, error);
      setIsAIResponding(false);
      setInteractionStateWithMessage('error', 'Failed to create response');
    }
  };

  // NEW: Performance metrics update function
  const updatePerformanceMetrics = (responseTime: number, wasCached: boolean) => {
    setPerformanceMetrics(prev => {
      const newTotal = prev.totalResponses + 1;
      const newCached = wasCached ? prev.cachedResponses + 1 : prev.cachedResponses;
      const newAverage = ((prev.averageResponseTime * prev.totalResponses) + responseTime) / newTotal;
      
      return {
        ...prev,
        lastResponseTime: responseTime,
        averageResponseTime: newAverage,
        cacheHitRate: (newCached / newTotal) * 100,
        totalResponses: newTotal,
        cachedResponses: newCached
      };
    });
  };

  // NEW: Real-time response creation (original logic) with performance tracking
  const createRealTimeResponse = async (scriptedResponse: string, startTime?: number, wasCacheAttempt?: boolean) => {
    const realStartTime = startTime || performance.now();
    console.log(`⏱️ PERF_TIMER: Real-time synthesis starting...`);
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
    
    sessionRef.current.dataChannel!.send(JSON.stringify(assistantMessageEvent));
    console.log(`🔍 VOICE_DEBUG: ✅ Assistant message sent`);
    
    // OPTIMIZED: Reduced delay before triggering response
    await new Promise(resolve => setTimeout(resolve, 100)); // Reduced from 300ms to 100ms
    
    // Create simple response without custom ID
    const responseEvent = {
      type: 'response.create',
      response: {
        modalities: ['audio', 'text']
      }
    };
    
    sessionRef.current.dataChannel!.send(JSON.stringify(responseEvent));
    console.log(`🔍 VOICE_DEBUG: ✅ Audio response triggered`);
    
    // Update UI immediately
    addMessage(scriptedResponse, false, true);
    console.log(`🔍 VOICE_DEBUG: ✅ UI updated with scripted response`);
    
    // NEW: Track real-time response performance
    const endTime = performance.now();
    const totalTime = endTime - realStartTime;
    console.log(`⏱️ PERF_TIMER: 🔄 REAL-TIME RESPONSE TOTAL TIME: ${totalTime.toFixed(2)}ms`);
    updatePerformanceMetrics(totalTime, false);
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
          await createScriptedVoiceResponse(result.scriptedResponse || "Please rephrase your response.", transcript, 'validation_error');
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
              await createScriptedVoiceResponse(retryResult.scriptedResponse, transcript, `retry_${selectedModality}`);
              return retryResult.scriptedResponse;
            }
          }
          
          // If we've done substantial work, allow completion
          const completionResponse = "Thank you for participating in this Mind Shifting demo. The treatment process has been completed.";
          await createScriptedVoiceResponse(completionResponse, transcript, 'completion_response');
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
            
            // Determine cache key based on signal type
            let cacheKey = 'followup_response';
            if (result.scriptedResponse === 'PROBLEM_SELECTION_CONFIRMED') cacheKey = 'problem_selection';
            else if (result.scriptedResponse === 'GOAL_SELECTION_CONFIRMED') cacheKey = 'goal_selection';
            else if (result.scriptedResponse === 'NEGATIVE_EXPERIENCE_SELECTION_CONFIRMED') cacheKey = 'experience_selection';
            
            await createScriptedVoiceResponse(followUpResult.scriptedResponse, transcript, cacheKey);
            return followUpResult.scriptedResponse;
          }
          
          // Fallback response for unhandled internal signals
          const fallbackResponse = "Thank you. Let's continue with the treatment process.";
          await createScriptedVoiceResponse(fallbackResponse, transcript, 'fallback_response');
          return fallbackResponse;
        } else {
          console.log(`🔍 VOICE_DEBUG: Got user-facing response: "${result.scriptedResponse}"`);
          await createScriptedVoiceResponse(result.scriptedResponse, transcript, `response_${selectedModality}`);
          return result.scriptedResponse;
        }
      }
    } catch (error) {
      console.error(`🔍 VOICE_DEBUG: Error processing transcript:`, error);
      
      // Provide recovery response
      const recoveryResponse = "I apologize, let me help you continue. What would you like to work on today?";
      await createScriptedVoiceResponse(recoveryResponse, transcript, 'recovery_response');
      return recoveryResponse;
    }
    
    return null;
  };

  const startVoiceSession = async () => {
    try {
      setError('');
      setStatus('starting');
      setInteractionStateWithMessage('processing', 'Starting voice session...');
      
      // NEW: Reset and start performance tracking
      setPerformanceMetrics({
        lastResponseTime: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        totalResponses: 0,
        cachedResponses: 0,
        sessionStartTime: performance.now()
      });
      console.log(`⏱️ PERF_TIMER: 🎬 SESSION STARTED - Performance tracking initialized`);

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
          voice: 'alloy', // Consistent voice across all demos (nova not supported in realtime)
          instructions: `You are a Mind Shifting treatment assistant. Speak only exact text from assistant messages. Never generate automatic responses.`,
          // Enable transcription
          input_audio_transcription: {
            model: 'whisper-1'
          },
          // CRITICAL: Disable turn detection to prevent dual voice responses
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

      // OPTIMIZED: Set up WebRTC with low-latency configuration
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
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
        
        // OPTIMIZED: Faster initial response delivery with caching
        const checkDataChannel = () => {
          if (sessionRef.current.dataChannel?.readyState === 'open') {
            console.log(`🔍 VOICE_DEBUG: 🎬 Sending initial response: "${initialResponse}"`);
            setTimeout(() => {
              createScriptedVoiceResponse(initialResponse, '', 'initial_intro');
            }, 500); // Reduced from 1200ms to 500ms
          } else {
            setTimeout(checkDataChannel, 50); // Faster polling
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

      // OPTIMIZED: Get microphone with low-latency constraints
      console.log(`🔍 VOICE_DEBUG: Requesting microphone access...`);
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000,
          channelCount: 1 // Mono for faster processing
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
            voice: 'alloy', // Consistent voice across all demos (nova not supported in realtime)
            input_audio_transcription: {
              model: 'whisper-1'
            },
            // CRITICAL: Disable automatic turn detection to prevent dual voices
            turn_detection: null, // Disable OpenAI's automatic response generation
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
          
          // Speech detection events (won't fire with turn_detection: null)
          // We rely on manual "Done Speaking" button instead
          
          // Handle user transcription - skip if browser already processed it
          if (message.type === 'conversation.item.input_audio_transcription.completed') {
            const transcript = message.transcript?.trim();
            console.log(`🔍 VOICE_DEBUG: OpenAI transcription completed:`, transcript);
            
            // Skip if we already processed browser transcription
            if (processingBrowserTranscript.current) {
              console.log(`🔍 VOICE_DEBUG: Skipping OpenAI transcription - already processed browser transcription`);
              processingBrowserTranscript.current = false; // Reset for next interaction
              return;
            }
            
            if (transcript && transcript.length > 1) {
              console.log(`🔍 VOICE_DEBUG: Using OpenAI transcription (no browser transcription available):`, transcript);
              addMessage(transcript, true, true);
              updateContextFromTranscript(transcript);
              
              // OPTIMIZED: Process with state machine immediately
              if (stateMachineDemo) {
                processTranscriptWithStateMachine(transcript);
              }
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
            
            // Ensure clean state before starting listening
            if (speechRecognitionRef.current) {
              console.log('🔍 VOICE_DEBUG: Cleaning up existing speech recognition before restart');
              speechRecognitionRef.current.stop();
              speechRecognitionRef.current = null;
              setIsBrowserListening(false);
            }
            
            setInteractionStateWithMessage('waiting_for_user', 'Your turn to speak');
            
            // NEW: Start automatic listening after AI response completes
            setTimeout(() => {
              console.log('🔍 VOICE_DEBUG: Force starting speech recognition after AI response');
              // Force start regardless of state since we know we want to listen now
              if (speechRecognitionRef.current) {
                speechRecognitionRef.current.stop();
                speechRecognitionRef.current = null;
                setIsBrowserListening(false);
              }
              startAutomaticListening();
            }, 1000); // Increased delay for better reliability
          }
          
          else if (message.type === 'response.cancelled') {
            console.log(`🔍 VOICE_DEBUG: ✅ Response cancelled`);
            setIsAIResponding(false);
            
            // Ensure clean state before starting listening
            if (speechRecognitionRef.current) {
              console.log('🔍 VOICE_DEBUG: Cleaning up existing speech recognition before restart');
              speechRecognitionRef.current.stop();
              speechRecognitionRef.current = null;
              setIsBrowserListening(false);
            }
            
            setInteractionStateWithMessage('waiting_for_user', 'Your turn to speak');
            
            // NEW: Start automatic listening after response cancellation
            setTimeout(() => {
              console.log('🔍 VOICE_DEBUG: Force starting speech recognition after response cancellation');
              // Force start regardless of state since we know we want to listen now
              if (speechRecognitionRef.current) {
                speechRecognitionRef.current.stop();
                speechRecognitionRef.current = null;
                setIsBrowserListening(false);
              }
              startAutomaticListening();
            }, 1000);
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
            } else if (errorCode === 'input_audio_buffer_commit_empty') {
              console.log(`🔍 VOICE_DEBUG: 🛠️ Empty audio buffer commit (expected with manual control)`);
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

  // Initialize state machine and trigger pre-loading
  const initializeStateMachine = async () => {
    if (!stateMachineDemo) {
      const demo = new TreatmentStateMachineDemo();
      setStateMachineDemo(demo);
      
      try {
        await demo.initializeSession(selectedModality, undefined, true);
        
        // NEW: Trigger pre-loading after state machine is ready
        setTimeout(() => {
          preloadCommonResponses();
        }, 500); // Reduced delay for faster user experience
        
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
    
    // NEW: Clean up cached audio URLs to prevent memory leaks
    responseCache.responses.forEach(cached => {
      if (cached.audioUrl) {
        URL.revokeObjectURL(cached.audioUrl);
      }
    });
    setResponseCache({
      responses: new Map(),
      preloadedSteps: new Set(),
      isPreloading: false
    });
    setPreloadingProgress('');
    
    // NEW: Reset performance metrics
    setPerformanceMetrics({
      lastResponseTime: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      totalResponses: 0,
      cachedResponses: 0,
      sessionStartTime: 0
    });
    console.log(`⏱️ PERF_TIMER: 🔄 METRICS RESET - Demo reset completed`);
    
    if (stateMachineDemo) {
      stateMachineDemo.resetSession();
    }
  };

  const stateInfo = getStateDisplayInfo(interactionState);
  
  return (
    <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      {/* Beautiful Pre-loading Overlay */}
      {responseCache.isPreloading && (
        <div className="absolute inset-0 rounded-lg transition-all duration-300 bg-indigo-50/90 dark:bg-indigo-900/90 backdrop-blur-sm z-20 flex items-center justify-center">
          <div className="px-8 py-6 rounded-xl shadow-lg border-2 bg-white border-indigo-300 dark:bg-gray-800 dark:border-indigo-600">
            <div className="text-center">
              <div className="text-4xl mb-3">🧠</div>
              <div className="text-xl font-semibold mb-2 text-indigo-800 dark:text-indigo-200">
                {preloadingProgress || 'Optimizing your experience...'}
              </div>
              <div className="text-sm text-indigo-600 dark:text-indigo-400 mb-3">
                Pre-loading responses for instant delivery
              </div>
              <div className="flex items-center justify-center space-x-1">
                <div className="animate-pulse w-2 h-2 bg-indigo-500 rounded-full"></div>
                <div className="animate-pulse w-2 h-2 bg-indigo-500 rounded-full" style={{animationDelay: '0.2s'}}></div>
                <div className="animate-pulse w-2 h-2 bg-indigo-500 rounded-full" style={{animationDelay: '0.4s'}}></div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  {isBrowserListening ? '🎙️ Listening automatically...' : '🎙️ You can speak now'}
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
            <div className="flex items-center space-x-2">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Voice Treatment Demo</h4>
              <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full font-medium">
                v{VOICE_DEMO_VERSION}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Voice-guided Mind Shifting treatment with pre-loading optimization
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





      {/* NEW: Performance Metrics Display */}
      {performanceMetrics.totalResponses > 0 && (
        <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-medium text-indigo-900 dark:text-indigo-200 flex items-center">
              ⏱️ Performance Metrics
              <span className="ml-2 px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-800 rounded-full">
                v2.0 Pre-loading Active
              </span>
            </h5>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="text-center">
              <div className="font-semibold text-indigo-800 dark:text-indigo-200">
                {performanceMetrics.lastResponseTime.toFixed(0)}ms
              </div>
              <div className="text-indigo-600 dark:text-indigo-400">Last Response</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-indigo-800 dark:text-indigo-200">
                {performanceMetrics.averageResponseTime.toFixed(0)}ms
              </div>
              <div className="text-indigo-600 dark:text-indigo-400">Average</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-indigo-800 dark:text-indigo-200">
                {performanceMetrics.cacheHitRate.toFixed(1)}%
              </div>
              <div className="text-indigo-600 dark:text-indigo-400">Cache Hit Rate</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-indigo-800 dark:text-indigo-200">
                {performanceMetrics.cachedResponses}/{performanceMetrics.totalResponses}
              </div>
              <div className="text-indigo-600 dark:text-indigo-400">Cached/Total</div>
            </div>
          </div>
          {performanceMetrics.cacheHitRate > 0 && (
            <div className="mt-2 text-xs text-indigo-700 dark:text-indigo-300">
              💡 Cached responses are ~10-50x faster than real-time synthesis
            </div>
          )}
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

        {/* Manual speech controls - fallback for browsers without speech recognition or permission issues */}
        {isConnected && (
          (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) ||
          (interactionState === 'waiting_for_user' && stateMessage.includes('Click'))
        ) && (
          <button
            onClick={() => {
              if (sessionRef.current.dataChannel?.readyState === 'open') {
                try {
                  setInteractionStateWithMessage('processing', 'Processing your speech...');
                  sessionRef.current.dataChannel.send(JSON.stringify({
                    type: 'input_audio_buffer.commit'
                  }));
                  console.log('🔍 VOICE_DEBUG: Manually committed speech for processing');
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
            <span>I'm Done Speaking</span>
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

        {/* NEW: Manual Pre-load Button */}
        {!isConnected && !responseCache.isPreloading && (
          <button
            onClick={preloadCommonResponses}
            disabled={responseCache.responses.size > 0}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Shield className="h-4 w-4" />
            <span>
              {responseCache.responses.size > 0 ? 'Pre-loaded' : 'Pre-load Responses'}
            </span>
          </button>
        )}
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