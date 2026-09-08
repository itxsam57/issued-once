import { encryptedPayloadFromStorage, type EncryptedPayload } from '@/server/crypto/privatePayload';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  ReferralNotificationInput,
  ReferralNotificationKind,
  ReferralNotificationRepository,
} from './ReferralNotificationRepository';

type NotificationInputRow = {
  conversion_id: string;
  creator_id: string;
  email_payload_version: 1 | number;
  email_key_version: 'v1' | string;
  email_iv: string;
  email_auth_tag: string;
  email_ciphertext: string;
  reward_amount_minor: number | string;
  currency: string;
  pending_balance_minor: number | string | null;
  available_balance_minor: number | string | null;
};

type ReservationRow = { id: string };

function encryptedEmail(row: NotificationInputRow): EncryptedPayload {
  return encryptedPayloadFromStorage({
    payloadVersion: Number(row.email_payload_version),
    keyVersion: row.email_key_version,
    iv: row.email_iv,
    tag: row.email_auth_tag,
    ciphertext: row.email_ciphertext,
  });
}

export class PostgresReferralNotificationRepository implements ReferralNotificationRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async loadNotificationInput(conversionId: string): Promise<ReferralNotificationInput | null> {
    const rows = await this.sql.query<NotificationInputRow>(
      `
        SELECT
          conversion.id AS conversion_id,
          conversion.creator_id,
          creator.email_payload_version,
          creator.email_key_version,
          creator.email_iv,
          creator.email_auth_tag,
          creator.email_ciphertext,
          conversion.reward_amount_minor,
          conversion.currency,
          COALESCE(SUM(ledger.reward_amount_minor) FILTER (WHERE ledger.state = 'PENDING'), 0) AS pending_balance_minor,
          COALESCE(SUM(ledger.reward_amount_minor) FILTER (WHERE ledger.state = 'AVAILABLE'), 0) AS available_balance_minor
        FROM referral_conversions conversion
        JOIN referral_creators creator
          ON creator.id = conversion.creator_id
        LEFT JOIN referral_conversions ledger
          ON ledger.creator_id = conversion.creator_id
         AND ledger.currency = conversion.currency
        WHERE conversion.id = $1::uuid
        GROUP BY
          conversion.id,
          conversion.creator_id,
          creator.email_payload_version,
          creator.email_key_version,
          creator.email_iv,
          creator.email_auth_tag,
          creator.email_ciphertext,
          conversion.reward_amount_minor,
          conversion.currency
        LIMIT 1
      `,
      [conversionId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      conversionId: row.conversion_id,
      creatorId: row.creator_id,
      encryptedEmail: encryptedEmail(row),
      rewardAmountMinor: Number(row.reward_amount_minor),
      currency: row.currency,
      pendingBalanceMinor: Number(row.pending_balance_minor ?? 0),
      availableBalanceMinor: Number(row.available_balance_minor ?? 0),
    };
  }

  async reserveNotification(input: {
    id: string;
    conversionId: string;
    kind: ReferralNotificationKind;
    now: Date;
  }): Promise<boolean> {
    const rows = await this.sql.query<ReservationRow>(
      `
        INSERT INTO referral_notification_deliveries (
          id, conversion_id, kind, state, attempts, created_at, updated_at
        ) VALUES ($1::uuid, $2::uuid, $3, 'QUEUED', 1, $4, $4)
        ON CONFLICT (conversion_id, kind) DO UPDATE
        SET
          state = 'QUEUED',
          attempts = referral_notification_deliveries.attempts + 1,
          updated_at = EXCLUDED.updated_at
        WHERE referral_notification_deliveries.state <> 'SENT'
        RETURNING id
      `,
      [input.id, input.conversionId, input.kind, input.now],
    );
    return Boolean(rows[0]);
  }

  async markNotificationSent(
    conversionId: string,
    kind: ReferralNotificationKind,
    providerMessageId: string,
    now: Date,
  ): Promise<void> {
    void providerMessageId;
    await this.sql.query(
      `
        UPDATE referral_notification_deliveries
        SET state = 'SENT', sent_at = COALESCE(sent_at, $3), updated_at = $3
        WHERE conversion_id = $1::uuid AND kind = $2
      `,
      [conversionId, kind, now],
    );
  }

  async markNotificationFailed(
    conversionId: string,
    kind: ReferralNotificationKind,
    errorCode: string,
    now: Date,
  ): Promise<void> {
    void errorCode;
    await this.sql.query(
      `
        UPDATE referral_notification_deliveries
        SET state = 'FAILED', updated_at = $3
        WHERE conversion_id = $1::uuid AND kind = $2 AND state <> 'SENT'
      `,
      [conversionId, kind, now],
    );
  }
}
