import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsDashboardRepository } from '@/server/ops/runtimeOwnerOs';
import { OpsRuntimeUnavailableError } from '@/server/ops/runtimeOps';

export async function GET() {
  if (!(await hasOpsSession())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dashboard = await createOpsDashboardRepository().getDashboard(new Date());
    return Response.json({
      ...dashboard,
      activity: dashboard.activity.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof OpsRuntimeUnavailableError) {
      return Response.json({ error: 'Owner dashboard is unavailable' }, { status: 503 });
    }
    console.error('owner dashboard failed');
    return Response.json({ error: 'Owner dashboard failed' }, { status: 500 });
  }
}
