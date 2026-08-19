import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsAuditService } from '@/server/ops/runtimeOwnerOs';

export async function GET(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    const page = await createOpsAuditService().listRecent({ cursor, limit: 50 });
    return Response.json({
      items: page.items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      nextCursor: page.nextCursor,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Owner audit stream failed', error);
    return Response.json({ error: 'Audit stream unavailable' }, { status: 503 });
  }
}
