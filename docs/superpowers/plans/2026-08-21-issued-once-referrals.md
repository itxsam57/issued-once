# ISSUED ONCE Creator Referrals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build native creator attribution, discounts, paid-sale rewards, creator notifications, balances, and manual payout settlement.

**Architecture:** Add referral domain/repository tables around immutable checkout quotes and payment attempts. Attribution is signed/opaque, discounting occurs server-side before quote freeze, conversions are created only from signed paid provider truth, and reward/payout ledgers are idempotent.

**Tech Stack:** Next.js 16, TypeScript, Neon Postgres, existing private-payload AES-256-GCM, Resend, Vercel Queue, Owner OS, Vitest/Playwright.

**Spec:** `docs/superpowers/specs/2026-08-21-issued-once-referrals-design.md`

## Global Constraints

- One referral per frozen quote/order; no stacking in v1.
- No referral credit from redirect/client state; only signed PAID truth.
- Discount is server-side and frozen into quote/payment amount.
- Existing historical commercial snapshots never change when referral settings change.
- Creator/private payout data is encrypted; customer PII never enters creator notifications.

---

### Task 1: Referral schema and repository

**Files:**
- Create: `db/migrations/0029_creator_referrals.sql`
- Modify: `db/migrations/CURRENT`
- Modify: `db/migrations/README.md`
- Create: `src/server/referrals/ReferralRepository.ts`
- Create: `src/server/referrals/PostgresReferralRepository.ts`
- Create: `src/server/referrals/ReferralPolicy.ts`
- Test: `tests/unit/referral-repository-contract.test.ts`

- [ ] Write failing tests for unique codes, encrypted creator email/payout payloads, rule snapshots, one conversion/payment, reward states, refund reversal, and payout balance constraints.
- [ ] Observe RED.
- [ ] Add migration + minimal repository/domain implementation.
- [ ] Run focused tests green and commit.

### Task 2: Public link/code attribution and server-side discount quote

**Files:**
- Create: `src/app/r/[code]/route.ts`
- Create: `src/app/api/referrals/apply/route.ts`
- Create: `src/server/referrals/ReferralService.ts`
- Modify: `src/server/physical/BaseSelectionService.ts`
- Modify: `src/components/experience/CommitmentScreen.tsx`
- Test: `tests/unit/referral-attribution.test.ts`
- Test: `tests/unit/base-selection-service.test.ts`
- Test: `tests/unit/commitment-screen.test.tsx`

- [ ] Write failing tests for signed attribution, explicit-code override before checkout, invalid/paused/self-referral rejection, gross/discount/net quote snapshot, and positive final payable amount.
- [ ] Observe RED.
- [ ] Implement attribution cookie + apply-code endpoint + referral-aware quote creation.
- [ ] Add visible gross/discount/final price UI without revealing creator private data.
- [ ] Run focused tests green and commit.

### Task 3: Paid conversion, reward ledger, creator email

**Files:**
- Create: `src/server/referrals/ReferralConversionService.ts`
- Create: `src/server/referrals/referralNotificationQueue.ts`
- Create: `src/server/referrals/ReferralNotificationService.ts`
- Modify: `src/app/api/webhooks/safepay/route.ts`
- Modify: `src/app/api/queue/notifications/route.ts`
- Test: `tests/unit/referral-conversion-service.test.ts`
- Test: `tests/integration/paid-order-webhook.integration.test.ts`

- [ ] Write failing tests proving only PAID creates one conversion/reward, duplicate webhook stays one conversion/email, and creator message has no buyer PII.
- [ ] Observe RED.
- [ ] Implement conversion + idempotent notification enqueue/send.
- [ ] Run focused tests green and commit.

### Task 4: Fulfillment availability and refund reversal

**Files:**
- Modify: `src/server/manufacturing/ManufacturingEventService.ts`
- Modify: `src/app/api/webhooks/safepay/route.ts`
- Modify: `src/server/referrals/ReferralConversionService.ts`
- Test: `tests/unit/referral-reward-lifecycle.test.ts`

- [ ] Write failing tests for delivered -> AVAILABLE and refund -> REVERSED exactly once.
- [ ] Observe RED.
- [ ] Implement idempotent lifecycle transitions.
- [ ] Run focused tests green and commit.

### Task 5: Owner OS referral management and payout settlement

**Files:**
- Create: `src/server/ops/OpsReferralService.ts`
- Create: `src/app/ops/api/referrals/route.ts`
- Create: `src/app/ops/api/referrals/[creatorId]/route.ts`
- Create: `src/app/ops/api/referrals/payouts/route.ts`
- Create: `src/components/ops/ReferralsPanel.tsx`
- Modify: `src/components/ops/OwnerOsShell.tsx`
- Modify: `src/server/ops/runtimeOwnerOs.ts`
- Test: `tests/unit/ops-referrals.test.ts`
- Test: `tests/e2e/owner-os.spec.ts`

- [ ] Write failing tests for create/edit/pause, link copy data, balances, payout eligibility, audited payout-detail reveal, and mark-paid settlement.
- [ ] Observe RED.
- [ ] Implement Owner OS routes/service/panel using encrypted payout details.
- [ ] Run focused unit/browser tests green and commit.

### Task 6: Full referral verification

**Files:**
- Modify: `.engineering/CONTINUATION.json`

- [ ] Run full unit/typecheck/lint/build/e2e suite.
- [ ] Run live production smoke with no payment/manufacturing side effects.
- [ ] Record exact evidence and migration-pending status in Governor.
- [ ] Commit checkpoint.
