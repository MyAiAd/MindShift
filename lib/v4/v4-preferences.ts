/**
 * V4 Preferences Module
 * Single source of truth for V4 interaction modes and voice settings
 */

export type InteractionMode = 'orb_ptt' | 'listen_only' | 'text_first';

export interface V4VoicePreferences {
  selectedVoice: string;
  playbackSpeed: number;
  vadSensitivity: number;
  micEnabled: boolean;
  speakerEnabled: boolean;
  guidedMode: boolean;
}

export interface V4Preferences extends V4VoicePreferences {
  interactionMode: InteractionMode;
}

// LocalStorage keys
const KEYS = {
  INTERACTION_MODE: 'v4_interaction_mode',
  SELECTED_VOICE: 'v4_selected_voice',
  PLAYBACK_SPEED: 'v4_playback_speed',
  VAD_SENSITIVITY: 'v4_vad_sensitivity',
  MIC_ENABLED: 'v4_mic_enabled',
  SPEAKER_ENABLED: 'v4_speaker_enabled',
  GUIDED_MODE: 'v4_guided_mode',
} as const;

// Event names for in-tab communication
export const V4_EVENTS = {
  INTERACTION_MODE_CHANGED: 'v4-interaction-mode-changed',
  VOICE_SETTINGS_CHANGED: 'v4-voice-settings-changed',
} as const;

/**
 * Detect if the device is mobile based on screen width
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/**
 * Get the default interaction mode based on device type
 */
export function getDefaultInteractionMode(): InteractionMode {
  return isMobileDevice() ? 'orb_ptt' : 'text_first';
}

/**
 * Get the current interaction mode
 */
export function getInteractionMode(): InteractionMode {
  if (typeof window === 'undefined') return 'text_first';
  
  const stored = localStorage.getItem(KEYS.INTERACTION_MODE);
  if (stored && ['orb_ptt', 'listen_only', 'text_first'].includes(stored)) {
    return stored as InteractionMode;
  }
  
  // Default based on device
  return getDefaultInteractionMode();
}

/**
 * Set the interaction mode
 */
export function setInteractionMode(mode: InteractionMode): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(KEYS.INTERACTION_MODE, mode);
  
  // Emit event for same-tab listeners
  const event = new CustomEvent(V4_EVENTS.INTERACTION_MODE_CHANGED, {
    detail: mode,
  });
  window.dispatchEvent(event);
}

/**
 * Get all V4 voice preferences
 */
export function getVoicePreferences(): V4VoicePreferences {
  if (typeof window === 'undefined') {
    return {
      selectedVoice: 'heart',
      playbackSpeed: 1.0,
      vadSensitivity: 0.5,
      micEnabled: false,
      speakerEnabled: true,
      guidedMode: false,
    };
  }
  
  return {
    selectedVoice: localStorage.getItem(KEYS.SELECTED_VOICE) || 'heart',
    playbackSpeed: parseFloat(localStorage.getItem(KEYS.PLAYBACK_SPEED) || '1.0'),
    vadSensitivity: parseFloat(localStorage.getItem(KEYS.VAD_SENSITIVITY) || '0.5'),
    micEnabled: localStorage.getItem(KEYS.MIC_ENABLED) === 'true',
    speakerEnabled: localStorage.getItem(KEYS.SPEAKER_ENABLED) !== 'false', // default true
    guidedMode: localStorage.getItem(KEYS.GUIDED_MODE) === 'true',
  };
}

/**
 * Set voice preferences (partial update)
 */
export function setVoicePreferences(prefs: Partial<V4VoicePreferences>): void {
  if (typeof window === 'undefined') return;
  
  if (prefs.selectedVoice !== undefined) {
    localStorage.setItem(KEYS.SELECTED_VOICE, prefs.selectedVoice);
  }
  if (prefs.playbackSpeed !== undefined) {
    localStorage.setItem(KEYS.PLAYBACK_SPEED, prefs.playbackSpeed.toString());
  }
  if (prefs.vadSensitivity !== undefined) {
    localStorage.setItem(KEYS.VAD_SENSITIVITY, prefs.vadSensitivity.toString());
  }
  if (prefs.micEnabled !== undefined) {
    localStorage.setItem(KEYS.MIC_ENABLED, prefs.micEnabled.toString());
  }
  if (prefs.speakerEnabled !== undefined) {
    localStorage.setItem(KEYS.SPEAKER_ENABLED, prefs.speakerEnabled.toString());
  }
  if (prefs.guidedMode !== undefined) {
    localStorage.setItem(KEYS.GUIDED_MODE, prefs.guidedMode.toString());
  }
  
  // Emit event for same-tab listeners
  const event = new CustomEvent(V4_EVENTS.VOICE_SETTINGS_CHANGED, {
    detail: prefs,
  });
  window.dispatchEvent(event);
  
  // Also emit the legacy v4-voice-changed event if voice changed
  if (prefs.selectedVoice !== undefined) {
    const legacyEvent = new CustomEvent('v4-voice-changed', {
      detail: prefs.selectedVoice,
    });
    window.dispatchEvent(legacyEvent);
  }
}

/**
 * Get all V4 preferences
 */
export function getAllPreferences(): V4Preferences {
  return {
    interactionMode: getInteractionMode(),
    ...getVoicePreferences(),
  };
}

/**
 * Check if we should show the orb UI
 */
export function shouldShowOrb(): boolean {
  const mode = getInteractionMode();
  return mode === 'orb_ptt' && isMobileDevice();
}

/**
 * Check if we should show text-first UI
 */
export function shouldShowTextFirst(): boolean {
  const mode = getInteractionMode();
  return mode === 'text_first' || !isMobileDevice();
}

/**
 * Check if we're in listen-only mode
 */
export function isListenOnlyMode(): boolean {
  return getInteractionMode() === 'listen_only';
}

/**
 * React hook for listening to preference changes
 * Returns current preferences and a refresh function
 */
export function useV4Preferences() {
  if (typeof window === 'undefined') {
    return {
      preferences: getAllPreferences(),
      refresh: () => {},
    };
  }
  
  // This is a simple version - in a React component, you'd use useState/useEffect
  return {
    preferences: getAllPreferences(),
    refresh: () => getAllPreferences(),
  };
}
