# ISSUED ONCE — Hostinger Deployment Runbook

Date: 2026-08-24
Status: production V2-compatible private-payload schema is green. Migration `0032` is applied and independently verified. Frozen candidate `release/hostinger-v2-candidate-20260824` points exactly to verified implementation SHA `3fa3b82e56d604d2d36e6634c88ac98e48920a92`. The current owner gate is Hostinger configuration of a fresh `QUIZ_ENCRYPTION_KEY_V2`.

## Immutable safety rules

- Never expose encryption keys, OTPs, sessions, raw answers, addresses, payment secrets or provider secrets.
- Do not delete historical dummy data without a separate explicit owner reset approval.
- Migration `0029_creator_referrals.sql` remains forbidden without its own exact owner approval.
- Keep Printful production confirmation disabled.
- Do not make a real Safepay charge solely for QA.
- Keep canonical artwork outside `public_html` and the Hostinger Node deployment directory.
- Prove the temporary Hostinger domain before connecting `issuedonce.shop`.

## 1. Current Hostinger runtime

Temporary URL:

`https://lightgray-coyote-141764.hostingersite.com`

Currently deployed old candidate:

- branch `release/hostinger-candidate-20260823`
- SHA `929081a8c08b0836ec74037cbb0a7aa59ec88640`
- `/api/health/release` previously proved exact SHA, database, durable queue and private filesystem storage healthy
- private artwork root `/home/u639555688/issued-once-private-artwork`

The old candidate predates the permanent V2 writer/key rollout. Questionnaire persistence on that old release is therefore not release proof for the new architecture.

## 2. Production database state

Neon:

- project `autumn-butterfly-25489215`
- database `neondb`
- production branch `br-dawn-cloud-axm880q9`

Applied and independently verified:

- `0030_background_jobs.sql` — `ac06c578-5607-460b-8550-5b3fc30c6742`
- `0031_quiz_encryption_key_v2.sql` — `36a667fe-e801-4496-ae67-e9b1719472d2`
- `0032_private_payload_key_v2.sql` — `aa0b9492-3f05-4125-bee8-ee8ad3a6d311`

Production `0032` verification after apply:

- all four private-payload key-version constraints are present and validated
- OTP challenge constraint accepts V1/V2
- verified-contact constraint accepts V1/V2
- shipping-snapshot constraint accepts V1/V2
- support-request constraint accepts V1/V2
- existing copied data remains OTP V1 254/V2 0; contacts V1 7/V2 0; shipping V1 7/V2 0; support V1 0/V2 0
- manufacturing jobs/events remain `0/0`
- referral creator/conversion tables remain absent
- temporary migration branch `br-hidden-glade-axpch1a3` was cleaned up after production apply

Still forbidden/unapplied:

- `0029_creator_referrals.sql`

## 3. Historical V1 data decision

The owner confirmed the historical questionnaire/order records are dummy testing data and do not require V1-to-V2 preservation.

Therefore:

- no Vercel V1-key transfer is required
- no V1-to-V2 row rotation is required for release
- existing V1 dummy rows may remain until a separately approved cleanup/reset
- new production private payloads must use V2

Dummy-data deletion remains unauthorized.

## 4. Permanent V2 writer

`src/server/crypto/privatePayload.ts` writes new private payloads with `QUIZ_ENCRYPTION_KEY_V2`, requires the decoded value to be exactly 32 bytes, and retains V1/V2 read support during transition.

The shared writer can reach:

- `experience_answers`
- `otp_challenges`
- `verified_contacts`
- `shipping_snapshots`
- `support_requests`

Production migrations `0031` and `0032` now make those write paths V2-compatible.

## 5. Frozen Hostinger V2 candidate

Deploy exactly:

- branch `release/hostinger-v2-candidate-20260824`
- SHA `3fa3b82e56d604d2d36e6634c88ac98e48920a92`
- `RELEASE_ID=3fa3b82e56d604d2d36e6634c88ac98e48920a92`

Fresh GitHub evidence for that exact SHA:

- CI #1368: PASS — unit tests, typecheck, lint and production build
- Browser QA #1267: PASS
- TDD RED: CI #1363 passed 536 existing tests and failed only because the new `0032` contract was not implemented yet

The release branch was independently compared with the implementation SHA and is identical: zero commits ahead/behind.

Do not deploy the obsolete `release/hostinger-v2-bridge-20260824` branch. That branch belongs to the superseded V1-preservation strategy.

## 6. Current exact owner gate — Hostinger V2 key

Create one new cryptographically random 32-byte value and base64-encode it. Save it in Hostinger as:

`QUIZ_ENCRYPTION_KEY_V2`

Never paste the value into chat, GitHub, screenshots, issues or logs.

For the existing Hostinger Node app, use hPanel **Website Dashboard → Settings & Redeploy → Environment variables**. Add `QUIZ_ENCRYPTION_KEY_V2`, then review deployment source/settings.

During the same redeploy configure:

- source branch `release/hostinger-v2-candidate-20260824`
- `RELEASE_ID=3fa3b82e56d604d2d36e6634c88ac98e48920a92`

Keep the existing production values unchanged unless a later gate explicitly requires a change.

Do not configure `REFERRAL_ATTRIBUTION_SIGNING_KEY` and do not enable Printful confirmation.

## 7. Temporary Hostinger proof

After the V2 candidate redeploy, require exact:

`GET https://lightgray-coyote-141764.hostingersite.com/api/health/release`

Expected:

- HTTP 200
- `ok=true`
- `runtimeProvider=hostinger`
- `releaseId=3fa3b82e56d604d2d36e6634c88ac98e48920a92`
- `databaseReady=true`
- `queueReady=true`
- `storageReady=true`

A Hostinger dashboard status alone is not proof.

Then run the non-payment live matrix:

- Tee → M → Bone
- Cap → OS → Bone
- Tote → OS → Bone
- questionnaire/object/size/base APIs must return HTTP 200 for the applicable flow
- Tote must persist `OS`
- real OTP boundary may be exercised when contact flow is explicitly being tested

No real Safepay charge and no Printful production confirmation are authorized by this test.

## 8. Remaining runtime boundaries

As the temporary flow reaches them, configure owner-controlled secrets one at a time without exposing values.

Contact/identity boundary may require:

- `IDENTITY_HMAC_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Artwork boundary requires:

- `ARTWORK_SIGNING_KEY`
- signed artwork route proof

Durable jobs require:

- `CRON_SECRET`
- successful protected `/api/internal/jobs/drain` proof
- Hostinger cron configured without placing the secret in a public URL query or repository file

Private artwork remains at:

`/home/u639555688/issued-once-private-artwork`

## 9. Production domain cutover

Only after the temporary Hostinger proof is fully green:

1. Connect `issuedonce.shop` to the proved Hostinger app.
2. Set `APP_ORIGIN=https://issuedonce.shop`.
3. Update cron to the final domain.
4. Redeploy/restart if required.
5. Repeat exact release-health proof on `issuedonce.shop`.
6. Repeat Tee/Cap/Tote live proof.
7. Re-run Neon read-only safety corroboration: newest physical selections persisted correctly, Tote size is `OS`, manufacturing remains 0/0, referrals remain absent.

Only after this second proof may PR #13 become eligible to merge into `feat/mystery-foundation`. PR #3 remains a separate final-release audit gate.

## 10. Optional dummy-data cleanup

Historical V1/test-order cleanup is optional and requires a separate explicit owner approval. Before deletion:

- enumerate dependent test-state tables
- prove manufacturing remains empty
- preserve schema/configuration rows that are not customer test data
- test the reset on a temporary Neon branch first
- apply only after separate approval

Dummy-data cleanup is not required for Hostinger release proof.
