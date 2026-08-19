# ISSUED ONCE — Canonical production launch gate

Date: 2026-08-19
Migration head: `0027_issue_prefix_search_indexes.sql`

This document is the canonical production launch checklist. The authoritative migration manifest is `db/migrations/README.md`, and `db/migrations/CURRENT` identifies the repository migration head. If a duplicated migration number in any runbook disagrees with `CURRENT`, stop and reconcile the documentation before migrating.

## Production stays closed until every gate below has observed evidence

### 1. Code / deployment
- exact reviewed GitHub head identified
- executable unit tests complete with zero failures
- executable TypeScript check completes with zero errors
- executable lint check completes with zero errors when included in the release verification command set
- production build completes with exit 0
- browser journey completes on desktop + mobile
- Vercel project is visible to the owner/integration again
- both durable consumers are registered in the deployed environment:
  - `issued-once-design`
  - `issued-once-notifications`

A workflow record that ends before step 1 exists is infrastructure evidence, not a successful or failed application verification.

### 2. Database
Production Neon must receive the complete ordered chain described by `db/migrations/README.md` through the file named by `db/migrations/CURRENT`.

Current repository head:

`db/migrations/CURRENT -> 0027_issue_prefix_search_indexes.sql`

Required post-migration proofs include:
- `payment_attempts.status` allows `REFUNDED`
- active payment truth freezes referenced contact/shipping snapshots
- FAILED unshown attempts release that freeze
- Issue state-machine enforcement exists
- payment exception overlay enforcement exists
- contradictory signed provider money can quarantine payment truth
- pre-production payment exceptions create a canonical Issue timeline event
- Owner OS audit/private-note storage exists and audit writes remain append-only
- design candidate history and the guarded pre-manufacturing rework path exist
- versioned Owner OS website/catalog configuration exists
- incremental `commercial_metric_buckets` projection exists for long-window analytics
- delivered-count projection exists independently of lifecycle timing
- bounded Owner OS operational/queue indexes exist
- newest-first Issue-ledger and country-filter join indexes exist
- `pg_trgm` and the four case-insensitive prefix-search indexes exist for Issue Code, Safepay reference, Printful order ID, and tracking number

The isolated Neon proof branches exercised migrations `0020`–`0027` and were deleted afterward. Those proofs do **not** mean production has been migrated. The connected production/default database remains separately evidence-gated.

### 3. Privacy
- `QUIZ_ENCRYPTION_KEY_V1`: base64 -> exactly 32 bytes
- `IDENTITY_HMAC_KEY`: independent base64 -> exactly 32 bytes
- secure backup confirmed before first real ciphertext
- canonical generated artwork stored in private Vercel Blob
- `/ops` receives only a short-lived signed artwork read URL
- Printful receives only a bounded signed artwork read URL at draft time
- raw seven answers never appear in Safepay, Printful, support, customer status, or ops list payloads
- private customer/support/design reveals remain explicit, scoped, and audited

### 4. Retail money
- ISSUED ONCE catalog currency is `USD` or `PKR` for the active Safepay adapter
- all retail prices are integer minor units internally
- Safepay adapter converts exact minor units -> decimal major units only at provider boundary
- signed Safepay webhook converts decimal major units -> exact integer minor units
- signed webhook merchant ID matches configured merchant
- amount and currency equal frozen payment attempt before PAID can be accepted
- replay after a crash completes the idempotent money transition
- exact PAID -> REFUNDED is monotonic; contradictory later money -> EXCEPTION
- browser redirect is never payment proof

### 5. Safepay sandbox
Before any production Safepay environment is enabled:
- real sandbox tracker opens hosted checkout at the expected amount
- cancel path returns safely
- signed PAID webhook is observed
- replay of the same signed PAID event is harmless and resumes downstream work
- signed refund test is observed if Safepay sandbox supports it
- pre-production refund quarantines Issue and blocks factory confirmation

### 6. Email
- issuedonce.shop sender/domain verified in Resend
- OTP arrives to a real inbox
- OTP retry/idempotency does not duplicate mail unexpectedly
- payment-received notification arrives once
- production, shipped and delivered notifications arrive from real state changes
- support submission reaches the support inbox with verified reply address

### 7. OpenAI design worker
- configured interpretation model is accessible from the deployed account
- configured image model is accessible from the deployed account
- one sandbox Issue produces a structured brief with `store:false`
- image generation receives structured brief, not raw seven answers
- generated PNG lands in private Blob
- a refund/quarantine cannot restart a queued design job
- a late in-flight design worker cannot resurrect an EXCEPTION Issue

### 8. Printful mapping
Every sellable ISSUED ONCE logical variant must have a sampled mapping containing:
- exact current Printful numeric variant ID
- exact file type / placement
- Printful print-area width/height/DPI
- placed width/height/top/left

The target placement must fit the area, and generated source pixels must be at least the placed pixel dimensions. No mapping = no sale/factory path for that variant.

### 9. Printful draft proof
With `PRINTFUL_ALLOW_CONFIRM` disabled:
- `/ops` approves one sandbox/test artwork
- create draft makes exactly one Printful draft
- retry resolves by public Issue Code before any create request
- canonical private Blob URL is never sent; only bounded signed read URL is sent
- correct blank/variant/size/color/placement is visually inspected in Printful
- questionnaire answers are absent from provider payload

### 10. Production-charge gate
Only after the draft is inspected:
- owner deliberately sets `PRINTFUL_ALLOW_CONFIRM=true`
- owner has a valid private `/ops` session
- Issue is still `MANUFACTURING_DRAFT`
- design is still `APPROVED`
- owner types exact phrase `CONFIRM <Issue Code>`
- server reloads current Issue state immediately before calling Printful confirm

After confirmation, return the kill switch to disabled if continuous automatic confirmations are not yet intended.

### 11. Signed fulfillment
- Printful v2 webhook signature proof observed in deployed environment
- provider order ID and public Issue Code cross-link the same Issue
- shipped event -> `IN_TRANSIT`
- delivered event -> `DELIVERED`
- provider retry is idempotent
- post-production payment exception remains an overlay and does not erase signed physical fulfillment truth

## Stop conditions

If any gate cannot be proven, ISSUED ONCE remains closed for production money/factory confirmation. The correct Governor result is `OWNER_REQUIRED`, `WAIT_EXTERNAL`, or another explicit stop state supported by the repo protocol—never an assumed green launch.
