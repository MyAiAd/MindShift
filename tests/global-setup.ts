import { FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const STORAGE_STATE = path.join(__dirname, '.auth/storage-state.json');

/**
 * Global setup: authenticate against Supabase directly via REST API.
 * No browser launch needed -- works on headless servers without system libs.
 *
 * Credentials come from environment variables:
 *   TEST_USER_EMAIL    - Supabase account email
 *   TEST_USER_PASSWORD - Supabase account password
 *
 * Supabase config is read from .env.local (or can be overridden):
 *   SUPABASE_URL       - override NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_ANON_KEY  - override NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
async function globalSetup(config: FullConfig) {
  // Hermetic projects (like `v9-visual`, R14) don't need a real
  // Supabase session — they mock `/api/treatment-v9` and the
  // profiles endpoint directly inside the spec. Opt them out so CI
  // doesn't fail on missing TEST_USER_EMAIL / TEST_USER_PASSWORD.
  if (process.env.SKIP_AUTH_SETUP === '1') {
    console.log('  SKIP_AUTH_SETUP=1 — skipping Supabase auth for this run.');
    // Still ensure the storage-state file exists so Playwright's
    // `use.storageState` can load it. An empty state is fine because
    // the per-project `use` block in playwright.config.ts overrides
    // it with `{ cookies: [], origins: [] }` for v9-visual.
    if (!fs.existsSync(STORAGE_STATE)) {
      fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
      fs.writeFileSync(
        STORAGE_STATE,
        JSON.stringify({ cookies: [], origins: [] }),
      );
    }
    return;
  }

  // Reuse existing session if it's still fresh (< 50 min old)
  if (fs.existsSync(STORAGE_STATE)) {
    const stats = fs.statSync(STORAGE_STATE);
    const ageMinutes = (Date.now() - stats.mtimeMs) / 60_000;
    if (ageMinutes < 50) {
      console.log(`  Reusing auth session (${Math.round(ageMinutes)}m old)`);
      return;
    }
  }

  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    console.error(
      '\n  Missing TEST_USER_EMAIL and/or TEST_USER_PASSWORD.\n' +
      '  Usage:\n\n' +
      '    TEST_USER_EMAIL=you@example.com TEST_USER_PASSWORD=secret npm test\n'
    );
    process.exit(1);
  }

  // Load Supabase config from .env.local
  const supabaseUrl = process.env.SUPABASE_URL || readEnvValue('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || readEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('  Could not find NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
    process.exit(1);
  }

  console.log(`  Authenticating ${email} via Supabase API...`);

  // Sign in via Supabase GoTrue REST API
  const authResp = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ email, password }),
    }
  );

  if (!authResp.ok) {
    const errBody = await authResp.text();
    console.error(`  Auth failed (${authResp.status}): ${errBody}`);
    process.exit(1);
  }

  const authData = await authResp.json();
  const { access_token, refresh_token, user } = authData;

  if (!access_token || !user?.id) {
    console.error('  Auth response missing access_token or user.id');
    process.exit(1);
  }

  console.log(`  Authenticated as user ${user.id}`);

  const baseURL = config.projects[0]?.use?.baseURL
    || process.env.TEST_BASE_URL
    || 'https://mind-shift.click';

  const domain = new URL(baseURL).hostname;
  const supabaseDomain = new URL(supabaseUrl).hostname;
  const projectRef = supabaseDomain.split('.')[0]; // e.g. "kdxwfaynzemmdonkmttf"

  // Build the storage state with auth cookies + localStorage
  // Supabase SSR expects cookies named sb-<ref>-auth-token.0, .1, etc.
  // The value is a base64-encoded JSON array: [access_token, refresh_token, ...]
  const tokenPayload = JSON.stringify({
    access_token,
    refresh_token,
    token_type: 'bearer',
    expires_in: authData.expires_in || 3600,
    expires_at: authData.expires_at || Math.floor(Date.now() / 1000) + 3600,
    user,
  });

  // Supabase SSR chunked cookie format
  const cookieName = `sb-${projectRef}-auth-token`;
  const encoded = Buffer.from(tokenPayload).toString('base64');

  // Split into chunks of 3180 chars (Supabase SSR default)
  const CHUNK_SIZE = 3180;
  const chunks: string[] = [];
  for (let i = 0; i < encoded.length; i += CHUNK_SIZE) {
    chunks.push(encoded.slice(i, i + CHUNK_SIZE));
  }

  const cookies = chunks.map((chunk, i) => ({
    name: chunks.length === 1 ? cookieName : `${cookieName}.${i}`,
    value: chunk,
    domain,
    path: '/',
    httpOnly: true,
    secure: baseURL.startsWith('https'),
    sameSite: 'Lax' as const,
    expires: Math.floor(Date.now() / 1000) + 3600,
  }));

  const storageState = {
    cookies,
    origins: [
      {
        origin: baseURL,
        localStorage: [
          {
            name: `sb-${projectRef}-auth-token`,
            value: tokenPayload,
          },
        ],
      },
    ],
  };

  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  fs.writeFileSync(STORAGE_STATE, JSON.stringify(storageState, null, 2));

  console.log(`  Auth session saved (${cookies.length} cookie chunk(s))`);
}

/** Read a value from .env.local */
function readEnvValue(key: string): string | undefined {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return undefined;

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eqIndex = trimmed.indexOf('=');
    const k = trimmed.slice(0, eqIndex).trim();
    if (k === key) {
      return trimmed.slice(eqIndex + 1).trim();
    }
  }
  return undefined;
}

export default globalSetup;
