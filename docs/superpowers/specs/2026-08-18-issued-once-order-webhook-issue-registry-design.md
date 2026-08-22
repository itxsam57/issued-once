# ISSUED ONCE — Paid Order Webhook & Private Issue Registry Design

Date: 2026-08-18
Status: owner-approved architecture; written-spec review pending
Repository: `itxsam57/issued-once`
Branch: `feat/mystery-foundation`

## 1. Purpose

This subsystem turns an externally confirmed paid Fourthwall order into exactly one durable private ISSUED ONCE Issue reservation.

The commercial truth is not the browser clicking `ISSUE MINE`, not checkout creation, and not a redirect. A private Issue may be reserved only after a valid Fourthwall `ORDER_PLACED` webhook has been authenticated and correlated to a server-created opaque quote.

The subsystem must remain correct under duplicate webhook delivery, retries, concurrent processing, process crashes, random Issue ID collisions, stale or missing quote records, and future horizontal scaling to many application instances.

## 2. Scope

### In scope

- `POST /api/webhooks/fourthwall`
- raw-body Fourthwall HMAC verification
- supported-shop validation
- `ORDER_PLACED` acceptance
- explicit `testMode` handling
- durable webhook event inbox / idempotency ledger
- opaque `io_quote_id` correlation
- server-side quote and locked-variant recovery
- private `RESERVED` Issue creation
- random, non-sequential permanent Issue ID allocation
- duplicate-event safety
- retryable versus terminal processing outcomes
- minimum operational observability without customer PII

### Explicitly out of scope for this subsystem

- artwork generation
- artwork previews
- public customer identity
- customer email, name, shipping address, or message storage
- public sales counters
- sequential Issue numbering
- public artwork reveal
- owner accounts
- final fulfillment submission
- public verification UI beyond reserving the data shape it will later read
- `ORDER_UPDATED` lifecycle processing, which will be a later subsystem

## 3. External contract used

As verified against Fourthwall developer documentation on 2026-08-18:

- `ORDER_PLACED` is fired when a new order is successfully placed and paid.
- Every webhook event has an `id`; repeated deliveries with the same event ID are duplicates.
- `testMode: true` identifies Fourthwall test notifications.
- Shop webhooks are signed with a base64 HMAC-SHA256 in `X-Fourthwall-Hmac-SHA256`.
- Verification must compute the HMAC over the complete raw request body before JSON interpretation.

The application must not depend on customer PII from the order payload to create an Issue.

## 4. Trust model

Trust is layered, never inferred from a single field.

1. **Transport truth** — request arrived at our HTTPS endpoint.
2. **Authenticity truth** — raw-body HMAC matches the configured Fourthwall webhook secret.
3. **Shop truth** — event `shopId` matches the configured ISSUED ONCE Fourthwall shop.
4. **Event truth** — event type is `ORDER_PLACED` and payload version is supported.
5. **Environment truth** — `testMode` is handled according to environment rules.
6. **Correlation truth** — order/cart metadata contains exactly the opaque `io_quote_id` we issued.
7. **Commercial truth** — the quote exists, belongs to a valid experience, and references the exact server-locked product/variant/price facts.
8. **Reservation truth** — a database transaction creates at most one private Issue for the accepted paid order/event.

No browser-supplied product, price, variant, size, color, customer name, or order claim can bypass these layers.

## 5. Endpoint behavior

### Route

`POST /api/webhooks/fourthwall`

The eventual canonical production URL is intended to be:

`https://issuedonce.shop/api/webhooks/fourthwall`

Before the custom domain is active, the same path may be exercised on the production Vercel deployment URL.

### Processing order

The route must:

1. Read the request as raw bytes.
2. Read `X-Fourthwall-Hmac-SHA256`.
3. Verify HMAC with constant-time comparison.
4. Reject invalid or missing signatures before any durable write.
5. Parse JSON only after signature verification succeeds.
6. Validate required envelope fields with a strict schema.
7. Validate `shopId`, `type`, `apiVersion`, and `testMode` policy.
8. Insert or resolve the event in the webhook inbox using its unique Fourthwall event ID.
9. For a new real `ORDER_PLACED` event, process correlation and Issue reservation.
10. Return an acknowledgement based on the durable processing result.

## 6. Webhook event inbox

A webhook handler must not depend on one in-memory request execution succeeding end-to-end. The event inbox is the durable boundary.

### Table: `webhook_events`

Minimum fields:

- `provider` — fixed `FOURTHWALL`
- `provider_event_id` — Fourthwall event `id`, unique
- `webhook_id`
- `shop_id`
- `event_type`
- `api_version`
- `test_mode`
- `provider_created_at`
- `received_at`
- `processing_status`
- `attempt_count`
- `processed_at` nullable
- `failure_code` nullable
- `failure_detail` nullable, sanitized and non-PII

### Statuses

- `RECEIVED`
- `PROCESSING`
- `PROCESSED`
- `FAILED_RETRYABLE`
- `FAILED_TERMINAL`
- `IGNORED_TEST`

The event inbox does **not** store the full raw order payload after processing. The HMAC must be verified from request bytes in memory, but customer PII must not be persisted merely because Fourthwall sent it.

### Idempotency

`UNIQUE(provider, provider_event_id)` is the first idempotency gate.

If a duplicate event arrives:

- if already `PROCESSED` or `IGNORED_TEST`, acknowledge success without creating another Issue;
- if `PROCESSING`, `RECEIVED`, or `FAILED_RETRYABLE`, the processing path may safely resume/claim according to the repository's compare-and-swap rules;
- it must never allocate a second commercial Issue.

## 7. Correlation model

Fourthwall cart metadata contains only:

- `io_quote_id`

It must not contain:

- experience ID
- raw session token
- quiz answers
- customer identity
- artwork details

The incoming paid order is correlated back to ISSUED ONCE by `io_quote_id`.

The server resolves that quote from its own durable store. The quote record is the bridge to the anonymous experience and exact provider product/variant truth.

If the quote does not exist or cannot be reconciled, no Issue is created.

## 8. Private Issue registry

### Table: `issues`

Minimum V1 fields:

- `id` — internal UUID primary key
- `issue_code` — public-safe random permanent Issue ID, unique
- `status` — initially `RESERVED`
- `fourthwall_order_id` — unique for V1 paid-order reservation
- `fourthwall_event_id`
- `quote_id`
- `product_slug` or provider product ID
- `variant_id`
- `size_code`
- `color_code`
- `reserved_at`
- `updated_at`

Optional operational fields may be added later without exposing them publicly.

### Explicit exclusions

The private Issue registry does not store:

- quiz answers
- customer name
- customer email
- shipping address
- payment card information
- Fourthwall customer/supporter profile
- artwork preview
- a human-readable order message

If later fulfillment requires selected delivery facts, they should be fetched from Fourthwall or held in a purpose-specific short-lived fulfillment boundary rather than copied into the identity/Issue registry by default.

## 9. Issue ID design

### Format

Use a high-entropy, non-sequential, human-readable code such as:

`IO-7K4M-92QF`

Exact alphabet must exclude ambiguous characters where practical (for example `0/O`, `1/I/L`).

### Properties

- random, not derived from database sequence
- no indication of sales volume or chronological position
- permanent once allocated
- never reused after cancellation, void, replacement, or future archival state
- database uniqueness constraint is authoritative

### Collision handling

1. Generate a cryptographically random candidate.
2. Attempt the atomic Issue insert.
3. If `issue_code` uniqueness conflicts, generate another candidate.
4. Retry up to a bounded maximum.
5. If the bound is exhausted, fail retryably and create no partial Issue.

The generator never checks a sales counter or calculates the next code.

## 10. Atomic reservation transaction

For a valid, new, real paid event, one database transaction must establish the reservation truth.

Within the transaction:

1. Claim the webhook event for processing with expected status semantics.
2. Resolve `io_quote_id` to the durable quote.
3. Validate the quote's provider product/variant facts against the locked physical selection relationship.
4. Check whether `fourthwall_order_id`, `fourthwall_event_id`, or `quote_id` already produced an Issue.
5. Allocate and insert one unique Issue code.
6. Insert the `RESERVED` private Issue.
7. Mark the webhook event `PROCESSED`.
8. Commit.

If the transaction fails, there must be no durable half-Issue with an event incorrectly marked processed.

Uniqueness constraints provide the final guard under concurrency:

- unique webhook event ID
- unique Fourthwall order ID
- unique Issue code
- V1: one Issue reservation per quote

## 11. Test-mode events

`testMode: true` events are useful for endpoint/signature/integration testing but must never create a production commercial Issue.

Production behavior:

- authenticate signature normally;
- record a minimal inbox event as `IGNORED_TEST`;
- return 200;
- never write a production `issues` row.

Automated integration tests may use a dedicated test repository/transaction to exercise Issue creation semantics, but test data must remain structurally isolated from production Issue IDs.

## 12. Error and acknowledgement policy

The route uses explicit acknowledgement semantics so authentication failures are rejected, retryable infrastructure failures can be retried, and terminal commercial mismatches do not create infinite provider retry loops.

### Invalid authentication

- missing or invalid `X-Fourthwall-Hmac-SHA256`: return `401`;
- no durable event or Issue write.

### Authenticated malformed envelope

- valid signature but JSON cannot be parsed or required top-level fields are invalid: return `200` after emitting a sanitized terminal diagnostic;
- no Issue creation;
- no raw body or customer data is logged.

The signed body cannot become valid on retry, so repeated provider delivery is not useful.

### Authenticated wrong shop / unsupported type / unsupported API version

- classify as terminal/ignored;
- return `200`;
- create no Issue.

### Duplicate already processed or ignored test event

- return `200`;
- create no new Issue.

### Retryable infrastructure failure

Examples:

- database connection/query failure
- transaction deadlock/serialization failure
- temporary repository failure
- Issue ID collision retry budget unexpectedly exhausted

Behavior:

- if an inbox row exists, leave/change it to `FAILED_RETRYABLE` with a sanitized failure code;
- return `503`;
- never mark the event `PROCESSED`;
- never leave a partial Issue.

### Terminal commercial mismatch

Examples:

- valid `ORDER_PLACED` but missing required `io_quote_id`
- successful quote lookup returns no matching quote
- quote exists but cannot reconcile to the server-locked provider variant
- paid order is already bound to a conflicting commercial reservation

Behavior:

- mark the event `FAILED_TERMINAL` with a non-PII failure code when the inbox is available;
- create no Issue;
- return `200` so a proven terminal mismatch does not retry forever;
- surface the mismatch through operational metrics/logging for manual investigation.

A database/query exception while checking the quote is **not** an unknown quote; it is a retryable infrastructure failure and returns `503`.

## 13. Privacy and data minimization

The webhook payload may contain customer email, shipping/address data, messages, and other order details. Receipt of those fields does not grant permission to persist them.

Rules:

- verify signature before parsing/trusting payload data;
- never log the raw body;
- never log full request JSON;
- never persist customer PII in `webhook_events` or `issues`;
- never attach quiz answers to Fourthwall cart metadata;
- never expose `io_quote_id` as a public verification credential;
- redact secrets and signatures from logs;
- log only event ID, shop ID, order ID where necessary, status, sanitized failure code, and internal correlation IDs.

## 14. Observability

Minimum operational events/metrics:

- webhook received count
- invalid signature count
- duplicate event count
- test event count
- processed paid-order count
- retryable processing failure count
- terminal mismatch count
- Issue ID collision count
- reservation latency

Metrics must not include quiz content or customer PII.

A future operator/admin surface may expose these states, but V1 can rely on structured server logs and database inspection.

## 15. Scaling model

The endpoint is stateless aside from database writes and secret/config access. Any application instance can receive any webhook event.

Correctness must not rely on:

- process memory
- sticky sessions
- a single worker
- request ordering
- exactly-once webhook delivery

The database uniqueness constraints and compare-and-swap/event-status transitions are the concurrency authority.

The first implementation may process synchronously after inbox insertion. The schema must leave a clean seam for moving processing to a queue/worker later without changing the webhook trust or Issue-reservation model.

At high volume, the endpoint can evolve to:

`verify → inbox insert → acknowledge → queue/worker claims inbox → atomic reservation`

without changing Issue identity semantics.

## 16. Public verification seam

Public verification is intentionally not implemented in this subsystem, but the Issue row must make it possible later without exposing private order data.

Future public read model may expose only facts such as:

- `issue_code`
- authenticity status
- object category
- issued/reserved/retired state as appropriate
- issue/creation date as policy allows
- commercial-owner count semantics
- owner reveal state

It must not expose Fourthwall order ID, quote ID, customer identity, quiz answers, or sales sequence.

## 17. Replacement semantics seam

A future verified replacement for damage/fulfillment error does not allocate a new commercial Issue.

The existing Issue code remains the identity. Replacement units will be modeled separately (for example `issue_replacements`) and linked to the same Issue.

This preserves the promise: one commercial owner / no resale of the exact issued artwork to another customer, while allowing legitimate physical replacement.

## 18. Security test gates

Implementation is not complete until automated tests prove at least:

1. Invalid HMAC produces zero durable writes.
2. Signature verification uses exact raw bytes and constant-time comparison.
3. Correct signature + malformed JSON produces no Issue.
4. Wrong shop ID produces no Issue.
5. Unsupported event type produces no Issue.
6. `testMode: true` creates no production Issue.
7. Duplicate event ID creates exactly one Issue.
8. Duplicate order ID creates exactly one Issue.
9. Missing `io_quote_id` creates no Issue.
10. Unknown quote creates no Issue and is observably classified.
11. Payload product/variant/price fields cannot override quote truth.
12. Issue ID collision causes retry, not reuse or overwrite.
13. Exhausted collision retries leave no partial Issue.
14. Transaction failure cannot leave `PROCESSED` without an Issue.
15. The Issue registry contains no quiz answers/customer PII.
16. Provider event/customer fields are not emitted into application logs.
17. Concurrent duplicate deliveries remain single-reservation safe.
18. Retryable infrastructure failures return `503`; terminal authenticated mismatches return `200` with no Issue.

## 19. Integration test gates

- signed Fourthwall-shaped `ORDER_PLACED` fixture → exactly one private `RESERVED` Issue
- replay same signed fixture → same existing Issue/no second insert
- signed Fourthwall test notification → acknowledged/no production Issue
- valid paid event with a real stored quote fixture → Issue contains server quote/variant facts, not payload overrides
- database migration applies cleanly on an isolated branch/database before production application

A real Fourthwall dashboard `Send test notification` will be used after deployment and webhook registration.

## 20. Deployment sequence

1. Implement and test subsystem behind server-only configuration.
2. Apply migrations on isolated Neon branch and verify.
3. Deploy ISSUED ONCE to Vercel.
4. Configure webhook secret and expected Fourthwall shop ID in server environment.
5. Register `https://<deployment>/api/webhooks/fourthwall` for `ORDER_PLACED`.
6. Send Fourthwall test notification; verify signed receipt and zero production Issue.
7. Attach/verify `issuedonce.shop` when the owner provides the domain.
8. Update webhook URL to `https://issuedonce.shop/api/webhooks/fourthwall` if required by deployment/domain setup.
9. Execute a controlled real paid-order test only after checkout/product/KYC configuration is ready.
10. Verify exactly one `RESERVED` Issue and no PII leakage.

## 21. Front-page/live-flow relationship

The public mystery front page and seven-question/physical-selection/commitment journey remain independent of the paid-order webhook subsystem.

A customer-testable front page may be deployed before a real paid order can complete, provided:

- checkout/payment remains clearly non-production or disabled until Fourthwall credentials/products are configured;
- preview/test fixtures cannot create production Issues;
- the public UI preserves the existing mystery/privacy rules.

The custom domain `issuedonce.shop` is planned as the canonical customer-facing domain once configured.

## 22. Definition of done for this subsystem

This subsystem is complete when:

- the signed webhook endpoint exists;
- event inbox/idempotency migration is durable;
- private Issue registry migration is durable;
- random permanent Issue IDs are collision-safe;
- duplicate/retry/concurrency tests pass;
- privacy/PII tests pass;
- CI is green;
- Fourthwall test webhook succeeds against a deployed endpoint without creating a production Issue;
- a controlled real paid order can produce exactly one private `RESERVED` Issue once external shop configuration is available;
- `.engineering/CONTINUATION.json` records verified evidence and the next subsystem boundary.
