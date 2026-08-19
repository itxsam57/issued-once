import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  OpsAuditInput,
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

type CursorPayload = {
  createdAt: string;
  id: string;
};

function toRecord(row: AuditRow): OpsAuditRecord {
  const safeMetadata = typeof row.safe_metadata === 'string'
    ? JSON.parse(row.safe_metadata) as Record<string, string | number | boolean | null>
    : row.safe_metadata;

  return {
    id: row.id,
    actor: row.actor_type,
    action: row.action_type,
    issueId: row.issue_id,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    safeMetadata,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

function encodeCursor(record: OpsAuditRecord): string {
  return Buffer.from(JSON.stringify({
    createdAt: record.createdAt.toISOString(),
    id: record.id,
  } satisfies CursorPayload), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<CursorPayload>;
    if (!parsed.createdAt || !parsed.id || Number.isNaN(Date.parse(parsed.createdAt))) {
      throw new Error('invalid');
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new Error('Invalid audit cursor');
  }
}

export class PostgresOpsAuditRepository implements OpsAuditRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async append(input: OpsAuditInput): Promise<void> {
    await this.sql.query(
      `INSERT INTO ops_audit_events (
        actor_type,
        action_type,
        issue_id,
        target_type,
        target_id,
        reason,
        safe_metadata,
        created_at
      ) VALUES ($1,$2,$3::uuid,$4,$5,$6,$7::jsonb,NOW())`,
      [
        input.actor,
        input.action,
        input.issueId,
        input.targetType,
        input.targetId,
        input.reason,
        JSON.stringify(input.safeMetadata),
      ],
    );
  }

  async listRecent(input: { cursor?: string | null; limit: number }): Promise<OpsAuditPage> {
    const limit = Math.min(Math.max(Math.trunc(input.limit), 1), 100);
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const rows = await this.sql.query<AuditRow>(
      `SELECT
        id,
        actor_type,
        action_type,
        issue_id,
        target_type,
        target_id,
        reason,
        safe_metadata,
        created_at
      FROM ops_audit_events
      WHERE ($1::timestamptz IS NULL OR (created_at,id) < ($1::timestamptz,$2::uuid))
      ORDER BY created_at DESC, id DESC
      LIMIT $3`,
      [cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
    );

    const records = rows.map(toRecord);
    const hasMore = records.length > limit;
    const items = hasMore ? records.slice(0, limit) : records;
    return {
      items,
      nextCursor: hasMore && items.length > 0 ? encodeCursor(items[items.length - 1]) : null,
    };
  }
}
