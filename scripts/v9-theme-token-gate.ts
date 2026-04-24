#!/usr/bin/env tsx
/**
 * V9 theme-token gate (R4 of `docs/prd-v9-ux-restoration.md`).
 *
 * Scans `components/treatment/v9/**` and `lib/v9/**` for raw Tailwind
 * color classes that bypass the theme engine (e.g. `bg-blue-600`,
 * `text-gray-500`, `bg-white`). These break the user's chosen theme
 * (solarized-dark by default), ignore glass-effect intensity, and are
 * how the original V9 client regressed in the first place.
 *
 * Allowed: the HSL-variable-backed tokens declared in `app/globals.css`
 * and `tailwind.config.js` (bg-primary, bg-card, bg-secondary,
 * text-foreground, text-muted-foreground, border-border, etc.) plus
 * opacity modifiers on those tokens (bg-card/95, bg-primary/20).
 *
 * Exit code: 0 on clean, 1 on violation. Run from CI in
 * `.github/workflows/v9-parity-gate.yml`.
 *
 * Enforcement scope:
 *   - `components/treatment/v9/**` (the V9 session shell)
 *   - `lib/v9/**`                   (V9 client + adapter code)
 * Test files (`.test.ts`, `.spec.ts`, `__tests__` dirs) are skipped
 * because tests may assert on the literal disallowed class strings.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');

const SCAN_ROOTS = [
  'components/treatment/v9',
  'lib/v9',
];

// Tailwind color palette names we reject. We explicitly list the ones
// used by the 404-line minimum-viable V9 shell that this PRD is
// replacing, plus every named palette in Tailwind's default config
// so future regressions are caught.
const DISALLOWED_COLOR_NAMES = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
];

const PROPERTY_PREFIXES = [
  'bg',
  'text',
  'border',
  'ring',
  'divide',
  'outline',
  'placeholder',
  'caret',
  'accent',
  'from',
  'via',
  'to',
  'shadow',
  'fill',
  'stroke',
];

// Build a regex that matches e.g. `bg-blue-600` or `text-gray-500/90`
// but NOT `bg-primary`, `bg-primary-foreground`, `text-muted-foreground`.
const colorPaletteClassRegex = new RegExp(
  String.raw`(?<![\w-])` +
    `(?:${PROPERTY_PREFIXES.join('|')})` +
    String.raw`-(?:${DISALLOWED_COLOR_NAMES.join('|')})` +
    String.raw`-\d{2,3}(?:\/\d{1,3})?(?![\w-])`,
  'g',
);

// `bg-white` / `bg-black` / `text-white` / `text-black` etc. are also
// raw-color leaks. These don't follow the `-<palette>-<shade>` shape
// so they need a separate matcher. `transparent` is intentionally
// excluded — `border-transparent` is the idiomatic Tailwind pattern
// for "hide this border, show my focus ring instead" and is theme-
// neutral.
const blackWhiteClassRegex = new RegExp(
  String.raw`(?<![\w-])` +
    `(?:${PROPERTY_PREFIXES.join('|')})` +
    String.raw`-(?:white|black)(?:\/\d{1,3})?(?![\w-])`,
  'g',
);

interface Violation {
  file: string;
  line: number;
  column: number;
  match: string;
  context: string;
}

function walk(dir: string): string[] {
  let results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') {
      continue;
    }
    const full = join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      if (entry === '__tests__') continue;
      results = results.concat(walk(full));
    } else if (s.isFile()) {
      if (
        entry.endsWith('.test.ts') ||
        entry.endsWith('.test.tsx') ||
        entry.endsWith('.spec.ts') ||
        entry.endsWith('.spec.tsx')
      ) {
        continue;
      }
      if (
        entry.endsWith('.ts') ||
        entry.endsWith('.tsx') ||
        entry.endsWith('.js') ||
        entry.endsWith('.jsx')
      ) {
        results.push(full);
      }
    }
  }

  return results;
}

function scanFile(path: string): Violation[] {
  const contents = readFileSync(path, 'utf-8');
  const lines = contents.split(/\r?\n/);
  const violations: Violation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matchers = [colorPaletteClassRegex, blackWhiteClassRegex];
    for (const regex of matchers) {
      regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(line)) !== null) {
        violations.push({
          file: relative(REPO_ROOT, path),
          line: i + 1,
          column: m.index + 1,
          match: m[0],
          context: line.trim(),
        });
      }
    }
  }

  return violations;
}

function main(): void {
  const allFiles: string[] = [];
  for (const root of SCAN_ROOTS) {
    const fullRoot = join(REPO_ROOT, root);
    allFiles.push(...walk(fullRoot));
  }

  let totalViolations = 0;
  const violationsByFile = new Map<string, Violation[]>();

  for (const file of allFiles) {
    const v = scanFile(file);
    if (v.length > 0) {
      violationsByFile.set(file, v);
      totalViolations += v.length;
    }
  }

  if (totalViolations === 0) {
    console.log(
      `✅ V9 theme-token gate: no raw Tailwind color classes found in ${allFiles.length} files.`,
    );
    process.exit(0);
  }

  console.error(
    `❌ V9 theme-token gate: ${totalViolations} violation(s) in ${violationsByFile.size} file(s).`,
  );
  console.error(
    '   Raw Tailwind color classes break theme inheritance. Use theme tokens:',
  );
  console.error(
    '   bg-background, bg-card, bg-primary, bg-secondary, bg-muted, bg-accent, bg-destructive',
  );
  console.error(
    '   text-foreground, text-muted-foreground, border-border, ring-ring, ring-offset-background',
  );
  console.error('   (opacity modifiers like bg-card/95 are allowed)');
  console.error('');

  violationsByFile.forEach((violations, file) => {
    console.error(`  ${file}:`);
    for (const v of violations) {
      console.error(`    ${v.line}:${v.column}  "${v.match}"  ${v.context}`);
    }
  });
  console.error('');
  console.error(
    'To fix: replace the palette class with the appropriate theme token, or add an opacity modifier if you need a tinted variant.',
  );
  process.exit(1);
}

main();
