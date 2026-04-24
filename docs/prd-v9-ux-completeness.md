# PRD: V9 UX Completeness — Orb Default, Kokoro Hardcode, V9 Settings Section, Admin Drawer Fix

## Introduction

`docs/prd-v9-ux-restoration.md` ported V7's client shell to V9 successfully.
The files are all in place: `TreatmentSession.tsx`, `AdminDebugDrawer.tsx`,
`V9AudioPreloader.tsx`, `lib/v9/v9-preferences.ts`, the static-audio resolver.
But three user-visible regressions ship today, and each is a direct
consequence of a decision the restoration PRD made (or declined to make) that
diverges from V5's proven behavior:

1. **The Orb never appears on desktop**, and there is no UI anywhere for a
   user to opt into orb mode. `getDefaultInteractionMode()` returns
   `'text_first'` on any viewport ≥ 768 px, and the restoration PRD's
   R5/Open-Q-#1 explicitly deferred the settings selector.
2. **The admin debug drawer never opens on desktop**, even for super admins
   pressing `Ctrl+Shift+D`. The drawer render is gated on
   `isGuidedMode && isAdmin`; `isGuidedMode` is only `true` in orb mode;
   desktop defaults to text-first; drawer is never mounted; keyboard
   shortcut is inert.
3. **Kokoro TTS is unreachable from V9** even though the Hetzner Kokoro
   service at `https://api.mind-shift.click/tts` is live and every prior
   version uses it successfully. V9's `KokoroTtsProvider`
   (`lib/voice/tts-providers/kokoro.ts`) was written against an
   OpenAI-compatible FastAPI shape (`/v1/audio/speech`) that the Hetzner
   deployment does not expose, and its `isAvailable()` check returns `false`
   unless `KOKORO_SERVICE_URL` is set — a variable that is not set in any
   current deployment.

Scope is **V9 only**. V4, V5, V6, V7 are all archived. This PRD does not
touch their preferences modules, components, routes, audio preloaders, or
state machines.

## Goals

- Default every V9 session on every device to `orb_ptt`, matching V5's
  `getDefaultInteractionMode()` exactly.
- Let desktop users actually see and use the orb. The existing
  `shouldShowOrb()` false-gates desktop even when `v9_interaction_mode` is
  explicitly `'orb_ptt'`; fix that.
- Let admins open the slide-out debug drawer in every session regardless of
  interaction mode, via either the always-visible edge tab or the
  `Ctrl+Shift+D` shortcut.
- Make Kokoro a usable TTS provider from V9 without env-var configuration.
  The Hetzner Kokoro URL is owned by the operator, is stable, and has been
  serving requests from V5 and the static-audio generator for months — it
  should be hardcoded as the default the way `scripts/generate-static-audio.js`
  hardcodes it, not gated behind an env var that is not set.
- Surface interaction mode and voice preferences in the existing user
  settings page (`app/dashboard/settings/page.tsx`) behind a V9 section that
  writes `v9_*` keys, mirroring the shape of the V4 section already in that
  file.

## Non-Goals

- **No changes to V4, V5, V6, or V7.** Those versions are archived. Their
  preferences modules (`lib/v*/`), components (`components/treatment/v*/`),
  API routes (`app/api/treatment-v*/`), and settings sections are out of
  scope.
- **No changes to V9's state machine** (`lib/v9/core.ts`), V2 state machine
  (`lib/v2/*`), or any backend route under `/api/treatment-v9`. This PRD is
  client-side plus one TTS provider file.
- **No changes to the Kokoro service** itself. No deploy pipeline, no Docker
  config, no health check route, no new endpoints on
  `api.mind-shift.click`.
- **No UI for configuring the Kokoro URL** or any TTS provider endpoint.
  The user was explicit: it must be ours, and since the URL is already
  decided it must be hardcoded. No admin-visible input, no DB column, no
  tenant override.
- **No changes to the admin voice-settings UI** at
  `app/dashboard/admin/settings/page.tsx` other than the provider
  availability report (FR-6) so that Kokoro no longer reports "unavailable:
  KOKORO_SERVICE_URL not set".
- **No deletion of `listen_only` or `text_first` code paths.** They remain
  selectable from the V9 settings section (same pattern V5 uses), they are
  just no longer the default on any device.
- **No schema migration.** `system_voice_settings` stays as-is (stt/tts
  provider selection only, no URL columns).
- **No visual-regression baseline churn work in this PRD.** The R14 matrix
  from the previous PRD will need its desktop-default snapshot updated
  from text-first to orb — handle that as part of the PR that lands this
  PRD, not as a separate user story.

## User Stories

### US-001: Orb loads by default on desktop and mobile

**Description:** As a V9 user visiting `/dashboard/sessions/treatment-v9` on
any device for the first time, I want the Orb to appear immediately so I
know I'm in a voice-first session.

**Acceptance Criteria:**

- [ ] `getDefaultInteractionMode()` in `lib/v9/v9-preferences.ts` returns
      `'orb_ptt'` regardless of `isMobileDevice()` result.
- [ ] A fresh browser session (no `v9_*` localStorage keys) on a 1280×800
      desktop viewport renders the guided-mode orb UI (the gradient PTT
      button with the subtitle line), not the chat-text layout.
- [ ] `shouldShowOrb()` returns `true` on both desktop and mobile when
      `v9_interaction_mode === 'orb_ptt'`.
- [ ] Unit test in `tests/v9/` asserts
      `getDefaultInteractionMode() === 'orb_ptt'` for simulated mobile
      (< 768 px) and desktop (≥ 768 px) viewports.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Admin debug drawer available from any interaction mode

**Description:** As a super_admin or tenant_admin debugging a V9 session, I
want `Ctrl+Shift+D` (or `Cmd+Shift+D`) to open the slide-out debug drawer
and the right-edge bug tab to be visible in every mode, so I can inspect
per-message timing, the pinned voice pair, and the static-audio telemetry
without first having to switch to orb mode.

**Acceptance Criteria:**

- [ ] The `AdminDebugDrawer` render in
      `components/treatment/v9/TreatmentSession.tsx:2755` is gated by
      `isAdmin` only, not `isGuidedMode && isAdmin`.
- [ ] On desktop, an admin in any of the three interaction modes sees the
      always-visible right-edge bug-icon tab (rendered by the drawer
      component at lines 106–121) and can click it to open the drawer.
- [ ] The `Ctrl+Shift+D` / `Cmd+Shift+D` shortcut toggles the drawer in all
      three interaction modes for an admin user.
- [ ] Non-admin users never see the drawer or its edge tab, regardless of
      mode or key combination.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: V9 user settings section

**Description:** As a V9 user, I want a section at `/dashboard/settings`
where I can pick my interaction mode, voice actor, playback speed, and
mic/speaker defaults — the same controls V5 surfaced — so I can adjust my
preferences without opening DevTools.

**Acceptance Criteria:**

- [ ] A new "Mind Shifting Session (V9)" section is added to
      `app/dashboard/settings/page.tsx`.
- [ ] The section reads and writes `v9_*` localStorage keys via
      `lib/v9/v9-preferences.ts` — it does not share state with the
      existing V4 section.
- [ ] The section contains:
  - three interaction-mode buttons (`Voice Orb`, `Listen Only`,
    `Text First`) styled with the Orb option highlighted as the
    recommended default;
  - a voice-actor picker;
  - a playback-speed slider (0.75× – 1.5×, default 1.0×);
  - mic-default and speaker-default toggles.
- [ ] Changing the interaction mode calls `setInteractionMode()` which
      dispatches `V9_EVENTS.INTERACTION_MODE_CHANGED`; a separately-open
      V9 session tab updates live.
- [ ] Selecting a new voice calls `setVoicePreferences()` which dispatches
      `V9_EVENTS.VOICE_SETTINGS_CHANGED` and the legacy
      `v9-voice-changed` event; a separately-open V9 session tab updates
      live.
- [ ] The V4 section already in the file is left completely unchanged.
      This is purely additive.
- [ ] All color classes in the new section use theme tokens (`bg-card`,
      `text-foreground`, `border-border`, `bg-primary`, etc.) per R4 of
      the restoration PRD. No raw Tailwind colors (`bg-blue-*`,
      `text-gray-*`, …).
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Kokoro URL hardcoded to the Hetzner endpoint

**Description:** As the operator, I want Kokoro's TTS endpoint hardcoded to
`https://api.mind-shift.click/tts` so that selecting "Kokoro" in the admin
Voice tab always reaches our production service without depending on a
`KOKORO_SERVICE_URL` env var that is not set in any current deployment.

**Acceptance Criteria:**

- [ ] `lib/voice/tts-providers/kokoro.ts` exports a `KOKORO_BASE_URL`
      constant whose value is `https://api.mind-shift.click/tts`, plus a
      `getKokoroBaseUrl()` helper that returns
      `process.env.KOKORO_API_URL ?? KOKORO_BASE_URL` — the same default
      endpoint `scripts/generate-static-audio.js:135` already uses.
- [ ] `KokoroTtsProvider.isAvailable()` returns `true` unconditionally.
      It no longer reads `process.env.KOKORO_SERVICE_URL`.
- [ ] `KokoroTtsProvider.synthesize()` POSTs to `getKokoroBaseUrl()`
      directly (it does **not** append `/v1/audio/speech` or any other
      path suffix).
- [ ] The request body matches the V5/generator shape:
      `{ text: request.text, voice: <voiceId>, format: request.format ?? 'mp3' }`
      and not the OpenAI-compatible `{ model, input, voice, response_format }`
      shape.
- [ ] The voice identifier is resolved via the same
      `getKokoroVoiceId()`-style mapping V5's `app/api/tts/route.ts:34-45`
      uses, so that generic names like `heart`, `michael`, `alloy` map to
      Kokoro's `af_heart`, `am_michael`, etc. A shared helper at
      `lib/voice/tts-providers/kokoro.ts` (or imported from a shared
      module) does this — no duplication.
- [ ] Kokoro response handling preserves today's mime-type logic:
      `mp3` → `audio/mpeg`, `wav` → `audio/wav`, `opus` → `audio/ogg; codecs=opus`.
- [ ] `KOKORO_API_KEY`, if set, continues to be sent as `X-API-Key`.
      `KOKORO_VOICE_ID`, if set, continues to act as the default voice
      override. Both env vars remain optional; missing env does not
      disable the provider.
- [ ] Smoke test (documented in the PR description):
      `curl -X POST https://api.mind-shift.click/tts
       -H 'content-type: application/json'
       -d '{"text":"hello","voice":"af_heart","format":"mp3"}' --output /tmp/k.mp3`
      returns a non-empty MP3. (This is the same call shape the provider
      will make.)
- [ ] Unit test in `tests/v9/` mocks `fetch` and asserts:
  1. `KokoroTtsProvider.isAvailable()` returns `true` with no env vars
     set;
  2. `.synthesize()` POSTs to `https://api.mind-shift.click/tts` exactly
     — no suffix — when `KOKORO_API_URL` is unset;
  3. the body is `{ text, voice, format }` with no `model` or
     `response_format` keys;
  4. setting `KOKORO_API_URL=http://localhost:8080/tts` redirects the
     POST to that URL (env override still honored);
  5. setting `KOKORO_API_KEY=xyz` adds `X-API-Key: xyz` to the request
     headers;
  6. omitting `KOKORO_API_KEY` omits the header.
- [ ] Typecheck passes.

### US-005: Admin voice UI shows Kokoro as available

**Description:** As a super_admin visiting the admin Voice tab, I want
Kokoro to appear as a selectable provider without the grey "Unavailable"
styling, because it now works with no env configuration.

**Acceptance Criteria:**

- [ ] `app/api/admin/voice-settings/route.ts` removes the
      `kokoro: 'KOKORO_SERVICE_URL not set'` entry from the
      provider-unavailability reasons map (line 70).
- [ ] The admin Voice tab at `/dashboard/admin/settings` on a fresh
      environment (no `KOKORO_*` env vars) shows Kokoro as an enabled
      radio option with no "Unavailable" red text.
- [ ] Clicking "Play sample" with Kokoro selected successfully
      round-trips audio through `https://api.mind-shift.click/tts` and
      plays it in the browser.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

### US-006: Docs reflect hardcoded Kokoro and orb-only default

**Description:** As the next engineer reading `docs/v9-voice-clone.md` to
onboard on V9, I want the docs to match what ships: orb as the default on
every device, and the Kokoro endpoint hardcoded rather than env-driven.

**Acceptance Criteria:**

- [ ] The provider table in `docs/v9-voice-clone.md` (line 46) replaces
      the Kokoro row to read:
      `| kokoro | Self-hosted compute | Endpoint hardcoded to https://api.mind-shift.click/tts. Optional env overrides: KOKORO_API_URL, KOKORO_API_KEY, KOKORO_VOICE_ID |`
- [ ] A new short "Why is Kokoro hardcoded?" subsection explains the
      rationale (stable operator-owned URL; env-driven configuration has
      left production without Kokoro repeatedly).
- [ ] The "V9 UX restoration (client shell)" section near line 146 gains
      a new bullet: "Default interaction mode is `orb_ptt` on every
      device. Desktop and mobile both land in the guided orb UI; the V4
      mobile-only orb restriction has been removed in V9."

## Functional Requirements

### FR-1: Default interaction mode is `orb_ptt` on every device

In `lib/v9/v9-preferences.ts`:

```ts
// BEFORE
export function getDefaultInteractionMode(): InteractionMode {
  return isMobileDevice() ? 'orb_ptt' : 'text_first';
}

// AFTER (matches lib/v5/v5-preferences.ts:49-51)
export function getDefaultInteractionMode(): InteractionMode {
  return 'orb_ptt';
}
```

### FR-2: `shouldShowOrb()` drops the `isMobileDevice()` gate

In `lib/v9/v9-preferences.ts`:

```ts
// BEFORE
export function shouldShowOrb(): boolean {
  const mode = getInteractionMode();
  return mode === 'orb_ptt' && isMobileDevice();
}

// AFTER
export function shouldShowOrb(): boolean {
  return getInteractionMode() === 'orb_ptt';
}
```

`isMobileDevice()` itself stays exported — other callers (mobile layout
tweaks, viewport-specific CSS) may still use it. Only the orb-visibility
helper drops it.

### FR-3: Admin drawer gate is `isAdmin` only

In `components/treatment/v9/TreatmentSession.tsx` at line 2755:

```tsx
// BEFORE
{isGuidedMode && isAdmin && (
  <AdminDebugDrawer ... />
)}

// AFTER
{isAdmin && (
  <AdminDebugDrawer ... />
)}
```

The drawer component (`components/treatment/v9/AdminDebugDrawer.tsx`) already
renders an always-visible bug-icon edge tab (lines 106–121) whenever it is
mounted, and its own keyboard handler (lines 82–91) attaches
`Ctrl+Shift+D`. Dropping the mode gate is the entire change.

### FR-4: V9 section in user settings page

Add a new `<Card>` block inside `app/dashboard/settings/page.tsx`, below
any existing V4 card. It must:

- Import from `@/lib/v9/v9-preferences` independently of the V4 imports.
  Do **not** modify the V4 import line (line 18 today).
- Own its own React state (e.g. `v9Settings`, `setV9Settings`) separate
  from the existing `v4Settings`.
- Load state on mount via `getInteractionMode()` and
  `getVoicePreferences()` from `lib/v9/v9-preferences`.
- Listen for `V9_EVENTS.INTERACTION_MODE_CHANGED` and
  `V9_EVENTS.VOICE_SETTINGS_CHANGED` to keep the UI in sync if other
  tabs/components change state.
- Render the following controls, matching V5's visual structure at
  `app/dashboard/settings/page.tsx:900–943` as a pattern reference:
  1. **Interaction Mode** — three full-width buttons for `orb_ptt`,
     `listen_only`, `text_first`. The orb_ptt button is visually
     primary (using `bg-primary` / `border-primary` theme tokens) to
     communicate it is the recommended mode; the other two use secondary
     styling. Clicking calls `setInteractionMode(mode)`.
  2. **Voice Actor** — a 2×N grid of voice buttons. The option set is
     `['heart', 'michael', 'marin', 'shimmer']` (the voice identifiers
     present in today's V9 preferences + the default from
     `lib/v9/v9-preferences.ts:123`). Clicking calls
     `setVoicePreferences({ selectedVoice })`.
  3. **Playback Speed** — a range slider bound to `v9_playback_speed`
     (min 0.75, max 1.5, step 0.05, default 1.0), calling
     `setVoicePreferences({ playbackSpeed })` on change.
  4. **Mic Default** — a `<Switch>` bound to `v9_mic_enabled`, calling
     `setVoicePreferences({ micEnabled })` on change.
  5. **Speaker Default** — a `<Switch>` bound to `v9_speaker_enabled`,
     calling `setVoicePreferences({ speakerEnabled })` on change.
- Persist no "save" button — preferences apply immediately. This is
  consistent with how V4/V5's sections behave today in that file.
- Uses only theme tokens for color classes. No raw Tailwind colors.
- Renders inside whichever tab makes sense in the existing tab structure
  (Session / Voice / Treatment); if the page has no such tab today, add
  a new "Session (V9)" tab; if V4's section is on a "Session" tab,
  append the V9 card below the V4 card on that same tab.

### FR-5: Hardcode Kokoro base URL + rewrite synthesize() to the V5 API shape

Rewrite `lib/voice/tts-providers/kokoro.ts` so that:

- A constant `KOKORO_BASE_URL` and helper `getKokoroBaseUrl()` exist at module scope:
  ```ts
  export const KOKORO_BASE_URL = 'https://api.mind-shift.click/tts';

  export function getKokoroBaseUrl(): string {
    return process.env.KOKORO_API_URL ?? KOKORO_BASE_URL;
  }
  ```
  Rationale: matches the exact pattern V5 already ships in
  `scripts/generate-static-audio.js:135`, so Vercel deploys without the
  env var still reach the production URL, and Hetzner deploys that want
  to optimize via `http://localhost:8080/tts` can set the env var.
  Note the env-var name is `KOKORO_API_URL` — consistent with V5 — **not**
  `KOKORO_SERVICE_URL`, which was a V9-only name that no deployment
  actually sets.
- `isAvailable()` returns `true` unconditionally.
- `synthesize()`:
  - POSTs to `getKokoroBaseUrl()` with no path suffix. (Previously it
    appended `/v1/audio/speech`.)
  - Sends the body `{ text, voice, format }` where `text` is
    `request.text`, `voice` is the mapped Kokoro voice id (see voice
    mapping requirement below), and `format` is `request.format ?? 'mp3'`.
    **Does not** send `model`, `input`, or `response_format` keys.
  - Sets `X-API-Key` header iff `process.env.KOKORO_API_KEY` is present.
  - Parses `response.arrayBuffer()` into a `Buffer` the same way it does
    today, returning a `TtsSynthesisResult` with the correct
    `mimeType` for the requested format.
- Voice mapping: generic voice names (`heart`, `michael`, `alloy`,
  `shimmer`, `echo`, `fable`, `onyx`, `nova`) map to Kokoro's
  `af_*`/`am_*` identifiers the same way `app/api/tts/route.ts:34-45`
  maps them today. Extract the mapping into a shared helper
  (`lib/voice/tts-providers/kokoro-voices.ts`, or similar) so the V9
  provider and the legacy `/api/tts` route share one source of truth.
- `DEFAULT_VOICE` remains `process.env.KOKORO_VOICE_ID ?? 'af_heart'` so
  that a deploy-time override is still possible; this matches the
  behavior already in the file.

### FR-6: Admin voice settings route no longer reports Kokoro as env-gated

In `app/api/admin/voice-settings/route.ts`, remove the line:

```ts
kokoro: 'KOKORO_SERVICE_URL not set',
```

from the unavailability-reasons map (line 70). Because `isAvailable()`
now always returns `true`, this message would never actually be shown,
but leaving it would mislead future readers; delete it to keep the map
honest.

### FR-7: V9 voice-clone docs updated

Update `docs/v9-voice-clone.md`:

- **Line 46** (provider table, Kokoro row): change the env column to
  describe the hardcoded endpoint and the remaining optional overrides:
  ```md
  | `kokoro` | Self-hosted compute | Endpoint hardcoded to `https://api.mind-shift.click/tts`. Optional env overrides: `KOKORO_API_URL`, `KOKORO_API_KEY`, `KOKORO_VOICE_ID` |
  ```
- **Add a new subsection** "Why is Kokoro hardcoded?" directly beneath
  the provider table, explaining: operator owns the URL; the URL is
  stable; env-driven configuration has left multiple deploys without
  Kokoro in the past; hardcoding removes a whole class of silent
  configuration failure; the env var override is retained so Hetzner
  deploys can still bypass the public DNS path when desired.
- **Line 146 area** (the "V9 UX restoration (client shell)" section):
  add a bullet stating that the default interaction mode is `orb_ptt`
  on every device (desktop and mobile), and cross-reference this PRD.

## Technical Considerations

### Why hardcode rather than store the URL in `system_voice_settings`

The previous PRD's voice-settings table (`supabase/migrations/062_voice_pipeline_settings.sql`)
deliberately stores only provider **selection** (`stt_provider`,
`tts_provider`) — not any URL, endpoint, or credential. The design
intent is "admin picks from a menu of providers the operator has
already configured." Adding a URL column would (a) let admins break
their own production by typing the URL wrong, (b) create a third place
(DB, env, code) that has to be kept in sync, (c) require RLS, audit,
and migration work that buys no real operator value because only the
operator knows what the URL should be anyway. Hardcoding in the
provider file, with an env override for infrastructure tuning, is
strictly simpler and strictly safer.

### Why the V9 Kokoro provider's current API shape is wrong

`lib/voice/tts-providers/kokoro.ts:43` does `BASE_URL + '/v1/audio/speech'`
and sends `{ model: 'kokoro', input: request.text, voice, response_format }`
— the OpenAI-compatible Kokoro-FastAPI shape. The actual Hetzner
deployment at `https://api.mind-shift.click/tts` exposes a simpler
endpoint: POST the root `/tts` URL with `{ text, voice, format }`.
That is the shape V5's `app/api/tts/route.ts:109-119` uses, the shape
`scripts/generate-static-audio.js:171` uses, and the shape documented
in `KOKORO_DEPLOYMENT.md:292` and `KOKORO_TROUBLESHOOTING.md:189`.
The V9 provider has never worked against this deployment; the first
time an admin ever selects Kokoro in production the session errors.
FR-5 corrects both the URL and the body shape.

### Why V5's settings pattern is the right model for FR-4

V5 already uses `app/dashboard/settings/page.tsx` as a
preferences-only page with cards per concern (interaction mode, voice,
playback, mic/speaker), writing to `v5_*` localStorage keys and
dispatching `V5_EVENTS.*`. V9's module (`lib/v9/v9-preferences.ts`)
mirrors that surface 1:1 (same function names, same event shape, same
keys with a `v9_` prefix). Adding a parallel card in the same file that
imports from `lib/v9/` and writes `v9_*` keys is the minimal delta; no
new page, no new route, no layout change.

### Orb rendering path is untouched by this PRD

`components/treatment/v9/TreatmentSession.tsx:2280` already renders the
orb when `isGuidedMode === true`, and `isGuidedMode` is already set to
`true` on mount when `interactionMode === 'orb_ptt'` (line 616). Making
orb the default on every device (FR-1) therefore produces the orb on
desktop immediately — no component logic needs changing. Similarly
FR-3 is a one-line change to the parent gate; the drawer component
itself is already complete and mounted properly.

### Test surface

- `tests/v9/preferences.spec.ts` (new, ~40 lines): asserts
  `getDefaultInteractionMode() === 'orb_ptt'` regardless of
  `window.innerWidth`; asserts `shouldShowOrb() === true` when
  `v9_interaction_mode === 'orb_ptt'` on simulated desktop.
- `tests/v9/kokoro-provider.spec.ts` (new, ~80 lines): mocks `fetch`
  and asserts the six bullet points in US-004's acceptance criteria.
- `tests/v9/admin-drawer.spec.ts` (new, ~30 lines): mounts
  `TreatmentSession` with a super_admin profile in each of the three
  interaction modes, asserts the drawer edge-tab button is visible in
  each, asserts `Ctrl+Shift+D` toggles the drawer in each.
- Existing `tests/v9-direct-parity.spec.ts` and
  `scripts/v2-v9-parity-check.ts` must continue to pass without
  modification — this PRD touches no state-machine code.
- Playwright visual-regression matrix from R14 of the previous PRD:
  scenarios #3 and #4 currently seed `v9_interaction_mode=text_first`
  as the desktop default. Update their comments to note the seed is
  now **explicitly overriding** the new default. Add a new scenario
  "Orb mode, desktop, solarized-dark" that does **not** seed
  `v9_interaction_mode` and snapshots the post-default-resolution
  state. Baselines need to be captured on the same CI run that lands
  this PRD.

## Success Metrics

- First-time V9 visit on a desktop browser renders the orb within
  500 ms of page interactivity. Verified manually per US-001.
- Admins on any V9 session can open the debug drawer in < 1 s via
  `Ctrl+Shift+D` or the edge tab, in every interaction mode. Verified
  manually per US-002.
- Mode switches in `/dashboard/settings` apply to a separately-open V9
  session tab within 500 ms (live event dispatch). Verified manually
  per US-003.
- Clicking "Play sample" with Kokoro selected in
  `/dashboard/admin/settings`'s Voice tab succeeds on a deploy with no
  `KOKORO_*` env vars set. Verified manually per US-004/US-005.
- `v9-parity-gate.yml` remains green (script parity is untouched).
- No regressions in V4, V5, V6, or V7 — their sessions, preferences,
  routes, and static audio all behave exactly as before.

## Open Questions

1. **Should the user-settings V9 section also expose the VAD sensitivity
   slider** that `lib/v9/v9-preferences.ts` already supports via
   `v9_vad_sensitivity`? V5 doesn't surface it in the settings page, so
   FR-4 omits it; add it if the operator wants it, but default-off.
2. **Should `listen_only` and `text_first` remain present in the V9
   settings selector at all**, given the user's statement that "orb mode
   is the only mode"? FR-4 keeps all three buttons to match V5's
   established pattern and to preserve accessibility (listen-only is the
   a11y mode). If the product direction is "orb only, no fallback," the
   selector can collapse to a single Orb pill with a "coming soon" note
   on the others — that is a net copy change, not a logic change, and
   should be a follow-up.
3. **Should `KOKORO_API_URL` (env override) be documented in the
   `.env.example` file**, or is hardcoding the default plus undocumented
   override the intended posture? FR-7 adds the env var name to
   `v9-voice-clone.md`; a `.env.example` line can be added in the same
   PR if the operator wants it discoverable.
4. **R14 baseline capture policy.** The desktop-default snapshot
   changes from text-first to orb as a side effect of this PRD. The
   reviewer who lands this PRD must re-run Playwright with
   `--update-snapshots` and commit the new baselines; there is no way
   to avoid the snapshot churn. Document this in the PR description
   so the reviewer doesn't block on "why are the PNGs changing?"
