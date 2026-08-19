import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { OpsSalesRepository, OpsSalesSnapshot } from './OpsSalesRepository';

type TotalsRow = {
  currency: string | null;
  currency_count: number | string;
  gross_minor: number | string;
  refunded_minor: number | string;
  paid_orders: number | string;
  average_order_minor: number | string;
  failed_payments: number | string;
  exception_payments: number | string;
};
type DistributionRow = { key: string; orders: number | string };
type FunnelRow = { started: number | string; answered: number | string; physical: number | string; verified: number | string; shipping: number | string; checkout: number | string; paid: number | string };
type TimingRow = { start_to_paid_hours: number | string | null; paid_to_production_hours: number | string | null; production_to_delivered_hours: number | string | null };
type BucketRow = {
  metric_key: string;
  dimension_key: string;
  currency_scope: string;
  event_count: number | string;
  value_minor: number | string;
  value_seconds: number | string;
};

const n = (value: number | string | null | undefined) => Number(value ?? 0);
const nullableNumber = (value: number | string | null | undefined) => value == null ? null : Number(value);

function emptySnapshot(days: number): OpsSalesSnapshot {
  return {
    days,
    currency: null,
    grossMinor: 0,
    refundedMinor: 0,
    netAfterRefundMinor: 0,
    paidOrders: 0,
    averageOrderMinor: 0,
    failedPayments: 0,
    exceptionPayments: 0,
    byProduct: [],
    bySize: [],
    byColor: [],
    byCountry: [],
    timing: { averageHoursStartToPaid: null, averageHoursPaidToProduction: null, averageHoursProductionToDelivered: null },
    funnel: { started: 0, answered: 0, physical: 0, verified: 0, shipping: 0, checkout: 0, paid: 0 },
  };
}

export class PostgresOpsSalesRepository implements OpsSalesRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async getSnapshot(input: { days: number; now: Date }): Promise<OpsSalesSnapshot> {
    const days = Math.min(Math.max(Math.trunc(input.days), 1), 3650);
    if (days > 30) return this.getBucketSnapshot(days, input.now);
    return this.getLiveSnapshot(days, input.now);
  }

  private async getBucketSnapshot(days: number, now: Date): Promise<OpsSalesSnapshot> {
    const cutoff = days >= 3650 ? null : new Date(now.getTime() - days * 86_400_000);
    const rows = await this.sql.query<BucketRow>(
      `SELECT metric_key,dimension_key,currency_scope,
        SUM(event_count) AS event_count,
        SUM(value_minor) AS value_minor,
        SUM(value_seconds) AS value_seconds
       FROM commercial_metric_buckets
       WHERE ($1::date IS NULL OR bucket_day >= $1::date)
       GROUP BY metric_key,dimension_key,currency_scope`,
      [cutoff ? cutoff.toISOString().slice(0, 10) : null],
    );
    if (!rows.length) return emptySnapshot(days);

    const result = emptySnapshot(days);
    const currencies = new Set<string>();
    const distributions = {
      object: new Map<string, number>(),
      size: new Map<string, number>(),
      color: new Map<string, number>(),
      country: new Map<string, number>(),
    };
    const timing = new Map<string, { events: number; seconds: number }>();

    for (const row of rows) {
      const events = n(row.event_count);
      const minor = n(row.value_minor);
      const seconds = n(row.value_seconds);
      if (row.currency_scope !== '*' && ['gross_paid','refund','paid_order'].includes(row.metric_key)) currencies.add(row.currency_scope);

      if (row.metric_key === 'gross_paid' && row.dimension_key === 'all') result.grossMinor += minor;
      if (row.metric_key === 'refund' && row.dimension_key === 'all') result.refundedMinor += minor;
      if (row.metric_key === 'paid_order' && row.dimension_key === 'all') result.paidOrders += events;
      if (row.metric_key === 'payment_failed' && row.dimension_key === 'all') result.failedPayments += events;
      if (row.metric_key === 'payment_exception' && row.dimension_key === 'all') result.exceptionPayments += events;

      if (row.metric_key === 'paid_order') {
        for (const prefix of ['object','size','color','country'] as const) {
          const marker = `${prefix}:`;
          if (row.dimension_key.startsWith(marker)) {
            const key = row.dimension_key.slice(marker.length);
            distributions[prefix].set(key, (distributions[prefix].get(key) ?? 0) + events);
          }
        }
      }

      if (row.metric_key.startsWith('funnel_') && row.dimension_key === 'all') {
        const key = row.metric_key.slice('funnel_'.length) as keyof OpsSalesSnapshot['funnel'];
        if (key in result.funnel) result.funnel[key] += events;
      }

      if (row.metric_key.startsWith('timing_') && row.dimension_key === 'all') {
        const current = timing.get(row.metric_key) ?? { events: 0, seconds: 0 };
        current.events += events;
        current.seconds += seconds;
        timing.set(row.metric_key, current);
      }
    }

    if (currencies.size > 1) throw new Error('Owner OS sales cannot aggregate mixed currencies');
    result.currency = [...currencies][0] ?? null;
    result.netAfterRefundMinor = Math.max(0, result.grossMinor - result.refundedMinor);
    result.averageOrderMinor = result.paidOrders ? Math.round(result.grossMinor / result.paidOrders) : 0;
    const sorted = (map: Map<string, number>) => [...map.entries()]
      .map(([key, orders]) => ({ key, orders }))
      .sort((left, right) => right.orders - left.orders || left.key.localeCompare(right.key));
    result.byProduct = sorted(distributions.object).slice(0, 20);
    result.bySize = sorted(distributions.size).slice(0, 30);
    result.byColor = sorted(distributions.color).slice(0, 30);
    result.byCountry = sorted(distributions.country).slice(0, 50);
    const hours = (key: string) => {
      const value = timing.get(key);
      return value?.events ? value.seconds / value.events / 3600 : null;
    };
    result.timing = {
      averageHoursStartToPaid: hours('timing_start_to_paid'),
      averageHoursPaidToProduction: hours('timing_paid_to_production'),
      averageHoursProductionToDelivered: hours('timing_production_to_delivered'),
    };
    return result;
  }

  private async getLiveSnapshot(days: number, now: Date): Promise<OpsSalesSnapshot> {
    const cutoff = new Date(now.getTime() - days * 86_400_000);
    const [totalsRows, productRows, sizeRows, colorRows, countryRows, timingRows, funnelRows] = await Promise.all([
      this.sql.query<TotalsRow>(
        `SELECT
          MIN(issue.currency) AS currency,
          COUNT(DISTINCT issue.currency) AS currency_count,
          COALESCE(SUM(issue.amount_minor),0) AS gross_minor,
          COALESCE(SUM(issue.amount_minor) FILTER (WHERE issue.payment_exception_code='PAYMENT_REFUNDED'),0) AS refunded_minor,
          COUNT(*) AS paid_orders,
          COALESCE(ROUND(AVG(issue.amount_minor)),0) AS average_order_minor,
          (SELECT COUNT(*) FROM payment_attempts WHERE created_at >= $1 AND status='FAILED') AS failed_payments,
          (SELECT COUNT(*) FROM payment_attempts WHERE created_at >= $1 AND status='EXCEPTION') AS exception_payments
        FROM issues AS issue
        WHERE issue.reserved_at >= $1 AND issue.payment_attempt_id IS NOT NULL`,
        [cutoff],
      ),
      this.sql.query<DistributionRow>(
        `SELECT issue.object_type AS key, COUNT(*) AS orders
         FROM issues AS issue
         WHERE issue.reserved_at >= $1 AND issue.payment_attempt_id IS NOT NULL
         GROUP BY issue.object_type ORDER BY orders DESC, issue.object_type ASC LIMIT 20`, [cutoff]),
      this.sql.query<DistributionRow>(
        `SELECT issue.size_code AS key, COUNT(*) AS orders
         FROM issues AS issue
         WHERE issue.reserved_at >= $1 AND issue.payment_attempt_id IS NOT NULL
         GROUP BY issue.size_code ORDER BY orders DESC, issue.size_code ASC LIMIT 30`, [cutoff]),
      this.sql.query<DistributionRow>(
        `SELECT issue.color_code AS key, COUNT(*) AS orders
         FROM issues AS issue
         WHERE issue.reserved_at >= $1 AND issue.payment_attempt_id IS NOT NULL
         GROUP BY issue.color_code ORDER BY orders DESC, issue.color_code ASC LIMIT 30`, [cutoff]),
      this.sql.query<DistributionRow>(
        `SELECT shipping.country_code AS key, COUNT(*) AS orders
         FROM issues AS issue JOIN shipping_snapshots AS shipping ON shipping.id=issue.shipping_snapshot_id
         WHERE issue.reserved_at >= $1 AND issue.payment_attempt_id IS NOT NULL
         GROUP BY shipping.country_code ORDER BY orders DESC, shipping.country_code ASC LIMIT 50`, [cutoff]),
      this.sql.query<TimingRow>(
        `WITH paid AS (
           SELECT issue.id, issue.experience_id, issue.reserved_at,
             MIN(event.created_at) FILTER (WHERE event.event_type='IN_PRODUCTION') AS production_at,
             MIN(event.created_at) FILTER (WHERE event.event_type='DELIVERED') AS delivered_at
           FROM issues AS issue LEFT JOIN issue_events AS event ON event.issue_id=issue.id
           WHERE issue.reserved_at >= $1 AND issue.payment_attempt_id IS NOT NULL
           GROUP BY issue.id,issue.experience_id,issue.reserved_at
         )
         SELECT AVG(EXTRACT(EPOCH FROM (paid.reserved_at-experience.created_at))/3600.0) AS start_to_paid_hours,
           AVG(EXTRACT(EPOCH FROM (paid.production_at-paid.reserved_at))/3600.0) FILTER (WHERE paid.production_at IS NOT NULL) AS paid_to_production_hours,
           AVG(EXTRACT(EPOCH FROM (paid.delivered_at-paid.production_at))/3600.0) FILTER (WHERE paid.production_at IS NOT NULL AND paid.delivered_at IS NOT NULL) AS production_to_delivered_hours
         FROM paid JOIN experiences AS experience ON experience.id=paid.experience_id`, [cutoff]),
      this.sql.query<FunnelRow>(
        `SELECT COUNT(*) AS started,
          COUNT(*) FILTER (WHERE (SELECT COUNT(*) FROM experience_answers answer WHERE answer.experience_id=experience.id)=7) AS answered,
          COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM experience_physical_selection physical WHERE physical.experience_id=experience.id AND physical.object_type IS NOT NULL AND physical.size_code IS NOT NULL AND physical.color_code IS NOT NULL)) AS physical,
          COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM verified_contacts contact WHERE contact.experience_id=experience.id)) AS verified,
          COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM shipping_snapshots shipping WHERE shipping.experience_id=experience.id)) AS shipping,
          COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM payment_attempts payment WHERE payment.experience_id=experience.id AND payment.status IN ('REDIRECTED','PAID','REFUNDED','EXCEPTION'))) AS checkout,
          COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM payment_attempts payment WHERE payment.experience_id=experience.id AND payment.status IN ('PAID','REFUNDED'))) AS paid
        FROM experiences AS experience WHERE experience.created_at >= $1`, [cutoff]),
    ]);

    const totals = totalsRows[0] ?? {} as TotalsRow;
    if (n(totals.currency_count) > 1) throw new Error('Owner OS sales cannot aggregate mixed currencies');
    const grossMinor = n(totals.gross_minor);
    const refundedMinor = n(totals.refunded_minor);
    const timing = timingRows[0] ?? {} as TimingRow;
    const funnel = funnelRows[0] ?? {} as FunnelRow;
    const distribution = (rows: DistributionRow[]) => rows.map((row) => ({ key: row.key ?? 'unknown', orders: n(row.orders) }));
    return {
      days,
      currency: totals.currency ?? null,
      grossMinor,
      refundedMinor,
      netAfterRefundMinor: Math.max(0, grossMinor - refundedMinor),
      paidOrders: n(totals.paid_orders),
      averageOrderMinor: n(totals.average_order_minor),
      failedPayments: n(totals.failed_payments),
      exceptionPayments: n(totals.exception_payments),
      byProduct: distribution(productRows), bySize: distribution(sizeRows), byColor: distribution(colorRows), byCountry: distribution(countryRows),
      timing: {
        averageHoursStartToPaid: nullableNumber(timing.start_to_paid_hours),
        averageHoursPaidToProduction: nullableNumber(timing.paid_to_production_hours),
        averageHoursProductionToDelivered: nullableNumber(timing.production_to_delivered_hours),
      },
      funnel: {
        started: n(funnel.started), answered: n(funnel.answered), physical: n(funnel.physical), verified: n(funnel.verified), shipping: n(funnel.shipping), checkout: n(funnel.checkout), paid: n(funnel.paid),
      },
    };
  }
}
