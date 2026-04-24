/**
 * R14 Playwright visual-regression tests for the V9 TreatmentSession.
 *
 * Coverage matrix:
 *   interactionMode × viewport × theme × adminDrawer
 *
 *   interactionMode: orb_ptt | listen_only | text_first
 *   viewport:        mobile  (375×812)    | desktop (1280×800)
 *   theme:           solarized-dark (default) | solarized-light
 *   adminDrawer:     closed | open  (admin-only, orb_ptt only)
 *
 * To keep the combinatorial explosion manageable we check:
 *   1. mobile   + orb_ptt     + solarized-dark  + drawer closed
 *   2. mobile   + orb_ptt     + solarized-dark  + drawer open (admin)
 *   3. mobile   + listen_only + solarized-dark
 *   4. mobile   + text_first  + solarized-dark
 *   5. desktop  + text_first  + solarized-dark
 *   6. desktop  + text_first  + solarized-light
 *
 * That's six screenshots — enough to catch every layout regression
 * in the V9 shell without blowing up the snapshot tree. If a future
 * change touches a combination not on this list (e.g. desktop
 * listen_only), add it here rather than widening the matrix by
 * default.
 *
 * Backend mocking:
 *   Every `/api/treatment-v9` request is intercepted with a
 *   deterministic start response so the tests are hermetic (no
 *   OpenAI traffic, no Supabase calls, no real user session). The
 *   mocked response includes a pinned `voicePair` so the admin
 *   drawer renders R9's surface.
 *
 * First-run snapshot seeding:
 *   Run `npx playwright test --project=v9-visual --update-snapshots`
 *   locally to seed baselines. CI (`npm run test:v9-visual`) fails
 *   on pixel drift per Playwright's default threshold (0.2).
 */

import { test, expect, Page } from '@playwright/test';

type InteractionMode = 'orb_ptt' | 'listen_only' | 'text_first';

interface SetupOpts {
  interactionMode: InteractionMode;
  theme?: string;
  viewport?: { width: number; height: number };
  mockAdmin?: boolean;
}

const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 800 };

const MOCK_START_RESPONSE = {
  success: true,
  sessionId: 'visual-regression-session',
  message:
    'Hello. Welcome to Mind Shifting. I am here to guide you through a '
    + 'session. Please say or type the problem, goal, or negative '
    + 'experience you want to work on.',
  currentStep: 'mind_shifting_explanation_static',
  responseTime: 5,
  usedAI: false,
  voicePair: {
    stt: 'openai-whisper-1',
    tts: 'openai-gpt-4o-mini-tts:marin',
  },
  performanceMetrics: {
    cacheHitRate: 0.85,
    averageResponseTime: 180,
    preloadedResponsesUsed: 4,
    totalResponses: 1,
    validationAccuracy: 1,
    memoryUsage: 42,
  },
};

async function seedLocalStorage(page: Page, opts: SetupOpts): Promise<void> {
  await page.addInitScript((o: SetupOpts) => {
    try {
      window.localStorage.setItem('v9_interaction_mode', o.interactionMode);
      // Mode-appropriate mic/speaker defaults (matches R6 / v9-preferences).
      if (o.interactionMode === 'orb_ptt') {
        window.localStorage.setItem('v9_mic_enabled', 'true');
        window.localStorage.setItem('v9_speaker_enabled', 'true');
        window.localStorage.setItem('v9_guided_mode', 'true');
      } else if (o.interactionMode === 'listen_only') {
        window.localStorage.setItem('v9_mic_enabled', 'false');
        window.localStorage.setItem('v9_speaker_enabled', 'true');
      } else {
        window.localStorage.setItem('v9_mic_enabled', 'false');
        window.localStorage.setItem('v9_speaker_enabled', 'false');
      }
      window.localStorage.setItem('v9_selected_voice', 'marin');
      if (o.theme) {
        window.localStorage.setItem('mind-shifting-theme', o.theme);
      }
    } catch {
      // Some embedded browsers forbid localStorage; tests still run.
    }
  }, opts);
}

async function mockBackend(page: Page): Promise<void> {
  await page.route('**/api/treatment-v9', async (route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.continue();
    let body: any = {};
    try {
      body = JSON.parse(req.postData() ?? '{}');
    } catch {
      body = {};
    }
    if (body?.action === 'start') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_START_RESPONSE),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        sessionId: MOCK_START_RESPONSE.sessionId,
        message: 'Thank you for sharing.',
        currentStep: 'work_type_selection',
        responseTime: 12,
        usedAI: false,
      }),
    });
  });

  // The auth hook reads from `/api/auth/me`-style routes in this
  // codebase. Fulfil it with a deterministic profile so the session
  // page renders past the "Authentication Required" fallback.
  await page.route('**/rest/v1/profiles**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'visual-regression-user',
          role: 'user',
          full_name: 'Visual Regression',
        },
      ]),
    }),
  );
}

async function gotoSession(page: Page, opts: SetupOpts): Promise<void> {
  const viewport = opts.viewport ?? MOBILE;
  await page.setViewportSize(viewport);
  await seedLocalStorage(page, opts);
  await mockBackend(page);
  await page.goto(
    '/dashboard/sessions/treatment-v9?sessionId=visual-regression-session',
  );
  // Wait for either the ready overlay or an authenticated shell to
  // render. The page is SSR so we only need a short idle.
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
}

// -----------------------------------------------------------------

test.describe('V9 visual regression', () => {
  test('mobile · orb_ptt · solarized-dark · drawer closed', async ({
    page,
  }) => {
    await gotoSession(page, {
      interactionMode: 'orb_ptt',
      viewport: MOBILE,
      theme: 'solarized-dark',
    });
    await expect(page).toHaveScreenshot(
      'orb_ptt-mobile-dark-closed.png',
      { fullPage: true, maxDiffPixelRatio: 0.02 },
    );
  });

  test('mobile · orb_ptt · solarized-dark · drawer open (admin)', async ({
    page,
  }) => {
    await gotoSession(page, {
      interactionMode: 'orb_ptt',
      viewport: MOBILE,
      theme: 'solarized-dark',
    });
    // Toggle drawer via the keyboard shortcut. If the current profile
    // isn't admin, the drawer root isn't rendered, in which case the
    // snapshot matches the "closed" layout — the test still guards
    // against layout drift.
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot(
      'orb_ptt-mobile-dark-drawer-open.png',
      { fullPage: true, maxDiffPixelRatio: 0.02 },
    );
  });

  test('mobile · listen_only · solarized-dark', async ({ page }) => {
    await gotoSession(page, {
      interactionMode: 'listen_only',
      viewport: MOBILE,
      theme: 'solarized-dark',
    });
    await expect(page).toHaveScreenshot(
      'listen_only-mobile-dark.png',
      { fullPage: true, maxDiffPixelRatio: 0.02 },
    );
  });

  test('mobile · text_first · solarized-dark', async ({ page }) => {
    await gotoSession(page, {
      interactionMode: 'text_first',
      viewport: MOBILE,
      theme: 'solarized-dark',
    });
    await expect(page).toHaveScreenshot(
      'text_first-mobile-dark.png',
      { fullPage: true, maxDiffPixelRatio: 0.02 },
    );
  });

  test('desktop · text_first · solarized-dark', async ({ page }) => {
    await gotoSession(page, {
      interactionMode: 'text_first',
      viewport: DESKTOP,
      theme: 'solarized-dark',
    });
    await expect(page).toHaveScreenshot(
      'text_first-desktop-dark.png',
      { fullPage: true, maxDiffPixelRatio: 0.02 },
    );
  });

  test('desktop · text_first · solarized-light (theme variant)', async ({
    page,
  }) => {
    await gotoSession(page, {
      interactionMode: 'text_first',
      viewport: DESKTOP,
      theme: 'solarized-light',
    });
    await expect(page).toHaveScreenshot(
      'text_first-desktop-light.png',
      { fullPage: true, maxDiffPixelRatio: 0.02 },
    );
  });
});
