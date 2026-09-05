import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { SupportContext, SupportRepository, SupportRequestRecord } from './SupportRepository';

type ContextRow = {
  issue_id: string;
  issue_code: string;
  contact_id: string;
  payload_version: 1;
  key_version: EncryptedPayload['keyVersion'];
  iv: string;
  auth_tag: string;
  ciphertext: string;
};

export class PostgresSupportRepository implements SupportRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findContextBySessionHash(sessionHash: string): Promise<SupportContext | null> {
    const rows = await this.sql.query<ContextRow>(
      `SELECT issue.id AS issue_id, issue.issue_code, contact.id AS contact_id,
              contact.payload_version, contact.key_version, contact.iv, contact.auth_tag, contact.ciphertext
       FROM experiences AS experience
       JOIN issues AS issue ON issue.experience_id=experience.id
       JOIN verified_contacts AS contact ON contact.id=issue.contact_id
       WHERE experience.public_session_hash=$1
       LIMIT 1`,
      [sessionHash],
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
      contactId: row.contact_id,
      encryptedEmail,
    };
  }

  async create(record: SupportRequestRecord): Promise<void> {
    const encrypted = record.encryptedMessage;
    await this.sql.query(
      `INSERT INTO support_requests (
         id,issue_id,contact_id,status,payload_version,key_version,iv,auth_tag,ciphertext,created_at,updated_at
       ) VALUES ($1::uuid,$2::uuid,$3,'OPEN',$4,$5,$6,$7,$8,$9,$10)`,
      [record.id,record.issueId,record.contactId,encrypted.version,encrypted.keyVersion,encrypted.iv,encrypted.tag,encrypted.ciphertext,record.createdAt,record.updatedAt],
    );
  }
}
