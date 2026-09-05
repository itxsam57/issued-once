import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const referralRuntime = vi.hoisted(() => ({
  enabled: vi.fn(() => false),
  createConversionService: vi.fn(() => ({ markDeliveredIssue: vi.fn() })),
}));

vi.mock('@/server/referrals/runtimeReferrals', () => ({
  referralsAreEnabled: referralRuntime.enabled,
  createReferralConversionService: referralRuntime.createConversionService,
}));

import { createManufacturingEventService } from '@/server/manufacturing/runtimeManufacturing';

const ENV_KEYS = [
  'DATABASE_URL',
  'PRINTFUL_WEBHOOK_PUBLIC_KEY',
  'PRINTFUL_WEBHOOK_SECRET_HEX',
] as const;
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

beforeEach(() => {
  process.env.DATABASE_URL = 'postgresql://user:pass@ep-test-000000.us-east-2.aws.neon.tech/neondb?sslmode=require';
  process.env.PRINTFUL_WEBHOOK_PUBLIC_KEY = 'test-public-key';
  process.env.PRINTFUL_WEBHOOK_SECRET_HEX = '00'.repeat(32);
  referralRuntime.enabled.mockReset().mockReturnValue(false);
  referralRuntime.createConversionService.mockClear();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('Printful event runtime does not attach referral lifecycle while referral rollout is disabled', () => {
  createManufacturingEventService();
  expect(referralRuntime.enabled).toHaveBeenCalledTimes(1);
  expect(referralRuntime.createConversionService).not.toHaveBeenCalled();
});

test('Printful event runtime attaches referral lifecycle only after referral rollout is enabled', () => {
  referralRuntime.enabled.mockReturnValue(true);
  createManufacturingEventService();
  expect(referralRuntime.createConversionService).toHaveBeenCalledTimes(1);
});
