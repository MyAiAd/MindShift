/**
 * R11.1 / R11.2 / R11.3 unit tests for `lib/v9/v9-preferences.ts`.
 *
 *   R11.1 — interaction-mode defaulting: mobile + desktop → orb_ptt.
 *   R11.2 — voice-on defaults per mode:
 *             orb_ptt     → mic ON, speaker ON
 *             listen_only → mic OFF, speaker ON
 *             text_first  → mic OFF, speaker OFF
 *   R11.3 — `localStorage` key migration: the preferences module
 *           never reads, writes, or checks any `v7_*` key. Switching
 *           from V7 to V9 gives the user fresh mode-appropriate
 *           defaults.
 *
 * Runs under `node --test` via `tsx`. We stub `window`, `localStorage`,
 * and a minimal custom-event emitter so the module's `typeof window`
 * guards evaluate to "present" without needing jsdom.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// A tiny in-memory localStorage that mimics the browser API surface
// the preferences module uses (`getItem` / `setItem` / `removeItem`).
function makeStorage() {
  const store = new Map<string, string>();
  return {
    store,
    getItem(k: string) {
      return store.has(k) ? (store.get(k) as string) : null;
    },
    setItem(k: string, v: string) {
      store.set(k, v);
    },
    removeItem(k: string) {
      store.delete(k);
    },
  };
}

let restoreWindow: (() => void) | null = null;

function mountWindow({ isMobile }: { isMobile: boolean }) {
  const storage = makeStorage();
  const listeners = new Map<string, Array<(e: any) => void>>();
  const win: any = {
    innerWidth: isMobile ? 390 : 1280,
    localStorage: storage,
    addEventListener(type: string, fn: (e: any) => void) {
      const arr = listeners.get(type) ?? [];
      arr.push(fn);
      listeners.set(type, arr);
    },
    removeEventListener(type: string, fn: (e: any) => void) {
      const arr = listeners.get(type) ?? [];
      listeners.set(
        type,
        arr.filter((f) => f !== fn),
      );
    },
    dispatchEvent(evt: any) {
      (listeners.get(evt?.type) ?? []).forEach((f) => f(evt));
    },
  };
  const originalWindow = (globalThis as any).window;
  const originalStorage = (globalThis as any).localStorage;
  const originalCustomEvent = (globalThis as any).CustomEvent;

  (globalThis as any).window = win;
  (globalThis as any).localStorage = storage;
  (globalThis as any).CustomEvent = class<T> {
    type: string;
    detail: T;
    constructor(type: string, init?: { detail?: T }) {
      this.type = type;
      this.detail = init?.detail as T;
    }
  };

  restoreWindow = () => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).localStorage = originalStorage;
    (globalThis as any).CustomEvent = originalCustomEvent;
  };

  return { storage, listeners };
}

async function reimport() {
  // Nuke the ESM cache slot for the preferences module so each test
  // gets a fresh copy (the module caches nothing of consequence, but
  // the `typeof window` check is evaluated per-call so a fresh import
  // isn't strictly required — we still do it for hygiene).
  const mod = await import('../../lib/v9/v9-preferences');
  return mod;
}

beforeEach(() => {
  restoreWindow = null;
});

afterEach(() => {
  if (restoreWindow) restoreWindow();
  restoreWindow = null;
});

// ---------- R11.1 ----------

test('R11.1: mobile device defaults to orb_ptt', async () => {
  mountWindow({ isMobile: true });
  const prefs = await reimport();
  assert.equal(prefs.isMobileDevice(), true);
  assert.equal(prefs.getInteractionMode(), 'orb_ptt');
});

test('R11.1: desktop defaults to orb_ptt', async () => {
  mountWindow({ isMobile: false });
  const prefs = await reimport();
  assert.equal(prefs.isMobileDevice(), false);
  assert.equal(prefs.getInteractionMode(), 'orb_ptt');
});

test('R11.1: desktop orb mode shows orb', async () => {
  const { storage } = mountWindow({ isMobile: false });
  storage.setItem('v9_interaction_mode', 'orb_ptt');
  const prefs = await reimport();
  assert.equal(prefs.shouldShowOrb(), true);
});

test('R11.1: stored interaction mode overrides the device default', async () => {
  const { storage } = mountWindow({ isMobile: false });
  storage.setItem('v9_interaction_mode', 'listen_only');
  const prefs = await reimport();
  assert.equal(prefs.getInteractionMode(), 'listen_only');
});

test('R11.1: invalid stored mode falls back to device default', async () => {
  const { storage } = mountWindow({ isMobile: true });
  storage.setItem('v9_interaction_mode', 'not_a_real_mode');
  const prefs = await reimport();
  assert.equal(prefs.getInteractionMode(), 'orb_ptt');
});

// ---------- R11.2 ----------

test('R11.2: orb_ptt first-session voice defaults are mic ON, speaker ON', async () => {
  const { storage } = mountWindow({ isMobile: true });
  storage.setItem('v9_interaction_mode', 'orb_ptt');
  const prefs = await reimport();
  const v = prefs.getVoicePreferences();
  assert.equal(v.micEnabled, true);
  assert.equal(v.speakerEnabled, true);
});

test('R11.2: listen_only first-session voice defaults are mic OFF, speaker ON', async () => {
  const { storage } = mountWindow({ isMobile: false });
  storage.setItem('v9_interaction_mode', 'listen_only');
  const prefs = await reimport();
  const v = prefs.getVoicePreferences();
  assert.equal(v.micEnabled, false);
  assert.equal(v.speakerEnabled, true);
});

test('R11.2: text_first first-session voice defaults are mic OFF, speaker OFF', async () => {
  const { storage } = mountWindow({ isMobile: false });
  storage.setItem('v9_interaction_mode', 'text_first');
  const prefs = await reimport();
  const v = prefs.getVoicePreferences();
  assert.equal(v.micEnabled, false);
  assert.equal(v.speakerEnabled, false);
});

test('R11.2: explicit user toggles win over mode defaults', async () => {
  const { storage } = mountWindow({ isMobile: true });
  storage.setItem('v9_interaction_mode', 'orb_ptt');
  storage.setItem('v9_mic_enabled', 'false');
  storage.setItem('v9_speaker_enabled', 'false');
  const prefs = await reimport();
  const v = prefs.getVoicePreferences();
  assert.equal(v.micEnabled, false);
  assert.equal(v.speakerEnabled, false);
});

// ---------- R11.3 ----------

test('R11.3: V7 localStorage keys never leak into V9 behaviour', async () => {
  const { storage } = mountWindow({ isMobile: true });
  // Populate pre-migration V7 keys the user would have had.
  storage.setItem('v7_mic_enabled', 'false');
  storage.setItem('v7_speaker_enabled', 'false');
  storage.setItem('v7_interaction_mode', 'text_first');
  storage.setItem('v7_selected_voice', 'shimmer');

  const prefs = await reimport();

  // V9 must ignore all of the above and give the device default.
  assert.equal(prefs.getInteractionMode(), 'orb_ptt');
  const v = prefs.getVoicePreferences();
  assert.equal(v.micEnabled, true);
  assert.equal(v.speakerEnabled, true);
  assert.equal(v.selectedVoice, 'marin'); // NOT 'shimmer' from V7
});

test('R11.3: setInteractionMode writes only v9_-prefixed keys', async () => {
  const { storage, listeners } = mountWindow({ isMobile: false });
  const prefs = await reimport();

  let dispatched: any = null;
  listeners.set('v9-interaction-mode-changed', [(e: any) => (dispatched = e)]);

  prefs.setInteractionMode('orb_ptt');

  assert.equal(storage.getItem('v9_interaction_mode'), 'orb_ptt');
  assert.equal(storage.getItem('v7_interaction_mode'), null);
  assert.ok(dispatched, 'mode-change event must fire');
});

test('R11.3: setVoicePreferences writes only v9_-prefixed keys and fires event', async () => {
  const { storage, listeners } = mountWindow({ isMobile: false });
  const prefs = await reimport();

  let voiceChangeCount = 0;
  listeners.set('v9-voice-settings-changed', [() => voiceChangeCount++]);

  prefs.setVoicePreferences({
    selectedVoice: 'heart',
    micEnabled: true,
    speakerEnabled: true,
  });

  assert.equal(storage.getItem('v9_selected_voice'), 'heart');
  assert.equal(storage.getItem('v9_mic_enabled'), 'true');
  assert.equal(storage.getItem('v9_speaker_enabled'), 'true');
  assert.equal(storage.getItem('v7_selected_voice'), null);
  assert.equal(voiceChangeCount, 1);
});
