# V7 Static Audio Library

Pre-generated OpenAI TTS audio for every string in `lib/v7/static-audio-texts.ts`.
Runtime lookup uses the cache key `${voiceName}:${text}` (see `lib/voice/voice-cache-name.ts`).

## Current default voice

| Property | Value |
|----------|-------|
| Voice | `shimmer` |
| Model | `tts-1-hd` (per US-011 determinism policy) |
| Directory | `public/audio/v7/static/shimmer/` |
| Regenerated | _Pending US-014 run — see below_ |

## Regenerating the library

```bash
# Dry run (no OpenAI calls, reports what would be written)
npx tsx scripts/regenerate-v7-static-audio.ts --voice shimmer --dry-run

# Idempotent regen (skips files already on disk)
npx tsx scripts/regenerate-v7-static-audio.ts --voice shimmer

# Full regen (overwrites everything)
npx tsx scripts/regenerate-v7-static-audio.ts --voice shimmer --force
```

The script reads `OPENAI_TTS_STATIC_MODEL` (default `tts-1-hd`) and requires `OPENAI_API_KEY`.

## Adding a new prompt

1. Add the new entry to `lib/v7/static-audio-texts.ts` with a descriptive `SCREAMING_SNAKE`
   key. Keep the text stable — any edit re-hashes and re-generates.
2. Run `npx tsx scripts/regenerate-v7-static-audio.ts --voice <voice>` — the script is
   idempotent and will only generate the new file + update the manifest.
3. Commit the new `<hash>.mp3`, the updated `manifest.json`, and the text change together.

## Adding a new voice

1. Run `npx tsx scripts/regenerate-v7-static-audio.ts --voice <new-voice> --force` to
   produce a fresh directory.
2. Add the new voice to the UI's `AVAILABLE_VOICES` list in
   `components/treatment/v7/TreatmentSession.tsx`.
3. Verify `lib/voice/voice-cache-name.ts` maps the new voice id (the OpenAI voice names
   already are).

## US-014 status (regeneration & commit)

The repo contains the regen script and the manifest validation (US-013) but does not yet
contain the generated audio binaries. The actual regen + commit must be run by an operator
with an `OPENAI_API_KEY` that has TTS credits; that step lives outside the autonomous agent
scope (it spends money and writes binary artifacts).

Operator steps (copy-paste):

```bash
export OPENAI_API_KEY=...
npx tsx scripts/regenerate-v7-static-audio.ts --voice shimmer --force
du -sh public/audio/v7/static/shimmer/
git add public/audio/v7/static/shimmer/
git commit -m "v7-speech(US-014): regenerate shimmer static library (tts-1-hd)"
```

File-size sanity checks (US-014 acceptance criteria):
- No single file > 2MB
- Total library directory < 100MB

## Legacy Kokoro directories

Per US-018, the v7 runtime no longer reaches the Kokoro endpoint. Any existing `heart/`,
`michael/`, or similar Kokoro-era subdirectories under `public/audio/v6/static/` remain
available for the v4/v5/v6 code paths and must not be deleted in the v7 cleanup phase.
