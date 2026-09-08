# ISSUED ONCE Reference UI Rebuild Implementation Plan

> **Execution rule:** TDD for every visible behavior change; no production provider side effects.

**Goal:** Replace the hybrid/patched consumer presentation with one coherent owner-approved ISSUED ONCE reference UI while leaving business, persistence, payment, fulfillment, privacy, and provider contracts untouched.

**Authority:** Owner-approved `ISSUED-ONCE-UI-HANDOFF.md` and the approved final cream reference it describes. The current production UI is explicitly rejected where old presentation survives inside the new shell.

**Base:** `origin/release/hostinger-v2-candidate-20260824` @ `e3bbafe3d597d51fd5db60dc28c1aa93873faf29`.

**Branch/worktree:** `ui/reference-rebuild-20260908` / `/home/ubuntu/openclaw-worktrees/issued-once-reference-rebuild`.

## Global constraints

- Do not modify `src/server/**`, `src/domain/**`, `src/app/api/**`, payment gateway logic, Printful logic, database migrations, or provider credentials.
- Safepay remains untouched; no real charge/refund. Printful confirmation remains disabled; no real manufacturing action.
- No hidden generated artwork may appear before purchase in DOM, URLs, metadata, alt text, or assets.
- The visible customer hierarchy must be owned by the reference presentation layer, not legacy stage CSS/components restyled from outside.
- Preserve existing callbacks and real data as the only authority for answers, object availability, size/color, OTP, shipping, quote, checkout, status, support, and recovery.
- No merge, Hostinger release fast-forward, or production deployment without a separate owner-authorized release action.
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
- Create `src/components/reference/ReferenceRitual.tsx` and module CSS.
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

**GREEN:** anti-hybrid unit contract plus existing homepage/public metadata tests.

## Task 4 — Rebuild the ritual/question surface while preserving handlers

**Files:**
- Rework `RitualShell.tsx`, `IssueLedger.tsx`, `InterviewFlow.tsx`, and `InterviewQuestion.tsx` presentation.
- Add colocated/module CSS owned by the new reference surface.
- Do not change `PublicInterviewExperience` API calls or route contracts except imports needed for presentation composition.

**Implementation:**
- one question at a time, huge serif prompt, minimal answer control, `01 / 07` progression;
- progressive right ledger after START only;
- answer count advances only after existing save succeeds;
- mobile ledger becomes the approved bottom control;
- no legacy global `.interview-*` styling dependency.

**GREEN:** interview shell/flow/mystery tests plus the anti-hybrid contract.
## Task 5 — Rebuild physical configuration surfaces in the same system

**Files:**
- Rework `ObjectSelection.tsx`, `SizeConfirmation.tsx`, `BaseColorSelection.tsx` presentation.
- Create/use colocated module CSS; stop loading old global stage CSS.

**Implementation:**
- exact TEE/CAP/TOTE equal-card selector and approved 12 JPG studies;
- 16px gaps; 380/300/240px card heights; no selected growth;
- FORM → MATERIAL → TECHNICAL → DISPLAY cycle and 25/50/75/100 rail;
- size/base render from existing production data and existing callbacks;
- all screens remain sparse cream editorial UI, not generic ecommerce cards.

## Task 6 — Unify verification, shipping, commitment, status, recovery and support

**Files:**
- Rework only customer-facing presentation components and their module CSS.
- Preserve merchant/legal facts and all action handlers.

**Implementation:**
- reference typography, rules, spacing and selection states across every customer route;
- no dashboard/SaaS visual remnants;
- OTP/retry/shipping validation/quote/checkout/recovery/support state semantics unchanged;
- repeat/status/pending surfaces inherit the same public header and cream editorial system.

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
