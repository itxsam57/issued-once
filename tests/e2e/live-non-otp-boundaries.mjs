import { chromium } from '@playwright/test';

const baseUrl = process.env.LIVE_PRODUCTION_URL?.replace(/\/$/, '');
if (!baseUrl) throw new Error('LIVE_PRODUCTION_URL is required');

const FORBIDDEN_MARKERS = [
  'DATABASE_URL',
  'QUIZ_ENCRYPTION_KEY',
  'IDENTITY_HMAC_KEY',
  'RESEND_API_KEY',
  'CRON_SECRET',
  'ARTWORK_SIGNING_KEY',
  'SAFE_PAY_SECRET',
  'PRINTFUL_TOKEN',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoSecretMarkers(text, label) {
  for (const marker of FORBIDDEN_MARKERS) {
    assert(!text.includes(marker), `${label} exposed forbidden marker ${marker}`);
  }
}

async function fetchText(context, path, init) {
  const response = await context.request.fetch(`${baseUrl}${path}`, init);
  const text = await response.text().catch(() => '');
  assertNoSecretMarkers(text, path);
  return { status: response.status(), text };
}

async function requireStatus(context, path, expected, init) {
  const result = await fetchText(context, path, init);
  assert(expected.includes(result.status), `${path} returned ${result.status}; expected ${expected.join('/')}`);
  console.log(`LIVE_BOUNDARY_PASS path=${path} status=${result.status}`);
  return result;
}

async function requireFailClosed(context, path, init) {
  const result = await fetchText(context, path, init);
  assert(result.status >= 400 && result.status < 600, `${path} unexpectedly returned ${result.status}`);
  console.log(`LIVE_FAIL_CLOSED_PASS path=${path} status=${result.status}`);
  return result;
}

const browser = await chromium.launch();
try {
  const anonymous = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    for (const path of ['/', '/terms', '/returns', '/store-info', '/contact']) {
      await requireStatus(anonymous, path, [200]);
    }

    const health = await requireStatus(anonymous, '/api/health/release', [200]);
    const healthPayload = JSON.parse(health.text);
    assert(healthPayload?.ok === true, 'release health payload is not ok');
    assert(healthPayload?.runtimeProvider === 'hostinger', 'release health runtime provider is not hostinger');

    const issueStatus = await requireStatus(anonymous, '/api/issue/status', [200]);
    const issuePayload = JSON.parse(issueStatus.text);
    assert(issuePayload?.found === false, 'anonymous issue status unexpectedly found an issue');

    await requireStatus(anonymous, '/api/artwork/not-a-valid-signed-token', [401]);
    await requireStatus(anonymous, '/ops/api/dashboard', [401]);

    for (const path of [
      '/api/internal/jobs/drain',
      '/api/internal/design/approve',
      '/api/internal/manufacturing/create-draft',
      '/api/internal/manufacturing/confirm',
      '/api/internal/quiz-encryption/rotate',
    ]) {
      await requireFailClosed(anonymous, path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        data: {},
      });
    }

    for (const path of [
      '/api/webhooks/safepay',
      '/api/webhooks/printful',
      '/api/webhooks/fourthwall',
    ]) {
      await requireFailClosed(anonymous, path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        data: {},
      });
    }

    await requireStatus(anonymous, '/api/support', [400], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: {},
    });
  } finally {
    await anonymous.close();
  }

  const customer = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const page = await customer.newPage();
    const begin = await page.goto(`${baseUrl}/begin`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    assert(begin?.ok(), `/begin returned ${begin?.status() ?? 'NO_RESPONSE'}`);
    await page.getByText('01 / 07').waitFor({ timeout: 15_000 });

    await requireStatus(customer, '/api/shipping', [409], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: {
        recipientName: 'Live Boundary Audit',
        line1: '1 Test Street',
        line2: '',
        city: 'Test City',
        region: 'Test Region',
        postalCode: '00000',
        countryCode: 'US',
        phone: '+10000000000',
      },
    });

    await requireStatus(customer, '/api/payments/create', [409], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: { quoteId: 'live-boundary-audit-no-quote' },
    });

    await requireFailClosed(customer, '/api/referrals/apply', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: { quoteId: 'live-boundary-audit-no-quote', explicitCode: 'AUDIT' },
    });

    console.log('LIVE_NON_OTP_CUSTOMER_GATES_PASS');
  } finally {
    await customer.close();
  }

  console.log('LIVE_NON_OTP_BOUNDARY_AUDIT_PASS');
} finally {
  await browser.close();
}
