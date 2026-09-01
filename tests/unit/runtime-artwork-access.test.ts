import { afterEach, expect, test, vi } from 'vitest';
import { SignedArtworkAccess } from '@/server/design/SignedArtworkAccess';
import { createArtworkAccess } from '@/server/design/runtimeArtworkAccess';

afterEach(() => {
  vi.unstubAllEnvs();
});

test('owner artwork runtime signs durable private locators without a Blob token or filesystem dependency', async () => {
  vi.stubEnv('ARTWORK_SIGNING_KEY', 'artwork-signing-key-that-is-long-enough');
  vi.stubEnv('APP_ORIGIN', 'https://issuedonce.shop');
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
  vi.stubEnv('ARTWORK_STORAGE_DIR', '');

  const access = createArtworkAccess();
  expect(access).toBeInstanceOf(SignedArtworkAccess);

  const url = await access.createReadUrl('artwork://issue-123/job-123', 60_000);
  expect(url).toMatch(/^https:\/\/issuedonce\.shop\/api\/artwork\//);
});
