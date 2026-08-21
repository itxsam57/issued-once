import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  ActiveReferralRuleRecord,
  CreateReferralAttributionInput,
  CreateReferralCreatorInput,
  CreateReferralPayoutRequestInput,
  ReferralAttributionRecord,
  ReferralRepository,
} from './ReferralRepository';
import type { ReferralRules } from './ReferralPolicy';
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

type RuleRow = {
  creator_id: string;
  creator_email_hash: string;
  rule_version_id: string;
  normalized_code: string;
  active: boolean;
  customer_discount_mode: 'PERCENT' | 'FIXED';
  customer_discount_bps: number | null;
  customer_discount_fixed_minor: number | null;
  creator_reward_mode: 'PERCENT' | 'FIXED';
  creator_reward_bps: number | null;
  creator_reward_fixed_minor: number | null;
  payout_cadence: 'MONTHLY' | 'THRESHOLD';
  payout_threshold_minor: number | null;
  attribution_window_days: number;
};

type AttributionRow = RuleRow & {
  attribution_id: string;
  source: 'LINK' | 'CODE';
  created_at: Date | string;
  expires_at: Date | string;
};

function referralValue(
  mode: 'PERCENT' | 'FIXED',
  basisPoints: number | null,
  fixedMinor: number | null,
): ReferralRules['customerDiscount'] {
  if (mode === 'PERCENT' && basisPoints !== null) return { mode, basisPoints: Number(basisPoints) };
  if (mode === 'FIXED' && fixedMinor !== null) return { mode, amountMinor: Number(fixedMinor) };
  throw new Error('Stored referral value is invalid');
}

function toRule(row: RuleRow): ActiveReferralRuleRecord {
  return {
    creatorId: row.creator_id,
    creatorEmailHash: row.creator_email_hash,
    ruleVersionId: row.rule_version_id,
    normalizedCode: row.normalized_code,
    active: row.active,
    rules: validateReferralRules({
      customerDiscount: referralValue(row.customer_discount_mode, row.customer_discount_bps, row.customer_discount_fixed_minor),
      creatorReward: referralValue(row.creator_reward_mode, row.creator_reward_bps, row.creator_reward_fixed_minor),
      payoutCadence: row.payout_cadence,
      payoutThresholdMinor: row.payout_threshold_minor === null ? null : Number(row.payout_threshold_minor),
      attributionWindowDays: Number(row.attribution_window_days),
    }),
  };
}

const ruleColumns = `
  c.id AS creator_id,
  c.email_hash AS creator_email_hash,
  rv.id AS rule_version_id,
  c.normalized_code,
  c.active,
  rv.customer_discount_mode,
  rv.customer_discount_bps,
  rv.customer_discount_fixed_minor,
  rv.creator_reward_mode,
  rv.creator_reward_bps,
  rv.creator_reward_fixed_minor,
  rv.payout_cadence,
  rv.payout_threshold_minor,
  rv.attribution_window_days
`;

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

  async findActiveRuleByCode(code: string): Promise<ActiveReferralRuleRecord | null> {
    const normalizedCode = normalizeReferralCode(code);
    const rows = await this.sql.query<RuleRow>(
      `
        SELECT ${ruleColumns}
        FROM referral_creators c
        JOIN LATERAL (
          SELECT *
          FROM referral_rule_versions candidate
          WHERE candidate.creator_id = c.id
          ORDER BY candidate.version DESC
          LIMIT 1
        ) rv ON true
        WHERE c.normalized_code = $1
          AND c.active = true
        LIMIT 1
      `,
      [normalizedCode],
    );
    return rows[0] ? toRule(rows[0]) : null;
  }

  async createAttribution(input: CreateReferralAttributionInput): Promise<void> {
    if (input.expiresAt.getTime() <= input.createdAt.getTime()) throw new Error('Referral attribution expiry is invalid');
    await this.sql.query(
      `
        INSERT INTO referral_attributions (
          id, creator_id, rule_version_id, source, created_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [input.id, input.creatorId, input.ruleVersionId, input.source, input.createdAt, input.expiresAt],
    );
  }

  async findAttribution(id: string): Promise<ReferralAttributionRecord | null> {
    const rows = await this.sql.query<AttributionRow>(
      `
        SELECT
          a.id AS attribution_id,
          a.source,
          a.created_at,
          a.expires_at,
          ${ruleColumns}
        FROM referral_attributions a
        JOIN referral_creators c ON c.id = a.creator_id
        JOIN referral_rule_versions rv ON rv.id = a.rule_version_id AND rv.creator_id = c.id
        WHERE a.id = $1
        LIMIT 1
      `,
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      ...toRule(row),
      id: row.attribution_id,
      source: row.source,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      expiresAt: row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at),
    };
  }
}
