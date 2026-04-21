#!/usr/bin/env tsx
/**
 * US-020 — Synthetic placeholder corpus generator.
 *
 * WARNING: The corpus this script produces is LABELLED SYNTHETIC in every
 * companion `.json`'s `speaker_notes`. It exists so that US-028 (VAD
 * tuning), US-021 (Track A regression), and US-029 (Track B regression)
 * can execute end-to-end before a real human-speech corpus is captured
 * per the capture methodology in INDEX.md. Word-error-rate or VAD metrics
 * collected against this corpus are NOT representative of production
 * human speech and must be reconfirmed once the real corpus lands.
 *
 * Buckets (matches INDEX.md):
 *   short-answer     10
 *   short-phrase     15
 *   long-utterance   10  (with a mid-clip 700 ms silence pause)
 *   whispered         5  (gpt-4o-mini-tts, instructions="whisper softly")
 *   background-tv     5  (speech + second TTS stream at -20 dBFS)
 *   hvac-noise        3  (speech + synthetic broadband noise at -30 dBFS)
 *   silent-control    2
 *                    ---
 *                    50
 *
 * Requires: OPENAI_API_KEY.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import OpenAI from 'openai';

const ROOT = path.resolve(__dirname, '..');
const CORPUS_DIR = path.join(ROOT, 'tests', 'fixtures', 'v7-speech-corpus');
const TTS_MODEL = 'gpt-4o-mini-tts';
const TARGET_RATE = 16_000;
const SRC_RATE = 24_000;

type CorpusEntry = {
  id: string;           // e.g. "001"
  bucket: string;       // folder name
  transcript: string;
  condition_tags: string[];
  expected_step_context: string;
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  instructions?: string;   // TTS style hint (gpt-4o-mini-tts)
  midPauseMs?: number;     // for long-utterance: insert silence after first half
  overlay?: 'tv' | 'hvac'; // add a noise bed
  silent?: boolean;        // pure silent control (no TTS call)
  durationOverrideSec?: number; // for silent-control
};

// Shaped so each bucket's totals match INDEX.md exactly.
const ENTRIES: CorpusEntry[] = [
  // ── short-answer (10) ──────────────────────────────────────────
  { id: '001', bucket: 'short-answer', transcript: 'Yes.',   condition_tags: ['short-answer','quiet-room'], expected_step_context: 'any',                voice: 'shimmer' },
  { id: '002', bucket: 'short-answer', transcript: 'No.',    condition_tags: ['short-answer','quiet-room'], expected_step_context: 'any',                voice: 'alloy'   },
  { id: '003', bucket: 'short-answer', transcript: 'Sure.',  condition_tags: ['short-answer','quiet-room'], expected_step_context: 'any',                voice: 'nova'    },
  { id: '004', bucket: 'short-answer', transcript: 'Maybe.', condition_tags: ['short-answer','quiet-room'], expected_step_context: 'any',                voice: 'echo'    },
  { id: '005', bucket: 'short-answer', transcript: 'Okay.',  condition_tags: ['short-answer','quiet-room'], expected_step_context: 'any',                voice: 'fable'   },
  { id: '006', bucket: 'short-answer', transcript: 'Yeah.',  condition_tags: ['short-answer','quiet-room'], expected_step_context: 'any',                voice: 'onyx'    },
  { id: '007', bucket: 'short-answer', transcript: 'Nope.',  condition_tags: ['short-answer','quiet-room'], expected_step_context: 'any',                voice: 'shimmer' },
  { id: '008', bucket: 'short-answer', transcript: 'Right.', condition_tags: ['short-answer','quiet-room'], expected_step_context: 'any',                voice: 'alloy'   },
  { id: '009', bucket: 'short-answer', transcript: 'Problem.', condition_tags: ['short-answer','quiet-room'], expected_step_context: 'work_type_selection', voice: 'nova'   },
  { id: '010', bucket: 'short-answer', transcript: 'Goal.',  condition_tags: ['short-answer','quiet-room'], expected_step_context: 'work_type_selection', voice: 'echo' },

  // ── short-phrase (15) ──────────────────────────────────────────
  { id: '011', bucket: 'short-phrase', transcript: 'I feel stuck at work.',                        condition_tags: ['short-phrase','quiet-room'], expected_step_context: 'problem', voice: 'shimmer' },
  { id: '012', bucket: 'short-phrase', transcript: 'I want to be more confident.',                 condition_tags: ['short-phrase','quiet-room'], expected_step_context: 'goal', voice: 'alloy' },
  { id: '013', bucket: 'short-phrase', transcript: "I can't focus on anything.",                   condition_tags: ['short-phrase','quiet-room'], expected_step_context: 'problem', voice: 'nova' },
  { id: '014', bucket: 'short-phrase', transcript: 'My partner and I keep arguing.',               condition_tags: ['short-phrase','quiet-room'], expected_step_context: 'problem', voice: 'echo' },
  { id: '015', bucket: 'short-phrase', transcript: 'I want to start my own business.',             condition_tags: ['short-phrase','quiet-room'], expected_step_context: 'goal', voice: 'fable' },
  { id: '016', bucket: 'short-phrase', transcript: 'I keep procrastinating on everything.',        condition_tags: ['short-phrase','quiet-room'], expected_step_context: 'problem', voice: 'onyx' },
  { id: '017', bucket: 'short-phrase', transcript: 'I feel lonely most evenings.',                 condition_tags: ['short-phrase','quiet-room'], expected_step_context: 'problem', voice: 'shimmer' },
  { id: '018', bucket: 'short-phrase', transcript: 'I want to sleep better.',                      condition_tags: ['short-phrase','quiet-room'], expected_step_context: 'goal', voice: 'alloy' },
  { id: '019', bucket: 'short-phrase', transcript: 'I get anxious before meetings.',               condition_tags: ['short-phrase','quiet-room'], expected_step_context: 'problem', voice: 'nova' },
  { id: '020', bucket: 'short-phrase', transcript: "I don't trust my own judgement.",              condition_tags: ['short-phrase','quiet-room'], expected_step_context: 'problem', voice: 'echo' },
  { id: '021', bucket: 'short-phrase', transcript: 'I want to finish my dissertation.',            condition_tags: ['short-phrase','quiet-room'], expected_step_context: 'goal', voice: 'fable' },
  { id: '022', bucket: 'short-phrase', transcript: 'Something bad happened last year.',            condition_tags: ['short-phrase','quiet-room'], expected_step_context: 'trauma', voice: 'onyx' },
  { id: '023', bucket: 'short-phrase', transcript: 'I keep comparing myself to others.',           condition_tags: ['short-phrase','quiet-room'], expected_step_context: 'problem', voice: 'shimmer' },
  { id: '024', bucket: 'short-phrase', transcript: 'It feels heavy on my chest.',                  condition_tags: ['short-phrase','quiet-room'], expected_step_context: 'problem', voice: 'alloy' },
  { id: '025', bucket: 'short-phrase', transcript: 'I want this to stop hurting.',                 condition_tags: ['short-phrase','quiet-room'], expected_step_context: 'integration', voice: 'nova' },

  // ── long-utterance (10) with 700 ms mid pause ──────────────────
  { id: '026', bucket: 'long-utterance', transcript: 'When I think about the presentation tomorrow, my chest gets tight, and I keep rehearsing every possible question, and then I lose track of what I actually wanted to say.', condition_tags: ['long-utterance','mid-utterance-pause','quiet-room'], expected_step_context: 'problem', voice: 'shimmer', midPauseMs: 700 },
  { id: '027', bucket: 'long-utterance', transcript: 'The feeling is like a low hum that sits behind everything I do, and it gets louder whenever I try to slow down or sit still, and I notice it most in the evenings.',   condition_tags: ['long-utterance','mid-utterance-pause','quiet-room'], expected_step_context: 'problem', voice: 'alloy',   midPauseMs: 700 },
  { id: '028', bucket: 'long-utterance', transcript: 'I keep thinking about the conversation with my manager, replaying what I should have said, and then I spiral into wondering whether I am in the wrong job entirely.',   condition_tags: ['long-utterance','mid-utterance-pause','quiet-room'], expected_step_context: 'problem', voice: 'nova',    midPauseMs: 700 },
  { id: '029', bucket: 'long-utterance', transcript: 'When I picture myself having actually finished the book, I feel lighter, and then almost immediately I feel the pressure of the empty page that still needs to be written.', condition_tags: ['long-utterance','mid-utterance-pause','quiet-room'], expected_step_context: 'goal',    voice: 'echo',    midPauseMs: 700 },
  { id: '030', bucket: 'long-utterance', transcript: 'It started after the move, I think, because that is when I stopped seeing my old friends, and the house felt empty in a way I had not expected it to feel.',            condition_tags: ['long-utterance','mid-utterance-pause','quiet-room'], expected_step_context: 'trauma',  voice: 'fable',   midPauseMs: 700 },
  { id: '031', bucket: 'long-utterance', transcript: 'There is a part of me that wants to rest, and a part of me that thinks I do not deserve to rest until I have earned it, and those two voices argue all day.',            condition_tags: ['long-utterance','mid-utterance-pause','quiet-room'], expected_step_context: 'problem', voice: 'onyx',    midPauseMs: 700 },
  { id: '032', bucket: 'long-utterance', transcript: 'When I imagine telling my parents, my throat tightens, and my voice goes up a register, and I start talking very fast, even though nothing bad has actually happened.',  condition_tags: ['long-utterance','mid-utterance-pause','quiet-room'], expected_step_context: 'problem', voice: 'shimmer', midPauseMs: 700 },
  { id: '033', bucket: 'long-utterance', transcript: 'The goal is to be able to walk into a room and not scan it for exits, because right now I can feel myself checking where the door is before I have even said hello.',    condition_tags: ['long-utterance','mid-utterance-pause','quiet-room'], expected_step_context: 'goal',    voice: 'alloy',   midPauseMs: 700 },
  { id: '034', bucket: 'long-utterance', transcript: 'When I think about it from a distance, it is not that big a deal, but when I am in it, my body acts like something is about to go very wrong, and I cannot talk myself out.', condition_tags: ['long-utterance','mid-utterance-pause','quiet-room'], expected_step_context: 'problem', voice: 'nova',    midPauseMs: 700 },
  { id: '035', bucket: 'long-utterance', transcript: 'Part of why I came today is that I have tried journaling, and I have tried meditating, and I still end up back in the same loop, and I want to try something different.',  condition_tags: ['long-utterance','mid-utterance-pause','quiet-room'], expected_step_context: 'integration', voice: 'echo', midPauseMs: 700 },

  // ── whispered (5) — gpt-4o-mini-tts supports an instructions hint
  { id: '036', bucket: 'whispered', transcript: 'Yes, I can hear you.',         condition_tags: ['whispered','quiet-room'], expected_step_context: 'any',     voice: 'shimmer', instructions: 'Whisper very softly and intimately, barely audible.' },
  { id: '037', bucket: 'whispered', transcript: 'I would rather not say.',      condition_tags: ['whispered','quiet-room'], expected_step_context: 'problem', voice: 'alloy',   instructions: 'Whisper very softly and intimately, barely audible.' },
  { id: '038', bucket: 'whispered', transcript: 'Just a moment.',               condition_tags: ['whispered','quiet-room'], expected_step_context: 'any',     voice: 'nova',    instructions: 'Whisper very softly and intimately, barely audible.' },
  { id: '039', bucket: 'whispered', transcript: 'I think so.',                  condition_tags: ['whispered','quiet-room'], expected_step_context: 'any',     voice: 'echo',    instructions: 'Whisper very softly and intimately, barely audible.' },
  { id: '040', bucket: 'whispered', transcript: 'Can you repeat that.',         condition_tags: ['whispered','quiet-room'], expected_step_context: 'any',     voice: 'fable',   instructions: 'Whisper very softly and intimately, barely audible.' },

  // ── background-tv (5)
  { id: '041', bucket: 'background-tv', transcript: 'I feel calmer today.',         condition_tags: ['short-phrase','background-tv'], expected_step_context: 'any',     voice: 'shimmer', overlay: 'tv' },
  { id: '042', bucket: 'background-tv', transcript: 'The same thing keeps happening.', condition_tags: ['short-phrase','background-tv'], expected_step_context: 'problem', voice: 'alloy',   overlay: 'tv' },
  { id: '043', bucket: 'background-tv', transcript: 'I want to feel present again.', condition_tags: ['short-phrase','background-tv'], expected_step_context: 'goal',    voice: 'nova',    overlay: 'tv' },
  { id: '044', bucket: 'background-tv', transcript: "I don't know.",                 condition_tags: ['short-answer','background-tv'], expected_step_context: 'any',     voice: 'echo',    overlay: 'tv' },
  { id: '045', bucket: 'background-tv', transcript: 'It is a heavy feeling in my chest.', condition_tags: ['short-phrase','background-tv'], expected_step_context: 'problem', voice: 'fable', overlay: 'tv' },

  // ── hvac-noise (3)
  { id: '046', bucket: 'hvac-noise', transcript: 'I can barely focus right now.',   condition_tags: ['short-phrase','hvac-noise'], expected_step_context: 'problem', voice: 'shimmer', overlay: 'hvac' },
  { id: '047', bucket: 'hvac-noise', transcript: 'Could you say that again please.', condition_tags: ['short-phrase','hvac-noise'], expected_step_context: 'any',     voice: 'alloy',   overlay: 'hvac' },
  { id: '048', bucket: 'hvac-noise', transcript: 'Yes, that fits.',                 condition_tags: ['short-answer','hvac-noise'], expected_step_context: 'any',     voice: 'nova',    overlay: 'hvac' },

  // ── silent-control (2)
  { id: '049', bucket: 'silent-control', transcript: '', condition_tags: ['silent-control'], expected_step_context: 'any', voice: 'shimmer', silent: true, durationOverrideSec: 2.0 },
  { id: '050', bucket: 'silent-control', transcript: '', condition_tags: ['silent-control'], expected_step_context: 'any', voice: 'shimmer', silent: true, durationOverrideSec: 2.5 },
];

function linearResample(samples: Int16Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const outLen = Math.floor(samples.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const frac = srcIdx - i0;
    out[i] = Math.round(samples[i0] * (1 - frac) + samples[i1] * frac);
  }
  return out;
}

function pcmBufferToInt16(buf: Buffer): Int16Array {
  // OpenAI `response_format: 'pcm'` returns raw little-endian 16-bit PCM @ 24 kHz mono.
  const samples = new Int16Array(buf.length / 2);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = buf.readInt16LE(i * 2);
  }
  return samples;
}

function makeSilence(ms: number, sr: number): Int16Array {
  return new Int16Array(Math.floor((ms * sr) / 1000));
}

function concat(a: Int16Array, b: Int16Array): Int16Array {
  const out = new Int16Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function clip(v: number): number {
  if (v > 32767) return 32767;
  if (v < -32768) return -32768;
  return v;
}

// Mix two Int16 streams; returns length = max(a,b), pads shorter with zeros.
function mix(a: Int16Array, b: Int16Array, gainA: number, gainB: number): Int16Array {
  const len = Math.max(a.length, b.length);
  const out = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const av = i < a.length ? a[i] : 0;
    const bv = i < b.length ? b[i] : 0;
    out[i] = clip(Math.round(av * gainA + bv * gainB));
  }
  return out;
}

// Linear gain for a given dBFS attenuation. -20 dBFS → 0.1, -30 dBFS → ~0.0316.
function dbfsGain(dbfs: number): number {
  return Math.pow(10, dbfs / 20);
}

// White-ish noise at given peak ≈ dBFS_peak.
function makeBroadbandNoise(lengthSamples: number, dbfsPeak: number): Int16Array {
  const peak = dbfsGain(dbfsPeak) * 32767;
  const out = new Int16Array(lengthSamples);
  for (let i = 0; i < lengthSamples; i++) {
    out[i] = Math.round((Math.random() * 2 - 1) * peak);
  }
  return out;
}

// Peak-normalise to target dBFS (e.g. -1 dBFS per capture spec).
function peakNormalize(samples: Int16Array, targetDbfs: number): Int16Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    if (v > peak) peak = v;
  }
  if (peak === 0) return samples;
  const targetPeak = dbfsGain(targetDbfs) * 32767;
  const gain = targetPeak / peak;
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = clip(Math.round(samples[i] * gain));
  }
  return out;
}

// Minimal RIFF/WAVE writer, mono 16-bit PCM.
function writeWav(samples: Int16Array, sampleRate: number, outPath: string): void {
  const bytesPerSample = 2;
  const numSamples = samples.length;
  const dataSize = numSamples * bytesPerSample;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * bytesPerSample, 28);
  header.writeUInt16LE(bytesPerSample, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);
  const body = Buffer.alloc(dataSize);
  for (let i = 0; i < numSamples; i++) {
    body.writeInt16LE(samples[i], i * bytesPerSample);
  }
  fs.writeFileSync(outPath, Buffer.concat([header, body]));
}

async function ttsToPcm24k(
  openai: OpenAI,
  opts: { text: string; voice: CorpusEntry['voice']; instructions?: string }
): Promise<Int16Array> {
  const response = await openai.audio.speech.create({
    model: TTS_MODEL,
    input: opts.text,
    voice: opts.voice,
    response_format: 'pcm',
    ...(opts.instructions ? { instructions: opts.instructions } : {}),
  } as any);
  const buf = Buffer.from(await response.arrayBuffer());
  return pcmBufferToInt16(buf);
}

// Produce a realistic-ish "TV bed" — two short TTS beds mixed and looped.
async function makeTvBed(openai: OpenAI, lengthSamples: number): Promise<Int16Array> {
  const beds = await Promise.all([
    ttsToPcm24k(openai, { text: 'And now the weather for the greater region this evening, expect mild showers turning to clear skies by sunrise.', voice: 'onyx' }),
    ttsToPcm24k(openai, { text: 'In other news, markets closed higher following the announcement, analysts suggesting a cautious outlook for the coming quarter.', voice: 'fable' }),
  ]);
  const bed = concat(beds[0], concat(makeSilence(200, SRC_RATE), beds[1]));
  if (bed.length >= lengthSamples) return bed.subarray(0, lengthSamples);
  const out = new Int16Array(lengthSamples);
  let off = 0;
  while (off < lengthSamples) {
    const n = Math.min(bed.length, lengthSamples - off);
    out.set(bed.subarray(0, n), off);
    off += n;
  }
  return out;
}

async function generateOne(
  openai: OpenAI,
  entry: CorpusEntry,
  sharedTvBed: Int16Array | null,
): Promise<{ samples16k: Int16Array; durationSec: number }> {
  if (entry.silent) {
    const durationSec = entry.durationOverrideSec ?? 2.0;
    const samples16k = makeSilence(Math.round(durationSec * 1000), TARGET_RATE);
    return { samples16k, durationSec };
  }

  // 1) Synthesize voice at 24 kHz PCM.
  let voice24k: Int16Array;
  if (entry.midPauseMs && entry.midPauseMs > 0) {
    // Split roughly in half at a word boundary for the mid-clip pause.
    const words = entry.transcript.split(' ');
    const mid = Math.max(1, Math.floor(words.length / 2));
    const firstText = words.slice(0, mid).join(' ');
    const secondText = words.slice(mid).join(' ');
    const first = await ttsToPcm24k(openai, { text: firstText, voice: entry.voice, instructions: entry.instructions });
    const pause = makeSilence(entry.midPauseMs, SRC_RATE);
    const second = await ttsToPcm24k(openai, { text: secondText, voice: entry.voice, instructions: entry.instructions });
    voice24k = concat(concat(first, pause), second);
  } else {
    voice24k = await ttsToPcm24k(openai, { text: entry.transcript, voice: entry.voice, instructions: entry.instructions });
  }

  // 2) Add overlay bed if configured.
  if (entry.overlay === 'tv' && sharedTvBed) {
    const bed = sharedTvBed.length >= voice24k.length
      ? sharedTvBed.subarray(0, voice24k.length)
      : (() => {
          const out = new Int16Array(voice24k.length);
          let off = 0;
          while (off < voice24k.length) {
            const n = Math.min(sharedTvBed.length, voice24k.length - off);
            out.set(sharedTvBed.subarray(0, n), off);
            off += n;
          }
          return out;
        })();
    voice24k = mix(voice24k, bed, 1.0, dbfsGain(-20));
  } else if (entry.overlay === 'hvac') {
    const noise = makeBroadbandNoise(voice24k.length, -30);
    voice24k = mix(voice24k, noise, 1.0, 1.0);
  }

  // 3) Peak-normalise to -1 dBFS per INDEX.md capture spec.
  voice24k = peakNormalize(voice24k, -1);

  // 4) Resample 24 kHz → 16 kHz.
  const samples16k = linearResample(voice24k, SRC_RATE, TARGET_RATE);
  const durationSec = samples16k.length / TARGET_RATE;
  return { samples16k, durationSec };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  for (const bucket of Array.from(new Set(ENTRIES.map((e) => e.bucket)))) {
    fs.mkdirSync(path.join(CORPUS_DIR, bucket), { recursive: true });
  }

  // Generate one shared TV bed so all background-tv clips reference the same pattern.
  console.log('[corpus-gen] synthesizing shared TV bed…');
  const sharedTvBed = await makeTvBed(openai, SRC_RATE * 8); // 8 seconds of bed, looped as needed

  let done = 0;
  for (const entry of ENTRIES) {
    const { samples16k, durationSec } = await generateOne(openai, entry, sharedTvBed);
    const baseName = entry.id;
    const wavPath = path.join(CORPUS_DIR, entry.bucket, `${baseName}.wav`);
    const jsonPath = path.join(CORPUS_DIR, entry.bucket, `${baseName}.json`);
    writeWav(samples16k, TARGET_RATE, wavPath);

    const speakerNotes = entry.silent
      ? `SYNTHETIC PLACEHOLDER (${new Date().toISOString().slice(0,10)}). Pure silent buffer, no TTS call, no background noise. Included only to exercise the silent-control path. See INDEX.md status entry for 2026-04-19.`
      : `SYNTHETIC PLACEHOLDER (${new Date().toISOString().slice(0,10)}). Generated via OpenAI ${TTS_MODEL}, voice='${entry.voice}'${entry.instructions ? `, instructions='${entry.instructions}'` : ''}${entry.midPauseMs ? `, ${entry.midPauseMs}ms mid-clip pause inserted` : ''}${entry.overlay ? `, overlay='${entry.overlay}'` : ''}. NOT human speech; WER / VAD metrics from this clip are not representative of production. Replace with a real human recording per INDEX.md capture methodology before the US-021 / US-029 decision.`;

    const meta = {
      transcript: entry.transcript,
      expected_step_context: entry.expected_step_context,
      condition_tags: entry.condition_tags,
      speaker_notes: speakerNotes,
      sample_rate: TARGET_RATE,
      duration_sec: Number(durationSec.toFixed(3)),
    };
    fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2) + '\n');

    done++;
    console.log(`[corpus-gen] ${done}/${ENTRIES.length}  ${entry.bucket}/${baseName}.wav  (${durationSec.toFixed(2)}s)`);
  }

  console.log('[corpus-gen] done');
}

main().catch((err) => {
  console.error('[corpus-gen] FAILED:', err);
  process.exit(1);
});
