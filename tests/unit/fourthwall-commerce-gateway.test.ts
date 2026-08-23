import { describe, expect, test, vi } from 'vitest';
import { FourthwallCommerceGateway } from '@/server/checkout/FourthwallCommerceGateway';

const variantId = '000009c2-0c75-0024-0000-09c20c750024';

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('FourthwallCommerceGateway', () => {
  test('fetches one known product and returns current exact variant truth', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        slug: 'mystery-hoodie',
        variants: [
          {
            id: variantId,
            unitPrice: { value: 54, currency: 'USD' },
            stock: { type: 'FINITE', inStock: 12 },
          },
        ],
      }),
    );
    const gateway = new FourthwallCommerceGateway({
      storefrontToken: 'ptkn_test',
      shopDomain: 'issued-once.fourthwall.com',
      fetchImpl,
    });

    await expect(
      gateway.getVariant('mystery-hoodie', variantId, 'USD'),
    ).resolves.toEqual({
      id: variantId,
      amountMinor: 5400,
      currency: 'USD',
      available: true,
    });

    const url = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(url.origin + url.pathname).toBe(
      'https://storefront-api.fourthwall.com/v1/products/mystery-hoodie',
    );
    expect(url.searchParams.get('storefront_token')).toBe('ptkn_test');
    expect(url.searchParams.get('currency')).toBe('USD');
  });

  test('creates one-item cart with anonymous metadata and returns hosted checkout URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 'cart-1', items: [], metadata: {} }));
    const gateway = new FourthwallCommerceGateway({
      storefrontToken: 'ptkn_test',
      shopDomain: 'issued-once.fourthwall.com',
      fetchImpl,
    });

    const result = await gateway.createCart({
      variantId,
      quantity: 1,
      currency: 'USD',
      metadata: {
        io_experience_id: 'exp-1',
        io_quote_id: 'quote-1',
      },
    });

    const [rawUrl, init] = fetchImpl.mock.calls[0] ?? [];
    const url = new URL(String(rawUrl));
    expect(url.origin + url.pathname).toBe('https://storefront-api.fourthwall.com/v1/carts');
    expect(url.searchParams.get('storefront_token')).toBe('ptkn_test');
    expect(url.searchParams.get('currency')).toBe('USD');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      items: [{ variantId, quantity: 1 }],
      metadata: {
        io_experience_id: 'exp-1',
        io_quote_id: 'quote-1',
      },
    });
    expect(result).toEqual({
      cartId: 'cart-1',
      checkoutUrl:
        'https://issued-once.fourthwall.com/cart/checkout?cartId=cart-1&currency=USD',
    });
  });

  test('fails closed on missing variant or failed Fourthwall response', async () => {
    const missingVariantFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        slug: 'mystery-hoodie',
        variants: [],
      }),
    );
    const missingVariantGateway = new FourthwallCommerceGateway({
      storefrontToken: 'ptkn_test',
      shopDomain: 'issued-once.fourthwall.com',
      fetchImpl: missingVariantFetch,
    });
    await expect(
      missingVariantGateway.getVariant('mystery-hoodie', variantId, 'USD'),
    ).resolves.toBeNull();

    const failedFetch = vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, 503));
    const failedGateway = new FourthwallCommerceGateway({
      storefrontToken: 'ptkn_test',
      shopDomain: 'issued-once.fourthwall.com',
      fetchImpl: failedFetch,
    });
    await expect(
      failedGateway.getVariant('mystery-hoodie', variantId, 'USD'),
    ).rejects.toThrow('Fourthwall product lookup failed');
  });
});
