import { z } from 'zod';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsSupportService } from '@/server/ops/runtimeOwnerOs';

const schema = z.object({
  issueId: z.string().uuid(),
  eventKey: z.enum(['PAYMENT_RECEIVED','IN_PRODUCTION','SHIPPED','DELIVERED']),
});

export async function POST(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid notification retry' }, { status: 400 });
  try {
    await createOpsSupportService().retryNotification(parsed.data);
    return Response.json({ queued: true });
  } catch (error) {
    if (error instanceof Error && /failed notification/i.test(error.message)) {
      return Response.json({ error: 'Only a failed notification can be retried' }, { status: 409 });
    }
    console.error('Owner notification retry failed');
    return Response.json({ error: 'Notification retry unavailable' }, { status: 503 });
  }
}
