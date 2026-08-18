import { afterEach, expect, test } from 'vitest';
import {
  createOpsSessionValue,
  verifyOpsSessionValue,
} from '@/server/ops/opsAuth';

afterEach(() => {
  delete process.env.INTERNAL_OPERATIONS_TOKEN;
});

test('derives a fixed owner session value without exposing the operations token', () => {
  process.env.INTERNAL_OPERATIONS_TOKEN = 'owner-secret-token-that-is-long';
  const value = createOpsSessionValue();
  expect(value).toMatch(/^[a-f0-9]{64}$/);
  expect(value).not.toContain('owner-secret');
  expect(verifyOpsSessionValue(value)).toBe(true);
  expect(verifyOpsSessionValue('0'.repeat(64))).toBe(false);
});

test('owner session auth fails closed when operations token is not configured safely', () => {
  expect(() => createOpsSessionValue()).toThrow(/configured/i);
  process.env.INTERNAL_OPERATIONS_TOKEN = 'short';
  expect(() => createOpsSessionValue()).toThrow(/safely/i);
});
