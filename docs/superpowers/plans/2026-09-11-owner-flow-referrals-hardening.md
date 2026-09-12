# Owner Flow + Referrals Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make unfinished customer journeys resumable, make manual design and customer choices obvious in Owner OS, make mixed pricing understandable, and activate the approved referral system without weakening payment/manufacturing safety.

**Architecture:** Keep commerce resume on the core checkout-quote schema; referral-aware quote storage is used only when referrals are actually enabled. Reorganize existing Owner OS controls rather than inventing new subsystems. Activate the already-built referral migrations only after isolated Neon proof and preserve explicit provider/manufacturing gates.

**Tech Stack:** Next.js 16, React, TypeScript, Vitest, Playwright, Neon Postgres, Hostinger, Safepay sandbox.

**Spec:** Owner approval in the 2026-09-11 project conversation plus existing `db/migrations/README.md` referral activation authority.

## Global Constraints

- Safepay remains sandbox during this work.
- Do not enable real Printful manufacturing or factory charging.
- Existing paid Issues and quotes remain immutable.
- Customer private answers remain reason-gated/audited.
- Referral production migration order is exactly `0029` → `0034` → `0035`.
- Every code fix is red→green TDD and full-gate verified before deployment.

---
### Task 1: Restore core-schema customer resume

**Files:**
- Modify: `src/server/experience/runtimeResume.ts`
- Test: `tests/unit/experience-resume-runtime.test.ts`

**Interfaces:**
- Consumes: `PostgresCheckoutQuoteRepository` implementing `create()` and `findLatestByExperienceId()`.
- Produces: `createExperienceResumeService()` that works before referral activation.

- [x] Add a failing runtime contract test proving resume does not construct the referral quote repository.
- [x] Run the focused test and confirm the current runtime fails the contract.
- [x] Replace `PostgresReferralQuoteRepository` with `PostgresCheckoutQuoteRepository` only in resume runtime.
- [x] Run resume unit tests and a live-style COMMITMENT_READY resume regression.
- [x] Commit the isolated resume fix.

### Task 2: Make Designer a clear owner workflow

**Files:**
- Modify: `src/components/ops/DesignerPanel.tsx`
- Modify: `src/components/ops/owner-os.module.css`
- Test: `tests/unit/designer-panel-controls.test.tsx`

**Interfaces:**
- Consumes: existing queue item `objectType`, `sizeCode`, `colorCode`, audited answer reveal, manual PNG upload, and design approval routes.
- Produces: explicit `CUSTOMER CHOSE`, step 1 context, step 2 artwork upload, step 3 approval controls.

- [x] Add failing UI assertions for visible customer choice and numbered manual-design workflow.
- [x] Reorganize existing controls without changing privacy or manufacturing semantics.
- [x] Verify upload remains PNG-only and approval remains explicit.
- [x] Commit the Designer UX change.
### Task 3: Make mixed pricing understandable and safe

**Files:**
- Modify: `src/components/ops/WebsitePanel.tsx`
- Modify: `src/components/ops/owner-os.module.css`
- Test: `tests/unit/website-panel-quick-price.test.tsx`
- Test: `tests/unit/website-panel-mixed-price.test.tsx`

**Interfaces:**
- Consumes: existing versioned catalog publication API and immutable existing quotes.
- Produces: major-unit variant price inputs, clear mixed-price state, and explicit publish behavior.

- [x] Add failing tests proving variant inputs display dollars, accept two-decimal prices, and mark unpublished edits.
- [x] Keep QUICK PRICE as the one-price shortcut while allowing per-variant mixed pricing.
- [x] Convert UI major units to integer minor units before catalog publication.
- [x] Verify invalid/negative/more-than-two-decimal values never publish.
- [x] Commit the pricing UX change.

### Task 4: Activate referrals behind the existing rollout contract

**Files:**
- Modify only if tests expose a code defect in referral runtime/Owner UI.
- Test: existing referral unit suites plus any focused regression required by findings.
- Database: `db/migrations/0029_creator_referrals.sql`, then `0034_referral_launch_outreach.sql`, then `0035_referral_private_payload_key_v2.sql`.

**Interfaces:**
- Consumes: `REFERRAL_ATTRIBUTION_SIGNING_KEY`, referral schema, Resend, existing Owner Referrals room.
- Produces: working creator/referral Owner controls and customer attribution/discount path.

- [x] Re-run isolated referral migration proof on a temporary Neon branch.
- [x] Run referral repository/service/route tests against the intended schema contract.
- [x] Verify the production preflight still has no partial referral objects before activation.
- [x] Apply the exact approved migration chain to production only after migration-tool approval requirements are satisfied.
- [x] Configure/verify the referral signing key without printing it.
- [ ] Verify Owner Referrals + customer referral application after Owner OS re-authentication.
- [x] Do not send creator outreach automatically; activation and outreach remain separate actions.
### Task 5: Full regression, deploy, and live proof

**Files:**
- Update plan/checkpoint docs only if verification changes the authoritative state.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: one verified release candidate with live customer/Owner evidence.

- [x] Run full Vitest suite, typecheck, lint, production build, `git diff --check`, and full Playwright suite.
- [x] Run focused live customer resume proof from partial questions and from COMMITMENT_READY.
- [ ] Run Owner OS proof for customer choice visibility, manual PNG workflow, and mixed pricing controls without publishing unintended price changes.
- [ ] Run referral Owner/API proof without sending outreach or real manufacturing actions.
- [x] Push the reviewed branch, fast-forward through normal release gates, wait for exact live SHA, and run Hostinger boundary proof.
- [x] Report remaining provider/config blockers separately from code defects.

### 2026-09-11 live checkpoint

- Exact deployed application SHA after active-referral live-boundary correction: `5c38ade6fefb725ba1a76427ed463922addac23e`.
- Live partial-question and COMMITMENT_READY resume proofs passed; restored selection `TEE / M / ASH` with `$32.00 USD` quote.
- Referral migrations `0029`, `0034`, `0035` are applied; signing key is configured; no creator outreach was sent.
- Local and GitHub Hostinger non-OTP boundary proofs pass with active referrals returning `409` for an invalid/no-current quote.
- Remaining live Owner proof requires re-authentication; automated transfer of the Owner key is blocked by the platform safety boundary.
- Hostinger Temporary Release Proof and Live Boundary Audit pass on `5c38ade`; Live Support Proof remains independently blocked by the known GitHub Actions vs Hostinger `INTERNAL_OPERATIONS_TOKEN` mismatch.
- Live quote matrix passes on `5c38ade`: TEE XS/Bone `$32.00`, CAP OS/Bone `$34.00`, TOTE OS/Bone `$36.00`; no payment attempted. Invalid referral code capture redirects safely to `/begin` without setting a referral cookie.
