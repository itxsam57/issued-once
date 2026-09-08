import { hasOpsSession } from '@/server/ops/opsRequest';
import { createOpsSupportService } from '@/server/ops/runtimeOwnerOs';

export async function GET(request: Request) {
  if (!(await hasOpsSession())) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const value = new URL(request.url).searchParams.get('status');
    const status = value === 'OPEN' || value === 'CLOSED' ? value : null;
    const items = await createOpsSupportService().list(status, 100);
    return Response.json({ items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('Owner support queue failed');
    return Response.json({ error: 'Support queue unavailable' }, { status: 503 });
  }
}
