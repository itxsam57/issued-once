import { afterEach, expect, test, vi } from 'vitest';
import { PostgresArtworkStorage } from '@/server/design/PostgresArtworkStorage';

const originalEnv = { ...process.env };

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

function baseEnv() {
  vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@example.com/db');
  vi.stubEnv('ARTWORK_SIGNING_KEY', 'artwork-signing-key-that-is-long-enough');
  vi.stubEnv('APP_ORIGIN', 'https://issuedonce.shop');
}

test('design and manual-upload runtimes use durable database artwork storage without deployment filesystem configuration', async () => {
  baseEnv();
  vi.stubEnv('OPENAI_API_KEY', 'openai-test-key');
  delete process.env.ARTWORK_STORAGE_DIR;
  delete process.env.BLOB_READ_WRITE_TOKEN;

  const { createDesignService } = await import('@/server/design/runtimeDesign');
  const { createManualArtworkUploadService } = await import('@/server/ops/runtimeOwnerOs');

  const design = createDesignService() as unknown as { storage: unknown };
  const manualUpload = createManualArtworkUploadService() as unknown as { storage: unknown };

  expect(design.storage).toBeInstanceOf(PostgresArtworkStorage);
  expect(manualUpload.storage).toBeInstanceOf(PostgresArtworkStorage);
});

test('manufacturing runtime signs durable artwork through the application origin without a filesystem or Blob token', async () => {
  baseEnv();
  vi.stubEnv('PRINTFUL_API_TOKEN', 'printful-test-token');
  vi.stubEnv('PRINTFUL_VARIANT_MAP_JSON', JSON.stringify({
    'tee:M:Black': {
      variantId: 4012,
      fileType: 'front',
      printArea: { width: 1800, height: 2400, dpi: 150 },
      position: { width: 900, height: 1350, top: 300, left: 450 },
    },
  }));
  delete process.env.ARTWORK_STORAGE_DIR;
  delete process.env.BLOB_READ_WRITE_TOKEN;

  const { createManufacturingService } = await import('@/server/manufacturing/runtimeManufacturing');
  const manufacturing = createManufacturingService() as unknown as {
    artworkAccess: { createReadUrl(canonicalUrl: string, ttlMs: number): Promise<string> };
  };

  await expect(manufacturing.artworkAccess.createReadUrl(
    'artwork://issue-1/job-1',
    60_000,
  )).resolves.toMatch(/^https:\/\/issuedonce\.shop\/api\/artwork\//);
});
