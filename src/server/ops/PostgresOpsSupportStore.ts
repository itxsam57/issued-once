import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { OpsSupportQueueItem, OpsSupportStore } from './OpsSupportService';

type QueueRow = { id: string; issue_id: string; issue_code: string; issue_status: string; status: 'OPEN' | 'CLOSED'; created_at: Date | string; updated_at: Date | string; note_count: number | string };
type ContextRow = { issue_id: string; issue_code: string; payload_version: 1; key_version: 'v1'; iv: string; auth_tag: string; ciphertext: string };

function encrypted(row: ContextRow): EncryptedPayload {
  return { version: row.payload_version, keyVersion: row.key_version, iv: row.iv, tag: row.auth_tag, ciphertext: row.ciphertext };
}

export class PostgresOpsSupportStore implements OpsSupportStore {
  constructor(private readonly sql: SqlExecutor) {}

  async list(status: 'OPEN' | 'CLOSED' | null, limit: number): Promise<OpsSupportQueueItem[]> {
    const rows = await this.sql.query<QueueRow>(
      `SELECT support.id,support.issue_id,issue.issue_code,issue.status AS issue_status,support.status,support.created_at,support.updated_at,
        (SELECT COUNT(*) FROM ops_internal_notes note WHERE note.issue_id=support.issue_id) AS note_count
       FROM support_requests AS support
       JOIN issues AS issue ON issue.id=support.issue_id
       WHERE ($1::text IS NULL OR support.status=$1)
       ORDER BY CASE support.status WHEN 'OPEN' THEN 0 ELSE 1 END,support.updated_at ASC
       LIMIT $2`,
      [status, Math.min(Math.max(Math.trunc(limit), 1), 100)],
    );
    return rows.map((row) => ({
      requestId: row.id, issueId: row.issue_id, issueCode: row.issue_code, issueStatus: row.issue_status, status: row.status,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at), noteCount: Number(row.note_count),
    }));
  }

  async setStatus(requestId: string, status: 'OPEN' | 'CLOSED') {
    const rows = await this.sql.query<{ issue_id: string }>(
      `UPDATE support_requests SET status=$2,updated_at=NOW() WHERE id=$1::uuid RETURNING issue_id`, [requestId, status],
    );
    if (!rows[0]) throw new Error('Support request not found');
    return { issueId: rows[0].issue_id };
  }

  async addNote(issueId: string, body: string) {
    await this.sql.query(`INSERT INTO ops_internal_notes(issue_id,body,created_at,updated_at) VALUES ($1::uuid,$2,NOW(),NOW())`, [issueId, body]);
  }

  async getReplyContext(requestId: string) {
    const rows = await this.sql.query<ContextRow>(
      `SELECT issue.id AS issue_id,issue.issue_code,contact.payload_version,contact.key_version,contact.iv,contact.auth_tag,contact.ciphertext
       FROM support_requests AS support
       JOIN issues AS issue ON issue.id=support.issue_id
       JOIN verified_contacts AS contact ON contact.id=issue.contact_id
       WHERE support.id=$1::uuid LIMIT 1`,
      [requestId],
    );
    return rows[0] ? { issueId: rows[0].issue_id, issueCode: rows[0].issue_code, encryptedEmail: encrypted(rows[0]) } : null;
  }
}
