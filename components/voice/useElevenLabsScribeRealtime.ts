'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useElevenLabsScribeRealtime
 *
 * Manages the full lifecycle of an ElevenLabs Scribe v2 realtime WebSocket
 * session: token fetch, dedicated microphone stream, PCM conversion, audio
 * streaming, transcript delivery, automatic reconnection, and PTT signalling.
 *
 * Design decisions (from PRD open-question resolutions):
 *
 *   - Dedicated getUserMedia stream — fully independent of the VAD AudioWorklet.
 *     Scribe handles VAD and hallucination suppression server-side; we do not
 *     run client-side VAD or the isLikelyHallucination() filter on this path.
 *
 *   - commit_strategy: 'vad' in continuous mode, 'manual' in guided/PTT mode.
 *     In manual mode the caller drives commits via commitNow().
 *
 *   - Reconnect: up to 3 attempts with 500 / 1 500 / 3 000 ms backoff.
 *     A fresh token is fetched for every WebSocket open (tokens are single-use).
 *
 * Wire protocol: Scribe v2 realtime expects JSON `input_audio_chunk` events
 * with base64-encoded 16-bit signed little-endian PCM at 16 000 Hz, mono,
 * sent in ~100 ms chunks (1 600 samples per send). Server replies use the
 * `message_type` field (not `type`).
 */

const WS_BASE = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';
const CHUNK_SAMPLES = 1600;          // 100 ms at 16 kHz
const SAMPLE_RATE = 16000;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAYS_MS = [500, 1500, 3000];
const RECONNECT_WINDOW_MS = 30_000;

interface UseElevenLabsScribeRealtimeProps {
  enabled: boolean;
  /** PTT / guided mode: use commit_strategy=manual instead of vad */
  guidedMode?: boolean;
  onTranscript: (transcript: string) => void;
  onPartialTranscript?: (transcript: string) => void;
  onError?: (message: string) => void;
  onProcessingChange?: (processing: boolean) => void;
  languageCode?: string;
}

interface UseElevenLabsScribeRealtimeReturn {
  isCapturing: boolean;
  isProcessing: boolean;
  /** Send a manual commit to Scribe (PTT release). No-op in vad mode. */
  commitNow: () => void;
  /** Stop streaming audio frames without closing the WebSocket (PTT start). */
  pauseCapture: () => void;
  /** Resume streaming audio frames after a pause (PTT press). */
  resumeCapture: () => void;
}

export function useElevenLabsScribeRealtime({
  enabled,
  guidedMode = false,
  onTranscript,
  onPartialTranscript,
  onError,
  onProcessingChange,
  languageCode = 'en',
}: UseElevenLabsScribeRealtimeProps): UseElevenLabsScribeRealtimeReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs kept stable across renders; mutated in async callbacks.
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mountedRef = useRef(true);
  const pausedRef = useRef(false);            // true = skip audio frame sends
  const pcmBufferRef = useRef<number[]>([]);  // accumulator for chunk batching

  // Reconnect state — reset on every intentional enable/disable cycle.
  const reconnectAttemptsRef = useRef(0);
  const reconnectWindowStartRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);  // set before WS.close(1000)

  // Stable callback refs — updated every render but never trigger effects.
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

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  const reportError = useCallback((msg: string) => {
    console.error('[ScribeRealtime]', msg);
    onErrorRef.current?.(msg);
  }, []);

  /** Convert a Float32 PCM array to little-endian Int16 PCM bytes. */
  function float32ToInt16(input: Float32Array): ArrayBuffer {
    const buf = new ArrayBuffer(input.length * 2);
    const view = new DataView(buf);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buf;
  }

  /** Base64-encode an ArrayBuffer using a chunked binary string (avoids stack overflow on large buffers). */
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

  /**
   * Send a single audio chunk (and/or a commit signal) using the Scribe v2
   * realtime JSON protocol:
   *   { message_type: 'input_audio_chunk',
   *     audio_base_64: '<base64 PCM>',
   *     commit: <bool>,
   *     sample_rate: 16000 }
   */
  function sendAudioChunk(int16Buf: ArrayBuffer | null, commit: boolean) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      message_type: 'input_audio_chunk',
      audio_base_64: int16Buf ? arrayBufferToBase64(int16Buf) : '',
      commit,
      sample_rate: SAMPLE_RATE,
    };

    try {
      ws.send(JSON.stringify(payload));
    } catch (e) {
      console.warn('[ScribeRealtime] WebSocket send error:', e);
    }
  }

  /** Flush the PCM accumulator (any sub-CHUNK_SAMPLES leftovers) to Scribe. */
  function flushPcmBuffer() {
    if (pausedRef.current) return;
    if (pcmBufferRef.current.length === 0) return;

    const float32 = new Float32Array(pcmBufferRef.current);
    pcmBufferRef.current = [];
    sendAudioChunk(float32ToInt16(float32), false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Audio capture setup / teardown
  // ─────────────────────────────────────────────────────────────────────────

  async function startAudioCapture() {
    if (streamRef.current) return; // already running

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
          : 'Failed to access microphone for ElevenLabs Scribe.';
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
    // bufferSize 4096 → ~256 ms; we accumulate to CHUNK_SAMPLES (100 ms) before sending.
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (!mountedRef.current) return;
      const input = e.inputBuffer.getChannelData(0);
      pcmBufferRef.current.push(...Array.from(input));

      while (pcmBufferRef.current.length >= CHUNK_SAMPLES) {
        const chunk = pcmBufferRef.current.splice(0, CHUNK_SAMPLES);
        const float32 = new Float32Array(chunk);
        if (!pausedRef.current) {
          sendAudioChunk(float32ToInt16(float32), false);
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

    // Fetch a fresh single-use token from our server-side proxy.
    let token: string;
    try {
      const res = await fetch('/api/elevenlabs-scribe-token', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Token request failed' }));
        reportError(
          (body as { error?: string }).error ?? 'Failed to obtain ElevenLabs Scribe token.',
        );
        return;
      }
      const data = (await res.json()) as { token?: string };
      if (!data.token) {
        reportError('ElevenLabs Scribe token response was empty.');
        return;
      }
      token = data.token;
    } catch (err) {
      reportError('Network error fetching ElevenLabs Scribe token.');
      return;
    }

    if (!mountedRef.current) return;

    const commitStrategy = guidedMode ? 'manual' : 'vad';
    const url = new URL(WS_BASE);
    url.searchParams.set('token', token);
    url.searchParams.set('model_id', 'scribe_v2_realtime');
    url.searchParams.set('commit_strategy', commitStrategy);
    url.searchParams.set('audio_format', 'pcm_16000');
    url.searchParams.set('language_code', languageCode);
    url.searchParams.set('include_timestamps', 'false');

    const ws = new WebSocket(url.toString());
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(1000); return; }
      console.log('[ScribeRealtime] WebSocket open, strategy:', commitStrategy);
      // Reset reconnect counter on successful open.
      reconnectAttemptsRef.current = 0;
      reconnectWindowStartRef.current = 0;
      // Start microphone capture.
      startAudioCapture();
      // In guided mode, start paused — caller drives via resumeCapture().
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

      // Scribe v2 realtime uses `message_type`, not `type`. We accept either
      // for forward-compatibility, but `message_type` is the documented field.
      const type =
        (msg.message_type as string | undefined) ??
        (msg.type as string | undefined);

      if (type === 'partial_transcript') {
        const text = (msg.text as string | undefined) ?? '';
        if (text) onPartialRef.current?.(text);
      } else if (
        type === 'committed_transcript' ||
        type === 'committed_transcript_with_timestamps'
      ) {
        const text = (msg.text as string | undefined) ?? '';
        setIsProcessing(false);
        onProcessingRef.current?.(false);
        if (text) {
          console.log('[ScribeRealtime] Committed transcript:', text);
          onTranscriptRef.current(text);
        }
      } else if (type === 'session_started') {
        console.log('[ScribeRealtime] Session started:', msg);
      } else if (
        type === 'error' ||
        type === 'input_error' ||
        type === 'auth_error' ||
        type === 'transcriber_error' ||
        type === 'quota_exceeded' ||
        type === 'rate_limited' ||
        type === 'unaccepted_terms' ||
        type === 'session_time_limit_exceeded' ||
        type === 'chunk_size_exceeded' ||
        type === 'insufficient_audio_activity'
      ) {
        const detail =
          (msg.message as string | undefined) ??
          (msg.error as string | undefined) ??
          JSON.stringify(msg);
        console.error(`[ScribeRealtime] Server ${type}:`, msg);
        reportError(`ElevenLabs Scribe ${type}: ${detail}`);
      }
    };

    ws.onerror = (event) => {
      console.error('[ScribeRealtime] WebSocket error:', event);
    };

    ws.onclose = (event) => {
      console.log(`[ScribeRealtime] WebSocket closed: code=${event.code} reason="${event.reason}"`);
      stopAudioCapture();
      wsRef.current = null;
      setIsProcessing(false);
      onProcessingRef.current?.(false);

      // Don't reconnect if we closed intentionally or component is unmounted.
      if (intentionalCloseRef.current || !mountedRef.current) return;
      if (!enabled) return;

      // Track reconnect window.
      const now = Date.now();
      if (reconnectWindowStartRef.current === 0 ||
          now - reconnectWindowStartRef.current > RECONNECT_WINDOW_MS) {
        reconnectAttemptsRef.current = 0;
        reconnectWindowStartRef.current = now;
      }

      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        reportError(
          'ElevenLabs Scribe connection failed after 3 attempts. Switching to text mode.',
        );
        return;
      }

      const delay = RECONNECT_DELAYS_MS[reconnectAttemptsRef.current] ?? 3000;
      reconnectAttemptsRef.current += 1;
      console.log(
        `[ScribeRealtime] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`,
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
  // Main lifecycle effect — runs when enabled changes
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
      // Teardown: close WS, stop mic, cancel pending reconnects.
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
  // connectWebSocket is stable (useCallback with stable deps); enabled is the
  // only runtime toggle we need to react to.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ─────────────────────────────────────────────────────────────────────────
  // Component unmount
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Public control methods
  // ─────────────────────────────────────────────────────────────────────────

  const commitNow = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // Scribe has no separate commit event — committing is just an
    // input_audio_chunk with `commit: true`. Flush any pending sub-chunk PCM
    // first, then send an empty-audio chunk with the commit flag.
    flushPcmBuffer();
    sendAudioChunk(null, true);
    setIsProcessing(true);
    onProcessingRef.current?.(true);
    console.log('[ScribeRealtime] Manual commit sent');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pauseCapture = useCallback(() => {
    pausedRef.current = true;
    pcmBufferRef.current = [];
    console.log('[ScribeRealtime] Audio capture paused');
  }, []);

  const resumeCapture = useCallback(() => {
    pausedRef.current = false;
    pcmBufferRef.current = [];
    console.log('[ScribeRealtime] Audio capture resumed');
  }, []);

  return { isCapturing, isProcessing, commitNow, pauseCapture, resumeCapture };
}
