/**
 * V9 Preferences Module
 *
 * Parallel of `lib/v7/v7-preferences.ts` with every v7/V7 identifier
 * rewritten to v9/V9. The surface is intentionally identical so the
 * ported V9 `TreatmentSession` can swap the preferences import without
 * any other change. See R1 + R5 of `docs/prd-v9-ux-restoration.md`.
 *
 * IMPORTANT: V9 never reads, writes, or checks any `v7_*` key. Users
 * who move from V7 to V9 start fresh with device-appropriate defaults
 * (R5). No migration, no cross-version leakage.
 */

export type InteractionMode = 'orb_ptt' | 'listen_only' | 'text_first';

export interface V9VoicePreferences {
  selectedVoice: string;
  playbackSpeed: number;
  vadSensitivity: number;
  micEnabled: boolean;
  speakerEnabled: boolean;
  guidedMode: boolean;
}

export interface V9Preferences extends V9VoicePreferences {
  interactionMode: InteractionMode;
}

// LocalStorage keys — all V9-namespaced. Never touch v7_* keys.
const KEYS = {
  INTERACTION_MODE: 'v9_interaction_mode',
  SELECTED_VOICE: 'v9_selected_voice',
  PLAYBACK_SPEED: 'v9_playback_speed',
  VAD_SENSITIVITY: 'v9_vad_sensitivity',
  MIC_ENABLED: 'v9_mic_enabled',
  SPEAKER_ENABLED: 'v9_speaker_enabled',
  GUIDED_MODE: 'v9_guided_mode',
} as const;

// Event names for in-tab communication
export const V9_EVENTS = {
  INTERACTION_MODE_CHANGED: 'v9-interaction-mode-changed',
  VOICE_SETTINGS_CHANGED: 'v9-voice-settings-changed',
} as const;

/**
 * Detect if the device is mobile based on screen width.
 * Matches V7's `isMobileDevice()` exactly (R1).
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/**
 * Get the default interaction mode based on device type.
 * R5: mobile → `orb_ptt`, desktop → `text_first`.
 */
export function getDefaultInteractionMode(): InteractionMode {
  return isMobileDevice() ? 'orb_ptt' : 'text_first';
}

/**
 * Get the current interaction mode (reads `v9_interaction_mode`).
 */
export function getInteractionMode(): InteractionMode {
  if (typeof window === 'undefined') return 'text_first';

  const stored = localStorage.getItem(KEYS.INTERACTION_MODE);
  if (stored && ['orb_ptt', 'listen_only', 'text_first'].includes(stored)) {
    return stored as InteractionMode;
  }

  return getDefaultInteractionMode();
}

/**
 * Set the interaction mode and dispatch the
 * `V9_EVENTS.INTERACTION_MODE_CHANGED` event.
 */
export function setInteractionMode(mode: InteractionMode): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(KEYS.INTERACTION_MODE, mode);

  const event = new CustomEvent(V9_EVENTS.INTERACTION_MODE_CHANGED, {
    detail: mode,
  });
  window.dispatchEvent(event);
}

/**
 * Get all V9 voice preferences.
 *
 * Voice defaults (mic/speaker) reflect R6:
 *   orb_ptt     → mic ON,  speaker ON
 *   listen_only → mic OFF, speaker ON
 *   text_first  → mic OFF, speaker OFF
 *
 * Explicit user toggles (written to `v9_mic_enabled` / `v9_speaker_enabled`)
 * always win. Only the first-session path falls through to defaults.
 */
export function getVoicePreferences(): V9VoicePreferences {
  if (typeof window === 'undefined') {
    return {
      selectedVoice: 'marin',
      playbackSpeed: 1.0,
      vadSensitivity: 0.5,
      micEnabled: false,
      speakerEnabled: false,
      guidedMode: false,
    };
  }

  const micRaw = localStorage.getItem(KEYS.MIC_ENABLED);
  const spkRaw = localStorage.getItem(KEYS.SPEAKER_ENABLED);
  const guidedRaw = localStorage.getItem(KEYS.GUIDED_MODE);

  const mode = getInteractionMode();
  const defaults = getVoiceDefaultsForMode(mode);

  return {
    selectedVoice: localStorage.getItem(KEYS.SELECTED_VOICE) || 'marin',
    playbackSpeed: parseFloat(localStorage.getItem(KEYS.PLAYBACK_SPEED) || '1.0'),
    vadSensitivity: parseFloat(localStorage.getItem(KEYS.VAD_SENSITIVITY) || '0.5'),
    micEnabled: micRaw === null ? defaults.micEnabled : micRaw === 'true',
    speakerEnabled: spkRaw === null ? defaults.speakerEnabled : spkRaw === 'true',
    guidedMode: guidedRaw === null ? mode === 'orb_ptt' : guidedRaw === 'true',
  };
}

/**
 * Set voice preferences (partial update) and dispatch
 * `V9_EVENTS.VOICE_SETTINGS_CHANGED`.
 */
export function setVoicePreferences(prefs: Partial<V9VoicePreferences>): void {
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

  const event = new CustomEvent(V9_EVENTS.VOICE_SETTINGS_CHANGED, {
    detail: prefs,
  });
  window.dispatchEvent(event);

  if (prefs.selectedVoice !== undefined) {
    const voiceChangedEvent = new CustomEvent('v9-voice-changed', {
      detail: prefs.selectedVoice,
    });
    window.dispatchEvent(voiceChangedEvent);
  }
}

/**
 * Get all V9 preferences.
 */
export function getAllPreferences(): V9Preferences {
  return {
    interactionMode: getInteractionMode(),
    ...getVoicePreferences(),
  };
}

/**
 * R6 lookup: return the voice defaults for a given interaction mode.
 * Used at first-session seed time (when `v9_mic_enabled` /
 * `v9_speaker_enabled` are absent) and also by UI code that wants
 * to reset to mode defaults.
 */
export function getVoiceDefaultsForMode(mode: InteractionMode): {
  micEnabled: boolean;
  speakerEnabled: boolean;
} {
  switch (mode) {
    case 'orb_ptt':
      return { micEnabled: true, speakerEnabled: true };
    case 'listen_only':
      return { micEnabled: false, speakerEnabled: true };
    case 'text_first':
    default:
      return { micEnabled: false, speakerEnabled: false };
  }
}

/**
 * Check if we should show the orb UI.
 * Identical logic to V7's `shouldShowOrb()` (R1).
 */
export function shouldShowOrb(): boolean {
  const mode = getInteractionMode();
  return mode === 'orb_ptt' && isMobileDevice();
}

/**
 * Check if we should show text-first UI.
 */
export function shouldShowTextFirst(): boolean {
  const mode = getInteractionMode();
  return mode === 'text_first' || !isMobileDevice();
}

/**
 * Check if we're in listen-only mode.
 */
export function isListenOnlyMode(): boolean {
  return getInteractionMode() === 'listen_only';
}

/**
 * React hook stub for listening to preference changes. Mirrors V7's
 * `useV7Preferences()`; components can subscribe to
 * `V9_EVENTS.INTERACTION_MODE_CHANGED` directly for fine-grained
 * updates.
 */
export function useV9Preferences() {
  if (typeof window === 'undefined') {
    return {
      preferences: getAllPreferences(),
      refresh: () => {},
    };
  }

  return {
    preferences: getAllPreferences(),
    refresh: () => getAllPreferences(),
  };
}
