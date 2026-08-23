# ISSUED ONCE Final Commercial Cycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete first real ISSUED ONCE commercial cycle from randomized questions through verified contact, Safepay payment, design generation, Printful draft manufacturing, tracking, private status and support.

**Architecture:** Preserve the existing Next.js/Neon experience and physical-selection boundaries. Add provider-independent `PaymentGateway`, `DesignGateway`, `ManufacturerGateway`, contact/OTP, shipping and fulfillment modules around the immutable Issue identity spine. External providers only receive the minimum data required for their boundary; every expensive side effect is idempotent and fail-closed.

**Tech Stack:** Next.js 16.2.11, React 19.2.7, TypeScript 5.9+, Neon Postgres, zod 4, Vitest, Playwright, Node crypto, Safepay HTTP API, OpenAI server-side design API adapter, Printful HTTP API.

**Spec:** `docs/superpowers/specs/2026-08-19-issued-once-safepay-printful-mvp-design.md`

## Global Constraints

- Source of truth stays `itxsam57/issued-once` / `feat/mystery-foundation` / PR #3.
- Preserve the approved premium minimal storefront and current TEE / CAP / TOTE issue.
- Hoodie remains a future winter form, not a current option.
- Exactly seven questions are served per experience, one from each required signal family, and the chosen set never reshuffles for that experience.
- Raw answers are encrypted at rest and never sent to Safepay or Printful.
- No Issue becomes `PAID` from a browser success redirect alone; authenticated server-side Safepay evidence is required.
- No manufacturing is confirmed automatically for the first live cycle.
- Every external write is idempotent and auditable.
- No provider secret may reach browser code.
- Production database migrations are created in code but are not claimed applied until an approved migration cycle actually runs.
- Never call CI/browser gates green when the runner did not execute.
- Safepay is an adapter, not the permanent domain model; Stripe must be swappable later.
- Printful is an adapter, not the permanent manufacturer domain model.

---

### Task 1: Versioned Question Vault and Immutable Seven-Question Assignment

**Files:**
- Create: `src/domain/questions/QuestionVault.ts`
- Create: `src/server/questions/QuestionSetRepository.ts`
- Create: `src/server/questions/QuestionSelectionService.ts`
- Create: `src/server/questions/PostgresQuestionSetRepository.ts`
- Create: `db/migrations/0007_question_vault.sql`
- Modify: `src/server/experience/ExperienceService.ts`
- Modify: `src/domain/experience/questions.ts`
- Test: `tests/unit/question-selection.test.ts`
- Test: `tests/integration/question-set-persistence.test.ts`

**Interfaces:**
- Produces `QuestionFamily = 'culture' | 'place' | 'rhythm' | 'identity' | 'music' | 'boundary' | 'wildcard'`.
- Produces `QuestionDefinition { id, version, family, prompt, mode, optional, active, weight }`.
- Produces `QuestionSelectionService.assign(experienceId): Promise<readonly QuestionDefinition[]>` that is idempotent per experience.

- [ ] **Step 1: Write the failing unit test** proving exactly seven unique active questions are selected, one per required family, with deterministic injected RNG.

```ts
expect(set).toHaveLength(7);
expect(new Set(set.map((q) => q.family))).toEqual(new Set(REQUIRED_FAMILIES));
expect(new Set(set.map((q) => q.id)).size).toBe(7);
```

- [ ] **Step 2: Run `pnpm test -- tests/unit/question-selection.test.ts`** and require RED because the vault/service does not exist.
- [ ] **Step 3: Implement the typed vault and deterministic weighted selector**; seed the initial vault with at least 8 carefully written prompts per family so the live experience is already non-repetitive.
- [ ] **Step 4: Add migration `0007_question_vault.sql`** with `question_definitions`, `experience_question_sets`, and `experience_question_set_items`, unique `(experience_id, ordinal)` and unique `(experience_id, question_id)` constraints.
- [ ] **Step 5: Add repository persistence** so a second `assign(experienceId)` returns the original seven IDs in the original order.
- [ ] **Step 6: Modify experience start/read flow** so the public question route resolves the assigned prompt for the current ordinal rather than a hardcoded q1..q7 prompt.
- [ ] **Step 7: Run unit + integration tests and typecheck**; require GREEN.
- [ ] **Step 8: Commit** `feat: add immutable randomized question vault`.

### Task 2: Verified Contact, OTP and Encrypted Shipping Snapshot

**Files:**
- Create: `src/server/contact/ContactRepository.ts`
- Create: `src/server/contact/ContactService.ts`
- Create: `src/server/contact/PostgresContactRepository.ts`
- Create: `src/server/contact/OtpDeliveryGateway.ts`
- Create: `src/server/contact/runtimeContact.ts`
- Create: `src/server/shipping/ShippingService.ts`
- Create: `db/migrations/0008_contact_shipping.sql`
- Create: `src/app/api/contact/request-otp/route.ts`
- Create: `src/app/api/contact/verify-otp/route.ts`
- Create: `src/app/api/shipping/route.ts`
- Test: `tests/unit/contact-service.test.ts`
- Test: `tests/integration/contact-shipping-persistence.test.ts`

**Interfaces:**
- `ContactService.requestOtp({ experienceToken, email, ipKey }) -> { retryAfterSeconds }`.
- `ContactService.verifyOtp({ experienceToken, email, code }) -> { verified: true }`.
- `ShippingService.save({ experienceToken, address }) -> { saved: true }` requires verified contact.

- [ ] **Step 1: Write RED tests** for hashed OTP storage, 10-minute expiry, single use, resend cooldown, maximum attempts, wrong-email rejection and shipping rejection before contact verification.
- [ ] **Step 2: Run targeted tests** and observe RED.
- [ ] **Step 3: Implement OTP generation with `crypto.randomInt(0, 1_000_000)`**, six-digit zero padding, HMAC/SHA-256 lookup hash, encrypted normalized email payload, timing-safe verification and attempt counters.
- [ ] **Step 4: Implement an `OtpDeliveryGateway` boundary** with a preview/dev sink and a production runtime that fails closed until a real transactional email provider is configured; never log OTPs in production.
- [ ] **Step 5: Add encrypted shipping snapshot persistence** using the existing private-payload encryption utility; store only country/region-derived non-sensitive routing fields separately if needed.
- [ ] **Step 6: Add API routes with zod validation and generic error responses** that do not reveal whether an email already exists.
- [ ] **Step 7: Run tests + typecheck**; require GREEN.
- [ ] **Step 8: Commit** `feat: add verified contact and encrypted shipping`.

### Task 3: Provider-Independent Payment Attempt Model and Safepay Adapter

**Files:**
- Create: `src/server/payments/PaymentGateway.ts`
- Create: `src/server/payments/PaymentRepository.ts`
- Create: `src/server/payments/PaymentService.ts`
- Create: `src/server/payments/PostgresPaymentRepository.ts`
- Create: `src/server/payments/SafepayPaymentGateway.ts`
- Create: `src/server/payments/runtimePayments.ts`
- Create: `db/migrations/0009_payments.sql`
- Create: `src/app/api/payments/create/route.ts`
- Create: `src/app/api/webhooks/safepay/route.ts`
- Test: `tests/unit/payment-service.test.ts`
- Test: `tests/unit/safepay-gateway.test.ts`
- Test: `tests/integration/safepay-webhook-idempotency.test.ts`

**Interfaces:**
- `PaymentGateway.createCheckout({ paymentAttemptId, amountMinor, currency, customerEmail, returnUrl }): Promise<{ providerReference, checkoutUrl }>`.
- `PaymentGateway.verifyWebhook({ rawBody, headers }): Promise<VerifiedPaymentEvent>`.
- `PaymentService.confirm(event)` validates provider reference, exact amount/currency and one-time transition before Issue creation.

- [ ] **Step 1: Write RED tests** for exact amount/currency matching, duplicate provider events, unknown attempts, tampered signatures, browser-return-without-webhook and payment replay.
- [ ] **Step 2: Verify RED** with targeted Vitest runs.
- [ ] **Step 3: Implement payment tables** for attempts and inbox events with provider/reference uniqueness and explicit states `CREATED | REDIRECTED | PAID | FAILED | REFUNDED | EXCEPTION`.
- [ ] **Step 4: Implement the Safepay adapter against current official API/signature semantics** after confirming the exact current production endpoints and webhook verification requirements from Safepay documentation.
- [ ] **Step 5: Add checkout creation route** that requires completed questions, locked physical selection, verified contact and shipping before creating a payment attempt.
- [ ] **Step 6: Add raw-body Safepay webhook route**; authenticate first, then idempotently reconcile server-side.
- [ ] **Step 7: Run tests + typecheck**; require GREEN.
- [ ] **Step 8: Commit** `feat: add safepay payment boundary`.

### Task 4: Replace Fourthwall Reservation Truth with Canonical Paid Issue Creation

**Files:**
- Create: `src/server/issues/IssueRepository.ts`
- Create: `src/server/issues/IssueService.ts`
- Create: `db/migrations/0010_issue_identity_spine.sql`
- Modify: `src/server/issues/PostgresPaidOrderRepository.ts` or retire it after data-compatible replacement
- Modify: `src/server/issues/runtimePaidOrders.ts`
- Modify: `src/server/checkout/*` to remove Fourthwall-specific assumptions from live runtime
- Test: `tests/unit/issue-service.test.ts`
- Test: `tests/integration/paid-issue-reservation.test.ts`

**Interfaces:**
- `IssueService.reserveForPaidAttempt(paymentAttemptId): Promise<{ issueId, issueCode, duplicate }>`.
- The Issue snapshot contains experience ID, contact ID, shipping snapshot ID, physical product/variant/size/color, paid amount/currency and Safepay reference.

- [ ] **Step 1: Write RED tests** proving exactly one Issue can exist per successful payment attempt and that mismatched/incomplete physical truth blocks reservation.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Add `0010_issue_identity_spine.sql`** with unique payment-attempt binding and immutable commercial snapshot columns; preserve old Fourthwall fields only as nullable legacy compatibility until cleanup.
- [ ] **Step 4: Implement atomic Postgres reservation transaction** that selects completed experience/contact/shipping/physical/payment truth and inserts Issue + initial status event together.
- [ ] **Step 5: Remove Fourthwall from the production runtime path** without deleting historical tests/data migration support until the new path is green.
- [ ] **Step 6: Run tests + typecheck**; require GREEN.
- [ ] **Step 7: Commit** `refactor: make paid issue identity provider independent`.

### Task 5: Design Job, Interpretation and Artwork Provider Boundary

**Files:**
- Create: `src/server/design/DesignRepository.ts`
- Create: `src/server/design/DesignService.ts`
- Create: `src/server/design/DesignGateway.ts`
- Create: `src/server/design/OpenAIDesignGateway.ts`
- Create: `src/server/design/DesignBrief.ts`
- Create: `src/server/design/runtimeDesign.ts`
- Create: `db/migrations/0011_design_jobs.sql`
- Create: `src/app/api/internal/design/run/route.ts`
- Test: `tests/unit/design-service.test.ts`
- Test: `tests/unit/openai-design-gateway.test.ts`

**Interfaces:**
- `DesignService.createForIssue(issueId)` is idempotent and only accepts `PAID` Issues.
- `DesignGateway.interpret(input): Promise<StructuredDesignBrief>`.
- `DesignGateway.generateArtwork(input): Promise<ArtworkCandidate[]>`.
- Raw answers are decrypted only inside the design execution boundary and are not persisted into provider logs by our application.

- [ ] **Step 1: Write RED tests** proving unpaid Issues cannot create design jobs, duplicate calls reuse the same job, raw answers never enter manufacturing payloads, and every brief records the exact question IDs/versions used.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Add design-job schema** with states `QUEUED | INTERPRETING | GENERATING | REVIEW | APPROVED | FAILED`, provider/model metadata and encrypted structured brief/candidate references.
- [ ] **Step 4: Implement structured brief generation** with explicit fields such as visual motifs, palette relationship, density, geometry, typography allowance, literal-elements-to-avoid, negative constraints and rationale tied to answer IDs.
- [ ] **Step 5: Implement OpenAI adapter using current official server API** with `store:false` where supported and strict JSON/schema parsing for the interpretation step; keep an interface so the provider is replaceable.
- [ ] **Step 6: Implement artwork generation adapter** returning durable production-file references; preview runtime may use deterministic fixtures, production must fail closed without configured API/storage credentials.
- [ ] **Step 7: Run tests + typecheck**; require GREEN.
- [ ] **Step 8: Commit** `feat: add issue design orchestration`.

### Task 6: Artwork Quality Gate

**Files:**
- Create: `src/server/design/ArtworkQualityGate.ts`
- Create: `src/server/design/ProductionArtwork.ts`
- Create: `src/app/api/internal/design/approve/route.ts`
- Test: `tests/unit/artwork-quality-gate.test.ts`

**Interfaces:**
- `ArtworkQualityGate.validate({ issue, artwork, template }): QualityResult`.
- Approval requires same Issue ID/version, non-empty asset, supported MIME/type, manufacturer print-area dimensions, adequate resolution, correct background/transparency rule and explicit reviewer/system approval.

- [ ] **Step 1: Write RED tests** for wrong Issue artwork, undersized artwork, empty file, wrong product template, duplicate approval and missing negative-constraint check.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement pure deterministic checks** plus persisted approval evidence.
- [ ] **Step 4: Require an explicit manual approval token/action for MVP** before the state becomes `DESIGN_APPROVED`.
- [ ] **Step 5: Run tests + typecheck**; require GREEN.
- [ ] **Step 6: Commit** `feat: add production artwork quality gate`.

### Task 7: Printful Catalog Mapping and Draft Manufacturing Gateway

**Files:**
- Create: `src/server/manufacturing/ManufacturerGateway.ts`
- Create: `src/server/manufacturing/ManufacturingRepository.ts`
- Create: `src/server/manufacturing/ManufacturingService.ts`
- Create: `src/server/manufacturing/PrintfulGateway.ts`
- Create: `src/server/manufacturing/runtimeManufacturing.ts`
- Create: `db/migrations/0012_manufacturing.sql`
- Create: `src/app/api/internal/manufacturing/create-draft/route.ts`
- Create: `src/app/api/internal/manufacturing/approve/route.ts`
- Create: `src/app/api/webhooks/printful/route.ts`
- Test: `tests/unit/manufacturing-service.test.ts`
- Test: `tests/unit/printful-gateway.test.ts`
- Test: `tests/integration/printful-webhook-idempotency.test.ts`

**Interfaces:**
- `ManufacturerGateway.createDraft(input): Promise<{ providerOrderId, status }>`.
- `ManufacturerGateway.confirmDraft(providerOrderId): Promise<void>` exists but is called only by explicit owner approval for MVP.
- `ManufacturerGateway.parseWebhook(...)` emits normalized production/shipment events.

- [ ] **Step 1: Write RED tests** proving design approval is required, exact provider variant mapping is required, duplicate draft creation is idempotent, confirmation cannot occur from a public route, and shipping payload belongs to the same Issue.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Confirm current Printful official order/catalog/webhook API semantics** and implement typed HTTP adapter with external ID = Issue Code/UUID reference, recipient, exact variant, final artwork URL/file and `confirm=false`/draft equivalent.
- [ ] **Step 4: Add manufacturing tables** with Issue uniqueness, artwork version, provider order ID, state and audit timestamps.
- [ ] **Step 5: Implement explicit owner-only confirmation path** and keep production runtime blocked unless `PRINTFUL_ALLOW_CONFIRM=true` plus authenticated owner action are both present.
- [ ] **Step 6: Implement Printful webhook normalization** for production/shipped/tracking/cancel/failure states and idempotent inbox storage.
- [ ] **Step 7: Run tests + typecheck**; require GREEN.
- [ ] **Step 8: Commit** `feat: add printful draft manufacturing`.

### Task 8: Unified Issue Timeline, Customer Status and Support Lookup

**Files:**
- Create: `src/server/status/IssueTimelineService.ts`
- Create: `src/server/support/SupportService.ts`
- Create: `src/app/issue/[code]/page.tsx`
- Create: `src/app/api/issue/[code]/request-access/route.ts`
- Create: `src/app/api/issue/[code]/verify-access/route.ts`
- Create: `src/app/support/page.tsx`
- Create: `src/app/status-stage.css`
- Test: `tests/unit/issue-timeline.test.ts`
- Test: `tests/integration/support-access.test.ts`

**Interfaces:**
- Public projection only exposes `RECEIVED | BEING_INTERPRETED | IN_PRODUCTION | IN_TRANSIT | DELIVERED | EXCEPTION`.
- Private Issue access requires verified email OTP/magic challenge and never exposes raw questionnaire answers.

- [ ] **Step 1: Write RED tests** for public projection, unauthorized access, wrong-email OTP, delivered tracking projection and raw-answer non-disclosure.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement normalized timeline from payment/design/manufacturing/shipment event tables**.
- [ ] **Step 4: Implement private Issue access using the same verified-contact challenge infrastructure**.
- [ ] **Step 5: Build premium minimal status/support UI** using the existing paper/ink/oxblood language, without generic ecommerce cards.
- [ ] **Step 6: Run tests + typecheck**; require GREEN.
- [ ] **Step 7: Commit** `feat: add private issue status and support`.

### Task 9: Complete Customer Journey UI

**Files:**
- Modify: `src/components/VisualPreviewExperience.tsx` or split the production journey into focused components
- Create: `src/components/ContactVerification.tsx`
- Create: `src/components/ShippingAddress.tsx`
- Create: `src/components/PaymentCommitment.tsx`
- Modify: `src/app/commitment-stage.css`
- Create: `src/app/contact-stage.css`
- Create: `src/app/shipping-stage.css`
- Test: `tests/integration/mystery-contact-payment.test.tsx`
- Modify: `tests/e2e/mystery-experience.spec.ts`
- Modify: `tests/e2e/public-physical-flow.spec.ts`

**Interfaces:**
- Journey becomes questions -> reveal -> form -> size -> colour -> email OTP -> shipping -> price/commitment -> Safepay checkout -> Issue receipt/status.

- [ ] **Step 1: Write RED component/browser expectations** for randomized displayed prompts, OTP UX, address validation, no payment before verified contact, and exact transition to Safepay checkout.
- [ ] **Step 2: Verify RED where runner execution is available**; if GitHub Actions still creates zero-step jobs, preserve that evidence and use local/provider build gates without calling browser GREEN.
- [ ] **Step 3: Implement the new stages** with the existing human voice, generous mobile tap targets, restrained information density and no unnecessary provider branding.
- [ ] **Step 4: Keep owner preview completely safe** with fake OTP/payment/design/manufacturing paths and an unmistakable owner-only marker outside the public production journey.
- [ ] **Step 5: Run unit/integration/typecheck/build and Playwright when executable**.
- [ ] **Step 6: Commit** `feat: complete customer commercial journey`.

### Task 10: Runtime Configuration, Provider Removal and Operational Safety

**Files:**
- Modify: provider runtime files under `src/server/**/runtime*.ts`
- Modify: `README.md`
- Create: `docs/operations/first-live-order-runbook.md`
- Create: `docs/operations/provider-secrets.md`
- Modify: `.github/workflows/ci.yml` only if evidence shows a workflow defect; do not change it to mask external runner failures
- Test: `tests/unit/runtime-fail-closed.test.ts`

**Interfaces:**
- Production runtime requires explicit Safepay, email, design, storage, Printful and Neon credentials.
- Preview runtime never creates a real payment or manufacturing confirmation.

- [ ] **Step 1: Write RED tests** for missing production secrets, accidental preview-to-production provider calls and public manufacturing-confirm route exposure.
- [ ] **Step 2: Implement a single validated runtime configuration boundary** that throws before serving dangerous operations when required secrets are missing.
- [ ] **Step 3: Remove Fourthwall from active production composition and documentation**, retaining only migration/history references needed to understand old schema.
- [ ] **Step 4: Write the first-live-order runbook** with evidence checkpoints at payment, Issue reservation, design approval, Printful draft, manual Printful charge, shipment and customer receipt.
- [ ] **Step 5: Run tests + typecheck + build**; require GREEN where executable.
- [ ] **Step 6: Commit** `chore: harden production provider runtime`.

### Task 11: End-to-End Commercial Proof Gate and Continuation State

**Files:**
- Create: `tests/e2e/final-commercial-cycle.spec.ts`
- Modify: `.engineering/CONTINUATION.json`
- Update: `docs/operations/first-live-order-runbook.md`

**Interfaces:**
- The final automated test uses stubbed provider boundaries and proves one Issue cannot cross-link another customer's answers, shipping, artwork or variant.

- [ ] **Step 1: Add an end-to-end test with two simultaneous customers** whose answers, forms, sizes, colours, contacts and addresses are deliberately different.
- [ ] **Step 2: Assert each paid Issue retains only its own encrypted-answer references, design job, artwork, Printful draft and shipment projection**.
- [ ] **Step 3: Assert duplicate Safepay and Printful callbacks do not create duplicate Issues/manufacturing jobs**.
- [ ] **Step 4: Run `pnpm test`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` when a runner/browser is actually executable**.
- [ ] **Step 5: Check Vercel deployment/build separately** and never substitute a Vercel compile result for missing unit/browser evidence.
- [ ] **Step 6: Update `.engineering/CONTINUATION.json`** with exact verified head, migrations-created-not-applied state, provider configuration blockers and owner-required actions.
- [ ] **Step 7: Commit** `test: prove complete issued once commercial cycle`.

## Execution Order and Release Gate

Tasks 1-4 establish identity and money truth. Tasks 5-7 establish design/manufacturing truth. Tasks 8-10 establish customer/support and runtime safety. Task 11 is the cross-customer proof gate.

No real Safepay charge or Printful manufacturing confirmation is enabled merely by merging code. Live enablement requires provider credentials, an approved Neon migration cycle, owner verification of pricing/catalog mappings, owner confirmation that the transactional email sender is live, and one controlled first-order run using `docs/operations/first-live-order-runbook.md`.
