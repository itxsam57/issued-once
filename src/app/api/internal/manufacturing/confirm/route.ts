import { z } from 'zod';
import {
  InternalOperationsUnauthorizedError,
  requireInternalAuthorization,
} from '@/server/http/internalAuth';
import {
  createManufacturingService,
  ManufacturingRuntimeUnavailableError,
} from '@/server/manufacturing/runtimeManufacturing';

const schema = z.object({
  issueId: z.string().uuid(),
  confirmation: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  try {
    requireInternalAuthorization(request.headers);
  } catch (error) {
    if (error instanceof InternalOperationsUnauthorizedError) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return Response.json({ error: 'Owner operations are unavailable' }, { status: 503 });
  }

  if (process.env.PRINTFUL_ALLOW_CONFIRM !== 'true') {
    return Response.json({ error: 'Printful production confirmation is disabled' }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.confirmation !== `CONFIRM ${parsed.data.issueId}`) {
    return Response.json({ error: 'Exact production confirmation is required' }, { status: 400 });
  }

  try {
    const job = await createManufacturingService().confirmDraft(parsed.data.issueId);
    return Response.json({ manufacturingJobId: job.id, state: job.state });
  } catch (error) {
    if (error instanceof ManufacturingRuntimeUnavailableError) {
      return Response.json({ error: 'Manufacturing is unavailable' }, { status: 503 });
    }
    if (error instanceof Error && /draft|confirm|printful/i.test(error.message)) {
      return Response.json({ error: 'Manufacturing draft is not ready to confirm' }, { status: 409 });
    }
    console.error('manufacturing confirmation failed');
    return Response.json({ error: 'Manufacturing confirmation failed' }, { status: 500 });
  }
}
