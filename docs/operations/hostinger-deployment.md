# ISSUED ONCE — Hostinger Deployment Runbook

Date: 2026-08-24
Status: permanent V2 private-payload architecture is staged. Production `0031` is applied; `0032` is verified on a temporary Neon branch and requires separate production approval. Historical production orders/questionnaire records were confirmed by the owner to be dummy test data, so Vercel/V1 preservation is no longer required.

## Immutable safety rules

- Never expose encryption keys, OTPs, sessions, raw answers, addresses, payment secrets or provider secrets.
- Do not delete historical dummy data merely because it is disposable; deletion/reset needs separate explicit owner approval.
- Migration `0029_creator_referrals.sql` remains forbidden without its own exact owner approval.
- Keep Printful production confirmation disabled and do not make a real Safepay QA charge.
- Keep canonical artwork outside `public_html` and the Hostinger Node deployment directory.
- Prove the temporary Hostinger domain before connecting `issuedonce.shop`.

## 1. Current Hostinger runtime

Temporary URL:

`https://lightgray-coyote-141764.hostingersite.com`

Currently deployed candidate:

- branch `release/hostinger-candidate-20260823`
- SHA `929081a8c08b0836ec74037cbb0a7aa59ec88640`
- `/api/health/release` previously proved exact SHA, database, durable queue and private filesystem storage all healthy
- private artwork root: `/home/u639555688/issued-once-private-artwork`

The old candidate still fails questionnaire answer persistence because it predates the permanent V2 writer/key rollout. That is expected and is not a new infrastructure regression.

## 2. Production database state

Neon:

- project `autumn-butterfly-25489215`
- database `neondb`
- production branch `br-dawn-cloud-axm880q9`

Applied and verified:

- `0030_background_jobs.sql` — `ac06c578-5607-460b-8550-5b3fc30c6742`
- `0031_quiz_encryption_key_v2.sql` — `36a667fe-e801-4496-ae67-e9b1719472d2`

Still forbidden/unapplied:

- `0029_creator_referrals.sql`

Manufacturing jobs/events remain `0/0`; referral creator/conversion tables remain absent.

## 3. Historical V1 data decision

The owner confirmed the historical questionnaire/order records are dummy testing data and the questionnaire answers were not meaningful production answers. Therefore:

- V1→V2 preservation is not required.
- A new Vercel deployment is not required for migration.
- The temporary Vercel/Hostinger rotation bridge is not part of the deployment plan.
- Existing V1 dummy rows may remain in the database until a separately approved cleanup/reset.
- New production data must use the permanent V2 key.

Read-only audit at the strategy change:

- experiences: 305
- questionnaire answers: 1,868
- verified contacts: 7
- shipping snapshots: 7
- checkout quotes: 258
- payment attempts: 6
- attempts marked `PAID`: 4
- issues: 4
- manufacturing jobs/events: 0/0

The `PAID` markers are part of the owner-confirmed dummy/test state. They must still not be deleted without a separate reset approval.

## 4. Permanent V2 writer

`src/server/crypto/privatePayload.ts` now:

- writes new private payloads with `QUIZ_ENCRYPTION_KEY_V2`
- requires that V2 key to base64-decode to exactly 32 bytes
- retains V1/V2 read support during transition

The shared private-payload writer is used beyond questionnaire answers. New V2 writes can reach:

- `experience_answers`
- `otp_challenges`
- `verified_contacts`
- `shipping_snapshots`
- `support_requests`

`0031` already made `experience_answers` V2-compatible. A schema audit found the other four tables still constrained to V1 only, which is why `0032` is required before deploying the V2 writer.

## 5. `0032_private_payload_key_v2.sql` — staged and temporary-branch verified

Implementation branch head verified before this runbook update:

`3fa3b82e56d604d2d36e6634c88ac98e48920a92`

Code evidence:

- CI #1368: PASS — unit tests, typecheck, lint, production build
- Browser QA #1267: PASS
- TDD RED: CI #1363 passed 536 existing tests and failed only because `0032_private_payload_key_v2.sql` did not yet exist
- Postgres contact/shipping/support row models now accept V1 or V2 without changing their persistence behavior

Managed Neon temporary proof:

- migration ID `aa0b9492-3f05-4125-bee8-ee8ad3a6d311`
- temporary branch `mcp-migration-2026-08-24T02-14-01`
- temporary branch ID `br-hidden-glade-axpch1a3`
- parent production branch `br-dawn-cloud-axm880q9`

Verified on the temporary branch:

- OTP challenge key-version constraint accepts V1/V2 and is validated
- verified-contact key-version constraint accepts V1/V2 and is validated
- shipping-snapshot key-version constraint accepts V1/V2 and is validated
- support-request key-version constraint accepts V1/V2 and is validated
- copied rows remained unchanged: OTP V1 254 / V2 0; contacts V1 7 / V2 0; shipping V1 7 / V2 0; support V1 0 / V2 0
- manufacturing remains 0/0
- referral schema remains absent

A separate read-only production query proved all four production constraints are still V1-only. Production `0032` has not been applied.

## 6. Current exact owner gate

Production mutation requires explicit approval of only:

`db/migrations/0032_private_payload_key_v2.sql`

Managed migration:

`aa0b9492-3f05-4125-bee8-ee8ad3a6d311`

This approval does not authorize migration 0029, dummy-data deletion, payment, Printful confirmation or domain cutover.

## 7. After production `0032` approval

1. Complete the managed migration against production.
2. Independently verify all four constraints accept V1/V2 and remain validated.
3. Confirm manufacturing remains 0/0 and referrals remain absent.
4. Generate one fresh `QUIZ_ENCRYPTION_KEY_V2`: exactly 32 cryptographically random bytes, base64 encoded.
5. Add that value to Hostinger without exposing it in chat, GitHub, screenshots or logs.
6. Vercel V1 transfer is not required because historical V1 records are disposable test data.
7. Freeze a new Hostinger release candidate from the verified migration branch and set `RELEASE_ID` to the exact candidate SHA.
8. Redeploy the temporary Hostinger app.

## 8. Temporary Hostinger proof

Require exact `/api/health/release` HTTP 200 with:

- `runtimeProvider=hostinger`
- exact candidate SHA
- database ready
- durable queue ready
- private storage ready

Then run the live physical matrix without a real payment or Printful confirmation:

- Tee → M → Bone → questionnaire/object/size/base HTTP 200; proceed to real OTP boundary only when explicitly testing contact
- Cap → OS → Bone → questionnaire/object/size/base HTTP 200
- Tote → OS → Bone → questionnaire/object/size/base HTTP 200

If the flow reaches contact configuration, required runtime values include `IDENTITY_HMAC_KEY`, `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Configure owner-controlled secrets one at a time and never paste values into chat.

## 9. Private artwork and durable jobs

Before domain cutover also require:

- `ARTWORK_SIGNING_KEY` configured
- signed artwork route proof
- `CRON_SECRET` configured
- protected `/api/internal/jobs/drain` proof
- Hostinger cron configured without putting a secret in a public URL query or file

Private artwork remains at:

`/home/u639555688/issued-once-private-artwork`

## 10. Production domain cutover

Only after the temporary Hostinger proof is green:

1. Connect `issuedonce.shop` to the proved Hostinger app.
2. Set `APP_ORIGIN=https://issuedonce.shop`.
3. Update cron to the final domain.
4. Redeploy/restart if required.
5. Repeat exact release health on the final domain.
6. Repeat Tee/Cap/Tote live proof.
7. Re-run Neon read-only safety corroboration: newest physical selections persisted correctly, Tote size `OS`, manufacturing 0/0, referrals absent.

Only after the second proof may PR #13 become eligible to merge into `feat/mystery-foundation`. PR #3 remains a separate final-release audit gate.

## 11. Optional dummy-data cleanup

Historical V1/test orders may be removed later only after an explicit owner reset approval. Before deletion:

- enumerate all dependent test-state tables
- prove manufacturing remains empty
- preserve schema/configuration rows that are not customer test data
- test the reset on a temporary Neon branch first
- apply only after separate approval

Dummy-data cleanup is not required to prove the new Hostinger customer flow.
