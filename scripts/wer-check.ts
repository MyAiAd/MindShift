#!/usr/bin/env tsx
/**
 * US-021 — Automated WER check against the v7 speech corpus.
 *
 * Reads every .wav / .json pair under tests/fixtures/v7-speech-corpus/,
 * sends the .wav to OpenAI's Speech-to-Text (OPENAI_STT_MODEL, default
 * gpt-4o-mini-transcribe) with language='en', and records the word-error
 * rate against the companion .json's ground-truth transcript.
 *
 * Output:
 *   tasks/v7-speech-corpus-wer-results.csv    per-clip results
 *   tasks/v7-speech-corpus-wer-summary.md     aggregated by condition tag
 *
 * This only covers the automated / scriptable portion of the US-021
 * plan — "WER check (automated)" step 2 in the plan. The end-to-end
 * 54-cell flow traversal (step 3) still requires a manual QA pass.
 *
 * For silent-control clips, WER is defined as 0 if the returned
 * transcript is empty (ideal behaviour) or 1 otherwise (false positive
 * — STT invented speech where there was none).
 *
 * Requires: OPENAI_API_KEY.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import OpenAI from 'openai';

const ROOT = path.resolve(__dirname, '..');
const CORPUS_DIR = path.join(ROOT, 'tests', 'fixtures', 'v7-speech-corpus');
const RESULTS_CSV = path.join(ROOT, 'tasks', 'v7-speech-corpus-wer-results.csv');
const SUMMARY_MD = path.join(ROOT, 'tasks', 'v7-speech-corpus-wer-summary.md');
const STT_MODEL = process.env.OPENAI_STT_MODEL || 'gpt-4o-mini-transcribe';

type CorpusPair = {
  bucket: string;
  id: string;
  wavPath: string;
  transcript: string;
  conditionTags: string[];
  durationSec: number;
};

function loadCorpus(): CorpusPair[] {
  const out: CorpusPair[] = [];
  if (!fs.existsSync(CORPUS_DIR)) return out;
  const buckets = fs.readdirSync(CORPUS_DIR).filter((e) =>
    fs.statSync(path.join(CORPUS_DIR, e)).isDirectory()
  );
  for (const bucket of buckets) {
    const bdir = path.join(CORPUS_DIR, bucket);
    for (const entry of fs.readdirSync(bdir)) {
      if (!entry.toLowerCase().endsWith('.wav')) continue;
      const wavPath = path.join(bdir, entry);
      const companion = wavPath.replace(/\.wav$/i, '.json');
      if (!fs.existsSync(companion)) continue;
      const meta = JSON.parse(fs.readFileSync(companion, 'utf-8'));
      out.push({
        bucket,
        id: path.basename(entry, '.wav'),
        wavPath,
        transcript: (meta.transcript || '').toString(),
        conditionTags: meta.condition_tags || [],
        durationSec: Number(meta.duration_sec || 0),
      });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

// Word-normalise: lowercase, strip non-word/space chars, collapse whitespace.
function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0);
}

// Levenshtein distance at word granularity.
function wordDistance(ref: string[], hyp: string[]): number {
  const m = ref.length;
  const n = hyp.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = ref[i - 1] === hyp[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,         // deletion
        dp[i][j - 1] + 1,         // insertion
        dp[i - 1][j - 1] + cost,  // substitution
      );
    }
  }
  return dp[m][n];
}

function computeWer(ref: string, hyp: string, isSilentControl: boolean): number {
  if (isSilentControl) {
    // Silent-control: want empty transcript. Any word is a false positive.
    return hyp.trim().length === 0 ? 0 : 1;
  }
  const refWords = normalize(ref);
  const hypWords = normalize(hyp);
  if (refWords.length === 0) {
    return hypWords.length === 0 ? 0 : 1;
  }
  const dist = wordDistance(refWords, hypWords);
  return dist / refWords.length;
}

async function transcribeOne(openai: OpenAI, wavPath: string): Promise<string> {
  const fileStream = fs.createReadStream(wavPath);
  // Cast: Node's Readable is accepted by openai.audio.transcriptions.create.
  const res = await openai.audio.transcriptions.create({
    file: fileStream as any,
    model: STT_MODEL,
    language: 'en',
  });
  const raw = (res as any).text || '';
  return raw.toString();
}

type Row = {
  id: string;
  bucket: string;
  condition_tag: string;
  is_silent_control: boolean;
  reference: string;
  hypothesis: string;
  wer: number;
  duration_sec: number;
};

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const corpus = loadCorpus();
  if (corpus.length === 0) {
    console.error('[wer] corpus is empty — populate tests/fixtures/v7-speech-corpus first.');
    process.exit(1);
  }
  console.log(`[wer] model=${STT_MODEL} clips=${corpus.length}`);

  const rows: Row[] = [];
  const CONCURRENCY = 8;
  let next = 0;
  let done = 0;

  async function worker() {
    while (true) {
      const idx = next++;
      if (idx >= corpus.length) return;
      const clip = corpus[idx];
      const isSilent = clip.conditionTags.includes('silent-control');
      let hypothesis = '';
      try {
        hypothesis = await transcribeOne(openai, clip.wavPath);
      } catch (err) {
        console.warn(`[wer] STT failed for ${clip.id}: ${(err as Error).message}`);
        hypothesis = '';
      }
      const wer = computeWer(clip.transcript, hypothesis, isSilent);
      rows.push({
        id: clip.id,
        bucket: clip.bucket,
        condition_tag: clip.conditionTags[0] || 'untagged',
        is_silent_control: isSilent,
        reference: clip.transcript,
        hypothesis,
        wer,
        duration_sec: clip.durationSec,
      });
      done += 1;
      if (done % 5 === 0) console.log(`[wer] progress ${done}/${corpus.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  rows.sort((a, b) => a.id.localeCompare(b.id));

  // Per-clip CSV.
  const header = ['id', 'bucket', 'condition_tag', 'duration_sec', 'wer', 'is_silent_control', 'reference', 'hypothesis'];
  const csvBody = rows.map((r) => [
    r.id,
    r.bucket,
    r.condition_tag,
    r.duration_sec.toFixed(3),
    r.wer.toFixed(4),
    r.is_silent_control ? 1 : 0,
    JSON.stringify(r.reference),
    JSON.stringify(r.hypothesis),
  ].join(',')).join('\n');
  fs.writeFileSync(RESULTS_CSV, header.join(',') + '\n' + csvBody + '\n');

  // Aggregate by condition tag.
  const byTag = new Map<string, Row[]>();
  for (const r of rows) {
    for (const t of Array.from(new Set([r.condition_tag, ...corpus.find((c) => c.id === r.id)?.conditionTags || []]))) {
      if (!byTag.has(t)) byTag.set(t, []);
      byTag.get(t)!.push(r);
    }
  }

  const overallAvg = rows.reduce((s, r) => s + r.wer, 0) / rows.length;

  const lines: string[] = [];
  lines.push('# V7 Speech Corpus — Automated WER Summary (US-021 step 2)');
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Model: \`${STT_MODEL}\``);
  lines.push(`- Clips: ${rows.length}`);
  lines.push(`- Corpus kind: **SYNTHETIC PLACEHOLDER** (see `
    + '`tests/fixtures/v7-speech-corpus/INDEX.md`). WER numbers against this '
    + 'corpus reflect TTS self-consistency, not production human-speech quality.');
  lines.push('');
  lines.push('## Aggregate WER by condition tag');
  lines.push('');
  lines.push('| Condition tag | Clips | Avg WER | Max WER | Notes |');
  lines.push('| --- | --- | --- | --- | --- |');
  const tagOrder = [
    'short-answer', 'short-phrase', 'long-utterance', 'mid-utterance-pause',
    'whispered', 'quiet-room', 'background-tv', 'hvac-noise', 'silent-control',
  ];
  for (const t of tagOrder) {
    const bucket = byTag.get(t);
    if (!bucket || bucket.length === 0) continue;
    const avg = bucket.reduce((s, r) => s + r.wer, 0) / bucket.length;
    const max = bucket.reduce((m, r) => Math.max(m, r.wer), 0);
    const note = t === 'silent-control'
      ? '(0 = empty transcript as desired, 1 = false-positive)'
      : '';
    lines.push(`| \`${t}\` | ${bucket.length} | ${(avg * 100).toFixed(2)}% | ${(max * 100).toFixed(2)}% | ${note} |`);
  }
  lines.push('');
  lines.push(`**Overall mean WER:** ${(overallAvg * 100).toFixed(2)}%`);
  lines.push('');
  lines.push('## Next step');
  lines.push('');
  lines.push('Recapture the corpus with real human speakers per INDEX.md, then re-run:');
  lines.push('');
  lines.push('```bash');
  lines.push('npx tsx scripts/wer-check.ts');
  lines.push('```');
  lines.push('');
  lines.push('The output of the real-human run is the authoritative US-021 automated-WER evidence.');
  fs.writeFileSync(SUMMARY_MD, lines.join('\n') + '\n');

  console.log(`[wer] wrote ${RESULTS_CSV}`);
  console.log(`[wer] wrote ${SUMMARY_MD}`);
  console.log(`[wer] overall mean WER: ${(overallAvg * 100).toFixed(2)}%`);
}

main().catch((err) => {
  console.error('[wer] FAILED:', err);
  process.exit(1);
});
