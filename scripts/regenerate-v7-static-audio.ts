#!/usr/bin/env tsx
/**
 * US-012: V7 static-audio regeneration script.
 *
 * Reads every prompt from `lib/v7/static-audio-texts.ts` and regenerates the static-audio
 * library under `public/audio/v7/static/<voice>/` using the OpenAI TTS API. Honours the
 * determinism policy from US-011 (docs/v7-tts-determinism-policy.md) — the default model is
 * `tts-1-hd` (deterministic) sourced from `OPENAI_TTS_STATIC_MODEL`.
 *
 * Usage:
 *
 *   # Dry run — just report what would be generated:
 *   npx tsx scripts/regenerate-v7-static-audio.ts --voice shimmer --dry-run
 *
 *   # Idempotent regen — skip files that already exist:
 *   npx tsx scripts/regenerate-v7-static-audio.ts --voice shimmer
 *
 *   # Full regen — overwrite everything:
 *   npx tsx scripts/regenerate-v7-static-audio.ts --voice shimmer --force
 *
 * Environment:
 *   OPENAI_API_KEY             — required
 *   OPENAI_TTS_STATIC_MODEL    — default 'tts-1-hd' (per Policy C, US-011)
 *   NEXT_PUBLIC_V7_DEFAULT_VOICE — fallback if --voice is not supplied
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import OpenAI from 'openai';

import { V7_STATIC_AUDIO_TEXTS } from '../lib/v7/static-audio-texts';

type Args = {
  voice: string;
  dryRun: boolean;
  force: boolean;
};

const SUPPORTED_VOICES = new Set(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']);

// Approximate price-per-1M-chars for the static models. Used for dry-run cost estimation only.
const MODEL_PRICE_PER_MILLION_CHARS: Record<string, number> = {
  'tts-1-hd': 30.0,
  'tts-1': 15.0,
  'gpt-4o-mini-tts': 12.0,
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    voice: process.env.NEXT_PUBLIC_V7_DEFAULT_VOICE || 'shimmer',
    dryRun: false,
    force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--voice') {
      const next = argv[i + 1];
      if (!next) throw new Error('--voice requires a value');
      args.voice = next;
      i++;
    } else if (a.startsWith('--voice=')) {
      args.voice = a.slice('--voice='.length);
    }
  }
  if (!SUPPORTED_VOICES.has(args.voice)) {
    throw new Error(
      `Unsupported voice '${args.voice}'. Supported: ${Array.from(SUPPORTED_VOICES).join(', ')}`,
    );
  }
  return args;
}

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

function fileSha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

type ManifestEntry = {
  key: string;
  text: string;
  file: string;
  hash: string;
  checksum: string;
  path: string;
  size_bytes: number;
};

type Manifest = {
  voice: string;
  model: string;
  generated_at: string;
  entries: ManifestEntry[];
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const model = process.env.OPENAI_TTS_STATIC_MODEL || 'tts-1-hd';
  const outDir = path.resolve(process.cwd(), 'public', 'audio', 'v7', 'static', args.voice);
  const manifestPath = path.join(outDir, 'manifest.json');
  const texts = V7_STATIC_AUDIO_TEXTS;

  console.log(`[v7-regen] voice=${args.voice} model=${model} dry-run=${args.dryRun} force=${args.force}`);
  console.log(`[v7-regen] output=${outDir}`);
  console.log(`[v7-regen] prompts=${Object.keys(texts).length}`);

  if (!args.dryRun) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const priorManifest: Manifest | null = (() => {
    if (!fs.existsSync(manifestPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Manifest;
    } catch {
      return null;
    }
  })();

  const openai = args.dryRun
    ? null
    : (() => {
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('OPENAI_API_KEY is not set');
        }
        return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      })();

  const entries: ManifestEntry[] = [];
  let generatedCount = 0;
  let skippedCount = 0;
  let totalChars = 0;

  for (const [key, text] of Object.entries(texts) as Array<[string, string]>) {
    totalChars += text.length;
    const hash = hashText(text);
    const filename = `${key.toLowerCase()}-${hash}.mp3`;
    const filePath = path.join(outDir, filename);
    const relPath = `/audio/v7/static/${args.voice}/${filename}`;

    const alreadyExists = fs.existsSync(filePath);
    if (alreadyExists && !args.force) {
      const existingBuf = fs.readFileSync(filePath);
      const checksum = fileSha256(existingBuf);
      entries.push({
        key,
        text,
        file: filename,
        hash,
        checksum,
        path: relPath,
        size_bytes: existingBuf.byteLength,
      });
      skippedCount++;
      console.log(`[v7-regen]  skip  ${key}  (exists)`);
      continue;
    }

    if (args.dryRun) {
      console.log(`[v7-regen]  plan  ${key}  (${text.length} chars → ${filename})`);
      continue;
    }

    console.log(`[v7-regen]  gen   ${key}  (${text.length} chars → ${filename})`);
    const response = await openai!.audio.speech.create({
      model,
      input: text,
      voice: args.voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
      response_format: 'mp3',
    });
    const buf = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buf);

    if (priorManifest) {
      const prior = priorManifest.entries.find((e) => e.key === key);
      if (prior && prior.text === text && prior.checksum !== fileSha256(buf)) {
        console.log(JSON.stringify({
          event: 'v7_static_audio_nondeterministic_diff',
          filename,
          key,
          prior_checksum: prior.checksum,
          new_checksum: fileSha256(buf),
          model,
        }));
      }
    }

    entries.push({
      key,
      text,
      file: filename,
      hash,
      checksum: fileSha256(buf),
      path: relPath,
      size_bytes: buf.byteLength,
    });
    generatedCount++;
  }

  const manifest: Manifest = {
    voice: args.voice,
    model,
    generated_at: new Date().toISOString(),
    entries,
  };

  if (args.dryRun) {
    const estimatedCost =
      ((MODEL_PRICE_PER_MILLION_CHARS[model] ?? 30.0) * totalChars) / 1_000_000;
    console.log(`[v7-regen] DRY RUN summary:`);
    console.log(`[v7-regen]   prompts          : ${Object.keys(texts).length}`);
    console.log(`[v7-regen]   total characters : ${totalChars}`);
    console.log(`[v7-regen]   est. cost        : $${estimatedCost.toFixed(3)} @ ${model}`);
    return;
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  const estimatedCost =
    ((MODEL_PRICE_PER_MILLION_CHARS[model] ?? 30.0) * totalChars) / 1_000_000;
  console.log(`[v7-regen] DONE.`);
  console.log(`[v7-regen]   generated  : ${generatedCount}`);
  console.log(`[v7-regen]   skipped    : ${skippedCount}`);
  console.log(`[v7-regen]   total chars: ${totalChars}`);
  console.log(`[v7-regen]   est. cost  : $${estimatedCost.toFixed(3)} @ ${model}`);
  console.log(`[v7-regen]   manifest   : ${manifestPath}`);
}

main().catch((err) => {
  console.error('[v7-regen] FAILED:', err);
  process.exit(1);
});
