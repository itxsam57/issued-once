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

test('historical windows read only aggregate metric buckets', async () => {
  let queryText = '';
  const sql: SqlExecutor = { query: async (text) => {
    queryText = text;
    return [
      { metric_key: 'gross_paid', dimension_key: 'all', currency_scope: 'USD', event_count: 10, value_minor: 54000, value_seconds: 0 },
      { metric_key: 'refund', dimension_key: 'all', currency_scope: 'USD', event_count: 1, value_minor: 5400, value_seconds: 0 },
      { metric_key: 'paid_order', dimension_key: 'all', currency_scope: 'USD', event_count: 10, value_minor: 0, value_seconds: 0 },
      { metric_key: 'paid_order', dimension_key: 'object:tee', currency_scope: 'USD', event_count: 8, value_minor: 0, value_seconds: 0 },
      { metric_key: 'paid_order', dimension_key: 'size:M', currency_scope: 'USD', event_count: 6, value_minor: 0, value_seconds: 0 },
      { metric_key: 'paid_order', dimension_key: 'color:Black', currency_scope: 'USD', event_count: 7, value_minor: 0, value_seconds: 0 },
      { metric_key: 'paid_order', dimension_key: 'country:PK', currency_scope: 'USD', event_count: 6, value_minor: 0, value_seconds: 0 },
      { metric_key: 'payment_failed', dimension_key: 'all', currency_scope: '*', event_count: 2, value_minor: 0, value_seconds: 0 },
      { metric_key: 'payment_exception', dimension_key: 'all', currency_scope: '*', event_count: 1, value_minor: 0, value_seconds: 0 },
      { metric_key: 'funnel_started', dimension_key: 'all', currency_scope: '*', event_count: 20, value_minor: 0, value_seconds: 0 },
      { metric_key: 'funnel_paid', dimension_key: 'all', currency_scope: '*', event_count: 10, value_minor: 0, value_seconds: 0 },
      { metric_key: 'timing_start_to_paid', dimension_key: 'all', currency_scope: '*', event_count: 10, value_minor: 0, value_seconds: 18000 },
      { metric_key: 'timing_paid_to_production', dimension_key: 'all', currency_scope: '*', event_count: 10, value_minor: 0, value_seconds: 648000 },
    ] as never;
  }};

  const result = await new PostgresOpsSalesRepository(sql).getSnapshot({ days: 90, now: new Date('2026-08-19T06:00:00Z') });

  expect(queryText).toContain('commercial_metric_buckets');
  expect(queryText).not.toMatch(/FROM issues|FROM payment_attempts|FROM experiences/i);
  expect(result.grossMinor).toBe(54000);
  expect(result.netAfterRefundMinor).toBe(48600);
  expect(result.averageOrderMinor).toBe(5400);
  expect(result.byProduct[0]).toEqual({ key: 'tee', orders: 8 });
  expect(result.byCountry[0]).toEqual({ key: 'PK', orders: 6 });
  expect(result.timing.averageHoursStartToPaid).toBe(0.5);
  expect(result.timing.averageHoursPaidToProduction).toBe(18);
  expect(result.funnel.started).toBe(20);
  expect(result.funnel.paid).toBe(10);
});

test('refuses to aggregate mixed currencies', async () => {
  const sql: SqlExecutor = { query: async () => [{ currency: 'PKR', currency_count: 2 }] as never };
  await expect(new PostgresOpsSalesRepository(sql).getSnapshot({ days: 30, now: new Date('2026-08-19T06:00:00Z') }))
    .rejects.toThrow(/mixed currencies/i);
});
