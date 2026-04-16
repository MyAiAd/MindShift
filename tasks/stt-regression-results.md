# V7 STT Regression Results

Date: 2026-04-16

## Scope

This document tracks regression verification for V7 speech-to-text routing with the new provider abstraction and V7-only speech path.

Configuration intended for this run:

- `STT_PROVIDER=openai`
- `STRICT_SPEECH_MODE=true`
- V7 session path only

## Automated verification completed

- `npm run type-check`: passed
- `npm run test:v7-speech-compliance`: passed
- `npm run test:v7-speech-route`: passed

## Implementation-level coverage now present

- V7 requests always route voice capture through `/api/transcribe`
- `/api/transcribe` preserves the existing transcript response shape across providers
- Step-aware context is forwarded as OpenAI transcription prompt text when V7 is active
- Non-V7 treatment sessions continue to use the existing provider path unless explicitly configured otherwise
- OpenAI STT provider failures now surface a V7-only backup-system prompt instead of silently failing

## Representative flow matrix

| Flow | Focus | Status | Notes |
| --- | --- | --- | --- |
| Introduction | Work-type selection utterances | Covered locally | `test:v7-speech-route` exercises `1` / `2` / `3` routing and verifies `expectedResponseType` plus token-free patient output. |
| Problem path entry | Short problem statements | Covered locally | `test:v7-speech-route` drives the initial problem path into modality intro without routing-token leakage. |
| Goal path entry | Short goal statements | Covered locally | Local route regression verifies short-utterance routing to `goal_description`. |
| Trauma path entry | Short negative-experience statements | Covered locally | Local route regression verifies short-utterance routing to `negative_experience_description`. |
| Browser microphone path | OpenAI STT live capture | Pending live run | Still requires browser/mic access plus provider credentials to validate actual audio transcription quality. |

## Current assessment

The V7 STT implementation is in place and type-safe, with provider selection and fallback behavior isolated to V7. Branch-local automated coverage now verifies the V7 route contract for representative short-utterance entry flows; the only remaining gap is live microphone/OpenAI transcription quality verification in an environment with browser audio access and valid credentials.
