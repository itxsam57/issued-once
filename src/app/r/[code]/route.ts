import { cookies } from 'next/headers';
import { REFERRAL_COOKIE_NAME, referralCookieOptions } from '@/server/referrals/referralCookie';
import { createReferralService } from '@/server/referrals/runtimeReferrals';

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const target = new URL('/begin', request.url);
  const { code } = await context.params;

  try {
    const captured = await createReferralService().captureLink(code);
    const cookieStore = await cookies();
    cookieStore.set(REFERRAL_COOKIE_NAME, captured.token, {
      ...referralCookieOptions,
      expires: captured.expiresAt,
    });
  } catch {
    // Referral capture fails closed: the ordinary customer journey remains available.
  }

  return Response.redirect(target, 307);
}
