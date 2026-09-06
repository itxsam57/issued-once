import { afterEach, expect, test, vi } from 'vitest';
import {
  createManufacturingEventService,
  ManufacturingRuntimeUnavailableError,
} from '@/server/manufacturing/runtimeManufacturing';

function configure(overrides: Record<string, string> = {}) {
  vi.stubEnv('DATABASE_URL', 'postgresql://user:password@example.com/db');
  vi.stubEnv('PRINTFUL_WEBHOOK_PUBLIC_KEY', 'public-key');
  vi.stubEnv('PRINTFUL_WEBHOOK_SECRET_HEX', 'aa'.repeat(32));
  vi.stubEnv('PRINTFUL_STORE_ID', '123');
  for (const [name, value] of Object.entries(overrides)) vi.stubEnv(name, value);
}

afterEach(() => vi.unstubAllEnvs());

test('invalid Printful webhook store configuration fails as runtime-unavailable server state', () => {
  configure({ PRINTFUL_STORE_ID: 'not-a-store-id' });

  expect(() => createManufacturingEventService()).toThrow(ManufacturingRuntimeUnavailableError);
});
