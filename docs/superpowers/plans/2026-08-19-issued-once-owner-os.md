# ISSUED ONCE Owner OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the existing authenticated `/ops` room into the canonical ISSUED ONCE Owner OS covering live business visibility, Issues/customers, sensitive reveals, Designer Studio, manufacturing, sales, support, website controls, system health, recovery, and audit without bypassing existing payment/design/factory safety rules.

**Architecture:** Keep `/ops` as the only privileged control plane. Add focused server-side repositories/services/read models under `src/server/ops`, capability-specific `/ops/api/*` routes, and smaller client sections under `src/components/ops`. Canonical commercial truth remains in existing payment/Issue/design/manufacturing/support tables; Owner OS adds append-only audit records, owner notes, design candidate history, versioned website configuration, and bounded aggregate/read models.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Neon/Postgres 18, Vitest, Testing Library, Playwright, Vercel Blob/Queue, existing Safepay/OpenAI/Resend/Printful services.

**Spec:** `docs/superpowers/specs/2026-08-19-issued-once-owner-os-design.md`

## Global Constraints

- Branch remains `feat/mystery-foundation`; never write `main` directly.
- Canonical identity remains Issue ID / Issue Code, never email/name/provider IDs.
- No browser-to-database or browser-to-provider-secret access.
- Raw answers, email, phone, shipping and decrypted support/brief data stay masked by default.
- Every privileged write records an append-only audit event with safe metadata only.
- No generic SQL editor, generic status editor, or generic unrestricted CRUD endpoint.
- Browser redirect never creates paid truth.
- Designer cannot manufacture without approved/current artwork.
- Printful confirmation continues to require owner session, `PRINTFUL_ALLOW_CONFIRM=true`, exact typed Issue Code confirmation, and last-moment state reload.
- Historical Issues/quotes remain immutable when website catalog/questions change.
- Owner OS list APIs use bounded queries/cursor pagination; never return full tables.
- Production credentials, production migrations, payment charges and factory confirmation remain fail-closed until explicit provider/database gates are proven.

---

## File Structure

### Existing files to split/extend
- `src/app/ops/page.tsx` — authenticated Owner OS entry.
- `src/components/ops/OpsConsole.tsx` — shrink into Owner OS shell/navigation; move domain UI into focused components.
- `src/components/ops/ops.module.css` — shared Owner OS shell tokens/layout; domain-specific CSS may split if file becomes unwieldy.
- `src/server/ops/PostgresOpsRepository.ts` — retain compact Issue list/read capability; richer reads move into dedicated repositories.
- `src/server/ops/ReadinessService.ts` — remains provider readiness source; System page composes it.

### New server units
- `src/server/ops/OpsAuditRepository.ts`
- `src/server/ops/PostgresOpsAuditRepository.ts`
- `src/server/ops/OpsAuditService.ts`
- `src/server/ops/OpsDashboardRepository.ts`
- `src/server/ops/PostgresOpsDashboardRepository.ts`
- `src/server/ops/OpsIssueDetailRepository.ts`
- `src/server/ops/PostgresOpsIssueDetailRepository.ts`
- `src/server/ops/OpsPrivateRevealService.ts`
- `src/server/ops/OpsDesignerService.ts`
- `src/server/ops/OpsManufacturingService.ts`
- `src/server/ops/OpsSalesRepository.ts`
- `src/server/ops/PostgresOpsSalesRepository.ts`
- `src/server/ops/OpsCustomerRepository.ts`
- `src/server/ops/PostgresOpsCustomerRepository.ts`
- `src/server/ops/OpsSupportService.ts`
- `src/server/ops/OpsWebsiteConfigRepository.ts`
- `src/server/ops/PostgresOpsWebsiteConfigRepository.ts`
- `src/server/ops/OpsAttentionRepository.ts`
- `src/server/ops/PostgresOpsAttentionRepository.ts`

### New client sections
- `src/components/ops/OwnerOsShell.tsx`
- `src/components/ops/HomePanel.tsx`
- `src/components/ops/IssuesPanel.tsx`
- `src/components/ops/IssueDetailPanel.tsx`
- `src/components/ops/DesignerPanel.tsx`
- `src/components/ops/ManufacturingPanel.tsx`
- `src/components/ops/SalesPanel.tsx`
- `src/components/ops/CustomersPanel.tsx`
- `src/components/ops/SupportPanel.tsx`
- `src/components/ops/WebsitePanel.tsx`
- `src/components/ops/SystemPanel.tsx`
- `src/components/ops/AuditPanel.tsx`
- `src/components/ops/AttentionPanel.tsx`

### Forward migrations
- `db/migrations/0020_owner_os_audit_notes.sql`
- `db/migrations/0021_owner_os_design_candidates.sql`
- `db/migrations/0022_owner_os_website_config.sql`
- update `db/migrations/CURRENT` to `0022_owner_os_website_config.sql`

---

### Task 1: Owner OS audit foundation and forward migrations

**Files:**
- Create: `db/migrations/0020_owner_os_audit_notes.sql`
- Create: `src/server/ops/OpsAuditRepository.ts`
- Create: `src/server/ops/PostgresOpsAuditRepository.ts`
- Create: `src/server/ops/OpsAuditService.ts`
- Test: `tests/unit/ops-audit.test.ts`

**Interfaces:**
- Produces `OpsAuditService.record(input)` and cursor-paginated `listRecent(input)` used by every later privileged action and Audit panel.
- Audit metadata is JSON-safe and must reject known private keys before persistence.

- [ ] **Step 1: Write the failing audit test**

```ts
import { expect, test } from 'vitest';
import { OpsAuditService } from '@/server/ops/OpsAuditService';

test('records safe owner action and rejects private plaintext metadata', async () => {
  const written: unknown[] = [];
  const service = new OpsAuditService({
    append: async (event) => { written.push(event); },
    listRecent: async () => [],
  });

  await service.record({ actor: 'OWNER', action: 'DESIGN_APPROVED', issueId: '11111111-1111-1111-1111-111111111111', targetType: 'design_job', targetId: 'd1', reason: null, safeMetadata: { state: 'APPROVED' } });
  expect(written).toHaveLength(1);
  await expect(service.record({ actor: 'OWNER', action: 'OPS_PRIVATE_REVEAL', issueId: null, targetType: 'issue', targetId: 'i1', reason: 'support', safeMetadata: { email: 'private@example.com' } })).rejects.toThrow(/private metadata/i);
});
```

- [ ] **Step 2: Run targeted test**

Run: `pnpm test -- tests/unit/ops-audit.test.ts`
Expected: FAIL because audit service/repository do not exist.

- [ ] **Step 3: Add forward migration**

Create append-only `ops_audit_events` plus `ops_internal_notes`. Required audit fields: UUID id, actor type, action type, nullable Issue ID, target type/id, nullable reason, safe metadata JSON, created timestamp. Notes reference Issue, contain owner-authored internal text, and timestamps; notes are private Owner OS data, not customer-visible.

- [ ] **Step 4: Implement repository/service**

```ts
export type OpsAuditInput = {
  actor: 'OWNER';
  action: string;
  issueId: string | null;
  targetType: string;
  targetId: string;
  reason: string | null;
  safeMetadata: Record<string, string | number | boolean | null>;
};

export interface OpsAuditRepository {
  append(input: OpsAuditInput): Promise<void>;
  listRecent(input: { cursor?: string | null; limit: number }): Promise<{ items: OpsAuditRecord[]; nextCursor: string | null }>;
}
```

Reject metadata keys matching `answer|email|phone|address|ciphertext|secret|token|apiKey|supportMessage|briefPlaintext` case-insensitively.

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm test -- tests/unit/ops-audit.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat: add Owner OS audit foundation"`

---

### Task 2: Dashboard read model and Owner OS shell

**Files:**
- Create: `src/server/ops/OpsDashboardRepository.ts`
- Create: `src/server/ops/PostgresOpsDashboardRepository.ts`
- Create: `src/app/ops/api/dashboard/route.ts`
- Create: `src/components/ops/OwnerOsShell.tsx`
- Create: `src/components/ops/HomePanel.tsx`
- Modify: `src/components/ops/OpsConsole.tsx`
- Modify: `src/components/ops/ops.module.css`
- Test: `tests/unit/ops-dashboard.test.ts`
- Test: `tests/unit/owner-os-shell.test.tsx`

**Interfaces:**
- `getDashboard(now)` returns attention counts, sales windows, operational counts and recent safe activity.
- Client shell controls tabs locally; all data comes from authenticated `/ops/api/*` routes.

- [ ] **Step 1: Write failing dashboard aggregate test**

Use a fake SQL executor and assert generated result exposes `today`, `sevenDays`, `thirtyDays`, `lifetime`, `refundedMinor`, `averageOrderMinor`, operational counts, and max 30 recent events.

- [ ] **Step 2: Write failing shell test**

Render `OwnerOsShell` and assert navigation contains Home, Issues, Designer, Manufacturing, Sales, Customers, Support, Website, System, Audit and that raw private labels/data are absent.

- [ ] **Step 3: Implement bounded SQL aggregates**

Compute from `payment_attempts`, `issues`, `design_jobs`, `manufacturing_jobs`, `notification_deliveries`, `support_requests`, `issue_events`. Use fixed date predicates and aggregate SQL; do not fetch rows then aggregate in JS.

- [ ] **Step 4: Implement authenticated dashboard route**

Route denies missing ops session with 401 and returns safe JSON only.

- [ ] **Step 5: Split `OpsConsole` into shell + Home**

Keep existing logout/readiness behavior available but move domain UI out of the monolith.

- [ ] **Step 6: Run targeted tests**

Run: `pnpm test -- tests/unit/ops-dashboard.test.ts tests/unit/owner-os-shell.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

`git commit -m "feat: add Owner OS live dashboard"`

---

### Task 3: Issues ledger, search, filters and canonical Issue detail

**Files:**
- Create: `src/server/ops/OpsIssueDetailRepository.ts`
- Create: `src/server/ops/PostgresOpsIssueDetailRepository.ts`
- Modify: `src/server/ops/PostgresOpsRepository.ts`
- Modify: `src/app/ops/api/issues/route.ts`
- Create: `src/app/ops/api/issues/[issueId]/route.ts`
- Create: `src/components/ops/IssuesPanel.tsx`
- Create: `src/components/ops/IssueDetailPanel.tsx`
- Test: `tests/unit/ops-issues.test.ts`

**Interfaces:**
- `listIssues({ cursor, limit, search, filters })` returns masked rows and `nextCursor`.
- `getIssueDetail(issueId)` returns payment/design/manufacturing/notification/support/timeline data but no decrypted PII/answers/support text/brief.

- [ ] **Step 1: Write failing privacy/search tests**

Assert Issue list/detail never returns ciphertext, raw email/phone/address/answers, and supports Issue Code, provider reference, Printful order ID and tracking search.

- [ ] **Step 2: Implement cursor pagination**

Cursor is `(updated_at,id)` encoded server-side. Limit 50 default, max 100. No deep OFFSET.

- [ ] **Step 3: Implement masked detail composition**

Join canonical IDs and return private-field presence flags such as `hasVerifiedEmail`, `hasShipping`, `hasAnswers`, `hasPrivateBrief`, `hasSupportMessage`.

- [ ] **Step 4: Build ledger/detail UI**

Search/filter bar, state chips, expandable/open detail, canonical timeline. No private plaintext.

- [ ] **Step 5: Run tests**

Run: `pnpm test -- tests/unit/ops-issues.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat: add Owner OS Issue ledger"`

---

### Task 4: Audited sensitive-data reveal

**Files:**
- Create: `src/server/ops/OpsPrivateRevealService.ts`
- Create: `src/app/ops/api/issues/[issueId]/reveal/route.ts`
- Modify: `src/components/ops/IssueDetailPanel.tsx`
- Test: `tests/unit/ops-private-reveal.test.ts`

**Interfaces:**
- `reveal({ issueId, category, reason })` where category is `contact | shipping | answers | design_brief | support_message`.
- Returns only requested category plaintext, `Cache-Control: no-store`, and records `OPS_PRIVATE_REVEAL` audit event before response completion.

- [ ] **Step 1: Write failing reveal tests**

Assert blank reason rejected, cross-Issue IDs rejected, only requested category decrypted, response never includes unrelated private data, and audit receives category/reason but not plaintext.

- [ ] **Step 2: Implement service using existing encryption primitives**

Resolve all private records by Issue foreign-key chain. Never lookup by email/name.

- [ ] **Step 3: Implement route and UI reveal drawer**

Require explicit reason input; reveal one category at a time; clear plaintext when drawer closes or Issue changes.

- [ ] **Step 4: Run tests**

Run: `pnpm test -- tests/unit/ops-private-reveal.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add audited private Issue reveals"`

---

### Task 5: Designer Studio with candidate/version history

**Files:**
- Create: `db/migrations/0021_owner_os_design_candidates.sql`
- Create: `src/server/ops/OpsDesignerService.ts`
- Create: `src/app/ops/api/designer/route.ts`
- Create routes under `src/app/ops/api/designer/[issueId]/` for `approve`, `reject`, `retry`, `reinterpret`, `regenerate`, `select`.
- Create: `src/components/ops/DesignerPanel.tsx`
- Modify existing design queue/service only through capability methods; do not bypass its state machine.
- Test: `tests/unit/ops-designer.test.ts`

**Interfaces:**
- Candidate records are append-only generations linked to Issue/design job, artwork private URL, dimensions, model/provider, safe summary, active/selected flags and timestamps.
- Full private brief remains behind Task 4 reveal; Designer list/detail returns only safe production summary by default.

- [ ] **Step 1: Write failing candidate-history test**

Assert regeneration creates a new candidate and does not overwrite prior artwork. Selecting a candidate after a Printful draft exists must reject with reconciliation-required error.

- [ ] **Step 2: Add migration and repository behavior**

Persist candidate history and one selected candidate per Issue using a safe uniqueness constraint/transaction.

- [ ] **Step 3: Implement capability actions**

`retry` only FAILED; `reinterpret` queues a new interpretation version; `regenerate` queues new image from current/owner-edited private brief; `approve` and `select` use existing design approval rules and audit every action.

- [ ] **Step 4: Build Designer UI**

Queues, large signed artwork preview, QA results, safe summary, candidate comparison, actions. Original answers/full brief require Task 4 reveal.

- [ ] **Step 5: Run tests**

Run: `pnpm test -- tests/unit/ops-designer.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat: add Owner OS Designer Studio"`

---

### Task 6: Manufacturing Control and contextual recovery

**Files:**
- Create: `src/server/ops/OpsManufacturingService.ts`
- Create: `src/app/ops/api/manufacturing/route.ts`
- Reuse/extend existing `/ops/api/manufacturing/create-draft` and `/confirm` routes.
- Create contextual retry/quarantine/reconcile routes only where supported.
- Create: `src/components/ops/ManufacturingPanel.tsx`
- Test: `tests/unit/ops-manufacturing.test.ts`

**Interfaces:**
- All writes delegate to existing `ManufacturingService`/Printful gateway; no direct state edits.
- `confirm` still requires Issue reload, approved design, no blocking pre-production payment exception, kill switch and exact confirmation phrase.

- [ ] **Step 1: Write failing safety tests**

Cover unpaid/refunded/EXCEPTION Issue, stale draft, wrong confirmation phrase, kill switch off, existing remote draft recovery by Issue Code, and retry idempotency.

- [ ] **Step 2: Implement manufacturing list/detail read model**

Include logical SKU, mapping, placement, artwork dimensions, provider IDs/status, tracking and verified provider events.

- [ ] **Step 3: Implement contextual recovery service**

Expose only `createDraft`, `retryDraft`, `quarantine`, `confirmProduction`, and reconciliation status. No generic status setter.

- [ ] **Step 4: Build Manufacturing UI**

Queues and safe irreversible confirmation UX. Show SAFE/ARMED factory switch prominently.

- [ ] **Step 5: Run tests**

Run: `pnpm test -- tests/unit/ops-manufacturing.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat: add Owner OS manufacturing control"`

---

### Task 7: Support Desk, owner notes and notification recovery

**Files:**
- Create: `src/server/ops/OpsSupportService.ts`
- Create: `src/app/ops/api/support/route.ts`
- Create capability routes for note, close, reopen, reply, retry-notification.
- Create: `src/components/ops/SupportPanel.tsx`
- Test: `tests/unit/ops-support.test.ts`

**Interfaces:**
- Support list returns masked message presence/state; plaintext message uses Task 4 reveal.
- Reply uses verified contact delivery boundary, not plaintext email stored in new tables.

- [ ] **Step 1: Write failing support tests**

Assert list does not decrypt message; note is private/internal; close/reopen audited; reply resolves verified contact by Issue; notification retry only FAILED and stays idempotent.

- [ ] **Step 2: Implement service/routes**

Use existing Resend/notification support paths and append audit events.

- [ ] **Step 3: Build Support UI**

OPEN/CLOSED queues, Issue state context, internal notes, reveal button, reply action, failed-notification retry.

- [ ] **Step 4: Run tests**

Run: `pnpm test -- tests/unit/ops-support.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add Owner OS support desk"`

---

### Task 8: Versioned Website controls for retail catalog and Question Vault

**Files:**
- Create: `db/migrations/0022_owner_os_website_config.sql`
- Update: `db/migrations/CURRENT`
- Create: `src/server/ops/OpsWebsiteConfigRepository.ts`
- Create: `src/server/ops/PostgresOpsWebsiteConfigRepository.ts`
- Create routes under `src/app/ops/api/website/catalog` and `src/app/ops/api/website/questions`.
- Create: `src/components/ops/WebsitePanel.tsx`
- Modify runtime catalog/question loaders to prefer published DB version with env/source fallback only for bootstrap.
- Test: `tests/unit/ops-website-config.test.ts`

**Interfaces:**
- Published versions are immutable snapshots; edits create drafts/new versions.
- Past experiences keep persisted prompt snapshots; past quotes/payments/Issues keep frozen retail values.

- [ ] **Step 1: Write failing versioning tests**

Assert price/question edits create new version, do not mutate published/history, inactive variant cannot publish without required factory mapping when manufacturing enabled, and question family coverage cannot publish with any family empty.

- [ ] **Step 2: Add migration**

Add catalog versions/items and question-vault configuration versions referencing existing question definitions rather than rewriting historical rows.

- [ ] **Step 3: Implement repository/publish service**

Transactional publish sets one active version; audit includes version ID and safe counts only.

- [ ] **Step 4: Build Website UI**

Catalog availability/prices/colors/sizes and Question Vault active/retired/weights/version controls. No free-form page builder.

- [ ] **Step 5: Run tests**

Run: `pnpm test -- tests/unit/ops-website-config.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat: add Owner OS website controls"`

---

### Task 9: Sales analytics and customer grouping

**Files:**
- Create: `src/server/ops/OpsSalesRepository.ts`
- Create: `src/server/ops/PostgresOpsSalesRepository.ts`
- Create: `src/server/ops/OpsCustomerRepository.ts`
- Create: `src/server/ops/PostgresOpsCustomerRepository.ts`
- Create: `src/app/ops/api/sales/route.ts`
- Create: `src/app/ops/api/customers/route.ts`
- Create: `src/components/ops/SalesPanel.tsx`
- Create: `src/components/ops/CustomersPanel.tsx`
- Test: `tests/unit/ops-sales-customers.test.ts`

**Interfaces:**
- Sales returns fixed-definition buckets/funnel counts; all money integer minor units server-side.
- Customer grouping uses `verified_contacts.email_hash`; never raw email as identity.

- [ ] **Step 1: Write failing analytics tests**

Cover gross paid, refunds, AOV, object/size/color distribution, funnel stages, timing metrics and customer lifetime paid amount from canonical records.

- [ ] **Step 2: Implement bounded aggregate queries**

Use date buckets and server-side aggregation. Country distribution may use stored country code; province is not aggregated until a privacy-safe derived representation is explicitly introduced.

- [ ] **Step 3: Build Sales/Customers UI**

No chart library required initially: compact SVG/CSS bars/lines and tables. Customer list is masked, Issue-linked and paginated.

- [ ] **Step 4: Run tests**

Run: `pnpm test -- tests/unit/ops-sales-customers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add Owner OS sales and customer views"`

---

### Task 10: System page and Attention Required recovery queue

**Files:**
- Create: `src/server/ops/OpsAttentionRepository.ts`
- Create: `src/server/ops/PostgresOpsAttentionRepository.ts`
- Create: `src/app/ops/api/system/readiness/route.ts`
- Create: `src/app/ops/api/attention/route.ts`
- Create: `src/components/ops/SystemPanel.tsx`
- Create: `src/components/ops/AttentionPanel.tsx`
- Modify: `src/server/ops/ReadinessService.ts` only where Owner OS needs safe evidence fields.
- Test: `tests/unit/ops-attention.test.ts`

**Interfaces:**
- Attention items have `kind`, `severity`, `issueId`, `issueCode`, `safeSummary`, `allowedActions`, `detectedAt`.
- Allowed actions are enumerated capabilities, never arbitrary state changes.

- [ ] **Step 1: Write failing attention tests**

Cover paid-without-Issue, payment exception, FAILED/stuck design, missing map, FAILED manufacturing, provider mismatch, FAILED notification and overdue OPEN support.

- [ ] **Step 2: Implement priority query/read model**

Return critical money/factory exceptions first, then customer obligations, then design/support/retry items.

- [ ] **Step 3: Build System page**

Compose current readiness plus safe last-seen operational evidence. Provider health is descriptive only; no mode-switch endpoint.

- [ ] **Step 4: Build Attention UI**

Each item links to the relevant panel/Issue and shows only supported action buttons.

- [ ] **Step 5: Run tests**

Run: `pnpm test -- tests/unit/ops-attention.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat: add Owner OS system and recovery queue"`

---

### Task 11: Audit panel, migration-current update and Governor checkpoint

**Files:**
- Create: `src/app/ops/api/audit/route.ts`
- Create: `src/components/ops/AuditPanel.tsx`
- Update: `db/migrations/CURRENT` to `0022_owner_os_website_config.sql`
- Modify: `.engineering/CONTINUATION.json`
- Test: `tests/unit/ops-audit-route.test.ts`

**Interfaces:**
- Audit API cursor-paginated, safe metadata only.

- [ ] **Step 1: Write failing audit route test**

Assert auth required, cursor pagination, no secret/private key fields, newest-first deterministic ordering.

- [ ] **Step 2: Implement route/panel**

Filter by action, Issue Code, target and date without exposing raw private values.

- [ ] **Step 3: Update migration head and Governor**

Record created migrations, current verification status, and remaining external gates truthfully.

- [ ] **Step 4: Run tests**

Run: `pnpm test -- tests/unit/ops-audit-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: complete Owner OS audit and governance"`

---

### Task 12: Full verification, browser QA and migration/provider safety checks

**Files:**
- Create/modify: `tests/e2e/owner-os.spec.ts`
- Modify any real defects found by executable verification.
- Update: `.engineering/CONTINUATION.json`

**Interfaces:**
- Owner OS acceptance suite proves authentication, privacy masking, read models, contextual actions and irreversible-action gates.

- [ ] **Step 1: Add Owner OS Playwright acceptance test**

Cover login, Home counters, tab navigation, Issue detail, reveal reason gate, Designer review UI, Manufacturing confirm phrase lock, Sales/Customers, Support, Website version controls, System readiness and Audit visibility. Use fixtures/mocks; never charge Safepay/Printful in browser QA.

- [ ] **Step 2: Run executable unit suite**

Run: `pnpm test`
Expected: zero failures.

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: zero TypeScript errors.

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: zero errors.

- [ ] **Step 5: Run production build**

Run: `pnpm build`
Expected: exit 0.

- [ ] **Step 6: Run browser QA**

Run: `pnpm test:e2e -- tests/e2e/owner-os.spec.ts`
Expected: PASS on configured desktop/mobile projects.

- [ ] **Step 7: Validate migrations on temporary Neon branch**

Apply `0020`-`0022` after the existing verified head using Neon temporary migration workflow, query required tables/indexes/constraints, and do not apply to production without Neon’s explicit migration approval gate.

- [ ] **Step 8: Re-check Vercel deployment status**

If build-rate limit has cleared, inspect/deploy exact GitHub head and run protected `/ops` browser verification. If still throttled, record `WAIT_EXTERNAL` rather than calling build green.

- [ ] **Step 9: Final verification checkpoint**

Use `superpowers:verification-before-completion`. Record exact green/blocked evidence in `.engineering/CONTINUATION.json`; do not mark COMPLETE while production database/provider/charge gates remain unproven.

- [ ] **Step 10: Commit verification evidence/fixes**

`git commit -m "test: verify Owner OS end to end"`
