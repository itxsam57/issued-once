# CR-22 Owner Refund Reconciliation Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing provider-derived Safepay refund reconciliation path executable from Owner OS without adding any local refund authority.

**Architecture:** Keep Safepay Dashboard as the only refund initiator. Reuse the existing authenticated `/ops/api/issues/[issueId]/refund/reconcile` route and its exact typed confirmation, expose only a provider-verification control in `IssueDetailPanel`, and reload Issue detail after reconciliation so all displayed state still comes from canonical server truth. Do not add a refund API call, caller-supplied money, provider payload display, or a browser-side `REFUNDED` mutation.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest + Testing Library, Playwright, pnpm.

**Spec:** `docs/superpowers/plans/2026-08-31-issued-once-consumer-readiness-master-plan.md`

## Global Constraints

- Do not deploy production or mutate the Hostinger selected branch/environment.
- Do not apply production migration `0036_durable_artwork_objects.sql`.
- Do not apply referral migrations `0029/0034/0035` or activate referrals.
- Do not create a real Safepay charge or refund solely for QA.
- Do not enable or perform Printful production confirmation.
- Do not cut over `issuedonce.shop` or fabricate merchant public-location/legal identity.
- Do not weaken mystery-store, privacy, authentication, payment, Issue, or provider-truth behavior to make tests pass.
- Safepay Dashboard remains the only refund initiator; Owner OS may only request authenticated reconciliation of the stored provider tracker.
- The browser must never supply refund amount, currency, payment status, provider secrets, or private provider payloads.

---

### Task 1: Bridge Owner OS to existing provider reconciliation

**Files:**
- Modify: `tests/unit/refund-operations-owner-runbook.test.tsx`
- Modify: `src/components/ops/IssueDetailPanel.tsx`

**Interfaces:**
- Consumes: `POST /ops/api/issues/[issueId]/refund/reconcile` with body `{ confirmation: string }` and exact phrase `VERIFY SAFEPAY <Issue Code>`.
- Produces: an Owner OS control that can only request Safepay verification, displays only safe outcome text, and refreshes Issue detail from the server after a successful reconciliation response.

- [x] **Step 1: Write the failing UI regression**

Extend `tests/unit/refund-operations-owner-runbook.test.tsx` to require an exact-confirmation input and a `VERIFY SAFEPAY TRUTH` button. Assert the button is disabled before the exact phrase, becomes enabled only for `VERIFY SAFEPAY IO-ABCD-EFGH`, and posts only `{ confirmation: 'VERIFY SAFEPAY IO-ABCD-EFGH' }` to the existing Issue-scoped reconciliation route. Assert no browser-supplied amount, currency, status, or provider payload enters the request.

- [x] **Step 2: Run the regression and prove RED**

Run:

```bash
corepack pnpm exec vitest run tests/unit/refund-operations-owner-runbook.test.tsx
```

Expected: FAIL because `IssueDetailPanel` currently exposes only the Safepay reference/runbook text and no executable reconciliation control.

- [x] **Step 3: Implement the minimum Owner OS bridge**

In `IssueDetailPanel`, add component-local reconciliation state keyed to the selected Issue. Require the exact phrase `VERIFY SAFEPAY ${detail.issueCode}` before enabling the action. POST only that confirmation to `/ops/api/issues/${encodeURIComponent(issueId)}/refund/reconcile`. On a successful `pending` result, state that local payment truth is unchanged; on `refunded`, state that provider-confirmed truth was reconciled. Reload Issue detail from the existing GET route after success. Do not accept or calculate refund money in the browser.

- [x] **Step 4: Run focused refund gates**

Run:

```bash
corepack pnpm exec vitest run tests/unit/refund-operations-owner-runbook.test.tsx tests/unit/ops-refund-route.test.ts tests/unit/ops-refund-service.test.ts tests/unit/payment-refund-reconciliation.test.ts tests/unit/payment-refund-safety.test.ts tests/unit/payment-webhook-recovery.test.ts tests/unit/finalize-refunded-attempt.test.ts
```

Expected: PASS.

- [x] **Step 5: Run repository acceptance gates**

Run unit tests, typecheck, lint, production build, and Playwright Browser QA using the same commands as `.github/workflows/ci.yml` and `.github/workflows/browser-qa.yml`.

- [x] **Step 6: Record exact evidence**

Update `docs/superpowers/plans/2026-08-31-issued-once-consumer-readiness-master-plan.md` and `.engineering/CONTINUATION.json` without changing CR-22 from `CODE_READY`: record the newly closed Owner OS execution gap, exact RED/GREEN commits and gate evidence, keep real Safepay full-refund proof parked as the remaining live boundary, and preserve the current later readiness/CR-27 state.

- [ ] **Step 7: Commit, push, PR, exact-head verification**

Commit the focused code/test/evidence changes, push the feature branch, open a PR against `infra/hostinger-migration-20260823`, require CI and Browser QA green, and do not merge unless the independent exact-head verifier approves the same SHA. Run both integration-base and user-required `git diff --check` checks on the final head.
