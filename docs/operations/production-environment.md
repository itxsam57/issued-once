# ISSUED ONCE — Production Environment Contract

Date: 2026-08-19
Branch: `feat/mystery-foundation`
Status: configuration contract only; values are not committed here.

Production must fail closed when any required boundary is not configured. Never put real secret values in this repository.

## Core database and privacy

### `DATABASE_URL`
Neon/Postgres connection used by the production repositories.

### `QUIZ_ENCRYPTION_KEY_V1`
Base64-encoded 32-byte AES-256-GCM key used for questionnaire answers, verified email, shipping addresses, design briefs, and support messages.

Requirements:
- server-only
- cryptographically random
- backed up in a secure owner-controlled secret store
- never rotate by deleting the old key while ciphertext still references `v1`

### `IDENTITY_HMAC_KEY`
Server-only high-entropy key used for privacy-preserving deterministic identity/lookup hashes.

It must be independent from `QUIZ_ENCRYPTION_KEY_V1`.

## Retail catalog

### `ISSUED_ONCE_CATALOG_JSON`
Provider-independent retail catalog owned by ISSUED ONCE.

Example structure only:

```json
{
  "currency": "USD",
  "products": {
    "tee": {
      "slug": "io-tee",
      "variants": [
        {
          "id": "io-tee-m-black",
          "size": "M",
          "colorName": "Black",
          "colorSwatch": "#171713",
          "amountMinor": 5400,
          "available": true
        }
      ]
    }
  }
}
```

Rules:
- retail price is integer minor units
- every logical variant ID is unique
- the retail catalog does not contain Printful order IDs
- only sampled/approved form/size/color combinations should be marked available for real sale
- Hoodie remains optional/seasonal

## Email / OTP / support

### `RESEND_API_KEY`
Server-only Resend API key for OTP, milestone notifications, and support forwarding.

### `RESEND_FROM_EMAIL`
Verified sender identity, for example an address on `issuedonce.shop` after domain verification.

### `SUPPORT_INBOX_EMAIL`
Private support inbox receiving encrypted-support submissions after decryption at the delivery boundary.

### `SUPPORT_REPLY_TO`
Optional reply-to address used on automated customer milestone emails.

## Safepay

### `SAFEPAY_ENVIRONMENT`
One of:
- `sandbox`
- `production`

First end-to-end payment proof must start in sandbox. Production must be a deliberate owner change.

### `SAFEPAY_API_KEY`
Safepay merchant/client API key used to create payment trackers.

### `SAFEPAY_WEBHOOK_SECRET`
Safepay merchant webhook secret used to verify `x-sfpy-signature` with HMAC-SHA512 over the serialized webhook `data` object.

Production webhook endpoint:

`https://issuedonce.shop/api/webhooks/safepay`

Rules:
- browser redirects are never payment proof
- only authenticated server webhook evidence can mark a payment `PAID`
- exact amount and currency must match the frozen payment attempt
- questionnaire answers are never sent to Safepay

## OpenAI design worker

### `OPENAI_API_KEY`
Server-only API key used by the design worker.

### `OPENAI_DESIGN_MODEL`
Optional override for the structured interpretation model. If unset, the code default is used. Verify model access in the live account before enabling paid orders.

### `OPENAI_IMAGE_MODEL`
Optional override for artwork generation. Verify live image-generation access before enabling paid orders.

Rules:
- raw customer answers are decrypted only inside the design worker
- interpretation requests use `store: false`
- image generation receives the structured design brief, not the raw seven answers
- generated art stops at `DESIGN_REVIEW`; no model output can enter manufacturing without explicit approval

## Vercel Blob

### `BLOB_READ_WRITE_TOKEN`
Server-only Blob token used to persist final generated PNG assets.

The resulting artwork URL must be HTTPS and reachable by Printful. Never store questionnaire answers in Blob object names or metadata.

## Internal owner operations

### `INTERNAL_OPERATIONS_TOKEN`
High-entropy server-only bearer token protecting owner-only design/manufacturing endpoints.

Minimum application requirement: 24 characters. Use a substantially longer random secret in production.

Owner-only endpoints include:
- design approval
- Printful draft creation
- Printful production confirmation

Do not expose this token to browser JavaScript or public environment variables.

## Printful

### `PRINTFUL_API_TOKEN`
Server-only Printful API token.

### `PRINTFUL_STORE_ID`
Optional API-store identifier when the token has access to multiple stores.

### `PRINTFUL_VARIANT_MAP_JSON`
Explicit mapping from ISSUED ONCE physical truth to a sampled/approved Printful catalog variant.

Example structure only:

```json
{
  "tee:M:Black": {
    "variantId": 4012,
    "fileType": "front"
  }
}
```

The example ID above is illustrative only. Never copy an example variant into production. Obtain and verify each real Printful numeric variant ID against the current Printful catalog and a physical sample.

Rules:
- no exact mapping = no manufacturing
- retail logical SKU and Printful numeric variant are intentionally separate
- customer questionnaire answers never enter Printful

### `PRINTFUL_WEBHOOK_PUBLIC_KEY`
Expected Printful v2 webhook public-key header.

### `PRINTFUL_WEBHOOK_SECRET_HEX`
Printful v2 webhook signing secret as hexadecimal. The application hex-decodes it before HMAC-SHA256 verification.

Production webhook endpoint:

`https://issuedonce.shop/api/webhooks/printful`

### `PRINTFUL_ALLOW_CONFIRM`
Manufacturing charge kill switch.

Safe/default state:
- missing, or
- anything except exact string `true`

Only set to `true` when an owner deliberately wants the application to allow `/orders/{id}/confirm`.

Even when this flag is `true`, confirmation still requires:
1. valid `INTERNAL_OPERATIONS_TOKEN`
2. an existing Printful draft attached to the same Issue
3. exact confirmation phrase `CONFIRM <issue UUID>`

For the first commercial cycles, return this flag to disabled after a deliberate confirmation if continuous automated confirmation is not yet wanted.

## Vercel Queue

Queue consumers are declared in `vercel.json`:

- `issued-once-design`
- `issued-once-notifications`

Before production payment is enabled, verify on the actual Vercel account that:
- the Queue feature is provisioned
- both function triggers are registered after deploy
- the design function has enough execution duration for the selected image model
- failed messages visibly retry
- queue delivery can reach the protected production deployment environment

## Variables that must NOT be present in the final active commerce configuration

The production ISSUED ONCE physical runtime no longer requires Fourthwall storefront credentials. Do not configure legacy Fourthwall secrets as a way to make an old route work.

The live commercial path is:

`ISSUED ONCE -> Safepay -> canonical Issue -> design -> Printful`

not Fourthwall or Shopify.

## Launch invariant

If any of the following cannot be demonstrated, keep paid production disabled:

- migrations applied and verified
- encryption/HMAC keys backed up
- Safepay signed webhook verified
- exact retail catalog loaded
- exactly mapped sampled Printful variants
- OpenAI design call proven
- Blob artwork reachable
- Queue retries proven
- owner design approval works
- Printful draft creation works with `confirm=0`
- `PRINTFUL_ALLOW_CONFIRM` defaults off
- Printful signed shipment webhook verified
- Resend domain/sender verified
- private Issue status and support tested
