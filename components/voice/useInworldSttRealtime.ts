'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useInworldSttRealtime
 *
 * Manages the full lifecycle of an Inworld STT realtime WebSocket session:
 * token fetch, dedicated microphone stream, PCM conversion, audio streaming,
 * transcript delivery, automatic reconnection, and PTT signalling.
 *
 * Mirrors useElevenLabsScribeRealtime in structure and exported interface so
 * the V9 session component can swap between providers with a single conditional
 * on voicePair.stt === 'inworld'.
 *
 * Auth flow:
 *   1. Fetch a short-lived token from GET /api/v9/inworld-stt-token.
 *   2a. If response.type === 'inworld': Inworld issued a native token.
 *       Connect directly to wss://api.inworld.ai/v1/stt/transcribe:stream
 *       with the token as a query parameter.
 *   2b. If response.type === 'proxy': Inworld has no token endpoint.
 *       Connect to /api/v9/inworld-stt-ws?token=<hmac> which is the
 *       server-side WebSocket proxy that holds the real API key.
 *
 * Wire protocol:
 *   - On open: send { config: { model, audioEncoding, sampleRateHertz, language } }
 *   - Audio: JSON { audio_data: '<base64 LINEAR16 PCM>' } at ~100 ms intervals
 *   - In guided mode: send { end_of_utterance: true } on PTT release (commitNow).
 *   - Transcripts: look for { transcript } or { text } on incoming JSON frames.
 *
 * Reconnect: up to 3 attempts with 500 / 1 500 / 3 000 ms backoff.
 */

const CHUNK_SAMPLES = 1600;     // 100 ms at 16 kHz
const SAMPLE_RATE = 16000;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAYS_MS = [500, 1500, 3000];
const RECONNECT_WINDOW_MS = 30_000;
const INWORLD_DIRECT_WS = 'wss://api.inworld.ai/v1/stt/transcribe:stream';

export interface UseInworldSttRealtimeProps {
  enabled: boolean;
  guidedMode?: boolean;
  onTranscript: (transcript: string) => void;
  onPartialTranscript?: (transcript: string) => void;
  onError?: (message: string) => void;
  onProcessingChange?: (processing: boolean) => void;
  languageCode?: string;
}

export interface UseInworldSttRealtimeReturn {
  isCapturing: boolean;
  isProcessing: boolean;
  commitNow: () => void;
  pauseCapture: () => void;
  resumeCapture: () => void;
}

type TokenResponse = {
  token: string;
  expiresAt: string | null;
  type: 'inworld' | 'proxy';
};

export function useInworldSttRealtime({
  enabled,
  guidedMode = false,
  onTranscript,
  onPartialTranscript,
  onError,
  onProcessingChange,
  languageCode = 'en',
}: UseInworldSttRealtimeProps): UseInworldSttRealtimeReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mountedRef = useRef(true);
  const pausedRef = useRef(false);
  const pcmBufferRef = useRef<number[]>([]);

  const reconnectAttemptsRef = useRef(0);
  const reconnectWindowStartRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);

  const onTranscriptRef = useRef(onTranscript);
  const onPartialRef = useRef(onPartialTranscript);
  const onErrorRef = useRef(onError);
  const onProcessingRef = useRef(onProcessingChange);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onPartialRef.current = onPartialTranscript;
    onErrorRef.current = onError;
    onProcessingRef.current = onProcessingChange;
  }, [onTranscript, onPartialTranscript, onError, onProcessingChange]);

  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  const reportError = useCallback((msg: string) => {
    console.error('[InworldSttRealtime]', msg);
    onErrorRef.current?.(msg);
  }, []);

  function float32ToInt16(input: Float32Array): ArrayBuffer {
    const buf = new ArrayBuffer(input.length * 2);
    const view = new DataView(buf);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buf;
  }

  function arrayBufferToBase64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + CHUNK)),
      );
    }
    return btoa(binary);
  }

  function sendAudioData(int16Buf: ArrayBuffer) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ audio_data: arrayBufferToBase64(int16Buf) }));
    } catch (e) {
      console.warn('[InworldSttRealtime] send error:', e);
    }
  }

  function flushPcmBuffer() {
    if (pausedRef.current || pcmBufferRef.current.length === 0) return;
    const float32 = new Float32Array(pcmBufferRef.current);
    pcmBufferRef.current = [];
    sendAudioData(float32ToInt16(float32));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Audio capture
  // ─────────────────────────────────────────────────────────────────────────

  async function startAudioCapture() {
    if (streamRef.current) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow microphone access and try again.'
          : 'Failed to access microphone for Inworld STT.';
      reportError(msg);
      return;
    }

    if (!mountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    streamRef.current = stream;
    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    audioCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (!mountedRef.current) return;
      const input = e.inputBuffer.getChannelData(0);
      pcmBufferRef.current.push(...Array.from(input));
      while (pcmBufferRef.current.length >= CHUNK_SAMPLES) {
        const chunk = pcmBufferRef.current.splice(0, CHUNK_SAMPLES);
        if (!pausedRef.current) {
          sendAudioData(float32ToInt16(new Float32Array(chunk)));
        }
      }
    };

    source.connect(processor);
    processor.connect(ctx.destination);
    if (mountedRef.current) setIsCapturing(true);
  }

  function stopAudioCapture() {
    processorRef.current?.disconnect();
    processorRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcmBufferRef.current = [];
    setIsCapturing(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WebSocket connection
  // ─────────────────────────────────────────────────────────────────────────

  const connectWebSocket = useCallback(async () => {
    if (!mountedRef.current) return;

    let tokenData: TokenResponse;
    try {
      const res = await fetch('/api/v9/inworld-stt-token', { method: 'GET' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Token request failed' }));
        reportError(
          (body as { error?: string }).error ?? 'Failed to obtain Inworld STT token.',
        );
        return;
      }
      tokenData = (await res.json()) as TokenResponse;
      if (!tokenData.token) {
        reportError('Inworld STT token response was empty.');
        return;
      }
    } catch {
      reportError('Network error fetching Inworld STT token.');
      return;
    }

    if (!mountedRef.current) return;

    // Build WebSocket URL.
    let wsUrl: string;
    if (tokenData.type === 'inworld') {
      // Inworld issued a native short-lived token; connect directly.
      const url = new URL(INWORLD_DIRECT_WS);
      url.searchParams.set('token', tokenData.token);
      wsUrl = url.toString();
    } else {
      // Use our server-side proxy.
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${proto}//${window.location.host}/api/v9/inworld-stt-ws?token=${encodeURIComponent(tokenData.token)}`;
    }

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(1000); return; }
      console.log('[InworldSttRealtime] WebSocket open, type:', tokenData.type);
      reconnectAttemptsRef.current = 0;
      reconnectWindowStartRef.current = 0;

      // Send initial config.
      try {
        ws.send(JSON.stringify({
          config: {
            model: 'inworld/inworld-stt-1',
            audioEncoding: 'LINEAR16',
            sampleRateHertz: SAMPLE_RATE,
            language: languageCode,
          },
        }));
      } catch (e) {
        console.warn('[InworldSttRealtime] Failed to send config:', e);
      }

      startAudioCapture();
      if (guidedMode) pausedRef.current = true;
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      // Inworld STT sends { transcript } for final results and { partial }
      // for intermediate results.  Accept both field names for robustness.
      const transcript =
        (msg.transcript as string | undefined) ??
        (msg.text as string | undefined);
      const partial =
        (msg.partial as string | undefined) ??
        (msg.partial_transcript as string | undefined);
      const isFinal = msg.is_final !== false && transcript !== undefined;

      if (partial) {
        onPartialRef.current?.(partial);
      } else if (transcript && isFinal) {
        setIsProcessing(false);
        onProcessingRef.current?.(false);
        console.log('[InworldSttRealtime] Final transcript:', transcript);
        onTranscriptRef.current(transcript);
      } else if (msg.error) {
        const detail =
          (msg.message as string | undefined) ??
          (msg.error as string | undefined) ??
          JSON.stringify(msg);
        console.error('[InworldSttRealtime] Server error:', msg);
        reportError(`Inworld STT error: ${detail}`);
      }
    };

    ws.onerror = (event) => {
      console.error('[InworldSttRealtime] WebSocket error:', event);
    };

    ws.onclose = (event) => {
      console.log(
        `[InworldSttRealtime] WebSocket closed: code=${event.code} reason="${event.reason}"`,
      );
      stopAudioCapture();
      wsRef.current = null;
      setIsProcessing(false);
      onProcessingRef.current?.(false);

      if (intentionalCloseRef.current || !mountedRef.current) return;
      if (!enabledRef.current) return;

      const now = Date.now();
      if (
        reconnectWindowStartRef.current === 0 ||
        now - reconnectWindowStartRef.current > RECONNECT_WINDOW_MS
      ) {
        reconnectAttemptsRef.current = 0;
        reconnectWindowStartRef.current = now;
      }

      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        reportError(
          'Inworld STT connection failed after 3 attempts. Switching to text mode.',
        );
        return;
      }

      const delay = RECONNECT_DELAYS_MS[reconnectAttemptsRef.current] ?? 3000;
      reconnectAttemptsRef.current += 1;
      console.log(
        `[InworldSttRealtime] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`,
      );
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current && !intentionalCloseRef.current) {
          connectWebSocket();
        }
      }, delay);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidedMode, languageCode, reportError]);

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      intentionalCloseRef.current = false;
      reconnectAttemptsRef.current = 0;
      reconnectWindowStartRef.current = 0;
      connectWebSocket();
    }

    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const ws = wsRef.current;
      if (ws && ws.readyState < WebSocket.CLOSING) {
        ws.close(1000, 'disabled');
      }
      wsRef.current = null;
      stopAudioCapture();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Public controls
  // ─────────────────────────────────────────────────────────────────────────

  const commitNow = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!guidedMode) return; // no-op in VAD mode
    flushPcmBuffer();
    try {
      ws.send(JSON.stringify({ end_of_utterance: true }));
    } catch (e) {
      console.warn('[InworldSttRealtime] commitNow send error:', e);
    }
    setIsProcessing(true);
    onProcessingRef.current?.(true);
    console.log('[InworldSttRealtime] Manual commit sent');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidedMode]);

  const pauseCapture = useCallback(() => {
    pausedRef.current = true;
    pcmBufferRef.current = [];
    console.log('[InworldSttRealtime] Audio capture paused');
  }, []);

  const resumeCapture = useCallback(() => {
    pausedRef.current = false;
    pcmBufferRef.current = [];
    console.log('[InworldSttRealtime] Audio capture resumed');
  }, []);

  return { isCapturing, isProcessing, commitNow, pauseCapture, resumeCapture };
}
