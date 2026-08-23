import { z } from 'zod';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsWebsiteService } from '@/server/ops/runtimeOwnerOs';

const schema = z.object({
  questionId: z.string().trim().min(1).max(200),
  version: z.number().int().positive(),
  active: z.boolean(),
  weight: z.number().min(0.1).max(100),
});

export async function POST(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid question control' }, { status: 400 });
  try { await createOpsWebsiteService().updateQuestion(parsed.data); return Response.json({ ok: true }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Question update failed' }, { status: 409 }); }
}
