import { expect, test } from 'vitest';
import { PostgresIssuedOnceCatalogGateway } from '@/server/physical/PostgresIssuedOnceCatalogGateway';
import { OpsWebsiteService } from '@/server/ops/OpsWebsiteService';
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
