/**
 * source-patcher.ts  — SERVER ONLY (uses fs)
 *
 * Finds a V5 step by ID in the treatment-modality TypeScript source files,
 * extracts the string/template literal that scriptedResponse returns, and
 * can write a replacement back.
 *
 * Handles all three scriptedResponse shapes used in the codebase:
 *   A) scriptedResponse: "static string",
 *   B) scriptedResponse: (args) => `template ${literal}`,
 *   C) scriptedResponse: (args) => { ...code...; return `template`; },
 */

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// File list
// ---------------------------------------------------------------------------

const MODALITIES_DIR = path.join(process.cwd(), 'lib/v5/treatment-modalities');

const MODALITY_FILES = [
  'introduction.ts',
  'work-type-selection.ts',
  'method-selection.ts',
  'discovery.ts',
  'problem-shifting.ts',
  'identity-shifting.ts',
  'belief-shifting.ts',
  'blockage-shifting.ts',
  'reality-shifting.ts',
  'trauma-shifting.ts',
  'digging-deeper.ts',
  'integration.ts',
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface StepSource {
  filePath: string;        // absolute
  relativeFile: string;    // lib/v5/treatment-modalities/xxx.ts
  /** The raw string literal as it appears in source, including surrounding
   *  quote/backtick characters, e.g.  `"Feel '${x}'..."` */
  stringValue: string;
}

/** Find the scriptedResponse string literal for a given step ID.
 *  Returns null if the step isn't found or has an unparseable response. */
export function findStepSource(stepId: string): StepSource | null {
  for (const fileName of MODALITY_FILES) {
    const filePath = path.join(MODALITIES_DIR, fileName);
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const result = extractFromFile(content, stepId);
    if (!result) continue;

    return {
      filePath,
      relativeFile: `lib/v5/treatment-modalities/${fileName}`,
      stringValue: result,
    };
  }
  return null;
}

/** Replace the scriptedResponse string literal in-place.
 *  Throws if the old value can't be located (safeguard against double-apply). */
export function applyStepCorrection(
  filePath: string,
  oldValue: string,
  newValue: string,
): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const idx = content.indexOf(oldValue);
  if (idx === -1) {
    throw new Error(`Could not find string to replace in ${path.basename(filePath)}`);
  }
  const updated = content.slice(0, idx) + newValue + content.slice(idx + oldValue.length);
  fs.writeFileSync(filePath, updated, 'utf-8');
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Scan `content` for the given step ID, then extract the string literal
 *  that scriptedResponse returns. Returns null on failure. */
function extractFromFile(content: string, stepId: string): string | null {
  // Find the step id declaration
  const idRe = new RegExp(`id:\\s*['"]${escapeRegex(stepId)}['"]`);
  const idMatch = idRe.exec(content);
  if (!idMatch) return null;

  // Find scriptedResponse: within the next ~2000 chars (same step block)
  const searchWindow = content.slice(idMatch.index, idMatch.index + 2000);
  const srMatch = /scriptedResponse:\s*/.exec(searchWindow);
  if (!srMatch) return null;

  const srValuePos = idMatch.index + srMatch.index + srMatch[0].length;
  return extractValue(content, srValuePos);
}

/** Starting at `pos`, skip optional function prefix `(…) =>` then extract
 *  the string literal (or the return value inside a block function). */
function extractValue(content: string, pos: number): string | null {
  let i = skipWhitespace(content, pos);

  // Arrow function prefix:  (...) =>
  if (content[i] === '(') {
    // skip parameter list
    let depth = 1;
    i++;
    while (i < content.length && depth > 0) {
      if (content[i] === '(') depth++;
      else if (content[i] === ')') depth--;
      i++;
    }
    i = skipWhitespace(content, i);
    if (content[i] === '=' && content[i + 1] === '>') i += 2;
    i = skipWhitespace(content, i);
  }

  // Block function body
  if (content[i] === '{') {
    return extractReturnFromBlock(content, i);
  }

  // Inline expression — should be a string literal
  return extractStringLiteral(content, i);
}

/** Find the last `return` statement inside a block function and extract
 *  the string literal that follows it. */
function extractReturnFromBlock(content: string, blockStart: number): string | null {
  // Walk to the matching closing brace
  let depth = 1;
  let i = blockStart + 1;
  while (i < content.length && depth > 0) {
    const ch = content[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    // Skip string literals so embedded braces don't confuse counts
    else if (ch === '"' || ch === "'") {
      i++;
      while (i < content.length && content[i] !== ch) {
        if (content[i] === '\\') i++;
        i++;
      }
    } else if (ch === '`') {
      i++;
      while (i < content.length && content[i] !== '`') {
        if (content[i] === '\\') { i += 2; continue; }
        if (content[i] === '$' && content[i + 1] === '{') {
          i += 2;
          let d = 1;
          while (i < content.length && d > 0) {
            if (content[i] === '{') d++;
            else if (content[i] === '}') d--;
            i++;
          }
          continue;
        }
        i++;
      }
    }
    i++;
  }
  const block = content.slice(blockStart, i);

  // Find the last `return` keyword in the block (matchAll not available at this target)
  const returnRe = /\breturn\s+/g;
  let lastReturnIndex = -1;
  let lastReturnLength = 0;
  let m: RegExpExecArray | null;
  while ((m = returnRe.exec(block)) !== null) {
    lastReturnIndex = m.index;
    lastReturnLength = m[0].length;
  }
  if (lastReturnIndex === -1) return null;
  const retValueStart = blockStart + lastReturnIndex + lastReturnLength;
  return extractStringLiteral(content, retValueStart);
}

/** Extract a quoted string or template literal starting at `pos`. */
function extractStringLiteral(content: string, pos: number): string | null {
  const quote = content[pos];
  if (quote !== '"' && quote !== "'" && quote !== '`') return null;

  let i = pos + 1;

  if (quote === '`') {
    while (i < content.length) {
      const ch = content[i];
      if (ch === '\\') { i += 2; continue; }
      if (ch === '`') { i++; break; }
      if (ch === '$' && content[i + 1] === '{') {
        // skip interpolation expression
        i += 2;
        let depth = 1;
        while (i < content.length && depth > 0) {
          if (content[i] === '{') depth++;
          else if (content[i] === '}') depth--;
          i++;
        }
        continue;
      }
      i++;
    }
  } else {
    while (i < content.length) {
      const ch = content[i];
      if (ch === '\\') { i += 2; continue; }
      if (ch === quote) { i++; break; }
      if (ch === '\n') break; // shouldn't happen for valid TS, bail
      i++;
    }
  }

  return content.slice(pos, i);
}

function skipWhitespace(content: string, pos: number): number {
  while (pos < content.length && /[\s]/.test(content[pos])) pos++;
  return pos;
}
