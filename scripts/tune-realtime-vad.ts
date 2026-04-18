#!/usr/bin/env tsx
/**
 * US-028 — Realtime VAD parameter grid-search tool.
 *
 * Replays every .wav in tests/fixtures/v7-speech-corpus against the
 * OpenAI Realtime API with a grid of `turn_detection` parameters:
 *
 *   threshold:           [0.3, 0.4, 0.5, 0.6, 0.7]
 *   prefix_padding_ms:   [200, 300, 400]
 *   silence_duration_ms: [300, 500, 700, 1000]
 *
 * For each (utterance, combination) pair the script records whether the
 * Realtime session captured the full utterance, whether it
 * false-segmented a mid-utterance pause, and the trailing silence in
 * milliseconds. Results are written to
 * `tasks/v7-realtime-vad-tuning-results.csv` and a human summary is
 * written to `tasks/v7-realtime-vad-tuning-summary.md` naming the
 * winning combination (lowest false-segmentation rate, then highest
 * capture rate, tiebreak smallest trailing silence).
 *
 * REQUIREMENTS AT RUN TIME:
 *   - Env var OPENAI_API_KEY
 *   - Corpus recorded per US-020 under tests/fixtures/v7-speech-corpus/
 *   - Node >= 18 (native fetch + WebRTC shim of caller's choice)
 *
 * This script is INTENTIONALLY a runnable scaffold. The real inner
 * transport (feeding an existing .wav into a Realtime WebRTC session)
 * requires either (a) an off-the-shelf SDK helper or (b) a headless
 * WebRTC peer that reads PCM from the .wav and pipes it as a synthetic
 * audio track. We stub that transport behind `runOneCombination()`
 * with an `--engine=fake` mode that returns deterministic fake metrics
 * so CI can validate the grid structure / CSV shape / summary picker
 * without touching the OpenAI API or burning tokens.
 *
 * Run the real thing:   tsx scripts/tune-realtime-vad.ts --engine=real
 * Dry-run with shape check:   tsx scripts/tune-realtime-vad.ts --engine=fake
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

type GridPoint = {
  threshold: number;
  prefix_padding_ms: number;
  silence_duration_ms: number;
};

type Utterance = {
  id: string;
  wav: string;
  meta: {
    transcript: string;
    condition_tags: string[];
    sample_rate: number;
    duration_sec: number;
  };
};

type TrialResult = GridPoint & {
  utterance_id: string;
  condition_tag: string;
  captured_full: boolean;
  false_segmented: boolean;
  trailing_silence_ms: number;
};

const THRESHOLDS = [0.3, 0.4, 0.5, 0.6, 0.7];
const PREFIX_PADDINGS = [200, 300, 400];
const SILENCE_DURATIONS = [300, 500, 700, 1000];

const ROOT = path.resolve(__dirname, '..');
const CORPUS_DIR = path.join(ROOT, 'tests', 'fixtures', 'v7-speech-corpus');
const RESULTS_DIR = path.join(ROOT, 'tasks');
const RESULTS_CSV = path.join(RESULTS_DIR, 'v7-realtime-vad-tuning-results.csv');
const SUMMARY_MD = path.join(RESULTS_DIR, 'v7-realtime-vad-tuning-summary.md');
const REALTIME_ROUTE_FILE = path.join(ROOT, 'app', 'api', 'treatment-v7', 'realtime-session', 'route.ts');

function loadCorpus(): Utterance[] {
  const utterances: Utterance[] = [];
  if (!existsSync(CORPUS_DIR)) return utterances;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.toLowerCase().endsWith('.wav')) continue;
      const companion = full.replace(/\.wav$/i, '.json');
      if (!existsSync(companion)) continue;
      const meta = JSON.parse(readFileSync(companion, 'utf-8')) as Utterance['meta'];
      utterances.push({
        id: path.basename(entry, path.extname(entry)),
        wav: full,
        meta,
      });
    }
  };
  walk(CORPUS_DIR);
  return utterances;
}

function buildGrid(): GridPoint[] {
  const points: GridPoint[] = [];
  for (const threshold of THRESHOLDS) {
    for (const prefix_padding_ms of PREFIX_PADDINGS) {
      for (const silence_duration_ms of SILENCE_DURATIONS) {
        points.push({ threshold, prefix_padding_ms, silence_duration_ms });
      }
    }
  }
  return points;
}

async function runOneCombinationFake(utterance: Utterance, grid: GridPoint): Promise<TrialResult> {
  // Deterministic fake heuristic — see note at top of file. The shape is
  // what matters: higher thresholds and longer silence_durations tend to
  // capture more cleanly; shorter silence_durations false-segment pauses
  // on long-utterance clips.
  const hasMidUtterancePause = utterance.meta.condition_tags.includes('mid-utterance-pause');
  const isSilentControl = utterance.meta.condition_tags.includes('silent-control');

  const captured_full = isSilentControl
    ? true
    : grid.threshold >= 0.4 && grid.prefix_padding_ms >= 200;

  const false_segmented = hasMidUtterancePause && grid.silence_duration_ms < 700;

  const trailing_silence_ms = Math.max(
    0,
    grid.silence_duration_ms - 200 + (grid.prefix_padding_ms - 300),
  );

  const tag = utterance.meta.condition_tags[0] || 'untagged';

  return {
    ...grid,
    utterance_id: utterance.id,
    condition_tag: tag,
    captured_full,
    false_segmented,
    trailing_silence_ms,
  };
}

async function runOneCombinationReal(_utterance: Utterance, _grid: GridPoint): Promise<TrialResult> {
  throw new Error(
    'tune-realtime-vad: --engine=real is not implemented in this scaffold. ' +
    'Wire up a WebRTC shim that feeds the .wav PCM into a live Realtime session. ' +
    'Until then, run with --engine=fake to validate the CSV / summary structure.',
  );
}

function writeCsv(results: TrialResult[]): void {
  const header = [
    'utterance_id',
    'condition_tag',
    'threshold',
    'prefix_padding_ms',
    'silence_duration_ms',
    'captured_full',
    'false_segmented',
    'trailing_silence_ms',
  ].join(',');
  const body = results.map((r) => [
    r.utterance_id,
    r.condition_tag,
    r.threshold,
    r.prefix_padding_ms,
    r.silence_duration_ms,
    r.captured_full ? 1 : 0,
    r.false_segmented ? 1 : 0,
    r.trailing_silence_ms,
  ].join(',')).join('\n');
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(RESULTS_CSV, header + '\n' + body + (body ? '\n' : ''));
}

type Summary = {
  winner: GridPoint;
  captureRate: number;
  falseSegmentationRate: number;
  avgTrailingSilenceMs: number;
};

function pickWinner(results: TrialResult[]): Summary | null {
  const byCombo = new Map<string, TrialResult[]>();
  for (const r of results) {
    const key = `${r.threshold}|${r.prefix_padding_ms}|${r.silence_duration_ms}`;
    if (!byCombo.has(key)) byCombo.set(key, []);
    byCombo.get(key)!.push(r);
  }
  if (byCombo.size === 0) return null;

  let winner: Summary | null = null;
  const entries: Array<[string, TrialResult[]]> = Array.from(byCombo.entries());
  for (const [key, trials] of entries) {
    const [threshold, prefix, silence] = key.split('|').map(Number);
    const captureRate = trials.filter((t: TrialResult) => t.captured_full).length / trials.length;
    const falseRate = trials.filter((t: TrialResult) => t.false_segmented).length / trials.length;
    const avgTrail = trials.reduce((s: number, t: TrialResult) => s + t.trailing_silence_ms, 0) / trials.length;

    const candidate: Summary = {
      winner: {
        threshold,
        prefix_padding_ms: prefix,
        silence_duration_ms: silence,
      },
      captureRate,
      falseSegmentationRate: falseRate,
      avgTrailingSilenceMs: avgTrail,
    };

    if (!winner) {
      winner = candidate;
      continue;
    }
    // Lowest false_segmentation_rate wins; tiebreak highest captureRate;
    // tiebreak smallest trailing silence.
    if (candidate.falseSegmentationRate < winner.falseSegmentationRate) {
      winner = candidate;
    } else if (candidate.falseSegmentationRate === winner.falseSegmentationRate) {
      if (candidate.captureRate > winner.captureRate) {
        winner = candidate;
      } else if (candidate.captureRate === winner.captureRate) {
        if (candidate.avgTrailingSilenceMs < winner.avgTrailingSilenceMs) {
          winner = candidate;
        }
      }
    }
  }
  return winner;
}

function writeSummary(summary: Summary | null, corpusSize: number, engine: string): void {
  const lines: string[] = [];
  lines.push('# V7 Realtime VAD Tuning Summary');
  lines.push('');
  lines.push(`- Engine: \`${engine}\``);
  lines.push(`- Corpus size: ${corpusSize} utterances`);
  lines.push(`- Grid size: ${THRESHOLDS.length} × ${PREFIX_PADDINGS.length} × ${SILENCE_DURATIONS.length} = ${THRESHOLDS.length * PREFIX_PADDINGS.length * SILENCE_DURATIONS.length} combinations`);
  lines.push('');
  if (!summary) {
    lines.push('_No results — corpus is empty._');
    lines.push('');
    lines.push('Populate `tests/fixtures/v7-speech-corpus/` per US-020, then re-run.');
  } else {
    lines.push('## Winning VAD combination');
    lines.push('');
    lines.push('| Parameter | Value |');
    lines.push('| --- | --- |');
    lines.push(`| threshold | ${summary.winner.threshold} |`);
    lines.push(`| prefix_padding_ms | ${summary.winner.prefix_padding_ms} |`);
    lines.push(`| silence_duration_ms | ${summary.winner.silence_duration_ms} |`);
    lines.push('');
    lines.push('## Metrics');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('| --- | --- |');
    lines.push(`| capture_full_rate | ${(summary.captureRate * 100).toFixed(1)}% |`);
    lines.push(`| false_segmentation_rate | ${(summary.falseSegmentationRate * 100).toFixed(1)}% |`);
    lines.push(`| avg_trailing_silence_ms | ${summary.avgTrailingSilenceMs.toFixed(0)} |`);
    lines.push('');
    lines.push('## Next step');
    lines.push('');
    lines.push('Update `app/api/treatment-v7/realtime-session/route.ts` so the ');
    lines.push('`turn_detection` block uses the values above, then re-run US-029 to confirm.');
  }
  writeFileSync(SUMMARY_MD, lines.join('\n') + '\n');
}

async function main(): Promise<void> {
  const engine = (process.argv.find((a) => a.startsWith('--engine='))?.split('=')[1] || 'fake') as 'fake' | 'real';
  const corpus = loadCorpus();
  const grid = buildGrid();

  console.log(`[tune-realtime-vad] engine=${engine} corpus=${corpus.length} grid=${grid.length}`);

  const runner = engine === 'real' ? runOneCombinationReal : runOneCombinationFake;
  const results: TrialResult[] = [];

  for (const utterance of corpus) {
    for (const point of grid) {
      results.push(await runner(utterance, point));
    }
  }

  writeCsv(results);
  const summary = pickWinner(results);
  writeSummary(summary, corpus.length, engine);

  console.log(`[tune-realtime-vad] wrote ${RESULTS_CSV}`);
  console.log(`[tune-realtime-vad] wrote ${SUMMARY_MD}`);
  if (summary) {
    console.log(`[tune-realtime-vad] winner: threshold=${summary.winner.threshold} prefix_padding_ms=${summary.winner.prefix_padding_ms} silence_duration_ms=${summary.winner.silence_duration_ms}`);
  }
  // Script does NOT auto-edit route.ts (noted in summary). Operator runs
  // the real engine, reviews the summary, then hand-edits
  // `${path.relative(ROOT, REALTIME_ROUTE_FILE)}`.
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
