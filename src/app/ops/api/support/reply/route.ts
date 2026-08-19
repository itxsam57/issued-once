import { z } from 'zod';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsSupportService } from '@/server/ops/runtimeOwnerOs';

const schema = z.object({ requestId: z.string().uuid(), message: z.string().trim().min(2).max(5000) });
export async function POST(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid support reply' }, { status: 400 });
  try {
    const delivered = await createOpsSupportService().replyToCustomer(parsed.data);
    return Response.json({ ok: true, providerMessageId: delivered.providerMessageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Support reply failed';
    return Response.json({ error: message }, { status: /configured|unavailable/i.test(message) ? 503 : 409 });
  }
}
