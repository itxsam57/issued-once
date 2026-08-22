# ISSUED ONCE — Merchant Surface + Final Launch Controls Design

Date: 2026-08-21
Status: OWNER APPROVED
Branch: `feat/mystery-foundation`

## Goal

Finish the public merchant surface and Owner OS launch controls required for a legitimate Safepay/Printful first commercial cycle while preserving the mystery experience, truthful business identity, immutable pricing truth, and fail-closed provider readiness.

## Public merchant surface

Add restrained public routes that match the existing ISSUED ONCE visual language:

- `/store-info`
- `/contact`
- `/terms`
- `/returns`

The homepage/footer and commitment/payment stage link to these pages without turning the product into a generic storefront.

## Truthful merchant identity

Public merchant details must come from deployment configuration rather than invented source literals.

Expected deployment-backed fields:

- public business/trading name
- public support email
- public support phone when supplied
- public business location/address text
- optional legal entity/business-registration text when genuinely applicable

The application must never claim a foreign incorporation, office, or business domicile that is not true.

Owner OS readiness reports merchant disclosure as `missing`, `blocked`, or `ready` based on the required public fields and route availability.

## Store information

`/store-info` explains in plain language:

- ISSUED ONCE creates one personalized physical piece from seven answers
- current forms are tee, cap/hat, and tote, subject to catalog availability
- final artwork remains unknown to the customer before purchase by product design
- the selected physical form, size, base color, final payable amount, and shipping destination are confirmed before payment
- manufacturing is fulfilled through the configured manufacturing partner
- displayed prices come from the canonical active catalog

The page may show current starting/current prices from the runtime catalog but must not create a second static price source.

## Contact

`/contact` exposes the configured merchant support email, phone if configured, and truthful business location. Existing support functionality remains available; the page must not expose internal IDs or private customer data.

## Terms

`/terms` states the operational contract for the first version, including:

- customer must provide accurate contact/shipping information
- personalized design is generated from submitted answers and may be created automatically or manually
- customers purchase the selected physical form and personalized creation process rather than previewing final artwork before payment
- payment is charged through the configured payment provider
- fulfillment/shipping estimates are not guarantees where carrier/manufacturer delays apply
- prohibited/abusive submissions may be refused/refunded where appropriate
- mandatory consumer rights are not waived
- contact/support route for disputes

The terms are product copy, not a claim of legal incorporation in an untrue jurisdiction.

## Returns/refunds

`/returns` is customized for made-to-order personalized goods while preserving mandatory consumer rights.

Launch policy:

- change-of-mind returns may be restricted for personalized/made-to-order pieces where legally permitted
- damaged, defective, materially wrong, duplicate, or unfulfillable orders receive an appropriate replacement/refund remedy
- shipping/production exceptions are handled through support using the Issue Code
- approved refunds must reconcile through payment truth and existing refund/exception state handling
- policy must not promise an automated refund capability that has not been implemented/proven

## Pricing controls

The existing versioned Owner OS catalog remains canonical and continues freezing existing quotes/Issues.

Add a fast product-level price control so the owner can:

1. choose TEE, HAT, or TOTE
2. enter a customer-facing price in major currency units
3. publish that price to every currently sellable variant of the selected product through the existing catalog-publication service

The detailed per-variant editor remains available for exceptional differences. Publishing still validates catalog structure and manufacturing mappings before activation.

## Safepay launch boundary

The current classic hosted-checkout implementation remains fail-closed until a real sandbox cycle identifies the exact protocol accepted by the owner's Safepay account.

Known current external evidence shows both:

- Safepay's current classic SDK still implements the v1-style hosted checkout/signature family used by this application
- newer Safepay documentation describes a v2 hosted checkout family with different initiation/query/signature details

Do not silently migrate protocol based only on documentation drift. The first sandbox checkout/webhook evidence determines whether the current adapter works or requires an intentional versioned gateway change.

Payment launch acceptance remains:

- checkout creation reaches Safepay sandbox
- browser redirect is not paid truth
- signed webhook authenticates merchant/payment state
- amount and currency reconcile exactly against frozen payment attempt
- duplicate/replay is idempotent
- refund or payment exception behavior is observed

## Remaining provider gates

After Safepay sandbox proof:

1. prove OpenAI interpretation/image generation when configured
2. prove private Blob write + signed manufacturing read
3. prove Vercel design/notification queue consumers
4. prove one real Printful draft with production confirmation disabled
5. prove Printful signed webhook/fulfillment events
6. only then permit an owner launch decision

## Readiness truth

Owner OS readiness must distinguish:

- configured
- read-only/live provider access proven
- safe/disabled production gate
- missing
- blocked

`readyForProduction` remains false until observed external evidence exists. Presence of environment variables alone never establishes payment, queue, model, email, or manufacturing proof.

## Browser QA

The existing real OTP production smoke is intentionally retained while the owner accepts the email volume because it proves production transactional delivery. Browser QA continues to cover desktop/mobile UI, live production journey to OTP, and no accidental payment/manufacturing side effects.

## Acceptance criteria

1. Public store-info/contact/terms/returns pages exist and match the product visual system.
2. Footer/payment stage links are discoverable without weakening the mystery presentation.
3. Public merchant identity is truthful and deployment-configured.
4. Merchant-readiness fails closed when required disclosure values are missing.
5. Store pricing is sourced from the canonical catalog.
6. Owner can change a selected product's future-sale price quickly without editing every variant individually.
7. Existing quotes and Issues retain historical prices after catalog publication.
8. Safepay protocol is not guessed; sandbox evidence determines adapter compatibility.
9. Provider gates remain independently observable and fail closed.
10. PR remains draft until all commercial launch evidence is green and owner explicitly promotes it.
