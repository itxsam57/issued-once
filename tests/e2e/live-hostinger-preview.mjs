import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.PREVIEW_URL?.replace(/\/$/, '');
if (!baseUrl) throw new Error('PREVIEW_URL is required');

const profiles = [
  { name: 'desktop', context: { viewport: { width: 1440, height: 1000 } } },
  { name: 'mobile', context: { ...devices['Pixel 7'] } },
];

async function runSmoke(browser, profile) {
  const context = await browser.newContext(profile.context);
  try {
    const health = await context.request.get(`${baseUrl}/api/health/release`);
    if (!health.ok()) throw new Error(`Hostinger release health returned HTTP ${health.status()}`);
    const healthPayload = await health.json();
    if (healthPayload?.ok !== true || healthPayload?.runtimeProvider !== 'hostinger') {
      throw new Error(`Hostinger release health mismatch: ${JSON.stringify(healthPayload)}`);
    }

    const page = await context.newPage();
    const response = await page.goto(`${baseUrl}/begin`, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    if (!response?.ok()) throw new Error(`/begin returned HTTP ${response?.status() ?? 'NO_RESPONSE'}`);

    await page.getByText('01 / 07').waitFor({ timeout: 15_000 });
    if ((await page.getByText('OWNER PREVIEW / NO PAYMENT').count()) > 0) {
      throw new Error('Hostinger live smoke unexpectedly rendered the Vercel owner-preview marker');
    }

    await mkdir('artifacts/visual', { recursive: true });
    await page.screenshot({
      path: `artifacts/visual/live-hostinger-${profile.name}.png`,
      fullPage: true,
    });

    console.log(`LIVE_HOSTINGER_PREVIEW_PASS profile=${profile.name}`);
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();
try {
  for (const profile of profiles) await runSmoke(browser, profile);
} finally {
  await browser.close();
}
