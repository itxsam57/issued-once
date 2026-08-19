# ISSUED ONCE — Controlled First Paid Cycle

Date: 2026-08-19
Purpose: prove one real order from private answers to delivered physical Issue without losing identity, creating duplicate work, or charging Printful before owner approval.

This is a runbook, not evidence that production is configured. Every checkpoint requires observed evidence before advancing.

## Gate 0 — branch and code

Source of truth:

- repository: `itxsam57/issued-once`
- branch: `feat/mystery-foundation`
- draft PR: #3

Before taking money:

1. restore a functioning CI/Browser QA runner
2. install dependencies from the branch
3. run unit tests
4. run TypeScript typecheck
5. run production build
6. run desktop and mobile browser journeys
7. inspect the exact deployed commit

Do not call this gate green if a GitHub Actions job exists but has no executable steps.

## Gate 1 — database

For a fresh database, apply and verify the complete migration chain in order:

- `0001_experience.sql`
- `0002_checkout_quotes.sql`
- `0003_physical_selection.sql`
- `0004_commitment_ready.sql`
- `0005_webhook_issue_registry.sql`
- `0006_add_tote_form.sql`
- `0007_question_vault.sql`
- `0008_contact_shipping.sql`
- `0009_payments.sql`
- `0009a_issue_uuid_prerequisite.sql`
- `0010_issue_identity_spine.sql`
- `0011_design_jobs.sql`
- `0012_manufacturing.sql`
- `0013_notifications_support.sql`

Do not skip `0009a`: it guarantees the internal Issue UUID required by the final design/manufacturing identity spine.

Verify schema invariants directly:

- seven-question assignment unique by experience/slot
- one verified contact per experience
- one shipping snapshot per experience
- one active/paid payment truth per quote
- one Issue per payment attempt
- one design job per Issue
- one manufacturing job per Issue
- provider events idempotent
- notification delivery unique by Issue/event

Back up the production encryption/HMAC secrets before inserting live private data.

## Gate 2 — question and privacy proof

Use a fresh production-like session.

Evidence:

1. start twice with the same session -> same seven assigned questions
2. fresh second session -> independently selected balanced set
3. exactly one question from each required family
4. database stores immutable question ID/version/prompt snapshot
5. answer rows contain ciphertext, not readable answer text
6. raw answers do not appear in Safepay/Printful/notification tables

## Gate 3 — contact and shipping proof

Use an inbox the owner controls.

Evidence:

1. OTP is delivered
2. wrong code fails
3. expired/reused code fails
4. valid code verifies once
5. verified email row contains encrypted payload, not plaintext email
6. shipping cannot save before verified contact
7. shipping saves after verification
8. shipping row contains encrypted full address
9. checkout cannot start without both verified contact and shipping

## Gate 4 — Safepay sandbox

Keep:

`SAFEPAY_ENVIRONMENT=sandbox`

Evidence:

1. final commitment displays the exact server quote
2. `ISSUE MINE` opens the official Safepay hosted checkout
3. browser return alone leaves the Issue page in payment-checking state
4. valid signed Safepay webhook is accepted
5. invalid signature is rejected
6. amount or currency mismatch becomes exception and does not create a paid Issue
7. valid paid event creates exactly one canonical Issue
8. sending the same provider event again does not create another Issue
9. Issue freezes exact form/size/color/amount/currency/contact/shipping references
10. payment-received email is queued once
11. design work is queued once

Do not enter Safepay production until this gate is green.

## Gate 5 — design proof

Use the paid controlled Issue.

Evidence:

1. design queue receives Issue UUID only
2. worker claims exactly one design job
3. the worker decrypts the seven answers internally
4. interpretation call is made with response storage disabled
5. structured brief is persisted encrypted
6. image-generation input contains the structured brief, not the raw answers
7. produced file is PNG on HTTPS Blob URL
8. design stops at `DESIGN_REVIEW`
9. no Printful draft exists yet

Manually review:

- originality
- meaningful use of all seven signals
- no copied logo/trademark/character/book cover/lyrics
- no literal dump of questionnaire answers
- composition on the selected base color
- physical print suitability

## Gate 6 — owner artwork approval

Use the private `/ops` room or the equivalent owner-only approval operation.

Evidence:

1. unauthorized request returns unauthorized
2. under-resolution/corrupt/incorrect-state artwork fails closed
3. approved artwork transitions:
   - design -> `APPROVED`
   - Issue -> `DESIGN_APPROVED`
4. audit event records the quality checks
5. Printful still has not been charged

## Gate 7 — Printful draft

Before this gate:

- physically sample the selected Printful blank/variant where practical
- populate the exact `PRINTFUL_VARIANT_MAP_JSON`
- keep `PRINTFUL_ALLOW_CONFIRM` disabled

Create the owner-only manufacturing draft.

Evidence in our database:

- same Issue UUID
- same design job
- same artwork URL
- exact numeric Printful variant mapping
- manufacturing state `DRAFT`
- Issue state `MANUFACTURING_DRAFT`

Evidence in Printful dashboard/API:

- order is draft/unconfirmed
- external ID is the public Issue Code
- recipient is correct
- exact size/color/product is correct
- quantity = 1
- exact final artwork file is attached in the intended print placement
- no questionnaire answers are present
- owner has not been charged for fulfillment

If any item differs, stop and correct the mapping/data before confirmation.

## Gate 8 — deliberate manufacturing confirmation

This is the first irreversible/paid factory action.

Requirements simultaneously:

1. owner operations session is valid
2. `PRINTFUL_ALLOW_CONFIRM=true`
3. exact confirmation requested for the displayed Issue
4. owner has visually inspected the Printful draft

After success:

- Printful order is submitted/charged
- manufacturing job -> `IN_PRODUCTION`
- Issue -> `IN_PRODUCTION`
- customer receives the production milestone once

For the first cycle, disable `PRINTFUL_ALLOW_CONFIRM` again after the deliberate submission unless continuous confirmations are intentionally desired.

## Gate 9 — fulfillment webhook

Configure the Printful v2 webhook to:

`https://issuedonce.shop/api/webhooks/printful`

Evidence:

- wrong public key rejected
- wrong HMAC signature rejected
- repeated delivery of same event is idempotent
- provider order ID matches our manufacturing job
- Printful external ID matches our Issue Code
- mismatch is quarantined

Expected transitions:

- shipment sent -> Issue `IN_TRANSIT`
- shipment delivered -> Issue `DELIVERED`
- failed/canceled -> exception/canceled state as appropriate

Customer private Issue page should show tracking only after verified shipment evidence exists.

## Gate 10 — email and support proof

Evidence:

- payment email exactly once
- production email exactly once
- shipped email exactly once with tracking
- delivered email exactly once
- retries do not duplicate SENT notifications
- support request can be created from the same private Issue session
- support message is ciphertext at rest
- support inbox receives Issue Code + customer message
- reply-to is verified customer email
- support email does not include the seven questionnaire answers

## Gate 11 — delivered audit

A completed Issue must be traceable without fuzzy matching:

```text
Experience
  -> persisted Question Set
  -> encrypted Answers
  -> verified Contact
  -> encrypted Shipping Snapshot
  -> Safepay Payment Attempt
  -> canonical Issue
  -> Design Job
  -> approved Artwork
  -> Manufacturing Job
  -> Printful Order
  -> Shipment/Tracking
  -> Delivered
```

For the controlled Issue, prove that every arrow is an ID/reference join—not name/email guessing.

## Success definition

The first cycle is proven only when the correct physical piece reaches the correct recipient with:

- the correct seven-answer design lineage
- correct form
- correct size
- correct color
- correct final artwork
- correct address
- one payment
- one Issue
- one manufacturing order
- one shipment trail
- support and notifications working

After that proof, optimize fees/FX and consider the LLC/Stripe migration. Do not change the Issue/design/manufacturing identity spine merely to change the payment provider.
