# V7 Vendor-String Audit (US-017)

Per the PRD, every v7 user-visible string must avoid vendor identifiers (OpenAI, Whisper,
Kokoro, ElevenLabs) and "backup"/"fallback provider" language. This audit records the state
as of the US-017 commit.

## Scope

Searched directories / files:
- `components/treatment/v7/**`
- `components/voice/**`
- `app/api/tts/route.ts`
- `app/api/transcribe/route.ts`

## Search terms

`Whisper`, `Kokoro`, `OpenAI`, `ElevenLabs`, `backup system`, `backup provider`, `fallback
provider`.

## Results by category

### (a) Server-side log lines — KEPT AS-IS

These do not appear in any user-visible surface. They're for operators reading logs and must
keep the vendor name to be useful for debugging.

- `app/api/transcribe/route.ts` — `[Transcribe] OpenAI success:` console lines
- `app/api/tts/route.ts` — `OpenAI TTS API error:` console line
- `components/voice/useAudioCapture.ts` — `🎙️ AudioCapture:` debug logs with "Whisper"
- `components/voice/useNaturalVoice.tsx` — `🎤 Using Whisper` and `🎤 Whisper transcript:`
  client console logs

### (b) Developer-facing code comments / variable names — KEPT AS-IS

These are invisible at runtime. Renaming them wholesale would churn the file without user
benefit.

- `components/voice/useAudioCapture.ts` — comments referring to "Whisper" (the product) for
  documentation of hallucination patterns and sample-rate choice.
- `components/voice/useNaturalVoice.tsx` — `useWhisper` boolean flag, `whisperProcessing`
  state, `handleVadSpeechEnd` comment about "Whisper processing".
- `components/treatment/v7/TreatmentSession.tsx` — `getKokoroVoiceId()` helper (legacy
  compatibility), `// Kokoro TTS voices` comment, `// Natural voice integration (ElevenLabs
  + Web Speech)` file comment.

### (c) User-visible strings — REWRITTEN

None found that were non-neutral. The two previously-user-visible strings touched by this
audit are:

- `components/treatment/v7/TreatmentSession.tsx` text-mode dialog copy — now "We're
  temporarily unable to use audio. Would you like to continue by typing?" (US-015, no vendor
  identifiers).
- `speechFallbackPromptText` legacy copy — updated from "…continue with the backup system?"
  to "…continue by typing?" in US-015 (the literal word "backup" is removed).
- `speechFallbackPromptText` title "Speech Service Issue" — already neutral wording.

## Verification

After the US-015/US-016/US-017 commit, the following grep across JSX text children and
aria-labels in the audited surfaces returns zero hits:

```bash
rg ">[^<]*(Whisper|Kokoro|OpenAI|ElevenLabs|backup system|backup provider|fallback provider)[^<]*<" components/treatment/v7 components/voice
rg "aria-label=.*(Whisper|Kokoro|OpenAI|ElevenLabs)" components/treatment/v7 components/voice
```

Out-of-scope hits (deliberately untouched):
- `components/labs/OpenAIVoiceDemo.tsx` — labs/admin demo page, not a v7 user surface.

## Sign-off

Audit complete. No user-visible strings in the audited scope expose vendor names or
"backup/fallback provider" language. The v7 text-mode dialog uses the PRD-specified neutral
copy. Continuing compliance is maintained by (a) keeping this doc up to date on each PR that
touches v7 UI strings and (b) the grep check above being part of the US-021 regression
suite.
