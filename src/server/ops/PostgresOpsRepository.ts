import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { OpsIssueRecord, OpsRepository } from './OpsRepository';

type Row = {
  issue_id: string;
  issue_code: string;
  status: string;
  object_type: string;
  size_code: string;
  color_code: string;
  amount_minor: number | string;
  currency: string;
  design_job_id: string | null;
  design_state: string | null;
  artwork_url: string | null;
  artwork_width: number | null;
  artwork_height: number | null;
  manufacturing_job_id: string | null;
  manufacturing_state: string | null;
  provider_order_id: string | null;
  tracking_number: string | null;
  updated_at: Date | string;
};

const SELECT = `SELECT
  issue.id AS issue_id,
  issue.issue_code,
  issue.status,
  issue.object_type,
  issue.size_code,
  issue.color_code,
  issue.amount_minor,
  issue.currency,
  design.id AS design_job_id,
  design.state AS design_state,
  design.artwork_url,
  design.artwork_width,
  design.artwork_height,
  manufacturing.id AS manufacturing_job_id,
  manufacturing.state AS manufacturing_state,
  manufacturing.provider_order_id,
  manufacturing.tracking_number,
  issue.updated_at
FROM issues AS issue
LEFT JOIN design_jobs AS design ON design.issue_id=issue.id
LEFT JOIN manufacturing_jobs AS manufacturing ON manufacturing.issue_id=issue.id`;

function fromRow(row: Row): OpsIssueRecord {
  return {
    issueId: row.issue_id,
    issueCode: row.issue_code,
    status: row.status,
    objectType: row.object_type,
    sizeCode: row.size_code,
    colorCode: row.color_code,
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    designJobId: row.design_job_id,
    designState: row.design_state,
    artworkUrl: row.artwork_url,
    artworkWidth: row.artwork_width,
    artworkHeight: row.artwork_height,
    manufacturingJobId: row.manufacturing_job_id,
    manufacturingState: row.manufacturing_state,
    providerOrderId: row.provider_order_id,
    trackingNumber: row.tracking_number,
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  };
}

export class PostgresOpsRepository implements OpsRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async listRecent(limit: number) {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const rows = await this.sql.query<Row>(`${SELECT} ORDER BY issue.updated_at DESC LIMIT $1`, [safeLimit]);
    return rows.map(fromRow);
  }

  async findById(issueId: string) {
    const rows = await this.sql.query<Row>(`${SELECT} WHERE issue.id=$1::uuid LIMIT 1`, [issueId]);
    return rows[0] ? fromRow(rows[0]) : null;
  }
}
