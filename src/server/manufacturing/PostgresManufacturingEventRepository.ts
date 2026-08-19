import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  ManufacturingEventApplyResult,
  ManufacturingEventKind,
  ManufacturingEventRepository,
} from './ManufacturingEventRepository';
import type { NormalizedPrintfulEvent } from './PrintfulWebhookVerifier';

type OutcomeRow = { outcome: ManufacturingEventKind; issue_id: string | null };

function targetStates(event: NormalizedPrintfulEvent): {
  manufacturingState: string | null;
  issueState: string | null;
  issueEvent: string;
} {
  switch (event.type) {
    case 'SHIPMENT_SENT':
      return { manufacturingState: 'SHIPPED', issueState: 'IN_TRANSIT', issueEvent: 'IN_TRANSIT' };
    case 'SHIPMENT_DELIVERED':
      return { manufacturingState: 'DELIVERED', issueState: 'DELIVERED', issueEvent: 'DELIVERED' };
    case 'SHIPMENT_CANCELED':
    case 'ORDER_FAILED':
      return { manufacturingState: 'FAILED', issueState: 'EXCEPTION', issueEvent: 'EXCEPTION' };
    case 'ORDER_CANCELED':
      return { manufacturingState: 'CANCELED', issueState: 'CANCELED', issueEvent: 'CANCELED' };
    case 'ORDER_UPDATED':
      return { manufacturingState: null, issueState: null, issueEvent: 'PROVIDER_UPDATED' };
  }
}

export class PostgresManufacturingEventRepository implements ManufacturingEventRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async applyProviderEvent(event: NormalizedPrintfulEvent): Promise<ManufacturingEventApplyResult> {
    const target = targetStates(event);
    const rows = await this.sql.query<OutcomeRow>(
      `WITH target AS (
         SELECT m.id AS job_id, m.issue_id, i.issue_code
         FROM manufacturing_jobs AS m
         JOIN issues AS i ON i.id=m.issue_id
         WHERE m.provider='PRINTFUL' AND m.provider_order_id=$2
         LIMIT 1
       ), mismatch AS (
         SELECT 1
         FROM target
         WHERE $3::text IS NOT NULL AND issue_code<>$3
       ), inserted_event AS (
         INSERT INTO manufacturing_provider_events (
           provider, provider_event_id, provider_order_id, event_type, received_at
         )
         SELECT 'PRINTFUL',$1,$2,$4,$5
         WHERE EXISTS (SELECT 1 FROM target)
           AND NOT EXISTS (SELECT 1 FROM mismatch)
         ON CONFLICT (provider, provider_event_id) DO NOTHING
         RETURNING provider_event_id
       ), updated_job AS (
         UPDATE manufacturing_jobs AS job
         SET state = CASE WHEN $6::text IS NULL THEN job.state ELSE $6 END,
             provider_status = COALESCE($7, job.provider_status),
             tracking_number = COALESCE($8, job.tracking_number),
             tracking_url = COALESCE($9, job.tracking_url),
             shipped_at = COALESCE($10, job.shipped_at),
             delivered_at = COALESCE($11, job.delivered_at),
             failure_code = CASE WHEN $6 IN ('FAILED','CANCELED') THEN COALESCE($12,'PRINTFUL_EVENT') ELSE job.failure_code END,
             updated_at = $5
         FROM target
         WHERE job.id=target.job_id
           AND EXISTS (SELECT 1 FROM inserted_event)
         RETURNING job.issue_id
       ), updated_issue AS (
         UPDATE issues AS issue
         SET status = CASE WHEN $13::text IS NULL THEN issue.status ELSE $13 END,
             updated_at = $5
         WHERE issue.id=(SELECT issue_id FROM updated_job LIMIT 1)
         RETURNING issue.id
       ), timeline AS (
         INSERT INTO issue_events (issue_id,event_type,source,safe_detail,created_at)
         SELECT id,$14,'PRINTFUL',jsonb_strip_nulls(jsonb_build_object(
           'tracking_number',$8,'tracking_url',$9,'provider_status',$7
         )),$5
         FROM updated_issue
         RETURNING issue_id
       )
       SELECT 'mismatch'::text AS outcome, (SELECT issue_id FROM target LIMIT 1) AS issue_id
       WHERE EXISTS (SELECT 1 FROM mismatch)
       UNION ALL
       SELECT 'unknown-order'::text AS outcome, NULL::uuid AS issue_id
       WHERE NOT EXISTS (SELECT 1 FROM target)
       UNION ALL
       SELECT 'applied'::text AS outcome, (SELECT issue_id FROM updated_job LIMIT 1) AS issue_id
       WHERE EXISTS (SELECT 1 FROM updated_job)
       UNION ALL
       SELECT 'duplicate'::text AS outcome, (SELECT issue_id FROM target LIMIT 1) AS issue_id
       WHERE EXISTS (SELECT 1 FROM target)
         AND NOT EXISTS (SELECT 1 FROM mismatch)
         AND NOT EXISTS (SELECT 1 FROM inserted_event)
       LIMIT 1`,
      [
        event.providerEventId,
        event.providerOrderId,
        event.externalIssueCode,
        event.type,
        event.occurredAt,
        target.manufacturingState,
        event.providerStatus,
        event.trackingNumber,
        event.trackingUrl,
        event.shippedAt,
        event.deliveredAt,
        event.reason,
        target.issueState,
        target.issueEvent,
      ],
    );
    const row = rows[0];
    return {
      kind: row?.outcome ?? 'unknown-order',
      ...(row?.issue_id ? { issueId: row.issue_id } : {}),
    };
  }
}
