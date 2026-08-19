import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsDesignerService } from '@/server/ops/runtimeOwnerOs';

export async function POST(request: Request, context: { params: Promise<{ issueId: string }> }) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { issueId } = await context.params;
    const body = await request.json().catch(() => null) as { decision?: 'approve' | 'revise'; reason?: string; next?: 'regenerate' | 'reinterpret' } | null;
    if (body?.decision === 'approve') {
      await createOpsDesignerService().approve(issueId);
      return Response.json({ ok: true });
    }
    if (body?.decision === 'revise') {
      const result = await createOpsDesignerService().reject({ issueId, reason: body.reason ?? '', next: body.next ?? 'regenerate' });
      return Response.json({ ok: true, generationKey: result.generationKey });
    }
    return Response.json({ error: 'Invalid review decision' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Design review failed';
    return Response.json({ error: message }, { status: /reason/i.test(message) ? 400 : 409 });
  }
}
