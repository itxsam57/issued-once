import { z } from 'zod';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsReferralService } from '@/server/ops/runtimeOwnerOs';

const requestSchema = z.object({
  action: z.literal('REQUEST'),
  creatorId: z.string(),
  currency: z.string(),
  details: z.unknown(),
  reason: z.string(),
});
const revealSchema = z.object({ action: z.literal('REVEAL'), payoutId: z.string(), reason: z.string() });
const paidSchema = z.object({ action: z.literal('MARK_PAID'), payoutId: z.string(), reason: z.string() });
const actionSchema = z.discriminatedUnion('action', [requestSchema, revealSchema, paidSchema]);
const noStore = { 'Cache-Control': 'no-store' };

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Referral payout action failed';
  const status = /not found|available|already|settle|payout/i.test(message) ? 409 : 400;
  return Response.json({ error: message }, { status, headers: noStore });
}

export async function POST(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid payout action' }, { status: 400, headers: noStore });

  try {
    const service = createOpsReferralService();
    if (parsed.data.action === 'REQUEST') {
      const result = await service.requestPayout({
        creatorId: parsed.data.creatorId,
        currency: parsed.data.currency,
        details: parsed.data.details,
        reason: parsed.data.reason,
      });
      return Response.json({ ok: true, ...result }, { headers: noStore });
    }
    if (parsed.data.action === 'REVEAL') {
      const value = await service.revealPayoutDetails({ payoutId: parsed.data.payoutId, reason: parsed.data.reason });
      return Response.json({ value }, { headers: noStore });
    }
    const result = await service.markPayoutPaid({ payoutId: parsed.data.payoutId, reason: parsed.data.reason });
    return Response.json({ ok: true, ...result }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}
