import { afterEach, expect, test, vi } from 'vitest';
import { FilesystemArtworkStorage } from '@/server/design/FilesystemArtworkStorage';
import { SignedArtworkAccess } from '@/server/design/SignedArtworkAccess';

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
  vi.stubEnv('ARTWORK_STORAGE_DIR', '/tmp/issued-once-private-artwork');
  vi.stubEnv('ARTWORK_SIGNING_KEY', 'artwork-signing-key-that-is-long-enough');
  vi.stubEnv('APP_ORIGIN', 'https://issuedonce.shop');
}

test('design and manual-upload runtimes use private filesystem storage without a Blob token', async () => {
  baseEnv();
  vi.stubEnv('OPENAI_API_KEY', 'openai-test-key');
  delete process.env.BLOB_READ_WRITE_TOKEN;

  const { createDesignService } = await import('@/server/design/runtimeDesign');
  const { createManualArtworkUploadService } = await import('@/server/ops/runtimeOwnerOs');

  const design = createDesignService() as unknown as { storage: unknown };
  const manualUpload = createManualArtworkUploadService() as unknown as { storage: unknown };

  expect(design.storage).toBeInstanceOf(FilesystemArtworkStorage);
  expect(manualUpload.storage).toBeInstanceOf(FilesystemArtworkStorage);
});

test('manufacturing runtime signs filesystem artwork through the application origin without a Blob token', async () => {
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
  delete process.env.BLOB_READ_WRITE_TOKEN;

  const { createManufacturingService } = await import('@/server/manufacturing/runtimeManufacturing');
  const manufacturing = createManufacturingService() as unknown as { artworkAccess: unknown };

  expect(manufacturing.artworkAccess).toBeInstanceOf(SignedArtworkAccess);
});
