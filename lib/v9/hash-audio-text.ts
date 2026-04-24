/**
 * TS-side re-export of the shared MD5 hasher for V9's static-audio
 * resolver. See `scripts/hash-audio-text.js` for full rationale.
 *
 * V7 used `crypto.createHash('md5')`; V9 MUST use the exact same
 * function or its resolver will silently miss every V7 manifest
 * entry (R13.4, R11.7).
 */

import { createHash } from 'crypto';

export function hashAudioText(text: string): string {
  return createHash('md5').update(text).digest('hex');
}
