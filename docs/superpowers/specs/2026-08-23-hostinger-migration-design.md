# ISSUED ONCE Hostinger Migration Design

## Goal
Move the production runtime from Vercel to the owner's existing Hostinger Business Web Hosting plan, preserve the current Neon production database and customer state, remove Vercel as a production runtime dependency, and prove the real Tee/Cap/Tote flow before switching `issuedonce.shop`.

## Current constraints
- Canonical product branch: `feat/mystery-foundation`.
- Migration work happens on `infra/hostinger-migration-20260823` until verified.
- Current production database remains Neon; no database replacement is part of this migration.
- Migration `0029_creator_referrals.sql` remains forbidden without separate explicit owner approval.
- Printful production confirmation remains disabled.
- No real Safepay QA charge is introduced by this migration.
- Existing failed owner Tote session must remain recoverable.
- Current Vercel-specific runtime dependencies are `@vercel/queue`, `@vercel/blob`, and `vercel.json` queue triggers.
- Hostinger Business supports full-stack Next.js, GitHub deployment, Node.js 22, environment variables, persistent server processes, and cron jobs.

## Chosen architecture

### 1. Web runtime
Run the existing Next.js 16 application as a Hostinger Node.js Web App. Keep the existing `pnpm` package manager, `next build`, and `next start` entry points. Hostinger will deploy from GitHub and initially use a temporary Hostinger URL so production DNS is not switched until live verification passes.

### 2. Database
Keep Neon as the single source of truth. No customer, checkout, OTP, issue, manufacturing, referral, or physical-selection data is copied to Hostinger.

### 3. Background jobs
Replace Vercel Queue with a provider-neutral durable queue stored in Neon.

The queue contract will support:
- topic
- JSON payload
- idempotency key
- available-at timestamp
- lease/lock ownership
- retry count
- last error
- terminal success/failure state

Workers claim jobs atomically using PostgreSQL row locking (`FOR UPDATE SKIP LOCKED`) and leases so multiple drains cannot process the same job concurrently. Existing design and notification enqueue call sites keep narrow interfaces rather than depending directly on Postgres.

Hostinger cron will call a protected internal drain endpoint on a schedule. The endpoint requires a dedicated `CRON_SECRET`, processes a bounded batch, and returns machine-readable counts. Job processing remains safe to retry and idempotent.

This design is intentionally provider-neutral: a future SQS, Cloudflare Queues, or other implementation can replace the Postgres queue without changing business services.

### 4. Private artwork storage
Keep the existing `ArtworkStorageGateway`/access abstraction and remove Vercel-specific implementations.

Primary Hostinger adapter:
- store artwork under a private writable directory outside the web root, configured by `ARTWORK_STORAGE_DIR`;
- write with create-exclusive semantics so a design job cannot silently overwrite another object;
- persist only opaque storage keys in the database, not public filesystem paths;
- serve artwork only through a signed application route that validates a short-lived HMAC token and streams the file;
- never place private artwork in `public_html` or expose a directly guessable URL.

Deployment must include a runtime storage probe before this adapter is considered production-ready. If Hostinger's managed Node process cannot durably write to the configured private path, the storage interface remains unchanged and the adapter is switched to S3-compatible object storage; the rest of the migration does not change.

### 5. Runtime release identity
Add a deployment health/release endpoint that exposes only non-secret operational metadata:
- runtime provider (`hostinger`)
- build/release identifier
- app version
- database connectivity status
- queue/storage readiness flags

The build identifier is generated at build time from the Git commit when available. Live smoke tests must prove they are hitting the expected Hostinger release before product-flow claims are accepted.

### 6. Environment variables
Hostinger production receives the existing non-Vercel application secrets/config plus:
- `RUNTIME_PROVIDER=hostinger`
- `CRON_SECRET=<random secret>`
- `ARTWORK_STORAGE_DIR=<private writable Hostinger path>`
- `ARTWORK_SIGNING_KEY=<random signing key>`

Remove production reliance on:
- `BLOB_READ_WRITE_TOKEN`
- Vercel Queue runtime configuration

`OPENAI_API_KEY` remains a separate later production design-generation gate; its absence must continue to trigger the existing manual/fallback behavior rather than break ordering.

### 7. Deployment and DNS cutover
1. Deploy migration branch to a temporary Hostinger Node.js app URL.
2. Configure environment variables using the current Neon production database and existing production-safe service credentials.
3. Run unit/type/lint/build checks.
4. Run browser QA against Hostinger temporary URL.
5. Run production-shaped live smoke against the Hostinger URL and require Tee, Cap, and Tote to reach physical `COMMITMENT_READY` through object/size/base HTTP 200 responses.
6. Verify the Tote OS regression is fixed on Hostinger.
7. Verify manufacturing jobs/events remain zero and migration 0029/referral schema remains absent.
8. Only after all gates pass, connect `issuedonce.shop` to Hostinger.
9. Re-run the exact same live smoke on the real domain.
10. Disconnect Vercel deployment from production only after the Hostinger domain proof succeeds.

### 8. Testing strategy
TDD applies to every behavioral replacement.

Required automated coverage:
- durable queue enqueue/idempotency
- concurrent claim/lease behavior
- retry and terminal-failure behavior
- design queue adapter parity
- notification queue adapter parity
- cron authorization and bounded drain behavior
- private artwork write/no-overwrite
- signed artwork URL validation, expiry, path traversal rejection, and unauthorized access rejection
- runtime health/release endpoint
- existing full unit suite
- typecheck/lint/Next production build
- existing browser suite
- real Hostinger Tee/Cap/Tote live production-shaped smoke

### 9. Rollback
Do not delete the Vercel project during migration. DNS remains on the old production deployment until Hostinger passes all gates. If Hostinger fails after cutover, DNS can be returned to the last known-good Vercel deployment while the Hostinger issue is repaired. Vercel-specific code is removed from canonical only after Hostinger is proven.

## Success criteria
The migration is complete only when:
- `issuedonce.shop` resolves to Hostinger;
- the expected Hostinger release is identifiable from the live endpoint;
- Tee, Cap, and Tote all pass real object/size/base gates on the real domain;
- Tote `OS` reaches `COMMITMENT_READY`;
- Neon data continuity is intact;
- manufacturing safety invariants are unchanged;
- Vercel Queue/Blob are no longer required by the production application;
- GitHub-to-Hostinger redeploy works from the canonical branch;
- the continuation governor records Hostinger as the production runtime.
