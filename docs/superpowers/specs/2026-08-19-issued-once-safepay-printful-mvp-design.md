# ISSUED ONCE — Safepay + Printful MVP Architecture

Date: 2026-08-19
Status: APPROVED DIRECTION — implementation plan pending owner review of this written spec
Branch: `feat/mystery-foundation`
Supersedes the Fourthwall-first commerce direction for the first real commercial cycle.

## 1. Goal

Prove one complete real ISSUED ONCE commercial cycle with the fewest moving parts:

`visitor -> randomized seven questions -> physical selection -> verified contact -> shipping details -> Safepay payment -> Issue ID -> design job -> quality gate -> Printful draft/order -> manual manufacturing payment/approval -> shipment -> customer updates -> delivered`

The first goal is not perfect payment economics. The first goal is evidence that one real paid order can travel through the entire system without losing the relationship between the person's private answers, the selected product, size, colour, payment, artwork, shipping address, manufacturing order, and delivery.

If the cycle works and demand is proven, ISSUED ONCE may later establish an eligible foreign entity and migrate the payment adapter to Stripe without changing the core Issue identity, design, support, or manufacturing architecture.

## 2. Non-negotiable product experience

The public experience remains the approved premium minimal ISSUED ONCE site. No Shopify/Fourthwall storefront is introduced.

Customer-facing sequence:

1. `BEGIN`
2. seven randomized questions
3. `WE HAVE ENOUGH.`
4. `Pick the shape your issue lives on.`
5. size
6. `Color your issue.`
7. verified email/contact step
8. shipping details
9. commitment/price review
10. Safepay payment
11. private Issue status experience

The customer must never need a Printful account and should not be exposed to internal design/manufacturing tooling.

## 3. Canonical identity spine

No order is matched by customer name, email, or human memory.

Every stage must be linked through immutable internal identifiers:

```text
Experience ID
  -> Question Set ID
  -> Encrypted Answers
  -> Contact ID
  -> Physical Selection
  -> Payment Attempt ID
  -> Issue ID
  -> Design Job ID
  -> Manufacturing Job ID
  -> Shipment ID
```

The public-facing Issue Code, for example `A7K-42Q`, is a human-friendly lookup key. Internally, database UUIDs remain canonical.

The Issue record must lock the commercial truth at successful payment:

- exact product/form
- exact provider/catalog variant mapping
- exact size
- exact base colour
- paid amount and currency
- shipping snapshot/reference
- verified contact reference
- Safepay transaction/reference
- experience/question-set reference

After payment, a customer or support action must never silently mutate the production truth. Changes require explicit state transitions and audit records.

## 4. Randomized seven-question system

The current seven hardcoded prompts become a versioned Question Vault.

Questions are grouped by useful design-signal families rather than selected from one undifferentiated random list. A session receives one question from each required family so every customer yields diverse but consistently useful creative information.

Initial families:

1. culture/reference
2. place/environment
3. rhythm/time/energy
4. identity/self-perception
5. music/sensory association
6. aesthetic boundary/aversion
7. wildcard/personal texture

The selected seven question IDs are persisted when the experience begins. Refreshing, reconnecting, or continuing the same experience must not reshuffle them.

Each question has at minimum:

- immutable question ID
- prompt version
- family
- answer mode
- active/retired state
- optional weighting
- optional safety/content constraints

Later analytics may score completion rate and design usefulness, but the MVP does not automatically optimize question weights.

## 5. Private answer handling

Answers remain encrypted at rest and attached to the Experience, not duplicated into commerce/manufacturing tables.

Raw answers must not be sent to Safepay or Printful.

Only the design worker can obtain the decrypted answer bundle for a paid Issue. Support views raw answers only through an explicit privileged path if such a path is later approved; raw answers are hidden by default.

## 6. Email verification

ISSUED ONCE owns customer contact verification.

Before payment, the customer enters an email address and completes a short-lived OTP challenge.

Requirements:

- six-digit or equivalent one-time code
- hashed OTP storage; never store plaintext OTP after issuance
- short expiration
- resend cooldown
- attempt limit
- rate limiting by experience/contact/IP-risk signal
- single-use verification
- audit timestamp

The verified email is stored encrypted. A normalized one-way lookup hash may be stored separately for support lookup and deduplication.

No password/account is required for MVP. Later private status access may use a magic link or email OTP.

## 7. Shipping address

Because the main site is our storefront and Safepay is only the payment processor, ISSUED ONCE collects the manufacturing/shipping information required for Printful before payment confirmation.

Minimum fields depend on destination but normally include:

- recipient name
- address line 1
- address line 2 optional
- city
- state/province/region where applicable
- postal/ZIP code
- country
- phone only where carrier/destination requirements justify it

Shipping data is PII and must be encrypted at rest. It is released to Printful only after the order is paid and a manufacturing job is being created.

Address validation should be introduced before automated scale, but MVP may use field-level validation plus a final owner/manual review before manufacturing confirmation.

## 8. Safepay payment boundary

Safepay is the launch payment adapter, not the permanent core of ISSUED ONCE.

Safepay responsibilities:

- card/payment collection
- customer payment authorization/capture
- transaction reference
- payment status/webhook/API result
- refunds through supported Safepay operations when required

ISSUED ONCE responsibilities:

- price calculation/truth
- Issue identity
- contact
- shipping
- product/size/colour selection
- payment-attempt record
- idempotent reconciliation
- design/manufacturing state

No Issue moves to `PAID` based only on a browser redirect/success page. Server-side authenticated Safepay evidence must reconcile the payment attempt.

Safepay metadata/reference fields should carry only opaque ISSUED ONCE identifiers. Never send private questionnaire answers.

## 9. Launch money flow

For the first cycle, money movement is intentionally manual after customer payment:

```text
Customer
  -> Safepay
  -> Safepay settlement
  -> ISSUED ONCE linked bank account
  -> owner-controlled billing method / Printful Wallet
  -> Printful manufacturing
```

Safepay must not be modeled as a spendable treasury wallet. The system must not assume that unsettled Safepay funds can be redirected directly to Printful.

The first production cycle may be economically inefficient. That is accepted as validation cost.

## 10. Printful manufacturing boundary

Printful is the first manufacturing adapter.

For the first cycle, manufacturing remains deliberately gated. A paid customer order must not automatically enter production.

Recommended flow:

1. payment confirmed
2. Issue created/locked
3. design job created
4. answers interpreted
5. final artwork produced
6. artwork and physical truth validated
7. Printful draft order created, or equivalent manually prepared order
8. owner/manual final review
9. owner funds/approves Printful order
10. Printful begins fulfillment
11. tracking/status captured back into ISSUED ONCE

Printful receives only what manufacturing/fulfillment requires:

- external Issue identifier
- Printful variant
- quantity
- final production artwork
- print placement/specification
- recipient shipping information

Printful never receives the seven raw answers.

The application must define a `ManufacturerGateway` boundary so Printful can later be replaced or augmented without changing the Issue/domain model.

## 11. Design job

A successful paid Issue creates a design job; unpaid experiences never trigger manufacturing design work by default.

Design job inputs:

- Issue ID
- seven question IDs and decrypted answers
- selected form
- size where relevant to printable area
- base colour
- negative/aesthetic constraints derived only from explicit answers
- manufacturing template/print-area constraints

Design job outputs:

- structured interpretation/brief
- artwork candidate(s)
- final approved artwork
- production metadata
- version/audit references

The MVP can include human/owner involvement in final design approval. Fully autonomous approval is not required to prove the commercial cycle.

## 12. Quality gate

Nothing is sent to manufacturing merely because an image exists.

Before Printful confirmation, verify:

- Issue ID matches manufacturing job
- exact product variant
- exact size/colour
- artwork belongs to the same Issue
- required print dimensions/resolution
- transparent/background requirements where applicable
- placement bounds
- no obvious corrupt/empty file
- shipping details present
- payment state is `PAID`
- manufacturing has not already been confirmed for this Issue/version

This gate must be idempotent and fail closed.

## 13. Status model

Internal lifecycle should distinguish commercial, creative, and fulfillment truth. Suggested public projection:

- `RECEIVED`
- `BEING INTERPRETED`
- `IN PRODUCTION`
- `IN TRANSIT`
- `DELIVERED`

Internal states may be more precise, for example:

- EXPERIENCE_ACTIVE
- CONTACT_VERIFIED
- PAYMENT_PENDING
- PAID
- DESIGN_QUEUED
- DESIGNING
- DESIGN_REVIEW
- DESIGN_APPROVED
- MANUFACTURING_DRAFT
- MANUFACTURING_APPROVED
- IN_PRODUCTION
- SHIPPED
- DELIVERED
- EXCEPTION
- CANCELED/REFUNDED

Customer messaging must not expose internal provider jargon.

## 14. Customer updates and support

The verified email is the primary communication channel for MVP.

Event-driven emails may later be sent for:

- payment received
- design/interpretation milestone if desired
- production started
- shipped/tracking
- delivery exception
- delivered

Support searches by Issue Code. The support view joins the commercial, design, manufacturing, and shipment states into one timeline.

No public customer account is required for the first cycle.

## 15. Failure handling

The system fails closed at every expensive boundary.

Examples:

- payment browser redirect but no verified server evidence -> remain PAYMENT_PENDING
- duplicate Safepay callback -> idempotent no-op/reconciliation
- payment amount/currency mismatch -> EXCEPTION, no design/manufacturing
- design failure -> retry/review, no manufacturing
- Printful variant mismatch -> block confirmation
- duplicate manufacturing request -> return existing manufacturing job
- address problem -> EXCEPTION/manual resolution
- Printful charge failure -> manufacturing remains unconfirmed/failed, customer Issue remains intact

Every external request gets a provider reference, attempt count, timestamp, and safe failure code.

## 16. Migration target after validation

Safepay is intentionally behind a `PaymentGateway` interface.

If the first commercial cycles prove demand and ISSUED ONCE later establishes an eligible entity for Stripe, migration should be:

`SafepayPaymentGateway -> StripePaymentGateway`

without rewriting:

- Question Vault
- Experience/answers
- Issue identity
- physical selection
- design orchestration
- Printful manufacturing
- support/status

The migration is a commercial infrastructure change, not a product rewrite.

## 17. What is explicitly out of scope for the first cycle

- Shopify
- Fourthwall
- automated Printful charge/confirmation without final gate
- customer username/password accounts
- multi-manufacturer routing
- sophisticated warehouse/ERP
- automated refunds without owner policy
- question-ranking ML
- global tax optimization
- pretending the business is incorporated or based in a jurisdiction where it is not

## 18. First-cycle acceptance test

The MVP architecture is proven only when a real or controlled live order completes all of the following with evidence:

1. unique randomized seven-question set is persisted
2. seven answers are encrypted and recoverable only through the intended design path
3. exact form/size/colour is locked
4. email is verified
5. shipping data is attached to the same experience
6. Safepay payment is verified server-side
7. exactly one Issue is created for the successful payment
8. design job receives the correct seven answers and physical constraints
9. final artwork is attached to that Issue only
10. Printful receives the exact variant, artwork, and recipient
11. owner manually approves/pays Printful for MVP
12. manufacturing/shipping status is recorded
13. customer receives an update/tracking path
14. delivered Issue remains auditable from payment through artwork and fulfillment

Only after this cycle is green should the team optimize fees, automate Printful payment/confirmation, or migrate to Stripe.
