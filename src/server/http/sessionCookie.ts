export const SESSION_COOKIE_NAME = '__Host-io_session';

export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
};
