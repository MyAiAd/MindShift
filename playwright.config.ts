import { defineConfig } from '@playwright/test';
import path from 'path';

const STORAGE_STATE = path.join(__dirname, 'tests/.auth/storage-state.json');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  timeout: 60_000,
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: process.env.TEST_BASE_URL || 'https://mind-shift.click',
    storageState: STORAGE_STATE,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
  projects: [
    {
      name: 'api-parity',
      testMatch: /tests\/api\/.*.spec\.ts/,
    },
    {
      name: 'full-parity',
      testMatch: /tests\/api\/full-parity-report\.spec\.ts/,
    },
    {
      name: 'e2e',
      testMatch: /tests\/e2e\/.*.spec\.ts/,
    },
  ],
});
