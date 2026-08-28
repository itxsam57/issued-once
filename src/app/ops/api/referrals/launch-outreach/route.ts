import { z } from 'zod';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createReferralLaunchOutreachService } from '@/server/referrals/runtimeReferralLaunchOutreach';

const schema = z.object({
  confirmation: z.literal('SEND_LAUNCH_REFERRALS'),
  campaign: z.string().default('launch-v1'),
  limit: z.number().int().min(1).max(100).default(50),
});
const noStore = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Explicit launch referral confirmation is required' }, { status: 400, headers: noStore });
  }
  try {
    const result = await createReferralLaunchOutreachService().sendBatch({
      campaign: parsed.data.campaign,
      limit: parsed.data.limit,
    });
    return Response.json({ ok: true, ...result }, { headers: noStore });
  } catch (error) {
    console.error('Referral launch outreach failed', error);
    return Response.json({ error: 'Referral launch outreach unavailable' }, { status: 503, headers: noStore });
  }
}
