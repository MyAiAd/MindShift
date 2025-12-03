'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { globalAudioCache } from '@/services/voice/audioCache';

interface UseNaturalVoiceProps {
    onTranscript: (transcript: string) => void;
    enabled: boolean;
    voiceProvider?: 'openai' | 'elevenlabs';
    elevenLabsVoiceId?: string;
    onAudioEnded?: () => void;
}

export const useNaturalVoice = ({
    onTranscript,
    enabled,
    voiceProvider = 'elevenlabs',
    elevenLabsVoiceId = '21m00Tcm4TlvDq8ikWAM', // Rachel
    onAudioEnded,
}: UseNaturalVoiceProps) => {
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const isSpeakingRef = useRef(false); // Ref for immediate access in callbacks

    // Initialize Speech Recognition
    useEffect(() => {
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
                    if (enabled && !isSpeakingRef.current) {
                        // Small delay to prevent CPU hogging if it fails repeatedly
                        setTimeout(() => {
                            if (enabled && !isSpeakingRef.current) {
                                startListening();
                            }
                        }, 500);
                    }
                };

                recognitionRef.current.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript;
                    console.log('🎤 Natural Voice: Transcript received:', transcript);
                    if (transcript.trim()) {
                        onTranscript(transcript.trim());
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

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [enabled, onTranscript]);

    // Start listening helper
    const startListening = useCallback(() => {
        if (recognitionRef.current && !isSpeakingRef.current) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                // Ignore errors if already started
                console.log('🎤 Natural Voice: Already listening or error starting:', e);
            }
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

    // Speak text with streaming support and global cache check
    const speak = useCallback(async (text: string) => {
        if (!text) return;

        // Stop listening while speaking
        stopListening();
        setIsSpeaking(true);
        isSpeakingRef.current = true;

        try {
            let audioUrl: string;

            // Check global cache first
            if (globalAudioCache.has(text)) {
                console.log('🗣️ Natural Voice: Playing from global cache');
                audioUrl = globalAudioCache.get(text)!;
            } else {
                console.log('🗣️ Natural Voice: Fetching TTS stream for:', text);
                const response = await fetch('/api/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text,
                        provider: voiceProvider,
                        voice: elevenLabsVoiceId,
                    }),
                });

                if (!response.ok) throw new Error('TTS request failed');

                const audioBlob = await response.blob();
                audioUrl = URL.createObjectURL(audioBlob);
                // Store in global cache for future use
                globalAudioCache.set(text, audioUrl);
            }

            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }

            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.onended = () => {
                console.log('🗣️ Natural Voice: Playback ended');
                setIsSpeaking(false);
                isSpeakingRef.current = false;
                // Resume listening after speaking
                if (enabled) {
                    startListening();
                }

                // Trigger callback
                onAudioEnded?.();
            };

            await audio.play();

        } catch (err) {
            console.error('🗣️ Natural Voice: TTS error:', err);
            setIsSpeaking(false);
            isSpeakingRef.current = false;
            // Resume listening even on error
            if (enabled) {
                startListening();
            }
        }
    }, [enabled, voiceProvider, elevenLabsVoiceId, startListening, stopListening, onAudioEnded]);

    // Handle enabled state changes
    useEffect(() => {
        if (enabled && !isSpeaking) {
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
