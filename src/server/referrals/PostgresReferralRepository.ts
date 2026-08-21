import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  CreateReferralCreatorInput,
  CreateReferralPayoutRequestInput,
  ReferralRepository,
} from './ReferralRepository';
import {
  normalizeReferralCode,
  referralValueColumns,
  validateReferralRules,
} from './ReferralPolicy';

function validateEmailHash(value: string) {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error('Creator email hash is invalid');
}

function validateCurrency(value: string) {
  if (!/^[A-Z]{3}$/.test(value)) throw new Error('Payout currency is invalid');
}

export class PostgresReferralRepository implements ReferralRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async createCreator(input: CreateReferralCreatorInput): Promise<void> {
    const displayName = input.displayName.trim();
    if (!displayName) throw new Error('Creator display name is required');
    validateEmailHash(input.emailHash);
    const normalizedCode = normalizeReferralCode(input.code);
    const rules = validateReferralRules(input.rules);
    const discount = referralValueColumns(rules.customerDiscount);
    const reward = referralValueColumns(rules.creatorReward);

    await this.sql.query(
      `
        WITH created_creator AS (
          INSERT INTO referral_creators (
            id, display_name, email_hash,
            email_payload_version, email_key_version, email_iv, email_auth_tag, email_ciphertext,
            normalized_code, active, created_at, updated_at
          ) VALUES (
            $1, $2, $3,
            $4, $5, $6, $7, $8,
            $9, $10, $11, $11
          )
          RETURNING id
        )
        INSERT INTO referral_rule_versions (
          id, creator_id, version, code_snapshot,
          customer_discount_mode, customer_discount_bps, customer_discount_fixed_minor,
          creator_reward_mode, creator_reward_bps, creator_reward_fixed_minor,
          payout_cadence, payout_threshold_minor, attribution_window_days, created_at
        )
        SELECT
          $12, id, 1, $9,
          $13, $14, $15,
          $16, $17, $18,
          $19, $20, $21, $11
        FROM created_creator
      `,
      [
        input.creatorId,
        displayName,
        input.emailHash.toLowerCase(),
        input.encryptedEmail.version,
        input.encryptedEmail.keyVersion,
        input.encryptedEmail.iv,
        input.encryptedEmail.tag,
        input.encryptedEmail.ciphertext,
        normalizedCode,
        input.active,
        input.now,
        input.ruleVersionId,
        discount.mode,
        discount.basisPoints,
        discount.fixedMinor,
        reward.mode,
        reward.basisPoints,
        reward.fixedMinor,
        rules.payoutCadence,
        rules.payoutThresholdMinor,
        rules.attributionWindowDays,
      ],
    );
  }

  async createPayoutRequest(input: CreateReferralPayoutRequestInput): Promise<void> {
    validateCurrency(input.currency);
    if (!Number.isSafeInteger(input.requestedAmountMinor) || input.requestedAmountMinor <= 0) {
      throw new Error('Payout amount must be positive');
    }

    await this.sql.query(
      `
        INSERT INTO referral_payout_requests (
          id, creator_id, currency, requested_amount_minor,
          details_payload_version, details_key_version, details_iv, details_auth_tag, details_ciphertext,
          status, requested_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'REQUESTED', $10, $10)
      `,
      [
        input.payoutId,
        input.creatorId,
        input.currency,
        input.requestedAmountMinor,
        input.encryptedDetails.version,
        input.encryptedDetails.keyVersion,
        input.encryptedDetails.iv,
        input.encryptedDetails.tag,
        input.encryptedDetails.ciphertext,
        input.requestedAt,
      ],
    );
  }
}
