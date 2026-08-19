import { z } from 'zod';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsManufacturingService } from '@/server/ops/runtimeOwnerOs';

const schema = z.object({
  issueId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});

export async function POST(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Issue and reason are required' }, { status: 400 });
  try {
    await createOpsManufacturingService().quarantine(parsed.data.issueId, parsed.data.reason);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Quarantine failed';
    return Response.json({ error: message }, { status: 409 });
  }
}
