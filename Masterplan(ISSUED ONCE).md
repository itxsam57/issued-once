# Masterplan(ISSUED ONCE)

**Project:** ISSUED ONCE  
**Canonical role:** enduring product constitution, engineering backbone, and continuous-build blueprint  
**Adopted:** 2026-09-03  
**Repository:** `itxsam57/issued-once`

> This document defines what ISSUED ONCE is, what must remain true while it is built, and how future work is allowed to change it. It is intentionally separate from release evidence, operational runbooks, and historical implementation plans.

---

## 0. How to use this document

Every engineer or agent changing ISSUED ONCE must read, in order:

1. `Masterplan(ISSUED ONCE).md` — enduring product and architecture authority.
2. `docs/superpowers/plans/2026-08-31-issued-once-consumer-readiness-master-plan.md` — dynamic consumer-readiness/evidence ledger.
3. The current design spec/runbook for the subsystem being changed.
4. `.engineering/CONTINUATION.json` — current execution checkpoint and owner/external gates.
5. Current accepted code and tests on the active integration line.

This file must **not** be used to fake readiness. A feature can be required by this Masterplan while still being `CODE_READY`, `MISSING`, `OWNER_REQUIRED`, or otherwise unfinished in the readiness ledger.

### Authority and conflict precedence

When two sources disagree, resolve them in this order:

1. A later explicit owner-approved decision/amendment.
2. This Masterplan after it has been updated to record that decision.
3. Current accepted/merged design specs that implement the same decision.
4. Current accepted code and regression contracts.
5. The consumer-readiness/evidence ledger for readiness state.
6. Operational runbooks for execution procedure.
7. Historical plans/specs/notes for provenance only.

A proposal, brainstorm, abandoned provider path, old branch pointer, stale price fixture, or unmerged experiment is never allowed to silently become product truth.

If an accepted owner decision changes this document, the Masterplan must be updated in the same work cycle or the change remains incomplete.

---

## 1. Audited repository snapshot at adoption

This Masterplan was reconciled against the repository and project history available on 2026-09-03.

- Active integration line at audit: `infra/hostinger-migration-20260823`
- Audited integration HEAD: `c51864ad5868cc9d84f57b99794b6223049fca6e`
- Deployed/default release line at audit: `release/hostinger-v2-candidate-20260824`
- Audited deployed release HEAD: `28ff7deb6b1fe7578c271131f1655fc46898cefd`
- Planned canonical domain: `issuedonce.shop`
- `feat/mystery-foundation` is an important historical foundation branch, but its branch pointer is not the current integration authority at this snapshot.

Branch names and SHAs are operational facts, not eternal product rules. The product invariants in this Masterplan survive branch, host, payment-provider, image-provider, and manufacturer changes.

---

## 2. Product identity

ISSUED ONCE is a **privacy-first mystery issuance experience**, not a conventional browse-first merchandise store.

A person gives seven private signals. ISSUED ONCE interprets those signals into an original visual, binds the resulting commercial truth to one canonical Issue, and carries that Issue through payment, artwork, controlled manufacturing, delivery, support, recovery, and later repeat-order lifecycle.

The experience should feel scarce, deliberate, private, premium, and mysterious without becoming confusing or dishonest.

### Non-negotiable product principles

- The entrance remains mystery-first. Do not turn the homepage into a normal catalog, gallery, “mood shop,” or marketplace.
- The seven-question experience is the creative identity spine.
- Answers are signals for interpretation, not instructions for a literal collage.
- A visualization is issued into a physical form; the physical item is not allowed to reduce the experience to ordinary merch shopping.
- The system does not publicly expose a customer's private transformation.
- No stealth edits to customer answers.
- No fake success states.
- No public sales-sequence leakage through Issue codes.
- No automatic factory production from payment alone.
- No raw questionnaire answers in logs, analytics, payment metadata, manufacturing metadata, public Issue data, or referral URLs.
- No gamification layer that changes the core experience into points, streaks, rankings, or public competition unless the owner explicitly amends this Masterplan.

---

## 3. Canonical customer lifecycle

The intended commercial lifecycle is:

`BEGIN`
→ seven randomized questions
→ profile complete / `WE HAVE ENOUGH.`
→ select current sellable form
→ select supported size where applicable
→ select supported base/color
→ enter email
→ verify contact or explicitly reuse proven same-browser verification on a repeat order
→ enter destination-aware shipping details
→ server computes authoritative quote and verifies factory availability
→ customer reviews commitment
→ Safepay hosted checkout
→ server-authenticated payment truth
→ exactly one canonical Issue
→ durable design job
→ private interpretation
→ artwork candidate
→ printable-artwork quality gate
→ Owner design review/approve/reject/regenerate/upload
→ exact Printful draft
→ explicit Owner manufacturing confirmation
→ fulfillment lifecycle
→ shipment/tracking
→ private Issue status/support/recovery
→ optional repeat-order and referral paths under their own rules.

Each transition must be idempotent where replay is possible and fail closed at expensive, private, or irreversible boundaries.

---

## 4. Seven-question Question Vault

### Required structure

Every fresh creative profile receives exactly seven questions: one from each required design-signal family.

Current required families:

1. culture/reference
2. place/environment
3. rhythm/time/energy
4. identity/self-perception
5. music/sensory association
6. aesthetic boundary/aversion
7. wildcard/personal texture

The established initial vault contains ten curated active prompts per family: seventy questions total. Balanced one-per-family assignment yields 10,000,000 possible seven-question combinations before future vault expansion.

### Identity and persistence rules

- Every question has an immutable question ID, version, family, answer mode/kind, active/retired state, and any bounded weighting/safety metadata.
- The chosen seven question IDs are persisted when the Experience is created.
- Refresh, reconnect, or resume must not reshuffle an existing Experience.
- A stored answer remains semantically bound to the exact question snapshot/version it answered.
- Question retirement cannot rewrite historical Experiences.
- Question weighting/optimization may evolve only without breaking one-per-family coverage or historical identity.
- Raw answer plaintext is never needed merely to identify which questions were asked.

---

## 5. Experience, answer, and privacy model

### Experience

An `Experience` is the private progression container for one order attempt/profile lifecycle. It is not a public customer account.

The system may link safe continuity between Experiences, but one order's mutable state must never be achieved by resetting or mutating a prior order's completed commercial record.

### Answers

- Raw answers are encrypted at rest.
- Answers stay attached to their Experience/profile boundary rather than being copied into payment, Issue, referral, or manufacturing metadata.
- Reuse of a previous profile copies the already-encrypted answer payloads and exact question snapshots without decrypting plaintext.
- Artwork generation may decrypt only through the intended private design-worker boundary.
- Owner access to raw answers, when available, is explicit, reason-gated, bounded, and audited; hidden by default.
- Browser bootstrap and public APIs do not return old answer plaintext.
- Unknown exceptions must not serialize answer/provider/database detail into logs.

### Analytics

Allowed analytics are privacy-safe operational facts such as stage completion, latency, safe failure category, and aggregate conversion. Raw answer text, verified email, address, OTP, session credentials, provider secrets, or private artwork interpretation do not belong in analytics.

---

## 6. Current commercial forms, catalog, and price truth

### Current sellable forms

The current commercial forms are:

- `TEE`
- `CAP` / Hat
- `TOTE`

Older notes/spec examples that mention a hoodie do **not** make hoodie currently sellable. Hoodie is a deferred/future form until the owner explicitly publishes it through the same catalog/factory authority and updates this Masterplan/readiness evidence.

### Catalog authority

ISSUED ONCE owns the canonical product/catalog/pricing truth.

- Browser input is never product, variant, availability, or price authority.
- A production quote is computed server-side.
- Product/form, size, base/color, gross/final amount, currency, discount snapshot where applicable, and factory mapping are frozen before checkout.
- Missing or inactive production catalog publication fails closed.
- Boot/default catalog data must never silently become production commercial truth.
- An explicitly published empty production catalog is authoritative and must not fall back to defaults.
- A variant cannot be sold unless an exact active factory mapping exists.
- Preview/dev fixtures are not production catalog authority.
- Test fixture prices are not automatically production prices; Owner OS publication is authoritative.

Current implementation/test history has used Tee/Hat/Tote values, but price amounts are mutable Owner-controlled commercial configuration, not eternal Masterplan constants.

---

## 7. Contact verification and continuity

ISSUED ONCE remains accountless for the current product model. Verified email/contact is the primary customer verification boundary.

### Fresh verification

The OTP system must provide:

- six-digit or equivalent one-time code;
- hashed OTP storage, never persisted plaintext;
- short expiration;
- resend cooldown;
- attempt limit;
- rate limiting;
- single-use verification;
- safe error distinctions/recovery;
- audit timestamps;
- encrypted verified email at rest;
- normalized one-way lookup hash only where needed for lookup/dedup/self-referral defense.

OTP messages include a non-secret request tag so a customer can match the active browser challenge to the correct email. A newer challenge invalidates the previous active challenge.

### Repeat-order contact continuity

A repeat order never silently inherits or activates a verified email.

The customer always enters the email intended for that order.

If and only if:
- the normalized email matches the immediately preceding verified email, **and**
- the same browser holds valid cryptographic continuity proof bound to the new child Experience,

the UI may state `THIS EMAIL IS ALREADY VERIFIED.` and offer:

- `USE THIS EMAIL`
- `CHANGE EMAIL`

`USE THIS EMAIL` creates/reuses a new verified-contact record for the child only after server verification of the continuity proof and matching email hash. A different email, missing/expired proof, or legacy child without proof requires a fresh OTP.

Knowing another person's email address is never sufficient to bypass verification.

Shipping is not silently reused through this mechanism.

---

## 8. Shipping and private delivery data

ISSUED ONCE collects the destination details required for fulfillment because the main site owns the customer experience.

- Recipient and address data are encrypted at rest.
- Required fields are destination-aware; globally non-applicable fields must not be required.
- Region/state is required only where destination rules require it.
- Phone is collected only where carrier/destination requirements justify it.
- Empty optional manufacturing fields are omitted rather than fabricated.
- Shipping data is exposed to Printful only when required for a paid manufacturing job.
- Shipping data never belongs in public Issue output, referral attribution, analytics, or logs.
- Address changes after paid truth require an explicit controlled state transition/audit; never silently rewrite the paid commercial snapshot.

---

## 9. Payment boundary and money truth

Safepay is the current launch payment adapter, not the core product.

### ISSUED ONCE owns

- quote/price truth;
- commercial selection;
- payment-attempt identity;
- contact/shipping relationship;
- Issue identity;
- idempotent reconciliation;
- design/manufacturing lifecycle;
- refund projection.

### Safepay owns

- hosted payment collection/authorization/capture;
- provider transaction/tracker/reference;
- authenticated payment/refund state.

### Payment invariants

- Checkout starts only from a complete, server-verified commercial state.
- Safepay receives only the final frozen amount and opaque ISSUED ONCE identifiers needed for correlation.
- Raw answers are never payment metadata.
- Browser return/navigation/success pages are **not payment truth**.
- `PAID` requires authenticated server-side Safepay webhook/API/Reporter evidence reconciled to the stored payment attempt.
- Duplicate callbacks and retries are idempotent.
- Amount/currency mismatch becomes an exception, not paid truth.
- One verified paid attempt creates at most one canonical Issue.
- A future migration from Safepay to another gateway (for example Stripe) is an adapter change, not a rewrite of Question Vault, Issue, design, support, or manufacturing semantics.

---

## 10. Canonical Issue identity

The Issue is the durable product/commercial identity.

### Identity rules

- One canonical Issue per verified paid attempt.
- Internal UUIDs remain system authority; the Issue Code is a human-safe lookup key.
- Issue Codes are high-entropy, non-sequential, and do not reveal sales volume or chronology.
- An Issue Code is permanent and never reused.
- The paid commercial snapshot is immutable: exact form, variant mapping, size, base/color, amount/currency, contact/shipping references, payment reference, and source Experience/profile relationship.
- Duplicate provider delivery, concurrency, retry, or collision must never create a second commercial Issue.
- Later replacement of a damaged/failed physical unit does not silently mint a second commercial identity; replacement semantics attach to the existing Issue unless an owner-approved future rule explicitly changes this.

### Public/private projection

Customer/public Issue surfaces may expose safe facts such as:

- Issue Code;
- current customer-facing lifecycle state;
- form;
- size where applicable;
- base/color;
- tracking/shipment state.

They must not expose:

- raw answers;
- customer email/name/address;
- payment secrets/card information;
- provider internal IDs unless explicitly safe/necessary;
- quote/session credentials;
- private artwork interpretation;
- owner-only audit data.

---

## 11. Design interpretation and artwork generation

A paid Issue creates a durable design job. Unpaid Experiences do not trigger paid manufacturing design work by default.

### Creative rule

The design system interprets the seven signals into an original visual language. It should avoid simply illustrating each answer literally.

The private generation boundary receives the minimum transformed/structured brief and physical constraints required for creation; it must not spray the customer's whole history into third-party provider metadata or logs.

### Provider boundary

Artwork generation is provider-backed and replaceable. The domain model must survive a change of model/provider.

For reproducibility/audit where supported, generation metadata should retain safe versioning such as interpretation/prompt-template version, physical placement/template version, provider/model version, and deterministic seed/settings where the provider supports them. This metadata must not reveal raw private answers publicly.

### Durable artwork

Approved/generated production artwork is durable private data, not deployment-local temporary state.

Current architecture uses private durable storage with canonical internal artwork locators and bounded signed same-application access for manufacturing reads. Redeploy/restart must not destroy Issue artwork.

### Quality gate

Artwork is not production-ready merely because an image exists.

Before manufacturing approval, validate at least:

- artwork belongs to the same Issue/version;
- valid PNG structure and decodable raster;
- actual transparency where the selected print contract requires it;
- non-corrupt/non-empty bytes;
- dimensions;
- selected product/variant/template match;
- placement bounds;
- effective DPI / manufacturing-quality threshold;
- durable-object integrity;
- payment state;
- no already-confirmed duplicate manufacturing request.

The quality gate fails closed.

---

## 12. Owner design control

Owner OS is the controlled human authority over final production artwork.

For each eligible Issue, Owner OS supports bounded, audited actions to:

- inspect safe Issue context;
- explicitly reveal private design inputs only through the approved reason-gated path;
- review candidate artwork;
- approve;
- reject;
- regenerate;
- upload/replace a candidate;
- observe quality/manufacturing validation state.

Every action that changes design truth is tied to the Issue, actor/session, time, version, and audit trail.

A customer's private answers are not displayed by default merely because an owner opened the Issue.

---

## 13. Manufacturing boundary

Printful is the current manufacturer adapter.

### Draft creation

For a paid, design-approved Issue, the system creates or recovers one exact idempotent Printful draft using:

- external Issue reference;
- exact mapped Printful variant;
- quantity;
- approved final production artwork;
- exact placement/specification;
- required recipient/shipping data.

Printful never receives the seven raw answers.

### No automatic production

Payment alone must never charge/confirm Printful production.

Production confirmation requires all independent gates in force, including:

1. authenticated Owner session;
2. independent production enable/kill-switch configuration;
3. exact typed Issue confirmation;
4. eligible paid/design-approved/manufacturing-draft state;
5. exact variant/artwork/shipping quality validation;
6. idempotency protection.

If any gate is missing, confirmation fails closed.

### Fulfillment events

Signed/authenticated Printful events update fulfillment truth only after cross-checking provider order identity and canonical Issue/manufacturing identity. Duplicate, stale, or cross-Issue events cannot corrupt another Issue.

Customer-facing states avoid unnecessary provider jargon.

---

## 14. Customer status, tracking, support, and recovery

### Status/tracking

The private Issue experience projects safe lifecycle facts such as received/interpreting/production/in-transit/delivered without exposing private/internal details.

Tracking is attached to the correct Issue and shipment. Provider events must be cross-linked safely and idempotently.

### Lifecycle notifications

Customer lifecycle email is event-driven and idempotent. Relevant events can include:

- payment received;
- production started;
- shipped/tracking;
- delivery exception;
- delivered;
- approved support/refund updates.

Mail must come from a verified sender and not disclose unnecessary private content.

### In-app support

A customer with valid Issue access can open Issue-scoped support inside ISSUED ONCE rather than relying only on `mailto`.

- Support messages are encrypted at rest.
- Requests use opaque support references.
- Owner replies remain tied to the correct Issue/customer.
- Generic errors do not expose backend/provider/database details.
- Cross-customer support isolation is mandatory.

### Accountless recovery

A returning customer may regain Issue access on another browser/device using:

- Issue Code;
- matching verified contact;
- OTP challenge.

The flow must resist enumeration. Unknown/mismatched combinations remain challenge-shaped and do not reveal whether the Issue/email exists. Recovery must not rotate/access another Issue through stale or cross-Issue challenges.

A payment tracker/return URL by itself is not proof of browser ownership.

---

## 15. Refund truth

Refund initiation and refund truth stay provider-derived.

- The application does not trust caller-supplied refund amount/state.
- The customer/browser cannot locally mark an Issue refunded.
- The owner initiates the supported full refund through Safepay's provider surface.
- Authenticated signed refund events and/or authenticated Owner reconciliation may verify the stored Safepay tracker through provider Reporter.
- Only the exact stored full amount and currency in a provider-refunded state can transition a paid attempt to canonical `REFUNDED`.
- Partial refund state does not silently promote the whole Issue to `REFUNDED`.
- The transition is row-safe/idempotent.
- Finalization applies the required Issue quarantine/status, referral reversal, notification, and audit effects exactly once.
- Owner OS may expose the stored provider reference and runbook guidance but does not provide a fake local “mark refunded” authority.

Real-provider proof remains a release-evidence concern tracked in the readiness ledger.

---

## 16. Owner OS

Owner OS is the private operational control plane, not a second source of commercial truth.

It must provide bounded, paginated, privacy-preserving views for at least:

- Home/Attention;
- Issues;
- Designer;
- Manufacturing;
- Sales;
- Customers;
- Support;
- Website/catalog/question controls;
- System/readiness;
- Audit/recovery;
- Referrals when that feature is explicitly enabled.

### Owner OS invariants

- Read canonical repository/database truth, not stale browser assumptions.
- Operational rooms refresh on mount and while actively used; critical views revalidate after focus/visibility return and support explicit refresh.
- Show safe `UPDATED`/freshness cues where operationally needed.
- Sensitive reveals require explicit reason/action and audit.
- Large collections are bounded/paginated.
- Readiness must mirror actual runtime requirements and must not display provider readiness that the runtime could not satisfy.
- Every irreversible/provider/production action remains separately gated.
- No Owner UI button may claim success when the provider/domain transition did not occur.

---

## 17. Repeat-order lifecycle

Repeat purchasing is a normal supported behavior and must scale to an unlimited sequence of independent orders.

After a prior Experience reaches terminal checkout, the customer explicitly chooses:

- `KEEP PREVIOUS ANSWERS`
- `ANSWER AGAIN`

### KEEP PREVIOUS ANSWERS

- Creates/recovers one new child Experience/order snapshot.
- Copies the seven already-encrypted answers without plaintext decryption.
- Copies the exact original question snapshots so answer meaning cannot drift.
- Starts the child at completed-profile/product-selection state.
- Does not mutate the previous Experience, quote, payment, Issue, notifications, design, or manufacturing records.

### ANSWER AGAIN

- Creates/recovers one new child Experience.
- Copies no old answers.
- Assigns one fresh question from each of the seven families.
- Every family uses a different question ID from the immediately previous profile.
- If an active alternate is unavailable for any family, creation fails cleanly rather than silently reusing the old question or creating a partial profile.

### Race/idempotency rule

Competing/retried repeat-order choice requests from the same terminal source converge on exactly one deterministic child. The first committed choice wins; a losing request recovers the already-created child's actual mode and may not create or mutate a second child.

### Contact/shipping on repeats

- Contact verification is not silently inherited.
- Proven same-browser email continuity may be explicitly reused only under Section 7.
- Shipping remains per-order and is not silently inherited.
- Every repeat order eventually freezes its own quote/payment/Issue commercial snapshot.

Older examples mentioning hoodie in repeat-order documentation do not override the current TEE/CAP/TOTE catalog rule.

---

## 18. Creator referrals

The referral system is a native but **launch-disabled-by-default** capability. It must have zero effect on ordinary checkout until the owner explicitly enables the feature and completes its required rollout.

### Referral principles

- Creator economics are Owner-configurable, not hardcoded.
- Discount mode/value, creator reward mode/value, payout cadence/threshold, attribution window, and active/paused state are configuration.
- One frozen order has at most one referral attribution.
- No discount stacking in the current version.
- Link attribution may be replaced by a valid explicitly entered code before the final quote is frozen.
- Invalid/paused/expired/self-referral codes cannot reduce price.
- Self-referral defense uses verified identity hashes, not exposed customer PII.
- Discount is calculated server-side before quote freeze.
- Provider paid truth, not browser navigation, creates a referral conversion.
- Duplicate provider events cannot duplicate conversion/reward.
- Customer identity, raw answers, shipping data, and creator payout details never enter public referral URLs/provider metadata.
- Creator notifications disclose sale/reward/balance facts without buyer identity/private answers.
- Refund reverses the matching reward idempotently.
- Rewards move through controlled pending/available/reversed/paid-out semantics.
- Payouts remain manual in the current version; payout details are encrypted and revealed only through audited Owner action.
- Non-referral checkout remains unchanged whether referral infrastructure exists or not.

Referral migrations/config/signing/creator outreach remain owner-controlled rollout actions. Presence of code is not permission to activate the commercial program.

---

## 19. Merchant identity, legal truth, and public trust

ISSUED ONCE must never invent a business location, incorporation status, policy, support identity, or provider relationship to appear more established.

Before public commercial launch, the live site must show the owner-approved truthful merchant/support/location/legal disclosures required by the current launch design and applicable operating reality.

This remains an owner-supplied boundary where facts cannot safely be guessed by engineering.

---

## 20. Hosting, deployment, and runtime boundaries

The current production architecture has migrated to the Hostinger deployment line. Hosting is infrastructure, not product identity.

### Deployment rules

- Production claims are valid only for the exact deployed release identity that was verified.
- Security/cache headers and canonical-domain boundaries are part of live acceptance.
- Schema changes require explicit migration discipline, preflight, postflight, and rollback/recovery evidence appropriate to their risk.
- Production secrets are server-side environment configuration; they never belong in this Masterplan, source code, logs, screenshots, or public evidence.
- Provider/runtime readiness probes must reflect the same configuration contract used by actual runtime.
- Production-specific behavior must fail closed when required provider/catalog/storage/factory configuration is absent.

### Legacy paths

The retired Fourthwall commerce path is historical architecture only. Current commerce is Safepay + ISSUED ONCE catalog + Printful manufacturing.

Legacy Fourthwall commerce endpoints/routes remain hard-disabled (`410`) rather than silently becoming an alternate checkout path.

Old Vercel/Fourthwall plans remain provenance, not current commercial authority.

---

## 21. Reliability and scale posture

The system must be designed for high scale without depending on one process, one browser, sticky sessions, provider exactly-once delivery, or human memory.

Core posture:

- durable database authority;
- unique constraints;
- compare-and-swap/state-transition discipline;
- event/provider idempotency;
- stateless web/API instances where practical;
- asynchronous durable work seams for design/notifications/provider processing;
- bounded retries;
- terminal vs retryable failure classification;
- no partial Issue/payment/manufacturing truth after transaction failure;
- pagination/bounded owner queries;
- explicit indexes and migration review for scale-sensitive paths;
- privacy preserved under horizontal scaling.

The first commercial cycle may use manual owner gates. Scale optimization must never delete identity, privacy, idempotency, or manufacturing safety invariants.

---

## 22. Consumer-readiness contract: CR-01 through CR-30

The detailed evidence and current status for these rows live in:

`docs/superpowers/plans/2026-08-31-issued-once-consumer-readiness-master-plan.md`

The following requirement set is part of the canonical product definition:

| ID | Canonical requirement |
|---|---|
| CR-01 | Seven randomized questions, one per required family, immutable per Experience. |
| CR-02 | Raw answers/private data encrypted at rest and isolated between customers. |
| CR-03 | TEE/CAP/TOTE selection with valid size/base, frozen variant and price truth. |
| CR-04 | Email OTP verification with rate limits, expiry, single use, recovery, and privacy. |
| CR-05 | Destination-aware shipping without globally requiring non-applicable fields. |
| CR-06 | Safepay checkout starts only from complete verified commercial state. |
| CR-07 | Browser return never creates paid truth; verified customers reach the correct Issue after authenticated payment truth. |
| CR-08 | One canonical Issue per paid attempt with immutable commercial snapshot. |
| CR-09 | Accountless cross-device recovery through Issue Code + verified contact challenge. |
| CR-10 | Safe customer lifecycle/tracking without private-data leakage. |
| CR-11 | Encrypted Issue-scoped in-app customer support. |
| CR-12 | Idempotent lifecycle email from a verified sender. |
| CR-13 | Provider-backed, private, replaceable AI interpretation/artwork generation. |
| CR-14 | Real printable transparent-PNG/manufacturing quality validation, not metadata-only checks. |
| CR-15 | Durable private artwork that survives application redeploy/restart. |
| CR-16 | Audited Owner review/approve/reject/regenerate/upload and bounded private reveals. |
| CR-17 | Catalog publication cannot sell a variant without a factory mapping. |
| CR-18 | Boot/default catalog cannot silently become production commercial truth. |
| CR-19 | Exact idempotent Printful draft creation without automatic charge. |
| CR-20 | Printful production confirmation requires Owner session + kill switch + exact typed Issue confirmation. |
| CR-21 | Signed Printful lifecycle events update the correct Issue without cross-linking. |
| CR-22 | Provider-derived refund truth plus documented Owner reconciliation path. |
| CR-23 | Bounded, paginated, privacy-preserving Owner OS operational views. |
| CR-24 | Owner readiness mirrors real runtime requirements and cannot show false provider readiness. |
| CR-25 | Unknown exceptions never serialize private/provider/database detail into logs. |
| CR-26 | Truthful merchant name, support identity, public location/legal disclosure before public launch. |
| CR-27 | Canonical domain serves the exact intended release with required security/cache boundaries. |
| CR-28 | Full live commercial cycle: seven answers → verified payment → Issue → design → Printful → tracking → support → recovery, including a second isolated customer proof. |
| CR-29 | Repeat reuse/fresh-answer flow preserves contact/profile/order boundaries. |
| CR-30 | Referral feature has no checkout effect unless explicitly enabled and remains reversible across refund/delivery lifecycle. |

### Adoption-time readiness snapshot

At this Masterplan audit, the readiness ledger recorded:

- `CR-24` and `CR-25`: `DONE`;
- `CR-26`: `OWNER_REQUIRED`;
- `CR-27`: `CODE_READY`;
- `CR-28`: `MISSING` pending controlled live-cycle evidence;
- `CR-30`: `CODE_READY (launch-disabled)`;
- the remaining listed CR rows: predominantly `CODE_READY` with live/provider proof still required.

This paragraph is a historical snapshot only. Future status changes belong in the readiness ledger and must not be inferred from this Masterplan.

---

## 23. Milestone backbone

These milestones are architectural completion layers, not a replacement for the CR readiness ledger.

### M0 — Mystery/private foundation
Complete when the seven-family Question Vault, persistent question identity, encrypted answers, privacy-safe Experience model, and mystery-first entry experience are durable.

### M1 — Verified commercial intent
Complete when current catalog/form selection, server-owned price/factory mapping, contact verification, and destination-aware encrypted shipping are correct.

### M2 — Payment and Issue truth
Complete when hosted payment can be reconciled idempotently from authenticated provider truth and creates exactly one immutable canonical Issue.

### M3 — Private creative pipeline
Complete when paid Issues create durable private interpretation/artwork jobs, provider-backed generation works, and actual printable quality/integrity gates fail closed.

### M4 — Owner control plane
Complete when Owner OS can safely operate Issues, design, support, sales, customer/recovery, catalog/questions, readiness, and audit with bounded private reveals.

### M5 — Controlled manufacturing
Complete when exact mapped Printful drafts are idempotent and production can occur only through explicit independent Owner gates.

### M6 — Fulfillment and customer continuity
Complete when signed fulfillment events, tracking, lifecycle notifications, Issue status, in-app support, and accountless recovery work without cross-customer leakage.

### M7 — Refund and exception integrity
Complete when provider-derived full-refund reconciliation, local state transition, quarantine/reversal/notification/audit behavior, and operational recovery are proven.

### M8 — Repeat/referral extensions
Complete when unlimited repeat ordering preserves profile/contact/order isolation and referrals remain configurable, reversible, private, and disabled until explicitly launched.

### M9 — Production release truth
Complete when truthful merchant/legal identity, canonical domain, exact release identity, runtime/provider readiness, security/cache headers, production catalog authority, migrations, and rollback/operational controls are verified.

### M10 — Controlled end-to-end commercial proof
Complete only when CR-28 evidence proves the whole real lifecycle with one controlled full live order **and** a second deliberately different customer/session proving isolation, without bypassing any Owner or provider gate.

No milestone label is permission to skip a later CR requirement or live/provider evidence.

---

## 24. Definition of done and mandatory verification

A code path is not complete because it “looks right.”

### Engineering verification

For behavior changes:

- use RED-first/TDD where the repository contract requires it;
- add focused regression coverage for the actual failure/invariant;
- run the relevant unit/integration tests;
- run typecheck;
- run lint;
- run production build;
- run CI on the exact candidate head;
- re-run required post-merge/exact-tree verification;
- test idempotency/concurrency for provider and state-transition paths;
- test privacy/logging sentinels for sensitive boundaries;
- prove two-customer/session isolation anywhere data could cross-link.

### Browser/UI verification

For customer- or Owner-facing changes:

- test desktop around 1440px width;
- test the established Pixel 7/mobile viewport;
- verify responsive layout, no horizontal overflow, visible focus, keyboard path where applicable, and touch targets;
- exercise real interactions, not screenshot-only inspection;
- prove buttons are not silent no-ops;
- verify loading, disabled, success, failure, retry/recovery, and stale-refresh states as relevant.

### Provider/live verification

When the consumer promise depends on a real provider, synthetic preview alone is insufficient.

Use the provider/live evidence required by the readiness ledger and preserve Owner gates for real charges, production confirmation, DNS/legal facts, credentials, migrations, or other irreversible actions.

### Evidence honesty

Never mark `DONE` from unit tests alone when the requirement calls for deployed/provider/customer evidence. Never claim the deployed production state without exact release identity.

---

## 25. Explicitly prohibited / deprecated behavior

Unless the owner explicitly amends this Masterplan, do not introduce:

- active Fourthwall commerce or any hidden alternate legacy checkout;
- normal storefront/gallery behavior replacing the mystery-first entrance;
- current sellability of hoodie or another form merely because an old document/example mentions it;
- browser-owned product/price/availability truth;
- browser success/return as paid truth;
- duplicate Issues for one paid attempt;
- sequential/public sales-count Issue IDs;
- raw answer text in logs, analytics, public metadata, payment metadata, referral URLs, or manufacturing metadata;
- unencrypted PII/private operational payloads at rest where the current architecture requires encryption;
- automatic verified-email inheritance on repeat orders;
- silent shipping reuse;
- mutation/reset of a previous paid/checkout Experience to make a new order;
- factory-mapping fallback for an unmapped sellable variant;
- production fallback from missing Owner catalog publication to boot defaults;
- “image exists” as a substitute for printable-artwork validation;
- payment-triggered automatic Printful production;
- caller/browser-supplied refund truth;
- partial refund silently treated as full canonical `REFUNDED`;
- public customer transformation gallery/social proof exposing private work;
- creator rewards from browser clicks/redirects rather than verified payment truth;
- enabled referral checkout behavior before explicit Owner rollout;
- fake merchant location/incorporation/legal claims;
- secrets/credentials in source-controlled docs;
- fake provider/readiness/success UI;
- silent weakening of OTP, session, payment, Issue, artwork, or manufacturing security to make a test pass.

---

## 26. Future-change protocol

ISSUED ONCE is expected to evolve. Evolution must be explicit.

Every meaningful product/architecture decision must be classified as one of:

- `FINALIZED` — approved and now part of product truth;
- `OWNER_GATE` — desired/implemented but blocked on a fact, credential, irreversible action, legal truth, provider charge, DNS, or other Owner boundary;
- `FUTURE_PROPOSAL` — considered but not product truth;
- `DEPRECATED` — intentionally retired and forbidden from silently returning.

### When a finalized rule changes

The same work cycle must:

1. state the owner-approved change;
2. update `Masterplan(ISSUED ONCE).md`;
3. update the relevant current design spec if mechanics changed;
4. update tests/contracts;
5. update the consumer-readiness ledger if the acceptance/evidence requirement changed;
6. update `.engineering/CONTINUATION.json` when execution/governance state changes;
7. explicitly name any superseded rule instead of deleting history;
8. verify that old/deprecated code paths cannot silently remain active.

Historical docs remain useful provenance. Do not rewrite history to pretend an old decision never existed.

---

## 27. Source register audited into this Masterplan

The following repository source families were reconciled when establishing this canonical backbone.

### Current readiness / governance

- `.engineering/CONTINUATION.json`
- `docs/superpowers/plans/2026-08-31-issued-once-consumer-readiness-master-plan.md`

### Core design contracts

- `docs/superpowers/specs/2026-08-18-issued-once-order-webhook-issue-registry-design.md` — historical Fourthwall-era Issue/webhook architecture; its durable idempotency/privacy/Issue principles survive, while Fourthwall commerce does not.
- `docs/superpowers/specs/2026-08-19-issued-once-safepay-printful-mvp-design.md`
- `docs/superpowers/specs/2026-08-19-issued-once-owner-os-design.md`
- `docs/superpowers/specs/2026-08-21-issued-once-design-control-design.md`
- `docs/superpowers/specs/2026-08-21-issued-once-merchant-launch-design.md`
- `docs/superpowers/specs/2026-08-21-issued-once-referrals-design.md`
- `docs/superpowers/specs/2026-08-23-hostinger-migration-design.md`
- `docs/superpowers/specs/2026-08-23-quiz-encryption-v1-v2-hostinger-migration-design.md`
- `docs/superpowers/specs/2026-08-23-repeat-order-lifecycle-design.md`
- `docs/superpowers/specs/2026-08-23-workflow-audit-otp-live-owner-design.md`

### Implementation and release plans

- `docs/superpowers/plans/2026-08-18-issued-once-order-webhook-issue-registry.md`
- `docs/superpowers/plans/2026-08-19-issued-once-final-commercial-cycle.md`
- `docs/superpowers/plans/2026-08-19-issued-once-owner-os.md`
- `docs/superpowers/plans/2026-08-20-commercial-release-gates.md`
- `docs/superpowers/plans/2026-08-21-issued-once-design-control.md`
- `docs/superpowers/plans/2026-08-21-issued-once-merchant-launch.md`
- `docs/superpowers/plans/2026-08-21-issued-once-referrals.md`
- `docs/superpowers/plans/2026-08-23-contact-continuity-otp-repair.md`
- `docs/superpowers/plans/2026-08-23-hostinger-migration.md`
- `docs/superpowers/plans/2026-08-23-owner-live-workflow-qa.md`
- later consumer-readiness/refund/release evidence integrated on the active branch.

### Operational runbooks

- `docs/operations/final-audit-2026-08-19.md`
- `docs/operations/first-live-cycle.md`
- `docs/operations/hostinger-deployment.md`
- `docs/operations/migration-order.md`
- `docs/operations/production-environment.md`
- `docs/operations/production-launch-gate.md`

### Recovered finalized project decisions

This consolidation also preserves finalized ISSUED ONCE decisions available in the project record that are consistent with current accepted implementation, including:

- seventy-question / seven-family vault structure;
- private encrypted answers and minimized plaintext exposure;
- mystery-first/no conventional storefront direction;
- interpretation rather than literal answer illustration;
- immutable Issue identity;
- owner-gated production;
- no public exposure of private transformations;
- privacy-safe Issue/support surfaces;
- provider replaceability;
- continuous engineering/evidence discipline.

Where an older decision conflicted with later accepted implementation, the later accepted implementation was selected and the conflict is named in this Masterplan rather than copied ambiguously.

---

## 28. Owner acceptance test for the finished product

A finished ISSUED ONCE must let an unknown customer:

1. arrive at a premium mystery-first experience rather than a generic store;
2. receive a stable, balanced seven-question set and answer privately;
3. choose only an actually published/mapped sellable form;
4. verify contact safely;
5. provide valid destination-aware shipping without unnecessary friction;
6. see a truthful server-owned commitment/price;
7. pay through hosted Safepay without the browser inventing paid truth;
8. receive exactly one permanent private Issue identity;
9. have only that Issue's private profile interpreted into its artwork;
10. have actual printable artwork survive redeploy/restart;
11. remain protected by Owner review before manufacturing;
12. never enter Printful production without deliberate Owner confirmation;
13. receive correct lifecycle/tracking;
14. contact support from the Issue;
15. recover the Issue from another device without account creation and without enumeration leakage;
16. receive a correct provider-derived refund outcome if a full refund occurs;
17. place another order using either the previous encrypted profile or a genuinely fresh seven-question profile without corrupting the first order;
18. never be affected by referrals unless the owner explicitly launches them;
19. never have their private answers, address, provider secrets, or another customer's data exposed through logs, UI, analytics, support, recovery, or cross-linked provider events.

The owner must be able to operate the system through a live, truthful, privacy-preserving Owner OS without hidden provider actions or fake readiness.

If the final product cannot pass this acceptance test and the CR-01…CR-30 evidence gates, it is not the ISSUED ONCE product defined by this Masterplan.

---

## 29. Engineering acceptance test for every future change

Before merging a future change, ask:

1. Does it preserve the seven-question/private Experience identity?
2. Does it preserve encrypted/minimized private data?
3. Does it preserve server-owned catalog/price/payment truth?
4. Does it preserve one immutable Issue per verified paid attempt?
5. Does it preserve design/artwork Issue isolation?
6. Does it preserve explicit Owner control over irreversible manufacturing?
7. Does it preserve provider idempotency and cross-customer isolation?
8. Does it preserve accountless recovery/support privacy?
9. Does it preserve repeat/referral rules if the changed code touches them?
10. Does it keep current vs future/deprecated behavior unambiguous?
11. Does it add/update RED-first regressions and required browser/provider evidence?
12. Does it require an Owner gate? If yes, did engineering stop before crossing it?
13. If product semantics changed, was this Masterplan updated explicitly?
14. Can a billion-scale deployment use the same identity/privacy/idempotency contract without relying on one process or human memory?

A “no” or unknown answer closes the merge gate until resolved.

---

**End of canonical Masterplan.**
