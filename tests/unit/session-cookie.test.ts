import { describe, expect, test } from 'vitest';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/server/http/sessionCookie';

describe('anonymous session cookie', () => {
  test('uses a host-bound httpOnly production cookie with bounded lifetime', () => {
    expect(SESSION_COOKIE_NAME).toBe('__Host-io_session');
    expect(sessionCookieOptions).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
    expect(sessionCookieOptions.maxAge).toBeGreaterThan(0);
    expect(sessionCookieOptions.maxAge).toBeLessThanOrEqual(30 * 24 * 60 * 60);
    expect('domain' in sessionCookieOptions).toBe(false);
  });
});
