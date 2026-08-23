import { describe, expect, it } from 'vitest';
import { deriveNextOrderSessionToken } from '@/server/http/sessionToken';

describe('deriveNextOrderSessionToken', () => {
  it('is deterministic, domain separated, and does not echo the source token', () => {
    const source = 'source-session-token';
    const first = deriveNextOrderSessionToken(source);
    const second = deriveNextOrderSessionToken(source);

    expect(first).toBe(second);
    expect(first).not.toBe(source);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(deriveNextOrderSessionToken('another-session-token')).not.toBe(first);
  });
});
