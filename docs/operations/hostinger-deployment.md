# ISSUED ONCE — Hostinger Production Deployment Runbook

Date: 2026-09-07
Status: Hostinger is the canonical hosting, DNS, and human-mail provider for `issuedonce.shop`.

This runbook describes the current production architecture. It deliberately does not preserve obsolete Vercel migration steps.

## Safety rules

- Never expose encryption keys, OTPs, sessions, raw answers, addresses, database credentials, payment secrets, provider secrets, or owner-operation tokens.
- Do not rotate privacy/encryption keys without an explicit continuity plan.
- Do not delete historical analytics/customer rows to make dashboards look clean; use the commercial metrics baseline.
- Keep `PRINTFUL_ALLOW_CONFIRM` disabled until the owner deliberately authorizes real fulfillment.
- Do not make a real Safepay charge/refund solely for QA.
- Do not invent merchant/legal identity or location values.

## Canonical web + DNS state

Canonical site:

`https://issuedonce.shop`

Canonical redirect:

`https://www.issuedonce.shop/*` -> `https://issuedonce.shop/*`

Hostinger authoritative nameservers are:

- `lunar.dns-parking.com`
- `solar.dns-parking.com`

The verified Hostinger zone intentionally contains:

- apex Hostinger ALIAS/CDN routing
- `www` Hostinger CDN routing
- root Resend DKIM/SPF return-path records
- `_dmarc`
- preserved `otp.issuedonce.shop` Resend DKIM/SPF return-path records

**Do not reset the current DNS zone.** It has already been checked against Hostinger authoritative DNS and contains the purposeful records required by the web and email stack.

For any future DNS recovery, restore only records with a known production purpose. Do not export/import the stale Vercel web zone and do not create a second authoritative DNS provider.

## Hostinger Mail

Primary human mailbox:

`support@issuedonce.shop`

Approved aliases into the same mailbox:

- `help@issuedonce.shop`
- `refunds@issuedonce.shop`
- `privacy@issuedonce.shop`
- `security@issuedonce.shop`
- `dmarc@issuedonce.shop`

A separate `info@` mailbox or alias is not required.

## Resend

Keep both sender domains during migration/proof:

- `otp.issuedonce.shop` — existing verified OTP sender; do not remove while root sender proof is incomplete.
- `issuedonce.shop` — canonical root sender domain.

Root Resend records are:

- TXT `resend._domainkey` — exact DKIM value returned by the connected Resend account
- MX `send` -> `feedback-smtp.ap-northeast-1.amazonses.com`, priority 10
- TXT `send` -> `v=spf1 include:amazonses.com ~all`

OTP records are the same shapes under `.otp` and must remain present until the root-domain sender is proven.

Production sender contract after Resend root verification:

`RESEND_FROM_EMAIL=ISSUED ONCE <notify@issuedonce.shop>`

Reply/support contract:

`SUPPORT_INBOX_EMAIL=support@issuedonce.shop`
`SUPPORT_REPLY_TO=support@issuedonce.shop`

## Canonical environment contract

Set in Hostinger environment variables, never in source control:

`APP_ORIGIN=https://issuedonce.shop`
`RESEND_FROM_EMAIL=ISSUED ONCE <notify@issuedonce.shop>`
`SUPPORT_INBOX_EMAIL=support@issuedonce.shop`
`SUPPORT_REPLY_TO=support@issuedonce.shop`
`MERCHANT_SUPPORT_EMAIL=support@issuedonce.shop`
`COMMERCIAL_METRICS_BASELINE_DATE=YYYY-MM-DD`

Only set:

`MERCHANT_PUBLIC_DETAILS_CONFIRMED=true`

after the owner has supplied and checked truthful public merchant name, support address, and location values.

Only set `COMMERCIAL_METRICS_BASELINE_DATE` after read-only production evidence identifies the commercial launch boundary. The baseline filters pre-launch/test metrics; it does not delete historical rows.

## Design workflow

OpenAI automation is optional for launch. MANUAL artwork is a valid production workflow when durable private artwork storage is healthy.

- `OPENAI_API_KEY` may be absent.
- Readiness reports OpenAI separately from `design-workflow`.
- A missing/blocked OpenAI integration must not block launch when the manual workflow and durable storage are ready.
- No design reaches manufacturing without the existing review/approval controls.

## Durable jobs and private artwork

The active Hostinger architecture uses the repository's Postgres-backed durable job/storage boundaries. Do not add Vercel Blob or Vercel Queue as a launch dependency.

Required runtime safety values include:

- `DATABASE_URL`
- `ARTWORK_SIGNING_KEY`
- `CRON_SECRET`
- `INTERNAL_OPERATIONS_TOKEN`

The cron/drain authorization secret must stay server-only and must never appear in a URL or source file.

## Safepay

Canonical endpoints:

- webhook: `https://issuedonce.shop/api/webhooks/safepay`
- browser return: `https://issuedonce.shop/payment/return`

Required provider configuration remains owner/provider controlled:

- `SAFEPAY_ENVIRONMENT`
- `SAFEPAY_API_KEY`
- `SAFEPAY_API_SECRET`
- `SAFEPAY_WEBHOOK_SECRET`

The browser return is navigation only; signed/provider reconciliation remains payment truth. Do not perform a real charge/refund just to configure the domain.

## Printful

Canonical signed webhook endpoint:

`https://issuedonce.shop/api/webhooks/printful`

Required production-bound values include:

- `PRINTFUL_API_TOKEN`
- `PRINTFUL_STORE_ID`
- `PRINTFUL_WEBHOOK_PUBLIC_KEY`
- `PRINTFUL_WEBHOOK_SECRET_HEX`

Keep:

`PRINTFUL_ALLOW_CONFIRM=false`

until a separate owner decision authorizes real manufacturing confirmation.

## Verification after code/environment changes

Require fresh proof of:

1. apex HTTPS 200 from Hostinger and valid TLS/security headers
2. `www` permanent canonical redirect preserving path/query
3. trusted public redirects/payment return never expose an internal Hostinger origin
4. Hostinger Mail receipt at `support@issuedonce.shop`
5. Resend OTP domain remains verified
6. root Resend domain is verified before switching production sender to `notify@issuedonce.shop`
7. full unit/typecheck/lint/build green
8. consumer + Owner OS browser regression green
9. read-only Neon corroboration for commercial metrics baseline
10. Safepay/Printful canonical webhooks only after their provider configuration is available

## Vercel retirement

Vercel is not part of the final ISSUED ONCE production architecture. There is no Vercel DNS export/import step. Once cached old delegation expires, any remaining Vercel configuration is simply unused; do not perform destructive provider cleanup unless the owner separately asks for it.
