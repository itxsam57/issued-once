# ISSUED ONCE — Hostinger Deployment Runbook

Date: 2026-08-24
Status: production `0031` is applied and verified. The migration no longer depends on a new Vercel deployment; the one-time V1→V2 rotation can run from Hostinger behind an explicit bridge flag after Hostinger is proven on the final domain.

## Immutable safety rules

- Never expose `QUIZ_ENCRYPTION_KEY_V1`, `QUIZ_ENCRYPTION_KEY_V2`, `QUIZ_KEY_ROTATION_TOKEN`, OTPs, sessions, customer answers, addresses, or provider secrets.
- Never generate a replacement V1 key. Copy the existing valid V1 key unchanged from Vercel to Hostinger.
- `QUIZ_KEY_ROTATION_HOSTINGER_BRIDGE=enabled` is temporary and must be removed/disabled after V1 reaches independently verified zero.
- Migration `0029_creator_referrals.sql` remains forbidden without its own exact owner approval.
- Keep `PRINTFUL_ALLOW_CONFIRM` off. Do not make a real Safepay QA charge.
- Keep artwork outside `public_html` and the redeployed Node directory.
- Do not rotate V1 rows before Hostinger has passed final-domain live proof; after rotation begins, the old V1-only Vercel runtime is no longer a safe rollback target.

## 1. Current production database

Neon project `autumn-butterfly-25489215`, database `neondb`, production branch `br-dawn-cloud-axm880q9`.

Applied and verified:

- `0030_background_jobs.sql` — migration `ac06c578-5607-460b-8550-5b3fc30c6742`
- `0031_quiz_encryption_key_v2.sql` — migration `36a667fe-e801-4496-ae67-e9b1719472d2`

Post-0031 verification:

- key-version constraint accepts V1/V2 and is validated
- V1 rows: 1,868 at verification time
- V2 rows: 0 at verification time
- unexpected versions: 0
- referral creator/conversion tables absent
- manufacturing jobs/events: 0/0

Counts may change until cutover, so use fresh counts before and after rotation.

## 2. Current Hostinger runtime

Temporary URL:

`https://lightgray-coyote-141764.hostingersite.com`

Currently deployed old candidate:

- branch `release/hostinger-candidate-20260823`
- SHA `929081a8c08b0836ec74037cbb0a7aa59ec88640`
- health has previously passed exact SHA + database + queue + storage
- live answer persistence currently fails because this runtime does not have the valid V1 questionnaire key

Do not treat that failure as a code regression. The old candidate remains in place until the required secrets are safely configured.

## 3. V2-compatible Hostinger bridge candidate

Frozen branch:

`release/hostinger-v2-bridge-20260824`

Exact SHA:

`974506b7aa041c025b609d765f943cbc61bcff4a`

Exact-sha verification:

- CI #1358: PASS — frozen install, all unit tests, typecheck, lint, production build
- Browser QA #1257: PASS

Capabilities:

- reads V1 and V2 encrypted questionnaire answers
- new questionnaire writes use V2
- bounded idempotent V1→V2 rotation with compare-and-swap writes
- batch size 1..250
- aggregate-only response
- Vercel-production fallback remains available
- Hostinger rotation is unavailable unless BOTH `RUNTIME_PROVIDER=hostinger` and `QUIZ_KEY_ROTATION_HOSTINGER_BRIDGE=enabled`
- valid dedicated `QUIZ_KEY_ROTATION_TOKEN` is still required

## 4. Owner secret preparation before deploying the V2 candidate

Hostinger must have all of these before switching branches:

1. Existing production `QUIZ_ENCRYPTION_KEY_V1`, copied exactly from Vercel. Do not modify or regenerate it.
2. New `QUIZ_ENCRYPTION_KEY_V2`: exactly 32 cryptographically random bytes, base64 encoded.
3. New `QUIZ_KEY_ROTATION_TOKEN`: high-entropy and at least 32 characters.
4. `QUIZ_KEY_ROTATION_HOSTINGER_BRIDGE=enabled`.

The V2 key and rotation token are Hostinger-only for this migration path. A new Vercel deployment is not required.

Do not paste any secret into chat, GitHub, screenshots, or logs.

## 5. Deploy and prove the temporary Hostinger V2 candidate

Only after section 4 is complete:

1. Point the Hostinger Node app to `release/hostinger-v2-bridge-20260824`.
2. Set `RELEASE_ID=974506b7aa041c025b609d765f943cbc61bcff4a`.
3. Keep `APP_ORIGIN=https://lightgray-coyote-141764.hostingersite.com`.
4. Redeploy.
5. Require `/api/health/release` HTTP 200 with exact release SHA, `databaseReady=true`, `queueReady=true`, `storageReady=true`.
6. Run the Tee/Cap/Tote live matrix on the temporary domain.

Required matrix:

- Tee → M → Bone → object/size/base HTTP 200 → real OTP request boundary
- Cap → OS → Bone → object/size/base HTTP 200
- Tote → OS → Bone → object/size/base HTTP 200

No real payment and no Printful confirmation.

Do not invoke the rotation endpoint yet.

## 6. Prove durable jobs on temporary Hostinger

Private artwork root remains:

`/home/u639555688/issued-once-private-artwork`

Require the protected `/api/internal/jobs/drain` endpoint to work with `CRON_SECRET`, then configure Hostinger cron without exposing the secret in a public file or URL query parameter.

## 7. Cut `issuedonce.shop` to the already-proven Hostinger release

Only after temporary health, Tee/Cap/Tote and durable-job proof pass:

1. Connect `issuedonce.shop` to the proved Hostinger app.
2. Set `APP_ORIGIN=https://issuedonce.shop`.
3. Update cron URL to the final domain.
4. Redeploy if Hostinger requires it for environment changes.
5. Require final-domain `/api/health/release` with exact SHA `974506b7aa041c025b609d765f943cbc61bcff4a`.
6. Repeat Tee/Cap/Tote live proof on `issuedonce.shop`.
7. Verify Neon read-only: physical selections persist correctly, Tote uses `OS`, manufacturing remains 0/0, referrals remain absent.

At this point Hostinger is the proven production writer and has both V1 and V2 keys, so it can safely read old answers while all new answers are written as V2.

## 8. Rotate V1 → V2 only after final-domain Hostinger proof

Protected route:

`POST /api/internal/quiz-encryption/rotate`

Run bounded batches, normally 100 and never above 250.

Response fields are limited to:

- `scanned`
- `migrated`
- `skipped`
- `failed`
- `remaining`

Rules:

- stop immediately if `failed > 0`
- CAS skips may be retried
- continue until endpoint says `remaining=0`
- independently query Neon after the last batch

Required database proof:

- V1 count exactly 0
- unexpected key-version count 0
- V2 count equals the full current questionnaire-answer population
- manufacturing remains 0/0
- referral migration 0029 remains absent

## 9. Disable the one-time bridge

Immediately after independent V1=0 proof:

- remove/disable `QUIZ_KEY_ROTATION_HOSTINGER_BRIDGE`
- remove `QUIZ_KEY_ROTATION_TOKEN`
- redeploy/restart if needed
- verify the rotation route returns 404 without the bridge flag
- V1 key may be retired only after a final read-path audit confirms no remaining V1 dependency

## 10. Retire Vercel

Vercel remains untouched as the old rollback path until Hostinger final-domain proof is green. Once V1 rotation begins, do not roll traffic back to the V1-only Vercel release.

After Hostinger final proof + V1=0 + bridge disablement + durable jobs + safety checks, Vercel can be retired from serving `issuedonce.shop`.

## 11. Merge gates

PR #13 stays draft until:

- final-domain Hostinger exact-sha health passes
- Tee/Cap/Tote final-domain matrix passes
- durable jobs/cron pass
- V1 count is exactly 0 after rotation
- one-time rotation bridge is disabled
- manufacturing remains unconfirmed/uncharged
- referral migration/signing remains disabled

Only then may PR #13 become eligible to merge into `feat/mystery-foundation`.

PR #3 remains a separate final-release audit gate and must not be merged merely because the Hostinger migration succeeds.
