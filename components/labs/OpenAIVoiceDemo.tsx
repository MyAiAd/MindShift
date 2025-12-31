'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Settings, Play, Square, AlertCircle, CheckCircle } from 'lucide-react';

interface VoiceSession {
  pc: RTCPeerConnection | null;
  audioEl: HTMLAudioElement | null;
  dataChannel: RTCDataChannel | null;
  micStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

export default function OpenAIVoiceDemo() {
  const [status, setStatus] = useState<string>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Configuration state
  const [config, setConfig] = useState({
    model: 'gpt-4o-realtime-preview-2024-12-17',
    voice: 'verse',
    instructions: ''
  });
  
  const sessionRef = useRef<VoiceSession>({
    pc: null,
    audioEl: null,
    dataChannel: null,
    micStream: null,
    remoteStream: null
  });

  const log = useCallback((...messages: any[]) => {
    const timestamp = new Date().toLocaleTimeString();
    const message = messages.map(m => typeof m === 'string' ? m : JSON.stringify(m)).join(' ');
    const logEntry = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-20), logEntry]); // Keep last 20 logs
  }, []);

  const cleanup = useCallback(() => {
    const session = sessionRef.current;
    try {
      if (session.dataChannel?.readyState === 'open') {
        session.dataChannel.close();
      }
      if (session.pc) {
        session.pc.close();
      }
      if (session.micStream) {
        session.micStream.getTracks().forEach(track => track.stop());
      }
      if (session.audioEl) {
        session.audioEl.remove();
      }
    } catch (err) {
      console.error('Cleanup error:', err);
    }
    
    sessionRef.current = {
      pc: null,
      audioEl: null,
      dataChannel: null,
      micStream: null,
      remoteStream: null
    };
    
    setIsConnected(false);
    setStatus('idle');
    log('Session cleaned up');
  }, [log]);

  const startSession = async () => {
    try {
      setError('');
      setStatus('starting');
      log('Starting OpenAI Realtime session...');

      // 1. Create ephemeral session
      const sessionResponse = await fetch('/api/labs/openai-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.error || 'Failed to create session');
      }

      const sessionData = await sessionResponse.json();
      const ephemeralKey = sessionData?.client_secret?.value;
      
      if (!ephemeralKey) {
        throw new Error('No ephemeral key received');
      }

      log('Ephemeral session created');

      // 2. Set up WebRTC
      const pc = new RTCPeerConnection();
      const remoteStream = new MediaStream();
      const audioEl = document.createElement('audio');
      
      audioEl.autoplay = true;
      audioEl.setAttribute('playsinline', 'true');
      audioEl.srcObject = remoteStream;
      document.body.appendChild(audioEl);

      sessionRef.current.pc = pc;
      sessionRef.current.audioEl = audioEl;
      sessionRef.current.remoteStream = remoteStream;

      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
        setStatus('connected');
        setIsConnected(true);
        log('Audio track received');
      };

      pc.onconnectionstatechange = () => {
        log('Connection state:', pc.connectionState);
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
          setStatus(pc.connectionState);
          if (pc.connectionState === 'failed') {
            setError('Connection failed');
          }
        }
      };

      // 3. Get microphone
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const [track] = micStream.getAudioTracks();
      pc.addTrack(track, micStream);
      sessionRef.current.micStream = micStream;

      log('Microphone access granted');

      // 4. Set up data channel
      const dataChannel = pc.createDataChannel('oai-events');
      sessionRef.current.dataChannel = dataChannel;

      dataChannel.addEventListener('open', () => {
        log('Data channel opened');
        if (config.instructions.trim()) {
          dataChannel.send(JSON.stringify({
            type: 'session.update',
            session: { 
              instructions: config.instructions.trim(),
              voice: config.voice 
            }
          }));
          log('Session updated with custom instructions');
        }
      });

      dataChannel.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          log('Event:', message.type || 'unknown', message);
        } catch (err) {
          // Ignore non-JSON messages
        }
      });

      // 5. Create and send offer
      await pc.setLocalDescription(await pc.createOffer());

      const sdpUrl = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(config.model)}`;
      const sdpResponse = await fetch(sdpUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        },
        body: pc.localDescription!.sdp
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(`SDP exchange failed: ${errorText}`);
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      log('Connected! You can now speak.');
      setStatus('connected');
      setIsConnected(true);

    } catch (err: any) {
      log('Error:', err.message);
      setError(err.message);
      setStatus('error');
      cleanup();
    }
  };

  const stopAudio = () => {
    if (sessionRef.current.audioEl) {
      sessionRef.current.audioEl.pause();
      sessionRef.current.audioEl.currentTime = 0;
      log('Audio playback stopped');
    }
  };

  const endSession = () => {
    log('Ending session');
    cleanup();
  };

  return (
    <div className="bg-card dark:bg-card rounded-lg shadow-sm border border-border dark:border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold text-foreground">OpenAI Realtime Voice</h4>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground">
            Real-time voice conversation with AI using WebRTC
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            status === 'connected' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
            status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
            status === 'starting' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
            'bg-secondary text-foreground dark:bg-background/20 dark:text-muted-foreground'
          }`}>
            {status}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
          <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        <button
          onClick={startSession}
          disabled={isConnected || status === 'starting'}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Phone className="h-4 w-4" />
          <span>{status === 'starting' ? 'Starting...' : 'Start Session'}</span>
        </button>

        <button
          onClick={stopAudio}
          disabled={!isConnected}
          className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Square className="h-4 w-4" />
          <span>Stop Audio</span>
        </button>

        <button
          onClick={endSession}
          disabled={!isConnected}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <PhoneOff className="h-4 w-4" />
          <span>End Session</span>
        </button>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 px-4 py-2 border border-border dark:border-border text-foreground dark:text-muted-foreground rounded-lg hover:bg-secondary/20 dark:hover:bg-secondary transition-colors"
        >
          <Settings className="h-4 w-4" />
          <span>Options</span>
        </button>
      </div>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="mb-4 p-4 border border-border dark:border-border rounded-lg bg-secondary/20 dark:bg-background/20">
          <h5 className="font-medium text-foreground mb-3">Configuration</h5>
          
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="model-input" className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">Model</label>
              <input
                id="model-input"
                type="text"
                value={config.model}
                onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                disabled={isConnected}
                placeholder="OpenAI model name"
                className="w-full px-3 py-2 text-sm border border-border dark:border-border rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-secondary disabled:opacity-50"
              />
            </div>
            
            <div>
              <label htmlFor="voice-select" className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">Voice</label>
              <select
                id="voice-select"
                value={config.voice}
                onChange={(e) => setConfig(prev => ({ ...prev, voice: e.target.value }))}
                disabled={isConnected}
                className="w-full px-3 py-2 text-sm border border-border dark:border-border rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-secondary disabled:opacity-50"
              >
                <option value="verse">Verse</option>
                <option value="alloy">Alloy</option>
                <option value="breeze">Breeze</option>
                <option value="coral">Coral</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">System Instructions</label>
            <textarea
              value={config.instructions}
              onChange={(e) => setConfig(prev => ({ ...prev, instructions: e.target.value }))}
              disabled={isConnected}
              rows={3}
              placeholder="Optional: Custom instructions for the AI assistant..."
              className="w-full px-3 py-2 text-sm border border-border dark:border-border rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-secondary disabled:opacity-50"
            />
          </div>
        </div>
      )}

      {/* Connection Info */}
      {isConnected && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md flex items-center">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
          <span className="text-sm text-green-800 dark:text-green-200">
            Connected! Speak naturally - the AI will respond with streaming audio. You can interrupt at any time.
          </span>
        </div>
      )}

      {/* Event Log */}
      {logs.length > 0 && (
        <div>
          <h5 className="font-medium text-foreground mb-2">Event Log</h5>
          <div className="bg-background text-green-400 text-xs p-3 rounded-md font-mono max-h-40 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 