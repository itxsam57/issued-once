import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { IssueStatus } from './IssueRepository';
import type { CustomerIssueStatus, IssueStatusRepository } from './IssueStatusRepository';

type Row = {
  issue_code: string;
  status: IssueStatus;
  object_type: string;
  size_code: string;
  color_code: string;
  tracking_url: string | null;
  tracking_number: string | null;
  updated_at: Date | string;
};

const toDate = (value: Date | string) => value instanceof Date ? value : new Date(value);
const fromRow = (row: Row): CustomerIssueStatus => ({
  issueCode: row.issue_code,
  internalStatus: row.status,
  objectType: row.object_type,
  sizeCode: row.size_code,
  colorCode: row.color_code,
  trackingUrl: row.tracking_url,
  trackingNumber: row.tracking_number,
  updatedAt: toDate(row.updated_at),
});

const projection = `SELECT issue.issue_code, issue.status, issue.object_type, issue.size_code, issue.color_code,
  manufacturing.tracking_url, manufacturing.tracking_number, issue.updated_at
  FROM issues AS issue
  LEFT JOIN manufacturing_jobs AS manufacturing ON manufacturing.issue_id=issue.id`;

export class PostgresIssueStatusRepository implements IssueStatusRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findBySessionHash(sessionHash: string) {
    const rows = await this.sql.query<Row>(
      `${projection}
       JOIN experiences AS experience ON experience.id=issue.experience_id
       WHERE experience.public_session_hash=$1
       LIMIT 1`,
      [sessionHash],
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async findByIssueCode(issueCode: string) {
    const rows = await this.sql.query<Row>(
      `${projection}
       WHERE issue.issue_code=$1
       LIMIT 1`,
      [issueCode],
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }
}
