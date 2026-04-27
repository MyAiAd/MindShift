/**
 * R11.6 + R11.7 unit tests for `lib/v9/static-audio-resolver.ts`.
 *
 * These tests run under `node --test` via `tsx` (see the
 * `ci:v9-unit` script in package.json) so they can exercise the
 * resolver without a full Next.js runtime.
 *
 * Coverage:
 *   R11.6 — hash resolver finds a V7 manifest entry for a known
 *           canonical text + voice and returns the correct asset path.
 *   R11.7 — unknown canonical text returns `{ kind: 'miss' }` and
 *           increments the miss telemetry counter.
 *   Bonus  — V9-over-V7 preference on hash collision.
 *   Bonus  — parity assertion logs on mismatch but does not throw.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { hashAudioText } from '../../lib/v9/hash-audio-text';
import {
  __resetResolverForTests,
  assertAudioPlaybackParity,
  getResolverTelemetry,
  resolveStaticAudio,
} from '../../lib/v9/static-audio-resolver';

// The resolver reaches for `fetch` to load the manifests. We stub the
// global `fetch` to serve in-memory JSON blobs keyed by path so the
// tests are fully hermetic (no disk, no network).

type FetchMap = Record<string, unknown | null>;

function mountFetch(responses: FetchMap): () => void {
  const originalFetch = (globalThis as any).fetch;
  (globalThis as any).fetch = async (url: string) => {
    if (!(url in responses) || responses[url] === null) {
      return {
        ok: false,
        status: 404,
        json: async () => {
          throw new Error('404');
        },
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => responses[url],
    };
  };
  return () => {
    (globalThis as any).fetch = originalFetch;
  };
}

const V7_WELCOME_TEXT =
  "Hello. Welcome to Mind Shifting. I'm here to guide you through a session.";

function buildV7Manifest(texts: Record<string, string>) {
  const out: Record<string, unknown> = {};
  for (const [semanticKey, text] of Object.entries(texts)) {
    const hash = hashAudioText(text);
    out[semanticKey] = {
      hash,
      filename: `${semanticKey}.opus`,
      path: `/audio/v7/static/marin/${semanticKey}.opus`,
      formats: {
        opus: { path: `/audio/v7/static/marin/${semanticKey}.opus` },
        wav: { path: `/audio/v7/static/marin/${semanticKey}.wav` },
      },
    };
  }
  return out;
}

function buildV9Manifest(voice: string, texts: Record<string, string>) {
  return {
    voice,
    model: 'gpt-4o-mini-tts-2026-04-01',
    generated_at: new Date().toISOString(),
    entries: Object.entries(texts).map(([key, text]) => {
      const hash = hashAudioText(text);
      return {
        key,
        text,
        hash,
        file: `${key}.opus`,
        path: `/audio/v9/static/${voice}/${key}.opus`,
      };
    }),
  };
}

let unmountFetch: (() => void) | null = null;

beforeEach(() => {
  __resetResolverForTests();
});

afterEach(() => {
  if (unmountFetch) {
    unmountFetch();
    unmountFetch = null;
  }
});

// ---------- R11.6 ----------

test('R11.6: V7 manifest hit for known canonical text increments hitsV7', async () => {
  const v7Manifest = buildV7Manifest({
    INITIAL_WELCOME: V7_WELCOME_TEXT,
  });
  unmountFetch = mountFetch({
    '/audio/v9/static/marin/manifest.json': null,
    '/audio/v7/static/marin/manifest.json': v7Manifest,
  });

  const result = await resolveStaticAudio(V7_WELCOME_TEXT, 'marin');

  assert.equal(result.kind, 'hit');
  if (result.kind === 'hit') {
    assert.equal(result.scope, 'v7');
    assert.equal(result.voice, 'marin');
    assert.equal(
      result.assetPath,
      '/audio/v7/static/marin/INITIAL_WELCOME.opus',
    );
    assert.equal(result.hash, hashAudioText(V7_WELCOME_TEXT));
  }

  const t = getResolverTelemetry();
  assert.equal(t.hitsV7, 1);
  assert.equal(t.hitsV9, 0);
  assert.equal(t.misses, 0);
});

test('R11.6: V7 fallback accepts generated entries-array manifest shape', async () => {
  const text = 'Choose which Mind Shifting method you would like to use to clear the problem:';
  const v7Manifest = {
    ...buildV9Manifest('marin', { METHOD_SELECTION: text }),
    entries: [
      {
        key: 'METHOD_SELECTION',
        text,
        hash: hashAudioText(text),
        file: 'method_selection.mp3',
        path: '/audio/v7/static/marin/method_selection.mp3',
      },
    ],
  };

  unmountFetch = mountFetch({
    '/audio/v9/static/marin/manifest.json': null,
    '/audio/v7/static/marin/manifest.json': v7Manifest,
  });

  const result = await resolveStaticAudio(text, 'marin');

  assert.equal(result.kind, 'hit');
  if (result.kind === 'hit') {
    assert.equal(result.scope, 'v7');
    assert.equal(result.assetPath, '/audio/v7/static/marin/method_selection.mp3');
  }

  const t = getResolverTelemetry();
  assert.equal(t.hitsV7, 1);
  assert.equal(t.hitsV9, 0);
  assert.equal(t.misses, 0);
});

// ---------- R11.7 ----------

test('R11.7: unknown canonical text returns miss and increments misses', async () => {
  const v7Manifest = buildV7Manifest({
    INITIAL_WELCOME: V7_WELCOME_TEXT,
  });
  unmountFetch = mountFetch({
    '/audio/v9/static/marin/manifest.json': null,
    '/audio/v7/static/marin/manifest.json': v7Manifest,
  });

  const result = await resolveStaticAudio(
    'Some brand new string the backend invented today',
    'marin',
  );
  assert.equal(result.kind, 'miss');

  const t = getResolverTelemetry();
  assert.equal(t.hitsV7, 0);
  assert.equal(t.hitsV9, 0);
  assert.equal(t.misses, 1);
});

test('R11.7: miss when the voice has no manifests at all', async () => {
  unmountFetch = mountFetch({
    '/audio/v9/static/unknown/manifest.json': null,
    '/audio/v7/static/unknown/manifest.json': null,
  });

  const result = await resolveStaticAudio('anything here', 'unknown');
  assert.equal(result.kind, 'miss');

  const t = getResolverTelemetry();
  assert.equal(t.misses, 1);
});

test('R11.7: empty canonical text is a miss without touching the manifests', async () => {
  unmountFetch = mountFetch({
    '/audio/v9/static/marin/manifest.json': null,
    '/audio/v7/static/marin/manifest.json': null,
  });

  const result = await resolveStaticAudio('   ', 'marin');
  assert.equal(result.kind, 'miss');

  const t = getResolverTelemetry();
  assert.equal(t.misses, 1);
});

// ---------- V9-wins-on-collision ----------

test('V9 manifest wins on hash collision with V7', async () => {
  const text = 'Tell me about your problem.';
  const v7Manifest = buildV7Manifest({ PROBLEM_PROMPT: text });
  const v9Manifest = buildV9Manifest('marin', { PROBLEM_PROMPT: text });

  unmountFetch = mountFetch({
    '/audio/v9/static/marin/manifest.json': v9Manifest,
    '/audio/v7/static/marin/manifest.json': v7Manifest,
  });

  const result = await resolveStaticAudio(text, 'marin');
  assert.equal(result.kind, 'hit');
  if (result.kind === 'hit') {
    assert.equal(result.scope, 'v9');
    assert.equal(result.assetPath, '/audio/v9/static/marin/PROBLEM_PROMPT.opus');
  }

  const t = getResolverTelemetry();
  assert.equal(t.hitsV9, 1);
  assert.equal(t.hitsV7, 0);
});

// ---------- parity assertion ----------

test('assertAudioPlaybackParity is a no-op when texts match', () => {
  let called = false;
  const origError = console.error;
  console.error = () => {
    called = true;
  };
  try {
    assertAudioPlaybackParity('hello', 'hello');
    assert.equal(called, false);
  } finally {
    console.error = origError;
  }
});

test('assertAudioPlaybackParity logs to console.error on dev mismatch and does not throw', () => {
  const origError = console.error;
  const env = process.env as Record<string, string | undefined>;
  const origEnv = env.NODE_ENV;
  let calls = 0;
  console.error = () => {
    calls++;
  };
  try {
    env.NODE_ENV = 'development';
    assert.doesNotThrow(() =>
      assertAudioPlaybackParity('rendered text here', 'different resolved text'),
    );
    assert.equal(calls, 1);
  } finally {
    console.error = origError;
    if (origEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = origEnv;
  }
});

test('hashAudioText returns a 32-char md5 hex for a simple input', () => {
  const h = hashAudioText('hello');
  assert.match(h, /^[0-9a-f]{32}$/);
  // known md5('hello') value
  assert.equal(h, '5d41402abc4b2a76b9719d911017c592');
});
