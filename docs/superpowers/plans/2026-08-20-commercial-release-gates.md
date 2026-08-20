# ISSUED ONCE Commercial Release Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the real production customer journey from verified shipping through sandbox payment truth, Issue creation, design generation, and a Printful draft while keeping production manufacturing confirmation disabled.

**Architecture:** The public journey remains fail-closed and provider-truth driven. Safepay checkout creation may redirect the browser, but only a signed provider webhook can mark payment paid and reserve an Issue. Paid Issues enqueue idempotent Vercel Queue messages; design uses OpenAI plus private Vercel Blob; manufacturing may create a Printful draft only after owner design approval, and production confirmation remains behind owner auth, `PRINTFUL_ALLOW_CONFIRM=true`, typed `CONFIRM <Issue Code>`, and a last-moment eligibility reload.

**Tech Stack:** Next.js 16, TypeScript, Vitest, Playwright, Neon Postgres, Safepay hosted Checkout, Vercel Queue, OpenAI API, Vercel Blob, Printful API.

**Spec:** `.engineering/CONTINUATION.json`

## Global Constraints

- Treat `itxsam57/issued-once` branch `feat/mystery-foundation` as source of truth; do not merge to `main` until all commercial gates are proven.
- Never treat browser redirect/callback as payment truth; paid truth requires verified Safepay webhook evidence.
- Never expose secrets, OTPs, session tokens, questionnaire plaintext, or private shipping data in repository/logs/chat.
- Questionnaire/contact/shipping private payloads must remain encrypted at rest.
- Printful production confirmation must remain disabled during release testing.
- A Printful draft may be created only after owner-authenticated design approval.
- Do not call a gate green unless the exact live operation executed and evidence was observed.

---

### Task 1: Safepay sandbox checkout and webhook truth

**Files:**
- Verify: `src/server/payments/runtimePayments.ts`
- Verify: `src/server/payments/SafepayPaymentGateway.ts`
- Verify: `src/server/payments/PaymentService.ts`
- Verify: `src/app/api/payments/create/route.ts`
- Verify: `src/app/api/webhooks/safepay/route.ts`
- Test: `tests/unit/safepay-gateway.test.ts`
- Test: `tests/unit/payment-service.test.ts`
- Test: `tests/integration/paid-order-webhook.integration.test.ts`
- Modify when needed: `tests/e2e/live-production-smoke.mjs`

**Interfaces:**
- Consumes: verified contact, encrypted shipping snapshot, current checkout quote, `SAFEPAY_ENVIRONMENT=sandbox`, `SAFEPAY_API_KEY`, `SAFEPAY_WEBHOOK_SECRET`.
- Produces: hosted sandbox checkout URL, provider tracker reference, signed webhook event, idempotent paid payment attempt.

- [ ] **Step 1: Run existing payment unit/integration verification**

Run via repository CI and require the Safepay gateway, payment service, webhook replay/idempotency, mismatch and refund tests to pass.

- [ ] **Step 2: Verify live runtime remains fail-closed before provider configuration**

Require `/api/payments/create` to return a controlled unavailable/state response rather than creating a production charge when sandbox credentials are absent.

- [ ] **Step 3: Configure only sandbox provider credentials externally**

Expected Vercel contract:

```text
SAFEPAY_ENVIRONMENT=sandbox
SAFEPAY_API_KEY=<sandbox client/api key stored only in Vercel>
SAFEPAY_WEBHOOK_SECRET=<sandbox shared secret stored only in Vercel>
```

Safepay webhook URL:

```text
https://issuedonce.shop/api/webhooks/safepay
```

- [ ] **Step 4: Execute one real hosted sandbox checkout**

Expected result: checkout URL host is the Safepay sandbox host, the payment attempt records provider tracker/reference, and the experience moves to `CHECKOUT_STARTED`.

- [ ] **Step 5: Prove signed webhook truth and replay safety**

Expected evidence: one authentic Safepay paid sandbox event marks the matching attempt paid; replaying the same provider event does not create a second payment/Issue; invalid signature is rejected; refund/failed events do not become paid.

- [ ] **Step 6: Commit only code/test changes if live evidence exposes a defect**

No provider secret or live webhook body is committed.

### Task 2: Paid Issue reservation and queue fan-out

**Files:**
- Verify: `src/app/api/webhooks/safepay/route.ts`
- Verify: `src/server/issues/IssueService.ts`
- Verify: `src/server/design/designQueue.ts`
- Verify: `src/server/notifications/notificationQueue.ts`
- Test: `tests/integration/paid-order-webhook.integration.test.ts`
- Test: `tests/unit/issue-service.test.ts`

**Interfaces:**
- Consumes: paid payment attempt ID from verified Safepay webhook.
- Produces: one canonical Issue, one idempotent design queue message, one idempotent `PAYMENT_RECEIVED` notification queue message.

- [ ] **Step 1: Verify Issue reservation is idempotent for duplicate paid events**

Expected: duplicate/replayed paid events return the same canonical Issue identity and never reserve another Issue.

- [ ] **Step 2: Verify queue enqueue keys are deterministic**

Design key must be `design:<issueId>:initial`; payment notification key must be `notify:<issueId>:PAYMENT_RECEIVED:initial`.

- [ ] **Step 3: Observe live queue dispatch after sandbox paid truth**

Expected: both queue messages are accepted after the signed paid webhook.

### Task 3: OpenAI design and private Blob proof

**Files:**
- Verify: `src/server/design/runtimeDesign.ts`
- Verify: `src/server/design/OpenAIDesignGateway.ts`
- Verify: `src/server/design/VercelBlobArtworkStorage.ts`
- Verify: `src/app/api/queue/design/route.ts`
- Test: `tests/unit/design-service.test.ts`
- Test: `tests/unit/vercel-blob-artwork-storage.test.ts`
- Test: `tests/unit/artwork-quality-gate.test.ts`

**Interfaces:**
- Consumes: paid canonical Issue, encrypted questionnaire inputs, `OPENAI_API_KEY`, `BLOB_READ_WRITE_TOKEN`, optional model overrides.
- Produces: design job in `REVIEW`, private artwork Blob, Owner OS candidate.

- [ ] **Step 1: Re-run design and Blob unit gates before live provider use**

Require design idempotency, refund-race, artwork dimensions/quality, and private Blob behavior to pass.

- [ ] **Step 2: Configure provider secrets externally**

Expected Vercel contract:

```text
OPENAI_API_KEY=<stored only in Vercel>
BLOB_READ_WRITE_TOKEN=<stored only in Vercel>
```

Optional model overrides remain unset unless a tested override is required.

- [ ] **Step 3: Observe one real design queue consumer execution**

Expected: queue callback reaches `createForIssue`, job reaches `REVIEW`, candidate is captured in Owner OS, and no manufacturing draft is created automatically.

- [ ] **Step 4: Prove Blob remains private and factory reads are time-limited**

Expected: artwork storage is not a public unrestricted asset path; manufacturing access is generated only through the signed/time-limited read path.

### Task 4: Printful draft and production kill-switch proof

**Files:**
- Verify: `src/server/manufacturing/runtimeManufacturing.ts`
- Verify: `src/server/manufacturing/ManufacturingService.ts`
- Verify: `src/server/manufacturing/PrintfulVariantMap.ts`
- Verify: `src/app/ops/api/manufacturing/create-draft/route.ts`
- Verify: `src/app/ops/api/manufacturing/confirm/route.ts`
- Verify: `src/app/api/webhooks/printful/route.ts`
- Test: `tests/unit/manufacturing-service.test.ts`
- Test: `tests/unit/printful-gateway.test.ts`
- Test: `tests/unit/printful-variant-map.test.ts`
- Test: `tests/unit/printful-webhook-route.test.ts`
- Test: `tests/unit/ops-manufacturing-route.test.ts`

**Interfaces:**
- Consumes: owner-approved design, decrypted delivery inputs only at draft creation boundary, `PRINTFUL_API_TOKEN`, `PRINTFUL_VARIANT_MAP_JSON`, webhook verification keys, Blob token.
- Produces: Printful draft order only; no production confirmation during release test.

- [ ] **Step 1: Verify draft creation is owner-authenticated and design-gated**

Expected: unauthenticated requests fail; unapproved design fails; approved design can create at most one reusable Printful draft.

- [ ] **Step 2: Configure Printful draft/webhook secrets externally**

Expected Vercel contract:

```text
PRINTFUL_API_TOKEN=<stored only in Vercel>
PRINTFUL_VARIANT_MAP_JSON=<real tested variant map stored only in Vercel>
PRINTFUL_WEBHOOK_PUBLIC_KEY=<stored only in Vercel>
PRINTFUL_WEBHOOK_SECRET_HEX=<stored only in Vercel>
```

`PRINTFUL_ALLOW_CONFIRM` must remain unset/false during this release proof.

- [ ] **Step 3: Create one real Printful draft after explicit owner design approval**

Expected: provider order is created as draft only, using the selected product/size/color mapping and time-limited artwork URL.

- [ ] **Step 4: Prove production confirmation remains disabled**

Expected: confirm endpoint returns disabled while `PRINTFUL_ALLOW_CONFIRM` is not exactly `true`, even for an authenticated owner and valid typed confirmation.

- [ ] **Step 5: Verify Printful webhook authentication and status mapping**

Expected: signed provider events update the draft/job; invalid authentication is rejected; no event bypasses the owner production gate.

### Task 5: Final release reconciliation

**Files:**
- Modify: `.engineering/CONTINUATION.json`
- Verify: `.github/workflows/ci.yml`
- Verify: `.github/workflows/browser-qa.yml`

**Interfaces:**
- Consumes: evidence from Tasks 1–4.
- Produces: one evidence-backed launch decision with PR #3 still draft unless every required commercial gate is green.

- [ ] **Step 1: Run full CI and Browser QA at final candidate SHA**

Expected: all unit/integration tests, typecheck, lint, production build and all desktop/mobile browser scenarios pass.

- [ ] **Step 2: Re-run real `issuedonce.shop` customer smoke**

Expected: questionnaire, physical selection, OTP request, verified contact, shipping, quote and sandbox checkout creation succeed without client-only false positives.

- [ ] **Step 3: Update Continuation Governor with exact evidence**

Record run IDs, provider gate states and remaining OWNER_REQUIRED/WAIT_EXTERNAL items without recording secrets/private payloads.

- [ ] **Step 4: Do not merge PR #3 unless all required launch gates are green**

If any external provider remains unproven, leave the PR draft and report the exact smallest remaining owner action.
