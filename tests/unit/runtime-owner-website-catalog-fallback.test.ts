import { afterEach, describe, expect, test, vi } from 'vitest';

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalCatalogJson = process.env.ISSUED_ONCE_CATALOG_JSON;

afterEach(() => {
  vi.resetModules();
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalCatalogJson === undefined) delete process.env.ISSUED_ONCE_CATALOG_JSON;
  else process.env.ISSUED_ONCE_CATALOG_JSON = originalCatalogJson;
});

describe('Owner Website runtime catalog bootstrap', () => {
  test('uses the audited boot catalog when ISSUED_ONCE_CATALOG_JSON is absent', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
    delete process.env.ISSUED_ONCE_CATALOG_JSON;

    const { createOpsWebsiteService } = await import('@/server/ops/runtimeOwnerOs');

    expect(() => createOpsWebsiteService()).not.toThrow();
  });
});
