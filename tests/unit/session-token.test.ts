import { describe, expect, test } from 'vitest';
import { createSessionToken, hashSessionToken } from '@/server/http/sessionToken';

describe('anonymous session tokens', () => {
  test('creates opaque high-entropy tokens and stores only a deterministic hash', () => {
    const token = createSessionToken();
    const hash = hashSessionToken(token);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashSessionToken(token)).toBe(hash);
  });

  test('generates distinct tokens across independent sessions', () => {
    expect(createSessionToken()).not.toBe(createSessionToken());
  });
});
