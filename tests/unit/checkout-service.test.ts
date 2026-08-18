import { describe, expect, test, vi } from 'vitest';
import { CheckoutService } from '@/server/checkout/CheckoutService';

const now = new Date('2026-08-18T06:30:00.000Z');
const quote = {
  id: 'quote-opaque-1',
  experienceId: 'exp-1',
  productSlug: 'mystery-hoodie',
  variantId: '000009c2-0c75-0024-0000-09c20c750024',
  amountMinor: 5400,
  currency: 'USD',
  expiresAt: new Date('2026-08-18T06:40:00.000Z'),
};

function setup(overrides: Record<string, unknown> = {}) {
  const quoteRepository = {
    findById: vi.fn().mockResolvedValue(quote),
  };
  const commerce = {
    getVariant: vi.fn().mockResolvedValue({
      id: quote.variantId,
      amountMinor: 5400,
      currency: 'USD',
      available: true,
    }),
    createCart: vi.fn().mockResolvedValue({
      cartId: 'cart-1',
      checkoutUrl: 'https://issued-once.fourthwall.com/cart/checkout?cartId=cart-1&currency=USD',
    }),
  };

  Object.assign(quoteRepository, overrides.quoteRepository ?? {});
  Object.assign(commerce, overrides.commerce ?? {});

  return {
    quoteRepository,
    commerce,
    service: new CheckoutService(quoteRepository, commerce, () => now),
  };
}

describe('CheckoutService', () => {
  test('revalidates ownership, current variant truth, and creates one anonymous cart item', async () => {
    const { service, commerce } = setup();

    const result = await service.start({
      quoteId: quote.id,
      experienceId: quote.experienceId,
    });

    expect(commerce.getVariant).toHaveBeenCalledWith(
      quote.productSlug,
      quote.variantId,
      'USD',
    );
    expect(commerce.createCart).toHaveBeenCalledWith({
      variantId: quote.variantId,
      quantity: 1,
      currency: 'USD',
      metadata: {
        io_experience_id: 'exp-1',
        io_quote_id: 'quote-opaque-1',
      },
    });
    expect(result).toEqual({
      checkoutUrl: 'https://issued-once.fourthwall.com/cart/checkout?cartId=cart-1&currency=USD',
    });
    expect(JSON.stringify(commerce.createCart.mock.calls[0])).not.toMatch(/answer|email|name|address/i);
  });

  test('rejects a quote copied from another anonymous experience', async () => {
    const { service, commerce } = setup();

    await expect(
      service.start({ quoteId: quote.id, experienceId: 'exp-other' }),
    ).rejects.toThrow('Quote does not belong to this experience');
    expect(commerce.getVariant).not.toHaveBeenCalled();
  });

  test('rejects an expired quote before touching commerce', async () => {
    const { service, commerce } = setup({
      quoteRepository: {
        findById: vi.fn().mockResolvedValue({
          ...quote,
          expiresAt: new Date('2026-08-18T06:29:59.000Z'),
        }),
      },
    });

    await expect(
      service.start({ quoteId: quote.id, experienceId: quote.experienceId }),
    ).rejects.toThrow('Quote expired');
    expect(commerce.getVariant).not.toHaveBeenCalled();
  });

  test('rejects price drift or unavailable inventory instead of silently charging a different truth', async () => {
    const priceDrift = setup({
      commerce: {
        getVariant: vi.fn().mockResolvedValue({
          id: quote.variantId,
          amountMinor: 5900,
          currency: 'USD',
          available: true,
        }),
      },
    });

    await expect(
      priceDrift.service.start({ quoteId: quote.id, experienceId: quote.experienceId }),
    ).rejects.toThrow('Quote changed');
    expect(priceDrift.commerce.createCart).not.toHaveBeenCalled();

    const unavailable = setup({
      commerce: {
        getVariant: vi.fn().mockResolvedValue({
          id: quote.variantId,
          amountMinor: 5400,
          currency: 'USD',
          available: false,
        }),
      },
    });

    await expect(
      unavailable.service.start({ quoteId: quote.id, experienceId: quote.experienceId }),
    ).rejects.toThrow('Variant unavailable');
    expect(unavailable.commerce.createCart).not.toHaveBeenCalled();
  });
});
