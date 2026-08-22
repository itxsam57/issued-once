import { afterEach, expect, test } from 'vitest';
import { requireInternalAuthorization } from '@/server/http/internalAuth';

afterEach(() => {
  delete process.env.INTERNAL_OPERATIONS_TOKEN;
});

test('accepts only the configured bearer token', () => {
  process.env.INTERNAL_OPERATIONS_TOKEN = 'owner-secret-token-that-is-long';
  expect(() => requireInternalAuthorization(new Headers({
    authorization: 'Bearer owner-secret-token-that-is-long',
  }))).not.toThrow();
  expect(() => requireInternalAuthorization(new Headers({
    authorization: 'Bearer wrong-token',
  }))).toThrow(/unauthorized/i);
});

test('fails closed when owner operations are not configured', () => {
  expect(() => requireInternalAuthorization(new Headers({
    authorization: 'Bearer anything',
  }))).toThrow(/not configured/i);
});
