import { z } from 'zod';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsReferralService } from '@/server/ops/runtimeOwnerOs';
import type { ReferralRules } from '@/server/referrals/ReferralPolicy';

const rulesSchema = z.custom<ReferralRules>((value) => Boolean(value && typeof value === 'object' && !Array.isArray(value)));
const updateSchema = z.object({ displayName: z.string(), code: z.string(), rules: rulesSchema });
const activeSchema = z.object({ active: z.boolean() });
const noStore = { 'Cache-Control': 'no-store' };

type Context = { params: Promise<{ creatorId: string }> };

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Referral creator update failed';
  const status = /not found|unique|already/i.test(message) ? 409 : 400;
  return Response.json({ error: message }, { status, headers: noStore });
}

export async function PUT(request: Request, context: Context) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid creator update' }, { status: 400, headers: noStore });
  try {
    const { creatorId } = await context.params;
    const result = await createOpsReferralService().updateCreator(creatorId, parsed.data);
    return Response.json({ ok: true, ...result }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = activeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid creator state' }, { status: 400, headers: noStore });
  try {
    const { creatorId } = await context.params;
    const result = await createOpsReferralService().setCreatorActive(creatorId, parsed.data.active);
    return Response.json({ ok: true, ...result }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}
