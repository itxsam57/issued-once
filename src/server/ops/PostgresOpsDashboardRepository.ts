import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { OpsDashboardRepository, OpsDashboardSnapshot } from './OpsDashboardRepository';

type SalesRow = {
  currency: string | null;
  currency_count: number | string;
  today_orders: number | string;
  today_gross_minor: number | string;
  seven_day_orders: number | string;
  seven_day_gross_minor: number | string;
  thirty_day_orders: number | string;
  thirty_day_gross_minor: number | string;
};

type LifetimeRow = {
  currency: string | null;
  currency_count: number | string;
  lifetime_orders: number | string;
  lifetime_gross_minor: number | string;
  refunded_minor: number | string;
};

type OpsRow = {
  designing: number | string;
  review: number | string;
  production: number | string;
  transit: number | string;
  delivered: number | string;
  payment_exceptions: number | string;
  design_failures: number | string;
  manufacturing_failures: number | string;
  notification_failures: number | string;
  support_open: number | string;
};

type ActivityRow = {
  issue_code: string;
  event_type: string;
  source: string;
  created_at: Date | string;
};

const n = (value: number | string | null | undefined) => Number(value ?? 0);

export class PostgresOpsDashboardRepository implements OpsDashboardRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async getDashboard(now: Date): Promise<OpsDashboardSnapshot> {
    const [salesRows, lifetimeRows, operationRows, activityRows] = await Promise.all([
      this.sql.query<SalesRow>(
        `WITH bounds AS (
          SELECT
            (date_trunc('day', $1::timestamptz AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi') AS today_start,
            $1::timestamptz - INTERVAL '7 days' AS seven_start,
            $1::timestamptz - INTERVAL '30 days' AS thirty_start
        )
        SELECT
          MIN(issue.currency) AS currency,
          COUNT(DISTINCT issue.currency) AS currency_count,
          COUNT(*) FILTER (WHERE issue.reserved_at >= bounds.today_start) AS today_orders,
          COALESCE(SUM(issue.amount_minor) FILTER (WHERE issue.reserved_at >= bounds.today_start),0) AS today_gross_minor,
          COUNT(*) FILTER (WHERE issue.reserved_at >= bounds.seven_start) AS seven_day_orders,
          COALESCE(SUM(issue.amount_minor) FILTER (WHERE issue.reserved_at >= bounds.seven_start),0) AS seven_day_gross_minor,
          COUNT(*) FILTER (WHERE issue.reserved_at >= bounds.thirty_start) AS thirty_day_orders,
          COALESCE(SUM(issue.amount_minor) FILTER (WHERE issue.reserved_at >= bounds.thirty_start),0) AS thirty_day_gross_minor
        FROM issues AS issue
        CROSS JOIN bounds
        WHERE issue.payment_attempt_id IS NOT NULL AND issue.reserved_at >= bounds.thirty_start`,
        [now],
      ),
      this.sql.query<LifetimeRow>(
        `SELECT
          MIN(currency_scope) FILTER (WHERE currency_scope<>'*') AS currency,
          COUNT(DISTINCT currency_scope) FILTER (WHERE currency_scope<>'*') AS currency_count,
          COALESCE(SUM(event_count) FILTER (WHERE metric_key='paid_order'),0) AS lifetime_orders,
          COALESCE(SUM(value_minor) FILTER (WHERE metric_key='gross_paid'),0) AS lifetime_gross_minor,
          COALESCE(SUM(value_minor) FILTER (WHERE metric_key='refund'),0) AS refunded_minor
        FROM commercial_metric_buckets
        WHERE dimension_key='all' AND metric_key IN ('paid_order','gross_paid','refund')`,
      ),
      this.sql.query<OpsRow>(
        `SELECT
          (SELECT COUNT(*) FROM issues WHERE status='BEING_INTERPRETED') AS designing,
          (SELECT COUNT(*) FROM design_jobs WHERE state='REVIEW') AS review,
          (SELECT COUNT(*) FROM issues WHERE status='IN_PRODUCTION') AS production,
          (SELECT COUNT(*) FROM issues WHERE status='IN_TRANSIT') AS transit,
          (SELECT COUNT(*) FROM issues WHERE status='DELIVERED') AS delivered,
          (SELECT COUNT(*) FROM issues WHERE payment_exception_code IS NOT NULL) AS payment_exceptions,
          (SELECT COUNT(*) FROM design_jobs WHERE state='FAILED') AS design_failures,
          (SELECT COUNT(*) FROM manufacturing_jobs WHERE state='FAILED') AS manufacturing_failures,
          (SELECT COUNT(*) FROM notification_deliveries WHERE status='FAILED') AS notification_failures,
          (SELECT COUNT(*) FROM support_requests WHERE status='OPEN') AS support_open`,
      ),
      this.sql.query<ActivityRow>(
        `SELECT issue.issue_code, event.event_type, event.source, event.created_at
         FROM issue_events AS event
         JOIN issues AS issue ON issue.id=event.issue_id
         ORDER BY event.created_at DESC, event.id DESC
         LIMIT 30`,
      ),
    ]);

    const sales = salesRows[0] ?? {} as SalesRow;
    const lifetime = lifetimeRows[0] ?? {} as LifetimeRow;
    if (n(sales.currency_count) > 1 || n(lifetime.currency_count) > 1) {
      throw new Error('Owner OS dashboard cannot aggregate mixed currencies');
    }
    if (sales.currency && lifetime.currency && sales.currency !== lifetime.currency) {
      throw new Error('Owner OS dashboard cannot aggregate mixed currencies');
    }
    const ops = operationRows[0] ?? {} as OpsRow;
    const lifetimeOrders = n(lifetime.lifetime_orders);
    const lifetimeGrossMinor = n(lifetime.lifetime_gross_minor);
    return {
      sales: {
        currency: sales.currency ?? lifetime.currency ?? null,
        today: { orders: n(sales.today_orders), grossMinor: n(sales.today_gross_minor) },
        sevenDays: { orders: n(sales.seven_day_orders), grossMinor: n(sales.seven_day_gross_minor) },
        thirtyDays: { orders: n(sales.thirty_day_orders), grossMinor: n(sales.thirty_day_gross_minor) },
        lifetime: { orders: lifetimeOrders, grossMinor: lifetimeGrossMinor },
        refundedMinor: n(lifetime.refunded_minor),
        averageOrderMinor: lifetimeOrders ? Math.round(lifetimeGrossMinor / lifetimeOrders) : 0,
      },
      operations: {
        paidIssues: lifetimeOrders,
        designing: n(ops.designing),
        review: n(ops.review),
        production: n(ops.production),
        transit: n(ops.transit),
        delivered: n(ops.delivered),
      },
      attention: {
        paymentExceptions: n(ops.payment_exceptions),
        designFailures: n(ops.design_failures),
        manufacturingFailures: n(ops.manufacturing_failures),
        notificationFailures: n(ops.notification_failures),
        supportOpen: n(ops.support_open),
      },
      activity: activityRows.map((row) => ({
        issueCode: row.issue_code,
        eventType: row.event_type,
        source: row.source,
        createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      })),
    };
  }
}
