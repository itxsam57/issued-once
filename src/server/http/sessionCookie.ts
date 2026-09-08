export const SESSION_COOKIE_NAME = '__Host-io_session';
export const CONTACT_CONTINUITY_COOKIE_NAME = '__Host-io_contact_continuity';
export const CONTACT_CONTINUITY_MAX_AGE_SECONDS = 30 * 60;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
};

export const contactContinuityCookieOptions = {
  ...sessionCookieOptions,
  maxAge: CONTACT_CONTINUITY_MAX_AGE_SECONDS,
};

export function sessionTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  for (const segment of cookieHeader.split(';')) {
    const separator = segment.indexOf('=');
    if (separator <= 0) continue;
    if (segment.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    const token = segment.slice(separator + 1).trim();
    return token || null;
  }

  return null;
}
