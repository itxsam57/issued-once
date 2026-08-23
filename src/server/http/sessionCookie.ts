export const SESSION_COOKIE_NAME = '__Host-io_session';
export const CONTACT_CONTINUITY_COOKIE_NAME = '__Host-io_contact_continuity';

export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
};

export const contactContinuityCookieOptions = {
  ...sessionCookieOptions,
};
