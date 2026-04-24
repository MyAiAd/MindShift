'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX } from 'lucide-react';
import { useNaturalVoice } from '@/components/voice/useNaturalVoice';
import type { TranscriptionDomainContext } from '@/lib/voice/transcription-domain-context';
import type {
  V9ApiResponse,
  V9SessionStats,
  V9TreatmentMessage,
  V9TreatmentSessionProps,
} from './shared/types';

/**
 * V9 TreatmentSession.
 *
 * Minimal voice-capable chat UI that points at /api/treatment-v9. The
 * hard rule: v9 renders exactly what the backend returns. In particular,
 * we deliberately do NOT port v7's `V7_STATIC_AUDIO_TEXTS.INITIAL_WELCOME`
 * override — that was the cause of the UI/backend step mismatch log the
 * user shared. V9 shows a loading state while the backend produces the
 * real welcome, then renders the real welcome.
 *
 * Voice layer: v9 reuses the existing `useNaturalVoice` hook (audio
 * capture + VAD + playback) because that layer is not a source of script
 * drift. Only the transcript string it produces enters v9's state
 * machine.
 */
export default function TreatmentSession({
  sessionId,
  userId,
  shouldResume = false,
  onComplete,
  onError,
}: V9TreatmentSessionProps) {
  const [messages, setMessages] = useState<V9TreatmentMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [currentStep, setCurrentStep] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [stats, setStats] = useState<V9SessionStats>({
    totalResponses: 0,
    avgResponseTime: 0,
    aiUsagePercent: 0,
  });
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const transcriptionContextRef = useRef<TranscriptionDomainContext | null>(null);

  // Auto-scroll message list as new messages arrive.
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keep transcription context fresh so STT can bias toward the current
  // expected response type.
  useEffect(() => {
    transcriptionContextRef.current = {
      currentStep: currentStep || null,
      expectedResponseType: null,
      hotwords: null,
    };
  }, [currentStep]);

  const handleTranscript = useCallback((transcript: string) => {
    if (!transcript || !transcript.trim()) return;
    setUserInput(transcript);
    // Small delay to let React flush the input state before we send,
    // matching v7's pattern.
    setTimeout(() => handleSend(transcript.trim()), 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const voice = useNaturalVoice({
    onTranscript: handleTranscript,
    enabled: isMicEnabled || isSpeakerEnabled,
    micEnabled: isMicEnabled,
    speakerEnabled: isSpeakerEnabled,
    voiceProvider: 'openai',
    treatmentVersion: 'v7',
    transcriptionContextRef,
  });

  const speak = useCallback(
    (text: string) => {
      if (!isSpeakerEnabled || !text) return;
      try {
        (voice as any).speakServerMessage?.(text);
      } catch (err) {
        console.warn('V9 speak failed:', err);
      }
    },
    [isSpeakerEnabled, voice],
  );

  const appendServerMessage = useCallback(
    (text: string, meta?: Partial<V9TreatmentMessage>) => {
      const msg: V9TreatmentMessage = {
        id: `system-${Date.now()}`,
        content: text,
        isUser: false,
        timestamp: new Date(),
        version: 'v9',
        ...meta,
      };
      setMessages((prev) => [...prev, msg]);
      speak(text);
    },
    [speak],
  );

  const appendUserMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        content: text,
        isUser: true,
        timestamp: new Date(),
        version: 'v9',
      },
    ]);
  }, []);

  const startSession = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const action = shouldResume ? 'resume' : 'start';
      const response = await fetch('/api/treatment-v9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sessionId, userId }),
      });

      if (!response.ok) {
        throw new Error(`V9 HTTP ${response.status}`);
      }
      const data = (await response.json()) as
        | V9ApiResponse
        | {
            success: true;
            sessionId: string;
            currentStep: string;
            currentPhase: string;
            messages: Array<{
              id: string;
              content: string;
              isUser: boolean;
              timestamp: string | Date;
              responseTime?: number;
              usedAI?: boolean;
            }>;
            isExistingSession?: boolean;
          };

      setIsSessionActive(true);

      if (shouldResume && 'messages' in data && Array.isArray(data.messages)) {
        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            content: m.content,
            isUser: m.isUser,
            timestamp: new Date(m.timestamp),
            responseTime: m.responseTime,
            usedAI: m.usedAI,
            version: 'v9',
          })),
        );
        setCurrentStep(data.currentStep || '');
      } else if ('message' in data && data.message) {
        // V9 shows exactly what v2 returned — no INITIAL_WELCOME substitution.
        appendServerMessage(data.message, {
          responseTime: data.responseTime,
          usedAI: data.usedAI,
        });
        setCurrentStep(data.currentStep || '');
      }
    } catch (err) {
      console.error('V9 start error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setHasError(true);
      setErrorMessage(message);
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  }, [appendServerMessage, onError, sessionId, shouldResume, userId]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      appendUserMessage(text);
      setUserInput('');
      setIsLoading(true);
      setHasError(false);

      try {
        const response = await fetch('/api/treatment-v9', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'continue',
            sessionId,
            userId,
            userInput: text,
          }),
        });

        if (!response.ok) {
          throw new Error(`V9 HTTP ${response.status}`);
        }
        const data = (await response.json()) as V9ApiResponse;
        if (!data.success && !data.message) {
          throw new Error('V9 returned no usable message');
        }
        if (data.message) {
          appendServerMessage(data.message, {
            responseTime: data.responseTime,
            usedAI: data.usedAI,
          });
        }
        if (data.currentStep) setCurrentStep(data.currentStep);

        setStats((prev) => {
          const totalResponses = prev.totalResponses + 1;
          const avgResponseTime =
            data.responseTime != null
              ? Math.round(
                  (prev.avgResponseTime * prev.totalResponses +
                    data.responseTime) /
                    totalResponses,
                )
              : prev.avgResponseTime;
          return {
            totalResponses,
            avgResponseTime,
            aiUsagePercent: 0,
          };
        });

        if (
          data.currentStep &&
          (data.currentStep === 'session_complete' ||
            data.currentStep === 'reality_session_complete' ||
            data.currentStep.includes('session_complete'))
        ) {
          onComplete?.(data);
        }
      } catch (err) {
        console.error('V9 send error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        setHasError(true);
        setErrorMessage(message);
        onError?.(message);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [appendServerMessage, appendUserMessage, isLoading, onComplete, onError, sessionId, userId],
  );

  const toggleMic = useCallback(() => {
    setIsMicEnabled((v) => !v);
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerEnabled((v) => !v);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend(userInput);
      }
    },
    [handleSend, userInput],
  );

  const canType = isSessionActive && !isLoading;

  const statusLabel = useMemo(() => {
    if (hasError) return `Error: ${errorMessage}`;
    if (!isSessionActive) return 'Not started';
    if (isLoading) return 'Processing…';
    return currentStep ? `Step: ${currentStep}` : 'Ready';
  }, [currentStep, errorMessage, hasError, isLoading, isSessionActive]);

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto p-4 gap-4">
      <header className="flex items-center justify-between border-b pb-2">
        <div>
          <h1 className="text-lg font-semibold">Mind Shifting — v9</h1>
          <p className="text-xs text-gray-500">{statusLabel}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleMic}
            className="p-2 rounded border hover:bg-gray-50"
            aria-pressed={isMicEnabled}
            aria-label={isMicEnabled ? 'Turn microphone off' : 'Turn microphone on'}
          >
            {isMicEnabled ? <Mic size={16} /> : <MicOff size={16} />}
          </button>
          <button
            type="button"
            onClick={toggleSpeaker}
            className="p-2 rounded border hover:bg-gray-50"
            aria-pressed={isSpeakerEnabled}
            aria-label={
              isSpeakerEnabled ? 'Turn speaker off' : 'Turn speaker on'
            }
          >
            {isSpeakerEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </header>

      {!isSessionActive ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <button
            type="button"
            onClick={startSession}
            disabled={isLoading}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
          >
            {isLoading
              ? 'Starting…'
              : shouldResume
                ? 'Resume session'
                : 'Start session'}
          </button>
          {hasError ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] whitespace-pre-wrap rounded px-3 py-2 text-sm ${
                  m.isUser
                    ? 'ml-auto bg-blue-600 text-white'
                    : 'mr-auto bg-gray-100 text-gray-900'
                }`}
              >
                {m.content}
              </div>
            ))}
            {isLoading ? (
              <div className="mr-auto bg-gray-100 text-gray-500 rounded px-3 py-2 text-sm">
                …
              </div>
            ) : null}
            <div ref={messageEndRef} />
          </div>

          <form
            className="flex gap-2 border-t pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(userInput);
            }}
          >
            <textarea
              ref={inputRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!canType}
              rows={1}
              placeholder="Type your reply…"
              className="flex-1 resize-none border rounded px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!canType || !userInput.trim()}
              className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60 flex items-center gap-1"
            >
              <Send size={16} /> Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
