import { afterEach, describe, expect, test, vi } from 'vitest';
import { CheckoutStartService } from '@/server/checkout/CheckoutStartService';
import { CheckoutRuntimeUnavailableError } from '@/server/checkout/runtimeCheckout';

const originalEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  FOURTHWALL_STOREFRONT_TOKEN: process.env.FOURTHWALL_STOREFRONT_TOKEN,
  FOURTHWALL_SHOP_DOMAIN: process.env.FOURTHWALL_SHOP_DOMAIN,
  ENABLE_VISUAL_PREVIEW: process.env.ENABLE_VISUAL_PREVIEW,
};

afterEach(() => {
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('createCheckoutStartService', () => {
  test('constructs the durable checkout stack only when storage and Fourthwall are configured', async () => {
    vi.stubEnv('ENABLE_VISUAL_PREVIEW', '0');
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@example.com/db');
    vi.stubEnv('FOURTHWALL_STOREFRONT_TOKEN', 'ptkn_test');
    vi.stubEnv('FOURTHWALL_SHOP_DOMAIN', 'issued-once.fourthwall.com');
    const { createCheckoutStartService } = await import('@/server/checkout/runtimeCheckout');

    expect(createCheckoutStartService()).toBeInstanceOf(CheckoutStartService);
  });

  test('fails closed when durable storage or Fourthwall configuration is missing', async () => {
    vi.stubEnv('ENABLE_VISUAL_PREVIEW', '0');
    delete process.env.DATABASE_URL;
    delete process.env.FOURTHWALL_STOREFRONT_TOKEN;
    delete process.env.FOURTHWALL_SHOP_DOMAIN;
    const { createCheckoutStartService } = await import('@/server/checkout/runtimeCheckout');

    expect(() => createCheckoutStartService()).toThrow(CheckoutRuntimeUnavailableError);
  });
});
