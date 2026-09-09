# ISSUED ONCE Team 5 Adversarial Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exhaustively review ISSUED ONCE from five adversarial roles, record every reproducible defect, fix every engineering-safe defect with RED→GREEN regression coverage, and finish with one integrated hard verification.

**Architecture:** Five isolated review tracks inspect the same verified checkpoint: Customer, Reviewer, Owner, Cybersecurity Expert, and Hater. Findings enter the integration branch only after independent reproduction; fixes target the root boundary and preserve provider/payment/manufacturing safety gates.

**Tech Stack:** Next.js 16, React, TypeScript, Vitest, Playwright, PostgreSQL/Neon, Hostinger runtime.

**Spec:** Owner request in the 2026-09-09 project conversation: “Team 5” must review everything from five perspectives and fix all reproducible bugs/errors.

## Global Constraints
- No real Safepay charge or refund.
- No Printful production confirmation or irreversible manufacturing action.
- `PRINTFUL_ALLOW_CONFIRM=false` remains a hard safety boundary.
- Do not expose owner keys, OTPs, provider credentials, private answers, shipping data, or payout destinations in logs/reports.
- Every production-code fix requires a failing regression first and a passing rerun after.
- Public customer UI remains the approved cream editorial system; no legacy presentation reintroduction.
- Consumer copy must not leak internal implementation/provider/runtime mechanics.
- Team findings are evidence, not truth: reproduce before fixing.

---
### Task 1: Customer adversarial track

**Files:**
- Modify only after RED proof: customer experience components/services and corresponding tests.
- Test: `tests/e2e/public-*.spec.ts`, `tests/e2e/repeat-order-lifecycle.spec.ts`, `tests/e2e/issue-*.spec.ts`, focused unit tests.

**Interfaces:**
- Consumes anonymous experience/session APIs, OTP, shipping, referral, payment handoff, status/recovery/support.
- Produces a finding ledger with exact reproduction, severity, root cause, regression, fix commit.

- [ ] Stress fresh/repeat sessions, double taps, delayed responses, refresh/back/forward, multi-tab isolation, mobile/tablet awkward widths.
- [ ] Attack OTP resend/verify timing, editable fields during saves, shipping retries, referral replacement, checkout retry, pending-payment recovery.
- [ ] Verify no pre-purchase artwork/design/private payload leakage and no internal mechanics in public copy.
- [ ] For each defect, write a failing regression and confirm RED.
- [ ] Implement the smallest root fix and confirm GREEN.

### Task 2: Reviewer adversarial track

**Files:**
- Modify only after RED proof: `src/components/ops/DesignerPanel.tsx`, design/review services/routes, reviewer tests.
- Test: `tests/e2e/designer-controls.spec.ts` plus relevant unit tests.

- [ ] Race Issue selection, candidate loads, policy loads, answer reveals, approve/reject/rework/select/upload actions.
- [ ] Test stale responses, refresh during action, double action, missing artwork, failed generation, long answers and long feedback.
- [ ] Prove private answers/candidates/policy from Issue A can never render or act under Issue B.
- [ ] Verify manufacturing handoff creates only unconfirmed draft and factory confirmation remains unreachable.
- [ ] RED→GREEN every reproduced Reviewer defect.
### Task 3: Owner adversarial track

**Files:**
- Modify only after RED proof: Owner OS panels/hooks/routes and Owner E2E/unit tests.

- [ ] Exercise all 11 rooms at desktop/laptop/tablet/mobile widths with long and hostile values.
- [ ] Race Issue, Support, Referrals, Manufacturing, Sales, Customers, Website and System selections/actions.
- [ ] Attack private reveals, payout details, refund reconcile, notes/replies, creator edits, price/question publication and pagination/filtering.
- [ ] Verify stale action results cannot cross records and all irreversible/provider actions remain gated.
- [ ] RED→GREEN every reproduced Owner defect.

### Task 4: Cybersecurity Expert adversarial track

**Files:**
- Modify only after RED proof: auth/session/route validation/privacy/security boundaries and security tests.

- [ ] Probe unauthenticated and malformed direct calls to every `/ops/api/**`, internal design/manufacturing, artwork, webhook and public mutation route.
- [ ] Test CSRF/origin assumptions, ID tampering, stale/replayed actions, oversized payloads, method confusion, cache/privacy headers and error-message secret leakage.
- [ ] Inspect private-data logging, response bodies, DOM, browser storage and signed artwork access for cross-session leakage.
- [ ] Verify webhook signature/store identity boundaries and fail-closed provider behavior without mutating provider state.
- [ ] RED→GREEN every reproduced security defect; do not weaken authentication to make tests pass.

### Task 5: Hater adversarial track

**Files:**
- Modify only after RED proof: any surface this track breaks plus its regression test.

- [ ] Behave like a hostile impatient user: random clicks, rapid navigation, extreme text, empty/Unicode input, zoom/narrow widths, reload mid-action, offline/500 responses.
- [ ] Search every public page for confusing/dead/leaky copy, broken links, browser errors, overflow, unreachable buttons, stale status and contradictory state.
- [ ] Hammer repeated actions and weird ordering that ordinary role tests do not try.
- [ ] Treat “looks bad/feels broken” as a hypothesis; require a measurable reproduction before code changes.
- [ ] RED→GREEN every reproduced defect.
### Task 6: Team 5 integration and final review

**Files:**
- Update: `.engineering/CONTINUATION.json` only after evidence is complete.
- Test: complete unit/typecheck/lint/build/Playwright matrix plus live production-safe smoke if deployment is authorized separately.

- [ ] Merge only reproduced/fixed findings into the Team 5 integration branch and resolve overlapping fixes by root cause, not by last writer.
- [ ] Run focused regressions for every Team 5 bug and repeat flaky/race tests enough times to prove stability.
- [ ] Run complete `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and all Playwright desktop/mobile tests.
- [ ] Re-run awkward-width Owner OS scan and consumer public-copy leak scan.
- [ ] Review git diff for accidental provider/domain/payment/manufacturing behavior changes and secrets.
- [ ] Record a final Team 5 table: role, bug, severity, reproduction, root cause, fix, regression, verification.
- [ ] Only after all engineering-safe findings are resolved and fresh verification is green, report exactly that “Team 5 review is done.”

## Pre-flight conflict scan

| Tracks | Shared surface | Ruling |
| --- | --- | --- |
| Customer + Hater | public experience/UI | Customer owns correctness; Hater may add usability regressions, never duplicate fixes. |
| Reviewer + Owner | Designer/Issue private state | Reviewer owns design queue; Owner owns general Issue/Support/Referrals. Shared privacy fixes use selection-generation guards consistently. |
| Owner + Cybersecurity | private reveal/auth routes | Security findings override convenience; no fix may weaken audited reveal or owner auth. |
| Customer + Cybersecurity | public mutation/session routes | Customer proves UX; Security proves authorization/privacy/idempotency. |
| All five | shared CSS/hooks | Integration controller adjudicates; no track independently broad-refactors shared infrastructure. |

**Ruling:** This environment has no literal subagent-dispatch API/agent CLI. Team 5 is implemented as five isolated worktree/process/ledger tracks with independent role rubrics and a single integration controller. No finding is accepted without independent reproduction and RED→GREEN evidence.
