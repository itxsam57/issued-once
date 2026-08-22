import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsDesignerService } from '@/server/ops/runtimeOwnerOs';

export async function POST(_request: Request, context: { params: Promise<{ issueId: string }> }) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { issueId } = await context.params;
    await createOpsDesignerService().approve(issueId);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Design approval failed';
    return Response.json({ error: message }, { status: 409 });
  }
}
