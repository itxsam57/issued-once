import { z } from 'zod';
import { createDesignService, DesignRuntimeUnavailableError } from '@/server/design/runtimeDesign';
import {
  InternalOperationsUnauthorizedError,
  requireInternalAuthorization,
} from '@/server/http/internalAuth';

const schema = z.object({ issueId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    requireInternalAuthorization(request.headers);
  } catch (error) {
    if (error instanceof InternalOperationsUnauthorizedError) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return Response.json({ error: 'Owner operations are unavailable' }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid issue' }, { status: 400 });

  try {
    const job = await createDesignService().approveForManufacturing(parsed.data.issueId);
    return Response.json({ designJobId: job.id, state: job.state });
  } catch (error) {
    if (error instanceof DesignRuntimeUnavailableError) {
      return Response.json({ error: 'Design operations are unavailable' }, { status: 503 });
    }
    if (error instanceof Error && /review|approval|artwork|resolution|dimensions|png|https|bytes/i.test(error.message)) {
      return Response.json({ error: 'Design is not ready for manufacturing' }, { status: 409 });
    }
    console.error('design approval failed', error);
    return Response.json({ error: 'Design approval failed' }, { status: 500 });
  }
}
