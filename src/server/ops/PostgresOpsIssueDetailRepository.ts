import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  OpsIssueDetail,
  OpsIssueDetailRepository,
  OpsIssueFilters,
  OpsIssueListItem,
} from './OpsIssueDetailRepository';

type ListRow = {
  issue_id: string;
  issue_code: string;
  status: string;
  object_type: string;
  size_code: string;
  color_code: string;
  amount_minor: number | string;
  currency: string;
  payment_status: string | null;
  design_state: string | null;
  manufacturing_state: string | null;
  provider_order_id: string | null;
  tracking_number: string | null;
  payment_exception_code: string | null;
  updated_at: Date | string;
};

type DetailRow = ListRow & {
  payment_provider: string | null;
  payment_provider_reference: string | null;
  design_job_id: string | null;
  artwork_width: number | null;
  artwork_height: number | null;
  design_provider: string | null;
  design_model: string | null;
  manufacturing_job_id: string | null;
  provider_status: string | null;
  tracking_url: string | null;
  has_verified_email: boolean;
  has_shipping: boolean;
  has_answers: boolean;
  has_private_brief: boolean;
  has_support_message: boolean;
  reserved_at: Date | string;
};

type TimelineRow = { event_type: string; source: string; safe_detail: Record<string, unknown> | null | string; created_at: Date | string };
type NotificationRow = { event_key: string; status: string; attempt_count: number; updated_at: Date | string };
type SupportRow = { id: string; status: string; created_at: Date | string; updated_at: Date | string };
type Cursor = { updatedAt: string; id: string };

const date = (value: Date | string) => value instanceof Date ? value : new Date(value);
const number = (value: number | string) => Number(value);

function listItem(row: ListRow): OpsIssueListItem {
  return {
    issueId: row.issue_id,
    issueCode: row.issue_code,
    status: row.status,
    objectType: row.object_type,
    sizeCode: row.size_code,
    colorCode: row.color_code,
    amountMinor: number(row.amount_minor),
    currency: row.currency,
    paymentStatus: row.payment_status,
    designState: row.design_state,
    manufacturingState: row.manufacturing_state,
    providerOrderId: row.provider_order_id,
    trackingNumber: row.tracking_number,
    paymentExceptionCode: row.payment_exception_code,
    updatedAt: date(row.updated_at),
  };
}

function encodeCursor(item: OpsIssueListItem): string {
  return Buffer.from(JSON.stringify({ updatedAt: item.updatedAt.toISOString(), id: item.issueId } satisfies Cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (!parsed.updatedAt || !parsed.id || Number.isNaN(Date.parse(parsed.updatedAt))) throw new Error('invalid');
    return { updatedAt: parsed.updatedAt, id: parsed.id };
  } catch {
    throw new Error('Invalid Issue cursor');
  }
}

export class PostgresOpsIssueDetailRepository implements OpsIssueDetailRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async listIssues(input: { cursor?: string | null; limit: number; search?: string | null; filters: OpsIssueFilters }) {
    const limit = Math.min(Math.max(Math.trunc(input.limit), 1), 100);
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const search = input.search?.trim() ? `${input.search.trim()}%` : null;
    const f = input.filters;
    if (f.updatedFrom && f.updatedTo && f.updatedFrom.getTime() > f.updatedTo.getTime()) throw new Error('Invalid Issue date range');
    const rows = await this.sql.query<ListRow>(
      `SELECT
        issue.id AS issue_id,
        issue.issue_code,
        issue.status,
        issue.object_type,
        issue.size_code,
        issue.color_code,
        issue.amount_minor,
        issue.currency,
        payment.status AS payment_status,
        design.state AS design_state,
        manufacturing.state AS manufacturing_state,
        manufacturing.provider_order_id,
        manufacturing.tracking_number,
        issue.payment_exception_code,
        issue.updated_at
      FROM issues AS issue
      LEFT JOIN payment_attempts AS payment ON payment.id=issue.payment_attempt_id
      LEFT JOIN design_jobs AS design ON design.issue_id=issue.id
      LEFT JOIN manufacturing_jobs AS manufacturing ON manufacturing.issue_id=issue.id
      LEFT JOIN shipping_snapshots AS shipping ON shipping.id=issue.shipping_snapshot_id
      WHERE (
        $1::text IS NULL OR
        issue.issue_code ILIKE $1 OR
        issue.payment_provider_reference ILIKE $1 OR
        manufacturing.provider_order_id ILIKE $1 OR
        manufacturing.tracking_number ILIKE $1
      )
        AND ($2::text IS NULL OR issue.status=$2)
        AND ($3::text IS NULL OR payment.status=$3)
        AND ($4::text IS NULL OR design.state=$4)
        AND ($5::text IS NULL OR manufacturing.state=$5)
        AND ($6::text IS NULL OR issue.object_type=$6)
        AND ($7::boolean IS NULL OR EXISTS (SELECT 1 FROM support_requests support WHERE support.issue_id=issue.id AND support.status='OPEN')=$7)
        AND ($8::boolean IS NULL OR (issue.payment_exception_code IS NOT NULL)=$8)
        AND ($9::text IS NULL OR shipping.country_code=$9)
        AND ($10::timestamptz IS NULL OR issue.updated_at >= $10)
        AND ($11::timestamptz IS NULL OR issue.updated_at <= $11)
        AND ($12::timestamptz IS NULL OR (issue.updated_at,issue.id) < ($12::timestamptz,$13::uuid))
      ORDER BY issue.updated_at DESC, issue.id DESC
      LIMIT $14`,
      [
        search,
        f.issueStatus ?? null,
        f.paymentStatus ?? null,
        f.designState ?? null,
        f.manufacturingState ?? null,
        f.objectType ?? null,
        f.supportOpen ?? null,
        f.paymentException ?? null,
        f.countryCode?.trim().toUpperCase() || null,
        f.updatedFrom ?? null,
        f.updatedTo ?? null,
        cursor?.updatedAt ?? null,
        cursor?.id ?? null,
        limit + 1,
      ],
    );
    const mapped = rows.map(listItem);
    const hasMore = mapped.length > limit;
    const items = hasMore ? mapped.slice(0, limit) : mapped;
    return { items, nextCursor: hasMore && items.length ? encodeCursor(items[items.length - 1]) : null };
  }

  async getIssueDetail(issueId: string): Promise<OpsIssueDetail | null> {
    const rows = await this.sql.query<DetailRow>(
      `SELECT
        issue.id AS issue_id,
        issue.issue_code,
        issue.status,
        issue.object_type,
        issue.size_code,
        issue.color_code,
        issue.amount_minor,
        issue.currency,
        payment.status AS payment_status,
        issue.payment_provider,
        issue.payment_provider_reference,
        issue.payment_exception_code,
        design.id AS design_job_id,
        design.state AS design_state,
        design.artwork_width,
        design.artwork_height,
        design.provider AS design_provider,
        design.model AS design_model,
        manufacturing.id AS manufacturing_job_id,
        manufacturing.state AS manufacturing_state,
        manufacturing.provider_order_id,
        manufacturing.provider_status,
        manufacturing.tracking_number,
        manufacturing.tracking_url,
        EXISTS (SELECT 1 FROM verified_contacts contact WHERE contact.id=issue.contact_id) AS has_verified_email,
        EXISTS (SELECT 1 FROM shipping_snapshots shipping WHERE shipping.id=issue.shipping_snapshot_id) AS has_shipping,
        EXISTS (SELECT 1 FROM experience_answers answer WHERE answer.experience_id=issue.experience_id) AS has_answers,
        (design.brief_ciphertext IS NOT NULL) AS has_private_brief,
        EXISTS (SELECT 1 FROM support_requests support WHERE support.issue_id=issue.id) AS has_support_message,
        issue.reserved_at,
        issue.updated_at
      FROM issues AS issue
      LEFT JOIN payment_attempts AS payment ON payment.id=issue.payment_attempt_id
      LEFT JOIN design_jobs AS design ON design.issue_id=issue.id
      LEFT JOIN manufacturing_jobs AS manufacturing ON manufacturing.issue_id=issue.id
      WHERE issue.id=$1::uuid
      LIMIT 1`,
      [issueId],
    );
    const row = rows[0];
    if (!row) return null;

    const [timelineRows, notificationRows, supportRows] = await Promise.all([
      this.sql.query<TimelineRow>(
        `SELECT event_type, source, safe_detail, created_at FROM issue_events WHERE issue_id=$1::uuid ORDER BY created_at ASC, id ASC LIMIT 500`,
        [issueId],
      ),
      this.sql.query<NotificationRow>(
        `SELECT event_key, status, attempt_count, updated_at FROM notification_deliveries WHERE issue_id=$1::uuid ORDER BY created_at ASC LIMIT 50`,
        [issueId],
      ),
      this.sql.query<SupportRow>(
        `SELECT id, status, created_at, updated_at FROM support_requests WHERE issue_id=$1::uuid ORDER BY created_at DESC LIMIT 50`,
        [issueId],
      ),
    ]);

    return {
      ...listItem(row),
      paymentProvider: row.payment_provider,
      paymentProviderReference: row.payment_provider_reference,
      designJobId: row.design_job_id,
      artworkWidth: row.artwork_width,
      artworkHeight: row.artwork_height,
      designProvider: row.design_provider,
      designModel: row.design_model,
      manufacturingJobId: row.manufacturing_job_id,
      providerStatus: row.provider_status,
      trackingUrl: row.tracking_url,
      reservedAt: date(row.reserved_at),
      privacy: {
        verifiedEmail: row.has_verified_email,
        shipping: row.has_shipping,
        answers: row.has_answers,
        privateBrief: row.has_private_brief,
        supportMessage: row.has_support_message,
      },
      timeline: timelineRows.map((event) => ({
        eventType: event.event_type,
        source: event.source,
        safeDetail: typeof event.safe_detail === 'string' ? JSON.parse(event.safe_detail) as Record<string, unknown> : event.safe_detail,
        createdAt: date(event.created_at),
      })),
      notifications: notificationRows.map((notification) => ({
        eventKey: notification.event_key,
        status: notification.status,
        attemptCount: notification.attempt_count,
        updatedAt: date(notification.updated_at),
      })),
      support: supportRows.map((request) => ({
        requestId: request.id,
        status: request.status,
        createdAt: date(request.created_at),
        updatedAt: date(request.updated_at),
      })),
    };
  }
}
