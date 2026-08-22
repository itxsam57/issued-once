import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  OpsAuditInput,
  OpsAuditListInput,
  OpsAuditPage,
  OpsAuditRecord,
  OpsAuditRepository,
} from './OpsAuditRepository';

type AuditRow = {
  id: string;
  actor_type: 'OWNER';
  action_type: string;
  issue_id: string | null;
  target_type: string;
  target_id: string;
  reason: string | null;
  safe_metadata: Record<string, string | number | boolean | null> | string;
  created_at: Date | string;
};
type CursorPayload = { createdAt: string; id: string };

function toRecord(row: AuditRow): OpsAuditRecord {
  const safeMetadata = typeof row.safe_metadata === 'string'
    ? JSON.parse(row.safe_metadata) as Record<string, string | number | boolean | null>
    : row.safe_metadata;
  return {
    id: row.id, actor: row.actor_type, action: row.action_type, issueId: row.issue_id,
    targetType: row.target_type, targetId: row.target_id, reason: row.reason, safeMetadata,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}
function encodeCursor(record: OpsAuditRecord): string {
  return Buffer.from(JSON.stringify({ createdAt: record.createdAt.toISOString(), id: record.id } satisfies CursorPayload), 'utf8').toString('base64url');
}
function decodeCursor(cursor: string): CursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<CursorPayload>;
    if (!parsed.createdAt || !parsed.id || Number.isNaN(Date.parse(parsed.createdAt))) throw new Error('invalid');
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch { throw new Error('Invalid audit cursor'); }
}

export class PostgresOpsAuditRepository implements OpsAuditRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async append(input: OpsAuditInput): Promise<void> {
    await this.sql.query(
      `INSERT INTO ops_audit_events (actor_type,action_type,issue_id,target_type,target_id,reason,safe_metadata,created_at)
       VALUES ($1,$2,$3::uuid,$4,$5,$6,$7::jsonb,NOW())`,
      [input.actor,input.action,input.issueId,input.targetType,input.targetId,input.reason,JSON.stringify(input.safeMetadata)],
    );
  }

  async listRecent(input: OpsAuditListInput): Promise<OpsAuditPage> {
    const limit = Math.min(Math.max(Math.trunc(input.limit), 1), 100);
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const rows = await this.sql.query<AuditRow>(
      `SELECT audit.id,audit.actor_type,audit.action_type,audit.issue_id,audit.target_type,audit.target_id,
        audit.reason,audit.safe_metadata,audit.created_at
       FROM ops_audit_events AS audit
       LEFT JOIN issues AS issue ON issue.id=audit.issue_id
       WHERE ($1::timestamptz IS NULL OR (audit.created_at,audit.id) < ($1::timestamptz,$2::uuid))
         AND ($3::text IS NULL OR audit.action_type=$3)
         AND ($4::text IS NULL OR issue.issue_code ILIKE $4)
         AND ($5::text IS NULL OR audit.target_type ILIKE $5 OR audit.target_id ILIKE $5)
         AND ($6::timestamptz IS NULL OR audit.created_at >= $6)
         AND ($7::timestamptz IS NULL OR audit.created_at <= $7)
       ORDER BY audit.created_at DESC,audit.id DESC
       LIMIT $8`,
      [
        cursor?.createdAt ?? null,
        cursor?.id ?? null,
        input.action?.trim() || null,
        input.issueCode?.trim() ? `%${input.issueCode.trim()}%` : null,
        input.target?.trim() ? `%${input.target.trim()}%` : null,
        input.from ?? null,
        input.to ?? null,
        limit + 1,
      ],
    );
    const records = rows.map(toRecord);
    const hasMore = records.length > limit;
    const items = hasMore ? records.slice(0, limit) : records;
    return { items, nextCursor: hasMore && items.length > 0 ? encodeCursor(items[items.length - 1]) : null };
  }
}
