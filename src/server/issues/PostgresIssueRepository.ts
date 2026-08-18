import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  IssueObjectType,
  IssueRecord,
  IssueRepository,
  IssueStatus,
  PaidIssueTruth,
  ReserveIssueInput,
  ReserveIssueResult,
} from './IssueRepository';

type TruthRow = {
  payment_attempt_id: string;
  experience_id: string;
  contact_id: string;
  shipping_snapshot_id: string;
  quote_id: string;
  product_slug: string;
  variant_id: string;
  object_type: IssueObjectType;
  size_code: string;
  color_code: string;
  amount_minor: number | string;
  currency: string;
  provider_reference: string;
};

type IssueRow = {
  id: string;
  issue_code: string;
  status: IssueStatus;
  payment_attempt_id: string;
  experience_id: string;
  contact_id: string;
  shipping_snapshot_id: string;
  quote_id: string;
  product_slug: string;
  variant_id: string;
  object_type: IssueObjectType;
  size_code: string;
  color_code: string;
  amount_minor: number | string;
  currency: string;
  payment_provider: 'SAFEPAY';
  payment_provider_reference: string;
  reserved_at: Date | string;
  updated_at: Date | string;
};

type ReserveRow = IssueRow & { reserve_kind: 'reserved' | 'duplicate' };

const toDate = (value: Date | string) => value instanceof Date ? value : new Date(value);

function issueFromRow(row: IssueRow): IssueRecord {
  return {
    id: row.id,
    issueCode: row.issue_code,
    status: row.status,
    paymentAttemptId: row.payment_attempt_id,
    experienceId: row.experience_id,
    contactId: row.contact_id,
    shippingSnapshotId: row.shipping_snapshot_id,
    quoteId: row.quote_id,
    productSlug: row.product_slug,
    variantId: row.variant_id,
    objectType: row.object_type,
    sizeCode: row.size_code,
    colorCode: row.color_code,
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    provider: row.payment_provider,
    providerReference: row.payment_provider_reference,
    reservedAt: toDate(row.reserved_at),
    updatedAt: toDate(row.updated_at),
  };
}

const ISSUE_SELECT = `SELECT id, issue_code, status, payment_attempt_id, experience_id, contact_id,
  shipping_snapshot_id, quote_id, product_slug, variant_id, object_type, size_code, color_code,
  amount_minor, currency, payment_provider, payment_provider_reference, reserved_at, updated_at
  FROM issues`;

export class PostgresIssueRepository implements IssueRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async loadPaidTruth(paymentAttemptId: string): Promise<PaidIssueTruth | null> {
    const rows = await this.sql.query<TruthRow>(
      `SELECT
         payment.id AS payment_attempt_id,
         payment.experience_id,
         payment.contact_id,
         payment.shipping_snapshot_id,
         payment.quote_id,
         quote.product_slug,
         quote.variant_id,
         physical.object_type,
         physical.size_code,
         physical.color_code,
         payment.amount_minor,
         payment.currency,
         payment.provider_reference
       FROM payment_attempts AS payment
       JOIN checkout_quotes AS quote
         ON quote.id = payment.quote_id
        AND quote.experience_id = payment.experience_id
       JOIN experience_physical_selection AS physical
         ON physical.experience_id = payment.experience_id
        AND physical.product_slug = quote.product_slug
        AND physical.variant_id = quote.variant_id
       JOIN verified_contacts AS contact
         ON contact.id = payment.contact_id
        AND contact.experience_id = payment.experience_id
       JOIN shipping_snapshots AS shipping
         ON shipping.id = payment.shipping_snapshot_id
        AND shipping.experience_id = payment.experience_id
        AND shipping.contact_id = payment.contact_id
       WHERE payment.id = $1
         AND payment.provider = 'SAFEPAY'
         AND payment.status = 'PAID'
         AND payment.provider_reference IS NOT NULL
         AND physical.size_code IS NOT NULL
         AND physical.color_code IS NOT NULL
       LIMIT 1`,
      [paymentAttemptId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      paymentAttemptId: row.payment_attempt_id,
      experienceId: row.experience_id,
      contactId: row.contact_id,
      shippingSnapshotId: row.shipping_snapshot_id,
      quoteId: row.quote_id,
      productSlug: row.product_slug,
      variantId: row.variant_id,
      objectType: row.object_type,
      sizeCode: row.size_code,
      colorCode: row.color_code,
      amountMinor: Number(row.amount_minor),
      currency: row.currency,
      providerReference: row.provider_reference,
    };
  }

  async findByPaymentAttemptId(paymentAttemptId: string): Promise<IssueRecord | null> {
    const rows = await this.sql.query<IssueRow>(
      `${ISSUE_SELECT} WHERE payment_attempt_id = $1 LIMIT 1`,
      [paymentAttemptId],
    );
    return rows[0] ? issueFromRow(rows[0]) : null;
  }

  async reserve(input: ReserveIssueInput): Promise<ReserveIssueResult> {
    const t = input.truth;
    const rows = await this.sql.query<ReserveRow>(
      `WITH existing AS (
         SELECT *, 'duplicate'::text AS reserve_kind
         FROM issues
         WHERE payment_attempt_id = $1
         LIMIT 1
       ), inserted AS (
         INSERT INTO issues (
           id, issue_code, status,
           fourthwall_order_id, fourthwall_event_id,
           quote_id, product_slug, variant_id, size_code, color_code,
           reserved_at, updated_at,
           payment_attempt_id, experience_id, contact_id, shipping_snapshot_id,
           object_type, amount_minor, currency, payment_provider, payment_provider_reference
         )
         SELECT
           $2::uuid, $3, 'RECEIVED',
           NULL, NULL,
           $4, $5, $6, $7, $8,
           $9, $9,
           $1, $10, $11, $12,
           $13, $14, $15, 'SAFEPAY', $16
         WHERE NOT EXISTS (SELECT 1 FROM existing)
         ON CONFLICT DO NOTHING
         RETURNING *, 'reserved'::text AS reserve_kind
       ), initial_event AS (
         INSERT INTO issue_events (issue_id, event_type, source, safe_detail, created_at)
         SELECT id, 'RECEIVED', 'PAYMENT', jsonb_build_object('provider', 'SAFEPAY'), $9
         FROM inserted
         RETURNING issue_id
       )
       SELECT * FROM inserted
       UNION ALL
       SELECT * FROM existing WHERE NOT EXISTS (SELECT 1 FROM inserted)
       LIMIT 1`,
      [
        t.paymentAttemptId,
        input.issueId,
        input.issueCode,
        t.quoteId,
        t.productSlug,
        t.variantId,
        t.sizeCode,
        t.colorCode,
        input.now,
        t.experienceId,
        t.contactId,
        t.shippingSnapshotId,
        t.objectType,
        t.amountMinor,
        t.currency,
        t.providerReference,
      ],
    );

    const row = rows[0];
    if (!row) return { kind: 'collision' };
    return {
      kind: row.reserve_kind,
      issue: issueFromRow(row),
    };
  }
}
