# ISSUED ONCE Integration Readiness + Canonical Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every engineering-controlled launch defect, make MANUAL design a first-class no-OpenAI path, clean pre-launch analytics non-destructively, and cut the canonical domain to a single Hostinger-controlled DNS/hosting/mail stack.

**Architecture:** Add three focused server boundaries: a trusted public-origin resolver, a truthful merchant-readiness parser, and a commercial-metrics baseline parser. Existing routes and Owner OS repositories consume those boundaries instead of inventing their own origin/readiness/cutoff logic. Hostinger becomes the only production DNS authority; Vercel is removed after the nameserver cutover proves healthy.

**Tech Stack:** Next.js 16.2.11, React 19.2.7, TypeScript 5.9, Vitest, Playwright, Neon Postgres, Hostinger, Resend, Printful, Safepay.

**Spec:** `docs/superpowers/specs/2026-09-07-issued-once-integration-readiness-domain-email-design.md`

## Global Constraints

- Preserve the existing mystery storefront and current visual design; no homepage redesign.
- No real Safepay charge/refund in this plan.
- No Printful manufacturing confirmation; `PRINTFUL_ALLOW_CONFIRM` remains disabled.
- No destructive cleanup of production analytics or customer data.
- No invented merchant/legal facts, provider credentials, DNS targets, or email-provider values.
- OpenAI remains optional; MANUAL artwork must remain launch-capable without `OPENAI_API_KEY`.
- Canonical public origin after cutover is exactly `https://issuedonce.shop`.
- Hostinger is the final hosting + DNS + human-mail authority; Vercel is not in the final production stack.
- Preserve the existing verified Resend `otp.issuedonce.shop` sender during migration.
- Node must remain `>=22.12.0`; package manager remains `pnpm@11.23.0`.

---

## File Structure

Create:

- `src/server/http/publicOrigin.ts` — validates/returns the one trusted public origin and builds public URLs.
- `tests/unit/public-origin.test.ts` — hostile/internal origin regression coverage.
- `src/server/ops/commercialMetricsBaseline.ts` — parses and clamps the launch analytics boundary.
- `tests/unit/commercial-metrics-baseline.test.ts` — date validation/clamping coverage.
- `tests/unit/canonical-domain-config.test.ts` — locks the `www` to apex redirect contract.

Modify:

- `src/app/api/payments/create/route.ts` — use trusted public origin for Safepay return base.
- `src/app/payment/return/route.ts` — build `/issue` and `/payment/pending` redirects from trusted public origin.
- `src/app/r/[code]/route.ts` — build `/begin` redirect from trusted public origin.
- `tests/unit/payment-routes.test.ts` — prove Hostinger internal request URLs cannot leak.
- `tests/unit/payment-return-reconciliation.test.ts` — prove return redirect canonicalization.
- `tests/unit/referral-routes.test.ts` — prove referral redirect canonicalization and hostile header resistance.
- `src/server/ops/ReadinessService.ts` — add `design-workflow`, merchant truth, and metrics-baseline readiness.
- `tests/unit/readiness-service.test.ts` — red/green readiness matrix.
- `src/brand/publicMerchant.ts` — canonical merchant validation + owner-attestation gate.
- `tests/unit/merchant-pages.test.tsx` — placeholder/unconfirmed disclosure regressions.
- `src/server/ops/PostgresOpsDashboardRepository.ts` — filter lifetime/live sales by launch baseline.
- `src/server/ops/PostgresOpsSalesRepository.ts` — clamp live/historical windows to launch baseline.
- `tests/unit/ops-dashboard.test.ts` — query/parameter baseline proof.
- `tests/unit/ops-sales.test.ts` — live and bucket cutoff proof.
- `next.config.ts` — host-specific `www.issuedonce.shop` to apex redirect.
- `docs/operations/production-environment.md` — new env contracts.
- `docs/operations/hostinger-deployment.md` — minimal Hostinger-authoritative DNS cutover.
- `.engineering/CONTINUATION.json` — checkpoint only after the implementation/verification cycle is complete.

---

### Task 1: Trusted Public Origin

**Files:**
- Create: `src/server/http/publicOrigin.ts`
- Create: `tests/unit/public-origin.test.ts`
- Modify: `src/app/api/payments/create/route.ts`
- Modify: `src/app/payment/return/route.ts`
- Modify: `src/app/r/[code]/route.ts`
- Modify: `tests/unit/payment-routes.test.ts`
- Modify: `tests/unit/payment-return-reconciliation.test.ts`
- Modify: `tests/unit/referral-routes.test.ts`

**Interfaces:**
- Produces: `resolvePublicOrigin(requestUrl: string, env?: NodeJS.ProcessEnv): string`
- Produces: `buildPublicUrl(pathname: string, requestUrl: string, env?: NodeJS.ProcessEnv): URL`
- Throws: `PublicOriginConfigurationError` when production cannot establish a safe public origin.

- [ ] **Step 1: Write the failing origin-boundary tests**

Create `tests/unit/public-origin.test.ts` with these cases:

```ts
import { expect, test } from 'vitest';
import {
  buildPublicUrl,
  PublicOriginConfigurationError,
  resolvePublicOrigin,
} from '@/server/http/publicOrigin';

test('configured APP_ORIGIN wins over Hostinger internal request origin', () => {
  const env = { NODE_ENV: 'production', APP_ORIGIN: 'https://issuedonce.shop' } as NodeJS.ProcessEnv;
  expect(resolvePublicOrigin('https://0.0.0.0:3000/payment/return', env)).toBe('https://issuedonce.shop');
  expect(buildPublicUrl('/payment/pending', 'https://0.0.0.0:3000/payment/return', env).href)
    .toBe('https://issuedonce.shop/payment/pending');
});

test.each([
  'http://issuedonce.shop',
  'https://user:pass@issuedonce.shop',
  'https://issuedonce.shop/path',
  'https://issuedonce.shop/?q=1',
  'https://issuedonce.shop/#fragment',
  'https://0.0.0.0:3000',
  'https://127.0.0.1',
  'https://10.0.0.2',
  'https://192.168.1.20',
  'https://172.16.4.2',
])('production rejects unsafe APP_ORIGIN %s', (APP_ORIGIN) => {
  expect(() => resolvePublicOrigin('https://0.0.0.0:3000/', { NODE_ENV: 'production', APP_ORIGIN } as NodeJS.ProcessEnv))
    .toThrow(PublicOriginConfigurationError);
});

test('production fails closed when APP_ORIGIN is missing', () => {
  expect(() => resolvePublicOrigin('https://0.0.0.0:3000/', { NODE_ENV: 'production' } as NodeJS.ProcessEnv))
    .toThrow(PublicOriginConfigurationError);
});

test('test/dev may fall back to request origin when APP_ORIGIN is absent', () => {
  expect(resolvePublicOrigin('http://localhost:3000/begin', { NODE_ENV: 'test' } as NodeJS.ProcessEnv))
    .toBe('http://localhost:3000');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
corepack pnpm exec vitest run tests/unit/public-origin.test.ts
```

Expected: FAIL because `@/server/http/publicOrigin` does not exist.

- [ ] **Step 3: Implement the public-origin boundary**

Create `src/server/http/publicOrigin.ts` with this contract:

```ts
export class PublicOriginConfigurationError extends Error {
  constructor(message = 'Public application origin is not configured safely') {
    super(message);
    this.name = 'PublicOriginConfigurationError';
  }
}

function isPrivateIpv4(hostname: string): boolean {
  if (/^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname)) return true;
  const match = hostname.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function isInternalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '0.0.0.0' || host === '::1' || host === '[::1]' ||
    host.startsWith('169.254.') || isPrivateIpv4(host) || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:');
}

function configuredOrigin(value: string, production: boolean): string {
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new PublicOriginConfigurationError();
  }
  if (production && (url.protocol !== 'https:' || isInternalHost(url.hostname))) {
    throw new PublicOriginConfigurationError();
  }
  if (!production && url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) {
    throw new PublicOriginConfigurationError();
  }
  return url.origin;
}

export function resolvePublicOrigin(
  requestUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.APP_ORIGIN?.trim();
  const production = env.NODE_ENV === 'production';
  if (configured) return configuredOrigin(configured, production);
  if (production) throw new PublicOriginConfigurationError();
  return new URL(requestUrl).origin;
}

export function buildPublicUrl(
  pathname: string,
  requestUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): URL {
  return new URL(pathname, `${resolvePublicOrigin(requestUrl, env)}/`);
}
```

- [ ] **Step 4: Run the origin tests GREEN**

```bash
corepack pnpm exec vitest run tests/unit/public-origin.test.ts
```

Expected: PASS.

- [ ] **Step 5: Route payment creation through the helper**

Change `src/app/api/payments/create/route.ts`:

```ts
import { resolvePublicOrigin } from '@/server/http/publicOrigin';
```

Replace:

```ts
const origin = new URL(request.url).origin;
```

with:

```ts
const origin = resolvePublicOrigin(request.url);
```

- [ ] **Step 6: Route payment-return redirects through the helper**

In `src/app/payment/return/route.ts`, import `buildPublicUrl` and replace:

```ts
const response = NextResponse.redirect(new URL(destination, request.url), 303);
```

with:

```ts
const response = NextResponse.redirect(buildPublicUrl(destination, request.url), 303);
```

- [ ] **Step 7: Route referral redirects through the helper**

In `src/app/r/[code]/route.ts`, import `buildPublicUrl` and replace:

```ts
const target = new URL('/begin', request.url);
```

with:

```ts
const target = buildPublicUrl('/begin', request.url);
```

- [ ] **Step 8: Add Hostinger internal-origin route regressions**

In `tests/unit/payment-routes.test.ts`, set `process.env.APP_ORIGIN='https://issuedonce.shop'` for the test and call the route with:

```ts
new Request('https://0.0.0.0:3000/api/payments/create', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    host: 'evil.example',
    'x-forwarded-host': 'evil.example',
    'x-forwarded-proto': 'http',
  },
  body: JSON.stringify({ quoteId: 'quote-1' }),
})
```

Assert:

```ts
expect(start).toHaveBeenCalledWith({
  sessionToken: 'session-token',
  quoteId: 'quote-1',
  returnBaseUrl: 'https://issuedonce.shop',
});
```

In `tests/unit/payment-return-reconciliation.test.ts`, make the request URL internal and assert:

```ts
expect(response.headers.get('location')).toBe('https://issuedonce.shop/payment/pending');
```

In `tests/unit/referral-routes.test.ts`, make the request URL internal with hostile forwarded headers and assert:

```ts
expect(response.headers.get('location')).toBe('https://issuedonce.shop/begin');
```

- [ ] **Step 9: Run all focused route tests**

```bash
corepack pnpm exec vitest run \
  tests/unit/public-origin.test.ts \
  tests/unit/payment-routes.test.ts \
  tests/unit/payment-return-reconciliation.test.ts \
  tests/unit/payment-return-route-reconciliation.test.ts \
  tests/unit/referral-routes.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit Task 1**

```bash
git add src/server/http/publicOrigin.ts src/app/api/payments/create/route.ts src/app/payment/return/route.ts src/app/r/[code]/route.ts tests/unit/public-origin.test.ts tests/unit/payment-routes.test.ts tests/unit/payment-return-reconciliation.test.ts tests/unit/referral-routes.test.ts
git commit -m "fix: trust canonical public origin behind Hostinger"
```

---

### Task 2: Manual-First Design Readiness

**Files:**
- Modify: `src/server/ops/ReadinessService.ts`
- Modify: `tests/unit/readiness-service.test.ts`

**Interfaces:**
- Produces readiness check key: `design-workflow`
- `design-workflow=ready` means manual artwork is launch-capable; `openai` remains an independent capability signal.

- [ ] **Step 1: Add RED readiness tests**

In `tests/unit/readiness-service.test.ts`, add `MERCHANT_PUBLIC_DETAILS_CONFIRMED: 'true'` and `COMMERCIAL_METRICS_BASELINE_DATE: '2026-09-07'` to `completeEnv`, then add:

```ts
test('missing OpenAI keeps manual design workflow ready when private artwork storage is ready', async () => {
  const env = { ...completeEnv };
  delete env.OPENAI_API_KEY;
  const result = await new ReadinessService(healthyDependencies(env)).check();
  expect(result.checks).toContainEqual(expect.objectContaining({ key: 'openai', state: 'missing' }));
  expect(result.checks).toContainEqual(expect.objectContaining({
    key: 'design-workflow', state: 'ready', detail: expect.stringMatching(/manual/i),
  }));
  expect(result.readyForSandbox).toBe(true);
});

test('blocked OpenAI still leaves manual design workflow ready', async () => {
  const env = { ...completeEnv, OPENAI_IMAGE_MODEL: 'gpt-image-2' };
  const result = await new ReadinessService(healthyDependencies(env)).check();
  expect(result.checks).toContainEqual(expect.objectContaining({ key: 'openai', state: 'blocked' }));
  expect(result.checks).toContainEqual(expect.objectContaining({ key: 'design-workflow', state: 'ready' }));
  expect(result.readyForSandbox).toBe(true);
});

test('manual design workflow blocks when durable artwork storage is unavailable', async () => {
  const dependencies = healthyDependencies({ ...completeEnv });
  dependencies.storagePing.mockResolvedValue(false);
  const result = await new ReadinessService(dependencies).check();
  expect(result.checks).toContainEqual(expect.objectContaining({ key: 'storage', state: 'blocked' }));
  expect(result.checks).toContainEqual(expect.objectContaining({ key: 'design-workflow', state: 'blocked' }));
  expect(result.readyForSandbox).toBe(false);
});
```

- [ ] **Step 2: Run RED**

```bash
corepack pnpm exec vitest run tests/unit/readiness-service.test.ts
```

Expected: new tests fail because `design-workflow` does not exist and `readyForSandbox` still requires `openai=ready`.

- [ ] **Step 3: Add `design-workflow` after storage readiness is known**

In `ReadinessService.check()`, after the storage check, compute:

```ts
const openAIState = checks.find((check) => check.key === 'openai')?.state;
const storageState = checks.find((check) => check.key === 'storage')?.state;
checks.push(storageState === 'ready'
  ? {
      key: 'design-workflow',
      label: 'Design workflow',
      state: 'ready',
      detail: openAIState === 'ready'
        ? 'AI and manual artwork workflows are available.'
        : 'Manual artwork workflow is available; AI automation is unavailable.',
    }
  : {
      key: 'design-workflow',
      label: 'Design workflow',
      state: 'blocked',
      detail: 'Manual and AI artwork workflows require durable private artwork storage.',
    });
```

Then change the sandbox aggregate from:

```ts
state('openai') === 'ready' &&
```

to:

```ts
state('design-workflow') === 'ready' &&
```

- [ ] **Step 4: Run readiness + existing design-dispatch tests**

```bash
corepack pnpm exec vitest run tests/unit/readiness-service.test.ts tests/unit/design-dispatch-policy.test.ts tests/unit/manual-artwork-upload.test.ts tests/unit/designer-panel-controls.test.tsx
```

Expected: PASS; existing manual safeguards remain unchanged.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/server/ops/ReadinessService.ts tests/unit/readiness-service.test.ts
git commit -m "fix: treat manual design as launch-ready without OpenAI"
```

---

### Task 3: Truthful Merchant Readiness

**Files:**
- Modify: `src/brand/publicMerchant.ts`
- Modify: `src/server/ops/ReadinessService.ts`
- Modify: `tests/unit/merchant-pages.test.tsx`
- Modify: `tests/unit/readiness-service.test.ts`

**Interfaces:**
- `PublicMerchant` gains `confirmed: boolean` and `invalid: Array<'name'|'supportEmail'|'location'|'legalEntity'>`.
- Invalid merchant values are returned as `null` instead of being rendered as trusted disclosure.

- [ ] **Step 1: Write RED merchant parser tests**

Update `configureMerchant()` in `tests/unit/merchant-pages.test.tsx` to set:

```ts
process.env.MERCHANT_PUBLIC_DETAILS_CONFIRMED = 'true';
```

Add `MERCHANT_PUBLIC_DETAILS_CONFIRMED` to the `afterEach` cleanup list and add:

```ts
test('merchant readiness rejects the observed production placeholders instead of echoing them', () => {
  const merchant = readPublicMerchant({
    MERCHANT_PUBLIC_NAME: 'ISSED ONCE',
    MERCHANT_SUPPORT_EMAIL: 'ADEVOLPER@GMAIL.COM',
    MERCHANT_PUBLIC_LOCATION: 'LOCATION 123',
    MERCHANT_LEGAL_ENTITY: 'EXAMPLE COMPANY',
    MERCHANT_PUBLIC_DETAILS_CONFIRMED: 'true',
  });
  expect(merchant.ready).toBe(false);
  expect(merchant.invalid).toEqual(expect.arrayContaining(['name', 'supportEmail', 'location', 'legalEntity']));
  expect(merchant.name).toBeNull();
  expect(merchant.supportEmail).toBeNull();
  expect(merchant.location).toBeNull();
  expect(merchant.legalEntity).toBeNull();
});

test('valid merchant disclosure still requires explicit owner confirmation', () => {
  const merchant = readPublicMerchant({
    MERCHANT_PUBLIC_NAME: 'ISSUED ONCE',
    MERCHANT_SUPPORT_EMAIL: 'support@issuedonce.shop',
    MERCHANT_PUBLIC_LOCATION: 'Lahore, Pakistan',
  });
  expect(merchant.missing).toEqual([]);
  expect(merchant.invalid).toEqual([]);
  expect(merchant.confirmed).toBe(false);
  expect(merchant.ready).toBe(false);
});
```

- [ ] **Step 2: Run merchant tests RED**

```bash
corepack pnpm exec vitest run tests/unit/merchant-pages.test.tsx
```

Expected: FAIL because confirmation/invalid fields do not exist and placeholders are currently accepted.

- [ ] **Step 3: Implement strict merchant parsing**

In `src/brand/publicMerchant.ts`, extend the type:

```ts
export type PublicMerchant = {
  name: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  location: string | null;
  legalEntity: string | null;
  confirmed: boolean;
  ready: boolean;
  missing: Array<'name' | 'supportEmail' | 'location'>;
  invalid: Array<'name' | 'supportEmail' | 'location' | 'legalEntity'>;
};
```

Add validators:

```ts
const PLACEHOLDER = /\b(?:LOCATION|TBD|TEST|EXAMPLE|PLACEHOLDER)\b/i;

function issuedOnceEmail(value: string | null): string | null {
  const email = validEmail(value);
  if (!email) return null;
  const domain = email.split('@').at(-1)!.toLowerCase();
  return domain === 'issuedonce.shop' || domain.endsWith('.issuedonce.shop') ? email : null;
}

function truthfulText(value: string | null): string | null {
  return value && !PLACEHOLDER.test(value) ? value : null;
}
```

In `readPublicMerchant`:

```ts
const rawName = optional(env.MERCHANT_PUBLIC_NAME);
const rawEmail = optional(env.MERCHANT_SUPPORT_EMAIL);
const rawLocation = optional(env.MERCHANT_PUBLIC_LOCATION);
const rawLegalEntity = optional(env.MERCHANT_LEGAL_ENTITY);
const name = rawName === 'ISSUED ONCE' ? rawName : null;
const supportEmail = issuedOnceEmail(rawEmail);
const location = truthfulText(rawLocation);
const legalEntity = truthfulText(rawLegalEntity);
const confirmed = env.MERCHANT_PUBLIC_DETAILS_CONFIRMED?.trim() === 'true';
const invalid: PublicMerchant['invalid'] = [];
if (rawName && !name) invalid.push('name');
if (rawEmail && !supportEmail) invalid.push('supportEmail');
if (rawLocation && !location) invalid.push('location');
if (rawLegalEntity && !legalEntity) invalid.push('legalEntity');
```

Return `ready: missing.length === 0 && invalid.length === 0 && confirmed`.

- [ ] **Step 4: Make ReadinessService distinguish missing, invalid and unconfirmed**

Replace the current merchant push with:

```ts
checks.push(merchant.ready
  ? {
      key: 'merchant', label: 'Public merchant disclosure', state: 'ready',
      detail: 'Required public merchant identity, support and location disclosures are owner-confirmed.',
    }
  : merchant.invalid.length > 0
    ? {
        key: 'merchant', label: 'Public merchant disclosure', state: 'blocked',
        detail: 'Public merchant disclosure contains invalid or placeholder values.',
      }
    : merchant.missing.length > 0
      ? {
          key: 'merchant', label: 'Public merchant disclosure', state: 'missing',
          detail: 'Required public merchant identity, support or location disclosure is incomplete.',
        }
      : {
          key: 'merchant', label: 'Public merchant disclosure', state: 'blocked',
          detail: 'Public merchant disclosure is configured but owner truthfulness confirmation is missing.',
        });
```

- [ ] **Step 5: Add readiness tests for unconfirmed + placeholder merchant data**

In `tests/unit/readiness-service.test.ts`:

```ts
test('merchant disclosure blocks when owner truthfulness confirmation is missing', async () => {
  const env = { ...completeEnv };
  delete env.MERCHANT_PUBLIC_DETAILS_CONFIRMED;
  const result = await new ReadinessService(healthyDependencies(env)).check();
  expect(result.checks).toContainEqual(expect.objectContaining({
    key: 'merchant', state: 'blocked', detail: expect.stringMatching(/confirmation/i),
  }));
  expect(result.readyForSandbox).toBe(false);
});

test('merchant disclosure blocks observed placeholder production values', async () => {
  const env = {
    ...completeEnv,
    MERCHANT_PUBLIC_NAME: 'ISSED ONCE',
    MERCHANT_SUPPORT_EMAIL: 'ADEVOLPER@GMAIL.COM',
    MERCHANT_PUBLIC_LOCATION: 'LOCATION 123',
  };
  const result = await new ReadinessService(healthyDependencies(env)).check();
  expect(result.checks).toContainEqual(expect.objectContaining({
    key: 'merchant', state: 'blocked', detail: expect.stringMatching(/invalid|placeholder/i),
  }));
  expect(result.readyForSandbox).toBe(false);
});
```

- [ ] **Step 6: Run focused merchant/readiness tests**

```bash
corepack pnpm exec vitest run tests/unit/merchant-pages.test.tsx tests/unit/readiness-service.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/brand/publicMerchant.ts src/server/ops/ReadinessService.ts tests/unit/merchant-pages.test.tsx tests/unit/readiness-service.test.ts
git commit -m "fix: require truthful merchant disclosure"
```

---

### Task 4: Non-Destructive Commercial Metrics Baseline

**Files:**
- Create: `src/server/ops/commercialMetricsBaseline.ts`
- Create: `tests/unit/commercial-metrics-baseline.test.ts`
- Modify: `src/server/ops/PostgresOpsDashboardRepository.ts`
- Modify: `src/server/ops/PostgresOpsSalesRepository.ts`
- Modify: `src/server/ops/ReadinessService.ts`
- Modify: `tests/unit/ops-dashboard.test.ts`
- Modify: `tests/unit/ops-sales.test.ts`
- Modify: `tests/unit/readiness-service.test.ts`

**Interfaces:**
- Produces: `readCommercialMetricsBaseline(env?: NodeJS.ProcessEnv): Date | null`
- Produces: `clampMetricsCutoff(requested: Date | null, baseline: Date | null): Date | null`
- Throws: `CommercialMetricsBaselineError` for malformed/impossible dates.

- [ ] **Step 1: Write RED baseline parser tests**

Create `tests/unit/commercial-metrics-baseline.test.ts`:

```ts
import { expect, test } from 'vitest';
import {
  clampMetricsCutoff,
  CommercialMetricsBaselineError,
  readCommercialMetricsBaseline,
} from '@/server/ops/commercialMetricsBaseline';

test('missing baseline is null', () => {
  expect(readCommercialMetricsBaseline({} as NodeJS.ProcessEnv)).toBeNull();
});

test('valid baseline is midnight UTC', () => {
  expect(readCommercialMetricsBaseline({ COMMERCIAL_METRICS_BASELINE_DATE: '2026-09-07' } as NodeJS.ProcessEnv)?.toISOString())
    .toBe('2026-09-07T00:00:00.000Z');
});

test.each(['2026-9-7', '2026-02-30', 'not-a-date'])('invalid baseline %s fails closed', (value) => {
  expect(() => readCommercialMetricsBaseline({ COMMERCIAL_METRICS_BASELINE_DATE: value } as NodeJS.ProcessEnv))
    .toThrow(CommercialMetricsBaselineError);
});

test('clamp chooses the later boundary', () => {
  const baseline = new Date('2026-09-07T00:00:00.000Z');
  expect(clampMetricsCutoff(new Date('2026-08-01T00:00:00.000Z'), baseline)?.toISOString())
    .toBe('2026-09-07T00:00:00.000Z');
  expect(clampMetricsCutoff(new Date('2026-09-10T00:00:00.000Z'), baseline)?.toISOString())
    .toBe('2026-09-10T00:00:00.000Z');
});
```

- [ ] **Step 2: Run RED**

```bash
corepack pnpm exec vitest run tests/unit/commercial-metrics-baseline.test.ts
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement baseline parsing/clamping**

Create `src/server/ops/commercialMetricsBaseline.ts`:

```ts
export class CommercialMetricsBaselineError extends Error {
  constructor(message = 'Commercial metrics baseline date is invalid') {
    super(message);
    this.name = 'CommercialMetricsBaselineError';
  }
}

export function readCommercialMetricsBaseline(env: NodeJS.ProcessEnv = process.env): Date | null {
  const raw = env.COMMERCIAL_METRICS_BASELINE_DATE?.trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new CommercialMetricsBaselineError();
  const value = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== raw) {
    throw new CommercialMetricsBaselineError();
  }
  return value;
}

export function clampMetricsCutoff(requested: Date | null, baseline: Date | null): Date | null {
  if (!requested) return baseline;
  if (!baseline) return requested;
  return requested.getTime() >= baseline.getTime() ? requested : baseline;
}
```

- [ ] **Step 4: Run helper tests GREEN**

```bash
corepack pnpm exec vitest run tests/unit/commercial-metrics-baseline.test.ts
```

Expected: PASS.

- [ ] **Step 5: Inject baseline into Dashboard repository**

Change the constructor in `PostgresOpsDashboardRepository.ts`:

```ts
import { readCommercialMetricsBaseline } from './commercialMetricsBaseline';

constructor(
  private readonly sql: SqlExecutor,
  private readonly baseline: Date | null = readCommercialMetricsBaseline(),
) {}
```

Pass `this.baseline?.toISOString().slice(0, 10) ?? null` into the lifetime-bucket query and add:

```sql
AND ($1::date IS NULL OR bucket_day >= $1::date)
```

For the bounded live-sales query, add a second parameter and clamp every live interval in SQL using the baseline:

```sql
GREATEST(bounds.today_start, COALESCE($2::timestamptz, bounds.today_start))
GREATEST(bounds.seven_start, COALESCE($2::timestamptz, bounds.seven_start))
GREATEST(bounds.thirty_start, COALESCE($2::timestamptz, bounds.thirty_start))
```

Pass `[now, this.baseline?.toISOString() ?? null]`.

- [ ] **Step 6: Add Dashboard baseline assertions**

Update `tests/unit/ops-dashboard.test.ts` to collect query params as well as text, construct:

```ts
const baseline = new Date('2026-09-07T00:00:00.000Z');
const dashboard = await new PostgresOpsDashboardRepository(sql, baseline)
  .getDashboard(new Date('2026-09-10T06:00:00Z'));
```

Assert:

```ts
expect(queries[0].text).toContain('GREATEST');
expect(queries[0].params).toContain('2026-09-07T00:00:00.000Z');
expect(queries[1].text).toContain('bucket_day >= $1::date');
expect(queries[1].params).toEqual(['2026-09-07']);
```

- [ ] **Step 7: Clamp Sales repository live and bucket windows**

Change `PostgresOpsSalesRepository` constructor:

```ts
import { clampMetricsCutoff, readCommercialMetricsBaseline } from './commercialMetricsBaseline';

constructor(
  private readonly sql: SqlExecutor,
  private readonly baseline: Date | null = readCommercialMetricsBaseline(),
) {}
```

In `getBucketSnapshot` replace the cutoff calculation with:

```ts
const requested = days >= 3650 ? null : new Date(now.getTime() - days * 86_400_000);
const cutoff = clampMetricsCutoff(requested, this.baseline);
```

In `getLiveSnapshot` replace:

```ts
const cutoff = new Date(now.getTime() - days * 86_400_000);
```

with:

```ts
const requested = new Date(now.getTime() - days * 86_400_000);
const cutoff = clampMetricsCutoff(requested, this.baseline) ?? requested;
```

All existing live queries already share the same `$1` cutoff, so no further SQL duplication is required.

- [ ] **Step 8: Add Sales baseline assertions**

Add a 90-day bucket test using baseline `2026-09-07` and assert query params contain `2026-09-07` rather than the older requested date. Add a 30-day live test and assert all seven live queries receive the same baseline-clamped `Date` argument.

Use concrete assertions:

```ts
expect(bucketParams).toEqual(['2026-09-07']);
expect(liveParams).toHaveLength(7);
for (const params of liveParams) {
  expect(params[0]).toEqual(new Date('2026-09-07T00:00:00.000Z'));
}
```

- [ ] **Step 9: Add readiness state for the baseline**

In `ReadinessService.ts`, import the parser and before calculating aggregate readiness add:

```ts
try {
  const baseline = readCommercialMetricsBaseline(this.env);
  checks.push(baseline
    ? {
        key: 'commercial-metrics', label: 'Commercial metrics baseline', state: 'ready',
        detail: `Commercial analytics start at ${baseline.toISOString().slice(0, 10)}.`,
      }
    : {
        key: 'commercial-metrics', label: 'Commercial metrics baseline', state: 'missing',
        detail: 'A launch analytics baseline date is required before commercial readiness.',
      });
} catch {
  checks.push({
    key: 'commercial-metrics', label: 'Commercial metrics baseline', state: 'blocked',
    detail: 'COMMERCIAL_METRICS_BASELINE_DATE must be a real YYYY-MM-DD date.',
  });
}
```

Add:

```ts
state('commercial-metrics') === 'ready' &&
```

to `readyForSandbox`.

- [ ] **Step 10: Add readiness RED/GREEN coverage for baseline**

In `readiness-service.test.ts`, ensure `completeEnv` has:

```ts
COMMERCIAL_METRICS_BASELINE_DATE: '2026-09-07',
```

and add:

```ts
test('malformed commercial metrics baseline blocks readiness', async () => {
  const result = await new ReadinessService(healthyDependencies({
    ...completeEnv,
    COMMERCIAL_METRICS_BASELINE_DATE: '2026-02-30',
  })).check();
  expect(result.checks).toContainEqual(expect.objectContaining({ key: 'commercial-metrics', state: 'blocked' }));
  expect(result.readyForSandbox).toBe(false);
});
```

- [ ] **Step 11: Run all analytics/readiness tests**

```bash
corepack pnpm exec vitest run \
  tests/unit/commercial-metrics-baseline.test.ts \
  tests/unit/ops-dashboard.test.ts \
  tests/unit/ops-sales.test.ts \
  tests/unit/readiness-service.test.ts
```

Expected: PASS.

- [ ] **Step 12: Commit Task 4**

```bash
git add src/server/ops/commercialMetricsBaseline.ts src/server/ops/PostgresOpsDashboardRepository.ts src/server/ops/PostgresOpsSalesRepository.ts src/server/ops/ReadinessService.ts tests/unit/commercial-metrics-baseline.test.ts tests/unit/ops-dashboard.test.ts tests/unit/ops-sales.test.ts tests/unit/readiness-service.test.ts
git commit -m "fix: isolate prelaunch commercial analytics"
```

---

### Task 5: Canonical Domain + Environment Contracts

**Files:**
- Create: `tests/unit/canonical-domain-config.test.ts`
- Modify: `next.config.ts`
- Modify: `docs/operations/production-environment.md`
- Modify: `docs/operations/hostinger-deployment.md`

**Interfaces:**
- `www.issuedonce.shop/*` permanently redirects to `https://issuedonce.shop/*`.
- Hostinger is authoritative DNS after cutover; no Vercel DNS export/import step exists.

- [ ] **Step 1: Write RED canonical redirect test**

Create `tests/unit/canonical-domain-config.test.ts`:

```ts
import { expect, test } from 'vitest';
import nextConfig from '../../next.config';

test('www canonicalizes to apex without a Vercel dependency', async () => {
  expect(nextConfig.redirects).toBeTypeOf('function');
  const rules = await nextConfig.redirects!();
  expect(rules).toContainEqual({
    source: '/:path*',
    has: [{ type: 'host', value: 'www.issuedonce.shop' }],
    destination: 'https://issuedonce.shop/:path*',
    permanent: true,
  });
});
```

- [ ] **Step 2: Run RED**

```bash
corepack pnpm exec vitest run tests/unit/canonical-domain-config.test.ts
```

Expected: FAIL because `nextConfig.redirects` is undefined.

- [ ] **Step 3: Add the host-specific redirect**

In `next.config.ts`, add alongside `headers`:

```ts
redirects: async () => [
  {
    source: '/:path*',
    has: [{ type: 'host', value: 'www.issuedonce.shop' }],
    destination: 'https://issuedonce.shop/:path*',
    permanent: true,
  },
],
```

- [ ] **Step 4: Run config/security tests**

```bash
corepack pnpm exec vitest run tests/unit/canonical-domain-config.test.ts tests/unit/security-headers.test.ts tests/unit/hostinger-proxy-security-headers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update production environment documentation**

Document these exact contracts in `docs/operations/production-environment.md`:

```text
APP_ORIGIN=https://issuedonce.shop
MERCHANT_PUBLIC_DETAILS_CONFIRMED=true
COMMERCIAL_METRICS_BASELINE_DATE=YYYY-MM-DD
RESEND_FROM_EMAIL=ISSUED ONCE <notify@issuedonce.shop>
SUPPORT_INBOX_EMAIL=support@issuedonce.shop
SUPPORT_REPLY_TO=support@issuedonce.shop
MERCHANT_SUPPORT_EMAIL=support@issuedonce.shop
```

State explicitly that the merchant confirmation flag may only be set after the owner supplies truthful public values and that the metrics baseline may only be set after read-only production corroboration of the prelaunch boundary.

- [ ] **Step 6: Replace the Hostinger deployment DNS runbook with the minimal flow**

`docs/operations/hostinger-deployment.md` must say:

```text
1. Prove the candidate release on the temporary Hostinger hostname.
2. Create support@issuedonce.shop and aliases in Hostinger Mail.
3. Attach issuedonce.shop to the existing Hostinger app.
4. In Domains -> DNS / Nameservers choose Use Hostinger nameservers.
5. Once Hostinger is authoritative, Reset DNS Records to Hostinger defaults.
6. Restore only the verified Resend OTP records from the connected Resend domain:
   - TXT resend._domainkey.otp
   - MX send.otp -> feedback-smtp.ap-northeast-1.amazonses.com priority 10
   - TXT send.otp -> v=spf1 include:amazonses.com ~all
7. Add the exact root-domain Resend records returned when issuedonce.shop is created/verified in Resend.
8. Add DMARC at _dmarc only after the dmarc@ mailbox/alias exists.
9. Verify apex/www TLS, exact release identity, Hostinger Mail receipt, and otp.issuedonce.shop Resend verification.
10. Set APP_ORIGIN=https://issuedonce.shop and rerun full consumer + Owner OS proof.
11. Update Safepay/Printful callback/webhook URLs to the canonical domain.
12. Vercel is no longer required for ISSUED ONCE after the above proof.
```

The runbook must explicitly say: **do not export/import the stale Vercel web zone; preserve only records with an identified production purpose.**

- [ ] **Step 7: Commit Task 5**

```bash
git add next.config.ts tests/unit/canonical-domain-config.test.ts docs/operations/production-environment.md docs/operations/hostinger-deployment.md
git commit -m "docs: make Hostinger the canonical domain authority"
```

---

### Task 6: Whole-Tree Verification and Continuation Checkpoint

**Files:**
- Modify after proof: `.engineering/CONTINUATION.json`

**Interfaces:**
- Produces a verified implementation head suitable for PR/review.
- Does not deploy, change DNS, charge Safepay, refund, or confirm Printful manufacturing.

- [ ] **Step 1: Run focused regression bundle**

```bash
corepack pnpm exec vitest run \
  tests/unit/public-origin.test.ts \
  tests/unit/payment-routes.test.ts \
  tests/unit/payment-return-reconciliation.test.ts \
  tests/unit/payment-return-route-reconciliation.test.ts \
  tests/unit/referral-routes.test.ts \
  tests/unit/readiness-service.test.ts \
  tests/unit/design-dispatch-policy.test.ts \
  tests/unit/manual-artwork-upload.test.ts \
  tests/unit/merchant-pages.test.tsx \
  tests/unit/commercial-metrics-baseline.test.ts \
  tests/unit/ops-dashboard.test.ts \
  tests/unit/ops-sales.test.ts \
  tests/unit/canonical-domain-config.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full unit suite**

```bash
corepack pnpm test
```

Expected: every test passes.

- [ ] **Step 3: Run typecheck**

```bash
corepack pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 4: Run lint**

```bash
corepack pnpm lint
```

Expected: exit 0; no new warnings attributable to this change.

- [ ] **Step 5: Run production build**

```bash
corepack pnpm build
```

Expected: exit 0.

- [ ] **Step 6: Run consumer + Owner OS browser suites against the local built candidate**

```bash
corepack pnpm exec playwright test tests/e2e/public-physical-flow.spec.ts tests/e2e/owner-os.spec.ts tests/e2e/designer-controls.spec.ts
```

Expected: PASS on configured desktop/mobile projects in the repository Playwright config.

- [ ] **Step 7: Audit changed public URL constructors**

Run:

```bash
grep -RInE "new URL\([^,]+, request\.url\)|new URL\(request\.url\)\.origin" src/app src/server
```

Expected: no customer-facing absolute URL constructor still derives authority from `request.url`; query parsing uses such as `new URL(request.url).searchParams` may remain because they do not choose the public origin.

- [ ] **Step 8: Update continuation checkpoint with verified facts only**

Update `.engineering/CONTINUATION.json` to record:

```json
{
  "activeTask": {
    "consumerReadinessId": "CR-28",
    "status": "CODE_READY_PENDING_EXTERNAL_CANONICAL_CUTOVER",
    "engineeringSafeWork": "COMPLETE_FOR_THIS_DEFECT_SET"
  }
}
```

Preserve all unrelated existing keys/ledgers. Add exact implementation head, test counts, commands, and remaining external gates. Do not claim the canonical domain, merchant truth, Safepay production, Printful webhook, or live email are complete until observed.

- [ ] **Step 9: Commit verification/checkpoint update**

```bash
git add .engineering/CONTINUATION.json
git commit -m "docs: checkpoint integration readiness implementation"
```

- [ ] **Step 10: Push branch and open focused PR to integration**

```bash
git push -u origin HEAD
```

Open a PR from the implementation branch to `infra/hostinger-migration-20260823` with the exact test/build evidence. Do not merge until repository gates are green.

---

## External Cutover After Code Merge — Minimal Owner Work

This is deliberately short. There is no Vercel migration project.

1. Create `support@issuedonce.shop` in Hostinger Mail plus the approved aliases.
2. Attach `issuedonce.shop` to the existing Hostinger application.
3. In Hostinger choose **Use Hostinger nameservers**.
4. Reset the Hostinger DNS zone to defaults.
5. Restore the three existing `otp.issuedonce.shop` Resend records from the connected Resend account.
6. Create/verify the root `issuedonce.shop` sender in Resend and add only the records Resend returns.
7. Verify web + email; then set `APP_ORIGIN=https://issuedonce.shop`.
8. Configure Printful and Safepay canonical webhooks when their production credentials are available.
9. Retire Vercel for ISSUED ONCE only after DNS/TLS/mail/live-release proof is green.

No DNS export/import, no parallel DNS provider, no duplicate mailbox estate, no OpenAI dependency, and no destructive analytics reset.
