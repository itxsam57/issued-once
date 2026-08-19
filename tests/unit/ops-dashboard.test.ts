import { expect, test } from 'vitest';
import { PostgresOpsDashboardRepository } from '@/server/ops/PostgresOpsDashboardRepository';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';

test('returns bounded canonical sales, attention, operations and activity aggregates', async () => {
  let call = 0;
  const sql: SqlExecutor = {
    query: async () => {
      call += 1;
      if (call === 1) return [{
        today_orders: 2,
        today_gross_minor: 10800,
        seven_day_orders: 5,
        seven_day_gross_minor: 27000,
        thirty_day_orders: 9,
        thirty_day_gross_minor: 48600,
        lifetime_orders: 12,
        lifetime_gross_minor: 64800,
        refunded_minor: 5400,
        average_order_minor: 5400,
      }] as never;
      if (call === 2) return [{
        paid_issues: 12,
        designing: 2,
        review: 1,
        production: 3,
        transit: 1,
        delivered: 5,
        payment_exceptions: 1,
        design_failures: 1,
        manufacturing_failures: 0,
        notification_failures: 2,
        support_open: 1,
      }] as never;
      return [{
        issue_code: 'IO-ABCD-EFGH',
        event_type: 'PAYMENT_RECEIVED',
        source: 'SAFEPAY',
        created_at: new Date('2026-08-19T05:00:00Z'),
      }] as never;
    },
  };

  const dashboard = await new PostgresOpsDashboardRepository(sql).getDashboard(new Date('2026-08-19T06:00:00Z'));

  expect(dashboard.sales.today).toEqual({ orders: 2, grossMinor: 10800 });
  expect(dashboard.sales.lifetime).toEqual({ orders: 12, grossMinor: 64800 });
  expect(dashboard.sales.refundedMinor).toBe(5400);
  expect(dashboard.operations.production).toBe(3);
  expect(dashboard.attention.notificationFailures).toBe(2);
  expect(dashboard.activity).toHaveLength(1);
  expect(dashboard.activity[0].issueCode).toBe('IO-ABCD-EFGH');
});
