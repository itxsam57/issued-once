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
type DistributionRow = { object_type?: string; country_code?: string; orders: number | string };
type FunnelRow = { started: number | string; answered: number | string; physical: number | string; verified: number | string; shipping: number | string; checkout: number | string; paid: number | string };
const n = (value: number | string | null | undefined) => Number(value ?? 0);

export class PostgresOpsSalesRepository implements OpsSalesRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async getSnapshot(input: { days: number; now: Date }): Promise<OpsSalesSnapshot> {
    const days = Math.min(Math.max(Math.trunc(input.days), 1), 3650);
    const cutoff = new Date(input.now.getTime() - days * 86_400_000);
    const [totalsRows, productRows, countryRows, funnelRows] = await Promise.all([
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
        `SELECT issue.object_type, COUNT(*) AS orders
         FROM issues AS issue
         WHERE issue.reserved_at >= $1 AND issue.payment_attempt_id IS NOT NULL
         GROUP BY issue.object_type ORDER BY orders DESC, issue.object_type ASC LIMIT 20`,
        [cutoff],
      ),
      this.sql.query<DistributionRow>(
        `SELECT shipping.country_code, COUNT(*) AS orders
         FROM issues AS issue
         JOIN shipping_snapshots AS shipping ON shipping.id=issue.shipping_snapshot_id
         WHERE issue.reserved_at >= $1 AND issue.payment_attempt_id IS NOT NULL
         GROUP BY shipping.country_code ORDER BY orders DESC, shipping.country_code ASC LIMIT 50`,
        [cutoff],
      ),
      this.sql.query<FunnelRow>(
        `SELECT
          COUNT(*) AS started,
          COUNT(*) FILTER (WHERE (SELECT COUNT(*) FROM experience_answers answer WHERE answer.experience_id=experience.id)=7) AS answered,
          COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM experience_physical_selection physical WHERE physical.experience_id=experience.id AND physical.object_type IS NOT NULL AND physical.size_code IS NOT NULL AND physical.color_code IS NOT NULL)) AS physical,
          COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM verified_contacts contact WHERE contact.experience_id=experience.id)) AS verified,
          COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM shipping_snapshots shipping WHERE shipping.experience_id=experience.id)) AS shipping,
          COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM payment_attempts payment WHERE payment.experience_id=experience.id AND payment.status IN ('REDIRECTED','PAID','REFUNDED','EXCEPTION'))) AS checkout,
          COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM payment_attempts payment WHERE payment.experience_id=experience.id AND payment.status IN ('PAID','REFUNDED'))) AS paid
        FROM experiences AS experience
        WHERE experience.created_at >= $1`,
        [cutoff],
      ),
    ]);

    const totals = totalsRows[0] ?? {} as TotalsRow;
    if (n(totals.currency_count) > 1) {
      throw new Error('Owner OS sales cannot aggregate mixed currencies');
    }
    const grossMinor = n(totals.gross_minor);
    const refundedMinor = n(totals.refunded_minor);
    const funnel = funnelRows[0] ?? {} as FunnelRow;
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
      byProduct: productRows.map((row) => ({ key: row.object_type ?? 'unknown', orders: n(row.orders) })),
      byCountry: countryRows.map((row) => ({ key: row.country_code ?? 'unknown', orders: n(row.orders) })),
      funnel: {
        started: n(funnel.started), answered: n(funnel.answered), physical: n(funnel.physical), verified: n(funnel.verified),
        shipping: n(funnel.shipping), checkout: n(funnel.checkout), paid: n(funnel.paid),
      },
    };
  }
}
