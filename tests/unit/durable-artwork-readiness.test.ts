import { expect, test, vi } from 'vitest';
import { ReadinessService } from '@/server/ops/ReadinessService';

test('durable artwork readiness does not require a deployment-local storage directory', async () => {
  const storagePing = vi.fn(async () => true);
  const result = await new ReadinessService({
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://configured',
      ARTWORK_SIGNING_KEY: 'artwork-signing-key-that-is-long-enough',
      APP_ORIGIN: 'https://issuedonce.shop',
    },
    databasePing: vi.fn(async () => true),
    catalogAuthorityPing: vi.fn(async () => false),
    storagePing,
    queuePing: vi.fn(async () => false),
    fetchImpl: vi.fn() as typeof fetch,
  }).check();

  expect(storagePing).toHaveBeenCalledTimes(1);
  expect(result.checks).toContainEqual(expect.objectContaining({
    key: 'storage',
    state: 'ready',
    detail: expect.stringMatching(/durable|database/i),
  }));
});
