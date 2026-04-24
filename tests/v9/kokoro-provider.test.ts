import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const DEFAULT_URL = 'https://api.mind-shift.click/tts';

type FetchCall = {
  url: string;
  init: RequestInit;
};

let originalFetch: typeof fetch | undefined;
let originalEnv: NodeJS.ProcessEnv;
let fetchCalls: FetchCall[];

function installFetchMock() {
  originalFetch = globalThis.fetch;
  fetchCalls = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init: init ?? {} });
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      text: async () => '',
    } as Response;
  }) as typeof fetch;
}

async function importProvider() {
  return import(`../../lib/voice/tts-providers/kokoro.ts?test=${Date.now()}-${Math.random()}`);
}

beforeEach(() => {
  originalEnv = { ...process.env };
  delete process.env.KOKORO_API_URL;
  delete process.env.KOKORO_API_KEY;
  delete process.env.KOKORO_VOICE_ID;
  installFetchMock();
});

afterEach(() => {
  process.env = originalEnv;
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
});

test('Kokoro provider is available without env vars', async () => {
  const { KokoroTtsProvider, KOKORO_BASE_URL } = await importProvider();
  const provider = new KokoroTtsProvider();

  assert.equal(KOKORO_BASE_URL, DEFAULT_URL);
  assert.equal(provider.isAvailable(), true);
});

test('Kokoro provider posts to the hardcoded Hetzner endpoint with V5 body shape', async () => {
  const { KokoroTtsProvider } = await importProvider();
  const provider = new KokoroTtsProvider();

  await provider.synthesize({ text: 'hello', voice: 'heart', format: 'mp3' });

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, DEFAULT_URL);
  assert.equal(fetchCalls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(fetchCalls[0].init.body as string), {
    text: 'hello',
    voice: 'af_heart',
    format: 'mp3',
  });
  assert.equal(JSON.parse(fetchCalls[0].init.body as string).model, undefined);
  assert.equal(JSON.parse(fetchCalls[0].init.body as string).response_format, undefined);
});

test('Kokoro provider honors KOKORO_API_URL override', async () => {
  process.env.KOKORO_API_URL = 'http://localhost:8080/tts';
  const { KokoroTtsProvider, getKokoroBaseUrl } = await importProvider();
  const provider = new KokoroTtsProvider();

  await provider.synthesize({ text: 'override', voice: 'michael', format: 'wav' });

  assert.equal(getKokoroBaseUrl(), 'http://localhost:8080/tts');
  assert.equal(fetchCalls[0].url, 'http://localhost:8080/tts');
  assert.deepEqual(JSON.parse(fetchCalls[0].init.body as string), {
    text: 'override',
    voice: 'am_michael',
    format: 'wav',
  });
});

test('Kokoro provider sends optional X-API-Key header only when configured', async () => {
  const withoutKey = await importProvider();
  await new withoutKey.KokoroTtsProvider().synthesize({ text: 'no key' });

  const headersWithoutKey = fetchCalls[0].init.headers as Record<string, string>;
  assert.equal(headersWithoutKey['X-API-Key'], undefined);

  process.env.KOKORO_API_KEY = 'xyz';
  const withKey = await importProvider();
  await new withKey.KokoroTtsProvider().synthesize({ text: 'with key' });

  const headersWithKey = fetchCalls[1].init.headers as Record<string, string>;
  assert.equal(headersWithKey['X-API-Key'], 'xyz');
});

