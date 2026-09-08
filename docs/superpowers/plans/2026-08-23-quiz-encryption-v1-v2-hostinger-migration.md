# Quiz Encryption V1 → V2 Hostinger Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve all existing V1-encrypted questionnaire answers, rotate new writes to V2, migrate 1,847 production V1 rows safely through the still-running Vercel runtime, and unblock permanent Hostinger cutover.

**Architecture:** Add version-aware AES-256-GCM payload handling where V1 is decrypt-only and V2 is the only writer. Add a bounded, idempotent Postgres-backed rotation service plus a Vercel-production-only authenticated internal endpoint. Migration `0031` broadens only the `experience_answers.key_version` check constraint from V1-only to `v1|v2`; production application remains owner-gated.

**Tech Stack:** Next.js 16, TypeScript 5.9, Node.js 22, Vitest, Neon Postgres, AES-256-GCM via `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-08-23-quiz-encryption-v1-v2-hostinger-migration-design.md`

## Global Constraints

- Never expose V1 or V2 in logs, GitHub, artifacts, browser responses, database rows, or chat.
- Never replace `QUIZ_ENCRYPTION_KEY_V1` with a generated replacement.
- `QUIZ_ENCRYPTION_KEY_V1` and `QUIZ_ENCRYPTION_KEY_V2` must each decode from base64 to exactly 32 bytes when their version is required.
- New questionnaire writes use V2 only.
- V1 remains decrypt-only until all production V1 rows are migrated and independently verified at zero.
- No plaintext questionnaire answer may be persisted during migration.
- The migration endpoint must run only in Vercel production, must be authenticated, and must return aggregate counts only.
- Production migration `0031` requires separate exact owner approval before application.
- Migration `0029_creator_referrals.sql` remains forbidden and unrelated.
- Printful production confirmation remains disabled; no real Safepay QA charge is authorized.
- Current production inventory before implementation: 1,847 `experience_answers` rows with `key_version='v1'` and constraint `experience_answers_key_version_check = CHECK (key_version = 'v1')`.

---

### Task 1: Version-aware private payload crypto

**Files:**
- Modify: `src/server/crypto/privatePayload.ts`
- Modify: `tests/unit/private-payload.test.ts`

**Interfaces:**
- Consumes: base64 environment variables `QUIZ_ENCRYPTION_KEY_V1`, `QUIZ_ENCRYPTION_KEY_V2`.
- Produces: `EncryptedPayloadV1`, `EncryptedPayloadV2`, `EncryptedPayload`; `encryptPrivatePayload(value)` that always emits V2; `decryptPrivatePayload(payload)` that dispatches by `keyVersion`.

- [ ] **Step 1: Expand the unit test first**

Add tests that create a known V1 AES-256-GCM fixture locally in the test, then assert:

```ts
expect(await decryptPrivatePayload(v1Fixture)).toEqual(source);
expect((await encryptPrivatePayload(source)).keyVersion).toBe('v2');
expect(await decryptPrivatePayload(await encryptPrivatePayload(source))).toEqual(source);
```

Also assert that missing/malformed V1 fails only for V1 decrypt, missing/malformed V2 fails for V2 encrypt/decrypt, and a V1 payload cannot be decrypted using only V2.

- [ ] **Step 2: Run the focused crypto test and confirm RED**

Run: `pnpm test -- tests/unit/private-payload.test.ts`

Expected: FAIL because the current implementation only supports V1 and new writes still emit `keyVersion: 'v1'`.

- [ ] **Step 3: Implement minimal version-aware crypto**

Use a version-specific key loader:

```ts
type KeyVersion = 'v1' | 'v2';

function loadKey(version: KeyVersion): Buffer {
  const envName = version === 'v1' ? 'QUIZ_ENCRYPTION_KEY_V1' : 'QUIZ_ENCRYPTION_KEY_V2';
  const encoded = process.env[envName];
  if (!encoded) throw new Error(`${envName} is required`);
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error(`${envName} must decode to exactly 32 bytes`);
  return key;
}
```

Keep payload version `1` and use self-describing `keyVersion`. `encryptPrivatePayload` must always create a fresh 12-byte IV and use V2; `decryptPrivatePayload` must select the matching key from the payload metadata.

- [ ] **Step 4: Run focused crypto test GREEN**

Run: `pnpm test -- tests/unit/private-payload.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Commit message: `feat(crypto): add versioned quiz encryption V2`

---

### Task 2: Postgres rotation repository and bounded migration service

**Files:**
- Create: `src/server/crypto/QuizEncryptionRotationRepository.ts`
- Create: `src/server/crypto/PostgresQuizEncryptionRotationRepository.ts`
- Create: `src/server/crypto/QuizEncryptionRotationService.ts`
- Create: `tests/unit/quiz-encryption-rotation-service.test.ts`
- Create: `tests/unit/postgres-quiz-encryption-rotation-repository.test.ts`

**Interfaces:**
- `QuizEncryptionRotationRepository.listV1(limit: number): Promise<StoredQuizCiphertext[]>`
- `QuizEncryptionRotationRepository.replaceV1(row: StoredQuizCiphertext, encrypted: EncryptedPayloadV2): Promise<boolean>`
- `QuizEncryptionRotationRepository.countV1(): Promise<number>`
- `QuizEncryptionRotationService.migrateBatch(limit: number): Promise<{ scanned: number; migrated: number; skipped: number; failed: number; remaining: number }>`

- [ ] **Step 1: Write service tests RED**

Cover all required behavior with an in-memory fake repository:

```ts
const result = await service.migrateBatch(100);
expect(result).toEqual({ scanned: 1, migrated: 1, skipped: 0, failed: 0, remaining: 0 });
expect(fake.rows[0].keyVersion).toBe('v2');
```

Also test already-V2 rows are never listed/changed, a compare-and-swap false result increments `skipped`, and a decrypt/encrypt failure increments `failed`, stops the batch, and leaves that source V1 row unchanged.

- [ ] **Step 2: Run service test RED**

Run: `pnpm test -- tests/unit/quiz-encryption-rotation-service.test.ts`

Expected: FAIL because the repository/service do not exist.

- [ ] **Step 3: Implement repository contracts and service**

`StoredQuizCiphertext` contains only identifiers plus encrypted metadata:

```ts
export type StoredQuizCiphertext = {
  experienceId: string;
  questionId: string;
  payloadVersion: 1;
  keyVersion: 'v1';
  iv: string;
  tag: string;
  ciphertext: string;
};
```

The service decrypts each V1 row in memory, immediately encrypts with `encryptPrivatePayload` (V2), then calls `replaceV1`. Do not log payloads or identifiers.

- [ ] **Step 4: Write Postgres repository SQL tests RED**

Use a recording `SqlExecutor` and assert:

- `listV1` filters `key_version = 'v1'`, orders deterministically, and parameterizes `LIMIT`.
- `replaceV1` updates the same `(experience_id, question_id)` only where `key_version = 'v1'`, writes V2 metadata, and returns success only when exactly one row is returned.
- `countV1` returns the aggregate V1 count.

- [ ] **Step 5: Implement Postgres repository GREEN**

Use `SqlExecutor` from `PostgresExperienceRepository.ts`. The update must be compare-and-swap guarded by `key_version = 'v1'`; no plaintext columns are introduced.

- [ ] **Step 6: Run both focused tests GREEN**

Run: `pnpm test -- tests/unit/quiz-encryption-rotation-service.test.ts tests/unit/postgres-quiz-encryption-rotation-repository.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Commit message: `feat(crypto): add bounded quiz key rotation service`

---

### Task 3: Vercel-only protected one-time rotation endpoint

**Files:**
- Create: `src/server/crypto/runtimeQuizEncryptionRotation.ts`
- Create: `src/server/http/quizRotationAuth.ts`
- Create: `src/app/api/internal/quiz-encryption/rotate/route.ts`
- Create: `tests/unit/quiz-rotation-auth.test.ts`
- Create: `tests/unit/quiz-encryption-rotate-route.test.ts`

**Interfaces:**
- Env: `QUIZ_KEY_ROTATION_TOKEN` (temporary secret, minimum 32 characters).
- Runtime gate: `VERCEL_ENV === 'production'`.
- Request: `POST /api/internal/quiz-encryption/rotate` with `Authorization: Bearer <token>` and optional JSON `{ "limit": 100 }`.
- Response: aggregate counts only: `{ scanned, migrated, skipped, failed, remaining }`.

- [ ] **Step 1: Write auth tests RED**

Require timing-safe bearer verification using SHA-256 digests, mirroring `internalAuth.ts`, and fail closed when the configured token is absent or too short.

- [ ] **Step 2: Write route tests RED**

Assert:

- non-Vercel or non-production runtime returns 404/503 without touching DB;
- missing/incorrect token returns 401;
- malformed limit returns 400;
- valid request calls one bounded batch and returns aggregate counts only;
- no response field contains ciphertext, IV, tag, answer, session, key, or customer identity.

- [ ] **Step 3: Implement runtime factory and route**

`runtimeQuizEncryptionRotation.ts` requires `DATABASE_URL`, constructs `PostgresQuizEncryptionRotationRepository(createNeonSqlExecutor(databaseUrl))`, and returns `QuizEncryptionRotationService`.

The route validates `VERCEL_ENV === 'production'` before auth and execution. Limit schema: integer `1..250`, default `100`.

- [ ] **Step 4: Run focused route/auth tests GREEN**

Run: `pnpm test -- tests/unit/quiz-rotation-auth.test.ts tests/unit/quiz-encryption-rotate-route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Commit message: `feat(ops): add protected Vercel quiz rotation endpoint`

---

### Task 4: Schema migration 0031 and temporary-branch proof

**Files:**
- Create: `db/migrations/0031_quiz_encryption_key_v2.sql`
- Create: `tests/unit/quiz-encryption-v2-migration.test.ts`

**Interfaces:**
- Existing constraint: `experience_answers_key_version_check`.
- Allowed after migration: `key_version IN ('v1', 'v2')`.
- No other table, column, index, or data mutation is authorized by this migration.

- [ ] **Step 1: Write migration contract test RED**

Read the SQL file and assert it references only `experience_answers` plus the exact key-version constraint, does not reference referral/manufacturing/payment tables, and broadens the check to exactly V1/V2.

- [ ] **Step 2: Create the migration SQL GREEN**

Use a transaction, drop the exact current check constraint, and recreate it allowing `v1` and `v2`. Do not update any ciphertext row in the migration file.

- [ ] **Step 3: Run migration contract test GREEN**

Run: `pnpm test -- tests/unit/quiz-encryption-v2-migration.test.ts`

Expected: PASS.

- [ ] **Step 4: Prepare migration on a Neon temporary branch**

Use the managed Neon migration workflow against project `autumn-butterfly-25489215`, database `neondb`. Do not complete/apply it to production.

- [ ] **Step 5: Verify temporary branch**

Run read-only checks on the temporary branch proving:

- `experience_answers_key_version_check` accepts both versions;
- all 1,847 copied rows remain V1 before rotation;
- no referral schema appears;
- manufacturing counts are unchanged.

Stop at the production-application approval gate and preserve the migration ID/temporary branch ID for the owner decision.

- [ ] **Step 6: Commit Task 4**

Commit message: `db: add quiz encryption V2 key-version migration`

---

### Task 5: Full verification and operational documentation

**Files:**
- Modify: `docs/operations/hostinger-deployment.md`
- Modify: `.engineering/CONTINUATION.json`

**Interfaces:**
- No secret values are written into docs/governor.
- Production `0031` remains un-applied until exact owner approval.

- [ ] **Step 1: Run full static and unit gates**

Run sequentially:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all exit 0.

- [ ] **Step 2: Run Browser QA on the migration head**

Require GitHub Browser QA success on the exact migration-head SHA.

- [ ] **Step 3: Update Hostinger runbook**

Add the V2 bridge sequence, temporary Vercel role, required temporary `QUIZ_KEY_ROTATION_TOKEN`, V2 generation requirements, zero-V1 verification rule, and explicit Vercel-retirement step.

- [ ] **Step 4: Update continuation governor**

Record:

- implementation head SHA;
- 1,847 current production V1 rows;
- 0031 temporary migration proof IDs/status;
- next state `OWNER_REQUIRED` with exact action `APPROVE_PRODUCTION_MIGRATION_0031`;
- 0029 still forbidden, Printful still disabled, no real Safepay QA charge.

- [ ] **Step 5: Commit Task 5**

Commit message: `docs: stage quiz V2 production migration gate`

---

### Task 6: Production execution after separate owner approval

**Files:** No code changes expected unless verification exposes a defect.

**Interfaces:** Uses the already-tested `0031`, V2-compatible release, Vercel production bridge endpoint, Neon production, then Hostinger.

- [ ] **Step 1: Require exact owner approval**

Do not apply production `0031` until the owner explicitly approves `0031_quiz_encryption_key_v2.sql`.

- [ ] **Step 2: Apply 0031 with managed Neon migration completion**

Verify production constraint and unchanged safety invariants.

- [ ] **Step 3: Generate and configure V2 without exposing it**

Generate 32 random bytes, base64 encode them, set the exact same `QUIZ_ENCRYPTION_KEY_V2` in Vercel and Hostinger. Configure a separate temporary `QUIZ_KEY_ROTATION_TOKEN` in Vercel only.

- [ ] **Step 4: Deploy compatible code to Vercel bridge runtime**

Keep V1 untouched. Require health/runtime proof before rotation.

- [ ] **Step 5: Rotate bounded batches until zero V1 remains**

Call the protected endpoint repeatedly with safe bounded batches. Stop immediately on `failed > 0`. Independently verify with Neon read-only SQL that V1 count reaches exactly zero and V2 count equals the preserved answer population.

- [ ] **Step 6: Prove Hostinger**

Deploy the same compatible release to Hostinger with V2 configured, then require exact health and Tee/Cap/Tote live matrix proof.

- [ ] **Step 7: Cut over `issuedonce.shop` and retire Vercel**

Only after the final-domain Hostinger proof and DB safety checks pass, remove Vercel from request serving and retire V1 with Vercel.
