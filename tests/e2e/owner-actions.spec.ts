import { expect, test, type Page, type Route } from '@playwright/test';

const OWNER_KEY = 'issued-once-playwright-owner-key-v1';
const ISSUE_ID = '11111111-1111-1111-1111-111111111111';
const ISSUE_CODE = 'IO-ACTION-01';
const SUPPORT_ID = '33333333-3333-3333-3333-333333333333';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function login(page: Page) {
  await page.goto('/ops');
  await expect(page.getByRole('heading', { name: 'Private room.' })).toBeVisible();
  await page.getByLabel('Owner key').fill(OWNER_KEY);
  await page.getByRole('button', { name: 'ENTER' }).click();
  await expect(page.getByText('OWNER OS', { exact: true })).toBeVisible();
}

test('Owner operational rooms execute only explicit safe actions and preserve production gates', async ({ page }) => {
  let attentionReads = 0;
  let recoveryBody: unknown = null;
  let manufacturingAction: { path: string; body: unknown } | null = null;
  const supportActions: Array<{ path: string; body: unknown }> = [];
  let readinessReads = 0;
  const salesWindows: number[] = [];
  const issueQueries: string[] = [];
  const customerQueries: string[] = [];

  await page.route('**/ops/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/ops/api/attention' && method === 'GET') {
      attentionReads += 1;
      return json(route, { items: [{
        kind: 'PAID_WITHOUT_ISSUE', priority: 100, issueId: null, issueCode: null,
        targetId: 'payment-needs-recovery', detail: 'Paid payment needs canonical Issue creation.',
        createdAt: '2026-08-23T08:00:00.000Z',
      }] });
    }
    if (path === '/ops/api/recovery/paid-issue' && method === 'POST') {
      recoveryBody = request.postDataJSON();
      return json(route, { recovered: true, issueId: ISSUE_ID });
    }
    if (path === '/ops/api/dashboard' && method === 'GET') return json(route, {
      sales: { currency: 'USD', today: { orders: 1, grossMinor: 3200 }, sevenDays: { orders: 1, grossMinor: 3200 }, thirtyDays: { orders: 1, grossMinor: 3200 }, lifetime: { orders: 1, grossMinor: 3200 }, refundedMinor: 0, averageOrderMinor: 3200 },
      operations: { paidIssues: 1, designing: 0, review: 1, production: 0, transit: 0, delivered: 0 },
      attention: { paymentExceptions: 0, designFailures: 0, manufacturingFailures: 0, notificationFailures: 1, supportOpen: 1 },
      activity: [{ issueCode: ISSUE_CODE, eventType: 'PAYMENT_RECEIVED', source: 'SAFEPAY', createdAt: '2026-08-23T08:00:00.000Z' }],
    });

    if (path === '/ops/api/issues' && method === 'GET') {
      issueQueries.push(url.search);
      if (url.searchParams.get('cursor') === 'page-2') {
        return json(route, { items: [{
          issueId: '22222222-2222-2222-2222-222222222222', issueCode: 'IO-ACTION-02', status: 'DELIVERED', objectType: 'tote', sizeCode: 'OS', colorCode: 'Bone', amountMinor: 3600, currency: 'USD',
          paymentStatus: 'PAID', designState: 'APPROVED', manufacturingState: 'DELIVERED', providerOrderId: 'pf-2', trackingNumber: 'track-2', paymentExceptionCode: null, updatedAt: '2026-08-22T08:00:00.000Z',
        }], nextCursor: null });
      }
      return json(route, { items: [{
        issueId: ISSUE_ID, issueCode: ISSUE_CODE, status: 'DESIGN_REVIEW', objectType: 'tee', sizeCode: 'M', colorCode: 'Black', amountMinor: 3200, currency: 'USD',
        paymentStatus: 'PAID', designState: 'REVIEW', manufacturingState: null, providerOrderId: null, trackingNumber: null, paymentExceptionCode: null, updatedAt: '2026-08-23T08:00:00.000Z',
      }], nextCursor: url.searchParams.has('search') || url.searchParams.has('paymentStatus') ? null : 'page-2' });
    }
    if (path === `/ops/api/issues/${ISSUE_ID}` && method === 'GET') return json(route, { issue: {
      issueId: ISSUE_ID, issueCode: ISSUE_CODE, status: 'DESIGN_REVIEW', objectType: 'tee', sizeCode: 'M', colorCode: 'Black', amountMinor: 3200, currency: 'USD',
      paymentStatus: 'PAID', paymentProvider: 'SAFEPAY', paymentProviderReference: 'safe-ref', paymentExceptionCode: null,
      designState: 'REVIEW', artworkWidth: 2048, artworkHeight: 3072, designProvider: 'OPENAI', designModel: 'test-model',
      manufacturingState: null, providerOrderId: null, providerStatus: null, trackingNumber: null, trackingUrl: null,
      privacy: { verifiedEmail: true, shipping: true, answers: true, privateBrief: true, supportMessage: true },
      timeline: [], notifications: [], support: [],
    }});
    if (path === `/ops/api/issues/${ISSUE_ID}/reveal` && method === 'POST') {
      const body = request.postDataJSON() as { category?: string };
      return json(route, { value: body.category === 'support_message' ? { message: 'Please help with my Issue.' } : { email: 'private@example.test' } });
    }

    if (path === '/ops/api/manufacturing' && method === 'GET') return json(route, { confirmArmed: false, items: [{
      issueId: ISSUE_ID, issueCode: ISSUE_CODE, issueStatus: 'MANUFACTURING_DRAFT', objectType: 'tee', sizeCode: 'M', colorCode: 'Black', designState: 'APPROVED',
      manufacturingState: 'DRAFT', providerOrderId: 'pf-draft-safe', providerStatus: 'draft', trackingNumber: null, updatedAt: '2026-08-23T08:00:00.000Z',
    }] });
    if (path === '/ops/api/manufacturing/quarantine' && method === 'POST') {
      manufacturingAction = { path, body: request.postDataJSON() };
      return json(route, { quarantined: true });
    }
    if (path === '/ops/api/manufacturing/confirm' && method === 'POST') {
      return json(route, { error: 'Production confirmation must remain unreachable in this test.' }, 500);
    }

    if (path === '/ops/api/sales' && method === 'GET') {
      const days = Number(url.searchParams.get('days') ?? 30);
      salesWindows.push(days);
      return json(route, {
        days, currency: 'USD', grossMinor: 3200, refundedMinor: 0, netAfterRefundMinor: 3200, paidOrders: 1, averageOrderMinor: 3200, failedPayments: 0, exceptionPayments: 0,
        byProduct: [{ key: 'tee', orders: 1 }], bySize: [{ key: 'M', orders: 1 }], byColor: [{ key: 'Black', orders: 1 }], byCountry: [{ key: 'PK', orders: 1 }],
        timing: { averageHoursStartToPaid: 0.25, averageHoursPaidToProduction: null, averageHoursProductionToDelivered: null },
        funnel: { started: 1, answered: 1, physical: 1, verified: 1, shipping: 1, checkout: 1, paid: 1 },
      });
    }

    if (path === '/ops/api/customers' && method === 'GET') {
      customerQueries.push(url.search);
      if (url.searchParams.get('cursor') === 'customer-2') return json(route, { items: [{
        contactAlias: 'CONTACT SECOND', issueCount: 2, currency: 'USD', paidMinor: 6800, refundedIssues: 0, activeDeliveries: 1, supportCount: 0, lastSeenAt: '2026-08-22T09:00:00.000Z',
      }], nextCursor: null });
      return json(route, { items: [{
        contactAlias: 'CONTACT FIRST', issueCount: 1, currency: 'USD', paidMinor: 3200, refundedIssues: 0, activeDeliveries: 0, supportCount: 1, lastSeenAt: '2026-08-23T09:00:00.000Z',
      }], nextCursor: url.searchParams.has('email') ? null : 'customer-2' });
    }

    if (path === '/ops/api/support' && method === 'GET') return json(route, { items: [{
      requestId: SUPPORT_ID, issueId: ISSUE_ID, issueCode: ISSUE_CODE, issueStatus: 'DESIGN_REVIEW', status: 'OPEN',
      createdAt: '2026-08-23T08:00:00.000Z', updatedAt: '2026-08-23T08:00:00.000Z', noteCount: 0, failedNotifications: ['PAYMENT_RECEIVED'],
    }] });
    if (['/ops/api/support/notification-retry','/ops/api/support/note','/ops/api/support/reply','/ops/api/support/status'].includes(path) && method === 'POST') {
      supportActions.push({ path, body: request.postDataJSON() });
      return json(route, { queued: true });
    }

    if (path === '/ops/api/readiness' && method === 'GET') {
      readinessReads += 1;
      return json(route, {
        checkedAt: `2026-08-23T08:00:${String(readinessReads).padStart(2, '0')}.000Z`, readyForSandbox: true, readyForProduction: false,
        checks: [{ key: 'factory-confirm', label: 'Factory charge switch', state: 'safe', detail: 'Production confirmation is disabled.' }],
      });
    }

    return json(route, { error: `Unhandled owner action fixture route ${method} ${path}${url.search}` }, 500);
  });

  await login(page);

  await expect(page.getByRole('heading', { name: 'What requires attention now.' })).toBeVisible();
  await expect(page.getByText('PAID WITHOUT ISSUE')).toBeVisible();
  const attentionBefore = attentionReads;
  await page.getByRole('button', { name: 'CHECK AGAIN' }).click();
  await expect.poll(() => attentionReads).toBeGreaterThan(attentionBefore);
  await page.getByRole('button', { name: 'RESUME ISSUE CREATION' }).click();
  await expect.poll(() => recoveryBody).toEqual({ paymentAttemptId: 'payment-needs-recovery' });

  await page.getByRole('button', { name: 'Issues', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Every paid piece.' })).toBeVisible();
  await page.getByRole('button', { name: 'LOAD MORE' }).click();
  await expect(page.getByText('IO-ACTION-02')).toBeVisible();
  const paidFilter = page.waitForRequest((request) => new URL(request.url()).pathname === '/ops/api/issues' && new URL(request.url()).searchParams.get('paymentStatus') === 'PAID');
  await page.getByLabel('Payment status filter').selectOption('PAID');
  await paidFilter;
  const searchRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/ops/api/issues' && new URL(request.url()).searchParams.get('search') === ISSUE_CODE);
  await page.getByLabel('Search Issues').fill(ISSUE_CODE);
  await searchRequest;
  await expect.poll(() => issueQueries.some((query) => new URLSearchParams(query).get('cursor') === 'page-2')).toBe(true);
  await expect.poll(() => issueQueries.some((query) => new URLSearchParams(query).get('paymentStatus') === 'PAID')).toBe(true);
  await expect.poll(() => issueQueries.some((query) => new URLSearchParams(query).get('search') === ISSUE_CODE)).toBe(true);

  await page.getByRole('button', { name: 'Manufacturing', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(ISSUE_CODE) }).click();
  await expect(page.getByText('FACTORY CONFIRM / SAFE')).toBeVisible();
  await expect(page.getByRole('button', { name: 'CONFIRM PRODUCTION' })).toBeDisabled();
  await page.getByPlaceholder('Why should this stop?').fill('Owner action QA quarantine');
  await page.getByRole('button', { name: 'QUARANTINE' }).click();
  await expect.poll(() => manufacturingAction).toEqual({ path: '/ops/api/manufacturing/quarantine', body: { issueId: ISSUE_ID, reason: 'Owner action QA quarantine' } });

  await page.getByRole('button', { name: 'Sales', exact: true }).click();
  const salesWindow = page.getByLabel('Sales window');
  for (const days of ['7', '90', '3650']) {
    await salesWindow.selectOption(days);
    await expect(salesWindow).toHaveValue(days);
  }
  expect(salesWindows).toEqual(expect.arrayContaining([30, 7, 90, 3650]));

  await page.getByRole('button', { name: 'Customers', exact: true }).click();
  await expect(page.getByText('CONTACT FIRST')).toBeVisible();
  await page.getByRole('button', { name: 'LOAD MORE' }).click();
  await expect(page.getByText('CONTACT SECOND')).toBeVisible();
  const customerSearch = page.waitForRequest((request) => new URL(request.url()).pathname === '/ops/api/customers' && new URL(request.url()).searchParams.get('email') === 'verified@example.com');
  await page.getByLabel('Find customer by verified email').fill('verified@example.com');
  await customerSearch;
  await expect.poll(() => customerQueries.some((query) => new URLSearchParams(query).get('cursor') === 'customer-2')).toBe(true);
  await expect.poll(() => customerQueries.some((query) => new URLSearchParams(query).get('email') === 'verified@example.com')).toBe(true);

  await page.getByRole('button', { name: 'Support', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(ISSUE_CODE) }).click();
  const reveal = page.getByRole('button', { name: 'REVEAL MESSAGE' });
  await expect(reveal).toBeDisabled();
  await page.getByPlaceholder('Why do you need the message?').fill('Resolve customer request');
  await reveal.click();
  await expect(page.getByText(/Please help with my Issue/)).toBeVisible();
  await page.getByRole('button', { name: 'RETRY PAYMENT RECEIVED' }).click();
  await page.getByLabel('Internal note').fill('Checked payment and delivery state.');
  await page.getByRole('button', { name: 'ADD NOTE' }).click();
  await page.getByLabel('Reply to verified customer').fill('We are checking this now.');
  await page.getByRole('button', { name: 'SEND REPLY' }).click();
  await page.getByRole('button', { name: 'CLOSE CASE' }).click();
  await expect.poll(() => supportActions.length).toBe(4);
  expect(supportActions).toEqual(expect.arrayContaining([
    { path: '/ops/api/support/notification-retry', body: { issueId: ISSUE_ID, eventKey: 'PAYMENT_RECEIVED' } },
    { path: '/ops/api/support/note', body: { issueId: ISSUE_ID, body: 'Checked payment and delivery state.' } },
    { path: '/ops/api/support/reply', body: { requestId: SUPPORT_ID, message: 'We are checking this now.' } },
    { path: '/ops/api/support/status', body: { requestId: SUPPORT_ID, status: 'CLOSED' } },
  ]));

  await page.getByRole('button', { name: 'System', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What can actually run.' })).toBeVisible();
  const readinessBefore = readinessReads;
  await page.getByRole('button', { name: 'CHECK AGAIN' }).click();
  await expect.poll(() => readinessReads).toBeGreaterThan(readinessBefore);
  await expect(page.getByText('PRODUCTION READY')).toHaveCount(0);

  await page.getByRole('button', { name: 'CLOSE ROOM' }).click();
  await expect(page.getByRole('heading', { name: 'Private room.' })).toBeVisible();
  expect(supportActions.some((action) => action.path.includes('/confirm'))).toBe(false);
});
