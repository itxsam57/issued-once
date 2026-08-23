import { z } from 'zod';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsSupportService } from '@/server/ops/runtimeOwnerOs';

const schema = z.object({ requestId: z.string().uuid(), status: z.enum(['OPEN','CLOSED']) });
export async function POST(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid support state' }, { status: 400 });
  try { await createOpsSupportService().setStatus(parsed.data); return Response.json({ ok: true }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Support state failed' }, { status: 409 }); }
}
