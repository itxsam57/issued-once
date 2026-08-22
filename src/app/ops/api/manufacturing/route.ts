import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsManufacturingService } from '@/server/ops/runtimeOwnerOs';

export async function GET() {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const items = await createOpsManufacturingService().listQueue(100);
    return Response.json({
      items: items.map((item) => ({ ...item, updatedAt: item.updatedAt.toISOString() })),
      confirmArmed: process.env.PRINTFUL_ALLOW_CONFIRM === 'true',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Owner manufacturing queue failed', error);
    return Response.json({ error: 'Manufacturing queue unavailable' }, { status: 503 });
  }
}
