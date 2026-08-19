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
Server-only token for a **private** Vercel Blob store containing canonical generated PNG assets.

Rules:
- canonical artwork is uploaded with `access: private`
- database stores the private canonical Blob URL
- the owner browser receives only a short-lived signed read URL
- Printful receives only a bounded signed read URL generated at draft time
- never put questionnaire answers in Blob object names or metadata
- do not switch the Blob store to public merely to make Printful fetch an image

## Internal owner operations

### `INTERNAL_OPERATIONS_TOKEN`
High-entropy server-only secret used to establish the private `/ops` session.

Minimum application requirement: 24 characters. Use a substantially longer random secret in production.

The owner room intentionally excludes raw questionnaire answers, email, and shipping details. Its production identity is the Issue.

Owner operations include:
- design approval
- Printful draft creation
- Printful production confirmation

Do not expose this token to public environment variables or browser JavaScript.

## Printful

### `PRINTFUL_API_TOKEN`
Server-only Printful API token.

### `PRINTFUL_STORE_ID`
Optional API-store identifier when the token has access to multiple stores.

### `PRINTFUL_VARIANT_MAP_JSON`
Explicit mapping from ISSUED ONCE physical truth to a **sampled and measured** Printful catalog variant and print placement.

Example structure only:

```json
{
  "tee:M:Black": {
    "variantId": 4012,
    "fileType": "front",
    "printArea": {
      "width": 1800,
      "height": 2400,
      "dpi": 150
    },
    "position": {
      "width": 900,
      "height": 1350,
      "top": 300,
      "left": 450
    }
  }
}
```

Every number above is illustrative only. Never copy this mapping into production. Obtain the current Printful numeric variant and printfile/placement profile for the exact sampled blank and verify the physical result.

Rules:
- no exact mapping = no manufacturing
- the target placement must fit entirely inside the configured Printful print area
- source artwork pixel width/height must be at least the target placement width/height; ISSUED ONCE refuses any mapping that would enlarge the source artwork
- Printful receives `limit_to_print_area=true`
- retail logical SKU and Printful numeric variant are intentionally separate
- the public Issue Code is Printful `external_id` and is used to recover ambiguous draft retries
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

Even when this flag is `true`, `/ops` confirmation still requires:
1. a valid private ops session
2. an existing Printful draft attached to the same Issue
3. exact confirmation phrase `CONFIRM <public Issue Code>`

For the first commercial cycles, return this flag to disabled after a deliberate confirmation if continuous confirmations are not yet wanted.

## Vercel Queue

Queue consumers are declared in `vercel.json`:

- `issued-once-design`
- `issued-once-notifications`

Before production payment is enabled, verify on the actual Vercel account that:
- the Queue feature is provisioned
- both function triggers are registered after deploy
- the design function has enough execution duration for the selected image model
- failed messages visibly retry
- queue delivery can reach the production deployment environment

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
- exactly mapped sampled Printful variants and print placements
- OpenAI design call proven
- canonical artwork private and temporary owner/factory access proven
- Queue retries proven
- owner design approval works
- Printful draft creation works with `confirm=0`
- ambiguous Printful draft retry resolves by public Issue Code without a second order
- `PRINTFUL_ALLOW_CONFIRM` defaults off
- Printful signed shipment webhook verified
- Resend domain/sender verified
- private Issue status and support tested
