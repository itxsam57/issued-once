# ISSUED ONCE Consumer Readiness Finish v4 Implementation Plan

**Goal:** exhaust every remaining engineering-safe code, regression, browser-QA, read-only live-proof, and canonical-ledger item without crossing owner/provider/irreversible gates.

**Verified engineering base:** `4ea10081cb0de2f5de49eb46f973649a5fba3a51` (`infra/hostinger-migration-20260823`)

**Verified deployed wrapper:** `909d84832b345ecd05b03ec30ad06e5c32000908` (`release/hostinger-v2-candidate-20260824`)

**Tree identity at audit start:** both refs use `409710dac112739ca8dc787c1e2b7db552b86188`.

## Task 1 — Restore a warning-free engineering gate

Files:
- `src/components/ops/SalesPanel.tsx`
- `src/components/ops/IssuesPanel.tsx`
- `src/components/ops/CustomersPanel.tsx`
- `src/server/payments/PaymentService.ts`
- `tests/unit/release-boundaries.test.ts`

1. Preserve the observed RED: `pnpm lint` reports exactly five warnings and zero errors.
2. Remove the three whole-object Hook dependency warnings by destructuring the stable live-resource members actually consumed; do not add the changing aggregate object to effect dependencies.
3. Remove the two genuinely unused bindings without changing side effects.
4. Run focused Owner live-refresh, payment-webhook, and release-boundary tests.
5. Run lint again and require zero warnings and zero errors.
## Task 2 — Reconcile every consumer-readiness row against fresh evidence

1. Compare CR-01 through CR-30 with the exact current tree, merged PR history, current CI/Browser QA, and safe live runs.
2. Credit only evidence that satisfies the row contract; never promote provider/live rows from synthetic tests.
3. Inspect the current live question smoke, support canary, boundary audit, catalog activation attempt, and public merchant surfaces for any safe proof that closes stale evidence gaps.
4. Treat missing production privacy keys, Safepay runtime, Printful API/mapping/signed-webhook configuration, ACTIVE catalog authority, real provider transactions, manufacturing confirmation, and canonical-domain cutover as hard owner/provider gates unless repository authority proves otherwise.
5. Do not weaken fail-closed checks merely to make live workflows green.

## Task 3 — Synchronize canonical continuation and checkpoints

Files:
- `.engineering/CONTINUATION.json`
- `docs/superpowers/plans/2026-08-31-issued-once-consumer-readiness-master-plan.md`
- `docs/superpowers/plans/2026-09-01-cr27-live-release-checkpoint.md`

1. Replace stale integration/release SHAs with exact reconciled descendants.
2. Record PR #88, exact CI/Browser QA, current Hostinger live-boundary/support evidence, and the owner-catalog activation rejection caused by absent Printful mapping.
3. Remove resolved stale gates such as the previously absent GitHub operations-token proof; preserve still-unproven paid-customer support/CR-28 evidence.
4. Record merchant-readiness evidence without inventing legal truth or owner attestations.
5. Set the continuation stop reason only after all remaining safe work and full verification complete.
## Task 4 — Full gates and integration closure

1. Run focused tests, full unit suite, typecheck, warning-free lint, production build, and diff-check from the verified engineering base.
2. Run Browser QA for any Owner/customer UI path touched.
3. Push a focused branch and open a PR to `infra/hostinger-migration-20260823`; use normal repository gates only.
4. Merge only after required CI and Browser QA pass, then verify the exact merged integration SHA and tree.
5. Inspect post-merge gates and perform only safe read-only live verification. Preserve every production mutation gate defined by canonical authority.
6. Stop only when the remaining items are genuine owner/configuration/production/provider gates, or if an external blocker prevents further safe engineering.

## Required final evidence

- exact engineering base and final integration SHA/tree;
- focused and full local verification results;
- exact-head and post-merge CI/Browser QA results;
- row-by-row remaining owner/provider gates;
- `git diff --check <verified-project-base>...HEAD` PASS.
