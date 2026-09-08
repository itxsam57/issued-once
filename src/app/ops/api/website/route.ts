import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsWebsiteService } from '@/server/ops/runtimeOwnerOs';

export async function GET() {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const state = await createOpsWebsiteService().getState();
    return Response.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('Owner website control failed');
    return Response.json({ error: 'Website controls unavailable' }, { status: 503 });
  }
}
