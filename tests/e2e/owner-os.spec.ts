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

async function expectNoDocumentOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    viewport: window.innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(Math.max(width.html, width.body)).toBeLessThanOrEqual(width.viewport);
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
    await expectNoDocumentOverflow(page);
  }
  await expect(page.getByText('Audit metadata never stores raw answers, email, phone, address, secrets or decrypted support text.')).toBeVisible();
});

test('Owner OS quick pricing publishes the chosen future-sale price without touching production providers', async ({ page }, testInfo) => {
  await mockOwnerApis(page);
  await login(page);
  await page.getByRole('button', { name: 'Website', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What the next customer can receive.' })).toBeVisible();

  const price = page.getByLabel('TEE quick price');
  const publish = page.getByRole('button', { name: 'PUBLISH TEE PRICE' });
  await expect(price).toHaveValue('54.00');
  const actionBox = await publish.boundingBox();
  expect(actionBox).not.toBeNull();
  expect(actionBox!.width).toBeGreaterThanOrEqual(140);
  expect(actionBox!.height).toBeLessThanOrEqual(60);
  await price.fill('61.00');

  const publication = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return request.method() === 'POST' && url.pathname === '/ops/api/website/catalog/price';
  });
  await publish.click();
  const request = await publication;
  expect(request.postDataJSON()).toEqual({ productKey: 'tee', amountMinor: 6100, currency: 'USD' });
  await expect(page.getByText(/TEE price published for future sales/i)).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `artifacts/visual/16-owner-quick-price-${testInfo.project.name}.png`, fullPage: true });
});

test('Owner OS new question editor keeps fields in a deliberate grid instead of baseline-staggering', async ({ page }, testInfo) => {
  await mockOwnerApis(page);
  await login(page);
  await page.getByRole('button', { name: 'Website', exact: true }).click();

  const questionId = page.getByPlaceholder('Question ID');
  const prompt = page.getByPlaceholder('Prompt');
  const family = page.locator('select').last();
  const idBox = await questionId.boundingBox();
  const promptBox = await prompt.boundingBox();
  const familyBox = await family.boundingBox();
  expect(idBox).not.toBeNull();
  expect(promptBox).not.toBeNull();
  expect(familyBox).not.toBeNull();

  if (testInfo.project.name.includes('mobile')) {
    expect(idBox!.width).toBeGreaterThanOrEqual(320);
    expect(familyBox!.width).toBeGreaterThanOrEqual(320);
    expect(promptBox!.width).toBeGreaterThanOrEqual(320);
    expect(Math.abs(idBox!.x - familyBox!.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(idBox!.x - promptBox!.x)).toBeLessThanOrEqual(2);
    expect(familyBox!.y).toBeGreaterThan(idBox!.y + idBox!.height);
    expect(promptBox!.y).toBeGreaterThan(familyBox!.y + familyBox!.height);
  } else {
    expect(Math.abs(idBox!.y - familyBox!.y)).toBeLessThanOrEqual(2);
    expect(promptBox!.y).toBeGreaterThan(idBox!.y + idBox!.height);
    expect(promptBox!.width).toBeGreaterThan(idBox!.width + familyBox!.width);
  }
});

test('Owner OS Website catalog fits a laptop viewport after variants render', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await mockOwnerApis(page);
  await login(page);
  await page.getByRole('button', { name: 'Website', exact: true }).click();
  await expect(page.getByLabel('tee variant id')).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test('Owner OS Referrals fits a tablet viewport after creator detail renders', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await mockOwnerApis(page);
  await login(page);
  await page.getByRole('button', { name: 'Referrals', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'CREATOR-ONE', exact: true })).toBeVisible();
  await expectNoDocumentOverflow(page);
});


test('Owner Referrals payout reveal cannot leak a previous creator destination into a newly selected creator', async ({ page }) => {
  const creators = [
    { creatorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', displayName: 'Creator A', code: 'CREATOR-A', referralPath: '/r/CREATOR-A', active: true, ruleVersion: 1, rules: { customerDiscount: { mode: 'PERCENT', basisPoints: 1000 }, creatorReward: { mode: 'PERCENT', basisPoints: 2000 }, payoutCadence: 'THRESHOLD', payoutThresholdMinor: 1000, attributionWindowDays: 30 }, salesCount: 2, balances: [{ currency: 'USD', pendingMinor: 0, availableMinor: 2000, paidOutMinor: 0, reversedMinor: 0, payoutReady: true }] },
    { creatorId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', displayName: 'Creator B', code: 'CREATOR-B', referralPath: '/r/CREATOR-B', active: true, ruleVersion: 1, rules: { customerDiscount: { mode: 'PERCENT', basisPoints: 1000 }, creatorReward: { mode: 'PERCENT', basisPoints: 2000 }, payoutCadence: 'THRESHOLD', payoutThresholdMinor: 1000, attributionWindowDays: 30 }, salesCount: 1, balances: [{ currency: 'USD', pendingMinor: 0, availableMinor: 2000, paidOutMinor: 0, reversedMinor: 0, payoutReady: true }] },
  ];
  const payouts = [
    { payoutId: 'pay-a', creatorId: creators[0].creatorId, currency: 'USD', requestedAmountMinor: 1000, conversionCount: 1, status: 'REQUESTED', requestedAt: '2026-09-09T00:00:00.000Z', paidAt: null },
    { payoutId: 'pay-b', creatorId: creators[1].creatorId, currency: 'USD', requestedAmountMinor: 1000, conversionCount: 1, status: 'REQUESTED', requestedAt: '2026-09-09T00:00:00.000Z', paidAt: null },
  ];
  await page.route('**/ops/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/ops/api/attention') return json(route, { items: [] });
    if (path === '/ops/api/dashboard') return json(route, { sales: { currency: 'USD', today: { orders: 0, grossMinor: 0 }, sevenDays: { orders: 0, grossMinor: 0 }, thirtyDays: { orders: 0, grossMinor: 0 }, lifetime: { orders: 0, grossMinor: 0 }, refundedMinor: 0, averageOrderMinor: 0 }, operations: { paidIssues: 0, designing: 0, review: 0, production: 0, transit: 0, delivered: 0 }, attention: { paymentExceptions: 0, designFailures: 0, manufacturingFailures: 0, notificationFailures: 0, supportOpen: 0 }, activity: [] });
    if (path === '/ops/api/referrals' && request.method() === 'GET') return json(route, { creators, payouts });
    if (path === '/ops/api/referrals/payouts' && request.method() === 'POST') {
      const body = request.postDataJSON() as { action?: string; payoutId?: string };
      if (body.action === 'REVEAL' && body.payoutId === 'pay-a') {
        await new Promise((resolve) => setTimeout(resolve, 350));
        return json(route, { value: { destination: 'CREATOR-A-PRIVATE-DESTINATION' } });
      }
      return json(route, { value: { destination: 'CREATOR-B-PRIVATE-DESTINATION' } });
    }
    return json(route, { error: `Unhandled referral race route ${request.method()} ${path}` }, 500);
  });

  await login(page);
  await page.getByRole('button', { name: 'Referrals', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'CREATOR-A', exact: true })).toBeVisible();
  await page.getByLabel('Reason to reveal payout details').fill('Owner payout audit');
  await page.getByRole('button', { name: 'REVEAL PAYOUT DETAILS' }).click();
  await page.getByRole('button', { name: /CREATOR-B/ }).click();
  await expect(page.getByRole('heading', { name: 'CREATOR-B', exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByText('CREATOR-A-PRIVATE-DESTINATION')).toHaveCount(0);
});


test('Owner Referrals mutation completion preserves a creator selected while the action was pending', async ({ page }) => {
  const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const creators = [
    { creatorId: A, displayName: 'Creator A', code: 'CREATOR-A', referralPath: '/r/CREATOR-A', active: true, ruleVersion: 1, rules: { customerDiscount: { mode: 'PERCENT', basisPoints: 1000 }, creatorReward: { mode: 'PERCENT', basisPoints: 2000 }, payoutCadence: 'MONTHLY', payoutThresholdMinor: null, attributionWindowDays: 30 }, salesCount: 2, balances: [] },
    { creatorId: B, displayName: 'Creator B', code: 'CREATOR-B', referralPath: '/r/CREATOR-B', active: true, ruleVersion: 1, rules: { customerDiscount: { mode: 'PERCENT', basisPoints: 1000 }, creatorReward: { mode: 'PERCENT', basisPoints: 2000 }, payoutCadence: 'MONTHLY', payoutThresholdMinor: null, attributionWindowDays: 30 }, salesCount: 1, balances: [] },
  ];
  await page.route('**/ops/api/**', async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    if (path === '/ops/api/attention') return json(route, { items: [] });
    if (path === '/ops/api/dashboard') return json(route, { sales: { currency: 'USD', today: { orders: 0, grossMinor: 0 }, sevenDays: { orders: 0, grossMinor: 0 }, thirtyDays: { orders: 0, grossMinor: 0 }, lifetime: { orders: 0, grossMinor: 0 }, refundedMinor: 0, averageOrderMinor: 0 }, operations: { paidIssues: 0, designing: 0, review: 0, production: 0, transit: 0, delivered: 0 }, attention: { paymentExceptions: 0, designFailures: 0, manufacturingFailures: 0, notificationFailures: 0, supportOpen: 0 }, activity: [] });
    if (path === '/ops/api/referrals' && method === 'GET') return json(route, { creators, payouts: [] });
    if (path === `/ops/api/referrals/${A}` && method === 'PATCH') { await new Promise((r) => setTimeout(r, 350)); return json(route, { updated: true }); }
    return json(route, { error: `Unhandled referral mutation race ${method} ${path}` }, 500);
  });
  await login(page);
  await page.getByRole('button', { name: 'Referrals', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'CREATOR-A', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'PAUSE CREATOR' }).click();
  await page.getByRole('button', { name: /CREATOR-B/ }).click();
  await expect(page.getByRole('heading', { name: 'CREATOR-B', exact: true })).toBeVisible();
  await page.waitForTimeout(600);
  await expect(page.getByRole('heading', { name: 'CREATOR-B', exact: true })).toBeVisible();
});

test('Owner Issues ignores a stale LOAD MORE page after the search changes', async ({ page }) => {
  await page.route('**/ops/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === '/ops/api/attention') return json(route, { items: [] });
    if (path === '/ops/api/dashboard') return json(route, { sales: { currency: 'USD', today: { orders: 0, grossMinor: 0 }, sevenDays: { orders: 0, grossMinor: 0 }, thirtyDays: { orders: 0, grossMinor: 0 }, lifetime: { orders: 0, grossMinor: 0 }, refundedMinor: 0, averageOrderMinor: 0 }, operations: { paidIssues: 1, designing: 0, review: 0, production: 0, transit: 0, delivered: 0 }, attention: { paymentExceptions: 0, designFailures: 0, manufacturingFailures: 0, notificationFailures: 0, supportOpen: 0 }, activity: [] });
    if (path === '/ops/api/issues') {
      const search = url.searchParams.get('search');
      const cursor = url.searchParams.get('cursor');
      const row = (id: string, code: string) => ({ issueId: id, issueCode: code, status: 'RECEIVED', objectType: 'tee', sizeCode: 'M', colorCode: 'Black', amountMinor: 3200, currency: 'USD', paymentStatus: 'PAID', designState: null, manufacturingState: null, providerOrderId: null, trackingNumber: null, paymentExceptionCode: null, updatedAt: '2026-09-09T00:00:00Z' });
      if (cursor === 'old-next') { await new Promise((r) => setTimeout(r, 350)); return json(route, { items: [row('22222222-2222-4222-8222-222222222222', 'IO-OLD-MORE')], nextCursor: null }); }
      if (search === 'IO-TARGET') return json(route, { items: [row('33333333-3333-4333-8333-333333333333', 'IO-TARGET')], nextCursor: null });
      return json(route, { items: [row('11111111-1111-4111-8111-111111111111', 'IO-INITIAL')], nextCursor: 'old-next' });
    }
    return json(route, { error: `Unhandled Issues race ${request.method()} ${path}` }, 500);
  });
  await login(page);
  await page.getByRole('button', { name: 'Issues', exact: true }).click();
  await expect(page.getByText('IO-INITIAL')).toBeVisible();
  await page.getByRole('button', { name: 'LOAD MORE' }).click();
  await page.getByLabel('Search Issues').fill('IO-TARGET');
  await expect(page.getByText('IO-TARGET')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByText('IO-OLD-MORE')).toHaveCount(0);
});

test('Owner Customers ignores a stale LOAD MORE page after the email search changes', async ({ page }) => {
  await page.route('**/ops/api/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    if (path === '/ops/api/attention') return json(route, { items: [] });
    if (path === '/ops/api/dashboard') return json(route, { sales: { currency: 'USD', today: { orders: 0, grossMinor: 0 }, sevenDays: { orders: 0, grossMinor: 0 }, thirtyDays: { orders: 0, grossMinor: 0 }, lifetime: { orders: 0, grossMinor: 0 }, refundedMinor: 0, averageOrderMinor: 0 }, operations: { paidIssues: 0, designing: 0, review: 0, production: 0, transit: 0, delivered: 0 }, attention: { paymentExceptions: 0, designFailures: 0, manufacturingFailures: 0, notificationFailures: 0, supportOpen: 0 }, activity: [] });
    if (path === '/ops/api/customers') {
      const cursor = url.searchParams.get('cursor'); const email = url.searchParams.get('email');
      const row = (alias: string, time: string) => ({ contactAlias: alias, issueCount: 1, currency: 'USD', paidMinor: 3200, refundedIssues: 0, activeDeliveries: 0, supportCount: 0, lastSeenAt: time });
      if (cursor === 'old-customer-next') { await new Promise((r) => setTimeout(r, 350)); return json(route, { items: [row('STALE CUSTOMER', '2026-09-08T00:00:00Z')], nextCursor: null }); }
      if (email === 'target@example.com') return json(route, { items: [row('TARGET CUSTOMER', '2026-09-09T00:00:00Z')], nextCursor: null });
      return json(route, { items: [row('INITIAL CUSTOMER', '2026-09-07T00:00:00Z')], nextCursor: 'old-customer-next' });
    }
    return json(route, { error: `Unhandled Customers race ${request.method()} ${path}` }, 500);
  });
  await login(page);
  await page.getByRole('button', { name: 'Customers', exact: true }).click();
  await expect(page.getByText('INITIAL CUSTOMER')).toBeVisible();
  await page.getByRole('button', { name: 'LOAD MORE' }).click();
  await page.getByLabel('Find customer by verified email').fill('target@example.com');
  await expect(page.getByText('TARGET CUSTOMER')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByText('STALE CUSTOMER')).toHaveCount(0);
});

test('Owner Audit ignores a slow initial response after a newer filter result arrives', async ({ page }) => {
  let auditReads = 0;
  await page.route('**/ops/api/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    if (path === '/ops/api/attention') return json(route, { items: [] });
    if (path === '/ops/api/dashboard') return json(route, { sales: { currency: 'USD', today: { orders: 0, grossMinor: 0 }, sevenDays: { orders: 0, grossMinor: 0 }, thirtyDays: { orders: 0, grossMinor: 0 }, lifetime: { orders: 0, grossMinor: 0 }, refundedMinor: 0, averageOrderMinor: 0 }, operations: { paidIssues: 0, designing: 0, review: 0, production: 0, transit: 0, delivered: 0 }, attention: { paymentExceptions: 0, designFailures: 0, manufacturingFailures: 0, notificationFailures: 0, supportOpen: 0 }, activity: [] });
    if (path === '/ops/api/audit') {
      auditReads += 1;
      const filtered = url.searchParams.get('action') === 'DESIGN_APPROVED';
      if (!filtered) await new Promise((r) => setTimeout(r, 350));
      const item = (id: string, action: string) => ({ id, actor: 'OWNER', action, issueId: null, targetType: 'design', targetId: id, reason: null, safeMetadata: {}, createdAt: '2026-09-09T00:00:00Z' });
      return json(route, { items: [filtered ? item('22222222-2222-4222-8222-222222222222', 'DESIGN_APPROVED') : item('11111111-1111-4111-8111-111111111111', 'STALE_INITIAL')], nextCursor: null });
    }
    return json(route, { error: `Unhandled Audit race ${request.method()} ${path}` }, 500);
  });
  await login(page);
  await page.getByRole('button', { name: 'Audit', exact: true }).click();
  await page.getByLabel('Audit action').fill('DESIGN_APPROVED');
  await page.getByRole('button', { name: 'FILTER' }).click();
  await expect(page.getByText('DESIGN APPROVED')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByText('STALE INITIAL')).toHaveCount(0);
  expect(auditReads).toBeGreaterThanOrEqual(2);
});

test('Owner Referrals never carries or clears payout destination fields across creators', async ({ page }) => {
  const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const creator = (creatorId: string, code: string) => ({ creatorId, displayName: code, code, referralPath: `/r/${code}`, active: true, ruleVersion: 1, rules: { customerDiscount: { mode: 'PERCENT', basisPoints: 1000 }, creatorReward: { mode: 'PERCENT', basisPoints: 2000 }, payoutCadence: 'THRESHOLD', payoutThresholdMinor: 1000, attributionWindowDays: 30 }, salesCount: 1, balances: [{ currency: 'USD', pendingMinor: 0, availableMinor: 2000, paidOutMinor: 0, reversedMinor: 0, payoutReady: true }] });
  const creators = [creator(A, 'CREATOR-A'), creator(B, 'CREATOR-B')];
  await page.route('**/ops/api/**', async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    if (path === '/ops/api/attention') return json(route, { items: [] });
    if (path === '/ops/api/dashboard') return json(route, { sales: { currency: 'USD', today: { orders: 0, grossMinor: 0 }, sevenDays: { orders: 0, grossMinor: 0 }, thirtyDays: { orders: 0, grossMinor: 0 }, lifetime: { orders: 0, grossMinor: 0 }, refundedMinor: 0, averageOrderMinor: 0 }, operations: { paidIssues: 0, designing: 0, review: 0, production: 0, transit: 0, delivered: 0 }, attention: { paymentExceptions: 0, designFailures: 0, manufacturingFailures: 0, notificationFailures: 0, supportOpen: 0 }, activity: [] });
    if (path === '/ops/api/referrals' && method === 'GET') return json(route, { creators, payouts: [] });
    if (path === '/ops/api/referrals/payouts' && method === 'POST') { await new Promise((r) => setTimeout(r, 350)); return json(route, { payoutId: 'pay-a' }); }
    return json(route, { error: `Unhandled payout field race ${method} ${path}` }, 500);
  });
  await login(page);
  await page.getByRole('button', { name: 'Referrals', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'CREATOR-A', exact: true })).toBeVisible();
  const method = page.locator('label').filter({ hasText: 'Destination type' }).getByRole('combobox');
  const name = page.locator('label').filter({ hasText: 'Recipient name' }).getByRole('textbox');
  const reference = page.locator('label').filter({ hasText: 'Destination / reference' }).getByRole('textbox');
  const reason = page.getByPlaceholder('Why is this payout being prepared?');
  await method.selectOption('bank'); await name.fill('CREATOR A BANK'); await reference.fill('A-ACCOUNT'); await reason.fill('Pay A');
  await page.getByRole('button', { name: 'REQUEST PAYOUT' }).click();
  await page.getByRole('button', { name: /CREATOR-B/ }).click();
  await expect(page.getByRole('heading', { name: 'CREATOR-B', exact: true })).toBeVisible();
  await expect(method).toHaveValue(''); await expect(name).toHaveValue(''); await expect(reference).toHaveValue(''); await expect(reason).toHaveValue('');
  await method.selectOption('wallet'); await name.fill('CREATOR B WALLET'); await reference.fill('B-WALLET'); await reason.fill('Pay B');
  await page.waitForTimeout(600);
  await expect(name).toHaveValue('CREATOR B WALLET'); await expect(reference).toHaveValue('B-WALLET'); await expect(reason).toHaveValue('Pay B');
});
