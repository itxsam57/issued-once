import { z } from 'zod';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsReferralService } from '@/server/ops/runtimeOwnerOs';
import type { ReferralRules } from '@/server/referrals/ReferralPolicy';

const rulesSchema = z.custom<ReferralRules>((value) => Boolean(value && typeof value === 'object' && !Array.isArray(value)));
const createSchema = z.object({
  displayName: z.string(),
  email: z.string(),
  code: z.string(),
  rules: rulesSchema,
});
const noStore = { 'Cache-Control': 'no-store' };

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Referral operation failed';
  const status = /unique|already|not found|available|payout/i.test(message) ? 409 : 400;
  return Response.json({ error: message }, { status, headers: noStore });
}

export async function GET() {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const service = createOpsReferralService();
    const [creators, payouts] = await Promise.all([service.listCreators(), service.listPayouts()]);
    return Response.json({
      creators,
      payouts: payouts.map((payout) => ({
        ...payout,
        requestedAt: payout.requestedAt.toISOString(),
        paidAt: payout.paidAt?.toISOString() ?? null,
      })),
    }, { headers: noStore });
  } catch {
    console.error('Owner referral list failed');
    return Response.json({ error: 'Referral data unavailable' }, { status: 503, headers: noStore });
  }
}

export async function POST(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid creator' }, { status: 400, headers: noStore });
  try {
    const result = await createOpsReferralService().createCreator(parsed.data);
    return Response.json({ ok: true, ...result }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}
