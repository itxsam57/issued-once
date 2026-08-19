# ISSUED ONCE — Canonical production launch gate

Date: 2026-08-19
Migration head: `0019_payment_exception_timeline.sql`

This document supersedes older launch snippets that stop at an earlier migration number.

## Production stays closed until every gate below has observed evidence

### 1. Code / deployment
- exact reviewed GitHub head identified
- executable unit tests complete with zero failures
- executable TypeScript check completes with zero errors
- production build completes with exit 0
- browser journey completes on desktop + mobile
- Vercel project is visible to the owner/integration again
- both durable consumers are registered in the deployed environment:
  - `issued-once-design`
  - `issued-once-notifications`

### 2. Database
Production Neon must receive the complete chain through:

`db/migrations/CURRENT -> 0019_payment_exception_timeline.sql`

Required post-migration proofs:
- `payment_attempts.status` allows `REFUNDED`
- active payment truth freezes referenced contact/shipping snapshots
- FAILED unshown attempts release that freeze
- Issue state-machine trigger exists
- payment exception overlay columns/triggers exist
- contradictory signed provider money can quarantine payment truth
- pre-production payment exceptions create a canonical Issue timeline event

The connected temporary Neon branch has exercised these rules. Production has not been claimed migrated.

### 3. Privacy
- `QUIZ_ENCRYPTION_KEY_V1`: base64 -> exactly 32 bytes
- `IDENTITY_HMAC_KEY`: independent base64 -> exactly 32 bytes
- secure backup confirmed before first real ciphertext
- canonical generated artwork stored in private Vercel Blob
- `/ops` receives only a short-lived signed artwork read URL
- Printful receives only a bounded signed artwork read URL at draft time
- raw seven answers never appear in Safepay, Printful, support, customer status, or ops payloads

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

If any gate cannot be proven, ISSUED ONCE remains closed for production money/factory confirmation. The correct result is `OWNER_REQUIRED` or `WAIT_EXTERNAL`, never an assumed green launch.
