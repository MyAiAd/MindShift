'use client';

import { useState, useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import type { TranscriptionDomainContext } from '@/lib/voice/transcription-domain-context';
import { validateSpeechOutput } from '@/lib/voice/speech-compliance';
import { globalAudioCache } from '@/services/voice/audioCache';
import { V4_STATIC_AUDIO_TEXTS } from '@/lib/v4/static-audio-texts';
import { V7_STATIC_AUDIO_TEXTS } from '@/lib/v7/static-audio-texts';
import { getVoiceCacheName } from '@/lib/voice/voice-cache-name';
import { useVAD } from './useVAD';
import { useAudioCapture } from './useAudioCapture';
import { useElevenLabsScribeRealtime } from './useElevenLabsScribeRealtime';

// Get all static texts for prefix matching
const STATIC_TEXTS = Array.from(
    new Set([
        ...Object.values(V4_STATIC_AUDIO_TEXTS),
        ...Object.values(V7_STATIC_AUDIO_TEXTS),
    ])
);

interface UseNaturalVoiceProps {
    onTranscript: (transcript: string) => void;
    enabled: boolean; // DEPRECATED: For backward compatibility, replaced by micEnabled + speakerEnabled
    micEnabled?: boolean; // NEW: Controls microphone input separately
    speakerEnabled?: boolean; // NEW: Controls audio output separately
    voiceProvider?: 'openai' | 'elevenlabs' | 'kokoro';
    elevenLabsVoiceId?: string;
    kokoroVoiceId?: string;
    /**
     * US-007: unified voice id for v7. When `voiceProvider === 'openai'` this takes priority
     * over the legacy kokoro/elevenlabs ids. Accepts OpenAI voice names (alloy/echo/fable/
     * onyx/nova/shimmer) or short-form aliases (heart, michael).
     */
    voiceId?: string;
    onAudioEnded?: () => void;
    playbackRate?: number; // 0.5 to 2.0, default 1.0
    onRenderText?: (timing: { audioStartTime: number; textRenderTime: number }) => void; // NEW: Callback when text should render
    guidedMode?: boolean; // NEW: If true, disables auto-restart of listening (for PTT mode)
    vadSensitivity?: number; // VAD sensitivity (0.1-0.9)
    onVadLevel?: (level: number) => void; // VAD level callback
    testMode?: boolean; // NEW: If true, VAD won't trigger speech recognition (for testing)
    onTestInterruption?: () => void; // NEW: Callback when VAD detects speech in test mode
    /** Ref to latest Whisper domain context (expectedResponseType, step, hotwords). */
    transcriptionContextRef?: MutableRefObject<TranscriptionDomainContext | null>;
    treatmentVersion?: string;
    sttProviderOverride?: 'existing' | 'openai' | 'elevenlabs';
    ttsProviderOverride?: 'existing' | 'openai';
    onSpeechProviderError?: (details: {
        kind: 'stt' | 'tts';
        provider: 'openai' | 'existing' | 'elevenlabs' | 'kokoro';
        message: string;
    }) => void;
    onTtsUsage?: (usage: NaturalVoiceTtsUsage) => void;
    /**
     * Optional latency-tracing callbacks. Each fires once per turn at a
     * known point in the TTS pipeline so the host can build a per-message
     * timing breakdown (Scribe → backend → TTS req → first audio chunk →
     * playback). All three may NOT fire when audio is served from the
     * cache (no network request happens) — consumers should treat them
     * as optional snapshots, not a strict sequence.
     */
    onTtsRequested?: () => void;
    onTtsFirstChunk?: () => void;
    onAudioPlaybackStarted?: () => void;
    /**
     * Server-reported time (ms) /api/tts spent before dispatching to the
     * upstream provider. Read from the `X-Tts-Route-Ms` response header so
     * the chip can split `→TTS chunk` into "route" + "upstream synth".
     * Fires once per /api/tts response. Not fired for cached audio (no fetch).
     */
    onTtsRouteMs?: (routeMs: number) => void;
}

interface SpeechRequestOptions {
    apiMessage?: string;
}

type NaturalVoiceTtsProvider = 'openai' | 'elevenlabs' | 'kokoro';

interface NaturalVoiceTtsUsage {
    provider: NaturalVoiceTtsProvider;
    characters: number;
    estimatedUsd: number;
    cached: boolean;
    source: 'prefetch' | 'playback';
}

const TTS_USAGE_USD_PER_CHARACTER: Record<NaturalVoiceTtsProvider, number> = {
    openai: 0.000015,
    elevenlabs: 0.00044,
    kokoro: 0,
};

function resolveTtsUsageProvider(
    voiceProvider?: NaturalVoiceTtsProvider,
    ttsProviderOverride?: 'existing' | 'openai',
): NaturalVoiceTtsProvider {
    if (ttsProviderOverride === 'openai') return 'openai';
    if (ttsProviderOverride === 'existing') return 'kokoro';
    return voiceProvider ?? 'kokoro';
}

function estimateTtsUsageUsd(
    provider: NaturalVoiceTtsProvider,
    characters: number,
    cached: boolean,
): number {
    if (cached) return 0;
    return characters * TTS_USAGE_USD_PER_CHARACTER[provider];
}

export const useNaturalVoice = ({
    onTranscript,
    enabled,
    micEnabled,
    speakerEnabled,
    voiceProvider,
    elevenLabsVoiceId = '21m00Tcm4TlvDq8ikWAM', // Rachel
    kokoroVoiceId = 'af_heart', // Default to Heart (Rachel)
    voiceId,
    onAudioEnded,
    playbackRate = 1.0,
    onRenderText, // NEW: Callback for text rendering timing
    guidedMode = false, // NEW: Guided mode flag
    vadSensitivity = 0.5, // VAD sensitivity
    onVadLevel, // VAD level callback
    testMode = false, // NEW: Test mode flag to prevent VAD triggering speech recognition
    onTestInterruption, // NEW: Callback when VAD detects speech in test mode
    transcriptionContextRef,
    treatmentVersion,
    sttProviderOverride,
    ttsProviderOverride,
    onSpeechProviderError,
    onTtsUsage,
    onTtsRequested,
    onTtsFirstChunk,
    onAudioPlaybackStarted,
    onTtsRouteMs,
}: UseNaturalVoiceProps) => {
    // Backward compatibility: if micEnabled/speakerEnabled not provided, use 'enabled'
    const isMicEnabled = micEnabled !== undefined ? micEnabled : enabled;
    const isSpeakerEnabled = speakerEnabled !== undefined ? speakerEnabled : enabled;
    
    // Feature flag: Use Whisper or Web Speech API.
    // If provider is not explicitly forced to webspeech, prefer Whisper on browsers
    // that do not implement SpeechRecognition (notably iOS Safari/PWA).
    // R8: V9 behaves identically to V7 here — the v9 client shell is a direct
    // port of v7's, and v9 uses the same Whisper STT path by default.
    const hasWebSpeechSupport = typeof window !== 'undefined' &&
        !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    const configuredTranscriptionProvider = process.env.NEXT_PUBLIC_TRANSCRIPTION_PROVIDER;
    const useWhisper = typeof window !== 'undefined' && (
        treatmentVersion === 'v7' ||
        treatmentVersion === 'v9' ||
        configuredTranscriptionProvider === 'whisper' ||
        (configuredTranscriptionProvider !== 'webspeech' && !hasWebSpeechSupport)
    );
    
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [vadError, setVadError] = useState<string | null>(null); // VAD-specific error
    const [interimTranscript, setInterimTranscript] = useState<string>(''); // NEW: Interim transcript for UI feedback
    const [whisperProcessing, setWhisperProcessing] = useState(false); // Track Whisper processing for UI feedback
    
    // NEW: Richer listening state for better UX
    type ListeningState = 'listening' | 'restarting' | 'blockedByAudio' | 'micDisabled' | 'unsupported' | 'permissionDenied' | 'idle' | 'error';
    const [listeningState, setListeningState] = useState<ListeningState>('idle');

    const recognitionRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const pausedAudioRef = useRef<{ audio: HTMLAudioElement; time: number; text: string } | null>(null); // NEW: Paused audio state
    const isSpeakingRef = useRef(false); // Ref for immediate access in callbacks
    const isMountedRef = useRef(true); // Track if component is mounted
    const isAudioPlayingRef = useRef(false); // Track if audio is actually playing (prevents feedback loop)
    const onTranscriptRef = useRef(onTranscript); // Ref to prevent effect re-runs
    const onAudioEndedRef = useRef(onAudioEnded); // Ref to prevent effect re-runs
    const onRenderTextRef = useRef(onRenderText); // NEW: Ref for render callback
    const prevMicEnabledRef = useRef(isMicEnabled); // Track previous mic state
    const prevSpeakerEnabledRef = useRef(isSpeakerEnabled); // Track previous speaker state
    const speakerEnabledRef = useRef(isSpeakerEnabled); // Immediate ref for async callback checks
    const speakStartTimeRef = useRef<number>(0); // NEW: Track when speak() was called
    const vadRef = useRef<any>(null); // Track VAD instance for resuming after speech
    const guidedModeRef = useRef(guidedMode); // Ref for async access in audio callbacks
    const playGenerationRef = useRef(0); // Monotonic counter for AbortError supersession detection
    // Per-session toggle for the MSE streaming TTS path. Flipped to `true`
    // on any MSE error (codec mismatch, SourceBuffer abort, decoder fail) so
    // subsequent utterances in the same session fall back to the buffered
    // blob path. Reset on hook remount; never reset within a session.
    const streamingDisabledRef = useRef<boolean>(false);

    // Scribe echo suppression — VAD-gated edition.
    //
    // We don't time-pause Scribe after AI ends any more (the 800ms tail
    // dropped the start of fast user replies like "I am having a bad day"
    // → "That day."). Instead, Scribe stays paused after AI speech and
    // only resumes when our local Silero VAD detects actual human voice
    // on the mic stream. Echo audio is acoustically distorted /
    // attenuated and rarely passes Silero's classifier, so this gives
    // us full user speech capture without echo bleed.
    //
    // Two short timers handle the edge cases:
    //   • SCRIBE_ECHO_GUARD_MS — for this long after AI playback ends, any
    //     VAD speech-start event is ignored as likely speaker reverb.
    //     Tuned short (~150-300ms) so it doesn't eat real user speech;
    //     real user replies almost always need at least Silero's own
    //     warmup (~50-100ms) before speech-start fires anyway.
    //   • SCRIBE_POST_SPEECH_DRAIN_MS — when VAD reports silence we wait
    //     this long before pausing Scribe, so the last few frames of the
    //     user's utterance reach the server and Scribe's own VAD can
    //     emit a clean committed_transcript.
    const SCRIBE_ECHO_GUARD_MS = 250;
    const SCRIBE_POST_SPEECH_DRAIN_MS = 300;
    const scribeEchoGuardActiveRef = useRef<boolean>(false);
    const scribeEchoGuardTimerRef = useRef<NodeJS.Timeout | null>(null);
    const scribePauseAfterSilenceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Restart scheduler state - for backoff/loop prevention
    const restartAttemptCountRef = useRef(0); // Track consecutive restart attempts without success
    const lastRestartTimeRef = useRef(0); // Track when last restart was scheduled
    const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Track pending restart
    
    // Continuous mode: track last speech time to detect silence and finalize transcripts
    const lastSpeechTimeRef = useRef<number>(0);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const SILENCE_TIMEOUT_MS = 1500; // 1.5s of silence = done speaking (trigger deployment)
    const TEXT_RENDER_DELAY_MS = 420; // Keep text clearly behind voice to reduce perceived lag
    
    // US-001: monotonic counter that is bumped every time the VAD reports onSpeechStart.
    // useAudioCapture watches it to decide whether there is real speech queued for upload,
    // so silence/ambient audio never reaches OpenAI STT.
    const [speechDetectedTrigger, setSpeechDetectedTrigger] = useState(0);
    // Track whether the VAD is actually usable so useAudioCapture knows whether to enforce
    // the speech gate or fall back to the legacy auto-process timer.
    const [vadAvailable, setVadAvailable] = useState(false);

    // ElevenLabs Scribe realtime path — active only for v9 + elevenlabs provider.
    // When active, AudioCapture and VAD are disabled (Scribe handles both server-side).
    const useScribeRealtime =
        sttProviderOverride === 'elevenlabs' && treatmentVersion === 'v9';

    const scribe = useElevenLabsScribeRealtime({
        enabled: useScribeRealtime && isMicEnabled && !testMode,
        guidedMode,
        onTranscript: (transcript) => {
            console.log('🎤 Scribe transcript:', transcript);
            onTranscriptRef.current(transcript);
        },
        onPartialTranscript: (partial) => setInterimTranscript(partial),
        onError: (message) => {
            onSpeechProviderError?.({ kind: 'stt', provider: 'elevenlabs', message });
        },
        onProcessingChange: (processing) => setWhisperProcessing(processing),
    });

    // Audio capture for Whisper transcription (disabled when Scribe is active or in test mode)
    const audioCapture = useAudioCapture({
        enabled: !useScribeRealtime && isMicEnabled && useWhisper && !testMode,
        onTranscript: (transcript) => {
            console.log('🎤 Whisper transcript:', transcript);
            onTranscriptRef.current(transcript);
        },
        onProcessingChange: (processing) => setWhisperProcessing(processing),
        vadTrigger: false, // We'll manually trigger via processNow()
        speechDetectedTrigger,
        vadAvailable,
        getTranscriptionContext: () => transcriptionContextRef?.current ?? null,
        treatmentVersion,
        transcriptionProviderOverride: sttProviderOverride === 'elevenlabs' ? undefined : sttProviderOverride,
        onProviderError: onSpeechProviderError,
    });

    // Scribe forwarding state machine (VAD-gated edition).
    //
    // We keep Scribe's outgoing audio frames paused by default and only
    // open the gate when our local Silero VAD positively identifies human
    // voice on the mic stream. This replaces the prior 800ms time-based
    // tail, which cut off the start of fast user replies right after AI
    // ended. VAD events are wired into Scribe in handleVadSpeechStart and
    // handleVadSpeechEnd (defined below). This effect just handles the
    // AI-speaking transitions:
    //   • AI starts speaking → pauseCapture (echo suppression) + cancel
    //     any pending VAD-driven resume/pause timers.
    //   • AI ends → leave Scribe paused. Open a brief echo-guard window
    //     during which VAD speech-start events are ignored as likely
    //     speaker reverb. Once the guard expires, the next legit VAD
    //     speech-start will resume Scribe.
    //
    // Initial state: Scribe is paused at hook init (see the dedicated
    // `useScribeRealtime && isMicEnabled` effect right below) so the
    // very first user utterance also goes through the VAD gate.
    useEffect(() => {
        if (!useScribeRealtime) return;

        if (isSpeaking) {
            if (scribeEchoGuardTimerRef.current) {
                clearTimeout(scribeEchoGuardTimerRef.current);
                scribeEchoGuardTimerRef.current = null;
            }
            if (scribePauseAfterSilenceTimerRef.current) {
                clearTimeout(scribePauseAfterSilenceTimerRef.current);
                scribePauseAfterSilenceTimerRef.current = null;
            }
            scribeEchoGuardActiveRef.current = false;
            scribe.pauseCapture();
            console.log('🎙️ Scribe: Paused for AI speech (echo suppression)');
            return;
        }

        // AI ended — keep Scribe paused, open the echo-guard window.
        // VAD speech-start handler reads scribeEchoGuardActiveRef and
        // ignores triggers while it's true.
        scribeEchoGuardActiveRef.current = true;
        if (scribeEchoGuardTimerRef.current) {
            clearTimeout(scribeEchoGuardTimerRef.current);
        }
        scribeEchoGuardTimerRef.current = setTimeout(() => {
            scribeEchoGuardActiveRef.current = false;
            scribeEchoGuardTimerRef.current = null;
            console.log(
                `🎙️ Scribe: Echo guard expired (${SCRIBE_ECHO_GUARD_MS}ms) — VAD now drives forwarding`,
            );
        }, SCRIBE_ECHO_GUARD_MS);

        return () => {
            if (scribeEchoGuardTimerRef.current) {
                clearTimeout(scribeEchoGuardTimerRef.current);
                scribeEchoGuardTimerRef.current = null;
            }
        };
    // scribe object is stable enough — useElevenLabsScribeRealtime's
    // pauseCapture/resumeCapture are useCallback'd with [] deps. Including
    // `scribe` here would re-fire the effect on every render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSpeaking, useScribeRealtime]);

    // Default Scribe to paused as soon as the realtime path is enabled.
    // Without this, the very first user utterance after voicePair loads
    // would race the AI-speaking effect — Scribe defaults `pausedRef` to
    // false when the WS opens, so frames could flow before VAD has a
    // chance to gate them. Pausing here is idempotent and safe even if
    // PTT mode (sidelined) ever comes back.
    useEffect(() => {
        if (!useScribeRealtime || !isMicEnabled) return;
        scribe.pauseCapture();
        console.log('🎙️ Scribe: Initial pause — waiting for VAD speech-start');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useScribeRealtime, isMicEnabled]);

    // Test mode handler - called when user speaks during test mode
    const handleTestModeInterruption = useCallback(() => {
        console.log('🧪 VAD: Test mode interruption detected (TEST MODE ACTIVE)');
        
        // Stop AI audio for visual feedback (keep element alive for iOS)
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        isAudioPlayingRef.current = false;
        
        // Notify parent component of test interruption
        onTestInterruption?.();
        
        console.log('🧪 VAD: Test mode - NO speech recognition started (safe)');
    }, [onTestInterruption]);
    
    // VAD barge-in handler - called when user speaks while AI is talking
    const handleVadBargeIn = useCallback(() => {
        console.log('🎙️ VAD: Barge-in detected - user interrupted AI');
        
        // CRITICAL SAFETY CHECK: If in test mode, don't trigger real barge-in
        if (testMode) {
            console.log('🧪 VAD: Test mode active - redirecting to test handler');
            handleTestModeInterruption();
            return;
        }
        
        // SAFETY CHECK: Prevent VAD from triggering during AI speech
        // This happens when VAD picks up AI voice from speakers (echo)
        if (isSpeakingRef.current || isAudioPlayingRef.current) {
            console.log('⚠️ VAD: False barge-in detected (AI still speaking) - IGNORING');
            return;
        }
        
        // Stop AI audio immediately (keep element alive for iOS audio session)
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        
        // Clear audio state flags
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        isAudioPlayingRef.current = false;
        
        // Clear any paused state (clear audio queue)
        if (pausedAudioRef.current) {
            pausedAudioRef.current = null;
            setIsPaused(false);
        }
        
        // ECHO FIX: If using Whisper, clear the buffer (it contains AI voice) instead of
        // processing it immediately. The VAD onSpeechEnd handler will trigger processNow()
        // after the user finishes speaking, at which point the buffer contains only user voice.
        if (useWhisper && audioCapture.isCapturing) {
            console.log('🎙️ VAD: Clearing audio buffer (contained AI voice) - waiting for clean user audio');
            audioCapture.clearBuffer();
            audioCapture.setAISpeaking(false); // Resume capture for user voice
            return;
        }
        
        // SCRIBE PATH: handleVadSpeechStart already called scribe.resumeCapture(),
        // and Scribe handles transcript commit server-side via its own VAD. We must
        // NOT fall through to the Web Speech fallback below — pausing our local VAD
        // would prevent the SCRIBE_POST_SPEECH_DRAIN_MS timer from scheduling AND
        // stop us from detecting the user's next utterance, which is exactly what
        // produced the "v9 stops listening after AI message" dead-zone.
        if (useScribeRealtime) {
            return;
        }

        // OLD: Web Speech API path - Pause VAD and use fast-start retry loop
        if (vadRef.current?.isInitialized) {
            vadRef.current.pauseVAD();
            console.log('🎙️ VAD: Paused during speech recognition');
        }
        
        // Stop current listening session to prevent echo
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                console.log('🎙️ VAD: Recognition already stopped');
            }
        }
        
        console.log('🎙️ VAD: Starting full speech recognition after barge-in (fast-start)');
        // Fast-start retry loop: attempt immediately, then retry with short delays
        const attemptStart = (attemptNumber: number, maxAttempts: number = 10, maxTotalTime: number = 500) => {
            const startTime = Date.now();
            
            if (attemptNumber >= maxAttempts || (Date.now() - startTime) > maxTotalTime) {
                console.log(`🎙️ VAD: Fast-start exhausted (${attemptNumber} attempts), falling back to normal restart`);
                // Fallback to normal restart scheduler
                setTimeout(() => {
                    if (isMountedRef.current && prevMicEnabledRef.current) {
                        startListening();
                    }
                }, 100);
                return;
            }
            
            if (!isMountedRef.current || !prevMicEnabledRef.current) {
                return; // Exit if component unmounted or mic disabled
            }
            
            try {
                recognitionRef.current?.start();
                console.log(`🎙️ VAD: Fast-start succeeded on attempt ${attemptNumber + 1}`);
            } catch (e) {
                // Recognition not ready yet, retry with short delay
                const retryDelay = attemptNumber === 0 ? 0 : Math.min(25 + (attemptNumber * 10), 50);
                setTimeout(() => attemptStart(attemptNumber + 1, maxAttempts, maxTotalTime), retryDelay);
            }
        };
        
        // Start immediately (attempt 0)
        attemptStart(0);
    }, [testMode, handleTestModeInterruption, useWhisper, audioCapture, useScribeRealtime]);
    
    // VAD speech-end handler — drives both the Whisper "process now" trigger
    // AND the Scribe pause-after-silence behaviour. For Scribe we keep
    // streaming for SCRIBE_POST_SPEECH_DRAIN_MS after our local VAD reports
    // silence, so the last frames of the user's utterance reach the server
    // and Scribe's own VAD can fire a clean committed_transcript.
    const handleVadSpeechEnd = useCallback((_audio: Float32Array) => {
        if (useWhisper && audioCapture.isCapturing) {
            console.log('🎙️ VAD: Speech ended - triggering immediate Whisper processing');
            audioCapture.processNow();
        }

        if (useScribeRealtime && !isSpeakingRef.current) {
            if (scribePauseAfterSilenceTimerRef.current) {
                clearTimeout(scribePauseAfterSilenceTimerRef.current);
            }
            scribePauseAfterSilenceTimerRef.current = setTimeout(() => {
                scribe.pauseCapture();
                scribePauseAfterSilenceTimerRef.current = null;
                console.log(
                    `🎙️ Scribe: VAD silence — paused forwarding after ${SCRIBE_POST_SPEECH_DRAIN_MS}ms drain`,
                );
            }, SCRIBE_POST_SPEECH_DRAIN_MS);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useWhisper, audioCapture, useScribeRealtime]);

    // V9 keeps VAD active whenever the mic is on so STT uploads remain
    // speech-gated even when speaker playback is disabled. With the dual-VAD
    // edition (option 1 of the streaming TTS work), VAD is ALSO active when
    // Scribe is the realtime provider — its events drive the Scribe
    // pause/resume gate above instead of a fixed time tail.
    const vadEnabled =
        treatmentVersion === 'v9'
            ? isMicEnabled && !guidedMode
            : isMicEnabled && isSpeakerEnabled && !guidedMode;
    
    // Choose the correct handler based on test mode
    const vadSpeechHandler = testMode ? handleTestModeInterruption : handleVadBargeIn;

    // US-001: wrap the speech-start handler so every VAD trigger also bumps the counter that
    // useAudioCapture watches. Without this, OpenAI STT would keep receiving ambient silence
    // even when the user never speaks.
    //
    // Scribe path: this is also the gate that resumes outgoing audio frames
    // when the user starts talking. Three reasons we might ignore the event:
    //   • AI is still speaking — likely echo, never barge-in via VAD.
    //   • Echo guard window is active (just after AI ended) — likely
    //     speaker reverb, not real user voice.
    //   • Scribe isn't the active provider — no-op.
    const handleVadSpeechStart = useCallback(() => {
        setSpeechDetectedTrigger((prev) => prev + 1);

        if (useScribeRealtime) {
            if (isSpeakingRef.current) {
                console.log('🎙️ Scribe: VAD speech-start while AI speaking — IGNORED');
            } else if (scribeEchoGuardActiveRef.current) {
                console.log('🎙️ Scribe: VAD speech-start during echo guard — IGNORED (likely reverb)');
            } else {
                if (scribePauseAfterSilenceTimerRef.current) {
                    clearTimeout(scribePauseAfterSilenceTimerRef.current);
                    scribePauseAfterSilenceTimerRef.current = null;
                }
                scribe.resumeCapture();
                console.log('🎙️ Scribe: VAD detected user speech — resumed forwarding');
            }
        }

        vadSpeechHandler();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vadSpeechHandler, useScribeRealtime]);

    console.log(`🎙️ VAD: Using ${testMode ? 'TEST MODE' : 'REAL MODE'} handler`);
    
    const vadTimingOverrides = testMode
        ? undefined
        : {
            endOfSpeechTimeoutMs: 600,     // Was 900ms - reduced for faster transcription response
            midSpeechPauseToleranceMs: 400  // Keep at 400ms - lower values drop one-word answers
        };
    
    const vad = useVAD({
        enabled: vadEnabled,
        sensitivity: vadSensitivity,
        onSpeechStart: handleVadSpeechStart,
        // Whisper needs onSpeechEnd to flush its accumulator. Scribe needs
        // it to schedule the post-silence drain → pause. Either consumer
        // gets the same signal.
        onSpeechEnd: useWhisper || useScribeRealtime ? handleVadSpeechEnd : undefined,
        onVadLevel: onVadLevel,
        ...(vadTimingOverrides ?? {})
    });

    // US-001: expose VAD availability to useAudioCapture so it knows whether to enforce the
    // speech gate (VAD present) or fall back to the legacy auto-process timer (VAD absent).
    useEffect(() => {
        const isAvailable = vadEnabled && vad.isInitialized;
        setVadAvailable((prev) => (prev === isAvailable ? prev : isAvailable));
    }, [vadEnabled, vad.isInitialized]);
    
    // Store VAD in ref for access in speech recognition callbacks
    useEffect(() => {
        vadRef.current = vad;
    }, [vad]);
    
    // Update vadError state when VAD error changes
    useEffect(() => {
        setVadError(vad.error);
    }, [vad.error]);
    
    // Update refs when callbacks/props change (without triggering effects)
    useEffect(() => {
        onTranscriptRef.current = onTranscript;
        onAudioEndedRef.current = onAudioEnded;
        onRenderTextRef.current = onRenderText;
        guidedModeRef.current = guidedMode;
    }, [onTranscript, onAudioEnded, onRenderText, guidedMode]);

    // Initialize Speech Recognition (only runs once on mount, skip if using Whisper)
    useEffect(() => {
        isMountedRef.current = true; // Mark as mounted
        
        // Skip Web Speech Recognition initialization if using Whisper
        if (useWhisper) {
            console.log('🎤 Using Whisper - skipping Web Speech Recognition initialization');
            return;
        }
        
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = true; // Always-on listener to eliminate dead zones
                recognitionRef.current.interimResults = true; // Enable interim results for better responsiveness
                recognitionRef.current.lang = 'en-US';

                recognitionRef.current.onstart = () => {
                    const timestamp = Date.now();
                    console.log(`🎤 Natural Voice: Listening started at ${timestamp}`);
                    setIsListening(true);
                    setListeningState('listening');
                    // Clear restart attempt counter on successful start
                    restartAttemptCountRef.current = 0;
                };

                recognitionRef.current.onend = () => {
                    const timestamp = Date.now();
                    console.log(`🎤 Natural Voice: Listening ended unexpectedly at ${timestamp} (continuous mode)`);
                    setIsListening(false);
                    
                    // Clear any silence timer
                    if (silenceTimerRef.current) {
                        clearTimeout(silenceTimerRef.current);
                        silenceTimerRef.current = null;
                    }
                    
                    // Resume VAD monitoring after user finishes speaking
                    if (vadRef.current?.isInitialized && vadEnabled) {
                        vadRef.current.startVAD();
                        console.log('🎙️ VAD: Resumed monitoring after speech recognition');
                    }
                    
                    // In continuous mode, onend should only fire on errors or manual stop
                    // Auto-restart if mic enabled and not speaking (but NOT in guided mode)
                    if (prevMicEnabledRef.current && !isSpeakingRef.current && isMountedRef.current && !guidedMode) {
                        // Clear any pending restart
                        if (restartTimeoutRef.current) {
                            clearTimeout(restartTimeoutRef.current);
                            restartTimeoutRef.current = null;
                        }
                        
                        // Calculate backoff delay based on consecutive restart attempts
                        // Progressive backoff: 0ms → 50ms → 150ms → 400ms → 800ms (capped)
                        const backoffDelays = [0, 50, 150, 400, 800];
                        const delayIndex = Math.min(restartAttemptCountRef.current, backoffDelays.length - 1);
                        const restartDelay = backoffDelays[delayIndex];
                        
                        if (restartDelay > 0) {
                            console.log(`🔄 Natural Voice: Scheduling restart with ${restartDelay}ms backoff (attempt ${restartAttemptCountRef.current + 1})`);
                            setListeningState('restarting');
                        } else {
                            console.log(`🔄 Natural Voice: Scheduling immediate restart`);
                            setListeningState('restarting');
                        }
                        
                        lastRestartTimeRef.current = timestamp;
                        restartAttemptCountRef.current++;
                        
                        restartTimeoutRef.current = setTimeout(() => {
                            if (prevMicEnabledRef.current && !isSpeakingRef.current && isMountedRef.current && !guidedMode) {
                                console.log(`🔄 Natural Voice: Executing restart (scheduled at ${lastRestartTimeRef.current})`);
                                startListening();
                            }
                            restartTimeoutRef.current = null;
                        }, restartDelay);
                    } else if (guidedMode) {
                        console.log('🧘 Guided Mode: Not auto-restarting listening (PTT mode)');
                        setListeningState('idle');
                    } else {
                        setListeningState('idle');
                    }
                };

                recognitionRef.current.onresult = (event: any) => {
                    // Update last speech time for silence detection
                    lastSpeechTimeRef.current = Date.now();
                    
                    // Clear any existing silence timer
                    if (silenceTimerRef.current) {
                        clearTimeout(silenceTimerRef.current);
                        silenceTimerRef.current = null;
                    }
                    
                    // In continuous mode, collect all results (browser provides full transcript each time)
                    let fullInterimText = '';
                    let fullFinalText = '';
                    
                    for (let i = 0; i < event.results.length; i++) {
                        const result = event.results[i];
                        const transcript = result[0].transcript;
                        
                        if (result.isFinal) {
                            fullFinalText += transcript;
                        } else {
                            fullInterimText += transcript;
                        }
                    }
                    
                    // Update interim transcript for UI feedback
                    if (fullInterimText) {
                        setInterimTranscript(fullInterimText);
                        console.log('🎤 Natural Voice: Interim transcript:', fullInterimText);
                    }
                    
                    // In continuous mode, we need to detect when user is done speaking
                    // Set a silence timer - if it expires, treat accumulated text as final
                    if (fullFinalText || fullInterimText) {
                        silenceTimerRef.current = setTimeout(() => {
                            const timeSinceLastSpeech = Date.now() - lastSpeechTimeRef.current;
                            if (timeSinceLastSpeech >= SILENCE_TIMEOUT_MS) {
                                // User has been silent - finalize the transcript
                                const finalizedText = fullFinalText || fullInterimText;
                                if (finalizedText && finalizedText.trim()) {
                                    console.log('🎤 Natural Voice: Silence detected, finalizing transcript:', finalizedText);
                                    setInterimTranscript(''); // Clear interim
                                    onTranscriptRef.current(finalizedText.trim());
                                    // Clear restart attempt counter on successful result
                                    restartAttemptCountRef.current = 0;
                                }
                            }
                            silenceTimerRef.current = null;
                        }, SILENCE_TIMEOUT_MS);
                    }
                    
                    // Also immediately process any final results from the browser
                    if (fullFinalText && fullFinalText.trim()) {
                        console.log('🎤 Natural Voice: Final transcript received:', fullFinalText);
                        setInterimTranscript(''); // Clear interim on final
                        onTranscriptRef.current(fullFinalText.trim());
                        // Clear restart attempt counter on successful result
                        restartAttemptCountRef.current = 0;
                    }
                };

                recognitionRef.current.onerror = (event: any) => {
                    console.error('🎤 Natural Voice: Recognition error:', event.error);
                    if (event.error === 'not-allowed') {
                        setError('Microphone permission denied');
                        setListeningState('permissionDenied');
                    } else {
                        setListeningState('error');
                    }
                };
            } else {
                setError('Speech recognition not supported in this browser');
                setListeningState('unsupported');
            }
        }

        // Cleanup only on actual unmount
        return () => {
            console.log('🧹 Natural Voice: Component unmounting');
            isMountedRef.current = false;
            
            // Clear any pending restart
            if (restartTimeoutRef.current) {
                clearTimeout(restartTimeoutRef.current);
                restartTimeoutRef.current = null;
            }
            
            // Clear any pending silence timer
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
            
            // Stop speech recognition
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            // Stop any playing audio
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current = null;
            }
            // Clear paused state
            if (pausedAudioRef.current) {
                pausedAudioRef.current = null;
            }
            setIsSpeaking(false);
            isSpeakingRef.current = false;
            setIsPaused(false);
            audioCapture.setAISpeaking(false); // Clear echo prevention on unmount
        };
    }, [useWhisper, audioCapture]); // Re-run if Whisper flag changes

    // iOS PWA: re-activate the audio session when the page returns to the foreground.
    // iOS suspends the system audio session when the app is backgrounded or the screen
    // locks. Playing a zero-duration silent Audio element on visibility restore ensures
    // that the next real HTMLAudioElement.play() call won't be blocked.
    useEffect(() => {
        if (typeof document === 'undefined') return;

        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;
            if (!speakerEnabledRef.current) return;
            if (isSpeakingRef.current || isAudioPlayingRef.current) return;

            // Attempt a silent play to re-open the iOS audio session.
            try {
                const silent = new Audio(
                    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
                );
                silent.volume = 0;
                silent.play().catch(() => {
                    // Blocked — audio context still suspended; harmless, real plays will retry.
                });
            } catch {
                // Ignore — environment doesn't support Audio
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []); // stable — only refs are used inside

    // Handle mic/speaker state changes (separate effect)
    useEffect(() => {
        const wasMicEnabled = prevMicEnabledRef.current;
        const wasSpeakerEnabled = prevSpeakerEnabledRef.current;
        prevMicEnabledRef.current = isMicEnabled; // Update ref
        prevSpeakerEnabledRef.current = isSpeakerEnabled; // Update ref
        speakerEnabledRef.current = isSpeakerEnabled; // Sync immediate ref
        
        // Handle microphone disable
        if (wasMicEnabled && !isMicEnabled) {
            console.log('🔇 Natural Voice: Disabling microphone - stopping listening');
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            setIsListening(false);
            setListeningState('micDisabled');
        } else if (!wasMicEnabled && isMicEnabled) {
            console.log('🎤 Natural Voice: Enabling microphone - ready for listening');
            setListeningState('idle');
            // Don't auto-start here, let the other effect handle it
        }
        
        // Handle speaker disable
        if (wasSpeakerEnabled && !isSpeakerEnabled) {
            console.log('🔇 Natural Voice: Disabling speaker - stopping audio');
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current = null;
            }
            setIsSpeaking(false);
            isSpeakingRef.current = false;
            isAudioPlayingRef.current = false;
            audioCapture.setAISpeaking(false); // Clear echo prevention flag
        } else if (!wasSpeakerEnabled && isSpeakerEnabled) {
            console.log('🔊 Natural Voice: Enabling speaker - ready for playback');
            // Don't stop anything when enabling - let audio play!
        }
    }, [isMicEnabled, isSpeakerEnabled, audioCapture]);

    // Start listening helper
    const startListening = useCallback(() => {
        // If using Whisper, audio capture is handled by useAudioCapture hook
        if (useWhisper) {
            console.log('🎤 Using Whisper - audio capture managed by useAudioCapture hook');
            return;
        }
        
        // Don't start if audio is currently playing (prevents feedback loop)
        if (recognitionRef.current && !isSpeakingRef.current && !isAudioPlayingRef.current) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                // Ignore errors if already started
                console.log('🎤 Natural Voice: Already listening or error starting:', e);
            }
        } else if (isAudioPlayingRef.current) {
            console.log('🎤 Natural Voice: Skipping start - audio is playing (feedback prevention)');
            setListeningState('blockedByAudio');
        }
    }, [useWhisper]);

    // Force-restart listening: stop any existing session then start fresh.
    // Used by PTT to guarantee a clean recognition session even if one is already running.
    const forceRestartListening = useCallback(() => {
        if (useWhisper) {
            console.log('🎤 Using Whisper - force restart is a no-op');
            return;
        }
        if (!recognitionRef.current) return;
        try { recognitionRef.current.stop(); } catch (_e) { /* may already be stopped */ }
        setTimeout(() => {
            if (!isMountedRef.current) return;
            try {
                recognitionRef.current?.start();
                console.log('🎤 Natural Voice: Force-restarted recognition (clean PTT session)');
            } catch (_e) { /* ignore */ }
        }, 50);
    }, [useWhisper]);

    // Stop listening helper
    const stopListening = useCallback(() => {
        // If using Whisper, stopping is handled by useAudioCapture hook
        if (useWhisper) {
            console.log('🎤 Using Whisper - stop managed by useAudioCapture hook');
            return;
        }
        
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    }, [useWhisper]);

    // Stop speaking helper - immediately stops audio
    // Note: we intentionally keep audioRef.current alive (don't null it) so iOS
    // preserves the "unlocked" audio session on the reused element.
    const stopSpeaking = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        // Clear any paused state when stopping
        if (pausedAudioRef.current) {
            pausedAudioRef.current = null;
            setIsPaused(false);
        }
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        isAudioPlayingRef.current = false; // Clear audio playing flag
        audioCapture.setAISpeaking(false); // Clear echo prevention flag
        
        // Resume VAD when stopping speech
        if (vadRef.current?.isInitialized && vadEnabled) {
            vadRef.current.startVAD();
            console.log('🎙️ VAD: Resumed after stopping speech');
        }
        
        stopListening();
    }, [stopListening, audioCapture, vadEnabled]);

    // NEW: Pause speaking - saves position for resume
    const pauseSpeaking = useCallback(() => {
        console.log(`⏸️ Natural Voice: Pause requested. Current state - audioRef exists: ${!!audioRef.current}, isSpeakingRef: ${isSpeakingRef.current}, isAudioPlayingRef: ${isAudioPlayingRef.current}`);
        
        if (audioRef.current) {
            const currentTime = audioRef.current.currentTime;
            const currentAudio = audioRef.current;
            const isPaused = currentAudio.paused;
            
            console.log(`⏸️ Natural Voice: Audio state - currentTime: ${currentTime.toFixed(2)}s, paused: ${isPaused}`);
            
            // Save paused state (even if already paused, in case we need to resume)
            pausedAudioRef.current = {
                audio: currentAudio,
                time: currentTime,
                text: '' // We'll track this when we need to recreate
            };
            
            console.log(`⏸️ Natural Voice: Paused at ${currentTime.toFixed(2)}s (will remain paused indefinitely)`);
            
            // Pause the audio if it's not already paused
            if (!isPaused) {
                currentAudio.pause();
            }
            setIsPaused(true);
            setIsSpeaking(false);
            isSpeakingRef.current = false;
            isAudioPlayingRef.current = false;
            audioCapture.setAISpeaking(false); // Audio paused, resume mic capture
            
            // NOTE: No timeout - pause state persists until:
            // 1. User resumes playback
            // 2. New audio starts (cleared in speak() function)
            // 3. Speaker is turned off
            // This is safe - no memory leak as we clear on new audio
        } else {
            console.log('⏸️ Natural Voice: Cannot pause - no audio reference exists');
        }
    }, [audioCapture]);

    // NEW: Resume speaking - continues from paused position
    const resumeSpeaking = useCallback(() => {
        if (pausedAudioRef.current && isSpeakerEnabled) {
            const { audio, time } = pausedAudioRef.current;
            
            console.log(`▶️ Natural Voice: Resuming from ${time.toFixed(2)}s`);
            
            // Resume playback
            audioRef.current = audio;
            audio.currentTime = time;
            setIsSpeaking(true);
            isSpeakingRef.current = true;
            setIsPaused(false);
            audioCapture.setAISpeaking(true); // Pause mic capture while AI speaks
            
            audio.play().then(() => {
                isAudioPlayingRef.current = true;
                console.log('▶️ Natural Voice: Resumed successfully');
            }).catch((err) => {
                console.error('▶️ Natural Voice: Resume failed:', err);
                // Clear paused state on error
                pausedAudioRef.current = null;
                setIsPaused(false);
                setIsSpeaking(false);
                isSpeakingRef.current = false;
                audioCapture.setAISpeaking(false);
            });
            
            // Clear paused state after resuming
            pausedAudioRef.current = null;
        } else if (!isSpeakerEnabled) {
            console.log('⏸️ Natural Voice: Cannot resume - speaker disabled');
        }
    }, [isSpeakerEnabled, audioCapture]);

    // NEW: Check if there's paused audio available
    const hasPausedAudio = useCallback(() => {
        return pausedAudioRef.current !== null;
    }, []);

    // NEW: Force clear audio state flags (for PTT in guided mode)
    const clearAudioFlags = useCallback(() => {
        console.log('🔧 Natural Voice: Force clearing audio state flags');
        isSpeakingRef.current = false;
        isAudioPlayingRef.current = false;
        setIsSpeaking(false);
    }, []);

    /**
     * Normalize Opus blob type for stricter browser decoders (Safari/iOS PWA).
     */
    const normalizeAudioBlobType = useCallback((blob: Blob): Blob => {
        const unsupportedOrGenericType = !blob.type ||
            blob.type === 'audio/opus' ||
            blob.type === 'application/opus' ||
            blob.type === 'application/octet-stream';

        if (!unsupportedOrGenericType) {
            return blob;
        }

        return blob.slice(0, blob.size, 'audio/ogg; codecs=opus');
    }, []);

    /**
     * Fallback TTS path using browser SpeechSynthesis when streamed audio fails.
     * This is especially useful for mobile PWAs where codec policies can differ
     * from desktop browser emulation.
     */
    const speakWithSystemVoiceFallback = useCallback(async (text: string): Promise<boolean> => {
        if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) {
            return false;
        }

        // Don't play fallback voice if speaker is disabled
        if (!speakerEnabledRef.current) {
            console.log('🔊 Natural Voice: SpeechSynthesis fallback skipped - speaker disabled');
            return false;
        }

        return new Promise<boolean>((resolve) => {
            let finished = false;
            let safetyTimeout: ReturnType<typeof setTimeout> | null = null;
            const synth = window.speechSynthesis;

            const settle = (success: boolean) => {
                if (finished) return;
                finished = true;
                if (safetyTimeout) {
                    clearTimeout(safetyTimeout);
                }
                resolve(success);
            };

            try {
                synth.cancel();

                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = Math.max(0.5, Math.min(2.0, playbackRate));

                utterance.onstart = () => {
                    isAudioPlayingRef.current = true;
                    const audioStartTime = performance.now() - speakStartTimeRef.current;

                    // Keep visual timing behavior consistent with streamed playback.
                    setTimeout(() => {
                        if (!onRenderTextRef.current) return;
                        const textRenderTime = performance.now() - speakStartTimeRef.current;
                        onRenderTextRef.current({ audioStartTime, textRenderTime });
                    }, TEXT_RENDER_DELAY_MS);
                };

                utterance.onend = () => settle(true);
                utterance.onerror = (event) => {
                    console.error('🔊 Natural Voice: SpeechSynthesis fallback error:', event.error);
                    settle(false);
                };

                // Guard against a stalled utterance state.
                safetyTimeout = setTimeout(() => {
                    console.warn('🔊 Natural Voice: SpeechSynthesis fallback timed out');
                    synth.cancel();
                    settle(false);
                }, Math.max(15000, text.length * 150));

                synth.speak(utterance);
            } catch (fallbackError) {
                console.error('🔊 Natural Voice: SpeechSynthesis fallback exception:', fallbackError);
                settle(false);
            }
        });
    }, [playbackRate]);

    // Prefetch audio for a given text (uses global cache)
    const prefetch = useCallback(async (text: string) => {
        if (!text || globalAudioCache.has(text)) return;

        try {
            console.log('🗣️ Natural Voice: Prefetching (global cache):', text);
            const voiceToSend = voiceProvider === 'openai'
                ? (voiceId || kokoroVoiceId)
                : voiceProvider === 'elevenlabs'
                    ? elevenLabsVoiceId
                    : kokoroVoiceId;
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    ...(ttsProviderOverride
                        ? { provider: ttsProviderOverride }
                        : (voiceProvider ? { provider: voiceProvider } : {})),
                    voice: voiceToSend,
                    apiMessage: text,
                    treatmentVersion,
                }),
            });

            if (!response.ok) throw new Error('Prefetch failed');

            const provider = resolveTtsUsageProvider(voiceProvider, ttsProviderOverride);
            const cached = response.headers.get('X-TTS-Cache')?.toUpperCase() === 'HIT';
            onTtsUsage?.({
                provider,
                characters: text.length,
                estimatedUsd: estimateTtsUsageUsd(provider, text.length, cached),
                cached,
                source: 'prefetch',
            });

            const audioBlob = normalizeAudioBlobType(await response.blob());
            const audioUrl = URL.createObjectURL(audioBlob);
            globalAudioCache.set(text, audioUrl);
            console.log('🗣️ Natural Voice: Prefetch complete (global cache):', text);
        } catch (err) {
            console.error('🗣️ Natural Voice: Prefetch error:', err);
        }
    }, [voiceProvider, ttsProviderOverride, elevenLabsVoiceId, kokoroVoiceId, voiceId, normalizeAudioBlobType, treatmentVersion, onTtsUsage]);

    /**
     * Find if text starts with any cached static text for a specific voice
     * Returns { prefix, suffix } if found, null otherwise
     */
    const findCachedPrefixForVoice = useCallback((text: string, voiceName: string): { prefix: string; suffix: string } | null => {
        // Check each static text to see if our text starts with it
        for (const staticText of STATIC_TEXTS) {
            const cacheKey = `${voiceName}:${staticText}`;
            if (text.startsWith(staticText) && globalAudioCache.has(cacheKey)) {
                const suffix = text.slice(staticText.length).trim();
                if (suffix.length > 0) {
                    console.log(`🎵 Found cached prefix match for ${voiceName}!`);
                    console.log(`   Prefix (cached): "${staticText.substring(0, 50)}..."`);
                    console.log(`   Suffix (to stream): "${suffix.substring(0, 50)}..."`);
                    return { prefix: staticText, suffix };
                }
            }
        }
        return null;
    }, []);

    /**
     * Play a single audio segment and return a promise that resolves when done
     * NEW: Now tracks audio start time and triggers delayed text rendering
     */
    const playAudioSegment = useCallback(async (audioUrl: string, isLast: boolean): Promise<void> => {
        return new Promise((resolve, reject) => {
            const PLAYBACK_START_TIMEOUT_MS = 5000;
            let playbackStarted = false;
            let settled = false;
            let playbackStartTimeout: ReturnType<typeof setTimeout> | null = null;

            const resolveOnce = () => {
                if (settled) return;
                settled = true;
                if (playbackStartTimeout) {
                    clearTimeout(playbackStartTimeout);
                    playbackStartTimeout = null;
                }
                resolve();
            };

            const rejectOnce = (error: unknown) => {
                if (settled) return;
                settled = true;
                if (playbackStartTimeout) {
                    clearTimeout(playbackStartTimeout);
                    playbackStartTimeout = null;
                }
                reject(error instanceof Error ? error : new Error('Audio playback failed'));
            };

            // SPEAKER OFF FIX: Check ref immediately before playing
            // This catches the case where speaker was disabled during an async TTS fetch
            if (!speakerEnabledRef.current) {
                console.log('🔊 Natural Voice: Speaker disabled before playback, skipping audio segment');
                if (isLast) {
                    setIsSpeaking(false);
                    isSpeakingRef.current = false;
                    isAudioPlayingRef.current = false;
                    audioCapture.setAISpeaking(false);
                }
                resolveOnce();
                return;
            }
            
            // iOS audio session fix: REUSE the existing audio element instead of
            // creating a new one. iOS "unlocks" an Audio element on the first user-gesture
            // play; destroying it and creating a new element loses that unlock, causing
            // subsequent non-gesture plays to be silent.
            let audio: HTMLAudioElement;
            if (audioRef.current) {
                audioRef.current.pause();
                audio = audioRef.current;
            } else {
                audio = new Audio();
                audio.setAttribute('playsinline', 'true');
            }
            audio.src = audioUrl;
            audio.playbackRate = playbackRate;
            audio.preload = 'auto';
            audioRef.current = audio;

            // Some mobile PWA/WebKit combinations can stall before onplay/onerror.
            // Watchdog prevents the app from staying in "AI speaking" forever.
            // Capture the generation BEFORE the timeout so we can detect supersession.
            const timeoutGeneration = playGenerationRef.current;
            playbackStartTimeout = setTimeout(() => {
                if (playbackStarted) return;
                // A newer playAudioSegment call superseded us — don't interfere
                if (playGenerationRef.current !== timeoutGeneration) return;

                console.warn('🔊 Natural Voice: Playback start timeout (possible codec/autoplay issue)');
                audio.pause();

                audioCapture.setAISpeaking(false);
                if (vadRef.current?.isInitialized && vadEnabled) {
                    vadRef.current.startVAD();
                    console.log('🎙️ VAD: Resumed after playback timeout');
                }

                rejectOnce(new Error('Audio playback start timeout'));
            }, PLAYBACK_START_TIMEOUT_MS);

            audio.onplay = () => {
                playbackStarted = true;
                isAudioPlayingRef.current = true;
                // Latency-trace stamp #5: audio.onplay fired (real playback start).
                onAudioPlaybackStarted?.();
                const audioStartTime = performance.now() - speakStartTimeRef.current;
                console.log(`🔊 Natural Voice: Audio segment started at ${audioStartTime.toFixed(2)}ms from speak() call`);
                
                // NEW: Schedule text rendering slightly AFTER audio starts
                setTimeout(() => {
                    const textRenderTime = performance.now() - speakStartTimeRef.current;
                    console.log(`📝 Natural Voice: Text should render at ${textRenderTime.toFixed(2)}ms (${(textRenderTime - audioStartTime).toFixed(0)}ms after audio)`);
                    
                    // Notify parent component to render text now
                    if (onRenderTextRef.current) {
                        onRenderTextRef.current({
                            audioStartTime,
                            textRenderTime
                        });
                    }
                }, TEXT_RENDER_DELAY_MS); // Audio leads text to avoid perceived startup lag
            };

            audio.onended = () => {
                const audioCompleteTime = performance.now() - speakStartTimeRef.current;
                const absoluteEndTime = performance.now();
                console.log(`🗣️ Natural Voice: Audio segment ended at ${audioCompleteTime.toFixed(2)}ms (absolute=${absoluteEndTime.toFixed(2)}ms)`);
                if (isLast) {
                    // Resume capture before parent callbacks so immediate user speech is not dropped.
                    audioCapture.setAISpeaking(false); // Resume mic capture after AI finishes
                    audioCapture.startPostAudioFastFallbackWindow?.();
                    console.log(`🎙️ Natural Voice: Capture resume requested before audio-ended callback at ${performance.now().toFixed(2)}ms`);

                    setIsSpeaking(false);
                    isSpeakingRef.current = false;
                    isAudioPlayingRef.current = false;
                    
                    // Resume VAD after AI finishes speaking
                    if (vadRef.current?.isInitialized && vadEnabled) {
                        vadRef.current.startVAD();
                        console.log(`🎙️ VAD: Resumed after AI finished speaking at ${performance.now().toFixed(2)}ms`);
                    }
                    
                    // Only restart listening if mic is enabled AND not in guided/PTT mode.
                    // In PTT mode the user controls when the mic is live via the orb button.
                    if (isMicEnabled && isMountedRef.current && !guidedModeRef.current) {
                        startListening();
                    }
                    console.log(`🔊 Natural Voice: Running audio-ended callback at ${performance.now().toFixed(2)}ms`);
                    onAudioEndedRef.current?.();
                }
                resolveOnce();
            };

            audio.onerror = () => {
                audioCapture.setAISpeaking(false);
                // Resume VAD after error
                if (vadRef.current?.isInitialized && vadEnabled) {
                    vadRef.current.startVAD();
                    console.log('🎙️ VAD: Resumed after audio error');
                }
                rejectOnce(new Error('Audio playback error'));
            };

            // Track which "generation" of playback this is so the AbortError handler
            // can detect whether a newer speak() call has already taken over.
            // We use a counter instead of element identity because we now reuse the
            // same Audio element across calls (for iOS audio session persistence).
            playGenerationRef.current++;
            const thisGeneration = playGenerationRef.current;

            audio.play().catch((playError) => {
                if (playError instanceof Error && playError.name === 'AbortError') {
                    // If a newer generation has started, this abort is expected — don't
                    // touch global state, just resolve cleanly.
                    if (playGenerationRef.current !== thisGeneration) {
                        console.log('🔊 Natural Voice: Superseded audio aborted (expected) — skipping state cleanup');
                        resolveOnce();
                        return;
                    }

                    console.log('🔊 Natural Voice: Audio playback interrupted (expected during cleanup)');
                    // CRITICAL: Clear the audio playing flags so listening can restart!
                    isAudioPlayingRef.current = false;
                    isSpeakingRef.current = false;
                    setIsSpeaking(false);
                    audioCapture.setAISpeaking(false);
                    // Resume VAD after abort
                    if (vadRef.current?.isInitialized && vadEnabled) {
                        vadRef.current.startVAD();
                        console.log('🎙️ VAD: Resumed after audio abort');
                    }
                    // Restart listening after a brief delay (only if mic enabled and not PTT)
                    if (isMicEnabled && isMountedRef.current && !guidedModeRef.current) {
                        setTimeout(() => startListening(), 300);
                    }
                    resolveOnce(); // Not an error, just cleanup
                } else {
                    audioCapture.setAISpeaking(false);
                    // Resume VAD after error
                    if (vadRef.current?.isInitialized && vadEnabled) {
                        vadRef.current.startVAD();
                        console.log('🎙️ VAD: Resumed after play error');
                    }
                    rejectOnce(playError);
                }
            });
        });
    }, [isMicEnabled, startListening, playbackRate, audioCapture, vadEnabled, onAudioPlaybackStarted]);

    // ─────────────────────────────────────────────────────────────────────
    // MSE streaming TTS
    //
    // Browser-side MediaSource Extensions consumer for /api/tts. Pipes the
    // upstream provider's audio (MP3 from OpenAI/EL, OGG/Opus from Kokoro)
    // straight into an Audio element via SourceBuffer chunks, so playback
    // can start before synthesis completes — a meaningful win for OpenAI
    // and Kokoro turns where the existing buffered path adds the full
    // synth duration to user-perceived latency.
    //
    // Three guards keep this safe:
    //   • Pre-flight codec probe — Safari MSE does not support MP3 or
    //     Opus, so we never attempt streaming there. iOS PWAs continue
    //     using the buffered blob path with no change.
    //   • Per-session fallback — any MSE error (codec mismatch, source
    //     buffer abort, decoder failure) sets `streamingDisabledRef.current
    //     = true` and the next utterance silently uses fetchTTSAudio.
    //   • Dual-pipe cache — chunks are accumulated into a `Uint8Array[]`
    //     in parallel with appending to the SourceBuffer; on stream end
    //     the array becomes a Blob, the URL goes into globalAudioCache.
    //     Future plays of the same `${voice}:${text}` replay from cache
    //     for $0 the same way the buffered path always has.
    // ─────────────────────────────────────────────────────────────────────

    /** Map a TTS Content-Type header to the MIME string MSE expects. */
    const mapContentTypeToMSEMime = (contentType: string): string | null => {
        const ct = contentType.toLowerCase();
        if (ct.includes('audio/mpeg')) return 'audio/mpeg';
        if (ct.includes('audio/ogg')) return 'audio/ogg; codecs="opus"';
        if (ct.includes('audio/webm')) return 'audio/webm; codecs="opus"';
        // WAV cannot be streamed via MSE — needs the full RIFF header up
        // front before the decoder produces a sample.
        return null;
    };

    /** True if we should even attempt MSE streaming in this browser. */
    const isMSEAvailable = (): boolean => {
        return typeof window !== 'undefined' && typeof MediaSource !== 'undefined';
    };

    /**
     * Fetch + stream TTS audio via MediaSource Extensions. Returns a
     * MediaSource object URL ready to be assigned to `audio.src`; data
     * streams in asynchronously so the Audio element starts playing as
     * soon as enough buffer is decoded.
     *
     * Returns `null` if streaming is disabled (Safari, prior failure, MSE
     * unavailable, codec mismatch from upstream Content-Type) — caller
     * MUST then fall back to `fetchTTSAudio`.
     */
    const streamTTSAudioViaMSE = useCallback(
        async (text: string, voiceName: string): Promise<string | null> => {
            if (streamingDisabledRef.current || !isMSEAvailable()) return null;

            const voiceToSend = voiceProvider === 'openai'
                ? (voiceId || kokoroVoiceId)
                : voiceProvider === 'elevenlabs'
                    ? elevenLabsVoiceId
                    : kokoroVoiceId;

            // Latency-trace stamp #3 (TTS request dispatched). Mirrors the
            // buffered path so the chip's `→TTS req` segment is consistent
            // across both code paths.
            onTtsRequested?.();

            let response: Response;
            try {
                response = await fetch('/api/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text,
                        ...(ttsProviderOverride
                            ? { provider: ttsProviderOverride }
                            : (voiceProvider ? { provider: voiceProvider } : {})),
                        voice: voiceToSend,
                        apiMessage: text,
                        treatmentVersion,
                    }),
                });
            } catch (err) {
                // Network error — let the caller fall back. Don't disable
                // streaming for this since a buffered fetch would have
                // failed too.
                throw err;
            }

            if (!response.ok || !response.body) {
                // Non-2xx or no body to stream — let caller's existing
                // error handling kick in (which uses fetchTTSAudio's
                // structured tts_provider_failure parsing).
                return null;
            }

            const routeMsHeader = response.headers.get('X-Tts-Route-Ms');
            if (routeMsHeader !== null) {
                const routeMs = Number(routeMsHeader);
                if (Number.isFinite(routeMs)) onTtsRouteMs?.(routeMs);
            }

            const provider = resolveTtsUsageProvider(voiceProvider, ttsProviderOverride);
            const cached = response.headers.get('X-TTS-Cache')?.toUpperCase() === 'HIT';
            onTtsUsage?.({
                provider,
                characters: text.length,
                estimatedUsd: estimateTtsUsageUsd(provider, text.length, cached),
                cached,
                source: 'playback',
            });

            const contentType = response.headers.get('Content-Type') ?? '';
            const mseMime = mapContentTypeToMSEMime(contentType);
            if (!mseMime || !MediaSource.isTypeSupported(mseMime)) {
                // Codec the route returned isn't MSE-streamable in this
                // browser (e.g. Kokoro WAV on iOS, MP3 on Safari).
                // Drain the response into a blob and write to cache so
                // the caller can still play it via the buffered path —
                // we don't want to waste the network round-trip we just
                // did. We hand the blob URL back via the cache; caller
                // checks the cache before re-fetching.
                const blob = normalizeAudioBlobType(await response.blob());
                onTtsFirstChunk?.();
                const blobUrl = URL.createObjectURL(blob);
                globalAudioCache.set(`${voiceName}:${text}`, blobUrl);
                return null;
            }

            const ms = new MediaSource();
            const msUrl = URL.createObjectURL(ms);
            const accumChunks: Uint8Array[] = [];
            let firstChunkSeen = false;

            const cleanupOnFailure = (err: unknown) => {
                console.warn(
                    '[NaturalVoice] MSE streaming error — disabling streaming for this session:',
                    err,
                );
                streamingDisabledRef.current = true;
                try { URL.revokeObjectURL(msUrl); } catch { /* ignore */ }
            };

            // Once `sourceopen` fires we can attach a SourceBuffer and start
            // pumping chunks. The function returns the MS URL synchronously
            // (via the outer Promise), so the caller can `audio.src = url`
            // and play() while data continues to arrive.
            ms.addEventListener('sourceopen', () => {
                let sb: SourceBuffer;
                try {
                    sb = ms.addSourceBuffer(mseMime);
                } catch (err) {
                    cleanupOnFailure(err);
                    return;
                }

                const reader = response.body!.getReader();
                let endOfStreamCalled = false;

                const waitForUpdateEnd = (target: SourceBuffer): Promise<void> =>
                    new Promise((resolve) => {
                        if (!target.updating) { resolve(); return; }
                        const onEnd = () => {
                            target.removeEventListener('updateend', onEnd);
                            resolve();
                        };
                        target.addEventListener('updateend', onEnd);
                    });

                const pump = async () => {
                    try {
                        // eslint-disable-next-line no-constant-condition
                        while (true) {
                            const { value, done } = await reader.read();
                            if (done) break;
                            if (!value) continue;

                            if (!firstChunkSeen) {
                                firstChunkSeen = true;
                                onTtsFirstChunk?.();
                            }
                            accumChunks.push(value);

                            await waitForUpdateEnd(sb);
                            // ms.readyState may have flipped to 'ended' if the
                            // user navigated away mid-stream — guard the append.
                            if (ms.readyState !== 'open') break;
                            try {
                                sb.appendBuffer(value);
                            } catch (appendErr) {
                                cleanupOnFailure(appendErr);
                                return;
                            }
                        }

                        await waitForUpdateEnd(sb);
                        if (ms.readyState === 'open' && !endOfStreamCalled) {
                            try {
                                ms.endOfStream();
                                endOfStreamCalled = true;
                            } catch (eosErr) {
                                cleanupOnFailure(eosErr);
                                return;
                            }
                        }

                        // Dual-pipe cache write. The MS URL itself is
                        // single-use (a MediaSource can't replay from
                        // start once endOfStream is called and the audio
                        // element disposes it), so we cache a fresh blob
                        // URL built from the accumulated chunks. Future
                        // plays of the same text replay from this for $0.
                        const totalBytes = accumChunks.reduce((acc, c) => acc + c.length, 0);
                        const merged = new Uint8Array(totalBytes);
                        let offset = 0;
                        for (const c of accumChunks) {
                            merged.set(c, offset);
                            offset += c.length;
                        }
                        const cachedBlob = normalizeAudioBlobType(
                            new Blob([merged], { type: contentType }),
                        );
                        const cacheUrl = URL.createObjectURL(cachedBlob);
                        globalAudioCache.set(`${voiceName}:${text}`, cacheUrl);
                    } catch (err) {
                        cleanupOnFailure(err);
                    }
                };

                pump();
            });

            return msUrl;
        },
        [
            voiceProvider, ttsProviderOverride, elevenLabsVoiceId, kokoroVoiceId, voiceId,
            normalizeAudioBlobType, treatmentVersion, onTtsUsage, onTtsRequested,
            onTtsFirstChunk, onTtsRouteMs,
        ],
    );

    /**
     * Fetch TTS audio for text and return the audio URL
     */
    const fetchTTSAudio = useCallback(async (text: string, voiceName: string): Promise<string> => {
        const voiceToSend = voiceProvider === 'openai'
            ? (voiceId || kokoroVoiceId)
            : voiceProvider === 'elevenlabs'
                ? elevenLabsVoiceId
                : kokoroVoiceId;
        // Latency-trace stamp #3: TTS request dispatched.
        onTtsRequested?.();
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                ...(ttsProviderOverride
                    ? { provider: ttsProviderOverride }
                    : (voiceProvider ? { provider: voiceProvider } : {})),
                voice: voiceToSend,
                apiMessage: text,
                treatmentVersion,
            }),
        });

        if (!response.ok) {
            let errorMessage = 'TTS request failed';
            try {
                const errorData = await response.json();
                errorMessage = errorData.details || errorData.message || errorData.error || errorMessage;
                if (errorData.code === 'tts_provider_failure' && errorData.provider) {
                    onSpeechProviderError?.({
                        kind: 'tts',
                        provider: errorData.provider,
                        message: errorMessage,
                    });
                }
            } catch {
                // Fall back to generic error below.
            }
            throw new Error(errorMessage);
        }

        const provider = resolveTtsUsageProvider(voiceProvider, ttsProviderOverride);
        const cached = response.headers.get('X-TTS-Cache')?.toUpperCase() === 'HIT';
        // Latency-trace: server-reported route processing time (parsing,
        // validation, voice mapping, cache lookup) before the upstream
        // provider was actually called. Same-origin response, no CORS
        // expose-headers needed.
        const routeMsHeader = response.headers.get('X-Tts-Route-Ms');
        if (routeMsHeader !== null) {
            const routeMs = Number(routeMsHeader);
            if (Number.isFinite(routeMs)) onTtsRouteMs?.(routeMs);
        }
        onTtsUsage?.({
            provider,
            characters: text.length,
            estimatedUsd: estimateTtsUsageUsd(provider, text.length, cached),
            cached,
            source: 'playback',
        });

        const audioBlob = normalizeAudioBlobType(await response.blob());
        // Latency-trace stamp #4: first audio chunk (the full blob, in
        // practice — /api/tts returns once the buffer is ready) is in hand.
        onTtsFirstChunk?.();
        const audioUrl = URL.createObjectURL(audioBlob);
        // Use voice-prefixed cache key
        const cacheKey = `${voiceName}:${text}`;
        globalAudioCache.set(cacheKey, audioUrl);
        return audioUrl;
    }, [voiceProvider, ttsProviderOverride, elevenLabsVoiceId, kokoroVoiceId, voiceId, normalizeAudioBlobType, treatmentVersion, onSpeechProviderError, onTtsUsage, onTtsRequested, onTtsFirstChunk, onTtsRouteMs]);

    // US-006: single source of truth — return a stable unique string for every supported voice,
    // never "unknown". The `voiceId` prop (US-007) takes priority on v7 OpenAI sessions.
    const resolvedVoiceId = voiceProvider === 'openai'
        ? (voiceId || kokoroVoiceId) // v7 OpenAI: prefer explicit voiceId prop, fallback to legacy id
        : voiceProvider === 'elevenlabs'
            ? elevenLabsVoiceId
            : kokoroVoiceId;
    const currentVoiceName = getVoiceCacheName(resolvedVoiceId);

    // Speak text with streaming support, voice-prefixed cache check, AND smart prefix matching
    // Only plays audio if speaker is enabled
    const speak = useCallback(async (text: string, options?: SpeechRequestOptions) => {
        if (!text) return;

        // R8: V9 shares V7's speech-compliance guard. Since V9 renders exactly
        // what the backend returned (R7), the `apiMessage` and `text` should
        // always match — the guard catches any client-side divergence.
        if (treatmentVersion === 'v7' || treatmentVersion === 'v9') {
            const complianceResult = validateSpeechOutput({
                textToSpeak: text,
                apiMessage: options?.apiMessage ?? text,
            });

            if (!complianceResult.ok) {
                console.error('🛡️ Natural Voice: Speech suppressed by compliance guard', complianceResult);
                setError(`Speech suppressed: ${complianceResult.reason}`);
                return;
            }
        }
        
        // SPEAKER OFF FIX: Use ref for immediate check (not stale closure)
        // This prevents audio from starting after speaker was disabled during an async gap
        if (!speakerEnabledRef.current) {
            console.log('🔇 Natural Voice: Speaker disabled, skipping audio playback');
            return;
        }

        // Clear any paused state when starting new audio
        if (pausedAudioRef.current) {
            console.log('🗑️ Natural Voice: Clearing paused state - new message starting');
            pausedAudioRef.current = null;
            setIsPaused(false);
        }

        // NEW: Track when speak() was called for timing measurements
        speakStartTimeRef.current = performance.now();
        console.log(`⏱️ Natural Voice: speak() called at ${speakStartTimeRef.current.toFixed(2)}ms`);

        // Stop listening while speaking
        stopListening();
        setIsSpeaking(true);
        isSpeakingRef.current = true;
        isAudioPlayingRef.current = false;
        
        // ECHO PREVENTION: Tell audio capture that AI is speaking
        audioCapture.setAISpeaking(true);
        
        // CRITICAL: Pause VAD to prevent it from detecting AI voice as user speech
        if (vadRef.current?.isInitialized) {
            try {
                await vadRef.current.pauseVAD();
                console.log('🎙️ VAD: Paused for AI speech (prevents self-triggering)');
            } catch (e) {
                console.warn('🎙️ VAD: Failed to pause, may self-trigger:', e);
            }
        }

        // Voice-prefixed cache key
        const cacheKey = `${currentVoiceName}:${text}`;

        try {
            // 1. Check if FULL text is cached for this voice
            if (globalAudioCache.has(cacheKey)) {
                console.log(`🗣️ Natural Voice: Playing FULL text from cache (${currentVoiceName})`);
                console.log('   💰 Cost: $0');
                const audioUrl = globalAudioCache.get(cacheKey)!;
                await playAudioSegment(audioUrl, true);
                return;
            }

            // 2. Check if text STARTS WITH a cached prefix (combined auto-advance messages)
            const prefixMatch = findCachedPrefixForVoice(text, currentVoiceName);
            if (prefixMatch) {
                console.log(`🗣️ Natural Voice: Smart split - playing cached prefix (${currentVoiceName}) then streaming suffix`);
                console.log('   💰 Cost: Only suffix streamed (prefix from cache)');
                
                // Play cached prefix first
                const prefixCacheKey = `${currentVoiceName}:${prefixMatch.prefix}`;
                const prefixUrl = globalAudioCache.get(prefixCacheKey)!;
                await playAudioSegment(prefixUrl, false);

                // Check if still mounted/speaking/speaker-enabled before continuing
                if (!isMountedRef.current || !isSpeakingRef.current || !speakerEnabledRef.current) {
                    console.log('🗣️ Natural Voice: Stopped before suffix playback');
                    audioCapture.setAISpeaking(false);
                    // Resume VAD after AI finishes
                    if (vadRef.current?.isInitialized && vadEnabled) {
                        vadRef.current.startVAD();
                        console.log('🎙️ VAD: Resumed after AI stopped early');
                    }
                    return;
                }

                // Now fetch and play the suffix (only part that costs $).
                // Try MSE streaming first; fall back to the buffered blob
                // path when streaming isn't available (Safari, prior MSE
                // failure, codec mismatch from upstream).
                console.log('🗣️ Natural Voice: Streaming suffix only:', prefixMatch.suffix.substring(0, 50) + '...');
                const suffixStreamUrl = await streamTTSAudioViaMSE(prefixMatch.suffix, currentVoiceName);
                const suffixUrl = suffixStreamUrl
                    ?? globalAudioCache.get(`${currentVoiceName}:${prefixMatch.suffix}`)
                    ?? await fetchTTSAudio(prefixMatch.suffix, currentVoiceName);

                // Check again after async TTS fetch
                if (!speakerEnabledRef.current || !isMountedRef.current) {
                    console.log('🗣️ Natural Voice: Speaker disabled during TTS fetch, aborting');
                    audioCapture.setAISpeaking(false);
                    setIsSpeaking(false);
                    isSpeakingRef.current = false;
                    // Resume VAD after AI finishes
                    if (vadRef.current?.isInitialized && vadEnabled) {
                        vadRef.current.startVAD();
                        console.log('🎙️ VAD: Resumed after AI stopped during fetch');
                    }
                    return;
                }
                
                await playAudioSegment(suffixUrl, true);
                return;
            }

            // 3. No cache match - try MSE streaming, then fall back to
            //    buffered fetch. Streaming starts playback before the full
            //    blob is in hand, so total user-perceived turn latency
            //    drops by roughly the synth duration on supported browsers.
            console.log(`🗣️ Natural Voice: No cache for ${currentVoiceName} - streaming full text`);
            console.log('   Text:', text.substring(0, 80) + '...');
            const streamUrl = await streamTTSAudioViaMSE(text, currentVoiceName);
            // streamTTSAudioViaMSE returns null for: streaming-disabled,
            // unsupported codec, non-2xx response. In the codec-mismatch
            // case it has already populated globalAudioCache with a blob
            // URL from the drained response, so we use that to avoid a
            // second network round-trip; otherwise we fall through to the
            // legacy buffered path.
            const audioUrl = streamUrl
                ?? globalAudioCache.get(`${currentVoiceName}:${text}`)
                ?? await fetchTTSAudio(text, currentVoiceName);
            
            // SPEAKER OFF FIX: Check again after async TTS fetch
            if (!speakerEnabledRef.current || !isMountedRef.current) {
                console.log('🗣️ Natural Voice: Speaker disabled during TTS fetch, aborting');
                audioCapture.setAISpeaking(false);
                setIsSpeaking(false);
                isSpeakingRef.current = false;
                // Resume VAD after AI finishes
                if (vadRef.current?.isInitialized && vadEnabled) {
                    vadRef.current.startVAD();
                    console.log('🎙️ VAD: Resumed after AI stopped during full fetch');
                }
                return;
            }
            
            await playAudioSegment(audioUrl, true);

        } catch (err) {
            console.error('🗣️ Natural Voice: TTS error:', err);

            // Last-resort fallback for legacy mobile/PWA codec issues.
            // V7/V9 use an explicit backup-provider / text-fallback prompt at
            // the session-component layer instead of silently switching
            // voices via the browser's SpeechSynthesis engine.
            if (speakerEnabledRef.current && treatmentVersion !== 'v7' && treatmentVersion !== 'v9') {
                const fallbackWorked = await speakWithSystemVoiceFallback(text);
                if (fallbackWorked) {
                    console.log('🗣️ Natural Voice: Recovered with SpeechSynthesis fallback');
                    setIsSpeaking(false);
                    isSpeakingRef.current = false;
                    isAudioPlayingRef.current = false;
                    audioCapture.setAISpeaking(false);
                    if (vadRef.current?.isInitialized && vadEnabled) {
                        vadRef.current.startVAD();
                        console.log('🎙️ VAD: Resumed after SpeechSynthesis fallback');
                    }
                    if (isMicEnabled && isMountedRef.current) {
                        startListening();
                    }
                    onAudioEndedRef.current?.();
                    return;
                }
            }

            setIsSpeaking(false);
            isSpeakingRef.current = false;
            isAudioPlayingRef.current = false;
            audioCapture.setAISpeaking(false); // Clear echo prevention on error
            // Resume VAD after error
            if (vadRef.current?.isInitialized && vadEnabled) {
                vadRef.current.startVAD();
                console.log('🎙️ VAD: Resumed after TTS error');
            }
            // Only restart listening if mic is enabled
            if (isMicEnabled && isMountedRef.current) {
                startListening();
            }
        }
    }, [isMicEnabled, stopListening, playAudioSegment, fetchTTSAudio, streamTTSAudioViaMSE, startListening, currentVoiceName, findCachedPrefixForVoice, audioCapture, vadEnabled, speakWithSystemVoiceFallback, treatmentVersion]);

    // Handle mic/speaker state changes - start/stop listening based on mic state (but not in guided mode)
    useEffect(() => {
        // In guided mode, do NOT auto-start listening - user controls via PTT
        if (guidedMode) {
            return;
        }
        
        if (isMicEnabled && !isSpeaking && isMountedRef.current) {
            startListening();
        } else if (!isMicEnabled) {
            stopListening();
        }
        // Note: Audio stopping is handled in the mic/speaker state change effect above
    }, [isMicEnabled, isSpeaking, startListening, stopListening, guidedMode]);

    return {
        isListening: useScribeRealtime
            ? scribe.isCapturing
            : useWhisper ? audioCapture.isCapturing : isListening,
        isSpeaking,
        isPaused,
        speak,
        prefetch,
        error: error || (useWhisper && !useScribeRealtime ? audioCapture.error : null),
        vadError, // VAD-specific error
        startListening,
        stopListening,
        forceRestartListening,
        stopSpeaking,
        pauseSpeaking,
        resumeSpeaking,
        hasPausedAudio,
        clearAudioFlags,
        processNow: useScribeRealtime ? scribe.commitNow : audioCapture.processNow,
        // PTT controls for Scribe (no-ops on other providers)
        scribePauseCapture: scribe.pauseCapture,
        scribeResumeCapture: scribe.resumeCapture,
        scribeCommitNow: scribe.commitNow,
        isUsingScribeRealtime: useScribeRealtime,
        interimTranscript: useScribeRealtime
            ? interimTranscript  // populated by scribe.onPartialTranscript
            : useWhisper
                ? (whisperProcessing ? '...' : '')
                : interimTranscript,
        listeningState: useScribeRealtime
            ? (scribe.isCapturing ? 'listening' : 'idle')
            : useWhisper
                ? (audioCapture.isCapturing ? 'listening' : 'idle')
                : listeningState,
        // Expose for debugging
        isProcessing: useScribeRealtime
            ? scribe.isProcessing
            : useWhisper ? audioCapture.isProcessing : false,
    };
};
