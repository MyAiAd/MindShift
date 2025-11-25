'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseNaturalVoiceProps {
    onTranscript: (transcript: string) => void;
    enabled: boolean;
    voiceProvider?: 'openai' | 'elevenlabs';
    elevenLabsVoiceId?: string;
}

export const useNaturalVoice = ({
    onTranscript,
    enabled,
    voiceProvider = 'elevenlabs',
    elevenLabsVoiceId = '21m00Tcm4TlvDq8ikWAM', // Rachel
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

    // Speak text
    const speak = useCallback(async (text: string) => {
        if (!text) return;

        // Stop listening while speaking
        stopListening();
        setIsSpeaking(true);
        isSpeakingRef.current = true;

        try {
            console.log('🗣️ Natural Voice: Fetching TTS for:', text);
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
            const audioUrl = URL.createObjectURL(audioBlob);

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
    }, [enabled, voiceProvider, elevenLabsVoiceId, startListening, stopListening]);

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
        error
    };
};
