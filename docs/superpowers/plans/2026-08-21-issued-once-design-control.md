# ISSUED ONCE Design Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver configurable AUTO/MANUAL/HYBRID design processing with global defaults, per-Issue overrides, audited answer reveal, manual artwork upload, rejection feedback, candidate history, owner approval, and configurable Printful-draft handoff.

**Architecture:** Extend the existing design job/candidate spine rather than replace it. Store versioned global design policy in Owner OS website config, per-Issue overrides in a dedicated table, and keep every artwork version in `ops_design_candidates`. Add a manual design runtime that depends on database + private Blob only, while AI generation continues to depend on OpenAI + Blob.

**Tech Stack:** Next.js 16 App Router, TypeScript, Neon Postgres, Vercel Blob, Vercel Queue, Vitest, Playwright, existing Owner OS audit and design/manufacturing services.

**Spec:** `docs/superpowers/specs/2026-08-21-issued-once-design-control-design.md`

## Global Constraints

- Safe default design mode is HYBRID with owner approval required.
- Safe default raw-answer behavior is HIDDEN_UNTIL_REVEALED.
- Safe default manufacturing handoff is WAIT_FOR_OWNER.
- Missing OpenAI must never block manual design work.
- Manual uploads and AI candidates must run the same production artwork quality gate before approval.
- No configuration can bypass `PRINTFUL_ALLOW_CONFIRM`, owner auth, exact typed Issue confirmation, remote draft/file-readiness checks, or final provider `pending` proof.
- Raw answers, private email, shipping data, and payout/payment secrets never enter logs/audit metadata.

---

### Task 1: Persist design policy and per-Issue overrides

**Files:**
- Create: `db/migrations/0028_design_controls.sql`
- Modify: `db/migrations/CURRENT`
- Modify: `db/migrations/README.md`
- Create: `src/server/design/DesignPolicy.ts`
- Create: `src/server/design/PostgresDesignPolicyRepository.ts`
- Test: `tests/unit/design-policy.test.ts`

**Interfaces:**
- Produces: `DesignPolicy`, `DesignMode`, `EffectiveDesignPolicy`, `DesignPolicyRepository.getGlobal()`, `getEffective(issueId)`, `publishGlobal(policy)`, `setIssueOverride(issueId, override)`.

- [ ] **Step 1: Write failing tests** for safe defaults, validation, global policy persistence contract, and per-Issue override precedence.
- [ ] **Step 2: Run `pnpm test tests/unit/design-policy.test.ts`** and verify failures are only missing policy behavior.
- [ ] **Step 3: Add migration and minimal repository/domain implementation.** Migration expands website config type to `DESIGN_POLICY`, adds `issue_design_policy_overrides`, and expands `ops_design_candidates.source` to include `OWNER_UPLOAD` without weakening existing constraints.
- [ ] **Step 4: Run the focused test until green.**
- [ ] **Step 5: Commit.**

### Task 2: Make paid-Issue design dispatch policy-aware

**Files:**
- Modify: `src/app/api/webhooks/safepay/route.ts`
- Modify: `src/server/design/designQueue.ts`
- Create: `src/server/design/designDispatch.ts`
- Test: `tests/unit/design-dispatch-policy.test.ts`
- Test: `tests/integration/paid-order-webhook.integration.test.ts`

**Interfaces:**
- Produces: `dispatchPaidIssueDesign(issueId): Promise<{mode:string; queued:boolean}>`.

- [ ] **Step 1: Write failing tests** proving MANUAL does not enqueue AI, AUTO/HYBRID enqueue when eligible, and duplicate paid webhooks remain idempotent.
- [ ] **Step 2: Run focused tests and observe RED.**
- [ ] **Step 3: Implement policy-aware dispatch while preserving payment truth and notification enqueue.** Manual mode leaves the paid Issue actionable in Owner OS rather than failing the payment webhook.
- [ ] **Step 4: Run focused tests green.**
- [ ] **Step 5: Commit.**

### Task 3: Add audited answer reveal

**Files:**
- Create: `src/server/ops/OpsDesignAnswerService.ts`
- Create: `src/app/ops/api/designer/[issueId]/answers/route.ts`
- Modify: `src/server/ops/runtimeOwnerOs.ts`
- Modify: `src/components/ops/DesignerPanel.tsx`
- Test: `tests/unit/ops-design-answer-reveal.test.ts`
- Test: `tests/e2e/owner-os.spec.ts`

**Interfaces:**
- `reveal(issueId, actorReason): Promise<Array<{questionId,family,prompt,answer}>>`

- [ ] **Step 1: Write failing service/route tests** proving raw answers are not returned before explicit reveal, reveal decrypts only the requested paid Issue, and audit metadata excludes raw answers.
- [ ] **Step 2: Observe RED.**
- [ ] **Step 3: Implement service/route and masked/reveal UI.**
- [ ] **Step 4: Add Playwright coverage for hidden default + reveal interaction.**
- [ ] **Step 5: Run focused unit/browser tests green and commit.**

### Task 4: Add manual artwork upload and candidate preservation

**Files:**
- Create: `src/server/design/ManualArtworkService.ts`
- Create: `src/app/ops/api/designer/[issueId]/upload/route.ts`
- Modify: `src/server/ops/PostgresOpsDesignerStore.ts`
- Modify: `src/server/ops/OpsDesignerService.ts`
- Modify: `src/components/ops/DesignerPanel.tsx`
- Test: `tests/unit/manual-artwork-service.test.ts`
- Test: `tests/unit/ops-designer.test.ts`
- Test: `tests/e2e/owner-os.spec.ts`

**Interfaces:**
- `ManualArtworkService.upload({issueId, bytes, mimeType}): Promise<{candidateId,state}>`

- [ ] **Step 1: Write failing tests** for owner-only PNG upload, size/dimension/Issue-state validation, private Blob storage, `OWNER_UPLOAD` candidate creation, refresh persistence, and no overwrite of history.
- [ ] **Step 2: Observe RED.**
- [ ] **Step 3: Implement manual Blob upload + candidate selection/review path.** Runtime requires database + Blob but not OpenAI.
- [ ] **Step 4: Apply effective `manualUploadApproval` policy through the existing quality gate.**
- [ ] **Step 5: Run focused tests/browser coverage green and commit.**

### Task 5: Add rejection reasons, instructions, and configurable regeneration

**Files:**
- Modify: `src/server/ops/OpsDesignerService.ts`
- Modify: `src/server/ops/PostgresOpsDesignerStore.ts`
- Modify: `src/server/design/DesignService.ts`
- Modify: `src/server/design/DesignGateway.ts`
- Modify: `src/server/design/OpenAIDesignGateway.ts`
- Modify: `src/components/ops/DesignerPanel.tsx`
- Test: `tests/unit/ops-designer.test.ts`
- Test: `tests/unit/design-service.test.ts`

**Interfaces:**
- Reject payload: `{ issueId, reasons: DesignRejectReason[], instruction?: string, next?: 'regenerate'|'reinterpret' }`.

- [ ] **Step 1: Write failing tests** for quick reason codes, optional instruction, audit-safe persistence, AUTO_REGENERATE vs WAIT_FOR_OWNER, and feedback injection into the next private generation request.
- [ ] **Step 2: Observe RED.**
- [ ] **Step 3: Implement minimal service/store/gateway changes.** Original customer answers remain unchanged.
- [ ] **Step 4: Run focused tests green and commit.**

### Task 6: Add global/per-Issue Owner OS controls and manufacturing handoff

**Files:**
- Create: `src/app/ops/api/designer/settings/route.ts`
- Create: `src/app/ops/api/designer/[issueId]/settings/route.ts`
- Modify: `src/components/ops/DesignerPanel.tsx`
- Modify: `src/server/ops/runtimeOwnerOs.ts`
- Modify: `src/server/manufacturing/ManufacturingService.ts`
- Test: `tests/unit/ops-designer-settings.test.ts`
- Test: `tests/unit/manufacturing-service.test.ts`
- Test: `tests/e2e/owner-os.spec.ts`

**Interfaces:**
- Global and per-Issue settings routes expose validated design-policy values only.

- [ ] **Step 1: Write failing tests** for global defaults, per-Issue overrides, audit records, WAIT_FOR_OWNER default, and auto-create-draft behavior that never confirms/charges.
- [ ] **Step 2: Observe RED.**
- [ ] **Step 3: Implement settings routes/UI and unconfirmed-draft handoff policy.**
- [ ] **Step 4: Verify the existing typed factory confirmation + kill switch remain mandatory under every setting.**
- [ ] **Step 5: Run focused tests/browser coverage green and commit.**

### Task 7: Full design-control verification

**Files:**
- Modify: `.engineering/CONTINUATION.json`

- [ ] **Step 1:** Run `pnpm test`.
- [ ] **Step 2:** Run `pnpm typecheck`.
- [ ] **Step 3:** Run `pnpm lint`.
- [ ] **Step 4:** Run `pnpm build`.
- [ ] **Step 5:** Run `pnpm test:e2e` and the existing live production Browser QA smoke without payment/manufacturing side effects.
- [ ] **Step 6:** Record exact RED/GREEN commits, run IDs, migration-pending status, and remaining external gates in `.engineering/CONTINUATION.json`.
- [ ] **Step 7:** Commit checkpoint.
