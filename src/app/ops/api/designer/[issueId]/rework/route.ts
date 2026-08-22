import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsDesignerService } from '@/server/ops/runtimeOwnerOs';

export async function POST(request: Request, context: { params: Promise<{ issueId: string }> }) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { issueId } = await context.params;
    const body = await request.json().catch(() => null) as { mode?: 'regenerate' | 'reinterpret'; reason?: string } | null;
    if (!body?.mode || !['regenerate','reinterpret'].includes(body.mode)) {
      return Response.json({ error: 'Invalid design rework mode' }, { status: 400 });
    }
    const result = await createOpsDesignerService().rework({ issueId, mode: body.mode, reason: body.reason ?? '' });
    return Response.json({ ok: true, generationKey: result.generationKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Design rework failed';
    return Response.json({ error: message }, { status: /reason/i.test(message) ? 400 : 409 });
  }
}
