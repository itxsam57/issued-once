import { expect, test, type Page, type Route } from '@playwright/test';

const OWNER_KEY = 'issued-once-playwright-owner-key-v1';
const ISSUE_ID = '11111111-1111-1111-1111-111111111111';
const ISSUE_CODE = 'IO-ABCD-EFGH';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockOwnerApis(page: Page) {
  await page.route('**/ops/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === '/ops/api/attention') return json(route, { items: [] });
    if (path === '/ops/api/dashboard') return json(route, {
      sales: { currency: 'USD', today: { orders: 1, grossMinor: 5400 }, sevenDays: { orders: 1, grossMinor: 5400 }, thirtyDays: { orders: 1, grossMinor: 5400 }, lifetime: { orders: 1, grossMinor: 5400 }, refundedMinor: 0, averageOrderMinor: 5400 },
      operations: { paidIssues: 1, designing: 0, review: 1, production: 0, transit: 0, delivered: 0 },
      attention: { paymentExceptions: 0, designFailures: 0, manufacturingFailures: 0, notificationFailures: 0, supportOpen: 1 },
      activity: [{ issueCode: ISSUE_CODE, eventType: 'PAYMENT_RECEIVED', source: 'SAFEPAY', createdAt: '2026-08-19T10:00:00.000Z' }],
    });
    if (path === '/ops/api/issues') return json(route, { items: [{
      issueId: ISSUE_ID, issueCode: ISSUE_CODE, status: 'DESIGN_REVIEW', objectType: 'tee', sizeCode: 'M', colorCode: 'Black', amountMinor: 5400, currency: 'USD',
      paymentStatus: 'PAID', designState: 'REVIEW', manufacturingState: null, providerOrderId: null, trackingNumber: null, paymentExceptionCode: null, updatedAt: '2026-08-19T10:00:00.000Z',
    }], nextCursor: null });
    if (path === `/ops/api/issues/${ISSUE_ID}`) return json(route, { issue: {
      issueId: ISSUE_ID, issueCode: ISSUE_CODE, status: 'DESIGN_REVIEW', objectType: 'tee', sizeCode: 'M', colorCode: 'Black', amountMinor: 5400, currency: 'USD',
      paymentStatus: 'PAID', paymentProvider: 'SAFEPAY', paymentProviderReference: 'safe-ref', paymentExceptionCode: null,
      designState: 'REVIEW', artworkWidth: 2048, artworkHeight: 3072, designProvider: 'OPENAI', designModel: 'test-model',
      manufacturingState: null, providerOrderId: null, providerStatus: null, trackingNumber: null, trackingUrl: null,
      privacy: { verifiedEmail: true, shipping: true, answers: true, privateBrief: true, supportMessage: true },
      timeline: [{ eventType: 'PAYMENT_RECEIVED', source: 'SAFEPAY', safeDetail: null, createdAt: '2026-08-19T10:00:00.000Z' }],
      notifications: [], support: [],
    }});
    if (path === `/ops/api/issues/${ISSUE_ID}/reveal`) return json(route, { value: { email: 'owner-os-fixture@example.test' } });
    if (path === '/ops/api/designer') return json(route, { items: [{
      issueId: ISSUE_ID, issueCode: ISSUE_CODE, issueStatus: 'DESIGN_REVIEW', objectType: 'tee', sizeCode: 'M', colorCode: 'Black',
      designJobId: '22222222-2222-2222-2222-222222222222', designState: 'REVIEW', artworkUrl: null, width: 2048, height: 3072, provider: 'OPENAI', model: 'test-model', candidateCount: 1, updatedAt: '2026-08-19T10:00:00.000Z',
    }] });
    if (path.endsWith('/candidates')) return json(route, { items: [] });
    if (path.startsWith('/ops/api/designer/')) return json(route, { queued: true });
    if (path === '/ops/api/manufacturing') return json(route, { confirmArmed: false, items: [{
      issueId: ISSUE_ID, issueCode: ISSUE_CODE, issueStatus: 'MANUFACTURING_DRAFT', objectType: 'tee', sizeCode: 'M', colorCode: 'Black', designState: 'APPROVED',
      manufacturingState: 'DRAFT', providerOrderId: 'pf-draft-1', providerStatus: 'draft', trackingNumber: null, updatedAt: '2026-08-19T10:00:00.000Z',
    }] });
    if (path.startsWith('/ops/api/manufacturing/')) return json(route, { state: 'DRAFT' });
    if (path === '/ops/api/sales') return json(route, {
      days: 30, currency: 'USD', grossMinor: 5400, refundedMinor: 0, netAfterRefundMinor: 5400, paidOrders: 1, averageOrderMinor: 5400, failedPayments: 0, exceptionPayments: 0,
      byProduct: [{ key: 'tee', orders: 1 }], bySize: [{ key: 'M', orders: 1 }], byColor: [{ key: 'Black', orders: 1 }], byCountry: [{ key: 'PK', orders: 1 }],
      timing: { averageHoursStartToPaid: 0.25, averageHoursPaidToProduction: null, averageHoursProductionToDelivered: null },
      funnel: { started: 1, answered: 1, physical: 1, verified: 1, shipping: 1, checkout: 1, paid: 1 },
    });
    if (path === '/ops/api/referrals') return json(route, { creators: [{
      creatorId: '55555555-5555-4555-8555-555555555555', displayName: 'Creator One', code: 'CREATOR-ONE', referralPath: '/r/CREATOR-ONE', active: true,
      ruleVersion: 2,
      rules: { customerDiscount: { mode: 'PERCENT', basisPoints: 1000 }, creatorReward: { mode: 'PERCENT', basisPoints: 2000 }, payoutCadence: 'THRESHOLD', payoutThresholdMinor: 2500, attributionWindowDays: 30 },
      salesCount: 4,
      balances: [{ currency: 'USD', pendingMinor: 972, availableMinor: 2916, paidOutMinor: 1000, reversedMinor: 500, payoutReady: true }],
    }] });
    if (path === '/ops/api/customers') return json(route, { items: [{ contactAlias: 'CONTACT A1B2C3D4', issueCount: 1, currency: 'USD', paidMinor: 5400, refundedIssues: 0, activeDeliveries: 0, supportCount: 1, lastSeenAt: '2026-08-19T10:00:00.000Z' }], nextCursor: null });
    if (path === '/ops/api/support') return json(route, { items: [{ requestId: '33333333-3333-3333-3333-333333333333', issueId: ISSUE_ID, issueCode: ISSUE_CODE, issueStatus: 'DESIGN_REVIEW', status: 'OPEN', createdAt: '2026-08-19T10:00:00.000Z', updatedAt: '2026-08-19T10:00:00.000Z', noteCount: 0, failedNotifications: ['PAYMENT_RECEIVED'] }] });
    if (path.startsWith('/ops/api/support/')) return json(route, { queued: true });
    if (path === '/ops/api/website') return json(route, {
      catalog: { source: 'ACTIVE', version: 1, payload: { currency: 'USD', products: { tee: { slug: 'issued-tee', variants: [{ id: 'tee-m-black', size: 'M', colorName: 'Black', colorSwatch: '#171713', amountMinor: 5400, available: true }] } } } },
      questions: [{ questionId: 'culture.book.v1', version: 1, family: 'culture', prompt: "So tell me. What's a book you actually remember?", kind: 'text', optional: false, active: true, weight: 1, usageCount: 0 }],
    });
    if (path.startsWith('/ops/api/website/')) return json(route, { version: 2 });
    if (path === '/ops/api/readiness') return json(route, { checkedAt: '2026-08-19T10:00:00.000Z', readyForSandbox: true, readyForProduction: false, checks: [{ key: 'factory', label: 'Printful confirmation', state: 'safe', detail: 'Production confirmation remains disabled.' }] });
    if (path === '/ops/api/audit') return json(route, { items: [{ id: '44444444-4444-4444-4444-444444444444', actor: 'OWNER', action: 'DESIGN_APPROVED', issueId: ISSUE_ID, targetType: 'design_job', targetId: 'd1', reason: null, safeMetadata: { state: 'APPROVED' }, createdAt: '2026-08-19T10:00:00.000Z' }], nextCursor: null });

    return json(route, { error: `Unhandled fixture route ${path}` }, 500);
  });
}

async function login(page: Page) {
  await page.goto('/ops');
  await expect(page.getByRole('heading', { name: 'Private room.' })).toBeVisible();
  await page.getByLabel('Owner key').fill(OWNER_KEY);
  await page.getByRole('button', { name: 'ENTER' }).click();
  await expect(page.getByText('OWNER OS', { exact: true })).toBeVisible();
}

test('Owner OS protects private data and exposes every control-plane room', async ({ page }) => {
  await mockOwnerApis(page);
  await login(page);

  await expect(page.getByRole('heading', { name: 'What requires attention now.' })).toBeVisible();
  await expect(page.getByText('owner-os-fixture@example.test')).toHaveCount(0);

  await page.getByRole('button', { name: 'Issues', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Every paid piece.' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(ISSUE_CODE) }).click();
  await expect(page.getByText('Plaintext stays hidden until an audited reveal is requested.')).toBeVisible();
  await page.getByRole('button', { name: 'CONTACT' }).click();
  const reveal = page.getByRole('button', { name: 'REVEAL PRIVATE DATA' });
  await expect(reveal).toBeDisabled();
  await page.getByLabel('Reason for access').fill('customer support verification');
  await expect(reveal).toBeEnabled();
  await reveal.click();
  await expect(page.getByText(/owner-os-fixture@example\.test/)).toBeVisible();

  await page.getByRole('button', { name: 'Designer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What each mind became.' })).toBeVisible();
  await expect(page.getByText('REVIEW', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Manufacturing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What is becoming physical.' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(ISSUE_CODE) }).click();
  await expect(page.getByText('FACTORY CONFIRM / SAFE')).toBeVisible();
  await expect(page.getByRole('button', { name: 'CONFIRM PRODUCTION' })).toBeDisabled();

  const rooms: Array<[string, RegExp]> = [
    ['Sales', /What actually sold/],
    ['Referrals', /Who is bringing people in/],
    ['Customers', /People, without turning them into profiles/],
    ['Support', /What needs a human/],
    ['Website', /What the next customer can receive/],
    ['System', /What can actually run/],
    ['Audit', /What changed, and why/],
  ];
  for (const [room, heading] of rooms) {
    await page.getByRole('button', { name: room, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    if (room === 'Referrals') {
      await expect(page.getByRole('heading', { name: 'CREATOR-ONE', exact: true })).toBeVisible();
      await expect(page.getByText(/available/i).first()).toBeVisible();
      await expect(page.getByText(/creator@example|PK00-PRIVATE/i)).toHaveCount(0);
    }
  }
  await expect(page.getByText('Audit metadata never stores raw answers, email, phone, address, secrets or decrypted support text.')).toBeVisible();
});
