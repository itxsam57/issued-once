import { z } from 'zod';
import { ManufacturingRuntimeUnavailableError } from '@/server/manufacturing/runtimeManufacturing';
import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsManufacturingService } from '@/server/ops/runtimeOwnerOs';

const schema = z.object({ issueId: z.string().uuid() });

export async function POST(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid issue' }, { status: 400 });

  try {
    const job = await createOpsManufacturingService().createDraft(parsed.data.issueId);
    return Response.json({
      manufacturingJobId: job.id,
      state: job.state,
      providerOrderId: job.providerOrderId,
    });
  } catch (error) {
    if (error instanceof ManufacturingRuntimeUnavailableError) {
      return Response.json({ error: 'Manufacturing is unavailable' }, { status: 503 });
    }
    if (error instanceof Error && /approved|mapping|input|artwork|eligible|printful/i.test(error.message)) {
      return Response.json({ error: 'Issue is not ready for a manufacturing draft' }, { status: 409 });
    }
    console.error('ops manufacturing draft failed');
    return Response.json({ error: 'Manufacturing draft failed' }, { status: 500 });
  }
}
