import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { CreatorOutreachCandidate, ReferralLaunchOutreachRepository } from './ReferralLaunchOutreachService';

type CandidateRow = {
  creator_id: string;
  display_name: string;
  normalized_code: string;
  email_payload_version: number;
  email_key_version: string;
  email_iv: string;
  email_auth_tag: string;
  email_ciphertext: string;
};

type ReservationRow = { id: string };

function encryptedEmail(row: CandidateRow): EncryptedPayload {
  if (Number(row.email_payload_version) !== 1 || row.email_key_version !== 'v1') {
    throw new Error('Creator email payload version is unsupported');
  }
  return {
    version: 1,
    keyVersion: 'v1',
    iv: row.email_iv,
    tag: row.email_auth_tag,
    ciphertext: row.email_ciphertext,
  };
}

export class PostgresReferralLaunchOutreachRepository implements ReferralLaunchOutreachRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async listActiveCreatorsForOutreach(campaign: string, limit: number): Promise<CreatorOutreachCandidate[]> {
    const rows = await this.sql.query<CandidateRow>(
      `SELECT
         creator.id AS creator_id,
         creator.display_name,
         creator.normalized_code,
         creator.email_payload_version,
         creator.email_key_version,
         creator.email_iv,
         creator.email_auth_tag,
         creator.email_ciphertext
       FROM referral_creators creator
       WHERE creator.active = true
         AND NOT EXISTS (
           SELECT 1
           FROM referral_creator_outreach_deliveries delivery
           WHERE delivery.creator_id = creator.id
             AND delivery.campaign = $1
             AND delivery.state = 'SENT'
         )
       ORDER BY creator.created_at, creator.id
       LIMIT $2`,
      [campaign, limit],
    );
    return rows.map((row) => ({
      creatorId: row.creator_id,
      displayName: row.display_name,
      normalizedCode: row.normalized_code,
      encryptedEmail: encryptedEmail(row),
    }));
  }

  async reserveOutreach(input: { id: string; creatorId: string; campaign: string; now: Date }): Promise<boolean> {
    const rows = await this.sql.query<ReservationRow>(
      `INSERT INTO referral_creator_outreach_deliveries (
         id, creator_id, campaign, state, attempts, created_at, updated_at
       ) VALUES ($1::uuid, $2::uuid, $3, 'QUEUED', 1, $4, $4)
       ON CONFLICT (creator_id, campaign) DO UPDATE
       SET state = 'QUEUED',
           attempts = referral_creator_outreach_deliveries.attempts + 1,
           updated_at = EXCLUDED.updated_at
       WHERE referral_creator_outreach_deliveries.state <> 'SENT'
       RETURNING id`,
      [input.id, input.creatorId, input.campaign, input.now],
    );
    return Boolean(rows[0]);
  }

  async markOutreachSent(
    creatorId: string,
    campaign: string,
    providerMessageId: string,
    at: Date,
  ): Promise<void> {
    void providerMessageId;
    await this.sql.query(
      `UPDATE referral_creator_outreach_deliveries
       SET state = 'SENT', sent_at = COALESCE(sent_at, $3), updated_at = $3
       WHERE creator_id = $1::uuid AND campaign = $2`,
      [creatorId, campaign, at],
    );
  }

  async markOutreachFailed(creatorId: string, campaign: string, errorCode: string, at: Date): Promise<void> {
    void errorCode;
    await this.sql.query(
      `UPDATE referral_creator_outreach_deliveries
       SET state = 'FAILED', updated_at = $3
       WHERE creator_id = $1::uuid AND campaign = $2 AND state <> 'SENT'`,
      [creatorId, campaign, at],
    );
  }
}
