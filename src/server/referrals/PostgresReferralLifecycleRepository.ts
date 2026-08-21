import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  ReferralConversionLifecycleIdentity,
  ReferralConversionState,
  ReferralLifecycleRepository,
  ReferralLifecycleTransitionResult,
} from './ReferralRepository';

type LifecycleRow = {
  id: string;
  creator_id: string;
  reward_amount_minor: number | string;
  currency: string;
  state: ReferralConversionState;
};

function toIdentity(row: LifecycleRow): ReferralConversionLifecycleIdentity {
  return {
    id: row.id,
    creatorId: row.creator_id,
    rewardAmountMinor: Number(row.reward_amount_minor),
    currency: row.currency,
    state: row.state,
  };
}

export class PostgresReferralLifecycleRepository implements ReferralLifecycleRepository {
  constructor(private readonly sql: SqlExecutor) {}

  private async findByIssueId(issueId: string): Promise<ReferralConversionLifecycleIdentity | null> {
    const rows = await this.sql.query<LifecycleRow>(
      `SELECT id, creator_id, reward_amount_minor, currency, state
       FROM referral_conversions
       WHERE issue_id = $1::uuid
       ORDER BY converted_at DESC, id DESC
       LIMIT 1`,
      [issueId],
    );
    return rows[0] ? toIdentity(rows[0]) : null;
  }

  private async findByPaymentAttemptId(paymentAttemptId: string): Promise<ReferralConversionLifecycleIdentity | null> {
    const rows = await this.sql.query<LifecycleRow>(
      `SELECT id, creator_id, reward_amount_minor, currency, state
       FROM referral_conversions
       WHERE payment_attempt_id = $1
       LIMIT 1`,
      [paymentAttemptId],
    );
    return rows[0] ? toIdentity(rows[0]) : null;
  }

  async markAvailableByIssueId(issueId: string, at: Date): Promise<ReferralLifecycleTransitionResult> {
    const rows = await this.sql.query<LifecycleRow>(
      `WITH target AS (
         SELECT id
         FROM referral_conversions
         WHERE issue_id = $1::uuid
         ORDER BY converted_at DESC, id DESC
         LIMIT 1
       )
       UPDATE referral_conversions conversion
       SET state = 'AVAILABLE',
           available_at = COALESCE(available_at, $2),
           updated_at = GREATEST(conversion.updated_at, $2)
       FROM target
       WHERE conversion.id = target.id
         AND conversion.state = 'PENDING'
       RETURNING conversion.id, conversion.creator_id, conversion.reward_amount_minor,
                 conversion.currency, conversion.state`,
      [issueId, at],
    );
    if (rows[0]) return { kind: 'updated', conversion: toIdentity(rows[0]) };

    const existing = await this.findByIssueId(issueId);
    return existing ? { kind: 'duplicate', conversion: existing } : { kind: 'not-referred' };
  }

  async reverseByPaymentAttemptId(
    paymentAttemptId: string,
    at: Date,
  ): Promise<ReferralLifecycleTransitionResult> {
    const rows = await this.sql.query<LifecycleRow>(
      `UPDATE referral_conversions
       SET state = 'REVERSED',
           reversed_at = COALESCE(reversed_at, $2),
           updated_at = GREATEST(updated_at, $2)
       WHERE payment_attempt_id = $1
         AND state IN ('PENDING', 'AVAILABLE', 'PAID_OUT')
       RETURNING id, creator_id, reward_amount_minor, currency, state`,
      [paymentAttemptId, at],
    );
    if (rows[0]) return { kind: 'updated', conversion: toIdentity(rows[0]) };

    const existing = await this.findByPaymentAttemptId(paymentAttemptId);
    return existing ? { kind: 'duplicate', conversion: existing } : { kind: 'not-referred' };
  }
}
