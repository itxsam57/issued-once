import { expect, test } from 'vitest';
import { IssuedOnceCatalogGateway } from '@/server/physical/IssuedOnceCatalogGateway';

test('serves ISSUED ONCE retail price and logical variants without Fourthwall identifiers', async () => {
  const catalog = new IssuedOnceCatalogGateway(JSON.stringify({
    currency: 'USD',
    products: {
      tee: {
        slug: 'io-tee',
        variants: [
          { id: 'io-tee-m-black', size: 'M', colorName: 'Black', colorSwatch: '#171713', amountMinor: 5400, available: true },
        ],
      },
    },
  }));

  expect(await catalog.listVariants('io-tee', 'USD')).toEqual([
    { id: 'io-tee-m-black', size: 'M', colorName: 'Black', colorSwatch: '#171713', amountMinor: 5400, currency: 'USD', available: true },
  ]);
  expect(catalog.productSlug('tee')).toBe('io-tee');
  expect(JSON.stringify(await catalog.listVariants('io-tee', 'USD'))).not.toContain('fourthwall');
});

test('fails closed on unsupported currency, missing product, duplicate logical variant or non-positive price', async () => {
  const valid = new IssuedOnceCatalogGateway(JSON.stringify({
    currency: 'USD',
    products: { tee: { slug: 'io-tee', variants: [{ id: 'v1', size: 'M', colorName: 'Black', colorSwatch: null, amountMinor: 5400, available: true }] } },
  }));
  await expect(valid.listVariants('io-tee', 'EUR')).rejects.toThrow(/currency/i);
  await expect(valid.listVariants('missing', 'USD')).rejects.toThrow(/product/i);
  expect(() => new IssuedOnceCatalogGateway(JSON.stringify({
    currency: 'USD',
    products: { tee: { slug: 'io-tee', variants: [
      { id: 'same', size: 'M', colorName: 'Black', amountMinor: 5400, available: true },
      { id: 'same', size: 'L', colorName: 'Black', amountMinor: 5400, available: true },
    ] } },
  }))).toThrow(/duplicate/i);
});
