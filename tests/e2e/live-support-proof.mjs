import { chromium } from '@playwright/test';

const baseUrl = process.env.LIVE_PRODUCTION_URL?.replace(/\/$/, '');
if (!baseUrl) throw new Error('LIVE_PRODUCTION_URL is required');

const expectedReleaseId = process.env.EXPECTED_RELEASE_ID?.trim().toLowerCase();
if (!expectedReleaseId || !/^[0-9a-f]{40}$/.test(expectedReleaseId)) {
  throw new Error('EXPECTED_RELEASE_ID must be a 40-character git SHA');
}

const internalToken = process.env.INTERNAL_OPERATIONS_TOKEN?.trim();
if (!internalToken || internalToken.length < 24) {
  throw new Error('INTERNAL_OPERATIONS_TOKEN is required');
}

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

    const canaryResponse = await context.request.post(`${baseUrl}/api/internal/support-canary`, {
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${internalToken}`,
      },
      data: { releaseId: expectedReleaseId },
    });
    if (canaryResponse.status() !== 200) {
      throw new Error(`/api/internal/support-canary returned ${canaryResponse.status()}; expected 200`);
    }
    const canaryPayload = await canaryResponse.json();
    if (canaryPayload?.sent !== true || canaryPayload?.releaseId !== expectedReleaseId) {
      throw new Error('support delivery canary response did not match the exact deployed release');
    }

    console.log('LIVE_SUPPORT_DELIVERY_CANARY_ACCEPTED');
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
