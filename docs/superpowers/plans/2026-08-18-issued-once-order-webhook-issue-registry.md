# Paid Order Webhook & Private Issue Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a verified Fourthwall `ORDER_PLACED` event into exactly one durable private `RESERVED` ISSUED ONCE Issue, with no customer PII or quiz content persisted in the webhook/Issue subsystem.

**Architecture:** The public checkout correlates to ISSUED ONCE only through opaque `io_quote_id`. A signed Fourthwall webhook is authenticated from raw bytes, durably recorded in an idempotent event inbox, then processed against server-owned quote/variant truth. Postgres uniqueness and expected-state writes are the concurrency authority; Issue IDs are random, non-sequential, permanent, and collision-safe.

**Tech Stack:** Next.js 16.2.11, React 19.2.7, TypeScript 5.9, Vitest, Playwright, PostgreSQL/Neon via `@neondatabase/serverless`, Node `crypto`, Zod 4.

**Spec:** `docs/superpowers/specs/2026-08-18-issued-once-order-webhook-issue-registry-design.md`

## Global Constraints

- Repository/branch source of truth: `itxsam57/issued-once` / `feat/mystery-foundation`.
- `ORDER_PLACED` is paid-order truth; checkout button/redirect is not paid-order truth.
- Verify `X-Fourthwall-Hmac-SHA256` over the exact raw body before JSON trust or durable write.
- `testMode: true` must never create a production Issue.
- Fourthwall cart metadata contains only `io_quote_id`; no `experience_id`, raw session token, quiz content, or customer identity.
- `webhook_events` and `issues` must not persist customer name, email, shipping address, payment details, message, or quiz answers.
- Issue IDs are random, non-sequential, never reused, and database uniqueness is authoritative.
- Invalid signature: 401 and zero writes. Authenticated terminal mismatch: durable terminal classification then 200/no Issue. Retryable infrastructure failure: 503.
- Preview/test runtime must remain structurally incapable of creating production Issues.
- Update `.engineering/CONTINUATION.json` after each meaningful cycle.

---

### Task 1: Close the current checkout metadata privacy RED

**Files:**
- Modify: `src/server/checkout/CheckoutService.ts`
- Test: `tests/unit/checkout-service.test.ts`

**Interfaces:**
- Consumes: existing `CheckoutQuoteRecord` and `CommerceGateway.createCart()`.
- Produces: cart metadata exactly `{ io_quote_id: quote.id }`.

- [ ] **Step 1: Verify the existing failing test**

Run: `pnpm test -- tests/unit/checkout-service.test.ts`

Expected: FAIL because production code still sends `io_experience_id` while the test requires one opaque correlation key.

- [ ] **Step 2: Make the minimal implementation change**

Change the cart call to:

```ts
const cart = await this.commerce.createCart({
  variantId: quote.variantId,
  quantity: 1,
  currency: quote.currency,
  metadata: {
    io_quote_id: quote.id,
  },
});
```

- [ ] **Step 3: Verify GREEN**

Run:

```bash
pnpm test -- tests/unit/checkout-service.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/server/checkout/CheckoutService.ts tests/unit/checkout-service.test.ts
git commit -m "security: minimize Fourthwall cart correlation metadata"
```

---

### Task 2: Authenticate exact Fourthwall raw webhook bytes and parse a strict envelope

**Files:**
- Create: `src/server/webhooks/FourthwallWebhookSignature.ts`
- Create: `src/server/webhooks/FourthwallWebhookEnvelope.ts`
- Test: `tests/unit/fourthwall-webhook-signature.test.ts`
- Test: `tests/unit/fourthwall-webhook-envelope.test.ts`

**Interfaces:**
- Produces: `verifyFourthwallWebhookSignature(rawBody: Uint8Array, signature: string, secret: string): boolean`.
- Produces: `parseFourthwallWebhookEnvelope(rawBody: Uint8Array): FourthwallWebhookEnvelope`.
- `FourthwallWebhookEnvelope` contains only envelope/order-correlation facts required by later tasks: `id`, `webhookId`, `shopId`, `type`, `apiVersion`, `createdAt`, `testMode`, `orderId`, `metadata`.

- [ ] **Step 1: Write RED signature tests**

```ts
import { createHmac } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { verifyFourthwallWebhookSignature } from '@/server/webhooks/FourthwallWebhookSignature';

const secret = 'webhook-secret';
const raw = Buffer.from('{"id":"evt-1"}', 'utf8');
const valid = createHmac('sha256', secret).update(raw).digest('base64');

describe('verifyFourthwallWebhookSignature', () => {
  test('accepts the exact raw body and rejects any byte change', () => {
    expect(verifyFourthwallWebhookSignature(raw, valid, secret)).toBe(true);
    expect(verifyFourthwallWebhookSignature(Buffer.from('{"id":"evt-2"}'), valid, secret)).toBe(false);
  });
});
```

Run: `pnpm test -- tests/unit/fourthwall-webhook-signature.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement constant-time HMAC verification**

Use Node `createHmac`, decode both signatures to bytes, require equal byte lengths, and call `timingSafeEqual`; malformed base64 returns `false`.

- [ ] **Step 3: Write RED envelope tests**

Test one valid `ORDER_PLACED` body and one body that contains customer `email`, `shipping`, and `message`; assert the returned object does not contain those fields and extracts only `data.id` plus `data.metadata`.

- [ ] **Step 4: Implement strict Zod parsing**

Use a Zod schema with:

```ts
const envelopeSchema = z.object({
  id: z.string().min(1),
  webhookId: z.string().min(1),
  shopId: z.string().min(1),
  type: z.string().min(1),
  apiVersion: z.string().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  testMode: z.boolean(),
  data: z.object({
    id: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).default({}),
  }).passthrough(),
}).passthrough();
```

Map the parsed object into a minimized application shape instead of returning the provider object.

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm test -- tests/unit/fourthwall-webhook-signature.test.ts tests/unit/fourthwall-webhook-envelope.test.ts
pnpm typecheck
```

Expected: PASS.

Commit: `feat: verify and minimize Fourthwall webhook envelopes`.

---

### Task 3: Generate permanent random Issue IDs with collision-safe semantics

**Files:**
- Create: `src/server/issues/IssueCode.ts`
- Test: `tests/unit/issue-code.test.ts`

**Interfaces:**
- Produces: `generateIssueCode(randomBytes?: (size: number) => Uint8Array): string`.
- Format: `IO-XXXX-XXXX` using alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ`.

- [ ] **Step 1: Write RED tests**

Assert:

```ts
expect(code).toMatch(/^IO-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
expect(code).not.toMatch(/[01ILO]/);
```

Inject deterministic bytes to prove formatting does not depend on time, order count, or a database sequence.

- [ ] **Step 2: Implement cryptographic generation**

Default to `randomBytes(8)` from `node:crypto`; map bytes modulo the unambiguous alphabet length. Do not query the database in this module.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test -- tests/unit/issue-code.test.ts && pnpm typecheck`

Expected: PASS.

Commit: `feat: add random permanent Issue IDs`.

---

### Task 4: Add durable event inbox and private Issue registry schema

**Files:**
- Create: `db/migrations/0005_webhook_issue_registry.sql`
- Create: `src/server/issues/PaidOrderRepository.ts`
- Create: `src/server/issues/PostgresPaidOrderRepository.ts`
- Test: `tests/unit/postgres-paid-order-repository.test.ts`

**Interfaces:**
- Produces `WebhookInboxRecord`, `PaidOrderReservationInput`, `PaidOrderReservationResult`.
- Produces repository methods:

```ts
interface PaidOrderRepository {
  recordAuthenticatedEvent(event: AuthenticatedOrderEvent): Promise<WebhookInboxRecord>;
  markIgnoredTest(providerEventId: string, now: Date): Promise<void>;
  reservePaidOrder(input: PaidOrderReservationInput): Promise<PaidOrderReservationResult>;
  markTerminalFailure(providerEventId: string, failureCode: string, now: Date): Promise<void>;
  markRetryableFailure(providerEventId: string, failureCode: string, now: Date): Promise<void>;
}
```

- [ ] **Step 1: Write the migration**

Create `webhook_events` with a unique `(provider, provider_event_id)` constraint and statuses:

`RECEIVED`, `PROCESSING`, `PROCESSED`, `FAILED_RETRYABLE`, `FAILED_TERMINAL`, `IGNORED_TEST`.

Create `issues` with:

```sql
issue_code text NOT NULL UNIQUE,
status text NOT NULL CHECK (status IN ('RESERVED')),
fourthwall_order_id text NOT NULL UNIQUE,
fourthwall_event_id text NOT NULL UNIQUE,
quote_id uuid NOT NULL UNIQUE REFERENCES checkout_quotes(id),
product_slug text NOT NULL,
variant_id text NOT NULL,
size_code text NOT NULL,
color_code text NOT NULL,
reserved_at timestamptz NOT NULL,
updated_at timestamptz NOT NULL
```

Do not add customer identity or quiz columns.

- [ ] **Step 2: Write RED repository SQL-contract tests**

Use a mocked `SqlExecutor.query` to assert `recordAuthenticatedEvent` uses `ON CONFLICT (provider, provider_event_id) DO UPDATE/NOTHING` idempotently and does not serialize the raw payload.

For `reservePaidOrder`, assert the generated SQL reads `checkout_quotes` and `experience_physical_selections` by server-owned `quote_id/experience_id`, inserts one `issues` row, and marks the inbox row `PROCESSED` in one PostgreSQL statement/CTE so the statement is atomic.

- [ ] **Step 3: Implement `PostgresPaidOrderRepository`**

Use one SQL statement for reservation truth. Return one of:

```ts
type PaidOrderReservationResult =
  | { kind: 'reserved'; issueCode: string }
  | { kind: 'duplicate'; issueCode: string }
  | { kind: 'quote-mismatch' };
```

The SQL must refuse provider payload product/variant values; those values are not parameters to `reservePaidOrder` except order/event/quote identity and candidate issue code.

- [ ] **Step 4: Verify and commit**

Run:

```bash
pnpm test -- tests/unit/postgres-paid-order-repository.test.ts
pnpm typecheck
```

Expected: PASS.

Commit: `feat: add paid-order event inbox and private Issue registry`.

---

### Task 5: Process an authenticated paid order idempotently

**Files:**
- Create: `src/server/issues/PaidOrderWebhookService.ts`
- Test: `tests/unit/paid-order-webhook-service.test.ts`

**Interfaces:**
- Consumes: `PaidOrderRepository`, `CheckoutQuoteRepository`, `generateIssueCode`.
- Produces:

```ts
type PaidOrderWebhookOutcome =
  | { kind: 'processed'; issueCode: string }
  | { kind: 'duplicate'; issueCode: string }
  | { kind: 'ignored-test' }
  | { kind: 'terminal'; code: string };
```

- [ ] **Step 1: Write RED behavior tests**

Cover all of these independently:

1. `testMode: true` records `IGNORED_TEST` and never calls reservation.
2. Missing/non-string `io_quote_id` becomes `FAILED_TERMINAL:MISSING_QUOTE_ID` and creates no Issue.
3. Unknown quote becomes `FAILED_TERMINAL:UNKNOWN_QUOTE` and creates no Issue.
4. Normal real event calls reservation using only event/order/quote IDs and a generated Issue code.
5. Duplicate result returns the existing Issue code and does not generate another commercial Issue.
6. A simulated unique Issue-code conflict triggers a bounded retry, max 5 candidates.
7. Exhausted collisions mark `FAILED_RETRYABLE:ISSUE_ID_COLLISION_BUDGET` and throw a retryable error.

- [ ] **Step 2: Implement minimal service**

Use dependency injection for generator and clock. Never accept product, variant, price, customer email, or address as service inputs.

- [ ] **Step 3: Verify and commit**

Run:

```bash
pnpm test -- tests/unit/paid-order-webhook-service.test.ts
pnpm typecheck
```

Expected: PASS.

Commit: `feat: reserve one private Issue from paid-order truth`.

---

### Task 6: Add fail-closed runtime and signed Next.js webhook route

**Files:**
- Create: `src/server/issues/runtimePaidOrders.ts`
- Create: `src/app/api/webhooks/fourthwall/route.ts`
- Test: `tests/unit/runtime-paid-orders.test.ts`
- Test: `tests/unit/fourthwall-webhook-route.test.ts`

**Interfaces:**
- Runtime requires `DATABASE_URL`, `FOURTHWALL_WEBHOOK_SECRET`, and `FOURTHWALL_SHOP_ID`.
- Route consumes no browser/session cookie.

- [ ] **Step 1: Write RED runtime tests**

Assert missing any required production env throws `PaidOrderRuntimeUnavailableError`. Do not provide an in-memory production fallback.

- [ ] **Step 2: Implement runtime**

Construct one Neon `SqlExecutor`, `PostgresPaidOrderRepository`, existing `PostgresCheckoutQuoteRepository`, and `PaidOrderWebhookService`.

- [ ] **Step 3: Write RED route tests**

Test exact HTTP behavior:

```ts
invalid signature -> 401, service not called
valid signature + malformed JSON -> 400, no Issue
valid signature + wrong shop -> 200 terminal acknowledgement, no Issue
valid signature + testMode -> 200 ignored-test
valid signature + processed/duplicate -> 200
retryable processing error -> 503
```

The test must construct the signature from the exact raw JSON string used in the Request body.

- [ ] **Step 4: Implement route**

Use:

```ts
const raw = new Uint8Array(await request.arrayBuffer());
const signature = request.headers.get('x-fourthwall-hmac-sha256');
```

Verify before `JSON.parse`. Never log `raw`, parsed `data`, signature, secret, email, address, or message.

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm test -- tests/unit/runtime-paid-orders.test.ts tests/unit/fourthwall-webhook-route.test.ts
pnpm typecheck
```

Expected: PASS.

Commit: `feat: add signed Fourthwall paid-order webhook endpoint`.

---

### Task 7: Prove replay, privacy, and concurrency invariants across the subsystem

**Files:**
- Create: `tests/unit/paid-order-privacy.test.ts`
- Create: `tests/integration/paid-order-webhook.integration.test.ts`
- Modify if necessary: `vitest.config.ts` only to include the integration file without changing browser discovery rules.

**Interfaces:**
- Uses the route/service/repository contracts from Tasks 2–6.

- [ ] **Step 1: Add privacy regression tests**

Create a Fourthwall-shaped event containing `email`, `message`, shipping/address objects, and payload product/price overrides. Assert:

- persisted repository arguments never include those values;
- issue facts come from the stored quote/physical selection;
- cart metadata remains only `io_quote_id`.

- [ ] **Step 2: Add duplicate/replay integration tests**

Run the same signed event twice against an isolated repository fixture and assert one event identity and one Issue reservation.

Run two concurrent service calls with the same provider event/order identity and assert one final Issue code.

- [ ] **Step 3: Run the complete quality gate**

```bash
pnpm test
pnpm typecheck
pnpm test:e2e
```

Expected: all existing mystery UI/browser tests remain GREEN and webhook tests pass.

- [ ] **Step 4: Commit**

Commit: `test: harden paid-order replay and privacy invariants`.

---

### Task 8: Verify migration on Neon and publish a customer-testable front page

**Files:**
- Modify: `.engineering/CONTINUATION.json`
- No product-code change unless deployment reveals a verified defect.

**Interfaces:**
- Uses migration `0005_webhook_issue_registry.sql`.
- Uses existing public mystery flow and Vercel deployment configuration.

- [ ] **Step 1: Verify the database migration on an isolated Neon branch**

Apply `0005_webhook_issue_registry.sql` to a temporary Neon branch. Query `information_schema`/constraints to prove:

- unique provider event ID;
- unique Issue code/order/event/quote;
- no PII/quiz columns in `webhook_events` or `issues`.

Do not apply to production until isolated verification is green and the migration action is available.

- [ ] **Step 2: Verify current branch gates before deployment**

Run CI + Browser QA on the exact deployment head. Require desktop and mobile mystery journey GREEN.

- [ ] **Step 3: Deploy a Vercel preview**

Use the connected Vercel project if one exists. If the repo has not yet been imported into Vercel and the connector cannot create/import a project, record `OWNER_REQUIRED` with the single action: import `itxsam57/issued-once` into Vercel. Do not invent a deployment URL.

The preview must keep payment/webhook production actions fail-closed unless the real server environment is configured.

- [ ] **Step 4: Live-test the deployed front page**

Verify over HTTPS:

`/ -> BEGIN -> Q1 -> Q7 -> UNLOCK FORM -> object -> size -> base -> commitment`

Use real-browser checks at desktop and mobile widths. Checkout may remain disabled/fail-closed until real Fourthwall credentials/products are configured.

- [ ] **Step 5: Record owner-testable URL and continuation state**

Update `.engineering/CONTINUATION.json` with exact deployment head, CI/Browser QA evidence, preview URL, and next stop state. When `issuedonce.shop` is available, attach it as the canonical front-end/webhook domain and reverify TLS + webhook route.

---

## Plan Self-Review Results

- **Spec coverage:** signature/authentication, strict envelope minimization, shop/type/test policy, durable event inbox, idempotency, opaque quote correlation, private registry, random ID allocation, collision retry, retryable/terminal outcomes, privacy, concurrency, deployment, and live test are each mapped to a task.
- **Placeholder scan:** no TBD/TODO/"handle appropriately" steps remain.
- **Type consistency:** `CheckoutQuoteRepository`, `PaidOrderRepository`, `PaidOrderWebhookService`, `generateIssueCode`, and route/runtime boundaries are defined before use.
- **Scope:** artwork creation, public verification UI, ORDER_UPDATED, replacement processing, and fulfillment are intentionally excluded per the approved spec.
