import { expect, test } from 'vitest';
import { OpsWebsiteService } from '@/server/ops/OpsWebsiteService';

const catalog = { currency: 'USD', products: { tee: { slug: 'issued-tee', variants: [{ id: 'tee-m-black', size: 'M', colorName: 'Black', colorSwatch: '#171713', amountMinor: 5400, available: true }] } } };

test('publishes only factory-mapped future-sale catalog and audits it', async () => {
  const audits: unknown[] = [];
  const published: unknown[] = [];
  const service = new OpsWebsiteService({
    getState: async () => ({ catalog: { source: 'BOOT', version: 0, payload: catalog }, questions: [] }),
    publishCatalog: async (payload) => { published.push(payload); return 1; },
    updateQuestion: async () => undefined,
    createQuestionVersion: async () => 1,
  }, {
    bootCatalogJson: JSON.stringify(catalog),
    assertFactoryMapping: () => undefined,
  }, { record: async (event) => { audits.push(event); } } as never);
  const version = await service.publishCatalog(catalog);
  expect(version).toBe(1);
  expect(published).toHaveLength(1);
  expect(JSON.stringify(audits)).toContain('CATALOG_PUBLISHED');
});
