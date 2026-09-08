# ISSUED ONCE Hostinger Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move ISSUED ONCE from Vercel to Hostinger Business Web Hosting while preserving Neon state, replacing Vercel Queue/Blob dependencies, and proving the real Tee/Cap/Tote flow before DNS cutover.

**Architecture:** Hostinger runs the full Next.js 16 app. Neon remains the data source and also hosts a durable provider-neutral background-job queue drained by a protected Hostinger cron endpoint. Private artwork moves behind the existing storage/access abstractions to a Hostinger private-filesystem adapter with signed application access; if the Hostinger runtime storage probe fails, only the storage adapter is swapped for S3-compatible object storage.

**Tech Stack:** Next.js 16.2.11, React 19, Node.js 22, pnpm 10.15, Neon/PostgreSQL, Vitest, Playwright, Hostinger Node.js Web Apps + cron.

**Spec:** `docs/superpowers/specs/2026-08-23-hostinger-migration-design.md`

## Global Constraints

- Work on `infra/hostinger-migration-20260823` until verified.
- Keep `feat/mystery-foundation` and current production untouched until migration gates pass.
- Do not apply `0029_creator_referrals.sql`.
- Do not enable Printful production confirmation.
- Do not make a real Safepay QA charge.
- Preserve the current Neon production database and the owner's failed Tote session.
- Every behavioral replacement follows RED -> GREEN -> full verification.
- Do not call Hostinger production-ready until a Hostinger URL proves Tee, Cap, and Tote through object/size/base with HTTP 200 and Tote reaches `COMMITMENT_READY`.

---

### Task 1: Add durable provider-neutral job storage

**Files:**
- Create: `db/migrations/0030_background_jobs.sql`
- Create: `src/server/jobs/JobQueue.ts`
- Create: `src/server/jobs/PostgresJobQueue.ts`
- Test: `tests/unit/postgres-job-queue.test.ts`

**Interfaces:**
- `JobQueue.enqueue(input: { topic: string; payload: unknown; idempotencyKey: string; availableAt?: Date }): Promise<{ id: string; duplicate: boolean }>`
- `JobQueue.claim(input: { topics: string[]; workerId: string; limit: number; leaseMs: number; now?: Date }): Promise<ClaimedJob[]>`
- `JobQueue.complete(id: string, workerId: string): Promise<void>`
- `JobQueue.retry(id: string, workerId: string, input: { availableAt: Date; error: string }): Promise<void>`
- `JobQueue.fail(id: string, workerId: string, error: string): Promise<void>`

- [ ] Write `tests/unit/postgres-job-queue.test.ts` with a fake SQL executor that proves enqueue idempotency, atomic claim semantics, lease ownership, complete, retry, and fail SQL/parameter behavior.
- [ ] Run the focused test and require RED because `PostgresJobQueue` does not exist.
- [ ] Add migration `0030_background_jobs.sql` creating `background_jobs` with UUID id, topic, JSONB payload, unique idempotency_key, state, available_at, attempts, max_attempts, lease_owner, lease_expires_at, last_error, created_at, updated_at; add an index on `(state, available_at, topic)`.
- [ ] Implement `JobQueue.ts` types and `PostgresJobQueue.ts`; claims must use a transaction/CTE with `FOR UPDATE SKIP LOCKED`, increment attempts on claim, and write a finite lease.
- [ ] Run focused tests to GREEN.
- [ ] Run full unit/type/lint checks.
- [ ] Commit as `feat: add durable postgres job queue`.

### Task 2: Replace Vercel Queue enqueue paths and callbacks

**Files:**
- Modify: `src/server/design/designQueue.ts`
- Modify: `src/server/notifications/notificationQueue.ts`
- Create: `src/server/jobs/runtimeJobs.ts`
- Create: `src/server/jobs/JobProcessor.ts`
- Create: `src/server/jobs/issuedOnceJobHandlers.ts`
- Create: `src/app/api/internal/jobs/drain/route.ts`
- Delete after parity is proven: `src/app/api/queue/design/route.ts`
- Delete after parity is proven: `src/app/api/queue/notifications/route.ts`
- Test: `tests/unit/job-processor.test.ts`
- Test: `tests/unit/job-drain-route.test.ts`
- Test/modify existing design/notification queue tests if present.

**Interfaces:**
- `enqueueDesignIssue(...)` and `enqueueIssueNotification(...)` retain their current call signatures.
- Queue topics remain `issued-once-design` and `issued-once-notifications` so operational meaning does not change.
- `JobProcessor.drain({ topics, workerId, limit }): Promise<{ claimed: number; completed: number; retried: number; failed: number }>`.

- [ ] Write RED tests proving existing enqueue functions no longer require `@vercel/queue`, preserve idempotency keys, and write the same message payloads to a supplied `JobQueue`.
- [ ] Refactor `designQueue.ts` and `notificationQueue.ts` to use `createJobQueue()` from `runtimeJobs.ts`; keep public function signatures stable.
- [ ] Extract the existing design callback body and notification/referral callback body into typed handler functions in `issuedOnceJobHandlers.ts` using the same zod schemas.
- [ ] Write RED `job-processor.test.ts` covering successful completion, retry with bounded exponential delay, invalid payload terminal failure, and max-attempt terminal failure.
- [ ] Implement `JobProcessor` with bounded batch processing and lease-safe completion/retry/failure.
- [ ] Write RED `job-drain-route.test.ts` proving missing/wrong bearer secret is 401, correct `CRON_SECRET` drains a bounded batch, and response contains counts only.
- [ ] Implement `POST /api/internal/jobs/drain`; never echo payloads/secrets.
- [ ] Remove Vercel callback route files only after their business logic is represented by handler tests.
- [ ] Run focused tests, then full unit/type/lint/build.
- [ ] Commit as `refactor: replace vercel queue with durable jobs`.

### Task 3: Replace Vercel Blob with provider-neutral private Hostinger storage

**Files:**
- Create: `src/server/design/FilesystemArtworkStorage.ts`
- Create: `src/server/design/SignedArtworkAccess.ts`
- Create: `src/app/api/artwork/[token]/route.ts`
- Modify: `src/server/design/runtimeDesign.ts`
- Modify: `src/server/ops/runtimeOwnerOs.ts`
- Remove after no references remain: `src/server/design/VercelBlobArtworkStorage.ts`
- Remove after no references remain: `src/server/design/VercelBlobArtworkAccess.ts`
- Test: `tests/unit/filesystem-artwork-storage.test.ts`
- Replace/extend: `tests/unit/artwork-access.test.ts`

**Interfaces:**
- Continue implementing existing `ArtworkStorageGateway`.
- Canonical stored value is an opaque `fs://<relative-key>` locator, never an absolute server path.
- `SignedArtworkAccess.createReadUrl(canonicalUrl, ttlMs)` returns an HTTPS URL under the application origin containing an HMAC-signed expiring token.

- [ ] Write RED filesystem storage tests using a temporary directory: PNG write succeeds, nested directories are created safely, empty bytes fail, identical object cannot overwrite, traversal segments are rejected.
- [ ] Implement `FilesystemArtworkStorage` using `fs/promises`, `mkdir({ recursive: true })`, and exclusive file creation (`flag: 'wx'`). Resolve every target under configured root and verify the resolved path remains inside the root.
- [ ] Rewrite artwork access tests to prove signed URLs expire, tampering fails, traversal fails, invalid scheme fails, and TTL stays within the existing six-day maximum.
- [ ] Implement `SignedArtworkAccess` using HMAC-SHA256 with `ARTWORK_SIGNING_KEY`; token contains only storage key + expiry, never filesystem root.
- [ ] Implement the artwork route to validate token, resolve within `ARTWORK_STORAGE_DIR`, stream PNG bytes with private/no-store cache headers, and return 404/401 without filesystem detail leakage.
- [ ] Update `runtimeDesign.ts` and `runtimeOwnerOs.ts` to construct filesystem storage rather than Vercel Blob.
- [ ] Remove Vercel Blob classes once repository search confirms zero production references.
- [ ] Run focused tests then full unit/type/lint/build.
- [ ] Commit as `refactor: replace vercel blob with private storage`.

### Task 4: Remove Vercel runtime package/config coupling and add release proof

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Delete: `vercel.json`
- Modify: `next.config.ts`
- Create: `src/server/runtime/releaseInfo.ts`
- Create: `src/app/api/health/release/route.ts`
- Test: `tests/unit/release-health-route.test.ts`

**Interfaces:**
- `GET /api/health/release` returns `{ ok, runtimeProvider, releaseId, version, databaseReady, queueReady, storageReady }` with no secrets.

- [ ] Write RED health-route tests for safe metadata and readiness failure behavior.
- [ ] Add build-time release identity using `generateBuildId` or a small build helper that prefers the Git commit SHA and falls back to a non-secret configured release ID.
- [ ] Implement health/release endpoint; database readiness performs a lightweight `SELECT 1`; storage readiness validates configured directory and queue readiness validates required DB/config without draining jobs.
- [ ] Remove `@vercel/blob` and `@vercel/queue` from `package.json`; regenerate lockfile through the normal package manager/CI workflow.
- [ ] Delete `vercel.json` only after Vercel queue routes/dependencies are gone.
- [ ] Run full unit/type/lint/build and require zero `@vercel/` runtime imports.
- [ ] Commit as `chore: make runtime host independent`.

### Task 5: Add Hostinger deployment/cron runbook and production smoke target

**Files:**
- Create: `docs/operations/hostinger-deployment.md`
- Modify: `tests/e2e/live-production-smoke.mjs`
- Modify: `.engineering/CONTINUATION.json`

- [ ] Update live smoke to accept `LIVE_BASE_URL` while defaulting to `https://issuedonce.shop`; retain exact Tee `M`, Cap `OS`, Tote `OS` object/size/base assertions and pass markers.
- [ ] Add a preflight request to `/api/health/release` and fail unless `runtimeProvider === 'hostinger'` when `EXPECT_RUNTIME_PROVIDER=hostinger` is set.
- [ ] Document exact Hostinger settings: GitHub repo `itxsam57/issued-once`, branch `infra/hostinger-migration-20260823` for preview migration, Node 22, `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm start`, environment variable list, private storage path, and protected cron command calling `/api/internal/jobs/drain`.
- [ ] Document DNS cutover only after temporary URL proof.
- [ ] Set governor to a migration state that names the exact remaining owner/external Hostinger setup step rather than claiming completion.
- [ ] Commit as `docs: add Hostinger deployment gate`.

### Task 6: CI and migration-branch review

- [ ] Push/confirm every migration commit is on `infra/hostinger-migration-20260823`.
- [ ] Require canonical CI workflow on migration branch: unit tests, typecheck, lint, production build.
- [ ] Require browser QA against local/preview-compatible routes.
- [ ] Review full diff against `7edd4519...`; reject unrelated product/UI/schema changes.
- [ ] Open a migration PR into `feat/mystery-foundation`, but do not merge before Hostinger runtime proof.

### Task 7: Hostinger temporary deployment and runtime proof

**Owner account action required only where account authentication is unavoidable.**

- [ ] In Hostinger hPanel create a new Node.js Web App using a temporary Hostinger domain.
- [ ] Connect GitHub and select `itxsam57/issued-once` + `infra/hostinger-migration-20260823`.
- [ ] Select Node.js 22 and the repository build/start settings.
- [ ] Add the existing production-safe environment variables copied from the current production configuration plus `RUNTIME_PROVIDER=hostinger`, `CRON_SECRET`, `ARTWORK_STORAGE_DIR`, and `ARTWORK_SIGNING_KEY`; do not add forbidden referral config or enable Printful confirmation.
- [ ] Deploy and verify `/api/health/release` reports Hostinger and expected release.
- [ ] Run storage write/read probe; if filesystem durability fails, keep the gateway and replace only its adapter with S3-compatible object storage before continuing.
- [ ] Create Hostinger cron calling the protected drain endpoint; verify a harmless empty drain succeeds.
- [ ] Run live production-shaped smoke against temporary Hostinger URL and require all three physical gate pass markers.
- [ ] Query Neon read-only to prove latest Hostinger Tote row is `OS`, locked base, `COMMITMENT_READY`; manufacturing jobs/events remain zero and referral migration remains absent.

### Task 8: Cut over `issuedonce.shop` and close migration

- [ ] Merge the migration PR to `feat/mystery-foundation` only after temporary Hostinger proof is green.
- [ ] Configure Hostinger app to deploy canonical `feat/mystery-foundation` automatically.
- [ ] Point/connect `issuedonce.shop` to the Hostinger Node.js app.
- [ ] Re-run release endpoint and complete real-domain Tee/Cap/Tote smoke.
- [ ] Recheck Neon safety invariants.
- [ ] Confirm owner's preserved Tote session can continue from `CONFIRM SIZE` without questionnaire restart.
- [ ] Update `.engineering/CONTINUATION.json` with Hostinger as production runtime and exact verified release.
- [ ] Update PR #3 release body; Vercel is no longer a production blocker.
- [ ] Only after all proof passes, disconnect Vercel's production-domain deployment. Keep rollback metadata until final release audit.
