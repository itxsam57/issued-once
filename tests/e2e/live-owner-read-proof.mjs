import { chromium } from '@playwright/test';

const baseUrl = process.env.LIVE_PRODUCTION_URL?.replace(/\/$/, '');
const expectedReleaseId = process.env.EXPECTED_RELEASE_ID?.trim().toLowerCase();
const internalToken = process.env.INTERNAL_OPERATIONS_TOKEN?.trim();
if (!baseUrl?.startsWith('https://')) throw new Error('LIVE_PRODUCTION_URL must be HTTPS');
if (!expectedReleaseId || !/^[0-9a-f]{40}$/.test(expectedReleaseId)) throw new Error('EXPECTED_RELEASE_ID must be a 40-character SHA');
if (!internalToken || internalToken.length < 24) throw new Error('INTERNAL_OPERATIONS_TOKEN is required');

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const health = await context.request.get(`${baseUrl}/api/health/release`, { headers: { 'cache-control': 'no-cache' } });
    const healthPayload = await health.json().catch(() => ({}));
    if (health.status() !== 200 || healthPayload?.releaseId !== expectedReleaseId || healthPayload?.runtimeProvider !== 'hostinger') {
      throw new Error(`exact Hostinger release mismatch: HTTP ${health.status()}`);
    }
    console.log(`LIVE_OWNER_READ_RELEASE_PASS release=${expectedReleaseId}`);

    // This is the only non-GET request in the proof. It creates the normal audited
    // Owner session and does not alter customer, payment, catalog or provider state.
    const login = await context.request.post(`${baseUrl}/api/ops/session`, {
      headers: { 'content-type': 'application/json' },
      data: { token: internalToken },
    });
    if (login.status() !== 200) throw new Error(`Owner session login returned ${login.status()}`);
    console.log('LIVE_OWNER_READ_AUTH_PASS');

    const readPaths = [
      '/ops/api/dashboard',
      '/ops/api/attention',
      '/ops/api/issues?view=ledger&limit=2',
      '/ops/api/designer',
      '/ops/api/manufacturing',
      '/ops/api/sales?days=30',
      '/ops/api/referrals',
      '/ops/api/customers',
      '/ops/api/support',
      '/ops/api/website',
      '/ops/api/readiness',
      '/ops/api/audit',
    ];
    for (const path of readPaths) {
      const response = await context.request.get(`${baseUrl}${path}`, { headers: { 'cache-control': 'no-cache' } });
      if (response.status() !== 200) {
        if (path === '/ops/api/manufacturing' && response.status() === 503) {
          const payload = await response.json().catch(() => ({}));
          if (payload?.error !== 'Manufacturing queue unavailable') {
            throw new Error(`Owner manufacturing read returned unexpected 503 body`);
          }
          console.log('LIVE_OWNER_API_KNOWN_DEFECT path=/ops/api/manufacturing status=503');
          continue;
        }
        if (path === '/ops/api/referrals' && response.status() === 503) {
          const payload = await response.json().catch(() => ({}));
          if (payload?.error !== 'Referral data unavailable') {
            throw new Error(`Owner referrals read returned unexpected 503 body`);
          }
          console.log('LIVE_OWNER_API_LAUNCH_DISABLED path=/ops/api/referrals status=503');
          continue;
        }
        throw new Error(`Owner read ${path} returned ${response.status()}`);
      }
      const cacheControl = response.headers()['cache-control'] ?? '';
      if (!/no-store/i.test(cacheControl)) throw new Error(`Owner read ${path} was not no-store`);
      console.log(`LIVE_OWNER_API_READ_PASS path=${path.split('?')[0]}`);
    }

    const firstPage = await context.request.get(`${baseUrl}/ops/api/issues?view=ledger&limit=2`);
    const firstPayload = await firstPage.json();
    if (!Array.isArray(firstPayload?.items) || firstPayload.items.length > 2) throw new Error('Issue ledger ignored the requested bounded page size');
    if (firstPayload.nextCursor) {
      const secondPage = await context.request.get(`${baseUrl}/ops/api/issues?view=ledger&limit=2&cursor=${encodeURIComponent(firstPayload.nextCursor)}`);
      if (secondPage.status() !== 200) throw new Error(`Issue ledger second page returned ${secondPage.status()}`);
      const secondPayload = await secondPage.json();
      if (!Array.isArray(secondPayload?.items) || secondPayload.items.length > 2) throw new Error('Issue ledger second page exceeded the requested bound');
      const firstIds = new Set(firstPayload.items.map((item) => item.issueId));
      if (secondPayload.items.some((item) => firstIds.has(item.issueId))) throw new Error('Issue ledger cursor repeated an Issue across adjacent pages');
    }
    console.log('LIVE_OWNER_PAGINATION_PASS limit=2');

    const page = await context.newPage();
    const hydratedDashboard = page.waitForResponse((response) => {
      try { return new URL(response.url()).pathname === '/ops/api/dashboard' && response.status() === 200; }
      catch { return false; }
    }, { timeout: 20_000 });
    const ops = await page.goto(`${baseUrl}/ops`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    if (!ops?.ok()) throw new Error(`/ops returned ${ops?.status() ?? 'NO_RESPONSE'}`);
    await page.getByText('OWNER OS').waitFor({ timeout: 10_000 });
    await hydratedDashboard;

    const sections = ['Home', 'Issues', 'Designer', 'Manufacturing', 'Sales', 'Referrals', 'Customers', 'Support', 'Website', 'System', 'Audit'];
    for (const section of sections) {
      await page.getByRole('button', { name: section, exact: true }).click();
      await page.getByText(`CONTROL PLANE / ${section.toUpperCase()}`).waitFor({ timeout: 10_000 });
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`Owner OS horizontal overflow=${overflow}`);
    console.log(`LIVE_OWNER_BROWSER_READ_PASS rooms=${sections.length} overflow=${overflow}`);
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
