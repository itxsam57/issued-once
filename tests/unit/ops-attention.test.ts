import { expect, test } from 'vitest';
import { PostgresOpsAttentionRepository } from '@/server/ops/PostgresOpsAttentionRepository';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';

test('prioritizes paid-without-Issue above downstream failures', async () => {
  const sql: SqlExecutor = { query: async () => [
    { kind: 'PAID_WITHOUT_ISSUE', priority: 100, issue_id: null, issue_code: null, target_id: 'pay-1', detail: 'Paid payment requires Issue creation', created_at: new Date('2026-08-19T05:00:00Z') },
    { kind: 'DESIGN_FAILED', priority: 70, issue_id: '11111111-1111-1111-1111-111111111111', issue_code: 'IO-ABCD-EFGH', target_id: 'd1', detail: 'Design job failed', created_at: new Date('2026-08-19T04:00:00Z') },
  ] as never };
  const items = await new PostgresOpsAttentionRepository(sql).list(50, new Date('2026-08-19T06:00:00Z'));
  expect(items[0].kind).toBe('PAID_WITHOUT_ISSUE');
  expect(items[0].priority).toBeGreaterThan(items[1].priority);
});
