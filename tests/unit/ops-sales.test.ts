import { expect, test } from 'vitest';
import { PostgresOpsSalesRepository } from '@/server/ops/PostgresOpsSalesRepository';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';

test('returns canonical sales totals, funnel and product distributions without private data', async () => {
  let call = 0;
  const sql: SqlExecutor = { query: async () => {
    call += 1;
    if (call === 1) return [{ gross_minor: 54000, refunded_minor: 5400, paid_orders: 10, average_order_minor: 5400, failed_payments: 2, exception_payments: 1 }] as never;
    if (call === 2) return [{ object_type: 'tee', orders: 8 }, { object_type: 'tote', orders: 2 }] as never;
    if (call === 3) return [{ country_code: 'PK', orders: 6 }, { country_code: 'US', orders: 4 }] as never;
    return [{ started: 20, answered: 16, physical: 14, verified: 13, shipping: 12, checkout: 11, paid: 10 }] as never;
  }};
  const result = await new PostgresOpsSalesRepository(sql).getSnapshot({ days: 30, now: new Date('2026-08-19T06:00:00Z') });
  expect(result.grossMinor).toBe(54000);
  expect(result.netAfterRefundMinor).toBe(48600);
  expect(result.funnel.paid).toBe(10);
  expect(JSON.stringify(result)).not.toMatch(/email|phone|address|ciphertext/i);
});
