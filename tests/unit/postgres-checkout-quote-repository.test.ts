import { describe, expect, test, vi } from 'vitest';
import { PostgresCheckoutQuoteRepository } from '@/server/checkout/PostgresCheckoutQuoteRepository';

const quote = {
  id: 'q_opaque_1',
  experienceId: 'exp-1',
  productSlug: 'mystery-hoodie',
  variantId: '000009c2-0c75-0024-0000-09c20c750024',
  amountMinor: 5400,
  currency: 'USD',
  expiresAt: new Date('2026-08-18T07:00:00.000Z'),
};

describe('PostgresCheckoutQuoteRepository', () => {
  test('persists only locked commerce truth and returns it by opaque id', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: quote.id,
          experience_id: quote.experienceId,
          product_slug: quote.productSlug,
          variant_id: quote.variantId,
          amount_minor: quote.amountMinor,
          currency: quote.currency,
          expires_at: quote.expiresAt,
        },
      ]);
    const repository = new PostgresCheckoutQuoteRepository({ query });

    await repository.create(quote);
    await expect(repository.findById(quote.id)).resolves.toEqual(quote);

    expect(query.mock.calls[0]?.[0]).toContain('INSERT INTO checkout_quotes');
    expect(query.mock.calls[0]?.[1]).toEqual([
      quote.id,
      quote.experienceId,
      quote.productSlug,
      quote.variantId,
      quote.amountMinor,
      quote.currency,
      quote.expiresAt,
    ]);
    expect(JSON.stringify(query.mock.calls[0])).not.toMatch(/answer|email|name|address/i);
  });
});
