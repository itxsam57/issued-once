import { afterEach, describe, expect, test, vi } from 'vitest';
import { PaidOrderWebhookService } from '@/server/issues/PaidOrderWebhookService';
import { PaidOrderRuntimeUnavailableError } from '@/server/issues/runtimePaidOrders';

const originalEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  FOURTHWALL_WEBHOOK_SECRET: process.env.FOURTHWALL_WEBHOOK_SECRET,
  FOURTHWALL_SHOP_ID: process.env.FOURTHWALL_SHOP_ID,
};

afterEach(() => {
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('createPaidOrderRuntime', () => {
  test('constructs the durable paid-order stack only when all server configuration exists', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@example.com/db');
    vi.stubEnv('FOURTHWALL_WEBHOOK_SECRET', 'whsec_test');
    vi.stubEnv('FOURTHWALL_SHOP_ID', 'shop_1');
    const { createPaidOrderRuntime } = await import('@/server/issues/runtimePaidOrders');

    const runtime = createPaidOrderRuntime();
    expect(runtime.service).toBeInstanceOf(PaidOrderWebhookService);
    expect(runtime.webhookSecret).toBe('whsec_test');
    expect(runtime.shopId).toBe('shop_1');
    expect(runtime.apiVersion).toBe('V1');
  });

  test('fails closed when database, webhook secret, or expected shop is missing', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.FOURTHWALL_WEBHOOK_SECRET;
    delete process.env.FOURTHWALL_SHOP_ID;
    const { createPaidOrderRuntime } = await import('@/server/issues/runtimePaidOrders');

    expect(() => createPaidOrderRuntime()).toThrow(PaidOrderRuntimeUnavailableError);
  });
});
