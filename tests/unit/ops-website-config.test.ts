import { expect, test } from 'vitest';
import { PostgresIssuedOnceCatalogGateway } from '@/server/physical/PostgresIssuedOnceCatalogGateway';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';

const base = JSON.stringify({ currency: 'USD', products: { tee: { slug: 'issued-tee', variants: [{ id: 'tee-m-black', size: 'M', colorName: 'Black', colorSwatch: '#171713', amountMinor: 5400, available: true }] } } });
const active = { currency: 'USD', products: { tee: { slug: 'issued-tee', variants: [{ id: 'tee-m-black', size: 'M', colorName: 'Black', colorSwatch: '#171713', amountMinor: 5900, available: true }] } } };

test('published catalog overlay changes future-sale price while preserving boot identity', async () => {
  const sql: SqlExecutor = { query: async () => [{ payload: active }] as never };
  const catalog = new PostgresIssuedOnceCatalogGateway(base, sql);
  expect(catalog.productSlug('tee')).toBe('issued-tee');
  expect(catalog.currency()).toBe('USD');
  const variants = await catalog.listVariants('issued-tee', 'USD');
  expect(variants[0].amountMinor).toBe(5900);
});
