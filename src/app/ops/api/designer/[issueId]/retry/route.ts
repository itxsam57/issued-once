import { z } from 'zod';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsDesignerService } from '@/server/ops/runtimeOwnerOs';

const paramsSchema = z.object({ issueId: z.string().uuid() });

export async function POST(_request: Request, context: { params: Promise<{ issueId: string }> }) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return Response.json({ error: 'Invalid Issue' }, { status: 400 });
  try {
    const result = await createOpsDesignerService().retryFailed(parsed.data.issueId);
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && /failed design|retry/i.test(error.message)) {
      return Response.json({ error: 'Only a failed design can be retried' }, { status: 409 });
    }
    console.error('Owner design retry failed', error);
    return Response.json({ error: 'Designer retry unavailable' }, { status: 503 });
  }
}
