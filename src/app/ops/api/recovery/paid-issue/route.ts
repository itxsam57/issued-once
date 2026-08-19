import { z } from 'zod';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsRecoveryService } from '@/server/ops/runtimeOwnerOs';

const schema = z.object({ paymentAttemptId: z.string().trim().min(1).max(200) });
export async function POST(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid payment attempt' }, { status: 400 });
  try {
    const issue = await createOpsRecoveryService().resumePaidIssue(parsed.data.paymentAttemptId);
    return Response.json({ ok: true, issue });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Paid Issue recovery failed' }, { status: 409 });
  }
}
