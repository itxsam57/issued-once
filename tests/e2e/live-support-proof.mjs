import { chromium } from '@playwright/test';

const baseUrl = process.env.LIVE_PRODUCTION_URL?.replace(/\/$/, '');
if (!baseUrl) throw new Error('LIVE_PRODUCTION_URL is required');

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const page = await context.newPage();
    const begin = await page.goto(`${baseUrl}/begin`, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    if (!begin?.ok()) throw new Error(`/begin returned ${begin?.status() ?? 'NO_RESPONSE'}`);
    await page.getByText('01 / 07').waitFor({ timeout: 15_000 });

    const statusResponse = await context.request.get(`${baseUrl}/api/issue/status`);
    if (statusResponse.status() !== 200) {
      throw new Error(`/api/issue/status returned ${statusResponse.status()}`);
    }
    const statusPayload = await statusResponse.json();
    if (statusPayload?.found !== true || typeof statusPayload?.issueCode !== 'string') {
      throw new Error('live Issue session was not established');
    }

    const supportResponse = await context.request.post(`${baseUrl}/api/support`, {
      headers: { 'content-type': 'application/json' },
      data: {
        message: 'Automated Hostinger live support verification. No customer data.',
      },
    });
    if (supportResponse.status() !== 200) {
      throw new Error(`/api/support returned ${supportResponse.status()}`);
    }
    const supportPayload = await supportResponse.json();
    if (supportPayload?.received !== true || supportPayload?.issueCode !== statusPayload.issueCode) {
      throw new Error('support response was not attached to the current Issue');
    }

    console.log('LIVE_SUPPORT_SESSION_AND_PERSISTENCE_REQUEST_PASS');
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
