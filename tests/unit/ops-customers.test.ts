import { expect, test } from 'vitest';
import { PostgresOpsCustomerRepository } from '@/server/ops/PostgresOpsCustomerRepository';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';

test('groups customers by verified contact hash without returning plaintext identity', async () => {
  const sql: SqlExecutor = { query: async () => [{
    email_hash: 'a'.repeat(64), issue_count: 3, paid_minor: 16200, refunded_issues: 1,
    active_deliveries: 1, support_count: 2, last_seen_at: new Date('2026-08-19T05:00:00Z'),
  }] as never };
  const result = await new PostgresOpsCustomerRepository(sql).listCustomers({ limit: 50, cursor: null, emailHash: null });
  expect(result.items[0].contactAlias).toBe('CONTACT AAAAAAAA');
  expect(JSON.stringify(result)).not.toMatch(/@|emailCiphertext|phone|address/i);
});
