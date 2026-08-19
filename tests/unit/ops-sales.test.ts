import { expect, test } from 'vitest';
import { PostgresOpsSalesRepository } from '@/server/ops/PostgresOpsSalesRepository';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';

test('returns canonical sales totals, mix, timing and funnel without private data', async () => {
  let call = 0;
  const sql: SqlExecutor = { query: async () => {
    call += 1;
    if (call === 1) return [{ currency: 'PKR', currency_count: 1, gross_minor: 54000, refunded_minor: 5400, paid_orders: 10, average_order_minor: 5400, failed_payments: 2, exception_payments: 1 }] as never;
    if (call === 2) return [{ key: 'tee', orders: 8 }, { key: 'tote', orders: 2 }] as never;
    if (call === 3) return [{ key: 'M', orders: 6 }, { key: 'L', orders: 4 }] as never;
    if (call === 4) return [{ key: 'Black', orders: 7 }, { key: 'Bone', orders: 3 }] as never;
    if (call === 5) return [{ key: 'PK', orders: 6 }, { key: 'US', orders: 4 }] as never;
    if (call === 6) return [{ start_to_paid_hours: 0.5, paid_to_production_hours: 18, production_to_delivered_hours: 72 }] as never;
    return [{ started: 20, answered: 16, physical: 14, verified: 13, shipping: 12, checkout: 11, paid: 10 }] as never;
  }};
  const result = await new PostgresOpsSalesRepository(sql).getSnapshot({ days: 30, now: new Date('2026-08-19T06:00:00Z') });
  expect(result.currency).toBe('PKR');
  expect(result.grossMinor).toBe(54000);
  expect(result.netAfterRefundMinor).toBe(48600);
  expect(result.bySize[0]).toEqual({ key: 'M', orders: 6 });
  expect(result.byColor[0]).toEqual({ key: 'Black', orders: 7 });
  expect(result.timing.averageHoursPaidToProduction).toBe(18);
  expect(result.funnel.paid).toBe(10);
  expect(JSON.stringify(result)).not.toMatch(/email|phone|address|ciphertext/i);
});

test('refuses to aggregate mixed currencies', async () => {
  const sql: SqlExecutor = { query: async () => [{ currency: 'PKR', currency_count: 2 }] as never };
  await expect(new PostgresOpsSalesRepository(sql).getSnapshot({ days: 30, now: new Date('2026-08-19T06:00:00Z') }))
    .rejects.toThrow(/mixed currencies/i);
});
