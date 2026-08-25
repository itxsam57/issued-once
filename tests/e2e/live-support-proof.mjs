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
    if (statusPayload?.found !== false) {
      throw new Error('pre-order experience unexpectedly exposed a paid Issue');
    }

    const supportResponse = await context.request.post(`${baseUrl}/api/support`, {
      headers: { 'content-type': 'application/json' },
      data: {
        message: 'Automated Hostinger pre-order support boundary verification. No customer data.',
      },
    });
    if (supportResponse.status() !== 409) {
      throw new Error(`/api/support returned ${supportResponse.status()}; expected 409 before a paid Issue exists`);
    }

    console.log('LIVE_PREORDER_SUPPORT_FAIL_CLOSED_PASS');
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
