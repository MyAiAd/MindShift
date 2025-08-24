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

interface TreatmentStep {
  id: string;
  phase: string;
  instruction: string;
  expectedResponse: string;
  scriptedResponse?: (userInput?: string, context?: any) => string;
}

interface DemoContext {
  problemStatement: string;
  goalStatement: string;
  experienceStatement: string;
  userResponses: Record<string, string>;
}

type TreatmentModality = 'problem_shifting' | 'reality_shifting' | 'belief_shifting' | 'identity_shifting' | 'blockage_shifting' | 'trauma_shifting';

// Real treatment scripts from the actual system - completely isolated for demo
const TREATMENT_MODALITIES: Record<TreatmentModality, { name: string; steps: TreatmentStep[] }> = {
  problem_shifting: {
    name: 'Problem Shifting',
    steps: [
      {
        id: 'problem_input',
        phase: 'Problem Input',
        instruction: 'What problem would you like to work on today? Please state it in a few words.',
        expectedResponse: 'problem statement',
        scriptedResponse: () => 'What problem would you like to work on today? Please state it in a few words.'
      },
      {
        id: 'problem_shifting_intro',
        phase: 'Introduction',
        instruction: 'Please close your eyes and keep them closed throughout the process.',
        expectedResponse: 'acknowledgment',
        scriptedResponse: (userInput, context) => {
          const problemStatement = context?.problemStatement || 'the problem';
          return `Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image. When I ask 'what needs to happen for the problem to not be a problem?' allow your answers to be different each time.

Feel the problem '${problemStatement}'... what does it feel like?`;
        }
      },
      {
        id: 'body_sensation_check',
        phase: 'Body Awareness',
        instruction: 'Feel that feeling... what happens in yourself when you feel that feeling?',
        expectedResponse: 'body sensation',
        scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`
      },
      {
        id: 'what_needs_to_happen_step',
        phase: 'Solution Finding',
        instruction: 'Feel the problem... what needs to happen for this to not be a problem?',
        expectedResponse: 'solution statement',
        scriptedResponse: (userInput, context) => {
          const problemStatement = context?.problemStatement || 'the problem';
          return `Feel the problem '${problemStatement}'... what needs to happen for this to not be a problem?`;
        }
      },
      {
        id: 'feel_solution_state',
        phase: 'Solution State',
        instruction: 'What would you feel like if that happened?',
        expectedResponse: 'feeling',
        scriptedResponse: (userInput) => `What would you feel like if '${userInput || 'that'}'?`
      },
      {
        id: 'feel_good_state',
        phase: 'Embodiment',
        instruction: 'Feel that feeling... what does that feeling feel like?',
        expectedResponse: 'feeling description',
        scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`
      },
      {
        id: 'what_happens_step',
        phase: 'Integration',
        instruction: 'Feel that feeling... what happens in yourself when you feel that feeling?',
        expectedResponse: 'experience',
        scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what happens in yourself when you feel '${userInput || 'that feeling'}'?`
      },
      {
        id: 'check_if_still_problem',
        phase: 'Verification',
        instruction: 'Feel the problem... does it still feel like a problem?',
        expectedResponse: 'yes/no',
        scriptedResponse: (userInput, context) => {
          const problemStatement = context?.problemStatement || 'the problem';
          return `Feel the problem '${problemStatement}'... does it still feel like a problem?`;
        }
      },
      {
        id: 'digging_deeper_start',
        phase: 'Digging Deeper',
        instruction: 'Would you like to dig deeper in this area?',
        expectedResponse: 'yes/no',
        scriptedResponse: () => 'Would you like to dig deeper in this area?'
      },
      {
        id: 'future_problem_check',
        phase: 'Future Assessment',
        instruction: 'Do you feel the problem will come back in the future?',
        expectedResponse: 'yes/no',
        scriptedResponse: () => 'Do you feel the problem will come back in the future?'
      },
      {
        id: 'restate_problem_future',
        phase: 'Problem Restatement',
        instruction: 'How would you state the problem in a few words?',
        expectedResponse: 'problem',
        scriptedResponse: () => 'How would you state the problem in a few words?'
      },
      {
        id: 'scenario_check_1',
        phase: 'Scenario Check',
        instruction: 'Is there any scenario in which this would still be a problem for you?',
        expectedResponse: 'yes/no',
        scriptedResponse: () => 'Is there any scenario in which this would still be a problem for you?'
      },
      {
        id: 'problem_integration_awareness_1',
        phase: 'Integration - Awareness',
        instruction: 'How do you feel about your problem now?',
        expectedResponse: 'feeling',
        scriptedResponse: (userInput, context) => {
          const problemStatement = context?.problemStatement || 'the problem';
          return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${problemStatement}' now?`;
        }
      },
      {
        id: 'problem_integration_awareness_2',
        phase: 'Integration - Awareness',
        instruction: 'What are you more aware of now than before we did this process?',
        expectedResponse: 'awareness',
        scriptedResponse: () => 'What are you more aware of now than before we did this process?'
      },
      {
        id: 'problem_integration_awareness_3',
        phase: 'Integration - Benefits',
        instruction: 'How has it helped you to do this process?',
        expectedResponse: 'benefits',
        scriptedResponse: () => 'How has it helped you to do this process?'
      },
      {
        id: 'problem_integration_awareness_4',
        phase: 'Integration - Narrative',
        instruction: 'What is your new narrative about this?',
        expectedResponse: 'narrative',
        scriptedResponse: () => 'What is your new narrative about this?'
      },
      {
        id: 'problem_integration_awareness_5',
        phase: 'Integration - Intention',
        instruction: 'What\'s your intention now in relation to this?',
        expectedResponse: 'intention',
        scriptedResponse: () => 'What\'s your intention now in relation to this?'
      },
      {
        id: 'problem_integration_action_1',
        phase: 'Integration - Action',
        instruction: 'What needs to happen for you to realise your intention?',
        expectedResponse: 'action plan',
        scriptedResponse: () => 'Integration Questions - ACTION Section:\n\nWhat needs to happen for you to realise your intention?... What else needs to happen for you to realise your intention? (Until they are clear on their plan of action)'
      },
      {
        id: 'problem_integration_action_2',
        phase: 'Integration - Priority',
        instruction: 'What is the one thing you can do that will make everything else easier or unnecessary?',
        expectedResponse: 'priority action',
        scriptedResponse: () => 'What is the one thing you can do that will make everything else easier or unnecessary?'
      },
      {
        id: 'problem_integration_action_3',
        phase: 'Integration - Commitment',
        instruction: 'What is the first action that you can commit to now that will help you to realise your intention? When will you do this?',
        expectedResponse: 'commitment',
        scriptedResponse: () => 'What is the first action that you can commit to now that will help you to realise your intention?... when will you do this?'
      },
      {
        id: 'treatment_complete',
        phase: 'Completion',
        instruction: 'Excellent work! You have completed the Problem Shifting treatment. Take a moment to notice how you feel about your original problem now.',
        expectedResponse: 'acknowledgment',
        scriptedResponse: (userInput, context) => {
          const problemStatement = context?.problemStatement || 'your problem';
          return `Excellent work! You have completed the Problem Shifting treatment. Take a moment to notice how you feel about '${problemStatement}' now. The treatment is complete.`;
        }
      }
    ]
  },
  reality_shifting: {
    name: 'Reality Shifting',
    steps: [
      {
        id: 'reality_goal_capture',
        phase: 'Goal Setting',
        instruction: 'What do you want?',
        expectedResponse: 'goal statement',
        scriptedResponse: () => 'What do you want?'
      },
      {
        id: 'goal_deadline_check',
        phase: 'Timeline',
        instruction: 'Is there a deadline?',
        expectedResponse: 'yes/no',
        scriptedResponse: () => 'Is there a deadline?'
      },
      {
        id: 'goal_deadline_date',
        phase: 'Deadline Details',
        instruction: 'When do you want to achieve this goal by?',
        expectedResponse: 'date/time',
        scriptedResponse: () => 'When do you want to achieve this goal by?'
      },
      {
        id: 'goal_certainty',
        phase: 'Certainty Assessment',
        instruction: 'How certain are you between 0% and 100% that you will achieve this goal?',
        expectedResponse: 'percentage',
        scriptedResponse: () => 'How certain are you between 0% and 100% that you will achieve this goal?'
      },
      {
        id: 'reality_shifting_intro',
        phase: 'Introduction',
        instruction: 'Please close your eyes and keep them closed throughout the process.',
        expectedResponse: 'acknowledgment',
        scriptedResponse: (userInput, context) => {
          const goalStatement = context?.goalStatement || 'your goal';
          return `Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image.

Feel '${goalStatement}'... what does it feel like?`;
        }
      },
      {
        id: 'reality_step_a2',
        phase: 'Goal Feeling',
        instruction: 'Feel that feeling... what can you feel now?',
        expectedResponse: 'feeling',
        scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what can you feel now?`
      },
      {
        id: 'reality_feel_reason',
        phase: 'Resistance Exploration',
        instruction: 'What could get in the way of you achieving this goal?',
        expectedResponse: 'obstacle',
        scriptedResponse: (userInput, context) => {
          const goalStatement = context?.goalStatement || 'your goal';
          return `Feel '${goalStatement}'... what could get in the way of you achieving this goal?`;
        }
      },
      {
        id: 'reality_feel_reason_2',
        phase: 'Obstacle Processing',
        instruction: 'Feel that obstacle... what can you feel now?',
        expectedResponse: 'feeling',
        scriptedResponse: (userInput) => `Feel '${userInput || 'that reason'}'... what does it feel like?`
      },
      {
        id: 'reality_feel_reason_3',
        phase: 'Deeper Obstacle Work',
        instruction: 'Feel that feeling... what\'s the first thing you notice about it?',
        expectedResponse: 'observation',
        scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what's the first thing you notice about it?`
      },
      {
        id: 'reality_check_goal_again',
        phase: 'Goal Reassessment',
        instruction: 'Feel your goal again... how certain are you now that you will achieve it?',
        expectedResponse: 'percentage',
        scriptedResponse: (userInput, context) => {
          const goalStatement = context?.goalStatement || 'your goal';
          return `Feel '${goalStatement}' again... how certain are you now between 0% and 100% that you will achieve it?`;
        }
      },
      {
        id: 'reality_integration_awareness_1',
        phase: 'Integration - Awareness',
        instruction: 'How do you feel about your goal now?',
        expectedResponse: 'feeling',
        scriptedResponse: (userInput, context) => {
          const goalStatement = context?.goalStatement || 'your goal';
          return `Integration Questions - AWARENESS Section:\n\nHow do you feel about '${goalStatement}' now?`;
        }
      },
      {
        id: 'reality_integration_action_1',
        phase: 'Integration - Action',
        instruction: 'What needs to happen for you to achieve your goal?',
        expectedResponse: 'action plan',
        scriptedResponse: () => 'Integration Questions - ACTION Section:\n\nWhat needs to happen for you to achieve your goal?'
      },
      {
        id: 'reality_integration_action_2',
        phase: 'Integration - First Step',
        instruction: 'What is the first action you can take towards achieving your goal?',
        expectedResponse: 'first action',
        scriptedResponse: () => 'What is the first action you can take towards achieving your goal?'
      },
      {
        id: 'treatment_complete',
        phase: 'Completion',
        instruction: 'Excellent work! You have completed the Reality Shifting treatment.',
        expectedResponse: 'acknowledgment',
        scriptedResponse: (userInput, context) => {
          const goalStatement = context?.goalStatement || 'your goal';
          return `Excellent work! You have completed the Reality Shifting treatment for '${goalStatement}'. Notice how you feel about achieving this goal now.`;
        }
      }
    ]
  },
  belief_shifting: {
    name: 'Belief Shifting',
    steps: [
      {
        id: 'belief_shifting_intro',
        phase: 'Introduction',
        instruction: 'Please close your eyes and keep them closed throughout the process.',
        expectedResponse: 'acknowledgment',
        scriptedResponse: (userInput, context) => {
          const problemStatement = context?.problemStatement || 'the problem';
          return `Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image.

Feel the problem '${problemStatement}'... what does it feel like?`;
        }
      },
      {
        id: 'belief_step_b',
        phase: 'Belief Exploration',
        instruction: 'Feel that feeling... what does that feeling feel like?',
        expectedResponse: 'feeling description',
        scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`
      },
      {
        id: 'belief_step_c',
        phase: 'Belief Identification',
        instruction: 'What belief do you have about yourself when you feel this way?',
        expectedResponse: 'belief statement',
        scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what belief do you have about yourself when you feel '${userInput || 'that feeling'}'?`
      },
      {
        id: 'belief_step_d',
        phase: 'Belief Origin',
        instruction: 'Where did you learn this belief?',
        expectedResponse: 'origin story',
        scriptedResponse: (userInput) => `Feel the belief '${userInput || 'that belief'}'... where did you learn this belief?`
      }
    ]
  },
  identity_shifting: {
    name: 'Identity Shifting',
    steps: [
      {
        id: 'identity_shifting_intro',
        phase: 'Introduction',
        instruction: 'Please close your eyes and keep them closed throughout the process.',
        expectedResponse: 'acknowledgment',
        scriptedResponse: (userInput, context) => {
          const problemStatement = context?.problemStatement || 'the problem';
          return `Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image.

Feel the problem '${problemStatement}'... what does it feel like?`;
        }
      },
      {
        id: 'identity_step_b',
        phase: 'Identity Recognition',
        instruction: 'Who are you being when you have this problem?',
        expectedResponse: 'identity description',
        scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... who are you being when you feel '${userInput || 'that feeling'}'?`
      },
      {
        id: 'identity_dissolve_step_a',
        phase: 'Identity Exploration',
        instruction: 'Feel yourself being that identity... as that identity, what do you want?',
        expectedResponse: 'desire/want',
        scriptedResponse: (userInput) => `Feel yourself being '${userInput || 'that identity'}'... as '${userInput || 'that identity'}', what do you want?`
      },
      {
        id: 'identity_dissolve_step_b',
        phase: 'Identity Dissolution',
        instruction: 'Feel yourself being that identity... exaggerate the feeling of it and tell me the first thing that you notice about it.',
        expectedResponse: 'observation',
        scriptedResponse: (userInput) => `Feel yourself being '${userInput || 'that identity'}'... exaggerate the feeling of it and tell me the first thing that you notice about it.`
      }
    ]
  },
  blockage_shifting: {
    name: 'Blockage Shifting',
    steps: [
      {
        id: 'blockage_shifting_intro',
        phase: 'Introduction',
        instruction: 'Please close your eyes and keep them closed throughout the process.',
        expectedResponse: 'acknowledgment',
        scriptedResponse: (userInput, context) => {
          const problemStatement = context?.problemStatement || 'the problem';
          return `Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image.

Feel the problem '${problemStatement}'... what does it feel like?`;
        }
      },
      {
        id: 'blockage_step_b',
        phase: 'Blockage Feeling',
        instruction: 'Feel that feeling... what does that feeling feel like?',
        expectedResponse: 'feeling description',
        scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... what does '${userInput || 'that feeling'}' feel like?`
      },
      {
        id: 'blockage_step_c',
        phase: 'Blockage Location',
        instruction: 'Where do you feel this blockage in your body?',
        expectedResponse: 'body location',
        scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... where do you feel this in your body?`
      },
      {
        id: 'blockage_step_d',
        phase: 'Blockage Quality',
        instruction: 'Feel that blockage... what does that blockage feel like?',
        expectedResponse: 'blockage description',
        scriptedResponse: (userInput) => `Feel '${userInput || 'that blockage'}'... what does '${userInput || 'that blockage'}' feel like?`
      }
    ]
  },
  trauma_shifting: {
    name: 'Trauma Shifting',
    steps: [
      {
        id: 'trauma_shifting_intro',
        phase: 'Introduction',
        instruction: 'Please close your eyes and keep them closed throughout the process.',
        expectedResponse: 'acknowledgment',
        scriptedResponse: (userInput, context) => {
          const experienceStatement = context?.experienceStatement || 'the experience';
          return `Please close your eyes and keep them closed throughout the process. Please tell me the first thing that comes up when I ask each of the following questions and keep your answers brief. What could come up when I ask a question is an emotion, a body sensation, a thought or a mental image.

Feel the experience '${experienceStatement}'... what does it feel like?`;
        }
      },
      {
        id: 'trauma_step_b',
        phase: 'Trauma Identity',
        instruction: 'Who are you being in this experience?',
        expectedResponse: 'identity description',
        scriptedResponse: (userInput) => `Feel '${userInput || 'that feeling'}'... who are you being when you feel '${userInput || 'that feeling'}'?`
      },
      {
        id: 'trauma_dissolve_step_a',
        phase: 'Trauma Identity Exploration',
        instruction: 'Feel yourself being that identity... as that identity, what do you want?',
        expectedResponse: 'desire/want',
        scriptedResponse: (userInput) => `Feel yourself being '${userInput || 'that identity'}'... as '${userInput || 'that identity'}', what do you want?`
      },
      {
        id: 'trauma_dissolve_step_b',
        phase: 'Trauma Processing',
        instruction: 'Feel yourself being that identity... exaggerate the feeling of it and tell me the first thing that you notice about it.',
        expectedResponse: 'observation',
        scriptedResponse: (userInput) => `Feel yourself being '${userInput || 'that identity'}'... exaggerate the feeling of it and tell me the first thing that you notice about it.`
      }
    ]
  }
};

export default function VoiceTreatmentDemo() {
  const [status, setStatus] = useState<string>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [messages, setMessages] = useState<TreatmentMessage[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [selectedModality, setSelectedModality] = useState<TreatmentModality>('problem_shifting');
  const [showModalitySelector, setShowModalitySelector] = useState(false);
  const [demoContext, setDemoContext] = useState<DemoContext>({
    problemStatement: '',
    goalStatement: '',
    experienceStatement: '',
    userResponses: {}
  });
  const [stateMachineDemo, setStateMachineDemo] = useState<TreatmentStateMachineDemo | null>(null);
  const [processingWithStateMachine, setProcessingWithStateMachine] = useState(false);
  const [conversationItems, setConversationItems] = useState<Map<string, any>>(new Map());
  
  // Track when conversation items are being cleared
  useEffect(() => {
    console.log(`🔍 VOICE_DEBUG: Conversation items state changed - count: ${conversationItems.size}`);
    if (conversationItems.size === 0) {
      console.log(`🔍 VOICE_DEBUG: WARNING - Conversation items were cleared/reset!`);
    }
  }, [conversationItems]);
  
  const sessionRef = useRef<VoiceSession>({
    pc: null,
    audioEl: null,
    dataChannel: null,
    micStream: null,
    remoteStream: null
  });

  const recognitionRef = useRef<any>(null);
  const currentModality = TREATMENT_MODALITIES[selectedModality];
  const currentStep = currentModality.steps[currentStepIndex];

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

      // Set up initial context based on modality
      let initialContext = { ...demoContext };
      if (selectedModality === 'problem_shifting' || selectedModality === 'belief_shifting' || selectedModality === 'identity_shifting' || selectedModality === 'blockage_shifting') {
        // For problem-based modalities, we need a problem statement
        if (!initialContext.problemStatement) {
          initialContext.problemStatement = 'your problem'; // Will be replaced when user provides one
        }
      } else if (selectedModality === 'reality_shifting') {
        // For reality shifting, we need a goal statement
        if (!initialContext.goalStatement) {
          initialContext.goalStatement = 'your goal'; // Will be replaced when user provides one
        }
      } else if (selectedModality === 'trauma_shifting') {
        // For trauma shifting, we need an experience statement
        if (!initialContext.experienceStatement) {
          initialContext.experienceStatement = 'your experience'; // Will be replaced when user provides one
        }
      }

      // Get the actual scripted response for the first step
      const initialResponse = currentStep.scriptedResponse 
        ? currentStep.scriptedResponse('', initialContext)
        : currentStep.instruction;

      // Set initial state
      

      // 1. Create ephemeral session with treatment-specific instructions
      const treatmentInstructions = `You are a Mind Shifting treatment assistant conducting a voice-guided ${currentModality.name} demo session. 

CRITICAL: You must speak EXACTLY this script: "${initialResponse}"

RULES:
1. Speak the EXACT script provided - word for word
2. Do NOT add, change, or improve the script
3. Do NOT ask follow-up questions unless they are in the script
4. Do NOT offer suggestions or alternatives
5. Do NOT improvise or make things up
6. If the script is a question, ask ONLY that question
7. If the script is a statement, say ONLY that statement
8. This is a DEMO - stick to the script precisely

Current step: ${currentStep.phase}
Script to speak: "${initialResponse}"`;

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
        
        // Add the initial treatment message using the actual scripted response
        addMessage(initialResponse, false, true);
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
          console.log(`🔍 VOICE_DEBUG: Received message from OpenAI:`, message);
          
                    // Handle conversation events if needed
          if (message.type === 'conversation.item.input_audio_transcription.completed') {
            const transcript = message.transcript || '';
            console.log(`🔍 VOICE_DEBUG: User transcript:`, transcript);
            addMessage(transcript, true, true); // isUser: true - this is actual user input
            
            // IMMEDIATELY process with state machine and update voice instructions
            if (stateMachineDemo) {
              console.log(`🔍 VOICE_DEBUG: Immediately processing transcript with state machine`);
              processTranscriptWithStateMachine(transcript);
            }
            
            // Capture problem/goal/experience based on current step
            if (currentStep.id === 'problem_input' && transcript.trim()) {
              setDemoContext(prev => ({ ...prev, problemStatement: transcript.trim() }));
            } else if (currentStep.id === 'reality_goal_capture' && transcript.trim()) {
              setDemoContext(prev => ({ ...prev, goalStatement: transcript.trim() }));
            } else if (currentStep.id === 'trauma_shifting_intro' && transcript.trim()) {
              setDemoContext(prev => ({ ...prev, experienceStatement: transcript.trim() }));
            }
          }
          
          // NEW: Track conversation items for transcript extraction
          if (message.type === 'conversation.item.created') {
            console.log(`🔍 VOICE_DEBUG: Conversation item created:`, message);
            
            // Track conversation items for transcript extraction
            if (message.item && message.item.id) {
              console.log(`🔍 VOICE_DEBUG: Conversation item details:`, {
                id: message.item.id,
                type: message.item.type,
                content: message.item.content,
                contentLength: message.item.content?.length || 0,
                contentFirstItem: message.item.content?.[0],
                transcript: message.item.transcript,
                text: message.item.text,
                hasContent: !!message.item.content,
                hasTranscript: !!message.item.transcript,
                hasText: !!message.item.text
              });
              
              setConversationItems(prev => {
                const newMap = new Map(prev);
                newMap.set(message.item.id, message.item);
                console.log(`🔍 VOICE_DEBUG: Stored conversation item: ${message.item.id}`);
                console.log(`🔍 VOICE_DEBUG: Total conversation items now: ${newMap.size}`);
                return newMap;
              });
            }
          }
          
          // Log any other message types for debugging
          if (message.type !== 'conversation.item.input_audio_transcription.completed') {
            console.log(`🔍 VOICE_DEBUG: Other message type:`, message.type, message);
            
            // Debug: Log all non-response messages to understand what we're receiving
            if (!message.type.includes('response') && !message.type.includes('output')) {
              console.log(`🔍 VOICE_DEBUG: NON-RESPONSE MESSAGE:`, message.type, message);
            }
            
            // ONLY process messages that are clearly user input, not AI responses
            if (message.type.includes('input') && !message.type.includes('response') && !message.type.includes('output')) {
              console.log(`🔍 VOICE_DEBUG: POTENTIAL USER INPUT DETECTED:`, message.type, message);
              
              // Try to extract transcript from various possible message formats
              const possibleTranscript = message.transcript || message.text || message.content || message.speech || '';
              if (possibleTranscript) {
                console.log(`🔍 VOICE_DEBUG: EXTRACTED USER TRANSCRIPT: "${possibleTranscript}"`);
                addMessage(possibleTranscript, true, true); // isUser: true
                
                // IMMEDIATELY process with state machine
                if (stateMachineDemo) {
                  console.log(`🔍 VOICE_DEBUG: Processing extracted transcript with state machine`);
                  processTranscriptWithStateMachine(possibleTranscript);
                }
              }
            }
            
            // Handle AI response transcripts (these should NOT be treated as user input)
            if (message.type.includes('response') && message.type.includes('audio_transcript')) {
              console.log(`🔍 VOICE_DEBUG: AI RESPONSE TRANSCRIPT (NOT USER INPUT):`, message);
              
              // Extract the AI's response text
              const aiResponseText = message.delta || message.text || message.content || '';
              if (aiResponseText) {
                console.log(`🔍 VOICE_DEBUG: AI is saying: "${aiResponseText}"`);
                // Note: We don't add AI responses as messages here because they're streamed
                // The voice system handles the audio output directly
              }
            }
            
            // Handle speech detection events
            if (message.type === 'input_audio_buffer.speech_started') {
              console.log(`🔍 VOICE_DEBUG: User started speaking`);
            }
            
            if (message.type === 'input_audio_buffer.speech_stopped') {
              console.log(`🔍 VOICE_DEBUG: User stopped speaking`);
            }
            
            if (message.type === 'input_audio_buffer.committed') {
              console.log(`🔍 VOICE_DEBUG: User speech committed to processing`);
            }
            
            // Handle user input transcription - look for multiple possible message types
            if (message.type === 'conversation.item.input_audio_transcription.completed' ||
                message.type === 'input_audio_transcription.completed' ||
                message.type === 'user_input_transcription' ||
                message.type === 'input_transcript' ||
                message.type === 'conversation.item.input_audio_transcription.delta' ||
                message.type === 'input_audio_transcription.delta' ||
                message.type === 'conversation.item.input_audio_transcription.started' ||
                message.type === 'input_audio_transcription.started') {
              const transcript = message.transcript || message.text || message.content || message.delta || '';
              console.log(`🔍 VOICE_DEBUG: USER INPUT DETECTED: "${transcript}"`);
              addMessage(transcript, true, true); // isUser: true
              
              // IMMEDIATELY process with state machine and update voice instructions
              if (stateMachineDemo) {
                console.log(`🔍 VOICE_DEBUG: Immediately processing user input with state machine`);
                processTranscriptWithStateMachine(transcript);
              }
            }
            
            // NEW: Fallback - use speech committed as trigger for user input processing
            if (message.type === 'input_audio_buffer.committed') {
              console.log(`🔍 VOICE_DEBUG: SPEECH COMMITTED - Attempting fallback transcription detection`);
              
              // Wait a moment for transcription to complete, then check for any transcript
              setTimeout(() => {
                console.log(`🔍 VOICE_DEBUG: Checking for delayed transcription after speech committed`);
                console.log(`🔍 VOICE_DEBUG: Current conversation items count: ${conversationItems.size}`);
                
                // Try to extract any available transcript from the conversation
                let possibleTranscript = '';
                
                // Check content array for transcript data
                if (message.content && Array.isArray(message.content) && message.content.length > 0) {
                  // Look for transcript in content array
                  const contentItem = message.content[0];
                  if (contentItem && typeof contentItem === 'object') {
                    possibleTranscript = contentItem.transcript || contentItem.text || contentItem.content || '';
                  }
                }
                
                // Fallback to direct fields
                if (!possibleTranscript) {
                  possibleTranscript = message.transcript || message.text || message.content || message.delta || '';
                }
                if (possibleTranscript && possibleTranscript.trim().length > 0) {
                  console.log(`🔍 VOICE_DEBUG: FALLBACK TRANSCRIPT FOUND: "${possibleTranscript}"`);
                  addMessage(possibleTranscript, true, true);
                  
                  if (stateMachineDemo) {
                    console.log(`🔍 VOICE_DEBUG: Processing fallback transcript with state machine`);
                    processTranscriptWithStateMachine(possibleTranscript);
                  }
                } else {
                  console.log(`🔍 VOICE_DEBUG: No transcript found in fallback check - transcription may be failing`);
                  
                  // NEW: Try to extract transcript from conversation item
                  console.log(`🔍 VOICE_DEBUG: Attempting to extract transcript from conversation item`);
                  
                  // Check if we can find the conversation item that was created
                  if (message.item_id) {
                    console.log(`🔍 VOICE_DEBUG: Looking for conversation item: ${message.item_id}`);
                    
                    // Try to find any transcript data in the conversation
                    const conversationItem = message.item || {};
                    const itemTranscript = conversationItem.transcript || conversationItem.text || conversationItem.content || '';
                    
                    if (itemTranscript && itemTranscript.trim().length > 0) {
                      console.log(`🔍 VOICE_DEBUG: CONVERSATION ITEM TRANSCRIPT FOUND: "${itemTranscript}"`);
                      addMessage(itemTranscript, true, true);
                      
                      if (stateMachineDemo) {
                        console.log(`🔍 VOICE_DEBUG: Processing conversation item transcript with state machine`);
                        processTranscriptWithStateMachine(itemTranscript);
                      }
                    } else {
                      console.log(`🔍 VOICE_DEBUG: No transcript in conversation item either`);
                      
                      // NEW: Check stored conversation items
                      const storedItem = conversationItems.get(message.item_id);
                      if (storedItem) {
                        console.log(`🔍 VOICE_DEBUG: Found stored conversation item:`, {
                          id: storedItem.id,
                          type: storedItem.type,
                          content: storedItem.content,
                          transcript: storedItem.transcript,
                          text: storedItem.text,
                          hasContent: !!storedItem.content,
                          hasTranscript: !!storedItem.transcript,
                          hasText: !!storedItem.text
                        });
                        
                        // Check content array for transcript data
                        let storedTranscript = '';
                        console.log(`🔍 VOICE_DEBUG: Examining stored item content:`, {
                          hasContent: !!storedItem.content,
                          isArray: Array.isArray(storedItem.content),
                          contentLength: storedItem.content?.length || 0,
                          contentFirstItem: storedItem.content?.[0]
                        });
                        
                        if (storedItem.content && Array.isArray(storedItem.content) && storedItem.content.length > 0) {
                          // Look for transcript in content array
                          const contentItem = storedItem.content[0];
                          console.log(`🔍 VOICE_DEBUG: Content item details:`, {
                            hasContentItem: !!contentItem,
                            isObject: typeof contentItem === 'object',
                            contentItemKeys: contentItem ? Object.keys(contentItem) : [],
                            contentItem: contentItem
                          });
                          
                          if (contentItem && typeof contentItem === 'object') {
                            storedTranscript = contentItem.transcript || contentItem.text || contentItem.content || '';
                            console.log(`🔍 VOICE_DEBUG: Extracted transcript from content item: "${storedTranscript}"`);
                          }
                        }
                        
                        // Fallback to direct fields
                        if (!storedTranscript) {
                          storedTranscript = storedItem.transcript || storedItem.text || storedItem.content || '';
                        }
                        
                        if (storedTranscript && storedTranscript.trim().length > 0) {
                          console.log(`🔍 VOICE_DEBUG: STORED CONVERSATION ITEM TRANSCRIPT FOUND: "${storedTranscript}"`);
                          addMessage(storedTranscript, true, true);
                          
                          if (stateMachineDemo) {
                            console.log(`🔍 VOICE_DEBUG: Processing stored conversation item transcript with state machine`);
                            processTranscriptWithStateMachine(storedTranscript);
                          }
                        } else {
                          console.log(`🔍 VOICE_DEBUG: No transcript in stored conversation item either`);
                          addMessage("[Voice detected but transcription failed - please try speaking again]", true, true);
                        }
                      } else {
                        console.log(`🔍 VOICE_DEBUG: No stored conversation item found for: ${message.item_id}`);
                        console.log(`🔍 VOICE_DEBUG: Available conversation items:`, Array.from(conversationItems.keys()));
                        addMessage("[Voice detected but transcription failed - please try speaking again]", true, true);
                      }
                    }
                  } else {
                    console.log(`🔍 VOICE_DEBUG: No item_id found in committed message`);
                    
                    // Add a placeholder message to indicate we heard the user but transcription failed
                    addMessage("[Voice detected but transcription failed - please try speaking again]", true, true);
                  }
                }
              }, 2000); // Wait 2 seconds for transcription to complete
            }
            
            // Also check for any message that might contain user input
            if (message.transcript || message.text || message.content || message.delta) {
              // Only process if it's NOT an AI response
              if (!message.type.includes('response') && !message.type.includes('output')) {
                const possibleUserInput = message.transcript || message.text || message.content || message.delta || '';
                if (possibleUserInput && possibleUserInput.trim().length > 0) {
                  console.log(`🔍 VOICE_DEBUG: POTENTIAL USER INPUT FOUND: "${possibleUserInput}" (type: ${message.type})`);
                  addMessage(possibleUserInput, true, true); // isUser: true
                  
                  // IMMEDIATELY process with state machine and update voice instructions
                  if (stateMachineDemo) {
                    console.log(`🔍 VOICE_DEBUG: Immediately processing potential user input with state machine`);
                    processTranscriptWithStateMachine(possibleUserInput);
                  }
                }
              }
            }
          }
        } catch (err) {
          console.log(`🔍 VOICE_DEBUG: Non-JSON message received:`, event.data);
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

  const nextStep = async () => {
    console.log(`🔍 CLIENT_DEBUG: nextStep called - voice-only mode`);
    console.log(`🔍 CLIENT_DEBUG: Voice-only mode - this function is for manual progression`);
    console.log(`🔍 CLIENT_DEBUG: In voice mode, progression happens automatically via voice input`);
    
    // In voice-only mode, this function is mainly for manual progression
    // The actual processing happens in the voice message handlers
    addMessage('Voice session is active. Please speak your response.', false, false);
  };

  // Process transcript immediately with state machine and update voice instructions
  const processTranscriptWithStateMachine = async (transcript: string) => {
    if (!stateMachineDemo) return;
    
    console.log(`🔍 VOICE_DEBUG: Processing transcript: "${transcript}"`);
    console.log(`🔍 VOICE_DEBUG: About to call stateMachineDemo.processUserInput`);
    
    try {
      const result = await stateMachineDemo.processUserInput(transcript, undefined, true);
      console.log(`🔍 VOICE_DEBUG: State machine result:`, result);
      
      if (result.scriptedResponse) {
        console.log(`🔍 VOICE_DEBUG: Got scripted response: "${result.scriptedResponse}"`);
        
        // Update voice instructions immediately
        if (sessionRef.current.dataChannel?.readyState === 'open') {
          const context = stateMachineDemo.getCurrentContext();
          const newInstructions = `You are a Mind Shifting treatment assistant using the real treatment state machine.

EXACT SCRIPTED RESPONSE TO SPEAK: "${result.scriptedResponse}"

CRITICAL RULES:
1. SPEAK THE EXACT WORDS ABOVE - DO NOT CHANGE, IMPROVE, OR INTERPRET THEM
2. DO NOT ADD ANY ADDITIONAL WORDS OR EXPLANATIONS
3. DO NOT MAKE THE RESPONSE MORE NATURAL OR CONVERSATIONAL
4. READ THE SCRIPTED RESPONSE WORD-FOR-WORD AS WRITTEN
5. IF THE SCRIPTED RESPONSE IS A VALIDATION MESSAGE, SPEAK IT EXACTLY
6. DO NOT DEVIATE FROM THE PROVIDED TEXT UNDER ANY CIRCUMSTANCES

Treatment context: ${context ? `Phase: ${context.currentPhase}, Step: ${context.currentStep}` : 'Unknown'}
This is a DEMO using real treatment logic.`;

          console.log(`🔍 VOICE_DEBUG: IMMEDIATELY updating voice instructions:`, newInstructions);
          
          try {
            const message = {
              type: 'session.update',
              session: { instructions: newInstructions }
            };
            console.log(`🔍 VOICE_DEBUG: Sending immediate session.update:`, message);
            
            sessionRef.current.dataChannel.send(JSON.stringify(message));
            console.log(`🔍 VOICE_DEBUG: Immediate instruction update sent successfully`);
          } catch (error) {
            console.error(`🔍 VOICE_DEBUG: Failed to send immediate instruction update:`, error);
          }
        } else {
          console.log(`🔍 VOICE_DEBUG: Data channel not open, cannot update instructions`);
        }
      } else {
        console.log(`🔍 VOICE_DEBUG: No scripted response from state machine`);
      }
    } catch (error) {
      console.error(`🔍 VOICE_DEBUG: Error processing transcript with state machine:`, error);
    }
  };

  const resetDemo = () => {
    cleanup();
    setMessages([]);
    setCurrentStepIndex(0);
    setDemoContext({
      problemStatement: '',
      goalStatement: '',
      experienceStatement: '',
      userResponses: {}
    });
    
    // Reset state machine if enabled
    if (stateMachineDemo) {
      stateMachineDemo.resetSession();
    }
  };

  const initializeStateMachine = async () => {
            if (!stateMachineDemo) {
      const demo = new TreatmentStateMachineDemo();
      setStateMachineDemo(demo);
      
      try {
        const result = await demo.initializeSession(selectedModality, undefined, true);
        if (result.scriptedResponse) {
          addMessage(result.scriptedResponse, false, false);
        }
      } catch (error) {
        console.error('Failed to initialize state machine:', error);
        setError('Failed to initialize treatment state machine');
      }
    }
  };

  // Initialize state machine when enabled
  useEffect(() => {
            if (true) {
      initializeStateMachine();
    }
      }, [selectedModality]);

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



      {/* Script Mode Toggle */}
      {/* State Machine Status - Always Active */}
      <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-md">
        <div className="flex items-center space-x-3">
          <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h5 className="font-medium text-indigo-900 dark:text-indigo-200">
              Treatment State Machine (Always Active)
            </h5>
            <p className="text-sm text-indigo-700 dark:text-indigo-300">
              Strict script adherence - follows doctor's treatment protocol exactly
            </p>
          </div>
        </div>
      </div>

      {/* Modality Selector */}
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
        <div className="flex items-center justify-between">
          <div>
            <h5 className="font-medium text-blue-900 dark:text-blue-200">
              Treatment Modality: {currentModality.name}
            </h5>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Real state machine with production logic - strict script adherence
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
                  setCurrentStepIndex(0);
                  setMessages([]);
                  setShowModalitySelector(false);
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

      {/* Current Step Info */}
      <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-md">
        <div className="flex items-center justify-between">
          <div>
            <h5 className="font-medium text-indigo-900 dark:text-indigo-200">
              Step {currentStepIndex + 1} of {currentModality.steps.length}: {currentStep.phase}
            </h5>
            <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
              Expected: {currentStep.expectedResponse}
            </p>
          </div>
          <div className="text-right">
            <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${((currentStepIndex + 1) / currentModality.steps.length) * 100}%` }}
              ></div>
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {Math.round(((currentStepIndex + 1) / currentModality.steps.length) * 100)}%
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
                        disabled={!isConnected || processingWithStateMachine}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
                      <span>{processingWithStateMachine ? 'Processing...' : 'Process Input'}</span>
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


    </div>
  );
} 