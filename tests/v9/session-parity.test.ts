/**
 * R11.5 + R11.8 session-level parity tests for the ported V9
 * TreatmentSession component.
 *
 *   R11.5 — V9's first assistant message renders exactly the string
 *           returned by the backend. No `INITIAL_WELCOME` override,
 *           no trimming, no prefix injection. If the backend returns
 *           a welcome string with trailing punctuation or emoji, the
 *           client displays it byte-for-byte.
 *   R11.8 — the admin drawer only renders when the user's role is
 *           `super_admin` or `tenant_admin`. Non-admin sessions
 *           never see the drawer's toggle tab or panel.
 *
 * Note: these tests don't run the component under jsdom (would pull
 * in the full Next.js dependency tree). Instead they assert on the
 * component's source code directly — guarding against regressions in
 * the R7 / R2 contract at the text level. That's not a full render
 * test, but it's enough to catch the "someone added
 * INITIAL_WELCOME.substitute(...) back in" class of regression.
 *
 * The heavier interaction/visual coverage lives in the Playwright
 * suite (`tests/v9/visual-regression.spec.ts`, R14).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SESSION_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'components',
  'treatment',
  'v9',
  'TreatmentSession.tsx',
);
const CORE_PATH = path.resolve(__dirname, '..', '..', 'lib', 'v9', 'core.ts');

function readSession(): string {
  return readFileSync(SESSION_PATH, 'utf-8');
}

function readCore(): string {
  return readFileSync(CORE_PATH, 'utf-8');
}

// ---------- R11.5 ----------

test('R11.5: V9 TreatmentSession does NOT import V7_STATIC_AUDIO_TEXTS', () => {
  const src = readSession();
  assert.equal(
    src.includes("V7_STATIC_AUDIO_TEXTS"),
    false,
    'V9 must not reference V7_STATIC_AUDIO_TEXTS — that import is the '
      + 'exact line that made V7 overwrite the first bubble. See R7.',
  );
});

test('R11.5: V9 startSession uses data.message, not a hard-coded welcome', () => {
  const src = readSession();
  // Pull the `const startSession = async () => { ... };` block.
  const match = src.match(
    /const startSession = async \(\) => \{([\s\S]*?)\n  \};/,
  );
  assert.ok(match, 'startSession function must exist');
  const body = match![1];

  assert.ok(
    /data\.message/.test(body),
    'startSession must consume data.message from the backend',
  );
  assert.ok(
    /const welcomeText: string = data\.message/.test(body),
    'welcomeText must be sourced from data.message byte-for-byte',
  );
  // No client-side string constants as the welcome.
  assert.equal(
    /INITIAL_WELCOME/.test(body),
    false,
    'startSession must not use the INITIAL_WELCOME constant (R7)',
  );
});

test('R11.5: V9 captures voicePair from start response (R9)', () => {
  const src = readSession();
  assert.ok(
    /setVoicePair\(data\.voicePair\)/.test(src),
    'V9 must capture the pinned voicePair from the start response',
  );
});

test('R11.5: V9 start clears stale context with the current user id', () => {
  const src = readCore();
  assert.ok(
    /clearContext\(sessionId,\s*\{\s*userId\s*\}\)/.test(src),
    'V9 start must seed a fresh context and not reload stale persisted state',
  );
});

// ---------- R11.8 ----------

test('R11.8: AdminDebugDrawer is gated on isAdmin', () => {
  const src = readSession();
  // The admin check should wrap the drawer render block.
  const block = src.match(/\{isAdmin && \([\s\S]{0,900}AdminDebugDrawer[\s\S]{0,600}?\)\}/);
  assert.ok(
    block,
    'AdminDebugDrawer must be rendered inside a block guarded by `isAdmin` only',
  );
});

test('R11.8: isAdmin is derived from profile.role super_admin/tenant_admin', () => {
  const src = readSession();
  assert.ok(
    /profile\?\.role === 'super_admin'/.test(src) &&
      /profile\?\.role === 'tenant_admin'/.test(src),
    'isAdmin must be derived strictly from profile.role === super_admin || tenant_admin',
  );
});

test('R11.8: voicePair and showAudioTelemetry props are passed to AdminDebugDrawer', () => {
  const src = readSession();
  assert.ok(
    /voicePair=\{voicePair\}/.test(src),
    'voicePair state must be forwarded to the drawer (R9)',
  );
  assert.ok(
    /showAudioTelemetry/.test(src),
    'showAudioTelemetry prop must be enabled (R13.4)',
  );
});

// ---------- defence-in-depth: no v7_ localStorage leak ----------

test('R11.3 guard: V9 session component never reads or writes a v7_ key', () => {
  const src = readSession();
  const matches = src.match(/['"]v7_[a-z_]+['"]/g) ?? [];
  assert.deepEqual(
    matches,
    [],
    'V9 TreatmentSession must not reference any v7_-prefixed localStorage key',
  );
});

test('R11 guard: V9 session imports V9 preferences, not V7 preferences', () => {
  const src = readSession();
  assert.ok(
    /from '@\/lib\/v9\/v9-preferences'/.test(src),
    'V9 must import preferences from @/lib/v9/v9-preferences',
  );
  assert.equal(
    /from '@\/lib\/v7\/v7-preferences'/.test(src),
    false,
    'V9 must not import V7 preferences',
  );
});
