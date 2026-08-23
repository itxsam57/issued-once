import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';

type ReferralQuoteRecord = {
  id: string;
  experienceId: string;
  productSlug: string;
  variantId: string;
  grossAmountMinor?: number;
  discountAmountMinor?: number;
  amountMinor: number;
  currency: string;
  referralAttributionId?: string | null;
  referralCreatorId?: string | null;
  referralRuleVersionId?: string | null;
  referralRuleSnapshot?: unknown | null;
  expiresAt: Date;
};

type ReferralQuoteRow = {
  id: string;
  experience_id: string;
  product_slug: string;
  variant_id: string;
  gross_amount_minor: number;
  discount_amount_minor: number;
  amount_minor: number;
  currency: string;
  referral_attribution_id: string | null;
  referral_creator_id: string | null;
  referral_rule_version_id: string | null;
  referral_rule_snapshot: unknown | null;
  expires_at: Date | string;
};

function mapQuote(row: ReferralQuoteRow): ReferralQuoteRecord {
  return {
    id: row.id,
    experienceId: row.experience_id,
    productSlug: row.product_slug,
    variantId: row.variant_id,
    grossAmountMinor: Number(row.gross_amount_minor),
    discountAmountMinor: Number(row.discount_amount_minor),
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    referralAttributionId: row.referral_attribution_id,
    referralCreatorId: row.referral_creator_id,
    referralRuleVersionId: row.referral_rule_version_id,
    referralRuleSnapshot: row.referral_rule_snapshot,
    expiresAt: row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at),
  };
}

const selectColumns = `
  id,
  experience_id,
  product_slug,
  variant_id,
  gross_amount_minor,
  discount_amount_minor,
  amount_minor,
  currency,
  referral_attribution_id,
  referral_creator_id,
  referral_rule_version_id,
  referral_rule_snapshot,
  expires_at
`;

export class PostgresReferralQuoteRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findById(id: string): Promise<ReferralQuoteRecord | null> {
    const rows = await this.sql.query<ReferralQuoteRow>(
      `SELECT ${selectColumns} FROM checkout_quotes WHERE id = $1 LIMIT 1`,
      [id],
    );
    return rows[0] ? mapQuote(rows[0]) : null;
  }

  async findLatestByExperienceId(experienceId: string): Promise<ReferralQuoteRecord | null> {
    const rows = await this.sql.query<ReferralQuoteRow>(
      `
        SELECT ${selectColumns}
        FROM checkout_quotes
        WHERE experience_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [experienceId],
    );
    return rows[0] ? mapQuote(rows[0]) : null;
  }

  async create(record: ReferralQuoteRecord): Promise<void> {
    const grossAmountMinor = record.grossAmountMinor ?? record.amountMinor;
    const discountAmountMinor = record.discountAmountMinor ?? 0;
    await this.sql.query(
      `
        INSERT INTO checkout_quotes (
          id, experience_id, product_slug, variant_id,
          gross_amount_minor, discount_amount_minor, amount_minor, currency,
          referral_attribution_id, referral_creator_id, referral_rule_version_id, referral_rule_snapshot,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
      `,
      [
        record.id,
        record.experienceId,
        record.productSlug,
        record.variantId,
        grossAmountMinor,
        discountAmountMinor,
        record.amountMinor,
        record.currency,
        record.referralAttributionId ?? null,
        record.referralCreatorId ?? null,
        record.referralRuleVersionId ?? null,
        record.referralRuleSnapshot === null || record.referralRuleSnapshot === undefined
          ? null
          : JSON.stringify(record.referralRuleSnapshot),
        record.expiresAt,
      ],
    );
  }
}
