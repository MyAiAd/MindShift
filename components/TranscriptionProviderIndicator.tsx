/**
 * Transcription Provider Indicator
 * 
 * Shows which transcription provider is active (dev mode only).
 * Helps developers verify feature flag configuration.
 */

'use client';

import { useEffect, useState } from 'react';
import { getTranscriptionProvider, isDevelopment } from '@/lib/config';

export function TranscriptionProviderIndicator() {
  const [provider, setProvider] = useState<string>('');
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isDevelopment()) {
      const currentProvider = getTranscriptionProvider();
      setProvider(currentProvider);
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 rounded-md bg-gray-800 px-3 py-2 text-xs text-white shadow-lg">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${provider === 'whisper' ? 'bg-green-500' : 'bg-blue-500'}`} />
        <span className="font-mono">
          {provider === 'whisper' ? '🎯 Whisper' : '🌐 WebSpeech'}
        </span>
      </div>
    </div>
  );
}
