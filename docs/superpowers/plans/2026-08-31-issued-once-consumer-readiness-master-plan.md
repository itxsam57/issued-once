# ISSUED ONCE Consumer Readiness Master Plan

Date: 2026-08-31
Last reconciled: 2026-09-01
Original audited integration base: `ad9f388c33121b1225cc7a387b038940edfd389b`
Verified runtime integration head: `6b64b3b000cff18db2ac27b8c5494b0c72670211`
Verified runtime tree: `c60126214c2de88731b912c6bdee26b7769d8fd4`
Governed integration head before this checkpoint: `3398a55399b747553bbce9d0bf9bdf820e5d4e14`
Current live Hostinger release: `28ff7deb6b1fe7578c271131f1655fc46898cefd`
Current live Hostinger tree: `c60126214c2de88731b912c6bdee26b7769d8fd4`
Actual Hostinger-linked branch: `release/hostinger-v2-candidate-20260824`
Parent implementation plan: `docs/superpowers/plans/2026-08-19-issued-once-final-commercial-cycle.md`
Owner OS design: `docs/superpowers/specs/2026-08-19-issued-once-owner-os-design.md`

## Purpose

This file is the canonical current release-readiness ledger for ISSUED ONCE. Historical implementation detail remains preserved in Git history and the parent plans; this revision intentionally removes stale checkpoint prose that contradicted fresh production evidence.

A feature is **not DONE because code exists or a unit test is green**. A feature becomes DONE only when the evidence required by its row is present. A provider/credential/DNS/charge/legal-identity boundary may be `OWNER_REQUIRED` without blocking unrelated safe engineering work.

## Status vocabulary

- `DONE`: code + automated regression + integration/build gate + required live/provider proof are verified on the exact integration tree or an explicitly recorded tree-identical deployed descendant.
- `CODE_READY`: implementation and automated verification are green, but required deployed/provider/consumer proof is still incomplete.
- `IN_PROGRESS`: a failing regression or implementation cycle is active.
- `MISSING`: required consumer behavior/proof is absent and still needs engineering or live-cycle work.
- `OWNER_REQUIRED`: only an irreversible, credential, payment, legal-identity, DNS, factory-charge or similar owner boundary remains for that row.
- `BLOCKED_EXTERNAL`: an external provider/platform prevents proof despite correct local/integration behavior.

Never promote `CODE_READY` to `DONE` from test coverage alone.

## Evidence rules

Every completed production claim must record:

1. exact Git commit/tree identity;
2. focused regression evidence;
3. full CI/typecheck/lint/build result when code changed;
4. browser evidence for customer-facing behavior;
5. real provider evidence when OTP/payment/design/factory/email/tracking is part of the promise;
6. two-customer isolation evidence for any flow capable of mixing customer data;
7. exact live deployed release identity for production claims.

Synthetic preview/browser tests are UI/logic evidence only. Fail-closed provider checks may accept `503` only when the response body exactly matches the route's safe unavailable contract; arbitrary `503` responses remain failures.

## 2026-09-01 production checkpoint — CR-27 database/deployment/live boundary

### Production database gate

- Owner approval already covered read-only preflight, only migration `0036`, exact verified-runtime deployment and CR-27 live boundary proof.
- Exact one-time runner head: `2c7da6528dfde7f5c87e6585fbe578bfc7c83bf8`.
- GitHub Actions run `33508570582`, rerun migration job `99911484696`: **PASS**.
- Preflight: `issues=present artwork_objects=present-compatible`.
- Postflight: `artwork_objects=already-compatible index=present`.
- `DATABASE_URL` was present only as a masked GitHub Actions secret; no credential value entered chat or repository history.
- The helper executed only the approved idempotent `0036` path. Production already satisfied the schema contract, so no destructive/backfill change was required.
- Referral migrations `0029`, `0034`, `0035` remain unapplied/unapproved.

### Hostinger provider truth and exact-tree deployment

- Fresh live evidence proved the actual linked branch is `release/hostinger-v2-candidate-20260824`; candidate naming alone must never again be treated as deployment linkage truth.
- The live branch now serves release `28ff7deb6b1fe7578c271131f1655fc46898cefd`.
- That release has exact tree `c60126214c2de88731b912c6bdee26b7769d8fd4`, byte-identical to verified runtime integration `6b64b3b000cff18db2ac27b8c5494b0c72670211`.
- Hostinger selected-branch configuration and production environment variables were not changed.

### Strict live boundary/security proof

Initial Hostinger audit run `33525915578`, job `99916597942`, correctly proved release identity but exposed a stale test assumption: Safepay webhook, Printful webhook and payment-create routes were returning their intentional fail-closed provider-unavailable `503` states while the harness required `401/409` even though those providers are not production-armed.

TDD RED -> GREEN correction:

- RED: run `33525915578` failed exactly the three stale expectations.
- Isolated proof PR #78 was never merged and could not deploy production.
- GREEN live proof: run `33527773379`, job `99922906669`.
- `LIVE_RELEASE_HEALTH_PASS provider=hostinger release=28ff7deb6b1fe7578c271131f1655fc46898cefd version=0.1.0`.
- `/api/webhooks/safepay`: exact `503` safe body `Payment webhook is unavailable` -> PASS.
- `/api/webhooks/printful`: exact `503` safe body `Manufacturing webhook is unavailable` -> PASS.
- `/api/payments/create`: exact `503` safe body `Payment is unavailable` -> PASS.
- Bare-home HSTS, nosniff, DENY frame policy, referrer policy, permissions policy, `no-store`, no `s-maxage`, no `x-powered-by` -> PASS.
- Forbidden secret/config marker scan -> PASS.
- Public pages, release health, Issue status, artwork auth, owner/internal auth/retired routes, support, shipping and referral boundaries -> PASS.
- Permanent regression PR #79 changed only `tests/e2e/live-non-otp-boundaries.mjs`; exact-head CI run `33528245008` and Browser QA run `33528245001` passed; merge `3398a55399b747553bbce9d0bf9bdf820e5d4e14`.

### CR-27 conclusion

The database gate, exact verified runtime **tree** deployment, Hostinger release identity and strict live security/cache/non-OTP boundary proof are complete. `CR-27` is now `OWNER_REQUIRED` only for canonical-domain cutover/live proof because the existing approval explicitly excluded DNS/domain mutation. This does not block safe work on other CR rows.

## Current audited product state

| ID | Consumer promise / operational contract | Current state | Remaining completion evidence |
|---|---|---|---|
| CR-01 | Seven randomized questions, one per required family, immutable per experience | CODE_READY | live full seven-question customer smoke on deployed tree |
| CR-02 | Raw answers/private data encrypted at rest and isolated between customers | CODE_READY | two-customer isolation gate on exact deployed tree |
| CR-03 | TEE/CAP/TOTE selection, size/base, frozen variant and price | CODE_READY | owner-published production catalog + live three-form smoke |
| CR-04 | Email OTP verification with rate limits, expiry, single use and privacy | CODE_READY | real Resend OTP receipt + verification on deployed tree |
| CR-05 | Destination-aware shipping without globally requiring non-applicable fields | CODE_READY | controlled live valid-address save; current boundary already proves DB runtime reaches state logic |
| CR-06 | Safepay checkout starts only from complete verified commercial state | OWNER_REQUIRED | production provider credentials/arming plus signed safe checkout proof; no real QA charge without explicit approval |
| CR-07 | Browser return cannot forge paid truth; verified customer reaches their Issue | CODE_READY | controlled provider-backed paid-return proof after Safepay gate |
| CR-08 | One canonical Issue per paid attempt with immutable commercial snapshot | CODE_READY | real/controlled paid attempt + duplicate callback proof |
| CR-09 | Cross-device Issue recovery uses Issue Code + verified contact challenge | CODE_READY | deployed cross-device + real OTP proof |
| CR-10 | Customer status shows safe lifecycle/tracking without private leakage | CODE_READY | recovery-linked live status + shipment projection proof |
| CR-11 | In-Issue encrypted customer support reaches Owner OS | CODE_READY | deployed customer request -> owner desk -> owner reply proof |
| CR-12 | Lifecycle emails are idempotent and deliver from verified sender | CODE_READY | real PAYMENT_RECEIVED/IN_PRODUCTION/SHIPPED/DELIVERED email proof |
| CR-13 | AI interpretation/artwork generation is provider-backed, private and replaceable | CODE_READY | real supported-provider candidate proof |
| CR-14 | Artwork gate validates an actually printable transparent PNG | CODE_READY | real selected-template/placement/effective-DPI proof |
| CR-15 | Artwork is durably retained across redeploy/restart | CODE_READY | `0036` production schema is verified; still prove a controlled private object survives destructive restart/redeploy with integrity intact |
| CR-16 | Owner design review/regenerate/upload/approve is audited and private | CODE_READY | deployed Owner OS proof on controlled Issue |
| CR-17 | Catalog cannot sell a variant without factory mapping | CODE_READY | deployed Owner OS publish rejection proof |
| CR-18 | Boot/default catalog cannot silently become production commercial truth | CODE_READY | owner-published production catalog + readiness/live quote proof |
| CR-19 | Printful draft creation is exact, idempotent and cannot auto-charge | CODE_READY | real controlled Printful draft proof; confirmation remains separate owner gate |
| CR-20 | Printful production confirmation requires owner + kill switch + typed Issue | OWNER_REQUIRED | deliberate first production confirmation proof only when owner authorizes charge |
| CR-21 | Signed Printful events update lifecycle truth idempotently without cross-link | CODE_READY | real signed webhook/shipment proof + duplicate/cross-link proof |
| CR-22 | Refund truth is provider-derived with an operational owner reconciliation path | OWNER_REQUIRED | one controlled real full Safepay refund and application reconciliation proof |
| CR-23 | Owner OS views are bounded, paginated and privacy-preserving | CODE_READY | deployed Owner OS browser + scale/query gate |
| CR-24 | Readiness mirrors every real runtime requirement | DONE | exact-head runtime/readiness parity regression already green |
| CR-25 | Unknown exceptions never serialize private/provider/database details into logs | DONE | structural route sentinel class + exact-head/post-merge gates already green |
| CR-26 | Merchant name/support address/truthful location/legal disclosure before public launch | OWNER_REQUIRED | truthful owner-supplied production values + live page proof |
| CR-27 | Canonical domain serves exact verified release with strict security/cache boundaries | OWNER_REQUIRED | Hostinger release/tree/security proof complete; only canonical-domain cutover/live proof remains and was explicitly not authorized |
| CR-28 | Full commercial cycle from questions through payment, Issue, design, factory, tracking, support and recovery | MISSING | one controlled full live order + second isolated customer proof |
| CR-29 | Repeat-order reuse/fresh-answer flow preserves contact/profile boundaries | CODE_READY | deployed repeat-order browser proof after real paid Issue |
| CR-30 | Referral cannot affect checkout unless explicitly enabled and reverses safely | CODE_READY (launch-disabled) | only required before referral launch; migrations/outreach remain owner-gated |

## Locked implementation evidence that must not regress

- CR-05 destination-aware shipping integration: `1c92677008d85ca7ca6b1dec6cb6e922964bf6b0`.
- CR-24 runtime/readiness parity integration: `0263200e8dfb0f38e9995ec2e8b5fdc4a9728292`.
- CR-25 residual log privacy integration: `c4a895b5dfbdc7cb5c8391fc1d176a278ea01f61`.
- CR-07/CR-09 unified Issue access/recovery integration: `25495afe78efcb4d0cfebf8917eae1f152c5317f`.
- CR-11 encrypted Issue-scoped support integration: `6485e944e338091a742814c0c2da5354cc32fa4d`.
- CR-18 explicit production catalog authority integration: `8fd418dd09fea083e188c01e86e01fcaa57240bc`.
- CR-13/CR-14 provider/printable-image integration lineage: `0e16159ce9fb6410c551a3f8925e452523a5d798`.
- CR-15 durable artwork integration: `fc3be93445a3538cac473146df8557077c35a6ef`.
- CR-22 refund operations verified runtime integration: `6b64b3b000cff18db2ac27b8c5494b0c72670211`, tree `c60126214c2de88731b912c6bdee26b7769d8fd4`.
- CR-27 permanent fail-closed live audit regression: merge `3398a55399b747553bbce9d0bf9bdf820e5d4e14`.

## Standing safety and owner gates

The following remain prohibited without their specific owner gate even though other engineering work may continue:

- canonical-domain/DNS cutover;
- truthful merchant public location/legal identity values that only the owner can attest;
- real Safepay charge;
- real Safepay refund;
- Printful production confirmation/charge;
- referral production migrations `0029`, `0034`, `0035` and creator outreach;
- secret/key rotation;
- changing Hostinger selected branch or production environment configuration.

Core migration `0036` is no longer pending: production is verified `already-compatible` with the required index.

## Next safe execution order

1. Read-only check `issuedonce.shop` and `/api/health/release`; if it already routes to the proven release, record evidence without changing DNS. If not, leave CR-27 at its owner domain gate.
2. Continue safe live proofs that cannot charge, refund, confirm manufacturing, rotate secrets, activate referrals or mutate DNS.
3. Prioritize deployed customer behavior that can be proven with existing configuration: question flow, catalog/readiness truth where available, shipping/session boundaries, support boundaries and other non-charge paths.
4. Where a provider runtime is intentionally unavailable, preserve exact fail-closed behavior and record the missing owner/provider gate instead of weakening code or tests.
5. After explicit provider gates, prove OTP/Safepay/Printful/email flows in controlled stages.
6. Only after those provider proofs run CR-28: one complete controlled order plus a deliberately different second customer/session to prove no cross-customer data mixing.

## Live consumer acceptance sequence

The final commercial release gate must verify, on one coherent deployed release/tree:

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
11. owner reviews/rejects/regenerates/approves without leaking private answers by default;
12. Printful creates exactly one unconfirmed mapped draft;
13. production confirmation remains impossible unless owner deliberately arms and types the Issue confirmation;
14. signed manufacturing events update status/tracking idempotently;
15. customer recovers the Issue from a different browser/device using Issue Code + verified contact;
16. customer creates encrypted support from the Issue and owner replies;
17. a second customer with deliberately different answers/contact/address/variant never receives or affects first-customer data;
18. logs contain no raw customer/provider/database exception details throughout the cycle.

## Completion rule

ISSUED ONCE is `CONSUMER_READY` only when every launch-blocking row above is `DONE` or an explicitly documented `OWNER_REQUIRED` irreversible boundary, and the full commercial-cycle proof has executed on the same deployed release identity/tree. No percentage, green unit suite, preview screenshot, deployment compile or Owner OS label overrides this rule.
