export const REFERRAL_COOKIE_NAME = '__Host-io_referral';

export const referralCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};
