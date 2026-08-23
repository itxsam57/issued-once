import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { OpsCustomerRecord, OpsCustomerRepository } from './OpsCustomerRepository';

type Row = {
  email_hash: string;
  issue_count: number | string;
  currency: string | null;
  currency_count: number | string;
  paid_minor: number | string;
  refunded_issues: number | string;
  active_deliveries: number | string;
  support_count: number | string;
  last_seen_at: Date | string;
};
type Cursor = { lastSeenAt: string; emailHash: string };
const n = (value: number | string) => Number(value);
function encode(item: OpsCustomerRecord) {
  return Buffer.from(JSON.stringify({ lastSeenAt: item.lastSeenAt.toISOString(), emailHash: item.emailHash } satisfies Cursor), 'utf8').toString('base64url');
}
function decode(value: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (!parsed.lastSeenAt || !parsed.emailHash || Number.isNaN(Date.parse(parsed.lastSeenAt))) throw new Error('invalid');
    return { lastSeenAt: parsed.lastSeenAt, emailHash: parsed.emailHash };
  } catch { throw new Error('Invalid customer cursor'); }
}

export class PostgresOpsCustomerRepository implements OpsCustomerRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async listCustomers(input: { limit: number; cursor?: string | null; emailHash?: string | null }) {
    const limit = Math.min(Math.max(Math.trunc(input.limit), 1), 100);
    const cursor = input.cursor ? decode(input.cursor) : null;
    const rows = await this.sql.query<Row>(
      `WITH grouped AS (
        SELECT contact.email_hash,
          COUNT(issue.id) AS issue_count,
          MIN(issue.currency) AS currency,
          COUNT(DISTINCT issue.currency) AS currency_count,
          COALESCE(SUM(issue.amount_minor),0) AS paid_minor,
          COUNT(issue.id) FILTER (WHERE issue.payment_exception_code='PAYMENT_REFUNDED') AS refunded_issues,
          COUNT(issue.id) FILTER (WHERE issue.status IN ('IN_PRODUCTION','IN_TRANSIT')) AS active_deliveries,
          GREATEST(MAX(contact.updated_at),COALESCE(MAX(issue.updated_at),MAX(contact.updated_at))) AS last_seen_at
        FROM verified_contacts AS contact
        LEFT JOIN issues AS issue ON issue.contact_id=contact.id
        WHERE ($1::text IS NULL OR contact.email_hash=$1)
        GROUP BY contact.email_hash
      )
      SELECT grouped.*,
        (SELECT COUNT(*)
         FROM support_requests support
         JOIN issues support_issue ON support_issue.id=support.issue_id
         JOIN verified_contacts support_contact ON support_contact.id=support_issue.contact_id
         WHERE support_contact.email_hash=grouped.email_hash) AS support_count
      FROM grouped
      WHERE ($2::timestamptz IS NULL OR (grouped.last_seen_at,grouped.email_hash) < ($2::timestamptz,$3::text))
      ORDER BY grouped.last_seen_at DESC,grouped.email_hash DESC
      LIMIT $4`,
      [input.emailHash ?? null, cursor?.lastSeenAt ?? null, cursor?.emailHash ?? null, limit + 1],
    );
    const mapped: OpsCustomerRecord[] = rows.map((row) => {
      const mixed = n(row.currency_count) > 1;
      return {
        emailHash: row.email_hash,
        contactAlias: `CONTACT ${row.email_hash.slice(0, 8).toUpperCase()}`,
        issueCount: n(row.issue_count),
        currency: mixed ? null : row.currency,
        paidMinor: mixed ? null : n(row.paid_minor),
        refundedIssues: n(row.refunded_issues),
        activeDeliveries: n(row.active_deliveries),
        supportCount: n(row.support_count),
        lastSeenAt: row.last_seen_at instanceof Date ? row.last_seen_at : new Date(row.last_seen_at),
      };
    });
    const hasMore = mapped.length > limit;
    const items = hasMore ? mapped.slice(0, limit) : mapped;
    return { items, nextCursor: hasMore && items.length ? encode(items[items.length - 1]) : null };
  }
}
