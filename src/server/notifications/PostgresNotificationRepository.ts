import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  NotificationEventKey,
  NotificationInput,
  NotificationRepository,
} from './NotificationRepository';

type InputRow = {
  issue_id: string;
  issue_code: string;
  status: string;
  payload_version: 1;
  key_version: 'v1';
  iv: string;
  auth_tag: string;
  ciphertext: string;
  tracking_url: string | null;
  tracking_number: string | null;
};
type BoolRow = { reserved: boolean };

export class PostgresNotificationRepository implements NotificationRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async loadInput(issueId: string): Promise<NotificationInput | null> {
    const rows = await this.sql.query<InputRow>(
      `SELECT issue.id AS issue_id, issue.issue_code, issue.status,
              contact.payload_version, contact.key_version, contact.iv, contact.auth_tag, contact.ciphertext,
              manufacturing.tracking_url, manufacturing.tracking_number
       FROM issues AS issue
       JOIN verified_contacts AS contact ON contact.id=issue.contact_id
       LEFT JOIN manufacturing_jobs AS manufacturing ON manufacturing.issue_id=issue.id
       WHERE issue.id=$1::uuid
       LIMIT 1`,
      [issueId],
    );
    const row = rows[0];
    if (!row) return null;
    const encryptedEmail: EncryptedPayload = {
      version: row.payload_version,
      keyVersion: row.key_version,
      iv: row.iv,
      tag: row.auth_tag,
      ciphertext: row.ciphertext,
    };
    return {
      issueId: row.issue_id,
      issueCode: row.issue_code,
      publicStatus: row.status,
      encryptedEmail,
      trackingUrl: row.tracking_url,
      trackingNumber: row.tracking_number,
    };
  }

  async reserve(issueId: string, eventKey: NotificationEventKey, at: Date) {
    const rows = await this.sql.query<BoolRow>(
      `WITH reserved AS (
         INSERT INTO notification_deliveries (
           issue_id,event_key,status,attempt_count,created_at,updated_at
         ) VALUES ($1::uuid,$2,'PENDING',1,$3,$3)
         ON CONFLICT (issue_id,event_key) DO UPDATE
         SET status='PENDING', attempt_count=notification_deliveries.attempt_count+1,
             failure_code=NULL, updated_at=EXCLUDED.updated_at
         WHERE notification_deliveries.status='FAILED'
         RETURNING id
       ) SELECT EXISTS(SELECT 1 FROM reserved) AS reserved`,
      [issueId, eventKey, at],
    );
    return rows[0]?.reserved === true;
  }

  async markSent(issueId: string, eventKey: NotificationEventKey, providerMessageId: string, at: Date) {
    await this.sql.query(
      `UPDATE notification_deliveries
       SET status='SENT', provider_message_id=$3, failure_code=NULL, sent_at=$4, updated_at=$4
       WHERE issue_id=$1::uuid AND event_key=$2 AND status='PENDING'`,
      [issueId, eventKey, providerMessageId, at],
    );
  }

  async markFailed(issueId: string, eventKey: NotificationEventKey, code: string, at: Date) {
    await this.sql.query(
      `UPDATE notification_deliveries
       SET status='FAILED', failure_code=$3, updated_at=$4
       WHERE issue_id=$1::uuid AND event_key=$2 AND status='PENDING'`,
      [issueId, eventKey, code.slice(0, 120), at],
    );
  }
}
