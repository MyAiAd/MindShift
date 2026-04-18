'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { TreatmentSessionProps } from './shared/types';
import { validateSpeechOutput } from '@/lib/voice/speech-compliance';
import { getVoiceCacheName } from '@/lib/voice/voice-cache-name';

/**
 * V7RealtimeSession (Track B — US-023 shell, US-024 transcription wire-up,
 * US-025 scripted playback, US-026 reconnect + text-mode fallback).
 *
 * This is a parallel alternative to `TreatmentSession.tsx` that uses
 * OpenAI's Realtime API over WebRTC instead of the request/response
 * STT + TTS pair. The treatment engine wire-up (send/continue) reuses
 * `/api/treatment-v7` verbatim so the server-side state machine is
 * identical across Track A and Track B.
 *
 * The component receives the same props contract as TreatmentSession
 * (US-027 can ternary-switch between them at the v7 page level).
 */

type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

type TextModeFallbackState = null | 'prompt' | 'active' | 'retrying';

type SessionMintResponse = {
  client_secret?: { value: string; expires_at?: number };
  id?: string;
  voice?: string;
  model?: string;
};

const REALTIME_BASE_URL = 'https://api.openai.com/v1/realtime';
const RECONNECT_SINGLE_ATTEMPT_MS = 5000;
const SECOND_DISCONNECT_WINDOW_MS = 30_000;

function resolveDefaultVoice(): string {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('v7_voice_id')
      || window.localStorage.getItem('v7_selected_voice');
    if (stored) return stored;
  }
  return process.env.NEXT_PUBLIC_V7_DEFAULT_VOICE || 'shimmer';
}

export default function V7RealtimeSession({
  sessionId,
  userId,
  shouldResume = false,
  onComplete,
  onError,
  version = 'v7',
}: TreatmentSessionProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [textModeFallbackState, setTextModeFallbackState] = useState<TextModeFallbackState>(null);
  const [userInput, setUserInput] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [serverMessages, setServerMessages] = useState<string[]>([]);

  const voiceRef = useRef<string>(resolveDefaultVoice());
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);

  const disconnectHistoryRef = useRef<number[]>([]);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSpokenMessageRef = useRef<string | null>(null);

  const logConnectionState = useCallback((state: ConnectionState) => {
    try {
      console.log(JSON.stringify({
        event: 'v7_realtime_connection_state',
        state,
        session_id: sessionId,
      }));
    } catch {
      // logging best-effort
    }
  }, [sessionId]);

  const updateConnectionState = useCallback((state: ConnectionState) => {
    setConnectionState(state);
    logConnectionState(state);
  }, [logConnectionState]);

  const teardown = useCallback(() => {
    try {
      dataChannelRef.current?.close();
    } catch {}
    dataChannelRef.current = null;

    try {
      peerRef.current?.close();
    } catch {}
    peerRef.current = null;

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        try { track.stop(); } catch {}
      }
    }
    localStreamRef.current = null;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  /**
   * US-024: forward user-transcription events from the Realtime data channel
   * to the v7 engine by POSTing to /api/treatment-v7 just like TreatmentSession
   * does. Extracted into a callback so US-026 reconnect paths can reuse it.
   */
  const sendTranscriptToEngine = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    try {
      console.log('Sending V4 message:', transcript);
      const response = await fetch('/api/treatment-v7', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userId,
          action: 'continue',
          userInput: transcript,
        }),
      });

      if (!response.ok) {
        throw new Error(`engine responded ${response.status}`);
      }
      const data = await response.json() as { scriptedResponse?: string; message?: string };
      const nextMessage = data.scriptedResponse || data.message || '';
      if (nextMessage) {
        setServerMessages((prev) => [...prev, nextMessage]);
        await speakServerMessage(nextMessage);
      }
    } catch (err) {
      console.error('v7 realtime: engine send failed:', err);
      onError?.(err instanceof Error ? err.message : 'engine_send_failed');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId, onError]);

  /**
   * US-025: speak a server-authored scripted message via the Realtime session.
   * Runs the compliance guard (validateSpeechOutput) first and suppresses
   * playback on violation. Also suppresses playback when text-mode is active.
   */
  const speakServerMessage = useCallback(async (message: string) => {
    if (!message) return;
    if (textModeFallbackState === 'active') {
      console.log('v7 realtime: suppressing TTS (text-mode active)');
      return;
    }

    const compliance = validateSpeechOutput({ textToSpeak: message, apiMessage: message });
    if (!compliance.ok) {
      console.error(JSON.stringify({
        event: 'v7_realtime_speech_compliance_violation',
        reason: compliance.reason,
        details: compliance.details,
      }));
      return;
    }

    lastSpokenMessageRef.current = message;

    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== 'open') {
      console.warn('v7 realtime: data channel not open; cannot speak message yet');
      return;
    }

    try {
      dc.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'input_text', text: message }],
        },
      }));
      dc.send(JSON.stringify({
        type: 'response.create',
        response: {
          modalities: ['audio'],
          instructions: 'Read exactly this message verbatim. Do not add or modify any text.',
        },
      }));
    } catch (err) {
      console.error('v7 realtime: speakServerMessage send failed:', err);
    }
  }, [textModeFallbackState]);

  /**
   * US-024: parse incoming data-channel events and extract user-speech
   * transcriptions to forward to the engine. Applies a non-English language
   * filter (the Realtime API has a different response shape than verbose_json
   * so US-002's metadata gates don't apply — language filtering is the
   * equivalent safeguard here).
   */
  const handleDataChannelMessage = useCallback((raw: string) => {
    let event: any;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    const t = event?.type as string | undefined;
    if (!t) return;

    if (t === 'conversation.item.input_audio_transcription.completed') {
      const transcript: string = event.transcript || '';
      const language: string | undefined = event.language;
      setLiveTranscript(transcript);

      if (language && language !== 'en') {
        console.log(JSON.stringify({
          event: 'v7_realtime_non_english_transcript_filtered',
          detected_language: language,
          transcript_preview: transcript.slice(0, 80),
        }));
        return;
      }
      if (transcript.trim()) {
        void sendTranscriptToEngine(transcript);
      }
    }
  }, [sendTranscriptToEngine]);

  /**
   * US-026: record a disconnect event; return `'first'` for a single attempt
   * in the last window, `'second'` if we already had one within 30 s.
   */
  const classifyDisconnect = useCallback((): 'first' | 'second' => {
    const now = Date.now();
    const recent = disconnectHistoryRef.current.filter(
      (t) => now - t < SECOND_DISCONNECT_WINDOW_MS,
    );
    recent.push(now);
    disconnectHistoryRef.current = recent;
    return recent.length >= 2 ? 'second' : 'first';
  }, []);

  /**
   * Establish the WebRTC session with OpenAI Realtime. Does not trigger
   * reconnect logic itself — callers handle that (US-026).
   */
  const connect = useCallback(async (reason: 'initial' | 'reconnect' = 'initial') => {
    if (peerRef.current) {
      teardown();
    }

    updateConnectionState(reason === 'initial' ? 'connecting' : 'reconnecting');

    let sessionData: SessionMintResponse;
    try {
      const tokenRes = await fetch('/api/treatment-v7/realtime-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: voiceRef.current }),
      });
      if (!tokenRes.ok) throw new Error(`session mint HTTP ${tokenRes.status}`);
      sessionData = await tokenRes.json() as SessionMintResponse;
    } catch (err) {
      console.error('v7 realtime: session mint failed:', err);
      updateConnectionState('failed');
      return;
    }

    const ephemeralKey = sessionData.client_secret?.value;
    if (!ephemeralKey) {
      console.error('v7 realtime: mint response missing client_secret');
      updateConnectionState('failed');
      return;
    }

    const pc = new RTCPeerConnection();
    peerRef.current = pc;

    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      if (iceState === 'disconnected' || iceState === 'failed' || iceState === 'closed') {
        if (!mountedRef.current) return;
        const kind = classifyDisconnect();
        if (kind === 'first') {
          console.log(JSON.stringify({
            event: 'v7_realtime_reconnect_attempt',
            ice_state: iceState,
          }));
          updateConnectionState('reconnecting');
          reconnectTimerRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            void connect('reconnect').then(() => {
              if (peerRef.current?.iceConnectionState !== 'connected') {
                setTextModeFallbackState('prompt');
              }
            });
          }, 50);
          const giveUpTimer = setTimeout(() => {
            if (!mountedRef.current) return;
            if (peerRef.current?.iceConnectionState !== 'connected') {
              setTextModeFallbackState('prompt');
              updateConnectionState('failed');
            }
          }, RECONNECT_SINGLE_ATTEMPT_MS);
          // best-effort cleanup when connect resolves
          void Promise.resolve().finally(() => clearTimeout(giveUpTimer));
        } else {
          console.log(JSON.stringify({
            event: 'v7_realtime_second_disconnect',
            ice_state: iceState,
          }));
          setTextModeFallbackState('prompt');
          updateConnectionState('failed');
        }
      }
    };

    pc.ontrack = (ev) => {
      if (!remoteAudioRef.current) return;
      remoteAudioRef.current.srcObject = ev.streams[0] ?? null;
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      for (const track of stream.getAudioTracks()) {
        pc.addTrack(track, stream);
      }
    } catch (err) {
      console.error('v7 realtime: mic access failed:', err);
      updateConnectionState('failed');
      setTextModeFallbackState('prompt');
      return;
    }

    const dc = pc.createDataChannel('oai-events');
    dataChannelRef.current = dc;
    dc.onmessage = (ev) => handleDataChannelMessage(ev.data);
    dc.onopen = () => {
      console.log(JSON.stringify({
        event: 'v7_realtime_data_channel_open',
        voice_cache_name: getVoiceCacheName(voiceRef.current),
      }));
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(`${REALTIME_BASE_URL}?model=${encodeURIComponent(sessionData.model || 'gpt-4o-realtime-preview-2024-12-17')}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
      });
      if (!sdpRes.ok) throw new Error(`SDP answer HTTP ${sdpRes.status}`);
      const answer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: await sdpRes.text(),
      };
      await pc.setRemoteDescription(answer);
      disconnectHistoryRef.current = [];
      updateConnectionState('connected');
    } catch (err) {
      console.error('v7 realtime: SDP exchange failed:', err);
      updateConnectionState('failed');
      setTextModeFallbackState('prompt');
    }
  }, [teardown, updateConnectionState, handleDataChannelMessage, classifyDisconnect]);

  useEffect(() => {
    mountedRef.current = true;
    void connect('initial');
    return () => {
      mountedRef.current = false;
      teardown();
      updateConnectionState('disconnected');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTextModeContinue = useCallback(() => {
    setTextModeFallbackState('active');
    teardown();
    updateConnectionState('disconnected');
  }, [teardown, updateConnectionState]);

  const handleTextModeRetry = useCallback(() => {
    setTextModeFallbackState('retrying');
    void connect('reconnect').then(() => {
      if (peerRef.current?.iceConnectionState === 'connected') {
        setTextModeFallbackState(null);
      } else {
        setTextModeFallbackState('prompt');
      }
    });
  }, [connect]);

  const handleTextSubmit = useCallback(async () => {
    const trimmed = userInput.trim();
    if (!trimmed) return;
    setUserInput('');
    await sendTranscriptToEngine(trimmed);
  }, [userInput, sendTranscriptToEngine]);

  const isTextModeActive = textModeFallbackState === 'active';
  const isReconnecting = textModeFallbackState === 'retrying' || connectionState === 'reconnecting';

  return (
    <div className="relative min-h-screen bg-white text-neutral-900">
      <header className="flex items-center justify-between p-4 border-b">
        <div className="text-sm text-neutral-500">
          Session {sessionId.slice(0, 8)} · {version}
        </div>
        <div className="text-xs text-neutral-500" aria-live="polite">
          {connectionState === 'connected' && !isTextModeActive ? 'Audio active' : ''}
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-4">
        {/* TODO(US-025 extension): render the full v7 UI shell — orb,
            transcript panel, selected-work-type cards, etc. This shell is
            intentionally minimal so Track B can be end-to-end-tested
            before we copy the full TreatmentSession chrome. */}
        <div
          className={`w-32 h-32 mx-auto rounded-full ${
            isTextModeActive ? 'bg-neutral-200 opacity-40' : 'bg-indigo-500/20 animate-pulse'
          }`}
          aria-label={isTextModeActive ? 'Microphone disabled' : 'Microphone ready'}
          role="img"
        />

        <div className="space-y-2">
          {serverMessages.map((msg, idx) => (
            <div key={idx} className="p-3 rounded bg-neutral-100">
              {msg}
            </div>
          ))}
        </div>

        {liveTranscript && (
          <div className="p-2 text-sm text-neutral-600 italic">
            You said: “{liveTranscript}”
          </div>
        )}

        {isTextModeActive && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleTextSubmit();
            }}
            className="flex gap-2"
          >
            <input
              autoFocus
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="flex-1 p-2 border rounded"
              placeholder="Type your response…"
              aria-label="Your response"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-indigo-600 text-white rounded"
            >
              Send
            </button>
          </form>
        )}
      </main>

      {isReconnecting && !isTextModeActive && (
        <div
          className="fixed top-4 right-4 text-xs bg-neutral-800 text-white px-3 py-1 rounded-full"
          aria-live="polite"
        >
          Reconnecting…
        </div>
      )}

      {textModeFallbackState === 'prompt' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="v7-realtime-textmode-title"
          className="fixed inset-0 bg-black/40 flex items-center justify-center"
        >
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <h2 id="v7-realtime-textmode-title" className="text-lg font-semibold mb-2">
              Audio unavailable
            </h2>
            <p className="text-sm text-neutral-600 mb-4">
              We&rsquo;re temporarily unable to use audio. Would you like to continue by typing?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="px-3 py-2 border rounded"
                onClick={handleTextModeRetry}
              >
                Try again
              </button>
              <button
                type="button"
                className="px-3 py-2 bg-indigo-600 text-white rounded"
                onClick={handleTextModeContinue}
              >
                Continue in text
              </button>
            </div>
          </div>
        </div>
      )}

      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* TODO(US-026 extension): share the exact TextModeFallback component
          with TreatmentSession so the visual is pixel-identical across
          tracks. Track A currently owns the canonical markup. */}
    </div>
  );
}
