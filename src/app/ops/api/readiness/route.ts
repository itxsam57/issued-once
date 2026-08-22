import { hasOpsSession } from '@/server/ops/opsRequest';
import { createReadinessService } from '@/server/ops/runtimeReadiness';

export async function GET() {
  if (!(await hasOpsSession())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await createReadinessService().check();
    return Response.json(result, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    console.error('ops readiness check failed', error);
    return Response.json({ error: 'Readiness check failed' }, { status: 500 });
  }
}
