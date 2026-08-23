# ISSUED ONCE — Hostinger Deployment Runbook

Date: 2026-08-23
Status: execution runbook for PR #13. Do not cut production traffic until every temporary-domain gate below passes.

## Immutable safety rules

- Deploy the frozen release-candidate branch to a Hostinger temporary domain first.
- Do not connect or repoint `issuedonce.shop` until live release health and Tee/Cap/Tote browser gates pass.
- Do not configure `REFERRAL_ATTRIBUTION_SIGNING_KEY`; migration `0029_creator_referrals.sql` remains separately owner-gated.
- Do not enable `PRINTFUL_ALLOW_CONFIRM`; production manufacturing confirmation stays disabled.
- Do not perform a real Safepay charge as part of migration proof.
- Never paste production secret values into GitHub issues, commits, logs, or chat.
- Keep canonical artwork outside both `public_html` and Hostinger's redeployed Node build directory.

## 1. Frozen release

Deploy exactly:

- Branch: `release/hostinger-candidate-20260823`
- Release SHA: `44730e01cd85c934266eaa4e11e83c6ad5ef741a`
- `RELEASE_ID=44730e01cd85c934266eaa4e11e83c6ad5ef741a`

This release passed CI #1319 (frozen install, unit tests, typecheck, lint and production build) and Browser QA #1218. Do not deploy the later metadata-only migration branch head.

The application also captures git HEAD into the Next build ID and `ISSUED_ONCE_RELEASE_ID`; `RELEASE_ID` is an explicit second lock.

## 2. Database prerequisite — COMPLETE

Owner-approved migration `0030_background_jobs.sql` was applied to production Neon branch `br-dawn-cloud-axm880q9` through managed migration `ac06c578-5607-460b-8550-5b3fc30c6742` and verified on 2026-08-23.

Verified production state:

- `background_jobs` exists
- `background_jobs_due_idx` exists exactly once
- queue contains 0 jobs immediately after migration
- manufacturing jobs remain 0
- manufacturing provider events remain 0
- referral migration `0029` remains absent

Applying `0030` did not authorize `0029`.

## 3. Create the temporary Hostinger Node.js app

In hPanel:

1. Go to **Websites → Add Website → Node.js Web App** (some hPanel versions label the intermediate choice **Deploy Web App**).
2. Choose a **temporary domain**, not `issuedonce.shop`.
3. Select **Import Git Repository / Connect with GitHub** and authorize Hostinger.
4. Select private repository `itxsam57/issued-once`.
5. Select branch `release/hostinger-candidate-20260823`.
6. Framework: **Next.js**.
7. Node.js: **22.x**.
8. Package manager: **pnpm**.
9. Install command: `pnpm install --frozen-lockfile` when Hostinger exposes an install-command field; otherwise use its pnpm lockfile detection.
10. Build command: `pnpm build`.
11. Start command: `pnpm start`.
12. If an output-directory field is requested for a Next.js backend app, use `.next` only when hPanel does not auto-detect Next.js.

Do not connect the production domain during this step.

## 4. Private artwork directory

Hostinger stores deployed backend build files under a path like:

`/home/<hostinger-user>/domains/<temporary-domain>/nodejs`

Do not store customer artwork there and do not store it under `public_html`.

Find the exact account home prefix in **Websites → Dashboard → FTP Accounts**. Create a private persistent directory under the hosting account home, for example:

`/home/<hostinger-user>/issued-once-private-artwork`

Set:

`ARTWORK_STORAGE_DIR=/home/<hostinger-user>/issued-once-private-artwork`

The application release-health probe performs a real write/read/delete against this directory. A permissions/path mistake therefore keeps `storageReady=false` and blocks release proof.

## 5. Hostinger environment variables

Enter values in hPanel's Environment Variables screen. Do not commit them to the repository.

### Hostinger/runtime additions

- `NODE_ENV=production`
- `RUNTIME_PROVIDER=hostinger`
- `RELEASE_ID=44730e01cd85c934266eaa4e11e83c6ad5ef741a`
- `APP_VERSION=0.1.0`
- `APP_ORIGIN=https://<temporary-hostinger-domain>`
- `ARTWORK_STORAGE_DIR=/home/<hostinger-user>/issued-once-private-artwork`
- `ARTWORK_SIGNING_KEY=<new high-entropy server-only secret>`
- `CRON_SECRET=<new high-entropy server-only secret, at least 24 characters>`

### Existing production values to transfer unchanged from the current secret store/deployment

- `DATABASE_URL`
- `QUIZ_ENCRYPTION_KEY_V1`
- `IDENTITY_HMAC_KEY`
- `ISSUED_ONCE_CATALOG_JSON`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SUPPORT_INBOX_EMAIL`
- `SUPPORT_REPLY_TO` if currently used
- `SAFEPAY_ENVIRONMENT`
- `SAFEPAY_API_KEY`
- `SAFEPAY_API_SECRET`
- `SAFEPAY_WEBHOOK_SECRET`
- `INTERNAL_OPERATIONS_TOKEN`
- `PRINTFUL_API_TOKEN`
- `PRINTFUL_STORE_ID` if currently used
- `PRINTFUL_VARIANT_MAP_JSON`
- `PRINTFUL_WEBHOOK_PUBLIC_KEY`
- `PRINTFUL_WEBHOOK_SECRET_HEX`
- `OPENAI_API_KEY` only if already intentionally configured
- `OPENAI_DESIGN_MODEL` if intentionally overridden
- `OPENAI_IMAGE_MODEL` if intentionally overridden

### Variables that must stay absent/off

- `BLOB_READ_WRITE_TOKEN`
- all Vercel Queue variables/configuration
- `REFERRAL_ATTRIBUTION_SIGNING_KEY`
- `PRINTFUL_ALLOW_CONFIRM=true`

If hPanel environment variables are changed after deployment, redeploy before testing because runtime configuration changes require a redeployment.

## 6. First temporary deployment gate

After Hostinger says deployment is running, do not trust the dashboard status alone.

Call:

`GET https://<temporary-hostinger-domain>/api/health/release`

Required response:

- HTTP 200
- `ok: true`
- `runtimeProvider: "hostinger"`
- `releaseId` equals `44730e01cd85c934266eaa4e11e83c6ad5ef741a`
- `databaseReady: true`
- `queueReady: true`
- `storageReady: true`

Any mismatch blocks the migration and must be fixed before browser testing.

## 7. Live release QA

Use GitHub Actions workflow **Live Release QA** with:

- `deployment_url = https://<temporary-hostinger-domain>`
- `expected_release = 44730e01cd85c934266eaa4e11e83c6ad5ef741a`

The workflow must first pass the release-health probe and then independently prove:

- Tee → `M` → Bone
- Cap → `OS` → Bone
- Tote → `OS` → Bone
- `/api/experience/object` HTTP 200 for all three
- `/api/experience/size` HTTP 200 for all three
- `/api/experience/base` HTTP 200 for all three
- Tee reaches the real OTP request boundary

A Hostinger dashboard screenshot is not sufficient evidence.

## 8. Neon read-only post-test proof

After the temporary-domain browser matrix, verify production Neon read-only:

- newest Tee physical selection reaches `COMMITMENT_READY`
- newest Cap physical selection reaches `COMMITMENT_READY`
- newest Tote physical selection reaches `COMMITMENT_READY`
- Tote has `size_code = 'OS'`
- each has its locked base color
- `manufacturing_jobs` remains `0`
- `manufacturing_provider_events` remains `0`
- referral schema from migration `0029` remains absent

No mutation is authorized by this proof step.

## 9. Configure durable job cron

Only after the temporary release is healthy:

1. Manually test the protected drain endpoint once with the configured `CRON_SECRET`.
2. Require HTTP success and a valid JSON drain result before scheduling it.
3. In hPanel go to **Websites → Dashboard → Advanced → Cron Jobs**.
4. Select **Custom**.
5. Schedule a protected POST to `/api/internal/jobs/drain` using the same secret.
6. Choose the smallest safe schedule hPanel allows for this account; cron schedules are UTC.
7. After the first scheduled execution, use **View Output** to confirm it ran successfully.

Do not expose `CRON_SECRET` in a public file or URL query parameter.

## 10. Production domain cutover

Cutover is allowed only after sections 6–9 are green.

1. In hPanel connect `issuedonce.shop` to the proved Node.js app.
2. Complete any required DNS change and require HTTPS to serve the Hostinger app.
3. Change `APP_ORIGIN=https://issuedonce.shop`.
4. Change the cron URL to `https://issuedonce.shop/api/internal/jobs/drain`.
5. Redeploy so the new `APP_ORIGIN` is active.
6. Re-run `/api/health/release` against `https://issuedonce.shop` and require the same exact SHA.
7. Re-run **Live Release QA** against `https://issuedonce.shop` with the same `expected_release`.
8. Re-run the Neon read-only safety proof.

Only after this second live proof may the migration PR be considered eligible to merge into the canonical branch.

## 11. Rollback rule

If the Hostinger release fails before domain cutover, leave `issuedonce.shop` on the existing provider and repair the temporary deployment.

If a problem appears after cutover:

1. Disable/stop the Hostinger cron before changing traffic if job processing is implicated.
2. Keep `PRINTFUL_ALLOW_CONFIRM` off.
3. Do not mutate payment truth to compensate for infrastructure failure.
4. Restore traffic to the last known-good runtime only if its required schema remains compatible.
5. Preserve production Neon data and diagnose from release ID, runtime logs, health output, browser evidence, and read-only DB state.

## Evidence required for migration completion

Migration is complete only when all are true:

- exact release SHA has green CI and Browser QA
- migration `0030` applied and verified in production
- Hostinger temporary deployment health is green
- exact deployed SHA proven
- Tee/Cap/Tote live physical matrix passes on Hostinger
- Tote `OS` persists and reaches `COMMITMENT_READY`
- durable job endpoint and cron execution proven
- manufacturing remains unconfirmed/uncharged during migration proof
- referral migration/signing remains disabled
- `issuedonce.shop` serves the same proved release
- live release QA passes again after domain cutover
