# PRD: V9 UX Restoration — Orb, Admin Drawer, Theme Tokens, Interaction Modes

## Problem

V9 was introduced as a voice clone of V2 with byte-parity enforced in CI
(see `docs/v9-voice-clone.md`). Parity is measured at the **state-machine
text** layer — what the backend returns — not the visual shell. When the
V9 frontend was stood up, the intent of "v9 renders exactly what the
backend returns" was read literally and the entire session UX was
replaced with a minimal 404-line chat component
(`components/treatment/v9/TreatmentSession.tsx`). The rest of the V7
experience was dropped.

The result is that the live V9 session shown to users today is a
monochrome chat window with two small icon toggles. The fully-designed
session experience we had in V7 is gone:

1. **No Orb.** V7 used `interactionMode === 'orb_ptt'` to render the
   animated voice Orb, subtitle line, and speaking-state feedback. V9
   renders a plain text transcript only.
2. **No admin debug drawer.** V7's `AdminDebugDrawer.tsx` (right-edge
   slide-out panel, `Ctrl+Shift+D` toggle, per-message text/audio timing)
   is not wired into V9. Admin testers have no way to see the internal
   step log without reading server logs.
3. **No theme engine.** V9 uses raw Tailwind colors
   (`bg-blue-600`, `bg-gray-100`, `bg-gray-500`, `text-gray-500`) in
   place of the theme tokens (`bg-primary`, `bg-card`, `bg-secondary`,
   `text-foreground`, `text-muted-foreground`, …) defined in
   `lib/theme.tsx`, `lib/themes.ts`, and `app/globals.css`. This means V9
   ignores the user's chosen theme (solarized-dark by default), doesn't
   inherit glass-effect intensity, and breaks visually in dark mode.
4. **No interaction modes.** V7 supports three modes via
   `lib/v7/v7-preferences.ts`: `orb_ptt` (voice + orb), `listen_only`
   (TTS playback, typed input), and `text_first` (text-only). V9
   hard-codes a single chat layout.
5. **No audio preloader.** V7's `V7AudioPreloader.tsx` pre-fetches
   static MP3 segments per voice, giving sub-200ms playback onset. V9
   issues a round-trip TTS request per turn. This is mostly a
   cost/latency concern and is not a day-one blocker, but it is a real
   regression from V7.
6. **No permission flow, no ready overlay, no guided mode.** V7's mic
   permission state machine (`'granted' | 'denied' | 'prompt'`), the
   pre-session ready overlay, and guided-mode auto-start are all
   absent. Users who enable the mic in V9 get no permission prompt, no
   feedback, and no recovery path if the browser denies access.

None of these affect script parity. V9's byte-parity CI gate
(`.github/workflows/v9-parity-gate.yml`) runs against the API, not the
client, and will remain green regardless of how the shell is rendered.

## Goals

- Restore the V7 session UX on V9 **without** regressing V9's byte-parity
  CI gate or changing a single word of state-machine text.
- Use the existing theme engine (`lib/theme.tsx`,
  `lib/themes.ts`, the CSS custom properties in `app/globals.css`)
  everywhere. No raw Tailwind color classes may appear in
  `components/treatment/v9/`.
- Support the three interaction modes V7 supports (`orb_ptt`,
  `listen_only`, `text_first`) via a parallel `lib/v9/v9-preferences.ts`
  module. Default to `orb_ptt` on mobile, `text_first` on desktop —
  matching V7's `shouldShowOrb()` semantics.
- Make voice defaults respect interaction mode, as agreed in the scoping
  question:
  - `orb_ptt` → mic ON, speaker ON
  - `listen_only` → mic OFF, speaker ON
  - `text_first` → mic OFF, speaker OFF
- Persist user voice choices to `localStorage` under V9-namespaced keys
  (`v9_mic_enabled`, `v9_speaker_enabled`, `v9_interaction_mode`) so a
  user's preferences don't leak between V7 and V9 sessions. V9 starts
  fresh — it never inherits a V7 key.
- Keep V9's existing rule that the client renders **exactly** the
  backend's `data.message` with no `INITIAL_WELCOME` substitution.
- Keep the admin STT/TTS routing added in the recent admin-voice work
  (`lib/v9/voice-settings.ts` + `app/api/admin/voice-settings`)
  functioning unchanged.
- **Serve static pre-rendered audio** for the canonical script steps
  via a hash-match resolver: reuse V7's existing
  `/audio/v7/static/` MP3s in Phase 1, regenerate V9-specific MP3s
  from V2's scripted strings in Phase 2. Full detail in R13.
- **Guard layout and theme regressions with Playwright screenshot
  tests** covering all three interaction modes, light/dark themes,
  and the admin drawer's open state. Full detail in R14.

## Non-Goals

- **No changes to V9's state machine, API, or wording.** Everything in
  `lib/v2/*` (imported by V9's backend) and `lib/v9/core.ts` stays
  untouched. This PRD is 100% client-side.
- **No changes to V7.** V7 stays frozen as an archived regression
  target. We are not refactoring V7 into a shared component.
- **No generation of V9-specific static MP3s in this PRD's first PR.**
  Phase 1 reuses V7's existing `/audio/v7/static/` MP3s via the
  hash-match resolver in R13. Phase 2 (scripted regeneration from V2's
  canonical strings) is explicitly in scope per R13.5 but lands in a
  follow-up PR.
- **No changes to the admin voice-settings UI** at
  `app/dashboard/admin/settings/page.tsx`.
- **No new theme variants or glass-effect changes.** V9 consumes the
  existing theme engine as-is.
- **No preference migration from V7.** A user's V7 settings do not
  carry over to V9. First V9 session starts from device-appropriate
  defaults.
- **No opt-in toggle for visual regression.** The Playwright
  screenshot tests (R14) run on every PR as part of the V9 parity
  gate. Developers update baselines with `--update-snapshots` when
  changes are intentional.

## Requirements

### R1: Create `lib/v9/v9-preferences.ts` as a parallel to V7's

Copy `lib/v7/v7-preferences.ts` to `lib/v9/v9-preferences.ts` verbatim,
then rewrite every `v7_`/`V7_` identifier to `v9_`/`V9_`:

- `getInteractionMode()` reads `localStorage.getItem('v9_interaction_mode')`.
- `setInteractionMode()` writes it and dispatches `V9_EVENTS.INTERACTION_MODE_CHANGED`.
- `getVoicePreferences()` reads `v9_mic_enabled` and `v9_speaker_enabled`.
- `setVoicePreferences()` writes both and dispatches
  `V9_EVENTS.VOICE_PREFERENCES_CHANGED`.
- `shouldShowOrb()`, `shouldShowTextFirst()`, `isListenOnlyMode()` —
  logic unchanged from V7.
- Default interaction mode: `orb_ptt` on mobile, `text_first` on
  desktop — identical to V7's `isMobileDevice()` check.

Exported surface must match V7's exported surface one-for-one so the
V9 session component can be a direct port.

### R2: Port `AdminDebugDrawer` to V9

Copy `components/treatment/v7/AdminDebugDrawer.tsx` to
`components/treatment/v9/AdminDebugDrawer.tsx`. Changes:

- Import `TreatmentMessage` from `./shared/types` (create if not already
  present — the V9 folder currently has a `shared/types.ts` with a
  compatible `V9TreatmentMessage` type).
- Keyboard shortcut stays `Ctrl+Shift+D` / `Cmd+Shift+D`.
- Per-message timing display (`textRenderTime`, `audioStartTime`, delta)
  stays exactly as implemented.
- Admin-only gate: component returns `null` unless
  `profile.role === 'super_admin' || profile.role === 'tenant_admin'`,
  matching the existing pattern in `MobileNav.tsx` line 42.
- Theme tokens: the V7 drawer already uses `bg-card/95`,
  `border-border`, `bg-primary`, `text-muted-foreground`, etc. — do not
  change these; they are already theme-engine compliant.

### R3: Port `TreatmentSession.tsx` to V9

Replace the current 404-line `components/treatment/v9/TreatmentSession.tsx`
with a port of `components/treatment/v7/TreatmentSession.tsx` (2960
lines). The port must make exactly these changes from the V7 source,
and **no other changes**:

- **API endpoint:** replace every `'/api/treatment-v7'` with
  `'/api/treatment-v9'`.
- **LocalStorage keys:** replace every `'v7_'` prefix with `'v9_'`
  (e.g. `v7_mic_enabled` → `v9_mic_enabled`,
  `v7_debug_drawer_open` → `v9_debug_drawer_open`,
  `v7_natural_voice` → `v9_natural_voice`).
- **Preferences import:** switch
  `from '@/lib/v7/v7-preferences'` to
  `from '@/lib/v9/v9-preferences'`.
- **Event names:** `V7_EVENTS.*` → `V9_EVENTS.*`.
- **`treatmentVersion` prop** passed into `useNaturalVoice`: `'v7'` →
  `'v9'`. (See constraint in R8 below.)
- **Audio preloader import:** replaced with `V9AudioPreloader` (see
  R13 below). The preloader is **on by default** in V9 and serves
  static MP3s using the hash-reuse strategy described in R13.
- **Remove the `V7_STATIC_AUDIO_TEXTS.INITIAL_WELCOME` override block.**
  V9 must render exactly `data.message` from the backend. Search for
  every reference to `V7_STATIC_AUDIO_TEXTS` in the ported file and
  either delete the block or wrap it in
  `if (process.env.NEXT_PUBLIC_V9_AUDIO_PRELOAD === 'true')`. The
  parity-gate risk is the `INITIAL_WELCOME` text substitution in the
  first message render; that specific override must be deleted
  entirely, not gated.
- **Admin drawer import:** `./AdminDebugDrawer` stays the same relative
  path, now pointing at the V9-local copy created in R2.
- **All other logic** (interaction-mode handling, mic permission flow,
  Orb rendering, subtitle assembly, guided mode, ready overlay, message
  timing metrics) is copied verbatim.

The reason for a verbatim port rather than a "fresh write" is that V7's
component has 2,960 lines of accumulated edge-case handling
(first-speech gating, mobile permission quirks, interaction-mode
transitions, subtitle race conditions). Rewriting any of that is an
invitation for regressions that the byte-parity gate will not catch
because they are client-side.

### R4: Theme-token enforcement in V9

No raw Tailwind color classes may appear in
`components/treatment/v9/**` or `lib/v9/**` (excluding `.test.ts` and
`.spec.ts` files).

Allowed tokens (from `app/globals.css` and `tailwind.config.ts`):

- `bg-background`, `bg-foreground`, `bg-card`, `bg-popover`
- `bg-primary`, `bg-secondary`, `bg-muted`, `bg-accent`, `bg-destructive`
- `*-foreground` variants of each
- `border-border`, `border-input`, `border-ring`
- `text-*` variants of all of the above
- `ring-ring`, `ring-offset-background`

**Disallowed** (examples, not exhaustive):

- `bg-blue-*`, `bg-gray-*`, `bg-red-*`, `bg-green-*`, `bg-slate-*`,
  `bg-zinc-*`, `bg-white`, `bg-black`
- `text-blue-*`, `text-gray-*`, `text-red-*`, `text-green-*`,
  `text-white`, `text-black`
- `border-gray-*`, `border-blue-*`, etc.

Enforcement mechanism: add a grep gate to CI. A lightweight
`scripts/v9-theme-token-gate.ts` that scans the two allowed directories
and fails the build if any raw color class is matched. The gate runs in
the existing `v9-parity-gate.yml` workflow as a separate step, so a
theme violation blocks merge the same way a script-drift violation
would.

Opacity modifiers on theme tokens (e.g. `bg-card/95`,
`bg-primary/20`) are allowed. These are already used in V7's
`AdminDebugDrawer`.

### R5: Interaction-mode selector parity — fresh preferences, no V7 inheritance

The existing session page at
`app/dashboard/sessions/treatment-v9/page.tsx` must respect
`getInteractionMode()` from `lib/v9/v9-preferences.ts`. The selector UI
(if exposed anywhere — likely inside Settings, mirroring V7's pattern)
is **out of scope** for this PRD; we rely on the default resolution
(`orb_ptt` on mobile, `text_first` on desktop) plus any
`v9_interaction_mode` value the user has set during V9 usage.

**V9 does not inherit any V7 preferences.** On first V9 session for a
user, if `v9_interaction_mode`, `v9_mic_enabled`, or `v9_speaker_enabled`
are absent from localStorage:

- `v9_interaction_mode` resolves to the device default (`orb_ptt` on
  mobile, `text_first` on desktop) via the `isMobileDevice()` helper in
  `lib/v9/v9-preferences.ts`.
- `v9_mic_enabled` and `v9_speaker_enabled` resolve via the R6 matrix
  below.

V9 never reads, writes, or checks any `v7_*` key. This was an explicit
product choice: users who move from V7 to V9 start with V9's defaults
(which match the device-appropriate mode anyway), so there is no
regression risk. A user who specifically configured V7 and then moves
to V9 will need to reconfigure V9 once — a tiny cost compared to the
cross-version-leak risk of shared keys.

### R6: Voice-on defaults per interaction mode

On first V9 session start (no `v9_mic_enabled` or `v9_speaker_enabled`
present in localStorage), initialize voice preferences based on
interaction mode:

| Mode | `isMicEnabled` default | `isSpeakerEnabled` default |
| ---- | ---------------------- | -------------------------- |
| `orb_ptt` | `true` | `true` |
| `listen_only` | `false` | `true` |
| `text_first` | `false` | `false` |

Once the user toggles either button, that choice is persisted to
`v9_mic_enabled` / `v9_speaker_enabled` and honored on every subsequent
session until explicitly changed. This matches V7's behavior in
`TreatmentSession.tsx` around line 557–569 (the initial-mode branch).

### R7: Preserve V9's "render exactly what the backend sent" rule

This is the single most important invariant of V9 and must survive the
port. Specifically:

- The **first** rendered assistant message after session start must be
  `data.message` from `POST /api/treatment-v9 { action: 'start' }`,
  with no client-side substitution, no `INITIAL_WELCOME` override, no
  prepend, and no append.
- Every subsequent rendered assistant message must be `data.message`
  from `POST /api/treatment-v9 { action: 'continue', … }`, unmodified.
- The admin drawer may display timing metadata alongside the message,
  but the message bubble in the main conversation area (and in the
  drawer) must be byte-identical to what the backend returned.

An assertion test (R11 below) verifies this.

### R8: Voice hook compatibility

The `useNaturalVoice` hook takes a `treatmentVersion` prop that is
currently typed as a finite union (likely `'v4' | 'v5' | 'v6' | 'v7'`).
Add `'v9'` to that union. Inside the hook, `'v9'` must behave
identically to `'v7'` for every code path, with one exception: when the
hook consults `globalAudioCache` for a pre-rendered clip, the V9 code
path uses the hash-match resolver in R13 rather than hard-coding
`/audio/v9/static/...`. The resolver is free to return a V7-scoped
cache entry (Phase 1) or a V9-scoped cache entry (Phase 2) depending on
which assets are available for the current hash.

This hook lives at `components/voice/useNaturalVoice.ts`. The change
must not affect V4/V5/V6/V7 callers. Specifically, V7 continues to read
from `/audio/v7/static/...` directly; V9 reads through the resolver.

### R9: Session-pinned voice provider integration

The admin STT/TTS pinning work in `lib/v9/core.ts#v9GetSessionVoicePair`
already ensures a session sticks to one STT and one TTS provider for
its lifetime. The V9 session component must not override this — it may
inspect `startJson.voicePair` (if the backend returns it) for display
purposes ("Voice: OpenAI STT → ElevenLabs TTS") inside the admin
drawer, but must not send a provider override on subsequent turns.
Every `/api/treatment-v9/turn` request from the V9 client must leave
`stt.provider` and `tts.provider` unset so the backend reads the
pinned pair.

### R10: Resume flow parity

V9 resume today fetches the full message history via
`POST /api/treatment-v9 { action: 'resume' }`. The port must:

- Keep that same payload shape.
- When resuming, also re-apply the persisted interaction mode and voice
  preferences (R6) so a user who last ran V9 in Orb mode lands back in
  Orb mode.
- Not speak any historical message (TTS is for new messages only),
  mirroring V7 behavior in the resume path.

### R11: Tests

Add tests under `tests/v9/` (create the folder if absent):

- **R11.1 — First-message parity test.** Mock
  `POST /api/treatment-v9` to return a known welcome string, render
  `TreatmentSession`, assert the first message bubble's text is
  byte-identical to the mock. This is the client-side equivalent of
  the server-side parity gate; a future editor who reintroduces an
  `INITIAL_WELCOME` substitution will fail it.
- **R11.2 — Theme-token gate test.** Unit test for
  `scripts/v9-theme-token-gate.ts` that feeds it a file containing
  `bg-blue-600` and asserts a non-zero exit code.
- **R11.3 — Interaction-mode default test.** Simulate mobile user
  agent, no localStorage, assert `getInteractionMode() === 'orb_ptt'`.
  Simulate desktop, assert `'text_first'`.
- **R11.4 — Voice-defaults-per-mode test.** For each interaction mode,
  assert the initial `isMicEnabled`/`isSpeakerEnabled` state.
- **R11.5 — No `V7_STATIC_AUDIO_TEXTS` references** anywhere under
  `components/treatment/v9/`. Simple grep-based unit test.
- **R11.6 — Static audio resolver miss-on-mismatch.** Feed the R13.1
  resolver a canonical text that does NOT hash to any entry in V7's
  manifest and assert the result is `{ kind: 'miss' }`. Then feed a
  canonical text that DOES hash to a known V7 entry and assert
  `{ kind: 'hit', scope: 'v7', assetPath: <expected> }`.
- **R11.7 — Manifest hash self-consistency.** For each voice in
  `/audio/v7/static/`, load its `manifest.json` and assert that every
  entry's `hash` equals `hash(entry.canonicalText)` using the shared
  hash function from R13.1. This catches manifest corruption and
  hash-function drift.
- **R11.8 — V7 preferences isolation.** Seed `v7_mic_enabled=true` in
  localStorage, start a V9 session, assert V9's voice state is NOT
  `true` by inheritance — it must be resolved from V9's defaults
  (R6) or from `v9_*` keys only. This enforces R5's fresh-preferences
  rule.

The existing V9 parity integration tests
(`tests/v9-direct-parity.spec.ts`, `scripts/v2-v9-parity-check.ts`) must
continue to pass without modification.

The visual-regression tests (R14) are separate from the R11 unit
tests and run in their own Playwright spec.

### R12: Docs update

Append a short section to `docs/v9-voice-clone.md` describing the
restored shell and linking to this PRD. Update the wording around
"client shell" in that document to say:

> V9's client shell is a full port of V7's shell (Orb, admin debug
> drawer, theme engine, interaction modes) with localStorage keys and
> API endpoints repointed at V9. Byte-parity is enforced at the
> backend/API layer, not the client, so shell changes do not risk
> parity.

### R13: Static audio — reuse V7's assets in Phase 1, regenerate in Phase 2

The app is majority-static in the sense that most user-facing voice
clips map to a small canonical set of prompts (welcome, method
selection, modality introductions, restate-problem, reality deadline
check, etc. — the full list lives in
`lib/v7/static-audio-texts.ts` and its V2-derived equivalent). Shipping
V9 without pre-rendered audio would ship runtime-TTS latency
(typically 1–3 seconds) on every turn and burn money that the V7
preloader saves at approximately $0.04 per session.

We cannot naively reuse V7's MP3s, because V9's canonical strings come
from V2, which in some steps says something slightly different from
V7. Serving a V7 MP3 whose text doesn't match the text V9 just
rendered would violate the "render exactly what the backend sent"
invariant (R7): the user would see V2's sentence on screen and hear
V7's sentence in the speaker.

**The compromise** is a text-hash-addressed lookup:

1. **Phase 1 (ship with this PRD).** Reuse the existing V7 static
   assets under `/audio/v7/static/[voice]/`. For each assistant message
   V9 emits, compute a stable hash of the exact text the backend
   returned. If and only if a V7 manifest entry exists with the same
   hash, play that V7 file. Otherwise fall back to runtime TTS through
   the admin-pinned provider (`lib/v9/core.ts#v9GetSessionVoicePair`).
2. **Phase 2 (separate PR, tracked in this PRD's "Open Questions" but
   scoped in).** Add `scripts/generate-static-audio-v9.js` that
   iterates the canonical V2/V9 strings and emits
   `/audio/v9/static/[voice]/` MP3s + a matching `manifest.json`. The
   resolver in R13.1 checks V9's manifest first, then falls back to
   V7's, then runtime TTS. Once V9's coverage is satisfactory (target
   ≥ 95% of assistant messages in a typical session), V7 fallback can
   be removed.

#### R13.1: Hash-match resolver

Create `lib/v9/static-audio-resolver.ts`:

```ts
type StaticAudioLookupResult =
  | { kind: 'hit'; assetPath: string; voice: string; scope: 'v9' | 'v7' }
  | { kind: 'miss' };

export function resolveStaticAudio(
  canonicalText: string,
  voice: string,
): StaticAudioLookupResult;
```

Contract:

- `canonicalText` is the exact string returned by the V9 backend in
  `data.message`, trimmed of leading/trailing whitespace only. No
  punctuation normalization, no case folding — the text must be
  byte-for-byte identical to what the hashes were computed against.
- `voice` is one of the voice identifiers under
  `/audio/v7/static/` today (`marin`, `shimmer`, `heart`, `michael`).
  If the admin pins a TTS provider for which no static assets exist
  (e.g. ElevenLabs with a custom voice), the resolver returns `miss`
  and the caller does runtime TTS.
- The hash function is the same one V7's generator uses (see the
  `hash` field in `/audio/v7/static/[voice]/manifest.json` entries).
  Reuse `scripts/hash-audio-text.js` or its TS equivalent; do not
  re-implement it. Diverging from V7's hash function would silently
  miss every V7 asset.
- Lookup order: V9 manifest (if present) → V7 manifest → `miss`. The
  V9 manifest is absent in Phase 1 and present in Phase 2.
- Caching: manifests are fetched once per page load and cached in
  memory. No stale-while-revalidate; a hard refresh picks up
  regenerations.

#### R13.2: V9 audio preloader component

Copy `components/treatment/v7/V7AudioPreloader.tsx` to
`components/treatment/v9/V9AudioPreloader.tsx`. Changes:

- Component name: `V7AudioPreloader` → `V9AudioPreloader`.
- Manifest fetch: instead of directly reading
  `/audio/v7/static/[voice]/manifest.json`, call the resolver in
  R13.1. In Phase 1 this means "fetch V7's manifest and use its
  entries." In Phase 2 this means "fetch V9's manifest, then V7's, and
  union the entries with V9 winning on hash collision."
- Cache key: include a `scope: 'v9' | 'v7'` field in the
  `globalAudioCache` key so a V7 session (still running for archived
  users) and a V9 session don't evict each other's entries.
- Remove the `V7_STATIC_AUDIO_TEXTS` import and the coupling to
  V7-authored text. The preloader in V9 is purely hash-driven — it
  preloads whatever the resolver returns for the full canonical
  string set at session start.

#### R13.3: Canonical V9 string set

The preloader needs a list of strings to preload at session start. In
Phase 1 we cannot author this list against V2's script without
duplicating work, so we take the pragmatic approach:

- The preloader fetches V7's `manifest.json` for the selected voice
  and preloads every entry. This over-preloads (V7 has strings V9 may
  never say) but is zero extra work and costs only bandwidth.
- At render time, the resolver decides per-message whether the current
  V9 canonical text matches any of those preloaded hashes.

In Phase 2, `scripts/generate-static-audio-v9.js` emits a V9-specific
manifest derived from V2's scripted responses, and the preloader
preloads that manifest instead.

#### R13.4: Parity protection for the audio path

This is the highest-risk part of the entire PRD: if the hash function
or the comparison logic is wrong, V9 could play a V7 MP3 whose text
does not match what was just rendered, silently breaking the
"render-exactly-what-the-backend-sent" invariant for the audio
channel. Mitigations, which are **required** to land with R13:

- **Assertion at playback time.** Before calling
  `audioElement.play()`, log a development-only assertion that the
  canonical text the preloader used to pick this asset is byte-equal
  to the text currently displayed in the message bubble. In production
  this is a `console.warn` with a sampling rate of 1% to catch drift
  without spamming logs.
- **Unit test** (R11.6 below) that feeds a V9 canonical text into the
  resolver with a known-mismatched V7 manifest entry and asserts the
  resolver returns `miss`.
- **Unit test** (R11.7 below) that rehydrates the manifest hashes for
  one voice and asserts every entry's hash matches
  `hash(entry.canonicalText)`.
- **Telemetry counter.** A lightweight in-memory counter in
  `lib/v9/static-audio-resolver.ts` tracks `{ hits_v9, hits_v7,
  misses }` per session, exposed through the admin debug drawer. This
  tells testers at a glance whether the Phase 1 hit rate is acceptable
  or whether Phase 2 should be expedited.

#### R13.5: Phase 2 regeneration script (in scope, separate PR)

`scripts/generate-static-audio-v9.js` mirrors the existing V7
generator. It:

1. Iterates the full set of canonical V2 strings (sourced from
   `lib/v2/treatment-state-machine.ts` by running the state machine in
   a "dry-run" mode that emits every reachable `scriptedResponse` —
   the same approach the V2→V9 parity check already uses).
2. For each string, computes the V7-compatible hash.
3. For each voice and each TTS provider with static-asset support,
   calls the provider once to generate the MP3 and writes to
   `/public/audio/v9/static/[voice]/[hash].mp3`.
4. Writes a `manifest.json` in the same shape as V7's.
5. Runs in CI on a schedule (weekly) so V2 wording drift automatically
   regenerates affected assets. The job is gated behind
   `V9_AUDIO_REGEN_ENABLED=true` to avoid burning TTS credit on every
   push.

Phase 2 does not land with this PRD's first PR. It is enumerated here
so the Phase 1 design (R13.1–R13.4) doesn't paint itself into a
corner.

### R14: Visual regression via Playwright screenshot tests (opinionated, in scope)

The theme-token grep (R4) catches raw color classes. The first-message
assertion (R11.1) catches script drift. Neither of them catches layout
regressions, animation bugs, alignment shifts, or cases where a theme
token resolves to a wrong color at runtime. Because V9 is the
production entry point for real users and the port touches 2,960 lines
of client code, we need a visual guard.

Playwright is already set up in this repo (see `playwright.config.ts`
and the `tests/api/` specs). Adding screenshot-based regression tests
is incremental, not a new framework.

**I recommend including visual regression in scope. The user is agnostic
on this; I am making the call because the risk-reward is clearly
positive here.** Reasoning:

- The port is mechanical but large. Mechanical edits over 2,960 lines
  of intertwined state and JSX carry a meaningful chance of a silent
  layout regression (e.g. a flex wrapper that no longer wraps, a
  z-index that was implicit, a conditional render gate whose signature
  changed). None of these would be caught by script parity or the
  theme gate.
- V9 is the only production flow. Users who hit a visually broken V9
  don't have a fallback — V7 is archived. Catching regressions before
  merge is much cheaper than catching them in production.
- Playwright's built-in screenshot assertion (`expect(page).toHaveScreenshot(...)`)
  has sensible defaults (per-OS snapshot folders, tolerance for
  anti-aliasing, explicit update-on-approval). It does not produce
  noisy false-positives if configured correctly.
- The test surface is tiny: three interaction-mode landing states,
  one admin drawer open state, two themes (light / solarized-dark).
  Nine baseline screenshots total.
- If a test fails, the developer sees the pixel diff immediately and
  either accepts the new baseline or investigates. This is a
  cheap-to-maintain signal.

#### R14.1: Test targets

Create `tests/v9/visual-regression.spec.ts`. Each test drives a
playwright page through the V9 session start flow and snapshots at a
well-defined post-load state.

Baselines:

| # | Scenario | Viewport | Theme | localStorage seed |
| - | -------- | -------- | ----- | ----------------- |
| 1 | Orb mode, just-started session | 390×844 (iPhone 14) | solarized-dark | `v9_interaction_mode=orb_ptt`, `v9_mic_enabled=true`, `v9_speaker_enabled=true` |
| 2 | Listen-only mode, just-started session | 1280×800 (desktop) | solarized-dark | `v9_interaction_mode=listen_only`, `v9_mic_enabled=false`, `v9_speaker_enabled=true` |
| 3 | Text-first mode, just-started session | 1280×800 | solarized-dark | `v9_interaction_mode=text_first`, `v9_mic_enabled=false`, `v9_speaker_enabled=false` |
| 4 | Text-first mode, just-started session | 1280×800 | light | `v9_interaction_mode=text_first` |
| 5 | Orb mode, light theme, mobile | 390×844 | light | same as #1 but theme=light |
| 6 | Admin drawer open over orb mode | 1280×800 (desktop) | solarized-dark | #1 seeds + `v9_debug_drawer_open=true`, role=super_admin |
| 7 | Admin drawer open, drawer's voice-pair panel (from R9) | 1280×800 | solarized-dark | same as #6 |
| 8 | Post-first-response state (one user msg + one assistant msg rendered) | 1280×800 | solarized-dark | text_first + mock backend |
| 9 | Permission-denied error state (mic denied) | 390×844 | solarized-dark | orb_ptt + simulated `getUserMedia` rejection |

The mock backend for #6–#9 uses Playwright's `route.fulfill()` to
return a deterministic `{ message: "...", currentStep: "..." }`
payload so the screenshot does not depend on live TTS output or
network latency.

#### R14.2: Animation stability

Playwright screenshots capture a single frame. The Orb has a subtle
breathing animation and the admin drawer has a slide transition.
Without control, these cause flake.

Mitigation:

- Disable CSS animations globally for the test via
  `await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })`.
- For the drawer-open test, wait for the drawer to be in its final
  `translate-x-0` state before snapshotting
  (`await expect(drawer).toHaveCSS('transform', 'none')`).
- For the Orb, seed the frame by calling
  `page.evaluate(() => document.body.classList.add('reduce-motion'))`
  after `reduce-motion` becomes a real class hook inside
  `useNaturalVoice`. If `reduce-motion` doesn't exist yet, the test
  PR adds it as a minimal change — it's a class on `<body>` that
  makes the Orb SVG swap its `<animate>` durations to `0s`.

#### R14.3: Baseline management

Baselines live under `tests/v9/visual-regression.spec.ts-snapshots/`
and are committed to the repo. Workflow:

- CI runs Playwright in the `v9-parity-gate.yml` workflow (new step,
  not a new workflow). Failures block merge.
- To update baselines intentionally, a developer runs
  `pnpm playwright test tests/v9/visual-regression.spec.ts --update-snapshots`
  locally and commits the new PNGs. No "approve in UI" flow — the PR
  diff shows which PNGs changed, and the reviewer visually inspects.
- Snapshot folder is per-OS-and-browser (Playwright default:
  `-linux`, `-darwin`, `-chromium`). CI runs Linux Chromium; that is
  the canonical baseline. Developers on macOS see local diffs they
  should **not** commit unless they also re-run on Linux (via the
  Playwright Docker image).

#### R14.4: Test runtime budget

Nine screenshots across two viewports and two themes in a single
`describe` block with shared setup should run in under 60 seconds on
CI. If the workflow runtime becomes a concern, we can run visual
regression on a cron schedule (nightly) instead of on every PR, but
the default is per-PR because catching regressions pre-merge is the
whole point.

#### R14.5: When visual regression fails

A failing Playwright screenshot test is not, by itself, a stop-ship
signal. The reviewer examines the pixel diff and decides:

- **Intended change** (e.g. the developer deliberately changed the
  admin drawer's padding). Developer runs `--update-snapshots`, commits
  the new baseline, CI goes green.
- **Unintended regression** (e.g. a theme token resolves to the wrong
  color in dark mode because of a typo). Developer fixes the code,
  re-runs the test, no baseline update needed.
- **Flake** (anti-aliasing on one side of a rounded corner). Increase
  the per-test `maxDiffPixels` tolerance for that specific test, not
  globally.

## Technical Considerations

### Why a verbatim port rather than a shared component

The scoping question offered a "shared component parameterized by
version" option. It was rejected for now because:

- V7 is archived and frozen. Refactoring it to be parameterized adds
  risk to a stable flow that real users are still resuming.
- V9 is expected to diverge from V7 over time (different voice
  providers, different cost model, eventually a different audio cache
  strategy). A shared component would accumulate conditional branches.
- The port is mechanical (string replacement on prefixes and endpoint
  names), so the diff is large but shallow.

A shared component can be revisited once V9 has been in production
long enough to show which divergences are permanent.

### Why `v9_*` localStorage keys rather than reusing `v7_*`

Sharing keys would let a V7 user's mic preference leak into V9 (and
vice versa) during the transition period where both exist. Separate
keys also make it possible to migrate one direction without affecting
the other (e.g. add a V9-specific voice-mode telemetry key without
touching V7).

### Admin drawer surface

V7's drawer shows timing metrics (`textRenderTime`, `audioStartTime`,
delta). V9 should continue to report these. The timing instrumentation
lives client-side (captured at message-render and audio-onset times),
so no server changes are required.

One new admin-drawer panel is worth adding in this port: the current
**voice pair** (STT + TTS) in use for the session, sourced from
`startJson.voicePair`. This is cheap (the data is already returned by
`v9HandleStartSession`) and solves a real testing question ("which
provider am I hearing right now?").

### Build / phasing order

1. **R1** — `lib/v9/v9-preferences.ts` (no UI change, safe to land
   first).
2. **R2** — `components/treatment/v9/AdminDebugDrawer.tsx` (not wired in
   yet, safe to land).
3. **R4** — theme-token gate script and CI step (fail-closed from day
   one, so subsequent PRs cannot regress).
4. **R13.1 + R11.6 + R11.7** — static audio resolver and its unit
   tests (the resolver can land and be unit-tested before it's wired
   into the session component).
5. **R8** — extend `useNaturalVoice` to accept `'v9'` and route its
   static-audio lookups through the R13.1 resolver.
6. **R13.2 + R13.3 + R13.4** — `V9AudioPreloader` component + Phase 1
   reuse-V7-manifest behavior + in-session assertion and telemetry.
7. **R3 + R5 + R6 + R7 + R9 + R10 + R11.1–R11.5 + R11.8** — the port
   itself, with all the non-visual unit tests, in one PR.
8. **R14** — Playwright visual-regression tests land in the same PR
   as the port (baselines are captured against the ported output).
9. **R12** — docs update, last.
10. **R13.5** — Phase 2 regeneration script and V9-specific manifest,
    in a follow-up PR, once Phase 1 has been running in production
    long enough to measure the hash-hit rate.

## Risks

- **Parity gate false negative (text channel).** The CI gate runs on
  the API, not the shell. R7 + R11.1 mitigate by explicitly asserting
  the first message is rendered byte-identical to the backend
  response. If that test is removed or weakened, a future shell
  change could silently insert a prefix/suffix and still pass CI.
  **Mitigation:** put a comment at the top of R11.1 telling future
  editors that it is the client-side parity equivalent of the
  server-side gate.
- **Parity gate false negative (audio channel).** This is new with
  R13. The hash-match resolver can, in principle, serve a V7 MP3
  whose text does not match V9's currently-rendered bubble. This
  would silently break parity in the audio channel without affecting
  the text channel. **Mitigations:** (1) the hash function must be
  byte-identical to V7's; (2) R13.4 adds a development-time
  assertion and a production-time sampled warn; (3) R11.6 and R11.7
  enforce resolver correctness and manifest self-consistency; (4) R13
  forbids any text normalization inside the resolver.
- **`useNaturalVoice` regression for V7.** Extending the version union
  must not change V7 behavior. **Mitigation:** R8's explicit
  "behaviorally identical to v7 except that static-audio lookups go
  through the R13.1 resolver" clause, plus running the existing V7
  tests after the hook change. V7 continues to read from
  `/audio/v7/static/...` directly.
- **LocalStorage collisions.** If any code path globs `v7_*` or `v9_*`
  keys or does a wholesale `localStorage.clear()`, preferences will
  be lost across versions. **Mitigation:** grep the repo for any such
  patterns before landing R3. R11.8 enforces V9-isolation explicitly.
- **Theme token incompleteness.** If the theme engine lacks a token
  that V7 happens to use only as a raw color (e.g. a literal
  `text-green-600` for a success dot), the gate will fail.
  **Mitigation:** the port copies V7 verbatim, and V7 is already
  largely theme-clean (verified above: only the status/success dot
  green-circle indicators in `AdminDebugDrawer` use raw colors, and
  those should be converted to `bg-accent` during the port).
- **Visual-regression flake.** Playwright screenshot tests can flake
  on anti-aliasing, font rendering, or animation timing.
  **Mitigation:** R14.2 disables CSS animations globally for the
  test run, waits for final transform states before snapshotting,
  and uses `reduce-motion` class hooks for SVG animations. Per-test
  `maxDiffPixels` tolerance is tunable if a specific test flakes
  without a real regression.
- **Phase 1 hit rate too low.** If V7's manifest covers too few of
  V9's canonical strings, most assistant turns fall back to runtime
  TTS, eroding the cost savings that motivated R13 in the first
  place. **Mitigation:** R13.4's telemetry counter measures this
  directly. Phase 2 (R13.5) is ready to ship once the measurement is
  in. Worst case we spend ~$0.04/session for the Phase 1 window — a
  known, time-boxed cost.
- **V9 audio assets generated with the wrong provider/voice.** When
  Phase 2 (R13.5) runs, it must not assume the admin-selected TTS
  provider. A static MP3 generated by OpenAI cannot be played back
  in an ElevenLabs-selected session without breaking voice
  consistency. **Mitigation:** Phase 2 generates per-provider
  manifests and the resolver (R13.1) scopes lookups by the pinned
  TTS provider, not just by voice name. ElevenLabs sessions with no
  matching V9 manifest and no matching V7 manifest fall back to
  runtime TTS.

## Success Metrics

- V9 visually matches V7 on desktop and mobile for all three
  interaction modes: `orb_ptt` shows the Orb and subtitle, `listen_only`
  shows speaker-on chat, `text_first` shows text-only chat.
- The theme-token gate in CI is green on main and fails if any raw
  color class is introduced under `components/treatment/v9/` or
  `lib/v9/`.
- `v9-parity-gate.yml` remains green across the change (script parity
  unchanged). The new Playwright visual-regression step added in the
  same workflow is also green on main.
- Admin testers can toggle the debug drawer with `Ctrl+Shift+D` and see
  per-message timing identical to V7, plus the new pinned-voice-pair
  panel and the static-audio telemetry counter.
- No change in `lib/v2/*` or `lib/v9/core.ts`.
- The admin-controlled voice pipeline (from the
  `system_voice_settings` table) continues to pin session voices
  correctly; the new drawer panel displays the pinned pair.
- **Phase 1 static-audio hit rate.** Measured via the R13.4 telemetry
  counter across the first week of real V9 sessions, the ratio
  `hits / (hits + misses)` is the trigger for Phase 2 prioritization.
  No hard threshold — Phase 2 ships when we decide the runtime-TTS
  cost of the miss rate exceeds the generation cost of Phase 2.
- **Parity invariant holds in the audio channel.** The R13.4
  playback-time assertion produces zero production warnings. Any
  non-zero count is investigated immediately — it would indicate the
  hash-match resolver served a V7 MP3 whose text does not match the
  V9-rendered bubble.

## Open Questions

1. **Interaction-mode selector UI.** V7's settings surface a
   three-option selector (Orb / Listen / Text-first). Does V9 need its
   own selector in `app/dashboard/settings/page.tsx`, or is the
   device-default resolution plus localStorage persistence good
   enough for launch? This PRD defers the settings UI and relies on
   defaults; a follow-up PRD can add a selector if users ask.
2. **TTS provider coverage for Phase 2 regeneration.** V7's static
   assets were generated against a specific voice set
   (`marin`, `shimmer`, `heart`, `michael`). Phase 2's
   `scripts/generate-static-audio-v9.js` needs a decision on which
   voices and which TTS providers to emit MP3s for. ElevenLabs custom
   voices are expensive and unique per tenant; OpenAI and Kokoro are
   cheap. The conservative starting point is "same four voices as
   V7, OpenAI + Kokoro only." To be confirmed before Phase 2 lands.
3. **Cron cadence for Phase 2 regeneration.** Weekly is proposed in
   R13.5, but V2 wording changes infrequently. Quarterly may be
   sufficient. Revisit after the first regeneration run measures
   actual drift over time.
