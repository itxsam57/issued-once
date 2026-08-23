# ISSUED ONCE — Hostinger Deployment Runbook

Date: 2026-08-24
Status: PR #13 migration execution. Hostinger temporary runtime health is proven; permanent cutover is blocked only by the separately owner-gated questionnaire encryption V1→V2 preservation migration.

## Immutable safety rules

- Prove a Hostinger temporary domain before connecting `issuedonce.shop`.
- Never expose `QUIZ_ENCRYPTION_KEY_V1`, `QUIZ_ENCRYPTION_KEY_V2`, `QUIZ_KEY_ROTATION_TOKEN`, OTPs, sessions, customer answers, addresses, payment secrets, or provider secrets in GitHub, logs, artifacts, or chat.
- Never generate a replacement V1 key. V1 is decrypt-only during preservation.
- New questionnaire writes use V2 only once the compatible release is deployed.
- Production migration `0031_quiz_encryption_key_v2.sql` requires separate exact owner approval before application.
- Migration `0029_creator_referrals.sql` remains unrelated and forbidden without its own approval.
- Keep `PRINTFUL_ALLOW_CONFIRM` off and do not make a real Safepay QA charge.
- Keep canonical artwork outside both `public_html` and Hostinger's redeployed Node build directory.
- Browser navigation is never payment proof.

## 1. Current proven Hostinger runtime

Temporary URL:

`https://lightgray-coyote-141764.hostingersite.com`

Currently deployed frozen branch/release:

- Branch: `release/hostinger-candidate-20260823`
- Release SHA: `929081a8c08b0836ec74037cbb0a7aa59ec88640`
- `RELEASE_ID=929081a8c08b0836ec74037cbb0a7aa59ec88640`
- pnpm: `11.23.0`
- Node: 22.x

Existing proof for that frozen runtime:

- CI #1329: PASS — frozen install, unit tests, typecheck, lint, production build
- Browser QA #1228: PASS
- `/api/health/release`: HTTP 200 with `ok=true`, `runtimeProvider=hostinger`, exact release ID, `databaseReady=true`, `queueReady=true`, `storageReady=true`

This release is deliberately left in place while the V1→V2 bridge is staged. Do not call the Tee/Cap/Tote production matrix complete yet.

## 2. Database state

Production Neon:

- Project: `autumn-butterfly-25489215`
- Database: `neondb`
- Production branch: `br-dawn-cloud-axm880q9`
- `0030_background_jobs.sql`: applied and verified through managed migration `ac06c578-5607-460b-8550-5b3fc30c6742`
- referral migration `0029`: not applied
- manufacturing jobs: 0
- manufacturing provider events: 0

Questionnaire encryption state observed on 2026-08-23 after staging `0031`:

- production V1 answer rows: 1,868
- production V2 answer rows: 0
- production constraint remains V1-only
- the count may continue growing until the V2 bridge is deployed, so use a fresh count immediately before and after rotation

## 3. `0031` temporary-branch proof — COMPLETE

Migration file:

`db/migrations/0031_quiz_encryption_key_v2.sql`

Managed Neon staging proof:

- Migration ID: `36a667fe-e801-4496-ae67-e9b1719472d2`
- Temporary branch name: `mcp-migration-2026-08-23T23-49-32`
- Temporary branch ID: `br-sweet-bread-axagx9qp`
- Parent production branch ID: `br-dawn-cloud-axm880q9`

Verified on the temporary branch:

- the answer key-version constraint accepts exactly V1 and V2
- constraint is validated
- all copied 1,868 questionnaire rows remain V1 before rotation
- V2 count is 0 before rotation
- unexpected key-version count is 0
- referral tables remain absent
- manufacturing counts remain 0/0

A separate read-only production query confirmed production still has the original V1-only constraint. **Do not complete this managed migration until the owner explicitly approves production `0031`.**

## 4. V2-compatible implementation proof — COMPLETE

Migration implementation branch:

`infra/hostinger-migration-20260823`

Verified implementation head before this runbook update:

`328011839ec79b18e8c016ca5fb4bba124b45eca`

Evidence:

- CI #1353: PASS — unit tests, typecheck, lint, production build
- Browser QA #1252: PASS
- Task 1: V2-only writer with V1/V2 reader support
- Task 2: bounded, idempotent Postgres rotation service with compare-and-swap updates
- Task 3: Vercel-production-only protected rotation endpoint returning aggregate counts only
- Task 4: schema-only `0031` migration contract and temporary Neon proof

The browser harness uses distinct test-only V1 and V2 keys. No production key value is present in repository code.

## 5. Required owner gate

The next production mutation is exactly:

`APPROVE_PRODUCTION_MIGRATION_0031`

Approval applies only to `db/migrations/0031_quiz_encryption_key_v2.sql` / managed migration `36a667fe-e801-4496-ae67-e9b1719472d2`.

It does **not** authorize migration 0029, payments, Printful confirmation, domain cutover, or any unrelated schema change.

## 6. After `0031` approval: apply and verify schema first

Use Neon managed migration completion with the preserved migration context. After application, independently verify on production:

- the exact constraint accepts V1 and V2
- current V1 count is preserved
- V2 is still zero before bridge rotation
- unexpected key-version count is zero
- referral tables remain absent
- manufacturing remains 0/0

Stop if any invariant differs.

## 7. Configure V2 bridge secrets without exposing them

Only after production `0031` is verified:

1. Generate exactly 32 cryptographically random bytes and base64-encode them for `QUIZ_ENCRYPTION_KEY_V2`.
2. Configure the **same exact V2 value** in Vercel production and Hostinger.
3. Leave the existing Vercel `QUIZ_ENCRYPTION_KEY_V1` unchanged.
4. Configure a separate temporary `QUIZ_KEY_ROTATION_TOKEN` in Vercel production only; minimum 32 characters, high entropy.
5. Never paste any of these values into chat, source control, logs, screenshots, or workflow inputs.

Hostinger no longer needs V1 after all production rows have been rotated and independently verified at V1=0. Until that zero proof exists, do not delete V1 from the Vercel bridge runtime.

## 8. Deploy the temporary Vercel preservation bridge

Deploy the V2-compatible code to the still-running Vercel production runtime while preserving its existing V1 key.

Required bridge properties:

- `VERCEL_ENV=production`
- existing V1 key present and unchanged
- V2 key present
- temporary rotation token present
- same production `DATABASE_URL`
- no response/log contains plaintext, ciphertext, IV, auth tag, key material, session, or customer identity

The protected endpoint is:

`POST /api/internal/quiz-encryption/rotate`

It must be unreachable outside Vercel production and requires the dedicated bearer token.

## 9. Rotate V1 rows in bounded batches

Run bounded batches, normally 100 and never above 250.

Each response may contain only:

- `scanned`
- `migrated`
- `skipped`
- `failed`
- `remaining`

Rules:

- stop immediately if `failed > 0`
- CAS skips are safe and may be retried
- do not expose row identifiers or payload data
- continue until endpoint reports `remaining=0`
- because production may receive new answers during rollout, independently query Neon after the final batch

Independent completion proof must show:

- V1 count = exactly 0
- unexpected key-version count = 0
- V2 count equals the full current questionnaire-answer population
- manufacturing remains 0/0
- referral migration 0029 remains absent

Only this independent database proof retires the V1-data dependency.

## 10. Promote the compatible Hostinger release

After V1 reaches zero and the same V2 key is configured in Hostinger:

1. Freeze a new Hostinger release candidate from the verified migration head.
2. Set `RELEASE_ID` to that exact SHA.
3. Redeploy the temporary Hostinger Node app.
4. Require `/api/health/release` HTTP 200 with exact SHA, database, queue and storage all true.
5. Run Live Release QA against the temporary Hostinger URL.

Required public matrix:

- Tee → M → Bone → object/size/base HTTP 200 → real OTP request boundary
- Cap → OS → Bone → object/size/base HTTP 200 → no OTP requirement for the matrix proof
- Tote → OS → Bone → object/size/base HTTP 200 → no OTP requirement for the matrix proof

No real Safepay charge and no Printful confirmation are permitted for this proof.

## 11. Private artwork and durable jobs

Private artwork root must remain persistent and non-public, for example:

`/home/<hostinger-user>/issued-once-private-artwork`

Never use `public_html` or the Hostinger Node deployment directory.

Required runtime variables include:

- `NODE_ENV=production`
- `RUNTIME_PROVIDER=hostinger`
- exact `RELEASE_ID`
- `APP_VERSION=0.1.0`
- temporary `APP_ORIGIN` until domain cutover
- `DATABASE_URL`
- `QUIZ_ENCRYPTION_KEY_V2`
- `ARTWORK_STORAGE_DIR`
- `ARTWORK_SIGNING_KEY`
- `CRON_SECRET`
- the existing provider/config values needed by the application

Keep absent/off:

- `REFERRAL_ATTRIBUTION_SIGNING_KEY`
- `PRINTFUL_ALLOW_CONFIRM=true`
- obsolete Vercel Blob/Queue configuration

After the compatible temporary Hostinger release is healthy, manually prove `/api/internal/jobs/drain` using `CRON_SECRET`, then configure the Hostinger cron without putting the secret in a URL query string or public file.

## 12. Neon post-smoke proof

After temporary Hostinger Tee/Cap/Tote proof, verify production read-only:

- newest Tee reaches `COMMITMENT_READY`
- newest Cap reaches `COMMITMENT_READY`
- newest Tote reaches `COMMITMENT_READY`
- Tote persists `size_code='OS'`
- locked base colors persist
- V1 questionnaire count remains 0
- manufacturing jobs remain 0
- manufacturing provider events remain 0
- referral schema remains absent

## 13. Production domain cutover

Only after sections 6–12 are green:

1. Connect `issuedonce.shop` to the proved Hostinger app.
2. Require HTTPS to serve Hostinger.
3. Set `APP_ORIGIN=https://issuedonce.shop`.
4. Update the job cron URL to the final domain.
5. Redeploy.
6. Re-run exact release health against `https://issuedonce.shop`.
7. Re-run Live Release QA against the final domain with the same exact release SHA.
8. Re-run Neon read-only safety proof.

Only after this second proof may PR #13 be eligible to merge into `feat/mystery-foundation`.

PR #3 remains a separate final-release audit gate and must not be merged merely because Hostinger migration succeeds.

## 14. Retire Vercel only after final proof

Vercel is the temporary preservation bridge because it still possesses the valid V1 decryption key. Retire it from request serving only when all of these are independently true:

- production V1 answer count is exactly 0
- final Hostinger release is healthy on `issuedonce.shop`
- Tee/Cap/Tote final-domain matrix passes
- durable jobs are proven on Hostinger
- Neon safety invariants pass

After that proof, remove the temporary rotation token and V1 bridge dependency. Do not retain the one-time rotation endpoint as an externally usable maintenance surface.

## 15. Rollback rule

- Before domain cutover, leave production traffic on the last known-good provider if the Hostinger candidate fails.
- If rotation reports any failure, stop rotation; do not delete V1 and do not improvise a replacement key.
- If post-cutover infrastructure fails, stop implicated cron processing first, keep Printful confirmation disabled, preserve payment truth, and restore traffic only to a schema-compatible known-good runtime.
- Never roll back the database by deleting or rewriting encrypted questionnaire rows. Diagnose from exact release IDs, safe aggregate rotation counts, runtime logs that contain no private payloads, and read-only Neon state.

## Completion evidence

Hostinger migration is complete only when all are true:

- production `0031` was explicitly owner-approved, applied and independently verified
- production V1 questionnaire count reached exactly 0 through the authenticated Vercel bridge
- same V2 key is active on the permanent Hostinger runtime without being exposed
- exact Hostinger release SHA has green CI and Browser QA
- temporary Hostinger health and Tee/Cap/Tote matrix pass
- durable job endpoint and Hostinger cron pass
- manufacturing remains unconfirmed/uncharged during migration proof
- referral migration/signing remains disabled
- `issuedonce.shop` serves the same proved Hostinger release
- final-domain health, live matrix and Neon read-only proof pass
- Vercel bridge is retired only after final-domain proof
