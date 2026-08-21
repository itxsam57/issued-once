# ISSUED ONCE Merchant + Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish truthful merchant disclosures, fast Owner OS price control, readiness truth, and the final external launch-gate sequence without weakening the mystery experience or provider safety boundaries.

**Architecture:** Add deployment-backed merchant identity and static public policy routes that reuse the existing visual system. Keep the active catalog as the only price source, expose a fast product-level price publish action through the existing versioned catalog service, and extend readiness so missing merchant disclosures fail closed.

**Tech Stack:** Next.js 16, TypeScript, existing Owner OS website service/catalog, Vitest, Playwright, GitHub Actions live production smoke.

**Spec:** `docs/superpowers/specs/2026-08-21-issued-once-merchant-launch-design.md`

## Global Constraints

- Never fabricate a foreign entity, office, address, registration, or domicile.
- Public prices come from the runtime canonical catalog only.
- Historical quotes/Issues remain frozen after price changes.
- `readyForProduction` remains false until external provider evidence is observed.
- Keep the real OTP Browser QA smoke enabled while owner accepts the test-email volume.

---

### Task 1: Public merchant identity and policy pages

**Files:**
- Create: `src/brand/publicMerchant.ts`
- Create: `src/app/store-info/page.tsx`
- Create: `src/app/contact/page.tsx`
- Create: `src/app/terms/page.tsx`
- Create: `src/app/returns/page.tsx`
- Create: `src/app/merchant.module.css`
- Modify: `src/app/page.tsx`
- Modify: `src/components/experience/CommitmentScreen.tsx`
- Test: `tests/unit/merchant-pages.test.tsx`
- Test: `tests/e2e/public-physical-flow.spec.ts`

- [x] Write failing tests for four public routes, truthful configured identity, canonical price rendering, footer/commitment links, and no fabricated location fallback.
- [x] Observe RED.
- [x] Implement merchant config reader + pages + restrained navigation.
- [x] Run focused unit/browser tests green and commit.

### Task 2: Merchant readiness gate

**Files:**
- Modify: `src/server/ops/ReadinessService.ts`
- Modify: `tests/unit/readiness-service.test.ts`
- Modify: `src/components/ops/SystemPanel.tsx`

- [x] Write failing tests for missing/ready merchant disclosure and sandbox readiness exclusion when disclosure is missing.
- [x] Observe RED.
- [x] Add readiness check without exposing configured values.
- [x] Run focused tests green and commit.

### Task 3: One-action product price publishing

**Files:**
- Modify: `src/server/ops/OpsWebsiteService.ts`
- Create: `src/app/ops/api/website/catalog/price/route.ts`
- Modify: `src/components/ops/WebsitePanel.tsx`
- Test: `tests/unit/ops-website-config.test.ts`
- Test: `tests/e2e/owner-os.spec.ts`

- [x] Write failing tests proving a chosen product price updates all currently sellable variants, leaves other products unchanged, validates integer minor units/currency/mappings, and publishes a new catalog version.
- [x] Observe RED.
- [x] Implement service/route and `QUICK PRICE` Owner OS control in major units.
- [x] Run focused unit/browser tests green and commit.

### Task 4: Final provider readiness and owner gates

**Files:**
- Modify: `.engineering/CONTINUATION.json`
- Modify only if sandbox evidence proves protocol mismatch: `src/server/payments/SafepayPaymentGateway.ts` + focused tests

- [ ] Verify Safepay sandbox configuration/runtime after owner adds secrets and endpoint.
- [ ] Run one sandbox checkout from an owner-held browser session.
- [ ] Verify signed webhook amount/currency/state, Issue reservation, duplicate replay, and refund/exception evidence in Neon.
- [ ] If real Safepay evidence contradicts the current classic adapter, write a failing protocol test before changing the gateway.
- [ ] Configure/prove OpenAI + Blob + Vercel Queue design flow.
- [ ] Configure/prove Printful mappings/webhook and one unconfirmed draft while production confirmation remains disabled.
- [ ] Verify signed fulfillment events.
- [ ] Update Governor with provider evidence classes; keep PR draft until every external gate is genuinely green.

### Task 5: Full release verification

- [x] Run full unit/typecheck/lint/build suites.
- [x] Run full Playwright desktop/mobile suite.
- [x] Run live `issuedonce.shop` production smoke.
- [x] Verify zero unintended payment/manufacturing side effects before owner deliberately enters provider sandbox cycle.
- [x] Update `.engineering/CONTINUATION.json` and PR release state for the internal-complete / owner-required boundary.
