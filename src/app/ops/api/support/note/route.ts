import { z } from 'zod';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsSupportService } from '@/server/ops/runtimeOwnerOs';

const schema = z.object({ issueId: z.string().uuid(), body: z.string().trim().min(1).max(10000) });
export async function POST(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid internal note' }, { status: 400 });
  try { await createOpsSupportService().addNote(parsed.data); return Response.json({ ok: true }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Internal note failed' }, { status: 409 }); }
}
