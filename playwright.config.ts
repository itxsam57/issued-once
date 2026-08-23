import { defineConfig, devices } from '@playwright/test';

const previewEncryptionKeyV1 = Buffer.alloc(32, 7).toString('base64');
const previewEncryptionKeyV2 = Buffer.alloc(32, 8).toString('base64');
const testOperationsToken = 'issued-once-playwright-owner-key-v1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'pnpm exec next dev --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      ENABLE_VISUAL_PREVIEW: '1',
      QUIZ_ENCRYPTION_KEY_V1: previewEncryptionKeyV1,
      QUIZ_ENCRYPTION_KEY_V2: previewEncryptionKeyV2,
      INTERNAL_OPERATIONS_TOKEN: testOperationsToken,
    },
  },
});
