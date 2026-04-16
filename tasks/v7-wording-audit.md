# V7 Wording Audit

Classification legend:

- `allowed-classifier`: AI or logic that classifies, validates, or routes without authoring patient-facing therapeutic wording.
- `allowed-constrained-rewrite`: deterministic or tightly bounded text assembly that preserves V7-authored wording/templates.
- `disallowed-generative-rewrite`: generative rewriting that can alter doctor-authored patient-facing wording and must be disabled or blocked in strict mode.

## Core V7 wording sources

| File | Classification | Notes |
| --- | --- | --- |
| `lib/v7/treatment-modalities/introduction.ts` | `allowed-constrained-rewrite` | Scripted introduction prompts and deterministic work-type wording. |
| `lib/v7/treatment-modalities/work-type-selection.ts` | `allowed-constrained-rewrite` | Deterministic work-type and method-selection prompts; also emits internal control tokens. |
| `lib/v7/treatment-modalities/discovery.ts` | `allowed-constrained-rewrite` | Scripted discovery prompts and problem restatement requests. |
| `lib/v7/treatment-modalities/method-selection.ts` | `allowed-constrained-rewrite` | Scripted method-selection prompts and deterministic branching language. |
| `lib/v7/treatment-modalities/problem-shifting.ts` | `allowed-constrained-rewrite` | Doctor-authored Problem Shifting prompts with exact template interpolation. |
| `lib/v7/treatment-modalities/blockage-shifting.ts` | `allowed-constrained-rewrite` | Doctor-authored Blockage Shifting prompts; emits `TRANSITION_TO_DIG_DEEPER`. |
| `lib/v7/treatment-modalities/identity-shifting.ts` | `allowed-constrained-rewrite` | Doctor-authored Identity Shifting prompts with deterministic interpolation. |
| `lib/v7/treatment-modalities/belief-shifting.ts` | `allowed-constrained-rewrite` | Doctor-authored Belief Shifting prompts with deterministic interpolation. |
| `lib/v7/treatment-modalities/reality-shifting.ts` | `allowed-constrained-rewrite` | Doctor-authored goal-path prompts with deterministic interpolation. |
| `lib/v7/treatment-modalities/trauma-shifting.ts` | `allowed-constrained-rewrite` | Doctor-authored trauma-path prompts with deterministic interpolation. |
| `lib/v7/treatment-modalities/digging-deeper.ts` | `allowed-constrained-rewrite` | Scripted Digging Deeper prompts; also emits routing/method-selection control tokens. |
| `lib/v7/treatment-modalities/integration.ts` | `allowed-constrained-rewrite` | Scripted integration prompts and completion wording. |
| `lib/v7/static-audio-texts.ts` | `allowed-constrained-rewrite` | Exact static audio source strings that must stay text-locked. |

## Orchestration and message assembly

| File | Classification | Notes |
| --- | --- | --- |
| `lib/v7/base-state-machine.ts` | `allowed-constrained-rewrite` | Selects current step response and auto-progresses through internal signals without free-form generation. |
| `lib/v7/treatment-state-machine.ts` | `allowed-constrained-rewrite` | Handles deterministic routing and maps internal control signals to next-step scripted prompts. |
| `lib/v7/types.ts` | `allowed-constrained-rewrite` | Defines `scriptedResponse` and response metadata contracts used by wording paths. |
| `app/api/treatment-v7/route.ts` | `disallowed-generative-rewrite` | Final patient-facing `message` assembly point; contains linguistic-processing and AI-assistance branches that can alter wording. |

## AI-assisted and linguistic-processing paths

| File | Classification | Notes |
| --- | --- | --- |
| `lib/v2/ai-assistance.ts` | `disallowed-generative-rewrite` | Performs linguistic reinterpretation and assistance prompts that can rewrite V7 output; validation helpers inside are classifier-safe, but output-writing paths are not strict-safe. |
| `app/api/treatment-v7/route.ts` `needsLinguisticProcessing` branch | `disallowed-generative-rewrite` | Replaces or rewrites portions of the final doctor-authored message. |
| `app/api/treatment-v7/route.ts` `handleAIAssistance(...)` | `disallowed-generative-rewrite` | Generates clarifying helper text for stuck-user scenarios; must be blocked or bounded in strict mode. |
| `app/api/treatment-v7/route.ts` `handleAIValidation(...)` | `allowed-classifier` | Uses AI to classify/validate user input and select correction prompts, not to author core treatment scripts. |

## Speech delivery paths

| File | Classification | Notes |
| --- | --- | --- |
| `components/treatment/v7/TreatmentSession.tsx` | `allowed-constrained-rewrite` | Renders/speaks the final server `message`; should not author new therapeutic wording. |
| `components/treatment/v7/V7AudioPreloader.tsx` | `allowed-constrained-rewrite` | Preloads exact static-audio strings from `lib/v7/static-audio-texts.ts`. |
| `components/voice/useNaturalVoice.tsx` | `allowed-constrained-rewrite` | Speaks the provided message and must enforce exact-message/routing-token safeguards. |
| `components/voice/useAudioCapture.ts` | `allowed-classifier` | Captures user audio and forwards it to transcription without authoring therapeutic output. |
| `app/api/tts/route.ts` | `allowed-constrained-rewrite` | Synthesizes the already-final message; must never originate alternative wording. |
| `app/api/transcribe/route.ts` | `allowed-classifier` | Converts user audio to transcript and forwards step-aware prompt context without creating patient-facing therapeutic text. |
| `lib/voice/transcription-domain-context.ts` | `allowed-classifier` | Packages step-aware STT bias/context for routing reliability only. |

## Internal control-token sources

| File | Classification | Notes |
| --- | --- | --- |
| `lib/v7/routing-tokens.ts` | `allowed-classifier` | Central registry of non-patient-facing routing/control tokens used for suppression. |
| `lib/v7/base-state-machine.ts` `isInternalConfirmationSignal(...)` | `allowed-classifier` | Detects internal signals that should never escape to speech/rendering. |
| `lib/v7/treatment-state-machine.ts` `handleInternalRoutingSignals(...)` | `allowed-classifier` | Consumes internal routing tokens and converts them into state transitions. |

## Ambiguities to keep reviewing

- `lib/v7/text-processing-utils.ts`: helper utilities may shape user-provided strings before insertion and should be reviewed if strict mode expands beyond speech playback.
- `lib/v7/validation-helpers.ts`: mostly classifier/validation logic, but should stay under review because validation outcomes affect which scripted wording is emitted.
- Any future fallback UI copy added around STT/TTS failures should be treated as patient-facing wording and reviewed against strict-mode requirements.
