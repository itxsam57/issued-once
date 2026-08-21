import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsDesignPolicyService } from '@/server/ops/runtimeOwnerOs';
import { OpsRuntimeUnavailableError } from '@/server/ops/runtimeOps';
import type { DesignPolicy } from '@/server/design/DesignPolicy';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

function errorResponse(cause: unknown) {
  if (cause instanceof OpsRuntimeUnavailableError) {
    return Response.json({ error: 'Design policy controls are unavailable' }, { status: 503, headers: NO_STORE });
  }
  const message = cause instanceof Error ? cause.message : 'Design policy action failed';
  return Response.json({ error: message }, { status: /invalid|policy/i.test(message) ? 400 : 409, headers: NO_STORE });
}

export async function GET() {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  try {
    return Response.json(await createOpsDesignPolicyService().getGlobal(), { headers: NO_STORE });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function PUT(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  try {
    const body = await request.json().catch(() => null) as DesignPolicy | null;
    if (!body) return Response.json({ error: 'Design policy is required' }, { status: 400, headers: NO_STORE });
    return Response.json(await createOpsDesignPolicyService().publishGlobal(body), { headers: NO_STORE });
  } catch (cause) {
    return errorResponse(cause);
  }
}
