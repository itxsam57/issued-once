import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';
import type {
  CheckoutQuoteRecord,
  CheckoutQuoteRepository,
} from './CheckoutService';

export interface WritableCheckoutQuoteRepository extends CheckoutQuoteRepository {
  create(record: CheckoutQuoteRecord): Promise<void>;
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

    const row = rows[0];
    if (!row) return null;

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
}
