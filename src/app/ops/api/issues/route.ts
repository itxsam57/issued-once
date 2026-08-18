import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsRepository, OpsRuntimeUnavailableError } from '@/server/ops/runtimeOps';

export async function GET() {
  if (!(await hasOpsSession())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const issues = await createOpsRepository().listRecent(50);
    return Response.json({
      issues: issues.map((issue) => ({
        ...issue,
        updatedAt: issue.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof OpsRuntimeUnavailableError) {
      return Response.json({ error: 'Owner operations are unavailable' }, { status: 503 });
    }
    console.error('owner issue list failed', error);
    return Response.json({ error: 'Owner issue list failed' }, { status: 500 });
  }
}
