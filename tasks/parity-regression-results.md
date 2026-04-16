# V7 Speech Parity Regression Results

Date: 2026-04-16

## Scope

This document tracks parity verification for the V7 OpenAI speech I/O work:

- OpenAI STT provider support
- OpenAI TTS provider support
- strict spoken-text/message equality checks
- routing-token suppression
- V7-only backup-provider prompts

## Automated verification completed

- `npm run type-check`: passed
- `npm run test:v7-speech-compliance`: passed
- `npm run test:v7-speech-route`: passed

## Automated guardrails now enforced

- Internal routing tokens are centralized in `lib/v7/routing-tokens.ts`
- Speech compliance validation rejects routing-token leakage
- Speech compliance validation rejects spoken-text/server-message mismatches
- `STRICT_SPEECH_MODE=true` bypasses V7 linguistic rewriting
- `STRICT_SPEECH_MODE=true` blocks V7 AI-assistance rewrites
- V7 `/api/tts` requests use exact final message text and return structured provider-failure errors
- V7 `/api/transcribe` requests preserve response shape across provider choices
- OpenAI STT/TTS provider failures trigger V7-only backup-system prompts without naming vendors in UI text

## Playback-mode coverage

| Mode | Status | Notes |
| --- | --- | --- |
| Text-only mode | Covered by existing V7 rendering path | No new provider-specific branching required. |
| Static audio hit path | Covered by existing cache-first `useNaturalVoice` flow | OpenAI TTS is only reached on cache miss. |
| OpenAI TTS fallback path | Implemented | Backup prompt appears on structured OpenAI TTS failures. |
| OpenAI transcription path | Implemented | Backup prompt appears on structured OpenAI STT failures. |

## Path coverage status

| Path | Status | Notes |
| --- | --- | --- |
| Introduction and work-type selection | Covered locally | `test:v7-speech-route` verifies representative entry routing plus patient-safe message output. |
| Problem path | Covered locally for entry routing | Route regression verifies early problem-path progression; strict speech guard remains covered by `test:v7-speech-compliance`. |
| Goal path | Covered locally for entry routing | Route regression verifies goal entry selection and response metadata. |
| Trauma path | Covered locally for entry routing | Route regression verifies negative-experience entry selection and response metadata. |
| Integration path | Covered by compliance/message guardrails | Exact-message speech guard is covered locally; full browser playback remains a live-only check. |
| Live browser audio path | Pending live run | Requires browser audio access and provider credentials for end-to-end STT/TTS parity. |

## Current assessment

The full V7 implementation boundary requested by the PRD is now present in code and isolated from other treatment session versions. This workspace now verifies the implementation through type-checking, focused speech-compliance tests, and local route regressions for representative V7 entry flows. The remaining unexecuted item is live browser-audio parity against real providers.
