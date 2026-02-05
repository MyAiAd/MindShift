'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { globalAudioCache } from '@/services/voice/audioCache';
import { V4_STATIC_AUDIO_TEXTS } from '@/lib/v4/static-audio-texts';
import { useVAD } from './useVAD';
import { useAudioCapture } from './useAudioCapture';

// Get all static texts for prefix matching
const STATIC_TEXTS = Object.values(V4_STATIC_AUDIO_TEXTS);

interface UseNaturalVoiceProps {
    onTranscript: (transcript: string) => void;
    enabled: boolean; // DEPRECATED: For backward compatibility, replaced by micEnabled + speakerEnabled
    micEnabled?: boolean; // NEW: Controls microphone input separately
    speakerEnabled?: boolean; // NEW: Controls audio output separately
    voiceProvider?: 'openai' | 'elevenlabs' | 'kokoro';
    elevenLabsVoiceId?: string;
    kokoroVoiceId?: string;
    onAudioEnded?: () => void;
    playbackRate?: number; // 0.5 to 2.0, default 1.0
    onRenderText?: (timing: { audioStartTime: number; textRenderTime: number }) => void; // NEW: Callback when text should render
    guidedMode?: boolean; // NEW: If true, disables auto-restart of listening (for PTT mode)
    vadSensitivity?: number; // VAD sensitivity (0.1-0.9)
    onVadLevel?: (level: number) => void; // VAD level callback
    testMode?: boolean; // NEW: If true, VAD won't trigger speech recognition (for testing)
    onTestInterruption?: () => void; // NEW: Callback when VAD detects speech in test mode
}

export const useNaturalVoice = ({
    onTranscript,
    enabled,
    micEnabled,
    speakerEnabled,
    voiceProvider = 'kokoro',
    elevenLabsVoiceId = '21m00Tcm4TlvDq8ikWAM', // Rachel
    kokoroVoiceId = 'af_heart', // Default to Heart (Rachel)
    onAudioEnded,
    playbackRate = 1.0,
    onRenderText, // NEW: Callback for text rendering timing
    guidedMode = false, // NEW: Guided mode flag
    vadSensitivity = 0.5, // VAD sensitivity
    onVadLevel, // VAD level callback
    testMode = false, // NEW: Test mode flag to prevent VAD triggering speech recognition
    onTestInterruption, // NEW: Callback when VAD detects speech in test mode
}: UseNaturalVoiceProps) => {
    // Backward compatibility: if micEnabled/speakerEnabled not provided, use 'enabled'
    const isMicEnabled = micEnabled !== undefined ? micEnabled : enabled;
    const isSpeakerEnabled = speakerEnabled !== undefined ? speakerEnabled : enabled;
    
    // Feature flag: Use Whisper or Web Speech API
    const useWhisper = typeof window !== 'undefined' && 
                       process.env.NEXT_PUBLIC_TRANSCRIPTION_PROVIDER === 'whisper';
    
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [vadError, setVadError] = useState<string | null>(null); // VAD-specific error
    const [interimTranscript, setInterimTranscript] = useState<string>(''); // NEW: Interim transcript for UI feedback
    
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
    const speakStartTimeRef = useRef<number>(0); // NEW: Track when speak() was called
    const vadRef = useRef<any>(null); // Track VAD instance for resuming after speech
    
    // Restart scheduler state - for backoff/loop prevention
    const restartAttemptCountRef = useRef(0); // Track consecutive restart attempts without success
    const lastRestartTimeRef = useRef(0); // Track when last restart was scheduled
    const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Track pending restart
    
    // Continuous mode: track last speech time to detect silence and finalize transcripts
    const lastSpeechTimeRef = useRef<number>(0);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const SILENCE_TIMEOUT_MS = 1500; // 1.5s of silence = done speaking (trigger deployment)
    
    // Audio capture for Whisper transcription (only if enabled)
    const audioCapture = useAudioCapture({
        enabled: isMicEnabled && useWhisper,
        onTranscript: (transcript) => {
            console.log('🎤 Whisper transcript:', transcript);
            onTranscriptRef.current(transcript);
        },
        vadTrigger: false, // We'll manually trigger via processNow()
    });
    
    // Test mode handler - called when user speaks during test mode
    const handleTestModeInterruption = useCallback(() => {
        console.log('🧪 VAD: Test mode interruption detected (TEST MODE ACTIVE)');
        
        // Stop AI audio for visual feedback
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
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
        
        // Stop AI audio immediately
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
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
        
        // NEW: If using Whisper, process buffered audio immediately
        if (useWhisper && audioCapture.isCapturing) {
            console.log('🎙️ VAD: Processing buffered audio via Whisper (no handoff delay!)');
            audioCapture.processNow();
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
    }, [testMode, handleTestModeInterruption, useWhisper, audioCapture]);
    
    // Initialize VAD - only when both mic AND speaker are enabled
    const vadEnabled = isMicEnabled && isSpeakerEnabled;
    
    // Choose the correct handler based on test mode
    const vadSpeechHandler = testMode ? handleTestModeInterruption : handleVadBargeIn;
    
    console.log(`🎙️ VAD: Using ${testMode ? 'TEST MODE' : 'REAL MODE'} handler`);
    
    const vadTimingOverrides = testMode
        ? undefined
        : {
            endOfSpeechTimeoutMs: 900,
            midSpeechPauseToleranceMs: 400
        };
    
    const vad = useVAD({
        enabled: vadEnabled,
        sensitivity: vadSensitivity,
        onSpeechStart: vadSpeechHandler,
        onVadLevel: onVadLevel,
        ...(vadTimingOverrides ?? {})
    });
    
    // Store VAD in ref for access in speech recognition callbacks
    useEffect(() => {
        vadRef.current = vad;
    }, [vad]);
    
    // Update vadError state when VAD error changes
    useEffect(() => {
        setVadError(vad.error);
    }, [vad.error]);
    
    // Update refs when callbacks change (without triggering effects)
    useEffect(() => {
        onTranscriptRef.current = onTranscript;
        onAudioEndedRef.current = onAudioEnded;
        onRenderTextRef.current = onRenderText;
    }, [onTranscript, onAudioEnded, onRenderText]);

    // Initialize Speech Recognition (only runs once on mount)
    useEffect(() => {
        isMountedRef.current = true; // Mark as mounted
        
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
        };
    }, []); // Empty deps - only run on mount/unmount

    // Handle mic/speaker state changes (separate effect)
    useEffect(() => {
        const wasMicEnabled = prevMicEnabledRef.current;
        const wasSpeakerEnabled = prevSpeakerEnabledRef.current;
        prevMicEnabledRef.current = isMicEnabled; // Update ref
        prevSpeakerEnabledRef.current = isSpeakerEnabled; // Update ref
        
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
        } else if (!wasSpeakerEnabled && isSpeakerEnabled) {
            console.log('🔊 Natural Voice: Enabling speaker - ready for playback');
            // Don't stop anything when enabling - let audio play!
        }
    }, [isMicEnabled, isSpeakerEnabled]);

    // Start listening helper
    const startListening = useCallback(() => {
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
    }, []);

    // Stop listening helper
    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    }, []);

    // Stop speaking helper - immediately stops audio
    const stopSpeaking = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        // Clear any paused state when stopping
        if (pausedAudioRef.current) {
            pausedAudioRef.current = null;
            setIsPaused(false);
        }
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        isAudioPlayingRef.current = false; // Clear audio playing flag
        stopListening();
    }, [stopListening]);

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
            
            // NOTE: No timeout - pause state persists until:
            // 1. User resumes playback
            // 2. New audio starts (cleared in speak() function)
            // 3. Speaker is turned off
            // This is safe - no memory leak as we clear on new audio
        } else {
            console.log('⏸️ Natural Voice: Cannot pause - no audio reference exists');
        }
    }, []);

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
            });
            
            // Clear paused state after resuming
            pausedAudioRef.current = null;
        } else if (!isSpeakerEnabled) {
            console.log('⏸️ Natural Voice: Cannot resume - speaker disabled');
        }
    }, [isSpeakerEnabled]);

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

    // Prefetch audio for a given text (uses global cache)
    const prefetch = useCallback(async (text: string) => {
        if (!text || globalAudioCache.has(text)) return;

        try {
            console.log('🗣️ Natural Voice: Prefetching (global cache):', text);
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    provider: voiceProvider,
                    voice: elevenLabsVoiceId,
                }),
            });

            if (!response.ok) throw new Error('Prefetch failed');

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            globalAudioCache.set(text, audioUrl);
            console.log('🗣️ Natural Voice: Prefetch complete (global cache):', text);
        } catch (err) {
            console.error('🗣️ Natural Voice: Prefetch error:', err);
        }
    }, [voiceProvider, elevenLabsVoiceId]);

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
     * NEW: Now tracks audio start time and triggers text rendering with 150ms delay
     */
    const playAudioSegment = useCallback(async (audioUrl: string, isLast: boolean): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }

            const audio = new Audio(audioUrl);
            audio.playbackRate = playbackRate; // Apply user's speed preference
            audioRef.current = audio;

            audio.onplay = () => {
                isAudioPlayingRef.current = true;
                const audioStartTime = performance.now() - speakStartTimeRef.current;
                console.log(`🔊 Natural Voice: Audio segment started at ${audioStartTime.toFixed(2)}ms from speak() call`);
                
                // NEW: Schedule text rendering 150ms AFTER audio starts
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
                }, 150); // 150ms delay: audio plays first, then text appears
            };

            audio.onended = () => {
                const audioCompleteTime = performance.now() - speakStartTimeRef.current;
                console.log(`🗣️ Natural Voice: Audio segment ended at ${audioCompleteTime.toFixed(2)}ms`);
                if (isLast) {
                    setIsSpeaking(false);
                    isSpeakingRef.current = false;
                    isAudioPlayingRef.current = false;
                    // Only restart listening if mic is enabled
                    if (isMicEnabled && isMountedRef.current) {
                        startListening();
                    }
                    onAudioEndedRef.current?.();
                }
                resolve();
            };

            audio.onerror = (e) => {
                reject(new Error('Audio playback error'));
            };

            audio.play().catch((playError) => {
                if (playError instanceof Error && playError.name === 'AbortError') {
                    console.log('🔊 Natural Voice: Audio playback interrupted (expected during cleanup)');
                    // CRITICAL: Clear the audio playing flags so listening can restart!
                    isAudioPlayingRef.current = false;
                    isSpeakingRef.current = false;
                    setIsSpeaking(false);
                    // Restart listening after a brief delay (only if mic enabled)
                    if (isMicEnabled && isMountedRef.current) {
                        setTimeout(() => startListening(), 300);
                    }
                    resolve(); // Not an error, just cleanup
                } else {
                    reject(playError);
                }
            });
        });
    }, [isMicEnabled, startListening, playbackRate]);

    /**
     * Fetch TTS audio for text and return the audio URL
     */
    const fetchTTSAudio = useCallback(async (text: string, voiceName: string): Promise<string> => {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                provider: voiceProvider,
                voice: voiceProvider === 'kokoro' ? kokoroVoiceId : elevenLabsVoiceId,
            }),
        });

        if (!response.ok) throw new Error('TTS request failed');

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        // Use voice-prefixed cache key
        const cacheKey = `${voiceName}:${text}`;
        globalAudioCache.set(cacheKey, audioUrl);
        return audioUrl;
    }, [voiceProvider, elevenLabsVoiceId, kokoroVoiceId]);

    // Get voice name from voice ID for cache key prefix
    const getVoiceNameFromId = (voiceId: string): string => {
        const voiceMap: Record<string, string> = {
            // Kokoro voices
            'af_heart': 'heart',
            'am_michael': 'michael',
            // Add more voices here as needed
        };
        return voiceMap[voiceId] || 'unknown';
    };

    const currentVoiceName = getVoiceNameFromId(voiceProvider === 'kokoro' ? kokoroVoiceId : elevenLabsVoiceId);

    // Speak text with streaming support, voice-prefixed cache check, AND smart prefix matching
    // Only plays audio if speaker is enabled
    const speak = useCallback(async (text: string) => {
        if (!text) return;
        
        // If speaker is disabled, don't play audio
        if (!isSpeakerEnabled) {
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

                // Check if still mounted/speaking before continuing
                if (!isMountedRef.current || !isSpeakingRef.current) {
                    console.log('🗣️ Natural Voice: Stopped before suffix playback');
                    return;
                }

                // Now fetch and play the suffix (only part that costs $)
                console.log('🗣️ Natural Voice: Streaming suffix only:', prefixMatch.suffix.substring(0, 50) + '...');
                const suffixUrl = await fetchTTSAudio(prefixMatch.suffix, currentVoiceName);
                await playAudioSegment(suffixUrl, true);
                return;
            }

            // 3. No cache match - stream the whole thing
            console.log(`🗣️ Natural Voice: No cache for ${currentVoiceName} - streaming full text`);
            console.log('   Text:', text.substring(0, 80) + '...');
            const audioUrl = await fetchTTSAudio(text, currentVoiceName);
            await playAudioSegment(audioUrl, true);

        } catch (err) {
            console.error('🗣️ Natural Voice: TTS error:', err);
            setIsSpeaking(false);
            isSpeakingRef.current = false;
            isAudioPlayingRef.current = false;
            // Only restart listening if mic is enabled
            if (isMicEnabled && isMountedRef.current) {
                startListening();
            }
        }
    }, [isSpeakerEnabled, isMicEnabled, stopListening, playAudioSegment, fetchTTSAudio, startListening, currentVoiceName, findCachedPrefixForVoice]);

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
        isListening: useWhisper ? audioCapture.isCapturing : isListening,
        isSpeaking,
        isPaused,
        speak,
        prefetch,
        error: error || (useWhisper ? audioCapture.error : null),
        vadError, // VAD-specific error
        startListening,
        stopListening,
        stopSpeaking,
        pauseSpeaking,
        resumeSpeaking,
        hasPausedAudio,
        clearAudioFlags,
        interimTranscript: useWhisper ? '' : interimTranscript, // Whisper doesn't have interim results yet
        listeningState: useWhisper 
            ? (audioCapture.isCapturing ? 'listening' : 'idle')
            : listeningState,
        // Expose for debugging
        isProcessing: useWhisper ? audioCapture.isProcessing : false,
    };
};
