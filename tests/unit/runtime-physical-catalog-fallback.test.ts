import { afterEach, describe, expect, test, vi } from 'vitest';

const originalPreview = process.env.ENABLE_VISUAL_PREVIEW;
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalCatalog = process.env.ISSUED_ONCE_CATALOG_JSON;

afterEach(() => {
  vi.unstubAllEnvs();
  if (originalPreview === undefined) delete process.env.ENABLE_VISUAL_PREVIEW;
  else process.env.ENABLE_VISUAL_PREVIEW = originalPreview;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalCatalog === undefined) delete process.env.ISSUED_ONCE_CATALOG_JSON;
  else process.env.ISSUED_ONCE_CATALOG_JSON = originalCatalog;
});

describe('production physical runtime catalog bootstrap', () => {
  test('uses the audited boot catalog when ISSUED_ONCE_CATALOG_JSON is not configured', async () => {
    vi.stubEnv('ENABLE_VISUAL_PREVIEW', '0');
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@example.com/db');
    delete process.env.ISSUED_ONCE_CATALOG_JSON;

    const { createObjectSelectionService } = await import('@/server/physical/runtimePhysical');

    expect(() => createObjectSelectionService()).not.toThrow();
  });
});
