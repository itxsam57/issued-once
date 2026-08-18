import { z } from 'zod';
import {
  createManufacturingService,
  ManufacturingRuntimeUnavailableError,
} from '@/server/manufacturing/runtimeManufacturing';
import { enqueueIssueNotification } from '@/server/notifications/notificationQueue';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsRepository, OpsRuntimeUnavailableError } from '@/server/ops/runtimeOps';

const schema = z.object({
  issueId: z.string().uuid(),
  confirmation: z.string().trim().min(1).max(100),
});

export async function POST(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (process.env.PRINTFUL_ALLOW_CONFIRM !== 'true') {
    return Response.json({ error: 'Printful production confirmation is disabled' }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid confirmation' }, { status: 400 });

  try {
    const issue = await createOpsRepository().findById(parsed.data.issueId);
    if (!issue) return Response.json({ error: 'Issue not found' }, { status: 404 });
    if (parsed.data.confirmation !== `CONFIRM ${issue.issueCode}`) {
      return Response.json({ error: `Type CONFIRM ${issue.issueCode}` }, { status: 400 });
    }

    const job = await createManufacturingService().confirmDraft(parsed.data.issueId);
    await enqueueIssueNotification(job.issueId, 'IN_PRODUCTION');
    return Response.json({ manufacturingJobId: job.id, state: job.state });
  } catch (error) {
    if (
      error instanceof ManufacturingRuntimeUnavailableError ||
      error instanceof OpsRuntimeUnavailableError
    ) {
      return Response.json({ error: 'Manufacturing is unavailable' }, { status: 503 });
    }
    if (error instanceof Error && /draft|confirm|printful/i.test(error.message)) {
      return Response.json({ error: 'Manufacturing draft is not ready to confirm' }, { status: 409 });
    }
    console.error('ops manufacturing confirmation failed', error);
    return Response.json({ error: 'Manufacturing confirmation failed' }, { status: 500 });
  }
}
