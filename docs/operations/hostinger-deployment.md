# ISSUED ONCE — Hostinger Deployment Runbook

Date: 2026-08-25
Status: temporary Hostinger runtime is serving verified V5 code. Exact-release customer smoke is green; remaining temporary-host gates are owner-controlled runtime configuration, verified-contact/shipping proof, provider integration proof, and email deliverability.

## Immutable safety rules

- Never expose encryption keys, OTPs, sessions, raw answers, addresses, database credentials, payment secrets, provider secrets or owner-operation tokens.
- Do not rotate `QUIZ_ENCRYPTION_KEY_V2` or `IDENTITY_HMAC_KEY` without an explicit continuity plan.
- Do not delete historical dummy data without separate explicit owner reset approval.
- Migration `0029_creator_referrals.sql` remains forbidden without its own explicit approval.
- Do not configure `REFERRAL_ATTRIBUTION_SIGNING_KEY` while migration `0029` is absent.
- Keep Printful production confirmation disabled during QA.
- Do not make a real Safepay charge solely for QA.
- Keep canonical artwork outside `public_html` and the Hostinger Node deployment directory.
- Do not connect/cut over `issuedonce.shop` until the temporary Hostinger release gates and deliverability are green and the owner separately approves cutover.
- Keep PR #13 draft/unmerged until the Hostinger release is proven; PR #3 is a separate final-release audit gate.

## 1. Current Hostinger runtime

Temporary URL:

`https://lightgray-coyote-141764.hostingersite.com`

Hostinger is already linked to branch name:

`release/hostinger-v2-candidate-20260824`

That branch name is historical. It is intentionally being fast-forwarded to already-verified candidates so Hostinger can auto-deploy without changing hPanel source settings or resetting environment variables.

Current frozen candidate:

- frozen branch `release/hostinger-v5-candidate-20260825`
- exact SHA `df13a171919e7223a0d76d9e4633950ccf2adc25`
- Hostinger-linked branch was fast-forwarded to that SHA
- private artwork root `/home/u639555688/issued-once-private-artwork`

The release identity endpoint now prefers the actual checked-out Git commit over a stale manually configured `RELEASE_ID`. This means same-branch Hostinger auto-deploys can prove the real deployed commit without manually editing `RELEASE_ID` on every release.

Do not mutate the frozen V5 branch itself.

## 2. Fresh V5 evidence

Repository verification for V5 engineering head:

- CI #1413 — PASS: unit tests, typecheck, lint, production build
- Browser QA #1312 — PASS

Exact Hostinger V5 proof:

- workflow `Hostinger Temporary Release Proof` #75
- run `32854863228`
- job `97824246027`
- exact release `df13a171919e7223a0d76d9e4633950ccf2adc25`
- release health PASS: Hostinger runtime, database, durable queue and private storage ready
- Tee physical gate PASS: seven answers + object + size + base
- Cap/Hat physical gate PASS: seven answers + object + size + base
- Tote physical gate PASS: seven answers + object + size + base
- real Resend OTP request returned HTTP 200
- no real Safepay charge was performed
- proof artifact ID `9565803339`
- proof ZIP SHA256 `e2cf859617365eb098fdd8d2aec92b4a3014bcedb8db4c8c33e3e99b5a10e447`

The live release harness is self-pinning and deployment-lag aware. On push it waits until Hostinger serves the exact pushed SHA before running customer/boundary proof, preventing false failures against the previous deployment.

## 3. Production database state

Neon:

- project `autumn-butterfly-25489215`
- database `neondb`
- production branch `br-dawn-cloud-axm880q9`

Applied and independently verified:

- `0030_background_jobs.sql`
- `0031_quiz_encryption_key_v2.sql`
- `0032_private_payload_key_v2.sql`

Still forbidden/unapplied:

- `0029_creator_referrals.sql`

Fresh read-only production corroboration after V5 live QA:

- encrypted questionnaire answers V2: 413
- OTP challenges V2: 19
- verified contacts V2: 0
- shipping snapshots V2: 0
- support requests V2: 0
- background jobs: 0
- manufacturing jobs/events: 0/0
- payment attempts: 6 total; V5 QA did not create another payment attempt
- referral creator/conversion tables: absent

V5 automated QA therefore created only expected encrypted questionnaire/OTP data. It created no verified contact, shipping, support, background job, payment, manufacturing or referral side effect.

## 4. Existing environment that must be preserved

Do not replace or regenerate these values while completing the remaining configuration:

- `NODE_ENV=production`
- `RUNTIME_PROVIDER=hostinger`
- `DATABASE_URL`
- `QUIZ_ENCRYPTION_KEY_V2`
- `IDENTITY_HMAC_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `APP_ORIGIN=https://lightgray-coyote-141764.hostingersite.com`
- `ARTWORK_STORAGE_DIR=/home/u639555688/issued-once-private-artwork`

A stale manual `RELEASE_ID` is no longer authoritative because actual Git HEAD wins at build time. Do not change it merely to make proof green.

## 5. Where owner-controlled values are added

For the existing Hostinger Node app, use either:

- hPanel **Website Dashboard → Settings & Redeploy → Environment variables**, or
- **Deployments → Settings and redeploy → Environment Variables**.

Add each variable as a Name/Value pair. Never put a secret in chat, GitHub, screenshots, URLs or repository files. Environment changes require a Hostinger redeploy before live proof is rerun.

### Batch 1 — local/runtime secrets and support routing

Add:

- `SUPPORT_INBOX_EMAIL` — real inbox controlled by the owner for support-request delivery
- `INTERNAL_OPERATIONS_TOKEN` — unique high-entropy random secret, minimum 24 characters
- `CRON_SECRET` — different high-entropy random secret, minimum 24 characters
- `ARTWORK_SIGNING_KEY` — third different high-entropy random secret, minimum 24 characters

Do not reuse one secret for multiple variables.

After Batch 1 redeploy require fresh proof:

- exact release health still reports V5 or the newly approved exact successor
- `/api/ops/session` with an invalid token returns 401 instead of 503
- `/api/internal/jobs/drain` without valid bearer authorization returns 401 instead of 503
- live support pre-order guard reaches 409 instead of runtime 503
- invalid signed-artwork access remains denied
- Neon safety counts remain free of unintended payment/manufacturing/referral writes

The actual Hostinger cron must later POST to `/api/internal/jobs/drain` with `Authorization: Bearer <CRON_SECRET>`. Never place the secret in a query string or source file.

### Batch 2 — truthful public merchant disclosure

Required for the public store/contact pages to be release-ready:

- `MERCHANT_PUBLIC_NAME`
- `MERCHANT_SUPPORT_EMAIL`
- `MERCHANT_PUBLIC_LOCATION`

Optional when truthful and available:

- `MERCHANT_SUPPORT_PHONE`
- `MERCHANT_LEGAL_ENTITY`
- `SUPPORT_REPLY_TO`

Do not invent a legal entity, registration, address, country or phone number. The public values must describe the actual merchant/support route.

### Batch 3 — design generation

Required:

- `OPENAI_API_KEY`

Optional model overrides:

- `OPENAI_DESIGN_MODEL`
- `OPENAI_IMAGE_MODEL`

V5 design generation uses the Hostinger private filesystem; no Vercel Blob token is required.

After configuration, prove design generation through the durable job path, private artwork persistence, signed read access and owner review controls. Do not bypass the queue or expose private answers/artwork.

### Batch 4 — Safepay

Obtain values from the appropriate Safepay merchant dashboard and add directly in Hostinger:

- `SAFEPAY_API_KEY` — Safepay Public API Key
- `SAFEPAY_API_SECRET` — Safepay Private API Secret Key
- `SAFEPAY_WEBHOOK_SECRET` — Safepay endpoint shared secret
- `SAFEPAY_ENVIRONMENT` — `sandbox` for sandbox proof; `production` only when the real live account/cutover is deliberately enabled

Do not use `SAFEPAY_V1_SECRET` for a new deployment when the current API secret is available.

Before any live customer charge, prove:

- invalid payment request reaches the normal 409 guard instead of runtime 503
- invalid Safepay webhook reaches 401 authentication guard instead of runtime 503
- return/cancel URLs use the current HTTPS app origin
- webhook verification and tracker identity/amount/currency checks remain intact

No real Safepay charge is required solely for QA.

### Batch 5 — Printful

Required for manufacturing draft creation:

- `PRINTFUL_API_TOKEN`
- `PRINTFUL_VARIANT_MAP_JSON`
- `ARTWORK_SIGNING_KEY` from Batch 1
- `APP_ORIGIN`

Optional depending on token type:

- `PRINTFUL_STORE_ID`

Required for Printful webhook-v2 verification:

- `PRINTFUL_WEBHOOK_PUBLIC_KEY`
- `PRINTFUL_WEBHOOK_SECRET_HEX`

Current code expects Printful webhook-v2 HMAC-SHA256 signing and decodes the returned hexadecimal secret before verification.

Prove draft-safe manufacturing only. Draft creation is separate from confirmation. Keep production confirmation disabled during QA because Printful confirmation submits the order for fulfillment and can charge the store owner.

## 6. Current exact live failures

The exact-V5 live boundary audit reaches the application but still reports these configuration-dependent findings:

1. public merchant disclosure incomplete
2. public support address absent
3. `/api/ops/session` returns 503 until `INTERNAL_OPERATIONS_TOKEN` is configured
4. `/api/internal/jobs/drain` returns 503 until `CRON_SECRET` is configured
5. `/api/webhooks/safepay` returns 503 until Safepay runtime credentials are configured
6. `/api/webhooks/printful` returns 503 until Printful webhook credentials are configured
7. `/api/payments/create` returns 503 until Safepay runtime credentials are configured
8. the dedicated support proof returns 503 until `SUPPORT_INBOX_EMAIL` is configured

Already-green live boundaries include public page reachability, release health, anonymous issue privacy, invalid artwork denial, anonymous Owner OS dashboard denial, retired internal routes returning 410, retired Fourthwall returning 410, invalid support-payload rejection, shipping locked before verified contact, and referrals intentionally unavailable.

## 7. Owner-managed customer persistence gates

OTP code entry is owner-managed and the code must never be pasted into chat.

To prove verified-contact persistence:

1. On the temporary Hostinger site complete a fresh customer flow to email verification.
2. Request the code.
3. Read the code from the mailbox and enter it directly into the website.
4. Do not share the code in chat.
5. After the website confirms verification, run a read-only Neon check and require a V2 verified-contact row.

Then prove shipping:

1. Continue the same live session to shipping.
2. Enter a valid test/shipping address directly into the website, never chat.
3. Submit/continue.
4. Run a read-only Neon check and require a V2 shipping snapshot.

## 8. Email deliverability gate

Transport is proven:

- Resend request accepted
- connected Gmail received the OTP mail
- SPF passed
- DKIM passed

Repeated automated QA OTP messages have been classified as Spam by Gmail. Therefore normal-user Inbox placement remains an open release-quality gate.

Before domain cutover:

- inspect Resend deliverability/DNS status
- establish/verify DMARC for the sending domain as appropriate
- avoid treating rapid automated QA traffic as representative user traffic
- perform a fresh normal-user OTP delivery test
- require acceptable placement/reliability before calling deliverability complete

Marking one message “Not spam” is not sufficient production proof by itself.

## 9. Temporary-host completion matrix

Before requesting canonical-domain cutover approval, require fresh evidence for all of the following:

- exact release identity and Hostinger/database/queue/storage health
- Tee/Cap/Tote questionnaire and physical gates
- real OTP request
- owner-completed OTP verification and V2 verified-contact persistence
- V2 shipping persistence
- support runtime and persistence guards
- owner operations authentication guard
- protected cron guard and safe zero-work drain proof
- design generation through durable queue
- private artwork filesystem persistence and signed access
- Safepay runtime/webhook guards without a QA charge
- Printful webhook/manufacturing draft safety without production confirmation
- truthful public merchant/contact disclosure
- acceptable email deliverability
- Neon corroboration showing no unintended payment/manufacturing/referral side effects
- migration `0029` still absent unless separately approved

## 10. Production domain cutover

Domain cutover requires a separate explicit owner approval after the temporary-host matrix is green.

After approval:

1. connect `issuedonce.shop` to the proved Hostinger app
2. set `APP_ORIGIN=https://issuedonce.shop`
3. update Safepay/Printful webhook endpoints and allowed return/cancel routes where required
4. update Hostinger cron target to the canonical HTTPS domain
5. redeploy/restart as required
6. repeat exact release health on `issuedonce.shop`
7. repeat Tee/Cap/Tote, OTP/contact, shipping, support, artwork/design and guarded provider proofs
8. repeat Neon read-only safety corroboration
9. recheck email deliverability on the canonical domain

Only after this second proof may PR #13 become eligible for promotion/merge into `feat/mystery-foundation`. PR #3 remains a separate final-release audit gate.

## 11. Optional dummy-data cleanup

Historical V1/test-order cleanup is optional and requires separate explicit owner approval. It is not required for release proof.

Before any deletion:

- enumerate dependent test-state tables
- prove manufacturing remains empty
- preserve schema/configuration rows that are not customer test data
- test reset behavior on a temporary Neon branch first
- apply to production only after the separate approval
