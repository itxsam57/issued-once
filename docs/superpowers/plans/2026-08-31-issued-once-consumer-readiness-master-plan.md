# ISSUED ONCE Consumer Readiness Master Plan

Date: 2026-08-31
Original audited integration base: `ad9f388c33121b1225cc7a387b038940edfd389b`
Current reconciled integration head: `0e16159ce9fb6410c551a3f8925e452523a5d798`
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
| CR-05 | Shipping accepts valid destination data without globally requiring non-applicable fields | CODE_READY | country-aware/optional region + phone contract and regressions are integrated; live save proof still required |
| CR-06 | Safepay checkout starts only from complete verified commercial state | CODE_READY | readiness parity fix + signed sandbox/production checkout proof |
| CR-07 | Browser return never creates paid truth, but customer reaches their Issue after verified payment | CODE_READY | ownership-bound paid-return handoff and browser regressions are integrated; live paid return proof still required |
| CR-08 | One canonical Issue per paid attempt with immutable commercial snapshot | CODE_READY | real paid attempt + duplicate callback proof |
| CR-09 | Returning customer can access Issue from another browser/device using Issue Code + verified contact challenge | CODE_READY | accountless recovery, anti-enumeration and browser recovery are integrated; deployed cross-device + real OTP proof still required |
| CR-10 | Customer status shows safe lifecycle/tracking without private-data leakage | CODE_READY | recovery-linked live status + shipment projection proof |
| CR-11 | Public support can be opened from the customer Issue without relying only on mailto | CODE_READY | Issue-scoped support UI + encrypted request are integrated; deployed customer request -> owner reply proof still required |
| CR-12 | Customer lifecycle email notifications are idempotent and deliver from verified sender | CODE_READY | real PAYMENT_RECEIVED/IN_PRODUCTION/SHIPPED/DELIVERED email proof |
| CR-13 | AI interpretation and artwork generation are provider-backed, private and replaceable | CODE_READY | exact-head provider/runtime hardening is green; one real supported-provider generated candidate proof still required |
| CR-14 | Artwork quality gate proves an actually printable transparent PNG, not metadata alone | CODE_READY | decoded corruption/alpha/template/effective-DPI contract is exact-head green; real selected-template candidate proof still required |
| CR-15 | Generated artwork is durably retained across application redeploy/restart boundary | CODE_READY | durable Postgres/private-access/integrity regressions are exact-head green; apply `0036` only through the production-migration gate, then prove a real object survives destructive restart/redeploy |
| CR-16 | Owner reviews/approves/rejects/regenerates/uploads design with audited private-data reveals | CODE_READY | deployed Owner OS browser proof on a real controlled Issue |
| CR-17 | Catalog publication cannot sell a variant without a factory mapping | CODE_READY | exact-head regression + Owner OS publish rejection proof |
| CR-18 | Boot/default catalog never silently becomes accidental production commercial truth | CODE_READY | fail-closed owner-publication authority and readiness regression are integrated; deployed owner-published catalog + live quote/selection proof still required |
| CR-19 | Printful draft creation is exact, idempotent and cannot charge automatically | CODE_READY | real Printful draft proof on controlled Issue |
| CR-20 | Printful confirmation requires owner session + independent kill switch + exact typed Issue confirmation | CODE_READY | controlled owner confirmation proof when owner deliberately authorizes first charge |
| CR-21 | Signed Printful webhook updates production/shipped/delivered truth without cross-linking Issues | CODE_READY | real signed webhook/shipment proof + duplicate/cross-link regression |
| CR-22 | Refund truth is provider-derived and an owner has a documented operational resolution path | IN_PROGRESS | first-class owner refund/reconciliation workflow or explicit runbook + provider proof |
| CR-23 | Owner OS customer, Issue, support, sales, audit and recovery views are bounded, paginated and privacy-preserving | CODE_READY | deployed Owner OS browser proof + scale/query gate |
| CR-24 | Owner System readiness mirrors every real runtime requirement and cannot show false-positive provider readiness | DONE | runtime/readiness config parity is integrated and exact-head full gates are green, including Safepay API-secret requirement |
| CR-25 | Unknown exceptions never serialize private/provider/database details into server logs | DONE | complete route sentinel class is integrated and exact-head/post-merge full gates are green |
| CR-26 | Merchant name, support address and truthful public location/legal disclosure are configured before public launch | OWNER_REQUIRED | owner-supplied truthful production values + live page proof |
| CR-27 | Canonical domain serves exact integration release with required security/cache headers | CODE_READY | deploy current verified integration head + strict live boundary audit |
| CR-28 | Full commercial cycle works from seven answers through verified payment, Issue, design, Printful, tracking, support and customer recovery | MISSING | one controlled full live order plus a second isolated customer proof |
| CR-29 | Repeat-order reuse/fresh-answer flow preserves contact/profile boundaries | CODE_READY | deployed repeat-order browser proof after a real paid Issue |
| CR-30 | Referral feature cannot affect checkout unless explicitly enabled; enabled flow is reversible on refund/delivery lifecycle | CODE_READY (launch-disabled) | only required before referral launch; non-referral checkout must remain green |

## 2026-08-31 execution checkpoint

### CR-25 — residual log privacy

- Integration merge: `c4a895b5dfbdc7cb5c8391fc1d176a278ea01f61`.
- Result: repository-wide raw-exception logging class is structurally guarded by regression tests and passed post-merge CI + Browser QA.
- Production deployment/environment mutation: none.
- Master-plan state: `DONE` because this row's completion contract is code/integration evidence and no provider side effect is part of the promise.

### CR-05 — destination-aware shipping

- Integration merge: `1c92677008d85ca7ca6b1dec6cb6e922964bf6b0`.
- Shared contract: core delivery fields remain required; region is required only for US/CA/AU; phone is not globally required; empty optional Printful fields are omitted.
- Regression evidence: server, UI and Printful-boundary tests plus exact-head/post-merge CI + Browser QA passed.
- Remaining evidence: a live deployed valid-address save under the destination rules.
- Master-plan state: `CODE_READY`.

### CR-24 — Safepay readiness/runtime parity

- Integration merge: `0263200e8dfb0f38e9995ec2e8b5fdc4a9728292`.
- Readiness now consumes the same validated Safepay runtime configuration contract, including `SAFEPAY_API_SECRET` / `SAFEPAY_V1_SECRET` rather than an incomplete approximation.
- Exact-head and post-merge unit/typecheck/lint/production-build gates passed; Browser QA passed where applicable.
- Production deployment/environment mutation: none.
- Master-plan state: `DONE` for the readiness-parity contract; live Safepay transaction proof remains tracked by CR-06/CR-07, not this row.

### CR-07 + CR-09 — unified Issue access and recovery

- Feature branch: `feat/issue-access-recovery-20260831`.
- Draft PR #52 closed unmerged only because the connected GitHub ready-for-review mutation is broken by an upstream GraphQL schema mismatch; normal integration PR #53 carried the same branch.
- Final feature head: `daa59cbafa5f404287ee30dc06e9a55e7f39a432`.
- Integration merge: `25495afe78efcb4d0cfebf8917eae1f152c5317f`.
- Feature CI: run `33419182618` PASS — unit tests, typecheck, lint and production build.
- Feature Browser QA: run `33419182637` PASS — desktop/mobile browser tests.
- Post-merge CI: run `33419570168` PASS — unit tests, typecheck, lint and production build.
- Post-merge Browser QA: run `33419570255` PASS — desktop/mobile browser tests.
- Recovery security: Issue Code + normalized verified email + OTP; unknown/mismatched pairs stay challenge-shaped and non-enumerating; cross-Issue/stale/wrong challenges cannot rotate access.
- Long-lived access: a paid Issue can rotate its public session hash after the short interview TTL without renewing that TTL or reactivating expired interview/contact privileges.
- Payment-return security finding: provider tracker/payment truth alone is not browser-ownership proof. Final implementation requires the caller's current Issue session and uses atomic compare-and-swap session rotation before setting a fresh cookie; leaked/forwarded tracker URLs cannot mint store access.
- Pending customers stay on the live Issue polling/recovery surface instead of a home-page dead end.
- Remaining CR-07 proof: controlled deployed paid-return evidence.
- Remaining CR-09 proof: deployed cross-device recovery with real OTP delivery/verification.
- Production deployment/environment mutation: none.
- Master-plan state: both `CODE_READY`.

### CR-11 — encrypted Issue-scoped customer support

- Feature branch: `feat/cr-11-in-app-support`.
- Draft PR #56 closed unmerged only because the connected GitHub draft-to-ready GraphQL mutation is broken; normal integration PR #57 carried the same exact reviewed head/base.
- Final feature head: `d3f4c5bc34741d8bcddd8b7d897a8d4590af8e6d`.
- Integration merge: `6485e944e338091a742814c0c2da5354cc32fa4d`.
- TDD RED evidence: CI run `33426961266` failed only because `IssueSupportForm` did not exist; tightened RED CI `33427358886` failed the new UI/reference contract; Browser QA `33427358895` failed the new support flow on desktop/mobile while unrelated coverage stayed green aside from one passing retry.
- Final feature CI: run `33428181290` PASS — unit tests, typecheck, lint and production build.
- Final feature Browser QA: run `33428181278` PASS — desktop/mobile support flow.
- Normal-PR wrapper CI: run `33428592576` PASS.
- Normal-PR wrapper Browser QA: run `33428592448` PASS.
- Post-merge CI: run `33428935199` PASS on exact integration SHA.
- Post-merge Browser QA: run `33428935165` PASS on exact integration SHA.
- Customer flow: current/recovered Issue access exposes a reason + free-text support form, reuses the existing encrypted SupportService, and shows the generated support request UUID as an opaque reference.
- Privacy: support POST no longer returns Issue Code; generic failure UI does not expose backend/provider/database details.
- Remaining evidence: deploy the exact integrated release, create a controlled customer support request, observe it in the owner support desk, and complete an owner reply without leaking another customer's data.
- Production deployment/environment mutation: none.
- Master-plan state: `CODE_READY`.

### CR-18 — explicit production catalog authority

- Feature branch: `feat/cr-18-catalog-authority`.
- Final feature head: `43008c64fa7cc1d73d4a9b343d53819e48df6905`.
- Integration PR: #59.
- Integration merge: `8fd418dd09fea083e188c01e86e01fcaa57240bc`.
- TDD RED evidence: `9620bdd750971994a9792b77f0938cf3ab864ce3` proved missing ACTIVE publication still allowed boot/default commercial truth and readiness lacked `catalog_authority`; `a67207b17a6387e0e56171935a025b59e2a2d45b` moved the invariant to the shared Postgres catalog/quote boundary rather than a checkout-only patch.
- Final PR merge-ref CI: run `33438840018` PASS — 222 test files / 656 tests, typecheck, lint with 0 errors and 5 pre-existing warnings, production build.
- Tree verification: synthetic PR merge `5654c41f3768a2acaf208a40bc8ea2d754ca753d` and actual integration merge `8fd418dd09fea083e188c01e86e01fcaa57240bc` share exact tree `ca99250c755ab9712f5c9117736ae963abd4351d`.
- Shared authority contract: missing ACTIVE owner publication fails closed before Postgres-backed catalog variants can become commercial truth; an explicitly published empty catalog remains authoritative and does not fall back to boot defaults.
- Readiness contract: `catalog_authority` is a mandatory blocking probe and uses a read-only ACTIVE-publication query.
- Preview/dev continuity: visual preview remains on `PreviewCatalogGateway`; CR-18 does not move boot defaults into preview production authority.
- Browser QA: not triggered by repository path policy because CR-18 changed backend-only files.
- External preview note: Vercel deployment failure was also present on the prior CR-11 green head, including hobby-plan build-rate limiting; it is not a CR-18 regression and production remains Hostinger.
- Remaining evidence: deploy the exact integrated release, publish/confirm an owner-authorized production catalog, observe `catalog_authority` GREEN, and prove the live quote/selection path uses that publication rather than boot defaults.
- Production deployment/environment mutation: none.
- Master-plan state: `CODE_READY`.

### CR-13 + CR-14 — provider-backed printable artwork contract

- Feature branch: `feat/cr-13-artwork-rendering`.
- Draft integration PR: #61; normal integration PR #63 carried the verified feature tree after the draft-to-ready connector mutation failed.
- RED head: `4d44c80b2a39c99d9d78066faf01d81000d2933a`; focused tests proved fully opaque provider/manual-upload PNGs and mismatched/under-DPI physical templates were still accepted before the production fix.
- RED CI: run `33470739855` failed the intentional unit slice on the exact test-only head.
- Implementation head: `e62e808f7816a1f87231a328361bfabd3f532091`.
- Final feature head: `18c8f4948b4fca6d2ecd788401b9ff8853072586`; integration merge: `405c8f3eb84a879d23c848616d3bfe8a5f159001`; reconciliation merge: `0e16159ce9fb6410c551a3f8925e452523a5d798`.
- Exact implementation CI: run `33478836227`, job `99763722261` PASS — unit tests, typecheck, lint and production build. Final feature and wrapper heads were independently reverified before integration.
- Actual-image contract: PNG bytes are signature/chunk/CRC/IHDR/IDAT/raster validated; scanlines are reconstructed for PNG filters 0-4 and Adam7; real transparency is detected from alpha samples or valid `tRNS` semantics rather than provider metadata.
- Ingress contract: both OpenAI artwork generation and owner manual upload fail closed when the decoded image is fully opaque.
- Manufacturing contract: approval resolves the exact selected `objectType:sizeCode:colorCode` through `PrintfulVariantMap`, calculates effective DPI from actual artwork dimensions and the mapped placement, rejects a mismatched/under-target template, and stores `template:*` plus `effective-dpi:*` in the existing audited `DESIGN_APPROVED` issue event.
- Runtime boundary: `PRINTFUL_VARIANT_MAP_JSON` remains lazy at manufacturing approval, so interpretation/generation does not acquire an eager factory configuration dependency.
- Browser QA: not required by repository path policy because the cycle changes backend/design runtime and tests, not customer/owner UI surfaces.
- Remaining CR-13 evidence: one real candidate generated through the currently supported production OpenAI contract without exposing private answers.
- Remaining CR-14 evidence: the real candidate must pass the actual selected Printful placement/template and printable transparency/effective-DPI proof end to end.
- Production deployment/environment/provider/factory mutation: none.
- Master-plan state: both `CODE_READY`; neither is `DONE` until the live/provider evidence above exists.

### CR-15 — durable private artwork retention across redeploys

- Feature branch: `feat/cr-15-durable-artwork-storage`; integration PR: #65.
- TDD RED heads: `490182a764d57083e9eab04633ee799b966438e9`, `5851b60f8f4c8e0cdd735dde0b7bcddcdc872fd4`, and final RED boundary `223bbf80a9ba189e1f7af3c41e2887f2a7ce7730`.
- RED evidence: CI run `33485518958`, job `99784566127` failed the intended new durability/access/approval/readiness regressions while unrelated coverage remained green.
- Implementation lineage: `1ddbda386e029fdeb8329e2929e1e51cd0244ac6` -> realm-safe BYTEA decode fix `fce1d01ea09ec6b71bbe3201fa8985a141701ea1` -> type-contract head `c0222229633af667983330fb52822eec1a1211f3`.
- Exact code-head CI: run `33487241096`, job `99790082709` PASS — 226 test files / 674 tests, typecheck, lint and production build.
- Exact code-head Browser QA: run `33487241103`, job `99790082471` PASS — browser tests and visual-evidence upload; live preview/production journey remained intentionally skipped by workflow conditions.
- Durable authority: generated and owner-uploaded PNG bytes now use the existing Neon/Postgres authority through `PostgresArtworkStorage`; production runtime no longer composes `FilesystemArtworkStorage` or requires `ARTWORK_STORAGE_DIR` for artwork retention.
- Private locator/access contract: canonical metadata stores only `artwork://<issue>/<artifact>` locators; external factory reads use bounded same-app signed `/api/artwork/<token>` URLs, and the durable raw locator is not exposed as a public object URL.
- Integrity contract: durable reads revalidate canonical locator, PNG MIME, byte count and SHA-256; missing or corrupt objects fail closed. Manufacturing approval reopens the durable object and rejects metadata-only/mismatched records before approval.
- Readiness contract: storage readiness verifies the durable Postgres relation plus signing/origin safety instead of probing deployment-local disk.
- Schema: `0036_durable_artwork_objects.sql` is repository/code-ready only. **It has not been applied to production.** Referral migrations remain separately deferred and untouched.
- Remaining CR-15 evidence before `DONE`: integrate this verified PR; obtain the explicit production-migration approval for `0036`; preflight/apply only that approved core migration; perform a controlled private durable write/read and destructive application restart/redeploy; prove the same bytes remain retrievable and integrity-checked afterward on the deployed release identity.
- Production deployment/environment/provider/factory mutation: none.
- Master-plan state: `CODE_READY`, not `DONE`.

## Audit findings that must remain in scope

### A. Post-payment handoff and recovery

**Code-side root cause resolved at integration `25495afe78efcb4d0cfebf8917eae1f152c5317f`; live proof remains.**

One accountless Issue-access capability now owns both lost-session recovery and post-payment handoff. The existing `__Host-io_session` remains the only public Issue credential. Explicit recovery requires Issue Code + verified email + OTP and stays anti-enumerating before proof. Payment return still treats browser navigation as non-authoritative; payment can finalize only from Reporter-backed truth, and the browser receives refreshed Issue access only when its current session atomically matches the paid Issue's experience.

Remaining completion target: deployed paid-return proof plus real cross-device OTP recovery.

### B. Readiness parity

**Resolved at integration `0263200e8dfb0f38e9995ec2e8b5fdc4a9728292`.**

Readiness and payment runtime now share the validated Safepay configuration contract, including the API-secret requirement. Future provider additions must follow the same single-source validator pattern rather than duplicate environment approximations.

### C. Shipping applicability

**Code-side resolved at integration `1c92677008d85ca7ca6b1dec6cb6e922964bf6b0`; live save proof remains.**

Server validation and customer form share destination-aware requirements. Region is required only where the provider requires it (US/CA/AU), phone is not globally mandatory, and provider serialization omits blank optional fields.

### D. Production catalog authority

**Code-side root cause resolved at integration `8fd418dd09fea083e188c01e86e01fcaa57240bc`; deployed owner-publication proof remains.**

Postgres-backed production catalog access now refuses to treat boot/default entries as commercial truth when there is no ACTIVE owner publication. An explicit empty publication remains authoritative rather than silently falling back. Owner readiness uses the same production rule through a blocking `catalog_authority` probe, while visual preview remains on its dedicated preview catalog path.

Remaining completion target: deploy the exact integrated release, confirm an owner-published production catalog, observe readiness GREEN and prove live quote/selection comes from that publication.

### E. Artwork provider, quality and durability

**Code-side CR-13/CR-14 is integrated through `0e16159ce9fb6410c551a3f8925e452523a5d798`; CR-15 durable storage is exact-head green on `c0222229633af667983330fb52822eec1a1211f3` pending integration.**

The design pipeline validates the actual decoded PNG rather than trusting requested background metadata, requires real transparent pixels at both automated and manual ingress, binds manufacturing approval to the exact selected Printful template with calculated effective DPI and audited evidence, and now reopens integrity-checked Postgres-backed artwork instead of trusting deployment-local filesystem metadata.

Remaining completion target: integrate CR-15; apply `0036` only through its explicit production-migration gate; prove destructive deployed restart/redeploy retention; then run one real supported-provider generation plus actual selected-template/placement proof. These live/provider proofs remain distinct from code readiness.

### F. Public support

**Code-side resolved at integration `6485e944e338091a742814c0c2da5354cc32fa4d`; deployed owner-reply proof remains.**

Current/recovered Issue access now exposes the encrypted support path directly. The customer selects a reason, enters free text, the existing encrypted SupportService persists the Issue-scoped request, and the response surfaces only the generated opaque request UUID rather than the Issue Code. Owner OS support behavior remains the operational reply/close/retry desk.

Remaining completion target: deployed customer request -> owner desk receipt -> owner reply proof on the exact deployed release.

### G. Refund operations

Refund events are reconciled from provider truth, but Owner OS does not yet provide a first-class refund initiation/reconciliation workflow. Do not invent browser refund truth.

Root-cause completion target: either implement a verified provider refund operation through the payment adapter or explicitly bind the owner runbook to provider-dashboard refund initiation and automatic webhook reconciliation for MVP.

### H. Residual log privacy

**Resolved as an audited code class at integration `c4a895b5dfbdc7cb5c8391fc1d176a278ea01f61`.**

Unknown caught exceptions in audited public/owner routes retain stable event names without serializing raw exception objects or customer lookup inputs. Keep the structural/sentinel regressions mandatory for future routes; any newly discovered response-body leakage remains a separate defect class and must not be hidden under this completed logging row.

### I. Live proof gap

The migration-branch Browser QA runs with visual preview and is not real provider proof. The existing production smoke reaches real OTP request only; it does not verify OTP, shipping, Safepay payment, Issue creation, design, Printful, tracking, support or cross-device recovery.

Root-cause completion target: expand controlled live QA in stages. Never charge or confirm Printful without the independent owner gate. All non-charge live behaviors should be automated where provider credentials permit.

## Execution order from this audit

1. `CR-25` residual API log privacy — **completed and integrated**.
2. `CR-24` runtime/readiness parity — **completed and integrated**.
3. `CR-05` destination-aware shipping — **code-ready and integrated; live save proof pending**.
4. `CR-07` + `CR-09` unified Issue access/recovery — **code-ready and integrated; deployed paid-return/real-OTP proof pending**.
5. `CR-11` encrypted Issue-scoped customer support — **code-ready and integrated; deployed owner-reply proof pending**.
6. `CR-18` require explicit production catalog authority — **code-ready and integrated; deployed owner-published catalog proof pending**.
7. `CR-13` + `CR-14` current provider + actual printable-image contract — **code-ready and integrated; live/provider candidate proof pending**.
8. `CR-15` durable artwork retention — **code-ready on PR #65; integrate next; production `0036` + destructive deployed recovery proof remain owner/live-gated**.
9. `CR-22` finish refund operations/runbook truth after CR-15 code integration; CR-15 live proof can execute at the approved deployment/migration gate.
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
