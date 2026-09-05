# ISSUED ONCE — Production Environment Contract

Date: 2026-08-22
Branch: `feat/mystery-foundation`
Status: configuration contract only; values are not committed here.

Production must fail closed when any required boundary is not configured. Never put real secret values in this repository.

## Core database and privacy

### `DATABASE_URL`
Neon/Postgres connection used by the production repositories.

### `QUIZ_ENCRYPTION_KEY_V2`
Base64-encoded 32-byte AES-256-GCM key used for all new questionnaire answers, verified email, shipping addresses, design briefs, and support messages.

Requirements:
- server-only
- cryptographically random
- backed up in a secure owner-controlled secret store
- never rotate or replace it while ciphertext still references `v2`

### `QUIZ_ENCRYPTION_KEY_V1`
Legacy decrypt-only key. It is required only while the production database still contains ciphertext whose key-version column is `v1`. Readiness must verify that condition from the database rather than requiring V1 unconditionally. Never fabricate or regenerate a replacement V1 key for historical ciphertext.

### `IDENTITY_HMAC_KEY`
Server-only high-entropy key used for privacy-preserving deterministic identity/lookup hashes.

It must be independent from the questionnaire encryption keys.

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

Provider-contract proof should start in sandbox whenever possible. Production must always be a deliberate owner change and a controlled real-payment test.

### `SAFEPAY_API_KEY`
Safepay merchant/client API key used as the merchant identity for checkout and webhook verification.

### `SAFEPAY_API_SECRET`
Server-only Safepay Merchant **Secret Key** used for authenticated server-to-server v3 tracker creation, Passport token creation, and Reporter verification.

Rules:
- never expose this value to browser JavaScript
- never log it
- never put it in a `NEXT_PUBLIC_*` variable
- production payment runtime must fail closed when it is absent

### `SAFEPAY_WEBHOOK_SECRET`
Safepay webhook signing secret. Current v2 webhook verification uses HMAC-SHA512 over the **exact raw HTTP request body** and compares it to `x-sfpy-signature`.

Production webhook endpoint:

`https://issuedonce.shop/api/webhooks/safepay`

### Safepay v3 payment contract

New checkout sessions use the current server-side flow:

1. create the payment with `/order/payments/v3/`
2. send the quote amount as an integer in the currency's lowest denomination
3. obtain the time-based Passport token server-to-server
4. send the customer to the hosted `/embedded` checkout with `source=hosted`
5. treat the browser redirect as navigation only, never payment truth
6. authenticate the v2 webhook from the raw request body
7. use Reporter v2 to prove the immutable original quote before moving a payment attempt to `PAID`

Safepay may settle a foreign-currency quote into a different provider base currency. A callback settlement amount/currency therefore does not have to equal the ISSUED ONCE retail quote. When settlement money differs, the application must verify the tracker through Reporter and require `purchase_totals.quote_amount` to match the frozen payment attempt's original currency and integer minor amount exactly.

Rules:
- only authenticated server evidence can mark a payment `PAID`
- the frozen ISSUED ONCE quote is immutable after payment initiation
- provider settlement conversion never rewrites the frozen quote
- Reporter must show the successful tracker state and the exact original quote
- signature or merchant-authentication failures return an authentication failure and never trigger downstream work
- malformed webhook bodies/data fail as bad input and never trigger downstream work
- questionnaire answers are never sent to Safepay
- legacy v1 webhook verification exists only as transitional compatibility for already-created legacy trackers; new sessions must use v3

## Referral rollout boundary

### `REFERRAL_ATTRIBUTION_SIGNING_KEY`
Server-only signing key for referral attribution. Its presence is also the explicit runtime signal that the referral schema rollout is enabled.

Migration dependency:

`db/migrations/0029_creator_referrals.sql`

Rollout order is mandatory:

1. obtain explicit owner approval for migration `0029_creator_referrals.sql`
2. apply and verify migration `0029` in production
3. only then configure `REFERRAL_ATTRIBUTION_SIGNING_KEY`
4. verify referred paid, replay, and refund/reversal flows

Do **not** configure the signing key before migration `0029` exists. Before rollout, its deliberate absence makes Safepay paid/refund webhooks skip referral SQL while preserving the canonical payment, Issue, design-dispatch, payment-notification, and refund-flag flows. Once the key is present, referral schema failures must fail loudly rather than silently degrading a partially enabled rollout.

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
- Safepay Merchant Secret Key configured server-only
- Safepay v3 checkout and Passport token proven
- Safepay signed v2 webhook verified from the raw request body
- Reporter v2 proves the exact frozen original quote
- referral signing key remains absent until migration `0029` is explicitly approved and applied
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
