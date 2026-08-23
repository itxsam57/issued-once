import { describe, expect, test, vi } from 'vitest';
import { FourthwallCommerceGateway } from '@/server/checkout/FourthwallCommerceGateway';

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Fourthwall normalized catalog', () => {
  test('uses structured size and color attributes and keeps stock/price truth', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        slug: 'mystery-hoodie',
        variants: [
          {
            id: 'v-m-black',
            unitPrice: { value: 54, currency: 'USD' },
            attributes: {
              description: 'Black, M',
              color: { name: 'Black', swatch: '#000000' },
              size: { name: 'M' },
            },
            stock: { type: 'FINITE', inStock: 12 },
          },
          {
            id: 'v-l-bone',
            unitPrice: { value: 54, currency: 'USD' },
            attributes: {
              description: 'Bone, L',
              color: { name: 'Bone', swatch: '#E8E0CF' },
              size: { name: 'L' },
            },
            stock: { type: 'FINITE', inStock: 0 },
          },
        ],
      }),
    );
    const gateway = new FourthwallCommerceGateway({
      storefrontToken: 'ptkn_test',
      shopDomain: 'issued-once.fourthwall.com',
      fetchImpl,
    });

    await expect(gateway.listVariants('mystery-hoodie', 'USD')).resolves.toEqual([
      {
        id: 'v-m-black',
        size: 'M',
        colorName: 'Black',
        colorSwatch: '#000000',
        amountMinor: 5400,
        currency: 'USD',
        available: true,
      },
      {
        id: 'v-l-bone',
        size: 'L',
        colorName: 'Bone',
        colorSwatch: '#E8E0CF',
        amountMinor: 5400,
        currency: 'USD',
        available: false,
      },
    ]);
  });
});
