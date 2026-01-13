'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { globalAudioCache } from '@/services/voice/audioCache';
import { V4_STATIC_AUDIO_TEXTS } from '@/lib/v4/static-audio-texts';

// Get all static texts for prefix matching
const STATIC_TEXTS = Object.values(V4_STATIC_AUDIO_TEXTS);

interface UseNaturalVoiceProps {
    onTranscript: (transcript: string) => void;
    enabled: boolean;
    voiceProvider?: 'openai' | 'elevenlabs' | 'kokoro';
    elevenLabsVoiceId?: string;
    kokoroVoiceId?: string;
    onAudioEnded?: () => void;
    playbackRate?: number; // 0.5 to 2.0, default 1.0
}

export const useNaturalVoice = ({
    onTranscript,
    enabled,
    voiceProvider = 'kokoro',
    elevenLabsVoiceId = '21m00Tcm4TlvDq8ikWAM', // Rachel
    kokoroVoiceId = 'af_heart', // Default to Heart (Rachel)
    onAudioEnded,
    playbackRate = 1.0,
}: UseNaturalVoiceProps) => {
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const isSpeakingRef = useRef(false); // Ref for immediate access in callbacks
    const isMountedRef = useRef(true); // Track if component is mounted
    const isAudioPlayingRef = useRef(false); // Track if audio is actually playing (prevents feedback loop)
    const onTranscriptRef = useRef(onTranscript); // Ref to prevent effect re-runs
    const onAudioEndedRef = useRef(onAudioEnded); // Ref to prevent effect re-runs
    const prevEnabledRef = useRef(enabled); // Track previous enabled state
    
    // Update refs when callbacks change (without triggering effects)
    useEffect(() => {
        onTranscriptRef.current = onTranscript;
        onAudioEndedRef.current = onAudioEnded;
    }, [onTranscript, onAudioEnded]);

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
                    // Auto-restart listening if enabled and not speaking
                    if (prevEnabledRef.current && !isSpeakingRef.current && isMountedRef.current) {
                        // Small delay to prevent CPU hogging if it fails repeatedly
                        setTimeout(() => {
                            if (prevEnabledRef.current && !isSpeakingRef.current && isMountedRef.current) {
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
            setIsSpeaking(false);
            isSpeakingRef.current = false;
        };
    }, []); // Empty deps - only run on mount/unmount

    // Handle enabled state changes (separate effect)
    useEffect(() => {
        const wasEnabled = prevEnabledRef.current;
        const isEnabled = enabled;
        prevEnabledRef.current = enabled; // Update ref
        
        // Only cleanup audio when DISABLING (true -> false), not when ENABLING (false -> true)
        if (wasEnabled && !isEnabled) {
            console.log('🔇 Natural Voice: Disabling - stopping audio');
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current = null;
            }
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            setIsSpeaking(false);
            isSpeakingRef.current = false;
            isAudioPlayingRef.current = false;
        } else if (!wasEnabled && isEnabled) {
            console.log('🔊 Natural Voice: Enabling - ready for playback');
            // Don't stop anything when enabling - let audio play!
        }
    }, [enabled]);

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
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        isAudioPlayingRef.current = false; // Clear audio playing flag
        stopListening();
    }, [stopListening]);

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
                console.log('🔊 Natural Voice: Audio segment started');
            };

            audio.onended = () => {
                console.log('🗣️ Natural Voice: Audio segment ended');
                if (isLast) {
                    setIsSpeaking(false);
                    isSpeakingRef.current = false;
                    isAudioPlayingRef.current = false;
                    if (enabled && isMountedRef.current) {
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
                    // Restart listening after a brief delay
                    if (enabled && isMountedRef.current) {
                        setTimeout(() => startListening(), 300);
                    }
                    resolve(); // Not an error, just cleanup
                } else {
                    reject(playError);
                }
            });
        });
    }, [enabled, startListening, playbackRate]);

    /**
     * Fetch TTS audio for text and return the audio URL
     */
    const fetchTTSAudio = useCallback(async (text: string): Promise<string> => {
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
        globalAudioCache.set(text, audioUrl);
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
    const speak = useCallback(async (text: string) => {
        if (!text) return;

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
                const suffixUrl = await fetchTTSAudio(prefixMatch.suffix);
                await playAudioSegment(suffixUrl, true);
                return;
            }

            // 3. No cache match - stream the whole thing
            console.log(`🗣️ Natural Voice: No cache for ${currentVoiceName} - streaming full text`);
            console.log('   Text:', text.substring(0, 80) + '...');
            const audioUrl = await fetchTTSAudio(text);
            await playAudioSegment(audioUrl, true);

        } catch (err) {
            console.error('🗣️ Natural Voice: TTS error:', err);
            setIsSpeaking(false);
            isSpeakingRef.current = false;
            isAudioPlayingRef.current = false;
            if (enabled && isMountedRef.current) {
                startListening();
            }
        }
    }, [enabled, stopListening, playAudioSegment, fetchTTSAudio, startListening, currentVoiceName]);

    // Handle enabled state changes
    useEffect(() => {
        if (enabled && !isSpeaking && isMountedRef.current) {
            startListening();
        } else if (!enabled) {
            stopListening();
            if (audioRef.current) {
                audioRef.current.pause();
                setIsSpeaking(false);
                isSpeakingRef.current = false;
            }
        }
    }, [enabled, isSpeaking, startListening, stopListening]);

    return {
        isListening,
        isSpeaking,
        speak,
        prefetch,
        error,
        startListening,
        stopListening,
        stopSpeaking
    };
};
