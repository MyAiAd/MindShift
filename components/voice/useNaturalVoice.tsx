'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { globalAudioCache } from '@/services/voice/audioCache';
import { V4_STATIC_AUDIO_TEXTS } from '@/lib/v4/static-audio-texts';

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
}: UseNaturalVoiceProps) => {
    // Backward compatibility: if micEnabled/speakerEnabled not provided, use 'enabled'
    const isMicEnabled = micEnabled !== undefined ? micEnabled : enabled;
    const isSpeakerEnabled = speakerEnabled !== undefined ? speakerEnabled : enabled;
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const pausedAudioRef = useRef<{ audio: HTMLAudioElement; time: number; text: string } | null>(null); // NEW: Paused audio state
    const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null); // NEW: Timeout to clear paused state
    const isSpeakingRef = useRef(false); // Ref for immediate access in callbacks
    const isMountedRef = useRef(true); // Track if component is mounted
    const isAudioPlayingRef = useRef(false); // Track if audio is actually playing (prevents feedback loop)
    const onTranscriptRef = useRef(onTranscript); // Ref to prevent effect re-runs
    const onAudioEndedRef = useRef(onAudioEnded); // Ref to prevent effect re-runs
    const onRenderTextRef = useRef(onRenderText); // NEW: Ref for render callback
    const prevMicEnabledRef = useRef(isMicEnabled); // Track previous mic state
    const prevSpeakerEnabledRef = useRef(isSpeakerEnabled); // Track previous speaker state
    const speakStartTimeRef = useRef<number>(0); // NEW: Track when speak() was called
    
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
                recognitionRef.current.continuous = false; // We want single utterances for now to avoid loops
                recognitionRef.current.interimResults = false;
                recognitionRef.current.lang = 'en-US';

                recognitionRef.current.onstart = () => {
                    console.log('🎤 Natural Voice: Listening started');
                    setIsListening(true);
                };

                recognitionRef.current.onend = () => {
                    console.log('🎤 Natural Voice: Listening ended');
                    setIsListening(false);
                    // Auto-restart listening if mic enabled and not speaking
                    if (prevMicEnabledRef.current && !isSpeakingRef.current && isMountedRef.current) {
                        // Small delay to prevent CPU hogging if it fails repeatedly
                        setTimeout(() => {
                            if (prevMicEnabledRef.current && !isSpeakingRef.current && isMountedRef.current) {
                                startListening();
                            }
                        }, 500);
                    }
                };

                recognitionRef.current.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript;
                    console.log('🎤 Natural Voice: Transcript received:', transcript);
                    if (transcript.trim()) {
                        onTranscriptRef.current(transcript.trim());
                    }
                };

                recognitionRef.current.onerror = (event: any) => {
                    console.error('🎤 Natural Voice: Recognition error:', event.error);
                    if (event.error === 'not-allowed') {
                        setError('Microphone permission denied');
                    }
                };
            } else {
                setError('Speech recognition not supported in this browser');
            }
        }

        // Cleanup only on actual unmount
        return () => {
            console.log('🧹 Natural Voice: Component unmounting');
            isMountedRef.current = false;
            
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
            if (pauseTimeoutRef.current) {
                clearTimeout(pauseTimeoutRef.current);
                pauseTimeoutRef.current = null;
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
        } else if (!wasMicEnabled && isMicEnabled) {
            console.log('🎤 Natural Voice: Enabling microphone - ready for listening');
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
        if (pauseTimeoutRef.current) {
            clearTimeout(pauseTimeoutRef.current);
            pauseTimeoutRef.current = null;
        }
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        isAudioPlayingRef.current = false; // Clear audio playing flag
        stopListening();
    }, [stopListening]);

    // NEW: Pause speaking - saves position for resume
    const pauseSpeaking = useCallback(() => {
        if (audioRef.current && !audioRef.current.paused) {
            const currentTime = audioRef.current.currentTime;
            const currentAudio = audioRef.current;
            
            // Save paused state
            pausedAudioRef.current = {
                audio: currentAudio,
                time: currentTime,
                text: '' // We'll track this when we need to recreate
            };
            
            console.log(`⏸️ Natural Voice: Pausing at ${currentTime.toFixed(2)}s`);
            
            // Pause the audio
            currentAudio.pause();
            setIsPaused(true);
            setIsSpeaking(false);
            isSpeakingRef.current = false;
            isAudioPlayingRef.current = false;
            
            // Set timeout to clear paused state after 10 seconds
            if (pauseTimeoutRef.current) {
                clearTimeout(pauseTimeoutRef.current);
            }
            pauseTimeoutRef.current = setTimeout(() => {
                console.log('⏱️ Natural Voice: Paused state timeout - clearing');
                pausedAudioRef.current = null;
                setIsPaused(false);
                pauseTimeoutRef.current = null;
            }, 10000); // 10 second timeout
        }
    }, []);

    // NEW: Resume speaking - continues from paused position
    const resumeSpeaking = useCallback(() => {
        if (pausedAudioRef.current && isSpeakerEnabled) {
            const { audio, time } = pausedAudioRef.current;
            
            console.log(`▶️ Natural Voice: Resuming from ${time.toFixed(2)}s`);
            
            // Clear timeout since we're resuming
            if (pauseTimeoutRef.current) {
                clearTimeout(pauseTimeoutRef.current);
                pauseTimeoutRef.current = null;
            }
            
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
        if (pauseTimeoutRef.current) {
            clearTimeout(pauseTimeoutRef.current);
            pauseTimeoutRef.current = null;
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

    // Handle mic/speaker state changes - start/stop listening based on mic state
    useEffect(() => {
        if (isMicEnabled && !isSpeaking && isMountedRef.current) {
            startListening();
        } else if (!isMicEnabled) {
            stopListening();
        }
        // Note: Audio stopping is handled in the mic/speaker state change effect above
    }, [isMicEnabled, isSpeaking, startListening, stopListening]);

    return {
        isListening,
        isSpeaking,
        isPaused,
        speak,
        prefetch,
        error,
        startListening,
        stopListening,
        stopSpeaking,
        pauseSpeaking,
        resumeSpeaking,
        hasPausedAudio
    };
};
