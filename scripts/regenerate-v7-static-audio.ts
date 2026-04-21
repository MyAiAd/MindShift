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

// `marin` and `cedar` are the post-2025-03 top-tier OpenAI voices and are only
// available on gpt-4o-mini-tts. The older voices stay supported so past manifests
// remain regenerable from the script.
const SUPPORTED_VOICES = new Set([
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova',
  'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar',
]);

// Models that support the `instructions` parameter. The static-side default
// model is a pinned gpt-4o-mini-tts snapshot so instructions ARE sent by default.
function modelSupportsInstructions(model: string): boolean {
  return model.startsWith('gpt-4o-mini-tts');
}

// Approximate price for dry-run cost estimation only. gpt-4o-mini-tts is billed
// per token not per character, but this script counts characters for a quick
// order-of-magnitude figure; the token count is roughly chars/4 for English.
const MODEL_PRICE_PER_MILLION_CHARS: Record<string, number> = {
  'tts-1-hd': 30.0,
  'tts-1': 15.0,
  'gpt-4o-mini-tts': 3.0,                 // ~$12/1M output tokens, ~4 chars/token
  'gpt-4o-mini-tts-2025-03-20': 3.0,
  'gpt-4o-mini-tts-2025-12-15': 3.0,
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    voice: process.env.NEXT_PUBLIC_V7_DEFAULT_VOICE || 'marin',
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
  instructions?: string | null;
  entries: ManifestEntry[];
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // Keep in lockstep with OPENAI_TTS_MODEL in app/api/tts/route.ts. Both sides
  // MUST synthesize on the same model snapshot + voice + instructions so that
  // the pre-rendered clips and the live /api/tts clips sound identical.
  const model = process.env.OPENAI_TTS_STATIC_MODEL || 'gpt-4o-mini-tts-2025-03-20';
  const DEFAULT_INSTRUCTIONS =
    'Speak in a warm, calm, unhurried voice with a therapeutic presence. Pace slightly slower than conversational. Gentle vowel releases. Leave natural micro-pauses at commas and between clauses. Never sound rushed, bright, or upbeat. The speaker is a patient, caring clinician.';
  const instructions = modelSupportsInstructions(model)
    ? (process.env.OPENAI_TTS_INSTRUCTIONS || DEFAULT_INSTRUCTIONS)
    : null;
  const outDir = path.resolve(process.cwd(), 'public', 'audio', 'v7', 'static', args.voice);
  const manifestPath = path.join(outDir, 'manifest.json');
  const texts = V7_STATIC_AUDIO_TEXTS;

  console.log(`[v7-regen] voice=${args.voice} model=${model} dry-run=${args.dryRun} force=${args.force}`);
  if (instructions) {
    console.log(`[v7-regen] instructions="${instructions.slice(0, 80)}${instructions.length > 80 ? '…' : ''}"`);
  }
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
    const payload: Parameters<OpenAI['audio']['speech']['create']>[0] = {
      model,
      input: text,
      voice: args.voice as any,
      response_format: 'mp3',
    };
    if (instructions) {
      (payload as unknown as { instructions?: string }).instructions = instructions;
    }
    const response = await openai!.audio.speech.create(payload);
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
    instructions: instructions ?? null,
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
