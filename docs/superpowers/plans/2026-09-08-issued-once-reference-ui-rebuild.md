# ISSUED ONCE Reference UI Rebuild

## Goal

Replace the rejected hybrid customer presentation with the owner-approved reference visual system while preserving production backend, domain, payment, manufacturing, privacy and fulfillment behavior.

## Authority

The approved reference HTML/handoff wins visually wherever it conflicts with the currently deployed presentation. Existing production handlers, APIs, provider boundaries, merchant/legal facts, privacy rules and irreversible-action gates remain authoritative behaviorally.

## Non-negotiable architecture

- Rebuild the entire customer-visible presentation layer, not one phase.
- Do not stack the new reference styling on top of legacy phase CSS.
- Remove globally mounted phase presentation styles from the root layout.
- Preserve backend callbacks and route contracts rather than rewriting business logic.
- No Safepay charge/refund/configuration mutation.
- No Printful production confirmation or manufacturing order.
- Production promotion is a separate owner-authorized operation.

## Task 1 — Freeze the anti-hybrid contract with RED tests

**Files:**
- Create `tests/unit/reference-ui-isolation.test.tsx`.
- Extend `tests/e2e/final-production-ui.spec.ts` only with observable reference-isolation checks.

**RED contract:**
- root layout does not globally import legacy `object-stage.css`, `size-stage.css`, `base-stage.css`, or `commitment-stage.css`;
- homepage does not render the rejected `HomeMaterialStudy` presentation component;
- homepage owns the approved scene order/copy with no ledger;
- the real `/begin` flow still renders one question at a time inside the reference ritual shell;
- customer-facing phase components expose reference-owned hooks/classes rather than relying on legacy global stage selectors.

Run the new unit test before production edits and preserve its intended failure as evidence.

## Task 2 — Establish one reference visual foundation

**Files:**
- Rework `src/app/globals.css` to tokens/reset/shared accessibility only.
- Create `src/components/reference/ReferenceHeader.tsx` and module CSS.
- Create `src/components/reference/ReferenceRitual.tsx` and module CSS where needed.
- Rework `src/app/layout.tsx` to load no phase-specific legacy CSS.

**Implementation:**
- exact cream/ink/signal typography and spacing tokens;
- fixed 64px desktop header, 58px mobile;
- 1020px ritual lane and 210/184px progressive ledger geometry;
- zero old `home-shell`/stage presentation leakage from global CSS;
- keyboard focus and reduced-motion defaults retained.

## Task 3 — Rebuild the homepage from a blank presentation tree

**Files:**
- Replace `src/app/page.tsx` presentation structure.
- Replace `src/app/home.module.css`.
- Delete/retire `src/components/home/HomeMaterialStudy.tsx` from production use.
- Create a new reference-owned abstract hero presence only if required by the approved composition.

**Implementation:**
- exact headline and editorial sequence;
- no old card, framed demo panel, or inherited stage component on the homepage;
- the physical presence must read as part of the page composition, not as a rectangular legacy widget;
- subtle pointer response only, with reduced-motion fallback;
- truthful issue state only; no fabricated allocation.

## Task 4 — Rebuild the ritual/question surface while preserving handlers

**Files:**
- Rework `RitualShell.tsx`, `IssueLedger.tsx`, `InterviewFlow.tsx`, and `InterviewQuestion.tsx` presentation through the reference-owned stylesheet/shell.
- Do not change `PublicInterviewExperience` API calls or route contracts except imports needed for presentation composition.

**Implementation:**
- one question at a time, huge serif prompt, minimal answer control, `01 / 07` progression;
- progressive right ledger after START only;
- answer count advances only after existing save succeeds;
- mobile ledger becomes the approved bottom control;
- no legacy global phase styling dependency.

## Task 5 — Rebuild physical configuration surfaces in the same system

- Exact TEE/CAP/TOTE equal-card selector and approved 12 JPG studies.
- 16px gaps; 380/300/240px card heights; no selected growth.
- FORM → MATERIAL → TECHNICAL → DISPLAY cycle and 25/50/75/100 rail.
- Size/base render from existing production data and callbacks.
- All screens remain sparse cream editorial UI, not generic ecommerce cards.

## Task 6 — Unify verification, shipping, commitment, status, recovery and support

- Rework only customer-facing presentation components and their CSS.
- Preserve merchant/legal facts and all action handlers.
- Reference typography, rules, spacing and selection states across every customer route.
- No dashboard/SaaS visual remnants.
- OTP/retry/shipping validation/quote/checkout/recovery/support state semantics unchanged.
- Repeat/status/pending surfaces inherit the same public header and cream editorial system.
- Store info, contact, terms and returns use the same system.

## Task 7 — Full visual + regression acceptance

- Run focused unit tests after each task.
- Run full unit suite, typecheck, lint and production build.
- Run Playwright customer-flow suites with provider boundaries mocked/fixture-backed.
- Capture desktop/tablet/mobile screenshots at 1440, 1024, 768, 390 and 360 widths.
- Inspect screenshots manually for visual coherence, not only selector assertions.
- Verify no page-level overflow, console/page errors, keyboard failures or reduced-motion regressions.
- Audit git diff to prove no server/domain/API/payment/manufacturing/provider code changed.
- Update `.engineering/CONTINUATION.json` with the failed prior visual acceptance and fresh replacement evidence.

**Stop condition:** code/QA complete on isolated branch. Production promotion remains a separate owner-authorized operation.
