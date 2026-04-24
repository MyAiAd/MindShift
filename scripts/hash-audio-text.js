/**
 * Shared hash function for V7 / V9 static-audio manifests.
 *
 * V7's original generator (`scripts/generate-static-audio.js`) used
 *   crypto.createHash('md5').update(text).digest('hex')
 * as the content-address for each TTS clip. V9's static-audio
 * resolver (`lib/v9/static-audio-resolver.ts`) **must** use the exact
 * same function, otherwise V9 would silently miss every V7 manifest
 * entry and fall back to runtime TTS. See R13.1 + R13.4 of
 * `docs/prd-v9-ux-restoration.md`.
 *
 * This file is the single source of truth, re-exported as both
 * CommonJS (for the V7 generator and any future Phase 2 generator)
 * and consumed by `lib/v9/hash-audio-text.ts` on the TS side via a
 * shim (node:crypto works in both Next.js SSR and Node scripts, so
 * the resolver can just import this from inside `lib/v9/` in a
 * Node/Edge-safe way). No text normalisation — the hash is computed
 * against the byte-for-byte canonical text returned by the backend.
 */
'use strict';

const crypto = require('crypto');

function hashAudioText(text) {
  if (typeof text !== 'string') {
    throw new TypeError('hashAudioText: text must be a string');
  }
  return crypto.createHash('md5').update(text).digest('hex');
}

module.exports = {
  hashAudioText,
};
