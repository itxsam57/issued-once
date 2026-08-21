import { expect, test, vi } from 'vitest';
import { PostgresIssuedOnceCatalogGateway } from '@/server/physical/PostgresIssuedOnceCatalogGateway';
import { OpsWebsiteService } from '@/server/ops/OpsWebsiteService';
import type { OpsCatalogPayload } from '@/server/ops/OpsWebsiteService';
import type { SqlExecutor } from '@/server/experience/PostgresExperienceRepository';

const base = JSON.stringify({ currency: 'USD', products: { tee: { slug: 'issued-tee', variants: [{ id: 'tee-m-black', size: 'M', colorName: 'Black', colorSwatch: '#171713', amountMinor: 5400, available: true }] } } });
const active = { currency: 'USD', products: { tee: { slug: 'issued-tee', variants: [{ id: 'tee-m-black', size: 'M', colorName: 'Black', colorSwatch: '#171713', amountMinor: 5900, available: true }] } } };

const retailCatalog: OpsCatalogPayload = {
  currency: 'USD',
  products: {
    tee: {
      slug: 'issued-tee',
      variants: [
        { id: 'tee-s-black', size: 'S', colorName: 'Black', colorSwatch: '#171713', amountMinor: 5400, available: true },
        { id: 'tee-m-bone', size: 'M', colorName: 'Bone', colorSwatch: '#e8e0cf', amountMinor: 5600, available: true },
        { id: 'tee-retired', size: 'XS', colorName: 'Old', colorSwatch: null, amountMinor: 5000, available: false },
      ],
    },
    hat: {
      slug: 'issued-hat',
      variants: [{ id: 'hat-os-black', size: 'OS', colorName: 'Black', colorSwatch: '#171713', amountMinor: 4200, available: true }],
    },
    tote: {
      slug: 'issued-tote',
      variants: [{ id: 'tote-os-bone', size: 'OS', colorName: 'Bone', colorSwatch: '#e8e0cf', amountMinor: 3800, available: true }],
    },
  },
};

test('published catalog overlay changes future-sale price while preserving boot identity', async () => {
  const sql: SqlExecutor = { query: async () => [{ payload: active }] as never };
  const catalog = new PostgresIssuedOnceCatalogGateway(base, sql);
  expect(catalog.productSlug('tee')).toBe('issued-tee');
  expect(catalog.currency()).toBe('USD');
  const variants = await catalog.listVariants('issued-tee', 'USD');
  expect(variants[0].amountMinor).toBe(5900);
});

test('catalog publication validates every available variant against factory mapping', async () => {
  const mapped: unknown[] = [];
  const service = new OpsWebsiteService({
    getState: async () => ({ catalog: { source: 'BOOT', version: 0, payload: JSON.parse(base) }, questions: [] }),
    publishCatalog: async () => 2,
    updateQuestion: async () => undefined,
    createQuestionVersion: async () => 2,
  }, {
    bootCatalogJson: base,
    assertFactoryMapping: (input) => { mapped.push(input); },
  }, { record: async () => undefined } as never);

  expect(await service.publishCatalog(active)).toBe(2);
  expect(mapped).toEqual([{ objectType: 'tee', sizeCode: 'M', colorCode: 'Black' }]);
});

test('quick product price publishes one new catalog version for sellable variants only', async () => {
  let published: OpsCatalogPayload | null = null;
  const audit = { record: vi.fn(async () => undefined) };
  const service = new OpsWebsiteService({
    getState: async () => ({ catalog: { source: 'ACTIVE', version: 4, payload: structuredClone(retailCatalog) }, questions: [] }),
    publishCatalog: async (payload) => { published = structuredClone(payload); return 5; },
    updateQuestion: async () => undefined,
    createQuestionVersion: async () => 2,
  }, {
    bootCatalogJson: JSON.stringify(retailCatalog),
    assertFactoryMapping: () => undefined,
  }, audit as never);

  await expect(service.publishProductPrice({ productKey: 'tee', amountMinor: 6100, currency: 'USD' })).resolves.toBe(5);

  expect(published).not.toBeNull();
  expect(published!.products.tee.variants.map((variant) => [variant.id, variant.amountMinor])).toEqual([
    ['tee-s-black', 6100],
    ['tee-m-bone', 6100],
    ['tee-retired', 5000],
  ]);
  expect(published!.products.hat).toEqual(retailCatalog.products.hat);
  expect(published!.products.tote).toEqual(retailCatalog.products.tote);
  expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'CATALOG_PUBLISHED' }));
});

test('quick product price rejects wrong currency and unknown products without publishing', async () => {
  const publishCatalog = vi.fn(async () => 5);
  const service = new OpsWebsiteService({
    getState: async () => ({ catalog: { source: 'ACTIVE', version: 4, payload: structuredClone(retailCatalog) }, questions: [] }),
    publishCatalog,
    updateQuestion: async () => undefined,
    createQuestionVersion: async () => 2,
  }, {
    bootCatalogJson: JSON.stringify(retailCatalog),
    assertFactoryMapping: () => undefined,
  }, { record: async () => undefined } as never);

  await expect(service.publishProductPrice({ productKey: 'tee', amountMinor: 6100, currency: 'PKR' })).rejects.toThrow(/currency/i);
  await expect(service.publishProductPrice({ productKey: 'hoodie', amountMinor: 6100, currency: 'USD' })).rejects.toThrow(/product/i);
  expect(publishCatalog).not.toHaveBeenCalled();
});

test('question controls cannot retire the last active family prompt at the store boundary', async () => {
  let call = 0;
  const sql: SqlExecutor = { query: async () => {
    call += 1;
    if (call === 1) return [] as never;
    return [] as never;
  }};
  const { PostgresOpsWebsiteStore } = await import('@/server/ops/PostgresOpsWebsiteStore');
  const store = new PostgresOpsWebsiteStore(sql, JSON.parse(base));
  await expect(store.updateQuestion({ questionId: 'culture.only', version: 1, active: false, weight: 1 }))
    .rejects.toThrow(/leave its family without an active prompt/i);
});

test('choice question versions require real choices', async () => {
  const service = new OpsWebsiteService({
    getState: async () => ({ catalog: { source: 'BOOT', version: 0, payload: JSON.parse(base) }, questions: [] }),
    publishCatalog: async () => 1,
    updateQuestion: async () => undefined,
    createQuestionVersion: async () => 2,
  }, { bootCatalogJson: base, assertFactoryMapping: () => undefined }, { record: async () => undefined } as never);

  await expect(service.createQuestionVersion({ questionId: 'rhythm.new', family: 'rhythm', prompt: 'Pick one.', kind: 'choice', optional: false, choices: [] }))
    .rejects.toThrow(/at least two valid choices/i);
});
