import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsDesignerService } from '@/server/ops/runtimeOwnerOs';

export async function POST(request: Request, context: { params: Promise<{ issueId: string }> }) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { issueId } = await context.params;
    const body = await request.json().catch(() => null) as { candidateId?: string; reason?: string } | null;
    if (!body?.candidateId) return Response.json({ error: 'candidateId is required' }, { status: 400 });
    await createOpsDesignerService().selectCandidate({ issueId, candidateId: body.candidateId, reason: body.reason ?? '' });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Candidate selection failed';
    return Response.json({ error: message }, { status: /reason/i.test(message) ? 400 : 409 });
  }
}
