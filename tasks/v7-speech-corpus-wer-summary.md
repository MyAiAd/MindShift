# V7 Speech Corpus — Automated WER Summary (US-021 step 2)

- Generated: 2026-04-21T13:03:09.490Z
- Model: `gpt-4o-mini-transcribe`
- Clips: 50
- Corpus kind: **SYNTHETIC PLACEHOLDER** (see `tests/fixtures/v7-speech-corpus/INDEX.md`). WER numbers against this corpus reflect TTS self-consistency, not production human-speech quality.

## Aggregate WER by condition tag

| Condition tag | Clips | Avg WER | Max WER | Notes |
| --- | --- | --- | --- | --- |
| `short-answer` | 12 | 30.56% | 100.00% |  |
| `short-phrase` | 21 | 0.79% | 16.67% |  |
| `long-utterance` | 10 | 0.59% | 5.88% |  |
| `mid-utterance-pause` | 10 | 0.59% | 5.88% |  |
| `whispered` | 5 | 0.00% | 0.00% |  |
| `quiet-room` | 40 | 8.06% | 100.00% |  |
| `background-tv` | 5 | 13.33% | 66.67% |  |
| `hvac-noise` | 3 | 0.00% | 0.00% |  |
| `silent-control` | 2 | 0.00% | 0.00% | (0 = empty transcript as desired, 1 = false-positive) |

**Overall mean WER:** 7.78%

## Next step

Recapture the corpus with real human speakers per INDEX.md, then re-run:

```bash
npx tsx scripts/wer-check.ts
```

The output of the real-human run is the authoritative US-021 automated-WER evidence.
