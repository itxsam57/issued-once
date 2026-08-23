# Live Owner OS and Full Workflow QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Owner OS continuously reflect canonical production truth and prove every sellable customer journey and owner control before the next owner handoff.

**Architecture:** Introduce a focused `useLiveResource` hook for read-only owner data: immediate fetch, visible-tab polling, focus refresh, stale-response protection, and manual refresh. Panels keep their own domain-specific filters/actions but delegate freshness lifecycle to the hook. Browser QA then covers Tee/Hat/Tote preview purchases, repeat-order contact behavior, Owner OS rooms/actions, and live response changes after mount.

**Tech Stack:** React 19, Next.js 16, TypeScript, Playwright, Vitest, Neon PostgreSQL read verification, GitHub Actions/Vercel deployment.

**Spec:** `docs/superpowers/specs/2026-08-23-workflow-audit-otp-live-owner-design.md`

## Global Constraints

- Owner reads must remain `cache: 'no-store'`.
- Do not turn polling into mutation retries.
- Do not enable Printful production confirmation.
- Do not create real Safepay charges for QA.
- Do not apply migration `0029_creator_referrals.sql`.
- Preserve pagination/filter semantics while refreshing first pages.
- Use TDD RED before behavior changes.

---

### Task 1: Reusable live-resource lifecycle

**Files:**
- Create: `src/components/ops/useLiveResource.ts`
- Create: `tests/unit/owner-live-resource.test.tsx`

**Interfaces:**

```ts
useLiveResource<T>({
  load: () => Promise<T>,
  intervalMs: number,
  enabled?: boolean,
}): {
  data: T | null;
  error: string | null;
  loading: boolean;
  updatedAt: Date | null;
  refresh: () => Promise<void>;
}
```

- [ ] **Step 1: Write RED hook tests**

Using fake timers, assert immediate load, interval refresh only while `document.visibilityState === 'visible'`, refresh on `focus`/`visibilitychange`, and a slower older request cannot overwrite a newer response.

- [ ] **Step 2: Run RED**

Run: `pnpm test -- tests/unit/owner-live-resource.test.tsx`
Expected: FAIL because hook does not exist.

- [ ] **Step 3: Implement hook with request generation guard**

Increment a generation counter per refresh and apply a response only when its generation equals the latest requested generation. Clear interval/listeners on unmount.

- [ ] **Step 4: Run GREEN**

Run targeted test.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add live owner resource lifecycle`

---

### Task 2: Home, Attention, Sales and Issues become live

**Files:**
- Modify: `src/components/ops/HomePanel.tsx`
- Modify: `src/components/ops/AttentionPanel.tsx`
- Modify: `src/components/ops/SalesPanel.tsx`
- Modify: `src/components/ops/IssuesPanel.tsx`
- Modify: `src/components/ops/owner-os.module.css`
- Modify: `tests/e2e/owner-os.spec.ts`

**Interfaces:**
- Home/Attention interval: 10_000 ms.
- Sales/Issues interval: 20_000 ms.
- Home renders `UPDATED <localized timestamp>` from hook `updatedAt`.
- Manual `CHECK AGAIN`/`REFRESH` invokes hook refresh.

- [ ] **Step 1: Write RED browser freshness test**

Mock `/ops/api/dashboard` to return 2 paid orders on first call and 3 including `IO-GUUM-8UR9` on the next refresh; prove the visible Home values/activity update without page reload. Do the same for Issues first-page refresh while preserving selected filters.

- [ ] **Step 2: Run RED**

Run: `pnpm test:e2e -- tests/e2e/owner-os.spec.ts`
Expected: FAIL because mounted panels do not refresh.

- [ ] **Step 3: Adopt `useLiveResource` without changing API payloads**

For Issues, keep debounced filter/search load and use the live refresh only for the non-append first page. `LOAD MORE` remains explicit and appended pages are not duplicated.

- [ ] **Step 4: Run GREEN desktop + mobile**

Run same Playwright file.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `fix: keep owner sales and issue truth live`

---

### Task 3: Operational panels refresh safely

**Files:**
- Modify: `src/components/ops/DesignerPanel.tsx`
- Modify: `src/components/ops/ManufacturingPanel.tsx`
- Modify: `src/components/ops/SupportPanel.tsx`
- Modify: `src/components/ops/CustomersPanel.tsx`
- Modify: `src/components/ops/SystemPanel.tsx`
- Modify: `tests/e2e/owner-os.spec.ts`
- Modify: `tests/e2e/designer-controls.spec.ts`

**Interfaces:**
- Designer/Manufacturing/Support/System: 15_000 ms while visible.
- Customers: 30_000 ms while visible; email search remains debounced and server-side HMAC matched.
- Existing mutations call `refresh()` after success; polling never submits actions.

- [ ] **Step 1: Add RED tests for external state changes**

After initial render, change fixture response from queued -> review for Designer, open -> closed for Support, and readiness `missing` -> `configured`; assert UI changes after manual/focus/interval refresh without navigation.

- [ ] **Step 2: Run RED**

Run owner/designer Playwright specs.
Expected: FAIL on stale mounted data.

- [ ] **Step 3: Integrate hook while preserving editor/selection state**

When refreshed rows no longer contain the selected item, clear selection. When they still contain it, replace selected snapshot with the refreshed row. Never auto-click or auto-submit production controls.

- [ ] **Step 4: Run GREEN**

Run targeted Playwright on desktop + mobile.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `fix: refresh owner operational rooms safely`

---

### Task 4: Every sellable product completes a safe preview purchase

**Files:**
- Create: `tests/e2e/catalog-purchase-matrix.spec.ts`
- Modify: `tests/e2e/public-physical-flow.spec.ts`
- Modify: `tests/e2e/repeat-order-lifecycle.spec.ts`

**Interfaces:**
- Matrix products: Tee USD 32.00; Hat USD 34.00; Tote USD 36.00.
- Tee checks representative smallest/largest sizes plus every color API option in service/unit tests; browser matrix completes at least one valid variant per form.
- Hat/Tote OS flow must skip invalid size assumptions.

- [ ] **Step 1: Write browser matrix tests**

For each `tee`, `hat`, `tote`: complete questions/profile, lock form, valid size/color, contact decision, shipping with required phone + province/state/region, commitment amount, preview checkout, and verify a unique preview payment ID.

- [ ] **Step 2: Add rejection scenarios**

Exercise invalid/unavailable object, size, color, malformed address/phone route responses and assert visible feedback/no stuck button. Add checkout cancel/back and confirm customer can begin next order.

- [ ] **Step 3: Run matrix desktop + mobile**

Run: `pnpm test:e2e -- tests/e2e/catalog-purchase-matrix.spec.ts tests/e2e/public-physical-flow.spec.ts tests/e2e/repeat-order-lifecycle.spec.ts`
Expected: PASS on both Playwright projects, no real external payment request.

- [ ] **Step 4: Commit**

Commit message: `test: prove every sellable customer workflow`

---

### Task 5: Every Owner OS room/action has interaction proof

**Files:**
- Modify: `tests/e2e/owner-os.spec.ts`
- Modify: `tests/e2e/designer-controls.spec.ts`
- Modify: `tests/e2e/live-owner-preview.mjs` only if the existing smoke lacks a safe read assertion.

- [ ] **Step 1: Cover navigation/session controls**

Assert login, logout request, private route/session protection, and each room heading: Home, Issues, Designer, Manufacturing, Sales, Referrals, Customers, Support, Website, System, Audit.

- [ ] **Step 2: Cover actions or explicit safe disabled gates**

Assert: Attention `CHECK AGAIN`; recovery contract; Issues filters/search/load-more/detail/reveal reason gate; Designer permitted actions and unavailable-provider states; Manufacturing production confirmation stays disabled; Sales 7/30/90/Lifetime; Customers search/load-more; Support reveal/note/reply/status/retry; Website price publish/question editor; System `CHECK AGAIN`; Audit list; Referrals read controls.

- [ ] **Step 3: Run browser QA desktop + mobile**

Run: `pnpm test:e2e -- tests/e2e/owner-os.spec.ts tests/e2e/designer-controls.spec.ts`
Expected: PASS with no unhandled fixture route and no horizontal overflow.

- [ ] **Step 4: Commit**

Commit message: `test: harden every owner control plane action`

---

### Task 6: Full release verification and production read proof

**Files:**
- Modify: `.engineering/CONTINUATION.json`
- Update PR description/comments with exact evidence.

- [ ] **Step 1: Full automated suite**

Run in CI/branch: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, full Playwright Browser QA desktop + mobile.
Expected: all green.

- [ ] **Step 2: Code review gate**

Review changed files for secret exposure, polling/mutation coupling, continuity replay, OTP bypass, race/idempotency regressions, migration drift, and test-only paths reachable in production.

- [ ] **Step 3: Merge to `feat/mystery-foundation` only after green**

Keep PR #3 draft; this task does not promote to `main`.

- [ ] **Step 4: Post-merge canonical CI + Browser QA + Vercel deployment**

Require fresh successful evidence on the canonical merge head.

- [ ] **Step 5: Production Neon read-only invariants**

Confirm newest paid attempt `e6af01a5-1639-4184-b155-d69c842013e7` still has exactly one Issue `IO-GUUM-8UR9`; verify counts, latest design state, zero unintended manufacturing, and `0029` schema remains absent.

- [ ] **Step 6: Owner API/data truth proof**

Use production repository/API-safe evidence to prove the newest Issue is included by current Owner OS queries; do not create a charge just for this proof.

- [ ] **Step 7: Real OTP delivery proof if safe**

Send at most one normal OTP when needed, confirm Gmail receives a uniquely tagged subject matching the active request, and never echo the code into logs/reporting.

- [ ] **Step 8: Update Continuation Governor**

Set the next stop state based only on actual remaining owner gate. Record exact heads/run IDs, production counts, OTP proof status, and preserved gates.

- [ ] **Step 9: Commit governor metadata**

Commit message: `chore: checkpoint workflow audit release evidence`
