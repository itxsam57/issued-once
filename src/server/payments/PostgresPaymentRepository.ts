import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  PaymentAttemptRecord,
  PaymentAttemptStatus,
  PaymentProviderEvent,
  PaymentRepository,
} from './PaymentRepository';

type AttemptRow = {
  id: string; experience_id: string; quote_id: string; contact_id: string; shipping_snapshot_id: string;
  provider: 'SAFEPAY'; provider_reference: string | null; checkout_url: string | null;
  amount_minor: number | string; currency: string; status: PaymentAttemptStatus;
  created_at: Date | string; updated_at: Date | string;
};
type BoolRow = { inserted: boolean };
type OutcomeRow = { outcome: 'paid' | 'duplicate' | 'mismatch' };

const d = (v: Date | string) => v instanceof Date ? v : new Date(v);
const fromRow = (r: AttemptRow): PaymentAttemptRecord => ({
  id: r.id, experienceId: r.experience_id, quoteId: r.quote_id, contactId: r.contact_id,
  shippingSnapshotId: r.shipping_snapshot_id, provider: r.provider, providerReference: r.provider_reference,
  checkoutUrl: r.checkout_url, amountMinor: Number(r.amount_minor), currency: r.currency, status: r.status,
  createdAt: d(r.created_at), updatedAt: d(r.updated_at),
});
const SELECT = `SELECT id, experience_id, quote_id, contact_id, shipping_snapshot_id, provider,
  provider_reference, checkout_url, amount_minor, currency, status, created_at, updated_at FROM payment_attempts`;

export class PostgresPaymentRepository implements PaymentRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findReusable(experienceId: string, quoteId: string) {
    const rows = await this.sql.query<AttemptRow>(`${SELECT} WHERE experience_id=$1 AND quote_id=$2 AND status='REDIRECTED' ORDER BY created_at DESC LIMIT 1`, [experienceId, quoteId]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async create(record: PaymentAttemptRecord) {
    const rows = await this.sql.query<AttemptRow>(
      `WITH inserted AS (
         INSERT INTO payment_attempts (id,experience_id,quote_id,contact_id,shipping_snapshot_id,provider,provider_reference,checkout_url,amount_minor,currency,status,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,NULL,NULL,$7,$8,'CREATED',$9,$9)
         ON CONFLICT DO NOTHING
         RETURNING *
       )
       SELECT * FROM inserted
       UNION ALL
       SELECT * FROM payment_attempts
       WHERE experience_id=$2 AND quote_id=$3 AND status IN ('CREATED','REDIRECTED','PAID')
         AND NOT EXISTS (SELECT 1 FROM inserted)
       ORDER BY created_at DESC LIMIT 1`,
      [record.id,record.experienceId,record.quoteId,record.contactId,record.shippingSnapshotId,record.provider,record.amountMinor,record.currency,record.createdAt],
    );
    if (!rows[0]) throw new Error('Payment attempt could not be reserved');
    return fromRow(rows[0]);
  }

  async attachProvider(input: { attemptId: string; providerReference: string; checkoutUrl: string; updatedAt: Date }) {
    const rows = await this.sql.query<{ id: string }>(
      `UPDATE payment_attempts SET provider_reference=$2, checkout_url=$3, status='REDIRECTED', updated_at=$4
       WHERE id=$1 AND status='CREATED' RETURNING id`,
      [input.attemptId,input.providerReference,input.checkoutUrl,input.updatedAt],
    );
    if (!rows[0]) throw new Error('Payment attempt is no longer claimable');
  }

  async findByProviderReference(reference: string) {
    const rows = await this.sql.query<AttemptRow>(`${SELECT} WHERE provider='SAFEPAY' AND provider_reference=$1 LIMIT 1`, [reference]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async recordProviderEvent(event: PaymentProviderEvent) {
    const rows = await this.sql.query<BoolRow>(
      `WITH inserted AS (
         INSERT INTO payment_provider_events (provider,provider_event_id,provider_reference,state,amount_minor,currency,reference,received_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING provider_event_id
       ) SELECT EXISTS(SELECT 1 FROM inserted) AS inserted`,
      [event.provider,event.providerEventId,event.providerReference,event.state,event.amountMinor,event.currency,event.reference,event.receivedAt],
    );
    return rows[0]?.inserted === true;
  }

  async markPaid(input: { attemptId: string; providerEventId: string; amountMinor: number; currency: string; paidAt: Date }) {
    const rows = await this.sql.query<OutcomeRow>(
      `WITH current AS (SELECT status, amount_minor, currency FROM payment_attempts WHERE id=$1 FOR UPDATE),
       mismatch AS (
         UPDATE payment_attempts SET status='EXCEPTION', updated_at=$5
         WHERE id=$1 AND EXISTS (SELECT 1 FROM current WHERE status<>'PAID' AND (amount_minor<>$3 OR currency<>$4))
         RETURNING 'mismatch'::text AS outcome
       ), paid AS (
         UPDATE payment_attempts SET status='PAID', updated_at=$5
         WHERE id=$1 AND EXISTS (SELECT 1 FROM current WHERE status<>'PAID' AND amount_minor=$3 AND currency=$4)
           AND NOT EXISTS (SELECT 1 FROM mismatch)
         RETURNING 'paid'::text AS outcome
       )
       SELECT outcome FROM mismatch UNION ALL SELECT outcome FROM paid UNION ALL
       SELECT 'duplicate'::text AS outcome WHERE EXISTS (SELECT 1 FROM current WHERE status='PAID') LIMIT 1`,
      [input.attemptId,input.providerEventId,input.amountMinor,input.currency,input.paidAt],
    );
    if (!rows[0]) throw new Error('Payment attempt not found');
    return rows[0].outcome;
  }

  async markFailed(attemptId: string, _providerEventId: string, at: Date) {
    await this.sql.query(`UPDATE payment_attempts SET status='FAILED', updated_at=$2 WHERE id=$1 AND status IN ('CREATED','REDIRECTED')`, [attemptId, at]);
  }
}
