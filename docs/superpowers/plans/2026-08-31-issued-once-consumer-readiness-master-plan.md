# ISSUED ONCE Consumer Readiness Master Plan

Date: 2026-08-31
Canonical integration base audited: `ad9f388c33121b1225cc7a387b038940edfd389b`
Parent implementation plan: `docs/superpowers/plans/2026-08-19-issued-once-final-commercial-cycle.md`
Owner OS design: `docs/superpowers/specs/2026-08-19-issued-once-owner-os-design.md`

## Purpose

This file is the canonical release-readiness ledger for ISSUED ONCE. The older commercial-cycle plan remains the implementation history and architectural source. This plan records whether each consumer promise is actually ready for an unknown customer in production.

A feature is **not DONE because code exists or a unit test is green**. A feature becomes DONE only when all evidence required by its row is present.

## Status vocabulary

- `DONE`: code + automated regression + integration/build gate + required live/provider proof are verified on the exact integration head or an explicitly recorded descendant.
- `CODE_READY`: implementation and automated verification are green, but the required deployed/provider/consumer proof has not yet been observed.
- `IN_PROGRESS`: failing regression or implementation cycle is active.
- `MISSING`: required consumer behavior is absent.
- `OWNER_REQUIRED`: only an irreversible, credential, payment, legal-identity, DNS, factory-charge, or similar owner boundary remains.
- `BLOCKED_EXTERNAL`: external provider/platform prevents proof despite correct local/integration behavior.

Never promote `CODE_READY` to `DONE` from test coverage alone.

## Evidence rules

Every completed row must record:

1. exact Git commit SHA;
2. focused regression test(s) and result;
3. full CI/typecheck/lint/build result when code changed;
4. browser evidence for customer-facing behavior;
5. real provider evidence for OTP/payment/design/factory/email/tracking behavior when that provider is part of the promise;
6. two-customer isolation evidence for any flow capable of mixing customer data;
7. live deployed release identity for production claims.

Synthetic preview/browser tests are evidence of UI logic only. `ENABLE_VISUAL_PREVIEW=1` is never production-provider proof.

## Audited product state

| ID | Consumer promise / operational contract | Audit state | Required completion evidence |
|---|---|---|---|
| CR-01 | Seven randomized questions, one per required family, immutable per experience | CODE_READY | exact-head full gate + live customer question-flow smoke |
| CR-02 | Raw answers/private data encrypted at rest and isolated between customers | CODE_READY | two-customer isolation gate on exact deployed code |
| CR-03 | TEE/CAP/TOTE selection, size/base, frozen variant and price | CODE_READY | explicitly published production catalog + live three-form smoke |
| CR-04 | Email OTP verification with rate limits, expiry, single use and privacy | CODE_READY | real Resend OTP receipt + verification on deployed integration release |
| CR-05 | Shipping accepts valid destination data without globally requiring non-applicable fields | MISSING | country-aware/optional region + phone contract, regression and live save proof |
| CR-06 | Safepay checkout starts only from complete verified commercial state | CODE_READY | readiness parity fix + signed sandbox/production checkout proof |
| CR-07 | Browser return never creates paid truth, but customer reaches their Issue after verified payment | MISSING | post-return polling/handoff to Issue + live paid return proof |
| CR-08 | One canonical Issue per paid attempt with immutable commercial snapshot | CODE_READY | real paid attempt + duplicate callback proof |
| CR-09 | Returning customer can access Issue from another browser/device using Issue Code + verified contact challenge | MISSING | accountless recovery implementation + cross-device browser proof |
| CR-10 | Customer status shows safe lifecycle/tracking without private-data leakage | CODE_READY | recovery-linked live status + shipment projection proof |
| CR-11 | Public support can be opened from the customer Issue without relying only on mailto | MISSING | Issue-scoped support UI + encrypted request + owner reply proof |
| CR-12 | Customer lifecycle email notifications are idempotent and deliver from verified sender | CODE_READY | real PAYMENT_RECEIVED/IN_PRODUCTION/SHIPPED/DELIVERED email proof |
| CR-13 | AI interpretation and artwork generation are provider-backed, private and replaceable | CODE_READY | current supported production models + one real generated candidate proof |
| CR-14 | Artwork quality gate proves an actually printable transparent PNG, not metadata alone | MISSING | decode/alpha/corruption/template/effective-DPI tests + real candidate proof |
| CR-15 | Generated artwork is durably retained across application redeploy/restart boundary | MISSING | persistence design + destructive redeploy/restart recovery proof |
| CR-16 | Owner reviews/approves/rejects/regenerates/uploads design with audited private-data reveals | CODE_READY | deployed Owner OS browser proof on a real controlled Issue |
| CR-17 | Catalog publication cannot sell a variant without a factory mapping | CODE_READY | exact-head regression + Owner OS publish rejection proof |
| CR-18 | Boot/default catalog never silently becomes accidental production commercial truth | MISSING | explicit production catalog authority/fail-closed rule + readiness regression |
| CR-19 | Printful draft creation is exact, idempotent and cannot charge automatically | CODE_READY | real Printful draft proof on controlled Issue |
| CR-20 | Printful confirmation requires owner session + independent kill switch + exact typed Issue confirmation | CODE_READY | controlled owner confirmation proof when owner deliberately authorizes first charge |
| CR-21 | Signed Printful webhook updates production/shipped/delivered truth without cross-linking Issues | CODE_READY | real signed webhook/shipment proof + duplicate/cross-link regression |
| CR-22 | Refund truth is provider-derived and an owner has a documented operational resolution path | IN_PROGRESS | first-class owner refund/reconciliation workflow or explicit runbook + provider proof |
| CR-23 | Owner OS customer, Issue, support, sales, audit and recovery views are bounded, paginated and privacy-preserving | CODE_READY | deployed Owner OS browser proof + scale/query gate |
| CR-24 | Owner System readiness mirrors every real runtime requirement and cannot show false-positive provider readiness | MISSING | parity tests against runtime env contracts; Safepay API secret included |
| CR-25 | Unknown exceptions never serialize private/provider/database details into server logs | IN_PROGRESS | complete route sentinel suite + exact-head full green gate |
| CR-26 | Merchant name, support address and truthful public location/legal disclosure are configured before public launch | OWNER_REQUIRED | owner-supplied truthful production values + live page proof |
| CR-27 | Canonical domain serves exact integration release with required security/cache headers | CODE_READY | deploy current verified integration head + strict live boundary audit |
| CR-28 | Full commercial cycle works from seven answers through verified payment, Issue, design, Printful, tracking, support and customer recovery | MISSING | one controlled full live order plus a second isolated customer proof |
| CR-29 | Repeat-order reuse/fresh-answer flow preserves contact/profile boundaries | CODE_READY | deployed repeat-order browser proof after a real paid Issue |
| CR-30 | Referral feature cannot affect checkout unless explicitly enabled; enabled flow is reversible on refund/delivery lifecycle | CODE_READY (launch-disabled) | only required before referral launch; non-referral checkout must remain green |

## Audit findings that must remain in scope

### A. Post-payment handoff and recovery

The current Safepay return correctly refuses to trust browser navigation as payment truth, but the pending page does not poll/transition to the newly created Issue. The current public Issue status lookup depends on the original browser session cookie. The required accountless recovery path using Issue Code plus verified contact challenge is absent.

Root-cause completion target: introduce one recovery capability that owns accountless Issue access. Do not bolt a second identity system onto support/status. Status, support and repeat-order re-entry must consume the same recovered Issue access boundary.

### B. Readiness parity

The readiness dashboard currently checks Safepay environment/API key/webhook secret but the actual payment runtime also requires `SAFEPAY_API_SECRET` or `SAFEPAY_V1_SECRET`. Readiness must be derived from the same validated runtime contract, not a duplicated approximation.

Root-cause completion target: centralize provider runtime configuration validation or have readiness call the same validators used by production runtime composition.

### C. Shipping applicability

Current shipping normalization requires phone and region for every destination. This is broader than the commercial plan and can reject legitimate addresses where those fields are not applicable.

Root-cause completion target: model requiredness by destination/provider contract rather than UI-only exceptions. Server validation and customer form must share the same rule.

### D. Production catalog authority

Catalog publication correctly verifies factory mapping and freezes old quotes. However, absence of a published catalog permits the audited boot catalog to become runtime commercial truth.

Root-cause completion target: keep boot catalog for development/initialization, but production selling/readiness must require explicit owner-published catalog authority.

### E. Artwork provider and quality

The design pipeline is real, but launch must not rely on an obsolete/deprecated image-provider assumption or metadata-only image QA. Artwork acceptance must decode the actual file and prove the printable contract.

Root-cause completion target: current supported image provider contract, actual PNG decode, alpha/transparency requirement, corruption rejection, mapped placement/effective-resolution checks, and durable asset retention.

### F. Public support

Encrypted Issue-scoped support exists server-side and Owner OS can reveal/reply/close/retry. The public customer experience still primarily exposes contact email instead of the encrypted Issue support flow.

Root-cause completion target: expose support from recovered/current Issue access, preserving the existing encrypted SupportService and owner desk.

### G. Refund operations

Refund events are reconciled from provider truth, but Owner OS does not yet provide a first-class refund initiation/reconciliation workflow. Do not invent browser refund truth.

Root-cause completion target: either implement a verified provider refund operation through the payment adapter or explicitly bind the owner runbook to provider-dashboard refund initiation and automatic webhook reconciliation for MVP.

### H. Residual log privacy

Unknown caught exceptions in public/owner routes must never be passed directly to `console.error`. Preserve stable event names and public HTTP contracts while logging no raw exception object or customer lookup input. Regression tests must use sensitive sentinels and prove absence from rendered logs.

### I. Live proof gap

The migration-branch Browser QA runs with visual preview and is not real provider proof. The existing production smoke reaches real OTP request only; it does not verify OTP, shipping, Safepay payment, Issue creation, design, Printful, tracking, support or cross-device recovery.

Root-cause completion target: expand controlled live QA in stages. Never charge or confirm Printful without the independent owner gate. All non-charge live behaviors should be automated where provider credentials permit.

## Execution order from this audit

1. `CR-25` complete residual API log privacy class already in TDD cycle.
2. `CR-24` make readiness use the real runtime contracts; eliminate Safepay false positive.
3. `CR-05` make shipping destination-valid and shared between server/UI.
4. `CR-07` + `CR-09` build one accountless Issue access/recovery boundary and post-payment handoff.
5. `CR-11` expose encrypted Issue-scoped customer support through that access boundary.
6. `CR-18` require explicit production catalog authority.
7. `CR-13` + `CR-14` move artwork generation/QA to a current, proven production contract.
8. `CR-15` prove or replace runtime filesystem persistence.
9. `CR-22` finish refund operations/runbook truth.
10. Deploy the exact verified integration release; run `CR-27` live boundary/security proof.
11. Automate all safe live provider tests: real OTP, shipping, payment sandbox/controlled production return, email, design generation and Printful draft.
12. Owner-only irreversible gate: first real Safepay charge if needed and first Printful confirmation.
13. Run `CR-28`: one complete controlled order plus a second deliberately different customer/session to prove no cross-customer data mixing.

## Live consumer acceptance sequence

The final release gate must verify, in order:

1. anonymous customer receives seven persisted randomized questions;
2. customer locks TEE/CAP/TOTE physical truth from explicitly published catalog;
3. real OTP arrives and verifies;
4. a valid shipping address saves under destination rules;
5. exact frozen price is shown;
6. Safepay checkout opens only after all prerequisites;
7. browser return alone cannot forge payment;
8. verified payment produces exactly one Issue and customer is handed into that Issue;
9. payment-received email arrives;
10. design job creates a private printable candidate;
11. owner can review/reject/regenerate/approve without leaking private answers by default;
12. Printful creates exactly one unconfirmed mapped draft;
13. production confirmation remains impossible unless the owner deliberately arms and types the Issue confirmation;
14. signed manufacturing events update status/tracking idempotently;
15. customer can recover the Issue from a different browser/device using Issue Code + verified contact;
16. customer can create encrypted support from the Issue and owner can reply;
17. a second customer with deliberately different answers/contact/address/variant never receives or affects any first-customer data;
18. logs contain no raw customer/provider/database exception details throughout the cycle.

## Completion rule

ISSUED ONCE is `CONSUMER_READY` only when every launch-blocking row above is `DONE` or an explicitly documented `OWNER_REQUIRED` irreversible boundary, and the full commercial-cycle proof has executed on the same deployed release identity. No percentage, green unit suite, preview screenshot, deployment compile, or owner dashboard label overrides this rule.
