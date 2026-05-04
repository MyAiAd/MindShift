'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, Clock, Zap, AlertCircle, CheckCircle, MessageSquare, Undo2, Sparkles, Mic, Volume2, VolumeX, Send, Play, Settings, Gauge, User, SkipForward, ArrowLeft, LogOut } from 'lucide-react';
// Global voice system integration (accessibility-driven)
import { useGlobalVoice } from '@/components/voice/useGlobalVoice';
// Natural voice integration (ElevenLabs + Web Speech)
import { useNaturalVoice } from '@/components/voice/useNaturalVoice';
import { getVoiceCacheName } from '@/lib/voice/voice-cache-name';
import V9AudioPreloader from './V9AudioPreloader';
// V9 preferences for interaction modes (parallel to V7, see R1/R5/R6 of
// `docs/prd-v9-ux-restoration.md`). V9 MUST NOT import V7 preferences —
// interaction mode, mic, speaker, voice, and playback speed are all
// stored under `v9_*` localStorage keys with their own defaults.
import {
  getInteractionMode,
  getVoicePreferences,
  shouldShowOrb,
  shouldShowTextFirst,
  isListenOnlyMode,
  InteractionMode,
  V9_EVENTS,
} from '@/lib/v9/v9-preferences';

// Import shared types
import {
  TreatmentMessage,
  TreatmentSessionProps,
  SessionStats,
  PerformanceMetrics,
  StepHistoryEntry
} from './shared/types';

// Admin debug drawer (slides out from right for admin testing)
// V9 ports its own copy so the `voicePair` (R9) and static-audio
// telemetry (R13.4) panels can be rendered without touching V7.
import AdminDebugDrawer from './AdminDebugDrawer';
import { useAuth } from '@/lib/auth';
import type { TranscriptionDomainContext } from '@/lib/voice/transcription-domain-context';

// R3: Reuse V7 modality components verbatim. V7 is frozen — its
// modalities are pure presentational components that accept a
// `ModalityComponentProps` whose shape V9 mirrors in its own
// `./shared/types.ts`. If V7 is ever deleted these imports move to
// `./modalities/*` in V9; until then there's no benefit to
// duplicating thousands of lines of modality UI.
import ProblemShifting from '@/components/treatment/v7/modalities/ProblemShifting/ProblemShifting';
import IdentityShifting from '@/components/treatment/v7/modalities/IdentityShifting/IdentityShifting';
import BeliefShifting from '@/components/treatment/v7/modalities/BeliefShifting/BeliefShifting';
import BlockageShifting from '@/components/treatment/v7/modalities/BlockageShifting/BlockageShifting';
import RealityShifting from '@/components/treatment/v7/modalities/RealityShifting/RealityShifting';
import TraumaShifting from '@/components/treatment/v7/modalities/TraumaShifting/TraumaShifting';

export default function TreatmentSession({
  sessionId,
  userId,
  shouldResume = false,
  onComplete,
  onError,
  version = 'v9'
}: TreatmentSessionProps) {
  type SpeechFallbackPromptState = {
    kind: 'stt' | 'tts';
    status: 'prompt' | 'declined';
  } | null;

  // US-015/US-016: text-mode fallback replaces the old Kokoro/Whisper "backup" prompt.
  // The v7 path is fully outsourced (OpenAI or typing), so the only fallback when OpenAI
  // fails is text-input mode. No vendor names are surfaced to the user.
  type TextModeFallbackState = null | 'prompt' | 'active' | 'retrying';
  type V9TtsProvider = 'openai' | 'elevenlabs' | 'kokoro';
  type SessionTtsEstimate = {
    provider: V9TtsProvider | null;
    fetches: number;
    cachedFetches: number;
    characters: number;
    estimatedUsd: number;
  };

  // Admin debug drawer
  const { profile, signOut } = useAuth();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'tenant_admin';
  const [isDebugDrawerOpen, setIsDebugDrawerOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('v9_debug_drawer_open') === 'true';
    }
    return false;
  });
  const toggleDebugDrawer = useCallback(() => {
    setIsDebugDrawerOpen((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('v9_debug_drawer_open', String(next));
      }
      return next;
    });
  }, []);

  const [messages, setMessages] = useState<TreatmentMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showReadyOverlay, setShowReadyOverlay] = useState(true); // New: Start with overlay visible
  const [isPreparingStartPermissions, setIsPreparingStartPermissions] = useState(false);
  const [hasUserStartedSession, setHasUserStartedSession] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    totalResponses: 0,
    avgResponseTime: 0,
    aiUsagePercent: 0,
    version: 'v9'
  });

  // Natural Voice State - SPLIT into Mic and Speaker (Phase 2: Audio System Fix)
  // Load from localStorage if available
  const [isMicEnabled, setIsMicEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('v9_mic_enabled') === 'true';
    }
    return false;
  });
  
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('v9_speaker_enabled') === 'true';
    }
    return false;
  });
  
  // Permission state tracking
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [hasCheckedPermission, setHasCheckedPermission] = useState(false);

  // DEPRECATED: Keep for backward compatibility during transition
  const [isNaturalVoiceEnabled, setIsNaturalVoiceEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('v9_natural_voice') === 'true';
    }
    return false;
  });

  // Permission checking logic (prevents repeated prompts on iPhone)
  const checkMicPermission = useCallback(async (): Promise<'granted' | 'denied' | 'prompt'> => {
    // Try modern Permissions API first
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return result.state as 'granted' | 'denied' | 'prompt';
      } catch (e) {
        // Fallback for browsers that don't support microphone query
        console.log('Permissions API not available for microphone');
      }
    }
    
    // Fallback: check localStorage cache
    const cached = localStorage.getItem('v9_mic_permission');
    if (cached) return cached as 'granted' | 'denied' | 'prompt';
    
    return 'prompt';
  }, []);

  // Request microphone permission (only if not already granted)
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    const currentState = await checkMicPermission();
    
    // Don't request if already granted
    if (currentState === 'granted') {
      console.log('🎤 Microphone already granted');
      setMicPermission('granted');
      return true;
    }
    
    // Don't request if denied
    if (currentState === 'denied') {
      console.log('🎤 Microphone denied');
      setMicPermission('denied');
      return false;
    }
    
    // Only request if 'prompt'
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      stream.getTracks().forEach(track => track.stop()); // Stop immediately, we just needed permission
      localStorage.setItem('v9_mic_permission', 'granted');
      setMicPermission('granted');
      return true;
    } catch (e) {
      localStorage.setItem('v9_mic_permission', 'denied');
      setMicPermission('denied');
      return false;
    }
  }, [checkMicPermission]);

  // Check permission state on mount (only once)
  useEffect(() => {
    if (!hasCheckedPermission && isMicEnabled) {
      checkMicPermission().then(state => {
        setMicPermission(state);
        setHasCheckedPermission(true);
      });
    }
  }, [isMicEnabled, hasCheckedPermission, checkMicPermission]);

  // Voice Settings State
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('v9_playback_speed');
      return saved ? parseFloat(saved) : 1.0;
    }
    return 1.0;
  });
  // R5/R6: v9 selects voice from `v9_voice_id` → legacy `v9_selected_voice`
  // → `NEXT_PUBLIC_V9_DEFAULT_VOICE` env → `NEXT_PUBLIC_V7_DEFAULT_VOICE`
  // env (compatibility with existing ops tooling) → 'marin'. V9 never
  // falls back to any `v7_*` localStorage key — that would violate R5.
  // Default 'marin' is OpenAI's current top-tier voice for
  // gpt-4o-mini-tts and the static library is baked against it.
  const [selectedVoice, setSelectedVoice] = useState(() => {
    if (typeof window !== 'undefined') {
      const explicit = localStorage.getItem('v9_voice_id');
      if (explicit) return explicit;
      const legacy = localStorage.getItem('v9_selected_voice');
      if (legacy) return legacy;
      const envDefault =
        process.env.NEXT_PUBLIC_V9_DEFAULT_VOICE ??
        process.env.NEXT_PUBLIC_V7_DEFAULT_VOICE;
      if (envDefault) return envDefault;
      return 'marin';
    }
    return 'marin';
  });
  // ─────────────────────────────────────────────────────────────────────────
  // PTT / Guided Mode — SIDELINED (not deleted).
  //
  // V9 no longer exposes Push-to-Talk / orb hold-to-speak in the UI: the orb
  // overlay below (`{isGuidedMode && ...}`) and the matching subtitle/skip
  // controls all gate on `isGuidedMode`, and the Scribe realtime hook reads
  // the same flag to choose between `commit_strategy=vad` (continuous) and
  // `commit_strategy=manual` (PTT). Forcing `isGuidedMode = false` is the
  // single switch that disables ALL of that without removing any code:
  //
  //   • orb UI never renders
  //   • Scribe always opens in continuous VAD mode
  //   • handlePTTStart / handlePTTEnd / orb component / scribe.pauseCapture
  //     / resumeCapture / commitNow all stay compiled and reachable
  //
  // To bring PTT back, restore the original useState + localStorage init:
  //   const [isGuidedMode, setIsGuidedMode] = useState(() =>
  //     typeof window !== 'undefined' &&
  //     localStorage.getItem('v9_guided_mode') === 'true'
  //   );
  const isGuidedMode = false;
  // No-op setter — kept so existing setIsGuidedMode(...) call sites still
  // type-check without conditional edits scattered across the file.
  const setIsGuidedMode = useCallback((_value: boolean | ((prev: boolean) => boolean)) => {
    // intentionally empty — see comment above
  }, []);
  const [isPTTActive, setIsPTTActive] = useState(false);
  const voiceSettingsRef = useRef<HTMLDivElement>(null);

  // PTT sideline cleanup: drop any stale `v9_guided_mode=true` from prior
  // sessions so the flag stays consistent with the in-memory `isGuidedMode`
  // constant above. Safe to run on every mount — it's just a localStorage
  // setItem of 'false'.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('v9_guided_mode') !== 'false') {
      localStorage.setItem('v9_guided_mode', 'false');
    }
  }, []);

  // Interaction Mode State (new - for orb/listen-only/text-first)
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(() => {
    if (typeof window !== 'undefined') {
      return getInteractionMode();
    }
    return 'text_first';
  });
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  // VAD (Voice Activity Detection) State
  const [vadSensitivity, setVadSensitivity] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('v9_vad_sensitivity');
      return saved ? parseFloat(saved) : 0.7; // Increased from 0.5 to 0.7 for more forgiving default
    }
    return 0.7; // Increased from 0.5 to 0.7 for more forgiving default
  });
  const [vadLevel, setVadLevel] = useState(0); // 0-100 for real-time meter display
  const [isVadActive, setIsVadActive] = useState(false); // Tracks if VAD is running

  // Test Audio State - for settings demo
  const [isTestPlaying, setIsTestPlaying] = useState(false);
  const [testInterrupted, setTestInterrupted] = useState(false);
  const testAudioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const testAutoStartTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Track the 300ms auto-start delay
  const isTestPlayingRef = useRef(false); // Ref for immediate access in callbacks
  
  // Subtitle testing state (single-line text under orb)
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const subtitleTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const subtitleSpeechTextRef = useRef('');
  const subtitleReadyRef = useRef(false);
  const subtitleStartedRef = useRef(false);
  const [hasFirstSpeechStarted, setHasFirstSpeechStarted] = useState(false);
  const [isFirstSpeechLoading, setIsFirstSpeechLoading] = useState(false);
  
  // Test audio sample text - longer for better testing
  const TEST_AUDIO_SAMPLE = "This is a test of your voice settings. I will keep speaking so you can test interrupting me at any time. Try adjusting the sensitivity slider, then speak to interrupt. Higher sensitivity means it's easier to interrupt me. Lower sensitivity means I'm harder to interrupt. You can also adjust my speaking speed to find what works best for you. Go ahead and try interrupting me now by speaking. I'll keep looping until you stop the test.";
  const SUBTITLE_START_DELAY_MS = 220;
  const SUBTITLE_MS_PER_WORD = 360;

  const clearSubtitleTimers = useCallback(() => {
    subtitleTimersRef.current.forEach(timer => clearTimeout(timer));
    subtitleTimersRef.current = [];
  }, []);

  const resetSubtitles = useCallback(() => {
    subtitleSpeechTextRef.current = '';
    subtitleReadyRef.current = false;
    subtitleStartedRef.current = false;
    clearSubtitleTimers();
    setCurrentSubtitle('');
  }, [clearSubtitleTimers]);

  const prepareSubtitlesForSpeech = useCallback((text: string) => {
    subtitleSpeechTextRef.current = text;
    subtitleReadyRef.current = Boolean(text?.trim());
    subtitleStartedRef.current = false;
    clearSubtitleTimers();
    setCurrentSubtitle('');
  }, [clearSubtitleTimers]);

  const beginFirstSpeechLoading = useCallback(() => {
    if (interactionMode !== 'orb_ptt' || !isSpeakerEnabled || hasFirstSpeechStarted) {
      return;
    }
    setIsFirstSpeechLoading(true);
  }, [hasFirstSpeechStarted, interactionMode, isSpeakerEnabled]);

  const splitIntoSubtitleSegments = useCallback((text: string): string[] => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return [];

    // Avoid regex lookbehind so older mobile browsers can parse this file.
    const sentenceSplit = (normalized.match(/[^.!?]+[.!?]?/g) || [])
      .map(segment => segment.trim())
      .filter(Boolean);

    const baseSegments = sentenceSplit.length > 0 ? sentenceSplit : [normalized];

    return baseSegments.flatMap(segment => {
      if (segment.length <= 110) {
        return [segment];
      }

      const clauseSegments = segment
        .split(/[,;:]\s+/)
        .map(clause => clause.trim())
        .filter(Boolean);

      return clauseSegments.length > 0 ? clauseSegments : [segment];
    });
  }, []);

  const getSubtitleSegmentDurationMs = useCallback((segment: string) => {
    const wordCount = segment.split(/\s+/).filter(Boolean).length;
    const effectiveSpeed = Math.max(playbackSpeed, 0.5);
    const estimatedDuration = (wordCount * SUBTITLE_MS_PER_WORD) / effectiveSpeed;
    return Math.min(Math.max(estimatedDuration, 900), 5200);
  }, [playbackSpeed]);

  const startSubtitleSequence = useCallback((text: string) => {
    const segments = splitIntoSubtitleSegments(text);
    if (segments.length === 0) {
      setCurrentSubtitle('');
      return;
    }

    clearSubtitleTimers();

    const firstLineTimer = setTimeout(() => {
      setCurrentSubtitle(segments[0]);
    }, SUBTITLE_START_DELAY_MS);
    subtitleTimersRef.current.push(firstLineTimer);

    let elapsedMs = SUBTITLE_START_DELAY_MS;
    for (let i = 0; i < segments.length - 1; i++) {
      elapsedMs += getSubtitleSegmentDurationMs(segments[i]);
      const nextLineTimer = setTimeout(() => {
        setCurrentSubtitle(segments[i + 1]);
      }, elapsedMs);
      subtitleTimersRef.current.push(nextLineTimer);
    }
  }, [clearSubtitleTimers, getSubtitleSegmentDurationMs, splitIntoSubtitleSegments]);

  // V7 OpenAI voices. Both are pinned to the `gpt-4o-mini-tts-2025-03-20`
  // snapshot so the static-audio library and the live /api/tts stream stay
  // sonically identical (see docs/v7-tts-determinism-policy.md).
  // Note: the `kokoroId` field is retained only to satisfy the legacy
  // `kokoroVoiceId` prop shape inherited by useNaturalVoice; V7 always uses
  // voiceProvider='openai' + voiceId=selectedVoice, so the kokoro fallback is
  // never exercised on this surface.
  const AVAILABLE_VOICES = [
    { id: 'marin', name: 'Marin', kokoroId: 'af_heart', description: 'Warm, calm female clinician voice' },
    { id: 'cedar', name: 'Cedar', kokoroId: 'am_michael', description: 'Grounded, measured male clinician voice' },
  ] as const;

  // Toggle handlers with Sticky Settings and Retroactive Play
  const toggleMic = useCallback(async () => {
    const newState = !isMicEnabled;
    
    // If turning ON, request permission first
    if (newState) {
      const granted = await requestMicPermission();
      if (!granted) {
        console.log('🎤 Microphone permission denied, cannot enable');
        return;
      }
    }
    
    setIsMicEnabled(newState);
    
    // Sticky Settings - persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('v9_mic_enabled', String(newState));
    }
    
    console.log(`🎤 Microphone ${newState ? 'enabled' : 'disabled'}`);
  }, [isMicEnabled, requestMicPermission]);

  const toggleSpeaker = useCallback(() => {
    const newState = !isSpeakerEnabled;
    
    // If turning OFF, stop any playing audio
    if (!newState) {
      naturalVoice.stopSpeaking();
      resetSubtitles();
    }
    
    setIsSpeakerEnabled(newState);
    
    // Sticky Settings - persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('v9_speaker_enabled', String(newState));
    }
    
    // Retroactive Play: If turning ON, speak the last AI message
    if (newState) {
      const lastAiMessage = [...messages].reverse().find(m => !m.isUser);
      if (lastAiMessage?.content) {
        console.log('🔊 Retroactive Play:', lastAiMessage.content);
        speakServerMessage(lastAiMessage.content);
      }
    }
    
    console.log(`🔊 Speaker ${newState ? 'enabled' : 'disabled'}`);
  }, [isSpeakerEnabled, messages, resetSubtitles, speakServerMessage]);
  // Note: naturalVoice is not in deps because it's stable (from useNaturalVoice hook)

  // NEW: Pause/Resume handler for dedicated pause button
  // DEPRECATED: Old toggle handler (keep for backward compatibility during transition)
  const toggleNaturalVoice = () => {
    const newState = !isNaturalVoiceEnabled;
    
    // If turning OFF, immediately stop any playing audio
    if (!newState) {
      naturalVoice.stopSpeaking();
      resetSubtitles();
    }
    
    setIsNaturalVoiceEnabled(newState);

    // Sticky Settings
    if (typeof window !== 'undefined') {
      localStorage.setItem('v9_natural_voice', String(newState));
    }

    // Retroactive Play: If turning ON, speak the last AI message
    if (newState) {
      // Find the last message that is NOT from the user
      const lastAiMessage = [...messages].reverse().find(m => !m.isUser);
      if (lastAiMessage?.content) {
        console.log('🔊 Retroactive Play:', lastAiMessage.content);
        speakServerMessage(lastAiMessage.content);
      }
    } else {
      // If turning OFF, stop any current speech
      // (The hook handles this via the enabled prop, but explicit is good)
    }
  };

  // Handle playback speed change
  const handleSpeedChange = (newSpeed: number) => {
    setPlaybackSpeed(newSpeed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('v9_playback_speed', String(newSpeed));
    }
  };

  // Handle voice selection change
  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoice(voiceId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('v9_selected_voice', voiceId);
      // Dispatch custom event to notify parent components (same-tab updates)
      window.dispatchEvent(new CustomEvent('v4-voice-changed', { detail: voiceId }));
    }
  };

  // Retained for the legacy `kokoroVoiceId` prop on useNaturalVoice. V7 never
  // hits the Kokoro path (voiceProvider='openai' + voiceId=selectedVoice), so
  // this just keeps the prop shape happy without influencing playback.
  const getKokoroVoiceId = () => {
    const voice = AVAILABLE_VOICES.find(v => v.id === selectedVoice);
    return voice?.kokoroId || 'af_heart';
  };

  // Get speed label for display
  const getSpeedLabel = (speed: number) => {
    if (speed <= 0.75) return 'Slower';
    if (speed <= 0.9) return 'Slow';
    if (speed <= 1.1) return 'Normal';
    if (speed <= 1.25) return 'Fast';
    return 'Faster';
  };

  // Handle VAD sensitivity change
  const handleVadSensitivityChange = (newSensitivity: number) => {
    setVadSensitivity(newSensitivity);
    if (typeof window !== 'undefined') {
      localStorage.setItem('v9_vad_sensitivity', String(newSensitivity));
    }
    console.log(`🎙️ VAD Sensitivity changed to ${newSensitivity} (${getVadSensitivityLabel(newSensitivity)})`);
  };

  // Get VAD sensitivity label for display
  const getVadSensitivityLabel = (sensitivity: number) => {
    if (sensitivity <= 0.35) return 'Low';
    if (sensitivity <= 0.65) return 'Medium';
    return 'High';
  };

  // Close voice settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (voiceSettingsRef.current && !voiceSettingsRef.current.contains(event.target as Node)) {
        setShowVoiceSettings(false);
      }
    };

    if (showVoiceSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVoiceSettings]);

  // FIX #4: Request mic permission when entering guided mode
  useEffect(() => {
    if (!hasUserStartedSession) return;
    if (showReadyOverlay) return;
    if (isGuidedMode && micPermission !== 'granted') {
      console.log('🧘 Guided Mode: Requesting mic permission on entry...');
      requestMicPermission().then(granted => {
        if (granted) {
          console.log('🧘 Guided Mode: Mic permission granted');
          // Auto-enable mic for guided mode
          if (!isMicEnabled) {
            setIsMicEnabled(true);
            localStorage.setItem('v9_mic_enabled', 'true');
          }
        } else {
          console.warn('🧘 Guided Mode: Mic permission denied - PTT will not work');
        }
      });
    }
  }, [hasUserStartedSession, showReadyOverlay, isGuidedMode, micPermission, isMicEnabled, requestMicPermission]);

  // Listen for interaction mode changes from settings and handle mobile resize
  useEffect(() => {
    const handleModeChange = (e: Event) => {
      const customEvent = e as CustomEvent<InteractionMode>;
      setInteractionMode(customEvent.detail);
      console.log('Interaction mode changed to:', customEvent.detail);
      
      // Apply mode-specific settings
      if (customEvent.detail === 'orb_ptt') {
        // Orb mode: enable both mic and speaker by default, activate guided mode
        setIsGuidedMode(true);
        setIsMicEnabled(true);
        setIsSpeakerEnabled(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('v9_mic_enabled', 'true');
          localStorage.setItem('v9_speaker_enabled', 'true');
          localStorage.setItem('v9_guided_mode', 'true');
        }
      } else if (customEvent.detail === 'listen_only') {
        // Listen-only: speaker on, mic off, no guided mode
        setIsGuidedMode(false);
        setIsMicEnabled(false);
        setIsSpeakerEnabled(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('v9_mic_enabled', 'false');
          localStorage.setItem('v9_speaker_enabled', 'true');
          localStorage.setItem('v9_guided_mode', 'false');
        }
      } else if (customEvent.detail === 'text_first') {
        // Text-first: no guided mode, user controls mic/speaker
        setIsGuidedMode(false);
        if (typeof window !== 'undefined') {
          localStorage.setItem('v9_guided_mode', 'false');
        }
      }
    };

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener(V9_EVENTS.INTERACTION_MODE_CHANGED, handleModeChange);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener(V9_EVENTS.INTERACTION_MODE_CHANGED, handleModeChange);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobile]);

  // Initialize orb mode for mobile on first load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const shouldInitOrb = interactionMode === 'orb_ptt';
    const isListenOnly = interactionMode === 'listen_only';
    const isTextFirst = interactionMode === 'text_first';
    
    if (shouldInitOrb && !isGuidedMode) {
      // Activate guided mode for orb on mobile
      setIsGuidedMode(true);
      localStorage.setItem('v9_guided_mode', 'true');
      
      // Enable controls now, but defer permission prompt until Start Session tap.
      setIsMicEnabled(true);
      setIsSpeakerEnabled(true);
      localStorage.setItem('v9_mic_enabled', 'true');
      localStorage.setItem('v9_speaker_enabled', 'true');
    } else if (isListenOnly) {
      // Listen-only: speaker on, mic off, no guided mode
      setIsGuidedMode(false);
      setIsMicEnabled(false);
      setIsSpeakerEnabled(true);
      localStorage.setItem('v9_mic_enabled', 'false');
      localStorage.setItem('v9_speaker_enabled', 'true');
      localStorage.setItem('v9_guided_mode', 'false');
    } else if (isTextFirst) {
      // Text-first: no guided mode, user controls mic/speaker
      setIsGuidedMode(false);
      localStorage.setItem('v9_guided_mode', 'false');
    }
  }, []); // Only run once on mount

  // V4: Enhanced performance metrics state
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    cacheHitRate: 0,
    averageResponseTime: 0,
    preloadedResponsesUsed: 0,
    totalResponses: 0,
    validationAccuracy: 0,
    stateTransitionTime: 0,
    memoryUsage: 0
  });
  const [lastResponseTime, setLastResponseTime] = useState<number>(0);
  const [stepHistory, setStepHistory] = useState<StepHistoryEntry[]>([]);
  const [voiceError, setVoiceError] = useState<string>('');
  const [speechFallbackPrompt, setSpeechFallbackPrompt] = useState<SpeechFallbackPromptState>(null);
  // US-015: text-mode fallback state machine.
  const [textModeFallbackState, setTextModeFallbackState] = useState<TextModeFallbackState>(null);
  const textModeErrorTimestampsRef = useRef<number[]>([]);
  const textModeRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedWorkType, setSelectedWorkType] = useState<string | null>(null);
  const [clickedButton, setClickedButton] = useState<string | null>(null);
  const [sessionMethod, setSessionMethod] = useState<string>('mind_shifting');
  const [showEmotionConfirmation, setShowEmotionConfirmation] = useState<boolean>(false);

  // V4: Button visibility state - managed by useEffect for race condition safety
  const [showWorkTypeButtons, setShowWorkTypeButtons] = useState<boolean>(false);

  // R9 (V9-only): pinned STT/TTS voice pair for this session. Backend
  // returns it on `action: 'start'` inside `data.voicePair = { stt, tts }`.
  // Only surfaced in the admin debug drawer; never touches user-facing UI.
  const [voicePair, setVoicePair] = useState<{ stt: string; tts: string } | null>(null);
  const [sessionTtsEstimate, setSessionTtsEstimate] = useState<SessionTtsEstimate>({
    provider: null,
    fetches: 0,
    cachedFetches: 0,
    characters: 0,
    estimatedUsd: 0,
  });

  useEffect(() => {
    setSessionTtsEstimate({
      provider: null,
      fetches: 0,
      cachedFetches: 0,
      characters: 0,
      estimatedUsd: 0,
    });
  }, [sessionId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // V4: Enhanced voice integration (Accessibility)
  const voice = useGlobalVoice({
    onError: (error: string) => {
      console.error('V9 Voice error:', error);
      setVoiceError(error);
    },
    currentStep: currentStep
  });

  // V4: Track expected response type for auto-advance
  const [expectedResponseType, setExpectedResponseType] = useState<string | null>(null);

  // Ref to track the expected response type of the current step (keep for ref access if needed)
  const currentStepTypeRef = useRef<string | null>(null);

  // Stable ref for sendMessage so callbacks like handleAudioEnded always see the latest version
  const sendMessageRef = useRef<(content: string, isAutoAdvance?: boolean) => Promise<void>>(async () => {});
  const isLoadingRef = useRef(isLoading);

  // Transcript accumulation: Whisper sends audio in ~1.5s chunks, each independently
  // transcribed. Without accumulation, only the first chunk triggers sendMessage and
  // subsequent chunks overwrite each other in pendingTranscriptRef, silently losing
  // the middle of longer utterances.
  const pendingTranscriptRef = useRef<string | null>(null);
  const transcriptAccumulatorRef = useRef<string>('');
  const transcriptFlushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const TRANSCRIPT_FLUSH_DELAY_MS = 2000;
  const isPTTActiveRef = useRef(false);
  const lastSpeechMessageRef = useRef<string | null>(null);

  /** Whisper domain bias: expectedResponseType, step id, and recent user wording for hotwords. */
  const transcriptionContextRef = useRef<TranscriptionDomainContext | null>(null);

  // Handle audio ended event for auto-advance steps
  const handleAudioEnded = useCallback(() => {
    resetSubtitles();
    console.log('🔊 Audio ended. Step type:', currentStepTypeRef.current);
    if (currentStepTypeRef.current === 'auto') {
      // Don't auto-advance while the user is actively holding the PTT button
      if (isPTTActiveRef.current) {
        console.log('⏩ Auto-advance deferred — PTT is active');
        return;
      }
      console.log('⏩ Auto-advancing step (Audio Ended)...');
      setTimeout(() => {
        if (isPTTActiveRef.current) {
          console.log('⏩ Auto-advance cancelled — PTT became active');
          return;
        }
        sendMessageRef.current('', true);
      }, 800);
    }
  }, [resetSubtitles]);

  // Auto-advance logic for Voice Off mode
  useEffect(() => {
    // Only run if we have an auto step and speaker is disabled
    // (If speaker is enabled, handleAudioEnded takes care of it)
    if (expectedResponseType === 'auto' && !isSpeakerEnabled) {
      console.log('⏩ Auto-advance timer started (Voice Off)...');

      // Calculate delay based on last message length
      const lastMessage = messages[messages.length - 1];
      // Default to 3 seconds if no message, otherwise 200ms per word (min 2s, max 10s)
      const wordCount = lastMessage?.content?.split(' ').length || 0;
      const readingDelay = Math.min(Math.max(2000, wordCount * 250), 10000);

      console.log(`⏱️ Waiting ${readingDelay}ms before auto-advancing`);

      const timer = setTimeout(() => {
        console.log('⏩ Auto-advancing step (Timer)...');
        sendMessage('', true);
      }, readingDelay);

      return () => clearTimeout(timer);
    }
  }, [expectedResponseType, isSpeakerEnabled, messages]);

  // Keep subtitles in sync with audio controls.
  useEffect(() => {
    if (!isSpeakerEnabled) {
      resetSubtitles();
    }
  }, [isSpeakerEnabled, resetSubtitles]);

  // State for pending message that's waiting for audio-then-text timing
  const [pendingMessage, setPendingMessage] = useState<{
    content: string;
    responseTime?: number;
    usedAI?: boolean;
    metadata?: any;
  } | null>(null);
  const pendingMessageRef = useRef<typeof pendingMessage>(null);
  const pendingMessageTimingRef = useRef<{
    audioStartTime?: number;
    textRenderTime?: number;
  }>({});

  useEffect(() => {
    pendingMessageRef.current = pendingMessage;
  }, [pendingMessage]);

  const clearTranscriptBuffers = useCallback(() => {
    transcriptAccumulatorRef.current = '';
    pendingTranscriptRef.current = null;
    if (transcriptFlushTimerRef.current) {
      clearTimeout(transcriptFlushTimerRef.current);
      transcriptFlushTimerRef.current = null;
    }
  }, []);

  const isInternalTranscriptLeak = useCallback((transcript: string): boolean => {
    const rawNormalized = transcript.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalized = rawNormalized.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    if (!normalized) return false;

    if (/\b[a-z]+(?:_[a-z0-9]+)+\b/.test(rawNormalized)) {
      return true;
    }

    const methodLabels = new Set([
      'problem shifting',
      'identity shifting',
      'belief shifting',
      'blockage shifting',
    ]);

    if (methodLabels.has(normalized)) {
      return currentStep !== 'choose_method' && currentStep !== 'digging_method_selection';
    }

    return normalized === 'solution state' || normalized === 'feel solution state';
  }, [currentStep]);

  const normalizeVoiceCommandText = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const isWorkTypeSelectionStep = () =>
    currentStep === 'mind_shifting_explanation' ||
    currentStep === 'mind_shifting_explanation_dynamic' ||
    currentStep === 'mind_shifting_explanation_static';

  const normalizeV9SpokenCommand = (rawContent: string): {
    backendContent: string;
    displayContent: string;
  } => {
    const normalized = normalizeVoiceCommandText(rawContent);

    if (isWorkTypeSelectionStep()) {
      if (normalized === '1' || normalized.includes('problem')) {
        return { backendContent: '1', displayContent: 'PROBLEM' };
      }
      if (normalized === '2' || normalized.includes('goal')) {
        return { backendContent: '2', displayContent: 'GOAL' };
      }
      if (
        normalized === '3' ||
        normalized.includes('negative experience') ||
        normalized.includes('negative')
      ) {
        return { backendContent: '3', displayContent: 'NEGATIVE EXPERIENCE' };
      }
    }

    if (currentStep === 'choose_method' || currentStep === 'digging_method_selection') {
      if (normalized === '1' || normalized.includes('problem')) {
        return { backendContent: '1', displayContent: 'Problem Shifting' };
      }
      if (normalized === '2' || normalized.includes('identity')) {
        return { backendContent: '2', displayContent: 'Identity Shifting' };
      }
      if (normalized === '3' || normalized.includes('belief')) {
        return { backendContent: '3', displayContent: 'Belief Shifting' };
      }
      if (normalized === '4' || normalized.includes('blockage')) {
        return { backendContent: '4', displayContent: 'Blockage Shifting' };
      }
    }

    return { backendContent: rawContent, displayContent: rawContent };
  };

  useEffect(() => {
    transcriptionContextRef.current = {
      expectedResponseType: null,
      currentStep: null,
      hotwords: null,
    };
  }, []);

  const revealPendingMessageWithoutAudio = useCallback(() => {
    const pending = pendingMessageRef.current;
    if (!pending) return;

    const fallbackMessage: TreatmentMessage = {
      id: (Date.now() + 1).toString(),
      content: pending.content,
      isUser: false,
      timestamp: new Date(),
      responseTime: pending.responseTime,
      usedAI: pending.usedAI,
      metadata: pending.metadata,
      version: 'v9',
    };

    setMessages(prev => [...prev, fallbackMessage]);
    pendingMessageRef.current = null;
    setPendingMessage(null);
    setIsFirstSpeechLoading(false);
  }, []);

  // Handler for when audio starts and text should be rendered (with 150ms delay)
  const handleRenderText = useCallback((timing: { audioStartTime: number; textRenderTime: number }) => {
    console.log(`⏱️ V9: Audio started at ${timing.audioStartTime.toFixed(2)}ms, rendering text at ${timing.textRenderTime.toFixed(2)}ms`);
    if (!hasFirstSpeechStarted) {
      setHasFirstSpeechStarted(true);
    }
    setIsFirstSpeechLoading(false);
    
    if (pendingMessage) {
      // Now actually add the message to the UI with timing data
      const timedMessage: TreatmentMessage = {
        id: (Date.now() + 1).toString(),
        content: pendingMessage.content,
        isUser: false,
        timestamp: new Date(),
        responseTime: pendingMessage.responseTime,
        usedAI: pendingMessage.usedAI,
        metadata: pendingMessage.metadata,
        version: 'v9',
        audioStartTime: timing.audioStartTime,
        textRenderTime: timing.textRenderTime,
      };
      
      setMessages(prev => [...prev, timedMessage]);
      pendingMessageRef.current = null;
      setPendingMessage(null); // Clear pending message
    }
    
    // Start sentence-by-sentence subtitle progression slightly after audio starts.
    if (subtitleReadyRef.current && !subtitleStartedRef.current) {
      subtitleStartedRef.current = true;
      startSubtitleSequence(subtitleSpeechTextRef.current);
    }
  }, [hasFirstSpeechStarted, pendingMessage, startSubtitleSequence]);

  // Handle test audio interruption via VAD (defined before naturalVoice hook)
  const handleTestInterruption = useCallback(() => {
    if (isTestPlaying) {
      console.log('🧪 Test audio interrupted by VAD!');
      setTestInterrupted(true);
      
      // Show feedback briefly then reset
      setTimeout(() => {
        setTestInterrupted(false);
      }, 2000);
    }
  }, [isTestPlaying]);

  // US-015: when text-mode is prompting/active, speech I/O is suppressed. The old
  // `speechFallbackPrompt` state is kept as a no-op fall-back for external callers that may
  // still set it, but the v7 path no longer sets it on OpenAI errors.
  const isSpeechFallbackPaused =
    speechFallbackPrompt !== null
    || textModeFallbackState === 'prompt'
    || textModeFallbackState === 'active'
    || textModeFallbackState === 'retrying';

  // Natural Voice Hook - Updated to use separate mic/speaker controls
  const activeTtsProvider: V9TtsProvider =
    voicePair?.tts === 'elevenlabs' || voicePair?.tts === 'kokoro' || voicePair?.tts === 'openai'
      ? voicePair.tts
      : 'openai';
  const activeSttProvider =
    voicePair?.stt === 'whisper-local' || voicePair?.stt === 'openai' || voicePair?.stt === 'elevenlabs'
      ? voicePair.stt
      : null;
  const sttProviderOverride: 'existing' | 'openai' | 'elevenlabs' | undefined =
    activeSttProvider === 'openai'
      ? 'openai'
      : activeSttProvider === 'whisper-local'
        ? 'existing'
        : activeSttProvider === 'elevenlabs'
          ? 'elevenlabs'
          : undefined;
  const runtimeStaticAudioVoice =
    activeTtsProvider === 'kokoro'
      ? getVoiceCacheName(getKokoroVoiceId())
      : activeTtsProvider === 'openai'
        ? getVoiceCacheName(selectedVoice)
        : null;
  const handleTtsUsage = useCallback((usage: {
    provider: V9TtsProvider;
    characters: number;
    estimatedUsd: number;
    cached: boolean;
  }) => {
    setSessionTtsEstimate((prev) => ({
      provider: usage.provider,
      fetches: prev.fetches + 1,
      cachedFetches: prev.cachedFetches + (usage.cached ? 1 : 0),
      characters: prev.characters + (usage.cached ? 0 : usage.characters),
      estimatedUsd: prev.estimatedUsd + usage.estimatedUsd,
    }));
  }, []);

  const naturalVoice = useNaturalVoice({
    enabled: isNaturalVoiceEnabled, // DEPRECATED: backward compatibility
    micEnabled: isMicEnabled && !isSpeechFallbackPaused, // NEW: Controls microphone input
    speakerEnabled: isSpeakerEnabled && !isSpeechFallbackPaused, // NEW: Controls audio output
    guidedMode: isGuidedMode, // NEW: Guided mode disables auto-restart for PTT
    testMode: isTestPlaying, // NEW: Test mode prevents VAD from triggering speech recognition
    onTranscript: (transcript) => {
      console.log('🗣️ Natural Voice Transcript:', transcript);
      if (isInternalTranscriptLeak(transcript)) {
        console.warn('🗣️ V9: Dropping internal transcript leak:', transcript);
        clearTranscriptBuffers();
        return;
      }

      const command = normalizeV9SpokenCommand(transcript.trim());
      const isMenuCommand =
        command.backendContent !== transcript.trim() ||
        command.displayContent !== transcript.trim();
      if (isMenuCommand) {
        console.log('🗣️ V9: Immediate spoken menu command:', {
          transcript,
          backendContent: command.backendContent,
          displayContent: command.displayContent,
        });
        clearTranscriptBuffers();
        if (!isLoadingRef.current) {
          sendMessageRef.current(transcript);
        } else {
          pendingTranscriptRef.current = transcript;
        }
        return;
      }

      transcriptAccumulatorRef.current = transcriptAccumulatorRef.current
        ? transcriptAccumulatorRef.current + ' ' + transcript
        : transcript;

      if (transcriptFlushTimerRef.current) {
        clearTimeout(transcriptFlushTimerRef.current);
      }

      transcriptFlushTimerRef.current = setTimeout(() => {
        transcriptFlushTimerRef.current = null;
        const accumulated = transcriptAccumulatorRef.current.trim();
        transcriptAccumulatorRef.current = '';
        if (!accumulated) return;
        if (isInternalTranscriptLeak(accumulated)) {
          console.warn('🗣️ V9: Dropping accumulated internal transcript leak:', accumulated);
          return;
        }

        console.log('🗣️ Flushing accumulated transcript:', accumulated);
        if (!isLoadingRef.current) {
          sendMessageRef.current(accumulated);
        } else {
          pendingTranscriptRef.current = pendingTranscriptRef.current
            ? pendingTranscriptRef.current + ' ' + accumulated
            : accumulated;
        }
      }, TRANSCRIPT_FLUSH_DELAY_MS);
    },
    kokoroVoiceId: getKokoroVoiceId(),
    // US-007: Pass an explicit voiceProvider + voiceId for v7 so the OpenAI path uses the
    // selected voice (shimmer/alloy/etc.) instead of falling through the Kokoro map.
    voiceProvider: activeTtsProvider,
    voiceId: selectedVoice,
    onAudioEnded: handleAudioEnded,
    playbackRate: playbackSpeed,
    onRenderText: handleRenderText, // NEW: Callback for text rendering timing
    vadSensitivity: vadSensitivity, // VAD sensitivity setting
    onVadLevel: (level) => setVadLevel(level), // Update VAD level for meter
    onTestInterruption: handleTestInterruption, // NEW: Handle test mode interruptions
    transcriptionContextRef,
    treatmentVersion: 'v9',
    sttProviderOverride,
    onTtsUsage: handleTtsUsage,
    onSpeechProviderError: ({ kind, provider, message }) => {
      if (kind === 'tts') {
        revealPendingMessageWithoutAudio();
      }

      if (provider !== 'openai') {
        console.error(`V9 ${kind.toUpperCase()} speech provider error (${provider}):`, message);
        setVoiceError(message);
        return;
      }

      console.error(`V7 ${kind.toUpperCase()} speech service error:`, message);
      setVoiceError(message);

      // US-016: the v7 fallback is text mode, not a provider switch. First hit → silent
      // auto-retry; second hit within 10s OR retry failure → 'prompt' dialog.
      const now = Date.now();
      const timestamps = textModeErrorTimestampsRef.current.filter((t) => now - t < 10_000);
      timestamps.push(now);
      textModeErrorTimestampsRef.current = timestamps;

      if (timestamps.length >= 2) {
        setTextModeFallbackState('prompt');
        return;
      }

      // Single-error auto-retry path — give the provider one chance to recover.
      setTextModeFallbackState('retrying');
      if (textModeRetryTimerRef.current) clearTimeout(textModeRetryTimerRef.current);
      textModeRetryTimerRef.current = setTimeout(() => {
        // If no second error came in, assume recovery.
        setTextModeFallbackState((current) => (current === 'retrying' ? null : current));
      }, 15_000);

      if (kind === 'tts' && lastSpeechMessageRef.current && isSpeakerEnabled) {
        // Retry the failed playback once after a short delay.
        setTimeout(() => {
          if (lastSpeechMessageRef.current) {
            speakServerMessage(lastSpeechMessageRef.current);
          }
        }, 400);
      }
    },
  });

  function speakServerMessage(message: string) {
    if (!message) return;
    clearTranscriptBuffers();
    lastSpeechMessageRef.current = message;
    // US-015: when text mode is active, TTS is suppressed entirely. Subtitles still render
    // so the user can read the scripted prompt.
    if (textModeFallbackState === 'active') {
      prepareSubtitlesForSpeech(message);
      return;
    }
    prepareSubtitlesForSpeech(message);
    naturalVoice.speak(message, { apiMessage: message });
  }

  // DEPRECATED (US-016). The v7 fallback is text mode; these handlers are retained as no-ops
  // so any legacy references don't crash, but they clear the prompt instead of switching
  // providers.
  const handleSpeechFallbackConfirm = useCallback(() => {
    setSpeechFallbackPrompt(null);
    setVoiceError('');
  }, []);

  const handleSpeechFallbackDecline = useCallback(() => {
    setSpeechFallbackPrompt(null);
  }, []);

  // US-015: text-mode handlers. "Continue in text" pins the session to text input;
  // "Try again" attempts one silent reconnect.
  const handleTextModeContinue = useCallback(() => {
    setTextModeFallbackState('active');
    setVoiceError('');
    textModeErrorTimestampsRef.current = [];
    if (textModeRetryTimerRef.current) {
      clearTimeout(textModeRetryTimerRef.current);
      textModeRetryTimerRef.current = null;
    }
  }, []);

  const handleTextModeRetry = useCallback(() => {
    setTextModeFallbackState('retrying');
    textModeErrorTimestampsRef.current = [];
    if (textModeRetryTimerRef.current) clearTimeout(textModeRetryTimerRef.current);
    textModeRetryTimerRef.current = setTimeout(() => {
      setTextModeFallbackState((current) => (current === 'retrying' ? null : current));
    }, 15_000);
    // Retry playback if we have a pending message.
    if (lastSpeechMessageRef.current && isSpeakerEnabled) {
      setTimeout(() => {
        if (lastSpeechMessageRef.current) {
          speakServerMessage(lastSpeechMessageRef.current);
        }
      }, 250);
    }
  }, [isSpeakerEnabled, speakServerMessage]);

  useEffect(() => {
    if (!isFirstSpeechLoading) return;
    const timeout = setTimeout(() => {
      setIsFirstSpeechLoading(false);
    }, 12000);
    return () => clearTimeout(timeout);
  }, [isFirstSpeechLoading]);

  // V4: Keep focus on input for voice input to work properly
  // This ensures the user can always speak and have their input registered
  useEffect(() => {
    // Only refocus when loading completes and session is active
    if (!isLoading && isSessionActive) {
      // Small delay to let button animations complete
      const focusTimer = setTimeout(() => {
        // Don't steal focus if user is actively typing somewhere else
        const activeElement = document.activeElement;
        const isTypingElsewhere = activeElement?.tagName === 'INPUT' || 
                                   activeElement?.tagName === 'TEXTAREA';
        
        // Focus the input if not already focused on an input
        if (!isTypingElsewhere || activeElement === inputRef.current) {
          inputRef.current?.focus();
        }
      }, 200);
      
      return () => clearTimeout(focusTimer);
    }
  }, [isLoading, isSessionActive]);

  // Cleanup: Stop audio and flush timers when navigating away
  useEffect(() => {
    return () => {
      console.log('🧹 TreatmentSession: Cleaning up - stopping audio');
      naturalVoice.stopSpeaking();
      clearSubtitleTimers();
      if (transcriptFlushTimerRef.current) {
        clearTimeout(transcriptFlushTimerRef.current);
        transcriptFlushTimerRef.current = null;
      }
    };
  }, []); // Cleanup on unmount only

  // Helper function to format method names
  const formatMethodName = (methodName: string) => {
    if (!methodName) return 'Mind Shifting V7';

    // Convert snake_case to Title Case
    return methodName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + ' V7';
  };

  // Handle pause/resume button click
  const handlePauseResume = useCallback(() => {
    if (naturalVoice.isPaused) {
      console.log('▶️ Resuming audio from pause button');
      naturalVoice.resumeSpeaking();
    } else if (naturalVoice.isSpeaking) {
      console.log('⏸️ Pausing audio from pause button');
      naturalVoice.pauseSpeaking();
    } else {
      console.log('⚠️ Cannot pause/resume - no audio active');
    }
  }, [naturalVoice]);

  // Temporary testing helper: approximate a hard refresh in-app on mobile.
  const handleHardRefresh = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(cacheKey => caches.delete(cacheKey)));
      }

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.update()));
      }
    } catch (error) {
      console.warn('⚠️ Hard refresh cleanup failed:', error);
    } finally {
      window.location.reload();
    }
  }, []);

  // Test Audio Controls (for settings modal demo)
  const startTestAudio = useCallback(() => {
    if (!isSpeakerEnabled) return;
    
    console.log('🧪 Starting test audio loop');
    setIsTestPlaying(true);
    isTestPlayingRef.current = true;
    setTestInterrupted(false);
    
    // Function to play and auto-loop
    const playLoop = () => {
      if (!isTestPlayingRef.current) return;
      
      console.log('🧪 Playing test audio sample');
      naturalVoice.speak(TEST_AUDIO_SAMPLE);
      
      // Schedule next loop
      // Using setInterval would be cleaner but timeout works for variable durations
      testAudioTimeoutRef.current = setTimeout(() => {
        if (isTestPlayingRef.current) {
          console.log('🧪 Looping test audio');
          playLoop(); // Recursive loop
        }
      }, 25000); // ~25 seconds for long phrase at normal speed (adjust based on playbackSpeed)
    };
    
    playLoop(); // Start first iteration
  }, [isSpeakerEnabled, naturalVoice, TEST_AUDIO_SAMPLE]);

  const stopTestAudio = useCallback(() => {
    console.log('🧪 Stopping test audio');
    setIsTestPlaying(false);
    isTestPlayingRef.current = false;
    setTestInterrupted(false);
    
    // Clear timeout
    if (testAudioTimeoutRef.current) {
      clearTimeout(testAudioTimeoutRef.current);
      testAudioTimeoutRef.current = null;
    }
    
    // Stop any playing audio
    naturalVoice.stopSpeaking();
    resetSubtitles();
  }, [naturalVoice, resetSubtitles]);

  // Pause session audio when settings open, auto-start test when settings open
  useEffect(() => {
    if (showVoiceSettings) {
      // Pause any ongoing session audio
      if (naturalVoice.isSpeaking) {
        console.log('⚙️ Settings opened - pausing session audio');
        naturalVoice.pauseSpeaking();
      }
      
      // Auto-start removed: users can manually trigger test audio via the Play Test button
    } else {
      // Settings closed - cancel any pending auto-start and stop test audio
      if (testAutoStartTimeoutRef.current) {
        clearTimeout(testAutoStartTimeoutRef.current);
        testAutoStartTimeoutRef.current = null;
        console.log('⚙️ Settings closed - cancelled pending test audio auto-start');
      }
      
      if (isTestPlaying) {
        stopTestAudio();
      }
      
      if (naturalVoice.isPaused) {
        console.log('⚙️ Settings closed - resuming session audio');
        naturalVoice.resumeSpeaking();
      }
    }
  }, [showVoiceSettings, isSpeakerEnabled]); // Don't include isTestPlaying to avoid loops

  useEffect(() => {
    return () => {
      if (testAudioTimeoutRef.current) {
        clearTimeout(testAudioTimeoutRef.current);
      }
      if (testAutoStartTimeoutRef.current) {
        clearTimeout(testAutoStartTimeoutRef.current);
      }
    };
  }, []);

  // PTT (Push-to-Talk) handlers for Guided Mode
  const handlePTTStart = useCallback(() => {
    if (!isGuidedMode) return;
    
    console.log('🎙️ PTT: Starting recording');
    clearTranscriptBuffers();
    
    // FIX #1: Check mic permission first
    if (micPermission !== 'granted') {
      console.warn('🎙️ PTT: Mic permission not granted, requesting...');
      requestMicPermission().then(granted => {
        if (granted) {
          console.log('🎙️ PTT: Permission granted, retrying start');
          handlePTTStart(); // Retry after permission granted
        } else {
          console.error('🎙️ PTT: Permission denied by user');
        }
      });
      return;
    }
    
    // iOS: Re-activate audio session on this user gesture so the next AI audio
    // play (which happens asynchronously after the API call) doesn't go silent.
    try {
      const warmup = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
      warmup.volume = 0;
      warmup.play().catch(() => {});
    } catch (_e) { /* env without Audio */ }

    // Stop any playing audio immediately
    if (naturalVoice.isSpeaking || naturalVoice.isPaused) {
      naturalVoice.stopSpeaking();
      resetSubtitles();
    }

    if (naturalVoice.isUsingScribeRealtime) {
      // Scribe realtime PTT: resume audio streaming to the WebSocket.
      console.log('🎙️ PTT (Scribe): Resuming audio capture');
      naturalVoice.scribeResumeCapture?.();
    } else {
      // Standard Whisper/WebSpeech PTT path.
      // FIX #3: Clear audio state flags to prevent false positives
      console.log('🎙️ PTT: Clearing audio state flags');
      naturalVoice.clearAudioFlags();
      
      // Force-restart to guarantee a clean recognition session.
      console.log('🎙️ PTT: Force starting listening (clean session)');
      naturalVoice.forceRestartListening();
    }
    
    setIsPTTActive(true);
    isPTTActiveRef.current = true;
  }, [isGuidedMode, naturalVoice, micPermission, requestMicPermission, resetSubtitles, clearTranscriptBuffers]);

  const handlePTTEnd = useCallback(() => {
    if (!isGuidedMode) return;
    
    console.log('🎙️ PTT: Ending recording');

    if (naturalVoice.isUsingScribeRealtime) {
      // Scribe PTT: commit the buffered audio and pause streaming.
      console.log('🎙️ PTT (Scribe): Committing and pausing capture');
      naturalVoice.scribeCommitNow?.();
      naturalVoice.scribePauseCapture?.();
    } else {
      // Standard Whisper/WebSpeech PTT path.
      // Stop user's mic
      naturalVoice.stopListening();

      // Immediately flush Whisper buffer so short utterances aren't left waiting
      // for the next auto-process timer tick (up to 1.5s away).
      naturalVoice.processNow?.();
    }

    // Flush any already-accumulated transcript immediately on PTT release
    // instead of waiting for the debounce timer. The final Whisper chunk
    // (from processNow above) will arrive async and be handled normally.
    if (transcriptFlushTimerRef.current) {
      clearTimeout(transcriptFlushTimerRef.current);
      transcriptFlushTimerRef.current = null;
    }
    const accumulated = transcriptAccumulatorRef.current.trim();
    transcriptAccumulatorRef.current = '';
    if (accumulated) {
      console.log('🎙️ PTT: Flushing accumulated transcript on release:', accumulated);
      if (!isLoading) {
        sendMessageRef.current(accumulated);
      } else {
        pendingTranscriptRef.current = pendingTranscriptRef.current
          ? pendingTranscriptRef.current + ' ' + accumulated
          : accumulated;
      }
    }

    setIsPTTActive(false);
    isPTTActiveRef.current = false;
  }, [isGuidedMode, naturalVoice, isLoading]);

  const handlePTTToggle = useCallback(() => {
    if (isPTTActive) {
      handlePTTEnd();
    } else {
      handlePTTStart();
    }
  }, [isPTTActive, handlePTTStart, handlePTTEnd]);

  // Keyboard handlers for desktop guided mode (Space bar PTT + ESC to exit)
  useEffect(() => {
    if (!isGuidedMode) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC key: Exit guided mode (always works, even in input fields)
      if (e.code === 'Escape') {
        e.preventDefault();
        console.log('⌨️ ESC pressed: Exiting guided mode');
        setIsGuidedMode(false);
        localStorage.setItem('v9_guided_mode', 'false');
        if (isPTTActive) {
          handlePTTEnd();
        }
        return;
      }
      
      // Ignore space bar if typing in input field
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Space bar: PTT start (on key press)
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault(); // Don't scroll page
        console.log('⌨️ Space pressed: PTT start', { isPTTActive });
        
        if (!isPTTActive) {
          handlePTTStart();
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // Ignore space bar if typing in input field
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Space bar: PTT end (on key release)
      if (e.code === 'Space') {
        e.preventDefault(); // Don't scroll page
        console.log('⌨️ Space released: PTT end', { isPTTActive });
        
        if (isPTTActive) {
          handlePTTEnd();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isGuidedMode, isPTTActive, handlePTTStart, handlePTTEnd]);

  // Auto-scroll to bottom when NEW messages arrive (not on initial load)
  const prevMessageCount = useRef(0);
  useEffect(() => {
    // Only auto-scroll if this is NOT the first message (initial load)
    // On first load, we want user to see the top of the intro message
    if (messages.length > 1 && messages.length > prevMessageCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCount.current = messages.length;
  }, [messages]);

  // Handler for starting the session (clicking the play button)
  const handleStartSession = async () => {
    setHasUserStartedSession(true);
    if (interactionMode === 'orb_ptt' && micPermission !== 'granted') {
      setIsPreparingStartPermissions(true);
      await requestMicPermission();
      setIsPreparingStartPermissions(false);
    }
    setShowReadyOverlay(false);
    // Start session immediately after hiding overlay
    if (sessionId && userId && !isSessionActive) {
      if (shouldResume) {
        resumeSession();
      } else {
        startSession();
      }
    }
  };

  // Initialize session on component mount - but wait for user to click Start
  // Removed auto-start useEffect - now controlled by play button

  // V9: R7 byte-parity session start. Unlike V7, V9 MUST NEVER
  // substitute `INITIAL_WELCOME` (or any other client-side constant)
  // for the first assistant message. The exact string the V9 backend
  // returns in `data.message` is what gets rendered, character for
  // character. This is what the v2-v9 parity gate (the CI job
  // guarding this port) checks after every change.
  //
  // Consequences vs. V7:
  //   - There is no "0 ms perceived delay" instant-bubble trick; we
  //     wait on the backend round-trip. The preloader primes static
  //     audio for the canonical welcome in parallel, so TTS is still
  //     warm by the time the message arrives.
  //   - If the backend ever returns a welcome that does not match
  //     what the static-audio manifest was generated for, the R13.4
  //     parity assertion fires in `useNaturalVoice.playAudioSegment`
  //     and we simply fall back to runtime TTS. The user still hears
  //     the same text that was rendered.
  //   - R9: the server replies with a pinned `voicePair` (STT + TTS
  //     provider/voice). We cache it on state so the admin drawer
  //     can display it and so future message round-trips show the
  //     same pair if the admin ever flips the backend policy.
  const startSession = async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      console.log('Starting V9 treatment session:', { sessionId, userId });

      const response = await fetch('/api/treatment-v9', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start',
          sessionId,
          userId
        }),
      });

      if (!response.ok) {
        throw new Error(`V9 HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('V9 Start session response:', data);

      if (!data.success) {
        throw new Error(data.error || 'Failed to start V9 session');
      }

      // R9: capture the pinned voice pair from the server's start
      // response. Admins see this in the debug drawer; non-admin
      // sessions simply ignore it.
      if (data.voicePair) {
        setVoicePair(data.voicePair);
      }

      // R7: render exactly what the backend returned — no client-side
      // substitution, trimming, or prefix injection.
      const welcomeText: string = data.message ?? '';
      const welcomeMessage: TreatmentMessage = {
        id: 'system-init',
        content: welcomeText,
        isUser: false,
        timestamp: new Date(),
        responseTime: data.responseTime,
        usedAI: data.usedAI,
        version: 'v9'
      };

      setMessages([welcomeMessage]);
      setCurrentStep(data.currentStep ?? 'mind_shifting_explanation_static');
      setIsSessionActive(true);
      setIsLoading(false);

      if (data.performanceMetrics) {
        setPerformanceMetrics(prev => ({
          ...prev,
          ...data.performanceMetrics,
          validationAccuracy: data.performanceMetrics.validationAccuracy || prev.validationAccuracy,
          stateTransitionTime: data.responseTime || prev.stateTransitionTime,
          memoryUsage: data.performanceMetrics.memoryUsage || prev.memoryUsage
        }));
      }

      setTimeout(() => {
        inputRef.current?.focus();
        if (isSpeakerEnabled && welcomeText) {
          setTimeout(() => {
            beginFirstSpeechLoading();
            // R7: speak the exact server-returned text. The speech
            // compliance guard inside `useNaturalVoice` asserts the
            // string being spoken matches `apiMessage` byte-for-byte.
            speakServerMessage(welcomeText);
          }, 150);
        }
      }, 100);
    } catch (error) {
      console.error('V9 Start session error:', error);
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown V9 error');
      onError?.(error instanceof Error ? error.message : 'Unknown V9 error');
      setIsLoading(false);
    }
  };

  // V3: Enhanced session resume
  const resumeSession = async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      console.log('Resuming V9 treatment session:', { sessionId, userId });

      const response = await fetch('/api/treatment-v9', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'resume',
          sessionId,
          userId
        }),
      });

      if (!response.ok) {
        throw new Error(`V9 HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('V9 Resume session response:', data);

      if (data.success) {
        // Restore conversation history
        const restoredMessages: TreatmentMessage[] = data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          version: 'v9'
        }));

        setMessages(restoredMessages);
        setCurrentStep(data.currentStep);
        setIsSessionActive(true);

        // Restore session metadata
        if (data.session?.metadata) {
          setSelectedWorkType(data.session.metadata.workType || null);
          setSessionMethod(data.session.metadata.selectedMethod || 'mind_shifting');
        }

        // Focus input for continued interaction
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      } else {
        // If resume fails, start a new session
        console.log('V9 Resume failed, starting new session');
        await startSession();
      }
    } catch (error) {
      console.error('V9 Resume session error:', error);
      // Fallback to starting new session
      console.log('V9 Resume failed, falling back to new session');
      await startSession();
    } finally {
      setIsLoading(false);
    }
  };

  // Capture undo state BEFORE adding a new user response.
  // This guarantees undo returns to the last app instruction.
  const createUndoHistoryEntry = (): StepHistoryEntry => ({
    messages: [...messages],
    currentStep,
    userInput: '',
    sessionStats,
    timestamp: Date.now(),
    version: 'v9',
    expectedResponseType,
  });

  // V3: Enhanced message sending
  const sendMessage = async (content: string, isAutoAdvance = false) => {
    if ((!content.trim() && !isAutoAdvance) || isLoading) return;
    clearTranscriptBuffers();
    const trimmedContent = content.trim();
    const normalizedCommand = isAutoAdvance
      ? { backendContent: trimmedContent, displayContent: trimmedContent }
      : normalizeV9SpokenCommand(trimmedContent);

    // Stop current audio if user is advancing to next step (only if speaker was enabled)
    if ((isMicEnabled || isSpeakerEnabled) && naturalVoice.isSpeaking) {
      console.log('🛑 Stopping current audio - user advancing to next step');
      naturalVoice.stopSpeaking();
      resetSubtitles();
    }

    // Save step history BEFORE applying the user's response to UI state
    setStepHistory(prev => [...prev, createUndoHistoryEntry()]);

    const userMessage: TreatmentMessage = {
      id: `user-${Date.now()}`,
      content: normalizedCommand.displayContent,
      isUser: true,
      timestamp: new Date(),
      version: 'v9'
    };

    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);
    setHasError(false);
    setClickedButton(null);

    try {
      console.log('Sending V9 message:', {
        content: normalizedCommand.backendContent,
        displayContent: normalizedCommand.displayContent,
        currentStep,
      });

      const response = await fetch('/api/treatment-v9', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'continue',
          sessionId,
          userId,
          userInput: normalizedCommand.backendContent
        }),
      });

      if (!response.ok) {
        throw new Error(`V9 HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('V9 Continue session response:', data);

      if (data.success) {
        // Always provide audio/visual feedback in PTT guided mode
        // PTT users need to hear confirmation that their input was processed
        if (data.message) {
          // NEW: If speaker is enabled, set up pending message for audio-then-text timing
          if (isSpeakerEnabled) {
            console.log('⏱️ V9: Setting up pending message for audio-first rendering');
            setPendingMessage({
              content: data.message,
              responseTime: data.responseTime,
              usedAI: data.usedAI,
              metadata: { version: 'v9' }
            });
            
            // Start audio playback (will trigger handleRenderText after 150ms)
            beginFirstSpeechLoading();
            speakServerMessage(data.message);
          } else {
            // Speaker disabled: add message immediately (no timing data)
            const systemMessage: TreatmentMessage = {
              id: `system-${Date.now()}`,
              content: data.message,
              isUser: false,
              timestamp: new Date(),
              responseTime: data.responseTime,
              usedAI: data.usedAI,
              version: 'v9'
            };

            setMessages(prev => [...prev, systemMessage]);
          }
        }

        setCurrentStep(data.currentStep);
        setLastResponseTime(data.responseTime || 0);

        // Update step type ref for auto-advance logic
        currentStepTypeRef.current = data.expectedResponseType || null;
        setExpectedResponseType(data.expectedResponseType || null);
        // V3: Update enhanced performance metrics
        if (data.performanceMetrics) {
          setPerformanceMetrics(prev => ({
            ...prev,
            ...data.performanceMetrics,
            validationAccuracy: data.performanceMetrics.validationAccuracy || prev.validationAccuracy,
            stateTransitionTime: data.responseTime || prev.stateTransitionTime,
            memoryUsage: data.performanceMetrics.memoryUsage || prev.memoryUsage
          }));
        }

        // Update session stats
        setSessionStats(prev => ({
          totalResponses: prev.totalResponses + 1,
          avgResponseTime: Math.round((prev.avgResponseTime * prev.totalResponses + (data.responseTime || 0)) / (prev.totalResponses + 1)),
          aiUsagePercent: data.usedAI ? Math.round(((prev.aiUsagePercent * prev.totalResponses) + 100) / (prev.totalResponses + 1)) : Math.round((prev.aiUsagePercent * prev.totalResponses) / (prev.totalResponses + 1)),
          version: 'v9'
        }));

        // Handle special UI states
        if (data.showEmotionConfirmation) {
          setShowEmotionConfirmation(true);
        } else {
          setShowEmotionConfirmation(false);
        }

        // Check for session completion
        if (data.currentStep === 'session_complete') {
          setIsSessionActive(false);
          onComplete?.(data);
        }

      } else {
        throw new Error(data.error || 'Failed to process V9 message');
      }
    } catch (error) {
      console.error('V9 Send message error:', error);
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown V9 error');

      // Add error message to conversation
      const errorMessage: TreatmentMessage = {
        id: `error-${Date.now()}`,
        content: `V9 Error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        isUser: false,
        timestamp: new Date(),
        version: 'v9'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Refocus input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  // Keep refs pointing at the latest values on every render
  sendMessageRef.current = sendMessage;
  isLoadingRef.current = isLoading;

  // Flush any queued transcript once the previous request finishes
  useEffect(() => {
    if (!isLoading && pendingTranscriptRef.current) {
      const queued = pendingTranscriptRef.current;
      pendingTranscriptRef.current = null;
      console.log('📨 Flushing queued transcript:', queued);
      sendMessage(queued);
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // V3: Enhanced undo functionality
  const handleUndo = async () => {
    if (stepHistory.length === 0 || isLoading) return;

    const lastEntry = stepHistory[stepHistory.length - 1];
    setIsLoading(true);

    try {
      console.log('V9 Undo to step:', lastEntry.currentStep);

      const response = await fetch('/api/treatment-v9', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'undo',
          sessionId,
          userId,
          undoToStep: lastEntry.currentStep
        }),
      });

      if (!response.ok) {
        throw new Error(`V9 Undo HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('V9 Undo response:', data);

      if (data.success) {
        // Prevent delayed text/audio from a pending message leaking into restored state
        if (naturalVoice.isSpeaking) {
          naturalVoice.stopSpeaking();
          resetSubtitles();
        }
        setPendingMessage(null);

        // Backward compatibility: trim trailing user messages from old history entries
        // so undo always lands on the most recent app instruction.
        const restoredMessages = [...lastEntry.messages];
        while (restoredMessages.length > 0 && restoredMessages[restoredMessages.length - 1].isUser) {
          restoredMessages.pop();
        }

        // Restore previous state
        setMessages(restoredMessages);
        setCurrentStep(lastEntry.currentStep);
        setSessionStats(lastEntry.sessionStats);
        setUserInput('');

        // Restore expectedResponseType so correct input UI (text vs Yes/No) is shown
        // Without this, stale expectedResponseType from the undone step causes wrong buttons
        setExpectedResponseType(lastEntry.expectedResponseType ?? null);
        currentStepTypeRef.current = lastEntry.expectedResponseType ?? null;

        // Remove the last entry from history
        setStepHistory(prev => prev.slice(0, -1));

        // Re-speak the restored last AI message so voice stays in sync with text
        if (isSpeakerEnabled) {
          const lastAiMessage = [...restoredMessages].reverse().find(m => !m.isUser);
          if (lastAiMessage?.content) {
            speakServerMessage(lastAiMessage.content);
          }
        }

        console.log('V9 Undo successful');
      } else {
        throw new Error(data.error || 'V9 Undo failed');
      }
    } catch (error) {
      console.error('V9 Undo error:', error);
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : 'V9 Undo failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userInput.trim() && !isLoading) {
      sendMessage(userInput.trim());
    }
  };

  // Handle button clicks for emotion confirmation
  const handleButtonClick = (buttonText: string) => {
    clearTranscriptBuffers();
    // Stop current audio if user is advancing to next step
    if ((isMicEnabled || isSpeakerEnabled) && naturalVoice.isSpeaking) {
      console.log('🛑 Stopping current audio - user clicked button');
      naturalVoice.stopSpeaking();
      resetSubtitles();
    }
    setClickedButton(buttonText);
    sendMessage(buttonText);
  };

  // V3: RACE CONDITION FIX - Use useEffect to compute button visibility after all state updates complete
  // This ensures we see consistent state, not partial updates during rapid re-renders
  useEffect(() => {
    // Check if we're in the initial explanation step
    const isInitialStep =
      currentStep === 'mind_shifting_explanation' ||
      currentStep === 'mind_shifting_explanation_dynamic' ||
      currentStep === 'mind_shifting_explanation_static';

    console.log('🔍 BUTTON CHECK (useEffect):', {
      currentStep,
      isInitialStep,
      isLoading,
      isSessionActive,
      messagesCount: messages.length,
      userMessagesCount: messages.filter(m => m.isUser).length
    });

    if (!isInitialStep) {
      console.log('❌ Not initial step');
      setShowWorkTypeButtons(false);
      return;
    }

    // Don't show if we're loading or session isn't active
    if (isLoading || !isSessionActive) {
      console.log('❌ Loading or session inactive:', { isLoading, isSessionActive });
      setShowWorkTypeButtons(false);
      return;
    }

    // Check the last bot message to see if it contains the work type options
    const lastBotMessage = messages.filter(m => !m.isUser).pop();
    if (!lastBotMessage) {
      console.log('❌ No bot message found');
      setShowWorkTypeButtons(false);
      return;
    }

    console.log('📝 Last bot message:', lastBotMessage.content.substring(0, 100) + '...');

    // Show buttons if the message contains the work type selection text
    const containsWorkTypeSelection = lastBotMessage.content.includes('1. PROBLEM') &&
      lastBotMessage.content.includes('2. GOAL') &&
      lastBotMessage.content.includes('3. NEGATIVE EXPERIENCE');

    console.log('✅ Contains work type text:', containsWorkTypeSelection);

    // Don't show if AI is asking clarifying questions
    if (lastBotMessage.usedAI) {
      console.log('❌ Message used AI');
      setShowWorkTypeButtons(false);
      return;
    }

    // Don't show if user has already made multiple inputs (likely past selection)
    const userMessages = messages.filter(m => m.isUser);
    if (userMessages.length >= 2) {
      console.log('❌ Too many user messages:', userMessages.length);
      setShowWorkTypeButtons(false);
      return;
    }

    console.log('✅ SETTING BUTTONS TO SHOW:', containsWorkTypeSelection);
    setShowWorkTypeButtons(containsWorkTypeSelection);
  }, [currentStep, isLoading, isSessionActive, messages]); // Run after these change

  // V3: Handle work type selection button clicks
  const handleWorkTypeSelection = (workType: string) => {
    clearTranscriptBuffers();
    // Stop current audio if user is advancing to next step
    if ((isMicEnabled || isSpeakerEnabled) && naturalVoice.isSpeaking) {
      console.log('🛑 Stopping current audio - user selected work type');
      naturalVoice.stopSpeaking();
      resetSubtitles();
    }
    
    setClickedButton(workType);

    // Save step history BEFORE applying the user's response to UI state
    setStepHistory(prev => [...prev, createUndoHistoryEntry()]);

    // Display the full work type name in the UI
    const workTypeMap: { [key: string]: string } = {
      '1': 'PROBLEM',
      '2': 'GOAL',
      '3': 'NEGATIVE EXPERIENCE'
    };

    const displayText = workTypeMap[workType] || workType;

    // Create user message with display text
    const userMessage: TreatmentMessage = {
      id: `user-${Date.now()}`,
      content: displayText,
      isUser: true,
      timestamp: new Date(),
      version: 'v9'
    };
    setMessages(prev => [...prev, userMessage]);
    setClickedButton(null);
    setUserInput('');
    setIsLoading(true);
    setHasError(false);

    // Continue with backend call using the number
    fetch('/api/treatment-v9', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'continue',
        sessionId,
        userId,
        userInput: workType
      }),
    })
      .then(async response => {
        console.log('Work type selection response status:', response.status);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Work type selection HTTP error:', response.status, errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Work type selection response data:', data);
        
        // Check if response indicates an error
        if (data.error || !data.success) {
          console.error('Work type selection failed:', data.error || 'Unknown error', data.details);
          throw new Error(data.error || data.details || 'Failed to process work type selection');
        }
        
        if (data.success) {
          // Skip "Choose a method:" message if buttons will be shown
          const shouldSkipMessage = data.message === "Choose a method:" ||
            (data.currentStep === 'choose_method' &&
              data.message.includes('Choose a method'));

          if (!shouldSkipMessage) {
            // NEW: If speaker is enabled, set up pending message for audio-then-text timing
            if (isSpeakerEnabled && data.message) {
              console.log('⏱️ V9: Setting up pending message for audio-first rendering (work type)');
              setPendingMessage({
                content: data.message,
                responseTime: data.responseTime,
                usedAI: data.usedAI,
                metadata: { version: 'v9' }
              });
              
              // Start audio playback (will trigger handleRenderText after 150ms)
              console.log('🔊 Playing new audio after work type selection');
              beginFirstSpeechLoading();
              speakServerMessage(data.message);
            } else {
              // Speaker disabled: add message immediately
              const systemMessage: TreatmentMessage = {
                id: `system-${Date.now()}`,
                content: data.message,
                isUser: false,
                timestamp: new Date(),
                responseTime: data.responseTime,
                usedAI: data.usedAI,
                version: 'v9'
              };
              setMessages(prev => [...prev, systemMessage]);
            }
          }

          setCurrentStep(data.currentStep);
          setLastResponseTime(data.responseTime || 0);

          if (data.performanceMetrics) {
            setPerformanceMetrics(prev => ({
              ...prev,
              ...data.performanceMetrics
            }));
          }

          if (data.currentStep) {
            setSessionStats(prev => ({
              ...prev,
              totalResponses: prev.totalResponses + 1
            }));
          }
        }
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Work type selection error:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        setHasError(true);
        setErrorMessage(`Failed to process work type selection: ${error.message || 'Unknown error'}`);
        setIsLoading(false);
      });
  };

  // V3: Helper function to determine if we should show method selection buttons
  const shouldShowMethodSelection = () => {
    // choose_method (method_selection phase) + digging_method_selection (digging_deeper phase)
    const isMethodSelectionStep =
      currentStep === 'choose_method' || currentStep === 'digging_method_selection';

    if (!isMethodSelectionStep) return false;

    // Don't show if we're loading or session isn't active
    if (isLoading || !isSessionActive) return false;

    console.log(`✅ METHOD BUTTONS: Showing buttons for ${currentStep} step`);
    return true;
  };

  // V3: Helper function to determine if we should show Yes/No buttons for trauma intro
  const shouldShowTraumaYesNoButtons = () => {
    // Check if we're in trauma_shifting_intro step
    if (currentStep !== 'trauma_shifting_intro') return false;

    // Don't show if we're loading or session isn't active
    if (isLoading || !isSessionActive) return false;

    console.log('✅ TRAUMA YES/NO BUTTONS: Showing for trauma_shifting_intro step');
    return true;
  };

  // V3: Helper function to determine if we should show Yes/No buttons for confirm statement
  const shouldShowConfirmStatementButtons = () => {
    // Check if we're in confirm_statement step
    if (currentStep !== 'confirm_statement') return false;

    // Don't show if we're loading or session isn't active
    if (isLoading || !isSessionActive) return false;

    console.log('✅ CONFIRM STATEMENT YES/NO BUTTONS: Showing for confirm_statement step');
    return true;
  };

  const shouldShowGoalYesNoButtons = () => {
    // Check if we're in goal yes/no steps
    const goalYesNoSteps = ['goal_deadline_check', 'goal_confirmation'];
    if (!goalYesNoSteps.includes(currentStep)) return false;

    // Don't show if we're loading or session isn't active
    if (isLoading || !isSessionActive) return false;

    console.log(`✅ GOAL YES/NO BUTTONS: Showing for ${currentStep} step`);
    return true;
  };

  // V4: GENERIC Yes/No button helper - automatically detects any yes/no step
  // This covers all 37 missing yes/no steps without needing individual helpers
  const shouldShowGenericYesNoButtons = () => {
    // Only show if expectedResponseType is 'yesno'
    if (expectedResponseType !== 'yesno') return false;

    // Don't show if we're loading or session isn't active
    if (isLoading || !isSessionActive) return false;

    // Exclude steps that have specific button implementations
    const specificYesNoSteps = [
      'trauma_shifting_intro',    // Has shouldShowTraumaYesNoButtons
      'confirm_statement',          // Has shouldShowConfirmStatementButtons
      'goal_deadline_check',        // Has shouldShowGoalYesNoButtons
      'goal_confirmation'           // Has shouldShowGoalYesNoButtons
    ];
    
    if (specificYesNoSteps.includes(currentStep)) return false;

    console.log(`✅ GENERIC YES/NO BUTTONS: Showing for ${currentStep} step (expectedResponseType: yesno)`);
    return true;
  };

  // V3: Handle Yes/No button clicks for trauma intro and confirm statement
  const handleYesNoClick = (response: string) => {
    clearTranscriptBuffers();
    // Stop current audio if user is advancing to next step
    if ((isMicEnabled || isSpeakerEnabled) && naturalVoice.isSpeaking) {
      console.log('🛑 Stopping current audio - user clicked yes/no');
      naturalVoice.stopSpeaking();
      resetSubtitles();
    }
    setClickedButton(response);
    sendMessage(response);
  };

  // V3: Handle method selection button clicks
  const handleMethodSelection = (method: string) => {
    clearTranscriptBuffers();
    // Stop current audio if user is advancing to next step
    if ((isMicEnabled || isSpeakerEnabled) && naturalVoice.isSpeaking) {
      console.log('🛑 Stopping current audio - user selected method');
      naturalVoice.stopSpeaking();
      resetSubtitles();
    }
    
    setClickedButton(method);

    // Save step history BEFORE applying the user's response to UI state
    setStepHistory(prev => [...prev, createUndoHistoryEntry()]);

    // Send the method number to backend but display full name to user
    const methodMap: { [key: string]: string } = {
      'Problem Shifting': '1',
      'Identity Shifting': '2',
      'Belief Shifting': '3',
      'Blockage Shifting': '4'
    };

    // Display the full method name in the UI
    const userMessage: TreatmentMessage = {
      id: `user-${Date.now()}`,
      content: method,
      isUser: true,
      timestamp: new Date(),
      version: 'v9'
    };
    setMessages(prev => [...prev, userMessage]);
    setClickedButton(null);

    // Send the number to the backend (what it expects)
    const methodNumber = methodMap[method] || method;
    setUserInput('');
    setIsLoading(true);
    setHasError(false);

    // Continue with backend call
    fetch('/api/treatment-v9', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'continue',
        sessionId,
        userId,
        userInput: methodNumber
      }),
    })
      .then(async response => {
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`V9 HTTP error! status: ${response.status}${errorText ? ` - ${errorText}` : ''}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          // NEW: If speaker is enabled, set up pending message for audio-then-text timing
          if (isSpeakerEnabled && data.message) {
            console.log('⏱️ V9: Setting up pending message for audio-first rendering (method selection)');
            setPendingMessage({
              content: data.message,
              responseTime: data.responseTime,
              usedAI: data.usedAI,
              metadata: { version: 'v9' }
            });
            
            // Start audio playback (will trigger handleRenderText after 150ms)
            console.log('🔊 Playing new audio after method selection');
            beginFirstSpeechLoading();
            speakServerMessage(data.message);
          } else {
            // Speaker disabled: add message immediately
            const systemMessage: TreatmentMessage = {
              id: `system-${Date.now()}`,
              content: data.message,
              isUser: false,
              timestamp: new Date(),
              responseTime: data.responseTime,
              usedAI: data.usedAI,
              version: 'v9'
            };
            setMessages(prev => [...prev, systemMessage]);
          }

          setCurrentStep(data.currentStep);
          setLastResponseTime(data.responseTime || 0);

          if (data.performanceMetrics) {
            setPerformanceMetrics(prev => ({
              ...prev,
              ...data.performanceMetrics
            }));
          }

          if (data.currentStep) {
            setSessionStats(prev => ({
              ...prev,
              totalResponses: prev.totalResponses + 1
            }));
          }
        }
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Method selection error:', error);
        setHasError(true);
        setErrorMessage(`Failed to process method selection: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoading(false);
      });
  };

  const showFirstSpeechWarmup =
    interactionMode === 'orb_ptt' &&
    isFirstSpeechLoading &&
    !hasFirstSpeechStarted;

  // US-015/US-017: neutral-wording copy with no vendor identifiers.
  const speechFallbackPromptText = speechFallbackPrompt?.kind === 'stt'
    ? "We're having trouble with speech recognition. Would you like to continue by typing?"
    : "We're having trouble with audio playback. Would you like to continue by typing?";

  const speechFallbackDeclinedText = speechFallbackPrompt?.kind === 'stt'
    ? 'Speech recognition is still paused. Please try again later.'
    : 'Audio playback is still paused. Please try again later.';

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 flex flex-col fixed inset-x-0 top-header-safe bottom-0 pb-safe">
      {runtimeStaticAudioVoice && <V9AudioPreloader voice={runtimeStaticAudioVoice} />}

      {/* US-015: text-mode fallback dialog. Renders when OpenAI speech fails twice in 10s. */}
      {textModeFallbackState === 'prompt' && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="text-mode-fallback-title"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl p-6 space-y-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" aria-hidden="true" />
              <div className="space-y-2">
                <h2 id="text-mode-fallback-title" className="text-lg font-semibold text-foreground">
                  Audio unavailable
                </h2>
                <p className="text-sm text-muted-foreground">
                  We&rsquo;re temporarily unable to use audio. Would you like to continue by typing?
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleTextModeRetry}
                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={handleTextModeContinue}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Continue in text
              </button>
            </div>
          </div>
        </div>
      )}

      {/* US-015: subtle reconnecting chip while auto-retrying. */}
      {textModeFallbackState === 'retrying' && (
        <div
          className="fixed top-4 right-4 z-40 rounded-full bg-secondary/90 border border-border px-3 py-1.5 text-xs text-secondary-foreground shadow-md"
          role="status"
          aria-live="polite"
        >
          Reconnecting&hellip;
        </div>
      )}

      {speechFallbackPrompt && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl p-6 space-y-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">Speech Service Issue</h2>
                <p className="text-sm text-muted-foreground">
                  {speechFallbackPrompt.status === 'prompt'
                    ? speechFallbackPromptText
                    : speechFallbackDeclinedText}
                </p>
              </div>
            </div>

            {speechFallbackPrompt.status === 'prompt' && (
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleSpeechFallbackDecline}
                  className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  No
                </button>
                <button
                  onClick={handleSpeechFallbackConfirm}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Yes
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Guided Mode PTT Interface - inline, not full-screen overlay */}
      {isGuidedMode && (
        <div className="relative flex-shrink-0 bg-gradient-to-br from-primary/90 via-secondary/90 to-primary/80 rounded-lg flex flex-col items-center py-5 px-4 mb-2">
          {/* Top row: Exit button + Status */}
          <div className="w-full flex items-center justify-between mb-3">
            <button
              onClick={() => {
                if (isPTTActive) {
                  handlePTTEnd();
                }
                naturalVoice.stopSpeaking();
                window.location.href = '/dashboard';
              }}
              className="text-primary-foreground/70 hover:text-primary-foreground p-2 bg-foreground/10 hover:bg-foreground/20 rounded-full transition-all backdrop-blur-sm"
              aria-label="Exit session"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="text-primary-foreground/60 text-sm">
              {isPTTActive ? '🔴 Recording...' :
               showFirstSpeechWarmup ? '⏳ Preparing voice...' :
               naturalVoice.isSpeaking ? '🔊 AI Speaking...' :
               '🧘 Ready - Speak now'}
            </div>
            <button
              onClick={async () => {
                if (isPTTActive) {
                  handlePTTEnd();
                }
                naturalVoice.stopSpeaking();
                await signOut();
              }}
              className="text-primary-foreground/70 hover:text-primary-foreground p-2 bg-foreground/10 hover:bg-foreground/20 rounded-full transition-all backdrop-blur-sm"
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>

          {/* Main PTT Button - compact */}
          <button
            onPointerDown={handlePTTStart}
            onPointerUp={handlePTTEnd}
            onPointerLeave={handlePTTEnd}
            className={`
              w-36 h-36 sm:w-44 sm:h-44 rounded-full
              ${isPTTActive
                ? 'bg-destructive animate-pulse-slow ring-8 ring-destructive/50 scale-105'
                : showFirstSpeechWarmup
                ? 'bg-primary/85 ring-4 ring-primary/25'
                : naturalVoice.isSpeaking
                ? 'bg-primary ring-8 ring-primary/30 animate-pulse-slow'
                : 'bg-secondary ring-4 ring-secondary/50 hover:ring-8 hover:scale-105'
              }
              flex flex-col items-center justify-center
              text-primary-foreground font-bold
              transition-all duration-300
              shadow-2xl
              active:scale-95
              cursor-pointer
              select-none
            `}
          >
            {isPTTActive ? (
              <>
                <div className="text-4xl mb-2 animate-bounce">🔴</div>
                <div className="text-base mb-1">Speaking...</div>
                <div className="text-xs opacity-75">Release to send</div>
              </>
            ) : showFirstSpeechWarmup ? (
              <>
                <div className="text-4xl mb-2 animate-pulse">⏳</div>
                <div className="text-base mb-1">Loading voice...</div>
                <div className="text-xs opacity-75">Starting first response</div>
              </>
            ) : naturalVoice.isSpeaking ? (
              <>
                <div className="text-4xl mb-2">🔊</div>
                <div className="text-base mb-1">AI Speaking</div>
              </>
            ) : (
              <>
                <div className="text-4xl mb-2">🎙️</div>
                <div className="text-base mb-1">Speak Now</div>
              </>
            )}
          </button>

          {/* Subtitle line - directly beneath the orb */}
          {interactionMode === 'orb_ptt' && (
            <div className="w-full px-4 mt-3">
              <div className="mx-auto max-w-md rounded-md bg-foreground/10 border border-foreground/20 backdrop-blur-sm px-3 py-2">
                <p
                  className="text-sm text-primary-foreground text-center whitespace-nowrap overflow-hidden text-ellipsis min-h-[20px]"
                  aria-live="polite"
                >
                  {showFirstSpeechWarmup && !currentSubtitle ? 'Preparing audio...' : currentSubtitle}
                </p>
              </div>
            </div>
          )}

          {/* Skip Audio + Instructions row */}
          <div className="flex items-center justify-center gap-4 mt-3">
            {interactionMode === 'orb_ptt' && naturalVoice.isSpeaking && (
              <button
                onClick={() => {
                  naturalVoice.stopSpeaking();
                  resetSubtitles();
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground backdrop-blur-sm transition-all text-sm"
                title="Skip current audio"
              >
                <SkipForward className="h-4 w-4" />
                <span>Skip Audio</span>
              </button>
            )}
            <p className="text-primary-foreground/60 text-xs text-center">Close your eyes and speak when ready</p>
          </div>
        </div>
      )}

      {/* Ready Overlay - Shows before session starts */}
      {showReadyOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="text-center px-4">
            <div className="mb-8">
              <Brain className="h-16 w-16 sm:h-20 sm:w-20 text-primary mx-auto mb-4 animate-pulse" />
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                Ready to Begin?
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
                Audio is preloaded and ready. Click below to begin. We may ask for microphone access before starting.
              </p>
            </div>
            <button
              onClick={handleStartSession}
              disabled={isPreparingStartPermissions}
              className={`group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-primary-foreground rounded-full transition-all duration-200 shadow-lg hover:shadow-xl ${
                isPreparingStartPermissions
                  ? 'bg-primary/70 cursor-wait'
                  : 'bg-primary hover:bg-primary/90 transform hover:scale-105'
              }`}
            >
              <Play className="h-6 w-6 mr-2 group-hover:scale-110 transition-transform" />
              {isPreparingStartPermissions ? 'Requesting Permission...' : 'Start Session'}
            </button>
            <p className="mt-6 text-xs text-muted-foreground">
              Make sure you're in a quiet space where you can focus
            </p>
          </div>
        </div>
      )}

      {/* Header - 2x2 Grid, sticky below page header (h-14 = 56px) */}
        <div className="flex-shrink-0 flex flex-col gap-2 px-3 py-2.5 mb-2 bg-card rounded-lg border border-border z-30">
        {/* Audio Controls - 2x2 Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Microphone Toggle */}
          <button
            onClick={toggleMic}
            disabled={micPermission === 'denied'}
            data-state={isMicEnabled ? 'on' : 'off'}
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-full text-sm font-semibold transition-all shadow-sm text-[#ffffff] ${
              isMicEnabled ? 'bg-[#16a34a]' : 'bg-[#6b7280]'
            } ${
              micPermission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title={
              !isMicEnabled ? 'Enable Microphone' :
              naturalVoice.listeningState === 'listening' ? 'Listening...' :
              naturalVoice.listeningState === 'restarting' ? 'Restarting...' :
              naturalVoice.listeningState === 'blockedByAudio' ? 'Blocked (AI speaking)' :
              naturalVoice.listeningState === 'micDisabled' ? 'Microphone disabled' :
              naturalVoice.listeningState === 'permissionDenied' ? 'Permission denied' :
              naturalVoice.listeningState === 'unsupported' ? 'Not supported' :
              naturalVoice.listeningState === 'error' ? 'Error' :
              'Ready'
            }
          >
            <span className="flex items-center gap-1.5">
              {naturalVoice.isListening ? (
                <Mic className="h-4 w-4 animate-pulse" />
              ) : naturalVoice.listeningState === 'restarting' ? (
                <Mic className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
              <span>Mic</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-xs tracking-wide">{isMicEnabled ? 'ON' : 'OFF'}</span>
              <span
                className={`h-4 w-4 rounded-full bg-card transition-transform ${
                  isMicEnabled ? 'translate-x-0' : ''
                }`}
                aria-hidden="true"
              />
            </span>
          </button>
          
          {/* Speaker Toggle */}
          <button
            onClick={toggleSpeaker}
            data-state={isSpeakerEnabled ? 'on' : 'off'}
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-full text-sm font-semibold transition-all shadow-sm text-[#ffffff] ${
              isSpeakerEnabled ? 'bg-[#16a34a]' : 'bg-[#6b7280]'
            }`}
            title={isSpeakerEnabled ? 'Disable Speaker' : 'Enable Speaker'}
          >
            <span className="flex items-center gap-1.5">
              {isSpeakerEnabled ? (
                naturalVoice.isSpeaking ? (
                  <Volume2 className="h-4 w-4 animate-pulse" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
              <span>Speaker</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-xs tracking-wide">{isSpeakerEnabled ? 'ON' : 'OFF'}</span>
              <span className="h-4 w-4 rounded-full bg-card" aria-hidden="true" />
            </span>
          </button>

          {/* Pause/Play Button - ALWAYS visible, disabled when no audio */}
          <button
            onClick={handlePauseResume}
            disabled={!naturalVoice.isSpeaking && !naturalVoice.isPaused}
            className={`flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
              naturalVoice.isPaused
                ? 'bg-accent/20 text-accent ring-2 ring-accent'
                : naturalVoice.isSpeaking
                ? 'bg-warning/20 text-warning ring-2 ring-warning'
                : 'bg-secondary text-muted-foreground opacity-50 cursor-not-allowed'
            }`}
            title={
              !naturalVoice.isSpeaking && !naturalVoice.isPaused
                ? "No audio playing"
                : naturalVoice.isPaused
                ? "Resume audio"
                : "Pause audio"
            }
          >
            {naturalVoice.isPaused ? (
              <Play className="h-5 w-5" />
            ) : (
              <span className="text-lg">⏸️</span>
            )}
          </button>

          {/* Settings & Undo - Split equally in the 4th grid cell */}
          <div className="flex gap-1">
            {/* Settings Button - Half width */}
            <button
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              className={`flex-1 flex items-center justify-center rounded-full transition-colors ${
                showVoiceSettings
                  ? 'bg-primary/20 text-primary'
                  : 'bg-secondary text-muted-foreground  '
              }`}
              title="Voice Settings"
            >
              <Settings className="h-5 w-5" />
            </button>

            {/* Undo Button - Half width, always visible */}
            <button
              onClick={handleUndo}
              disabled={stepHistory.length === 0 || isLoading}
              className={`flex-1 flex items-center justify-center rounded-full transition-colors ${
                stepHistory.length > 0 && !isLoading
                  ? 'bg-secondary text-foreground'
                  : 'bg-secondary text-muted-foreground opacity-50 cursor-not-allowed'
              }`}
              title="Undo last message"
            >
              <Undo2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Voice Settings Modal - bottom sheet on all devices */}
      {showVoiceSettings && (
        <>
          {/* Overlay backdrop — theme-aware translucent veil instead of
              raw black (R4). `bg-foreground/30` gives a dark overlay in
              light themes and a light one in dark themes, preserving
              the "pushed back" affordance without violating the theme
              token contract. */}
          <div
            className="fixed inset-0 bg-foreground/30 z-40"
            onClick={() => setShowVoiceSettings(false)}
          />
          
          {/* Modal content - bottom sheet on mobile, centered modal on desktop */}
          <div className="fixed bottom-0 left-0 right-0 w-full bg-card border-t border-border shadow-xl p-4 pb-8 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl">
            {/* Mobile drag handle */}
            <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
            
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center space-x-2">
                <Settings className="h-5 w-5 text-primary" />
                <span>Voice Settings</span>
              </h3>
              <button
                onClick={() => setShowVoiceSettings(false)}
                className="text-muted-foreground hover:text-foreground text-2xl leading-none p-1 -mr-1"
                aria-label="Close settings"
              >
                ×
              </button>
            </div>

            {/* Voice Selector */}
            {AVAILABLE_VOICES.length > 1 && (
              <div className="space-y-3 mb-4 pb-4 border-b border-border">
                <div className="flex items-center space-x-2 text-sm font-medium text-foreground">
                  <User className="h-4 w-4 text-primary" />
                  <span>Voice Actor</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_VOICES.map((voiceOption) => (
                    <button
                      key={voiceOption.id}
                      onClick={() => handleVoiceChange(voiceOption.id)}
                      className={`w-full text-left px-3 py-3 md:py-2 rounded-lg text-sm transition-colors ${
                        selectedVoice === voiceOption.id
                          ? 'bg-primary/20 text-primary ring-2 ring-primary'
                          : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                      }`}
                    >
                      <div className="font-medium">{voiceOption.name}</div>
                      <div className="text-xs opacity-75 truncate">{voiceOption.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Speed Slider */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-sm font-medium text-foreground">
                <Gauge className="h-4 w-4 text-primary" />
                <span>Playback Speed</span>
              </div>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Speed: {playbackSpeed.toFixed(2)}x</span>
                <span className={`font-medium ${
                  playbackSpeed === 1.0 ? 'text-accent' : 'text-primary'
                }`}>
                  {getSpeedLabel(playbackSpeed)}
                </span>
              </div>
              
              <input
                type="range"
                min="0.75"
                max="1.5"
                step="0.05"
                value={playbackSpeed}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                aria-label="Playback speed"
                title="Playback speed"
                className="w-full h-3 md:h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0.75x</span>
                <span className="text-accent">1.0x</span>
                <span>1.5x</span>
              </div>

              {/* Quick preset buttons */}
              <div className="grid grid-cols-5 gap-2 pt-3 border-t border-border">
                {[0.75, 0.9, 1.0, 1.15, 1.5].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`px-2 py-2.5 md:py-1.5 text-xs rounded-lg transition-colors ${
                      Math.abs(playbackSpeed - speed) < 0.01
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {speed === 1.0 ? '1x' : `${speed}x`}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground text-center md:text-left">
              Adjust voice and speed for your session.
            </p>
          </div>
        </>
      )}

      {/* Messages Area - scrollable, fills remaining space */}
      {/* In guided/orb mode: hidden inline, moved to admin debug drawer */}
      {!isGuidedMode && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-card/30 rounded-lg border border-border/30 min-h-0 mb-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.isUser
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground'
                  }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                {/* Response time badge removed from bubble so it doesn't read as bot speech */}

                {/* NEW: Audio/Text timing metrics (only for bot messages with voice timing) */}
                {!message.isUser && (message.textRenderTime || message.audioStartTime) && (
                  <div
                    className="mt-2 pt-2 border-t border-border/30 text-xs text-muted-foreground font-mono"
                    aria-hidden="true"
                  >
                    ⏱️
                    {message.textRenderTime && (
                      <span className="ml-1">
                        Text: <span className="font-semibold">{Math.round(message.textRenderTime)}ms</span>
                      </span>
                    )}
                    {message.audioStartTime && (
                      <span className="ml-2">
                        | Audio: <span className="font-semibold">{Math.round(message.audioStartTime)}ms</span>
                      </span>
                    )}
                    {message.textRenderTime && message.audioStartTime && (
                      <span className="ml-2">
                        | Δ: <span className={`font-semibold ${
                          (message.textRenderTime - message.audioStartTime) > 0
                            ? 'text-accent'
                            : 'text-destructive'
                        }`}>
                          {Math.round(message.textRenderTime - message.audioStartTime)}ms
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Processing shimmer - shows while Whisper is transcribing user speech */}
          {naturalVoice.isProcessing && (
            <div className="flex justify-end">
              <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-primary/20 animate-pulse">
                <div className="space-y-2">
                  <div className="h-3 bg-primary/40 rounded w-3/4"></div>
                  <div className="h-3 bg-primary/40 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* In guided/orb mode: spacer to push input to bottom when messages hidden */}
      {isGuidedMode && <div className="flex-1 min-h-0" />}

      {/* Admin Debug Drawer — right-edge slide-out, admin-only in every mode.
          R9: `voicePair` surfaces the pinned STT/TTS pair.
          R13.4: `showAudioTelemetry` wires in the static-audio
          resolver's hit/miss counters for this session. */}
      {isAdmin && (
        <AdminDebugDrawer
          messages={messages}
          isProcessing={naturalVoice.isProcessing}
          isOpen={isDebugDrawerOpen}
          onToggle={toggleDebugDrawer}
          voicePair={voicePair}
          ttsEstimate={sessionTtsEstimate}
          showAudioTelemetry
        />
      )}

      {/* Input area - pinned at bottom, scrolls if too tall for viewport */}
        <div className="flex-shrink-0 max-h-[45vh] overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 border-t border-border bg-background">
        {hasError && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">{errorMessage}</span>
            </div>
          </div>
        )}

        {voiceError && (
          <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              <span className="text-sm text-warning">Voice: {voiceError}</span>
            </div>
          </div>
        )}

        {showEmotionConfirmation && (
          <div className="mb-4 flex space-x-2">
            <button
              onClick={() => handleButtonClick('yes')}
              disabled={isLoading}
              className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              Yes
            </button>
            <button
              onClick={() => handleButtonClick('no')}
              disabled={isLoading}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 transition-colors"
            >
              No
            </button>
          </div>
        )}

        {/* V3: Work Type Selection Buttons */}
        {showWorkTypeButtons && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 sm:gap-4 justify-center">
              <button
                onClick={() => handleWorkTypeSelection('1')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === '1' ? 'scale-105 bg-primary/80 shadow-lg' : ''
                  }`}
              >
                <span className="bg-primary/80 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">1</span>
                <span>PROBLEM</span>
              </button>

              <button
                onClick={() => handleWorkTypeSelection('2')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === '2' ? 'scale-105 bg-accent/80 shadow-lg' : ''
                  }`}
              >
                <span className="bg-accent/80 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">2</span>
                <span>GOAL</span>
              </button>

              <button
                onClick={() => handleWorkTypeSelection('3')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === '3' ? 'scale-105 bg-secondary/80 shadow-lg' : ''
                  }`}
              >
                <span className="bg-secondary/80 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">3</span>
                <span className="hidden sm:inline">NEGATIVE EXPERIENCE</span>
                <span className="sm:hidden">NEG. EXP.</span>
              </button>
            </div>
          </div>
        )}

        {/* V3: Yes/No Buttons for Trauma Intro */}
        {shouldShowTraumaYesNoButtons() && (
          <div className="mb-4 flex gap-2 sm:gap-3 justify-center">
            <button
              onClick={() => handleYesNoClick('yes')}
              disabled={isLoading}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors font-semibold text-sm sm:text-base"
            >
              Yes
            </button>
            <button
              onClick={() => handleYesNoClick('no')}
              disabled={isLoading}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 transition-colors font-semibold text-sm sm:text-base"
            >
              No
            </button>
          </div>
        )}

        {/* V3: Yes/No Buttons for Confirm Statement */}
        {shouldShowConfirmStatementButtons() && (
          <div className="mb-4 flex gap-2 sm:gap-3 justify-center">
            <button
              onClick={() => handleYesNoClick('yes')}
              disabled={isLoading}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors font-semibold text-sm sm:text-base"
            >
              Yes
            </button>
            <button
              onClick={() => handleYesNoClick('no')}
              disabled={isLoading}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 transition-colors font-semibold text-sm sm:text-base"
            >
              No
            </button>
          </div>
        )}

        {/* V3: Yes/No Buttons for Goal Steps (goal_deadline_check, goal_confirmation) */}
        {shouldShowGoalYesNoButtons() && (
          <div className="mb-4 flex gap-2 sm:gap-3 justify-center">
            <button
              onClick={() => handleYesNoClick('yes')}
              disabled={isLoading}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors font-semibold text-sm sm:text-base"
            >
              Yes
            </button>
            <button
              onClick={() => handleYesNoClick('no')}
              disabled={isLoading}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 transition-colors font-semibold text-sm sm:text-base"
            >
              No
            </button>
          </div>
        )}

        {/* V4: GENERIC Yes/No Buttons - Auto-detects all yes/no steps */}
        {/* Covers 37 steps: digging_deeper, trauma checks, identity checks, belief checks, etc. */}
        {shouldShowGenericYesNoButtons() && (
          <div className="mb-4 flex gap-2 sm:gap-3 justify-center">
            <button
              onClick={() => handleYesNoClick('yes')}
              disabled={isLoading}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors font-semibold text-sm sm:text-base"
            >
              Yes
            </button>
            <button
              onClick={() => handleYesNoClick('no')}
              disabled={isLoading}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 transition-colors font-semibold text-sm sm:text-base"
            >
              No
            </button>
          </div>
        )}

        {/* V3: Method Selection Buttons - 2x2 Grid */}
        {shouldShowMethodSelection() && (
          <div className="mb-4">
            <div className="text-center mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3">
                Choose a method:
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-2xl mx-auto">
              <button
                onClick={() => handleMethodSelection('Problem Shifting')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === 'Problem Shifting' ? 'scale-105 bg-primary/80 shadow-lg' : ''
                  }`}
              >
                <span className="bg-primary/80 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">1</span>
                <span className="hidden sm:inline">Problem Shifting</span>
                <span className="sm:hidden">Problem Shifting</span>
              </button>

              <button
                onClick={() => handleMethodSelection('Identity Shifting')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === 'Identity Shifting' ? 'scale-105 bg-accent/80 shadow-lg' : ''
                  }`}
              >
                <span className="bg-accent/80 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">2</span>
                <span className="hidden sm:inline">Identity Shifting</span>
                <span className="sm:hidden">Identity Shifting</span>
              </button>

              <button
                onClick={() => handleMethodSelection('Belief Shifting')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === 'Belief Shifting' ? 'scale-105 bg-secondary/80 shadow-lg' : ''
                  }`}
              >
                <span className="bg-secondary/80 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">3</span>
                <span className="hidden sm:inline">Belief Shifting</span>
                <span className="sm:hidden">Belief Shifting</span>
              </button>

              <button
                onClick={() => handleMethodSelection('Blockage Shifting')}
                disabled={isLoading}
                className={`px-3 py-2 sm:px-6 sm:py-3 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:bg-secondary disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center space-x-1 sm:space-x-2 font-semibold text-sm sm:text-base ${isLoading ? 'opacity-50' : ''
                  } ${clickedButton === 'Blockage Shifting' ? 'scale-105 bg-destructive/80 shadow-lg' : ''
                  }`}
              >
                <span className="bg-destructive/80 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs sm:text-sm font-bold">4</span>
                <span className="hidden sm:inline">Blockage Shifting</span>
                <span className="sm:hidden">Blockage Shifting</span>
              </button>
            </div>
          </div>
        )}

        {/* V3: Text Input Form - Hidden when buttons are shown */}
        {!showWorkTypeButtons && !shouldShowMethodSelection() && !shouldShowTraumaYesNoButtons() && !shouldShowConfirmStatementButtons() && !shouldShowGoalYesNoButtons() && !shouldShowGenericYesNoButtons() && (
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your response..."
              disabled={isLoading || !isSessionActive}
              className="flex-1 px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !userInput.trim() || !isSessionActive}
              className="px-4 sm:px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center sm:space-x-2"
            >
              <Send className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        )}
      </div>
    </div>

  );
}