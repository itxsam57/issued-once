import type { EncryptedPayload } from '@/server/crypto/privatePayload';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type { ReferralRules } from '@/server/referrals/ReferralPolicy';
import {
  normalizeReferralCode,
  referralValueColumns,
  validateReferralRules,
} from '@/server/referrals/ReferralPolicy';
import type {
  CreateOpsReferralCreatorInput,
  CreateOpsReferralCreatorResult,
  CreateReferralPayoutFromAvailableInput,
  OpsReferralCreatorRecord,
  OpsReferralPayoutSummary,
  OpsReferralRepository,
  ReferralPayoutEncryptedDetailsRecord,
  ReferralPayoutRequestRecord,
  ReferralPayoutSettlementRecord,
  UpdateOpsReferralCreatorInput,
  UpdateOpsReferralCreatorResult,
} from './OpsReferralRepository';

type CreatorRow = {
  creator_id: string;
  display_name: string;
  normalized_code: string;
  active: boolean;
  rule_version_id: string;
  rule_version: number | string;
  customer_discount_mode: 'PERCENT' | 'FIXED';
  customer_discount_bps: number | null;
  customer_discount_fixed_minor: number | string | null;
  creator_reward_mode: 'PERCENT' | 'FIXED';
  creator_reward_bps: number | null;
  creator_reward_fixed_minor: number | string | null;
  payout_cadence: 'MONTHLY' | 'THRESHOLD';
  payout_threshold_minor: number | string | null;
  attribution_window_days: number | string;
  sales_count: number | string;
  currency: string | null;
  pending_minor: number | string | null;
  available_minor: number | string | null;
  paid_out_minor: number | string | null;
  reversed_minor: number | string | null;
};

type CreatorMutationRow = {
  creator_id: string;
  rule_version_id: string;
  rule_version?: number | string;
};

type PayoutRequestRow = {
  payout_id: string;
  creator_id: string;
  currency: string;
  requested_amount_minor: number | string;
  conversion_count: number | string;
  status: 'REQUESTED';
};

type PayoutDetailsRow = {
  payout_id: string;
  creator_id: string;
  status: 'REQUESTED' | 'PAID' | 'CANCELLED';
  details_payload_version: 1;
  details_key_version: 'v1' | 'v2';
  details_iv: string;
  details_auth_tag: string;
  details_ciphertext: string;
};

type PayoutSettlementRow = {
  payout_id: string;
  creator_id: string;
  currency: string;
  paid_amount_minor: number | string;
  conversion_count: number | string;
  status: 'PAID';
};

type PayoutSummaryRow = {
  payout_id: string;
  creator_id: string;
  currency: string;
  requested_amount_minor: number | string;
  conversion_count: number | string;
  status: 'REQUESTED' | 'PAID' | 'CANCELLED';
  requested_at: Date | string;
  paid_at: Date | string | null;
};

function integer(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error('Stored referral amount is invalid');
  return parsed;
}

function currency(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new Error('Payout currency is invalid');
  return normalized;
}

function emailHash(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new Error('Creator email hash is invalid');
  return normalized;
}

function displayName(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 120) throw new Error('Creator display name is invalid');
  return normalized;
}

function referralValue(
  mode: 'PERCENT' | 'FIXED',
  basisPoints: number | null,
  fixedMinor: number | string | null,
): ReferralRules['customerDiscount'] {
  if (mode === 'PERCENT' && basisPoints !== null) return { mode, basisPoints: Number(basisPoints) };
  if (mode === 'FIXED' && fixedMinor !== null) return { mode, amountMinor: Number(fixedMinor) };
  throw new Error('Stored referral value is invalid');
}

function rulesFromRow(row: CreatorRow): ReferralRules {
  return validateReferralRules({
    customerDiscount: referralValue(
      row.customer_discount_mode,
      row.customer_discount_bps,
      row.customer_discount_fixed_minor,
    ),
    creatorReward: referralValue(
      row.creator_reward_mode,
      row.creator_reward_bps,
      row.creator_reward_fixed_minor,
    ),
    payoutCadence: row.payout_cadence,
    payoutThresholdMinor: row.payout_threshold_minor == null ? null : Number(row.payout_threshold_minor),
    attributionWindowDays: Number(row.attribution_window_days),
  });
}

function encryptedDetails(row: PayoutDetailsRow): EncryptedPayload {
  return {
    version: row.details_payload_version,
    keyVersion: row.details_key_version,
    iv: row.details_iv,
    tag: row.details_auth_tag,
    ciphertext: row.details_ciphertext,
  };
}

export class PostgresOpsReferralRepository implements OpsReferralRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async listCreators(): Promise<OpsReferralCreatorRecord[]> {
    const rows = await this.sql.query<CreatorRow>(
      `SELECT
         creator.id AS creator_id,
         creator.display_name,
         creator.normalized_code,
         creator.active,
         rule.id AS rule_version_id,
         rule.version AS rule_version,
         rule.customer_discount_mode,
         rule.customer_discount_bps,
         rule.customer_discount_fixed_minor,
         rule.creator_reward_mode,
         rule.creator_reward_bps,
         rule.creator_reward_fixed_minor,
         rule.payout_cadence,
         rule.payout_threshold_minor,
         rule.attribution_window_days,
         COALESCE(sales.sales_count, 0) AS sales_count,
         balances.currency,
         COALESCE(balances.pending_minor, 0) AS pending_minor,
         COALESCE(balances.available_minor, 0) AS available_minor,
         COALESCE(balances.paid_out_minor, 0) AS paid_out_minor,
         COALESCE(balances.reversed_minor, 0) AS reversed_minor
       FROM referral_creators creator
       JOIN LATERAL (
         SELECT candidate.*
         FROM referral_rule_versions candidate
         WHERE candidate.creator_id = creator.id
         ORDER BY candidate.version DESC
         LIMIT 1
       ) rule ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::integer AS sales_count
         FROM referral_conversions conversion
         WHERE conversion.creator_id = creator.id
       ) sales ON true
       LEFT JOIN LATERAL (
         SELECT
           conversion.currency,
           COALESCE(SUM(conversion.reward_amount_minor) FILTER (WHERE conversion.state = 'PENDING'), 0)::bigint AS pending_minor,
           COALESCE(SUM(conversion.reward_amount_minor) FILTER (WHERE conversion.state = 'AVAILABLE'), 0)::bigint AS available_minor,
           COALESCE(SUM(conversion.reward_amount_minor) FILTER (WHERE conversion.state = 'PAID_OUT'), 0)::bigint AS paid_out_minor,
           COALESCE(SUM(conversion.reward_amount_minor) FILTER (WHERE conversion.state = 'REVERSED'), 0)::bigint AS reversed_minor
         FROM referral_conversions conversion
         WHERE conversion.creator_id = creator.id
         GROUP BY conversion.currency
       ) balances ON true
       ORDER BY creator.created_at DESC, creator.id, balances.currency`,
    );

    const creators = new Map<string, OpsReferralCreatorRecord>();
    for (const row of rows) {
      let creator = creators.get(row.creator_id);
      if (!creator) {
        creator = {
          creatorId: row.creator_id,
          displayName: row.display_name,
          normalizedCode: row.normalized_code,
          active: row.active,
          ruleVersionId: row.rule_version_id,
          ruleVersion: integer(row.rule_version),
          rules: rulesFromRow(row),
          salesCount: integer(row.sales_count),
          balances: [],
        };
        creators.set(row.creator_id, creator);
      }
      if (row.currency) {
        creator.balances.push({
          currency: row.currency,
          pendingMinor: integer(row.pending_minor),
          availableMinor: integer(row.available_minor),
          paidOutMinor: integer(row.paid_out_minor),
          reversedMinor: integer(row.reversed_minor),
        });
      }
    }
    return [...creators.values()];
  }

  async listPayouts(limit = 100): Promise<OpsReferralPayoutSummary[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 250);
    const rows = await this.sql.query<PayoutSummaryRow>(
      `SELECT
         payout.id AS payout_id,
         payout.creator_id,
         payout.currency,
         payout.requested_amount_minor,
         COUNT(allocation.conversion_id)::integer AS conversion_count,
         payout.status,
         payout.requested_at,
         payout.paid_at
       FROM referral_payout_requests payout
       LEFT JOIN referral_payout_allocations allocation ON allocation.payout_id = payout.id
       GROUP BY payout.id
       ORDER BY payout.requested_at DESC, payout.id DESC
       LIMIT $1`,
      [safeLimit],
    );
    return rows.map((row) => ({
      payoutId: row.payout_id,
      creatorId: row.creator_id,
      currency: row.currency,
      requestedAmountMinor: integer(row.requested_amount_minor),
      conversionCount: integer(row.conversion_count),
      status: row.status,
      requestedAt: row.requested_at instanceof Date ? row.requested_at : new Date(row.requested_at),
      paidAt: row.paid_at == null ? null : row.paid_at instanceof Date ? row.paid_at : new Date(row.paid_at),
    }));
  }

  async createCreator(input: CreateOpsReferralCreatorInput): Promise<CreateOpsReferralCreatorResult> {
    const name = displayName(input.displayName);
    const code = normalizeReferralCode(input.code);
    const rules = validateReferralRules(input.rules);
    const discount = referralValueColumns(rules.customerDiscount);
    const reward = referralValueColumns(rules.creatorReward);
    const rows = await this.sql.query<CreatorMutationRow>(
      `WITH created_creator AS (
         INSERT INTO referral_creators (
           id, display_name, email_hash,
           email_payload_version, email_key_version, email_iv, email_auth_tag, email_ciphertext,
           normalized_code, active, created_at, updated_at
         ) VALUES (
           $1::uuid, $2, $3,
           $4, $5, $6, $7, $8,
           $9, $10, $11, $11
         )
         RETURNING id
       ), created_rule AS (
         INSERT INTO referral_rule_versions (
           id, creator_id, version, code_snapshot,
           customer_discount_mode, customer_discount_bps, customer_discount_fixed_minor,
           creator_reward_mode, creator_reward_bps, creator_reward_fixed_minor,
           payout_cadence, payout_threshold_minor, attribution_window_days, created_at
         )
         SELECT
           $12::uuid, created_creator.id, 1, $9,
           $13, $14, $15,
           $16, $17, $18,
           $19, $20, $21, $11
         FROM created_creator
         RETURNING id, creator_id
       )
       SELECT creator_id, id AS rule_version_id FROM created_rule`,
      [
        input.creatorId,
        name,
        emailHash(input.emailHash),
        input.encryptedEmail.version,
        input.encryptedEmail.keyVersion,
        input.encryptedEmail.iv,
        input.encryptedEmail.tag,
        input.encryptedEmail.ciphertext,
        code,
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
    if (!rows[0]) throw new Error('Creator could not be created');
    return { creatorId: rows[0].creator_id, ruleVersionId: rows[0].rule_version_id };
  }

  async updateCreator(input: UpdateOpsReferralCreatorInput): Promise<UpdateOpsReferralCreatorResult> {
    const name = displayName(input.displayName);
    const code = normalizeReferralCode(input.code);
    const rules = validateReferralRules(input.rules);
    const discount = referralValueColumns(rules.customerDiscount);
    const reward = referralValueColumns(rules.creatorReward);
    const rows = await this.sql.query<CreatorMutationRow>(
      `WITH updated_creator AS (
         UPDATE referral_creators
         SET display_name = $3,
             normalized_code = $4,
             updated_at = $5
         WHERE id = $1::uuid
         RETURNING id
       ), next_version AS (
         SELECT COALESCE(MAX(version), 0) + 1 AS version
         FROM referral_rule_versions
         WHERE creator_id = $1::uuid
       ), created_rule AS (
         INSERT INTO referral_rule_versions (
           id, creator_id, version, code_snapshot,
           customer_discount_mode, customer_discount_bps, customer_discount_fixed_minor,
           creator_reward_mode, creator_reward_bps, creator_reward_fixed_minor,
           payout_cadence, payout_threshold_minor, attribution_window_days, created_at
         )
         SELECT
           $2::uuid, updated_creator.id, next_version.version, $4,
           $6, $7, $8,
           $9, $10, $11,
           $12, $13, $14, $5
         FROM updated_creator CROSS JOIN next_version
         RETURNING id, creator_id, version
       )
       SELECT creator_id, id AS rule_version_id, version AS rule_version FROM created_rule`,
      [
        input.creatorId,
        input.ruleVersionId,
        name,
        code,
        input.now,
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
    if (!rows[0]) throw new Error('Creator was not found');
    return {
      creatorId: rows[0].creator_id,
      ruleVersionId: rows[0].rule_version_id,
      ruleVersion: integer(rows[0].rule_version),
    };
  }

  async setCreatorActive(creatorId: string, active: boolean, at: Date): Promise<boolean> {
    const rows = await this.sql.query<{ id: string }>(
      `UPDATE referral_creators
       SET active = $2, updated_at = $3
       WHERE id = $1::uuid
       RETURNING id`,
      [creatorId, active, at],
    );
    return rows.length > 0;
  }

  async createPayoutFromAvailable(
    input: CreateReferralPayoutFromAvailableInput,
  ): Promise<ReferralPayoutRequestRecord> {
    const payoutCurrency = currency(input.currency);
    const rows = await this.sql.query<PayoutRequestRow>(
      `WITH current_rule AS MATERIALIZED (
         SELECT rule.payout_cadence, rule.payout_threshold_minor
         FROM referral_rule_versions rule
         WHERE rule.creator_id = $2::uuid
         ORDER BY rule.version DESC
         LIMIT 1
       ), candidate_conversions AS MATERIALIZED (
         SELECT conversion.id, conversion.reward_amount_minor
         FROM referral_conversions conversion
         WHERE conversion.creator_id = $2::uuid
           AND conversion.currency = $3
           AND conversion.state = 'AVAILABLE'
           AND NOT EXISTS (
             SELECT 1
             FROM referral_payout_allocations allocation
             WHERE allocation.conversion_id = conversion.id
           )
         ORDER BY conversion.available_at, conversion.id
         FOR UPDATE SKIP LOCKED
       ), totals AS (
         SELECT
           COALESCE(SUM(reward_amount_minor), 0)::bigint AS requested_amount_minor,
           COUNT(*)::integer AS conversion_count
         FROM candidate_conversions
       ), created_payout AS (
         INSERT INTO referral_payout_requests (
           id, creator_id, currency, requested_amount_minor,
           details_payload_version, details_key_version, details_iv, details_auth_tag, details_ciphertext,
           status, requested_at, updated_at
         )
         SELECT
           $1::uuid, $2::uuid, $3, totals.requested_amount_minor,
           $4, $5, $6, $7, $8,
           'REQUESTED', $9, $9
         FROM totals CROSS JOIN current_rule
         WHERE totals.requested_amount_minor > 0
           AND (
             current_rule.payout_cadence = 'MONTHLY'
             OR totals.requested_amount_minor >= current_rule.payout_threshold_minor
           )
         RETURNING id, creator_id, currency, requested_amount_minor, status
       ), created_allocations AS (
         INSERT INTO referral_payout_allocations (
           payout_id, conversion_id, amount_minor, allocated_at
         )
         SELECT created_payout.id, candidate.id, candidate.reward_amount_minor, $9
         FROM created_payout CROSS JOIN candidate_conversions candidate
         RETURNING payout_id, conversion_id, amount_minor
       ), allocation_totals AS (
         SELECT
           COUNT(*)::integer AS conversion_count,
           COALESCE(SUM(amount_minor), 0)::bigint AS allocated_amount_minor
         FROM created_allocations
       )
       SELECT
         created_payout.id AS payout_id,
         created_payout.creator_id,
         created_payout.currency,
         created_payout.requested_amount_minor,
         allocation_totals.conversion_count,
         created_payout.status
       FROM created_payout CROSS JOIN allocation_totals
       WHERE created_payout.requested_amount_minor = allocation_totals.allocated_amount_minor`,
      [
        input.payoutId,
        input.creatorId,
        payoutCurrency,
        input.encryptedDetails.version,
        input.encryptedDetails.keyVersion,
        input.encryptedDetails.iv,
        input.encryptedDetails.tag,
        input.encryptedDetails.ciphertext,
        input.requestedAt,
      ],
    );
    const row = rows[0];
    if (!row) throw new Error('No payout-eligible AVAILABLE referral earnings were found');
    return {
      payoutId: row.payout_id,
      creatorId: row.creator_id,
      currency: row.currency,
      requestedAmountMinor: integer(row.requested_amount_minor),
      conversionCount: integer(row.conversion_count),
      status: row.status,
    };
  }

  async getPayoutEncryptedDetails(
    payoutId: string,
  ): Promise<ReferralPayoutEncryptedDetailsRecord | null> {
    const rows = await this.sql.query<PayoutDetailsRow>(
      `SELECT
         id AS payout_id,
         creator_id,
         status,
         details_payload_version,
         details_key_version,
         details_iv,
         details_auth_tag,
         details_ciphertext
       FROM referral_payout_requests
       WHERE id = $1::uuid
       LIMIT 1`,
      [payoutId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      payoutId: row.payout_id,
      creatorId: row.creator_id,
      status: row.status,
      encryptedDetails: encryptedDetails(row),
    };
  }

  async settlePayout(payoutId: string, at: Date): Promise<ReferralPayoutSettlementRecord> {
    const rows = await this.sql.query<PayoutSettlementRow>(
      `WITH locked_request AS MATERIALIZED (
         SELECT id, creator_id, currency, requested_amount_minor, status
         FROM referral_payout_requests
         WHERE id = $1::uuid
         FOR UPDATE
       ), allocated AS MATERIALIZED (
         SELECT conversion.id, conversion.reward_amount_minor, conversion.state
         FROM referral_payout_allocations allocation
         JOIN locked_request payout ON payout.id = allocation.payout_id
         JOIN referral_conversions conversion ON conversion.id = allocation.conversion_id
         FOR UPDATE OF conversion
       ), counts AS (
         SELECT
           COUNT(*)::integer AS allocated_count,
           COUNT(*) FILTER (WHERE state = 'AVAILABLE')::integer AS eligible_count,
           COALESCE(SUM(reward_amount_minor) FILTER (WHERE state = 'AVAILABLE'), 0)::bigint AS eligible_amount
         FROM allocated
       ), eligible AS (
         SELECT allocated.id
         FROM allocated CROSS JOIN counts CROSS JOIN locked_request
         WHERE allocated.state = 'AVAILABLE'
           AND locked_request.status = 'REQUESTED'
           AND counts.eligible_count = counts.allocated_count
           AND counts.allocated_count > 0
           AND counts.eligible_amount = locked_request.requested_amount_minor
       ), paid_conversions AS (
         UPDATE referral_conversions conversion
         SET state = 'PAID_OUT',
             paid_out_at = COALESCE(conversion.paid_out_at, $2),
             updated_at = GREATEST(conversion.updated_at, $2)
         WHERE conversion.id IN (SELECT id FROM eligible)
         RETURNING conversion.id, conversion.reward_amount_minor
       ), paid_request AS (
         UPDATE referral_payout_requests payout
         SET status = 'PAID',
             paid_at = COALESCE(payout.paid_at, $2),
             updated_at = GREATEST(payout.updated_at, $2)
         FROM counts
         WHERE payout.id = $1::uuid
           AND payout.status = 'REQUESTED'
           AND counts.eligible_count = counts.allocated_count
           AND counts.allocated_count > 0
           AND (SELECT COALESCE(SUM(reward_amount_minor), 0) FROM paid_conversions) = payout.requested_amount_minor
         RETURNING payout.id, payout.creator_id, payout.currency, payout.requested_amount_minor, payout.status
       ), settled AS (
         SELECT
           paid_request.id AS payout_id,
           paid_request.creator_id,
           paid_request.currency,
           paid_request.requested_amount_minor AS paid_amount_minor,
           counts.allocated_count AS conversion_count,
           paid_request.status
         FROM paid_request CROSS JOIN counts
       ), replay AS (
         SELECT
           locked_request.id AS payout_id,
           locked_request.creator_id,
           locked_request.currency,
           locked_request.requested_amount_minor AS paid_amount_minor,
           COUNT(allocated.id)::integer AS conversion_count,
           'PAID'::text AS status
         FROM locked_request LEFT JOIN allocated ON true
         WHERE locked_request.status = 'PAID'
         GROUP BY locked_request.id, locked_request.creator_id, locked_request.currency,
                  locked_request.requested_amount_minor, locked_request.status
       )
       SELECT payout_id, creator_id, currency, paid_amount_minor, conversion_count, status
       FROM settled
       UNION ALL
       SELECT payout_id, creator_id, currency, paid_amount_minor, conversion_count, status
       FROM replay
       LIMIT 1`,
      [payoutId, at],
    );
    const row = rows[0];
    if (!row) throw new Error('Payout cannot be settled because allocated earnings are not all AVAILABLE');
    return {
      payoutId: row.payout_id,
      creatorId: row.creator_id,
      currency: row.currency,
      paidAmountMinor: integer(row.paid_amount_minor),
      conversionCount: integer(row.conversion_count),
      status: 'PAID',
    };
  }
}
