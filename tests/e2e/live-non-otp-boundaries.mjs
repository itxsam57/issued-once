import { chromium } from '@playwright/test';

const baseUrl = process.env.LIVE_PRODUCTION_URL?.replace(/\/$/, '');
if (!baseUrl) throw new Error('LIVE_PRODUCTION_URL is required');

const failures = [];
const FORBIDDEN_MARKERS = [
  'DATABASE_URL',
  'QUIZ_ENCRYPTION_KEY',
  'IDENTITY_HMAC_KEY',
  'RESEND_API_KEY',
  'CRON_SECRET',
  'ARTWORK_SIGNING_KEY',
  'SAFEPAY_API_SECRET',
  'SAFEPAY_V1_SECRET',
  'PRINTFUL_API_TOKEN',
  'OPENAI_API_KEY',
  'INTERNAL_OPERATIONS_TOKEN',
];
const REQUIRED_SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

function check(condition, message) {
  if (!condition) failures.push(message);
}

function assertNoSecretMarkers(text, label) {
  for (const marker of FORBIDDEN_MARKERS) {
    check(!text.includes(marker), `${label} exposed forbidden configuration marker ${marker}`);
  }
}

function assertBareHomeSecurityHeaders(result) {
  for (const [name, expected] of Object.entries(REQUIRED_SECURITY_HEADERS)) {
    check(result.headers[name] === expected, `bare / ${name} mismatch`);
  }

  check(!('x-powered-by' in result.headers), 'bare / exposes x-powered-by');

  const cacheControl = result.headers['cache-control'] ?? '';
  check(cacheControl.includes('no-store'), 'bare / cache-control is missing no-store');
  check(!/s-maxage\s*=/i.test(cacheControl), 'bare / cache-control contains s-maxage');
}

async function fetchText(context, path, init) {
  const response = await context.request.fetch(`${baseUrl}${path}`, init);
  const text = await response.text().catch(() => '');
  const headers = Object.fromEntries(
    Object.entries(response.headers()).map(([name, value]) => [name.toLowerCase(), value]),
  );
  assertNoSecretMarkers(text, path);
  return { status: response.status(), text, headers };
}

async function checkStatus(context, path, expected, init) {
  const result = await fetchText(context, path, init);
  if (expected.includes(result.status)) {
    console.log(`LIVE_BOUNDARY_PASS path=${path} status=${result.status}`);
  } else {
    failures.push(`${path} returned ${result.status}; expected ${expected.join('/')}`);
    console.log(`LIVE_BOUNDARY_MISMATCH path=${path} status=${result.status} expected=${expected.join('/')}`);
  }
  return result;
}

const browser = await chromium.launch();
try {
  const anonymous = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    for (const path of ['/', '/terms', '/returns']) {
      const publicPage = await checkStatus(anonymous, path, [200]);
      if (path === '/') assertBareHomeSecurityHeaders(publicPage);
    }

    const storeInfo = await checkStatus(anonymous, '/store-info', [200]);
    check(
      !storeInfo.text.includes('Public merchant disclosure is not fully configured'),
      'public merchant disclosure is not fully configured',
    );
    const contactPage = await checkStatus(anonymous, '/contact', [200]);
    check(
      !contactPage.text.includes('The public support address is not configured yet'),
      'public support address is not configured',
    );

    const health = await checkStatus(anonymous, '/api/health/release', [200]);
    try {
      const healthPayload = JSON.parse(health.text);
      check(healthPayload?.ok === true, 'release health payload is not ok');
      check(healthPayload?.runtimeProvider === 'hostinger', 'release health runtime provider is not hostinger');
    } catch {
      failures.push('release health payload is not valid JSON');
    }

    const issueStatus = await checkStatus(anonymous, '/api/issue/status', [200]);
    try {
      const issuePayload = JSON.parse(issueStatus.text);
      check(issuePayload?.found === false, 'anonymous issue status unexpectedly found an issue');
    } catch {
      failures.push('anonymous issue status payload is not valid JSON');
    }

    await checkStatus(anonymous, '/api/artwork/not-a-valid-signed-token', [401]);
    await checkStatus(anonymous, '/ops/api/dashboard', [401]);
    await checkStatus(anonymous, '/api/ops/session', [401], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: { token: 'live-boundary-audit-invalid-owner-token' },
    });

    await checkStatus(anonymous, '/api/internal/jobs/drain', [401], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: {},
    });

    for (const path of [
      '/api/internal/design/approve',
      '/api/internal/manufacturing/create-draft',
      '/api/internal/manufacturing/confirm',
      '/api/internal/quiz-encryption/rotate',
    ]) {
      await checkStatus(anonymous, path, [410], {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        data: {},
      });
    }

    await checkStatus(anonymous, '/api/webhooks/safepay', [401], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: {},
    });
    await checkStatus(anonymous, '/api/webhooks/printful', [401], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: {},
    });
    await checkStatus(anonymous, '/api/webhooks/fourthwall', [410], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: {},
    });

    await checkStatus(anonymous, '/api/support', [400], {
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
    check(Boolean(begin?.ok()), `/begin returned ${begin?.status() ?? 'NO_RESPONSE'}`);
    await page.getByText('01 / 07').waitFor({ timeout: 15_000 });

    await checkStatus(customer, '/api/shipping', [409], {
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

    await checkStatus(customer, '/api/payments/create', [409], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: { quoteId: 'live-boundary-audit-no-quote' },
    });

    await checkStatus(customer, '/api/referrals/apply', [503], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: { quoteId: 'live-boundary-audit-no-quote', explicitCode: 'AUDIT' },
    });

    console.log('LIVE_NON_OTP_CUSTOMER_GATES_COMPLETE');
  } finally {
    await customer.close();
  }

  if (failures.length > 0) {
    for (const failure of failures) console.log(`LIVE_BOUNDARY_FINDING ${failure}`);
    throw new Error(`Live non-OTP boundary audit found ${failures.length} mismatch(es)`);
  }

  console.log('LIVE_NON_OTP_BOUNDARY_AUDIT_PASS');
} finally {
  await browser.close();
}
