import { expect, test, type Page, type Route } from '@playwright/test';

const OWNER_KEY = 'issued-once-playwright-owner-key-v1';
const REVIEW_ID = '11111111-1111-1111-1111-111111111111';
const APPROVED_ID = '22222222-2222-2222-2222-222222222222';

const basePolicy = {
  mode: 'HYBRID',
  approvalRequired: true,
  rejectBehavior: 'WAIT_FOR_OWNER',
  manualUploadApproval: 'REQUIRE_APPROVAL',
  answerRevealDefault: 'HIDDEN_UNTIL_REVEALED',
  manufacturingHandoff: 'WAIT_FOR_OWNER',
  factoryConfirmation: 'WAIT_FOR_OWNER',
} as const;

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

test('Designer control plane applies policy, feedback and unconfirmed manufacturing handoff', async ({ page }) => {
  let globalPolicy = { ...basePolicy };
  const overrides = new Map<string, Record<string, unknown>>();
  let lastReviewBody: Record<string, unknown> | null = null;
  let draftIssueId: string | null = null;

  await page.route('**/ops/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path === '/ops/api/attention') return json(route, { items: [] });
    if (path === '/ops/api/dashboard') return json(route, {
      sales: { currency: 'USD', today: { orders: 1, grossMinor: 5400 }, sevenDays: { orders: 1, grossMinor: 5400 }, thirtyDays: { orders: 1, grossMinor: 5400 }, lifetime: { orders: 1, grossMinor: 5400 }, refundedMinor: 0, averageOrderMinor: 5400 },
      operations: { paidIssues: 2, designing: 0, review: 1, production: 0, transit: 0, delivered: 0 },
      attention: { paymentExceptions: 0, designFailures: 0, manufacturingFailures: 0, notificationFailures: 0, supportOpen: 0 },
      activity: [],
    });
    if (path === '/ops/api/designer' && method === 'GET') return json(route, { items: [
      {
        issueId: REVIEW_ID, issueCode: 'IO-REVIEW-01', issueStatus: 'DESIGN_REVIEW', objectType: 'tee', sizeCode: 'M', colorCode: 'Black',
        designJobId: '33333333-3333-3333-3333-333333333333', designState: 'REVIEW', artworkUrl: null, width: 2048, height: 3072,
        provider: 'OPENAI', model: 'test-model', candidateCount: 1, updatedAt: '2026-08-21T10:00:00.000Z',
      },
      {
        issueId: APPROVED_ID, issueCode: 'IO-APPROVED-01', issueStatus: 'DESIGN_APPROVED', objectType: 'tee', sizeCode: 'L', colorCode: 'White',
        designJobId: '44444444-4444-4444-4444-444444444444', designState: 'APPROVED', artworkUrl: 'https://example.com/approved.png', width: 2048, height: 3072,
        provider: 'OPENAI', model: 'test-model', candidateCount: 1, updatedAt: '2026-08-21T10:00:00.000Z',
      },
    ] });
    if (path === '/ops/api/designer/policy' && method === 'GET') return json(route, { source: 'ACTIVE', version: 7, policy: globalPolicy });
    if (path === '/ops/api/designer/policy' && method === 'PUT') {
      globalPolicy = JSON.parse(request.postData() || '{}') as typeof globalPolicy;
      return json(route, { source: 'ACTIVE', version: 8, policy: globalPolicy });
    }
    if (path === '/ops/api/readiness') return json(route, {
      checkedAt: '2026-08-21T10:00:00.000Z', readyForSandbox: true, readyForProduction: false,
      checks: [
        { key: 'openai', label: 'OpenAI design models', state: 'ready', detail: 'Configured models are accessible.' },
        { key: 'storage', label: 'Private artwork storage', state: 'ready', detail: 'Durable private artwork database boundary is available.' },
        { key: 'queues', label: 'Durable queues', state: 'configured', detail: 'Design queue consumer is declared.' },
        { key: 'factory-confirm', label: 'Factory charge switch', state: 'safe', detail: 'Production confirmation is disabled.' },
      ],
    });
    if (path.endsWith('/candidates') && method === 'GET') return json(route, { items: [] });

    const issuePolicyMatch = path.match(/^\/ops\/api\/designer\/([^/]+)\/policy$/);
    if (issuePolicyMatch) {
      const issueId = issuePolicyMatch[1];
      if (method === 'PUT') overrides.set(issueId, JSON.parse(request.postData() || '{}') as Record<string, unknown>);
      if (method === 'DELETE') overrides.delete(issueId);
      const override = overrides.get(issueId) ?? null;
      return json(route, { globalVersion: 8, override, policy: { ...globalPolicy, ...(override ?? {}) } });
    }

    if (path === `/ops/api/designer/${REVIEW_ID}/review` && method === 'POST') {
      lastReviewBody = JSON.parse(request.postData() || '{}') as Record<string, unknown>;
      return json(route, { queued: true, policyVersion: 8, generationKey: 'gen-browser-proof' });
    }
    if (path === '/ops/api/manufacturing/create-draft' && method === 'POST') {
      const body = JSON.parse(request.postData() || '{}') as { issueId?: string };
      draftIssueId = body.issueId ?? null;
      return json(route, { issueId: draftIssueId, state: 'DRAFT', providerOrderId: 'pf-browser-draft' });
    }

    return json(route, { error: `Unhandled Designer fixture route ${method} ${path}` }, 500);
  });

  await login(page);
  await page.getByRole('button', { name: 'Designer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What each mind became.' })).toBeVisible();

  await expect(page.getByText('AI AUTOMATION READY')).toBeVisible();
  await expect(page.getByText('MANUAL ARTWORK READY')).toBeVisible();
  await expect(page.getByText('FACTORY CHARGE SWITCH SAFE')).toBeVisible();

  await page.getByRole('combobox', { name: 'Global design mode' }).selectOption('MANUAL');
  await expect(page.getByRole('combobox', { name: 'Global design mode' })).toHaveValue('MANUAL');

  await page.getByRole('button', { name: /IO-REVIEW-01/ }).click();
  await page.getByRole('combobox', { name: 'This Issue Mode' }).selectOption('AUTO');
  await expect(page.getByRole('combobox', { name: 'This Issue Mode' })).toHaveValue('AUTO');

  await page.getByRole('button', { name: 'WRONG MOOD' }).click();
  await page.getByLabel('Custom design instruction').fill('Colder, quieter, less literal.');
  await page.getByRole('button', { name: 'REJECT / APPLY POLICY' }).click();
  await expect.poll(() => lastReviewBody).toEqual({
    decision: 'revise',
    next: 'regenerate',
    reason: 'WRONG MOOD — Colder, quieter, less literal.',
  });

  await page.getByRole('button', { name: /IO-APPROVED-01/ }).click();
  await expect(page.getByText('This creates or reconciles an unconfirmed Printful draft only. It does not authorize a charge or production.')).toBeVisible();
  await page.getByRole('button', { name: 'SEND TO MANUFACTURING' }).click();
  await expect.poll(() => draftIssueId).toBe(APPROVED_ID);
  await expect(page.getByRole('status')).toContainText('Production is still not confirmed.');
});


test('Reviewer selection ignores stale candidate and policy responses from a previously selected Issue', async ({ page }) => {
  const items = [
    { issueId: REVIEW_ID, issueCode: 'IO-REVIEW-01', issueStatus: 'DESIGN_REVIEW', objectType: 'tee', sizeCode: 'M', colorCode: 'Black', designJobId: '33333333-3333-3333-3333-333333333333', designState: 'REVIEW', artworkUrl: null, width: 2048, height: 3072, provider: 'OPENAI', model: 'test-model', candidateCount: 1, updatedAt: '2026-08-21T10:00:00.000Z' },
    { issueId: APPROVED_ID, issueCode: 'IO-APPROVED-01', issueStatus: 'DESIGN_APPROVED', objectType: 'tee', sizeCode: 'L', colorCode: 'White', designJobId: '44444444-4444-4444-4444-444444444444', designState: 'APPROVED', artworkUrl: null, width: 2048, height: 3072, provider: 'OPENAI', model: 'test-model', candidateCount: 1, updatedAt: '2026-08-21T10:00:00.000Z' },
  ];
  const readiness = { checkedAt: '2026-08-21T10:00:00.000Z', readyForSandbox: true, readyForProduction: false, checks: [
    { key: 'openai', label: 'OpenAI', state: 'ready', detail: 'ready' },
    { key: 'storage', label: 'Storage', state: 'ready', detail: 'ready' },
    { key: 'queues', label: 'Queues', state: 'configured', detail: 'ready' },
    { key: 'factory-confirm', label: 'Factory', state: 'safe', detail: 'safe' },
  ] };
  await page.route('**/ops/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/ops/api/attention') return json(route, { items: [] });
    if (path === '/ops/api/dashboard') return json(route, { sales: { currency: 'USD', today: { orders: 0, grossMinor: 0 }, sevenDays: { orders: 0, grossMinor: 0 }, thirtyDays: { orders: 0, grossMinor: 0 }, lifetime: { orders: 0, grossMinor: 0 }, refundedMinor: 0, averageOrderMinor: 0 }, operations: { paidIssues: 2, designing: 0, review: 1, production: 0, transit: 0, delivered: 0 }, attention: { paymentExceptions: 0, designFailures: 0, manufacturingFailures: 0, notificationFailures: 0, supportOpen: 0 }, activity: [] });
    if (path === '/ops/api/designer') return json(route, { items });
    if (path === '/ops/api/designer/policy') return json(route, { policy: basePolicy });
    if (path === '/ops/api/readiness') return json(route, readiness);
    const candidateMatch = path.match(/^\/ops\/api\/designer\/([^/]+)\/candidates$/);
    if (candidateMatch) {
      const id = candidateMatch[1];
      if (id === REVIEW_ID) await new Promise((resolve) => setTimeout(resolve, 250));
      return json(route, { items: [{ id: `candidate-${id}`, issueId: id, generationKey: `g-${id}`, source: 'AI_GENERATED', artworkUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', width: 2048, height: 3072, provider: 'OPENAI', model: 'test-model', safeSummary: id === REVIEW_ID ? 'REVIEW-CANDIDATE-ONLY' : 'APPROVED-CANDIDATE-ONLY', selected: true, createdAt: '2026-08-21T10:00:00.000Z' }] });
    }
    const policyMatch = path.match(/^\/ops\/api\/designer\/([^/]+)\/policy$/);
    if (policyMatch) {
      const id = policyMatch[1];
      if (id === REVIEW_ID) await new Promise((resolve) => setTimeout(resolve, 300));
      const override = { mode: id === REVIEW_ID ? 'AUTO' : 'MANUAL' };
      return json(route, { globalVersion: 7, override, policy: { ...basePolicy, ...override } });
    }
    return json(route, { error: `Unhandled stale-selection fixture ${path}` }, 500);
  });

  await login(page);
  await page.getByRole('button', { name: 'Designer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What each mind became.' })).toBeVisible();
  await page.getByRole('button', { name: /IO-REVIEW-01/ }).click();
  await page.getByRole('button', { name: /IO-APPROVED-01/ }).click();
  await expect(page.getByText('ISSUE / IO-APPROVED-01')).toBeVisible();
  await expect(page.getByText('APPROVED-CANDIDATE-ONLY')).toBeVisible();
  await page.waitForTimeout(450);
  await expect(page.getByText('REVIEW-CANDIDATE-ONLY')).toHaveCount(0);
  await expect(page.getByText('APPROVED-CANDIDATE-ONLY')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'This Issue Mode' })).toHaveValue('MANUAL');
});


test('Reviewer action completion cannot repopulate a newly selected Issue with old candidates', async ({ page }) => {
  const items = [
    { issueId: REVIEW_ID, issueCode: 'IO-REVIEW-01', issueStatus: 'DESIGN_REVIEW', objectType: 'tee', sizeCode: 'M', colorCode: 'Black', designJobId: '33333333-3333-3333-3333-333333333333', designState: 'REVIEW', artworkUrl: null, width: 2048, height: 3072, provider: 'OPENAI', model: 'test-model', candidateCount: 1, updatedAt: '2026-08-21T10:00:00.000Z' },
    { issueId: APPROVED_ID, issueCode: 'IO-APPROVED-01', issueStatus: 'DESIGN_REVIEW', objectType: 'tee', sizeCode: 'L', colorCode: 'White', designJobId: '44444444-4444-4444-4444-444444444444', designState: 'REVIEW', artworkUrl: null, width: 2048, height: 3072, provider: 'OPENAI', model: 'test-model', candidateCount: 1, updatedAt: '2026-08-21T10:00:00.000Z' },
  ];
  let reviewStarted = false;
  await page.route('**/ops/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/ops/api/attention') return json(route, { items: [] });
    if (path === '/ops/api/dashboard') return json(route, { sales: { currency: 'USD', today: { orders: 0, grossMinor: 0 }, sevenDays: { orders: 0, grossMinor: 0 }, thirtyDays: { orders: 0, grossMinor: 0 }, lifetime: { orders: 0, grossMinor: 0 }, refundedMinor: 0, averageOrderMinor: 0 }, operations: { paidIssues: 2, designing: 0, review: 1, production: 0, transit: 0, delivered: 0 }, attention: { paymentExceptions: 0, designFailures: 0, manufacturingFailures: 0, notificationFailures: 0, supportOpen: 0 }, activity: [] });
    if (path === '/ops/api/designer') return json(route, { items });
    if (path === '/ops/api/designer/policy') return json(route, { policy: basePolicy });
    if (path === '/ops/api/readiness') return json(route, { checkedAt: '2026-08-21T10:00:00.000Z', readyForSandbox: true, readyForProduction: false, checks: [
      { key: 'openai', label: 'OpenAI', state: 'ready', detail: 'ready' }, { key: 'storage', label: 'Storage', state: 'ready', detail: 'ready' }, { key: 'queues', label: 'Queues', state: 'configured', detail: 'ready' }, { key: 'factory-confirm', label: 'Factory', state: 'safe', detail: 'safe' },
    ] });
    const candidateMatch = path.match(/^\/ops\/api\/designer\/([^/]+)\/candidates$/);
    if (candidateMatch) {
      const id = candidateMatch[1];
      return json(route, { items: [{ id: `candidate-${id}`, issueId: id, generationKey: `g-${id}`, source: 'AI_GENERATED', artworkUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', width: 2048, height: 3072, provider: 'OPENAI', model: 'test-model', safeSummary: id === REVIEW_ID ? 'ACTION-OLD-CANDIDATE' : 'ACTION-NEW-CANDIDATE', selected: true, createdAt: '2026-08-21T10:00:00.000Z' }] });
    }
    const policyMatch = path.match(/^\/ops\/api\/designer\/([^/]+)\/policy$/);
    if (policyMatch) return json(route, { globalVersion: 7, override: null, policy: basePolicy });
    if (path === `/ops/api/designer/${REVIEW_ID}/review` && request.method() === 'POST') {
      reviewStarted = true;
      await new Promise((resolve) => setTimeout(resolve, 300));
      return json(route, { queued: true });
    }
    return json(route, { error: `Unhandled action-race fixture ${path}` }, 500);
  });

  await login(page);
  await page.getByRole('button', { name: 'Designer', exact: true }).click();
  await page.getByRole('button', { name: /IO-REVIEW-01/ }).click();
  await expect(page.getByText('ACTION-OLD-CANDIDATE')).toBeVisible();
  await page.getByRole('button', { name: 'APPROVE', exact: true }).click();
  await expect.poll(() => reviewStarted).toBe(true);
  await page.getByRole('button', { name: /IO-APPROVED-01/ }).click();
  await expect(page.getByText('ACTION-NEW-CANDIDATE')).toBeVisible();
  await page.getByLabel('Revision reason').fill('B-SPECIFIC-FEEDBACK');
  await page.waitForTimeout(500);
  await expect(page.getByText('ISSUE / IO-APPROVED-01')).toBeVisible();
  await expect(page.getByText('ACTION-OLD-CANDIDATE')).toHaveCount(0);
  await expect(page.getByText('ACTION-NEW-CANDIDATE')).toBeVisible();
  await expect(page.getByLabel('Revision reason')).toHaveValue('B-SPECIFIC-FEEDBACK');
  await expect(page.getByRole('status')).toHaveCount(0);
});


test('Reviewer private answer reveal cannot leak into a newly selected Issue', async ({ page }) => {
  const items = [
    { issueId: REVIEW_ID, issueCode: 'IO-REVIEW-A', issueStatus: 'DESIGN_REVIEW', objectType: 'tee', sizeCode: 'M', colorCode: 'Black', designJobId: '33333333-3333-3333-3333-333333333333', designState: 'REVIEW', artworkUrl: null, width: 2048, height: 3072, provider: 'OPENAI', model: 'test-model', candidateCount: 0, updatedAt: '2026-08-21T10:00:00.000Z' },
    { issueId: APPROVED_ID, issueCode: 'IO-REVIEW-B', issueStatus: 'DESIGN_APPROVED', objectType: 'tee', sizeCode: 'L', colorCode: 'White', designJobId: '44444444-4444-4444-4444-444444444444', designState: 'APPROVED', artworkUrl: null, width: 2048, height: 3072, provider: 'OPENAI', model: 'test-model', candidateCount: 0, updatedAt: '2026-08-21T10:00:00.000Z' },
  ];
  await page.route('**/ops/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/ops/api/attention') return json(route, { items: [] });
    if (path === '/ops/api/dashboard') return json(route, { sales: { currency: 'USD', today: { orders: 0, grossMinor: 0 }, sevenDays: { orders: 0, grossMinor: 0 }, thirtyDays: { orders: 0, grossMinor: 0 }, lifetime: { orders: 0, grossMinor: 0 }, refundedMinor: 0, averageOrderMinor: 0 }, operations: { paidIssues: 2, designing: 0, review: 1, production: 0, transit: 0, delivered: 0 }, attention: { paymentExceptions: 0, designFailures: 0, manufacturingFailures: 0, notificationFailures: 0, supportOpen: 0 }, activity: [] });
    if (path === '/ops/api/designer') return json(route, { items });
    if (path === '/ops/api/designer/policy') return json(route, { policy: basePolicy });
    if (path === '/ops/api/readiness') return json(route, { checkedAt: '2026-08-21T10:00:00.000Z', readyForSandbox: true, readyForProduction: false, checks: [
      { key: 'openai', label: 'OpenAI', state: 'ready', detail: 'ready' }, { key: 'storage', label: 'Storage', state: 'ready', detail: 'ready' }, { key: 'queues', label: 'Queues', state: 'configured', detail: 'ready' }, { key: 'factory-confirm', label: 'Factory', state: 'safe', detail: 'safe' },
    ] });
    if (path.endsWith('/candidates')) return json(route, { items: [] });
    if (/\/policy$/.test(path)) return json(route, { globalVersion: 7, override: null, policy: basePolicy });
    if (path === `/ops/api/issues/${REVIEW_ID}/reveal`) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return json(route, { value: [{ slot: 'q1', prompt: 'A prompt', answer: 'PRIVATE-A-ANSWER' }] });
    }
    if (path === `/ops/api/issues/${APPROVED_ID}/reveal`) return json(route, { value: [{ slot: 'q1', prompt: 'B prompt', answer: 'PRIVATE-B-ANSWER' }] });
    return json(route, { error: `Unhandled reviewer-reveal fixture ${request.method()} ${path}` }, 500);
  });

  await login(page);
  await page.getByRole('button', { name: 'Designer', exact: true }).click();
  await page.getByRole('button', { name: /IO-REVIEW-A/ }).click();
  await page.getByRole('button', { name: 'REVEAL ANSWERS' }).click();
  await page.getByRole('button', { name: /IO-REVIEW-B/ }).click();
  await expect(page.getByText('ISSUE / IO-REVIEW-B')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByText('PRIVATE-A-ANSWER')).toHaveCount(0);
});


test('Reviewer per-Issue policy save cannot overwrite a newly selected Issue policy', async ({ page }) => {
  const A = REVIEW_ID;
  const B = APPROVED_ID;
  await page.route('**/ops/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path === '/ops/api/attention') return json(route, { items: [] });
    if (path === '/ops/api/dashboard') return json(route, { sales: { currency: 'USD', today: { orders: 0, grossMinor: 0 }, sevenDays: { orders: 0, grossMinor: 0 }, thirtyDays: { orders: 0, grossMinor: 0 }, lifetime: { orders: 0, grossMinor: 0 }, refundedMinor: 0, averageOrderMinor: 0 }, operations: { paidIssues: 2, designing: 0, review: 1, production: 0, transit: 0, delivered: 0 }, attention: { paymentExceptions: 0, designFailures: 0, manufacturingFailures: 0, notificationFailures: 0, supportOpen: 0 }, activity: [] });
    if (path === '/ops/api/designer' && method === 'GET') return json(route, { items: [
      { issueId: A, issueCode: 'IO-POLICY-A', issueStatus: 'DESIGN_REVIEW', objectType: 'tee', sizeCode: 'M', colorCode: 'Black', designJobId: 'a3333333-3333-4333-8333-333333333333', designState: 'REVIEW', artworkUrl: null, width: 2048, height: 3072, provider: 'OPENAI', model: 'test', candidateCount: 0, updatedAt: '2026-09-09T00:00:00Z' },
      { issueId: B, issueCode: 'IO-POLICY-B', issueStatus: 'DESIGN_APPROVED', objectType: 'tee', sizeCode: 'L', colorCode: 'White', designJobId: 'b4444444-4444-4444-8444-444444444444', designState: 'APPROVED', artworkUrl: null, width: 2048, height: 3072, provider: 'OPENAI', model: 'test', candidateCount: 0, updatedAt: '2026-09-09T00:00:00Z' },
    ] });
    if (path === '/ops/api/designer/policy' && method === 'GET') return json(route, { policy: basePolicy });
    if (path === '/ops/api/readiness') return json(route, { checkedAt: '2026-09-09T00:00:00Z', readyForSandbox: true, readyForProduction: false, checks: [{ key: 'openai', label: 'OpenAI', state: 'ready', detail: 'ready' }, { key: 'storage', label: 'Storage', state: 'ready', detail: 'ready' }, { key: 'queues', label: 'Queues', state: 'configured', detail: 'ready' }, { key: 'factory-confirm', label: 'Factory', state: 'safe', detail: 'safe' }] });
    if (path.endsWith('/candidates')) return json(route, { items: [] });
    if (path === `/ops/api/designer/${A}/policy`) {
      if (method === 'GET') return json(route, { globalVersion: 1, override: null, policy: { ...basePolicy, mode: 'HYBRID' } });
      if (method === 'PUT') {
        await new Promise((resolve) => setTimeout(resolve, 350));
        return json(route, { globalVersion: 1, override: { mode: 'AUTO' }, policy: { ...basePolicy, mode: 'AUTO' } });
      }
    }
    if (path === `/ops/api/designer/${B}/policy` && method === 'GET') return json(route, { globalVersion: 1, override: { mode: 'MANUAL' }, policy: { ...basePolicy, mode: 'MANUAL' } });
    return json(route, { error: `Unhandled policy race ${method} ${path}` }, 500);
  });

  await login(page);
  await page.getByRole('button', { name: 'Designer', exact: true }).click();
  await page.getByRole('button', { name: /IO-POLICY-A/ }).click();
  await expect(page.getByRole('combobox', { name: 'This Issue Mode' })).toHaveValue('INHERIT');
  await page.getByRole('combobox', { name: 'This Issue Mode' }).selectOption('AUTO');
  await page.getByRole('button', { name: /IO-POLICY-B/ }).click();
  await expect(page.getByText('ISSUE / IO-POLICY-B')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'This Issue Mode' })).toHaveValue('MANUAL');
  await page.waitForTimeout(500);
  await expect(page.getByRole('combobox', { name: 'This Issue Mode' })).toHaveValue('MANUAL');
});
