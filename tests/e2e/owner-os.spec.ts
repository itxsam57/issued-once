import { expect, test } from '@playwright/test';

const privatePayload = {
  value: { email: 'private@example.com', phone: '+15550000000', address: 'raw street', answer: 'raw answer' },
};

test('Owner OS protects private data and exposes every control-plane room', async ({ page }) => {
  await page.route('**/ops/api/dashboard', async (route) => route.fulfill({ json: {
    attention: [],
    todaySales: { currency: 'USD', grossMinor: 5400, count: 1 },
    issueCounts: { paid: 1, designing: 0, approved: 0, production: 0, shipped: 0, delivered: 0, failed: 0 },
  } }));
  await page.route('**/ops/api/issues**', async (route) => route.fulfill({ json: { issues: [] } }));
  await page.route('**/ops/api/design/policy**', async (route) => route.fulfill({ json: {
    global: {
      mode: 'HYBRID', approvalRequired: true, rejectBehavior: 'REGENERATE', manualUploadApproval: true,
      answerRevealDefault: false, manufacturingHandoff: 'MANUAL', factoryConfirmation: 'MANUAL',
    },
    overrides: [],
  } }));
  await page.route('**/ops/api/design/readiness**', async (route) => route.fulfill({ json: {
    automation: { ready: false, reason: 'Provider proof pending' },
    manualArtwork: { ready: false, reason: 'Blob unavailable' },
    factory: { ready: false, reason: 'Production confirmation disabled' },
  } }));
  await page.route('**/ops/api/designer**', async (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/ops/api/manufacturing**', async (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/ops/api/sales**', async (route) => route.fulfill({ json: { sales: [] } }));
  await page.route('**/ops/api/referrals', async (route) => route.fulfill({ json: {
    creators: [{
      creatorId: '55555555-5555-4555-8555-555555555555', displayName: 'Creator One', code: 'CREATOR-ONE',
      referralPath: '/r/CREATOR-ONE', active: true, ruleVersionId: 'rule-2', ruleVersion: 2,
      rules: {
        customerDiscount: { mode: 'PERCENT', basisPoints: 1000 },
        creatorReward: { mode: 'PERCENT', basisPoints: 2000 },
        payoutCadence: 'THRESHOLD', payoutThresholdMinor: 2500, attributionWindowDays: 30,
      },
      salesCount: 4,
      balances: [{ currency: 'USD', pendingMinor: 972, availableMinor: 2916, paidOutMinor: 1000, reversedMinor: 500, payoutReady: true }],
    }],
    payouts: [],
  } }));
  await page.route('**/ops/api/customers**', async (route) => route.fulfill({ json: { customers: [] } }));
  await page.route('**/ops/api/support**', async (route) => route.fulfill({ json: { conversations: [] } }));
  await page.route('**/ops/api/website**', async (route) => route.fulfill({ json: {
    catalog: { version: 1, products: [] },
    readiness: { readyForProduction: false, checks: [] },
  } }));
  await page.route('**/ops/api/readiness**', async (route) => route.fulfill({ json: {
    readyForProduction: false,
    readyForSandbox: false,
    checks: [],
  } }));
  await page.route('**/ops/api/audit**', async (route) => route.fulfill({ json: { entries: [] } }));
  await page.route('**/ops/api/reveal**', async (route) => route.fulfill({ json: privatePayload }));
  await page.route('**/ops/api/session', async (route) => {
    if (route.request().method() === 'DELETE') await route.fulfill({ status: 204 });
    else await route.fulfill({ status: 200, json: { authenticated: true } });
  });

  await page.goto('/ops');
  await expect(page.getByText('ISSUED ONCE')).toBeVisible();
  await expect(page.getByText(/private@example|raw street|raw answer/i)).toHaveCount(0);

  const rooms: Array<[string, RegExp]> = [
    ['Home', /What needs you now/],
    ['Issues', /Every paid object/],
    ['Designer', /What the machine is making/],
    ['Manufacturing', /What can physically move/],
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
