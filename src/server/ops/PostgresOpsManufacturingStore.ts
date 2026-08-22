import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { OpsManufacturingQueueItem, OpsManufacturingStore } from './OpsManufacturingService';

type Row = {
  issue_id: string; issue_code: string; issue_status: string; object_type: string; size_code: string; color_code: string;
  design_state: string | null; manufacturing_state: string | null; provider_order_id: string | null;
  provider_status: string | null; tracking_number: string | null; updated_at: Date | string;
};

export class PostgresOpsManufacturingStore implements OpsManufacturingStore {
  constructor(private readonly sql: SqlExecutor) {}

  async listQueue(limit: number): Promise<OpsManufacturingQueueItem[]> {
    const rows = await this.sql.query<Row>(
      `SELECT issue.id AS issue_id,issue.issue_code,issue.status AS issue_status,
        issue.object_type,issue.size_code,issue.color_code,
        design.state AS design_state,manufacturing.state AS manufacturing_state,
        manufacturing.provider_order_id,manufacturing.provider_status,manufacturing.tracking_number,
        issue.updated_at
       FROM issues AS issue
       LEFT JOIN design_jobs AS design ON design.issue_id=issue.id
       LEFT JOIN manufacturing_jobs AS manufacturing ON manufacturing.issue_id=issue.id
       WHERE issue.status IN ('DESIGN_APPROVED','MANUFACTURING_DRAFT','IN_PRODUCTION','IN_TRANSIT','EXCEPTION')
          OR manufacturing.state IN ('FAILED','DRAFT','IN_PRODUCTION','SHIPPED')
       ORDER BY CASE
         WHEN manufacturing.state='FAILED' THEN 0
         WHEN issue.status='DESIGN_APPROVED' THEN 1
         WHEN manufacturing.state='DRAFT' THEN 2
         WHEN manufacturing.state='IN_PRODUCTION' THEN 3
         ELSE 4 END,
         issue.updated_at ASC
       LIMIT $1`,
      [Math.min(Math.max(Math.trunc(limit), 1), 100)],
    );
    return rows.map((row) => ({
      issueId: row.issue_id, issueCode: row.issue_code, issueStatus: row.issue_status,
      objectType: row.object_type, sizeCode: row.size_code, colorCode: row.color_code,
      designState: row.design_state, manufacturingState: row.manufacturing_state,
      providerOrderId: row.provider_order_id, providerStatus: row.provider_status,
      trackingNumber: row.tracking_number,
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    }));
  }

  async quarantine(issueId: string, _reason: string): Promise<void> {
    const rows = await this.sql.query<{ id: string }>(
      `WITH issue_update AS (
         UPDATE issues AS issue
         SET status='EXCEPTION',updated_at=NOW()
         WHERE issue.id=$1::uuid
           AND issue.status IN ('DESIGN_APPROVED','MANUFACTURING_DRAFT')
           AND NOT EXISTS (
             SELECT 1 FROM manufacturing_jobs manufacturing
             WHERE manufacturing.issue_id=issue.id
               AND manufacturing.state IN ('IN_PRODUCTION','SHIPPED','DELIVERED')
           )
         RETURNING id
       ), event AS (
         INSERT INTO issue_events(issue_id,event_type,source,safe_detail,created_at)
         SELECT id,'MANUFACTURING_QUARANTINED','OWNER',NULL,NOW() FROM issue_update
         RETURNING issue_id
       )
       SELECT id FROM issue_update`,
      [issueId],
    );
    if (!rows[0]) throw new Error('Issue cannot be quarantined after production has started');
  }
}
