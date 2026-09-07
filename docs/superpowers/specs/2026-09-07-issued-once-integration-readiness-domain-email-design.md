# ISSUED ONCE — Integration Readiness, Canonical Domain, and Email Design

Date: 2026-09-07
Status: OWNER APPROVED — simplified to Hostinger-authoritative DNS
Base: `infra/hostinger-migration-20260823` @ `aea453222f86abb352f6833271a4d24230e5cbc3`
Live Hostinger release: `674ca48769619bc4664653caddd5f5b9545d1576`

## Goal

Make every engineering-controlled part of ISSUED ONCE production-ready before the remaining external-provider handoffs. Preserve the existing mystery storefront and backend scope while fixing known live defects, making MANUAL design a first-class launch path without OpenAI, preparing truthful merchant/email identity, isolating pre-launch analytics, and making `issuedonce.shop` a controlled one-variable canonical-domain cutover.

## Current verified facts

- The proved production runtime is Hostinger at `https://lightgray-coyote-141764.hostingersite.com`.
- `issuedonce.shop` currently delegates DNS to Vercel (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`) and serves a stale Vercel deployment.
- The apex currently has no MX, SPF, or DMARC record. Domain mail is not configured.
- Resend OTP infrastructure already exists on `otp.issuedonce.shop`: DKIM is published at `resend._domainkey.otp.issuedonce.shop`, while `send.otp.issuedonce.shop` has SES MX/SPF.
- MANUAL design already exists: paid Issues remain actionable without OpenAI, owner artwork upload uses `MANUAL_UPLOAD` provenance, quality gates still apply, and manufacturing can stop at an unconfirmed Printful draft.
- Hostinger reverse proxy exposes internal request origin `https://0.0.0.0:3000`; payment-return and referral redirects currently leak that origin.
- Merchant readiness currently accepts syntactically non-empty placeholder data.
- Production contains four historical `paid_order` metric projections from 2026-08-22/23, while current `issues` and `payment_attempts` tables both contain zero rows.

## Non-goals and safety boundaries

- No homepage visual redesign in this work.
- No real Safepay charge or refund.
- No Printful manufacturing confirmation; `PRINTFUL_ALLOW_CONFIRM` remains disabled.
- No referral launch, payout, or outreach.
- No destructive production-data cleanup merely to make dashboards look clean.
- No invented merchant/legal identity, public location, provider credential, DNS target, or email-provider value.
- No dependence on OpenAI for launch; AI remains an optional capability layered over the manual workflow.

## 1. Trusted public-origin contract

Create one server-only public-origin helper. `APP_ORIGIN` is the authoritative external origin for every customer-facing absolute URL in production.

Rules:

1. If `APP_ORIGIN` is present, parse and validate it as an absolute HTTPS origin in production.
2. Reject credentials, paths, query strings, fragments, localhost/private/internal hostnames, and Hostinger's `0.0.0.0` internal origin as production public origins.
3. Never trust `Host`, `Forwarded`, or `X-Forwarded-*` headers as public-origin authority.
4. In local/test development only, allow a request-origin fallback so normal developer workflows continue without production environment configuration.
5. If production lacks a safe `APP_ORIGIN`, fail closed instead of constructing a redirect from `request.url`.

Apply the helper to:

- `POST /api/payments/create` return base URL
- `GET/POST /payment/return` redirects
- `GET /r/[code]` referral redirect
- any newly discovered customer-facing absolute URL constructor during implementation audit

Regression tests must simulate a request URL of `https://0.0.0.0:3000/...` with a configured public origin and prove every emitted URL remains on the configured public domain.

## 2. Manual-first design readiness without OpenAI

OpenAI is a capability, not a launch prerequisite.

Keep the existing `openai` readiness check so Owner OS still tells the truth about AI availability. Add a separate effective `design-workflow` readiness check:

- `ready` when private artwork storage is ready and OpenAI is ready: AI + manual design are available.
- `ready` when private artwork storage is ready and OpenAI is missing/blocked: manual artwork workflow is available; AI automation is unavailable.
- `blocked` when private artwork storage is unavailable because both AI persistence and manual upload depend on it.

`readyForSandbox` must require `design-workflow=ready`, not `openai=ready`.

No change may weaken the existing manual safeguards: owner authentication, private storage, production image validation, candidate history, approval policy, selected-artwork requirement, Printful draft boundary, or production confirmation kill switch.

## 3. Truthful merchant readiness

Replace presence-only readiness with an explicit truthful-production contract.

Add `MERCHANT_PUBLIC_DETAILS_CONFIRMED=true` as an owner attestation gate. Production merchant readiness is `ready` only when:

- brand name is the canonical `ISSUED ONCE` spelling;
- support email is syntactically valid and belongs to `issuedonce.shop` or one of its subdomains;
- public location is present and does not match known placeholder/test markers such as `LOCATION`, `TBD`, `TEST`, `EXAMPLE`, or `PLACEHOLDER`;
- any optional legal-entity value that is supplied also passes placeholder screening; and
- `MERCHANT_PUBLIC_DETAILS_CONFIRMED=true` is present.

Invalid values must not be echoed as trustworthy production disclosure. Owner OS must explain whether the problem is missing data, invalid/placeholder data, or missing owner confirmation.

The implementation must not guess the merchant's truthful public location or legal identity. Those remain owner-provided facts.

## 4. Non-destructive commercial analytics baseline

Do not delete historical metric buckets. The root issue is that `commercial_metric_buckets` is an append-only projection, so deleted or retired QA rows do not reverse previously projected lifetime metrics.

Add `COMMERCIAL_METRICS_BASELINE_DATE=YYYY-MM-DD` as the launch analytics boundary.

Behavior:

- Owner Dashboard lifetime metrics ignore buckets before the configured baseline.
- Sales snapshots clamp their requested cutoff to the later of the requested period cutoff and the configured baseline.
- Live Issue/payment/funnel queries use the same effective cutoff so pre-launch test rows cannot bleed into post-launch views if any remain.
- Invalid baseline syntax is a blocked readiness state rather than silently falling back.
- Historical rows remain untouched and available for forensic/audit work.

At canonical launch, set the baseline only after a read-only production check proves which activity is pre-launch. The current four historical paid-order projections will therefore disappear from launch dashboards without destructive SQL.

## 5. Domain email topology

Use one real human mailbox and aliases instead of paying for many separate inboxes.

Primary mailbox:

- `support@issuedonce.shop`

Aliases routed to the support mailbox:

- `help@issuedonce.shop`
- `refunds@issuedonce.shop`
- `info@issuedonce.shop`
- `privacy@issuedonce.shop`
- `security@issuedonce.shop`
- `dmarc@issuedonce.shop`

Transactional sender:

- `notify@issuedonce.shop` through Resend; it does not require a normal inbox.

Application environment after mail proof:

- `RESEND_FROM_EMAIL=ISSUED ONCE <notify@issuedonce.shop>`
- `SUPPORT_INBOX_EMAIL=support@issuedonce.shop`
- `SUPPORT_REPLY_TO=support@issuedonce.shop`
- `MERCHANT_SUPPORT_EMAIL=support@issuedonce.shop`

Preserve the existing `otp.issuedonce.shop` Resend records until the root-domain sender has passed real OTP and notification delivery tests. Do not remove the working OTP subdomain during the cutover.

## 6. DNS and canonical-domain strategy

Use Hostinger as the single production DNS authority. Vercel is not part of the final stack and is removed after the nameserver migration proves healthy.

The cutover intentionally avoids a Vercel-zone migration. The only existing non-Hostinger DNS state that must survive is the verified Resend OTP subdomain, whose exact three records are recoverable from the connected Resend account.

Sequence:

1. Deploy and prove all code-side fixes on the temporary Hostinger hostname.
2. Create `support@issuedonce.shop` in Hostinger Mail and the required aliases.
3. In Hostinger, attach `issuedonce.shop` to the existing application and choose **Use Hostinger nameservers** for the Hostinger-registered domain.
4. Once Hostinger is authoritative, reset the Hostinger DNS zone to its default records so stale Vercel web routing is not carried forward.
5. Restore only the verified Resend OTP records from Resend: `resend._domainkey.otp` TXT, `send.otp` MX, and `send.otp` SPF TXT.
6. Add the root-domain Resend sender records and `_dmarc` record after Resend returns their exact values. Never guess DNS targets or mail records.
7. Verify apex and `www` resolve to Hostinger, TLS is valid, the exact intended release is served, Hostinger Mail receives, and `otp.issuedonce.shop` remains verified in Resend.
8. Canonicalize `www.issuedonce.shop` to `https://issuedonce.shop`, preserving path and query.
9. Set `APP_ORIGIN=https://issuedonce.shop` in Hostinger and restart/redeploy as required.
10. Re-run the full customer and Owner OS proofs on the apex domain, then update Safepay/Printful callback/webhook URLs to `issuedonce.shop`.
11. After the Hostinger DNS cutover is proven, Vercel is no longer required for ISSUED ONCE and may be retired without affecting production.

Do not export, import, or preserve the stale Vercel web zone merely for completeness. Preserve only records that have an identified production purpose.

## 7. Provider integration boundary

The engineering pass ends with every provider contract ready to accept real credentials/configuration, but commercial actions remain separately gated.

Safepay:

- production dashboard/onboarding may be configured when available;
- final webhook target is `https://issuedonce.shop/api/webhooks/safepay`;
- final payment return is `https://issuedonce.shop/payment/return`;
- no charge/refund occurs without a separate explicit commercial proof step.

Printful:

- signed webhook-v2 target becomes `https://issuedonce.shop/api/webhooks/printful` after canonical cutover;
- runtime token/store/public-key/secret configuration may be installed;
- `PRINTFUL_ALLOW_CONFIRM` stays disabled;
- no production confirmation is performed.

OpenAI:

- no credential is required for launch;
- when absent, Owner OS must clearly show AI unavailable + manual workflow ready;
- if later configured, model access proof upgrades the optional AI capability without changing order safety.

## 8. Testing and acceptance

Implementation follows red-green TDD for every defect and contract.

Required focused proof:

- reverse-proxy internal-origin regression for payment create, payment return, and referral redirects;
- hostile forwarded-header tests proving headers cannot override `APP_ORIGIN`;
- MANUAL design readiness with no `OPENAI_API_KEY`;
- AI-ready and storage-blocked readiness variants;
- merchant typo/placeholder/external-email/unconfirmed-attestation rejection tests;
- analytics baseline tests across Dashboard and Sales without deleting buckets;
- canonical `www` redirect tests preserving path/query;
- domain/email environment contract tests.

Required whole-tree proof before deployment:

- full unit suite
- typecheck
- lint
- production build
- consumer Playwright desktop + mobile suite
- Owner OS Playwright desktop + mobile suite

Required live proof on the temporary Hostinger host after deployment:

- exact release identity
- payment-return/referral redirects never expose `0.0.0.0`
- Owner readiness reports manual design ready when OpenAI is absent
- merchant readiness is blocked until truthful confirmed values exist
- analytics no longer presents historical pre-launch paid metrics once the baseline is configured
- no unintended payment, manufacturing, referral, or customer-data mutation

Required canonical-domain proof after DNS cutover:

- apex and `www` TLS
- `www` canonical redirect
- homepage + full interview/physical/contact/OTP gates
- all public policy/contact pages
- Owner OS authenticated read proof
- support email proof
- OTP inbox-placement/deliverability proof
- provider webhook fail-closed proof
- Neon read-only corroboration of no unintended commercial side effects

## Completion definition

Engineering is complete when all code-side defects above are merged, deployed, and green on the temporary Hostinger runtime; DNS/email/provider configuration can then be applied without code changes. Final launch readiness still depends on truthful merchant facts, root-domain mail verification, Safepay production credentials, Printful signed webhook-v2 credentials, canonical DNS cutover, and the separately authorized real commercial proof cycle.
