import { cookies } from 'next/headers';
import { z } from 'zod';
import { SESSION_COOKIE_NAME } from '@/server/http/sessionCookie';
import { REFERRAL_COOKIE_NAME } from '@/server/referrals/referralCookie';
import {
  createReferralService,
  ReferralRuntimeUnavailableError,
} from '@/server/referrals/runtimeReferrals';

const applyReferralSchema = z.object({
  quoteId: z.string().trim().min(1).max(128),
  explicitCode: z.string().trim().min(1).max(32).optional(),
});

export async function POST(request: Request) {
  const parsed = applyReferralSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid referral payload' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return Response.json({ error: 'Experience session is required' }, { status: 401 });
  }
  const attributionToken = cookieStore.get(REFERRAL_COOKIE_NAME)?.value;

  try {
    const result = await createReferralService().applyToQuote({
      sessionToken,
      quoteId: parsed.data.quoteId,
      ...(parsed.data.explicitCode ? { explicitCode: parsed.data.explicitCode } : {}),
      ...(attributionToken ? { attributionToken } : {}),
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof ReferralRuntimeUnavailableError) {
      return Response.json({ error: 'Referral service is unavailable' }, { status: 503 });
    }
    if (
      error instanceof Error &&
      /experience not found|frozen after checkout|does not belong|latest quote|gross amount/i.test(error.message)
    ) {
      return Response.json({ error: 'Referral state conflict' }, { status: 409 });
    }
    console.error('referral application failed', error);
    return Response.json({ error: 'Referral could not be applied' }, { status: 500 });
  }
}
