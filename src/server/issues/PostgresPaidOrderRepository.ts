import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  AuthenticatedOrderEvent,
  PaidOrderRepository,
  PaidOrderReservationInput,
  PaidOrderReservationResult,
  WebhookInboxRecord,
  WebhookProcessingStatus,
} from './PaidOrderRepository';

type InboxRow = {
  provider_event_id: string;
  processing_status: string;
  attempt_count: number;
};

type ReservationRow = {
  kind: string;
  issue_code: string | null;
};

const inboxStatuses = new Set<WebhookProcessingStatus>([
  'RECEIVED',
  'PROCESSING',
  'PROCESSED',
  'FAILED_RETRYABLE',
  'FAILED_TERMINAL',
  'IGNORED_TEST',
]);

function asInboxStatus(value: string): WebhookProcessingStatus {
  if (!inboxStatuses.has(value as WebhookProcessingStatus)) {
    throw new Error('Stored webhook processing status is invalid');
  }
  return value as WebhookProcessingStatus;
}

export class PostgresPaidOrderRepository implements PaidOrderRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async recordAuthenticatedEvent(event: AuthenticatedOrderEvent): Promise<WebhookInboxRecord> {
    const rows = await this.sql.query<InboxRow>(
      `WITH inserted AS (
         INSERT INTO webhook_events (
           provider,
           provider_event_id,
           webhook_id,
           shop_id,
           event_type,
           api_version,
           test_mode,
           provider_created_at,
           received_at,
           processing_status,
           attempt_count
         )
         VALUES ('FOURTHWALL', $1, $2, $3, $4, $5, $6, $7, $8, 'RECEIVED', 0)
         ON CONFLICT (provider, provider_event_id) DO NOTHING
         RETURNING provider_event_id, processing_status, attempt_count
       )
       SELECT provider_event_id, processing_status, attempt_count
       FROM inserted
       UNION ALL
       SELECT provider_event_id, processing_status, attempt_count
       FROM webhook_events
       WHERE provider = 'FOURTHWALL'
         AND provider_event_id = $1
         AND NOT EXISTS (SELECT 1 FROM inserted)
       LIMIT 1`,
      [
        event.providerEventId,
        event.webhookId,
        event.shopId,
        event.eventType,
        event.apiVersion,
        event.testMode,
        event.providerCreatedAt,
        event.receivedAt,
      ],
    );

    const row = rows[0];
    if (!row) throw new Error('Webhook event could not be recorded');

    return {
      providerEventId: row.provider_event_id,
      status: asInboxStatus(row.processing_status),
      attemptCount: row.attempt_count,
    };
  }

  async markIgnoredTest(providerEventId: string, now: Date): Promise<void> {
    await this.updateFailureState(providerEventId, 'IGNORED_TEST', null, now, true);
  }

  async markTerminalFailure(providerEventId: string, failureCode: string, now: Date): Promise<void> {
    await this.updateFailureState(providerEventId, 'FAILED_TERMINAL', failureCode, now, true);
  }

  async markRetryableFailure(providerEventId: string, failureCode: string, now: Date): Promise<void> {
    await this.updateFailureState(providerEventId, 'FAILED_RETRYABLE', failureCode, now, false);
  }

  async reservePaidOrder(input: PaidOrderReservationInput): Promise<PaidOrderReservationResult> {
    const rows = await this.sql.query<ReservationRow>(
      `WITH claimed AS (
         UPDATE webhook_events
         SET processing_status = 'PROCESSING',
             attempt_count = attempt_count + 1,
             failure_code = NULL,
             failure_detail = NULL
         WHERE provider = 'FOURTHWALL'
           AND provider_event_id = $1
           AND processing_status IN ('RECEIVED', 'FAILED_RETRYABLE', 'PROCESSING')
         RETURNING provider_event_id
       ), truth AS (
         SELECT
           quote.id AS quote_id,
           quote.product_slug,
           quote.variant_id,
           physical.size_code,
           physical.color_code
         FROM checkout_quotes AS quote
         JOIN experiences AS experience
           ON experience.id = quote.experience_id
         JOIN experience_physical_selection AS physical
           ON physical.experience_id = quote.experience_id
          AND physical.product_slug = quote.product_slug
          AND physical.variant_id = quote.variant_id
         WHERE quote.id = $3
           AND experience.stage = 'CHECKOUT_STARTED'
           AND physical.size_code IS NOT NULL
           AND physical.color_code IS NOT NULL
         LIMIT 1
       ), existing AS (
         SELECT issue_code
         FROM issues
         WHERE fourthwall_order_id = $2
            OR fourthwall_event_id = $1
            OR quote_id = $3
         LIMIT 1
       ), inserted AS (
         INSERT INTO issues (
           issue_code,
           status,
           fourthwall_order_id,
           fourthwall_event_id,
           quote_id,
           product_slug,
           variant_id,
           size_code,
           color_code,
           reserved_at,
           updated_at
         )
         SELECT
           $4,
           'RESERVED',
           $2,
           $1,
           truth.quote_id,
           truth.product_slug,
           truth.variant_id,
           truth.size_code,
           truth.color_code,
           $5,
           $5
         FROM truth
         WHERE EXISTS (SELECT 1 FROM claimed)
           AND NOT EXISTS (SELECT 1 FROM existing)
         ON CONFLICT DO NOTHING
         RETURNING issue_code
       ), outcome AS (
         SELECT 'reserved'::text AS kind, issue_code
         FROM inserted
         UNION ALL
         SELECT 'duplicate'::text AS kind, issue_code
         FROM existing
         WHERE NOT EXISTS (SELECT 1 FROM inserted)
         UNION ALL
         SELECT 'quote-mismatch'::text AS kind, NULL::text AS issue_code
         WHERE EXISTS (SELECT 1 FROM claimed)
           AND NOT EXISTS (SELECT 1 FROM truth)
           AND NOT EXISTS (SELECT 1 FROM existing)
         UNION ALL
         SELECT 'collision'::text AS kind, NULL::text AS issue_code
         WHERE EXISTS (SELECT 1 FROM claimed)
           AND EXISTS (SELECT 1 FROM truth)
           AND NOT EXISTS (SELECT 1 FROM existing)
           AND NOT EXISTS (SELECT 1 FROM inserted)
       ), processed AS (
         UPDATE webhook_events AS event
         SET processing_status = 'PROCESSED',
             processed_at = $5,
             failure_code = NULL,
             failure_detail = NULL
         FROM outcome
         WHERE event.provider = 'FOURTHWALL'
           AND event.provider_event_id = $1
           AND outcome.kind IN ('reserved', 'duplicate')
         RETURNING event.provider_event_id
       )
       SELECT kind, issue_code
       FROM outcome
       LIMIT 1`,
      [
        input.providerEventId,
        input.fourthwallOrderId,
        input.quoteId,
        input.candidateIssueCode,
        input.now,
      ],
    );

    const row = rows[0];
    if (!row) throw new Error('Paid order event is not claimable');

    if (row.kind === 'reserved' && row.issue_code) {
      return { kind: 'reserved', issueCode: row.issue_code };
    }
    if (row.kind === 'duplicate' && row.issue_code) {
      return { kind: 'duplicate', issueCode: row.issue_code };
    }
    if (row.kind === 'quote-mismatch') return { kind: 'quote-mismatch' };
    if (row.kind === 'collision') return { kind: 'collision' };

    throw new Error('Paid order reservation result is invalid');
  }

  private async updateFailureState(
    providerEventId: string,
    status: Extract<
      WebhookProcessingStatus,
      'IGNORED_TEST' | 'FAILED_TERMINAL' | 'FAILED_RETRYABLE'
    >,
    failureCode: string | null,
    now: Date,
    terminal: boolean,
  ): Promise<void> {
    await this.sql.query(
      `UPDATE webhook_events
       SET processing_status = $2,
           failure_code = $3,
           failure_detail = NULL,
           processed_at = CASE WHEN $4 THEN $5 ELSE NULL END
       WHERE provider = 'FOURTHWALL'
         AND provider_event_id = $1`,
      [providerEventId, status, failureCode, terminal, now],
    );
  }
}
