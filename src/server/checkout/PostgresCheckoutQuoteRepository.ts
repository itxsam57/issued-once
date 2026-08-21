import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  CheckoutQuoteRecord,
  CheckoutQuoteRepository,
} from './CheckoutService';

export interface WritableCheckoutQuoteRepository extends CheckoutQuoteRepository {
  create(record: CheckoutQuoteRecord): Promise<void>;
  findLatestByExperienceId(experienceId: string): Promise<CheckoutQuoteRecord | null>;
}

type CheckoutQuoteRow = {
  id: string;
  experience_id: string;
  product_slug: string;
  variant_id: string;
  amount_minor: number;
  currency: string;
  expires_at: Date | string;
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function mapRow(row: CheckoutQuoteRow): CheckoutQuoteRecord {
  return {
    id: row.id,
    experienceId: row.experience_id,
    productSlug: row.product_slug,
    variantId: row.variant_id,
    amountMinor: row.amount_minor,
    currency: row.currency,
    expiresAt: toDate(row.expires_at),
  };
}

export class PostgresCheckoutQuoteRepository implements WritableCheckoutQuoteRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: CheckoutQuoteRecord): Promise<void> {
    await this.sql.query(
      `
        INSERT INTO checkout_quotes (
          id,
          experience_id,
          product_slug,
          variant_id,
          amount_minor,
          currency,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        record.id,
        record.experienceId,
        record.productSlug,
        record.variantId,
        record.amountMinor,
        record.currency,
        record.expiresAt,
      ],
    );
  }

  async findById(id: string): Promise<CheckoutQuoteRecord | null> {
    const rows = await this.sql.query<CheckoutQuoteRow>(
      `
        SELECT
          id,
          experience_id,
          product_slug,
          variant_id,
          amount_minor,
          currency,
          expires_at
        FROM checkout_quotes
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findLatestByExperienceId(experienceId: string): Promise<CheckoutQuoteRecord | null> {
    const rows = await this.sql.query<CheckoutQuoteRow>(
      `
        SELECT
          id,
          experience_id,
          product_slug,
          variant_id,
          amount_minor,
          currency,
          expires_at
        FROM checkout_quotes
        WHERE experience_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [experienceId],
    );

    return rows[0] ? mapRow(rows[0]) : null;
  }
}
