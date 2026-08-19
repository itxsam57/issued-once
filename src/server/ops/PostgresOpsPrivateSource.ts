import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { OpsPrivateSource } from './OpsPrivateRevealService';

type PayloadRow = {
  payload_version: number;
  key_version: string;
  iv: string;
  auth_tag: string;
  ciphertext: string;
};

type AnswerRow = PayloadRow & { slot: string; prompt_snapshot: string };
type SupportRow = PayloadRow & { id: string; status: string };

function payload(row: PayloadRow): EncryptedPayload {
  if (row.payload_version !== 1 || row.key_version !== 'v1') {
    throw new Error('Unsupported private payload version');
  }
  return {
    version: 1,
    keyVersion: 'v1',
    iv: row.iv,
    ciphertext: row.ciphertext,
    tag: row.auth_tag,
  };
}

export class PostgresOpsPrivateSource implements OpsPrivateSource {
  constructor(private readonly sql: SqlExecutor) {}

  async getContact(issueId: string) {
    const rows = await this.sql.query<PayloadRow>(
      `SELECT contact.payload_version, contact.key_version, contact.iv, contact.auth_tag, contact.ciphertext
       FROM issues AS issue
       JOIN verified_contacts AS contact ON contact.id=issue.contact_id
       WHERE issue.id=$1::uuid
       LIMIT 1`,
      [issueId],
    );
    return rows[0] ? payload(rows[0]) : null;
  }

  async getShipping(issueId: string) {
    const rows = await this.sql.query<PayloadRow>(
      `SELECT shipping.payload_version, shipping.key_version, shipping.iv, shipping.auth_tag, shipping.ciphertext
       FROM issues AS issue
       JOIN shipping_snapshots AS shipping ON shipping.id=issue.shipping_snapshot_id
       WHERE issue.id=$1::uuid
       LIMIT 1`,
      [issueId],
    );
    return rows[0] ? payload(rows[0]) : null;
  }

  async getAnswers(issueId: string) {
    const rows = await this.sql.query<AnswerRow>(
      `SELECT item.slot, item.prompt_snapshot, answer.payload_version, answer.key_version, answer.iv, answer.auth_tag, answer.ciphertext
       FROM issues AS issue
       JOIN experience_question_set_items AS item ON item.experience_id=issue.experience_id
       JOIN experience_answers AS answer ON answer.experience_id=issue.experience_id AND answer.question_id=item.slot
       WHERE issue.id=$1::uuid
       ORDER BY item.ordinal ASC`,
      [issueId],
    );
    return rows.map((row) => ({ slot: row.slot, prompt: row.prompt_snapshot, payload: payload(row) }));
  }

  async getDesignBrief(issueId: string) {
    const rows = await this.sql.query<PayloadRow>(
      `SELECT design.brief_payload_version AS payload_version, design.brief_key_version AS key_version, design.brief_iv AS iv, design.brief_auth_tag AS auth_tag, design.brief_ciphertext AS ciphertext
       FROM design_jobs AS design
       WHERE design.issue_id=$1::uuid
         AND design.brief_ciphertext IS NOT NULL
       LIMIT 1`,
      [issueId],
    );
    return rows[0] ? payload(rows[0]) : null;
  }

  async getSupportMessages(issueId: string) {
    const rows = await this.sql.query<SupportRow>(
      `SELECT id, status, payload_version, key_version, iv, auth_tag, ciphertext
       FROM support_requests
       WHERE issue_id=$1::uuid
       ORDER BY created_at DESC
       LIMIT 50`,
      [issueId],
    );
    return rows.map((row) => ({ requestId: row.id, status: row.status, payload: payload(row) }));
  }
}
