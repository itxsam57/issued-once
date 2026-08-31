import { expect, test, vi } from 'vitest';
import { ReadinessService } from '@/server/ops/ReadinessService';

test('privacy readiness fails closed when the active V2 private-payload key is missing', async () => {
  const result = await new ReadinessService({
    env: {
      NODE_ENV: 'test',
      QUIZ_ENCRYPTION_KEY_V1: Buffer.alloc(32, 1).toString('base64'),
      IDENTITY_HMAC_KEY: Buffer.alloc(32, 2).toString('base64'),
    },
    databasePing: vi.fn(async () => false),
    catalogAuthorityPing: vi.fn(async () => false),
    storagePing: vi.fn(async () => false),
    queuePing: vi.fn(async () => false),
    fetchImpl: vi.fn() as typeof fetch,
  }).check();

  expect(result.checks).toContainEqual(expect.objectContaining({
    key: 'privacy',
    state: 'missing',
    detail: expect.stringMatching(/v2/i),
  }));
  expect(result.readyForSandbox).toBe(false);
});
