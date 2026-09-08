# ISSUED ONCE Final Production UI Implementation Plan

> **For implementation:** Use `superpowers:test-driven-development` for every behavior change and `superpowers:verification-before-completion` before commits/PR/claims.

**Goal:** Port the owner-approved cream editorial ritual UI onto the current ISSUED ONCE production customer flow while preserving every backend, catalog, payment, provider, privacy, and fulfillment contract.

**Architecture:** Keep `PublicInterviewExperience` and existing API routes as the business/data authority. Add presentation-only shell/ledger/home/object-inspection components around existing handlers, then restyle downstream components. The real paid Issue allocator remains untouched; pre-payment UI must say unissued/not-yet rather than fabricate a code.

**Spec:** `docs/superpowers/specs/2026-09-08-issued-once-final-production-ui-design.md`

**Base:** `origin/infra/hostinger-migration-20260823` @ `4195bfd5d445d7625885c9716f9b9ed3e68e93ea`

**Isolated branch/worktree:** `ui/final-production-ritual-20260908` / `/home/ubuntu/openclaw-worktrees/issued-once-final-production-ui`

**Baseline evidence:** `pnpm test` → 245 files / 749 tests PASS before UI edits.

## Task 1 — Freeze owner-approved UI contracts with RED tests

**Files:**
- Create `tests/unit/final-production-ui-contract.test.tsx`
- Create `tests/unit/object-inspection-selector.test.tsx`
- Modify only test fixtures/helpers needed by those tests

**RED requirements:**
- homepage exact hero + 7/1/1-to-1/current-issue/BEGIN sequence and no ledger;
- global theme exposes `#F3EEE6` and approved tokens;
- pre-payment ritual ledger labels Issue as not-yet/unissued, never a generated `IO-...` code;
- object cards expose tee/cap/tote, supplied FORM assets, equal presentation state, and no hidden design copy;
- activating selected card cycles FORM → MATERIAL → TECHNICAL → DISPLAY → FORM without calling `onSelect` until `LOCK FORM`.

Run each new test and record the expected RED caused by missing approved UI behavior.
## Task 2 — Implement global shell and exact homepage

**Files:**
- Modify `src/app/globals.css`
- Modify `src/app/page.tsx`
- Replace/rework `src/app/home.module.css`
- Create `src/components/home/HomeMaterialStudy.tsx`

**Implementation:**
- install approved tokens and cream background without changing Owner OS/server behavior;
- fixed 64px editorial header, sparse utilities, accessible focus states;
- exact homepage copy/order from spec;
- dark abstract non-product material study responds subtly to pointer and disables motion when requested;
- current issue scene remains truthful: no fake pre-payment number, while exact `HIDDEN / 1 / 1 / AVAILABLE` presentation remains;
- footer keeps real merchant/legal routes.

**GREEN:** run `final-production-ui-contract` plus existing app-shell/merchant/public-metadata tests.

## Task 3 — Add ritual shell + progressive truth ledger

**Files:**
- Create `src/components/experience/RitualShell.tsx`
- Create `src/components/experience/IssueLedger.tsx`
- Create `src/components/experience/ritual-shell.module.css`
- Modify `src/components/experience/MysteryExperience.tsx`
- Modify `src/components/experience/InterviewFlow.tsx`
- Modify `src/components/experience/InterviewQuestion.tsx`

**Implementation:**
- wrap post-START customer phases in the 1020px ritual lane with 210px/184px responsive ledger;
- make interview progress presentation state observable without changing answer persistence;
- show ISSUE as `NOT YET` until real paid Issue creation;
- reveal ANSWERS/OBJECT/SIZE/BASE only after corresponding existing handler succeeds;
- mobile ledger becomes an accessible bottom-sheet/details control at <=720px;
- keep canonical question source and failure/retry semantics unchanged.
**GREEN:** run new ledger contract test plus interview-flow/interview-shell/mystery-experience tests.

## Task 4 — Build exact object inspection selector and add approved assets

**Files:**
- Add 12 owner-supplied JPGs under `public/assets/issued-once/`
- Modify `src/components/experience/ObjectSelection.tsx`
- Replace/rework `src/app/object-stage.css`
- Expand `tests/unit/object-inspection-selector.test.tsx`
- Update focused Playwright expectations only where the accessible control implementation changes

**Implementation:**
- three equal dark cards, 16px gap, 380px desktop / 300px tablet / 240px mobile;
- no card growth on selection; unselected opacity ~.58;
- mode cycle FORM/MATERIAL/TECHNICAL/DISPLAY with 25/50/75/100 rail;
- use exact supplied image for each object/mode, descriptive physical-study alt text only;
- restrained pointer tilt/light + scan line, keyboard/touch parity, reduced-motion safety;
- `LOCK FORM` remains the sole call into the existing production `onSelect(object)` handler.

**GREEN:** run object selector unit tests, physical-selection error tests, and public-physical-flow focused browser test.

## Task 5 — Restyle downstream customer states without changing handlers

**Files:**
- Modify `src/app/size-stage.css`, `src/app/base-stage.css`, `src/app/commitment-stage.css`
- Modify CSS modules for contact, shipping, repeat, issue status/support/recovery
- Modify `src/app/merchant.module.css`
- Modify `src/app/payment/pending/page.tsx` / `src/app/issue/page.tsx` only if a shared shell wrapper is needed
- Keep component logic changes presentation-only unless a RED test proves a presentation state needs wiring

**Contracts to preserve:** production-returned size/color/quote truth; OTP continuity/retry; shipping validation; referral application; hosted checkout handoff; pending/status polling; recovery OTP; support submission; repeat choice; truthful merchant pages.
**GREEN:** run focused size/base/contact/shipping/commitment/repeat/recovery/status/support/merchant/payment-pending unit tests, then their Playwright specs.

## Task 6 — Responsive, accessibility, privacy, and hard browser QA

**Files:**
- Create `tests/e2e/final-production-ui.spec.ts`
- Add/adjust existing e2e assertions where necessary
- Create a non-production QA script only if needed for matrix inspection

**Browser matrix:** 1440, 1024, 768, 390, 360.

**Verify:**
- exact cream computed background and header/ledger palette;
- homepage has no permanent ledger and exact editorial sequence;
- no page-level horizontal overflow at every width;
- object card measured geometry and no selection growth;
- every object mode loads the expected supplied asset;
- keyboard-only completion of questions → object → size → base → contact controls with mocked provider boundary;
- touch/click path for selected-card mode cycling;
- `prefers-reduced-motion: reduce` removes non-essential transforms/animation;
- no browser console errors;
- no pre-purchase DOM/attributes/URLs contain generated artwork/design payload data;
- catalog matrix exercises TEE / CAP / TOTE and asserts route-returned sizes/colors, not UI hardcodes;
- error/missing provider branches remain visible/recoverable through project mocks/fixtures;
- checkout QA stops at safe mocked/Safepay sandbox handoff and never creates a real charge;
- manufacturing confirmation is never invoked.

Run all customer-facing e2e specs after the focused final-production UI spec is green.
## Task 7 — Whole-tree verification, project ledger, PR, and release promotion

**Files:**
- Update `.engineering/CONTINUATION.json`
- Update referenced consumer-readiness evidence only with fresh facts from this cycle

**Fresh local gates:**
1. `corepack pnpm test`
2. `corepack pnpm typecheck`
3. `corepack pnpm lint`
4. `corepack pnpm build`
5. `corepack pnpm test:e2e` or the repository Browser-QA-equivalent suite
6. `git diff --check`

Before commit/PR, inspect `git diff --stat`, `git diff`, and verify no server/API/payment/provider/catalog/manufacturing behavior was unintentionally changed.

Push `ui/final-production-ritual-20260908`, open a normal PR to `infra/hostinger-migration-20260823`, require exact-head CI + Browser QA, and use the code-review skill before merge.

After verified merge, promotion may use the existing forward-only Hostinger release-wrapper method: parent the current `release/hostinger-v2-candidate-20260824` head and reuse the exact verified integration tree. Do not force-push, mutate Safepay/Printful configuration, create a real payment/refund, or confirm manufacturing as part of UI deployment.

After Hostinger deploy, repeat direct Hostinger-edge health checks and the safe live customer smoke through real questionnaire/catalog/OTP only; stop before payment-provider side effects. Record the new exact release SHA and live evidence in the continuation ledger.

## Completion criteria

The work is complete only when every acceptance item in the spec has fresh evidence, whole-tree gates are green, exact-head CI/Browser QA are green, the merged integration tree is known, and any production promotion is proven against the Hostinger runtime without commercial side effects.
