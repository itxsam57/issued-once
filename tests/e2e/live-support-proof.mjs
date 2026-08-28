import { chromium } from '@playwright/test';

const baseUrl = process.env.LIVE_PRODUCTION_URL?.replace(/\/$/, '');
if (!baseUrl) throw new Error('LIVE_PRODUCTION_URL is required');
const expectedReleaseId = process.env.EXPECTED_RELEASE_ID?.trim();
if (!expectedReleaseId) throw new Error('EXPECTED_RELEASE_ID is required');
const internalToken = process.env.INTERNAL_OPERATIONS_TOKEN?.trim();
if (!internalToken) throw new Error('INTERNAL_OPERATIONS_TOKEN is required');

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const releaseResponse = await context.request.get(`${baseUrl}/api/health/release`);
    if (!releaseResponse.ok()) throw new Error(`/api/health/release returned ${releaseResponse.status()}`);
    const releasePayload = await releaseResponse.json();
    if (releasePayload?.releaseId !== expectedReleaseId) {
      throw new Error(`live support proof release mismatch; observed ${String(releasePayload?.releaseId)}`);
    }

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

    const canaryResponse = await context.request.post(`${baseUrl}/api/internal/support/canary`, {
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${internalToken}`,
      },
      data: { confirmation: 'SEND_SUPPORT_CANARY' },
    });
    if (canaryResponse.status() !== 200) {
      throw new Error(`support canary returned ${canaryResponse.status()}`);
    }
    const canaryPayload = await canaryResponse.json();
    if (canaryPayload?.ok !== true) throw new Error('support canary did not confirm provider acceptance');
    console.log('LIVE_SUPPORT_CANARY_DISPATCH_ACCEPTED');
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
