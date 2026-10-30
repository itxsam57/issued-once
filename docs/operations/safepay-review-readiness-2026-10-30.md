# ISSUED ONCE — Safepay merchant review readiness (2026-10-30)

Scope: fill the merchant-visible disclosure gaps without redesigning the mystery experience, changing payment/factory configuration, or inventing legal and provider facts.

## Plan / current implementation

| Safepay asks for | Code deliverable | Verification required before recording |
| --- | --- | --- |
| Business features, products and prices | Home includes a minimal physical-product description; /store-info lists real active catalog starting prices instead of copied hardcoded amounts | Live prices match three variant quotes (tee, cap, tote); pricing and discounts remain frozen when resuming |
| Terms | /terms connects to delivery, returns, and privacy; preserves personalized mystery terms and mandatory rights | Owner checks terms match trading jurisdiction and actual operations |
| Privacy | Add /privacy, with categories, purposes, processing/sharing, security, retention and data requests | Owner/legal review of controller identity, applicable legal rights and actual retention periods; check public HTTP 200 |
| Cancellation, refunds, returns | Expand /returns with cancellation-before-production, fault evidence, support-directed returns and provider-confirmed refunds | Owner signs off real cancellation/refund rules and any consumer-law deadlines |
| Delivery | Add /shipping with destination, dispatch/transit, charges, customs, issues and status | Owner must substantiate supported countries, delivery time estimates, delivery fees and customs instructions; no made-up SLA |
| Customer contact | /contact and /store-info remain environment-backed; no invented business identity | Verify published merchant address and business/legal entity against Safepay application |
| Full journey and order confirmation | Existing seven-question, physical selection, verified email, shipping, frozen quote, Safepay sandbox, payment return and Issue status remain unchanged | Run a controlled sandbox purchase; verify hosted checkout, signed webhook, exactly one paid Issue, customer confirmation and Owner visibility. Browser return alone never proves payment |
| Screen recording | Recording runbook below | Capture only after sandbox cycle is proven; redact OTP, personal address, keys and provider credentials |

## Validation gates

1. Regression tests: new privacy and delivery routes, discoverable footer/pre-checkout links, dynamic catalog prices, original merchant/cookie/commitment tests.
2. Full unit suite, TypeScript, lint, production build; desktop/mobile Playwright merchant routes; inspect exact commit and branch protections.
3. Promote through normal PR and release gates. The Hostinger-selected release branch must **not** be mutated without owner deployment authorization.
4. After release, live HTTP 200 for /privacy, /shipping, /terms, /returns, /store-info, /contact. Verify security headers, current prices, mobile viewport and legible policy copy.
5. Complete one real Safepay **sandbox** cycle plus verified server-side payment truth. Do not activate production Safepay, manufacturing confirmation or create a real customer charge as a shortcut.

## Review recording sequence

1. Show domain/home, explain personalized unisex TEE/CAP/TOTE and why only the artwork is hidden.
2. Open Store Info and select current items/physical variants; show prices and support disclosure.
3. Show Terms, Privacy, Delivery, Returns/Refunds and Contact.
4. Complete the seven questions and verify contact; conceal the actual email/OTP/address in published footage.
5. Select product, size and color, enter shipping, confirm a full price/discount quote.
6. Open official Safepay sandbox checkout; complete a **successful controlled** sandbox transaction using provider-approved test credentials.
7. Show that the app checks verified payment and produces one Issue Code/order confirmation. Show customer status and the matching Owner order (redacted).
8. End with visible customer support route.

## Remaining OWNER_REQUIRED / PROVIDER_REQUIRED

- Owner legal review and approval of all policy text; **no factual legal domicile claim can be certified from code**. In particular, attest that the configured US address on /store-info and /contact is accurate, belongs to the actual merchant, and matches Safepay onboarding.
- Set actual destination eligibility, manufacturing/dispatch and delivery estimates, carrier fees/taxes, return periods, and business refund/contact SLA. Do not publish universal dates or deadlines without business evidence.
- Authenticated live Owner OS verification of manual design upload, individual-variant price publication, referral creator-link/discount/resume, and customer order status after a paid sandbox Issue.
- A successful end-to-end signed Safepay sandbox payment/webhook/confirmation/refund-exception test. A green unit test or checkout redirect is insufficient.
- GitHub Live Support Proof must be rechecked; previously the Actions INTERNAL_OPERATIONS_TOKEN did not match Hostinger. Secrets must be synchronized through approved owner tooling, not copied into source or logs.
- Printful confirmation is intentionally OFF. Never use production payment or manufacturing confirmation for the Safepay recording.

## Stop condition

Code-ready is not the same as Safepay-ready: until the legal/disclosure truth and controlled payment-to-confirmation proof exist, record the result as **NO-GO for final merchant submission**.