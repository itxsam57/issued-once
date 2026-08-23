import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsDesignPolicyService } from '@/server/ops/runtimeOwnerOs';
import { OpsRuntimeUnavailableError } from '@/server/ops/runtimeOps';
import type { DesignPolicyOverride } from '@/server/design/DesignPolicy';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };
type Context = { params: Promise<{ issueId: string }> };

function errorResponse(cause: unknown) {
  if (cause instanceof OpsRuntimeUnavailableError) {
    return Response.json({ error: 'Design policy controls are unavailable' }, { status: 503, headers: NO_STORE });
  }
  const message = cause instanceof Error ? cause.message : 'Design policy action failed';
  return Response.json({ error: message }, { status: /invalid|policy|override/i.test(message) ? 400 : 409, headers: NO_STORE });
}

export async function GET(_request: Request, context: Context) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  try {
    const { issueId } = await context.params;
    return Response.json(await createOpsDesignPolicyService().getEffective(issueId), { headers: NO_STORE });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function PUT(request: Request, context: Context) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  try {
    const { issueId } = await context.params;
    const body = await request.json().catch(() => null) as DesignPolicyOverride | null;
    if (!body || Array.isArray(body) || typeof body !== 'object') {
      return Response.json({ error: 'Design policy override is required' }, { status: 400, headers: NO_STORE });
    }
    return Response.json(await createOpsDesignPolicyService().setIssueOverride(issueId, body), { headers: NO_STORE });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function DELETE(_request: Request, context: Context) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  try {
    const { issueId } = await context.params;
    return Response.json(await createOpsDesignPolicyService().setIssueOverride(issueId, null), { headers: NO_STORE });
  } catch (cause) {
    return errorResponse(cause);
  }
}
